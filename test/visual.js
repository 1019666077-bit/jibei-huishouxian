// 画面层冒烟：绘制函数可在无真实 Canvas 时跑完，选项主文案不再只剩短动词。
const assert = require('assert')
const present = require('../miniprogram/runtime/present')
const stage = require('../miniprogram/runtime/stage')
const { UI, COLORS, TYPE, INK, METAL, wellLook, ctaLook } = require('../miniprogram/runtime/ui')

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
assert.ok(!/的…$/.test(present.clip('冷却舱配电柄的说明文字', 8)), '省略号前不应留虚字')
assert.ok(present.useOptionList({ options: [1, 2, 3, 4] }))
assert.ok(!present.useOptionList({ options: [1, 2, 3] }))
assert.ok(present.useOptionList({ id: 'opener_fog', options: [1, 2, 3] }), '首局三选项应走完整列表')
assert.ok(present.useTravelList({
  options: [
    { moveTo: 'thermal', verb: '管廊' },
    { moveTo: 'core', verb: '刷门' },
    { verb: '搜', safe: true }
  ]
}), '现场+转移应走列表而不是挤地图')
assert.ok(!present.useTravelList({
  options: [{ moveTo: 'thermal' }, { moveTo: 'core' }]
}))
assert.strictEqual(present.travelStripH(2), 88)
assert.ok(present.travelStripH(5) > present.travelStripH(2))
assert.strictEqual(present.travelLabel({ moveTo: 'core' }), '内环')
assert.ok(present.OPTION_ROW_H >= 76, '四选项行高仍偏矮')
assert.ok(present.plateText({ verb: '砸柜', text: '冲过去砸开柜子' }, { tone: 'loot', label: '搜刮' }).length <= 4)
assert.ok(!String(present.plateText({ verb: '砸柜', full: '冲过去砸开冻港西堤的密封柜' })).includes('冻港西堤'))
assert.ok(present.dangerPip({ rounds: 20, chance: 48 }))
assert.ok(!present.dangerPip({ safe: true, chance: 48, rounds: 20 }))
assert.ok(!present.dangerPip({ chance: 80, rounds: 20 }))
assert.ok(present.isLever({ verb: '合闸', text: '合上冷却舱配电柄' }))
assert.ok(present.isLever({ verb: '穿庭合闸' }))
assert.ok(!present.isLever({ verb: '撤', text: '不碰配电柄，贴墙撤' }))
assert.ok(present.isLeverHint({ costText: '芯片 · 可合闸', moveTo: 'core' }))
assert.ok(!present.isLeverHint({ moveTo: 'thermal', costText: '' }))
assert.ok(present.listTitle({ full: '合上冷却舱配电柄（极地索道条件之一）' }).includes('极地索道'))
assert.ok(present.listTitle({ full: '合上冷却舱配电柄（极地索道条件之一）' }).length > 16)
assert.ok(present.leverGuide({ zone: 'core', levers: 0, node: { options: [] } }).includes('合闸'))
assert.ok(present.leverGuide({ zone: 'core', levers: 0, node: { room: 'coolant', options: [{ verb: '合闸' }] } }).includes('合闸'))
assert.ok(present.leverGuide({ zone: 'core', levers: 2, node: { options: [] } }).includes('索道'))
assert.ok(present.leverGuide({ zone: 'extract', levers: 2, node: { type: 'escape', options: [{ method: 'heli' }] } }).includes('索道'))
assert.ok(present.leverPath({ levers: 0 }).includes('合闸'))
assert.ok(present.leverPath({ levers: 2 }).includes('索道'))
{
  const card = present.lesson({ levers: 0, node: { options: [{ verb: '合闸' }] } })
  assert.ok(card.steps.length === 3 && card.steps[0].label === '合闸')
  assert.ok(card.cue.includes('合闸'))
  assert.ok(present.shouldForceLesson({ levers: 0, node: { options: [{ verb: '合闸' }] } }, { taught: false }))
  assert.ok(!present.shouldForceLesson({ levers: 0, node: { options: [{ verb: '合闸' }] } }, { taught: true }))
  assert.ok(present.shouldForceLesson({ levers: 2, node: { options: [{ method: 'heli' }] } }, { taught: false }))
}
assert.ok(present.leverNudge({ levers: 0, step: 3 }))
assert.ok(!present.leverNudge({ levers: 0, step: 1 }))
assert.ok(!present.leverNudge({ levers: 1, step: 5 }))
assert.ok(present.leverNudge({ levers: 0, step: 0, tutorial: true }), '首局应从第0步催合闸')
assert.ok(present.leverNudge({ levers: 0, step: 0, openerId: 'opener_fog' }))
assert.ok(present.leverGuide({ zone: 'harbor', levers: 0, step: 4, node: { options: [] } }).includes('冷却舱'))
assert.ok(!present.leverGuide({ zone: 'harbor', levers: 0, step: 1, node: { options: [] } }))
assert.ok(present.leverGuide({ zone: 'harbor', levers: 0, step: 0, tutorial: true, node: { options: [] } }).includes('冷却舱'))
assert.ok(present.leverGuide({ zone: 'harbor', levers: 1, step: 5, node: { options: [] } }).includes('合闸'), '中盘 1/2 合闸仍应看见主线')
assert.ok(present.sceneLine({ full: '雾把灯吃了。柜后有人换气。' }).includes('雾把灯吃了'))
assert.ok(present.sceneLine({ full: '冲过去砸开冻港西堤的密封柜，把里面的低温匣带走' }).length > 16)
{
  const plate = present.fitBox({ x: -20, y: 10, w: 132, h: 56 }, { x: 0, y: 0, w: 320, h: 180 }, 8)
  assert.ok(plate.x >= 8 && plate.x + plate.w <= 312, '铭牌仍会贴边被裁')
  assert.ok(plate.y >= 8)
  const inset = present.fitBox({ x: -4, y: -4, w: 100, h: 40 }, { x: 0, y: 0, w: 200, h: 120 })
  assert.ok(inset.x >= 10 && inset.y >= 10, '默认安全内边距不够')
  assert.strictEqual(present.listFitH(3, 400), 3 * (present.OPTION_ROW_H + 8) - 8 + 16)
  assert.ok(present.listFitH(3, 200) <= 200, '三行列表仍可能溢出房间')
}
assert.ok(present.isLeverTarget({ moveTo: 'core' }))
assert.ok(present.isLeverTarget({ goEvent: 'core_coolant' }))
assert.ok(!present.isLeverTarget({ moveTo: 'thermal' }))
assert.ok(present.isCable({ method: 'heli' }))
assert.ok(!present.isCable({ method: 'bag' }))
assert.strictEqual(present.optionTone({ rounds: 20, verb: '开火' }), 'fight')
assert.strictEqual(present.optionTone({ safe: true, verb: '撤' }), 'safe')
assert.strictEqual(present.optionTone({ method: 'heli' }), 'extract')
assert.strictEqual(present.optionTone({ verb: '合闸' }), 'lever')
assert.strictEqual(present.toneLabel('fight'), '交火')
assert.ok(present.paceHint({ step: 1 }).includes('开局'))
assert.ok(present.paceHint({ step: 6 }).includes('还剩'))
assert.ok(present.stepChip({ step: 6 }).includes('还剩'))
assert.ok(present.toast(['点合闸开索道']).includes('合闸'))
assert.ok(present.toast(['内环可合闸开索道']).includes('合闸'))
assert.ok(present.toast(['电源已通，点索道']).includes('索道'))
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
  const tighter = packed.some((a, i) => packed.slice(i + 1).some(b =>
    Math.abs(a.x - b.x) < 90 && Math.abs(a.y - b.y) < 44
  ))
  assert.ok(!tighter, '房间道具槽位仍挤在一起')
}

