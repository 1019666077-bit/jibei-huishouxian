// 首局钩子：不进随机池，只在第一次出发时插入。
// 十秒内给出打、抢、跑三种反馈，失败只擦伤，避免开局贪一下就倒。
const OPENER_EVENT = {
  id: 'opener_fog',
  zone: 'harbor',
  type: 'event',
  entryOnly: true,
  spot: '雾里。柜还亮。内环通电。',
  text: '雾把灯吃了。柜后有人换气。',
  options: [
    {
      text: '冲过去砸开柜子',
      verb: '砸柜',
      base: 84,
      success: { loot: 'crate', lootCount: 2, risk: 10, log: '柜开了。有脚步' },
      fail: { hp: -8, loot: 'crate', lootCount: 1, risk: 12, log: '柜开了。擦了一下' }
    },
    {
      text: '对着呼吸声开枪',
      verb: '开枪',
      base: 72,
      rounds: 30,
      armor: 3,
      medal: 'pvp',
      success: { loot: 'crate', lootCount: 1, risk: 10, log: '人倒了' },
      fail: { hp: -10, risk: 14, log: '他擦中你，人还在' }
    },
    {
      text: '不碰，贴墙撤向内环',
      verb: '撤',
      safe: true,
      success: { risk: 4, moveTo: 'core', goEvent: 'core_coolant', log: '没碰封条，转入冷却舱合闸' }
    }
  ]
}

module.exports = { OPENER_EVENT }
