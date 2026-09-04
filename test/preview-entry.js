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
  setup(manager)
  manager.render()
}

document.addEventListener('DOMContentLoaded', () => {
  shot('legal', '协议', () => {})

  shot('index', '大厅', manager => {
    manager.scene.scroll.offset = manager.scene.scroll.max
    manager.scene.accept()
  })

  shot('run', '局内现场', manager => {
    manager.scene.scroll.offset = manager.scene.scroll.max
    manager.scene.accept()
    manager.go('run')
  })

  shot('bag', '背包', manager => {
    manager.scene.scroll.offset = manager.scene.scroll.max
    manager.scene.accept()
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
    manager.scene.scroll.offset = manager.scene.scroll.max
    manager.scene.accept()
    const meta = metaStore.load()
    meta.runs = 4
    meta.escapes = 2
    meta.balance = 860000
    metaStore.save(meta)
    manager.go('codex')
  })
})
