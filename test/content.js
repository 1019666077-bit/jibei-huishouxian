// 内容扩容机制自检：阶段变体 / 状态谓词 / 广播资产 / 雪橇名额 / 空池兜底
// 用法：node test/content.js
const assert = require('assert')
const engine = require('../miniprogram/core/engine')
const { EVENTS, ESCAPE_CHOICE, MOVE_ROUTES, MOVE_CHOICE_CORE } = require('../miniprogram/data/events')
const { makeItem, rollLoot, ITEM_POOL } = require('../miniprogram/data/items')

const byId = id => EVENTS.find(e => e.id === id)
const shownOptionByRaw = (node, predicate) => {
  const raw = byId(node.id)
  const rawIdx = raw ? raw.options.findIndex(predicate) : -1
  return node.options.find(o => o.idx === rawIdx)
}
const escapeOption = (node, method) => {
  const rawIdx = ESCAPE_CHOICE.options.findIndex(o => o.method === method)
  return node.options.find(o => o.idx === rawIdx)
}
const moveOption = (state, predicate) => {
  const raw = state.node.id === MOVE_CHOICE_CORE.id ? MOVE_CHOICE_CORE : MOVE_ROUTES[state.zone]
  const rawIdx = raw ? raw.options.findIndex(predicate) : -1
  return state.node.options.find(o => o.idx === rawIdx)
}

// 借 findRawNode 的"当前节点不是事件就重新抽一个"这条路探事件池，不用为测试导出内部函数
function drawAt(step, zone, room, patch) {
  const s = engine.newRun()
  s.loadout = 'half'
  s.step = step
  s.zone = zone
  s.lastRoom = room || null
  s.usedEvents = []
  s.node = { id: '__probe' }
  if (patch) Object.assign(s, patch)
  return engine.refreshNode(s).id
}

function drawMany(n, step, zone, room, patch) {
  const seen = {}
  for (let i = 0; i < n; i++) {
    const id = drawAt(step, zone, room, patch)
    seen[id] = (seen[id] || 0) + 1
  }
  return seen
}

// ===== 1) phase：阶段变体只在自己的时间段出现 =====
// 池子还满着的时候绝不能提前漏出来（池子空了才允许放宽阶段，那是另一条兜底路径）
// 注意真实步位：0出生 1-2开局 3转移 4-5中盘 6残局 7撤离——残局只有第6步这一个事件位
const EARLY_STEP = 1
const MID_STEP = 5
const LATE_STEP = 6
{
  assert.strictEqual(engine.phaseOf({ step: EARLY_STEP }), 'early')
  assert.strictEqual(engine.phaseOf({ step: MID_STEP }), 'mid')
  assert.strictEqual(engine.phaseOf({ step: LATE_STEP }), 'late')

  const lateOnly = EVENTS.filter(e => e.phase === 'late').map(e => e.id)
  assert.ok(lateOnly.length >= 3, '残局变体太少，这条测试就没意义了')

  for (const step of [EARLY_STEP, MID_STEP]) {
    const drawn = drawMany(400, step, 'core', 'coolant')
    for (const id of lateOnly) {
      assert.ok(!drawn[id], `第${step}步抽到了残局专属事件 ${id}`)
    }
  }
  // 反过来：残局步位里，冷却舱的残局变体必须真的能出来，否则等于写了个死节点
  const late = drawMany(400, LATE_STEP, 'core', 'coolant')
  assert.ok(late.coolant_late > 0, '残局冷却舱变体在残局也抽不到，phase 过滤写反了')

  const earlyOnly = EVENTS.filter(e => e.phase === 'early').map(e => e.id)
  assert.ok(earlyOnly.length >= 1)
  const lateDorm = drawMany(400, LATE_STEP, 'harbor', null)
  for (const id of earlyOnly) {
    assert.ok(!lateDorm[id], `残局(第${LATE_STEP}步)抽到了开局专属事件 ${id}`)
  }
  // 开局步位里开局变体要能抽到
  const earlyDorm = drawMany(400, EARLY_STEP, 'harbor', null)
  assert.ok(earlyDorm.harbor_early_rush > 0, '开局冻港变体在开局抽不到')
}

