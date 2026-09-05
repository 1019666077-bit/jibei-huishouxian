// 局内场景：矩形+路径拼楼。缺高级接口时退回色块，模拟器也能画。
const { ZONE_POS, ZONE_SHORT, cityLabelLayout } = require('./present')
const gfx = require('./gfx')

const ROOM_WALL = 0.34
const TINT = {
  harbor: '#65d6b4',
  weather: '#65a9ff',
  thermal: '#ff8c50',
  lift: '#ffc65c',
  core: '#65d6b4',
  aurora: '#7ee0c4',
  extract: '#65d6b4'
}

const TIER_COLOR = {
  white: '#c8d4de',
  green: '#65d6b4',
  blue: '#65a9ff',
  purple: '#b48cff',
  gold: '#ffc65c',
  red: '#ff6b6b',
  silver: '#d0d8e0'
}

function fill(ctx, color) {
  ctx.fillStyle = color
}

function rect(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, h)
}

function windows(ctx, x, y, w, h, tint, seed) {
  const cols = w > 36 ? 2 : 1
  const rows = h > 40 ? 2 : 1
  const pw = Math.max(6, (w - 10) / cols - 4)
  const ph = Math.max(7, (h - 10) / rows - 4)
  fill(ctx, tint)
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if ((r + c + seed) % 5 === 0) continue
      rect(ctx, x + 5 + c * (pw + 4), y + 5 + r * (ph + 4), pw, ph)
    }
  }
}

function frame(ctx, x, y, w, h, color) {
  fill(ctx, color)
  rect(ctx, x, y, w, 2)
  rect(ctx, x, y + h - 2, w, 2)
  rect(ctx, x, y, 2, h)
  rect(ctx, x + w - 2, y, 2, h)
}

function sky(ctx, x, y, w, h, tick, tone) {
  fill(ctx, gfx.vgrad(ctx, x, y, h, [
    [0, tone === 'ember' ? '#1a100e' : '#061018'],
    [0.42, tone === 'ember' ? '#2a1812' : '#0d2438'],
    [1, tone === 'ember' ? '#120e10' : '#071018']
  ]))
  rect(ctx, x, y, w, h)
  if (tone !== 'ember') {
    gfx.quad(ctx, x, y + h * 0.08, x + w * 0.45, y - 4 + ((tick || 0) % 6), x + w, y + h * 0.16,
      'rgba(101,214,180,0.16)')
    gfx.quad(ctx, x, y + h * 0.2, x + w * 0.55, y + h * 0.08, x + w, y + h * 0.28,
      'rgba(101,169,255,0.1)')
  }
  fill(ctx, 'rgba(230,240,255,0.45)')
  for (let i = 0; i < 16; i++) {
    rect(ctx, x + ((i * 47 + (tick || 0) * 2) % w), y + 6 + (i * 19) % Math.max(12, h * 0.55), i % 4 ? 1 : 2, i % 4 ? 1 : 2)
  }
}

function drawHarbor(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick)
  fill(ctx, gfx.vgrad(ctx, x, y + h * 0.58, h * 0.42, [
    [0, 'rgba(70,130,160,0.34)'],
    [1, 'rgba(20,40,56,0.7)']
  ]))
  rect(ctx, x, y + h * 0.58, w, h * 0.42)
  fill(ctx, 'rgba(200,220,240,0.14)')
  for (let i = 0; i < 6; i++) rect(ctx, x, y + h * (0.62 + i * 0.055), w, 2)
  fill(ctx, '#132433')
  for (let i = 0; i < 5; i++) {
    const cx = x + w * (0.05 + i * 0.17)
    const ch = h * (0.26 + (i % 3) * 0.1)
    rect(ctx, cx, y + h * 0.58 - ch, w * 0.13, ch)
    windows(ctx, cx, y + h * 0.58 - ch, w * 0.13, ch, i % 2 ? 'rgba(101,214,180,0.4)' : 'rgba(255,198,92,0.3)', i)
    fill(ctx, '#0c1620')
    rect(ctx, cx - 1, y + h * 0.58 - ch - 4, w * 0.13 + 2, 4)
  }
  fill(ctx, '#243040')
  rect(ctx, x + w * 0.72, y + h * 0.16, 6, h * 0.42)
  fill(ctx, '#ffc65c')
  rect(ctx, x + w * 0.68, y + h * 0.16, w * 0.2, 5)
  fill(ctx, 'rgba(101,214,180,0.2)')
  rect(ctx, x + w * 0.78, y + h * 0.22, 10, 10)
}

function drawWeather(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick)
  ;[0.16, 0.42, 0.68].forEach((tx, i) => {
    const tw = w * (0.09 + i * 0.012)
    const th = h * (0.44 + i * 0.12)
    fill(ctx, '#15263a')
    rect(ctx, x + w * tx, y + h * 0.78 - th, tw, th)
    windows(ctx, x + w * tx, y + h * 0.78 - th, tw, th, 'rgba(101,169,255,0.42)', i)
    fill(ctx, 'rgba(101,169,255,0.6)')
    rect(ctx, x + w * tx + tw / 2 - 2, y + h * 0.78 - th - 14, 4, 14)
    gfx.circle(ctx, x + w * tx + tw / 2, y + h * 0.78 - th - 16, 5, 'rgba(159,212,255,0.45)')
  })
  fill(ctx, 'rgba(101,214,180,0.16)')
  rect(ctx, x, y + h * 0.14 + ((tick || 0) % 12), w, 5)
}

function drawThermal(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick, 'ember')
  fill(ctx, '#2a1c18')
  for (let i = 0; i < 4; i++) {
    rect(ctx, x, y + h * (0.2 + i * 0.16), w, 12)
    fill(ctx, '#ff8c50')
    rect(ctx, x + w * (0.12 + i * 0.2), y + h * (0.2 + i * 0.16) - 4, 8, 8)
    fill(ctx, '#2a1c18')
  }
  const steam = (tick || 0) % 18
  fill(ctx, 'rgba(255,140,80,0.24)')
  for (let i = 0; i < 6; i++) {
    rect(ctx, x + w * (0.1 + i * 0.14), y + h * 0.28 - steam, 8, 20)
  }
  fill(ctx, 'rgba(255,140,80,0.12)')
  rect(ctx, x + w * 0.3, y + h * 0.7, w * 0.4, 8)
}

function drawLift(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick)
  fill(ctx, '#1b2430')
  rect(ctx, x + w * 0.16, y + 10, 10, h - 20)
  rect(ctx, x + w * 0.78, y + 10, 10, h - 20)
  fill(ctx, '#243040')
  rect(ctx, x + w * 0.2, y + h * 0.38, w * 0.6, 18)
  for (let i = 0; i < 8; i++) {
    fill(ctx, i % 2 ? '#ffc65c' : '#1a1c20')
    rect(ctx, x + w * 0.22 + i * (w * 0.07), y + h * 0.38, w * 0.07, 6)
  }
  fill(ctx, 'rgba(255,198,92,0.38)')
  rect(ctx, x + w * 0.38, y + h * 0.18, w * 0.24, 12)
  fill(ctx, '#65d6b4')
  rect(ctx, x + w * 0.46, y + h * 0.62 + ((tick || 0) % 10), w * 0.08, 8)
}

function drawCore(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick)
  fill(ctx, '#152033')
  const rooms = [
    [0.16, 0.16, 0.28, 0.22],
    [0.52, 0.14, 0.3, 0.2],
    [0.32, 0.4, 0.34, 0.18],
    [0.14, 0.58, 0.28, 0.22],
    [0.56, 0.56, 0.28, 0.24]
  ]
  rooms.forEach((r, i) => {
    rect(ctx, x + w * r[0], y + h * r[1], w * r[2], h * r[3])
    windows(ctx, x + w * r[0], y + h * r[1], w * r[2], h * r[3], 'rgba(101,214,180,0.22)', i)
  })
  fill(ctx, 'rgba(101,214,180,0.24)')
  rect(ctx, x + w * 0.46, y + h * 0.08, w * 0.08, h * 0.84)
}

