const { UI } = require('./ui')

class SceneManager {
  constructor(canvas, ctx, viewport, factories) {
    this.canvas = canvas
    this.ctx = ctx
    this.viewport = viewport
    this.factories = factories
    this.ui = new UI(ctx)
    this.scene = null
    this.sceneName = ''
    this.pendingFrame = false
    this.touch = null
    this.fx = { shake: 0, flash: 0, color: '', label: '', until: 0, bits: [] }
    this.fxTimer = null
  }

  pulse(kind, label) {
    const feel = require('./feel')
    feel.vibrate(kind)
    this.fx.kind = kind
    this.fx.label = label || ''
    this.fx.until = Date.now() + ((kind === 'dead' || kind === 'win' || kind === 'loot') ? 820 : 420)
    if (kind === 'hit' || kind === 'dead') {
      this.fx.shake = kind === 'dead' ? 1 : 0.85
      this.fx.flash = 1
      this.fx.color = 'rgba(255,80,80,0.32)'
    } else if (kind === 'loot' || kind === 'win') {
      this.fx.shake = 0.2
      this.fx.flash = 0.9
      this.fx.color = 'rgba(255,198,92,0.28)'
    } else if (kind === 'heal') {
      this.fx.shake = 0
      this.fx.flash = 0.7
      this.fx.color = 'rgba(101,214,180,0.26)'
    } else {
      this.fx.shake = 0.12
      this.fx.flash = 0.45
      this.fx.color = 'rgba(101,214,180,0.16)'
    }
    this.fx.bits = feel.burst(kind, this.viewport.width, this.viewport.height).concat(this.fx.bits || []).slice(0, 48)
    this.tickFx()
  }

  tickFx() {
    if (this.fxTimer) return
    const step = () => {
      this.fxTimer = null
      this.fx.shake *= 0.7
      this.fx.flash *= 0.76
      if (this.fx.shake < 0.04) this.fx.shake = 0
      if (this.fx.flash < 0.03) this.fx.flash = 0
      this.fx.bits = (this.fx.bits || []).filter(bit => {
        bit.x += bit.vx
        bit.y += bit.vy
        bit.vy += 0.18
        bit.life -= 0.045
        return bit.life > 0
      })
      this.requestRender()
      if (this.fx.shake || this.fx.flash || (this.fx.bits && this.fx.bits.length) || Date.now() < this.fx.until) {
        this.fxTimer = setTimeout(step, 32)
      } else {
        this.fx.label = ''
      }
    }
    this.fxTimer = setTimeout(step, 32)
    this.requestRender()
  }

  go(name, params) {
    const factory = this.factories[name]
    if (!factory) throw new Error(`未知场景：${name}`)
    if (this.scene && this.scene.leave) this.scene.leave()
    this.sceneName = name
    this.scene = factory(this)
    if (this.scene.enter) this.scene.enter(params || {})
    if (name === 'run') {
      const Scroll = require('./scroll')
      Scroll.resetView(this.canvas)
    }
    this.requestRender()
  }

  resize(viewport) {
    this.viewport = viewport
    if (this.scene && this.scene.resize) this.scene.resize(viewport)
    this.requestRender()
  }

  requestRender() {
    if (this.pendingFrame) return
    this.pendingFrame = true
    const draw = () => {
      this.pendingFrame = false
      this.render()
    }
    if (this.canvas && typeof this.canvas.requestAnimationFrame === 'function') {
      this.canvas.requestAnimationFrame(draw)
    } else {
      setTimeout(draw, 16)
    }
  }

