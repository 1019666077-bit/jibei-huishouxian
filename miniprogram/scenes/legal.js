const { documents, healthNotice } = require('../legal/documents')
const consent = require('../legal/consent')
const Scroll = require('../runtime/scroll')
const { COLORS } = require('../runtime/ui')

module.exports = manager => ({
  enter(params) {
    this.scroll = new Scroll()
    this.firstUse = !!(params && params.firstUse)
  },
  canAccept() {
    return !this.firstUse || (this.scroll && this.scroll.atEnd())
  },
  accept() {
    if (!this.canAccept()) {
      wx.showToast({ title: '请先滑动读完全部协议', icon: 'none' })
      return
    }
    try {
      wx.setStorageSync(consent.STORAGE_KEY, {
        version: consent.VERSION,
        acceptedAt: Date.now()
      })
    } catch (e) {
      wx.showToast({ title: '确认状态保存失败，请重试', icon: 'none' })
      return
    }
    manager.go('index')
  },
  decline() {
    if (typeof wx.exitMiniProgram === 'function') {
      wx.exitMiniProgram()
      return
    }
    wx.showToast({ title: '请从右上角关闭游戏', icon: 'none' })
  },
  inDrag(point) {
    const area = this.dragRect
    if (!area || !point) return false
    return point.x >= area.x && point.x <= area.x + area.w &&
      point.y >= area.y && point.y <= area.y + area.h
  },
  pointerStart(point) {
    if (this.inDrag(point)) this.scroll.start(point.y)
  },
  pointerMove(point) { return this.scroll.move(point.y) },
  pointerEnd() { this.scroll.end() },
  wheel(delta) {
    return this.scroll.wheel(delta)
  },
  render(ui, v) {
    const top = ui.header(
      '协议与隐私',
      this.firstUse ? '请滑动或滚轮读完全文后再同意' : '上下滑动查看完整内容',
      this.firstUse ? null : () => manager.go('index')
    )
    const left = v.safe.left + 12
    const width = v.safe.right - v.safe.left - 24
    const bannerY = top + 4
    ui.panel(left, bannerY, width, 78, {
      accent: COLORS.gold,
      depth: true,
      rim: COLORS.gold,
      material: 'metal',
      bezel: 3,
      metal: '#7a6230',
      hairline: 'rgba(255,220,140,0.2)'
    })
    ui.text(`${healthNotice.title}  ·  16+`, left + 12, bannerY + 10, 13, COLORS.gold, '700')
    ui.wrapped(healthNotice.lines[0], left + 12, bannerY + 32, width - 24, {
      size: 11, lineHeight: 16, color: COLORS.text
    })
    ui.wrapped(healthNotice.lines[1], left + 12, bannerY + 50, width - 24, {
      size: 11, lineHeight: 16, color: COLORS.text
    })

    const toolbarH = this.firstUse ? 58 : 8
    this.rect = {
      x: v.safe.left + 10,
      y: bannerY + 88,
      w: v.safe.right - v.safe.left - 20,
      h: v.safe.bottom - (bannerY + 88) - toolbarH
    }
    this.dragRect = {
      x: v.safe.left,
      y: top,
      w: v.width - v.safe.left,
      h: (this.firstUse ? v.safe.bottom - toolbarH : v.safe.bottom) - top
    }
    ui.withClip(this.rect, () => {
      const x = this.rect.x + 4
      const w = this.rect.w - 18
      let y = this.rect.y + 4 - this.scroll.offset
      const start = y
      documents.forEach((doc, docIndex) => {
        ui.text(doc.title, x + 2, y, 20, COLORS.text, '700')
        y += 34
        doc.body.forEach(paragraph => {
          const h = ui.wrapped(paragraph, x + 3, y, w - 6, {
            size: 13,
            lineHeight: 21,
            color: COLORS.muted
          })
          y += h + 12
        })
        if (docIndex < documents.length - 1) {
          ui.divider(x, y + 2, w)
          y += 26
        }
      })
      y += 8
      ui.text(healthNotice.lines[2], x + 3, y, 12, COLORS.muted)
      y += 28
      this.scroll.setBounds(y - start, this.rect.h)
    })
    ui.scrollbar(this.rect, this.scroll)
    if (this.firstUse && !this.canAccept()) {
      const hintH = 36
      const hintY = this.rect.y + this.rect.h - hintH
      ui.panel(this.rect.x + 8, hintY, this.rect.w - 22, hintH, {
        fill: 'rgba(18, 36, 28, 0.92)',
        stroke: COLORS.gold,
        radius: 8,
        sheen: false
      })
      const pct = Math.round(this.scroll.progress() * 100)
      ui.text(`继续下滑阅读全文 · 已读 ${pct}%`, this.rect.x + 18, hintY + 10, 13, COLORS.gold, '700', this.rect.w - 40)
    }
    if (this.firstUse) {
      const gap = 10
      const buttonWidth = (width - gap) / 2
      const y = v.safe.bottom - 48
      ui.button(left, y, buttonWidth, 40, '不同意并退出', () => this.decline(), {
        color: COLORS.muted
      })
      const ready = this.canAccept()
      ui.button(left + buttonWidth + gap, y, buttonWidth, 40, ready ? '同意并进入' : '请先读完', () => this.accept(), {
        fill: ready ? '#1f6657' : '#22303d',
        stroke: ready ? COLORS.accent : COLORS.line,
        color: ready ? '#ffffff' : COLORS.muted
      })
    }
  }
})
