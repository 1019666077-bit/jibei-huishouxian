// 内容盘点 + 硬门禁：文字游戏的命脉是"玩到第几局开始重复"，这个数必须量出来而不是拍脑袋
// 用法：node test/audit.js [每个玩家的局数] [模拟玩家数]
const { EVENTS, SPAWNS, CORE_ROOM_ADJ } = require('../miniprogram/data/events')
const { ITEM_POOL, LOOT_TABLES } = require('../miniprogram/data/items')
const engine = require('../miniprogram/core/engine')

const RUNS_PER_PLAYER = Number(process.argv[2]) || 30
const PLAYERS = Number(process.argv[3]) || 200

// ---- 验收线（来自 docs/内容扩容方案.md，改这里等于改验收标准）----
const GATE = {
  randomPool: 60,       // 随机池大小：每局抽 5~6 个事件，60 才撑得到第 30 局
  perCoreRoom: 3,       // 每个核心房间的事件数：房间相邻限制会砍掉三四成有效池
  marginalAtLast: 0.3,  // 最后一局仍能遇到的新节点数：低于这个数就是"没新内容了"
  repeatRateRun2: 0.55, // 第2局的节点重复率上限：第二局就大面积重样是最伤的
  coldNodes: 0          // 一次都没触发过的节点：写了却摸不到等于没写
}

// ===== 1) 存量 =====
// 只有 EVENTS + SPAWNS 属于"内容库"；拾取/转移/撤离/战备是流程节点，不该算进覆盖率
const CONTENT_IDS = new Set([...EVENTS.map(e => e.id), ...SPAWNS.map(s => s.id)])
const randomPool = EVENTS.filter(e => !e.entryOnly)

const byZone = {}
const byRoom = {}
let optCount = 0
let phaseTagged = 0
let whenTagged = 0
for (const e of EVENTS) {
  const z = e.zone || '(无区域)'
  byZone[z] = (byZone[z] || 0) + 1
  if (e.room) byRoom[e.room] = (byRoom[e.room] || 0) + 1
  optCount += e.options.length
  if (e.phase) phaseTagged++
  if (e.when) whenTagged++
}

console.log('=== 内容存量 ===')
console.log(`事件节点 ${EVENTS.length} 个（随机池 ${randomPool.length} + 入口 ${EVENTS.length - randomPool.length}）· 选项 ${optCount} 条 · 平均每节点 ${(optCount / EVENTS.length).toFixed(1)} 个选择`)
console.log(`其中阶段变体 ${phaseTagged} 个 · 状态变体 ${whenTagged} 个`)
console.log(`出生点 ${SPAWNS.length} 个 · 出生选项 ${SPAWNS.reduce((s, x) => s + x.options.length, 0)} 条`)
const itemCount = Object.keys(ITEM_POOL).reduce((s, k) => s + ITEM_POOL[k].length, 0)
console.log(`物品 ${itemCount} 种（${Object.keys(ITEM_POOL).length} 个品质档）· 掉落表 ${Object.keys(LOOT_TABLES).length} 张`)

console.log('\n按区域：')
for (const [k, v] of Object.entries(byZone).sort((a, b) => b[1] - a[1])) console.log(`  ${k}\t${v}`)
console.log('\n研究城内环按房间：')
for (const [k, v] of Object.entries(byRoom).sort((a, b) => b[1] - a[1])) console.log(`  ${k}\t${v}`)

// ===== 2) 重复度：模拟"一个新玩家连打 N 局"，看第几局开始没新东西 =====
// 每个玩家独立统计自己见过什么——用一条 300 局的连续轨迹算覆盖率会把结论算漂
function playOne(first) {
  const s = first
    ? engine.newRun({ autoLoadout: 'half', opener: true })
    : engine.newRun()
  const seen = new Set()
  let guard = 0
  while (!s.ended && guard++ < 40) {
    if (s.node && CONTENT_IDS.has(s.node.id)) seen.add(s.node.id)
    const usable = s.node.options.filter(o => !o.disabled)
    if (!usable.length) break
    engine.choose(s, usable[Math.floor(Math.random() * usable.length)].idx)
  }
  return seen
}

