// 本地位图：微信小游戏 / 浏览器预览可加载，Node 自检无 Image 时退回程序化绘制。

const MAP_KEYS = ['harbor', 'weather', 'thermal', 'lift', 'core', 'aurora', 'extract']
const KIT_KEYS = ['full', 'half', 'knife']

const PATHS = {
  lobbyCover: 'assets/p0/lobby_cover.jpg',
  shareCard: 'assets/p0/share_card.jpg',
  map: {
    harbor: 'assets/map/harbor.png',
    weather: 'assets/map/weather.png',
    thermal: 'assets/map/thermal.png',
    lift: 'assets/map/lift.png',
    core: 'assets/map/core.png',
    aurora: 'assets/map/aurora.png',
    extract: 'assets/map/extract.png'
  },
  kit: {
    full: 'assets/kit/full.png',
    half: 'assets/kit/half.png',
    knife: 'assets/kit/knife.png'
  },
  item: {
    '北辰零号晶核': 'assets/item/zero_core.png',
    '暴风演算主机': 'assets/item/storm_host.png',
    '相控云图阵列': 'assets/item/cloud_array.png'
  }
}

const cache = Object.create(null)
let primed = false
let factory = null

function candidateUrls(rel) {
  if (typeof GameGlobal !== 'undefined') return [rel]
  if (typeof document !== 'undefined') {
    return ['../miniprogram/' + rel, '/miniprogram/' + rel, rel]
  }
  return [rel]
}

function load(rel, onReady) {
  if (cache[rel]) return cache[rel]
  const slot = { src: rel, img: null, ready: false }
  cache[rel] = slot
  const img = factory ? factory() : makeImage(null)
  if (!img) return slot
  const urls = candidateUrls(rel)
  let at = 0
  img.onload = () => {
    slot.img = img
    slot.ready = true
    if (typeof onReady === 'function') onReady()
  }
  img.onerror = () => {
    at += 1
    if (at < urls.length) img.src = urls[at]
  }
  img.src = urls[0]
  return slot
}

function makeImage(canvas) {
  if (canvas && typeof canvas.createImage === 'function') return canvas.createImage()
  if (typeof wx !== 'undefined' && typeof wx.createImage === 'function') return wx.createImage()
  if (typeof Image !== 'undefined') return new Image()
  return null
}

function warmupList() {
  const list = [PATHS.lobbyCover]
  MAP_KEYS.forEach(key => list.push(PATHS.map[key]))
  KIT_KEYS.forEach(key => list.push(PATHS.kit[key]))
  Object.keys(PATHS.item).forEach(name => list.push(PATHS.item[name]))
  return list
}

function prime(canvas, onReady) {
  if (primed) return
  primed = true
  factory = () => makeImage(canvas)
  warmupList().forEach(src => load(src, onReady))
}

function slotFor(kind, key) {
  if (kind === 'lobbyCover') return cache[PATHS.lobbyCover]
  if (kind === 'map') return cache[PATHS.map[key]]
  if (kind === 'kit') return cache[PATHS.kit[key]]
  if (kind === 'item') return cache[PATHS.item[key]]
  return null
}

function image(kind, key) {
  const slot = slotFor(kind, key)
  return slot && slot.ready ? slot.img : null
}

function paint(ctx, img, x, y, w, h, alpha) {
  if (!img || !ctx || typeof ctx.drawImage !== 'function') return false
  const prev = ctx.globalAlpha
  try {
    if (alpha != null && alpha < 1) ctx.globalAlpha = (prev || 1) * alpha
    ctx.drawImage(img, x, y, w, h)
    return true
  } catch (e) {
    return false
  } finally {
    ctx.globalAlpha = prev
  }
}

function coverFit(ctx, img, x, y, w, h) {
  if (!img || !ctx || typeof ctx.drawImage !== 'function') return false
  const iw = img.width || 1
  const ih = img.height || 1
  const scale = Math.max(w / iw, h / ih)
  const dw = iw * scale
  const dh = ih * scale
  try {
    ctx.drawImage(img, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh)
    return true
  } catch (e) {
    return false
  }
}

module.exports = {
  PATHS,
  prime,
  image,
  paint,
  coverFit
}
