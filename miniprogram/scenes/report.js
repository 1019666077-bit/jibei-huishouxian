const engine = require('../core/engine')
const Scroll = require('../runtime/scroll')
const { COLORS, wrapLines } = require('../runtime/ui')

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
    ctx.font = '700 14px sans-serif'
    const titleLines = wrapLines(ctx, plan.title, w - 24)
    ctx.font = '12px sans-serif'
    const goalLines = wrapLines(ctx, plan.goal || '', w - 24)
    const h = 46 + titleLines.length * 20 + goalLines.length * 17
    ui.panel(x, y, w, h, { fill: '#15273a', stroke: COLORS.blue })
    ui.wrapped(plan.title, x + 12, y + 10, w - 24, {
      size: 14, lineHeight: 20, weight: '700', color: COLORS.text
    })
    let ty = y + 12 + titleLines.length * 20
    ui.wrapped(plan.goal || '', x + 12, ty, w - 24, {
      size: 12, lineHeight: 17, color: COLORS.muted
    })
    ty += goalLines.length * 17 + 7
    ui.text('按此方案重开', x + 12, ty, 12, COLORS.accent, '700')
    ui.addHit(x, y, w, h, () => this.again(plan))
    return h
  },

  render(ui, v) {
    if (!this.report) return
    const headerBottom = ui.header('行动结算', '本地战报 · 不上传、不生成编号', () => manager.go('index'))
    const toolbarH = 55
    this.rect = {
      x: v.safe.left + 10,
      y: headerBottom,
      w: v.safe.right - v.safe.left - 20,
      h: v.safe.bottom - toolbarH - headerBottom
    }
    const r = this.report
    ui.withClip(this.rect, () => {
      const x = this.rect.x + 4
      const w = this.rect.w - 8
      let y = this.rect.y + 4 - this.scroll.offset
      const start = y
      const ratingColor = r.rating === 'S' ? COLORS.danger : r.rating === 'A' ? COLORS.gold : COLORS.text
      ui.panel(x, y, w, 132, {
        fill: r.escaped ? '#132820' : '#2c171b',
        stroke: r.escaped ? '#2b6653' : '#703840'
      })
      ui.text(r.escaped ? '活着出来了' : '没能回来', x + 16, y + 16, 18,
        r.escaped ? COLORS.accent : COLORS.danger, '700')
      ui.text(`评级 ${r.rating}`, x + 16, y + 46, 36, ratingColor, '700')
      ui.text(`${r.methodText || '未能撤离'} · ${r.loadoutName || ''}`, x + 16, y + 96, 13, COLORS.muted)
      y += 148

      ui.panel(x, y, w, 100)
      ui.text('本局物资', x + 16, y + 14, 12, COLORS.muted)
      ui.text(`${engine.fmtVal(r.totalValue || 0)} 配给点`, x + 16, y + 36, 26, COLORS.gold, '700')
      const profit = r.netProfit || 0
      ui.text(`${profit >= 0 ? '净收益 +' : '净损失 -'}${engine.fmtVal(Math.abs(profit))} 配给点`,
        x + 16, y + 72, 13, profit >= 0 ? COLORS.accent : COLORS.danger, '600')
      y += 116

      if (r.causeChain.length) {
        ui.text('复盘', x + 2, y, 17, COLORS.text, '700')
        y += 28
        r.causeChain.forEach((line, index) => {
          const h = ui.wrapped(`${index + 1}. ${line}`, x + 5, y, w - 10, {
            size: 13, lineHeight: 20, color: COLORS.muted
          })
          y += h + 8
        })
        y += 7
      }

      if (r.retryPlans.length) {
        ui.text('针对性重开', x + 2, y, 17, COLORS.text, '700')
        y += 29
        r.retryPlans.forEach(plan => {
          y += this.planCard(ui, x, y, w, plan) + 10
        })
      }

      if (r.medals.length) {
        ui.text('本局勋章', x + 2, y, 17, COLORS.text, '700')
        y += 27
        r.medals.forEach(medal => {
          const h = ui.wrapped(`${medal.icon || '◆'} ${medal.name} · ${medal.desc}`, x + 5, y, w - 10, {
            size: 12, lineHeight: 18, color: COLORS.gold
          })
          y += h + 6
        })
        y += 8
      }

      if (r.lootItems.length) {
        ui.text(`带出物资（${r.lootItems.length}）`, x + 2, y, 17, COLORS.text, '700')
        y += 28
        r.lootItems.forEach(item => {
          ui.text(`[${item.tierLabel || ''}] ${item.name}`, x + 5, y, 12, COLORS.text, '600', w * 0.68)
          ui.ctx.textAlign = 'right'
          ui.text(engine.fmtVal(item.value), x + w - 5, y, 12, COLORS.muted)
          ui.ctx.textAlign = 'left'
          y += 21
        })
        y += 10
      }
      if (r.lostItems.length) {
        ui.text(`未能带出（${r.lostItems.length}）`, x + 2, y, 17, COLORS.text, '700')
        y += 28
        r.lostItems.slice(0, 8).forEach(item => {
          const h = ui.wrapped(`${item.name}${item.reason ? ' · ' + item.reason : ''}`, x + 5, y, w - 10, {
            size: 12, lineHeight: 18, color: COLORS.muted
          })
          y += h + 6
        })
        if (r.lostItems.length > 8) {
          ui.text(`其余 ${r.lostItems.length - 8} 件略`, x + 5, y, 12, COLORS.muted)
          y += 22
        }
      }
      y += 18
      this.scroll.setBounds(y - start + 8, this.rect.h)
    })

    const left = v.safe.left + 12
    const width = v.safe.right - v.safe.left - 24
    const y = v.safe.bottom - 48
      ui.button(left, y, width, 44,
        r.loadoutName ? `再出发 · ${r.loadoutName}` : '再出发',
        () => this.again(), { fill: '#1e4f43', stroke: COLORS.accent, size: 16 })
  }
})