// ===== 2) when：状态谓词按真实状态开关事件 =====
{
  // tide_anchor_gone 写的是 !dockSeen：自己清过潮汐坞后，“沉锚已被别队击倒”就自相矛盾
  assert.strictEqual(byId('tide_anchor_gone').when, '!dockSeen')
  const fresh = drawMany(400, 4, 'core', 'tide')
  assert.ok(fresh.tide_anchor_gone > 0, '没去过潮汐坞时反而抽不到沉锚已被击倒的事件')

  const been = drawMany(400, 4, 'core', 'tide', { usedEvents: ['core_tide'] })
  assert.ok(!been.tide_anchor_gone, '已经清过潮汐坞还刷出“沉锚已被别队击倒”，取反谓词失效')

  // compressor_late 要求闸被拉过：一道闸都没拉时不该出现
  const noLever = drawMany(400, LATE_STEP, 'core', 'compressor', { levers: 0 })
  assert.ok(!noLever.compressor_late, '没拉过闸就刷出了"闸已合上"的事件')
  const pulled = drawMany(400, LATE_STEP, 'core', 'compressor', { levers: 1, leverRooms: { coolant: true, compressor: false } })
  assert.ok(pulled.compressor_late > 0, '拉过闸了却抽不到对应的残局事件')
}

// ===== 3) 谓词表本身：认不出的键要放过（不能崩），但 routes.js 会报错 =====
{
  assert.strictEqual(typeof engine.WHEN.hasBrick, 'function')
  const s = engine.newRun()
  assert.strictEqual(engine.WHEN.hasBrick(s), false)
  s.loot.push({ name: '暴风演算主机', value: 2000000, weight: 9 })
  assert.strictEqual(engine.WHEN.hasBrick(s), true)
}

// ===== 4) 唯一广播资产：暴风演算主机是指定物品，不是掉落表随机 =====
{
  assert.strictEqual(makeItem('查无此物'), null, '不存在的物品名应该返回 null 让 routes.js 抓住')
  const brick = makeItem('暴风演算主机')
  assert.ok(brick, '暴风演算主机不在物品表里')
  assert.strictEqual(brick.weight, 9, '广播资产应占 9 格')
  assert.strictEqual(brick.tier, 'red')

  // 走一遍真实的 choose：拿砖那一项是必成功的，拿到手就该在背包里
  const s = engine.newRun()
  engine.applyLoadout(s, 'half')
  s.step = 3
  s.zone = 'core'
  s.usedEvents = []
  s.node = { id: '__probe' }
  s.node = engine.refreshNode(s)
  // 直接把节点换成广播资产事件，再按 item 效果选取主机
  s.node = { id: 'core_pulse' }
  const node = engine.refreshNode(s)
  assert.strictEqual(node.id, 'core_pulse')
  const take = shownOptionByRaw(node, o => o.success && o.success.item === '暴风演算主机')
  assert.ok(take, '广播资产事件里找不到领取主机的选项')
  const before = s.loot.length
  engine.choose(s, take.idx)
  assert.strictEqual(s.loot.length, before + 1, '领取主机之后背包里没多出东西')
  assert.ok(s.loot.some(it => it.name === '暴风演算主机'), '拿到的不是广播资产')
  assert.ok(s.weight >= 9, '广播资产的 9 格没算进负重')
}

