// 局外存档自检：仓库扣款/入账 · 破产地板 · 绝密资产图鉴 · 赛季懒重置 · 老存档兼容
// 用法：node test/meta.js
const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const meta = require('../miniprogram/core/meta')

const { LOADOUTS } = engine
const FULL = LOADOUTS.full.cost      // 45万
const HALF = LOADOUTS.half.cost      // 15万

function memStore(init) {
  const box = { v: init || null }
  return { get() { return box.v }, set(k, v) { box.v = JSON.parse(JSON.stringify(v)) }, _box: box }
}

// 造一份战报：只保留结算真正会读的字段
function report(o) {
  return Object.assign({
    escaped: true, totalValue: 0, netProfit: 0, lootItems: [], bestItem: null
  }, o)
}
const redItem = name => ({ name, tier: 'red' })

// ===== 1) 新档：起步资金摆在那，图鉴全灰 =====
{
  const m = meta.load(memStore())
  assert.strictEqual(m.balance, meta.START_BALANCE)
  assert.strictEqual(m.runs, 0)
  const view = meta.codexView(m)
  assert.ok(view.total >= 11, `绝密资产图鉴只有 ${view.total} 条，红档物品是不是漏了`)
  assert.strictEqual(view.owned, 0)
  assert.ok(view.entries.every(e => !e.owned && e.count === 0))
  // 未解锁的条目也要带着格数和价格区间返回，UI 才能显示"还差哪几件、多大个儿"
  assert.ok(view.entries.every(e => e.weight > 0 && e.valueMax > 0))
}

// ===== 2) 扣款：进场即沉没，买不起的档不让选 =====
{
  const m = meta.load(memStore())
  assert.strictEqual(meta.START_BALANCE < FULL, true, '起步资金不该一上手就买得起重装回收组')
  assert.strictEqual(meta.affordable(m).full, false)
  assert.strictEqual(meta.affordable(m).half, true)

  const bad = meta.charge(m, 'full')
  assert.strictEqual(bad.ok, false)
  assert.ok(bad.reason.indexOf('买不起') >= 0)
  assert.strictEqual(m.balance, meta.START_BALANCE, '扣款失败却把钱扣了')

  const ok = meta.charge(m, 'half')
  assert.strictEqual(ok.ok, true)
  assert.strictEqual(m.balance, meta.START_BALANCE - HALF)
  assert.strictEqual(m.spent, HALF)
}

{
  const fresh = meta.load(memStore())
  assert.strictEqual(meta.preferredLoadout(fresh), 'half')
  fresh.lastLoadout = 'knife'
  assert.strictEqual(meta.preferredLoadout(fresh), 'knife')
  fresh.lastLoadout = 'full'
  assert.strictEqual(meta.preferredLoadout(fresh), 'half', '买不起的战备不该被记成默认档')
}

// ===== 3) 破产地板：钱见底也一定能开局 =====
// 破产时仍可用零成本轻装勘探组翻身；这条一旦破了，玩家会被永久卡在大厅。
{
  const m = meta.load(memStore())
  m.balance = 0
  const af = meta.affordable(m)
  assert.strictEqual(af.knife, true, '余额为 0 时连轻装勘探组都选不了，玩家被卡死')
  assert.strictEqual(af.half, false)
  assert.strictEqual(af.full, false)
  assert.strictEqual(meta.charge(m, 'knife').ok, true)
  assert.strictEqual(m.balance, 0, '轻装勘探组不该扣钱')
  assert.strictEqual(meta.isBroke(m), true)
}

// ===== 4) 引擎侧：余额是数据，买不起的档真的点不动 =====
{
  const s = engine.newRun({ balance: 0 })
  assert.strictEqual(s.node.type, 'loadout')
  const usable = s.node.options.filter(o => !o.disabled)
  assert.strictEqual(usable.length, 1, '余额为 0 时应该只剩轻装勘探组可选')
  assert.strictEqual(usable[0].loadout, 'knife')
  for (const o of s.node.options.filter(o => o.disabled)) {
    assert.ok(o.disabledReason.indexOf('仓库') >= 0, `禁用了却没说清为什么：${o.disabledReason}`)
  }
  // 绕过界面直接点重装也必须被拦
  const blocked = s.node.options.find(o => o.loadout === 'full')
  const r = engine.choose(s, blocked.idx)
  assert.ok(r.messages.some(m => m.indexOf('无法执行') === 0), '余额不够却让人进场了')
  assert.strictEqual(s.loadout, null)

  // 不传 balance 时按"钱随便花"处理：纯引擎测试和模拟器不用管局外存档
  const free = engine.newRun()
  assert.ok(free.node.options.every(o => !o.disabled), '没传余额时不该禁用任何战备档')

  // 钱刚好够就该能选
  const exact = engine.newRun({ balance: FULL })
  assert.ok(exact.node.options.every(o => !o.disabled), '余额刚好等于重装成本却买不了')
}

