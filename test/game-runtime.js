// 微信小游戏 Canvas 运行时冒烟：首启协议、本地行动、清档与固定广告奖励。
// 不依赖开发者工具，用最小 wx/Canvas mock 验证场景和存储链路。
const assert = require('assert')

const storage = {}
const events = {}
let modalConfirm = true
let exited = false
let pageScroll = 240
global.window = {
  scrollY: 240,
  scrollTo(x, y) {
    pageScroll = typeof x === 'object' ? (x.top || 0) : (y || 0)
    global.window.scrollY = pageScroll
  }
}

const ctx = new Proxy({
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', textAlign: '',
  globalAlpha: 1, shadowBlur: 0, shadowColor: '',
  measureText(text) { return { width: String(text || '').length * 8 } },
  createLinearGradient() { return { addColorStop() {} } },
  createRadialGradient() { return { addColorStop() {} } }
}, { get(t, k) { return k in t ? t[k] : () => {} } })
const canvas = {
  width: 0,
  height: 0,
  getContext() { return ctx },
  requestAnimationFrame(fn) { fn() },
  scrollIntoView() { pageScroll = 0; global.window.scrollY = 0 }
}

global.wx = {
  createCanvas() { return canvas },
  getWindowInfo() {
    return {
      windowWidth: 390, windowHeight: 844, pixelRatio: 2,
      safeArea: { left: 0, top: 44, right: 390, bottom: 810 }
    }
  },
  getStorageSync(key) { return storage[key] || null },
  setStorageSync(key, value) { storage[key] = value },
  removeStorageSync(key) { delete storage[key] },
  onTouchStart(fn) { events.touchStart = fn },
  onTouchMove(fn) { events.touchMove = fn },
  onTouchEnd(fn) { events.touchEnd = fn },
  onTouchCancel(fn) { events.touchCancel = fn },
  onWindowResize(fn) { events.resize = fn },
  onHide(fn) { events.hide = fn },
  onShow(fn) { events.show = fn },
  showModal(options) {
    options.success({ confirm: modalConfirm, cancel: !modalConfirm })
  },
  showToast() {},
  exitMiniProgram() { exited = true }
}

const { createGame } = require('../miniprogram/runtime/app')
const ads = require('../miniprogram/utils/ads')
const present = require('../miniprogram/runtime/present')

// 首次启动必须停在协议页，不能在用户确认前直接进大厅
const manager = createGame({ adUnitId: '' })
assert.strictEqual(manager.sceneName, 'legal', '首次启动没有先展示协议与隐私')
assert.strictEqual(manager.scene.firstUse, true, '协议页没有进入首次确认模式')
assert.ok(manager.scene.scroll.max > 0, '协议正文没有超出一屏，滚轮/下滑无从验证')
const beforeWheel = manager.scene.scroll.offset
assert.ok(manager.wheel(160, { x: 200, y: 360 }), '协议页滚轮没有推动 Scroll')
assert.ok(manager.scene.scroll.offset > beforeWheel, '协议页滚轮没有改变偏移')
assert.ok(!manager.scene.canAccept(), '只滚了一段不应立刻允许同意')
manager.scene.accept()
assert.strictEqual(manager.sceneName, 'legal', '未读完协议不应进入大厅')
manager.scene.scroll.offset = manager.scene.scroll.max
manager.scene.accept()
assert.strictEqual(manager.sceneName, 'index', '读完并同意后没有进入大厅')
assert.strictEqual(storage.legal_consent_v1.version, 6, '协议确认没有写入当前条款版本')