// ===== 5) 携带主机=持续广播：剩下的路遇袭明显变多 =====
// 统计测试：风险拉到 80 让遭遇频繁，两组各跑 1500 次单步推进
{
  function encounterRate(withBrick) {
    let hit = 0
    const N = 1500
    for (let i = 0; i < N; i++) {
      const s = engine.newRun()
      engine.applyLoadout(s, 'half')
      s.step = 4
      s.risk = 80
      s.zone = 'harbor'
      if (withBrick) s.loot.push({ name: '暴风演算主机', value: 2000000, weight: 9, lootId: 'B1', secured: false })
      s.node = { id: 'harbor_rooms' }
      const node = engine.refreshNode(s)
      const safe = node.options.find(o => o.safe) || node.options[0]
      engine.choose(s, safe.idx)
      if (s.sig.encounters > 0) hit++
    }
    return hit / N
  }
  const plain = encounterRate(false)
  const brick = encounterRate(true)
  assert.ok(brick > plain * 1.25,
    `携带广播资产没有明显提高遇袭率（不带主机 ${(plain * 100).toFixed(1)}% vs 带主机 ${(brick * 100).toFixed(1)}%）`)
}

// ===== 6) 雪橇名额被占：撤收页真的不能再选货运雪橇 =====
{
  const s = engine.newRun()
  engine.applyLoadout(s, 'half')
  s.step = engine.TOTAL_STEPS
  const open = engine.refreshNode(s)
  assert.ok(escapeOption(open, 'bag'), '正常情况下货运雪橇应该是可选的')

  s.bagClosed = true
  const closed = engine.refreshNode(s)
  assert.ok(!escapeOption(closed, 'bag'), '雪橇已离站，撤收页却还给货运雪橇这条路')
  assert.ok(closed.options.length >= 1, '关掉雪橇之后不能一条撤收路都不剩')
  assert.ok(closed.text.indexOf('货运雪橇已离站') >= 0, '撤收页没说明雪橇为什么没了')

  // 事件里的 closeBag 必须真的把状态改掉——不能只写文案
  const s2 = engine.newRun()
  engine.applyLoadout(s2, 'half')
  s2.step = LATE_STEP
  s2.zone = 'lift'
  s2.node = { id: 'lift_bag_taken' }
  const ev = engine.refreshNode(s2)
  assert.strictEqual(ev.id, 'lift_bag_taken')
  // 每条分支都必须真的关掉雪橇：成功和失败都得算数（读原始事件，装饰后的选项不带效果）
  for (const o of byId('lift_bag_taken').options) {
    const setsFlag = (o.success && o.success.closeBag) || (o.fail && o.fail.closeBag)
    assert.ok(setsFlag, `「${o.text}」没有把雪橇线路标记为关闭，玩家会以为还能使用`)
  }
  engine.choose(s2, ev.options[ev.options.length - 1].idx)
  assert.strictEqual(s2.bagClosed, true, '选完之后 bagClosed 没有置位')
}

// ===== 7) 空池兜底：任何离谱的状态组合都不能让抽事件崩掉 =====
{
  const zones = ['harbor', 'weather', 'thermal', 'lift', 'core', 'aurora']
  const rooms = [null, 'coolant', 'maglev', 'compressor', 'dimhold', 'storm', 'tide']
  const allIds = EVENTS.map(e => e.id)
  let checked = 0
  for (const zone of zones) {
    for (const room of rooms) {
        for (const step of [1, 2, 4, 5, 6]) {
        for (const usedAll of [false, true]) {
          for (const centLever of [false, true]) {
            const s = engine.newRun()
            engine.applyLoadout(s, 'half')
            s.step = step
            s.zone = zone
            s.lastRoom = room
            s.levers = centLever ? 1 : 0
            s.leverRooms = { coolant: false, compressor: centLever }
            s.usedEvents = usedAll ? allIds.slice() : []
            s.node = { id: '__probe' }
            const node = engine.refreshNode(s)
            assert.ok(node && node.id, `zone=${zone} room=${room} step=${step} 抽不出节点`)
            assert.ok(node.options && node.options.length > 0,
              `zone=${zone} room=${room} step=${step} usedAll=${usedAll} 抽到了没有选项的节点 ${node.id}`)
            checked++
          }
        }
      }
    }
  }
  assert.ok(checked > 300, '兜底扫描的组合数不对')
}

