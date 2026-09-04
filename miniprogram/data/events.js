// “极夜回收线”决策数据总入口。
// map/spawns/outer/core/aurora/nodes 分别维护地图、出生、事件与固定流程。
//
// event 字段说明：
//   zone      所属区域，决定进哪个区域的事件池
//   room      内环房间（coolant/maglev/compressor/dimhold/storm/tide）
//   phase     只在这个时间段出现：early=第1-2步 mid=第3-5步 late=第6-7步；不写=全程可出
//             口径与 HOTSPOTS 一致。注意每个房间要留至少 2 个不写 phase 的通用事件当地基，
//             否则阶段标签会把每次抽取的有效池切碎，反而更容易重样
//   when      前置状态谓词（见 engine.js 的 WHEN 表）
//             写的是字符串键而不是函数：本文件必须保持纯数据，test/routes.js 才能静态校验
//   entryOnly true = 不进随机池，只能被 goEvent 显式指定
//   free      true = 不占步数、不涨风险、不做遭遇检定（纯路线抉择）
//
// option 字段说明：
//   base      基础成功率（引擎按 hp/负重/风险修正）
//   cost      前置消耗 { meds, card }，不够置灰
//   rounds    这一枪要打掉多少发；armor 目标护甲档(0/3/4/5/6)，穿深不足会跳弹(判定-15%/级、耗弹翻倍)
//   headshot  精准命中暴露部位，可绕开躯干护板；backstab 背后突袭同理
//   need      前置条件 { hpMin 血量门槛, maxLevers 供电上限, minLevers 供电门槛 }
//   success   成功效果 { loot 掉落表, lootCount, hp, risk, rounds 补弹发数, meds, levers, log }
//   fail      失败效果 { hp, risk, lootLose, log }
//   safe      true = 必成功

const { ZONES, ADJACENT, CORE_ROOM_ADJ, HOTSPOTS } = require('./events/map')
const { SPAWNS } = require('./events/spawns')
const { OUTER_EVENTS } = require('./events/outer')
const { CORE_EVENTS } = require('./events/core')
const { AURORA_EVENTS } = require('./events/aurora')
const { LOADOUT_CHOICE, MOVE_ROUTES, MOVE_CHOICE_CORE, ESCAPE_CHOICE } = require('./events/nodes')
const { OPENER_EVENT } = require('./events/opener')

const EVENTS = OUTER_EVENTS.concat(CORE_EVENTS, AURORA_EVENTS, [OPENER_EVENT])

module.exports = { ZONES, ADJACENT, CORE_ROOM_ADJ, HOTSPOTS, SPAWNS, EVENTS, MOVE_ROUTES, MOVE_CHOICE_CORE, ESCAPE_CHOICE, LOADOUT_CHOICE, OPENER_EVENT }
