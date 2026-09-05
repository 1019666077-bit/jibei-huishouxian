// 画面层用的短标：引擎仍保存完整选项，这里只决定玩家看见哪几个字。
const ZONE_SHORT = {
  harbor: '冻港',
  weather: '塔群',
  thermal: '管廊',
  lift: '升降场',
  core: '内环',
  aurora: '指挥塔',
  extract: '撤离'
}

const ZONE_POS = {
  weather: { x: 0.50, y: 0.16 },
  aurora: { x: 0.50, y: 0.30 },
  harbor: { x: 0.16, y: 0.42 },
  core: { x: 0.50, y: 0.46 },
  thermal: { x: 0.50, y: 0.64 },
  lift: { x: 0.84, y: 0.42 },
  extract: { x: 0.84, y: 0.80 }
}

const ROOM_POS = {
  maglev: { x: 0.38, y: 0.38 },
  coolant: { x: 0.62, y: 0.38 },
  storm: { x: 0.50, y: 0.46 },
  dimhold: { x: 0.68, y: 0.52 },
  compressor: { x: 0.38, y: 0.54 },
  tide: { x: 0.50, y: 0.58 }
}

function clip(text, n) {
  const source = String(text == null ? '' : text).replace(/\s+/g, '')
  if (source.length <= n) return source
  if (n <= 1) return '…'
  return source.slice(0, n - 1) + '…'
}

function firstBeat(text) {
  const raw = String(text == null ? '' : text)
  const beat = raw.split(/[。！？；：]/)[0].split('，')[0]
  return clip(beat, 16)
}

function spot(node) {
  if (!node) return ''
  if (node.text && /货运雪橇已离站/.test(node.text)) return '货运雪橇已离站'
  if (node.spot) return clip(node.spot, 16)
  if (node.type === 'move') return '下一段走哪'
  if (node.type === 'escape') return '选一条撤'
  if (node.type === 'loadout') return '带什么进场'
  if (node.revealItem) return node.revealItem.name
  if (node.type === 'loot') return '有人来了'
  return firstBeat(node.text)
}

function verb(opt) {
  if (!opt) return '继续'
  if (opt.verb) return clip(opt.verb, 8)
  if (opt.method === 'heli') return '索道'
  if (opt.method === 'rocket') return '列车'
  if (opt.method === 'sneak') return '混入'
  if (opt.method === 'ambush') return '截停'
  if (opt.method === 'bag') return '雪橇'
  if (opt.wait) return '等窗口'
  if (opt.loadout === 'full') return '重装'
  if (opt.loadout === 'half') return '标准'
  if (opt.loadout === 'knife') return '轻装'
  if (opt.lootAction === 'take') return '装箱'
  if (opt.lootAction === 'skip') return '留下'
  if (opt.lootAction === 'grabAll') return '全翻'
  if (opt.lootAction === 'flee') return '撤'
  const t = String(opt.text || '')
  if (/配电柄|合上/.test(t)) return '合闸'
  const go = opt.goEvent || ''
  if (go) {
    if (/aurora/.test(go)) return '上塔'
    if (/coolant/.test(go)) return '冷却舱'
    if (/maglev/.test(go)) return '磁悬舱'
    if (/dimhold/.test(go)) return '暗光仓'
    if (/compressor/.test(go)) return '压缩机'
    if (/tide/.test(go)) return '潮汐坞'
    if (/storm/.test(go)) return '庭院'
    if (/entry_north/.test(go)) return '北侧'
    if (/entry_east/.test(go)) return '东侧'
    if (/entry_west/.test(go)) return '西侧'
    if (/entry_south/.test(go)) return '南侧'
    if (/wt_|weather/.test(go)) return '塔群'
  }
  if (opt.moveTo && ZONE_SHORT[opt.moveTo]) return ZONE_SHORT[opt.moveTo]
  if (/芯片/.test(t) && /门|气闸|穿|渠/.test(t)) return '刷门'
  if (/砸开|砸柜/.test(t)) return '砸柜'
  if (/开枪|射击|击穿|击落/.test(t)) return '开枪'
  if (opt.rounds) {
    if (/截|伏|守|卡/.test(t)) return '截击'
    return '开火'
  }
  if (/拆|开柜|翻|搜|取/.test(t) && !opt.safe) return '开柜'
  if (opt.safe) {
    if (/搜|取|翻|拆|扫/.test(t)) return '搜'
    if (/等|等待/.test(t)) return '等'
    if (/放弃|离开|绕|不碰|不进|记下|标记/.test(t)) return '绕开'
    if (/贴墙|撤/.test(t)) return '撤'
    return '绕开'
  }
  if (opt.goEvent) return '进去'
  return clip(t, 6) || '继续'
}

