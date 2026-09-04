// 极光指挥塔：研究城最高价值终点。
const AURORA_EVENTS = [
  {
    id: 'aurora_corridor', zone: 'aurora',
    text: '指挥塔警戒层是一条弧形窄廊，灰潮机枪手、热焰手与盾卫组成固定封锁，天花板还在投射极光噪点。',
    options: [
      {
        text: '先击穿面部传感器，再绕开盾卫',
        rounds: 40, armor: 5, headshot: true, base: 56, medal: 'ai',
        success: { loot: 'core', lootCount: 1, rounds: 40, risk: 16, log: '警戒层封锁被快速拆解' },
        fail: { hp: -26, risk: 24, log: '机枪火力压住弧形窄廊' }
      },
      {
        text: '贴着极光投影盲区静步通过',
        base: 66,
        success: { risk: 8, log: '借投影噪点穿过警戒层' },
        fail: { hp: -20, risk: 20, log: '热焰手转身封住通道' }
      }
    ]
  },
  {
    id: 'aurora_office', zone: 'aurora',
    text: '极光指挥塔主控前厅保存着风暴预案、观测终端与封存箱，核心保管库只隔一道重门。',
    options: [
      {
        text: '快速拆取观测终端并翻查封存箱',
        base: 70,
        success: { loot: 'core', lootCount: 2, risk: 15, log: '主控前厅回收两件技术资产' },
        fail: { hp: -18, risk: 22, log: '封存箱警报引来隔壁守备' }
      },
      {
        text: '不在前厅停留，直取核心保管库',
        safe: true,
        success: { goEvent: 'aurora_vault', risk: 6, log: '穿过主控前厅进入核心保管库' }
      }
    ]
  },
  {
    id: 'aurora_vault', zone: 'aurora',
    text: '塔顶核心保管库封存着研究城最重要的气候技术，加强护板守备班挡在零号资产柜前。',
    options: [
      {
        text: '强攻守备班，开启零号资产柜',
        rounds: 80, armor: 5, base: 48, medal: 'ai', need: { hpMin: 45 },
        success: { loot: 'aurora', lootCount: 2, risk: 30, log: '守备班被击破，零号资产柜完成回收' },
        fail: { hp: -48, risk: 35, lootLose: 1, log: '强攻失败，为脱离保管库遗失一件资产' }
      },
      {
        text: '只取外间应急封存箱',
        base: 70,
        success: { loot: 'core', lootCount: 1, risk: 16, log: '外间封存箱快速回收' },
        fail: { hp: -18, risk: 22, log: '外间暗哨发动拦截' }
      },
      { text: '退出保管库，不与守备班硬碰', safe: true, success: { risk: 6, log: '退回指挥塔前厅' } }
    ]
  },
  {
    id: 'aurora_stair', zone: 'aurora',
    text: '塔内螺旋梯没有侧向掩体，下层正传来一组沉重脚步，显然有人携带大量资产登塔。',
    options: [
      {
        text: '利用高度差控制螺旋梯',
        rounds: 45, armor: 5, base: 58, medal: 'pvp',
        success: { loot: 'crate', lootCount: 2, risk: 20, log: '登塔队在螺旋梯失去掩体，资产被截获' },
        fail: { hp: -34, risk: 26, log: '对方从设备梯绕到背后' }
      },
      {
        text: '抢先登上塔顶保管库',
        base: 68,
        success: { goEvent: 'aurora_vault', risk: 12, log: '先一步进入核心保管库' },
        fail: { hp: -20, risk: 20, log: '登梯声惊动塔顶守备' }
      },
      {
        text: '让来队先接触守备，再从后方收尾',
        base: 60,
        success: { loot: 'crate', lootCount: 1, risk: 16, log: '借守备火力消耗来队后完成接管' },
        fail: { hp: -26, risk: 22, log: '来队仍保持足够战力，回头反击' }
      }
    ]
  },
  {
    id: 'aurora_window', zone: 'aurora',
    text: '主控层的极光观测窗俯视风暴庭院、冷却舱顶与南侧撤收线，玻璃一旦破裂就会触发全塔压差警报。',
    options: [
      {
        text: '击碎观察窗截击庭院目标',
        rounds: 35, armor: 4, base: 62, medal: 'pvp',
        success: { loot: 'core', lootCount: 1, risk: 18, log: '高位截击成功，压差警报同时启动' },
        fail: { hp: -22, risk: 24, log: '庭院目标反向锁定观测窗' }
      },
      {
        text: '只观察各区动向，不破坏玻璃',
        base: 80,
        success: { risk: -6, log: '从观测窗确认内环与撤收线态势' },
        fail: { risk: 8, log: '极光噪点遮住大部分视野' }
      },
      { text: '远离观测窗，继续搜索主控层', safe: true, success: { loot: 'core', lootCount: 1, risk: 6, log: '主控层内回收一件资产' } }
    ]
  },
  {
    id: 'aurora_late', zone: 'aurora', when: 'presDone',
    text: '零号资产柜已被你开启，空柜前只剩守备装备；后续登塔者会认定最重要的技术资产就在你身上。',
    options: [
      {
        text: '利用空柜反守下一支登塔队',
        rounds: 50, armor: 5, base: 54, medal: 'pvp',
        success: { loot: 'crate', lootCount: 2, risk: 22, log: '登塔队冲向空柜时被截停' },
        fail: { hp: -38, risk: 28, log: '携带塔顶资产久留，遭两侧包夹' }
      },
      {
        text: '检查守备班遗留装备',
        base: 70,
        success: { loot: 'crate', lootCount: 1, lootMode: 'body', risk: 14, log: '守备装备中仍有可回收部件' },
        fail: { hp: -18, risk: 20, log: '检查途中螺旋梯来人' }
      },
      {
        text: '带着技术资产沿磁悬侧梯下塔',
        safe: true,
        success: { moveTo: 'core', goEvent: 'core_maglev', risk: 4, log: '从磁悬侧梯返回内环' }
      }
    ]
  }
]

module.exports = { AURORA_EVENTS }
