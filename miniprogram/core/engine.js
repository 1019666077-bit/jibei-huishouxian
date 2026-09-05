// 单局核心引擎：状态管理 / 成功率修正 / 决策处理 / 结算
// 纯 JS 无微信依赖 —— 页面渲染它，Node 也能直接跑模拟验证数值
const { rollLoot, makeItem, TIERS } = require('../data/items')
const { ZONES, ADJACENT, CORE_ROOM_ADJ, HOTSPOTS, SPAWNS, EVENTS, MOVE_ROUTES, MOVE_CHOICE_CORE, ESCAPE_CHOICE, LOADOUT_CHOICE, OPENER_EVENT } = require('../data/events')
const { GUNS, ARMOR_LABEL, ammoGrids, makeAmmo, rollDrop, AMMO_TYPES } = require('../data/ammo')
const present = require('../runtime/present')

// 战备三档：cost=进场成本 mod=全局判定修正 capacity=背包格数 cards=通行芯片。
// 轻装勘探只保留八格携行空间，大型技术资产必须选择完整撤收线路。
const LOADOUTS = {
  full:  { name: '重装回收组', cost: 450000, meds: 2, cards: 1, mod: 8,  capacity: 30 },
  half:  { name: '标准勤务组', cost: 150000, meds: 1, cards: 1, mod: 0,  capacity: 25 },
  knife: { name: '轻装勘探组', cost: 0,      meds: 1, cards: 0, mod: -8, capacity: 8 }
}

// 配给点补给价目：撤收成功后只结算消耗品。
const RESUPPLY = { card: 45000, med: 12000, round: { full: 90, half: 45, knife: 8 } }

function resupplyCost(state) {
  const per = RESUPPLY.round[state.loadout] || 0
  return state.cardsUsed * RESUPPLY.card + state.medsUsed * RESUPPLY.med + state.ammoUsed * per
}

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

// 首局前两步只擦伤：不改事件经济表，只在教程态把过量掉血压住。
function tutorialWound(state, hp) {
  if (!state || !state.tutorial || hp >= 0) return hp
  if ((state.step || 0) > 1) return hp
  return Math.max(hp, -12)
}

// 护板减伤：重装、标准、轻装承伤不同。
const ARMOR_MULT = { full: 0.65, half: 0.8, knife: 1.3 }
function armored(state, dmg) {
  const mult = ARMOR_MULT[state.loadout] || 1
  return Math.max(1, Math.round(dmg * mult))
}

function changeRisk(state, delta) {
  state.risk = clamp(state.risk + delta, 0, 100)
  state.peakRisk = Math.max(state.peakRisk || 0, state.risk)
}

// ===== 弹药：口径 + 穿深 + 发数 =====
// 穿深不足会在护板表面产生跳弹：
// 每差一级穿深判定 -15%、弹药消耗翻倍、打输还多挨三成伤害
function penGap(state, opt) {
  if (!opt || !opt.armor) return 0
  if (opt.backstab || opt.headshot) return 0   // 背身偷袭打后脑、锁头打面罩：绕开躯干甲
  const pen = state.ammo ? state.ammo.pen : 0
  return Math.max(0, opt.armor - pen)
}

// 这一枪要打掉多少发：穿深不足发生跳弹，就得翻倍消耗弹药
function roundsNeeded(state, opt) {
  if (!opt || !opt.rounds) return 0
  return penGap(state, opt) > 0 ? opt.rounds * 2 : opt.rounds
}

function ammoRounds(state) {
  return state.ammo ? state.ammo.rounds : 0
}

// 带弹也占背包：60发一格，打空了格子就腾出来
function loadGrids(state) {
  return state.weight + ammoGrids(ammoRounds(state))
}

function overload(state) {
  return Math.max(0, loadGrids(state) - state.capacity)
}

// 记录每次判定的真实快照：战报复盘只能引用这里的数据，不允许事后编造
function recordDecision(state, opt, info) {
  if (!state.decisionTrail) return
  if (!info.pass) state.sig.failedChecks += 1
  state.decisionTrail.push({
    step: state.step,
    node: state.node ? state.node.id : null,
    text: String(opt.text || '').slice(0, 30),
    chance: info.chance,
    pass: !!info.pass,
    gap: info.gap || 0,
    armor: opt.armor || 0,
    hp: state.hp,
    risk: state.risk
  })
}

function ammoText(state) {
  if (!state.ammo || state.ammo.rounds <= 0) return '空仓'
  const a = state.ammo
  return `${a.caliber} ${a.name} · ${a.pen}穿 · ${a.rounds}发`
}

// 局内补弹：口径对得上才装得进枪
function addRounds(state, typeId, rounds, messages) {
  const t = AMMO_TYPES[typeId]
  if (!t) return false
  if (state.ammo && state.ammo.caliber === t.caliber) {
    // 同口径：低穿弹不能顶掉手里的高穿弹，只把发数并进去
    state.ammo.rounds += rounds
    if (t.pen > state.ammo.pen) {
      state.ammo.id = t.id
      state.ammo.name = t.name
      state.ammo.pen = t.pen
      if (messages) messages.push(`换上${t.name}（${t.pen}穿）——这下打得穿了`)
    } else if (messages) {
      messages.push(`补到同口径 ${t.name} ${rounds}发`)
    }
    return true
  }
  return false
}

// 换枪：口径不匹配时接管对方整套武器。
function swapGun(state, typeId, rounds, messages) {
  const t = AMMO_TYPES[typeId]
  if (!t) return false
  state.gun = { name: `缴获${t.caliber}步枪`, caliber: t.caliber }
  state.ammo = makeAmmo(typeId, rounds)
  state.gunSwaps += 1
  if (messages) messages.push(`口径对不上——索性把他的枪一起端了：${t.caliber} ${t.name}（${t.pen}穿）${rounds}发`)
  return true
}

// 配给点格式化：≥1万显示为「x万」。
function fmtVal(v) {
  if (v >= 10000) {
    const w = v / 10000
    return (w >= 100 ? Math.round(w) : Math.round(w * 10) / 10) + '万'
  }
  return String(v)
}

// ===== 局内流程编排：8 个决策位 =====
// 0 出生 | 1-2 当前区事件 | 3 深入方向选择 | 4-6 深入区事件 | 7 撤离选择（结算）
const TOTAL_STEPS = 8
const MOVE_STEP = 3
const ESCAPE_STEP = 7
const ROOM_NAMES = {
  coolant: '冷却舱', maglev: '磁悬舱', compressor: '压缩机房',
  dimhold: '暗光仓', storm: '风暴庭院', tide: '潮汐坞'
}

function pushRoute(state, label) {
  if (!label) return
  const last = state.routeTrail[state.routeTrail.length - 1]
  if (last !== label) state.routeTrail.push(label)
}

function addLoot(state, item) {
  if (!item) return null
  if (!item.lootId) item.lootId = `L${++state.lootSeq}`
  if (item.secured === undefined) item.secured = false
  state.loot.push(item)
  state.weight += item.weight
  return item
}

function secureWeight(state) {
  return state.loot.filter(it => it.secured).reduce((sum, it) => sum + it.weight, 0)
}

function toggleSecure(state, lootId) {
  const item = state.loot.find(it => it.lootId === lootId)
  if (!item) return { ok: false, message: '物资不存在' }
  if (item.secured) {
    item.secured = false
    return { ok: true, secured: false, item }
  }
  if (secureWeight(state) + item.weight > state.safebox) {
    return { ok: false, message: `低温回收匣只剩 ${state.safebox - secureWeight(state)} 格` }
  }
  item.secured = true
  return { ok: true, secured: true, item }
}

function dropLoot(state, lootId, reason = '主动丢弃') {
  const index = state.loot.findIndex(it => it.lootId === lootId)
  if (index < 0) return null
  const [dropped] = state.loot.splice(index, 1)
  state.weight = Math.max(0, state.weight - dropped.weight)
  state.droppedLoot.push({ name: dropped.name, value: dropped.value, reason })
  pushLog(state, `${reason} ${dropped.name}（${dropped.weight}格）`, 'fail')
  return dropped
}

// 模拟器使用：在4格内求总价值最高组合；真人由背包抽屉手动管理
function autoSecureBest(state) {
  state.loot.forEach(item => {
    if (!item.lootId) item.lootId = `L${++state.lootSeq}`
    if (item.secured === undefined) item.secured = false
  })
  const candidates = state.loot.filter(it => it.weight <= state.safebox)
  const dp = Array.from({ length: state.safebox + 1 }, () => ({ value: 0, ids: [] }))
  for (const item of candidates) {
    for (let cap = state.safebox; cap >= item.weight; cap--) {
      const prev = dp[cap - item.weight]
      if (prev.value + item.value > dp[cap].value) {
        dp[cap] = { value: prev.value + item.value, ids: prev.ids.concat(item.lootId) }
      }
    }
  }
  const best = dp.reduce((a, b) => b.value > a.value ? b : a)
  const ids = new Set(best.ids)
  state.loot.forEach(it => { it.secured = ids.has(it.lootId) })
  return best.ids
}

function getRunMeta(state) {
  const remaining = Math.max(0, 30 * 60 - state.step * 3 * 60)
  const mm = Math.floor(remaining / 60)
  const ss = String(remaining % 60).padStart(2, '0')
  const rounds = ammoRounds(state)
  const remainSteps = Math.max(0, ESCAPE_STEP - state.step)
  const stepShown = Math.min((state.step || 0) + 1, TOTAL_STEPS)
  return {
    timeText: `${mm}:${ss}`,
    phase: PHASE_LABEL[phaseOf(state)],
    zoneName: (ZONES[state.zone] || {}).name || '基地',
    routeText: state.routeTrail.join(' → '),
    secureWeight: secureWeight(state),
    ammoText: ammoText(state),
    ammoRounds: rounds,
    // 一匣30发：低于一匣就该考虑撤了，空仓只能靠刀和腿
    ammoClass: rounds <= 0 ? 'ammo-out' : rounds < 30 ? 'ammo-low' : 'ammo-ok',
    ammoGrids: ammoGrids(rounds),
    loadGrids: loadGrids(state),
    step: state.step,
    stepShown,
    totalSteps: TOTAL_STEPS,
    remainSteps,
    stepText: state.step >= ESCAPE_STEP
      ? '撤离步'
      : (remainSteps <= 2 ? `还剩${remainSteps}步` : `第${stepShown}/${TOTAL_STEPS}步`)
  }
}

