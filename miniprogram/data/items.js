// 技术资产分级：白 < 绿 < 蓝 < 紫 < 金 < 红

const TIERS = {
  white:  { key: 'white',  label: '白', order: 0 },
  green:  { key: 'green',  label: '绿', order: 1 },
  blue:   { key: 'blue',   label: '蓝', order: 2 },
  purple: { key: 'purple', label: '紫', order: 3 },
  gold:   { key: 'gold',   label: '金', order: 4 },
  red:    { key: 'red',    label: '红·绝密', order: 5 }
}

// 原创物资；value 为配给点区间，weight 为背包格数。
const ITEM_POOL = {
  white: [
    { name: '结霜标签夹', value: [900, 2600], weight: 1 },
    { name: '校准铅坠', value: [1400, 3300], weight: 1 },
    { name: '旧式热贴', value: [1800, 4600], weight: 1 },
    { name: '绝缘拨片', value: [1200, 3100], weight: 1 },
    { name: '除霜刮片', value: [1100, 2800], weight: 1 },
    { name: '冷媒取样管', value: [1600, 3900], weight: 1 }
  ],
  green: [
    { name: '抗冻接线盒', value: [6200, 10800], weight: 2 },
    { name: '微型焊接笔', value: [7100, 12600], weight: 2 },
    { name: '雪雾信标灯', value: [7600, 13900], weight: 2 },
    { name: '密封菌种包', value: [5400, 9800], weight: 2 },
    { name: '低温密封阀', value: [6800, 11800], weight: 2 },
    { name: '雾灯驱动芯', value: [7300, 13200], weight: 2 }
  ],
  blue: [
    { name: '冰芯测厚规', value: [12200, 18600], weight: 2 },
    { name: '高热口粮罐', value: [13600, 19400], weight: 2 },
    { name: '气压逻辑板', value: [17500, 28700], weight: 2 },
    { name: '耐寒记录盘', value: [22800, 36400], weight: 2 },
    { name: '潮位校准片', value: [15800, 24600], weight: 2 }
  ],
  purple: [
    { name: '白障透视镜', value: [46800, 57600], weight: 2 },
    { name: '风暴固存片', value: [38400, 52200], weight: 2 },
    { name: '长距云层仪', value: [51200, 69400], weight: 2 }
  ],
  gold: [
    { name: '极光频谱冠', value: [246000, 298000], weight: 3 },
    { name: '同温层中继器', value: [186000, 233000], weight: 2 },
    { name: '低温循环泵', value: [162000, 207000], weight: 2 },
    { name: '震冰工程药柱', value: [128000, 159000], weight: 4 }
  ],
  red: [
    { name: '北辰零号晶核', value: [4870000, 5230000], weight: 1 },
    { name: '相控云图阵列', value: [2180000, 2460000], weight: 9 },
    { name: '暴风演算主机', value: [1940000, 2210000], weight: 9 },
    { name: '地热引燃剂', value: [1510000, 1760000], weight: 12 },
    { name: '百年气候母盘', value: [1320000, 1580000], weight: 6 },
    { name: '平流层接收环', value: [610000, 742000], weight: 4 },
    { name: '金穹压力模型', value: [526000, 638000], weight: 4 },
    { name: '远古冰芯样本', value: [412000, 487000], weight: 2 },
    { name: '极夜渲染阵列', value: [356000, 429000], weight: 2 },
    { name: '量子气象匣', value: [298000, 347000], weight: 1 },
    { name: '深海盐度胶囊', value: [214000, 269000], weight: 1 }
  ]
}

// 掉落表：不同区域/事件用不同品质权重（权重和不必为100，按比例算）
const LOOT_TABLES = {
  thermal: { white: 55, green: 38, blue: 7,  purple: 0,  gold: 0,  red: 0 },
  weather: { white: 25, green: 45, blue: 25, purple: 5,  gold: 0,  red: 0 },
  harbor:  { white: 20, green: 45, blue: 28, purple: 7,  gold: 0,  red: 0 },
  crate:   { white: 22, green: 40, blue: 28, purple: 10, gold: 0,  red: 0 },
  lift:    { white: 48, green: 38, blue: 12, purple: 2,  gold: 0,  red: 0 },
  // 高热资产点
  fuel_spot:  { white: 0,  green: 40, blue: 32, purple: 18, gold: 6,  red: 4 },
  // 指挥官掉落
  boss:       { white: 0,  green: 0,  blue: 15, purple: 35, gold: 38, red: 12 },
  // 核心六房
  core:       { white: 0,  green: 18, blue: 38, purple: 28, gold: 14, red: 2 },
  // 核心密封柜
  core_vault: { white: 0,  green: 0,  blue: 25, purple: 40, gold: 29, red: 6 },
  aurora: { white: 0, green: 0, blue: 20, purple: 33, gold: 32, red: 15 }
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

// 按掉落表随机一件物资；redBoost 为绝密资产概率加成。
function rollLoot(tableName, redBoost = 0, avoidNames = []) {
  const table = { ...LOOT_TABLES[tableName] }
  if (!table) return null
  if (redBoost > 0 && table.red !== undefined) table.red += redBoost

  const entries = Object.entries(table).filter(([, w]) => w > 0)
  const total = entries.reduce((s, [, w]) => s + w, 0)
  let roll = Math.random() * total
  let tier = entries[0][0]
  for (const [t, w] of entries) {
    roll -= w
    if (roll <= 0) { tier = t; break }
  }

  const pool = ITEM_POOL[tier]
  const avoid = new Set(avoidNames || [])
  const unused = pool.filter(p => !avoid.has(p.name))
  const pick = unused.length ? unused : pool
  const proto = pick[randInt(0, pick.length - 1)]
  return {
    name: proto.name,
    tier,
    tierLabel: TIERS[tier].label,
    tierOrder: TIERS[tier].order,
    value: randInt(proto.value[0], proto.value[1]),
    weight: proto.weight
  }
}

// 按名字取指定物资，用于唯一资产抉择。
function makeItem(name) {
  for (const tier of Object.keys(ITEM_POOL)) {
    const proto = ITEM_POOL[tier].find(p => p.name === name)
    if (!proto) continue
    return {
      name: proto.name,
      tier,
      tierLabel: TIERS[tier].label,
      tierOrder: TIERS[tier].order,
      value: randInt(proto.value[0], proto.value[1]),
      weight: proto.weight
    }
  }
  return null
}

module.exports = { TIERS, ITEM_POOL, LOOT_TABLES, rollLoot, makeItem }