function drawAurora(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick)
  fill(ctx, 'rgba(101,214,180,0.2)')
  rect(ctx, x, y + h * 0.1 + ((tick || 0) % 8), w, 12)
  fill(ctx, 'rgba(101,169,255,0.16)')
  rect(ctx, x, y + h * 0.26, w, 8)
  fill(ctx, '#142436')
  rect(ctx, x + w * 0.36, y + h * 0.16, w * 0.28, h * 0.72)
  windows(ctx, x + w * 0.36, y + h * 0.16, w * 0.28, h * 0.72, 'rgba(255,198,92,0.3)', 2)
  fill(ctx, ((tick || 0) % 8) < 4 ? '#ffc65c' : '#65d6b4')
  rect(ctx, x + w * 0.47, y + h * 0.1, 8, 8)
  gfx.circle(ctx, x + w * 0.5, y + h * 0.12, 7, 'rgba(126,224,196,0.35)')
}

function drawExtract(ctx, box, tick) {
  const { x, y, w, h } = box
  sky(ctx, x, y, w, h, tick)
  fill(ctx, '#1a2a22')
  rect(ctx, x + w * 0.08, y + h * 0.58, w * 0.84, 14)
  fill(ctx, 'rgba(101,214,180,0.35)')
  rect(ctx, x + w * 0.58, y + h * 0.2, w * 0.28, h * 0.36)
  fill(ctx, '#65d6b4')
  for (let i = 0; i < 3; i++) {
    rect(ctx, x + w * (0.18 + i * 0.12), y + h * 0.7, 10, 4)
  }
  fill(ctx, ((tick || 0) % 10) < 5 ? '#ffc65c' : '#65d6b4')
  rect(ctx, x + w * 0.68, y + h * 0.12, 8, 8)
}

const DRAW = {
  harbor: drawHarbor,
  weather: drawWeather,
  thermal: drawThermal,
  lift: drawLift,
  core: drawCore,
  aurora: drawAurora,
  extract: drawExtract
}

function drawZone(ctx, zone, box, tick) {
  const fn = DRAW[zone] || drawCore
  fn(ctx, box, tick || 0)
}

function drawRoad(ctx, x, y, w, h, a, b) {
  const x1 = x + a.x * w
  const y1 = y + a.y * h
  const x2 = x + b.x * w
  const y2 = y + b.y * h
  const steps = 14
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    const px = x1 + (x2 - x1) * t
    const py = y1 + (y2 - y1) * t
    fill(ctx, '#15202c')
    rect(ctx, px - 5, py - 5, 10, 10)
    fill(ctx, 'rgba(186,214,230,0.28)')
    rect(ctx, px - 2, py - 2, 4, 4)
  }
}

function drawSite(ctx, key, px, py, size, state) {
  const s = size
  const dim = state.dim
  const body = dim ? '#0e1620' : '#152433'
  const tint = dim ? '#2a3a48' : (TINT[key] || '#65d6b4')
  fill(ctx, 'rgba(0,0,0,0.35)')
  rect(ctx, px - s * 0.62, py - 4, s * 1.24, 8)

  if (key === 'harbor') {
    fill(ctx, dim ? '#163040' : 'rgba(80,130,160,0.4)')
    rect(ctx, px - s * 0.7, py - s * 0.08, s * 0.36, s * 0.42)
    fill(ctx, body)
    rect(ctx, px - s * 0.28, py - s * 0.7, s * 0.34, s * 0.7)
    rect(ctx, px + s * 0.1, py - s * 0.5, s * 0.4, s * 0.5)
    windows(ctx, px - s * 0.28, py - s * 0.7, s * 0.34, s * 0.7, tint, 1)
    windows(ctx, px + s * 0.1, py - s * 0.5, s * 0.4, s * 0.5, '#ffc65c', 2)
  } else if (key === 'weather') {
    ;[-0.38, 0, 0.38].forEach((dx, i) => {
      const tw = s * (0.18 + i * 0.02)
      const th = s * (0.55 + i * 0.18)
      fill(ctx, body)
      rect(ctx, px + dx * s - tw / 2, py - th, tw, th)
      windows(ctx, px + dx * s - tw / 2, py - th, tw, th, tint, i)
      fill(ctx, tint)
      rect(ctx, px + dx * s - 1, py - th - 8, 3, 8)
    })
  } else if (key === 'thermal') {
    fill(ctx, body)
    rect(ctx, px - s * 0.55, py - s * 0.42, s * 1.1, s * 0.42)
    fill(ctx, dim ? '#3a2418' : '#4a2a18')
    for (let i = 0; i < 3; i++) rect(ctx, px - s * 0.5, py - s * 0.34 + i * 8, s, 5)
    fill(ctx, tint)
    rect(ctx, px - 4, py - s * 0.55, 8, s * 0.16)
  } else if (key === 'lift') {
    fill(ctx, body)
    rect(ctx, px - s * 0.48, py - s * 0.72, 8, s * 0.72)
    rect(ctx, px + s * 0.4, py - s * 0.72, 8, s * 0.72)
    fill(ctx, '#243040')
    rect(ctx, px - s * 0.4, py - s * 0.32, s * 0.8, 12)
    fill(ctx, tint)
    rect(ctx, px - s * 0.16, py - s * 0.52, s * 0.32, 8)
  } else if (key === 'core') {
    fill(ctx, body)
    ;[[-0.42, -0.62, 0.36, 0.28], [0.08, -0.58, 0.38, 0.24], [-0.18, -0.28, 0.4, 0.2], [-0.46, -0.02, 0.34, 0.26], [0.12, 0, 0.36, 0.26]].forEach((r, i) => {
      rect(ctx, px + r[0] * s, py + r[1] * s, r[2] * s, r[3] * s)
      windows(ctx, px + r[0] * s, py + r[1] * s, r[2] * s, r[3] * s, tint, i)
    })
    fill(ctx, tint)
    rect(ctx, px - 3, py - s * 0.7, 6, s * 0.92)
  } else if (key === 'aurora') {
    fill(ctx, body)
    rect(ctx, px - s * 0.18, py - s * 0.95, s * 0.36, s * 0.95)
    windows(ctx, px - s * 0.18, py - s * 0.95, s * 0.36, s * 0.95, tint, 4)
    fill(ctx, (state.tick || 0) % 8 < 4 ? '#ffc65c' : tint)
    rect(ctx, px - 4, py - s * 1.05, 8, 8)
    fill(ctx, 'rgba(101,214,180,0.2)')
    rect(ctx, px - s * 0.7, py - s * 0.8, s * 1.4, 6)
  } else {
    fill(ctx, dim ? '#122018' : '#1a2a22')
    rect(ctx, px - s * 0.55, py - s * 0.22, s * 1.1, s * 0.28)
    fill(ctx, tint)
    for (let i = 0; i < 3; i++) rect(ctx, px - s * 0.36 + i * s * 0.28, py - s * 0.08, 12, 5)
    fill(ctx, dim ? '#243040' : '#2a4a40')
    rect(ctx, px + s * 0.08, py - s * 0.55, s * 0.4, s * 0.36)
  }

  if (state.current) {
    fill(ctx, 'rgba(101,214,180,0.22)')
    rect(ctx, px - s * 0.82, py - s * 1.18, s * 1.64, s * 1.36)
    frame(ctx, px - s * 0.76, py - s * 1.12, s * 1.52, s * 1.28, '#7ee8c8')
    frame(ctx, px - s * 0.7, py - s * 1.06, s * 1.4, s * 1.16, '#65d6b4')
  } else if (state.goal) {
    fill(ctx, 'rgba(255,198,92,0.28)')
    rect(ctx, px - s * 0.86, py - s * 1.22, s * 1.72, s * 1.44)
    frame(ctx, px - s * 0.8, py - s * 1.16, s * 1.6, s * 1.36, '#ffe08a')
    frame(ctx, px - s * 0.7, py - s * 1.04, s * 1.4, s * 1.16, '#ffc65c')
  } else if (state.reach) {
    fill(ctx, 'rgba(255,198,92,0.16)')
    rect(ctx, px - s * 0.76, py - s * 1.1, s * 1.52, s * 1.28)
    frame(ctx, px - s * 0.7, py - s * 1.04, s * 1.4, s * 1.16, '#ffc65c')
  }
}

