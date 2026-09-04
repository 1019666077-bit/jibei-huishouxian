// 路线静态自检：固化极夜研究城地理，任何路线改动跑一遍就能抓出穿越/断链
// 用法：node test/routes.js（sim 前先跑这个）
const { SPAWNS, EVENTS, CORE_ROOM_ADJ, MOVE_ROUTES, MOVE_CHOICE_CORE } = require('../miniprogram/data/events')
const engine = require('../miniprogram/core/engine')
const { makeItem } = require('../miniprogram/data/items')

const ids = new Set(EVENTS.map(e => e.id))
const byId = id => EVENTS.find(e => e.id === id)
let fails = 0
const err = m => { console.error('  ✗ ' + m); fails++ }

// ---- 1) 所有 goEvent 目标必须存在（断链=玩家卡死在半路）----
const allNodes = [...SPAWNS, ...EVENTS, ...Object.values(MOVE_ROUTES), MOVE_CHOICE_CORE]
for (const node of allNodes) {
  for (const o of node.options || []) {
    for (const eff of [o, o.success, o.fail]) {
      if (eff && eff.goEvent && !ids.has(eff.goEvent)) {
        err(`${node.id}: goEvent '${eff.goEvent}' 不存在`)
      }
    }
  }
}

// ---- 2) 入口贴边房间表：每个入口只能直达贴着它的房间 ----
// 北侧连桥接冷却舱/磁悬舱；东侧供能沟接冷却舱/暗光仓；
// 西堤气密门接压缩机房/磁悬舱/潮汐坞；南侧配重井接暗光仓/压缩机房/潮汐坞。
const ENTRY_ROOMS = {
  entry_north: ['coolant', 'maglev'],
  entry_east:  ['coolant', 'dimhold'],
  entry_west:  ['compressor', 'maglev', 'tide'],
  entry_south: ['dimhold', 'compressor', 'tide']
}
for (const [id, rooms] of Object.entries(ENTRY_ROOMS)) {
  const node = byId(id)
  if (!node) { err(`缺少入口节点 ${id}`); continue }
  for (const o of node.options) {
    const go = o.success && o.success.goEvent
    if (!go) continue
    const target = byId(go)
    if (!target) continue // 断链已在 1) 报过
    if (target.zone === 'aurora') continue // 登极光指挥塔的显式路线在 3) 单独校验
    if (target.room && !rooms.includes(target.room)) {
      err(`${id} → ${go}(${target.room})：该房间不贴这个入口`)
    }
  }
}

// ---- 3) 内环房间事件的显式流转必须走相邻房间；登塔只允许三条既定路线 ----
// 磁悬侧梯(maglev)、暗光维护梯(dimhold)、风暴庭院升降梯(storm 或入口节点)
const AURORA_FROM_ROOMS = ['maglev', 'dimhold', 'storm']
for (const e of EVENTS) {
  if (e.zone !== 'core' || !e.room) continue
  for (const o of e.options || []) {
    const go = o.success && o.success.goEvent
    if (!go) continue
    const target = byId(go)
    if (!target) continue
    if (target.zone === 'aurora') {
      if (!AURORA_FROM_ROOMS.includes(e.room)) {
        err(`${e.id}(${e.room}) 登塔：只有磁悬侧梯/暗光维护梯/风暴庭院升降梯三条路`)
      }
      continue
    }
    if (target.room && target.room !== e.room && !(CORE_ROOM_ADJ[e.room] || []).includes(target.room)) {
      err(`${e.id}(${e.room}) → ${go}(${target.room})：房间不相邻，等于瞬移`)
    }
  }
}

// ---- 4) 相邻表必须对称（A 挨着 B 则 B 必挨着 A）----
for (const [room, adj] of Object.entries(CORE_ROOM_ADJ)) {
  for (const other of adj) {
    if (!(CORE_ROOM_ADJ[other] || []).includes(room)) {
      err(`CORE_ROOM_ADJ 不对称：${room}→${other} 有，${other}→${room} 没有`)
    }
  }
  if (!engine.ROOM_NAMES[room]) err(`ROOM_NAMES 缺房间 ${room}，路线条会丢中文名`)
}

