// 浏览器预览：用真实 scene 模块画出现行画面。仅本地预览，不进发布包。
const { createGame } = require('../miniprogram/runtime/app')
const { makeItem } = require('../miniprogram/data/items')
const metaStore = require('../miniprogram/core/meta')

const storage = {}

function viewport() {
  return {
    windowWidth: 390,
    windowHeight: 844,
    pixelRatio: 1,
    safeArea: { left: 0, top: 44, right: 390, bottom: 810 }
  }
}

function bindWx(canvas) {
  window.wx = {
    createCanvas() { return canvas },
    getWindowInfo: viewport,
    getStorageSync(k) { return storage[k] || null },
    setStorageSync(k, v) { storage[k] = v },
    removeStorageSync(k) { delete storage[k] },
    onTouchStart() {}, onTouchMove() {}, onTouchEnd() {}, onTouchCancel() {},
    onWindowResize() {}, onHide() {}, onShow() {},
    showModal() {}, showToast() {}, exitMiniProgram() {}
  }
}

function enterLobby(manager) {
  if (manager.sceneName === 'legal') {
    manager.scene.scroll.offset = manager.scene.scroll.max
    manager.scene.accept()
  }
}

function shot(id, title, setup) {
  const host = document.getElementById('shots')
  const wrap = document.createElement('figure')
  const canvas = document.createElement('canvas')
  canvas.width = 390
  canvas.height = 844
  canvas.style.width = '390px'
  canvas.style.height = '844px'
  const cap = document.createElement('figcaption')
  cap.textContent = title
  wrap.appendChild(canvas)
  wrap.appendChild(cap)
  host.appendChild(wrap)
  bindWx(canvas)
  const manager = createGame({})
  try {
    setup(manager)
    manager.render()
  } catch (e) {
    cap.textContent = title + '（绘制失败）'
    console.error(id, e)
  }
}

