// 局内场景：只用矩形和简单路径，模拟器缺接口时也能画。
const { ZONE_POS, ZONE_SHORT } = require('./present')

const ROOM_WALL = 0.36
const TINT = {
  harbor: '#65d6b4',
  weather: '#65a9ff',
  thermal: '#ff8c50',
  lift: '#ffc65c',
  core: '#65d6b4',
  aurora: '#7ee0c4',
  extract: '#65d6b4'
}

function fill(ctx, color) {
  ctx.fillStyle = color
}

function rect(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, h)
}

function windows(ctx, x, y, w, h, tint, seed) {
  fill(ctx, tint)
  for (let row = 4; row < h - 6; row += 7) {
    for (let col = 3; col < w - 4; col += 6) {
      if ((row + col + seed) % 3 === 0) rect(ctx, x + col, y + row, 3, 4)
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

function drawHarbor(ctx, box, tick) {
  const { x, y, w, h } = box
  fill(ctx, '#0b1622')
  rect(ctx, x, y, w, h)
  fill(ctx, 'rgba(70,120,150,0.28)')
  rect(ctx, x, y + h * 0.62, w, h * 0.38)
  fill(ctx, 'rgba(200,220,240,0.12)')
  for (let i = 0; i < 5; i++) rect(ctx, x, y + h * (0.66 + i * 0.06), w, 2)
  fill(ctx, '#132433')
  for (let i = 0; i < 5; i++) {
    const cx = x + w * (0.06 + i * 0.18)
    const ch = h * (0.28 + (i % 3) * 0.1)
    rect(ctx, cx, y + h * 0.62 - ch, w * 0.14, ch)
    windows(ctx, cx, y + h * 0.62 - ch, w * 0.14, ch, i % 2 ? 'rgba(101,214,180,0.35)' : 'rgba(255,198,92,0.28)', i)
  }
  fill(ctx, '#243040')
  rect(ctx, x + w * 0.72, y + h * 0.18, 6, h * 0.44)
  fill(ctx, '#ffc65c')
  rect(ctx, x + w * 0.7, y + h * 0.18, w * 0.18, 5)
  fill(ctx, 'rgba(230,240,255,0.5)')
  for (let i = 0; i < 18; i++) {
    rect(ctx, x + ((i * 37 + (tick || 0) * 2) % w), y + 8 + (i * 19) % (h * 0.5), 2, 2)
  }
}

function drawWeather(ctx, box, tick) {
  const { x, y, w, h } = box
  fill(ctx, '#0a1420')
  rect(ctx, x, y, w, h)
  ;[0.16, 0.42, 0.68].forEach((tx, i) => {
    const tw = w * (0.09 + i * 0.01)
    const th = h * (0.46 + i * 0.12)
    fill(ctx, '#15263a')
    rect(ctx, x + w * tx, y + h * 0.78 - th, tw, th)
    windows(ctx, x + w * tx, y + h * 0.78 - th, tw, th, 'rgba(101,169,255,0.4)', i)
    fill(ctx, 'rgba(101,169,255,0.55)')
    rect(ctx, x + w * tx + tw / 2 - 2, y + h * 0.78 - th - 12, 4, 12)
  })
  fill(ctx, 'rgba(101,214,180,0.14)')
  rect(ctx, x, y + h * 0.16 + ((tick || 0) % 12), w, 5)
}

function drawThermal(ctx, box, tick) {
  const { x, y, w, h } = box
  fill(ctx, '#120e10')
  rect(ctx, x, y, w, h)
  fill(ctx, '#2a1c18')
  for (let i = 0; i < 4; i++) {
    rect(ctx, x, y + h * (0.2 + i * 0.16), w, 12)
    fill(ctx, '#ff8c50')
    rect(ctx, x + w * (0.12 + i * 0.2), y + h * (0.2 + i * 0.16) - 4, 8, 8)
    fill(ctx, '#2a1c18')
  }
  const steam = (tick || 0) % 18
  fill(ctx, 'rgba(255,140,80,0.22)')
  for (let i = 0; i < 6; i++) {
    rect(ctx, x + w * (0.1 + i * 0.14), y + h * 0.28 - steam, 8, 20)
  }
}

function drawLift(ctx, box) {
  const { x, y, w, h } = box
  fill(ctx, '#0c1018')
  rect(ctx, x, y, w, h)
  fill(ctx, '#1b2430')
  rect(ctx, x + w * 0.16, y + 10, 10, h - 20)
  rect(ctx, x + w * 0.78, y + 10, 10, h - 20)
  fill(ctx, '#243040')
  rect(ctx, x + w * 0.2, y + h * 0.38, w * 0.6, 18)
  for (let i = 0; i < 8; i++) {
    fill(ctx, i % 2 ? '#ffc65c' : '#1a1c20')
    rect(ctx, x + w * 0.22 + i * (w * 0.07), y + h * 0.38, w * 0.07, 6)
  }
  fill(ctx, 'rgba(255,198,92,0.35)')
  rect(ctx, x + w * 0.38, y + h * 0.18, w * 0.24, 12)
}

function drawCore(ctx, box) {
  const { x, y, w, h } = box
  fill(ctx, '#0b121c')
  rect(ctx, x, y, w, h)
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
    windows(ctx, x + w * r[0], y + h * r[1], w * r[2], h * r[3], 'rgba(101,214,180,0.2)', i)
  })
  fill(ctx, 'rgba(101,214,180,0.22)')
  rect(ctx, x + w * 0.46, y + h * 0.08, w * 0.08, h * 0.84)
}

function drawAurora(ctx, box, tick) {
  const { x, y, w, h } = box
  fill(ctx, '#071018')
  rect(ctx, x, y, w, h)
  fill(ctx, 'rgba(101,214,180,0.18)')
  rect(ctx, x, y + h * 0.1 + ((tick || 0) % 8), w, 12)
  fill(ctx, 'rgba(101,169,255,0.14)')
  rect(ctx, x, y + h * 0.26, w, 8)
  fill(ctx, '#142436')
  rect(ctx, x + w * 0.36, y + h * 0.16, w * 0.28, h * 0.72)
  windows(ctx, x + w * 0.36, y + h * 0.16, w * 0.28, h * 0.72, 'rgba(255,198,92,0.28)', 2)
  fill(ctx, ((tick || 0) % 8) < 4 ? '#ffc65c' : '#65d6b4')
  rect(ctx, x + w * 0.47, y + h * 0.1, 8, 8)
}

function drawExtract(ctx, box) {
  const { x, y, w, h } = box
  fill(ctx, '#0c1410')
  rect(ctx, x, y, w, h)
  fill(ctx, '#1a2a22')
  rect(ctx, x + w * 0.08, y + h * 0.58, w * 0.84, 14)
  fill(ctx, 'rgba(101,214,180,0.35)')
  rect(ctx, x + w * 0.58, y + h * 0.2, w * 0.28, h * 0.36)
  fill(ctx, '#65d6b4')
  for (let i = 0; i < 3; i++) {
    rect(ctx, x + w * (0.18 + i * 0.12), y + h * 0.7, 10, 4)
  }
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
    fill(ctx, 'rgba(186,214,230,0.22)')
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

  if (state.current) frame(ctx, px - s * 0.72, py - s * 1.08, s * 1.44, s * 1.2, '#65d6b4')
  else if (state.reach) frame(ctx, px - s * 0.68, py - s * 1.02, s * 1.36, s * 1.12, 'rgba(255,198,92,0.7)')
}

function drawCityDots(ctx, box, options = {}) {
  const { x, y, w, h } = box
  const tick = options.tick || 0
  fill(ctx, options.bg || '#071018')
  rect(ctx, x, y, w, h)
  fill(ctx, 'rgba(70,120,150,0.2)')
  rect(ctx, x, y + h * 0.34, w * 0.28, h * 0.24)
  const links = [
    ['harbor', 'thermal'], ['harbor', 'lift'], ['weather', 'thermal'],
    ['thermal', 'core'], ['harbor', 'core'], ['lift', 'core'],
    ['core', 'aurora'], ['weather', 'aurora'], ['lift', 'extract']
  ]
  fill(ctx, 'rgba(186,214,230,0.28)')
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
  Object.keys(ZONE_POS).forEach(key => {
    const p = ZONE_POS[key]
    const px = x + p.x * w
    const py = y + p.y * h
    const here = options.current === key
    const sz = here ? 8 : 5
    fill(ctx, here ? (options.hot ? '#ff6b6b' : '#65d6b4') : (TINT[key] || '#65d6b4'))
    rect(ctx, px - sz / 2, py - sz / 2, sz, sz)
    if (here) {
      const pulse = 4 + (tick % 4)
      fill(ctx, 'rgba(101,214,180,0.35)')
      rect(ctx, px - pulse, py - pulse, pulse * 2, pulse * 2)
    }
  })
}

function drawCity(ctx, box, options = {}) {
  const { x, y, w, h } = box
  if (options.compact || h < 110) {
    drawCityDots(ctx, box, options)
    return
  }
  const tick = options.tick || 0
  fill(ctx, options.bg || '#071018')
  rect(ctx, x, y, w, h)
  fill(ctx, 'rgba(70,120,150,0.16)')
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
  ctx.font = h > 140 ? '11px sans-serif' : '9px sans-serif'
  Object.keys(ZONE_POS).forEach(key => {
    const p = ZONE_POS[key]
    const px = x + p.x * w
    const py = y + p.y * h
    const current = options.current === key
    const reach = !options.reachable || options.reachable[key]
    drawSite(ctx, key, px, py, size, {
      current,
      reach,
      dim: !current && !reach,
      tick
    })
    fill(ctx, 'rgba(8,12,18,0.72)')
    rect(ctx, px - 22, py + 6, 44, 14)
    fill(ctx, current ? '#65d6b4' : reach ? '#eef4fa' : '#6a7a88')
    ctx.fillText(ZONE_SHORT[key] || key, px, py + 8)
  })
  fill(ctx, '#8fa3b8')
  ctx.font = '10px sans-serif'
  ctx.fillText('北', x + w * 0.5, y + 4)
  ctx.textAlign = align || 'left'
  ctx.font = font || '14px sans-serif'
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

function gem(ctx, x, y, size, color) {
  fill(ctx, color)
  rect(ctx, x, y + size * 0.22, size, size * 0.56)
  fill(ctx, color)
  rect(ctx, x + size * 0.18, y, size * 0.64, size)
  fill(ctx, 'rgba(255,255,255,0.35)')
  rect(ctx, x + 3, y + 3, Math.max(2, size / 4), Math.max(2, size / 4))
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
  fill(ctx, 'rgba(0,0,0,0.35)')
  rect(ctx, x - 12, y - 4, 24, 6)
  fill(ctx, '#1a1c20')
  rect(ctx, x - 8 + step, y - 8 + bob, 7, 8)
  rect(ctx, x + 1 - step, y - 8 + bob, 7, 8)
  fill(ctx, dark)
  rect(ctx, x - 7 + step, y - 18 + bob, 6, 16)
  rect(ctx, x + 1 - step, y - 18 + bob, 6, 16)
  fill(ctx, body)
  rect(ctx, x - 9, y - 34 + bob, 18, 18)
  fill(ctx, dark)
  rect(ctx, facing > 0 ? x - 13 : x + 6, y - 30 + bob, 8, 12)
  fill(ctx, '#1a2430')
  rect(ctx, x - 9, y - 24 + bob, 18, 3)
  fill(ctx, skin)
  rect(ctx, x - 6, y - 48 + bob, 12, 14)
  fill(ctx, body)
  rect(ctx, x - 7, y - 50 + bob, 14, 8)
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

function drawCrate(ctx, x, y, lit, hot) {
  fill(ctx, 'rgba(0,0,0,0.3)')
  rect(ctx, x - 26, y - 4, 52, 8)
  const wood = hot ? '#d4b06a' : lit ? '#8f6a36' : '#3a424c'
  fill(ctx, wood)
  rect(ctx, x - 24, y - 34, 48, 34)
  fill(ctx, lit ? '#6a4e28' : '#2a3038')
  for (let i = 0; i < 5; i++) rect(ctx, x - 24, y - 34 + i * 7, 48, 2)
  fill(ctx, hot ? '#eee0b0' : '#6a6e74')
  rect(ctx, x - 4, y - 34, 8, 34)
  rect(ctx, x - 24, y - 18, 48, 3)
  fill(ctx, 'rgba(220,235,255,0.18)')
  rect(ctx, x - 24, y - 34, 14, 8)
  fill(ctx, hot ? '#ffc65c' : '#c4a056')
  rect(ctx, x - 5, y - 22, 10, 10)
  fill(ctx, '#1a1c20')
  rect(ctx, x - 1, y - 18, 3, 5)
}

function drawDoor(ctx, x, y, lit, hot) {
  fill(ctx, lit ? '#1a2e28' : '#121820')
  rect(ctx, x - 24, y - 56, 48, 56)
  fill(ctx, hot ? '#0a1814' : '#070b10')
  rect(ctx, x - 18, y - 50, 36, 46)
  fill(ctx, lit ? '#65d6b4' : '#3d5a52')
  rect(ctx, x - 24, y - 56, 48, 5)
  rect(ctx, x - 24, y - 56, 5, 56)
  rect(ctx, x + 19, y - 56, 5, 56)
  fill(ctx, hot ? '#ffc65c' : '#65d6b4')
  rect(ctx, x + 8, y - 30, 6, 6)
  fill(ctx, 'rgba(101,214,180,0.16)')
  rect(ctx, x - 16, y - 4, 32, 10)
}

function drawLoot(ctx, x, y, lit, hot) {
  fill(ctx, 'rgba(0,0,0,0.28)')
  rect(ctx, x - 16, y - 4, 32, 6)
  fill(ctx, '#243040')
  rect(ctx, x - 14, y - 12, 28, 10)
  fill(ctx, '#1a2430')
  rect(ctx, x - 12, y - 10, 24, 3)
  gem(ctx, x - 11, y - 38, 22, hot || lit ? '#ffc65c' : '#65d6b4')
}

function drawProp(ctx, kind, x, y, lit, tick, hot) {
  if (kind === 'threat') {
    drawPerson(ctx, x, y, tick, { hostile: true, facing: -1, walking: !!hot })
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

function drawFloor(ctx, x, y, w, h) {
  fill(ctx, '#121820')
  rect(ctx, x, y, w, h)
  fill(ctx, '#0c1218')
  for (let i = 1; i < 8; i++) rect(ctx, x, y + (h * i) / 8, w, 2)
  for (let i = 1; i < 7; i++) {
    const inset = (i - 3) * 10
    rect(ctx, x + (w * i) / 7 + inset, y, 2, h)
  }
  fill(ctx, '#1a2430')
  rect(ctx, x, y, w, 6)
  fill(ctx, 'rgba(200,220,240,0.08)')
  rect(ctx, x + w * 0.12, y + h * 0.7, w * 0.28, 8)
  rect(ctx, x + w * 0.62, y + h * 0.82, w * 0.22, 6)
}

function drawClutter(ctx, zone, x, y, w, h, tick) {
  if (zone === 'harbor' || zone === 'lift') {
    fill(ctx, '#3a2e16')
    rect(ctx, x + 10, y + h * 0.16, 32, 20)
    rect(ctx, x + 16, y + h * 0.06, 24, 16)
    fill(ctx, '#6a6e74')
    rect(ctx, x + 24, y + h * 0.1, 6, 14)
    fill(ctx, 'rgba(200,220,255,0.12)')
    rect(ctx, x + w * 0.52, y + h * 0.72, 48, 6)
  }
  if (zone === 'thermal') {
    fill(ctx, '#2a1c18')
    rect(ctx, x + 8, y + 8, 12, h - 18)
    fill(ctx, '#ff8c50')
    rect(ctx, x + 10, y + 24, 8, 8)
    fill(ctx, 'rgba(255,140,80,0.22)')
    rect(ctx, x + 10, y + 18 - ((tick || 0) % 10), 8, 16)
  }
  if (zone === 'weather' || zone === 'aurora') {
    fill(ctx, '#15263a')
    rect(ctx, x + w - 24, y + 6, 10, h * 0.42)
    fill(ctx, 'rgba(101,169,255,0.35)')
    rect(ctx, x + w - 22, y + 2, 6, 8)
  }
  if (zone === 'core') {
    fill(ctx, '#152033')
    rect(ctx, x + w - 40, y + 10, 28, h * 0.38)
    fill(ctx, 'rgba(101,214,180,0.22)')
    for (let i = 0; i < 5; i++) rect(ctx, x + w - 36, y + 16 + i * 10, 20, 4)
  }
}

function drawRoom(ctx, zone, box, tick) {
  const { x, y, w, h } = box
  const wall = h * ROOM_WALL
  fill(ctx, '#101820')
  rect(ctx, x, y, w, wall)
  fill(ctx, '#0c1218')
  rect(ctx, x, y, w, 8)
  const win = { x: x + w * 0.14, y: y + 12, w: w * 0.72, h: wall - 22 }
  drawZone(ctx, zone, win, tick)
  fill(ctx, 'rgba(8,12,18,0.2)')
  rect(ctx, win.x, win.y, win.w, win.h)
  fill(ctx, '#1a2430')
  rect(ctx, win.x - 6, win.y - 6, win.w + 12, 6)
  rect(ctx, win.x - 6, win.y + win.h, win.w + 12, 8)
  rect(ctx, win.x - 6, win.y, 6, win.h)
  rect(ctx, win.x + win.w, win.y, 6, win.h)
  fill(ctx, TINT[zone] || '#65d6b4')
  rect(ctx, win.x + win.w * 0.48, win.y - 6, 8, 6)
  fill(ctx, '#243040')
  rect(ctx, x + w * 0.46, y + 2, 8, 8)
  fill(ctx, 'rgba(255,198,92,0.35)')
  rect(ctx, x + w * 0.47, y + 3, 6, 6)
  drawFloor(ctx, x, y + wall, w, h - wall)
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

module.exports = {
  ROOM_WALL,
  drawZone,
  drawCity,
  gem,
  drawActor,
  drawProp,
  drawRoom,
  drawWalk,
  drawFight,
  drawPad
}
