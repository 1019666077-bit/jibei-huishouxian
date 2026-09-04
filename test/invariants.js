// 随机对局不变量校验：背包重量、安全箱上限、路线轨迹与战报字段必须始终自洽
const assert = require('assert')
const engine = require('../miniprogram/core/engine')

const RUNS = Number(process.argv[2]) || 500
let checked = 0

function checkState(state, where) {
  const weight = state.loot.reduce((sum, it) => sum + it.weight, 0)
  assert.strictEqual(state.weight, weight, `${where}: 背包重量与物资明细不符`)

  const ids = state.loot.map(it => it.lootId)
  assert.ok(ids.every(Boolean), `${where}: 存在没有 lootId 的物资`)
  assert.strictEqual(new Set(ids).size, ids.length, `${where}: lootId 重复，装箱/丢弃会误伤同名物资`)

  const secured = state.loot.filter(it => it.secured).reduce((sum, it) => sum + it.weight, 0)
  assert.ok(secured <= state.safebox, `${where}: 安全箱超出 ${state.safebox} 格`)

  assert.ok(state.risk <= state.peakRisk, `${where}: 峰值风险小于当前风险`)
  assert.ok(state.hp >= 0 && state.hp <= 100, `${where}: 生命越界`)
  assert.ok(state.cards >= 0 && state.meds >= 0, `${where}: 资源出现负数`)
  if (state.ammo) {
    assert.ok(state.ammo.rounds >= 0, `${where}: 弹药发数为负`)
    assert.ok(state.ammo.pen >= 1 && state.ammo.pen <= 6, `${where}: 穿深越界`)
    assert.ok(state.ammo.caliber === state.gun.caliber, `${where}: 弹药口径与枪不匹配`)
  }
  // 缺弹不能把人逼死：任何节点都必须留有不用枪的活路
  const usable = state.node.options.filter(o => !o.disabled)
  assert.ok(usable.length, `${where}: 没有任何可用选项（可能是弹药门槛把路全堵死了）`)
  assert.strictEqual(state.levers, Object.values(state.leverRooms).filter(Boolean).length, `${where}: 供电路数与分房间状态不符`)
  checked++
}

function checkReport(state) {
  const r = state.report
  assert.ok(r, '结束时没有生成战报')
  assert.strictEqual(r.lootCount, r.lootItems.length, '战报件数与明细不符')
  assert.strictEqual(r.totalValue, r.lootItems.reduce((s, it) => s + it.value, 0), '战报总价值与明细不符')
  // 净利润口径：撤出来了装备跟着回来，只烧消耗品；倒在里面则整套战备血亏
  assert.strictEqual(r.gearKept, r.escaped, '装备去向标记与撤离结果不一致')
  assert.strictEqual(
    r.netProfit,
    r.escaped ? r.totalValue - r.resupply : -r.cost,
    '净利润口径不对'
  )
  assert.ok(r.resupply >= 0, '补给费为负')
  if (r.loadout === 'knife') assert.strictEqual(r.cost, 0, '轻装勘探组不该有战备成本')

  if (!r.escaped) {
    assert.strictEqual(r.lootItems.length, 0, '阵亡/撤离失败还带出了物资')
    assert.strictEqual(r.rating, 'D', '失败局评级不是 D')
  }
  if (r.method === 'bag') {
    assert.ok(r.lootItems.every(it => it.secured), '货运雪橇带出了没装箱的物资')
  }
  if (r.escaped && r.lootItems.length) {
    assert.strictEqual(r.bestItem.value, Math.max(...r.lootItems.map(it => it.value)), '最高价值物资取错')
  }

  assert.ok(Array.isArray(r.routeTrail) && r.routeTrail.length >= 1, '路线轨迹为空')
  assert.ok(r.routeTrail.every((z, i) => i === 0 || z !== r.routeTrail[i - 1]), '路线轨迹出现连续重复站点')
  assert.ok(r.resourcesUsed.ammo >= 0 && r.resourcesUsed.meds >= 0 && r.resourcesUsed.cards >= 0, '资源消耗统计为负')
  assert.strictEqual(r.ammoReport.fired, r.resourcesUsed.ammo, '弹药账与资源统计对不上')
  assert.ok(r.ammoReport.ironHits >= 0 && r.ammoReport.left >= 0, '弹药账出现负数')
  assert.ok(r.lostItems.every(it => it.reason), '遗失物资缺少原因')
  assert.ok(r.medals.length === 0 || r.escaped, '失败局不应发勋章')

  // 复盘：任何一局都要给得出能落地的账和方案，且不能编造没发生过的事
  assert.ok(r.causeChain.length >= 1 && r.causeChain.length <= 3, '死因链条数越界')
  assert.ok(r.causeChain.every(t => typeof t === 'string' && t.length > 4), '死因链有空条目')
  assert.strictEqual(r.retryPlans.length, 2, '重开方案不是两条')
  assert.ok(r.retryPlans.every(p => p.id && p.title && p.goal && p.why && p.loadout), '重开方案字段不全')
  assert.notStrictEqual(r.retryPlans[0].id, r.retryPlans[1].id, '两条重开方案重复')
  if (r.ammoReport.ironHits === 0) {
    assert.ok(!r.causeChain.some(t => t.includes('跳弹')), '没发生跳弹却写进了死因链')
  }
}

for (let i = 0; i < RUNS; i++) {
  const state = engine.newRun(i % 5 === 0 ? { extraMed: 1, redBoost: 2 } : {})
  let guard = 0
  while (!state.ended && guard++ < 40) {
    // 随机操作背包：模拟真人中途装箱和丢货，检验状态始终自洽
    if (state.loot.length && Math.random() < 0.4) {
      const it = state.loot[Math.floor(Math.random() * state.loot.length)]
      if (Math.random() < 0.75) engine.toggleSecure(state, it.lootId)
      else engine.dropLoot(state, it.lootId, '随机测试丢弃')
      engine.refreshNode(state)
    }
    if (state.hp < 55 && state.meds > 0 && state.node.type !== 'loadout') engine.useMed(state)
    checkState(state, `第${i}局 第${state.step}步`)

    const usable = state.node.options.filter(o => !o.disabled)
    assert.ok(usable.length, `第${i}局 第${state.step}步 没有任何可用选项`)
    engine.choose(state, usable[Math.floor(Math.random() * usable.length)].idx)
  }
  assert.ok(state.ended, `第${i}局 40步内没有结束`)
  checkReport(state)
}

console.log(`不变量自检通过：${RUNS} 局随机对局 · ${checked} 次状态快照（背包/安全箱/风险/双电源/战报口径全部自洽）`)
