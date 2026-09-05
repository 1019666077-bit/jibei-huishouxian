# 测试与画面截图

`npm test` 覆盖法务门禁、画面层绘制、运行时场景、路线、物资、弹药、撤离、重开、内容、仓库、经济、审计、不变量和随机对局。不依赖微信开发者工具。

## 现行 UI 截图

`test/ui-*.png` 已删除。那些文件仍是换皮前的旧界面，带有第三方地图、货币和社交入口指纹，**不得作为当前产品或提审材料**。

要用现行画面取证，请在本机用微信开发者工具重截：

1. 打开本仓库，`compileType` 为 `minigame`，入口 `miniprogram/game.js`。
2. 启动模拟器后运行：

```powershell
cd test
node device-smoke.js
```

或先启动开发者工具自动化再跑 `node device-smoke-launch.js`。

3. 新截图会写到 `test/device-shots/`（`01-legal.png`、`02-index.png`、`03-report.png`）。该目录不作为发布包内容。
4. 提审前再按 `compliance/iaa-filing-material.md` 的截图清单，用现行大厅、局内、背包、结算、图鉴、设置各拍一张。确认画面只有北辰回收署 / 冻港 / 配给点等原创用语。

本机没有开发者工具时，只跑 `npm test`。通过即表示绘制函数和玩法回归是绿的，但不能替代真机或模拟器截图。

若只想在桌面浏览器里试玩或看画面（不是提审截图），可在 `test` 目录执行：

```bash
npx esbuild play-entry.js --bundle --outfile=play-bundle.js --platform=browser
python3 -m http.server 8765
```

然后打开 `http://127.0.0.1:8765/play.html`。协议页把鼠标悬在画布上滚动滚轮，或拖动正文区，直到底部提示消失、「同意并进入」亮起。静态分屏预览仍可用 `preview-entry.js` → `preview.html`。生成的 `*-bundle.js` 不要提交。
