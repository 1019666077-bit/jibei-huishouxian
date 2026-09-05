const gfx = require('./gfx')

const COLORS = {
  bg: '#061018',
  panel: '#101a26',
  panelAlt: '#162433',
  line: '#2a4156',
  rim: '#3d5c74',
  text: '#f4f8fc',
  body: '#c8d6e6',
  muted: '#9aafc2',
  accent: '#65d6b4',
  danger: '#ff6b6b',
  gold: '#ffc65c',
  blue: '#65a9ff',
  ice: '#9fd4ff'
}

const THEME = {
  radius: { panel: 12, button: 10, chip: 8, stamp: 14 },
  fill: {
    ice: '#10202c',
    gold: '#2a2410',
    danger: '#2c171b',
    ok: '#132820',
    extract: '#15273a'
  }
}

function copy(text) {
  return String(text == null ? '' : text)
}

function roundedRect(ctx, x, y, w, h, r) {
  gfx.roundRect(ctx, x, y, w, h, r)
}

function tidyCut(text) {
  const trimmed = String(text || '').replace(/[的了在与和及到向于·，、（(\s]+$/g, '')
  return trimmed.length >= 2 ? trimmed : String(text || '')
}

function ellipsize(ctx, text, maxWidth) {
  const source = copy(text)
  if (!maxWidth || maxWidth <= 0 || typeof ctx.measureText !== 'function') return source
  if (ctx.measureText(source).width <= maxWidth) return source
  let shown = source
  while (shown.length > 0 && ctx.measureText(`${shown}…`).width > maxWidth) {
    shown = shown.slice(0, -1)
  }
  shown = tidyCut(shown)
  if (!shown) shown = source.slice(0, 1)
  return `${shown}…`
}

function wrapLines(ctx, text, maxWidth) {
  const source = copy(text).split('\n')
  const lines = []
  source.forEach(part => {
    if (!part) {
      lines.push('')
      return
    }
    let line = ''
    for (const char of part) {
      const next = line + char
      if (line && ctx.measureText(next).width > maxWidth) {
        lines.push(line)
        line = char
      } else {
        line = next
      }
    }
    if (line) lines.push(line)
  })
  return lines
}

function tierColor(tier) {
  if (tier === 'red') return COLORS.danger
  if (tier === 'gold') return COLORS.gold
  if (tier === 'purple') return '#b48cff'
  if (tier === 'blue') return COLORS.blue
  if (tier === 'white') return '#c8d4de'
  return COLORS.accent
}

class UI {
  constructor(ctx) {
    this.ctx = ctx
    this.regions = []
    this.clip = null
  }

  begin(viewport) {
    this.viewport = viewport
    this.regions = []
    this.clip = null
    const ctx = this.ctx
    ctx.fillStyle = gfx.vgrad(ctx, 0, 0, viewport.height, [
      [0, '#07131e'],
      [0.45, '#0a1520'],
      [1, '#05090f']
    ])
    ctx.fillRect(0, 0, viewport.width, viewport.height)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
    gfx.noGlow(ctx)
    gfx.resetAlpha(ctx)
  }

  addHit(x, y, w, h, action, enabled = true) {
    if (!action || !enabled || w <= 0 || h <= 0) return
    let rect = { x, y, w, h, action }
    if (this.clip) {
      const right = Math.min(x + w, this.clip.x + this.clip.w)
      const bottom = Math.min(y + h, this.clip.y + this.clip.h)
      rect = {
        x: Math.max(x, this.clip.x),
        y: Math.max(y, this.clip.y),
        w: right - Math.max(x, this.clip.x),
        h: bottom - Math.max(y, this.clip.y),
        action
      }
    }
    if (rect.w > 2 && rect.h > 2) this.regions.push(rect)
  }

  hit(x, y) {
    for (let i = this.regions.length - 1; i >= 0; i--) {
      const r = this.regions[i]
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) {
        r.action()
        return true
      }
    }
    return false
  }

  withClip(rect, fn) {
    const ctx = this.ctx
    const old = this.clip
    this.clip = rect
    ctx.save()
    ctx.beginPath()
    ctx.rect(rect.x, rect.y, rect.w, rect.h)
    ctx.clip()
    fn()
    ctx.restore()
    this.clip = old
  }

  text(text, x, y, size = 14, color = COLORS.text, weight = 'normal', maxWidth) {
    const ctx = this.ctx
    gfx.applyFont(ctx, size, weight)
    ctx.fillStyle = color
    const shown = ellipsize(ctx, text, maxWidth)
    ctx.fillText(shown, x, y)
  }

  wrapped(text, x, y, maxWidth, options = {}) {
    const ctx = this.ctx
    const size = options.size || 14
    const lineHeight = options.lineHeight || Math.round(size * 1.55)
    const wrapW = Math.max(8, (maxWidth || 0) - 12)
    gfx.applyFont(ctx, size, options.weight || 'normal')
    ctx.fillStyle = options.color || COLORS.text
    const lines = wrapLines(ctx, text, wrapW)
    const limit = options.maxLines || lines.length
    lines.slice(0, limit).forEach((line, index) => {
      ctx.fillText(ellipsize(ctx, line, wrapW), x, y + index * lineHeight)
    })
    return Math.min(lines.length, limit) * lineHeight
  }

  panel(x, y, w, h, options = {}) {
    const ctx = this.ctx
    const radius = options.radius == null ? 12 : options.radius
    roundedRect(ctx, x, y, w, h, radius)
    ctx.fillStyle = options.fill || COLORS.panel
    ctx.fill()
    if (options.glow) {
      gfx.glow(ctx, options.glow, 10)
      roundedRect(ctx, x, y, w, h, radius)
      ctx.fill()
      gfx.noGlow(ctx)
    }
    if (options.stroke !== false) {
      ctx.strokeStyle = options.stroke || COLORS.line
      ctx.lineWidth = options.lineWidth || 1
      if (typeof ctx.stroke === 'function') ctx.stroke()
    }
    if (options.accent) {
      ctx.fillStyle = options.accent
      ctx.fillRect(x, y + 8, 4, Math.max(8, h - 16))
    }
    if (options.sheen !== false && h > 20) {
      ctx.fillStyle = 'rgba(186,220,255,0.06)'
      ctx.fillRect(x + 2, y + 2, w - 4, Math.min(14, h * 0.22))
    }
    if (options.rim) {
      ctx.fillStyle = options.rim
      ctx.fillRect(x + 10, y, Math.max(24, w - 20), 2)
    }
  }

  button(x, y, w, h, label, action, options = {}) {
    const enabled = options.enabled !== false
    this.panel(x, y, w, h, {
      fill: enabled ? (options.fill || COLORS.panelAlt) : '#0d141c',
      stroke: enabled ? (options.stroke || COLORS.line) : '#1b2633',
      radius: options.radius == null ? 10 : options.radius,
      glow: options.glow || null,
      sheen: true
    })
    const size = options.size || 14
    const ctx = this.ctx
    gfx.applyFont(ctx, size, options.weight || '600')
    const text = copy(label)
    const tw = Math.min(ctx.measureText(text).width, w - 20)
    ctx.fillStyle = enabled ? (options.color || COLORS.text) : '#536273'
    const ty = options.sub ? y + Math.max(6, (h - size) / 2 - 8) : y + (h - size) / 2 - 1
    ctx.fillText(text, x + (w - tw) / 2, ty, w - 20)
    if (options.sub) {
      gfx.applyFont(ctx, 11, '600')
      const sw = Math.min(ctx.measureText(options.sub).width, w - 20)
      ctx.fillStyle = enabled ? (options.subColor || COLORS.muted) : '#3d4a56'
      ctx.fillText(options.sub, x + (w - sw) / 2, ty + size + 4, w - 20)
    }
    this.addHit(x, y, w, h, action, enabled)
  }

  bar(x, y, w, h, ratio, fill, track) {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0))
    this.panel(x, y, w, h, { fill: track || '#13202c', stroke: false, radius: Math.min(4, h / 2), sheen: false })
    if (r > 0) {
      this.panel(x, y, Math.max(3, Math.round(w * r)), h, {
        fill: fill || COLORS.accent,
        stroke: false,
        radius: Math.min(4, h / 2),
        sheen: false
      })
    }
  }

  meter(x, y, w, label, value, ratio, fill) {
    this.text(label, x, y, 11, COLORS.body, '700')
    gfx.applyFont(this.ctx, 16, '700')
    const num = copy(value)
    const nw = this.ctx.measureText(num).width
    this.text(num, x + w - nw, y - 2, 16, fill || COLORS.text, '700')
    this.bar(x, y + 17, w, 10, ratio, fill || COLORS.accent, '#071018')
  }

  scrollbar(rect, scroll) {
    if (!scroll || scroll.max <= 0 || !rect) return
    const trackW = 5
    const x = rect.x + rect.w - 9
    const y = rect.y + 6
    const h = Math.max(24, rect.h - 12)
    const thumbH = Math.max(28, Math.round(h * (rect.h / (rect.h + scroll.max))))
    const thumbY = y + (h - thumbH) * scroll.progress()
    this.panel(x, y, trackW, h, { fill: '#0a141c', stroke: '#2a4156', radius: 3, sheen: false })
    this.panel(x, thumbY, trackW, thumbH, { fill: COLORS.accent, stroke: false, radius: 3, sheen: false })
  }

  chip(x, y, w, h, label, options = {}) {
    this.panel(x, y, w, h, {
      fill: options.fill || '#14202c',
      stroke: options.stroke || COLORS.line,
      radius: options.radius == null ? 8 : options.radius,
      glow: options.glow || null,
      sheen: false
    })
    const size = options.size || 11
    gfx.applyFont(this.ctx, size, options.weight || '700')
    const text = copy(label)
    const tw = Math.min(this.ctx.measureText(text).width, w - 12)
    this.ctx.fillStyle = options.color || COLORS.text
    this.ctx.fillText(text, x + (w - tw) / 2, y + (h - size) / 2 - 1, w - 12)
    if (options.action) this.addHit(x, y, w, h, options.action, options.enabled !== false)
  }

  section(x, y, w, title, color) {
    this.ctx.fillStyle = color || COLORS.accent
    this.ctx.fillRect(x, y + 4, 3, 12)
    this.text(title, x + 10, y, 13, color || COLORS.gold, '700', w - 12)
    return y + 20
  }

  header(title, subtitle, onBack) {
    const v = this.viewport
    const top = v.safe.top + 10
    if (onBack) this.button(v.safe.left + 12, top, 64, 40, '返回', onBack, { size: 14 })
    const x = onBack ? v.safe.left + 86 : v.safe.left + 18
    this.text(title, x, top + 1, 22, COLORS.text, '700')
    if (subtitle) this.text(subtitle, x, top + 29, 11, COLORS.muted)
    return top + 58
  }

  divider(x, y, w) {
    this.ctx.fillStyle = COLORS.line
    this.ctx.fillRect(x, y, w, 1)
    this.ctx.fillStyle = 'rgba(101,214,180,0.12)'
    this.ctx.fillRect(x, y, Math.min(48, w), 1)
  }
}

module.exports = { UI, COLORS, THEME, copy, wrapLines, tierColor }
