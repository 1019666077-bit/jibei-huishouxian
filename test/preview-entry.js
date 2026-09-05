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
    run.step = 3
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
        { idx: 0, text: '冲过去砸开柜子', verb: '砸柜', chance: 72, full: '冲过去砸开柜子' },
        { idx: 1, text: '对着呼吸声开枪', verb: '开枪', chance: 48, rounds: 30, full: '对着呼吸声开枪' },
        { idx: 2, text: '不碰，贴墙撤', verb: '撤', safe: true, chance: 100, full: '不碰，贴墙撤' },
        { idx: 3, text: '搜角落工具堆', verb: '搜', safe: true, chance: 100, full: '搜角落工具堆' }
      ]
    }
    scene.placeActor(run.node)
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
  })

  shot('report', '结算', manager => {
    storage.last_report = {
      escaped: true,
      rating: 'A',
      methodText: '货运雪橇',
      loadoutName: '标准勤务组',
      totalValue: 5120000,
      netProfit: 4800000,
      causeChain: ['沿冻港西堤推进', '带出零号资产柜'],
      retryPlans: [{ id: 'p1', title: '再走冻港补给线', goal: '先装箱再上塔', loadout: 'half' }],
      lootItems: [makeItem('北辰零号晶核')],
      lostItems: [],
      medals: [
        { name: '归航标·A', desc: '活着回到回收署', tier: 'gold' },
        { name: '零号见证', desc: '带出北辰零号晶核', tier: 'red' }
      ]
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
