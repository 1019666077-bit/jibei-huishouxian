const engine = require('../core/engine')
const metaStore = require('../core/meta')
const ads = require('../utils/ads')
const { healthNotice } = require('../legal/documents')
const { COLORS } = require('../runtime/ui')
const stage = require('../runtime/stage')
const gfx = require('../runtime/gfx')

function drawCover(ctx, v, tick) {
  const w = v.width
  const h = v.height
  ctx.fillStyle = gfx.vgrad(ctx, 0, 0, h, [
    [0, '#06101c'],
    [0.38, '#12344c'],
    [0.7, '#0b1c2a'],
    [1, '#05090f']
  ])
  ctx.fillRect(0, 0, w, h)

  gfx.quad(ctx, 0, v.safe.top + 28, w * 0.42, v.safe.top - 16, w, v.safe.top + 64,
    'rgba(101,214,180,0.2)')
  gfx.quad(ctx, 0, v.safe.top + 70, w * 0.58, v.safe.top + 24, w, v.safe.top + 110,
    'rgba(101,169,255,0.12)')

  const ground = Math.min(v.safe.bottom - 168, h * 0.58)
  const towers = [
    { x: 0.03, w: 0.1, h: 0.2 },
    { x: 0.13, w: 0.07, h: 0.15 },
    { x: 0.22, w: 0.13, h: 0.36 },
    { x: 0.37, w: 0.08, h: 0.2 },
    { x: 0.47, w: 0.17, h: 0.44 },
    { x: 0.66, w: 0.1, h: 0.26 },
    { x: 0.78, w: 0.14, h: 0.32 },
    { x: 0.93, w: 0.08, h: 0.18 }
  ]
  towers.forEach((t, i) => {
    const x = w * t.x
    const tw = w * t.w
    const th = h * t.h
    ctx.fillStyle = i === 4 ? '#173044' : '#101c2a'
    ctx.fillRect(x, ground - th, tw, th)
    ctx.fillStyle = '#0a1218'
    ctx.fillRect(x - 2, ground - th - 5, tw + 4, 5)
    ctx.fillStyle = i % 2 ? 'rgba(255,198,92,0.38)' : 'rgba(101,214,180,0.3)'
    for (let row = 8; row < th - 10; row += 11) {
      for (let col = 5; col < tw - 6; col += 8) {
        if ((row + col + i) % 3 === 0) ctx.fillRect(x + col, ground - th + row, 3, 4)
      }
    }
  })
  ctx.fillStyle = '#243040'
  ctx.fillRect(w * 0.78, ground - h * 0.42, 5, h * 0.28)
  ctx.fillStyle = '#ffc65c'
  ctx.fillRect(w * 0.74, ground - h * 0.42, w * 0.14, 4)
  ctx.fillStyle = gfx.vgrad(ctx, 0, ground, h - ground, [
    [0, 'rgba(40,80,110,0.45)'],
    [1, '#070b12']
  ])
  ctx.fillRect(0, ground, w, h - ground)
  ctx.fillStyle = 'rgba(101,214,180,0.1)'
  ctx.fillRect(0, ground - 16, w, 16)

  const t = tick || 0
  ctx.fillStyle = 'rgba(230,240,255,0.55)'
  for (let i = 0; i < 32; i++) {
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
    this.lastReport = null
    try { this.lastReport = wx.getStorageSync('last_report') || null } catch (e) { this.lastReport = null }
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

    ui.button(v.safe.right - 86, top, 64, 36, '设置', () => manager.go('settings'), {
      size: 13, radius: 8
    })

    ui.chip(left, top + 22, 148, 22, '北辰回收署 · 配给点', {
      fill: 'rgba(12,28,32,0.72)',
      stroke: COLORS.accent,
      color: COLORS.accent,
      size: 11
    })
    ui.text('极夜回收线', left, top + 52, 34, COLORS.text, '700')
    ui.text('带东西活着出来', left, top + 94, 18, COLORS.gold, '700')
    const mapH = Math.max(108, Math.min(168, v.safe.bottom - top - 300))
    const mapY = top + (this.meta.runs === 0 ? 148 : 198)
    ui.section(left, mapY - 22, width, '冻港作业图')
    ui.panel(left - 4, mapY - 4, width + 8, mapH + 8, {
      fill: '#071018',
      stroke: '#2a4156',
      radius: 12,
      sheen: false
    })
    const missedLever = this.meta.runs >= 1 && this.lastReport && (this.lastReport.levers || 0) < 1
    stage.drawCity(ui.ctx, { x: left, y: mapY, w: width, h: mapH }, {
      current: 'harbor',
      tick: this.tick,
      marker: 'pulse',
      target: missedLever ? 'core' : ''
    })
    if (missedLever) {
      ui.chip(left + 8, mapY + 6, Math.min(width - 16, 248), 22, '冷却舱·压缩机房可合闸开索道', {
        fill: '#2a2410',
        stroke: COLORS.gold,
        color: COLORS.gold,
        size: 11
      })
    }
    const kit = engine.LOADOUTS[this.kit] || engine.LOADOUTS.half
    if (this.meta.runs === 0) {
      ui.text(`首趟配发${kit.name}，倒了不扣押金`, left, top + 120, 13, COLORS.gold, '600', width)
    } else {
      const can = metaStore.affordable(this.meta)
      const chips = [
        { id: 'knife', label: '轻装', sub: '0' },
        { id: 'half', label: '标准', sub: '15万' },
        { id: 'full', label: '重装', sub: '45万' }
      ]
      const cw = (width - 16) / 3
      chips.forEach((chip, i) => {
        const on = this.kit === chip.id
        const bx = left + i * (cw + 8)
        ui.button(bx, top + 122, cw, 48, chip.label, () => this.selectKit(chip.id), {
          size: 14,
          enabled: !!can[chip.id],
          fill: on ? '#1e4f43' : '#172333',
          stroke: on ? COLORS.accent : COLORS.line,
          color: on ? '#ffffff' : COLORS.text,
          sub: chip.sub,
          subColor: on ? COLORS.gold : COLORS.muted
        })
        stage.drawKit(ui.ctx, bx + 8, top + 132, 18, chip.id)
      })
      ui.text(kit.cost ? `本趟押 ${engine.fmtVal(kit.cost)}，活着退回` : '本趟零成本，倒了不亏押金',
        left, top + 176, 12, COLORS.gold, '600', width)
    }

    const startY = Math.min(v.safe.bottom - 196, Math.max(mapY + mapH + 16, v.height * 0.54))
    const glow = 0.55 + 0.45 * Math.sin((this.tick || 0) / 4.2)
    const startFill = `rgb(${Math.round(22 + 18 * glow)},${Math.round(90 + 30 * glow)},${Math.round(75 + 20 * glow)})`
    ui.button(left, startY, width, 64, '出发回收', () => this.start(), {
      fill: startFill,
      stroke: COLORS.accent,
      color: '#ffffff',
      size: 22,
      glow: 'rgba(101,214,180,0.25)'
    })

    ui.button(left, startY + 76, (width - 10) / 2, 42, '仓库图鉴', () => manager.go('codex'), { size: 14 })
    ui.button(left + (width - 10) / 2 + 10, startY + 76, (width - 10) / 2, 42, '协议说明', () => manager.go('legal'), { size: 14 })

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
