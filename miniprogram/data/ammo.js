// 北辰回收署制式弹药：内部 ID、显示名和口径全部使用虚构命名。
const AMMO_TYPES = {
  dawn6:  { id: 'dawn6',  name: '曙光重型穿芯弹', caliber: '北辰口径', pen: 6 },
  frost6: { id: 'frost6', name: '霜脊重型穿芯弹', caliber: '霜脊口径', pen: 6 },
  dawn4:  { id: 'dawn4',  name: '曙光标准穿芯弹', caliber: '北辰口径', pen: 4 },
  frost4: { id: 'frost4', name: '霜脊标准穿芯弹', caliber: '霜脊口径', pen: 4 },
  dawn3:  { id: 'dawn3',  name: '曙光勤务弹', caliber: '北辰口径', pen: 3 },
  frost2: { id: 'frost2', name: '霜脊勤务弹', caliber: '霜脊口径', pen: 2 },
  short1: { id: 'short1', name: '短锋训练弹', caliber: '短锋口径', pen: 1 }
}

// 三档回收装备只表达功能等级，不引用现实或第三方武器。
const GUNS = {
  full:  { name: '北辰重型回收步枪', caliber: '北辰口径', ammo: 'dawn6',  rounds: 180 },
  half:  { name: '北辰标准勤务步枪', caliber: '北辰口径', ammo: 'dawn4',  rounds: 120 },
  knife: { name: '短锋应急发射器',   caliber: '短锋口径', ammo: 'short1', rounds: 30 }
}

const ARMOR_LABEL = {
  0: '无防护',
  3: '轻型护板',
  4: '勤务护板',
  5: '加强护板',
  6: '重型护板'
}

const DROP_TABLE = {
  ai:       ['dawn3', 'frost2'],
  pvp:      ['dawn4', 'frost4', 'dawn3', 'dawn6'],
  takeover: ['dawn6', 'dawn4', 'frost4'],
  boss:     ['dawn6', 'frost6'],
  box:      ['dawn4', 'dawn3', 'frost4']
}

// 一格装 60 发。
const ROUNDS_PER_GRID = 60

function ammoGrids(rounds) {
  return Math.ceil(Math.max(0, rounds) / ROUNDS_PER_GRID)
}

function makeAmmo(typeId, rounds) {
  const t = AMMO_TYPES[typeId]
  if (!t) return null
  return { id: t.id, name: t.name, caliber: t.caliber, pen: t.pen, rounds }
}

function rollDrop(kind) {
  const pool = DROP_TABLE[kind] || DROP_TABLE.box
  return pool[Math.floor(Math.random() * pool.length)]
}

module.exports = { AMMO_TYPES, GUNS, ARMOR_LABEL, ROUNDS_PER_GRID, ammoGrids, makeAmmo, rollDrop }
