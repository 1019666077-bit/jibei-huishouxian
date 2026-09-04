const COLORS = {
  bg: '#080c13',
  panel: '#111925',
  panelAlt: '#182333',
  line: '#26364a',
  text: '#eef4fa',
  muted: '#8fa3b8',
  accent: '#65d6b4',
  danger: '#ff6b6b',
  gold: '#ffc65c',
  blue: '#65a9ff'
}

function copy(text) {
  return String(text == null ? '' : text)
}

function roundedRect(ctx, x, y, w, h, r) {
  const radius = Math.max(0, Math.min(r || 0, w / 2, h / 2))
  ctx.beginPath()
  ctx.moveTo(x + radius, y)
  ctx.arcTo(x + w, y, x + w, y + h, radius)
  ctx.arcTo(x + w, y + h, x, y + h, radius)
  ctx.arcTo(x, y + h, x, y, radius)
  ctx.arcTo(x, y, x + w, y, radius)
  ctx.closePath()
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
    ctx.fillStyle = COLORS.bg
    ctx.fillRect(0, 0, viewport.width, viewport.height)
    ctx.textBaseline = 'top'
    ctx.textAlign = 'left'
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
    ctx.font = `${weight} ${size}px sans-serif`
    ctx.fillStyle = color
    ctx.fillText(copy(text), x, y, maxWidth)
  }

  wrapped(text, x, y, maxWidth, options = {}) {
    const ctx = this.ctx
    const size = options.size || 14
    const lineHeight = options.lineHeight || Math.round(size * 1.55)
    ctx.font = `${options.weight || 'normal'} ${size}px sans-serif`
    ctx.fillStyle = options.color || COLORS.text
    const lines = wrapLines(ctx, text, maxWidth)
    const limit = options.maxLines || lines.length
    lines.slice(0, limit).forEach((line, index) => {
      let shown = line
      if (index === limit - 1 && lines.length > limit) shown = line.slice(0, -1) + '…'
      ctx.fillText(shown, x, y + index * lineHeight)
    })
    return Math.min(lines.length, limit) * lineHeight
  }

  panel(x, y, w, h, options = {}) {
    const ctx = this.ctx
    roundedRect(ctx, x, y, w, h, options.radius == null ? 12 : options.radius)
    ctx.fillStyle = options.fill || COLORS.panel
    ctx.fill()
    if (options.stroke !== false) {
      ctx.strokeStyle = options.stroke || COLORS.line
      ctx.lineWidth = 1
      ctx.stroke()
    }
  }

  button(x, y, w, h, label, action, options = {}) {
    const enabled = options.enabled !== false
    this.panel(x, y, w, h, {
      fill: enabled ? (options.fill || COLORS.panelAlt) : '#111720',
      stroke: enabled ? (options.stroke || COLORS.line) : '#1b2633',
      radius: options.radius == null ? 10 : options.radius
    })
    const size = options.size || 14
    const ctx = this.ctx
    ctx.font = `${options.weight || '600'} ${size}px sans-serif`
    const text = copy(label)
    const tw = Math.min(ctx.measureText(text).width, w - 20)
    ctx.fillStyle = enabled ? (options.color || COLORS.text) : '#536273'
    ctx.fillText(text, x + (w - tw) / 2, y + (h - size) / 2 - 1, w - 20)
    this.addHit(x, y, w, h, action, enabled)
  }

  bar(x, y, w, h, ratio, fill, track) {
    const r = Math.max(0, Math.min(1, Number(ratio) || 0))
    this.panel(x, y, w, h, { fill: track || '#1a2430', stroke: false, radius: 3 })
    if (r > 0) {
      this.panel(x, y, Math.max(3, Math.round(w * r)), h, { fill: fill || COLORS.accent, stroke: false, radius: 3 })
    }
  }

  header(title, subtitle, onBack) {
    const v = this.viewport
    const top = v.safe.top + 10
    if (onBack) this.button(v.safe.left + 12, top, 58, 36, '返回', onBack, { size: 13 })
    const x = onBack ? v.safe.left + 82 : v.safe.left + 18
    this.text(title, x, top + 1, 22, COLORS.text, '700')
    if (subtitle) this.text(subtitle, x, top + 29, 11, COLORS.muted)
    return top + 58
  }

  divider(x, y, w) {
    this.ctx.fillStyle = COLORS.line
    this.ctx.fillRect(x, y, w, 1)
  }
}

module.exports = { UI, COLORS, copy, wrapLines }
