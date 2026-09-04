// 死因链与针对性重开自检
// 这套测试的重点不是"有没有输出"，而是"输出的每个数字能不能在 state 里对上账"。
// 死因链一旦开始编造（比如没跳弹却说跳弹、把最终风险当峰值），玩家的信任是一次性烧光的。
const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const { ESCAPE_CHOICE } = require('../miniprogram/data/events')

function start(loadout = 'full') {
  const state = engine.newRun()
  engine.applyLoadout(state, loadout)
  return state
}

// 用真实结算流程收尾，绝不手工拼 report——死因链必须是引擎自己算出来的
// escapeMethod 存在时走指定撤收方法；否则压到 1 血后连续吃判定失败，让它真的倒在局内
function settle(state, { escapeMethod = null, forcePass = false } = {}) {
  const original = Math.random
  Math.random = () => (forcePass ? 0 : 0.999)   // 0.999 = 所有判定必败，且不触发额外遭遇
  try {
    if (escapeMethod) {
      state.step = 7
      engine.refreshNode(state)
      const rawIdx = ESCAPE_CHOICE.options.findIndex(o => o.method === escapeMethod)
      const opt = state.node.options.find(o => o.idx === rawIdx)
      assert.ok(opt, `撤收页没有 method=${escapeMethod} 选项`)
      engine.choose(state, opt.idx)
    } else {
      state.hp = 1
      engine.refreshNode(state)
      let guard = 0
      while (!state.ended && guard++ < 20) {
        assert.notStrictEqual(state.node.type, 'escape', '没能在撤离步之前倒下，用例失效')
        // 挑不开枪的选项：避免污染 ironHits / ammoUsed 这些被断言的信号
        const usable = state.node.options.filter(o => !o.disabled && !/发/.test(o.costText || ''))
        const pick = usable[0] || state.node.options.filter(o => !o.disabled)[0]
        assert.ok(pick, '没有可用选项，用例失效')
        engine.choose(state, pick.idx)
        state.hp = Math.min(state.hp, 1)   // 一直压在 1 血，下一次判定失败就收场
      }
      assert.ok(state.ended, '压测没能让这局结束')
    }
  } finally {
    Math.random = original
  }
  return state.report
}

// ---- 1) 战报结构：三个字段必须成套出现，且方案永远给得出 ----
{
  const s = start('half')
  const r = settle(s, { escapeMethod: 'bag', forcePass: true })
  assert.ok(Array.isArray(r.causeChain), 'causeChain 缺失')
  assert.ok(r.causeChain.length >= 1 && r.causeChain.length <= 3, `死因链条数越界：${r.causeChain.length}`)
  assert.ok(typeof r.causeTag === 'string' && r.causeTag, 'causeTag 缺失')
  assert.strictEqual(r.retryPlans.length, 2, '重开方案必须正好两条：一条解题一条绕路')
  for (const p of r.retryPlans) {
    assert.ok(p.id && p.title && p.goal && p.why, `重开方案字段不全：${JSON.stringify(p)}`)
    assert.ok(['full', 'half', 'knife'].includes(p.loadout), `重开方案战备非法：${p.loadout}`)
  }
  // 两条方案不能是同一件事，否则等于没给选择
  assert.notStrictEqual(r.retryPlans[0].id, r.retryPlans[1].id, '两条重开方案重复')
}

// ---- 2) 跳弹致死：必须点名穿深，且次数与 state.ironHits 一致 ----
{
  const s = start('half')            // MK318 4穿
  s.ironHits = 3
  s.ammo.rounds = 10
  const r = settle(s)
  assert.strictEqual(r.causeTag, 'iron', `跳弹3次没被判为主因，实际 ${r.causeTag}`)
  const line = r.causeChain.find(t => t.includes('跳弹'))
  assert.ok(line, '死因链没提跳弹')
  assert.ok(line.includes('3 次'), `跳弹次数没对上 state.ironHits：${line}`)
  assert.ok(line.includes('4 穿'), `没点名当前弹的穿深：${line}`)
  assert.strictEqual(r.retryPlans[0].loadout, 'full', '跳弹的第一方案应该换重装六穿弹')
}

