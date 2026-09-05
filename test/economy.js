// 长线经济模拟：仓库余额有没有把"战备成本"变成真决策
// 用法：node test/economy.js [玩家数] [每人局数]
//
// 要盯两个失败方向，两边都是设计事故：
//   往下：玩家被打到买不起标准勤务组、长期卡在轻装出不来 —— 体验断裂
//   往上：钱涨到怎么打都买得起重装回收组 —— 余额约束形同虚设，等于白做
const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const meta = require('../miniprogram/core/meta')
const { ESCAPE_CHOICE } = require('../miniprogram/data/events')

const PLAYERS = parseInt(process.argv[2] || '400', 10)
const RUNS = parseInt(process.argv[3] || '40', 10)
const { LOADOUTS } = engine
const escapeOption = (state, method) => {
  const rawIdx = ESCAPE_CHOICE.options.findIndex(o => o.method === method)
  return state.node.options.find(o => o.idx === rawIdx)
}

function memStore() {
  const box = { v: null }
  return { get() { return box.v }, set(k, v) { box.v = v } }
}

// 局内决策：跟 sim.js 的 mixed 打法一致（血厚偏激进，双电源走索道、血厚走列车、否则走雪橇）
function pickOption(state) {
  const opts = state.node.options.filter(o => !o.disabled)
  if (!opts.length) return state.node.options[0].idx
  if (state.node.type === 'loot') {
    const grab = opts.find(o => o.text.includes('顶着枪声'))
    if (grab) return state.hp >= 55 ? grab.idx : opts.find(o => o !== grab).idx
    const it = state.pendingLoot.items[state.pendingLoot.idx]
    const take = opts.find(o => o.text.includes('装进背包'))
    const skip = opts.find(o => o !== take)
    const fits = state.weight + it.weight <= state.capacity
    return (fits || it.tier === 'red' || it.tier === 'gold') ? take.idx : skip.idx
  }
  const pull = opts.find(o => !o.disabled && o.verb === '合闸')
  if (pull && state.levers < 2) return pull.idx
  if (state.node.type === 'escape') {
    if (state.weight > state.capacity + 5) engine.dropHeaviest(state)
    const wait = opts.find(o => o.idx >= ESCAPE_CHOICE.options.length)
    if (wait && state.levers >= 2) return wait.idx
    const heli = escapeOption(state, 'heli')
    const rocket = escapeOption(state, 'rocket')
    if (state.levers >= 2 && heli) return heli.idx
    const heavy = state.weight > state.safebox
    if (rocket && (state.hp > 65 || (heavy && state.hp > 52))) return rocket.idx
    return opts[opts.length - 1].idx
  }
  return state.hp >= 70 ? opts[0].idx : opts[opts.length - 1].idx
}

// 战备口味：买得起就上最好的 / 永远标准勤务 / 一律轻装勘探
const TASTES = {
  best: m => (meta.affordable(m).full ? 'full' : meta.affordable(m).half ? 'half' : 'knife'),
  steady: m => (meta.affordable(m).half ? 'half' : 'knife'),
  rat: () => 'knife'
}

function playOne(m) {
  const taste = m.__taste
  const want = TASTES[taste](m)
  const charged = meta.charge(m, want)
  assert.ok(charged.ok, `${taste} 想带${want}却扣款失败，余额 ${m.balance} —— 破产地板破了`)

  const state = engine.newRun({ balance: m.balance + charged.cost })
  const opt = state.node.options.find(o => o.loadout === want)
  // 这里必须严格：一旦匹配不上就静默回落到"第一个可用项"，
  // 就会出现“按轻装收钱、实际打重装”的免费装备，整组经济数据全废
  assert.ok(opt, `战备页找不到 ${want} 这一项，decorateNode 是不是没透出 loadout 字段`)
  assert.ok(!opt.disabled, `${want} 在战备页被禁用，和 meta.affordable 的判断不一致`)
  engine.choose(state, opt.idx)
  assert.strictEqual(state.loadout, want, `想带 ${want}，实际进场是 ${state.loadout}`)

  let guard = 0
  while (!state.ended && guard++ < 40) {
    if (state.alive && state.hp < 50 && state.meds > 0) engine.useMed(state)
    engine.autoSecureBest(state)
    engine.choose(state, pickOption(state))
  }
  if (!state.report) return null
  meta.settle(m, state.report)
  // 带出格数 vs 背包容量：重装 45 万买的主要就是那多出来的 5 格，
  // 要是局里根本填不满，这笔钱等于买了个空袋子
  if (state.report.escaped) {
    const grids = (state.report.lootItems || []).reduce((a, it) => a + (it.weight || 0), 0)
    m.__grids = (m.__grids || 0) + grids
    m.__wins = (m.__wins || 0) + 1
    m.__fill = (m.__fill || 0) + grids / state.capacity
  }
  return state.report
}