document.addEventListener('DOMContentLoaded', () => {
  shot('legal', '协议', () => {})

  shot('index', '大厅', manager => {
    enterLobby(manager)
  })

  shot('index-nudge', '大厅合闸提示', manager => {
    storage.meta_v1 = Object.assign({}, metaStore.load(), { runs: 2, lastLoadout: 'half' })
    storage.last_report = { escaped: false, levers: 0, rating: 'D' }
    enterLobby(manager)
    if (manager.sceneName === 'index' && manager.scene.reload) manager.scene.reload()
  })

  shot('run', '局内现场', manager => {
    enterLobby(manager)
    manager.go('run')
  })

  shot('run-map', '双栏地图短铭牌', manager => {
    enterLobby(manager)
    manager.go('run')
    const scene = manager.scene
    const run = scene.run
    run.zone = 'harbor'
    run.step = 6
    run.node = {
      id: 'preview_split',
      type: 'event',
      text: '冻港西堤还能走',
      zone: 'harbor',
      options: [
        { idx: 0, text: '沿运冰线去热能管廊', verb: '管廊', moveTo: 'thermal', full: '沿运冰线去热能管廊' },
        { idx: 1, text: '沿货运环轨去轨道升降场', verb: '升降场', moveTo: 'lift', full: '沿货运环轨去轨道升降场' },
        { idx: 2, text: '刷通行芯片开启西堤气密门', verb: '刷门', moveTo: 'core', full: '刷通行芯片开启西堤气密门', costText: '可合闸' },
        { idx: 3, text: '只取门边维修箱', verb: '搜', safe: true, chance: 100, full: '只取门边维修箱' }
      ]
    }
    scene.messages = ['点右下撤离。']
    scene.placeActor(run.node)
  })

  shot('run-list', '四选项列表', manager => {
    enterLobby(manager)
    manager.go('run')
    const scene = manager.scene
    const run = scene.run
    run.zone = 'harbor'
    run.node = {
      id: 'preview_list',
      type: 'event',
      text: '雾里四条路',
      zone: 'harbor',
      options: [
        { idx: 0, text: '冲过去砸开冻港西堤的密封柜，把里面的低温匣带走', verb: '砸柜', chance: 72, full: '冲过去砸开冻港西堤的密封柜，把里面的低温匣带走' },
        { idx: 1, text: '对着货架后的呼吸声开枪，先打断这一波截击', verb: '开枪', chance: 48, rounds: 30, full: '对着货架后的呼吸声开枪，先打断这一波截击' },
        { idx: 2, text: '不碰柜子，贴墙从检修缝撤出这一层', verb: '撤', safe: true, chance: 100, full: '不碰柜子，贴墙从检修缝撤出这一层' },
        { idx: 3, text: '蹲下来搜角落工具堆，只取能装进回收匣的零件', verb: '搜', safe: true, chance: 100, full: '蹲下来搜角落工具堆，只取能装进回收匣的零件' }
      ]
    }
    scene.placeActor(run.node)
  })

  shot('run-lever', '合闸引导', manager => {
    enterLobby(manager)
    manager.go('run')
    const scene = manager.scene
    const run = scene.run
    run.zone = 'core'
    run.lastRoom = 'coolant'
    run.levers = 0
    run.leverRooms = { coolant: false, compressor: false }
    run.node = {
      id: 'preview_lever',
      type: 'event',
      room: 'coolant',
      text: '冷却舱蓝雾里能看见配电柄',
      zone: 'core',
      options: [
        { idx: 0, text: '打开旁边密封柜', verb: '开柜', chance: 68, full: '打开旁边密封柜' },
        { idx: 1, text: '对着雾里呼吸声开枪', verb: '开枪', chance: 46, rounds: 24, full: '对着雾里呼吸声开枪' },
        { idx: 2, text: '不碰配电柄，贴墙撤', verb: '撤', safe: true, chance: 100, full: '不碰配电柄，贴墙撤' },
        { idx: 3, text: '合上冷却舱配电柄（极地索道条件之一）', verb: '合闸', safe: true, chance: 100, full: '合上冷却舱配电柄（极地索道条件之一）' }
      ]
    }
    run.step = 2
    scene.messages = ['先合闸，再走索道']
    scene.hintedLever = true
    scene.hintedCore = true
    scene.placeActor(run.node)
  })

  shot('run-nudge', '合闸迟到提示', manager => {
    enterLobby(manager)
    manager.go('run')
    const scene = manager.scene
    const run = scene.run
    run.zone = 'harbor'
    run.step = 4
    run.levers = 0
    run.node = {
      id: 'preview_nudge',
      type: 'event',
      text: '冻港西堤还能走',
      zone: 'harbor',
      options: [
        { idx: 0, text: '沿运冰线去热能管廊', verb: '管廊', moveTo: 'thermal', full: '沿运冰线去热能管廊' },
        { idx: 1, text: '沿货运环轨去轨道升降场', verb: '升降场', moveTo: 'lift', full: '沿货运环轨去轨道升降场' },
        { idx: 2, text: '刷通行芯片开启西堤气密门', verb: '刷门', moveTo: 'core', full: '刷通行芯片开启西堤气密门' },
        { idx: 3, text: '只取门边维修箱', verb: '搜', safe: true, chance: 100, full: '只取门边维修箱' }
      ]
    }
    scene.messages = ['冷却舱·压缩机房可合闸']
    scene.hintedLate = true
    scene.placeActor(run.node)
  })

  shot('run-juice', '拾取与失手', manager => {
    enterLobby(manager)
    manager.go('run')
    const scene = manager.scene
    scene.pickup = makeItem('气压逻辑板')
    scene.pickupUntil = Date.now() + 60000
    scene.juice = { kind: 'ok', label: '入手', until: Date.now() + 60000 }
  })

  shot('bag', '背包', manager => {
    enterLobby(manager)
    manager.go('run')
    const core = manager.scene.run
    const a = makeItem('北辰零号晶核')
    const b = makeItem('气压逻辑板')
    a.lootId = 'L1'
    a.secured = true
    b.lootId = 'L2'
    b.secured = false
    core.loot = [a, b]
    manager.scene.bagOpen = true
    manager.scene.juice = { kind: 'ok', label: '入匣', until: Date.now() + 60000 }
  })

  shot('report', '结算', manager => {
    storage.last_report = {
      escaped: true,
      rating: 'A',
      methodText: '货运雪橇',
      loadoutName: '标准勤务组',
      totalValue: 5120000,
      netProfit: 4800000,
      wallet: { balanceAfter: 5600000 },
      causeChain: ['沿冻港西堤推进', '带出零号资产柜'],
      retryPlans: [{ id: 'p1', title: '再走冻港补给线', goal: '先装箱再上塔', loadout: 'half' }],
      lootItems: [makeItem('北辰零号晶核'), makeItem('气压逻辑板'), makeItem('远古冰芯样本')],
      lostItems: [],
      medals: [
        { name: '归航标·A', desc: '活着回到回收署', tier: 'gold' },
        { name: '零号见证', desc: '带出北辰零号晶核', tier: 'red' }
      ]
    }
    manager.go('report')
  })

  shot('report-fail', '失败结算', manager => {
    storage.last_report = {
      escaped: false,
      rating: 'C',
      methodText: '未能撤离',
      loadoutName: '标准勤务组',
      totalValue: 0,
      netProfit: -150000,
      causeChain: ['冷却舱交火失血，风险峰值被摸两次', '倒下时包里还剩 1 个医疗包没用'],
      retryPlans: [{ id: 'p2', title: '轻装再探冻港', goal: '少带少亏', loadout: 'knife' }],
      lootItems: [],
      lostItems: [],
      medals: [],
      wallet: { balanceAfter: 350000 }
    }
    manager.go('report')
  })

  shot('codex', '图鉴', manager => {
    enterLobby(manager)
    const meta = metaStore.load()
    meta.runs = 4
    meta.escapes = 2
    meta.balance = 860000
    metaStore.save(meta)
    manager.go('codex')
  })
})
