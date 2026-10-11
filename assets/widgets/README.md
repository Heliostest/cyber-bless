# 今日仪式小组件封面

`today/` 为项目现有 Three.js 场景的实际渲染图片。来源是 `scripts/widget-preview/scene.ts` 挂载的场景引擎、现有 CSS 和木鱼 GLB，不包含用户存档或完成状态。

- 小尺寸：600×600；中尺寸：1280×600。
- 11 个场景各两张，另有两张木鱼图片作为通用入口封面。
- `manifest.json` 记录引擎、尺寸、SHA-256、WebGL 渲染证据与素材 revision。
- Android 的 `drawable-nodpi/blessing_preview_*` 与对应源 PNG 字节一致。

运行 `npm ci` 安装已锁定的 Playwright，首次使用 `npx playwright install chromium` 安装浏览器；也可设置 `WBR_CHROME` 指定已有 Chrome。使用 `npm run mobile:widgets:render` 重新生成。修改素材后运行 `npm run mobile:widgets:test` 和 `npm run mobile:archive:verify` 检查随包资源。
