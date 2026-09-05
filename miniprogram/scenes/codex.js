const engine = require('../core/engine')
const metaStore = require('../core/meta')
const Scroll = require('../runtime/scroll')
const { COLORS } = require('../runtime/ui')
const stage = require('../runtime/stage')

module.exports = manager => ({
  enter() {
    this.scroll = new Scroll()
    this.reload()
  },
  onShow() {
    this.reload()
    manager.requestRender()
  },
  reload() {
    this.meta = metaStore.load()
    this.codex = metaStore.codexView(this.meta)
    this.entries = this.codex.entries.slice().sort((a, b) =>
      Number(b.owned) - Number(a.owned) || b.valueMax - a.valueMax)
  },
  pointerStart(point) {
    if (this.rect && point.y >= this.rect.y && point.y <= this.rect.y + this.rect.h) this.scroll.start(point.y)
  },
  pointerMove(point) { return this.scroll.move(point.y) },
  pointerEnd() { this.scroll.end() },
  render(ui, v) {
    const top = ui.header('仓库与图鉴', '所有进度仅保存在当前设备', () => manager.go('index'))
    this.rect = {
      x: v.safe.left + 10,
      y: top,
      w: v.safe.right - v.safe.left - 20,
      h: v.safe.bottom - 57 - top
    }
    ui.withClip(this.rect, () => {
      const x = this.rect.x + 4
      const w = this.rect.w - 8
      let y = this.rect.y + 4 - this.scroll.offset
      const start = y
      ui.panel(x, y, w, 124, { accent: COLORS.gold, fill: '#162018' })
      ui.text('仓库余额', x + 16, y + 14, 12, COLORS.muted)
      ui.text(`${engine.fmtVal(this.meta.balance)} 配给点`, x + 16, y + 36, 26, COLORS.gold, '700')
      ui.divider(x + 16, y + 74, w - 32)
      ui.text(`累计 ${this.meta.runs} 局 · 撤离 ${this.meta.escapes} 次`, x + 16, y + 88, 13, COLORS.text)
      y += 140
      y = ui.section(x, y, w, `绝密资产图鉴 ${this.codex.owned}/${this.codex.total}`)
      this.entries.forEach(entry => {
        ui.panel(x, y, w, 80, {
          fill: entry.owned ? '#251a20' : '#101720',
          stroke: entry.owned ? '#743744' : '#1e2a38',
          accent: entry.owned ? COLORS.danger : '#2a3644'
        })
        if (entry.owned) {
          stage.drawItemIcon(ui.ctx, x + 14, y + 22, 28, { name: entry.name, tier: 'red' })
        } else {
          stage.gem(ui.ctx, x + 16, y + 26, 22, '#2a3644')
        }
        ui.text(entry.owned ? entry.name : '未收录物资', x + 54, y + 14, 15,
          entry.owned ? COLORS.danger : '#627184', '700', w - 70)
        ui.text(`${entry.weight} 格 · 最高 ${engine.fmtVal(entry.valueMax)} 配给点`,
          x + 54, y + 40, 12, entry.owned ? COLORS.muted : '#4c5968')
        ui.ctx.textAlign = 'right'
        ui.text(entry.owned ? `带出 ${entry.count} 次` : '仅撤离带出后收录',
          x + w - 14, y + 40, 11, entry.owned ? COLORS.accent : '#4c5968')
        ui.ctx.textAlign = 'left'
        y += 90
      })
      y += 10
      this.scroll.setBounds(y - start, this.rect.h)
    })
    const left = v.safe.left + 12
    const width = v.safe.right - v.safe.left - 24
    ui.button(left, v.safe.bottom - 50, width, 46, '回大厅出发', () => manager.go('index'), {
      fill: '#2a8f72', stroke: '#8ef0d0', color: '#ffffff', size: 17
    })
  }
})