function drawCityDots(ctx, box, options = {}) {
  const { x, y, w, h } = box
  const tick = options.tick || 0
  sky(ctx, x, y, w, h, tick)
  fill(ctx, 'rgba(70,120,150,0.22)')
  rect(ctx, x, y + h * 0.34, w * 0.28, h * 0.24)
  const links = [
    ['harbor', 'thermal'], ['harbor', 'lift'], ['weather', 'thermal'],
    ['thermal', 'core'], ['harbor', 'core'], ['lift', 'core'],
    ['core', 'aurora'], ['weather', 'aurora'], ['lift', 'extract']
  ]
  fill(ctx, 'rgba(186,214,230,0.32)')
  links.forEach(pair => {
    const a = ZONE_POS[pair[0]]
    const b = ZONE_POS[pair[1]]
    if (!a || !b) return
    const x1 = x + a.x * w
    const y1 = y + a.y * h
    const x2 = x + b.x * w
    const y2 = y + b.y * h
    for (let i = 0; i < 6; i++) {
      const t = i / 6
      rect(ctx, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, 2, 2)
    }
  })
  const align = ctx.textAlign
  const font = ctx.font
  ctx.textAlign = 'center'
  Object.keys(ZONE_POS).forEach(key => {
    const p = ZONE_POS[key]
    const px = x + p.x * w
    const py = y + p.y * h
    const here = options.current === key
    const reach = !options.reachable || options.reachable[key]
    const goal = options.target === key && !here
    if (here) {
      const pulse = 7 + (tick % 5)
      fill(ctx, options.hot ? 'rgba(255,107,107,0.4)' : 'rgba(101,214,180,0.4)')
      rect(ctx, px - pulse, py - pulse, pulse * 2, pulse * 2)
      frame(ctx, px - 11, py - 11, 22, 22, options.hot ? '#ff6b6b' : '#7ee8c8')
    } else if (goal) {
      const pulse = 6 + (tick % 4)
      fill(ctx, 'rgba(255,198,92,0.38)')
      rect(ctx, px - pulse, py - pulse, pulse * 2, pulse * 2)
      frame(ctx, px - 10, py - 10, 20, 20, '#ffc65c')
    } else if (reach) {
      frame(ctx, px - 8, py - 8, 16, 16, '#ffc65c')
    }
    const sz = here ? 10 : reach ? 7 : 4
    fill(ctx, here ? (options.hot ? '#ff6b6b' : '#7ee8c8') : (reach ? (TINT[key] || '#ffc65c') : '#243040'))
    rect(ctx, px - sz / 2, py - sz / 2, sz, sz)
  })
  cityLabelLayout(box, { skip: options.skipLabels, busy: options.busy }).forEach(lab => {
    const here = options.current === lab.key
    const reach = !options.reachable || options.reachable[lab.key]
    const goal = options.target === lab.key && !here
    if (!here && !reach && !goal) return
    gfx.roundRect(ctx, lab.x, lab.y, lab.w, lab.h, 5)
    fill(ctx, 'rgba(6,12,18,0.9)')
    ctx.fill()
    gfx.applyFont(ctx, here ? 11 : 10, '700')
    fill(ctx, here ? '#7ee8c8' : '#ffe08a')
    ctx.fillText(ZONE_SHORT[lab.key] || lab.key, lab.x + lab.w / 2, lab.y + 1)
  })
  ctx.textAlign = align || 'left'
  ctx.font = font || gfx.font(14)
}

function drawCity(ctx, box, options = {}) {
  const { x, y, w, h } = box
  if (options.compact || h < 118) {
    drawCityDots(ctx, box, options)
    return
  }
  const tick = options.tick || 0
  sky(ctx, x, y, w, h, tick)
  fill(ctx, 'rgba(70,120,150,0.18)')
  rect(ctx, x, y + h * 0.32, w * 0.3, h * 0.28)
  fill(ctx, 'rgba(230,240,255,0.35)')
  for (let i = 0; i < 22; i++) {
    rect(ctx, x + ((i * 53 + tick) % w), y + 6 + (i * 29) % (h * 0.7), i % 4 ? 1 : 2, i % 4 ? 1 : 2)
  }
  const links = [
    ['harbor', 'thermal'],
    ['harbor', 'lift'],
    ['weather', 'thermal'],
    ['weather', 'lift'],
    ['thermal', 'core'],
    ['harbor', 'core'],
    ['lift', 'core'],
    ['core', 'aurora'],
    ['weather', 'aurora'],
    ['lift', 'extract']
  ]
  links.forEach(pair => {
    const a = ZONE_POS[pair[0]]
    const b = ZONE_POS[pair[1]]
    if (a && b) drawRoad(ctx, x, y, w, h, a, b)
  })
  const size = Math.max(26, Math.min(w, h) * (h > 140 ? 0.14 : 0.18))
  const align = ctx.textAlign
  const font = ctx.font
  ctx.textAlign = 'center'
  gfx.applyFont(ctx, h > 140 ? 11 : 9, '700')
  Object.keys(ZONE_POS).forEach(key => {
    const p = ZONE_POS[key]
    const px = x + p.x * w
    const py = y + p.y * h
    const current = options.current === key
    const reach = !options.reachable || options.reachable[key]
    const goal = options.target === key && !current
    drawSite(ctx, key, px, py, size, {
      current,
      reach: reach || goal,
      goal,
      dim: !current && !reach && !goal,
      tick
    })
  })
  cityLabelLayout(box, { skip: options.skipLabels, busy: options.busy }).forEach(lab => {
    const current = options.current === lab.key
    const reach = !options.reachable || options.reachable[lab.key]
    const goal = options.target === lab.key && !current
    if (!current && !reach && !goal) return
    gfx.roundRect(ctx, lab.x, lab.y, lab.w, lab.h, 6)
    fill(ctx, 'rgba(8,12,18,0.9)')
    ctx.fill()
    gfx.applyFont(ctx, 12, '700')
    fill(ctx, current ? '#7ee8c8' : '#ffe08a')
    ctx.fillText(ZONE_SHORT[lab.key] || lab.key, lab.x + lab.w / 2, lab.y + 1)
  })
  fill(ctx, '#8fa3b8')
  gfx.applyFont(ctx, 10, '700')
  ctx.fillText('北', x + w * 0.5, y + 4)
  ctx.textAlign = align || 'left'
  ctx.font = font || gfx.font(14)
  const here = ZONE_POS[options.current]
  if (here && options.marker !== 'none') {
    const hx = x + here.x * w
    const hy = y + here.y * h
    if (h > 160 && options.marker === 'person') {
      drawPerson(ctx, hx, hy + 4, tick, { facing: 1 })
    } else {
      fill(ctx, options.hot ? 'rgba(255,107,107,0.85)' : 'rgba(101,214,180,0.9)')
      const pulse = 7 + (tick % 5)
      rect(ctx, hx - pulse / 2, hy - size * 0.55 - pulse / 2, pulse, pulse)
    }
  }
}

