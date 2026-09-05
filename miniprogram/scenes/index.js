const engine = require('../core/engine')
const metaStore = require('../core/meta')
const ads = require('../utils/ads')
const { healthNotice } = require('../legal/documents')
const { COLORS, TYPE, INK, METAL, THEME } = require('../runtime/ui')
const stage = require('../runtime/stage')
const gfx = require('../runtime/gfx')

function drawCover(ui, v, tick) {
  const ctx = ui.ctx
  const w = v.width
  const h = v.height
  const t = tick || 0
  ctx.fillStyle = gfx.vgrad(ctx, 0, 0, h, [
    [0, METAL.well],
    [0.28, METAL.washTop],
    [0.62, COLORS.bg],
    [1, METAL.washBot]
  ])
  ctx.fillRect(0, 0, w, h)

  ctx.fillStyle = gfx.rgrad(ctx, w * 0.68, v.safe.top + 24, w * 0.7, [
    [0, 'rgba(159,212,255,0.18)'],
    [0.4, 'rgba(101,214,180,0.08)'],
    [1, 'rgba(0,0,0,0)']
  ])
  ctx.fillRect(0, 0, w, h * 0.55)

  gfx.quad(ctx, 0, v.safe.top + 28, w * 0.42, v.safe.top - 16, w, v.safe.top + 64,
    'rgba(101,214,180,0.16)')
  gfx.quad(ctx, 0, v.safe.top + 70, w * 0.58, v.safe.top + 24, w, v.safe.top + 110,
    'rgba(101,169,255,0.1)')

  const ridge = Math.round(h * 0.3)
  ctx.fillStyle = METAL.well
  ;[0.0, 0.22, 0.46, 0.7, 0.88].forEach((nx, i) => {
    ctx.fillRect(w * nx - 6, ridge - (18 + (i % 3) * 8), w * 0.26, 36)
  })
  ctx.fillStyle = COLORS.ice
  gfx.setAlpha(ctx, 0.14)
  ctx.fillRect(0, ridge + 8, w, 2)
  gfx.resetAlpha(ctx)

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
  towers.forEach((spec, i) => {
    const far = spec.h < 0.22
    const near = spec.h >= 0.36
    const x = w * spec.x
    const tw = w * spec.w
    const th = h * spec.h
    const ty = ground - th
    ctx.fillStyle = 'rgba(0,0,0,0.34)'
    ctx.fillRect(x + 3, ground - 5, tw, 6)
    if (near) {
      ctx.fillStyle = gfx.metalGrad(ctx, x, ty, th, METAL.steel)
      ctx.fillRect(x, ty, tw, th)
      ctx.fillStyle = gfx.vgrad(ctx, x + 2, ty, th, [
        [0, METAL.washTop],
        [1, METAL.well]
      ])
      ctx.fillRect(x + 2, ty + 5, tw - 4, th - 5)
    } else {
      ctx.fillStyle = far ? METAL.well : (i === 4 ? METAL.washTop : COLORS.panel)
      ctx.fillRect(x, ty, tw, th)
    }
    ctx.fillStyle = near ? COLORS.rim : METAL.well
    ctx.fillRect(x - 2, ty - 5, tw + 4, 5)
    if (near) {
      ctx.fillStyle = COLORS.ice
      gfx.setAlpha(ctx, 0.28)
      ctx.fillRect(x - 2, ty - 5, tw + 4, 1)
      gfx.resetAlpha(ctx)
      ctx.fillStyle = 'rgba(0,0,0,0.4)'
      ctx.fillRect(x - 2, ty, tw + 4, 2)
      ctx.fillStyle = COLORS.ice
      gfx.setAlpha(ctx, 0.22)
      for (let ry = 10; ry < th - 8; ry += 16) {
        ctx.fillRect(x + 3, ty + ry, 2, 2)
        ctx.fillRect(x + tw - 5, ty + ry, 2, 2)
      }
      gfx.resetAlpha(ctx)
    }
    ctx.fillStyle = i % 2 ? COLORS.gold : COLORS.accent
    gfx.setAlpha(ctx, near ? 0.48 : far ? 0.18 : 0.3)
    const step = far ? 14 : 11
    for (let row = 8; row < th - 10; row += step) {
      for (let col = 5; col < tw - 6; col += 8) {
        if ((row + col + i) % 3 === 0) ctx.fillRect(x + col, ty + row, near ? 3 : 2, 4)
      }
    }
    gfx.resetAlpha(ctx)
  })

  const mastX = w * 0.78
  const mastTop = ground - h * 0.42
  ctx.fillStyle = gfx.metalGrad(ctx, mastX, mastTop, h * 0.28, METAL.steel)
  ctx.fillRect(mastX, mastTop, 5, h * 0.28)
  ctx.fillStyle = COLORS.gold
  ctx.fillRect(w * 0.74, mastTop, w * 0.14, 4)
  ctx.fillStyle = INK.display
  gfx.setAlpha(ctx, 0.28)
  ctx.fillRect(w * 0.74, mastTop, w * 0.14, 1)
  gfx.resetAlpha(ctx)

  ctx.fillStyle = gfx.vgrad(ctx, 0, ground, h - ground, [
    [0, METAL.washTop],
    [0.22, COLORS.bg],
    [1, METAL.washBot]
  ])
  ctx.fillRect(0, ground, w, h - ground)
  ui.well(0, ground - 7, w, 16, {
    radius: 0,
    rim: COLORS.ice,
    metal: METAL.ice,
    bezel: 2,
    sheen: false
  })
  const gh = h - ground
  for (let i = 1; i < 5; i++) {
    ctx.fillStyle = 'rgba(0,0,0,0.36)'
    ctx.fillRect(0, ground + gh * (i / 5), w, 1)
    ctx.fillStyle = COLORS.ice
    gfx.setAlpha(ctx, 0.06)
    ctx.fillRect(0, ground + gh * (i / 5) + 1, w, 1)
    gfx.resetAlpha(ctx)
  }

  ctx.fillStyle = INK.display
  gfx.setAlpha(ctx, 0.5)
  for (let i = 0; i < 32; i++) {
    const sx = ((i * 97 + t * 2) % (w + 20)) - 10
    const sy = ((i * 53) % Math.max(40, ground - 20)) + 8
    ctx.fillRect(sx, sy, i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1)
  }
  ctx.fillStyle = COLORS.ice
  gfx.setAlpha(ctx, 0.16)
  for (let i = 0; i < 16; i++) {
    const fx = (i * 41 + t * 3) % (w + 40) - 20
    const fy = ground - 30 + ((i * 17 + t) % 24)
    ctx.fillRect(fx, fy, 18 + (i % 4) * 8, 6)
  }
  gfx.resetAlpha(ctx)
  gfx.grain(ctx, 0, 0, w, h, 11, 0.04)
  ctx.fillStyle = gfx.hgrad(ctx, 0, 0, 28, [
    [0, 'rgba(0,0,0,0.32)'],
    [1, 'rgba(0,0,0,0)']
  ])
  ctx.fillRect(0, 0, 28, h)
  ctx.fillStyle = gfx.hgrad(ctx, w - 28, 0, 28, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.34)']
  ])
  ctx.fillRect(w - 28, 0, 28, h)
  ctx.fillStyle = gfx.vgrad(ctx, 0, h - 130, 130, [
    [0, 'rgba(0,0,0,0)'],
    [1, 'rgba(0,0,0,0.4)']
  ])
  ctx.fillRect(0, h - 130, w, 130)
}

