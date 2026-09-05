let audio = null

function audioCtx() {
  if (audio) return audio
  if (typeof wx === 'undefined') return null
  try {
    if (typeof wx.createWebAudioContext === 'function') audio = wx.createWebAudioContext()
  } catch (e) { audio = null }
  return audio
}

function beep(kind) {
  const ctx = audioCtx()
  if (!ctx || typeof ctx.createOscillator !== 'function') return
  const table = {
    hit: [160, 0.1, 'sawtooth'],
    dead: [78, 0.28, 'sawtooth'],
    loot: [540, 0.11, 'square'],
    win: [392, 0.18, 'triangle'],
    heal: [330, 0.12, 'sine'],
    ok: [260, 0.07, 'square'],
    bad: [118, 0.14, 'sawtooth']
  }
  const spec = table[kind] || table.ok
  try {
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.type = spec[2]
    osc.frequency.value = spec[0]
    gain.gain.value = 0.05
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.start()
    const stopAt = (ctx.currentTime || 0) + spec[1]
    osc.stop(stopAt)
    if (gain.gain.exponentialRampToValueAtTime) {
      gain.gain.exponentialRampToValueAtTime(0.001, stopAt)
    }
  } catch (e) { /* 基础库不含 WebAudio 时静默 */ }
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
      wx.vibrateShort({
        type: kind === 'hit' || kind === 'bad' ? 'heavy' : kind === 'loot' ? 'medium' : 'light'
      })
    }
  } catch (e) { /* 部分真机没有震动权限 */ }
}

function liveSting() {
  return typeof wx !== 'undefined' && typeof wx.vibrateShort === 'function'
}

function classify(prev, next, messages) {
  if (next.ended && next.alive === false) return { kind: 'dead', label: '没能回来' }
  if (next.ended && next.report && next.report.escaped) return { kind: 'win', label: '活着出来了' }
  const hpDelta = (next.hp || 0) - (prev.hp || 0)
  const lootGain = (next.loot ? next.loot.length : 0) - (prev.lootCount || 0)
  const text = (messages && messages[0]) || ''
  const all = (messages || []).join(' ')
  const fight = !!(prev && prev.fight)
  const fail = /✗ |失败|失利/.test(all)
  if (hpDelta < 0) {
    if (fight || fail) {
      return { kind: 'bad', label: `${hpDelta} 生命`, hpDelta, mark: 'bad', stamp: '失手' }
    }
    return { kind: 'hit', label: `${hpDelta} 生命`, hpDelta, mark: 'bad', stamp: '挨打' }
  }
  if (lootGain > 0 || /收入背包|顺手拿走|拿到 /.test(text)) {
    const item = next.loot && next.loot[next.loot.length - 1]
    return {
      kind: 'loot',
      label: item ? item.name : '物资入手',
      item: item || null,
      lootGain,
      mark: 'ok',
      stamp: '入手'
    }
  }
  if (hpDelta > 0) return { kind: 'heal', label: `+${hpDelta} 生命` }
  if (fail) return { kind: 'bad', label: '失手', mark: 'bad', stamp: '失手' }
  if (fight && /✓ |到手|制服|奏效/.test(all)) {
    return { kind: 'ok', label: '得手', mark: 'ok', stamp: '得手' }
  }
  if (/撤离成功|到手|制服|奏效/.test(text)) return { kind: 'ok', label: '得手', mark: 'ok', stamp: '得手' }
  return { kind: 'ok', label: '' }
}

function burst(kind, width, height) {
  const n = kind === 'loot' || kind === 'win' ? 22 : kind === 'hit' || kind === 'dead' || kind === 'bad' ? 16 : 8
  const color = kind === 'hit' || kind === 'dead' || kind === 'bad'
    ? '#ff6b6b'
    : kind === 'loot' || kind === 'win' ? '#ffc65c' : '#65d6b4'
  const bits = []
  const cx = width / 2
  const cy = height * 0.4
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 * i) / n + Math.random() * 0.4
    const sp = 2.2 + Math.random() * 4.5
    bits.push({
      x: cx, y: cy,
      vx: Math.cos(a) * sp,
      vy: Math.sin(a) * sp - 1.2,
      life: 1,
      color
    })
  }
  return bits
}

module.exports = { vibrate, classify, liveSting, burst, beep }