function toast(messages) {
  const line = String((messages && messages[0]) || '')
  if (!line) return ''
  const named = line.match(/\[([^\]]+)\]\s*([^\s（(+]+)/)
  if (named && /收入背包|顺手拿走|拿到 |接管 \[|检查战场/.test(line)) return named[2]
  const hp = line.match(/-(\d+)\s*HP/)
  if (hp) return `-${hp[1]}`
  if (/生命归零|倒在|没能回来/.test(line)) return '倒了'
  if (/撤离成功|活着出来/.test(line)) return '出来了'
  if (/⚠/.test(line)) return clip(line.replace(/⚠\s*/, ''), 10)
  if (/合闸|供电|索道/.test(line)) return clip(line.replace(/（[^）]*）/g, ''), 14)
  return clip(line.replace(/（[^）]*）/g, '').replace(/配给点.*/g, ''), 12)
}

// 局内主文案：完整句的前半拍，避免按钮只剩含糊动词。
function caption(opt) {
  if (!opt) return '继续'
  const raw = String(opt.full || opt.text || '')
  if (raw) {
    const beat = raw.split(/[。！？；：]/)[0].replace(/\s+/g, '')
    if (beat) return clip(beat, 16)
  }
  return verb(opt)
}

const OPTION_ROW_H = 64

function isLever(opt) {
  if (!opt) return false
  if (opt.verb === '合闸' || opt.verb === '穿庭合闸') return true
  if (opt.verb) return false
  const t = String(opt.text || opt.full || '')
  return /^合上.+配电柄/.test(t) || /^合闸/.test(t)
}

function isLeverHint(opt) {
  if (!opt || isLever(opt)) return false
  return /可合闸/.test(String(opt.costText || ''))
}

// 底部列表用完整前半句，交给两行省略，不再先裁成 16 字。
function listTitle(opt) {
  if (!opt) return '继续'
  const raw = String(opt.full || opt.text || '').replace(/\s+/g, '')
  if (!raw) return verb(opt)
  const beat = raw.split(/[。！？]/)[0]
  return beat || raw
}

function leverGuide(run) {
  if (!run || run.ended || (run.levers || 0) >= 2) return ''
  const node = run.node || {}
  const options = node.options || []
  const hasLever = options.some(isLever)
  const hasHint = options.some(isLeverHint)
  const room = node.room || run.lastRoom
  const nearLever = room === 'coolant' || room === 'compressor'
  if (hasLever) return run.levers === 1 ? '再合闸，开索道' : '点「合闸」接通电源，开索道'
  if (run.zone === 'core' || nearLever) {
    return run.levers === 1 ? '去另一处配电房合闸' : '冷却舱·压缩机房可合闸开索道'
  }
  if (hasHint) return '进内环可合闸开索道'
  return ''
}

function isTravel(opt) {
  if (!opt) return false
  return !!(opt.moveTo || opt.goEvent || opt.method || opt.wait)
}

function useMap(node) {
  if (!node) return false
  if (node.type === 'move' || node.type === 'escape') return true
  if (node.type === 'loadout' || node.type === 'loot') return false
  if (node.free) return true
  const options = node.options || []
  if (options.length < 2) return false
  const travel = options.filter(isTravel).length
  return travel >= 2 && travel * 2 >= options.length
}

function useRoom(node) {
  if (!node) return false
  if (useMap(node)) return false
  if (node.type === 'loadout') return false
  return true
}

function pinZone(opt, node) {
  if (!opt) return (node && node.zone) || 'harbor'
  if (opt.method || opt.wait) return 'extract'
  if (opt.moveTo && ZONE_POS[opt.moveTo]) return opt.moveTo
  const go = opt.goEvent || ''
  if (/aurora/.test(go)) return 'aurora'
  if (/wt_|weather/.test(go)) return 'weather'
  if (/harbor/.test(go)) return 'harbor'
  if (/lift/.test(go)) return 'lift'
  if (/ind_|thermal/.test(go)) return 'thermal'
  if (/entry_|core_|coolant|maglev|dimhold|compressor|tide|storm/.test(go)) return 'core'
  if (node && node.room && ROOM_POS[node.room]) return 'core'
  return (node && node.zone) || 'harbor'
}

function propKind(opt) {
  if (!opt) return 'crate'
  if (opt.lootAction === 'take') return 'take'
  if (opt.lootAction === 'skip' || opt.lootAction === 'flee') return 'door'
  if (opt.rounds) return 'threat'
  if (opt.safe) return 'door'
  return 'crate'
}

function propName(opt) {
  const kind = propKind(opt)
  if (kind === 'threat') return '交火点'
  if (kind === 'door') {
    if (opt && opt.lootAction === 'skip') return '先走'
    if (opt && opt.lootAction === 'flee') return '出口'
    return '门口'
  }
  if (kind === 'take') return clip(String((opt && (opt.full || opt.text)) || '这件'), 8)
  if (opt && opt.lootAction === 'grabAll') return '一堆'
  return '货柜'
}

function useOptionList(node) {
  return ((node && node.options) || []).length >= 4
}

function layoutRoom(node, rect) {
  const options = (node && node.options) || []
  const slots = [
    { nx: 0.20, ny: 0.50 },
    { nx: 0.50, ny: 0.34 },
    { nx: 0.80, ny: 0.50 },
    { nx: 0.30, ny: 0.76 },
    { nx: 0.70, ny: 0.76 }
  ]
  const used = {}
  const take = prefers => {
    for (let i = 0; i < prefers.length; i++) {
      const index = prefers[i]
      if (index < slots.length && !used[index]) {
        used[index] = true
        return slots[index]
      }
    }
    for (let i = 0; i < slots.length; i++) {
      if (!used[i]) {
        used[i] = true
        return slots[i]
      }
    }
    return slots[0]
  }
  const placed = options.map(opt => {
    const kind = propKind(opt)
    const slot = kind === 'threat' ? take([2, 1, 4])
      : kind === 'door' ? take([0, 3, 4])
      : kind === 'take' ? take([1, 2])
      : take([1, 4, 0])
    return {
      opt,
      kind,
      x: rect.x + slot.nx * rect.w,
      y: rect.y + slot.ny * rect.h,
      nx: slot.nx,
      ny: slot.ny
    }
  })
  placed.forEach((item, index) => {
    for (let prev = 0; prev < index; prev++) {
      const other = placed[prev]
      if (Math.abs(item.x - other.x) < 96 && Math.abs(item.y - other.y) < 50) {
        item.x += item.x >= other.x ? 22 : -22
        item.y += item.y >= other.y ? 18 : -18
        item.x = Math.min(rect.x + rect.w - 40, Math.max(rect.x + 40, item.x))
        item.y = Math.min(rect.y + rect.h - 28, Math.max(rect.y + 24, item.y))
        item.nx = rect.w ? (item.x - rect.x) / rect.w : item.nx
        item.ny = rect.h ? (item.y - rect.y) / rect.h : item.ny
      }
    }
  })
  return placed
}

function layoutPins(node, rect, forceMap) {
  const options = (node && node.options) || []
  const mapped = forceMap || useMap(node)
  const used = {}
  return options.map((opt, index) => {
    let pos
    if (mapped) {
      const zone = pinZone(opt, node)
      pos = ZONE_POS[zone] || ZONE_POS.core
      if (node.room && ROOM_POS[node.room] && zone === 'core' && !opt.moveTo && !opt.method) {
        pos = ROOM_POS[node.room]
      }
      if (opt.method) {
        const methods = ['heli', 'rocket', 'sneak', 'ambush', 'bag']
        const slot = Math.max(0, methods.indexOf(opt.method))
        pos = { x: 0.18 + slot * 0.16, y: 0.82 }
        if (opt.wait) pos = { x: 0.50, y: 0.70 }
      }
    } else {
      const origin = ZONE_POS[(node && node.zone) || 'harbor'] || ZONE_POS.core
      const count = Math.max(1, options.length)
      const ang = -Math.PI / 2 + (index - (count - 1) / 2) * 0.62
      pos = {
        x: origin.x + Math.cos(ang) * 0.22,
        y: origin.y + Math.sin(ang) * 0.18
      }
    }
    const key = `${Math.round(pos.x * 40)}_${Math.round(pos.y * 40)}`
    const bump = used[key] || 0
    used[key] = bump + 1
    if (bump) {
      pos = { x: pos.x + bump * 0.05, y: pos.y + bump * 0.04 }
    }
    const x = Math.min(rect.x + rect.w - 26, Math.max(rect.x + 26, rect.x + pos.x * rect.w))
    const y = Math.min(rect.y + rect.h - 26, Math.max(rect.y + 22, rect.y + pos.y * rect.h))
    return {
      opt,
      x,
      y,
      r: mapped ? 22 : 20,
      nx: rect.w ? (x - rect.x) / rect.w : pos.x,
      ny: rect.h ? (y - rect.y) / rect.h : pos.y
    }
  })
}

module.exports = {
  ZONE_SHORT,
  ZONE_POS,
  ROOM_POS,
  OPTION_ROW_H,
  clip,
  spot,
  verb,
  caption,
  listTitle,
  toast,
  isTravel,
  isLever,
  isLeverHint,
  leverGuide,
  useMap,
  useRoom,
  pinZone,
  layoutPins,
  propKind,
  propName,
  layoutRoom,
  useOptionList
}