// ===== 开局 =====
// buffs: { extraMed: 固定医疗补给, redBoost: 测试用绝密资产概率修正, balance: 仓库余额 }
// balance 由外部（局外存档）传进来：引擎只拿它当数据判断哪档买得起，自己不碰任何存储
function newRun(buffs = {}) {
  // 随机出生点决定开局动线。首局钩子固定冻港西堤，避免雾中短戏和下一步地图打架。
  const spawn = buffs.opener
    ? (SPAWNS.find(s => s.id === 'spawn_harbor_west') || SPAWNS[0])
    : SPAWNS[Math.floor(Math.random() * SPAWNS.length)]
  const state = {
    hp: 100,
    weight: 0,
    capacity: 25,          // 背包容量(格)：装超了各判定和撤离都吃惩罚
    safebox: 4,            // 低温回收匣固定四格：雪橇撤收只能保留匣内物品
    gun: null,             // 当前用的枪：口径决定局内捡到的弹能不能用
    ammo: null,            // 当前上膛的弹：{ 口径, 弹种, 穿深, 发数 }
    meds: 0,
    cards: 0,              // 通行芯片
    mod: 0,                // 战备带来的全局判定修正
    cost: 0,               // 战备成本：阵亡/撤离失败即血亏
    // 仓库余额：买不起的战备档在选择页直接禁用。不传就按"钱随便花"处理，
    // 这样纯引擎测试和模拟器不用关心局外存档
    balance: typeof buffs.balance === 'number' ? buffs.balance : Infinity,
    loadout: null,         // 战备档位（进场前必选）
    goal: buffs.goal || '',// 针对性重开带进来的本局目标，只提示不强制
    extraMed: buffs.extraMed ? 1 : 0,
    risk: 10,              // 风险等级 0-100：随时间和动静上涨
    peakRisk: 10,          // 本局到达过的最高风险（战报不能拿最终风险冒充峰值）
    step: 0,
    zone: spawn.zone,
    spawnId: spawn.id,
    levers: 0,             // 已接通电源数（冷却舱+压缩机房）
    leverRooms: { coolant: false, compressor: false }, // 两处配电柄分开记录
    bagClosed: false,      // 货运雪橇名额已用
    leverStep: null,       // 第二路电源接通时的步数
    pendingEvent: null,    // 路线抉择指定的下一个事件（过桥→选楼这类地图流转）
    pendingLoot: null,     // 开柜/检查战场背包翻出的待拾取物品（逐件揭示，拿不拿自己定，不占步数）
    lastRoom: null,        // 内环当前房间，事件只在相邻房间流转
    tags: { pvp: 0, ai: 0, boss: 0, takeover: 0 },  // 本局战果统计（勋章判定用）
    loot: [],
    lootSeq: 0,
    routeTrail: [],
    decisionTrail: [],     // 每次判定的快照：复盘"哪一步开始崩"的原始材料
    escapeAttempt: null,   // 最后一次撤离判定的现场数据（超重/残血/读秒都记在这）
    // 结算复盘信号：全部来自真实过程，绝不为了煽动重开而编造"就差一点"
    sig: {
      encounters: 0,       // 被摸了几次
      encounterDmg: 0,     // 遭遇战累计掉血
      overloadSteps: 0,    // 有几步是超重状态下走的
      failedChecks: 0,     // 判定失败次数
      grabAll: 0,          // 顶着枪声硬薅柜子的次数
      skippedValue: 0,     // 主动留下没拿的价值
      dryAmmoSteps: 0      // 备弹不足一匣还在推进的步数
    },
    ammoUsed: 0,           // 累计射出发数
    ironHits: 0,           // 跳弹次数
    gunSwaps: 0,
    medsUsed: 0,
    cardsUsed: 0,
    droppedLoot: [],
    log: [],
    usedEvents: [],        // 已出过的事件，避免一局重复
    redBoost: buffs.redBoost || 0,
    alive: true,
    ended: false,
    report: null,
    node: null
  }
  // 大厅点「出发」会带 autoLoadout，跳过整备台；测试和复盘仍可停在战备页。
  if (buffs.autoLoadout && LOADOUTS[buffs.autoLoadout]) {
    if (buffs.opener) state.tutorial = true
    applyLoadout(state, buffs.autoLoadout, [])
    if (buffs.opener) {
      state.openerId = OPENER_EVENT.id
      state.node = decorateNode(state, OPENER_EVENT)
    }
    return state
  }
  state.node = decorateNode(state, LOADOUT_CHOICE)
  return state
}

// ===== 成功率修正 =====
// 每次判定独立：只看选项本身的 base + 战备 + 当前伤势/超载，不随局内时间叠加衰减
// （风险值不压事件成功率——它只驱动突袭检定和撤离难度）
function successChance(state, base, opt) {
  let c = base + state.mod                                 // 装备修正：重装+8 / 轻装-8
  c -= (100 - state.hp) * 0.25                             // 伤势影响发挥：满血0，20血-20
  c -= overload(state) * 2.5                               // 超载惩罚：每超1格 -2.5（弹药也占格）
  c -= penGap(state, opt) * 15                             // 跳弹：每差一级穿深 -15
  return clamp(Math.round(c), 10, 95)
}

// 撤收成功率：雪橇最稳但容量有限；索道需要双电源；风暴列车是高风险方案。
// out 是可选的扣分明细收集器：战报要把"为什么只有 59%"逐项拆给玩家看，
// 光说"运气不好"等于没说，玩家下一局照样犯同样的错
function escapeChance(state, opt, out) {
  const cut = (tag, label, delta) => {
    if (out && Math.round(delta)) out.push({ tag, label, delta: Math.round(delta) })
    return delta
  }
  // 南侧撤收线对冻港、塔群和管廊有位置惩罚。
  const far = state.zone === 'harbor' || state.zone === 'weather' || state.zone === 'thermal'
  const pos = far ? cut('pos', `人还在${ZONES[state.zone].name}`, 8) : 0
  // 雪橇不吃装备修正；索道和列车需要突围。
  let c = opt.base + (opt.method === 'bag' ? 0 : state.mod)
  if (opt.method === 'bag') {
    // 雪橇卸下背包，超重不惩罚。
    c -= cut('hp', `伤势 ${state.hp} 血`, (100 - state.hp) * 0.15)
    c -= cut('risk', `风险 ${state.risk}`, Math.max(0, state.risk - 60) * 0.1)
    return clamp(Math.round(c - pos), 40, 98)
  }
  if (opt.method === 'heli') {
    // 双电源索道路线对风险相对钝感。
    c -= cut('hp', `伤势 ${state.hp} 血`, (100 - state.hp) * 0.2)
    c -= cut('overweight', `超重 ${overload(state)} 格`, overload(state) * 3)
    c -= cut('risk', `风险 ${state.risk}`, Math.max(0, state.risk - 45) * 0.25)
    // 双电源接通后索道开放五分钟；过早进场和错过窗口都会降低成功率。
    if (state.leverStep !== null) {
      const wait = state.step - state.leverStep
      if (wait <= 1) c -= cut('heli', '索道刚启动就进入暴露区', 4)
      else if (wait <= 3) c += 6
      else c -= cut('heli', `错过索道窗口（拖了 ${wait} 步）`, 10)
    }
    return clamp(Math.round(c - pos), 20, 95)
  }
  if (opt.method === 'sneak') {
    // 借用他队索道窗口：伤势影响小，超重影响大。
    c = opt.base
    c -= cut('hp', `伤势 ${state.hp} 血`, (100 - state.hp) * 0.15)
    c -= cut('overweight', `超重 ${overload(state)} 格`, overload(state) * 2)
    c -= cut('risk', `风险 ${state.risk}`, Math.max(0, state.risk - 50) * 0.2)
    return clamp(Math.round(c - pos), 25, 92)
  }
  if (opt.method === 'ambush') {
    // 截停撤收队：正面交火，装备与伤势影响明显。
    c -= cut('hp', `伤势 ${state.hp} 血`, (100 - state.hp) * 0.3)
    c -= cut('overweight', `超重 ${overload(state)} 格`, overload(state) * 2)
    c -= cut('risk', `风险 ${state.risk}`, Math.max(0, state.risk - 45) * 0.2)
    return clamp(Math.round(c - pos), 15, 92)
  }
  // 风暴列车对超重相对宽容。
  c -= cut('hp', `伤势 ${state.hp} 血`, (100 - state.hp) * 0.3)
  c -= cut('overweight', `超重 ${overload(state)} 格`, overload(state) * 1)
  c -= cut('risk', `风险 ${state.risk}`, Math.max(0, state.risk - 45) * 0.25)
  return clamp(Math.round(c - pos), 15, 92)
}

// ===== 房间常驻动作：双配电柄 =====
const LEVER_ROOMS = {
  coolant: { name: '冷却舱', text: '合上冷却舱配电柄（极地索道条件之一）' },
  compressor: { name: '压缩机房', text: '合上压缩机房配电柄（极地索道条件之一）' }
}
const ROOM_ACTION_SKIP = ['escape', 'loot', 'move', 'loadout']

// 挑一个目标房间里还没出过的事件当落点。必须是确定性的——
// decorateNode 和 choose 会各调一次，两次拿到的选项列表必须完全一致，否则点下去就错位了
function roomEntryEvent(state, room) {
  const inRoom = EVENTS.filter(e => e.room === room && !e.entryOnly && whenOk(state, e.when))
  const unused = inRoom.filter(e => !state.usedEvents.includes(e.id))
  const phase = phaseOf(state)
  const fit = unused.filter(e => !e.phase || e.phase === phase)
  const pick = fit[0] || unused[0] || inRoom[0]
  return pick ? pick.id : null
}