// ===== 8) 阶段口径只有一套：HUD 上那行字必须跟 phaseOf 对得上 =====
{
  const s = engine.newRun()
  engine.applyLoadout(s, 'half')
  const expect = { 1: '开局进驻', 2: '开局进驻', 3: '中盘转移', 5: '中盘转移', 6: '残局撤离', 7: '残局撤离' }
  for (const step of Object.keys(expect)) {
    s.step = Number(step)
    const meta = engine.getRunMeta(s)
    assert.strictEqual(meta.phase, expect[step], `第${step}步的阶段文案不对`)
    assert.ok(meta.zoneName, 'HUD 区位名不能空')
    assert.ok(meta.stepText, 'HUD 步数文案不能空')
    assert.ok(meta.remainSteps != null, 'HUD 剩余步数不能空')
    const p = engine.phaseOf(s)
    assert.ok(['early', 'mid', 'late'].includes(p))
  }
}

{
  const s = engine.newRun()
  engine.applyLoadout(s, 'half')
  s.zone = 'harbor'
  s.step = 3
  s.risk = 80
  s.node = { id: 'move', type: 'move' }
  engine.refreshNode(s)
  const hinted = (s.node.options || []).filter(o => /途中很可能交火/.test(o.costText || ''))
  assert.ok(hinted.length > 0, '风险偏高时转移选项必须提示途中交火')
  const gated = (s.node.options || []).filter(o => o.moveTo === 'core' && /可合闸/.test(o.costText || ''))
  assert.ok(gated.length > 0, '未接通双电源时进入内环的路线应提示可合闸')
}

// ===== 9) 配电柄是房间设施，不是随机遭遇 =====
// 修复前：闸只挂在冷却舱 / 压缩机房事件上，房间补到 5 个事件后抽中率被稀释到两成，
// 专门冲索道的打法若双电源率过低，会让路线门禁失去意义。
function coreState(room, patch) {
  const s = engine.newRun()
  engine.applyLoadout(s, 'half')
  s.step = 5
  s.zone = 'core'
  s.lastRoom = room
  s.usedEvents = []
  s.node = { id: '__probe' }
  if (patch) Object.assign(s, patch)
  return s
}
const leverOption = node => {
  const raw = byId(node.id)
  if (!raw) return null
  return node.options.find(o => {
    const source = raw.options[o.idx]
    return !!(source && source.success && source.success.levers) || o.idx >= raw.options.length
  })
}
const hasLeverOpt = node => {
  const raw = byId(node.id)
  if (!raw) return false
  return node.options.some(o => {
    const source = raw.options[o.idx]
    return !!(source && source.success && source.success.leverRoom) ||
      (o.idx >= raw.options.length && o.chance === 100)
  })
}
const injectedOption = node => {
  const raw = byId(node.id)
  return raw && node.options.find(o => o.idx >= raw.options.length)
}

{
  // 冷却舱和压缩机房：抽到哪个事件都得能看见配电柄
  for (const room of ['coolant', 'compressor']) {
    for (const ev of EVENTS.filter(e => e.room === room && !e.entryOnly)) {
      const s = coreState(room)
      s.node = { id: ev.id }
      assert.ok(hasLeverOpt(engine.refreshNode(s)), `${ev.id}（${room}）里看不见配电柄`)
    }
  }
  // 没配电柄的房间不该凭空长出一个常驻动作。
  // 注意要把节点钉在该房间的事件上：refreshNode 是按邻接抽下一个房间的，直接传 dock 可能抽到离心去
  for (const room of ['maglev', 'dimhold', 'storm', 'tide']) {
    for (const ev of EVENTS.filter(e => e.room === room && !e.entryOnly)) {
      const s = coreState(room)
      s.node = { id: ev.id }
      const node = engine.refreshNode(s)
      assert.ok(!injectedOption(node), `${ev.id}（${room}）不该长出配电柄`)
    }
  }
  // 拉过的闸不重复出现，拉满两道后彻底消失
  assert.ok(!hasLeverOpt(engine.refreshNode(coreState('coolant', {
    levers: 1, leverRooms: { coolant: true, compressor: false }
  }))), '冷却舱配电柄接通过了还在列')
  assert.ok(!hasLeverOpt(engine.refreshNode(coreState('coolant', {
    levers: 2, leverRooms: { coolant: true, compressor: true }
  }))), '双闸拉满后还在显示拉闸项')
}

