// 发布前法务门禁：确保提交包已经是原创、无诱导分享、无云账号、无小程序页面残留。
// 用法：node test/legal.js
const assert = require('assert')
const fs = require('fs')
const path = require('path')

const ROOT = path.resolve(__dirname, '..')
const GAME_ROOT = path.join(ROOT, 'miniprogram')
const TEXT_EXT = new Set(['.js', '.json', '.md', '.wxml', '.wxss', '.wxs'])

// 仅扫描会进入发布包或用于公开说明的内容。
// test 里的禁词清单不能反过来把自己报成命中。
const SCAN_ROOTS = [
  GAME_ROOT,
  path.join(ROOT, 'README.md'),
  path.join(ROOT, 'docs'),
  path.join(ROOT, 'compliance')
]

const FORBIDDEN_TERMS = [
  '三角洲行动', '烽火地带', '航天基地', '非洲之心', '曼德尔',
  '哈夫币', '哈夫克', '哈德森', '德穆兰', '乌鲁鲁', '露娜',
  'G.T.I.', '三角铁', '钻石大亨', '花来', '天才少年',
  '小米之家', '蓝室', '浮力室', '离心机室', '黑室', '花园平台',
  '西区码头', '总裁室', '二员', '西大', '牢大', '牢二', '牢三',
  '东吊', '发射桥', '航天舱', '跑刀', '舔包', '蹲闸', '控闸',
  '夺舍', '打铁', '大红', '暗区', '塔科夫',
  '对齐正版', '更像正版', '真实交易行', '正版结算',
  '说明与修复', '小游戏详情页公示主体',
  '包舔', '不舔', '舔完', '收尸',
  '三级护板', '四级护板', '五级护板', '六级护板', '六级重甲', '四级甲',
  'm995', 'mk318', 'm855', 'm61', 'duoshe', 'hualai', 'hudson',
  'core_mandel', 'core_duoshe', 'dock_hudson',
  'spawn_yuan2', 'spawn_xida', 'spawn_laoda', 'spawn_lao2', 'spawn_lao3',
  'zhongkong', 'president_vault', 'pres_corridor', 'core_dunzha',
  'launch_demoulin', 'spawn_zhongkong', 'core_blue', 'zk_bridge',
  '扒开', '扒完',
  'core_black', 'core_centrifuge', 'core_garden', 'core_dock',
  'president.js',
  "zone: 'dorm'", "zone: 'zhongkong'", "zone: 'industrial'",
  "zone: 'launch'", "zone: 'president'",
  "room: 'blue'", "room: 'buoy'", "room: 'black'",
  "room: 'cent'", "room: 'garden'", "room: 'dock'",
  'leverRooms: { blue',
  '装包', '搜包', '紫货', '开局抢点', '2×2', '2x2',
  '六型步枪', '四型步枪', '北辰六型', '北辰四型',
  '曙光-6', '曙光-4', '曙光-3', '霜脊-6', '霜脊-4', '霜脊-2', '短锋-1',
  '主动分享', '分享（无奖励）', 'spawn_westdock',
  "icon: '¥'", 'shareTimeline', 'showShareMenu', '安全箱'
]

const FORBIDDEN_RUNTIME = [
  { term: 'Page(', why: '仍在使用普通小程序 Page 运行时' },
  { term: 'getApp(', why: '仍依赖普通小程序 App 全局' },
  { term: 'wx.cloud', why: '本地首版不应初始化或调用云开发' },
  { term: 'globalData.openid', why: '本地首版不应取得或传播 OpenID' },
  { term: 'res.openid', why: '本地首版不应取得或传播 OpenID' },
  { term: '?inviter=', why: '分享路径不应传播邀请者标识' },
  { term: 'inviter', why: '首版已删除邀请归因和奖励' },
  { term: 'bindInvite', why: '首版已删除邀请奖励链路' },
  { term: 'weekInvite', why: '首版已删除邀请奖励链路' },
  { term: 'wx.request(', why: '本地首版不应向开发者服务器发送数据' },
  { term: 'reportEvent', why: '首版不启用行为分析上报' },
  { term: 'requestMidasPayment', why: 'IAA 版禁止虚拟支付' },
  { term: 'requestPayment', why: 'IAA 版禁止支付入口' },
  { term: 'shareTimeline', why: '首版不提供朋友圈分享入口' },
  { term: 'showShareMenu', why: '首版不在游戏内主动唤起分享菜单' }
]

function walk(target) {
  if (!fs.existsSync(target)) return []
  const stat = fs.statSync(target)
  if (stat.isFile()) return [target]
  return fs.readdirSync(target).flatMap(name => {
    if (name === 'node_modules' || name === '.git') return []
    return walk(path.join(target, name))
  })
}

function rel(file) {
  return path.relative(ROOT, file).replace(/\\/g, '/')
}

function lineOf(text, index) {
  return text.slice(0, index).split(/\r?\n/).length
}

function collect(files, checks) {
  const hits = []
  for (const file of files) {
    if (!TEXT_EXT.has(path.extname(file))) continue
    const text = fs.readFileSync(file, 'utf8')
    for (const check of checks) {
      const term = typeof check === 'string' ? check : check.term
      let from = 0
      while (true) {
        const at = text.toLowerCase().indexOf(term.toLowerCase(), from)
        if (at < 0) break
        hits.push({
          file: rel(file),
          line: lineOf(text, at),
          term,
          why: typeof check === 'string' ? '第三方识别词或误导宣传' : check.why
        })
        from = at + term.length
      }
    }
  }
  return hits
}