// ---- 3) 空仓致死：只在真的打空时才说，没开过枪不能说"打光了" ----
{
  const s = start('full')
  s.ammoUsed = 175
  s.ammo.rounds = 5
  const r = settle(s)
  assert.ok(r.causeChain.some(t => t.includes('175 发')), `没引用真实射出发数：${r.causeChain}`)

  const quiet = start('full')        // 一枪没开就死：绝不能出现空仓论
  const q = settle(quiet)
  assert.ok(!q.causeChain.some(t => t.includes('只剩')), `没开过枪却说空仓：${q.causeChain}`)
}

// ---- 4) 遭遇战：引用的是峰值风险和真实掉血，不是最终风险 ----
{
  const s = start('full')
  s.sig.encounters = 3
  s.sig.encounterDmg = 66
  s.peakRisk = 88
  const r = settle(s)
  const line = r.causeChain.find(t => t.includes('被摸'))
  assert.ok(line, '有遭遇战却没进死因链')
  assert.ok(line.includes(`风险峰值 ${s.peakRisk}`), `没引用真实峰值风险：${line}`)
  assert.ok(line.includes('66 血'), `遭遇战掉血对不上 sig.encounterDmg：${line}`)
  assert.strictEqual(r.maxRisk, s.peakRisk, '战报把最终风险当成了峰值')
}

// ---- 5) 带着药倒下：这条是最扎心也最容易写错的 ----
{
  const s = start('full')
  s.meds = 2
  const r = settle(s)
  assert.ok(r.causeChain.some(t => t.includes('2 个医疗包')), `没提醒药没用完：${r.causeChain}`)

  // 反向：提没提药必须严格跟着真实剩余量走（局内可能捡到药，所以拿收场时的真值比）
  for (let i = 0; i < 30; i++) {
    const d = start(i % 2 ? 'knife' : 'half')
    d.meds = 0
    const dr = settle(d)
    const mentioned = dr.causeChain.some(t => t.includes('医疗包'))
    assert.strictEqual(mentioned, d.meds > 0,
      `提药与真实剩余量不符（剩 ${d.meds} 个）：${dr.causeChain}`)
  }
}

// ---- 6) 超重撤收失败：扣的百分比要能和引擎真实扣的对上（极地索道每格扣 3）----
{
  const s = start('half')
  s.zone = 'lift'
  s.levers = 2
  s.leverRooms = { coolant: true, compressor: true }
  s.leverStep = 6
  s.loot = [{ lootId: 1, name: '地热引燃剂', tier: 'red', tierLabel: '红·绝密', value: 1500000, weight: 30 }]
  s.weight = 30                      // 标准勤务组 25 格容量，稳定超重
  const over = engine.overload(s)
  assert.ok(over > 0, '用例没造出超重状态')
  const r = settle(s, { escapeMethod: 'heli', forcePass: false })
  assert.strictEqual(r.causeTag, 'overweight', `超重没被判为撤离失败主因：${r.causeTag}`)
  assert.ok(r.causeChain[0].includes(`超重 ${over} 格 -${over * 3}%`),
    `超重扣分没对上引擎的每格 3%：${r.causeChain[0]}`)
}

// ---- 6b) 雪橇失败绝不能甩锅超重：引擎的 bag 分支根本不扣负重 ----
// 这条是防回归的核心。复盘不能对雪橇另算并不存在的超重扣分，
// 数字纯属编造，还被上一版测试当成预期固化了下来。
{
  const s = start('half')
  s.zone = 'lift'
  s.loot = [{ lootId: 1, name: '地热引燃剂', tier: 'red', tierLabel: '红·绝密', value: 1500000, weight: 30 }]
  s.weight = 30
  assert.ok(engine.overload(s) > 0, '用例没造出超重状态')
  const r = settle(s, { escapeMethod: 'bag', forcePass: false })
  assert.notStrictEqual(r.causeTag, 'overweight', '雪橇不扣超重，却把超重写成了主因')
  assert.ok(!r.causeChain.some(t => t.includes('超重')),
    `雪橇失败提了不存在的超重惩罚：${r.causeChain}`)
}

