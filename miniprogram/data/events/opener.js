// 首局钩子：不进随机池，只在第一次出发时插入。
// 十秒内必须给出打、抢、跑三种输赢感，文案短、结果狠。
const OPENER_EVENT = {
  id: 'opener_fog',
  zone: 'harbor',
  type: 'event',
  entryOnly: true,
  spot: '雾里。柜还亮。有人换气。',
  text: '雾把灯吃了。柜后有人换气。',
  options: [
    {
      text: '冲过去砸开柜子',
      verb: '砸柜',
      base: 72,
      success: { loot: 'crate', lootCount: 2, risk: 14, log: '柜开了。有脚步' },
      fail: { hp: -16, loot: 'crate', lootCount: 1, risk: 18, log: '柜开了。挨了一下' }
    },
    {
      text: '对着呼吸声开枪',
      verb: '开枪',
      base: 58,
      rounds: 30,
      armor: 3,
      medal: 'pvp',
      success: { loot: 'crate', lootCount: 1, risk: 12, log: '人倒了' },
      fail: { hp: -26, risk: 20, log: '他先打中你' }
    },
    {
      text: '不碰，贴墙撤',
      verb: '撤',
      safe: true,
      success: { risk: 6, log: '没碰封条，贴墙撤' }
    }
  ]
}

module.exports = { OPENER_EVENT }