function drawJobPlan(ctx, box, options = {}) {
  const { x, y, w, h } = box
  const tick = options.tick || 0
  sky(ctx, x, y, w, h, tick)
  fill(ctx, gfx.vgrad(ctx, x, y + h * 0.58, h * 0.42, [
    [0, 'rgba(70,130,160,0.3)'],
    [1, 'rgba(10,20,30,0.72)']
  ]))
  rect(ctx, x, y + h * 0.58, w, h * 0.42)
  const nodes = [
    { key: 'harbor', title: '冻港', sub: '出发', nx: 0.16, ny: 0.62 },
    { key: 'core', title: '内环', sub: '合闸', nx: 0.50, ny: 0.32 },
    { key: 'extract', title: '索道', sub: '撤离', nx: 0.84, ny: 0.58 }
  ]
  const pts = nodes.map(n => ({
    ...n,
    px: x + n.nx * w,
    py: y + n.ny * h
  }))
  for (let i = 0; i < pts.length - 1; i++) {
    drawRoad(ctx, x, y, w, h,
      { x: pts[i].nx, y: pts[i].ny },
      { x: pts[i + 1].nx, y: pts[i + 1].ny }
    )
  }
  gfx.line(ctx, pts[0].px, pts[0].py, pts[2].px, pts[2].py, 'rgba(140,210,255,0.16)', 1)
  const align = ctx.textAlign
  ctx.textAlign = 'center'
  pts.forEach(n => {
    const here = options.current === n.key
    const goal = options.target === n.key && !here
    const reach = !options.reachable || options.reachable[n.key]
    const size = Math.max(28, Math.min(w, h) * 0.26)
    drawSite(ctx, n.key, n.px, n.py, size, {
      current: here,
      goal,
      reach: reach || goal,
      dim: !here && !reach && !goal,
      tick
    })
    const plateW = 52
    const plateH = 28
    let plateX = n.px - plateW / 2
    let plateY = n.key === 'core' ? n.py - size * 0.82 - plateH : n.py + 16
    plateX = Math.min(x + w - plateW - 4, Math.max(x + 4, plateX))
    plateY = Math.min(y + h - plateH - 4, Math.max(y + 4, plateY))
    gfx.roundRect(ctx, plateX, plateY, plateW, plateH, 8)
    fill(ctx, here ? 'rgba(18,52,40,0.94)' : goal ? 'rgba(42,36,16,0.94)' : 'rgba(8,14,20,0.92)')
    ctx.fill()
    gfx.applyFont(ctx, 13, '700')
    fill(ctx, here ? '#7ee8c8' : goal ? '#ffe08a' : '#f4f8fc')
    ctx.fillText(n.title, plateX + plateW / 2, plateY + 2)
    gfx.applyFont(ctx, 11, '700')
    fill(ctx, here ? '#8ef0d0' : goal ? '#ffc65c' : '#9aafc2')
    ctx.fillText(n.sub, plateX + plateW / 2, plateY + 15)
  })
  ctx.textAlign = align || 'left'
}

function gem(ctx, x, y, size, color) {
  fill(ctx, color)
  rect(ctx, x, y + size * 0.22, size, size * 0.56)
  rect(ctx, x + size * 0.18, y, size * 0.64, size)
  fill(ctx, 'rgba(255,255,255,0.4)')
  rect(ctx, x + 3, y + 3, Math.max(2, size / 4), Math.max(2, size / 4))
  fill(ctx, 'rgba(0,0,0,0.22)')
  rect(ctx, x + size * 0.62, y + size * 0.58, size * 0.28, size * 0.28)
}

function drawItemIcon(ctx, x, y, size, item) {
  const tier = (item && item.tier) || 'green'
  const color = TIER_COLOR[tier] || TIER_COLOR.green
  const name = String((item && item.name) || '')
  fill(ctx, 'rgba(8,12,18,0.45)')
  rect(ctx, x - 2, y + size - 3, size + 4, 5)
  if (/晶核|阵列|冠|环/.test(name)) {
    gem(ctx, x, y, size, color)
    gfx.circle(ctx, x + size / 2, y + size / 2, size * 0.18, 'rgba(255,255,255,0.35)')
    return
  }
  if (/主机|板|仪|盘|匣/.test(name)) {
    fill(ctx, '#1a2430')
    rect(ctx, x, y + 2, size, size - 4)
    fill(ctx, color)
    rect(ctx, x + 3, y + 5, size - 6, 4)
    rect(ctx, x + 3, y + size * 0.42, size - 6, 3)
    rect(ctx, x + 5, y + size * 0.62, size * 0.28, size * 0.22)
    return
  }
  if (/罐|管|泵|阀|药柱|胶囊/.test(name)) {
    fill(ctx, color)
    rect(ctx, x + size * 0.28, y, size * 0.44, size)
    fill(ctx, '#1a2430')
    rect(ctx, x + size * 0.22, y + 2, size * 0.56, 5)
    fill(ctx, 'rgba(255,255,255,0.28)')
    rect(ctx, x + size * 0.34, y + size * 0.3, 3, size * 0.4)
    return
  }
  gem(ctx, x, y, size, color)
}

function drawMedal(ctx, x, y, size, medal) {
  const tier = (medal && medal.tier) || 'gold'
  const color = TIER_COLOR[tier] || TIER_COLOR.gold
  gfx.circle(ctx, x + size / 2, y + size / 2, size * 0.48, '#1a2430')
  gfx.strokeCircle(ctx, x + size / 2, y + size / 2, size * 0.42, color, 3)
  fill(ctx, color)
  rect(ctx, x + size * 0.38, y + size * 0.22, size * 0.24, size * 0.56)
  rect(ctx, x + size * 0.22, y + size * 0.38, size * 0.56, size * 0.24)
  fill(ctx, 'rgba(255,255,255,0.35)')
  rect(ctx, x + size * 0.42, y + size * 0.28, 4, 4)
}

