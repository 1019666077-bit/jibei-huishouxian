const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const { ESCAPE_CHOICE } = require('../miniprogram/data/events')

const state = engine.newRun()
const loadoutIdx = state.node.options.find(o => o.loadout === 'half').idx
engine.choose(state, loadoutIdx)

state.loot = [
  { name: '两格绝密', tier: 'red', tierLabel: '红·绝密', value: 500000, weight: 2 },
  { name: '三格金', tier: 'gold', tierLabel: '金', value: 600000, weight: 3 },
  { name: '两格蓝', tier: 'blue', tierLabel: '蓝', value: 200000, weight: 2 }
]
state.weight = 7

const autoIds = engine.autoSecureBest(state)
assert.strictEqual(autoIds.length, 2, '自动装箱应选择两个两格物资')
assert.strictEqual(state.loot.filter(it => it.secured).reduce((s, it) => s + it.weight, 0), 4)

state.loot.forEach(it => { it.secured = false })
const [red, gold, blue] = state.loot
assert.strictEqual(engine.toggleSecure(state, gold.lootId).ok, true)
assert.strictEqual(engine.toggleSecure(state, red.lootId).ok, false, '安全箱超4格必须阻止')
engine.toggleSecure(state, gold.lootId)
engine.toggleSecure(state, red.lootId)
engine.toggleSecure(state, blue.lootId)
assert.strictEqual(engine.dropLoot(state, blue.lootId).name, '两格蓝')
assert.strictEqual(red.secured, true)

state.step = 7
engine.refreshNode(state)
const bagRawIdx = ESCAPE_CHOICE.options.findIndex(o => o.method === 'bag')
const bagIdx = state.node.options.find(o => o.idx === bagRawIdx).idx
const originalRandom = Math.random
Math.random = () => 0
engine.choose(state, bagIdx)
Math.random = originalRandom

assert.strictEqual(state.report.escaped, true)
assert.deepStrictEqual(state.report.lootItems.map(it => it.name), ['两格绝密'])
assert.ok(state.report.lostItems.some(it => it.name === '三格金' && it.reason === '雪橇撤收容量不足'))
assert.ok(state.report.routeTrail.length >= 1)
assert.ok(state.report.resourcesUsed)

console.log('背包/安全箱/指定丢弃/货运雪橇结算自检通过')
