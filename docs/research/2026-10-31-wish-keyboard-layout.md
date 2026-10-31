# 心愿输入的键盘视口修复

日期：2026-10-31。

用户反馈：仪式完成后打开祈愿表单、聚焦输入框，整页上移，表单被顶到屏幕顶部，键盘上方出现大块空白。

## 原因与修改

- `useSceneViewport` 原来只读取 `visualViewport.height`，忽略聚焦输入时独立发生的视口偏移。现在同时读取 `offsetTop`，监听 `resize` 和 `scroll`，退出仪式时清理属性和监听。
- 手机仪式 shell 固定在可视区域顶部；桌面设备框继续沿用原有布局。接口语义参见 [MDN VisualViewport](https://developer.mozilla.org/en-US/docs/Web/API/VisualViewport)。
- 键盘缩短可见高度后，`useAppLayout` 原来仍启用场景的最小高度滚动模式，使绝对定位在场景底部的心愿表单落到屏幕之外。表单打开期间优先容纳编辑区域，关闭后恢复原来的场景布局判断。
- 表单外层采用可收缩的 flex 布局，让短屏下的溢出由表单自身滚动承担。
- 不全局关闭原生 WebView 滚动，普通长页面继续保留原有滚动能力。

## 验证

- 新增两项回归：视口高度不变时的键盘平移／退出清理；短视口打开表单与关闭后的滚动恢复。均先观察到失败，再修改实现并通过。
- `npm run test -w @wbr/app -- src/scene-viewport.test.ts src/app-layout.test.ts`：4 项通过。
- `npm run build -w @wbr/cyber-bless`：通过，有既有大体积 chunk 提示。
- `npm run typecheck -w @wbr/mobile`：通过。
- `npm test`：i18n、core、runtime 通过；app 为 1267 项通过、43 项失败，均在 `hourly-scene-lifecycle.test.ts`。一项为 `scottish-first-footing` 完成 checkpoint 断言，其余 42 项为连续动作恢复用例找不到当前 draggable cue。该文件直接运行场景引擎，未加载 App、视口 hook、布局 hook 或 CSS，不在本次布局修改执行路径中。完整输出在本机 `artifacts/wish-keyboard-test.log`。
- Chrome 中使用独立内存场景预览，未读写个人存档；验证聚焦、填写、取消、保存与恢复高度。390×390 浏览器设置对应约 354.5 CSS px 可见高度：shell 顶部为 0，输入框与两个按钮完整位于可见区域。320×300 对应约 272.7 CSS px：表单 `clientHeight=186`、`scrollHeight=237`，内部可滚动，保存成功。预览工具栏仅在截图时临时隐藏，随后重新加载清除。
- 使用实际 CSS 复核 320／390／600／999／1000px 宽度、240px 可见高度及大字体，手机与桌面居中规则正常，极短表单可收缩并内部滚动。
- [短视口验证截图](../../artifacts/wish-keyboard-short.png)只反映浏览器短视口模拟；尚未在 iPhone 发布版 Expo DOM WebView 上实测系统键盘，不将浏览器结果当作真机结论。

## 文化影响核查

本次仅修改共享视口与表单布局。器物、材料、场景动作、完成条件、标题、介绍、寓意、来源绑定、引擎 ID 与存档结构均未变更。按 [场景来源规范](../scene-provenance.md)的纯布局改动规则，沿用[已有全场景核查](2026-10-19-scene-culture-audit.md)，不新增或改写文化主张，无需更改来源卡、模块 metadata 或场景 README。