// ---- 6c) 撤离失败的每一句扣分，都必须能在引擎的扣分明细里逐字找到 ----
{
  const methods = [
    { key: 'bag', setup: s => {} },
    { key: 'rocket', setup: s => {} },
    { key: 'heli', setup: s => { s.levers = 2; s.leverRooms = { coolant: true, compressor: true }; s.leverStep = 2 } }
  ]
  for (const m of methods) {
    const s = start('half')
    s.zone = 'lift'
    s.hp = 38                                   // 造出伤势扣分
    s.loot = [{ lootId: 1, name: '地热引燃剂', tier: 'red', tierLabel: '红·绝密', value: 1500000, weight: 30 }]
    s.weight = 30                               // 造出超重（只有部分路线会扣）
    s.risk = 75                                 // 造出风险扣分
    m.setup(s)
    const r = settle(s, { escapeMethod: m.key, forcePass: false })
    const cuts = s.escapeAttempt.breakdown.filter(p => p.delta > 0)
    for (const t of r.causeChain) {
      // 提到某个扣分项，就必须真的扣了，且百分比一字不差
      for (const p of cuts.concat([
        { label: '超重', delta: null }, { label: '伤势', delta: null }, { label: '风险', delta: null }
      ])) {
        if (p.delta === null && t.includes(p.label)) {
          const real = cuts.find(x => x.label.startsWith(p.label))
          assert.ok(real, `${m.key}：复盘提了「${p.label}」但引擎根本没扣 —— ${t}`)
          assert.ok(t.includes(`-${real.delta}%`), `${m.key}：「${p.label}」的扣分数字对不上引擎 —— ${t}`)
        }
      }
    }
  }
}

// ---- 7) 索道供电后拖时间：只在真的拖过才说，接通就走不能被扣帽子 ----
{
  const late = start('full')
  late.zone = 'lift'
  late.levers = 2
  late.leverRooms = { coolant: true, compressor: true }
  late.leverStep = 1                 // step 会被 settle 拉到 7，等于拖了 6 步
  const r = settle(late, { escapeMethod: 'heli', forcePass: false })
  assert.ok(r.causeChain.some(t => t.includes('拖了 6 步')), `没算对读秒等待：${r.causeChain}`)
  assert.strictEqual(r.causeTag, 'heli', `拖读秒没被判为主因：${r.causeTag}`)

  const fast = start('full')
  fast.zone = 'lift'
  fast.levers = 2
  fast.leverRooms = { coolant: true, compressor: true }
  fast.leverStep = 6                 // 拉完一步内就到点
  const f = settle(fast, { escapeMethod: 'heli', forcePass: false })
  assert.ok(!f.causeChain.some(t => t.includes('拖了')), `拉完就跑还被说拖延：${f.causeChain}`)
}

// ---- 8) 雪橇漏货：金额必须等于真实没进箱的价值 ----
{
  const s = start('full')
  s.zone = 'lift'
  s.loot = [
    { lootId: 1, name: '远古冰芯样本', tier: 'red', tierLabel: '红·绝密', value: 335000, weight: 2, secured: true },
    { lootId: 2, name: '低温循环泵', tier: 'gold', tierLabel: '金', value: 120000, weight: 1, secured: false },
    { lootId: 3, name: '风暴固存片', tier: 'purple', tierLabel: '紫', value: 80000, weight: 1, secured: false }
  ]
  s.weight = 4
  const r = settle(s, { escapeMethod: 'bag', forcePass: true })
  // 带出了绝密资产也不能盖掉“20万没装箱”这笔账：肯定归肯定，方案要冲着损失去
  assert.strictEqual(r.causeTag, 'bag', `雪橇漏货没被判为主因：${r.causeTag}`)
  assert.ok(r.causeChain[0].includes('远古冰芯样本'), `第一条应该先认账做对的：${r.causeChain[0]}`)
  assert.ok(r.causeChain.some(t => t.includes('20万')), `漏掉的金额没对上 12万+8万：${r.causeChain}`)
  assert.ok(r.lootItems.length === 1, '雪橇应只带出安全箱内的一件')
}

