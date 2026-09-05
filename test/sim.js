// 数值平衡模拟器：Node 直接跑 N 局，验证撤收率/绝密资产率/评级分布
// 用法：node sim.js [局数] [策略]
// 策略：greedy=永远选第一个(激进) safe=永远选安全项 random=随机
//       red=冲极光指挥塔摸绝密资产 heli=接双电源走索道 rat=轻装借窗 mixed=混合(默认)
const { newRun, choose, dropHeaviest, useMed, autoSecureBest } = require('../miniprogram/core/engine')
const { EVENTS, MOVE_ROUTES, MOVE_CHOICE_CORE, ESCAPE_CHOICE } = require('../miniprogram/data/events')

const N = parseInt(process.argv[2] || '1000', 10)
const STRATEGY = process.argv[3] || 'mixed'

const eventById = id => EVENTS.find(e => e.id === id)
function shownByRaw(node, raw, predicate) {
  const rawIdx = raw ? raw.options.findIndex(predicate) : -1
  return node.options.find(o => o.idx === rawIdx)
}
function moveOption(state, predicate) {
  const raw = state.node.id === MOVE_CHOICE_CORE.id ? MOVE_CHOICE_CORE : MOVE_ROUTES[state.zone]
  return shownByRaw(state.node, raw, predicate)
}
function escapeOption(state, method) {
  return shownByRaw(state.node, ESCAPE_CHOICE, o => o.method === method)
}
function injectedOption(node) {
  const raw = eventById(node.id)
  return raw && node.options.find(o => o.idx >= raw.options.length)
}
function leverOption(node) {
  const raw = eventById(node.id)
  if (!raw) return null
  return node.options.find(o => {
    const source = raw.options[o.idx]
    return !!(source && source.success && source.success.levers)
  }) || injectedOption(node)
}

