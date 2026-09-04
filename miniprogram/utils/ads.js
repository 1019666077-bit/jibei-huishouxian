const STORAGE_KEY = 'ad_reward_v1'

let adUnitId = ''
let video = null
let showing = false

function dayKey(now) {
  const d = new Date(now || Date.now())
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
}

function read() {
  try {
    const value = wx.getStorageSync(STORAGE_KEY)
    return value && typeof value === 'object'
      ? { day: value.day || '', claimed: !!value.claimed, stock: Math.max(0, Number(value.stock) || 0) }
      : { day: '', claimed: false, stock: 0 }
  } catch (e) {
    return { day: '', claimed: false, stock: 0 }
  }
}

function write(value) {
  try { wx.setStorageSync(STORAGE_KEY, value) } catch (e) { /* 奖励状态无法落盘时不发奖励 */ }
}

function configure(id) {
  adUnitId = String(id || '').trim()
  video = null
}

function isConfigured() {
  return !!adUnitId && typeof wx !== 'undefined' && typeof wx.createRewardedVideoAd === 'function'
}

function status() {
  const state = read()
  return {
    configured: isConfigured(),
    claimedToday: state.day === dayKey() && state.claimed,
    stock: state.stock
  }
}

function grant() {
  const state = read()
  const today = dayKey()
  if (state.day === today && state.claimed) return false
  const next = { day: today, claimed: true, stock: state.stock + 1 }
  write(next)
  const saved = read()
  return saved.day === today && saved.claimed && saved.stock >= next.stock
}

function show() {
  if (!isConfigured()) return Promise.reject(new Error('激励视频未配置'))
  const current = status()
  if (current.claimedToday) return Promise.reject(new Error('今日医疗补给已领取'))
  if (showing) return Promise.reject(new Error('视频正在播放'))
  if (!video) video = wx.createRewardedVideoAd({ adUnitId })
  showing = true

  return new Promise((resolve, reject) => {
    let settled = false
    const cleanup = () => {
      showing = false
      if (video.offClose) video.offClose(onClose)
      if (video.offError) video.offError(onError)
    }
    const finish = (fn, value) => {
      if (settled) return
      settled = true
      cleanup()
      fn(value)
    }
    const onClose = result => {
      if (!result || result.isEnded !== true) {
        finish(reject, new Error('完整看完视频才可领取'))
        return
      }
      if (!grant()) {
        finish(reject, new Error('奖励保存失败'))
        return
      }
      finish(resolve, { medical: 1 })
    }
    const onError = () => finish(reject, new Error('视频加载失败'))
    video.onClose(onClose)
    video.onError(onError)

    Promise.resolve(video.show())
      .catch(() => video.load().then(() => video.show()))
      .catch(() => finish(reject, new Error('视频暂不可用')))
  })
}

function consumeMedicalSupply() {
  const state = read()
  if (state.stock <= 0) return 0
  const next = { day: state.day, claimed: state.claimed, stock: state.stock - 1 }
  write(next)
  return read().stock === next.stock ? 1 : 0
}

module.exports = {
  STORAGE_KEY,
  configure,
  isConfigured,
  status,
  show,
  consumeMedicalSupply
}