function withRoomActions(state, node) {
  if (!node || !node.options || ROOM_ACTION_SKIP.includes(node.type) || node.free) return node
  if (state.levers >= 2) return node
  const extra = []

  // 1) 人在有闸的房间：把闸列出来（该事件自带拉闸项就不重复加）
  const here = LEVER_ROOMS[node.room]
  if (here && !state.leverRooms[node.room] &&
      !node.options.some(o => o.success && o.success.leverRoom === node.room)) {
    extra.push({
      text: here.text,
      verb: '合闸',
      safe: true,
      need: { maxLevers: 2, leverRoom: node.room },
      success: { levers: 1, leverRoom: node.room, risk: 4, log: `${here.name}配电柄已合上` }
    })
  }

  // 已接通一路电源时，允许穿过风暴庭院完成第二处供电。
  if (state.levers === 1 && node.zone === 'core') {
    const want = state.leverRooms.coolant ? 'compressor' : 'coolant'
    if (node.room !== want && !state.leverRooms[want]) {
      const go = roomEntryEvent(state, want)
      if (go) {
        // 一步走完"穿过去 + 拉下来"：文案说了把闸拉了，就不能只把人送到门口。
        // 拆成两步的话，双闸要吃掉三个决策位——这张图统共才六个，正规军路线会被时间成本压死
        extra.push({
          text: `穿过风暴庭院直奔${LEVER_ROOMS[want].name}，接通第二路电源`,
          verb: '穿庭合闸',
          base: 78,
          success: {
            levers: 1, leverRoom: want, goEvent: go, risk: 8,
            log: `借避风墙穿过庭院，${LEVER_ROOMS[want].name}供电接通`
          },
          fail: { hp: -14, risk: 14, log: '穿庭院时被履带哨机锁定，只能退回' }
        })
      }
    }
  }

  return extra.length ? { ...node, options: node.options.concat(extra) } : node
}

// 给节点的每个选项算好实时成功率/可用性，供 UI 直接展示
function decorateNode(state, node) {
  if (!node || !Array.isArray(node.options)) {
    node = {
      id: 'hold',
      type: 'event',
      text: '这一带空了。',
      options: [{ text: '换邻近再搜', verb: '再搜', safe: true, success: { log: '改换邻近区域继续搜索', risk: 2 } }]
    }
  }
  node = withRoomActions(state, node)
  const isEscape = node.type === 'escape'
  const options = node.options
    .filter(o => {
      if (!o.need) return true
      if (o.need.hpMin && state.hp < o.need.hpMin) return false
      if (o.need.maxLevers !== undefined && state.levers >= o.need.maxLevers) return false // 闸拉满就不再显示拉闸项
      if (o.need.leverRoom && state.leverRooms[o.need.leverRoom]) return false
      return true
    })
    .map(o => {
      const lackLevers = !!(o.need && o.need.minLevers && state.levers < o.need.minLevers)
      const need = roundsNeeded(state, o)
      const lackAmmo = need > ammoRounds(state)
      const lackMeds = !!(o.cost && (o.cost.meds || 0) > state.meds)
      const lackCard = !!(o.cost && (o.cost.card || 0) > state.cards)
      // 轻装勘探成本为零，余额见底仍可开局。
      const price = o.loadout && LOADOUTS[o.loadout] ? LOADOUTS[o.loadout].cost : 0
      const lackFunds = price > state.balance
      const lackCost = lackAmmo || lackMeds || lackCard || lackFunds
      const gap = penGap(state, o)
      let ct = lackLevers ? `供电 ${state.levers}/2` : costText(state, o)
      // 跳弹惩罚如实写在选项上：不禁用，让玩家自己决定要不要拿低穿弹去磨护板
      if (gap > 0) ct = `${ct ? ct + ' · ' : ''}跳弹 -${gap * 15}%（${ARMOR_LABEL[o.armor]}要${o.armor}穿，你只有${state.ammo ? state.ammo.pen : 0}穿）`
      // 撤收页明示雪橇容量与索道窗口。
      if (isEscape && o.method === 'bag') {
        const lost = bagLostCount(state)
        if (lost > 0) ct = `将丢 ${lost} 件（低温回收匣只保 ${state.loot.length - lost} 件）`
      }
      if (isEscape && o.method === 'heli' && !lackLevers && state.leverStep !== null) {
        const wait = state.step - state.leverStep
        ct = wait <= 1 ? '索道刚启动，吊舱区仍在交叉火力下'
          : wait <= 3 ? '索道窗口接近末段，早到者正在散开'
          : '错过五分钟窗口，需要重新接通供电'
      }
      if (node.type === 'move' && state.risk >= 50) {
        const hint = state.risk >= 75 ? '途中很可能交火' : '途中可能遭遇'
        ct = ct ? `${ct} · ${hint}` : hint
      }
      if (state.levers < 2 && (o.moveTo === 'core' || /coolant|compressor/.test(o.goEvent || ''))) {
        ct = ct ? `${ct} · 可合闸` : '可合闸'
      }
      const moveTo = o.moveTo || (o.success && o.success.moveTo) || null
      const goEvent = o.goEvent || (o.success && o.success.goEvent) || null
      return {
        idx: node.options.indexOf(o),
        text: o.text,
        verb: present.verb({
          text: o.text,
          verb: o.verb,
          moveTo,
          goEvent,
          method: o.method,
          wait: o.wait,
          loadout: o.loadout,
          rounds: o.rounds,
          safe: o.safe,
          lootAction: o.lootAction
        }),
        full: o.text,
        lootAction: o.lootAction || null,
        // 战备档位要透出来：局外仓库得知道这一项该扣多少钱，光靠文案匹配不可靠
        loadout: o.loadout || null,
        safe: !!o.safe,
        rounds: o.rounds || 0,
        moveTo,
        goEvent,
        method: o.method || null,
        wait: !!o.wait,
        // 转移/战备/路线抉择节点没有判定，不显示成功率
        chance: (node.type === 'move' || node.type === 'loadout' || node.free) ? null
          : o.safe ? 100
          : isEscape ? escapeChance(state, o)
          : successChance(state, o.base, o),
        disabled: lackCost || lackLevers,
        disabledReason: lackLevers ? `需要双电源，当前 ${state.levers}/2`
          : lackFunds ? `仓库只剩 ${fmtVal(state.balance)} 配给点，无法投入这档装备`
          : lackCard ? '缺少通行芯片'
          : lackAmmo ? `备弹不够：需要 ${need} 发，只剩 ${ammoRounds(state)} 发`
          : lackMeds ? '医疗不足'
          : '',
        costText: ct
      }
    })
  // revealTier：拾取节点的揭示品质（UI 红金高光+震动用）
  return {
    id: node.id,
    type: node.type || 'event',
    text: present.spot(node),
    full: node.text,
    zone: node.zone || state.zone || null,
    room: node.room || null,
    free: !!node.free,
    options,
    revealTier: node.revealTier || null,
    revealItem: node.revealItem || null
  }
}

// 货运雪橇会留下多少未装箱资产。
function bagLostCount(state) {
  return state.loot.filter(it => !it.secured).length
}

function costText(state, opt) {
  const parts = []
  const need = roundsNeeded(state, opt)
  if (need) parts.push(`约${need}发`)
  if (opt.armor) parts.push(ARMOR_LABEL[opt.armor])
  if (opt.cost && opt.cost.meds) parts.push(`医疗×${opt.cost.meds}`)
  if (opt.cost && opt.cost.card) parts.push(`通行芯片×${opt.cost.card}`)
  return parts.join(' · ')
}

function optionBlockReason(state, opt) {
  if (!opt) return '选项不存在'
  const need = opt.need || {}
  const cost = opt.cost || {}
  if (need.hpMin && state.hp < need.hpMin) return `生命不足（需要 ${need.hpMin}）`
  if (need.minLevers && state.levers < need.minLevers) return `需要双电源，当前 ${state.levers}/2`
  if (need.maxLevers !== undefined && state.levers >= need.maxLevers) return '该操作当前已失效'
  if (need.leverRoom && state.leverRooms[need.leverRoom]) return '这路电源已经接通'
  const rounds = roundsNeeded(state, opt)
  if (rounds > ammoRounds(state)) return `备弹不够：需要 ${rounds} 发，只剩 ${ammoRounds(state)} 发`
  if ((cost.meds || 0) > state.meds) return '医疗不足'
  if ((cost.card || 0) > state.cards) return '缺少通行芯片'
  if (opt.loadout && LOADOUTS[opt.loadout] && LOADOUTS[opt.loadout].cost > state.balance) {
    return `仓库只剩 ${fmtVal(state.balance)} 配给点，无法投入这档装备`
  }
  return ''
}

// 战备落地：应用配置后直接进出生点，不占步数不涨风险
// 单独抽出来是为了"针对性重开"能带着上一局的结论直接开局
function applyLoadout(state, loadoutId, messages = []) {
  const lo = LOADOUTS[loadoutId]
  const gun = GUNS[loadoutId]
  if (!lo || !gun) return { state, messages }
  state.loadout = loadoutId
  state.cost = state.tutorial ? 0 : lo.cost
  state.gun = { name: gun.name, caliber: gun.caliber }
  state.ammo = makeAmmo(gun.ammo, gun.rounds)
  state.meds = lo.meds + state.extraMed
  state.cards = lo.cards
  state.mod = lo.mod
  state.capacity = lo.capacity
  pushRoute(state, ZONES[state.zone].name)
  const costLog = state.tutorial
    ? '（首趟配发，倒了不扣押金）'
    : (lo.cost ? `（投入 ${fmtVal(lo.cost)}配给点）` : '（零成本勘探）')
  pushLog(state, `${lo.name}进场${costLog}`, 'move')
  pushLog(state, `${gun.name}：${ammoText(state)}`, 'move')
  pushLog(state, `出生点：${ZONES[state.zone].name}`, 'move')
  messages.push(`${lo.name}进场 · 出生点：${ZONES[state.zone].name}`)
  const spawn = SPAWNS.find(s => s.id === state.spawnId) || SPAWNS[0]
  state.node = decorateNode(state, spawn)
  return { state, messages }
}