// ===== 5) 结算：成功入账，失败一分不给 =====
{
  const m = meta.load(memStore())
  meta.charge(m, 'half')
  const afterCharge = m.balance
  const win = meta.settle(m, report({ escaped: true, totalValue: 400000, netProfit: 250000 }))
  assert.strictEqual(win.gained, 400000)
  assert.strictEqual(m.balance, afterCharge + 400000)
  assert.strictEqual(m.escapes, 1)
  assert.strictEqual(m.runs, 1)

  const m2 = meta.load(memStore())
  meta.charge(m2, 'half')
  const before = m2.balance
  const lose = meta.settle(m2, report({ escaped: false, totalValue: 0, netProfit: -HALF }))
  assert.strictEqual(lose.gained, 0)
  assert.strictEqual(m2.balance, before, '撤离失败不该有任何入账')
  assert.strictEqual(m2.escapes, 0)
  assert.strictEqual(m2.runs, 1)
  // 一局的余额净变化必须等于战报上的净利润，否则大厅和战报会互相打脸
  assert.strictEqual(m2.balance - meta.START_BALANCE, -HALF)
}

// ===== 6) 图鉴：只认真正带出去的红，第二件同名不再算新解锁 =====
{
  const m = meta.load(memStore())
  const first = meta.settle(m, report({
    escaped: true, totalValue: 1500000,
    lootItems: [redItem('北辰零号晶核'), { name: '结霜标签夹', tier: 'white' }],
    bestItem: { name: '北辰零号晶核' }
  }))
  assert.deepStrictEqual(first.unlocked, ['北辰零号晶核'])
  assert.strictEqual(meta.codexView(m).owned, 1)
  assert.strictEqual(m.best.itemName, '北辰零号晶核')

  const again = meta.settle(m, report({
    escaped: true, totalValue: 100, lootItems: [redItem('北辰零号晶核')]
  }))
  assert.deepStrictEqual(again.unlocked, [], '同一件绝密资产不该重复算解锁')
  assert.strictEqual(m.codex['北辰零号晶核'].count, 2)
  assert.strictEqual(meta.codexView(m).owned, 1)

  // 没带出去就不算：撤离失败时背包里那件红只是遗物
  const m2 = meta.load(memStore())
  meta.settle(m2, report({ escaped: false, lootItems: [redItem('远古冰芯样本')] }))
  assert.strictEqual(meta.codexView(m2).owned, 0, '没撤出去的绝密资产不该进图鉴')
}

// ===== 7) 赛季：换期归零，同期累加 =====
{
  const t0 = Date.UTC(2026, 0, 6)              // 赛季基准日之后一天
  const store = memStore()
  const m = meta.load(store, t0)
  const s1 = m.season.id
  meta.settle(m, report({ escaped: true, totalValue: 500000, netProfit: 350000 }), t0)
  assert.strictEqual(m.season.runs, 1)
  assert.strictEqual(m.season.bestValue, 500000)
  meta.save(m, store)

  // 同一赛季内重新读档：战绩要还在
  const same = meta.load(store, t0 + 86400000)
  assert.strictEqual(same.season.id, s1)
  assert.strictEqual(same.season.runs, 1)

  // 跨赛季：赛季战绩归零，但仓库余额和图鉴是长期资产，不能清
  const later = t0 + meta.SEASON_DAYS * 86400000 * 2
  const next = meta.load(store, later)
  assert.notStrictEqual(next.season.id, s1, '过了两个赛季周期赛季号没变')
  assert.strictEqual(next.season.runs, 0)
  assert.strictEqual(next.season.bestValue, 0)
  assert.strictEqual(next.balance, same.balance, '换赛季把仓库清了')
  assert.strictEqual(next.season.endAt > later, true, '赛季结束时间应该在当前时间之后')
}

// ===== 8) 存档兼容与脏数据 =====
{
  // 老存档只有余额：其余字段补默认值，不能崩
  const old = meta.load(memStore({ balance: 12345 }))
  assert.strictEqual(old.balance, 12345)
  assert.strictEqual(old.runs, 0)
  assert.deepStrictEqual(old.codex, {})
  assert.ok(old.season && old.season.id)

  // 脏数据：负数/非数字/坏 codex 一律纠正，绝不让界面拿到 NaN
  assert.strictEqual(meta.load(memStore({ balance: -999 })).balance, 0)
  assert.strictEqual(meta.load(memStore({ balance: 'abc' })).balance, 0)
  assert.deepStrictEqual(meta.load(memStore({ codex: 'oops' })).codex, {})

  // 存档往返：存进去再读出来必须一模一样
  const store = memStore()
  const m = meta.load(store)
  meta.charge(m, 'half')
  meta.settle(m, report({ escaped: true, totalValue: 777000, lootItems: [redItem('远古冰芯样本')] }))
  meta.save(m, store)
  const back = meta.load(store)
  assert.strictEqual(back.balance, m.balance)
  assert.strictEqual(back.codex['远古冰芯样本'].count, 1)
  assert.strictEqual(back.runs, 1)
}

// ===== 9) 破产计数只在跨过门槛的那一刻记一次 =====
{
  const m = meta.load(memStore())
  m.balance = HALF + 10000
  meta.charge(m, 'half')                                   // 掉到买不起标准勤务组
  meta.settle(m, report({ escaped: false, cost: HALF, netProfit: -HALF }))
  assert.strictEqual(m.bankruptcies, 1)
  // 已经在破产状态，之后每局轻装勘探都不该再计数
  meta.settle(m, report({ escaped: false, cost: 0, netProfit: 0 }))
  assert.strictEqual(m.bankruptcies, 1, '破产状态下每局都在加计数')
}

console.log('局外存档自检通过：仓库扣款入账/破产地板/绝密资产图鉴/赛季懒重置/老存档兼容全部正确')
