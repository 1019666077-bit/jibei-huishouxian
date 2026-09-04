// 画布小工具：微信真机优先，模拟器或缺接口时退回矩形。
const FONT = 'PingFang SC, Microsoft YaHei, sans-serif'

function can(ctx, name) {
  return !!(ctx && typeof ctx[name] === 'function')
}

function font(size, weight) {
  return `${weight || 'normal'} ${Math.max(8, Math.round(size))}px ${FONT}`
}

function applyFont(ctx, size, weight) {
  ctx.font = font(size, weight)
}

function setAlpha(ctx, a) {
  if (ctx && 'globalAlpha' in ctx) ctx.globalAlpha = a
}

function resetAlpha(ctx) {
  if (ctx && 'globalAlpha' in ctx) ctx.globalAlpha = 1
}

function vgrad(ctx, x, y, h, stops) {
  if (can(ctx, 'createLinearGradient')) {
    const g = ctx.createLinearGradient(x, y, x, y + h)
    stops.forEach(pair => g.addColorStop(pair[0], pair[1]))
    return g
  }
  return stops[stops.length - 1][1]
}

function hgrad(ctx, x, y, w, stops) {
  if (can(ctx, 'createLinearGradient')) {
    const g = ctx.createLinearGradient(x, 0, x + w, 0)
    stops.forEach(pair => g.addColorStop(pair[0], pair[1]))
    return g
  }
  return stops[stops.length - 1][1]
}

function rgrad(ctx, x, y, r, stops) {
  if (can(ctx, 'createRadialGradient')) {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r)
    stops.forEach(pair => g.addColorStop(pair[0], pair[1]))
    return g
  }
  return stops[0][1]
}

function fill(ctx, color) {
  ctx.fillStyle = color
}

function rect(ctx, x, y, w, h) {
  ctx.fillRect(x, y, w, h)
}

function roundRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r || 0, w / 2, h / 2))
  if (can(ctx, 'roundRect')) {
    ctx.beginPath()
    ctx.roundRect(x, y, w, h, radius)
    return
  }
  if (!can(ctx, 'arcTo')) {
    ctx.beginPath()
    ctx.rect(x, y, w, h)
    return
  }
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
}

function circle(ctx, x, y, r, color) {
  if (can(ctx, 'arc')) {
    ctx.beginPath()
    ctx.arc(x, y, r, 0, Math.PI * 2)
    if (color) ctx.fillStyle = color
    ctx.fill()
    return
  }
  if (color) ctx.fillStyle = color
  ctx.fillRect(x - r, y - r, r * 2, r * 2)
}

function strokeCircle(ctx, x, y, r, color, width) {
  if (!can(ctx, 'arc') || !can(ctx, 'stroke')) {
    ctx.fillStyle = color
    ctx.fillRect(x - r, y - 1, r * 2, width || 2)
    return
  }
  ctx.beginPath()
  ctx.arc(x, y, r, 0, Math.PI * 2)
  ctx.strokeStyle = color
  ctx.lineWidth = width || 2
  ctx.stroke()
}

function line(ctx, x1, y1, x2, y2, color, width) {
  if (can(ctx, 'lineTo') && can(ctx, 'stroke')) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.lineTo(x2, y2)
    ctx.strokeStyle = color
    ctx.lineWidth = width || 1
    ctx.stroke()
    return
  }
  const steps = 8
  ctx.fillStyle = color
  for (let i = 0; i <= steps; i++) {
    const t = i / steps
    ctx.fillRect(x1 + (x2 - x1) * t - 1, y1 + (y2 - y1) * t - 1, width || 2, width || 2)
  }
}

function quad(ctx, x1, y1, cx, cy, x2, y2, color) {
  if (can(ctx, 'quadraticCurveTo')) {
    ctx.beginPath()
    ctx.moveTo(x1, y1)
    ctx.quadraticCurveTo(cx, cy, x2, y2)
    ctx.lineTo(x2, y2 + 8)
    ctx.lineTo(x1, y1 + 8)
    ctx.closePath()
    ctx.fillStyle = color
    ctx.fill()
    return
  }
  ctx.fillStyle = color
  ctx.fillRect(x1, Math.min(y1, cy, y2), x2 - x1, 10)
}

function glow(ctx, color, blur) {
  if (!ctx) return
  if ('shadowColor' in ctx) ctx.shadowColor = color
  if ('shadowBlur' in ctx) ctx.shadowBlur = blur || 8
}

function noGlow(ctx) {
  if (!ctx) return
  if ('shadowBlur' in ctx) ctx.shadowBlur = 0
  if ('shadowColor' in ctx) ctx.shadowColor = 'transparent'
}

module.exports = {
  FONT,
  can,
  font,
  applyFont,
  setAlpha,
  resetAlpha,
  vgrad,
  hgrad,
  rgrad,
  fill,
  rect,
  roundRect,
  circle,
  strokeCircle,
  line,
  quad,
  glow,
  noGlow
}