  render() {
    if (!this.scene) return
    const dpr = this.viewport.dpr
    const shake = this.fx.shake || 0
    const ox = shake ? (Math.random() - 0.5) * 12 * shake : 0
    const oy = shake ? (Math.random() - 0.5) * 10 * shake : 0
    if (typeof this.ctx.setTransform === 'function') {
      this.ctx.setTransform(dpr, 0, 0, dpr, ox * dpr, oy * dpr)
    }
    this.ui.begin(this.viewport)
    try {
      this.scene.render(this.ui, this.viewport)
    } catch (e) {
      this.ctx.fillStyle = '#080c13'
      this.ctx.fillRect(0, 0, this.viewport.width, this.viewport.height)
      this.ctx.fillStyle = '#ffc65c'
      this.ctx.font = require('./gfx').font(16)
      this.ctx.fillText('界面暂时无法绘制，请返回重进。', 24, 80)
    }
    if (this.fx.bits && this.fx.bits.length) {
      const ctx = this.ctx
      this.fx.bits.forEach(bit => {
        ctx.globalAlpha = Math.max(0, bit.life)
        ctx.fillStyle = bit.color
        ctx.fillRect(bit.x, bit.y, 3, 3)
      })
      ctx.globalAlpha = 1
    }
    if (this.fx.flash > 0.02) {
      const ctx = this.ctx
      ctx.fillStyle = this.fx.color || 'rgba(255,80,80,0.2)'
      ctx.globalAlpha = this.fx.flash
      ctx.fillRect(-20, -20, this.viewport.width + 40, this.viewport.height + 40)
      ctx.globalAlpha = 1
    }
    if (this.fx.label && this.fx.flash > 0.15) {
      const ctx = this.ctx
      ctx.font = require('./gfx').font(28, '700')
      ctx.fillStyle = this.fx.kind === 'hit' || this.fx.kind === 'dead' ? '#ff8a8a' : '#ffe08a'
      ctx.textAlign = 'center'
      ctx.globalAlpha = Math.min(1, this.fx.flash + 0.2)
      ctx.fillText(this.fx.label, this.viewport.width / 2, this.viewport.height * 0.38)
      ctx.globalAlpha = 1
      ctx.textAlign = 'left'
    }
  }

  pointerStart(point) {
    this.touch = { x: point.x, y: point.y, moved: false }
    try {
      if (this.scene && this.scene.pointerStart) this.scene.pointerStart(point)
    } catch (e) { /* 单次触摸失败不中断会话 */ }
  }

  pointerMove(point) {
    if (!this.touch) return
    if (Math.abs(point.x - this.touch.x) > 8 || Math.abs(point.y - this.touch.y) > 8) {
      this.touch.moved = true
    }
    try {
      if (this.scene && this.scene.pointerMove && this.scene.pointerMove(point)) {
        this.requestRender()
      }
    } catch (e) { /* ignore */ }
  }

  pointerEnd(point) {
    if (!this.touch) return
    try {
      if (this.scene && this.scene.pointerEnd) this.scene.pointerEnd(point)
    } catch (e) { /* ignore */ }
    const dx = point.x - this.touch.x
    const dy = point.y - this.touch.y
    const moved = this.touch.moved || Math.hypot(dx, dy) > 10
    if (!moved) {
      try { this.ui.hit(point.x, point.y) } catch (e) { /* ignore */ }
    }
    this.touch = null
  }

  wheel(delta, point) {
    try {
      if (this.scene && typeof this.scene.wheel === 'function') {
        const moved = this.scene.wheel(delta, point)
        if (moved) this.requestRender()
        return !!moved
      }
      const scroll = this.scene && this.scene.scroll
      const area = this.scene && (this.scene.dragRect || this.scene.rect)
      if (!scroll || typeof scroll.wheel !== 'function') return false
      if (point && area) {
        if (point.x < area.x || point.x > area.x + area.w ||
            point.y < area.y || point.y > area.y + area.h) return false
      }
      if (scroll.wheel(delta)) {
        this.requestRender()
        return true
      }
    } catch (e) { /* 滚轮失败不中断会话 */ }
    return false
  }

  onShow() {
    if (this.scene && this.scene.onShow) this.scene.onShow()
    this.requestRender()
  }

  onHide() {
    if (this.scene && this.scene.onHide) this.scene.onHide()
  }
}

module.exports = SceneManager