// ===== 决策处理：唯一入口 =====
// 返回 { state, messages }，messages 是本步发生的事（UI 滚动播报用）
function choose(state, optIdx) {
  if (state.ended) return { state, messages: [] }
  const rawNode = withRoomActions(state, findRawNode(state))
  if (!rawNode || !Array.isArray(rawNode.options)) {
    return { state, messages: ['现场无法读取，请换一个选项'] }
  }
  const opt = rawNode.options[optIdx]
  const messages = []
  const blocked = optionBlockReason(state, opt)
  if (blocked) {
    messages.push(`无法执行：${blocked}`)
    return { state, messages }
  }

  // 扣前置消耗：先打光弹匣里的发数，穿深不够的还要多打一倍去磨
  const spent = roundsNeeded(state, opt)
  if (spent) {
    if (!state.ammo) {
      messages.push('没有可用弹药')
      return { state, messages }
    }
    const gap = penGap(state, opt)
    state.ammo.rounds = Math.max(0, state.ammo.rounds - spent)
    state.ammoUsed += spent
    if (gap > 0) {
      state.ironHits += 1
      messages.push(`连续跳弹：${state.ammo.name}只有${state.ammo.pen}穿，无法稳定击穿${ARMOR_LABEL[opt.armor]}（判定 -${gap * 15}%，弹药翻倍）`)
    }
    messages.push(`射出 ${spent} 发，剩 ${state.ammo.rounds} 发`)
  }
  if (opt.cost) {
    state.meds -= opt.cost.meds || 0
    state.cards -= opt.cost.card || 0
    state.medsUsed += opt.cost.meds || 0
    state.cardsUsed += opt.cost.card || 0
  }

  if (rawNode.type === 'loot') {
    // 拾取节点：逐件拿/不拿，全程不占步数不涨风险（纠结本身不惩罚，惩罚在声音检定里）
    const pl = state.pendingLoot
    const act = opt.lootAction
    if (act === 'take') {
      const it = pl.items[pl.idx]
      addLoot(state, it)
      messages.push(`收入背包 [${it.tierLabel}] ${it.name}（${fmtVal(it.value)}配给点 / ${it.weight}格）`)
      pushLog(state, `拿走 [${it.tierLabel}] ${it.name}`, it.tier === 'red' ? 'red' : 'ok')
      if (it.tier === 'red') pushLog(state, `发现绝密资产：${it.name}！`, 'red')
      pl.idx += 1
    } else if (act === 'skip') {
      const it = pl.items[pl.idx]
      state.sig.skippedValue += it.value
      messages.push(`留下了 ${it.name}`)
      pl.idx += 1
    } else if (act === 'grabAll') {
      state.sig.grabAll += 1
      // 顶着枪声强取：剩余资产全部收入背包，但必须承担近距离反击
      for (let i = pl.idx; i < pl.items.length; i++) {
        const it = pl.items[i]
        addLoot(state, it)
        messages.push(`收入背包 [${it.tierLabel}] ${it.name}（${fmtVal(it.value)}配给点 / ${it.weight}格）`)
        if (it.tier === 'red') pushLog(state, `发现绝密资产：${it.name}！`, 'red')
      }
      const dmg = armored(state, 22 + Math.floor(Math.random() * 18))
      state.hp = clamp(state.hp - dmg, 0, 100)
      changeRisk(state, 8)
      pushLog(state, `顶着枪声薅完了柜子，交火损失${dmg}生命`, 'crit')
      messages.push(`⚠ 对面贴脸了，边翻边挨打 -${dmg} HP`)
      pl.idx = pl.items.length
      if (state.hp <= 0) {
        state.alive = false
        pushLog(state, '倒在了没翻完的柜子前——贪字头上一把刀', 'crit')
        return endRun(state, false, null, messages)
      }
    } else if (act === 'flee') {
      for (let i = pl.idx; i < pl.items.length; i++) state.sig.skippedValue += pl.items[i].value
      messages.push(`丢下剩余 ${pl.items.length - pl.idx} 件，从侧门脱离`)
      pushLog(state, '听见脚步果断弃柜脱离——命比货值钱', 'move')
      pl.idx = pl.items.length
    }
    if (pl.idx >= pl.items.length) state.pendingLoot = null
    state.node = decorateNode(state, state.pendingLoot ? lootNodeFor(state) : nextRawNode(state))
    return { state, messages }
  }

  if (rawNode.type === 'loadout') {
    return applyLoadout(state, opt.loadout, messages)
  }

  if (rawNode.type === 'move') {
    // 转移节点：切区域（可指定入口抉择，如过中控桥→选先吃哪栋楼）
    const fromZone = state.zone
    state.zone = opt.moveTo
    if (opt.moveTo !== 'core' && opt.moveTo !== 'aurora') state.lastRoom = null // 出核心清房间记忆
    if (fromZone === 'aurora' && opt.moveTo === 'core') state.lastRoom = 'storm'
    pushRoute(state, opt.moveTo === 'core' ? '核心区' : ZONES[opt.moveTo].name)
    changeRisk(state, opt.risk || 0)
    if (opt.goEvent) state.pendingEvent = opt.goEvent
    pushLog(state, `深入${ZONES[opt.moveTo].name}`, 'move')
    messages.push(`进入${ZONES[opt.moveTo].name}（${ZONES[opt.moveTo].riskTag}）`)
  } else if (rawNode.type === 'escape') {
    // 蹲读秒不是撤离，不结算：往下走一步流程，再回到撤离页时窗口就对上了
    if (opt.wait) {
      resolveEvent(state, opt, messages)
      if (!state.alive) return endRun(state, false, null, messages)
    } else {
      return resolveEscape(state, opt, messages)
    }
  } else {
    // 普通事件：判定
    resolveEvent(state, opt, messages)
    if (!state.alive) return endRun(state, false, null, messages)
    // 路线抉择节点（进核心选楼这类）不消耗时间，直接进入下一个节点
    if (rawNode.free) {
      state.node = decorateNode(state, nextRawNode(state))
      return { state, messages }
    }
  }

  // 时间流逝：每步风险自然上涨（停留越久越危险）
  state.step += 1
  if (opt.success && opt.success.skipStep) { state.step += 1; state.skipped = true }
  changeRisk(state, 2)
  if (overload(state) > 0) state.sig.overloadSteps += 1
  if (state.loadout !== 'knife' && ammoRounds(state) < 30) state.sig.dryAmmoSteps += 1

  // 遭遇检定按研究城人流动线推演。
  // 1) 热点遭遇：当前房间和行动阶段决定会不会撞上从对应出生点赶来的队
  // 2) 兜底遭遇：研究城没有固定安全区，巡检排查基础概率3%，风险超50后加码
  // 轻装被发现概率更高；携带暴风演算主机会广播定位脉冲。
  const knife = state.loadout === 'knife'
  const brick = WHEN.hasBrick(state)
  const heat = (knife ? 1.5 : 1) * (brick ? 1.8 : 1)
  const spot = state.zone === 'aurora' ? 'aurora' : state.zone === 'core' ? state.lastRoom : null
  const phase = phaseOf(state)
  let encounterText = null
  if (spot && HOTSPOTS[spot]) {
    const flows = HOTSPOTS[spot].filter(h => h.phase === phase && h.from !== state.spawnId)
    for (const h of flows) {
      if (Math.random() * 100 < h.chance * heat) { encounterText = h.text; break }
    }
  }
  const baseChance = (2 + Math.max(0, state.risk - 55) * 0.65) * heat
  if (!encounterText && Math.random() * 100 < baseChance) {
    encounterText = brick ? '演算主机的定位脉冲暴露了路线——追踪队正在接近' : '遭遇灰潮武装搜索组'
  }
  if (encounterText) {
    // 基础伤害经护板档位修正。
    let dmg = armored(state, 22 + Math.floor(Math.random() * 18))
    if (state.tutorial && (state.step || 0) <= 2) dmg = Math.min(dmg, 10)
    state.hp = clamp(state.hp - dmg, 0, 100)
    changeRisk(state, 4)
    state.sig.encounters += 1
    state.sig.encounterDmg += dmg
    pushLog(state, `${encounterText}，交火损失${dmg}生命${knife ? '（轻装防护不足）' : ''}`, 'crit')
    messages.push(`⚠ ${encounterText}！-${dmg} HP`)
    if (state.hp <= 0) {
      state.alive = false
      return endRun(state, false, null, messages)
    }
  }

  // 推进到下一节点
  state.node = decorateNode(state, nextRawNode(state))
  return { state, messages }
}