// ===== 10) 注入的选项不能让下标错位 =====
// decorateNode 和 choose 各自调一次 withRoomActions，两边的选项列表必须逐项对齐，
// 否则玩家点第 N 项、引擎结算的是另一件事——这类 bug 在界面上完全看不出来
{
  for (const room of ['coolant', 'compressor', 'storm']) {
    for (const levers of [0, 1]) {
      for (let rep = 0; rep < 40; rep++) {
      const s = coreState(room, { levers, leverRooms: { coolant: levers === 1, compressor: false } })
      const shown = engine.refreshNode(s)
      // 只测可用项：缺弹/缺门禁卡被拦是正当的消耗校验，不是下标错位
      shown.options.filter(o => !o.disabled).forEach(o => {
        const probe = JSON.parse(JSON.stringify(s))
        probe.node = s.node
        const r = engine.choose(probe, o.idx)
        assert.ok(r.messages.every(m => m.indexOf('无法执行') !== 0),
          `${shown.id} · ${room} levers=${levers} 第${o.idx}项「${o.text}」点下去被拒了，说明两边选项对不上`)
      })
      }
    }
  }
}

// ===== 11) 接通一路电源后，得有办法主动把第二路补完 =====
{
  const s = coreState('coolant', { levers: 1, leverRooms: { coolant: true, compressor: false } })
  const node = engine.refreshNode(s)
  const dash = injectedOption(node)
  assert.ok(dash, '接通一路电源后没有补第二路的结构化选项')
  let pulled = false
  for (let i = 0; i < 60 && !pulled; i++) {
    const t = coreState('coolant', { levers: 1, leverRooms: { coolant: true, compressor: false } })
    const d = injectedOption(engine.refreshNode(t))
    engine.choose(t, d.idx)
    if (t.levers === 2) { assert.ok(t.leverRooms.compressor, '双电源齐了但压缩机房那一路没记上'); pulled = true }
  }
  assert.ok(pulled, '穿风暴庭院补电源 60 次一次都没成功，判定或效果没接上')
  assert.ok(!injectedOption(engine.refreshNode(coreState('coolant', {
    levers: 2, leverRooms: { coolant: true, compressor: true }
  }))), '双电源齐了还在让人去补')
}

// ===== 12) 索道刚启动时得能等待早期争夺结束 =====
{
  const s = engine.newRun()
  engine.applyLoadout(s, 'half')
  s.step = 7
  s.zone = 'core'
  s.lastRoom = 'compressor'
  s.levers = 2
  s.leverRooms = { coolant: true, compressor: true }
  s.leverStep = 7
  s.node = { id: '__probe' }
  const node = engine.refreshNode(s)
  const wait = node.options.find(o => o.idx >= ESCAPE_CHOICE.options.length)
  assert.ok(wait, '索道刚启动却没有等待早期争夺结束的选项')
  const heliBefore = escapeOption(node, 'heli')
  assert.ok(heliBefore && heliBefore.costText.indexOf('索道刚启动') >= 0, '刚接通电源的索道提示不对')

  engine.choose(s, wait.idx)
  assert.ok(!s.ended, '蹲读秒不该直接结算撤离')
  assert.ok(s.step > 7, '蹲读秒没有推进时间')
  if (s.alive && !s.ended && s.node.type === 'escape') {
    const heliAfter = escapeOption(s.node, 'heli')
    assert.ok(heliAfter && heliAfter.costText.indexOf('窗口接近末段') >= 0, '蹲完读秒窗口没切换到有利区间')
  }
  // 窗口一进去就不该再蹲，避免无限拖时间
  const s2 = engine.newRun()
  engine.applyLoadout(s2, 'half')
  Object.assign(s2, {
    step: 9, zone: 'core', lastRoom: 'compressor', levers: 2,
    leverRooms: { coolant: true, compressor: true }, leverStep: 7, node: { id: '__probe' }
  })
  assert.ok(!engine.refreshNode(s2).options.some(o => o.idx >= ESCAPE_CHOICE.options.length), '已经在窗口里了还能继续蹲')
}

