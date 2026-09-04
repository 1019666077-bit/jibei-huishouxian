// 一键：启动开发者工具自动化 + 模拟器冒烟（无需手动扫真机）。
const automator = require('miniprogram-automator')
const { spawn } = require('child_process')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const SHOTS = path.join(__dirname, 'device-shots')
const sleep = ms => new Promise(r => setTimeout(r, ms))

function findCli() {
  const roots = ['D:\\', 'C:\\Program Files (x86)\\Tencent']
  for (const root of roots) {
    try {
      const hit = require('child_process')
        .execSync(`powershell -NoProfile -Command "Get-ChildItem '${root.replace(/'/g, "''")}' -Filter cli.bat -Recurse -Depth 2 -ErrorAction SilentlyContinue | Select-Object -First 1 -ExpandProperty FullName"`, { encoding: 'utf8' })
        .trim()
      if (hit && fs.existsSync(hit)) return hit
    } catch (e) { /* try next root */ }
  }
  throw new Error('未找到微信开发者工具 cli.bat')
}

function managerState() {
  return `(() => {
    const m = typeof GameGlobal !== 'undefined' ? GameGlobal.__JYX_MANAGER__ : null
    if (!m) return { ok: false, reason: 'no manager' }
    const s = m.scene || {}
    return {
      ok: true,
      scene: m.sceneName,
      firstUse: !!s.firstUse,
      runStep: s.run ? s.run.step : null
    }
  })()`
}

async function runSmoke(mini) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const say = line => console.log(line)

  await mini.callWxMethod('clearStorageSync')
  await sleep(800)
  await mini.evaluate('(() => { if (typeof GameGlobal !== "undefined") GameGlobal.__JYX_MANAGER__ = null })()')
  await mini.evaluate('require("./game.js")')
  await sleep(1200)

  let state = await mini.evaluate(managerState())
  say(`1. 冷启动 → ${state.scene}`)
  if (state.scene !== 'legal') throw new Error('冷启动未进入协议页')
  await mini.screenshot({ path: path.join(SHOTS, '01-legal.png') })

  await mini.evaluate(`(() => {
    const s = GameGlobal.__JYX_MANAGER__.scene
    s.scroll.offset = s.scroll.max
  })()`)
  await mini.evaluate('GameGlobal.__JYX_MANAGER__.scene.accept()')
  await sleep(600)
  state = await mini.evaluate(managerState())
  say(`2. 同意协议 → ${state.scene}`)
  await mini.screenshot({ path: path.join(SHOTS, '02-index.png') })

  await mini.evaluate('GameGlobal.__JYX_MANAGER__.go("run")')
  await sleep(600)
  let guard = 0
  while (guard++ < 80) {
    state = await mini.evaluate(managerState())
    if (state.scene !== 'run') break
    await mini.evaluate(`(() => {
      const scene = GameGlobal.__JYX_MANAGER__.scene
      if (scene.busy || scene.run.ended) return
      const option = scene.run.node.options.find(item => !item.disabled)
      if (!option) return
      scene.busy = false
      scene.pick(option.idx)
    })()`)
    await sleep(320)
  }
  state = await mini.evaluate(managerState())
  say(`3. 自动行动 ${guard - 1} 步 → ${state.scene}`)
  await mini.screenshot({ path: path.join(SHOTS, '03-report.png') })
  if (state.scene !== 'report') throw new Error('未进入战报')

  say(`截图：${SHOTS}`)
  say('模拟器冒烟通过')
}

async function main() {
  const cliPath = findCli()
  console.log('启动开发者工具自动化…')
  const mini = await automator.launch({
    cliPath,
    projectPath: ROOT,
    port: 9420,
    trustProject: true
  })
  try {
    await runSmoke(mini)
  } finally {
    await mini.close()
  }
}

main().catch(err => {
  console.error(err)
  process.exitCode = 1
})
