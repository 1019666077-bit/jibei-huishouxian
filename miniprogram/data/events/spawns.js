// 八个原创出生点。内部 ID 保持稳定，画面走点选，文案只留短标。
const SPAWNS = [
  {
    id: 'spawn_windgate', type: 'event', zone: 'weather',
    spot: '测风门。塔在盯你。',
    text: '测风门。塔在盯你。',
    options: [
      { text: '刷通行芯片穿冷媒渠，抢先进入冷却舱', verb: '刷门', cost: { card: 1 }, base: 74,
        success: { moveTo: 'core', goEvent: 'core_coolant', risk: 8, log: '进冷却舱了' },
        fail: { hp: -18, risk: 18, moveTo: 'core', goEvent: 'core_coolant', log: '挨打滚进冷却舱' } },
      { text: '检查测风门货梯和样品箱', verb: '开箱', base: 76,
        success: { loot: 'crate', lootCount: 1, lootMode: 'search', risk: 6, log: '样品箱到手' },
        fail: { hp: -14, risk: 14, log: '有人跟来，撤' } },
      { text: '不消耗芯片，沿覆冰连桥前往气象塔群', verb: '连桥', safe: true,
        success: { goEvent: 'wt_bridge', risk: 4, log: '上了连桥' } }
    ]
  },
  {
    id: 'spawn_harbor_west', type: 'event', zone: 'harbor',
    spot: '西堤。门在响。',
    text: '西堤。门在响。',
    options: [
      { text: '用通行芯片开启西堤气密门，进入磁悬舱', verb: '刷门', cost: { card: 1 }, base: 74,
        success: { moveTo: 'core', goEvent: 'entry_west', risk: 10, log: '门开了，进内环' },
        fail: { hp: -15, risk: 16, moveTo: 'core', goEvent: 'entry_west', log: '开门挨打，还是进去了' } },
      { text: '先清理仓顶观察哨', verb: '清哨', rounds: 45, armor: 4, base: 58, medal: 'pvp',
        success: { loot: 'harbor', lootCount: 2, risk: 18, log: '哨没了' },
        fail: { hp: -26, risk: 24, log: '火力把你压下来' } },
      { text: '搜西堤维修车，补充弹药和医疗', verb: '搜车', safe: true,
        success: { rounds: 60, meds: 1, risk: 4, log: '车上有药有弹' } },
      { text: '沿冰下输送带绕去气象塔群', verb: '塔群', base: 68,
        success: { moveTo: 'weather', goEvent: 'wt_bridge', risk: 8, log: '钻到塔底下' },
        fail: { hp: -12, risk: 12, moveTo: 'weather', log: '冰裂了，带着伤到塔边' } }
    ]
  },
  {
    id: 'spawn_harbor', type: 'event', zone: 'harbor',
    spot: '三号库顶。灯在扫。',
    text: '三号库顶。灯在扫。',
    options: [
      { text: '下到一号冷库回收医用恒温箱', verb: '下一号', base: 72,
        success: { loot: 'harbor', lootCount: 2, meds: 1, risk: 8, log: '恒温箱到手' },
        fail: { hp: -14, risk: 14, log: '库里有人，破窗撤' } },
      { text: '沿屋顶串联三座冷库，拆取温控模块', verb: '拆顶', base: 64,
        success: { loot: 'fuel_spot', lootCount: 1, risk: 10, log: '模块拆下来了' },
        fail: { hp: -18, risk: 18, log: '踏板掀了，人摔下去' } },
      { text: '伏在吊轨后截断西堤来队', verb: '截击', rounds: 45, armor: 4, base: 58, medal: 'pvp',
        success: { loot: 'harbor', lootCount: 2, risk: 16, log: '伏击成了' },
        fail: { hp: -22, risk: 22, log: '被反包了' } },
      { text: '刷芯片从西堤气密门切入内环', verb: '刷门', cost: { card: 1 }, base: 70,
        success: { moveTo: 'core', goEvent: 'entry_west', risk: 10, log: '进内环了' },
        fail: { hp: -15, risk: 16, moveTo: 'core', goEvent: 'entry_west', log: '门慢了，带着伤挤进去' } }
    ]
  },
  {
    id: 'spawn_weather', type: 'event', zone: 'weather',
    spot: '风标平台。四面透风。',
    text: '风标平台。四面透风。',
    options: [
      { text: '逐层检查风标塔和数据讲堂', verb: '搜塔', base: 66,
        success: { loot: 'fuel_spot', lootCount: 1, risk: 10, log: '端口有货' },
        fail: { hp: -16, risk: 16, log: '塔里撞上人' } },
      { text: '直下二层打开气压档案柜', verb: '开柜', base: 62,
        success: { loot: 'core_vault', lootCount: 2, risk: 14, log: '档案柜开了' },
        fail: { hp: -18, risk: 18, log: '开柜声引来人' } },
      { text: '占据风向标高点截击连桥来队', verb: '截击', rounds: 40, armor: 4, base: 55, medal: 'pvp',
        success: { loot: 'crate', lootCount: 2, risk: 18, log: '高点打中了' },
        fail: { hp: -22, risk: 22, log: '看不见，被侧打' } },
      { text: '沿维护索道滑入研究城内环', verb: '滑入', base: 68,
        success: { moveTo: 'core', goEvent: 'entry_north', risk: 12, log: '滑进内环北侧' },
        fail: { hp: -16, risk: 16, log: '索道冻住，退回塔基' } }
    ]
  },
  {
    id: 'spawn_thermal', type: 'event', zone: 'thermal',
    spot: '管廊北端。热，但远。',
    text: '管廊北端。热，但远。',
    options: [
      { text: '刷芯片穿过蒸汽检修管，进入冷却舱', verb: '刷门', cost: { card: 1 }, base: 66,
        success: { moveTo: 'core', goEvent: 'core_coolant', risk: 10, log: '进冷却舱' },
        fail: { hp: -15, risk: 16, moveTo: 'core', goEvent: 'core_coolant', log: '管口挨打，还是进去了' } },
      { text: '追踪前队热迹，从暗光仓侧翼切入', verb: '跟热', base: 62,
        success: { moveTo: 'core', goEvent: 'core_dimhold', risk: 12, log: '摸到暗光仓' },
        fail: { hp: -16, risk: 16, log: '热迹是诱饵' } },
      { text: '清理换热站，控制这段管廊', verb: '开火', rounds: 45, armor: 4, base: 58, medal: 'pvp',
        success: { loot: 'fuel_spot', lootCount: 1, risk: 16, log: '换热站到手' },
        fail: { hp: -22, risk: 22, log: '阀组后面有人' } },
      { text: '沿保温层去气象塔群捡漏', verb: '塔群', base: 60,
        success: { loot: 'weather', lootCount: 2, risk: 14, log: '塔边还有货' },
        fail: { hp: -20, risk: 20, log: '塔基被人封了' } },
      { text: '在热交换井等待枪声远去', verb: '等', safe: true,
        success: { risk: 2, skipStep: true, log: '枪声远了' } }
    ]
  },
  {
    id: 'spawn_branch', type: 'event', zone: 'thermal',
    spot: '二号支站。前后都可能有人。',
    text: '二号支站。前后都可能有人。',
    options: [
      { text: '先确认南侧阀门，再拆地热控制件', verb: '拆件', base: 78,
        success: { loot: 'fuel_spot', lootCount: 1, risk: 6, log: '控制件下来了' },
        fail: { risk: 10, log: '件被人拆空了' } },
      { text: '上层材料室打开密封档案柜', verb: '开柜', base: 66,
        success: { loot: 'core_vault', lootCount: 2, risk: 10, log: '档案柜开了' },
        fail: { hp: -14, risk: 14, log: '楼下有脚步，弃柜' } },
      { text: '利用蒸汽观察窗狙击过路巡队', verb: '开枪', rounds: 20, armor: 4, headshot: true, base: 55, medal: 'pvp',
        success: { loot: 'crate', lootCount: 2, risk: 18, log: '窗后打中了' },
        fail: { hp: -20, risk: 20, log: '镜片结霜，位置露了' } },
      { text: '刷芯片进入内环压缩线', verb: '刷门', cost: { card: 1 }, base: 64,
        success: { moveTo: 'core', goEvent: 'core_compressor', risk: 10, log: '进压缩线' },
        fail: { hp: -15, risk: 16, moveTo: 'core', goEvent: 'core_compressor', log: '门后有人，还是进去了' } }
    ]
  },
  {
    id: 'spawn_powerditch', type: 'event', zone: 'thermal',
    spot: '供能沟底。桥在东。',
    text: '供能沟底。桥在东。',
    options: [
      { text: '刷芯片升起检修桥，从东侧进入暗光仓', verb: '升桥', cost: { card: 1 }, base: 60,
        success: { moveTo: 'core', goEvent: 'entry_east', risk: 14, log: '桥升了，进东侧' },
        fail: { hp: -20, risk: 20, moveTo: 'core', goEvent: 'entry_east', log: '桥上挨打，跌进外廊' } },
      { text: '不刷门，沿供能沟转往热能支站', verb: '连桥', base: 62,
        success: { loot: 'thermal', lootCount: 1, moveTo: 'weather', goEvent: 'wt_bridge', risk: 10, log: '沟尽头接上连桥' },
        fail: { hp: -20, risk: 20, log: '沟里撞上搜索组' } },
      { text: '关闭照明，等巡组离开再行动', verb: '等', safe: true,
        success: { risk: 2, skipStep: true, log: '人走了' } }
    ]
  },
  {
    id: 'spawn_lift', type: 'event', zone: 'lift',
    spot: '下层站台。货舱在上。',
    text: '下层站台。货舱在上。',
    options: [
      { text: '抢在守备合围前打开坠落货舱', verb: '开舱', base: 60,
        success: { loot: 'boss', lootCount: 1, risk: 14, log: '货舱里有硬货' },
        fail: { hp: -22, risk: 18, log: '合围了，空手突' } },
      { text: '沿配重箱下跳，直达压缩机房', verb: '下跳', base: 74,
        success: { hp: -5, moveTo: 'core', goEvent: 'core_compressor', risk: 8, log: '跳进压缩机房' },
        fail: { hp: -18, risk: 16, moveTo: 'core', goEvent: 'core_compressor', log: '落偏了，带着伤到' } },
      { text: '走排水隧道去潮汐坞，抢指挥官缓存', verb: '潮汐坞', base: 70,
        success: { moveTo: 'core', goEvent: 'core_tide', risk: 10, log: '隧道通潮汐坞' },
        fail: { hp: -16, risk: 14, moveTo: 'core', goEvent: 'core_tide', log: '炮台扫了隧道口' } },
      { text: '先观察升降轨和冻港方向，再扫平台工具柜', verb: '搜', safe: true,
        success: { loot: 'lift', lootCount: 1, risk: 4, log: '柜里有一件' } }
    ]
  }
]

module.exports = { SPAWNS }
