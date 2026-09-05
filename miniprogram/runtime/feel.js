let audio = null

function audioCtx() {
  if (audio) return audio
  if (typeof wx === 'undefined') return null
  try {
    if (typeof wx.createWebAudioContext === 'function') audio = wx.createWebAudioContext()
  } catch (e) { audio = null }
  return audio
}

function tone(ctx, freq, dur, wave, delay) {
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = wave
    osc.frequency.value = freq
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    const startAt = (ctx.currentTime || 0) + (delay || 0)
    const stopAt = startAt + dur
    osc.start(startAt)
    osc.stop(stopAt)
    if (gain.gain.exponentialRampToValueAtTime) {
      gain.gain.setValueAtTime(0.05, startAt)
      gain.gain.exponentialRampToValueAtTime(0.001, stopAt)
    }
  } catch (e) { /* 基础库不含 WebAudio 时静默 */ }
}

function beep(kind) {
  const ctx = audioCtx()
  if (!ctx || typeof ctx.createOscillator !== 'function') return
  const table = {
    hit: [[170, 0.08, 'sawtooth'], [110, 0.12, 'sawtooth']],
    dead: [[78, 0.28, 'sawtooth']],
    loot: [[784, 0.05, 'square'], [988, 0.06, 'square'], [1174, 0.08, 'square'], [1568, 0.05, 'triangle']],
    win: [[392, 0.1, 'triangle'], [523, 0.1, 'triangle'], [659, 0.12, 'triangle']],
    heal: [[330, 0.12, 'sine']],
    ok: [[247, 0.06, 'square'], [370, 0.1, 'square']],
    bad: [[196, 0.06, 'sawtooth'], [131, 0.09, 'sawtooth'], [73, 0.18, 'sawtooth']],
    lever: [[330, 0.06, 'triangle'], [392, 0.07, 'triangle'], [523, 0.12, 'triangle']],
    extract: [[196, 0.06, 'sine'], [262, 0.07, 'sine'], [330, 0.08, 'sine'], [440, 0.14, 'triangle']]
  }
  const notes = table[kind] || table.ok
  notes.forEach((spec, i) => {
    tone(ctx, spec[0], spec[1], spec[2], i ? notes[0][1] * 0.72 : 0)
  })
}

function vibrate(kind) {
  beep(kind)
  if (typeof wx === 'undefined') return
  try {
    if (kind === 'dead' && typeof wx.vibrateLong === 'function') {
      wx.vibrateLong()
      return
    }
    if (typeof wx.vibrateShort === 'function') {
      const heavy = kind === 'hit' || kind === 'bad' || kind === 'dead'
      const medium = kind === 'loot' || kind === 'lever' || kind === 'extract'
      wx.vibrateShort({ type: heavy ? 'heavy' : medium ? 'medium' : 'light' })
    }
  } catch (e) { /* 部分真机没有震动权限 */ }
}

function liveSting() {
  return typeof wx !== 'undefined' && typeof wx.vibrateShort === 'function'
}