// 普通事件判定
function resolveEvent(state, opt, messages) {
  const gap = penGap(state, opt)
  const chance = opt.safe ? 100 : successChance(state, opt.base, opt)
  const pass = opt.safe || Math.random() * 100 < chance
  recordDecision(state, opt, { chance, pass, gap })
  const eff = pass ? opt.success : opt.fail
  if (!eff) return
  const iron = gap > 0

  // 战果统计：pvp=敌对回收队，ai=守备单位，boss=指挥官，takeover=装备接管。
  if (pass && opt.medal && state.tags) {
    state.tags[opt.medal] = (state.tags[opt.medal] || 0) + 1
    // 接管补给时仍需校验口径；指挥官更容易掉落高穿弹。
    const isBoss = opt.medal === 'boss'
    const dropType = rollDrop(opt.medal)
    const dropRounds = isBoss ? 60 : 30 + Math.floor(Math.random() * 31)
    let supply = ''
    if (addRounds(state, dropType, dropRounds, messages)) {
      supply = `弹药+${dropRounds}发`
    } else if (opt.medal !== 'ai' && (ammoRounds(state) < 30 || AMMO_TYPES[dropType].pen > (state.ammo ? state.ammo.pen : 0))) {
      // 口径不通用，但自己快空仓或者对面的弹更能打穿：连枪一起端走
      swapGun(state, dropType, dropRounds, messages)
      supply = '换枪换弹'
    } else {
      messages.push(`他用的是${AMMO_TYPES[dropType].caliber}，你的枪吃不了这弹`)
      supply = '口径不通用'
    }
    if (isBoss || Math.random() < 0.3) {
      state.meds += 1
      supply += '、医疗+1'
    }
    if (state.hp < 100) {
      const heal = isBoss ? 12 : 6
      state.hp = clamp(state.hp + heal, 0, 100)
      supply += `、包扎回血+${heal}`
    }
    messages.push(`接管补给：${supply}`)
    pushLog(state, `战场补给：${supply}`, 'ok')
    // 敌对回收队与守备单位提供不同价值的装备资产。
    if (opt.medal === 'pvp' || opt.medal === 'takeover' || opt.medal === 'ai') {
      const isPlayer = opt.medal !== 'ai'
      const gear = {
        name: isPlayer ? '接管装备·护板与勤务枪' : '回收装备·守备制式枪',
        tier: 'gold',
        tierLabel: TIERS.gold.label,
        tierOrder: TIERS.gold.order,
        value: isPlayer ? 100000 + Math.floor(Math.random() * 200000) : 30000 + Math.floor(Math.random() * 50000),
        weight: isPlayer ? 3 : 2
      }
      addLoot(state, gear)
      messages.push(`接管 [${gear.tierLabel}] ${gear.name}（${fmtVal(gear.value)}配给点 / ${gear.weight}格）`)
    }
  }

  // 环境伤害不受护板修正：跌落、灼伤等后果由事件单独标定
  // 护甲差距体现在遭遇交火里（armored 只作用于突袭伤害）
  // 跳弹后仍然交火失败：对面护板和火力占优，反击伤害再加三成
  if (eff.hp) {
    const raw = !pass && iron ? Math.round(eff.hp * 1.3) : eff.hp
    state.hp = clamp(state.hp + tutorialWound(state, raw), 0, 100)
  }
  if (eff.risk) changeRisk(state, eff.risk)
  if (eff.rounds) {
    // 补给箱/弹药堆：给的是同口径弹，捡到就能直接压进弹匣
    const boxType = eff.ammoType || (state.ammo ? state.ammo.id : 'dawn3')
    if (!addRounds(state, boxType, eff.rounds, messages)) {
      messages.push(`补给里是${AMMO_TYPES[boxType] ? AMMO_TYPES[boxType].caliber : '别的口径'}的弹，你的枪用不上`)
    }
  }
  if (eff.meds) state.meds = Math.max(0, state.meds + eff.meds)
  if (eff.cards) {
    state.cards += eff.cards
    messages.push(`找到通行芯片 +${eff.cards}（可开启外围气密门）`)
  }
  if (eff.levers) {
    const before = state.levers
    if (eff.leverRoom) state.leverRooms[eff.leverRoom] = true
    state.levers = eff.leverRoom
      ? Object.values(state.leverRooms).filter(Boolean).length
      : Math.min(2, state.levers + eff.levers)
    if (state.levers >= 2 && before < 2) {
      // 第二路电源接通会触发全区广播与索道窗口。
      state.leverStep = state.step + 1
      changeRisk(state, 10)
      messages.push('供电进度 2/2 —— 全区广播：极地索道开放，五分钟窗口开始（风险+10）')
      pushLog(state, '双电源接通，索道窗口开启；吊舱区会迅速成为争夺点', 'crit')
    } else {
      messages.push(`供电进度 ${state.levers}/2`)
    }
  }
  // 事件内换区（刷卡过点/管道直插核心区等）
  if (eff.moveTo) {
    state.zone = eff.moveTo
    if (eff.moveTo !== 'core' && eff.moveTo !== 'aurora') state.lastRoom = null // 出核心清房间记忆
    pushRoute(state, eff.moveTo === 'core' ? '核心区' : ZONES[eff.moveTo].name)
    messages.push(`进入${ZONES[eff.moveTo].name}（${ZONES[eff.moveTo].riskTag}）`)
  }
  // 接管装备后提升后续判定。
  if (eff.gearMod) {
    state.mod += eff.gearMod
    messages.push(`装备升级！后续判定 +${eff.gearMod}%`)
  }
  // 路线流转：本选项直接决定下一个事件（如不刷卡→走到中控桥、过桥→选楼）
  if (eff.goEvent) state.pendingEvent = eff.goEvent

  // 掉落分三种真实场景（不是所有东西都要"翻柜子"）：
  // search=开启密封容器，body=检查战场背包，auto=直接拾取。
  //   body   = 交火后检查战场背包——逐件翻找，停留越久越容易被增援截住
  //   auto   = 油点/地上/顺手捡——看见就秒拿直接进包，没有搜索过程
  if (eff.loot) {
    const items = []
    let rolls = eff.lootCount || 1
    if (pass && opt.safe) rolls += 1
    else if (pass && rolls === 1 && Math.random() < 0.35) rolls += 1
    for (let i = 0; i < rolls; i++) {
      const avoid = state.loot.map(it => it.name).concat(items.map(it => it.name))
      const item = rollLoot(eff.loot, state.redBoost, avoid)
      if (item) items.push(item)
    }
    if (items.length) {
      const isVault = ['core_vault', 'aurora', 'boss'].includes(eff.loot)
      const mode = eff.lootMode
        || (opt.medal ? 'body' : (isVault || items.length >= 2) ? 'search' : 'auto')
      if (mode === 'auto') {
        // 直接拾取不进入逐件揭示流程。
        for (const item of items) {
          addLoot(state, item)
          messages.push(`顺手拿走 [${item.tierLabel}] ${item.name}（${fmtVal(item.value)}配给点 / ${item.weight}格）`)
          if (item.tier === 'red') pushLog(state, `发现绝密资产：${item.name}！`, 'red')
        }
      } else {
        state.pendingLoot = {
          items,
          idx: 0,
          mode,
          // search=开锁音引人（只有大型密封柜才够响）；body=检查战场背包时可能被增援截住
          threat: items.length > 1 && (mode === 'body' ? Math.random() < 0.15 : isVault && Math.random() < 0.18)
        }
        messages.push(mode === 'body'
          ? `打开战场背包——里面 ${items.length} 件，一件件检查`
          : (items.length > 1 ? `翻出 ${items.length} 件东西——一件一件看` : '摸到一件东西'))
      }
    }
  }
  // 货运雪橇名额用掉后移除对应撤收方式。
  if (eff.closeBag && !state.bagClosed) {
    state.bagClosed = true
    pushLog(state, '货运雪橇已经离站，只能改走极地索道、风暴列车或借用其他窗口', 'fail')
  }
  // 唯一指定资产不经过随机掉落表。
  if (eff.item) {
    const item = makeItem(eff.item)
    if (item) {
      addLoot(state, item)
      messages.push(`拿到 [${item.tierLabel}] ${item.name}（${fmtVal(item.value)}配给点 / ${item.weight}格）`)
      if (item.tier === 'red') pushLog(state, `到手：${item.name}！`, 'red')
    }
  }
  // 丢失物资（丢最值钱的 n 件）
  if (eff.lootLose && state.loot.length) {
    state.loot.sort((a, b) => b.value - a.value)
    for (let i = 0; i < eff.lootLose && state.loot.length; i++) {
      const lost = dropLoot(state, state.loot[0].lootId, '交火遗失')
      messages.push(`失去 [${lost.tierLabel}] ${lost.name}`)
    }
  }

  pushLog(state, eff.log, pass ? 'ok' : 'fail')
  messages.push((pass ? '✓ ' : '✗ ') + eff.log)
  if (state.hp <= 0) {
    state.alive = false
    pushLog(state, '生命归零，倒在了基地里', 'crit')
  }
}

// 撤离结算（三种真实撤离方式）
function resolveEscape(state, opt, messages) {
  const breakdown = []
  const chance = escapeChance(state, opt, breakdown)
  const pass = Math.random() * 100 < chance
  state.escapeAttempt = {
    method: opt.method,
    chance,
    pass,
    breakdown,
    overload: overload(state),
    hp: state.hp,
    risk: state.risk,
    leverWait: state.leverStep === null ? null : state.step - state.leverStep,
    unsecured: state.loot.filter(it => !it.secured).reduce((s, it) => s + it.value, 0)
  }
  recordDecision(state, opt, { chance, pass, gap: penGap(state, opt) })
  const enterText = {
    heli: '双电源接通，进入极地索道吊舱区',
    rocket: '登上穿越白障的风暴列车',
    bag: '进入应急回收台，将低温回收匣固定在货运雪橇上',
    sneak: '借其他队伍开启的索道窗口，从白障中混入吊舱',
    ambush: '守住吊舱区外沿，等待携货撤收队进入控制范围'
  }
  pushLog(state, enterText[opt.method], 'move')

  if (!pass) {
    const failText = {
      heli: '索道吊舱区遭到截击，没能赶上窗口闭合',
      rocket: '列车气密门未及时关闭，灰潮守备队完成登车',
      bag: '货运雪橇固定过程中遭到偷袭',
      sneak: '白障中的热轮廓被守备传感器锁定',
      ambush: '撤收队提前放出侦察蜂，守位暴露'
    }
    pushLog(state, failText[opt.method], 'crit')
    return endRun(state, false, opt.method, messages)
  }

  // 货运雪橇只保住手动放进四格低温回收匣的物资。
  if (opt.method === 'bag') {
    const kept = state.loot.filter(it => it.secured)
    const lost = state.loot.filter(it => !it.secured)
    const lostCount = lost.length
    lost.forEach(it => state.droppedLoot.push({ name: it.name, value: it.value, reason: '雪橇撤收容量不足' }))
    state.loot = kept
    state.weight = kept.reduce((sum, it) => sum + it.weight, 0)
    if (lostCount > 0) {
      pushLog(state, `背包连同 ${lostCount} 件物资留在回收台，低温回收匣保住 ${kept.length} 件`, 'fail')
      messages.push(`雪橇容量代价：${lostCount} 件物资没带出来`)
    }
  }

  // 风暴列车成功离场后检查车载封存舱。
  if (opt.method === 'rocket') {
    const bonus = rollLoot('aurora', state.redBoost, state.loot.map(it => it.name))
    if (bonus) {
      addLoot(state, bonus)
      pushLog(state, `列车封存舱发现：${bonus.name}`, bonus.tier === 'red' ? 'red' : 'ok')
      messages.push(`车载封存舱开出 [${bonus.tierLabel}] ${bonus.name}！`)
    }
  }

  // 截停撤收队成功后接管其吊舱。
  if (opt.method === 'ambush') {
    if (state.tags) state.tags.pvp += 1
    for (let i = 0; i < 2; i++) {
      const bonus = rollLoot('crate', state.redBoost, state.loot.map(it => it.name))
      if (bonus) {
        addLoot(state, bonus)
        messages.push(`检查战场背包获得 [${bonus.tierLabel}] ${bonus.name}`)
      }
    }
    pushLog(state, '接管撤收队资产并使用其吊舱离场', 'ok')
  }

  return endRun(state, true, opt.method, messages)
}

// 撤离前丢弃最重的一件物资（UI 上的动态按钮调这个）
function dropHeaviest(state) {
  if (!state.loot.length) return null
  const dropped = state.loot.slice().sort((a, b) => b.weight - a.weight || a.value - b.value)[0]
  return dropLoot(state, dropped.lootId, '忍痛丢弃')
}