// 一局完整链路：选择能买得起的装备，之后始终选第一个可用项，必须进入本地战报
pageScroll = 240
global.window.scrollY = 240
manager.go('run')
assert.strictEqual(pageScroll, 0, '进入局内后页面滚动没有回到顶部，HUD会被顶出视野')
assert.ok(manager.scene.run.loadout, '出发后仍停在战备选择')
assert.strictEqual(manager.scene.run.node.id, 'opener_fog', '首局没有进入雾中短戏')
assert.ok(present.useRoom(manager.scene.run.node), '首局现场没有走进房间')
assert.ok(present.layoutRoom(manager.scene.run.node, { x: 0, y: 0, w: 100, h: 100 }).some(item => item.kind === 'crate'), '首局房间没有柜子')
assert.ok(manager.scene.run.node.text.length <= 16, '首局场景仍是长段说明')
assert.ok(manager.scene.run.node.options.every(item => (item.verb || item.text).length <= 8), '首局选项没有收成短动词')
assert.strictEqual(manager.scene.run.cost, 0, '首局进场不该扣押金')
assert.ok(manager.scene.messages.some(line => /合闸/.test(line)), '首局进场没有合闸目标')
assert.ok(present.leverGuide(manager.scene.run).includes('冷却舱'), '首局现场没有合闸条')
assert.ok(present.leverNudge(manager.scene.run), '首局没有提前催合闸')
assert.ok(!manager.scene.juice, '进场印章不得伪装合闸成功')
{
  const runMeta = require('../miniprogram/core/engine').getRunMeta(manager.scene.run)
  assert.strictEqual(present.bagLoadText(manager.scene.run, runMeta), `${runMeta.loadGrids}/${manager.scene.run.capacity}格`)
  assert.ok(present.extractCue(manager.scene.run).includes('2/2'))
  manager.scene.goExtract()
  assert.ok(manager.scene.juice, '锁撤离应给顶栏说明，不能静默')
  assert.ok(/第3步|还早/.test(manager.scene.juice.label + manager.scene.juice.sub), '开局点撤离应说明第3步')
  assert.ok(manager.scene.juice.kind === 'extract', '锁撤离说明不得伪装合闸成功')
  manager.scene.juice = null
}
const meta = require('../miniprogram/core/meta')
assert.ok(!storage.meta_v1 || storage.meta_v1.balance === meta.START_BALANCE, '首局尚未结算却已扣仓库')
let guard = 0
while (manager.sceneName === 'run' && guard++ < 100) {
  const scene = manager.scene
  const option = scene.run.node.options.find(item => !item.disabled)
  assert.ok(option, `第 ${scene.run.step} 步没有可用选项`)
  scene.busy = false
  scene.pick(option.idx)
}
assert.ok(guard < 100, '完整行动超过 100 次选择仍未结算')
assert.strictEqual(manager.sceneName, 'report', '行动结束后没有进入本地战报')
assert.ok(storage.last_report, '行动结束后没有保存最近战报')
assert.ok(storage.meta_v1 && storage.meta_v1.runs >= 1, '行动结算没有更新本地仓库')
if (!storage.last_report.escaped) {
  assert.strictEqual(storage.meta_v1.balance, meta.START_BALANCE, '首局阵亡把押金扣了')
}

// 合闸引导：进冷却舱要出短教学，避免两局都看不见合闸
{
  manager.go('run')
  const scene = manager.scene
  scene.run.zone = 'core'
  scene.run.levers = 0
  scene.run.node = {
    id: 'teach_lever',
    type: 'event',
    room: 'coolant',
    options: [{ idx: 0, verb: '合闸', text: '合上冷却舱配电柄', safe: true }]
  }
  scene.teach()
  assert.ok(scene.messages.some(line => /合闸/.test(line)), '进冷却舱没有合闸教学')
  assert.ok(present.leverGuide(scene.run).includes('合闸'), '冷却舱现场没有合闸教学条')
  assert.ok(present.leverPath(scene.run).includes('索道'), '合闸条没有指向索道')
  assert.ok(scene.lessonOpen, '首次合闸没有强制短教学')
  scene.dismissLesson()
  assert.ok(!scene.lessonOpen, '短教学不能关掉')
  assert.ok(storage.lesson_cable_v1, '短教学没有记下已看过')
}