function classify(prev, next, messages) {
  if (next.ended && next.alive === false) {
    return { kind: 'dead', label: '没能回来', stamp: '倒了', mark: 'bad' }
  }
  if (next.ended && next.report && next.report.escaped) {
    return { kind: 'win', label: '活着出来了', stamp: '出来了', mark: 'ok' }
  }
  const hpDelta = (next.hp || 0) - (prev.hp || 0)
  const lootGain = (next.loot ? next.loot.length : 0) - (prev.lootCount || 0)
  const leverGain = (next.levers || 0) - ((prev && prev.levers) || 0)
  const text = (messages && messages[0]) || ''
  const all = (messages || []).join(' ')
  const fight = !!(prev && prev.fight)
  const fail = /✗ |失败|失利/.test(all)
  if (hpDelta < 0 && prev.tutorial && (prev.step || 0) <= 3 && hpDelta >= -8) {
    return { kind: 'scratch', label: '擦伤', sub: `${hpDelta} 生命`, hpDelta, mark: 'ok', stamp: '擦伤' }
  }
  if (hpDelta < 0) {
    if (fight || fail) {
      return { kind: 'bad', label: '失手', sub: `${hpDelta} 生命`, hpDelta, mark: 'bad', stamp: '失手' }
    }
    return { kind: 'hit', label: '挨打', sub: `${hpDelta} 生命`, hpDelta, mark: 'bad', stamp: '挨打' }
  }
  if (lootGain > 0 || /收入背包|顺手拿走|拿到 /.test(text)) {
    const item = next.loot && next.loot[next.loot.length - 1]
    return {
      kind: 'loot',
      label: '入手',
      sub: item ? item.name : '物资入手',
      item: item || null,
      lootGain,
      mark: 'ok',
      stamp: '入手'
    }
  }
  if (leverGain > 0 || /供电进度|配电柄已合上|双电源/.test(all)) {
    const n = next.levers || 0
    if (n >= 2) return { kind: 'lever', label: '电源通了', sub: '点索道撤离', mark: 'ok', stamp: '通电' }
    return { kind: 'lever', label: `合闸 ${n}/2`, sub: '再去另一处配电房', mark: 'ok', stamp: '合闸' }
  }
  if (hpDelta > 0) return { kind: 'heal', label: `+${hpDelta} 生命`, stamp: '回血', mark: 'ok', sub: `+${hpDelta} 生命` }
  if (fail) return { kind: 'bad', label: '失手', mark: 'bad', stamp: '失手' }
  if (fight && /✓ |到手|制服|奏效/.test(all)) {
    return { kind: 'ok', label: '得手', mark: 'ok', stamp: '得手' }
  }
  if ((prev && prev.extract) || /转向撤离/.test(all)) {
    return { kind: 'extract', label: '撤离', mark: 'ok', stamp: '撤离', sub: '选一条撤出' }
  }
  if (/撤离成功|到手|制服|奏效/.test(text)) return { kind: 'ok', label: '得手', mark: 'ok', stamp: '得手' }
  if (prev.tutorial && (prev.step || 0) <= 2) {
    return { kind: 'ok', label: '得手', mark: 'ok', stamp: '得手', sub: '继续合闸' }
  }
  return { kind: 'ok', label: '' }
}

function burst(kind, width, height) {
  const n = kind === 'loot' || kind === 'win' ? 32
    : kind === 'extract' ? 24
    : kind === 'lever' ? 20
    : kind === 'hit' || kind === 'dead' || kind === 'bad' ? 28
    : kind === 'scratch' ? 16
    : 12
  const color = kind === 'hit' || kind === 'dead' || kind === 'bad'
    ? '#ff6b6b'
    : kind === 'loot' || kind === 'win' || kind === 'scratch' ? '#ffc65c'
    : kind === 'lever' ? '#ffe08a'
    : kind === 'extract' ? '#65a9ff' : '#65d6b4'
  const bits = []
  const cx = width / 2
  const cy = height * 0.34
  for (let i = 0; i < n; i++) {
    let a = (Math.PI * 2 * i) / n + Math.random() * 0.28
    let sp = 2.8 + Math.random() * 5.2
    let vx = Math.cos(a) * sp
    let vy = Math.sin(a) * sp - 1.6
    if (kind === 'loot' || kind === 'win') {
      a = -Math.PI / 2 + (Math.random() - 0.5) * 1.4
      vx = Math.cos(a) * (2 + Math.random() * 3.2)
      vy = Math.sin(a) * (4 + Math.random() * 4) - 2.2
    } else if (kind === 'extract') {
      vx = 3.2 + Math.random() * 4.4
      vy = (Math.random() - 0.5) * 2.4
    } else if (kind === 'bad' || kind === 'hit' || kind === 'dead') {
      sp = 3.6 + Math.random() * 5.8
      vx = Math.cos(a) * sp
      vy = Math.sin(a) * sp
    }
    bits.push({ x: cx, y: cy, vx, vy, life: 1, color })
  }
  return bits
}

module.exports = { vibrate, classify, liveSting, burst, beep }