const scanFiles = SCAN_ROOTS.flatMap(walk)
const gameFiles = walk(GAME_ROOT)

const gameConfig = require(path.join(GAME_ROOT, 'config/index.js'))
assert.strictEqual(gameConfig.ageRating, '16+', '适龄准备必须锁定为 16+，不得空置或降级')
assert.strictEqual(gameConfig.operatorName, '东莞市常平创客汇网络技术工作室（个体工商户）', '运营主体须与执照全称一致')
assert.ok(gameConfig.supportEmail.includes('@'), '联系邮箱必须填写')
const consent = require(path.join(GAME_ROOT, 'legal/consent.js'))
assert.strictEqual(consent.VERSION, 6, '条款变更后必须提升协议版本并强制重签')
assert.strictEqual(gameConfig.creditCode, '92441900MAKCP05Q55', '统一社会信用代码须与执照一致')
assert.ok(String(gameConfig.version || '').length > 0, '发行版本号不能空')

const settingsSrc = fs.readFileSync(path.join(GAME_ROOT, 'scenes/settings.js'), 'utf8')
assert.ok(settingsSrc.includes('creditCode'), '设置页必须公示统一社会信用代码')
assert.ok(settingsSrc.includes('healthNotice'), '设置页必须展示健康游戏忠告')
assert.ok(settingsSrc.includes('contact'), '设置页必须公示客服邮箱')

const lobbySrc = fs.readFileSync(path.join(GAME_ROOT, 'scenes/index.js'), 'utf8')
assert.ok(!lobbySrc.includes('主动分享'), '大厅不应提供独立分享按钮')
assert.ok(lobbySrc.includes('healthNotice.lines[0]'), '大厅必须展示健康游戏忠告第一句')
assert.ok(lobbySrc.includes('healthNotice.lines[1]'), '大厅必须展示健康游戏忠告第二句')

const legalSrc = fs.readFileSync(path.join(GAME_ROOT, 'scenes/legal.js'), 'utf8')
assert.ok(legalSrc.includes('canAccept()'), '首次同意必须校验是否读完')
assert.ok(legalSrc.includes('请先滑动读完全部协议'), '未读完时必须提示用户继续阅读')

const userAgreement = fs.readFileSync(path.join(ROOT, 'compliance/user-agreement.md'), 'utf8')
const privacyPolicy = fs.readFileSync(path.join(ROOT, 'compliance/privacy-policy.md'), 'utf8')
const inGameDocs = fs.readFileSync(path.join(GAME_ROOT, 'legal/documents.js'), 'utf8')
for (const phrase of ['不因分享、邀请或关注发放任何利益', '反编译', '无法从服务器恢复']) {
  assert.ok(inGameDocs.includes(phrase) && userAgreement.includes(phrase), `用户协议与提审底稿偏离：${phrase}`)
}
for (const phrase of ['不取得或保存 OpenID', '不得把接入写成既成事实', '重新滑动读完', '不提供朋友圈分享入口']) {
  assert.ok(inGameDocs.includes(phrase) && privacyPolicy.includes(phrase), `隐私说明与提审底稿偏离：${phrase}`)
}

const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'project.config.json'), 'utf8'))
assert.strictEqual(config.compileType, 'minigame', 'project.config.json 的 compileType 必须是 minigame')
assert.strictEqual(config.miniprogramRoot, 'miniprogram/', '源码目录应为 miniprogram/')
assert.ok(fs.existsSync(path.join(GAME_ROOT, 'game.js')), '缺少 miniprogram/game.js')
assert.ok(fs.existsSync(path.join(GAME_ROOT, 'game.json')), '缺少 miniprogram/game.json')
assert.ok(inGameDocs.includes('统一社会信用代码'), '游戏内协议须载明统一社会信用代码')
const ignored = (config.packOptions && config.packOptions.ignore) || []
assert.ok(ignored.some(item => item.value === 'test'), '发布包必须排除 test 目录')

const pageArtifacts = gameFiles
  .filter(file => ['.wxml', '.wxss', '.wxs'].includes(path.extname(file)))
  .map(rel)
assert.deepStrictEqual(
  pageArtifacts,
  [],
  `发布包仍有普通小程序页面资源：\n${pageArtifacts.join('\n')}`
)

const ipHits = collect(scanFiles, FORBIDDEN_TERMS)
const runtimeHits = collect(gameFiles.filter(file => path.extname(file) === '.js'), FORBIDDEN_RUNTIME)

if (ipHits.length || runtimeHits.length) {
  const lines = ipHits.concat(runtimeHits).map(hit =>
    `${hit.file}:${hit.line}  [${hit.term}] ${hit.why}`
  )
  assert.fail(`法务门禁发现 ${lines.length} 处问题：\n${lines.join('\n')}`)
}

console.log(
  `法务门禁通过：扫描 ${scanFiles.length} 个发布/公开文件，` +
  '第三方识别词=0 · 诱导分享/云账号=0 · 支付入口=0 · Page/WXML残留=0'
)