function drawPerson(ctx, x, y, tick, options = {}) {
  const facing = options.facing < 0 ? -1 : 1
  const walking = !!options.walking
  const hostile = !!options.hostile
  const t = tick || 0
  const bob = walking ? ((t % 4) < 2 ? -2 : 1) : ((t % 8) < 4 ? 0 : 1)
  const step = walking ? ((t % 6) < 3 ? 4 : -4) : 0
  const body = hostile ? '#d45a5a' : '#65d6b4'
  const dark = hostile ? '#4a181c' : '#2a4a40'
  const skin = hostile ? '#e0b09a' : '#d7efe6'
  fill(ctx, gfx.rgrad(ctx, x, y + 2, 16, [
    [0, 'rgba(0,0,0,0.45)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x - 16, y - 4, 32, 10)
  fill(ctx, '#1a1c20')
  rect(ctx, x - 8 + step, y - 8 + bob, 7, 8)
  rect(ctx, x + 1 - step, y - 8 + bob, 7, 8)
  fill(ctx, dark)
  rect(ctx, x - 7 + step, y - 18 + bob, 6, 16)
  rect(ctx, x + 1 - step, y - 18 + bob, 6, 16)
  fill(ctx, body)
  rect(ctx, x - 9, y - 34 + bob, 18, 18)
  fill(ctx, 'rgba(255,255,255,0.16)')
  rect(ctx, x - 7, y - 32 + bob, 5, 12)
  fill(ctx, dark)
  rect(ctx, facing > 0 ? x - 13 : x + 6, y - 30 + bob, 8, 12)
  fill(ctx, '#1a2430')
  rect(ctx, x - 9, y - 24 + bob, 18, 3)
  fill(ctx, skin)
  rect(ctx, x - 6, y - 48 + bob, 12, 14)
  fill(ctx, body)
  rect(ctx, x - 7, y - 50 + bob, 14, 8)
  fill(ctx, 'rgba(255,255,255,0.18)')
  rect(ctx, x - 6, y - 50 + bob, 4, 6)
  fill(ctx, dark)
  rect(ctx, x - 5, y - 42 + bob, 10, 4)
  fill(ctx, tintVisor(hostile))
  rect(ctx, x - 4, y - 40 + bob, 8, 3)
  if (hostile) {
    const gx = facing > 0 ? x + 8 : x - 26
    fill(ctx, '#1a1c20')
    rect(ctx, gx, y - 28 + bob, 18, 4)
    fill(ctx, '#5a5e66')
    rect(ctx, gx + 4, y - 30 + bob, 4, 8)
    fill(ctx, '#ff6b6b')
    rect(ctx, facing > 0 ? gx + 16 : gx - 2, y - 29 + bob, 4, 6)
  }
}

function tintVisor(hostile) {
  return hostile ? '#ff6b6b' : '#c8fff0'
}

function drawActor(ctx, x, y, tick, options) {
  drawPerson(ctx, x, y, tick, options || {})
}

function rivet(ctx, x, y) {
  fill(ctx, '#0c0e12')
  rect(ctx, x, y, 4, 4)
  fill(ctx, 'rgba(230,242,255,0.55)')
  rect(ctx, x, y, 3, 2)
  fill(ctx, 'rgba(70,80,90,0.75)')
  rect(ctx, x + 2, y + 2, 2, 2)
}

function frost(ctx, x, y, w, h) {
  const hh = h || 4
  fill(ctx, 'rgba(186,230,255,0.3)')
  rect(ctx, x, y, w, hh)
  fill(ctx, 'rgba(236,248,255,0.46)')
  rect(ctx, x + 3, y, Math.max(8, w * 0.4), Math.max(2, hh - 1))
}

function seam(ctx, x, y, w) {
  fill(ctx, 'rgba(6,8,10,0.64)')
  rect(ctx, x, y, w, 2)
  fill(ctx, 'rgba(210,228,242,0.24)')
  rect(ctx, x, y, w, 1)
}

function iceBloom(ctx, x, y, w, h) {
  fill(ctx, 'rgba(159,212,255,0.18)')
  rect(ctx, x, y, w, h)
  fill(ctx, 'rgba(236,248,255,0.28)')
  rect(ctx, x + 2, y + 1, Math.max(6, w * 0.42), 2)
}

function metalEdge(ctx, x, y, w) {
  fill(ctx, 'rgba(220,232,245,0.26)')
  rect(ctx, x, y, w, 2)
  fill(ctx, 'rgba(8,10,14,0.48)')
  rect(ctx, x, y + 2, w, 2)
}

function isoFace(ctx, points, color) {
  if (ctx.beginPath && ctx.lineTo && ctx.closePath) {
    ctx.beginPath()
    ctx.moveTo(points[0][0], points[0][1])
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i][0], points[i][1])
    ctx.closePath()
    fill(ctx, color)
    ctx.fill()
    return
  }
  fill(ctx, color)
  rect(ctx, points[0][0], points[0][1], 20, 16)
}

function drawCrate(ctx, x, y, lit, hot) {
  fill(ctx, gfx.rgrad(ctx, x + 4, y + 6, 36, [
    [0, 'rgba(0,0,0,0.58)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x - 38, y - 6, 80, 20)
  if (lit || hot) {
    fill(ctx, gfx.rgrad(ctx, x, y - 24, 46, [
      [0, hot ? 'rgba(255,198,92,0.3)' : 'rgba(255,210,140,0.16)'],
      [1, 'rgba(0,0,0,0)']
    ]))
    rect(ctx, x - 42, y - 62, 86, 72)
  }
  const front = hot ? '#d8a85c' : lit ? '#a0743c' : '#4a4e46'
  const top = hot ? '#f4d890' : lit ? '#d4a45c' : '#6a6e64'
  const side = hot ? '#8a6428' : lit ? '#6a4a22' : '#32362e'
  const d = 14
  const w = 48
  const h = 36
  const fx = x - 26
  const fy = y
  isoFace(ctx, [
    [fx + w, fy - h], [fx + w + d, fy - h - 8], [fx + w + d, fy - 8], [fx + w, fy]
  ], side)
  fill(ctx, gfx.vgrad(ctx, fx, fy - h, h, [
    [0, top],
    [0.22, front],
    [1, side]
  ]))
  rect(ctx, fx, fy - h, w, h)
  isoFace(ctx, [
    [fx, fy - h], [fx + 10, fy - h - 8], [fx + w + d, fy - h - 8], [fx + w, fy - h]
  ], top)
  frost(ctx, fx, fy - h - 10, w + 10, 6)
  iceBloom(ctx, fx + 6, fy - h - 6, 18, 5)
  fill(ctx, 'rgba(255,245,210,0.42)')
  rect(ctx, fx + 2, fy - h + 2, 18, 5)
  metalEdge(ctx, fx + 1, fy - h + 1, w - 2)
  fill(ctx, hot ? '#eee4b8' : '#9aa096')
  rect(ctx, fx + 18, fy - h, 6, h)
  seam(ctx, fx, fy - 16, w)
  seam(ctx, fx, fy - 26, w)
  fill(ctx, 'rgba(40,22,10,0.42)')
  rect(ctx, fx + 6, fy - 30, 7, 16)
  rect(ctx, fx + 32, fy - 30, 7, 16)
  rivet(ctx, fx + 3, fy - h + 4)
  rivet(ctx, fx + w - 8, fy - h + 4)
  rivet(ctx, fx + 3, fy - 10)
  rivet(ctx, fx + w - 8, fy - 10)
  fill(ctx, hot ? '#ffc65c' : '#d4a84a')
  gfx.roundRect(ctx, fx + 16, fy - 22, 18, 14, 3)
  ctx.fill()
  fill(ctx, '#14161a')
  rect(ctx, fx + 24, fy - 17, 5, 6)
  fill(ctx, hot ? '#8ef0d0' : '#65d6b4')
  rect(ctx, fx + 38, fy - 32, 8, 5)
  fill(ctx, 'rgba(159,212,255,0.16)')
  rect(ctx, fx + 2, fy - 8, 12, 3)
}

function drawDoor(ctx, x, y, lit, hot) {
  fill(ctx, gfx.rgrad(ctx, x, y + 6, 32, [
    [0, 'rgba(0,0,0,0.55)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x - 34, y - 4, 70, 18)
  if (lit || hot) {
    gfx.quad(ctx, x - 20, y - 2, x, y + 30, x + 20, y - 2,
      hot ? 'rgba(255,198,92,0.22)' : 'rgba(101,214,180,0.18)')
  }
  fill(ctx, '#0a1014')
  rect(ctx, x - 32, y - 76, 64, 74)
  fill(ctx, lit ? '#1e3a34' : '#161a20')
  rect(ctx, x - 28, y - 70, 52, 66)
  isoFace(ctx, [
    [x + 24, y - 70], [x + 32, y - 76], [x + 32, y - 6], [x + 24, y]
  ], lit ? '#16302c' : '#101418')
  fill(ctx, hot ? '#0a1814' : '#080c10')
  rect(ctx, x - 18, y - 58, 36, 50)
  fill(ctx, lit ? '#65d6b4' : '#3d5a52')
  rect(ctx, x - 28, y - 70, 52, 7)
  rect(ctx, x - 28, y - 70, 7, 66)
  rect(ctx, x + 17, y - 70, 7, 66)
  fill(ctx, '#243040')
  rect(ctx, x - 34, y - 2, 68, 6)
  metalEdge(ctx, x - 28, y - 70, 52)
  frost(ctx, x - 30, y - 74, 56, 6)
  rivet(ctx, x - 26, y - 66)
  rivet(ctx, x + 18, y - 66)
  rivet(ctx, x - 26, y - 12)
  rivet(ctx, x + 18, y - 12)
  fill(ctx, lit ? 'rgba(142,240,208,0.42)' : 'rgba(80,100,110,0.18)')
  rect(ctx, x - 12, y - 52, 16, 22)
  frost(ctx, x - 12, y - 52, 16, 4)
  iceBloom(ctx, x - 10, y - 50, 12, 6)
  fill(ctx, 'rgba(8,12,16,0.35)')
  rect(ctx, x - 5, y - 52, 3, 22)
  rect(ctx, x - 12, y - 42, 16, 3)
  fill(ctx, hot ? '#ffc65c' : '#65d6b4')
  gfx.circle(ctx, x + 10, y - 30, 6, hot ? '#ffc65c' : '#65d6b4')
  fill(ctx, '#1a2430')
  rect(ctx, x + 8, y - 32, 5, 5)
  fill(ctx, 'rgba(255,198,92,0.55)')
  rect(ctx, x - 4, y - 78, 8, 5)
  gfx.circle(ctx, x, y - 4, 16, lit ? 'rgba(142,240,208,0.12)' : 'rgba(159,212,255,0.08)')
}

function drawLoot(ctx, x, y, lit, hot) {
  fill(ctx, gfx.rgrad(ctx, x, y + 2, 26, [
    [0, 'rgba(0,0,0,0.5)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x - 26, y - 4, 52, 16)
  if (lit || hot) {
    fill(ctx, gfx.rgrad(ctx, x, y - 30, 32, [
      [0, 'rgba(255,198,92,0.32)'],
      [1, 'rgba(0,0,0,0)']
    ]))
    rect(ctx, x - 30, y - 56, 60, 56)
  }
  fill(ctx, '#1a2430')
  rect(ctx, x - 16, y - 8, 32, 8)
  isoFace(ctx, [
    [x - 18, y - 16], [x - 10, y - 22], [x + 22, y - 22], [x + 14, y - 16]
  ], hot || lit ? '#3a2e16' : '#243040')
  fill(ctx, '#2a3848')
  rect(ctx, x - 18, y - 16, 32, 10)
  gem(ctx, x - 13, y - 50, 26, hot || lit ? '#ffc65c' : '#65d6b4')
  fill(ctx, 'rgba(255,240,180,0.45)')
  rect(ctx, x - 2, y - 44, 5, 5)
}

function drawThreat(ctx, x, y, tick, hot) {
  fill(ctx, gfx.rgrad(ctx, x, y + 4, 30, [
    [0, 'rgba(90,12,18,0.55)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x - 34, y - 6, 68, 20)
  fill(ctx, gfx.rgrad(ctx, x, y - 38, 40, [
    [0, hot ? 'rgba(255,107,107,0.32)' : 'rgba(255,107,107,0.16)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x - 36, y - 76, 72, 76)
  drawPerson(ctx, x, y, tick, { hostile: true, facing: -1, walking: !!hot })
  fill(ctx, '#ff6b6b')
  isoFace(ctx, [
    [x - 10, y - 70], [x, y - 80], [x + 10, y - 70]
  ], '#ff6b6b')
  gfx.strokeCircle(ctx, x, y - 28, hot ? 26 : 21, 'rgba(255,107,107,0.72)', 2)
  fill(ctx, 'rgba(255,107,107,0.22)')
  rect(ctx, x - 26, y - 60, 52, 6)
}

function drawProp(ctx, kind, x, y, lit, tick, hot) {
  if (kind === 'threat') {
    drawThreat(ctx, x, y, tick, hot)
    return
  }
  if (kind === 'door') {
    drawDoor(ctx, x, y, lit, hot)
    return
  }
  if (kind === 'take') {
    drawLoot(ctx, x, y, lit, hot)
    return
  }
  drawCrate(ctx, x, y, lit, hot)
}

function drawPropTag(ctx, kind, x, y) {
  const label = kind === 'threat' ? '交火' : kind === 'door' ? '门口' : kind === 'take' ? '物资' : '货柜'
  const color = kind === 'threat' ? '#ff6b6b' : kind === 'door' ? '#65d6b4' : '#ffc65c'
  const align = ctx.textAlign
  ctx.textAlign = 'center'
  gfx.roundRect(ctx, x - 22, y, 44, 16, 6)
  fill(ctx, 'rgba(6,10,14,0.92)')
  ctx.fill()
  fill(ctx, color)
  rect(ctx, x - 18, y + 5, 4, 6)
  gfx.applyFont(ctx, 11, '700')
  fill(ctx, color)
  ctx.fillText(label, x + 4, y + 2)
  ctx.textAlign = align || 'left'
}

function drawFloor(ctx, x, y, w, h) {
  fill(ctx, gfx.vgrad(ctx, x, y, h, [
    [0, '#1c2632'],
    [0.55, '#121820'],
    [1, '#0a1016']
  ]))
  rect(ctx, x, y, w, h)
  fill(ctx, '#2a3644')
  rect(ctx, x, y, w, 6)
  metalEdge(ctx, x, y, w)
  fill(ctx, gfx.rgrad(ctx, x + w * 0.5, y + 8, Math.max(w, h) * 0.66, [
    [0, 'rgba(255,220,160,0.22)'],
    [0.4, 'rgba(255,198,92,0.08)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x, y, w, h)
  const tilesX = 5
  for (let i = 1; i < tilesX; i++) {
    fill(ctx, 'rgba(8,10,12,0.38)')
    rect(ctx, x + (w / tilesX) * i, y + 6, 2, h - 10)
    fill(ctx, 'rgba(200,220,235,0.1)')
    rect(ctx, x + (w / tilesX) * i + 2, y + 6, 1, h - 10)
  }
  ;[0.18, 0.4, 0.62, 0.82].forEach(ny => seam(ctx, x + 8, y + h * ny, w - 16))
  const stains = [
    [0.1, 0.42, 0.2, 0.1, 'rgba(8,12,16,0.28)'],
    [0.58, 0.18, 0.18, 0.09, 'rgba(20,28,36,0.32)'],
    [0.36, 0.68, 0.26, 0.08, 'rgba(90,140,160,0.1)'],
    [0.7, 0.72, 0.16, 0.07, 'rgba(255,198,92,0.08)']
  ]
  stains.forEach(s => {
    fill(ctx, s[4])
    rect(ctx, x + w * s[0], y + h * s[1], w * s[2], h * s[3])
  })
  iceBloom(ctx, x + w * 0.14, y + h * 0.1, w * 0.24, 10)
  iceBloom(ctx, x + w * 0.6, y + h * 0.48, w * 0.18, 8)
  frost(ctx, x + w * 0.72, y + h * 0.28, w * 0.16, 5)
  fill(ctx, gfx.rgrad(ctx, x + w * 0.5, y + h * 0.7, w * 0.2, [
    [0, 'rgba(255,220,160,0.16)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x + w * 0.34, y + h * 0.58, w * 0.32, h * 0.22)
  fill(ctx, 'rgba(186,214,230,0.06)')
  ;[0.28, 0.5, 0.72].forEach(nx => {
    gfx.line(ctx, x + w * nx, y + 4, x + w * 0.5, y + h * 0.92, 'rgba(186,214,230,0.12)', 1)
  })
  fill(ctx, gfx.hgrad(ctx, x, y, w * 0.22, [
    [0, 'rgba(0,0,0,0.46)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x, y, w * 0.22, h)
  fill(ctx, gfx.hgrad(ctx, x + w * 0.78, y, w * 0.22, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.5)']
  ]))
  rect(ctx, x + w * 0.78, y, w * 0.22, h)
}

function drawClutter(ctx, zone, x, y, w, h, tick) {
  if (zone === 'harbor' || zone === 'lift') {
    fill(ctx, 'rgba(0,0,0,0.28)')
    rect(ctx, x + 8, y + h * 0.28, 40, 8)
    fill(ctx, '#3a2e16')
    rect(ctx, x + 10, y + h * 0.12, 34, 22)
    rect(ctx, x + 16, y + h * 0.02, 26, 16)
    fill(ctx, '#c4924c')
    rect(ctx, x + 14, y + h * 0.12, 26, 4)
    fill(ctx, '#6a6e74')
    rect(ctx, x + 24, y + h * 0.06, 6, 16)
    frost(ctx, x + 12, y + h * 0.02, 22, 4)
    rivet(ctx, x + 14, y + h * 0.14)
    rivet(ctx, x + 36, y + h * 0.14)
    fill(ctx, 'rgba(200,220,255,0.12)')
    rect(ctx, x + w * 0.56, y + h * 0.74, 42, 5)
  }
  if (zone === 'thermal') {
    fill(ctx, '#2a1c18')
    rect(ctx, x + 8, y + 8, 14, h - 18)
    fill(ctx, '#ff8c50')
    rect(ctx, x + 11, y + 26, 8, 8)
    fill(ctx, 'rgba(255,140,80,0.22)')
    rect(ctx, x + 11, y + 18 - ((tick || 0) % 10), 8, 16)
  }
  if (zone === 'weather' || zone === 'aurora') {
    fill(ctx, '#15263a')
    rect(ctx, x + w - 26, y + 6, 12, h * 0.4)
    fill(ctx, 'rgba(101,169,255,0.35)')
    rect(ctx, x + w - 24, y + 2, 8, 8)
  }
  if (zone === 'core') {
    fill(ctx, '#152033')
    rect(ctx, x + w - 44, y + 8, 32, h * 0.4)
    fill(ctx, 'rgba(101,214,180,0.2)')
    rect(ctx, x + w - 38, y + 16, 20, 8)
    rect(ctx, x + w - 38, y + 30, 20, 8)
    fill(ctx, '#65d6b4')
    rect(ctx, x + w - 20, y + 18, 4, 4)
  }
}

function drawRoom(ctx, zone, box, tick) {
  const { x, y, w, h } = box
  const wall = h * ROOM_WALL
  fill(ctx, gfx.vgrad(ctx, x, y, wall, [
    [0, '#182028'],
    [0.55, '#121820'],
    [1, '#0e141c']
  ]))
  rect(ctx, x, y, w, wall)
  for (let i = 1; i < 6; i++) {
    const sx = x + (w / 6) * i
    fill(ctx, 'rgba(8,10,12,0.42)')
    rect(ctx, sx, y + 8, 2, wall - 10)
    fill(ctx, 'rgba(210,228,242,0.1)')
    rect(ctx, sx + 2, y + 8, 1, wall - 10)
  }
  fill(ctx, '#0c1218')
  rect(ctx, x, y, w, 8)
  metalEdge(ctx, x, y, w)
  const win = { x: x + w * 0.12, y: y + 10, w: w * 0.76, h: wall - 20 }
  drawZone(ctx, zone, win, tick)
  fill(ctx, 'rgba(159,212,255,0.08)')
  rect(ctx, win.x, win.y, win.w, win.h)
  iceBloom(ctx, win.x, win.y, win.w * 0.3, 10)
  iceBloom(ctx, win.x + win.w * 0.58, win.y + win.h - 12, win.w * 0.32, 10)
  fill(ctx, 'rgba(200,230,255,0.16)')
  ;[0.2, 0.46, 0.72].forEach(nx => {
    rect(ctx, win.x + win.w * nx, win.y + 4, 3, win.h * 0.58)
  })
  fill(ctx, '#1a2430')
  rect(ctx, win.x - 6, win.y - 6, win.w + 12, 6)
  rect(ctx, win.x - 6, win.y + win.h, win.w + 12, 8)
  rect(ctx, win.x - 6, win.y, 6, win.h)
  rect(ctx, win.x + win.w, win.y, 6, win.h)
  frost(ctx, win.x - 6, win.y - 7, win.w + 12, 5)
  rivet(ctx, win.x - 2, win.y - 4)
  rivet(ctx, win.x + win.w - 4, win.y - 4)
  rivet(ctx, win.x - 2, win.y + win.h - 2)
  rivet(ctx, win.x + win.w - 4, win.y + win.h - 2)
  fill(ctx, TINT[zone] || '#65d6b4')
  rect(ctx, win.x + win.w * 0.48, win.y - 6, 8, 6)
  fill(ctx, '#243040')
  rect(ctx, x + w * 0.46, y + 2, 8, 8)
  fill(ctx, 'rgba(255,198,92,0.42)')
  rect(ctx, x + w * 0.47, y + 3, 6, 6)
  drawFloor(ctx, x, y + wall, w, h - wall)
  const lx = x + w * 0.5
  const ly = y + wall
  fill(ctx, '#14161a')
  rect(ctx, lx - 2, y + 2, 4, wall - 6)
  fill(ctx, '#d4a84a')
  rect(ctx, lx - 12, ly - 6, 24, 7)
  fill(ctx, 'rgba(255,236,190,0.72)')
  rect(ctx, lx - 6, ly - 16, 12, 10)
  fill(ctx, gfx.rgrad(ctx, lx, ly + 6, w * 0.5, [
    [0, 'rgba(255,220,160,0.3)'],
    [0.42, 'rgba(255,198,92,0.1)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x + w * 0.16, ly, w * 0.68, (h - wall) * 0.82)
  gfx.circle(ctx, lx, ly + 14, 28, 'rgba(255,220,160,0.18)')
  fill(ctx, gfx.hgrad(ctx, x, y, 22, [
    [0, 'rgba(0,0,0,0.36)'],
    [1, 'rgba(0,0,0,0)']
  ]))
  rect(ctx, x, y, 22, h)
  fill(ctx, gfx.hgrad(ctx, x + w - 22, y, 22, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.4)']
  ]))
  rect(ctx, x + w - 22, y, 22, h)
  fill(ctx, '#2a3644')
  rect(ctx, x, ly - 3, w, 5)
  frost(ctx, x + 10, ly - 3, w - 20, 3)
  drawClutter(ctx, zone, x, y + wall, w, h - wall, tick)
}

function drawWalk(ctx, ax, ay, bx, by, tick) {
  const steps = 8
  for (let i = 1; i < steps; i++) {
    const t = i / steps
    const px = ax + (bx - ax) * t
    const py = ay + (by - ay) * t
    fill(ctx, i === ((tick || 0) % steps) ? 'rgba(101,214,180,0.55)' : 'rgba(101,214,180,0.18)')
    rect(ctx, px - 2, py - 2, 4, 4)
  }
}

function drawFight(ctx, ax, ay, bx, by, tick) {
  const t = tick || 0
  const fromA = (t % 6) < 3
  const sx = fromA ? ax : bx
  const sy = fromA ? ay - 26 : by - 26
  const ex = fromA ? bx : ax
  const ey = fromA ? by - 26 : ay - 26
  fill(ctx, fromA ? 'rgba(101,214,180,0.85)' : 'rgba(255,107,107,0.85)')
  rect(ctx, sx - 7, sy - 7, 14, 14)
  for (let i = 1; i < 7; i++) {
    const p = i / 7
    rect(ctx, sx + (ex - sx) * p - 2, sy + (ey - sy) * p - 2, 4, 3)
  }
  fill(ctx, 'rgba(255,198,92,0.75)')
  rect(ctx, ex - 5, ey - 5, 10, 10)
}

function drawPad(ctx, method, x, y, lit, hot) {
  fill(ctx, 'rgba(0,0,0,0.28)')
  rect(ctx, x - 18, y - 4, 36, 6)
  if (method === 'heli') {
    fill(ctx, lit ? '#2a4a40' : '#1a2430')
    rect(ctx, x - 16, y - 30, 32, 18)
    fill(ctx, '#1a2430')
    rect(ctx, x - 10, y - 24, 8, 8)
    rect(ctx, x + 2, y - 24, 8, 8)
    fill(ctx, hot ? '#ffc65c' : '#65d6b4')
    rect(ctx, x - 2, y - 44, 4, 16)
    rect(ctx, x - 18, y - 46, 36, 4)
    return
  }
  if (method === 'rocket') {
    fill(ctx, lit ? '#3a2e16' : '#1a2430')
    rect(ctx, x - 24, y - 24, 48, 18)
    fill(ctx, hot ? '#ffc65c' : '#65a9ff')
    rect(ctx, x - 20, y - 18, 8, 8)
    rect(ctx, x - 8, y - 18, 8, 8)
    rect(ctx, x + 4, y - 18, 8, 8)
    fill(ctx, '#1a1c20')
    rect(ctx, x + 16, y - 20, 6, 12)
    return
  }
  if (method === 'bag') {
    fill(ctx, lit ? '#3a2e16' : '#243040')
    rect(ctx, x - 20, y - 18, 40, 14)
    fill(ctx, '#1a1c20')
    rect(ctx, x - 16, y - 6, 8, 8)
    rect(ctx, x + 8, y - 6, 8, 8)
    fill(ctx, hot ? '#ffc65c' : '#65d6b4')
    rect(ctx, x - 6, y - 14, 12, 6)
    return
  }
  if (method === 'ambush') {
    drawPerson(ctx, x, y, 0, { hostile: true, facing: -1 })
    return
  }
  if (method === 'sneak') {
    drawPerson(ctx, x, y, 0, { facing: 1 })
    return
  }
  fill(ctx, lit ? '#1e4f43' : '#16332c')
  rect(ctx, x - 16, y - 24, 32, 20)
  fill(ctx, '#65d6b4')
  rect(ctx, x - 4, y - 16, 8, 8)
}

function drawToneMark(ctx, tone, x, y, size) {
  const s = Math.max(16, size || 22)
  const color = tone === 'fight' ? '#ff6b6b'
    : tone === 'safe' ? '#65d6b4'
    : tone === 'extract' ? '#65a9ff'
    : tone === 'lever' ? '#ffc65c'
    : '#ffc65c'
  gfx.roundRect(ctx, x, y, s, s, 5)
  fill(ctx, 'rgba(8,14,20,0.72)')
  ctx.fill()
  gfx.roundRect(ctx, x + 1, y + 1, s - 2, s - 2, 4)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  if (typeof ctx.stroke === 'function') ctx.stroke()
  fill(ctx, color)
  if (tone === 'fight') {
    rect(ctx, x + s * 0.42, y + 4, 4, s - 8)
    rect(ctx, x + 4, y + s * 0.4, s - 8, 4)
    return
  }
  if (tone === 'safe') {
    rect(ctx, x + 5, y + s * 0.55, s * 0.32, 4)
    rect(ctx, x + s * 0.28, y + s * 0.22, 4, s * 0.48)
    return
  }
  if (tone === 'extract') {
    rect(ctx, x + 4, y + s * 0.42, s - 8, 5)
    rect(ctx, x + s - 10, y + s * 0.28, 5, s * 0.44)
    return
  }
  if (tone === 'lever') {
    rect(ctx, x + 5, y + 4, 4, s - 8)
    rect(ctx, x + s - 9, y + 4, 4, s - 8)
    rect(ctx, x + 5, y + 6, s - 10, 4)
    return
  }
  rect(ctx, x + 4, y + 7, s - 8, s - 11)
  rect(ctx, x + 6, y + 4, s - 12, 4)
}

function drawStamp(ctx, kind, cx, cy, size) {
  const s = Math.max(14, size || 20)
  if (kind === 'loot') {
    gfx.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, 8)
    fill(ctx, 'rgba(42,36,16,0.94)')
    ctx.fill()
    fill(ctx, '#ffc65c')
    rect(ctx, cx - s * 0.48, cy - s * 0.28, s * 0.96, s * 0.7)
    fill(ctx, '#2a2410')
    rect(ctx, cx - 3, cy - s * 0.28, 6, s * 0.7)
    fill(ctx, '#65d6b4')
    rect(ctx, cx - s * 0.16, cy + 2, s * 0.22, 4)
    rect(ctx, cx, cy - s * 0.18, 4, s * 0.32)
    return
  }
  if (kind === 'extract') {
    gfx.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, 8)
    fill(ctx, 'rgba(18,36,56,0.94)')
    ctx.fill()
    fill(ctx, '#65a9ff')
    rect(ctx, cx - s * 0.5, cy - 3, s, 6)
    rect(ctx, cx + s * 0.18, cy - s * 0.32, 6, s * 0.64)
    return
  }
  if (kind === 'lever') {
    gfx.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, 8)
    fill(ctx, 'rgba(42,36,16,0.94)')
    ctx.fill()
    fill(ctx, '#ffc65c')
    rect(ctx, cx - s * 0.42, cy - s * 0.45, 5, s * 0.9)
    rect(ctx, cx + s * 0.22, cy - s * 0.45, 5, s * 0.9)
    rect(ctx, cx - s * 0.42, cy - s * 0.28, s * 0.84, 5)
    return
  }
  drawJudge(ctx, kind !== 'bad' && kind !== 'hit' && kind !== 'dead', cx, cy, s)
}

function drawJudge(ctx, ok, cx, cy, size) {
  const s = Math.max(16, size || 36)
  gfx.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, Math.min(10, s * 0.35))
  fill(ctx, ok ? 'rgba(18,52,40,0.94)' : 'rgba(72,18,24,0.94)')
  ctx.fill()
  gfx.roundRect(ctx, cx - s, cy - s, s * 2, s * 2, Math.min(10, s * 0.35))
  ctx.strokeStyle = ok ? '#65d6b4' : '#ff6b6b'
  ctx.lineWidth = 2
  if (typeof ctx.stroke === 'function') ctx.stroke()
  fill(ctx, ok ? '#65d6b4' : '#ff6b6b')
  if (ok) {
    rect(ctx, cx - s * 0.48, cy + 2, s * 0.38, 6)
    rect(ctx, cx - s * 0.16, cy - s * 0.38, 6, s * 0.58)
    return
  }
  for (let i = -3; i <= 3; i++) {
    rect(ctx, cx + i * (s * 0.12) - 2, cy + i * (s * 0.12) - 2, 5, 5)
    rect(ctx, cx + i * (s * 0.12) - 2, cy - i * (s * 0.12) - 2, 5, 5)
  }
}

function drawHudGlyph(ctx, kind, x, y, size) {
  const s = Math.max(10, size || 14)
  if (kind === 'ammo') {
    fill(ctx, '#c8d6e6')
    rect(ctx, x + s * 0.28, y + 1, s * 0.44, s - 2)
    fill(ctx, '#0a141c')
    rect(ctx, x + s * 0.34, y + 3, s * 0.32, 3)
    fill(ctx, '#65d6b4')
    rect(ctx, x + s * 0.42, y + 7, 3, s * 0.5)
    return
  }
  if (kind === 'med') {
    fill(ctx, '#65d6b4')
    rect(ctx, x + s * 0.38, y + 1, s * 0.24, s - 2)
    rect(ctx, x + 1, y + s * 0.38, s - 2, s * 0.24)
    return
  }
  if (kind === 'grid') {
    fill(ctx, '#9fd4ff')
    rect(ctx, x + 1, y + 1, s * 0.4, s * 0.4)
    rect(ctx, x + s * 0.54, y + 1, s * 0.4, s * 0.4)
    rect(ctx, x + 1, y + s * 0.54, s * 0.4, s * 0.4)
    rect(ctx, x + s * 0.54, y + s * 0.54, s * 0.4, s * 0.4)
    return
  }
  if (kind === 'card') {
    fill(ctx, '#ffc65c')
    rect(ctx, x + s * 0.18, y + 2, s * 0.64, s - 4)
    fill(ctx, '#2a2410')
    rect(ctx, x + s * 0.32, y + s * 0.28, s * 0.36, 3)
    return
  }
  if (kind === 'power') {
    fill(ctx, '#ffc65c')
    rect(ctx, x + 2, y + 2, 3, s - 4)
    rect(ctx, x + s - 5, y + 2, 3, s - 4)
    rect(ctx, x + 2, y + 3, s - 4, 3)
    return
  }
  fill(ctx, '#65d6b4')
  rect(ctx, x + 2, y + 2, s - 4, s - 4)
}

function drawLessonRail(ctx, box, steps, tick) {
  const { x, y, w, h } = box
  const n = Math.max(1, (steps || []).length)
  const gap = 6
  const unit = (w - gap * (n - 1)) / n
  const align = ctx.textAlign
  ctx.textAlign = 'left'
  steps.forEach((step, i) => {
    const sx = x + i * (unit + gap)
    const on = !!step.done
    const pulse = !on && i === steps.findIndex(item => !item.done)
    const glow = pulse ? 0.22 + 0.16 * Math.abs(Math.sin((tick || 0) * 0.28)) : 0
    gfx.roundRect(ctx, sx, y, unit, h, 8)
    fill(ctx, on ? '#1e4f43' : '#2a2410')
    ctx.fill()
    gfx.roundRect(ctx, sx, y, unit, h, 8)
    ctx.strokeStyle = on ? '#65d6b4' : '#ffc65c'
    ctx.lineWidth = pulse ? 2 : 1
    if (typeof ctx.stroke === 'function') ctx.stroke()
    if (glow) {
      fill(ctx, `rgba(255,198,92,${glow})`)
      rect(ctx, sx + 2, y + 2, unit - 4, h - 4)
    }
    gfx.applyFont(ctx, 11, '700')
    fill(ctx, on ? '#8ef0d0' : '#ffe08a')
    const label = `${i + 1} ${step.label || ''}`
    ctx.fillText(label, sx + 8, y + Math.max(4, (h - 11) / 2 - 1), unit - 14)
  })
  ctx.textAlign = align || 'left'
}

function drawKit(ctx, x, y, size, id) {
  if (id === 'full') {
    fill(ctx, '#2a4a40')
    rect(ctx, x, y + 4, size, size - 8)
    fill(ctx, '#65d6b4')
    rect(ctx, x + 4, y + 8, size - 8, 6)
    rect(ctx, x + size * 0.3, y, size * 0.4, 8)
    return
  }
  if (id === 'knife') {
    fill(ctx, '#3a2e16')
    rect(ctx, x + size * 0.15, y + size * 0.2, size * 0.7, size * 0.18)
    fill(ctx, '#ffc65c')
    rect(ctx, x + size * 0.42, y + size * 0.12, 5, size * 0.7)
    return
  }
  fill(ctx, '#1a3048')
  rect(ctx, x + 3, y + 6, size - 6, size - 10)
  fill(ctx, '#65a9ff')
  rect(ctx, x + 7, y + 10, size - 14, 5)
}

module.exports = {
  ROOM_WALL,
  TIER_COLOR,
  drawZone,
  drawCity,
  drawJobPlan,
  gem,
  drawItemIcon,
  drawMedal,
  drawKit,
  drawActor,
  drawProp,
  drawRoom,
  drawWalk,
  drawFight,
  drawPad,
  drawToneMark,
  drawJudge,
  drawStamp,
  drawPropTag,
  drawHudGlyph,
  drawLessonRail
}
