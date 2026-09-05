const metaStore = require('../core/meta')
const consent = require('../legal/consent')
const config = require('../config/index')
const { healthNotice, operator, contact, ageRating, creditCode } = require('../legal/documents')
const Scroll = require('../runtime/scroll')
const { COLORS } = require('../runtime/ui')

const CLEAR_KEYS = [
  'meta_v1', 'last_report', 'last_rid', 'retry_preset',
  'ad_reward_v1', consent.STORAGE_KEY, 'lesson_cable_v1'
]

module.exports = manager => ({
  enter() {
    this.scroll = new Scroll()
    this.cleared = false
  },

  clearAll() {
    wx.showModal({
      title: '清除本地数据',
      content: '仓库、图鉴、最近战报、重开方案、广告奖励与协议确认记录都会删除，且无法恢复。清除后需要重新阅读并同意协议。',
      confirmText: '确认清除',
      confirmColor: '#d95763',
      success: result => {
        if (!result.confirm) return
        let ok = true
        CLEAR_KEYS.forEach(key => {
          try { wx.removeStorageSync(key) } catch (e) { ok = false }
        })
        this.cleared = ok
        if (ok) {
          manager.go('legal', { firstUse: true })
          return
        }
        manager.requestRender()
        wx.showToast({ title: '部分数据清除失败', icon: 'none' })
      }
    })
  },

  pointerStart(point) {
    if (this.rect && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.h) this.scroll.start(point.y)
  },
  pointerMove(point) { return this.scroll.move(point.y) },
  pointerEnd() { this.scroll.end() },

  render(ui, v) {
    const headerBottom = ui.header('设置', `${config.gameTitle}  ${config.version || '1.0.0'}`, () => manager.go('index'))
    const toolbarH = 58
    this.rect = {
      x: v.safe.left + 10,
      y: headerBottom,
      w: v.safe.right - v.safe.left - 20,
      h: v.safe.bottom - toolbarH - headerBottom
    }
    ui.withClip(this.rect, () => {
      const x = this.rect.x + 8
      const w = this.rect.w - 16
      let y = this.rect.y + 8 - this.scroll.offset
      const start = y

      ui.panel(x, y, w, 88, { accent: COLORS.gold })
      ui.text(healthNotice.title + '  ·  ' + ageRating, x + 14, y + 12, 14, COLORS.gold, '700')
      ui.wrapped(healthNotice.lines[0], x + 14, y + 36, w - 28, { size: 11, lineHeight: 16, color: COLORS.text })
      ui.wrapped(healthNotice.lines[1], x + 14, y + 54, w - 28, { size: 11, lineHeight: 16, color: COLORS.muted })
      y += 102

      ui.panel(x, y, w, 168)
      ui.text('运营主体', x + 14, y + 12, 14, COLORS.text, '700')
      ui.wrapped(operator, x + 14, y + 38, w - 28, { size: 13, lineHeight: 20, color: COLORS.text })
      if (creditCode) ui.text(`统一社会信用代码 ${creditCode}`, x + 14, y + 82, 12, COLORS.muted, 'normal', w - 28)
      ui.text(`客服 / 投诉 / 未成年人保护`, x + 14, y + 106, 12, COLORS.muted)
      ui.text(contact, x + 14, y + 128, 13, COLORS.accent, '600', w - 28)
      y += 182

      ui.panel(x, y, w, 118)
      ui.text('本地单机', x + 14, y + 12, 14, COLORS.text, '700')
      ui.wrapped('不登录微信账号，不读取 OpenID，不提供排行，不上传战报。配给点无现金价值。激励视频未配置时不显示入口。',
        x + 14, y + 40, w - 28, { size: 12, lineHeight: 19, color: COLORS.muted })
      y += 132

      const fresh = metaStore.load()
      ui.panel(x, y, w, 96)
      ui.text('本地存档', x + 14, y + 12, 14, COLORS.text, '700')
      ui.text(`已记录 ${fresh.runs} 局 · 版本 ${config.version || '1.0.0'}`, x + 14, y + 40, 12, COLORS.muted)
      ui.text('删除后以初始仓库重开，并重新确认协议。', x + 14, y + 64, 12, COLORS.muted)
      y += 110

      ui.button(x, y, w, 46, '一键清除全部本地数据', () => this.clearAll(), {
        fill: '#321a20',
        stroke: COLORS.danger,
        color: COLORS.danger
      })
      y += 58
      if (this.cleared) {
        ui.text('已清除：仓库、战报、重开方案、广告奖励与协议确认', x + 4, y, 12, COLORS.accent)
        y += 28
      }
      ui.wrapped(healthNotice.lines[2], x + 4, y, w - 8, { size: 11, lineHeight: 16, color: COLORS.muted })
      y += 40
      this.scroll.setBounds(y - start + 8, this.rect.h)
    })

    const left = v.safe.left + 12
    const width = v.safe.right - v.safe.left - 24
    ui.button(left, v.safe.bottom - 50, width, 42, '查看协议、隐私与家长监护', () => manager.go('legal'))
  }
})
