const engine = require('../core/engine')
const metaStore = require('../core/meta')
const ads = require('../utils/ads')
const { healthNotice } = require('../legal/documents')
const { COLORS } = require('../runtime/ui')
const stage = require('../runtime/stage')

function drawCover(ctx, v, tick) {
  const w = v.width
  const h = v.height
  if (typeof ctx.createLinearGradient === 'function') {
    const sky = ctx.createLinearGradient(0, 0, 0, h)
    sky.addColorStop(0, '#07101c')
    sky.addColorStop(0.42, '#14304a')
    sky.addColorStop(0.72, '#0c1a28')
    sky.addColorStop(1, '#070b12')
    ctx.fillStyle = sky
  } else {
    ctx.fillStyle = '#0b1522'
  }
  ctx.fillRect(0, 0, w, h)

  if (typeof ctx.createLinearGradient === 'function') {
    const aurora = ctx.createLinearGradient(w * 0.1, v.safe.top, w * 0.9, v.safe.top + 180)
    aurora.addColorStop(0, 'rgba(101,214,180,0)')
    aurora.addColorStop(0.5, 'rgba(101,214,180,0.22)')
    aurora.addColorStop(1, 'rgba(101,169,255,0)')
    ctx.fillStyle = aurora
    ctx.beginPath()
    ctx.moveTo(0, v.safe.top + 36)
    ctx.quadraticCurveTo(w * 0.45, v.safe.top - 10, w, v.safe.top + 70)
    ctx.lineTo(w, v.safe.top + 120)
    ctx.quadraticCurveTo(w * 0.5, v.safe.top + 40, 0, v.safe.top + 90)
    ctx.closePath()
    ctx.fill()
  }

  const ground = Math.min(v.safe.bottom - 168, h * 0.58)
  const towers = [
    { x: 0.04, w: 0.09, h: 0.22 },
    { x: 0.14, w: 0.07, h: 0.16 },
    { x: 0.23, w: 0.12, h: 0.34 },
    { x: 0.37, w: 0.08, h: 0.2 },
    { x: 0.48, w: 0.16, h: 0.42 },
    { x: 0.66, w: 0.1, h: 0.26 },
    { x: 0.78, w: 0.14, h: 0.31 },
    { x: 0.93, w: 0.08, h: 0.18 }
  ]
  towers.forEach((t, i) => {
    const x = w * t.x
    const tw = w * t.w
    const th = h * t.h
    ctx.fillStyle = i === 4 ? '#152433' : '#101c2a'
    ctx.fillRect(x, ground - th, tw, th)
    ctx.fillStyle = i % 2 ? 'rgba(255,198,92,0.35)' : 'rgba(101,214,180,0.28)'
    for (let row = 8; row < th - 10; row += 11) {
      for (let col = 5; col < tw - 6; col += 8) {
        if ((row + col + i) % 3 === 0) ctx.fillRect(x + col, ground - th + row, 3, 4)
      }
    }
  })
  ctx.fillStyle = '#0a121c'
  ctx.fillRect(0, ground, w, h - ground)
  ctx.fillStyle = 'rgba(101,214,180,0.08)'
  ctx.fillRect(0, ground - 18, w, 18)

  const t = tick || 0
  ctx.fillStyle = 'rgba(230,240,255,0.55)'
  for (let i = 0; i < 28; i++) {
    const sx = ((i * 97 + t * 2) % (w + 20)) - 10
    const sy = ((i * 53) % Math.max(40, ground - 20)) + 8
    ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
  }
  ctx.fillStyle = 'rgba(200,220,255,0.18)'
  for (let i = 0; i < 16; i++) {
    const fx = (i * 41 + t * 3) % (w + 40) - 20
    const fy = ground - 30 + ((i * 17 + t) % 24)
    ctx.fillRect(fx, fy, 18 + (i % 4) * 8, 6)
  }
}

