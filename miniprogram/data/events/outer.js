// 外围四区：冻港仓储区、气象塔群、热能管廊、轨道升降场。
const E = (id, zone, text, options, extra = {}) => ({ id, zone, ...extra, text, options })
const S = (text, success) => ({ text, safe: true, success })
const R = (text, base, success, fail, extra = {}) => ({ text, base, ...extra, success, fail })
const F = (text, base, success, fail, extra = {}) => R(text, base, success, fail, { ...extra, medal: extra.medal || 'pvp' })

const OUTER_EVENTS = [
  E('ind_assembly', 'thermal',
    '换热装配站的机械臂被冻结在半空，底座下方仍有一只保温资产匣；灰潮守备队的脚步正沿管廊接近。', [
      R('钻入机械臂底座拆取高热模块', 72,
        { loot: 'fuel_spot', lootCount: 1, risk: 10, log: '高热模块完成封装回收' },
        { hp: -15, risk: 16, log: '守备队堵住底座，突围时负伤' }),
      S('只取门边维修箱', { loot: 'thermal', lootCount: 1, risk: 4, log: '维修箱快速回收' })
    ]),
  E('ind_print', 'thermal',
    '材料打印站仍在吐出结霜零件，一名轻装拾荒者也从另一侧摸向成品槽。', [
      F('先控制成品槽和拾荒者', 65,
        { loot: 'thermal', lootCount: 2, risk: 15, log: '打印站交火获胜，成品槽归回收署' },
        { hp: -25, risk: 22, log: '狭窄槽道交火失利' }, { rounds: 25, armor: 0 }),
      R('等对方离开，只拆供热喷嘴', 78,
        { loot: 'fuel_spot', lootCount: 1, risk: 6, log: '供热喷嘴成功拆离' },
        { risk: 10, log: '喷嘴已过载报废' }),
      S('放弃争抢，退出打印站', { risk: 2, log: '保持静默离开打印站' })
    ]),
  E('ind_crane', 'thermal',
    '管廊吊运厅连接两条外围线路，高架货盘上散着运输匣，一支巡队正在蒸汽中穿行。', [
      F('锁住吊运厅入口截击巡队', 58,
        { loot: 'thermal', lootCount: 2, risk: 16, log: '吊运厅截击成功' },
        { hp: -22, risk: 20, log: '巡队火力压过吊架，行动失败' }, { rounds: 50, armor: 4 }),
      R('快速取走高架运输匣', 74,
        { loot: 'thermal', lootCount: 1, risk: 8, log: '高架运输匣回收完成' },
        { risk: 12, log: '货盘只剩空壳' }),
      S('借蒸汽错开巡队', { risk: 3, log: '利用蒸汽完成无接触转移' })
    ]),

  E('wt_hall', 'weather',
    '主气象塔底层散落着灾变前的观测箱，二层数据环仍在低功耗运行。', [
      R('清点底层观测箱并上二层拆数据环', 68,
        { loot: 'weather', lootCount: 2, risk: 12, log: '主塔上下层资产一并回收' },
        { hp: -14, risk: 18, log: '二层遭遇搜索队，带伤撤下' }),
      S('只取入口两侧便携仪器', { loot: 'weather', lootCount: 1, risk: 5, log: '入口仪器快速入包' })
    ]),
  E('wt_patrol', 'weather',
    '三名灰潮巡检兵封住通往覆冰连桥的走廊，他们的防寒护板在应急灯下反光。', [
      R('逐个击穿巡检兵阵位', 58,
        { loot: 'weather', lootCount: 1, risk: 20, log: '巡检组被清除，走廊恢复通行' },
        { hp: -28, risk: 26, log: '交叉火力逼退回收小队' }, { rounds: 35, armor: 3, medal: 'ai' }),
      R('藏进百叶校准室等他们通过', 80,
        { risk: 6, log: '巡检组从门外经过' },
        { hp: -12, risk: 14, log: '百叶片结冰异响暴露位置' }),
      S('抛出一件资产引开巡检组', { lootLose: 1, risk: 0, log: '巡检组被远处坠物声引开' })
    ]),
  E('wt_vault', 'weather',
    '二号气象塔的气压档案室藏着一只密封柜，外侧观测台能俯视两条外围道路。', [
      R('破解气压档案柜', 60,
        { loot: 'core_vault', lootCount: 2, risk: 15, log: '档案柜中的技术资产完成回收' },
        { hp: -15, risk: 18, log: '解锁声引来观测台守军' }),
      S('只翻记录桌并检查备用芯片槽', { loot: 'weather', lootCount: 1, cards: 1, risk: 5, log: '记录桌中找到一枚通行芯片' })
    ]),
  E('wt_bridge', 'weather',
    '覆冰连桥横跨主塔与研究城内环。桥面两端互相压制，薄冰下还传来结构断裂声。', [
      F('沿检修梁绕到两端火力侧后', 52,
        { loot: 'weather', lootCount: 2, risk: 20, log: '连桥两端的资产均被接管' },
        { hp: -28, risk: 24, log: '检修梁暴露在观测台射界内' }, { rounds: 70, armor: 4 }),
      R('释放白障罐，快速穿桥进入内环', 62,
        { moveTo: 'core', goEvent: 'entry_north', risk: 14, log: '白障掩护小队通过连桥' },
        { hp: -20, risk: 20, log: '侧风吹散白障，被迫退回桥头' }),
      S('搜索废弃桥控箱，等待交火结束', { loot: 'weather', lootCount: 1, risk: 5, log: '桥控箱中回收到一件部件' })
    ]),

  E('harbor_rooms', 'harbor',
    '三座低温仓库沿冻港排开，一号库传来翻动金属架的声音，医疗恒温箱也在那里。', [
      R('进入一号库抢收恒温物资', 66,
        { loot: 'harbor', lootCount: 2, meds: 1, risk: 12, log: '一号库物资和医疗模块入包' },
        { hp: -20, risk: 18, log: '货架间遭遇战后破窗脱离' }),
      S('转搜无人活动的三号库', { loot: 'harbor', lootCount: 1, risk: 4, log: '三号库安静回收一件资产' })
    ]),
  E('harbor_drone', 'harbor',
    '一架旧物流机卡在冷库屋脊，吊舱里还有补给；屋顶没有任何挡风与掩体。', [
      R('沿排水管爬上屋脊取吊舱', 62,
        { loot: 'harbor', lootCount: 1, lootMode: 'search', rounds: 90, meds: 1, risk: 14, log: '物流吊舱与补给回收完成' },
        { hp: -16, risk: 20, log: '屋脊遭远端射击，被迫放弃吊舱' }),
      S('标记坐标后离开', { risk: 3, log: '放弃暴露的物流吊舱' })
    ]),
  E('harbor_keyroom', 'harbor',
    '三号冷库的样本间本应双重闭锁，此刻一扇门虚掩，地上留着尚未结霜的脚印。', [
      R('进入样本间检查遗漏资产', 62,
        { loot: 'core', lootCount: 1, risk: 12, log: '样本间仍有一件高阶资产' },
        { hp: -16, risk: 18, log: '先到者守在门后' }),
      S('把虚掩门视为诱饵，直接离开', { risk: 3, log: '没有触碰可疑样本间' })
    ]),

  E('lift_pod', 'lift',
    '升降轨上坠下一只密封货舱，外壳仍在冒白汽，灰潮士兵正从两侧轨台合围。', [
      R('抢在合围前开启货舱', 60,
        { loot: 'fuel_spot', lootCount: 1, lootMode: 'search', risk: 15, log: '密封货舱资产抢收成功' },
        { hp: -22, risk: 20, log: '合围完成，只能空手突围' }),
      S('绕过货舱和合围线', { risk: 4, log: '从配重井旁绕开合围' })
    ]),
  E('lift_cache', 'lift',
    '升降架阴影中走出灰潮重装指挥官“白獠”，她带着护卫沿轨台推进。', [
      R('正面阻断白獠指挥组', 45,
        { loot: 'boss', lootCount: 2, risk: 28, log: '白獠指挥组被击破，指挥缓存全部接收' },
        { hp: -48, risk: 32, log: '重装火力迫使小队重伤撤离' },
        { rounds: 110, armor: 5, medal: 'boss', need: { hpMin: 45 } }),
      R('钻入配重检修沟避开指挥组', 80,
        { risk: 5, log: '指挥组从检修沟上方通过' },
        { hp: -15, risk: 16, log: '沟口撞上落单护卫' })
    ]),
  E('lift_span', 'lift',
    '轨道升降场的中央转运桥控制着撤收方向，一支灰潮狙击组已经用速凝挡板封住桥顶。', [
      F('沿轨枕反向攀上桥顶清除狙击组', 50,
        { loot: 'boss', lootCount: 1, risk: 20, log: '桥顶狙击组被清除' },
        { hp: -44, risk: 26, log: '侦察蜂发现攀爬路线，陷入高位压制' }, { rounds: 65, armor: 5 }),
      R('等待运输车经过，借车体分散火力', 68,
        { risk: 10, log: '借运输车掩护通过转运桥' },
        { hp: -22, risk: 18, log: '狙击火力仍锁定了小队' }),
      S('记下狙位，改走配重井', { risk: 8, log: '避开桥顶视线完成绕行' })
    ]),
  E('lift_tower', 'lift',
    '升降控制架的检修梯通往高层观察台，那里能看清撤收轨与内环门，却完全暴露在极夜风中。', [
      R('登上观察台并搜工具柜', 66,
        { loot: 'lift', lootCount: 1, risk: -4, log: '观察台确认全场动向并回收工具' },
        { hp: -26, risk: 16, log: '梯面结冰，滑坠造成重伤' }),
      F('把观察台当作临时射击位', 56,
        { loot: 'lift', lootCount: 1, risk: 16, log: '高位先手击退过路小队' },
        { hp: -30, risk: 22, log: '无掩体高台遭到反制' }, { rounds: 35, armor: 4 }),
      S('只扫控制架底层', { loot: 'lift', lootCount: 1, risk: 4, log: '底层工具堆回收一件' })
    ]),
  E('lift_container', 'lift',
    '配重箱在升降场堆成狭窄迷阵，每个转角都藏着盲区，箱体内却可能留有运输资产。', [
      R('逐排检查配重箱', 70,
        { loot: 'lift', lootCount: 2, risk: 12, log: '配重箱迷阵中回收两件资产' },
        { hp: -20, risk: 18, log: '盲角贴面遭遇，负伤退回' }),
      F('守住箱间缺口等待搜索者', 58,
        { loot: 'lift', lootCount: 1, risk: 16, log: '缺口伏击奏效' },
        { hp: -26, risk: 22, log: '对方从箱顶绕到背后' }, { rounds: 35, armor: 4 }),
      S('沿箱阵外缘绕行', { risk: 4, log: '不进入盲区密集的箱阵' })
    ]),
  E('lift_rat_hole', 'lift',
    '配重井下方有一条旧维护孔，通往应急回收台；孔口的新霜被人刚刚踩碎。', [
      R('沿新脚印进入维护孔', 64,
        { loot: 'crate', lootCount: 1, lootMode: 'body', risk: 14, log: '维护孔内发现一只遗落背包' },
        { hp: -22, risk: 20, log: '脚印主人仍在孔内伏击' }),
      F('守住孔口截停携带资产的撤收者', 54,
        { loot: 'crate', lootCount: 2, risk: 20, log: '孔口截击成功' },
        { hp: -32, risk: 24, log: '维护孔两端同时出现敌人' }, { rounds: 40, armor: 4 }),
      S('记录维护孔坐标后离开', { risk: 5, log: '已标记应急回收通道' })
    ]),
  E('lift_bag_taken', 'lift',
    '应急回收台亮着封闭提示：本轮唯一货运雪橇已经离站，只剩索道、风暴列车或借用他队撤收窗口。', [
      R('检查离站雪橇遗落物', 70,
        { loot: 'lift', lootCount: 1, closeBag: true, risk: 10, log: '回收台找到一件遗落资产' },
        { hp: -16, risk: 18, closeBag: true, log: '另一支迟到队伍守在回收台' }),
      F('留在回收台截停下一支迟到队', 56,
        { loot: 'crate', lootCount: 2, closeBag: true, risk: 20, log: '迟到队资产被接管' },
        { hp: -30, risk: 24, closeBag: true, log: '迟到的是完整灰潮班组' }, { rounds: 40, armor: 4 }),
      S('立刻转向其他撤收方式', { closeBag: true, risk: 4, log: '雪橇线路关闭，开始改道' })
    ], { phase: 'late' }),
  E('lift_drone', 'lift',
    '灰潮侦察蜂在升降场上空盘旋，它的热标会把小队位置送进守备网。', [
      R('击落侦察蜂', 74,
        { risk: 8, log: '侦察蜂坠毁，枪声同时暴露了方向' },
        { hp: -14, risk: 22, log: '射击落空，热标持续更久' }, { rounds: 20, armor: 0, medal: 'ai' }),
      R('躲入配重沟等待扫描结束', 78,
        { risk: -4, log: '热标在配重沟内丢失' },
        { hp: -12, risk: 16, log: '沟口仍被扫描光扫中' }),
      S('顶着热标迅速离开开阔轨台', { risk: 10, log: '快速穿过扫描区' })
    ]),

  E('wt_warden', 'weather',
    '主塔二层环廊能封锁覆冰连桥与塔间空地，现在高位空着，栏杆旁却留着新鲜弹壳。', [
      F('占据环廊截击连桥来队', 58,
        { loot: 'crate', lootCount: 2, risk: 20, log: '环廊高位截击成功' },
        { hp: -28, risk: 24, log: '桥对面早已瞄准环廊' }, { rounds: 45, armor: 4 }),
      R('先检查弹壳附近的遗留背包', 68,
        { loot: 'crate', lootCount: 1, lootMode: 'body', risk: 12, log: '环廊角落回收到遗留背包' },
        { hp: -18, risk: 18, log: '背包被当成诱饵' }),
      S('环廊过于醒目，转身下塔', { risk: 4, log: '放弃暴露的环廊高位' })
    ]),
  E('wt_server', 'weather',
    '气象运算室的机柜仍在低鸣，耐寒记录盘与气压逻辑板可以直接拆走，但机房只有一个出口。', [
      R('深入机房拆取两组数据件', 66,
        { loot: 'weather', lootCount: 2, risk: 14, log: '运算室数据件回收完成' },
        { hp: -20, risk: 20, log: '出口被搜索队封住' }),
      R('只拆门边机架', 78,
        { loot: 'weather', lootCount: 1, risk: 6, log: '门边机架回收一件' },
        { risk: 10, log: '外侧机架已被拆空' }),
      S('不进入单出口房间', { risk: 3, log: '绕开气象运算室' })
    ]),
  E('wt_card_room', 'weather',
    '三号塔的小型值班室可能保存备用通行芯片，抽屉已被翻开一半。', [
      R('彻底检查抽屉与芯片柜', 64,
        { cards: 1, loot: 'weather', lootCount: 1, risk: 10, log: '找到备用通行芯片' },
        { risk: 14, log: '芯片槽为空' }),
      S('只取桌面仪器', { loot: 'weather', lootCount: 1, risk: 4, log: '桌面仪器收入背包' }),
      F('先控制楼梯，再搜索芯片柜', 62,
        { cards: 1, loot: 'crate', lootCount: 1, risk: 16, log: '控制楼梯后取得通行芯片' },
        { hp: -24, risk: 22, log: '楼梯来队人数超出预估' }, { rounds: 30, armor: 4 })
    ]),
  E('wt_late_empty', 'weather',
    '回收终段的气象塔群已被拆得凌乱，空柜、断线和医疗包装铺满地面，只剩赶向撤收点的人还会经过。', [
      F('守住主塔大厅截停过路队', 56,
        { loot: 'crate', lootCount: 2, risk: 20, log: '过路队携带的资产被截获' },
        { hp: -28, risk: 24, log: '完整班组穿塔而过，守点失败' }, { rounds: 40, armor: 4 }),
      R('复查观测台背面的盲区', 72,
        { loot: 'weather', lootCount: 1, risk: 8, log: '盲区仍有一件遗漏资产' },
        { risk: 12, log: '塔群确已清空' }),
      S('离开空塔，前往覆冰连桥', { goEvent: 'wt_bridge', risk: 4, log: '不在空塔停留' })
    ], { phase: 'late' }),

  E('harbor_roof', 'harbor',
    '冷库屋顶排列着平流层接收环，其中一台仍保持锁定姿态；拆卸需要在横风中暴露数十秒。', [
      R('登顶拆取接收环', 62,
        { loot: 'core_vault', lootCount: 1, lootMode: 'search', risk: 16, log: '接收环完成拆卸封装' },
        { hp: -24, risk: 22, log: '横风与远端火力迫使拆卸中止' }),
      R('先在楼梯间监听，再登顶取小件', 76,
        { loot: 'harbor', lootCount: 1, risk: 8, log: '确认屋顶安全并回收一件小型模块' },
        { hp: -14, risk: 16, log: '屋顶已有伏守者' }),
      S('放弃大件接收环', { risk: 3, log: '不为大件暴露在屋顶' })
    ]),
  E('harbor_balcony', 'harbor',
    '二号冷库外廊正对西堤气密门，门机启动时目标会短暂暴露。', [
      F('控制外廊，截击下一支开门队', 60,
        { loot: 'harbor', lootCount: 2, risk: 18, log: '气密门前截击成功' },
        { hp: -26, risk: 22, log: '开门队预先清扫了外廊' }, { rounds: 40, armor: 4 }),
      R('只观察气密门状态', 80,
        { risk: -4, log: '确认西堤路线暂时无人' },
        { risk: 8, log: '风雪遮住了门机灯号' }),
      S('搜索外廊货架后离开', { loot: 'harbor', lootCount: 1, risk: 4, log: '外廊货架回收一件资产' })
    ]),
  E('harbor_medbay', 'harbor',
    '一号冷库的恒温救护间仍有医疗包和勤务弹箱，是冻港最可靠的补给节点。', [
      R('同时搬走医疗与弹药补给', 70,
        { meds: 2, rounds: 90, loot: 'harbor', lootCount: 1, risk: 12, log: '救护间补给完成' },
        { hp: -18, risk: 18, log: '与正在治疗的敌队贴面相遇' }),
      S('只取一组医疗模块', { meds: 1, risk: 5, log: '快速取得医疗模块' }),
      F('守住救护间截停补给者', 58,
        { loot: 'harbor', lootCount: 2, meds: 1, risk: 18, log: '补给者的资产被接管' },
        { hp: -26, risk: 22, log: '进入救护间的是清扫班组' }, { rounds: 35, armor: 4 })
    ]),
  E('harbor_early_rush', 'harbor',
    '极夜行动刚开始，三座冷库同时响起门机与货架碰撞声，各队都在争抢第一轮恒温物资。', [
      R('闯入一号库抢占主货架', 58,
        { loot: 'harbor', lootCount: 2, meds: 1, risk: 18, log: '抢先取得一号库主货架' },
        { hp: -26, risk: 24, log: '多队在货架间混战，小队被迫退出' }),
      F('卡住库间输送口等待搬运者', 56,
        { loot: 'harbor', lootCount: 2, risk: 20, log: '输送口截击成功' },
        { hp: -28, risk: 24, log: '满员小队强行通过输送口' }, { rounds: 45, armor: 4 }),
      S('关闭三号库灯光，等待第一波离开', { risk: -2, skipStep: true, log: '避开冻港开局混战' })
    ], { phase: 'early' }),

  E('ind_pipe', 'thermal',
    '蒸汽检修管是热能管廊切入内环的捷径，长直管壁会放大任何脚步与开火声。', [
      R('刷芯片开启气闸，释放蒸汽掩护进入冷却舱', 68,
        { moveTo: 'core', goEvent: 'core_coolant', risk: 10, log: '蒸汽掩护小队穿过检修管' },
        { hp: -18, risk: 18, moveTo: 'core', goEvent: 'core_coolant', log: '蒸汽提前散去，带伤进入冷却舱' },
        { cost: { card: 1 } }),
      F('守住管口截击持芯片的过路队', 58,
        { cards: 1, loot: 'crate', lootCount: 1, risk: 18, log: '管口截击后取得通行芯片' },
        { hp: -26, risk: 22, log: '管内涌出完整班组' }, { rounds: 40, armor: 4 }),
      S('只搜管口工具堆', { loot: 'thermal', lootCount: 1, risk: 4, log: '工具堆回收一件' })
    ]),
  E('ind_tank', 'thermal',
    '蓄热罐之间的单人检修槽保存着高温介质，但两端都可能被灰潮封锁。', [
      R('进入检修槽拆取介质罐', 70,
        { loot: 'fuel_spot', lootCount: 1, risk: 12, log: '高温介质罐完成回收' },
        { hp: -20, risk: 18, log: '检修槽两端同时出现敌人' }),
      R('爬上蓄热罐确认全场', 66,
        { loot: 'thermal', lootCount: 1, risk: -4, log: '罐顶确认管廊动线并回收一件' },
        { hp: -22, risk: 18, log: '罐顶结霜导致滑坠' }),
      S('沿蓄热区外缘绕行', { risk: 3, log: '避开单人检修槽' })
    ]),
  E('ind_zipline', 'thermal',
    '维护索横跨一段断裂管廊，悬挂者无法快速变向；索台边还有一只被遗忘的设备箱。', [
      R('翻设备箱，不上维护索', 76,
        { loot: 'thermal', lootCount: 1, risk: 6, log: '索台设备箱回收完成' },
        { risk: 10, log: '设备箱已被拆空' }),
      F('控制索台截停悬挂目标', 66,
        { loot: 'crate', lootCount: 1, risk: 16, log: '索台截击成功' },
        { hp: -22, risk: 20, log: '敌人从下层管廊反向包抄' }, { rounds: 25, armor: 4 }),
      S('放弃维护索，走地面保温通道', { risk: 3, log: '选择稳定地面线路' })
    ]),
  E('ind_scrap', 'thermal',
    '吊运厅外堆着废旧换热片和未拆运输箱，价值不高但回收风险也低。', [
      R('系统清点废料与运输箱', 80,
        { loot: 'thermal', lootCount: 2, risk: 6, log: '低风险回收两件资产' },
        { risk: 10, log: '可用部件均已冻裂' }),
      R('只开勤务弹箱', 74,
        { rounds: 60, loot: 'thermal', lootCount: 1, risk: 8, log: '弹药与一件设备入包' },
        { risk: 12, log: '弹箱早已清空' }),
      S('不为低值废料停留', { risk: 2, log: '继续沿管廊推进' })
    ])
]

module.exports = { OUTER_EVENTS }
