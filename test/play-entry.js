// 浏览器试玩入口：真实 scene + 鼠标/滚轮。仅本地验证，不进发布包。
const { createGame } = require('../miniprogram/runtime/app')

function store() {
  try {
    return window.localStorage
  } catch (e) {
    return { getItem() { return null }, setItem() {}, removeItem() {} }
  }
}

function boot() {
  const canvas = document.getElementById('game')
  const toast = document.getElementById('toast')
  const memory = {}
  const disk = store()
  window.wx = {
    createCanvas() { return canvas },
    getWindowInfo() {
      return {
        windowWidth: 390, windowHeight: 844, pixelRatio: 1,
        safeArea: { left: 0, top: 44, right: 390, bottom: 810 }
      }
    },
    getStorageSync(key) {
      if (Object.prototype.hasOwnProperty.call(memory, key)) return memory[key]
      try {
        const raw = disk.getItem('jyx_' + key)
        return raw ? JSON.parse(raw) : null
      } catch (e) { return null }
    },
    setStorageSync(key, value) {
      memory[key] = value
      try { disk.setItem('jyx_' + key, JSON.stringify(value)) } catch (e) { /* ignore */ }
    },
    removeStorageSync(key) {
      delete memory[key]
      try { disk.removeItem('jyx_' + key) } catch (e) { /* ignore */ }
    },
    onTouchStart() {}, onTouchMove() {}, onTouchEnd() {}, onTouchCancel() {},
    onWindowResize() {}, onHide() {}, onShow() {},
    showModal(options) {
      const ok = window.confirm((options.title || '') + '\n' + (options.content || ''))
      if (options.success) options.success({ confirm: ok, cancel: !ok })
    },
    showToast(options) {
      if (toast) toast.textContent = (options && options.title) || ''
    },
    exitMiniProgram() {
      if (toast) toast.textContent = '已退出试玩。刷新页面可重开。'
    }
  }
  createGame({})
}

document.addEventListener('DOMContentLoaded', boot)
