const engine = require('../core/engine')
const Scroll = require('../runtime/scroll')
const { COLORS, wrapLines, tierColor } = require('../runtime/ui')
const stage = require('../runtime/stage')
const gfx = require('../runtime/gfx')

module.exports = manager => ({
  enter(params) {
    this.scroll = new Scroll()
    this.report = params.report || null
    if (!this.report) {
      try { this.report = wx.getStorageSync('last_report') || null } catch (e) { this.report = null }
    }
    if (!this.report) {
      manager.go('index')
      return
    }
    const r = this.report
    r.causeChain = r.causeChain || []
    r.retryPlans = r.retryPlans || []
    r.lootItems = r.lootItems || []
    r.lostItems = r.lostItems || []
    r.medals = r.medals || []
    if (typeof manager.pulse === 'function') {
      manager.pulse(r.escaped ? 'win' : 'dead', r.escaped ? '活着出来了' : '没能回来')
    }
  },

  again(plan) {
    try {
      if (plan) {
        wx.setStorageSync('retry_preset', {
          planId: plan.id,
          loadout: plan.loadout,
          goal: plan.goal,
          cause: this.report.causeTag || ''
        })
      } else {
        wx.removeStorageSync('retry_preset')
      }
    } catch (e) { /* 无存储时仍可普通重开 */ }
    manager.go('run')
  },

  pointerStart(point) {
    if (this.rect && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.h) this.scroll.start(point.y)
  },
  pointerMove(point) { return this.scroll.move(point.y) },
  pointerEnd() { this.scroll.end() },

  planCard(ui, x, y, w, plan) {
    const ctx = ui.ctx
    ctx.font = gfx.font(14, '700')
    const titleLines = wrapLines(ctx, plan.title, w - 24)
    ctx.font = gfx.font(12)
    const goalLines = wrapLines(ctx, plan.goal || '', w - 24)
    const h = 46 + titleLines.length * 20 + goalLines.length * 17
    ui.panel(x, y, w, h, { fill: '#15273a', stroke: COLORS.blue, accent: COLORS.blue })
    ui.wrapped(plan.title, x + 14, y + 10, w - 24, {
      size: 14, lineHeight: 20, weight: '700', color: COLORS.text
    })
    let ty = y + 12 + titleLines.length * 20
    ui.wrapped(plan.goal || '', x + 14, ty, w - 24, {
      size: 12, lineHeight: 17, color: COLORS.muted
    })
    ty += goalLines.length * 17 + 7
    ui.text('按此方案重开', x + 14, ty, 12, COLORS.accent, '700')
    ui.addHit(x, y, w, h, () => this.again(plan))
    return h
  },

  render(ui, v) {
    if (!this.report) return
    const headerBottom = ui.header('行动结算', '本地战报 · 不上传、不生成编号', () => manager.go('index'))
    const toolbarH = 96
    this.rect = {
      x: v.safe.left + 10,
      y: headerBottom + 4,
      w: v.safe.right - v.safe.left - 20,
      h: v.safe.bottom - toolbarH - headerBottom - 8
    }
    const r = this.report
    ui.withClip(this.rect, () => {
      const x = this.rect.x + 4
      const w = this.rect.w - 8
      let y = this.rect.y + 8 - this.scroll.offset
      const start = y
      const win = !!r.escaped
      const ratingColor = r.rating === 'S' ? COLORS.danger : r.rating === 'A' ? COLORS.gold : COLORS.ice
      const profit = r.netProfit || 0
      const failLine = !win && r.causeChain[0] ? r.causeChain[0] : ''
      const lootStrip = win ? (r.lootItems || []).slice(0, 8) : []
      const headH = win ? (lootStrip.length ? 244 : 204) : (failLine ? 286 : 204)
      ui.panel(x, y, w, headH, {
        fill: win ? '#10241c' : '#2a1418',
        stroke: win ? COLORS.accent : COLORS.danger,
        glow: win ? 'rgba(101,214,180,0.18)' : 'rgba(255,107,107,0.16)',
        rim: win ? COLORS.accent : COLORS.danger
      })
      ui.chip(x + 16, y + 16, 102, 28, win ? '撤收成功' : '未能归署', {
        fill: win ? '#1e4f43' : '#4a2024',
        stroke: win ? COLORS.accent : COLORS.danger,
        color: win ? '#b8ffe8' : '#ffd0d0',
        size: 14
      })
      ui.chip(x + 126, y + 16, 72, 28, `评级 ${r.rating}`, {
        fill: '#0c1418',
        stroke: ratingColor,
        color: ratingColor,
        size: 14
      })
      let bodyY = y + 58
      if (failLine) {
        ui.panel(x + 14, bodyY, w - 28, 68, {
          fill: '#4a2024',
          stroke: COLORS.danger,
          radius: 12,
          glow: 'rgba(255,107,107,0.18)'
        })
        stage.drawJudge(ui.ctx, false, x + 40, bodyY + 34, 14)
        ui.text('倒在这一步', x + 62, bodyY + 10, 12, '#ffd0d0', '700')
        ui.wrapped(failLine, x + 62, bodyY + 28, w - 96, {
          size: 15, lineHeight: 20, maxLines: 2, weight: '700', color: '#fff4f4'
        })
        bodyY += 82
      }
      stage.drawMedal(ui.ctx, x + 18, bodyY, 52, {
        tier: r.rating === 'S' || r.rating === 'A' ? 'gold' : win ? 'green' : 'red'
      })
      ui.text(win ? '带出变现' : '本趟亏损', x + 82, bodyY + 2, 12, COLORS.body, '700')
      ui.text(`${win ? engine.fmtVal(r.totalValue || 0) : engine.fmtVal(Math.abs(profit))} 配给点`,
        x + 82, bodyY + 20, 26, win ? COLORS.gold : '#ffd0d0', '700', w - 104)
      ui.text(`${profit >= 0 ? '净入账 +' : '净损失 -'}${engine.fmtVal(Math.abs(profit))}`,
        x + 82, bodyY + 54, 15, profit >= 0 ? COLORS.accent : COLORS.danger, '700', w - 104)
      ui.text(`${r.methodText || '未能撤离'} · ${r.loadoutName || ''}`, x + 18, bodyY + 88, 13, COLORS.body, '600', w - 36)
      const wallet = r.wallet && r.wallet.balanceAfter != null
        ? `仓库还剩 ${engine.fmtVal(r.wallet.balanceAfter)}`
        : (win ? '配给点已入账，装备押金退回' : '本趟装备投入未返还')
      ui.text(wallet, x + 18, bodyY + 110, 12, COLORS.muted, '600', w - 36)
      if (lootStrip.length) {
        lootStrip.forEach((item, i) => {
          stage.drawItemIcon(ui.ctx, x + 18 + i * 30, bodyY + 134, 24, item)
        })
      }
      y += headH + 20

      const review = failLine ? r.causeChain.slice(1) : r.causeChain
      if (review.length) {
        y = ui.section(x, y, w, '复盘')
        review.forEach((line, index) => {
          const h = ui.wrapped(`${index + 1}. ${line}`, x + 8, y, w - 16, {
            size: 13, lineHeight: 20, color: COLORS.muted
          })
          y += h + 8
        })
        y += 8
      }

      if (r.retryPlans.length) {
        y = ui.section(x, y, w, '针对性重开')
        r.retryPlans.forEach(plan => {
          y += this.planCard(ui, x, y, w, plan) + 10
        })
      }

      if (r.medals.length) {
        y = ui.section(x, y, w, '本局勋章')
        r.medals.forEach(medal => {
          ui.panel(x, y, w, 64, {
            fill: '#1a2418',
            stroke: tierColor(medal.tier),
            accent: tierColor(medal.tier)
          })
          stage.drawMedal(ui.ctx, x + 12, y + 10, 40, medal)
          ui.text(medal.name, x + 62, y + 12, 15, COLORS.gold, '700', w - 76)
          ui.text(medal.desc || '', x + 62, y + 36, 12, COLORS.muted, '600', w - 76)
          y += 74
        })
        y += 6
      }

      if (r.lootItems.length) {
        y = ui.section(x, y, w, `带出物资（${r.lootItems.length}）`)
        r.lootItems.forEach(item => {
          ui.panel(x, y, w, 44, {
            fill: '#111925',
            stroke: tierColor(item.tier),
            accent: tierColor(item.tier),
            radius: 10
          })
          stage.drawItemIcon(ui.ctx, x + 12, y + 10, 22, item)
          ui.text(`[${item.tierLabel || ''}] ${item.name}`, x + 44, y + 13, 13, COLORS.text, '600', w * 0.58)
          ui.ctx.textAlign = 'right'
          ui.text(engine.fmtVal(item.value), x + w - 12, y + 13, 13, COLORS.gold, '700')
          ui.ctx.textAlign = 'left'
          y += 52
        })
        y += 8
      }
      if (r.lostItems.length) {
        y = ui.section(x, y, w, `未能带出（${r.lostItems.length}）`)
        r.lostItems.slice(0, 8).forEach(item => {
          const h = ui.wrapped(`${item.name}${item.reason ? ' · ' + item.reason : ''}`, x + 8, y, w - 16, {
            size: 12, lineHeight: 18, color: COLORS.muted
          })
          y += h + 6
        })
        if (r.lostItems.length > 8) {
          ui.text(`其余 ${r.lostItems.length - 8} 件略`, x + 8, y, 12, COLORS.muted)
          y += 22
        }
      }
      y += 24
      this.scroll.setBounds(y - start + 8, this.rect.h)
    })

    const dock = {
      x: v.safe.left,
      y: v.safe.bottom - toolbarH,
      w: v.safe.right - v.safe.left,
      h: toolbarH
    }
    ui.panel(dock.x, dock.y, dock.w, dock.h, {
      fill: '#071018',
      stroke: false,
      radius: 0,
      sheen: false
    })
    ui.ctx.fillStyle = COLORS.gold
    ui.ctx.fillRect(dock.x + 24, dock.y, dock.w - 48, 2)
    const left = v.safe.left + 14
    const width = v.safe.right - v.safe.left - 28
    const y = v.safe.bottom - 78
    ui.button(left, y, width, 64,
      r.escaped ? '再出发' : '换方案再出发',
      () => this.again(), {
        fill: r.escaped ? '#2a8f72' : '#d4a017',
        stroke: r.escaped ? '#8ef0d0' : '#ffe08a',
        color: r.escaped ? '#ffffff' : '#1a1408',
        size: 22,
        weight: '700',
        sub: r.loadoutName ? `${r.loadoutName} · 重开` : '用上一套战备重开',
        subColor: r.escaped ? '#d7fff0' : '#3a2a08',
        glow: r.escaped ? 'rgba(101,214,180,0.28)' : 'rgba(255,198,92,0.28)'
      })
  }
})
