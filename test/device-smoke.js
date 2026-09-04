// 开发者工具模拟器冒烟：连接 auto 端口，截图并驱动 Canvas 场景。
// 截图写入 test/device-shots/，只反映现行原创 UI。不要再引用已删除的 test/ui-*.png。
// 运行前：cli.bat auto --project <工程路径>
// 运行：node device-smoke.js
const automator = require('miniprogram-automator')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SHOTS = path.join(__dirname, 'device-shots')
const sleep = ms => new Promise(r => setTimeout(r, ms))
const report = []
const say = line => { console.log(line); report.push(line) }

function managerState() {
  return `(() => {
    const m = typeof GameGlobal !== 'undefined' ? GameGlobal.__JYX_MANAGER__ : null
    if (!m) return { ok: false, reason: 'no manager' }
    const s = m.scene || {}
    return {
      ok: true,
      scene: m.sceneName,
      firstUse: !!s.firstUse,
      scrollMax: s.scroll ? s.scroll.max : null,
      scrollOffset: s.scroll ? s.scroll.offset : null,
      runStep: s.run ? s.run.step : null,
      runEnded: s.run ? !!s.run.ended : null
    }
  })()`
}

async function main() {
  fs.mkdirSync(SHOTS, { recursive: true })
  say('连接开发者工具模拟器…')
  let mini
  for (const port of [9420, 9430, 9440]) {
    try {
      mini = await automator.connect({ wsEndpoint: `ws://127.0.0.1:${port}` })
      say(`✓ 已连接 ws://127.0.0.1:${port}`)
      break
    } catch (e) { /* try next port */ }
  }
  if (!mini) throw new Error('无法连接 auto 端口。请先运行：cli.bat auto --project <工程>')

  mini.on('exception', msg => say(`! 运行时异常: ${msg.message || JSON.stringify(msg)}`))
  mini.on('console', msg => {
    const text = (msg.args || []).map(a => (typeof a === 'object' ? JSON.stringify(a) : String(a))).join(' ')
    if (text) say(`  [console.${msg.type}] ${text}`)
  })

  await mini.callWxMethod('clearStorageSync')
  await sleep(800)
  await mini.evaluate('(() => { if (typeof GameGlobal !== "undefined") GameGlobal.__JYX_MANAGER__ = null })()')
  await mini.evaluate('require("./game.js")')
  await sleep(1200)

  let state = await mini.evaluate(managerState())
  say(`1. 冷启动 → ${state.scene}${state.firstUse ? '（首启协议）' : ''}`)
  if (state.scene !== 'legal' || !state.firstUse) throw new Error('冷启动未进入首启协议页')
  await mini.screenshot({ path: path.join(SHOTS, '01-legal.png') })

  await mini.evaluate(`(() => {
    const s = GameGlobal.__JYX_MANAGER__.scene
    s.scroll.offset = s.scroll.max
  })()`)
  await sleep(200)
  await mini.evaluate('GameGlobal.__JYX_MANAGER__.scene.accept()')
  await sleep(600)
  state = await mini.evaluate(managerState())
  say(`2. 同意协议 → ${state.scene}`)
  if (state.scene !== 'index') throw new Error('同意后未进入大厅')
  await mini.screenshot({ path: path.join(SHOTS, '02-index.png') })

  await mini.evaluate('GameGlobal.__JYX_MANAGER__.go("run")')
  await sleep(600)
  state = await mini.evaluate(managerState())
  say(`3. 进入行动 → step ${state.runStep}`)
  if (state.scene !== 'run') throw new Error('未进入局内')

  let guard = 0
  while (guard++ < 80) {
    state = await mini.evaluate(managerState())
    if (state.scene !== 'run') break
    const progressed = await mini.evaluate(`(() => {
      const scene = GameGlobal.__JYX_MANAGER__.scene
      if (scene.busy || scene.run.ended) return false
      const option = scene.run.node.options.find(item => !item.disabled)
      if (!option) return false
      scene.busy = false
      scene.pick(option.idx)
      return true
    })()`)
    if (!progressed) break
    await sleep(320)
  }
  state = await mini.evaluate(managerState())
  say(`4. 自动推进 → ${state.scene}（${guard - 1} 步）`)
  if (state.scene !== 'report') throw new Error('行动未进入战报页')
  await mini.screenshot({ path: path.join(SHOTS, '03-report.png') })

  await mini.evaluate('GameGlobal.__JYX_MANAGER__.go("settings")')
  await sleep(400)
  await mini.evaluate(`(() => {
    wx.showModal = opts => opts.success({ confirm: true, cancel: false })
    GameGlobal.__JYX_MANAGER__.scene.clearAll()
  })()`)
  await sleep(500)
  state = await mini.evaluate(managerState())
  say(`5. 一键清档 → ${state.scene}`)
  if (state.scene !== 'legal' || !state.firstUse) throw new Error('清档后未回到首启协议')

  say('')
  say('模拟器冒烟通过：协议 → 大厅 → 完整行动 → 战报 → 清档')
  say(`截图目录：${SHOTS}`)
  await mini.disconnect()
}

main().catch(error => {
  console.error(error)
  process.exitCode = 1
})
