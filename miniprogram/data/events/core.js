// 研究城内环六房：冷却舱、磁悬舱、压缩机房、暗光仓、风暴庭院、潮汐坞。
const E = (id, room, text, options, extra = {}) => ({ id, zone: 'core', ...(room ? { room } : {}), ...extra, text, options })
const S = (text, success, extra = {}) => ({ text, safe: true, ...extra, success })
const R = (text, base, success, fail, extra = {}) => ({ text, base, ...extra, success, fail })
const C = (text, base, success, fail, extra = {}) => R(text, base, success, fail, { medal: extra.medal || 'pvp', ...extra })

const CORE_EVENTS = [
  E('entry_north', null,
    '内环北侧。左冷却，右磁悬。', [
      R('穿风暴庭院直取极光指挥塔', 62,
        { moveTo: 'aurora', goEvent: 'aurora_corridor', risk: 14, log: '上了指挥塔下层' },
        { hp: -20, risk: 18, log: '庭院炮台把路锁了' }, { need: { hpMin: 45 } }),
      S('先进入冷却舱，检查配电柄和密封柜', { goEvent: 'core_coolant', log: '进冷却舱' }),
      S('先进入磁悬舱，搜索样品井', { goEvent: 'core_maglev', log: '进磁悬舱' })
    ], { entryOnly: true, free: true }),
  E('entry_east', null,
    '内环东侧。没灯。', [
      S('沿北侧冷媒管进入冷却舱', { goEvent: 'core_coolant', log: '进冷却舱' }),
      S('关闭照明进入暗光仓', { goEvent: 'core_dimhold', log: '进暗光仓' })
    ], { entryOnly: true, free: true }),
  E('entry_west', null,
    '西门后就是压缩机房。', [
      R('沿磁悬侧梯直上极光指挥塔', 66,
        { moveTo: 'aurora', goEvent: 'aurora_corridor', risk: 12, log: '侧梯上了指挥塔' },
        { hp: -16, risk: 16, log: '侧梯被封了' }, { need: { hpMin: 45 } }),
      S('进入压缩机房', { goEvent: 'core_compressor', log: '进压缩机房' }),
      S('沿下层排水管去潮汐坞', { goEvent: 'core_tide', log: '去潮汐坞' }),
      S('经磁轨转入磁悬舱', { goEvent: 'core_maglev', log: '进磁悬舱' })
    ], { entryOnly: true, free: true }),
  E('entry_south', null,
    '南侧落点。三扇门。', [
      S('先查暗光仓的数据货架', { goEvent: 'core_dimhold', log: '进暗光仓' }),
      S('沿排水渠进入潮汐坞', { goEvent: 'core_tide', log: '进潮汐坞' }),
      S('直入压缩机房，寻找第二道配电柄', { goEvent: 'core_compressor', log: '进压缩机房' })
    ], { entryOnly: true, free: true }),

  E('core_coolant', 'coolant',
    '冷却舱的蓝白雾气压低能见度，主配电柄位于结霜平台，旁边密封柜仍显示完整封条。', [
      R('破解冷却舱密封柜', 58,
        { loot: 'core_vault', lootCount: 2, risk: 20, log: '冷却舱密封柜回收完成' },
        { hp: -22, risk: 25, log: '解锁时遭雾中伏击' }),
      S('合上冷却舱配电柄', { levers: 1, leverRoom: 'coolant', risk: 8, log: '冷却舱配电柄已合上' },
        { need: { maxLevers: 2, leverRoom: 'coolant' } }),
      R('扫描结霜平台的散落仪器', 75,
        { loot: 'core', lootCount: 1, risk: 10, log: '平台仪器入包' },
        { risk: 14, log: '平台已被清空' })
    ]),
  E('coolant_ambush', 'coolant',
    '冷却雾中出现规律的呼吸声，一名灰潮伏守者靠在制冷柱后，正等人触碰配电柄。', [
      C('投出震冰弹逼他离开制冷柱', 62,
        { loot: 'crate', lootCount: 1, risk: 16, log: '伏守者被逼出掩体，装备归回收署' },
        { hp: -26, risk: 22, log: '震冰弹被柱体挡住，遭到反击' }, { rounds: 45, armor: 4 }),
      C('贴着冷媒噪声绕到背后', 45,
        { loot: 'crate', lootCount: 1, risk: 14, log: '借设备噪声完成无声制服' },
        { hp: -40, risk: 24, log: '脚下薄冰碎裂，近距离交火受创' }),
      S('离开雾区，不碰伏守点', { risk: 5, log: '退出冷却舱伏守区' })
    ]),
  E('coolant_double_door', 'coolant',
    '冷却舱双联样本门需要两处同时授权，此刻门被前队撑开，搬运车还停在里面。', [
      C('守住出口截取搬运资产', 52,
        { loot: 'core_vault', lootCount: 2, risk: 20, log: '样本门搬运队被截停' },
        { hp: -40, risk: 26, log: '完整搬运班组反向封门' }, { rounds: 50, armor: 5 }),
      R('从另一侧授权口取一件就走', 56,
        { loot: 'core', lootCount: 2, lootMode: 'search', risk: 18, log: '双联样本间抢收两件资产' },
        { hp: -24, risk: 22, log: '样本间内已有警戒人员' }),
      S('放弃需要双人授权的样本间', { risk: 5, log: '绕开双联样本门' })
    ]),
  E('coolant_alarm', 'coolant',
    '冷却剂泄漏警报突然启动，灰潮应急组正从多个舱门向结霜平台汇集。', [
      R('依托制冷柱清除应急组', 62,
        { loot: 'core', lootCount: 1, rounds: 40, risk: 20, log: '应急组被清除，并取得补给' },
        { hp: -30, risk: 26, log: '应急组持续增援，小队被逼出舱门' }, { rounds: 60, armor: 3, medal: 'ai' }),
      R('趁警戒转向抢开密封柜', 62,
        { loot: 'core_vault', lootCount: 2, risk: 18, log: '警报掩护了密封柜回收' },
        { hp: -26, risk: 24, log: '柜门声引回一组守备' }),
      S('在应急组封舱前撤离', { risk: 6, log: '离开泄漏警报区' })
    ]),
  E('coolant_late', 'coolant',
    '回收终段的冷却舱只剩空柜和断开的冷媒管，仍有人守着配电柄等待撤收队出现。', [
      C('反守配电平台', 54,
        { loot: 'crate', lootCount: 2, risk: 20, log: '赶来合闸的队伍被截停' },
        { hp: -36, risk: 26, log: '更早到位的伏守者发动攻击' }, { rounds: 45, armor: 5 }),
      R('复查冷媒槽底部', 70,
        { loot: 'core', lootCount: 1, risk: 8, log: '冷媒槽中找到遗漏资产' },
        { risk: 12, log: '冷却舱已无可回收物' }),
      S('离开空舱，向南侧撤收线移动', { risk: 3, log: '不在空冷却舱停留' })
    ], { phase: 'late' }),

  E('core_compressor', 'compressor',
    '压缩机房震动不断，第二道配电柄在检修梯转角，二层压力档案柜仍处于锁定状态。', [
      R('打开二层压力档案柜', 58,
        { loot: 'core_vault', lootCount: 2, risk: 18, log: '压力档案柜回收完成' },
        { hp: -20, risk: 22, log: '检修梯暗处出现伏击者' }),
      S('合上压缩机房配电柄', { levers: 1, leverRoom: 'compressor', risk: 8, log: '压缩机房配电柄已合上' },
        { need: { maxLevers: 2, leverRoom: 'compressor' } }),
      S('沿设备背面快速通过', { risk: 4, log: '穿过压缩机房' })
    ]),
  E('compressor_guard', 'compressor',
    '压缩机房传来配电柄撞击声，另一支队伍刚启动撤收供电，随后退回内环寻找第二道电源。', [
      C('守住配电柄等他们回来', 52,
        { levers: 1, leverRoom: 'compressor', loot: 'crate', lootCount: 2, risk: 18, log: '守柄截击成功，供电进度与资产一并接管' },
        { hp: -42, risk: 24, log: '对方从两侧检修梯包围守位' },
        { rounds: 60, armor: 5, need: { maxLevers: 2 } }),
      R('趁空档接管配电节奏', 72,
        { levers: 1, leverRoom: 'compressor', risk: 12, log: '压缩机房供电进度由回收署接管' },
        { hp: -12, risk: 16, log: '操作中撞上回防队' }, { need: { maxLevers: 2 } }),
      S('远离配电平台，搜设备背面', { loot: 'core', lootCount: 1, risk: 6, log: '设备背面安静回收一件资产' })
    ]),
  E('compressor_stair', 'compressor',
    '检修梯转角传来极轻的换匣声，伏守者利用压缩机震动掩盖了自己的动作。', [
      C('用震冰弹清理检修梯转角', 60,
        { loot: 'crate', lootCount: 1, risk: 18, log: '转角伏守者被清除' },
        { hp: -32, risk: 24, log: '投掷角度被护栏挡住' }, { rounds: 45, armor: 5 }),
      R('不上二层，只搜一层控制柜', 74,
        { loot: 'core', lootCount: 1, risk: 8, log: '一层控制柜回收一件' },
        { risk: 12, log: '一层控制柜已空' }),
      S('从外侧维护廊绕过检修梯', { risk: 4, log: '避开检修梯伏守点' })
    ]),
  E('compressor_bot', 'compressor',
    '灰潮强化巡检组封住二层档案柜，他们专门射击暴露的手脚，重甲也很难完全保护。', [
      R('强行清理强化巡检组', 58,
        { loot: 'core', lootCount: 1, risk: 18, log: '强化巡检组被清除' },
        { hp: -32, risk: 24, log: '肢体遭连续命中，撤回一层' }, { rounds: 50, armor: 4, medal: 'ai' }),
      R('把巡检组引下一层，再绕回档案柜', 60,
        { loot: 'core_vault', lootCount: 2, risk: 16, log: '调离巡检组后打开档案柜' },
        { hp: -22, risk: 22, log: '巡检组在梯中停止追击，形成封锁' }),
      S('退出压缩机房', { risk: 5, log: '放弃与强化巡检组接触' })
    ]),
  E('compressor_late', 'compressor',
    '供电广播已经响过，压缩机房内外都是赶往撤收线的脚步，配电平台变成了争夺焦点。', [
      C('截停赶往索道的携货队', 56,
        { loot: 'crate', lootCount: 2, risk: 20, log: '撤收队资产被截获' },
        { hp: -36, risk: 26, log: '整组撤收人员强行突破' }, { rounds: 50, armor: 5 }),
      R('混入人流前往轨道升降场', 72,
        { moveTo: 'lift', risk: -6, log: '跟随撤收人流向升降场移动' },
        { hp: -18, risk: 16, log: '混行途中遭流弹命中' }),
      R('逆向返回二层打开档案柜', 58,
        { loot: 'core_vault', lootCount: 2, risk: 18, log: '人流离开后档案柜无人看守' },
        { hp: -24, risk: 22, log: '逆向行动被误认为抢夺供电' })
    ], { phase: 'late', when: 'leverPulled' }),

  E('core_dimhold', 'dimhold',
    '暗光仓的遮光板全部关闭，货架只靠设备状态灯勾出轮廓；上层维护梯通往极光指挥塔。', [
      R('搜索数据货架与光学台', 62,
        { loot: 'core', lootCount: 2, risk: 16, log: '暗光仓两处资产完成回收' },
        { hp: -24, risk: 24, log: '黑暗中遭灰潮驻守火力压制' }),
      R('沿维护梯直上极光指挥塔', 70,
        { moveTo: 'aurora', goEvent: 'aurora_office', risk: 10, log: '从暗光维护梯进入指挥塔主控层' },
        { hp: -14, risk: 14, log: '维护梯遇到下行搜索队' }, { need: { hpMin: 45 } }),
      S('不深入暗光仓底层，退回内环廊道', { risk: 4, log: '退出暗光仓' })
    ]),
  E('dimhold_satellite', 'dimhold',
    '暗光仓的天幕模拟架仍装着一组平流层接收环，两名灰潮技师正在检查锁扣。', [
      R('攀上模拟架拆取接收环', 64,
        { loot: 'core_vault', lootCount: 1, lootMode: 'search', risk: 18, log: '接收环从模拟架拆离' },
        { hp: -20, risk: 22, log: '拆卸中被技师发现' }),
      R('先处理技师，再拆设备', 68,
        { loot: 'core', lootCount: 2, risk: 16, log: '技师与模拟架资产一并清理' },
        { hp: -22, risk: 22, log: '技师触发仓内警报' }, { rounds: 30, armor: 3, medal: 'ai' }),
      S('只取架底线缆匣', { loot: 'thermal', lootCount: 1, risk: 5, log: '线缆匣快速回收' })
    ]),
  E('dimhold_smoke', 'dimhold',
    '遮光材料燃烧后形成不透光烟层，三米外只剩热源轮廓，烟中脚步无法辨向。', [
      R('借烟层摸到数据货架', 70,
        { loot: 'core', lootCount: 1, risk: 12, log: '烟层中找到一件数据资产' },
        { hp: -18, risk: 18, log: '烟中与敌人贴面相遇' }),
      C('守住烟层出口', 60,
        { loot: 'crate', lootCount: 1, risk: 18, log: '烟层出口截击成功' },
        { hp: -28, risk: 24, log: '敌人从维护孔绕到侧后' }, { rounds: 40, armor: 4 }),
      S('绕开燃烧区', { risk: 4, log: '沿完整遮光墙绕行' })
    ]),
  E('dimhold_corridor', 'dimhold',
    '暗光仓通往极光指挥塔的维护廊散着空弹匣，显然有人长期观察这条必经线。', [
      C('反向守住维护廊入口', 52,
        { loot: 'crate', lootCount: 2, risk: 20, log: '前往指挥塔的携货队被截停' },
        { hp: -40, risk: 26, log: '更深处的伏守者先行开火' }, { rounds: 50, armor: 5 }),
      R('绕设备层进入指挥塔主控层', 62,
        { moveTo: 'aurora', goEvent: 'aurora_office', risk: 12, log: '避开维护廊，从设备层进入指挥塔' },
        { hp: -16, risk: 16, log: '设备层同样有人警戒' }, { need: { hpMin: 45 } }),
      S('放弃登塔，继续搜索暗光仓', { loot: 'core', lootCount: 1, risk: 5, log: '留在暗光仓回收一件资产' })
    ]),

  E('core_maglev', 'maglev',
    '磁悬舱中央是深陷的磁轨样品井，密封回收柜位于井底，启动吊台会产生覆盖全舱的低频震动。', [
      R('启动吊台下井打开密封柜', 60,
        { loot: 'core_vault', lootCount: 2, risk: 16, log: '样品井密封柜回收完成' },
        { hp: -20, risk: 20, log: '吊台震动引来井口伏击' }),
      R('沿检修梯下井搜索样品箱', 64,
        { loot: 'fuel_spot', lootCount: 1, lootMode: 'search', risk: 12, log: '井底样品箱回收完成' },
        { hp: -18, risk: 16, log: '磁轨突然启动，负伤脱离' }),
      R('沿磁悬侧梯上极光指挥塔', 70,
        { moveTo: 'aurora', goEvent: 'aurora_corridor', risk: 10, log: '从磁悬侧梯抵达指挥塔' },
        { hp: -14, risk: 14, log: '侧梯口遭警戒火力阻断' }, { need: { hpMin: 45 } }),
      S('沿井边通过磁悬舱', { risk: 5, log: '未启动磁轨设备' })
    ]),
  E('maglev_ghost', 'maglev',
    '样品井底积着导电冷凝液，检修梯仍在轻晃，一名伏守者可能藏在磁轨阴影下。', [
      C('向阴影区域压制射击', 64,
        { loot: 'crate', lootCount: 1, risk: 16, log: '伏守者被逼出磁轨阴影' },
        { hp: -26, risk: 22, log: '射击方向错误，位置反被锁定' }, { rounds: 30, armor: 4 }),
      R('直接下井抢收样品箱', 55,
        { loot: 'fuel_spot', lootCount: 1, lootMode: 'search', risk: 14, log: '样品箱到手后迅速离井' },
        { hp: -24, risk: 20, log: '伏守者从检修梯后发动攻击' }),
      S('不下井，沿外环绕行', { risk: 4, log: '放弃样品井资产' })
    ]),
  E('maglev_bait', 'maglev',
    '磁悬吊台的启动声能传遍内环，有人会把它当成争夺井底密封柜的信号。', [
      C('空启吊台，守住井口等待来队', 54,
        { loot: 'crate', lootCount: 2, risk: 22, log: '吊台诱饵引来一支携货队' },
        { hp: -38, risk: 26, log: '诱来的是完整突击组' }, { rounds: 45, armor: 5 }),
      R('正常下井回收密封柜', 58,
        { loot: 'core_vault', lootCount: 2, risk: 18, log: '吊台运行期间无人接近' },
        { hp: -22, risk: 22, log: '吊台声引来井口封锁' }),
      S('关闭吊台电源，安静离开', { risk: 4, log: '未制造磁悬舱噪声' })
    ]),
  E('maglev_late', 'maglev',
    '磁悬舱的井底密封柜已经敞开，井边只剩一只尚未被检查完整的背包。', [
      R('下井检查遗留背包', 64,
        { loot: 'crate', lootCount: 1, lootMode: 'body', risk: 14, log: '背包夹层仍有一件资产' },
        { hp: -20, risk: 20, log: '检查途中井口出现敌人' }),
      R('先观察井口与吊台十秒', 74,
        { risk: 6, log: '确认磁悬舱暂时无人' },
        { hp: -14, risk: 16, log: '观察方向错误，侧后遭袭' }),
      S('不看空柜，向撤收线移动', { risk: 3, log: '离开已清空的磁悬舱' })
    ], { phase: 'late' }),

  E('core_storm', 'storm',
    '风暴庭院暴露在极夜气流中，灰潮指挥官“霜鸦”带两台履带哨机巡查避风墙之间的通路。', [
      R('借避风墙分段击破霜鸦', 48,
        { loot: 'boss', lootCount: 2, risk: 28, log: '霜鸦与指挥缓存被北辰回收署接管' },
        { hp: -46, risk: 32, log: '暴露节奏失误，重装射击击穿掩体' },
        { rounds: 100, armor: 5, medal: 'boss', need: { hpMin: 45 } }),
      R('在观风室确认她的巡逻周期', 78,
        { risk: 5, log: '记录霜鸦与哨机巡逻间隙' },
        { hp: -13, risk: 15, log: '观风窗反光暴露了位置' }),
      S('沿庭院外墙绕行', { risk: 4, log: '避开霜鸦巡逻区' })
    ]),
  E('core_takeover', 'storm',
    '避风墙转角，一名重型护板的灰潮回收者背对着你破解资产箱，设备噪声覆盖了脚步。', [
      C('贴近后方快速制服并接管装备', 55,
        { gearMod: 6, loot: 'core_vault', lootCount: 2, risk: 20, log: '重甲与资产箱一并接管' },
        { hp: -44, risk: 26, log: '对方提前从反射面发现靠近动作' },
        { rounds: 30, armor: 6, backstab: true, medal: 'takeover' }),
      R('抛出医疗包示意互不交火', 72,
        { risk: 4, log: '双方保持距离，各自离开' },
        { hp: -20, risk: 18, log: '对方没有接受停火信号' }),
      S('安静退回上一道避风墙', { risk: 5, log: '未惊动重甲回收者' })
    ]),
  E('storm_car', 'storm',
    '两台履带哨机分头巡过风暴庭院，中央气流使它们的传感器短暂失焦。', [
      R('集中火力击毁一台哨机', 58,
        { loot: 'core', lootCount: 1, risk: 18, log: '一台履带哨机停止运行' },
        { hp: -30, risk: 24, log: '哨机近防压住避风墙' }, { rounds: 55, armor: 5, medal: 'ai' }),
      R('利用传感器失焦穿过庭院', 70,
        { risk: 8, log: '借强风盲区通过哨机巡线' },
        { hp: -18, risk: 18, log: '气流提前减弱，哨机恢复锁定' }),
      S('等待下一轮巡逻间隙', { risk: 5, log: '在避风墙后等待哨机离开' })
    ]),
  E('storm_crossfire', 'storm',
    '两支队伍隔着避风墙交火，一边控制指挥塔升降梯，另一边守着内环捷径，双方都已出现伤员。', [
      C('等双方耗尽资源再接管战场', 50,
        { loot: 'crate', lootCount: 2, risk: 24, log: '两队残余资产被一并接管' },
        { hp: -42, risk: 28, log: '介入过早，遭双方同时压制' }, { rounds: 70, armor: 5 }),
      R('借交火声掩护进入极光指挥塔', 66,
        { moveTo: 'aurora', goEvent: 'aurora_corridor', risk: 14, log: '沿升降梯抵达指挥塔警戒层' },
        { hp: -20, risk: 20, log: '守梯队伍临时转火' }, { need: { hpMin: 45 } }),
      S('沿庭院边缘转入其他房间', { risk: 4, log: '借交火掩护离开庭院' })
    ]),

  E('core_tide', 'tide',
    '潮汐坞是灰潮水路指挥官“沉锚”的据点，内侧泵房由重甲护卫与自动炮台共同守卫。', [
      R('清除护卫并进入泵房指挥室', 42,
        { loot: 'boss', lootCount: 2, risk: 30, log: '沉锚与泵房指挥缓存被回收' },
        { hp: -52, risk: 34, log: '重甲护卫与炮台形成交叉火力' },
        { rounds: 130, armor: 6, medal: 'boss', need: { hpMin: 50 } }),
      R('远距离处理落单护卫', 66,
        { loot: 'crate', lootCount: 1, risk: 12, log: '落单护卫与随身缓存被回收' },
        { hp: -16, risk: 18, log: '射击引来泵房炮台压制' }, { rounds: 20, armor: 5, medal: 'ai' }),
      S('沿排水墙转入压缩机房', { goEvent: 'core_compressor', risk: 4, log: '离开潮汐坞前往压缩机房' })
    ]),
  E('tide_guard_box', 'tide',
    '一名重甲护卫背对排水渠检查货箱，他携带的泵房授权片能开启内侧指挥室。', [
      R('攻击腿部薄弱处并取得授权片', 62,
        { loot: 'crate', lootCount: 1, risk: 14, log: '重甲护卫倒下，泵房授权片到手' },
        { hp: -24, risk: 20, log: '护卫呼叫炮台支援' }, { rounds: 25, armor: 6, medal: 'ai' }),
      R('趁炮台转向抢开脚边货箱', 58,
        { loot: 'crate', lootCount: 1, lootMode: 'search', risk: 16, log: '货箱抢收成功' },
        { hp: -20, risk: 20, log: '箱锁延迟，炮台先完成转向' }),
      S('只搜潮汐坞外侧运输箱', { loot: 'thermal', lootCount: 1, risk: 5, log: '外侧运输箱回收一件资产' })
    ]),
  E('tide_anchor_gone', 'tide',
    '泵房枪声刚停，另一支队伍先一步击倒沉锚，指挥缓存仍在内侧门边，而胜者尚未走远。', [
      R('抢在胜者返回前检查指挥缓存', 60,
        { loot: 'boss', lootCount: 1, lootMode: 'body', risk: 22, log: '从指挥缓存取出一件高阶资产' },
        { hp: -30, risk: 26, log: '胜者从排水渠折返' }),
      C('用指挥缓存作诱饵截停胜者', 50,
        { loot: 'crate', lootCount: 2, risk: 24, log: '胜者弹药不足，资产被接管' },
        { hp: -44, risk: 28, log: '对方仍保持完整战力' }, { rounds: 60, armor: 5 }),
      S('刚结束交火的泵房不值得进入', { risk: 5, log: '绕开潮汐坞内侧' })
    ], { when: '!dockSeen' }),
  E('tide_boat', 'tide',
    '潮汐坞停着一艘冰下测量艇，甲板货箱尚未卸完，顶部吊架能观察两个入口。', [
      R('翻查测量艇甲板货箱', 72,
        { loot: 'crate', lootCount: 1, risk: 10, log: '甲板货箱回收一件资产' },
        { hp: -16, risk: 16, log: '甲板回声惊动泵房护卫' }),
      C('登上吊架控制潮汐坞入口', 56,
        { loot: 'crate', lootCount: 1, risk: 18, log: '吊架高位截击成功' },
        { hp: -26, risk: 22, log: '炮台锁定无掩体吊架' }, { rounds: 40, armor: 5 }),
      S('沿排水墙去压缩机房', { goEvent: 'core_compressor', risk: 4, log: '沿排水墙离开潮汐坞' })
    ]),

  E('core_pulse', null,
    '内环数据脊上仍插着一台暴风演算主机。它体积巨大且会持续发送防盗定位脉冲，携带后每一步都更易遭追踪。', [
      S('拆下暴风演算主机并承担定位暴露', { item: '暴风演算主机', risk: 20, log: '主机离架，定位脉冲开始广播' }),
      R('只拆外围运算模块', 72,
        { loot: 'core', lootCount: 1, risk: 8, log: '外围模块拆取完成，主机留在原位' },
        { risk: 12, log: '模块与主板焊死' }),
      S('不携带会广播位置的大件', { risk: 2, log: '放弃暴风演算主机' })
    ]),
  E('core_dogtag', null,
    '内环拐角有一枚北辰旧式行动牌，时间戳能判断附近交火发生在几分钟前。', [
      R('读取行动牌时间戳并回收', 82,
        { loot: 'thermal', lootCount: 1, risk: -4, log: '交火发生已久，周边风险下降' },
        { risk: 8, log: '时间戳就在刚才，胜者仍在附近' }),
      R('先观察行动牌周围的伏守痕迹', 74,
        { risk: 6, log: '确认附近暂时无人' },
        { hp: -16, risk: 16, log: '伏守者先一步开火' }),
      S('不触碰现场，绕道离开', { risk: 2, log: '保持现场原状' })
    ])
]

module.exports = { CORE_EVENTS }
