// ===== 局外存档：配给点仓库 / 绝密资产图鉴 / 赛季战绩 =====
// 三档装备投入与行动成败共同决定长期仓库曲线。
//
// 三条底线：
// 1) 轻装勘探永远是 0 成本，余额见底也能开局
// 2) 纯逻辑，不直接依赖 wx —— storage 适配器可注入，node 里跑测试用内存实现
// 3) 战备是"押上的身家"不是"花掉的钱"：进场先扣住，撤出来原路退回（只烧消耗品），
//    倒在里面才真丢。这是战备页那句"阵亡或撤离失败，战备成本全部血亏"的言下之意

const { LOADOUTS } = require('./engine')
const { ITEM_POOL, TIERS } = require('../data/items')

const META_KEY = 'meta_v1'
const START_BALANCE = 300000        // 起步配给：够两次标准勤务或接近一次重装投入
const SEASON_EPOCH = Date.UTC(2026, 0, 5)   // 赛季基准日（周一）
const SEASON_DAYS = 28
const DAY_MS = 86400000

// 绝密资产图鉴直接读取红档掉落池。
const CODEX_ENTRIES = ITEM_POOL.red.map(p => ({
  name: p.name,
  tier: 'red',
  tierLabel: TIERS.red.label,
  weight: p.weight,
  valueMin: p.value[0],
  valueMax: p.value[1]
}))

function seasonIdAt(ts) {
  const n = Math.floor((ts - SEASON_EPOCH) / (SEASON_DAYS * DAY_MS))
  return 'S' + (n + 1)
}

function seasonEndAt(ts) {
  const n = Math.floor((ts - SEASON_EPOCH) / (SEASON_DAYS * DAY_MS))
  return SEASON_EPOCH + (n + 1) * SEASON_DAYS * DAY_MS
}

// wx 存在就用小程序 storage，否则退成内存（node 测试、以及万一 storage 被禁用）
function defaultStore() {
  if (typeof wx !== 'undefined' && wx && typeof wx.getStorageSync === 'function') {
    return {
      get(k) { try { return wx.getStorageSync(k) || null } catch (e) { return null } },
      set(k, v) { try { wx.setStorageSync(k, v) } catch (e) { /* 存不进就这局不留档，不影响玩 */ } }
    }
  }
  const mem = {}
  return { get(k) { return mem[k] || null }, set(k, v) { mem[k] = v } }
}

function blankSeason(id, endAt) {
  return { id, endAt, runs: 0, escapes: 0, bestValue: 0, bestItemName: '', netProfit: 0 }
}

function freshMeta(now) {
  return {
    v: 1,
    balance: START_BALANCE,
    spent: 0,             // 累计投进去的战备成本
    earned: 0,            // 累计带出来的物资价值
    runs: 0,
    escapes: 0,
    bankruptcies: 0,      // 掉到无法投入标准勤务组的次数
    best: { value: 0, itemName: '' },
    codex: {},            // 物品名 → { at: 首次带出时间, count: 累计带出次数 }
    season: blankSeason(seasonIdAt(now), seasonEndAt(now)),
    lastLoadout: '',
    createdAt: now
  }
}

// 读档：字段缺失一律补默认值，老存档加了新字段也不会崩
function load(store, now) {
  const s = store || defaultStore()
  const at = now || Date.now()
  const raw = s.get(META_KEY)
  const base = freshMeta(at)
  if (!raw || typeof raw !== 'object') return base
  const meta = Object.assign(base, raw)
  meta.best = Object.assign({ value: 0, itemName: '' }, raw.best || {})
  meta.codex = raw.codex && typeof raw.codex === 'object' ? raw.codex : {}
  // 赛季懒重置：跟云端周榜同一套思路，读取时发现换期了就地归零，不需要定时任务
  const id = seasonIdAt(at)
  if (!raw.season || raw.season.id !== id) meta.season = blankSeason(id, seasonEndAt(at))
  else meta.season = Object.assign(blankSeason(id, seasonEndAt(at)), raw.season)
  if (typeof meta.balance !== 'number' || !isFinite(meta.balance) || meta.balance < 0) meta.balance = 0
  if (!LOADOUTS[meta.lastLoadout]) meta.lastLoadout = ''
  return meta
}