// ===== 北辰行动章 =====
function computeMedals(state, escaped, carried, totalValue, rating) {
  const medals = []
  if (!escaped) return medals
  const t = state.tags || {}
  const pvp = (t.pvp || 0) + (t.takeover || 0)

  medals.push({
    id: 'rank', name: `归航标·${rating}`, icon: '▲',
    tier: rating === 'S' ? 'red' : rating === 'A' ? 'gold' : 'silver',
    desc: `北辰回收署行动评级 ${rating}`
  })
  if (carried.some(it => it.name === '北辰零号晶核')) {
    medals.push({ id: 'zero_core', name: '零号见证', icon: '◆', tier: 'red', desc: '带出北辰零号晶核' })
  }
  if ((t.takeover || 0) >= 1 && carried.some(it => it.name.indexOf('接管装备·护板与勤务枪') === 0)) {
    medals.push({ id: 'takeover', name: '逆向接管', icon: '❀', tier: 'red', desc: '携带接管装备完成撤收' })
  }
  if ((t.boss || 0) >= 1) {
    medals.push({ id: 'tidebreaker', name: '断潮者', icon: '♛', tier: 'red', desc: '单局击破灰潮指挥官' })
  }
  if (pvp >= 3) {
    medals.push({ id: 'sweeper', name: '极夜清道夫', icon: '★', tier: 'gold', desc: '单局击败 3 支敌对回收队' })
  }
  if (totalValue >= 1000000) {
    medals.push({ id: 'haul', name: '满载归署', icon: '◈', tier: 'gold', desc: '带出超过 100 万配给点资产' })
  }
  if (carried.some(it => it.name === '暴风演算主机')) {
    medals.push({ id: 'pulse', name: '脉冲负重者', icon: '▦', tier: 'gold', desc: '带着持续广播定位的主机完成撤收' })
  }
  if ((t.ai || 0) >= 2) {
    medals.push({ id: 'closer', name: '防线突破', icon: '◆', tier: 'silver', desc: '单局击退 2 波特殊守备单位' })
  }
  if (state.loadout === 'knife' && pvp + (t.ai || 0) >= 1) {
    medals.push({ id: 'knife', name: '轻装破局', icon: '†', tier: 'silver', desc: '轻装勘探仍赢下一次交火' })
  }
  if (!state.skipped && state.step >= TOTAL_STEPS - 1) {
    medals.push({ id: 'jog', name: '全线踏查', icon: '➤', tier: 'silver', desc: '完整推进到撤收阶段' })
  }
  return medals
}

// ===== 复盘：从真实过程推死因，再给针对性重开方案 =====
// 铁律：每一条因果都必须有 state 里的真实数字兜底。
// 不做"就差一点点"这种假挽留——玩家一旦发现是编的，信任一次性烧光。

const LOADOUT_LABEL = { full: '重装回收组', half: '标准勤务组', knife: '轻装勘探组' }

// 同样扣 8%，"超重"比"风险高"更值得先改，所以给不同起始权重
const W_CUT = { overweight: 82, heli: 78, hp: 68, pos: 60, risk: 55 }

// 每类死因对应两套可执行的重开方案：一套正面解题，一套换条路绕开
function plansFor(tag, state, ctx) {
  const cur = state.loadout || 'half'
  const P = {
    iron: [
      { id: 'iron-up', title: '换重装六穿弹再行动', loadout: 'full',
        goal: '携带曙光重型穿芯弹，处理刚才无法击穿的护板',
        why: `这局发生跳弹 ${state.ironHits} 次，问题是穿深不足` },
      { id: 'iron-avoid', title: '维持战备，绕开重甲', loadout: cur,
        goal: '绕开指挥官和重型护板，只回收密封柜与办公设备',
        why: '低穿弹打软目标一样出货，硬磨甲只是白烧弹' }
    ],
    dry: [
      { id: 'dry-full', title: '换重装携带 180 发', loadout: 'full',
        goal: '备足弹量，中盘还能打得起一次遭遇战',
        why: `这局射出 ${state.ammoUsed} 发就空了仓` },
      { id: 'dry-quiet', title: '维持战备，改走搜刮线', loadout: cur,
        goal: '能绕就绕，把弹药留给撤离点那一架',
        why: '弹是消耗品，撤离点那一枪才是决定钱包的' }
    ],
    risk: [
      { id: 'risk-fast', title: '维持战备，打短平快', loadout: cur,
        goal: '风险到 50 就直奔撤离点，不再多吃一个点',
        why: `这局风险峰值 ${state.peakRisk}，被摸了 ${state.sig.encounters} 次` },
      { id: 'risk-armor', title: '换重装护板再深入', loadout: 'full',
        goal: '靠重型护板减伤 35% 扛住热点区的遭遇战',
        why: `遭遇战一共掉了 ${state.sig.encounterDmg} 血，甲能吃掉三分之一` }
    ],
    knife: [
      { id: 'knife-up', title: '换标准勤务组进场', loadout: 'half',
        goal: '拿勤务护板和 120 发把这条线重跑一次',
        why: '轻装被发现概率高 50%、还多承受 30% 伤害' },
      { id: 'knife-rat', title: '继续轻装，只搜不打', loadout: 'knife',
        goal: '零成本捡满低温回收匣就撤，一枪不开',
        why: '轻装方案的优势是零投入回收，不是正面交火' }
    ],
    overweight: [
      { id: 'ow-secure', title: '维持战备，撤离前先装箱', loadout: cur,
        goal: '走到撤离点前把最贵的四格塞进低温回收匣',
        why: `这局超重 ${ctx.over} 格，撤离判定被扣了 ${ctx.over * 3}%` },
      { id: 'ow-cap', title: '换重装拿 30 格背包', loadout: 'full',
        goal: '用大背包把这局丢下的货一次带全',
        why: '格子不够就得二选一，背包本身就是产能' }
    ],
    heli: [
      { id: 'heli-fast', title: '维持战备，接通供电就撤', loadout: cur,
        goal: '第二路电源接通后三步内抵达索道吊舱区',
        why: `这局拖了 ${ctx.leverWait} 步，供电广播已暴露行动` },
      { id: 'heli-alt', title: '维持装备，改走货运雪橇', loadout: cur,
        goal: '不启动供电，装满低温回收匣走应急回收台',
        why: '雪橇不广播，低温回收匣中的资产可以保住' }
    ],
    bag: [
      { id: 'bag-secure', title: '维持战备，先塞满低温回收匣', loadout: cur,
        goal: '每拿到一件大件立刻判断要不要占那四格',
        why: `这局有 ${fmtVal(ctx.unsecured)} 配给点资产没进箱，全留在回收台` },
      { id: 'bag-heli', title: '维持装备，接双电源走索道', loadout: cur,
        goal: '整包带出，不做取舍',
        why: '资产较多时，雪橇的容量损失最大' }
    ],
    pos: [
      { id: 'pos-south', title: '维持战备，早点往南边挪', loadout: cur,
        goal: '第 5 步之前离开外围，向轨道升降场撤收线收尾',
        why: `撤离点全在南边，从${ctx.zoneName}横穿全图白扣 8%` },
      { id: 'pos-bag', title: '维持装备，走最近的雪橇台', loadout: cur,
        goal: '装满低温回收匣，走维护孔抵达应急回收台',
        why: '货运雪橇判定基础最高，也最不看风险' }
    ],
    hp: [
      { id: 'hp-med', title: '维持战备，见血就打药', loadout: cur,
        goal: '掉到 60 血就补，别攒着药进撤离点',
        why: `这局带着 ${state.meds} 个医疗包收场，血却只剩 ${state.hp}` },
      { id: 'hp-armor', title: '换全装靠甲兜底', loadout: 'full',
        goal: '用减伤把中盘的血线稳在 70 以上',
        why: '血量直接换算判定：每少 4 血扣 1% 成功率' }
    ],
    greed: [
      { id: 'greed-cut', title: '维持战备，听见脚步就走', loadout: cur,
        goal: '柜子只翻到第一件大件为止',
        why: `这局硬薅了 ${state.sig.grabAll} 次柜子，代价是贴脸挨打` },
      { id: 'greed-armor', title: '换重装再深入', loadout: 'full',
        goal: '有甲有药，才有资格把柜子翻完',
        why: '贪不是错，没本钱贪才是' }
    ],
    profit: [
      { id: 'pf-cheap', title: '换标准勤务组压风险', loadout: 'half',
        goal: '只押 15 万进场，带出 30 万就算赢',
        why: `这局押上 ${fmtVal(state.cost)} 战备，只带出 ${fmtVal(ctx.totalValue)}` },
      { id: 'pf-deep', title: '维持装备，直奔极光指挥塔', loadout: cur,
        goal: '跳过低值点，争取一件绝密资产回本',
        why: '押了这么多身家就得吃高价值点位，中途搜刮回不了本' }
    ],
    push: [
      { id: 'push-deep', title: '维持战备，打更深的点', loadout: cur,
        goal: '这次进入极光指挥塔或压缩机房，争取绝密资产',
        why: `上一局稳稳带出 ${fmtVal(ctx.totalValue)}，说明还有余量` },
      { id: 'push-rich', title: '升到重装打指挥官', loadout: 'full',
        goal: '带六穿弹击破灰潮指挥官，取得断潮者行动章',
        why: '手法已经稳了，剩下的差距在战备' }
    ]
  }
  return P[tag] || P.push
}