const newPerRun = new Array(RUNS_PER_PLAYER).fill(0)   // 第 i 局平均见到几个"这辈子还没见过"的节点
const seenPerRun = new Array(RUNS_PER_PLAYER).fill(0)  // 第 i 局平均见到几个节点
const repeatPerRun = new Array(RUNS_PER_PLAYER).fill(0)// 第 i 局里"以前见过"的占比
const everSeen = new Set()

for (let p = 0; p < PLAYERS; p++) {
  const known = new Set()
  for (let r = 0; r < RUNS_PER_PLAYER; r++) {
    const seen = playOne(r === 0)
    let fresh = 0
    for (const id of seen) {
      everSeen.add(id)
      if (!known.has(id)) { fresh++; known.add(id) }
    }
    newPerRun[r] += fresh
    seenPerRun[r] += seen.size
    repeatPerRun[r] += seen.size ? (seen.size - fresh) / seen.size : 0
  }
}
const avgNew = i => newPerRun[i] / PLAYERS
const avgSeen = i => seenPerRun[i] / PLAYERS
const avgRepeat = i => repeatPerRun[i] / PLAYERS

console.log(`\n=== 重复度（${PLAYERS} 个玩家 × 各打 ${RUNS_PER_PLAYER} 局）===`)
console.log(`单局平均见到 ${avgSeen(0).toFixed(1)} 个节点（内容库 ${CONTENT_IDS.size}）`)
const marks = [1, 2, 3, 5, 10, 20, RUNS_PER_PLAYER].filter((v, i, a) => v <= RUNS_PER_PLAYER && a.indexOf(v) === i)
console.log('局数\t本局新内容\t本局重复率')
for (const m of marks) {
  console.log(`第${m}局\t${avgNew(m - 1).toFixed(2)} 个\t\t${(avgRepeat(m - 1) * 100).toFixed(0)}%`)
}

// 没被摸到的节点：写了但玩家几乎看不到的内容
const cold = [...CONTENT_IDS].filter(id => !everSeen.has(id))
if (cold.length) {
  console.log(`\n=== ${PLAYERS * RUNS_PER_PLAYER} 局都没触发的节点（${cold.length} 个）===`)
  for (const id of cold) {
    const e = EVENTS.find(x => x.id === id)
    console.log(`  ${id}\t[${e ? (e.zone || '-') + (e.room ? '/' + e.room : '') : '出生点'}]${e && e.phase ? ' phase=' + e.phase : ''}${e && e.when ? ' when=' + e.when : ''}`)
  }
}

// ===== 3) 门禁 =====
const fails = []
if (randomPool.length < GATE.randomPool) {
  fails.push(`随机池只有 ${randomPool.length} 个，要求 ≥${GATE.randomPool}`)
}
for (const room of Object.keys(CORE_ROOM_ADJ)) {
  const n = byRoom[room] || 0
  if (n < GATE.perCoreRoom) fails.push(`内环房间 ${room} 只有 ${n} 个事件，要求 ≥${GATE.perCoreRoom}`)
}
const last = avgNew(RUNS_PER_PLAYER - 1)
if (last < GATE.marginalAtLast) {
  fails.push(`第 ${RUNS_PER_PLAYER} 局只剩 ${last.toFixed(2)} 个新节点，要求 ≥${GATE.marginalAtLast}`)
}
if (RUNS_PER_PLAYER >= 2 && avgRepeat(1) > GATE.repeatRateRun2) {
  fails.push(`第 2 局重复率 ${(avgRepeat(1) * 100).toFixed(0)}%，要求 ≤${GATE.repeatRateRun2 * 100}%`)
}
if (cold.length > GATE.coldNodes) {
  fails.push(`有 ${cold.length} 个节点一次都没触发（要求 ≤${GATE.coldNodes}）`)
}

if (fails.length) {
  console.error('\n内容门禁未通过：')
  for (const f of fails) console.error('  ✗ ' + f)
  process.exit(1)
}
console.log('\n内容门禁通过：存量/房间均衡/新鲜度/冷门节点全部达标')
