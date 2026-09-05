// 画面层冒烟：绘制函数可在无真实 Canvas 时跑完，选项主文案不再只剩短动词。
const assert = require('assert')
const present = require('../miniprogram/runtime/present')
const stage = require('../miniprogram/runtime/stage')
const { UI } = require('../miniprogram/runtime/ui')

const ctx = new Proxy({
  fillStyle: '', strokeStyle: '', lineWidth: 1, font: '', textBaseline: '', textAlign: '',
  globalAlpha: 1, shadowBlur: 0, shadowColor: '',
  measureText(text) { return { width: String(text || '').length * 8 } },
  createLinearGradient() { return { addColorStop() {} } },
  createRadialGradient() { return { addColorStop() {} } }
}, { get(t, k) { return k in t ? t[k] : () => {} } })

const Scroll = require('../miniprogram/runtime/scroll')
const scroll = new Scroll()
scroll.setBounds(400, 100)
assert.strictEqual(scroll.wheel(80), true)
assert.strictEqual(scroll.offset, 80)
assert.ok(!scroll.atEnd())
assert.ok(scroll.progress() > 0)
scroll.wheel(1000)
assert.ok(scroll.atEnd())

assert.strictEqual(present.verb({ verb: '砸柜', text: '冲过去砸开柜子' }), '砸柜')
assert.strictEqual(present.caption({ verb: '砸柜', text: '冲过去砸开柜子', full: '冲过去砸开柜子' }), '冲过去砸开柜子')
assert.ok(present.caption({ verb: '撤', text: '不碰，贴墙撤', full: '不碰，贴墙撤' }).includes('不碰'))
assert.ok(present.caption({ verb: '重装', text: '重装回收组 · 45万配给点' }).includes('重装回收组'))
assert.ok(present.caption({ verb: '砸柜', full: '冲过去砸开柜子' }).length > 2)
assert.strictEqual(present.ZONE_SHORT.extract, '撤离')
assert.ok(present.clip('这是一段超过十六个字的转移选项标题', 16).endsWith('…'))
assert.ok(present.clip('短标', 16) === '短标')
assert.ok(present.useOptionList({ options: [1, 2, 3, 4] }))
assert.ok(!present.useOptionList({ options: [1, 2, 3] }))
{
  const packed = present.layoutRoom({
    options: [
      { text: '砸开柜子', verb: '砸柜' },
      { text: '贴墙撤', verb: '撤', safe: true },
      { text: '开火', verb: '开火', rounds: 20 },
      { text: '搜角落', verb: '搜', safe: true }
    ]
  }, { x: 0, y: 0, w: 320, h: 220 })
  const overlap = packed.some((a, i) => packed.slice(i + 1).some(b =>
    Math.abs(a.x - b.x) < 70 && Math.abs(a.y - b.y) < 36
  ))
  assert.ok(!overlap, '四选项房间铭牌仍严重重叠')
}

const box = { x: 0, y: 0, w: 320, h: 180 }
;['harbor', 'weather', 'thermal', 'lift', 'core', 'aurora', 'extract'].forEach(zone => {
  stage.drawZone(ctx, zone, box, 4)
  stage.drawRoom(ctx, zone, { x: 0, y: 0, w: 320, h: 400 }, 3)
})
stage.drawCity(ctx, { x: 0, y: 0, w: 360, h: 220 }, { current: 'harbor', tick: 5, reachable: { harbor: true, thermal: true } })
stage.drawCity(ctx, { x: 0, y: 0, w: 360, h: 100 }, { current: 'core', compact: true, tick: 2 })
stage.drawItemIcon(ctx, 10, 10, 22, { name: '北辰零号晶核', tier: 'red' })
stage.drawItemIcon(ctx, 40, 10, 22, { name: '气压逻辑板', tier: 'blue' })
stage.drawMedal(ctx, 10, 40, 36, { tier: 'gold', name: '归航标' })
stage.drawKit(ctx, 10, 80, 20, 'full')
stage.drawProp(ctx, 'crate', 80, 120, true, 2, false)
stage.drawProp(ctx, 'threat', 140, 120, true, 2, true)
stage.drawPad(ctx, 'heli', 200, 120, true, false)
stage.drawActor(ctx, 160, 160, 3, { facing: 1, walking: true })

const ui = new UI(ctx)
ui.begin({
  width: 390, height: 844,
  safe: { left: 0, top: 44, right: 390, bottom: 810 }
})
ui.panel(10, 10, 200, 40, { accent: '#65d6b4' })
ui.meter(10, 60, 160, '生命', 72, 0.72)
ui.chip(10, 100, 64, 24, '弹 120')
ui.section(10, 140, 200, '路线')
ui.button(10, 180, 120, 40, '出发', () => {}, { sub: '标准勤务组' })
ui.text('这是一段会被窄板裁切的长标题文字', 10, 230, 12, '#fff', '700', 48)
assert.ok(String(ctx.fillStyle || '#fff'))
{
  let scrolled = 80
  global.window = { scrollTo() { scrolled = 0 } }
  Scroll.resetView({ scrollIntoView() { scrolled = 0 } })
  assert.strictEqual(scrolled, 0, '进局滚动重置没有把页面拉回顶部')
}

assert.ok(typeof stage.drawItemIcon === 'function')
assert.ok(typeof stage.drawMedal === 'function')
console.log('画面层自检通过：场景/图标/选项主文案均可绘制')