{
  ;[{ w: 360, h: 220 }, { w: 360, h: 100 }].forEach(box => {
    const labels = present.cityLabelLayout({ x: 0, y: 0, w: box.w, h: box.h })
    assert.ok(labels.length >= 7, '城市标签数量不足')
    const clash = labels.some((a, i) => labels.slice(i + 1).some(b => present.boxesOverlap(a, b, 2)))
    assert.ok(!clash, `城市标签在 ${box.w}x${box.h} 仍重叠`)
  })
  const split = { x: 0, y: 0, w: 360, h: 124 }
  const pins = present.layoutPins({
    options: [
      { verb: '管廊', moveTo: 'thermal' },
      { verb: '刷门', moveTo: 'core', costText: '可合闸' }
    ]
  }, split, true)
  const plates = pins.map(pin => present.pinPlateBox(pin, split))
  const labels = present.cityLabelLayout(split, { skip: { core: true }, busy: plates })
  const clash = labels.some(lab => plates.some(plate => present.boxesOverlap(lab, plate, 2)))
  assert.ok(!clash, '双栏地图铭牌仍压着城市标签')
}

const box = { x: 0, y: 0, w: 320, h: 180 }
;['harbor', 'weather', 'thermal', 'lift', 'core', 'aurora', 'extract'].forEach(zone => {
  stage.drawZone(ctx, zone, box, 4)
  stage.drawRoom(ctx, zone, { x: 0, y: 0, w: 320, h: 400 }, 3)
})
stage.drawCity(ctx, { x: 0, y: 0, w: 360, h: 220 }, { current: 'harbor', tick: 5, reachable: { harbor: true, thermal: true }, target: 'core' })
stage.drawCity(ctx, { x: 0, y: 0, w: 360, h: 100 }, { current: 'core', compact: true, tick: 2, target: 'core' })
stage.drawJobPlan(ctx, { x: 0, y: 0, w: 360, h: 160 }, { current: 'harbor', tick: 3, target: 'core', reachable: { harbor: true, core: true } })
assert.ok(typeof stage.drawJobPlan === 'function')
stage.drawItemIcon(ctx, 10, 10, 22, { name: '北辰零号晶核', tier: 'red' })
stage.drawItemIcon(ctx, 40, 10, 22, { name: '气压逻辑板', tier: 'blue' })
stage.drawMedal(ctx, 10, 40, 36, { tier: 'gold', name: '归航标' })
stage.drawKit(ctx, 10, 80, 20, 'full')
stage.drawProp(ctx, 'crate', 80, 120, true, 2, false)
stage.drawProp(ctx, 'threat', 140, 120, true, 2, true)
stage.drawPad(ctx, 'heli', 200, 120, true, false)
stage.drawActor(ctx, 160, 160, 3, { facing: 1, walking: true })
stage.drawToneMark(ctx, 'fight', 10, 200, 22)
stage.drawToneMark(ctx, 'safe', 40, 200, 22)
stage.drawToneMark(ctx, 'extract', 70, 200, 22)
stage.drawToneMark(ctx, 'lever', 100, 200, 22)
stage.drawJudge(ctx, true, 160, 210, 20)
stage.drawJudge(ctx, false, 210, 210, 20)
stage.drawHudGlyph(ctx, 'ammo', 10, 240, 14)
stage.drawHudGlyph(ctx, 'med', 30, 240, 14)
stage.drawHudGlyph(ctx, 'grid', 50, 240, 14)
stage.drawHudGlyph(ctx, 'card', 70, 240, 14)
stage.drawStamp(ctx, 'loot', 240, 210, 16)
stage.drawStamp(ctx, 'extract', 280, 210, 16)
stage.drawStamp(ctx, 'lever', 320, 210, 16)
stage.drawPropTag(ctx, 'crate', 80, 150)
stage.drawPropTag(ctx, 'threat', 140, 150)
stage.drawPropTag(ctx, 'door', 200, 150)
stage.drawLessonRail(ctx, { x: 10, y: 260, w: 300, h: 22 }, [
  { label: '合闸', done: true },
  { label: '再合闸', done: false },
  { label: '索道', done: false }
], 3)