// ---- 5) 路线语义校验：防止“文字进去了，状态还在外面”或“写刷卡却不扣卡”----
const CARD_ACTION = /(刷|用)通行芯片|刷芯片/
const ENTER_CORE_LOG = /(进入|切入|挤入|抵达|落入)内环/
for (const node of allNodes) {
  for (const o of node.options || []) {
    if (CARD_ACTION.test(o.text) && (!o.cost || o.cost.card !== 1)) {
        err(`${node.id}: 「${o.text}」写了刷通行芯片，但没有消耗通行芯片×1`)
    }
    for (const [result, eff] of [['成功', o.success], ['失败', o.fail]]) {
      if (!eff) continue
      if (eff.moveTo === 'core' && !eff.goEvent) {
        err(`${node.id} ${result}进入内环却没有 goEvent，下一步会随机落房间`)
      }
      if (ENTER_CORE_LOG.test(eff.log || '') && eff.moveTo !== 'core') {
        err(`${node.id} ${result}文案说进入内环，但状态没有 moveTo: 'core'`)
      }
    }
    if (o.success && o.success.levers && !o.success.leverRoom) {
      err(`${node.id}: 「${o.text}」增加供电进度，却没有标明 blue/cent，可能重复接通同一路`)
    }
    if (o.need && o.need.leverRoom && (!o.success || o.success.leverRoom !== o.need.leverRoom)) {
      err(`${node.id}: 「${o.text}」的配电柄门槛与成功落点不一致`)
    }
  }
}

// ---- 6) phase / when 字段合法性：写错的标签会静默让事件永不出现，必须静态抓住 ----
const PHASES = ['early', 'mid', 'late']
const WHEN_KEYS = Object.keys(engine.WHEN)
for (const e of EVENTS) {
  if (e.phase && !PHASES.includes(e.phase)) {
    err(`${e.id}: phase '${e.phase}' 不合法（只能是 ${PHASES.join('/')}）`)
  }
  if (e.when) {
    const key = e.when.charAt(0) === '!' ? e.when.slice(1) : e.when
    if (!WHEN_KEYS.includes(key)) {
      err(`${e.id}: when '${e.when}' 没有对应谓词（engine.WHEN 里有：${WHEN_KEYS.join('/')}）`)
    }
  }
  if (e.phase && e.entryOnly) {
    err(`${e.id}: entryOnly 节点不进随机池，标 phase 没有意义`)
  }
}

// ---- 6b) 指定物品必须能在物品表里找到（名字写错就会静默发不出东西）----
for (const node of allNodes) {
  for (const o of node.options || []) {
    for (const eff of [o.success, o.fail]) {
      if (eff && eff.item && !makeItem(eff.item)) {
        err(`${node.id}: 指定物品「${eff.item}」在 ITEM_POOL 里不存在`)
      }
    }
  }
}

// ---- 7) 每个核心房间要留够"无 phase"的通用事件当地基 ----
// 阶段变体是增量，不能把一个房间的事件全打上阶段标签——否则那个房间在别的阶段就成了空白
const MIN_GENERIC_PER_ROOM = 2
const roomStat = {}
for (const e of EVENTS) {
  if (e.zone !== 'core' || !e.room) continue
  const s = roomStat[e.room] || (roomStat[e.room] = { total: 0, generic: 0 })
  s.total++
  if (!e.phase && !e.when) s.generic++
}
for (const room of Object.keys(CORE_ROOM_ADJ)) {
  const s = roomStat[room] || { total: 0, generic: 0 }
  if (s.generic < MIN_GENERIC_PER_ROOM) {
    err(`内环房间 ${room} 只有 ${s.generic} 个无 phase/when 的通用事件（要求 ≥${MIN_GENERIC_PER_ROOM}），阶段变体会把这个房间切出空白`)
  }
}

if (fails) {
  console.error(`\n路线自检失败：${fails} 处问题`)
  process.exit(1)
} else {
  console.log('路线自检通过：断链/房间地理/芯片成本/文字状态/阶段谓词全部一致')
}