function analyzeRun(state, escaped, ctx) {
  const sig = state.sig
  const att = state.escapeAttempt
  if (att) ctx.over = att.overload      // 重开方案要引用撤离那一刻的负重，不是结算后的
  const c = []
  let win = ''                                     // 开头那句肯定，只在活着出来时给
  const add = (tag, weight, text) => c.push({ tag, weight, text })

  if (!escaped && att && !att.pass) {
    // 死在撤离点：**只引用这次判定真实的扣分明细**，绝不另算一套系数。
    // 五条撤收线路使用不同的伤势、负重与风险系数。
    // 血量也是 0.15/0.2/0.3 三档。复盘要是统一按一个系数写，说出来的百分比就是假的。
    const cuts = (att.breakdown || []).filter(p => p.delta > 0).sort((a, b) => b.delta - a.delta)
    if (cuts.length) {
      const top = cuts[0]
      add(top.tag, (W_CUT[top.tag] || 50) + top.delta, `撤离判定只有 ${att.chance}%，最大的一刀是${top.label} -${top.delta}%`)
      if (cuts.length > 1) {
        add(cuts[1].tag, 45, `同时还扣了：${cuts.slice(1, 3).map(p => `${p.label} -${p.delta}%`).join('、')}`)
      }
    } else {
      add('push', 40, `${att.chance}% 的撤离判定没过——该做的都做了，这一枪是运气`)
    }
  } else if (!escaped) {
    // 死在局内
    if (state.ironHits > 0) {
      add('iron', 90 + state.ironHits * 3, `${state.ammo ? state.ammo.pen : 0} 穿弹强攻重甲，发生跳弹 ${state.ironHits} 次——每次判定 -15%、耗弹翻倍`)
    }
    if (state.loadout !== 'knife' && ammoRounds(state) < 20 && state.ammoUsed > 0) {
      add('dry', 85, `射出 ${state.ammoUsed} 发后只剩 ${ammoRounds(state)} 发，后面全是硬撑`)
    }
    if (sig.encounters > 0) {
      add('risk', 60 + Math.min(25, sig.encounterDmg / 3), `风险峰值 ${state.peakRisk}，被摸 ${sig.encounters} 次，遭遇战掉了 ${sig.encounterDmg} 血`)
    }
    if (state.meds > 0) add('hp', 72, `倒下时包里还剩 ${state.meds} 个医疗包没用`)
    if (state.loadout === 'knife') add('knife', 55, '轻装缺少护板，同样攻击多承受 30% 伤害')
    if (sig.grabAll > 0) add('greed', 58, `硬薅了 ${sig.grabAll} 次柜子，每次都在对面枪口下多站几秒`)
    if (!c.length) add('risk', 30, `走到第 ${state.step} 步被打断，没有明显的操作失误`)
  } else {
    // 活着出来了：先认账做对的。这句只用于开头肯定，不参与"下一局打什么"的排序，
    // 正向结果不覆盖可改进的资源管理问题。
    if (ctx.hasRed) win = `带出绝密资产「${ctx.best.name}」，本轮路线判断有效`
    else if (ctx.netProfit > 0) win = `净赚 ${fmtVal(ctx.netProfit)}，${LOADOUT_LABEL[state.loadout] || ''}的家当也整套带回来了`
    if (att && att.method === 'bag' && att.unsecured > 0) {
      ctx.unsecured = att.unsecured
      add('bag', 90, `货运雪橇只保低温回收匣，${fmtVal(att.unsecured)} 配给点资产留在了回收台`)
    }
    if (ctx.netProfit < 0) add('profit', 88, `带出 ${fmtVal(ctx.totalValue)}，弹药医疗通行芯片消耗 ${fmtVal(resupplyCost(state))}，本轮倒亏 ${fmtVal(-ctx.netProfit)}`)
    if (sig.skippedValue > 0) add('bag', 55, `主动留下了 ${fmtVal(sig.skippedValue)} 配给点资产`)
    if (state.ironHits > 0) add('iron', 50, `路上发生跳弹 ${state.ironHits} 次，额外消耗了一倍弹药`)
    if (!c.length && !win) win = `${state.step} 步安全离场，全程没被逮住`
  }

  c.sort((a, b) => b.weight - a.weight)
  const tag = c.length ? c[0].tag : 'push'
  const chain = c.slice(0, win ? 2 : 3).map(x => x.text)
  if (win) chain.unshift(win)
  return { causeChain: chain, causeTag: tag, retryPlans: plansFor(tag, state, ctx) }
}

// ===== 结算：生成战报 =====
function endRun(state, escaped, method, messages, valueRate = 1) {
  state.ended = true
  const inventoryAtEnd = state.loot.slice()
  // 失败：物资清空（硬核规则）
  const carried = escaped ? state.loot : []
  const totalValue = Math.round(carried.reduce((s, it) => s + it.value, 0) * valueRate)
  const best = carried.slice().sort((a, b) => b.value - a.value)[0] || null
  const hasRed = carried.some(it => it.tier === 'red')

  // 评级：S=带红撤离 A=金 B=紫/蓝 C=其他成功 D=阵亡/被击落
  let rating = 'D'
  if (escaped) {
    if (hasRed) rating = 'S'
    else if (best && best.tier === 'gold') rating = 'A'
    else if (best && (best.tier === 'purple' || best.tier === 'blue')) rating = 'B'
    else rating = 'C'
  }

  // 关键时刻：红掉落、暴击事件、失败翻车点，最多3条
  const keyMoments = state.log
    .filter(l => l.kind === 'red' || l.kind === 'crit' || l.kind === 'fail')
    .slice(-3)
    .map(l => l.text)

  const METHOD_TEXT = { heli: '极地索道撤收', rocket: '风暴列车离场', bag: '货运雪橇撤收', sneak: '借用索道窗口', ambush: '接管撤收吊舱' }
  // 战备成本是"押上的身家"，不是"花掉的钱"——这正是战备页那句
  // "阵亡或撤离失败，战备成本全部血亏"的言下之意：撤出来了，枪和甲都跟着你回来了。
  // 真正消耗的是弹药、医疗和通行芯片。
  const resupply = resupplyCost(state)
  const netProfit = escaped ? totalValue - resupply : -state.cost
  const medals = computeMedals(state, escaped, carried, totalValue, rating)
  const review = analyzeRun(state, escaped, {
    totalValue, netProfit, hasRed, best,
    over: overload(state), unsecured: 0, leverWait: 0,
    zoneName: (ZONES[state.zone] || {}).name || '基地'
  })
  state.report = {
    medals,
    causeChain: review.causeChain,
    causeTag: review.causeTag,
    retryPlans: review.retryPlans,
    escaped,
    method,                       // heli / rocket / bag / null(阵亡)
    methodText: METHOD_TEXT[method] || '未能撤离',
    rating,
    totalValue,
    cost: state.cost,          // 这局押上的战备身家：撤出来能带回，倒在里面就全丢
    resupply,                  // 真正烧掉的消耗品钱（弹/药/卡）
    gearKept: escaped,         // 装备有没有带回来
    netProfit,
    loadout: state.loadout,
    loadoutName: (LOADOUTS[state.loadout] || {}).name || '',
    bestItem: best,
    hasRed,
    lootCount: carried.length,
    lootItems: carried.map(it => ({
      name: it.name, tier: it.tier, tierLabel: it.tierLabel,
      value: it.value, weight: it.weight, secured: !!it.secured
    })),
    lostItems: escaped
      ? state.droppedLoot.slice()
      : state.droppedLoot.concat(inventoryAtEnd.map(it => ({ name: it.name, value: it.value, reason: '行动失败' }))),
    routeTrail: state.routeTrail.slice(),
    combatStats: { ...state.tags },
    resourcesUsed: {
      ammo: state.ammoUsed,
      meds: state.medsUsed,
      cards: state.cardsUsed
    },
    // 弹药账：进场弹种、发射数、跳弹次数、装备更换次数和剩余发数
    ammoReport: {
      name: state.ammo ? state.ammo.name : '无',
      caliber: state.ammo ? state.ammo.caliber : '',
      pen: state.ammo ? state.ammo.pen : 0,
      fired: state.ammoUsed,
      left: ammoRounds(state),
      ironHits: state.ironHits,
      gunSwaps: state.gunSwaps
    },
    keyMoments,
    steps: state.step,
    levers: state.levers || 0,
    finalHp: state.hp,
    maxRisk: state.peakRisk
  }
  messages.push(escaped
    ? `✓ 撤离成功！评级 ${rating}${state.cost > 0 ? `，${LOADOUTS[state.loadout].name}带回来了` : ''}${netProfit >= 0 ? `，净赚 ${fmtVal(netProfit)}` : `，倒亏 ${fmtVal(-netProfit)}`}`
    : `✗ 行动失败，物资全部丢失${state.cost > 0 ? `，损失 ${fmtVal(state.cost)} 配给点装备` : '（轻装零投入）'}`)
  if (medals.length) messages.push(`获得勋章：${medals.map(m => m.name).join('、')}`)
  return { state, messages }
}

// ===== 节点调度 =====
function findRawNode(state) {
  if (!state.loadout) return LOADOUT_CHOICE
  if (state.pendingLoot) return lootNodeFor(state)
  if (state.step === 0) {
    if (state.openerId === OPENER_EVENT.id) return OPENER_EVENT
    return SPAWNS.find(s => s.id === state.spawnId) || SPAWNS[0]
  }
  if (state.node && state.node.type === 'move') return moveNodeFor(state)
  if (state.step >= ESCAPE_STEP) return escapeNodeFor(state)
  if (state.node && state.node.id) {
    const ev = EVENTS.find(e => e.id === state.node.id)
    if (ev) return ev
  }
  return pickZoneEvent(state)
}

function nextRawNode(state) {
  // 拾取最优先：柜子开了东西还没翻完，撤离/转移都得等（拾取免费，不占步数）
  if (state.pendingLoot) return lootNodeFor(state)
  if (state.step >= ESCAPE_STEP) return escapeNodeFor(state)
  // 路线抉择优先：过桥/刷卡/选楼指定了下一站
  if (state.pendingEvent) {
    const ev = EVENTS.find(e => e.id === state.pendingEvent)
    state.pendingEvent = null
    if (ev) {
      if (!state.usedEvents.includes(ev.id)) state.usedEvents.push(ev.id)
      if (ev.room) {
        state.lastRoom = ev.room
        pushRoute(state, ROOM_NAMES[ev.room])
      } else if (ev.zone === 'aurora') {
        pushRoute(state, '极光指挥塔')
      }
      return ev
    }
  }
  if (state.step === MOVE_STEP) return moveNodeFor(state)
  return pickZoneEvent(state)
}

// ===== 拾取节点（逐件揭示）=====
// 资产逐件揭示，品质越高越晚出现；每件当场决定是否收入背包，不占行动步数
// search=开启密封柜，body=检查战场背包；两种模式分别承担设备声响和增援抵达风险
const REVEAL = {
  white: '翻出一件不起眼的玩意儿',
  green: '翻出一件还算能卖的货',
  blue: '摸到一件泛蓝光的东西',
  purple: '手感不一样——紫色品质！',
  gold: '柜子深处金光一闪！',
  red: '封条完整——发现绝密资产！'
}
const REVEAL_BODY = {
  white: '他包里塞着件不值钱的',
  green: '包侧兜摸出一件普通货',
  blue: '主袋里翻出件泛蓝光的',
  purple: '他背包夹层藏着高价值密封件！',
  gold: '包底金光一闪——舍得带这个进来！',
  red: '背包最底层藏着绝密资产！'
}