// ---- 9) 打得好的一局：先认账做对的，方案是往上打而不是找茬 ----
{
  const s = start('half')
  s.zone = 'lift'
  s.levers = 2
  s.leverRooms = { coolant: true, compressor: true }
  s.leverStep = 6
  s.loot = [{ lootId: 1, name: '远古冰芯样本', tier: 'red', tierLabel: '红·绝密', value: 335000, weight: 2, secured: true }]
  s.weight = 2
  const r = settle(s, { escapeMethod: 'heli', forcePass: true })
  assert.strictEqual(r.hasRed, true, '用例没带出绝密资产')
  assert.ok(r.causeChain[0].includes('远古冰芯样本'), `带绝密资产的一局第一条应该是肯定：${r.causeChain[0]}`)
  assert.strictEqual(r.causeTag, 'push', `顺风局应给"往上打"方案，实际 ${r.causeTag}`)
  assert.strictEqual(r.retryPlans[1].loadout, 'full', '顺风局第二方案应是升级战备打首领')
}

// ---- 10) 决策轨迹：每次判定都要落痕，且成功率在合法区间 ----
{
  const s = start('full')
  for (let i = 0; i < 4 && !s.ended; i++) {
    const usable = s.node.options.filter(o => !o.disabled)
    if (!usable.length) break
    engine.choose(s, usable[0].idx)
  }
  assert.ok(s.decisionTrail.length > 0, '决策轨迹没记录')
  for (const d of s.decisionTrail) {
    assert.ok(d.chance >= 10 && d.chance <= 100, `轨迹里的判定率越界：${d.chance}`)
    assert.strictEqual(typeof d.pass, 'boolean', '轨迹缺少成败标记')
    assert.ok(d.hp >= 0 && d.hp <= 100, `轨迹里的血量越界：${d.hp}`)
  }
  const fails = s.decisionTrail.filter(d => !d.pass).length
  assert.strictEqual(fails, s.sig.failedChecks, '失败次数与轨迹对不上')
}

// ---- 11) 重开预设：把方案里的战备直接套上，等于玩家自己选的 ----
{
  const s = start('full')
  const r = settle(s)
  const plan = r.retryPlans[0]
  const next = engine.newRun({ goal: plan.goal })
  assert.strictEqual(next.goal, plan.goal, '目标没带进下一局')
  engine.applyLoadout(next, plan.loadout)
  assert.strictEqual(next.loadout, plan.loadout, '预设战备没生效')
  assert.ok(next.ammo && next.ammo.rounds > 0, '预设战备没发弹')
  assert.ok(next.node && next.node.type !== 'loadout', '预设后还停在战备选择页')
}

// ---- 12) 随机压测：任何一局都必须给得出能落地的复盘 ----
{
  for (let i = 0; i < 400; i++) {
    const s = engine.newRun()
    let guard = 0
    while (!s.ended && guard++ < 40) {
      const usable = s.node.options.filter(o => !o.disabled)
      if (!usable.length) break
      engine.choose(s, usable[Math.floor(Math.random() * usable.length)].idx)
    }
    if (!s.report) continue
    const r = s.report
    assert.ok(r.causeChain.length >= 1, `第${i}局没有死因链`)
    assert.ok(r.causeChain.every(t => typeof t === 'string' && t.length > 4), `第${i}局死因链有空条目`)
    assert.strictEqual(r.retryPlans.length, 2, `第${i}局重开方案不是两条`)
    assert.ok(r.retryPlans.every(p => p.loadout && p.goal), `第${i}局重开方案不完整`)
    // 没发生过跳弹就绝不能说跳弹
    if (s.ironHits === 0) {
      assert.ok(!r.causeChain.some(t => t.includes('跳弹')), `第${i}局凭空捏造跳弹：${r.causeChain}`)
    }
  }
}

console.log('复盘自检通过：死因链全部有真实数据兜底 · 重开方案与战备预设可落地')