function pickOption(state, strategy) {
  const opts = state.node.options.filter(o => !o.disabled)
  if (!opts.length) return state.node.options[0].idx
  // 拾取节点（所有策略通用）：金红必拿；普通货装得下就拿，会超载就留下
  // 声音检定：血厚顶着枪声薅完，血薄弃货保命
  if (state.node.type === 'loot') {
    const grab = opts.find(o => o.text.includes('顶着枪声'))
    if (grab) {
      const flee = opts.find(o => o !== grab)
      return state.hp >= 55 ? grab.idx : flee.idx
    }
    const it = state.pendingLoot.items[state.pendingLoot.idx]
    const fits = state.weight + it.weight <= state.capacity
    const take = opts.find(o => o.text.includes('装进背包'))
    const skip = opts.find(o => o !== take)
    return (fits || it.tier === 'red' || it.tier === 'gold') ? take.idx : skip.idx
  }
  // 战备选择：激进流重装(第1项)，保守流轻装(末项)，均衡流标准(第2项)
  if (state.node.type === 'loadout') {
    if (strategy === 'safe' || strategy === 'rat') return opts[opts.length - 1].idx
    if (strategy === 'mixed' || strategy === 'heli') return opts[1].idx
    if (strategy === 'random') return opts[Math.floor(Math.random() * opts.length)].idx
    return opts[0].idx
  }
  switch (strategy) {
    case 'greedy': return opts[0].idx                       // 永远最激进
    case 'safe':   return opts[opts.length - 1].idx          // 永远最保守（流程选项里稳妥项靠后）
    case 'random': return opts[Math.floor(Math.random() * opts.length)].idx
    case 'red': {
      // 冲绝密资产流：转移优先极光指挥塔；外围先进入研究城内环
      const pres = moveOption(state, o => o.moveTo === 'aurora')
      const toCore = moveOption(state, o => o.moveTo === 'core')
      if (state.node.type === 'move' && pres) return pres.idx
      if (state.node.type === 'move' && toCore) return toCore.idx
      if (state.node.type === 'escape') {
        const bigRed = state.loot.find(it => it.tier === 'red' && it.weight > state.safebox)
        const rocket = escapeOption(state, 'rocket')
        const bag = escapeOption(state, 'bag')
        if (bigRed && rocket) return rocket.idx
        return (bag || opts[opts.length - 1]).idx
      }
      return opts[0].idx
    }
    case 'rat': {
      // 轻装流：进场事件全选保守项，资产超箱时借用他队索道窗口
      if (state.node.type === 'escape') {
        const sneak = escapeOption(state, 'sneak')
        const bag = escapeOption(state, 'bag')
        // 货超过安全箱容量才值得借窗，小件直接走货运雪橇
        if (sneak && state.weight > state.safebox) return sneak.idx
        return (bag || opts[opts.length - 1]).idx
      }
      return opts[opts.length - 1].idx
    }
    case 'heli': {
      // 勤务组流：进入内环接通双电源，走极地索道全额带出
      const core = moveOption(state, o => o.moveTo === 'core')
      if (state.node.type === 'move' && core) return core.idx
      const lever = leverOption(state.node)
      if (state.node.type === 'event' && lever && state.levers < 2) return lever.idx
      const dash = injectedOption(state.node)
      if (state.node.type === 'event' && dash && state.levers === 1) return dash.idx
      if (state.node.type === 'escape') {
        while (state.weight > state.capacity) { if (!dropHeaviest(state)) break }
        const wait = opts.find(o => o.idx >= ESCAPE_CHOICE.options.length)
        if (wait) return wait.idx
        const heli = escapeOption(state, 'heli')
        return (heli || opts[opts.length - 1]).idx
      }
      // 拉闸之余正常搜刮：血量健康选激进项，残血苟着
      return state.hp >= 70 ? opts[0].idx : opts[opts.length - 1].idx
    }
    default: {
      // mixed：看见合闸就拉（引导更清楚后的普通打法）；双电源走索道；
      // 货超过回收匣且还能打时优先列车，避免雪橇把整包留在台上。
      const pull = opts.find(o => !o.disabled && o.verb === '合闸')
      if (pull && state.levers < 2) return pull.idx
      if (state.node.type === 'escape') {
        if (state.weight > state.capacity + 5) dropHeaviest(state)
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
  }
}

const stats = {
  runs: N, escaped: 0, died: 0, shotDown: 0,
  ratings: { S: 0, A: 0, B: 0, C: 0, D: 0 },
  redRuns: 0, valueEscapedSum: 0, netProfitSum: 0,
  method: { heli: [0, 0], rocket: [0, 0], bag: [0, 0], sneak: [0, 0], ambush: [0, 0] },  // [选择次数, 成功次数]
  // 极地索道是唯一有前置门槛的撤收方式：双电源凑不齐时，“没人选”反映的是可达性问题
  levers: [0, 0, 0],
  coreRuns: 0,           // 进过研究城内环的局数（没进内环碰不到配电柄，不该算进分母）
  stepsSum: 0, crashes: 0
}

for (let i = 0; i < N; i++) {
  try {
    let state = newRun()
    let guard = 0
    while (!state.ended && guard++ < 30) {
      // 真实玩家行为：血低于50且有医疗就先打药再走
      if (state.alive && state.hp < 50 && state.meds > 0 && state.node.type !== 'loadout') {
        useMed(state)
      }
      // 模拟器代替真人操作背包：每步把4格安全箱调整为总价值最高组合
      autoSecureBest(state)
      const idx = pickOption(state, STRATEGY)
      const r = choose(state, idx)
      state = r.state
    }
    const rep = state.report
    if (!rep) { stats.crashes++; continue }
    stats.levers[Math.min(2, state.levers)]++
    if (state.routeTrail.some(z => ['冷却舱', '磁悬舱', '压缩机房', '暗光仓', '风暴庭院', '潮汐坞'].includes(z))) stats.coreRuns++
    stats.stepsSum += rep.steps
    stats.netProfitSum += rep.netProfit
    stats.ratings[rep.rating]++
    if (rep.method && stats.method[rep.method]) {
      stats.method[rep.method][0]++
      if (rep.escaped) stats.method[rep.method][1]++
    }
    if (rep.escaped) {
      stats.escaped++
      stats.valueEscapedSum += rep.totalValue
      if (rep.hasRed) stats.redRuns++
    } else if (rep.method) stats.shotDown++
    else stats.died++
  } catch (e) {
    stats.crashes++
    if (stats.crashes <= 3) console.error('CRASH:', e.message, e.stack.split('\n')[1])
  }
}

const pct = n => (n / N * 100).toFixed(1) + '%'
const m = k => {
  const [sel, ok] = stats.method[k]
  return `选${sel}次 成功率${sel ? (ok / sel * 100).toFixed(0) : 0}%`
}
console.log(`\n===== 模拟 ${N} 局 · 策略=${STRATEGY} =====`)
console.log(`撤离成功: ${pct(stats.escaped)} | 中途阵亡: ${pct(stats.died)} | 撤离失败: ${pct(stats.shotDown)}`)
console.log(`评级分布: S=${pct(stats.ratings.S)} A=${pct(stats.ratings.A)} B=${pct(stats.ratings.B)} C=${pct(stats.ratings.C)} D=${pct(stats.ratings.D)}`)
console.log(`绝密资产带出率: ${pct(stats.redRuns)}`)
console.log(`成功局均价值: ${stats.escaped ? (stats.valueEscapedSum / stats.escaped / 10000).toFixed(1) : 0}万配给点`)
console.log(`全局局均净利润: ${(stats.netProfitSum / N / 10000).toFixed(1)}万配给点（含亏损局）`)
console.log(`极地索道: ${m('heli')} | 风暴列车: ${m('rocket')} | 货运雪橇: ${m('bag')} | 借用窗口: ${m('sneak')} | 截停小队: ${m('ambush')}`)
console.log(`供电进度: 0路 ${pct(stats.levers[0])} · 1路 ${pct(stats.levers[1])} · 双电源 ${pct(stats.levers[2])}（进过内环的局占 ${pct(stats.coreRuns)}）`)
console.log(`平均步数: ${(stats.stepsSum / N).toFixed(1)} | 引擎崩溃: ${stats.crashes}`)