function lootNodeFor(state) {
  const pl = state.pendingLoot
  const left = pl.items.length - pl.idx
  const body = pl.mode === 'body'
  // 中途检定：开启密封柜会产生设备声；检查战场背包可能被增援截住
  if (pl.threat && pl.idx >= 1) {
    return {
      id: 'loot_threat',
      type: 'loot',
      free: true,
      text: body
        ? `战场背包刚翻到一半，不远处响起脚步声——交火声把附近队伍引来了。包里还剩 ${left} 件。`
        : `刚把东西塞好，门外传来脚步声——开锁的动静把人引来了！柜子里还压着 ${left} 件没翻。`,
      options: [
        { text: `顶着枪声把剩下 ${left} 件${body ? '检查完' : '全翻完'}（免不了挨一梭子）`, lootAction: 'grabAll' },
        { text: body ? '停止翻包，转入掩体立刻脱离（剩下的不要了）' : '不贪了，从侧门立刻脱离（剩下的不要了）', lootAction: 'flee' }
      ]
    }
  }
  const it = pl.items[pl.idx]
  const more = left - 1
  const over = state.weight + it.weight > state.capacity
  const reveal = body ? REVEAL_BODY[it.tier] : REVEAL[it.tier]
  return {
    id: 'loot_pick',
    type: 'loot',
    free: true,
    revealTier: it.tier,
    revealItem: {
      name: it.name,
      tier: it.tier,
      tierLabel: it.tierLabel,
      value: it.value,
      weight: it.weight
    },
    text: `${reveal}——[${it.tierLabel}] ${it.name}（${fmtVal(it.value)}配给点 / ${it.weight}格）。${more ? (body ? `包里还剩 ${more} 件。` : `底下还压着 ${more} 件。`) : '这是最后一件。'}`,
    options: [
      { text: `装进背包（+${it.weight}格${over ? ' ⚠会超载' : ''}）`, lootAction: 'take' },
      { text: more ? (body ? '不要这件，继续检查' : '不要这件，继续翻') : (body ? '不要这件，结束检查' : '不要这件，收拾走人'), lootAction: 'skip' }
    ]
  }
}

// 转移节点按新地图拓扑生成；已完成塔顶回收后不再重复登塔。
function moveNodeFor(state) {
  if (state.zone === 'core' || state.zone === 'aurora') {
    const inPres = state.zone === 'aurora'
    const presDone = state.usedEvents.includes('aurora_vault')
    const options = MOVE_CHOICE_CORE.options.filter(o => !(o.moveTo === 'aurora' && (inPres || presDone)))
    const node = { ...MOVE_CHOICE_CORE, options }
    if (inPres) {
      node.text = '极光指挥塔主层已完成回收，风暴庭院仍有交火。可沿磁悬侧梯或暗光维护梯返回内环。'
    }
    return node
  }
  return MOVE_ROUTES[state.zone] || MOVE_CHOICE_CORE
}

// 局内阶段：HOTSPOTS 的人流表、事件的 phase 字段、HUD 上那行字全部共用这一个口径
const PHASE_LABEL = { early: '开局进驻', mid: '中盘转移', late: '残局撤离' }

function phaseOf(state) {
  return state.step <= 2 ? 'early' : state.step <= 5 ? 'mid' : 'late'
}

// 事件前置状态谓词：events 数据里写字符串键（前面加 ! 取反），实现集中在这
// 之所以不让数据文件直接写函数——那边必须保持纯数据，test/routes.js 才做得了静态校验
const WHEN = {
  bossDown:    s => s.tags.boss > 0,                                  // 本局打下过首领
  leverPulled: s => s.levers > 0,
  bothLevers:  s => s.levers >= 2,                                    // 双闸合上=全图广播过了
  presDone:    s => s.usedEvents.indexOf('aurora_vault') >= 0,
  dockSeen:    s => s.usedEvents.indexOf('core_tide') >= 0,
  hurt:        s => s.hp < 60,
  hasBrick:    s => s.loot.some(it => it.name.indexOf('暴风演算主机') >= 0)
}

function whenOk(state, key) {
  if (!key) return true
  const neg = key.charAt(0) === '!'
  const fn = WHEN[neg ? key.slice(1) : key]
  if (!fn) return true // 认不出的谓词按"不限制"放过，让 routes.js 去报错，别在玩家手里崩
  return neg ? !fn(state) : !!fn(state)
}

// 从当前区域事件池抽一个没出过的事件（入口抉择节点不进随机池）
// 池子空了只从"地理相邻区"补（杜绝发射区刷出宿舍/码头事件这类穿越），再空就允许本区重复
function pickZoneEvent(state) {
  const phase = phaseOf(state)
  const ok = e => !e.entryOnly && !state.usedEvents.includes(e.id) && whenOk(state, e.when)
  const fit = e => !e.phase || e.phase === phase
  // 先要阶段贴合的，挑不到再放宽阶段——phase 只管氛围，宁可给个语气不合的也不能让池子空掉
  const draw = pred => {
    const hit = EVENTS.filter(e => pred(e) && ok(e) && fit(e))
    return hit.length ? hit : EVENTS.filter(e => pred(e) && ok(e))
  }
  let pool = draw(e => e.zone === state.zone)
  if (!pool.length) {
    const adj = ADJACENT[state.zone] || []
    pool = draw(e => adj.includes(e.zone))
  }
  if (!pool.length) {
    // 池子耗尽后只允许普通事件重复；指挥官、零号柜和装备接管只兑现一次。
    // when 必须继续过滤：指挥官仍在场时不能出现其战场背包，只有 phase 可以放宽
    pool = EVENTS.filter(e =>
      e.zone === state.zone &&
      !e.entryOnly &&
      whenOk(state, e.when) &&
      e.id !== 'aurora_vault' &&
      e.id !== 'core_takeover' &&
      !(e.options || []).some(o => o.medal === 'boss')
    )
  }
  if (state.leverRooms.compressor) pool = pool.filter(e => e.id !== 'compressor_guard')
  // 内环事件按房间相邻表流转，未标房间的过渡事件不受限。
  if (state.zone === 'core' && state.lastRoom) {
    const near = CORE_ROOM_ADJ[state.lastRoom] || []
    const roomPool = pool.filter(e => !e.room || e.room === state.lastRoom || near.includes(e.room))
    if (roomPool.length) pool = roomPool
    else pushLog(state, '相邻房间已完成回收，穿过风暴庭院转往内环另一侧', 'move')
    if (state.levers === 1) {
      const want = state.leverRooms.coolant ? 'compressor' : 'coolant'
      const biased = pool.filter(e => e.room === want)
      if (biased.length && Math.random() < 0.42) pool = biased
    }
  }
  // 一个都挑不出来（例如配电柄已启动、本区只剩守柄事件）：不能崩，改成一次真实的转移抉择
  if (!pool.length) {
    pushLog(state, '这一片能搜的都搜过了，得换个地方', 'move')
    return moveNodeFor(state)
  }
  const ev = pool[Math.floor(Math.random() * pool.length)]
  state.usedEvents.push(ev.id)
  if (ev.room) {
    state.lastRoom = ev.room
    pushRoute(state, ROOM_NAMES[ev.room])
  } else if (ev.zone === 'aurora') {
    pushRoute(state, '极光指挥塔')
  }
  return ev
}

// 撤离节点：超重时动态加"丢弃最重物资"提示（UI 层配合 dropHeaviest）
// 货运雪橇离站后从列表移除。
function escapeNodeFor(state) {
  const options = state.bagClosed
    ? ESCAPE_CHOICE.options.filter(o => o.method !== 'bag')
    : ESCAPE_CHOICE.options.slice()
  const node = { ...ESCAPE_CHOICE, options }
  if (state.bagClosed) {
    node.text = ESCAPE_CHOICE.text + '（本轮货运雪橇已离站）'
  }
  // 广播刚响就冲要扣分，可之前没给等的办法——撤离节点一到就必须选，等于强制吃罚。
  // 允许等待早期争夺结束后进入索道窗口。
  // 放掉一步换进有利窗口，代价是多吃一次遭遇检定。窗口一进去选项自己就没了，不会无限蹲
  if (state.levers >= 2 && state.leverStep !== null && state.step - state.leverStep <= 1) {
    node.options = options.concat([{
      text: '暂不进入吊舱区，等待早期争夺结束后再接近索道',
      verb: '等窗口',
      wait: true,
      safe: true,
      // 借 skipStep 一次烧掉两步：蹲住就得蹲够，蹲半程还在罚分区间等于白蹲
      success: { skipStep: true, risk: 2, log: '吊舱区第一波争夺正在散去，索道窗口接近末段' }
    }])
  }
  return node
}

function canExtractNow(state) {
  if (!state || state.ended || !state.alive || !state.loadout) return false
  if (state.node && state.node.type === 'escape') return false
  if (state.step < 2 && state.hp >= 60 && state.risk < 70) return false
  return true
}

function forceExtract(state) {
  const messages = []
  if (!canExtractNow(state)) return { state, messages }
  const pl = state.pendingLoot
  if (pl) {
    const left = pl.items.length - pl.idx
    for (let i = pl.idx; i < pl.items.length; i++) state.sig.skippedValue += pl.items[i].value
    state.pendingLoot = null
    messages.push(left > 0 ? `剩下 ${left} 件不翻了，转向撤离线` : '转向撤离线')
  } else {
    messages.push('带着已经到手的货，转向撤离线')
  }
  pushLog(state, '主动收工，前往撤离线', 'move')
  state.step = Math.max(state.step, ESCAPE_STEP)
  state.node = decorateNode(state, escapeNodeFor(state))
  return { state, messages }
}

function pushLog(state, text, kind) {
  state.log.push({ step: state.step, text, kind })
}

// 重新装饰当前节点（丢弃物资后刷新撤离成功率等场景用）
function refreshNode(state) {
  state.node = decorateNode(state, findRawNode(state))
  return state.node
}

// 使用医疗模块：恢复35生命，不占步数，但操作声使风险+6。
function useMed(state) {
  if (!state.alive || state.ended) return null
  if (state.meds <= 0 || state.hp >= 100) return null
  state.meds -= 1
  state.medsUsed += 1
  const before = state.hp
  state.hp = clamp(state.hp + 35, 0, 100)
  changeRisk(state, 6)
  const healed = state.hp - before
  pushLog(state, `停下打药：生命+${healed}，药音传了出去（风险+6）`, 'ok')
  return { healed }
}

module.exports = {
  newRun, choose, dropHeaviest, dropLoot, toggleSecure, autoSecureBest,
  refreshNode, useMed, getRunMeta, successChance, fmtVal,
  ammoText, ammoRounds, penGap, roundsNeeded, loadGrids, overload,
  analyzeRun, applyLoadout, canExtractNow, forceExtract,
  phaseOf, WHEN, // 给 test/routes.js 静态校验事件的 phase/when 字段用
  TOTAL_STEPS, ZONES, TIERS, ROOM_NAMES,
  LOADOUTS  // 局外存档(core/meta.js)和大厅按它算价钱，价目表只有这一份
}
