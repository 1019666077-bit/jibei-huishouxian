// 弹药系统专项：穿深矩阵、发数消耗、跳弹惩罚、口径补给与换枪
const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const { AMMO_TYPES, GUNS, makeAmmo, ammoGrids } = require('../miniprogram/data/ammo')
const { EVENTS } = require('../miniprogram/data/events')

function start(loadout) {
  const state = engine.newRun()
  engine.choose(state, state.node.options.find(o => o.loadout === loadout).idx)
  return state
}

function optionBy(state, eventId, predicate) {
  const event = EVENTS.find(e => e.id === eventId)
  const rawIdx = event.options.findIndex(predicate)
  return state.node.options.find(o => o.idx === rawIdx)
}

// ---- 1) 三档战备的枪与弹要跟 GUNS 表一致 ----
const expectedAmmoNames = {
  dawn6: '曙光重型穿芯弹',
  dawn4: '曙光标准穿芯弹',
  short1: '短锋训练弹'
}
for (const key of ['full', 'half', 'knife']) {
  const state = start(key)
  const gun = GUNS[key]
  assert.strictEqual(state.gun.caliber, gun.caliber, `${key} 口径不对`)
  assert.strictEqual(state.ammo.id, gun.ammo, `${key} 弹种不对`)
  assert.strictEqual(state.ammo.name, expectedAmmoNames[gun.ammo], `${key} 弹药显示名不对`)
  assert.strictEqual(state.ammo.rounds, gun.rounds, `${key} 带弹量不对`)
  assert.strictEqual(state.ammo.pen, AMMO_TYPES[gun.ammo].pen, `${key} 穿深不对`)
}

// ---- 2) 穿深矩阵：每种弹打每档护板，跳弹判定必须一致 ----
const state = start('full')
for (const type of Object.keys(AMMO_TYPES)) {
  for (const armor of [0, 3, 4, 5, 6]) {
    state.ammo = makeAmmo(type, 500)
    const opt = { rounds: 40, armor, base: 60 }
    const expected = Math.max(0, armor - AMMO_TYPES[type].pen)
    assert.strictEqual(engine.penGap(state, opt), expected,
      `${type}(${AMMO_TYPES[type].pen}穿) 打 ${armor} 级甲的穿深差算错`)
    // 跳弹耗弹翻倍
    assert.strictEqual(engine.roundsNeeded(state, opt), expected > 0 ? 80 : 40,
      `${type} 打 ${armor} 级甲的耗弹翻倍规则不对`)
    // 跳弹每差一级判定 -15
    const clean = makeAmmo('dawn6', 500)
    state.ammo = clean
    const full = engine.successChance(state, 60, { rounds: 40, armor: 0 })
    state.ammo = makeAmmo(type, 500)
    const real = engine.successChance(state, 60, opt)
    if (expected > 0 && real > 10) {
      assert.strictEqual(full - real, expected * 15, `${type} 打 ${armor} 级甲的判定惩罚不对`)
    }
  }
}

// ---- 3) 锁头 / 背身偷袭绕开护甲 ----
state.ammo = makeAmmo('short1', 500)   // 1穿短锋弹
assert.strictEqual(engine.penGap(state, { rounds: 30, armor: 6 }), 5, '手枪打六套甲应该差5级')
assert.strictEqual(engine.penGap(state, { rounds: 30, armor: 6, backstab: true }), 0, '背身行动不该判跳弹')
assert.strictEqual(engine.penGap(state, { rounds: 30, armor: 5, headshot: true }), 0, '锁定面部传感器不该判跳弹')

// ---- 4) 走完整 choose 流程：发数真扣、跳弹真记账 ----
const shoot = start('full')
shoot.step = 2
shoot.zone = 'aurora'
shoot.ammo = makeAmmo('dawn3', 200)          // 3穿去打加强护板 = 差2级，耗弹翻倍
shoot.node = { id: 'aurora_vault' }
engine.refreshNode(shoot)
const assault = optionBy(shoot, 'aurora_vault', o => o.rounds === 80 && o.armor === 5)
assert.ok(assault, '零号资产柜强攻选项缺失')
assert.ok(assault.costText.includes('跳弹'), `3穿打加强护板应标出跳弹：${assault.costText}`)
// 固定成打输：打赢会触发战场补弹，剩余发数就不好断言了
const realRandom = Math.random
Math.random = () => 0.999
try {
  engine.choose(shoot, assault.idx)
} finally {
  Math.random = realRandom
}
assert.strictEqual(shoot.ammoUsed, 160, '3穿打加强护板应扣双倍160发')
assert.strictEqual(shoot.ammo.rounds, 40, '扣弹后余量不对')
assert.strictEqual(shoot.ironHits, 1, '跳弹次数没记上')

// 跳弹后还打输：反击伤害要多吃三成（aurora_vault 失败是 -48，跳弹后 -62）
assert.strictEqual(shoot.hp, 38, `跳弹失败的加重伤害不对：hp=${shoot.hp}`)

// ---- 5) 弹药占格：60发一格，打空腾出来 ----
assert.strictEqual(ammoGrids(0), 0)
assert.strictEqual(ammoGrids(1), 1)
assert.strictEqual(ammoGrids(60), 1)
assert.strictEqual(ammoGrids(120), 2)
const load = start('full')
assert.strictEqual(engine.loadGrids(load), 3, '重装回收组180发应占3格')
load.ammo.rounds = 0
assert.strictEqual(engine.loadGrids(load), 0, '打空后弹药不该继续占格')

// ---- 6) 备弹不够时射击选项必须禁用，且不能靠直接调引擎绕过 ----
const dry = start('half')
dry.ammo.rounds = 10
dry.zone = 'aurora'
dry.step = 4
dry.node = { id: 'aurora_vault' }
engine.refreshNode(dry)
const node6 = dry.node
const attack = optionBy(dry, 'aurora_vault', o => o.rounds === 80 && o.armor === 5)
if (attack) {
  assert.ok(attack.disabled, '备弹10发还能强攻零号资产柜守备班')
  assert.ok(attack.disabledReason.includes('备弹不够'), `禁用原因应说明缺弹：${attack.disabledReason}`)
  const snapshot = dry.ammo.rounds
  engine.choose(dry, attack.idx)
  assert.strictEqual(dry.ammo.rounds, snapshot, '禁用的射击选项被强行执行并扣了弹')
}
assert.ok(node6.options.some(o => !o.disabled), '缺弹时必须还留有不用枪的活路')

// ---- 7) 轻装发射器对重型护板：背身行动应绕开护板 ----
const rat = start('knife')
rat.zone = 'core'
rat.lastRoom = 'storm'
rat.step = 2
rat.node = { id: 'core_takeover' }
engine.refreshNode(rat)
const takeover = optionBy(rat, 'core_takeover', o => o.backstab === true)
assert.ok(takeover, '背身接管装备选项缺失')
assert.ok(!takeover.disabled, '轻装勘探组30发应该够背身行动的30发')
assert.ok(takeover.costText.indexOf('跳弹') === -1, '背身行动不该显示跳弹')

console.log('弹药系统自检通过：穿深矩阵/锁头背身/耗弹翻倍/占格/缺弹禁用全部正确')
