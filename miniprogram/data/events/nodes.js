// 固定流程节点：战备、转移、撤收。画面走地图点，这里只留短标。
const LOADOUT_CHOICE = {
  id: 'loadout',
  type: 'loadout',
  spot: '带什么进场',
  text: '带什么进场',
  options: [
    { text: '重装回收组 · 45万配给点（重型护板、重型回收步枪、通行芯片、180发曙光重型穿芯弹、医疗2、30格）', verb: '重装', loadout: 'full' },
    { text: '标准勤务组 · 15万配给点（勤务护板、标准勤务步枪、通行芯片、120发曙光标准穿芯弹、医疗1、25格）', verb: '标准', loadout: 'half' },
    { text: '轻装勘探组 · 0配给点（应急发射器、30发训练弹、无护板无芯片、8格）', verb: '轻装', loadout: 'knife' }
  ]
}

const MOVE_ROUTES = {
  harbor: {
    id: 'move', type: 'move',
    spot: '冻港搜完了。下一段？',
    text: '冻港搜完了。下一段？',
    options: [
      { text: '沿运冰线去热能管廊', verb: '管廊', moveTo: 'thermal', risk: 5 },
      { text: '沿货运环轨去轨道升降场', verb: '升降场', moveTo: 'lift', risk: 6 },
      { text: '刷通行芯片开启西堤气密门', verb: '刷门', moveTo: 'core', risk: 8, cost: { card: 1 }, goEvent: 'entry_west' },
      { text: '走覆冰连桥进入内环北侧', verb: '连桥', moveTo: 'core', risk: 12, goEvent: 'entry_north' }
    ]
  },
  weather: {
    id: 'move', type: 'move',
    spot: '塔群看过了。下一段？',
    text: '塔群看过了。下一段？',
    options: [
      { text: '沿蒸汽线去热能管廊', verb: '管廊', moveTo: 'thermal', risk: 5 },
      { text: '沿维护轨去轨道升降场', verb: '升降场', moveTo: 'lift', risk: 5 },
      { text: '通过覆冰连桥进入内环', verb: '连桥', moveTo: 'core', risk: 12, goEvent: 'entry_north' }
    ]
  },
  thermal: {
    id: 'move', type: 'move',
    spot: '管廊空了。下一段？',
    text: '管廊空了。下一段？',
    options: [
      { text: '沿运冰线去冻港仓储区', verb: '冻港', moveTo: 'harbor', risk: 5 },
      { text: '沿蒸汽线去气象塔群', verb: '塔群', moveTo: 'weather', risk: 5 },
      { text: '刷芯片穿蒸汽检修管，进入冷却舱', verb: '刷门', moveTo: 'core', risk: 8, cost: { card: 1 }, goEvent: 'core_coolant' },
      { text: '沿供能沟从东侧进入内环', verb: '东侧', moveTo: 'core', risk: 12, goEvent: 'entry_east' }
    ]
  },
  lift: {
    id: 'move', type: 'move',
    spot: '升降场过了。下一段？',
    text: '升降场过了。下一段？',
    options: [
      { text: '从配重井进入内环南侧', verb: '南侧', moveTo: 'core', risk: 10, goEvent: 'entry_south' },
      { text: '沿货运环轨去冻港仓储区', verb: '冻港', moveTo: 'harbor', risk: 5 },
      { text: '沿维护轨去气象塔群', verb: '塔群', moveTo: 'weather', risk: 5 }
    ]
  }
}

const MOVE_CHOICE_CORE = {
  id: 'move_core',
  type: 'move',
  spot: '内环。上塔、继续、还是撤？',
  text: '内环。上塔、继续、还是撤？',
  options: [
    { text: '登上极光指挥塔，争夺零号资产柜', verb: '上塔', moveTo: 'aurora', risk: 18, need: { hpMin: 45 }, goEvent: 'aurora_corridor' },
    { text: '留在内环继续搜索六个技术房间', verb: '再搜', moveTo: 'core', risk: 6 },
    { text: '沿排压道前往轨道升降场撤离线', verb: '撤离线', moveTo: 'lift', risk: -6 }
  ]
}

const ESCAPE_CHOICE = {
  id: 'escape',
  type: 'escape',
  spot: '南边五条路。选一条撤。',
  text: '南边五条路。选一条撤。',
  options: [
    { text: '极地索道撤收 · 双配电柄启动，全部资产带出', verb: '索道', method: 'heli', base: 90, need: { minLevers: 2 } },
    { text: '风暴列车强行离场 · 全部带出，并可检查车载封存舱', verb: '列车', method: 'rocket', base: 70 },
    { text: '借用他队索道窗口 · 释放白障后混入吊舱', verb: '混入', method: 'sneak', base: 60, need: { maxLevers: 2 } },
    { text: '截停撤收小队 · 接管他们的吊舱与两份资产包', verb: '截停', method: 'ambush', base: 55, rounds: 60, armor: 5, need: { maxLevers: 2 } },
    { text: '货运雪橇撤收 · 最稳，但只能保留四格低温回收匣内物资', verb: '雪橇', method: 'bag', base: 96 }
  ]
}

module.exports = { LOADOUT_CHOICE, MOVE_ROUTES, MOVE_CHOICE_CORE, ESCAPE_CHOICE }
