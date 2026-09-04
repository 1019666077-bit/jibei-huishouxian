const { createGame } = require('./runtime/app')
const config = require('./config/index')

if (typeof wx.onShareAppMessage === 'function') {
  wx.onShareAppMessage(() => ({
    title: '极夜回收线',
    query: ''
  }))
}

if (typeof wx.onError === 'function') {
  wx.onError(() => { /* 不向开发者服务器上报 */ })
}
if (typeof wx.onUnhandledRejection === 'function') {
  wx.onUnhandledRejection(() => { /* 不向开发者服务器上报 */ })
}

if (typeof wx.getUpdateManager === 'function') {
  try {
    const updater = wx.getUpdateManager()
    updater.onUpdateReady(() => {
      wx.showModal({
        title: '发现新版本',
        content: '新版本已下载，是否立即重启？',
        confirmText: '重启',
        success: result => {
          if (result.confirm && typeof updater.applyUpdate === 'function') updater.applyUpdate()
        }
      })
    })
  } catch (e) { /* 基础库不含更新管理器时忽略 */ }
}

let manager = null
try {
  manager = createGame({
    adUnitId: config.adUnitId || ''
  })
} catch (error) {
  try {
    const canvas = wx.createCanvas()
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#080c13'
    ctx.fillRect(0, 0, 400, 800)
    ctx.fillStyle = '#ffc65c'
    ctx.font = '16px sans-serif'
    ctx.fillText('启动失败，请完全关闭后重开。', 24, 80)
  } catch (e) { /* 画布也不可用时只能退出 */ }
}

try {
  if (typeof GameGlobal !== 'undefined') GameGlobal.__JYX_MANAGER__ = manager
} catch (e) { /* ignore */ }