module.exports = manager => ({
  enter() {
    this.reload()
    this.tick = 0
    if (this.breath) clearInterval(this.breath)
    this.breath = setInterval(() => {
      this.tick += 1
      manager.requestRender()
    }, 120)
  },

  leave() {
    if (this.breath) {
      clearInterval(this.breath)
      this.breath = null
    }
  },

  onHide() {
    if (this.breath) {
      clearInterval(this.breath)
      this.breath = null
    }
  },

  onShow() {
    this.reload()
    if (!this.breath) {
      this.breath = setInterval(() => {
        this.tick += 1
        manager.requestRender()
      }, 120)
    }
    manager.requestRender()
  },

  reload() {
    this.meta = metaStore.load()
    this.codex = metaStore.codexView(this.meta)
    this.ad = ads.status()
    this.kit = this.meta.runs === 0
      ? (metaStore.affordable(this.meta).half ? 'half' : 'knife')
      : metaStore.preferredLoadout(this.meta)
  },

  selectKit(id) {
    if (!metaStore.affordable(this.meta)[id]) return
    this.kit = id
    this.meta.lastLoadout = id
    metaStore.save(this.meta)
    manager.requestRender()
  },

  start() {
    const feel = require('../runtime/feel')
    this.meta.lastLoadout = this.kit
    metaStore.save(this.meta)
    feel.vibrate('ok')
    manager.go('run')
  },

  claimAd() {
    ads.show().then(() => {
      this.reload()
      manager.requestRender()
      wx.showToast({ title: '医疗补给 +1', icon: 'none' })
    }).catch(error => {
      this.reload()
      manager.requestRender()
      wx.showToast({ title: error.message || '视频暂不可用', icon: 'none' })
    })
  },

  render(ui, v) {
    drawCover(ui.ctx, v, this.tick)
    const left = v.safe.left + 22
    const width = v.safe.right - v.safe.left - 44
    const top = v.safe.top + 18

    ui.button(v.safe.right - 86, top, 64, 32, '设置', () => manager.go('settings'), {
      size: 12, radius: 8
    })

    ui.text('极夜回收线', left, top + 28, 34, COLORS.text, '700')
    ui.text('带东西活着出来', left, top + 72, 18, COLORS.gold, '700')
    const mapH = Math.max(120, Math.min(188, v.safe.bottom - top - 280))
    const mapY = top + (this.meta.runs === 0 ? 118 : 178)
    ui.text('冻港地图', left, mapY - 20, 13, COLORS.gold, '600')
    stage.drawCity(ui.ctx, { x: left, y: mapY, w: width, h: mapH }, {
      current: 'harbor',
      tick: this.tick,
      marker: 'pulse'
    })
    const kit = engine.LOADOUTS[this.kit] || engine.LOADOUTS.half
    if (this.meta.runs === 0) {
      ui.text(`首趟配发${kit.name}，倒了不扣押金`, left, top + 100, 13, COLORS.gold, '600', width)
    } else {
      const can = metaStore.affordable(this.meta)
      const chips = [
        { id: 'knife', label: '轻装 0' },
        { id: 'half', label: '标准 15万' },
        { id: 'full', label: '重装 45万' }
      ]
      const cw = (width - 16) / 3
      chips.forEach((chip, i) => {
        const on = this.kit === chip.id
        ui.button(left + i * (cw + 8), top + 100, cw, 36, chip.label, () => this.selectKit(chip.id), {
          size: 12,
          enabled: !!can[chip.id],
          fill: on ? '#1e4f43' : '#172333',
          stroke: on ? COLORS.accent : COLORS.line,
          color: on ? '#ffffff' : COLORS.text
        })
      })
      ui.text(kit.cost ? `本趟押 ${engine.fmtVal(kit.cost)}，活着退回` : '本趟零成本，倒了不亏押金',
        left, top + 144, 12, COLORS.gold, '600', width)
    }

    const startY = Math.min(v.safe.bottom - 196, Math.max(mapY + mapH + 14, v.height * 0.52))
    const glow = 0.55 + 0.45 * Math.sin((this.tick || 0) / 4.2)
    const startFill = `rgb(${Math.round(22 + 18 * glow)},${Math.round(90 + 30 * glow)},${Math.round(75 + 20 * glow)})`
    ui.button(left, startY, width, 62, '出发', () => this.start(), {
      fill: startFill,
      stroke: COLORS.accent,
      color: '#ffffff',
      size: 22
    })

    ui.button(left, startY + 74, (width - 10) / 2, 40, '仓库', () => manager.go('codex'), { size: 13 })
    ui.button(left + (width - 10) / 2 + 10, startY + 74, (width - 10) / 2, 40, '协议', () => manager.go('legal'), { size: 13 })

    if (this.ad.configured && !this.ad.claimedToday) {
      ui.button(left, startY - 52, width, 40, '看完视频：医疗补给 +1', () => this.claimAd(), {
        fill: '#342a17',
        stroke: COLORS.gold,
        color: COLORS.gold,
        size: 13
      })
    } else if (this.ad.stock > 0) {
      ui.text(`待用医疗补给 ${this.ad.stock}`, left, startY - 28, 12, COLORS.accent)
    }

    ui.text(`${engine.fmtVal(this.meta.balance)} 配给点  ·  图鉴 ${this.codex.owned}/${this.codex.total}`,
      left, v.safe.bottom - 52, 11, COLORS.muted)
    ui.text(`${healthNotice.title} · 16+`, left, v.safe.bottom - 34, 10, '#5d6e80')
    ui.text(healthNotice.lines[0], left, v.safe.bottom - 20, 9, '#4e5d6d')
    ui.text(healthNotice.lines[1], left, v.safe.bottom - 8, 9, '#4e5d6d')
  }
})
