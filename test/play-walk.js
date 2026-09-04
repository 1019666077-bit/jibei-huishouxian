// 人工体验替身：按真机同一套场景走完首局，打印玩家会看到的内容。
const storage = {}
const ctx = new Proxy({
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', textAlign: '',
  globalAlpha: 1, shadowBlur: 0, shadowColor: '',
  measureText(text) { return { width: String(text || '').length * 8 } },
  createLinearGradient() { return { addColorStop() {} } }
}, { get(t, k) { return k in t ? t[k] : () => {} } })
const canvas = { width: 0, height: 0, getContext() { return ctx }, requestAnimationFrame(fn) { fn() } }
global.wx = {
  createCanvas() { return canvas },
  getWindowInfo() {
    return { windowWidth: 390, windowHeight: 844, pixelRatio: 2, safeArea: { left: 0, top: 44, right: 390, bottom: 810 } }
  },
  getStorageSync(k) { return storage[k] || null },
  setStorageSync(k, v) { storage[k] = v },
  removeStorageSync(k) { delete storage[k] },
  onTouchStart() {}, onTouchMove() {}, onTouchEnd() {}, onTouchCancel() {},
  onWindowResize() {}, onHide() {}, onShow() {},
  showModal() {}, showToast() {}, exitMiniProgram() {}
}

const { createGame } = require('../miniprogram/runtime/app')
const engine = require('../miniprogram/core/engine')
const manager = createGame({})
const issues = []
const log = []

function snap(title) {
  const s = manager.scene
  const line = { title, scene: manager.sceneName }
  if (manager.sceneName === 'run' && s.run) {
    const n = s.run.node || {}
    line.step = s.run.step
    line.hp = s.run.hp
    line.meds = s.run.meds
    line.risk = s.run.risk
    line.zone = s.run.zone
    line.hud = engine.getRunMeta(s.run).zoneName + ' · ' + engine.getRunMeta(s.run).phase
    line.node = n.id
    line.text = String(n.text || '').slice(0, 80)
    line.options = (n.options || []).map(o => ({
      t: o.text.slice(0, 36),
      disabled: !!o.disabled,
      chance: o.chance,
      safe: !!o.safe,
      cost: o.costText || ''
    }))
    line.loot = (s.run.loot || []).map(i => i.name)
    line.msg = (s.messages || [])[0]
    if (!(n.options || []).some(o => !o.disabled)) issues.push(`step ${s.run.step} ${n.id} 没有可点选项`)
    if (n.text && n.text.length > 18 && !n.revealItem) issues.push(`长文案 ${n.id} ${n.text.length}字`)
    if ((n.options || []).some(o => String(o.verb || o.text || '').length > 8)) issues.push(`长按钮 ${n.id}`)
    if (!s.run.zone) issues.push('HUD 不知道自己在哪个区（zone 空）')
  }
  if (manager.sceneName === 'report' && s.report) {
    line.escaped = s.report.escaped
    line.rating = s.report.rating
    line.value = s.report.totalValue
    line.titleText = s.report.escaped ? '活着出来了' : '没能回来'
  }
  log.push(line)
}

snap('冷启动')
manager.scene.scroll.offset = manager.scene.scroll.max
manager.scene.accept()
snap('同意后大厅')
manager.scene.start()
snap('出发第一屏')

let guard = 0
while (manager.sceneName === 'run' && guard++ < 40) {
  const scene = manager.scene
  const n = scene.run.node
  const playable = n.options.filter(o => !o.disabled)
  // 首屏优先砸柜，后面优先非稳妥的第一条，模拟想玩的人
  let pick = playable[0]
  if (n.id === 'opener_fog') pick = playable.find(o => /砸/.test(o.verb || o.text)) || pick
  scene.busy = false
  scene.pick(pick.idx)
  snap(`点「${pick.text.slice(0, 18)}」后`)
}

console.log(JSON.stringify({ issues, screens: log }, null, 2))
if (manager.scene && manager.scene.leave) manager.scene.leave()
if (manager.sceneName === 'index' && manager.scene.leave) manager.scene.leave()
