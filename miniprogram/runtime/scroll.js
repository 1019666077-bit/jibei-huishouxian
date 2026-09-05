class Scroll {
  constructor() {
    this.offset = 0
    this.max = 0
    this.dragging = false
    this.startY = 0
    this.startOffset = 0
  }

  setBounds(contentHeight, viewportHeight) {
    this.max = Math.max(0, contentHeight - viewportHeight)
    this.offset = Math.max(0, Math.min(this.offset, this.max))
  }

  start(y) {
    this.dragging = true
    this.startY = y
    this.startOffset = this.offset
  }

  move(y) {
    if (!this.dragging) return false
    this.offset = Math.max(0, Math.min(this.max, this.startOffset + this.startY - y))
    return true
  }

  end() {
    this.dragging = false
  }

  reset() {
    this.offset = 0
    this.max = 0
    this.dragging = false
  }

  wheel(delta) {
    if (this.max <= 0) return false
    const next = Math.max(0, Math.min(this.max, this.offset + (Number(delta) || 0)))
    if (next === this.offset) return false
    this.offset = next
    return true
  }

  progress() {
    if (this.max <= 0) return 1
    return this.offset / this.max
  }

  atEnd() {
    return this.max <= 12 || this.offset >= this.max - 12
  }
}

module.exports = Scroll
