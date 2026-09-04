// 五种撤收方式结算校验：按 method 锁定路线，不依赖可见文案。
const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const { ESCAPE_CHOICE } = require('../miniprogram/data/events')

function prepare({ levers = 0, rounds = 120, hp = 90 } = {}) {
  const state = engine.newRun()
  engine.choose(state, state.node.options.find(o => o.loadout === 'full').idx)
  state.hp = hp
  state.ammo.rounds = rounds
  state.zone = 'lift'
  state.loot = [
    { name: '远古冰芯样本', tier: 'red', tierLabel: '红·绝密', value: 435000, weight: 2 },
    { name: '地热引燃剂', tier: 'red', tierLabel: '红·绝密', value: 1600000, weight: 12 }
  ]
  state.weight = 14
  state.lootSeq = 0
  engine.autoSecureBest(state)
  if (levers) {
    state.leverRooms = { coolant: true, compressor: levers >= 2 }
    state.levers = levers
    state.leverStep = 6
  }
  state.step = 7
  engine.refreshNode(state)
  return state
}

function escapeOption(state, method) {
  const rawIdx = ESCAPE_CHOICE.options.findIndex(o => o.method === method)
  return state.node.options.find(o => o.idx === rawIdx)
}

function runEscape(method, opts, forcePass) {
  const state = prepare(opts)
  const opt = escapeOption(state, method)
  assert.ok(opt, `撤收页没有 method=${method} 选项`)
  assert.ok(!opt.disabled, `method=${method} 被禁用：${opt.disabledReason}`)
  assert.ok(opt.chance > 0 && opt.chance <= 95, `method=${method} 撤收成功率异常：${opt.chance}`)

  const original = Math.random
  Math.random = () => (forcePass ? 0 : 0.999)
  try {
    engine.choose(state, opt.idx)
  } finally {
    Math.random = original
  }

  const r = state.report
  assert.ok(r, `method=${method} 没有生成战报`)
  assert.strictEqual(r.escaped, forcePass, `method=${method} 撤收结果与判定不符`)
  assert.strictEqual(
    r.netProfit,
    r.escaped ? r.totalValue - r.resupply : -r.cost,
    `method=${method} 净利润口径不对`
  )
  assert.strictEqual(r.lootCount, r.lootItems.length, `method=${method} 战报件数与明细不符`)
  if (!forcePass) assert.strictEqual(r.lootItems.length, 0, `method=${method} 失败还带出了物资`)
  return { chance: opt.chance, report: r }
}

const heli = runEscape('heli', { levers: 2 }, true)
assert.strictEqual(heli.report.method, 'heli')
assert.strictEqual(heli.report.lootItems.length, 2, '极地索道应全额带出')

const ambush = runEscape('ambush', { levers: 0 }, true)
assert.strictEqual(ambush.report.method, 'ambush')
assert.ok(ambush.report.combatStats.pvp >= 1, '截停撤收队没有计入队伍战果')
assert.ok(ambush.report.lootItems.length > 2, '截停撤收队没有拿到资产包收益')

const sneak = runEscape('sneak', {}, true)
assert.strictEqual(sneak.report.method, 'sneak')

const rocket = runEscape('rocket', {}, true)
assert.strictEqual(rocket.report.method, 'rocket')
assert.ok(rocket.report.lootItems.length >= 3, '风暴列车没有开出车载封存舱资产')

// 货运雪橇只保安全箱：4格装得下冰芯样本(2格)，12格的地热引燃剂必然留下
const bag = runEscape('bag', {}, true)
assert.strictEqual(bag.report.method, 'bag')
assert.deepStrictEqual(bag.report.lootItems.map(it => it.name), ['远古冰芯样本'])
assert.ok(bag.report.lostItems.some(it => it.name === '地热引燃剂' && it.reason === '雪橇撤收容量不足'))

// 双电源未接通时极地索道必须是禁用状态，不能靠直接调引擎绕过
const noLever = prepare({ levers: 0 })
const heliOpt = escapeOption(noLever, 'heli')
assert.ok(heliOpt.disabled && heliOpt.disabledReason.includes('双电源'), '未接通双电源的极地索道没有禁用')
const before = JSON.stringify({ ended: noLever.ended, step: noLever.step })
engine.choose(noLever, heliOpt.idx)
assert.strictEqual(JSON.stringify({ ended: noLever.ended, step: noLever.step }), before, '禁用的极地索道撤收被强行执行了')

// 每种方式的失败分支也要能干净结算
for (const [method, levers] of [['heli', 2], ['ambush', 0], ['sneak', 0], ['rocket', 0], ['bag', 0]]) {
  runEscape(method, { levers }, false)
}

// 双电源接通后，借用他队窗口和截停撤收队两条备用路不该再出现
const bothLevers = prepare({ levers: 2 })
for (const method of ['sneak', 'ambush']) {
  assert.ok(!escapeOption(bothLevers, method), `双电源已接通还显示 method=${method}`)
}

console.log('五种撤收自检通过：索道/截停/借窗/列车/雪橇的成功与失败分支、双电源门禁全部正确')