function save(meta, store) {
  (store || defaultStore()).set(META_KEY, meta)
  return meta
}

// 哪些装备档位买得起；轻装勘探始终可选。
function affordable(meta) {
  const out = {}
  for (const id of Object.keys(LOADOUTS)) out[id] = LOADOUTS[id].cost <= meta.balance
  return out
}

function preferredLoadout(meta) {
  const can = affordable(meta)
  if (meta.lastLoadout && can[meta.lastLoadout]) return meta.lastLoadout
  if (can.full) return 'full'
  if (can.half) return 'half'
  return 'knife'
}

function isBroke(meta) {
  return meta.balance < LOADOUTS.half.cost
}

// 进场扣款：装备一带进场就是沉没成本，死了不退
function charge(meta, loadoutId) {
  const lo = LOADOUTS[loadoutId]
  if (!lo) return { ok: false, reason: '没有这个战备档位' }
  if (lo.cost > meta.balance) {
    return { ok: false, reason: `仓库只剩 ${Math.floor(meta.balance / 10000)} 万，买不起${lo.name}` }
  }
  meta.balance -= lo.cost
  meta.spent += lo.cost
  return { ok: true, cost: lo.cost, balance: meta.balance }
}

// 局末结算。撤离成功：装备带回来了，进场扣的那笔原路退回，再入账物资、扣掉消耗品；
// 阵亡或撤离失败：装备连人一起留在图里，进场扣的钱就是真亏掉的
function settle(meta, report, now) {
  const at = now || Date.now()
  const before = meta.balance
  const cost = report.cost || 0
  const refund = report.escaped ? cost : 0
  const gained = report.escaped ? (report.totalValue || 0) : 0
  const resupply = report.escaped ? (report.resupply || 0) : 0

  meta.balance += refund + gained - resupply
  if (meta.balance < 0) meta.balance = 0   // 补给费不该把人扣成负数
  meta.earned += gained
  meta.spent -= refund                     // 退回来的不算花掉
  meta.runs += 1
  meta.season.runs += 1
  meta.season.netProfit += (report.netProfit || 0)
  if (report.escaped) {
    meta.escapes += 1
    meta.season.escapes += 1
  }

  const unlocked = []
  if (report.escaped) {
    for (const it of (report.lootItems || [])) {
      if (it.tier !== 'red') continue
      const had = meta.codex[it.name]
      if (had) had.count += 1
      else {
        meta.codex[it.name] = { at, count: 1 }
        unlocked.push(it.name)
      }
    }
    const v = report.totalValue || 0
    const bestName = (report.bestItem && report.bestItem.name) || ''
    if (v > meta.best.value) meta.best = { value: v, itemName: bestName }
    if (v > meta.season.bestValue) {
      meta.season.bestValue = v
      meta.season.bestItemName = bestName
    }
  }

  // 破产计数：只记"这一局把人打下去"的那一次。扣款发生在结算之前，
  // 所以得拿战报里的战备成本反推出选装备那一刻的余额，不能拿结算时的余额比
  const runStart = before + (report.cost || 0)
  if (isBroke(meta) && runStart >= LOADOUTS.half.cost) meta.bankruptcies += 1

  return {
    balanceBefore: before, balanceAfter: meta.balance,
    gained, refund, resupply, unlocked, broke: isBroke(meta)
  }
}

// 图鉴视图：未解锁的也返回，UI 显示成剪影，让人知道还差哪几件
function codexView(meta) {
  const entries = CODEX_ENTRIES.map(e => {
    const got = meta.codex[e.name]
    return Object.assign({}, e, { owned: !!got, count: got ? got.count : 0, at: got ? got.at : 0 })
  })
  return { total: entries.length, owned: entries.filter(e => e.owned).length, entries }
}

module.exports = {
  META_KEY, START_BALANCE, SEASON_DAYS, CODEX_ENTRIES,
  defaultStore, load, save, freshMeta,
  affordable, preferredLoadout, isBroke, charge, settle, codexView,
  seasonIdAt, seasonEndAt
}