const feel = require('../miniprogram/runtime/feel')
{
  const loot = feel.classify(
    { hp: 80, lootCount: 0 },
    { hp: 80, loot: [{ name: '气压逻辑板' }], ended: false },
    ['收入背包']
  )
  assert.strictEqual(loot.stamp, '入手', '拾取没有即时对错标')
  assert.strictEqual(loot.label, '入手')
  assert.strictEqual(loot.mark, 'ok')
  const miss = feel.classify(
    { hp: 80, lootCount: 0, fight: true },
    { hp: 52, loot: [], ended: false },
    ['✗ 狭窄槽道交火失利']
  )
  assert.strictEqual(miss.stamp, '失手', '交火失败没有即时对错标')
  assert.strictEqual(miss.mark, 'bad')
  const bump = feel.classify(
    { hp: 80, lootCount: 0 },
    { hp: 62, loot: [], ended: false },
    ['巡检摸到了']
  )
  assert.strictEqual(bump.stamp, '挨打')
  const gate = feel.classify(
    { hp: 80, lootCount: 0, levers: 0 },
    { hp: 80, loot: [], levers: 1, ended: false },
    ['供电进度 1/2']
  )
  assert.strictEqual(gate.stamp, '合闸', '合闸没有即时标')
  assert.strictEqual(gate.kind, 'lever')
  const live = feel.classify(
    { hp: 80, lootCount: 1, extract: true },
    { hp: 80, loot: [{}], ended: false },
    ['带着已经到手的货，转向撤离线']
  )
  assert.strictEqual(live.stamp, '撤离', '撤离没有即时标')
  const scratch = feel.classify(
    { hp: 80, lootCount: 0, tutorial: true, step: 1 },
    { hp: 74, loot: [], ended: false },
    ['柜开了。擦了一下']
  )
  assert.strictEqual(scratch.stamp, '擦伤', '首局轻伤仍按失手报')
  assert.strictEqual(scratch.kind, 'scratch')
  const pass = feel.classify(
    { hp: 80, lootCount: 0, tutorial: true, step: 1 },
    { hp: 80, loot: [], ended: false },
    ['没碰封条，转入冷却舱合闸']
  )
  assert.ok(!pass.stamp, '空成功不该盖得手/继续合闸印章')
}