function createIndex(manager) {
  return {
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
      drawCover(ui, v, this.tick)
      const left = v.safe.left + 22
      const width = v.safe.right - v.safe.left - 44
      const top = v.safe.top + 18
      const plateH = 114

      ui.well(left - 4, top, width + 8, plateH, {
        rim: COLORS.gold,
        metal: METAL.ice,
        fill: METAL.well
      })
      ui.cta(v.safe.right - 90, top + 8, 72, 40, '设置', () => manager.go('settings'), {
        kind: 'ghost',
        size: TYPE.body
      })
      ui.chip(left + 8, top + 10, 156, 22, '北辰回收署 · 配给点', {
        fill: THEME.fill.ok,
        stroke: COLORS.accent,
        color: COLORS.accent,
        size: TYPE.micro,
        material: 'metal',
        metal: METAL.ok
      })
      ui.text('极夜回收线', left + 8, top + 38, TYPE.display, INK.display, '700', width - 88)
      ui.ctx.fillStyle = COLORS.gold
      ui.ctx.fillRect(left + 8, top + 76, 72, 2)
      ui.ctx.fillStyle = COLORS.ice
      gfx.setAlpha(ui.ctx, 0.22)
      ui.ctx.fillRect(left + 80, top + 76, 48, 1)
      gfx.resetAlpha(ui.ctx)
      ui.text('带东西活着出来', left + 8, top + 84, TYPE.lead, INK.lead, '700', width - 24)

      const mapH = Math.max(108, Math.min(156, v.safe.bottom - top - 310))
      const mapY = top + (this.meta.runs === 0 ? 172 : 216)
      const firstTrip = this.meta.runs === 0
      const missedLever = this.meta.runs >= 1 && this.lastReport && (this.lastReport.levers || 0) < 1
      const hallTarget = firstTrip || missedLever ? 'core' : ''
      ui.section(left, mapY - 22, width, firstTrip || missedLever ? '作业图 · 先合闸再索道' : '冻港作业图')
      ui.well(left - 4, mapY - 4, width + 8, mapH + 8, {
        rim: COLORS.ice,
        metal: METAL.ice
      })
      stage.drawJobPlan(ui.ctx, { x: left, y: mapY, w: width, h: mapH }, {
        current: 'harbor',
        tick: this.tick,
        target: hallTarget,
        reachable: { harbor: true, core: true, extract: !firstTrip && !missedLever }
      })
      const kit = engine.LOADOUTS[this.kit] || engine.LOADOUTS.half
      if (this.meta.runs === 0) {
        ui.text(`首趟配发${kit.name}，倒了不扣押金`, left, top + 120, TYPE.body, INK.lead, '600', width)
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
            size: TYPE.body,
            enabled: !!can[chip.id],
            fill: on ? THEME.fill.ok : COLORS.panelAlt,
            stroke: on ? COLORS.accent : COLORS.line,
            color: on ? INK.display : COLORS.text,
            sub: chip.sub,
            subColor: on ? INK.lead : INK.mute,
            metal: on ? METAL.ok : METAL.ice
          })
          stage.drawKit(ui.ctx, bx + 8, top + 132, 18, chip.id)
        })
        ui.text(kit.cost ? `本趟押 ${engine.fmtVal(kit.cost)}，活着退回` : '本趟零成本，倒了不亏押金',
          left, top + 176, TYPE.caption, INK.lead, '600', width)
      }

      const startY = Math.min(v.safe.bottom - 196, Math.max(mapY + mapH + 16, v.height * 0.54))
      const glow = 0.22 + 0.14 * Math.abs(Math.sin((this.tick || 0) / 4.2))
      ui.cta(left, startY, width, 64, '出发回收', () => this.start(), {
        glow: `rgba(101,214,180,${glow})`
      })

      ui.cta(left, startY + 76, (width - 10) / 2, 42, '仓库图鉴', () => manager.go('codex'), {
        kind: 'ghost',
        size: TYPE.body
      })
      ui.cta(left + (width - 10) / 2 + 10, startY + 76, (width - 10) / 2, 42, '协议说明', () => manager.go('legal'), {
        kind: 'ghost',
        size: TYPE.body
      })

      if (this.ad.configured && !this.ad.claimedToday) {
        ui.cta(left, startY - 52, width, 40, '看完视频：医疗补给 +1', () => this.claimAd(), {
          kind: 'gold',
          size: TYPE.body
        })
      } else if (this.ad.stock > 0) {
        ui.text(`待用医疗补给 ${this.ad.stock}`, left, startY - 28, TYPE.caption, COLORS.accent)
      }

      ui.text(`${engine.fmtVal(this.meta.balance)} 配给点  ·  图鉴 ${this.codex.owned}/${this.codex.total}`,
        left, v.safe.bottom - 52, TYPE.micro, INK.mute)
      ui.text(`${healthNotice.title} · 16+`, left, v.safe.bottom - 34, TYPE.micro, INK.legal)
      ui.text(healthNotice.lines[0], left, v.safe.bottom - 20, TYPE.legal, INK.legalDim)
      ui.text(healthNotice.lines[1], left, v.safe.bottom - 8, TYPE.legal, INK.legalDim)
    }
  }
}

createIndex.drawCover = drawCover
module.exports = createIndex
