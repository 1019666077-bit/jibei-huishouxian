// 废弃极地气候研究城：内部 key 与显示名一致，不再沿用旧图兼容代号。
const ZONES = {
  harbor:  { key: 'harbor',  name: '冻港仓储区', riskTag: '中风险·补给密集' },
  weather: { key: 'weather', name: '气象塔群',   riskTag: '中风险·视野开阔' },
  thermal: { key: 'thermal', name: '热能管廊',   riskTag: '低风险·设备繁多' },
  lift:    { key: 'lift',    name: '轨道升降场', riskTag: '中风险·撤收通道' },
  core:    { key: 'core',    name: '研究城内环', riskTag: '高风险·极夜干扰' },
  aurora:  { key: 'aurora',  name: '极光指挥塔', riskTag: '极高风险·技术中枢' }
}

const ADJACENT = {
  harbor:  ['thermal', 'lift'],
  weather: ['thermal', 'lift'],
  thermal: ['harbor', 'weather'],
  lift:    ['harbor', 'weather'],
  core:    [],
  aurora:  ['core']
}

const CORE_ROOM_ADJ = {
  coolant:    ['maglev', 'storm'],
  maglev:     ['coolant', 'dimhold', 'storm'],
  dimhold:    ['maglev', 'compressor', 'storm'],
  compressor: ['dimhold', 'tide', 'storm'],
  tide:       ['compressor', 'storm'],
  storm:      ['coolant', 'maglev', 'compressor', 'dimhold', 'tide']
}

const HOTSPOTS = {
  coolant: [
    { phase: 'early', chance: 13, from: 'spawn_windgate', text: '西侧测风门的小队先一步进入冷却舱' },
    { phase: 'mid', chance: 10, from: 'spawn_harbor', text: '冻港来队沿冷媒渠抵达冷却舱' },
    { phase: 'late', chance: 8, text: '回收终段仍有人守着冷却舱配电柄' }
  ],
  maglev: [
    { phase: 'early', chance: 9, from: 'spawn_harbor_west', text: '冻港门来的队直取磁悬舱样品井' },
    { phase: 'mid', chance: 12, text: '磁轨启动声引来灰潮巡队' },
    { phase: 'late', chance: 8, text: '撤收队在磁悬舱寻找内环近路' }
  ],
  dimhold: [
    { phase: 'early', chance: 11, from: 'spawn_powerditch', text: '电缆沟来的队已占据暗光仓' },
    { phase: 'mid', chance: 11, from: 'spawn_lift', text: '升降场来队沿检修隧道切入暗光仓' },
    { phase: 'late', chance: 9, text: '前往指挥塔的人在暗光仓汇合' }
  ],
  compressor: [
    { phase: 'early', chance: 11, from: 'spawn_lift', text: '下层轨台来的队抢先抵达压缩机房' },
    { phase: 'mid', chance: 13, from: 'spawn_branch', text: '热能支站小队沿蒸汽管线进入压缩机房' },
    { phase: 'late', chance: 10, text: '准备启动撤收索道的人回到压缩机房' }
  ],
  storm: [
    { phase: 'mid', chance: 9, text: '两支回收队在风暴庭院争抢避风墙' },
    { phase: 'late', chance: 9, text: '灰潮搜索灯扫过庭院，逼出一队人影' }
  ],
  tide: [
    { phase: 'mid', chance: 8, text: '有人沿排水渠潜入潮汐坞' },
    { phase: 'late', chance: 7, text: '搜寻指挥官缓存的人与你在潮汐坞相遇' }
  ],
  aurora: [
    { phase: 'mid', chance: 16, text: '极光指挥塔的螺旋梯传来多组脚步' },
    { phase: 'late', chance: 20, text: '封存倒计时逼近，各队都在争夺塔顶主控层' }
  ]
}

module.exports = { ZONES, ADJACENT, CORE_ROOM_ADJ, HOTSPOTS }