{
  const engine = require('../miniprogram/core/engine')
  assert.strictEqual(engine.tutorialWound({ tutorial: true, step: 1 }, -8), -4, '演示伤感应与教程封顶一致')
  assert.strictEqual(present.bagLoadText({ capacity: 25 }, { loadGrids: 2 }), '2/25格')
  assert.ok(present.extractCue({ levers: 0 }).includes('2/2'), '未合闸撤离应说清索道门槛')
  assert.ok(present.extractCue({ levers: 2 }).includes('索道'), '双电源撤离应指向索道')
  assert.ok(present.extractLockReason({ step: 0, hp: 80, risk: 10 }).includes('第3步'), '开局锁撤离要说清步数')
  assert.ok(present.extractLockReason({ node: { type: 'escape' }, step: 7 }).includes('撤离线'))
  const board = require('../miniprogram/data/items').makeItem('气压逻辑板')
  assert.strictEqual(board.weight, 2)
  assert.ok(`${board.name} · ${board.weight}格`.includes('2格'))
}

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
assert.ok(TYPE.display >= 32 && TYPE.title >= 20 && TYPE.lead >= 14, '字阶未抽出')
assert.strictEqual(INK.lead, COLORS.gold)
assert.ok(METAL.well && METAL.ok && METAL.ice, '金属井色阶未抽出')
assert.strictEqual(wellLook().material, 'well')
assert.strictEqual(ctaLook('primary').material, 'metal')
assert.strictEqual(ctaLook('primary').metal, METAL.ok)
assert.ok(typeof ui.cta === 'function' && typeof ui.well === 'function')
ui.well(10, 260, 200, 72)
ui.cta(10, 340, 200, 64, '出发回收', () => {})
ui.cta(10, 410, 200, 42, '设置', () => {}, { kind: 'ghost', size: 13 })
{
  const lobby = require('../miniprogram/scenes/index')
  assert.ok(typeof lobby.drawCover === 'function')
  lobby.drawCover(ui, {
    width: 390, height: 844,
    safe: { left: 0, top: 44, right: 390, bottom: 810 }
  }, 4)
}
{
  let scrolled = 80
  global.window = { scrollTo() { scrolled = 0 } }
  Scroll.resetView({ scrollIntoView() { scrolled = 0 } })
  assert.strictEqual(scrolled, 0, '进局滚动重置没有把页面拉回顶部')
}

assert.ok(typeof stage.drawItemIcon === 'function')
assert.ok(typeof stage.drawMedal === 'function')
console.log('画面层自检通过：场景/图标/选项主文案均可绘制')
