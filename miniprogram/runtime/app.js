const SceneManager = require('./scene-manager')
const ads = require('../utils/ads')
const consent = require('../legal/consent')

const factories = {
  index: require('../scenes/index'),
  run: require('../scenes/run'),
  report: require('../scenes/report'),
  codex: require('../scenes/codex'),
  settings: require('../scenes/settings'),
  legal: require('../scenes/legal')
}

function windowInfo(override) {
  let base
  try {
    base = typeof wx.getWindowInfo === 'function' ? wx.getWindowInfo() : wx.getSystemInfoSync()
  } catch (e) {
    base = { windowWidth: 375, windowHeight: 667, pixelRatio: 1 }
  }
  const info = Object.assign({}, base, override || {})
  if (!info.safeArea && base.safeArea) info.safeArea = base.safeArea
  const width = Number(info.windowWidth) || 375
  const height = Number(info.windowHeight) || 667
  const dpr = Math.max(1, Math.min(4, Number(info.pixelRatio) || 1))
  const area = info.safeArea || { left: 0, top: 0, right: width, bottom: height }
  return {
    width,
    height,
    dpr,
    safe: {
      left: Math.max(0, Number(area.left) || 0),
      top: Math.max(0, Number(area.top) || 0),
      right: Math.min(width, Number(area.right) || width),
      bottom: Math.min(height, Number(area.bottom) || height)
    }
  }
}

function touchPoint(event, changed) {
  const list = changed ? event.changedTouches : event.touches
  const touch = list && list[0]
  if (!touch) return null
  return {
    x: Number(touch.clientX != null ? touch.clientX : touch.x) || 0,
    y: Number(touch.clientY != null ? touch.clientY : touch.y) || 0
  }
}

function createGame(options = {}) {
  ads.configure(options.adUnitId || '')
  const canvas = wx.createCanvas()
  const ctx = canvas && canvas.getContext ? canvas.getContext('2d') : null
  if (!ctx) throw new Error('无法创建画布')
  let viewport = windowInfo()

  function sizeCanvas(next) {
    viewport = next || windowInfo()
    canvas.width = Math.round(viewport.width * viewport.dpr)
    canvas.height = Math.round(viewport.height * viewport.dpr)
    return viewport
  }

  sizeCanvas(viewport)
  const manager = new SceneManager(canvas, ctx, viewport, factories)

  wx.onTouchStart(event => {
    try {
      const point = touchPoint(event, false)
      if (point) manager.pointerStart(point)
    } catch (e) { /* ignore */ }
  })
  wx.onTouchMove(event => {
    try {
      const point = touchPoint(event, false)
      if (point) manager.pointerMove(point)
    } catch (e) { /* ignore */ }
  })
  wx.onTouchEnd(event => {
    try {
      const point = touchPoint(event, true)
      if (point) manager.pointerEnd(point)
    } catch (e) { /* ignore */ }
  })
  if (typeof wx.onTouchCancel === 'function') {
    wx.onTouchCancel(event => {
      const point = touchPoint(event, true) || { x: -1, y: -1 }
      manager.pointerEnd(point)
    })
  }
  if (typeof wx.onWindowResize === 'function') {
    wx.onWindowResize(info => manager.resize(sizeCanvas(windowInfo(info))))
  }
  wx.onHide(() => manager.onHide())
  wx.onShow(() => {
    manager.resize(sizeCanvas(windowInfo()))
    manager.onShow()
  })

  let accepted = false
  try {
    const record = wx.getStorageSync(consent.STORAGE_KEY)
    accepted = !!(record && record.version === consent.VERSION)
  } catch (e) { accepted = false }
  manager.go(accepted ? 'index' : 'legal', accepted ? {} : { firstUse: true })
  return manager
}

module.exports = { createGame }