const players = []
for (const taste of Object.keys(TASTES)) {
  for (let i = 0; i < PLAYERS; i++) {
    const m = meta.load(memStore())
    m.__taste = taste
    players.push(m)
  }
}

// 逐局推进所有玩家，按局数留快照
const SNAPS = [1, 5, 10, 20, 40].filter(n => n <= RUNS)
const history = {}   // taste → { run → [余额...] }
const brokeEver = {}
for (const t of Object.keys(TASTES)) { history[t] = {}; brokeEver[t] = 0 }

let crashes = 0
for (let r = 1; r <= RUNS; r++) {
  for (const m of players) {
    try { if (!playOne(m)) crashes++ } catch (e) {
      crashes++
      if (crashes <= 3) console.error('CRASH:', e.message)
    }
    if (meta.isBroke(m) && !m.__brokeSeen) { m.__brokeSeen = true; brokeEver[m.__taste]++ }
  }
  if (SNAPS.includes(r)) {
    for (const m of players) {
      (history[m.__taste][r] = history[m.__taste][r] || []).push(m.balance)
    }
  }
}

const wan = n => (n / 10000).toFixed(1) + '万'
function pctl(arr, p) {
  const a = arr.slice().sort((x, y) => x - y)
  return a[Math.min(a.length - 1, Math.floor(a.length * p))]
}

const TASTE_NAME = { best: '买得起就上最好的', steady: '只用标准勤务组', rat: '一律轻装勘探' }
console.log(`\n===== 长线经济 · 每种打法 ${PLAYERS} 个玩家 × 各打 ${RUNS} 局 =====`)
console.log(`起步资金 ${wan(meta.START_BALANCE)}｜重装 ${wan(LOADOUTS.full.cost)}｜标准 ${wan(LOADOUTS.half.cost)}｜轻装 0\n`)

for (const t of Object.keys(TASTES)) {
  console.log(`【${TASTE_NAME[t]}】`)
  console.log('局数\t余额中位数\t两成最惨\t两成最壕\t买得起重装占比')
  for (const r of SNAPS) {
    const arr = history[t][r]
    const rich = arr.filter(b => b >= LOADOUTS.full.cost).length / arr.length
    console.log(`第${r}局\t${wan(pctl(arr, 0.5))}\t\t${wan(pctl(arr, 0.2))}\t\t${wan(pctl(arr, 0.8))}\t\t${(rich * 100).toFixed(0)}%`)
  }
  const finals = history[t][SNAPS[SNAPS.length - 1]]
  const stuck = finals.filter(b => b < LOADOUTS.half.cost).length / finals.length
  console.log(`期间跌到买不起标准组过: ${(brokeEver[t] / PLAYERS * 100).toFixed(0)}%｜最后仍卡在轻装: ${(stuck * 100).toFixed(0)}%`)
  const mine = players.filter(p => p.__taste === t && p.__wins)
  const wins = Math.max(1, mine.reduce((a, p) => a + p.__wins, 0))
  const grids = mine.reduce((a, p) => a + p.__grids, 0) / wins
  const fill = mine.reduce((a, p) => a + p.__fill, 0) / wins
  console.log(`撤离成功时平均带出 ${grids.toFixed(1)} 格，背包填满度 ${(fill * 100).toFixed(0)}%\n`)
}

// ===== 门禁 =====
const last = SNAPS[SNAPS.length - 1]
assert.strictEqual(crashes, 0, `模拟里有 ${crashes} 局崩了`)

// 1) 任何打法都不能被永久卡死：轻装零成本、局均还有得赚，就一定能爬回来
for (const t of Object.keys(TASTES)) {
  const finals = history[t][last]
  const stuck = finals.filter(b => b < LOADOUTS.half.cost).length / finals.length
  assert.ok(stuck <= 0.35,
    `${TASTE_NAME[t]}：打满 ${last} 局还有 ${(stuck * 100).toFixed(0)}% 的人买不起标准勤务组，经济太陡`)
}

// 2) 余额约束不能形同虚设：重装是最贵的一档，一路顺风也该有人买不起
{
  const finals = history.best[last]
  const rich = finals.filter(b => b >= LOADOUTS.full.cost).length / finals.length
  assert.ok(rich <= 0.97,
    `打满 ${last} 局有 ${(rich * 100).toFixed(0)}% 的人随时买得起重装回收组，仓库约束基本没了`)
}

// 3) 轻装勘探必须真能翻身：这是破产玩家唯一的出路，不能是死路
{
  const finals = history.rat[last]
  const up = finals.filter(b => b > meta.START_BALANCE).length / finals.length
  assert.ok(up >= 0.35,
    `一律轻装打满 ${last} 局只有 ${(up * 100).toFixed(0)}% 的人比起步更有钱，破产玩家爬不回来`)
}

console.log('经济门禁通过：三种打法都不会被永久卡死 · 仓库约束仍然起作用 · 轻装能翻身')