// ===== 13) 门禁：想走极地索道的人，得真能走成 =====
// 这条盯的是“往冷却舱/压缩机房加内容会稀释常驻配电柄”这类回归。
// 若大量对局卡在 1/2 供电，意味着第二路电源不可达。
{
  const RUNS = 600
  let both = 0, stuck = 0
  for (let i = 0; i < RUNS; i++) {
    const s = engine.newRun()
    let guard = 0
    while (!s.ended && guard++ < 40) {
      const opts = s.node.options.filter(o => !o.disabled)
      if (!opts.length) { engine.choose(s, s.node.options[0].idx); continue }
      let pick
      if (s.node.type === 'loadout') pick = opts[1] || opts[0]
      else if (s.node.type === 'loot') pick = opts[0]
      else if (s.node.type === 'move') pick = moveOption(s, o => o.moveTo === 'core') || opts[0]
      else if (s.node.type === 'escape') {
        pick = opts.find(o => o.idx >= ESCAPE_CHOICE.options.length) || opts[0]
      }
      else {
        pick = leverOption(s.node) || opts[0]
      }
      engine.choose(s, pick.idx)
    }
    if (s.levers >= 2) both++
    else if (s.levers === 1) stuck++
  }
  const bothRate = both / RUNS, stuckRate = stuck / RUNS
  assert.ok(bothRate >= 0.35,
    `冲双电源的打法只有 ${(bothRate * 100).toFixed(1)}% 凑齐（门禁 35%）——极地索道路线不可达`)
  assert.ok(stuckRate <= 0.30,
    `${(stuckRate * 100).toFixed(1)}% 的局卡在 1/2 供电（门禁 30%）——补第二路电源的路径走不通`)
}

{
  const s = engine.newRun({ autoLoadout: 'half', opener: true })
  assert.strictEqual(s.cost, 0, '首局教程不应扣押金')
  assert.strictEqual(s.tutorial, true)
  s.step = 2
  engine.refreshNode(s)
  assert.ok(engine.canExtractNow(s), '搜过一轮后应能提前撤')
  const jumped = engine.forceExtract(s)
  assert.ok(jumped.messages.some(m => /撤离线/.test(m)))
  assert.strictEqual(s.node.type, 'escape')
  assert.ok(!engine.canExtractNow(s), '已经在撤收点不应再显示撤离')
}

{
  const keep = ITEM_POOL.green[0].name
  const avoid = ITEM_POOL.green.slice(1).map(p => p.name)
  let hit = 0
  for (let i = 0; i < 50; i++) {
    const it = rollLoot('harbor', 0, avoid)
    if (it && it.tier === 'green') {
      assert.strictEqual(it.name, keep, '避开已有品名后抽到了重复绿装')
      hit++
    }
  }
  assert.ok(hit >= 1, '五十次冻港掉落里应出现绿装，以便校验去重')
}

console.log('内容机制自检通过：阶段变体/状态谓词/广播资产/雪橇名额/空池兜底/双电源可达性全部正确')