{
  manager.go('run')
  const scene = manager.scene
  scene.run.zone = 'core'
  scene.run.levers = 2
  scene.run.node = {
    id: 'teach_cable',
    type: 'escape',
    options: [{ idx: 0, method: 'heli', verb: '索道', text: '启动极地索道' }]
  }
  scene.hintedLever = true
  scene.hintedCore = true
  scene.hintedCable = false
  scene.teach()
  assert.ok(scene.messages.some(line => /索道/.test(line)), '双电源后没有索道教学')
  assert.ok(present.leverGuide(scene.run).includes('索道'), '撤离页没有索道高亮提示')
  scene.flashJuice('ok', '入匣')
  assert.ok(scene.juice && scene.juice.kind === 'ok', '入匣没有即时对错标')
  scene.flashJuice('bad', '装不下')
  assert.ok(scene.juice && scene.juice.kind === 'bad', '装箱失败没有即时对错标')
  scene.flashJuice('ok', '入手', { silent: true })
  assert.ok(scene.juice && scene.juice.label === '入手', '拾取没有即时对错标')
  scene.flashJuice('bad', '失手', { silent: true })
  assert.ok(scene.juice && scene.juice.label === '失手', '交火失败没有即时对错标')
}

{
  manager.go('run')
  const scene = manager.scene
  scene.run.zone = 'harbor'
  scene.run.levers = 0
  scene.run.step = 4
  scene.run.node = {
    id: 'teach_late',
    type: 'event',
    options: [
      { idx: 0, text: '沿运冰线去热能管廊', verb: '管廊', moveTo: 'thermal' }
    ]
  }
  scene.teach()
  assert.ok(scene.messages.some(line => /冷却舱|压缩机/.test(line)), '长时间0合闸没有补提示')
  assert.ok(present.leverGuide(scene.run).includes('冷却舱'), '外围残局没有合闸目标条')
  assert.ok(present.leverNudge(scene.run), '外围残局没有合闸催促')
  const look = scene.optionLook({ idx: 1, text: '刷门进内环', verb: '刷门', moveTo: 'core' })
  assert.strictEqual(look.label, '内环', '迟到催促没有把进内环标成目标')
  assert.ok(look.highlight, '迟到催促没有高亮内环选项')
}

// 设置页清档必须连协议确认和广告记录一起清除
storage.ad_reward_v1 = { day: 'x', claimed: true, stock: 1 }
storage.retry_preset = { loadout: 'half' }
manager.go('settings')
modalConfirm = true
manager.scene.clearAll()
for (const key of ['meta_v1', 'last_report', 'last_rid', 'retry_preset', 'ad_reward_v1', 'legal_consent_v1', 'lesson_cable_v1']) {
  assert.strictEqual(storage[key], undefined, `一键清档漏掉 ${key}`)
}
assert.strictEqual(manager.sceneName, 'legal', '清档后没有立刻回到协议确认')
assert.strictEqual(manager.scene.firstUse, true, '清档后协议页不是强制确认模式')

// 不同意首启协议时应退出
manager.go('legal', { firstUse: true })
manager.scene.decline()
assert.strictEqual(exited, true, '拒绝协议没有退出小游戏')

// 激励视频：提前关闭不发奖，完整观看只发固定 1 份，且同日不可重复
let closeHandler = null
const video = {
  onClose(fn) { closeHandler = fn },
  offClose() {},
  onError() {},
  offError() {},
  show() { return Promise.resolve() },
  load() { return Promise.resolve() }
}
wx.createRewardedVideoAd = () => video

async function testAds() {
  ads.configure('adunit-test')
  const early = ads.show().then(
    () => assert.fail('提前关闭视频却发了奖励'),
    error => assert.ok(error.message.includes('完整看完'), '提前关闭的错误说明不清楚')
  )
  closeHandler({ isEnded: false })
  await early
  assert.strictEqual(ads.status().stock, 0, '提前关闭视频后库存增加')

  const completed = ads.show()
  closeHandler({ isEnded: true })
  const reward = await completed
  assert.deepStrictEqual(reward, { medical: 1 }, '完整观看没有发固定医疗奖励')
  assert.strictEqual(ads.status().stock, 1, '完整观看后奖励库存不是 1')
  await assert.rejects(() => ads.show(), /今日医疗补给已领取/, '同日可以重复领取广告奖励')
  assert.strictEqual(ads.consumeMedicalSupply(), 1, '下一局没有消费医疗奖励')
  assert.strictEqual(ads.status().stock, 0, '医疗奖励消费后仍留在库存')
}

testAds().then(() => {
  console.log('小游戏运行时自检通过：首启协议/完整行动/本地结算/一键清档/固定广告奖励全部正确')
}).catch(error => {
  console.error(error)
  process.exitCode = 1
})
