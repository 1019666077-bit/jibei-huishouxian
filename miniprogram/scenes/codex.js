const engine = require('../core/engine')
const metaStore = require('../core/meta')
const Scroll = require('../runtime/scroll')
const { COLORS } = require('../runtime/ui')

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
      ui.panel(x, y, w, 112)
      ui.text('仓库余额', x + 14, y + 13, 11, COLORS.muted)
      ui.text(`${engine.fmtVal(this.meta.balance)} 配给点`, x + 14, y + 33, 24, COLORS.gold, '700')
      ui.divider(x + 14, y + 69, w - 28)
      ui.text(`累计 ${this.meta.runs} 局 · 撤离 ${this.meta.escapes} 次`, x + 14, y + 82, 12, COLORS.text)
      y += 126
      ui.text(`绝密资产图鉴 ${this.codex.owned}/${this.codex.total}`, x + 2, y, 18, COLORS.text, '700')
      y += 31
      this.entries.forEach(entry => {
        ui.panel(x, y, w, 72, {
          fill: entry.owned ? '#251a20' : '#101720',
          stroke: entry.owned ? '#743744' : '#1e2a38'
        })
        ui.text(entry.owned ? entry.name : '未收录物资', x + 13, y + 11, 14,
          entry.owned ? COLORS.danger : '#627184', '700')
        ui.text(`${entry.weight} 格 · 最高 ${engine.fmtVal(entry.valueMax)} 配给点`,
          x + 13, y + 36, 11, entry.owned ? COLORS.muted : '#4c5968')
        ui.ctx.textAlign = 'right'
        ui.text(entry.owned ? `带出 ${entry.count} 次` : '仅撤离带出后收录',
          x + w - 13, y + 36, 11, entry.owned ? COLORS.accent : '#4c5968')
        ui.ctx.textAlign = 'left'
        y += 82
      })
      y += 10
      this.scroll.setBounds(y - start, this.rect.h)
    })
    const left = v.safe.left + 12
    const width = v.safe.right - v.safe.left - 24
    ui.button(left, v.safe.bottom - 48, width, 44, '回大厅出发', () => manager.go('index'), {
      fill: '#1f6657', stroke: COLORS.accent, size: 17
    })
  }
})
