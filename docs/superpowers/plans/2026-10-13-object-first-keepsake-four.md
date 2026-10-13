# Keepsake Four 实施与验证记录

Spec: docs/superpowers/specs/2026-10-13-object-first-keepsake-four-design.md

基线为干净 master `57ad9b6`，实现分支为 `codex/object-first-keepsake-four`。用户授权自行选题、实现、集成、验收及本地提交；完成后保留功能分支，不合并、不推送。按 dispatching-parallel-agents 技能分派三个独立场景目录，root 实现手记与共享集成、浏览器验收和 Git；另有只读独立审查。没有新增依赖、运行时外网资产或共享交互接口重构。

- [x] 阅读四项本地传统说明、参考照片，并核对公开来源与文化边界。
- [x] 炉前一炷：原创圆润香炉、盖托、纸套握柄、茶托，真实开盖与置香动作。
- [x] 红绳自持：原创线轴与立式绕线架，十二段连续绕绳、合扣、静看或明确书写。
- [x] 绘牌记谢：原创陶牌、画架、调色盘、笔，取笔与沿线描窗光。
- [x] 旅途一页：原创布面手记、铰接封面、布书签、山路页，翻书与夹签。
- [x] registry、engine、icons、native-safe catalog、叙事、分类、环境与 UTC 全年推荐覆盖。
- [x] 真实几何、指针所有权、宿主暂停/恢复、静默恢复、保存/还愿与资源释放回归。
- [x] 全套测试、生产构建、离线移动端导出、独立审查与全目录 GPU 巡检。
- [x] 新四场景三宽度浏览器完整流程与全目录布局验收。
- [x] 本地提交（`feat(scenes): add four object-first keepsake scenes`）。

## 验证与修复

四个模块共 81 项测试：香炉 20、红绳 27、绘牌 19、手记 15。先写失败回归后实现或修复；使用真实 Three.js 几何和射线，只替换 GPU 边界。另新增四个宿主适配器生命周期用例。指针取消、丢失捕获、失焦、暂停、单指所有权及错误起落点不推进；进度 0/1/2/3 恢复不重放声音、保存或完成副作用。红绳和绘牌仅明确提交表单才保存，未提交草稿加静看不会保存；还愿入口不新建心愿。

几何回归发现并修复：手记打开后的封面挡住书签，将书签移至桌前边缘并重新定位握点；绘牌笔迹原先浮离陶面，校准至陶面；红绳最终提示与文化说明卡片相交，将说明移至场景顶部并把静看握点放到右侧。红绳除常规宽度还验证 320×228、390×350 小画布。独立审查未发现重要问题，额外核对香炉和红绳 45 个全场首可见几何命中。

`npm test` 通过 1,260 项测试和木鱼资产校验，`npm run build` 成功，保留已有 chunk 大小提示。日志：`artifacts/keepsake-final-tests.log`、`artifacts/keepsake-final-build.log`。

全目录生产预览巡检通过：31 个场景加桌面视口，0 脚本错误、0 外部请求，33 个 WebGL 上下文全部释放，最终 live GPU 资源为 0。报告：`artifacts/cozy-scenes/keepsake-four/report.json`。巡检脚本补上桌面截图前展开“显示更多”的步骤，适配返回目录后重新收起的既有分页行为。

四个新场景在 320/390/1280px 的生产浏览器验收通过：12 组 Enter/Space 键盘与恢复流程、12 组实际物品与显示落点交互、2 组还愿流程，共 100 张实际截图，0 脚本错误、0 外部请求。实际指针验证错误起落点不推进，红绳依次通过十二段绕线；明确提交只保存一个心愿，静看不保存草稿，还愿仅消耗一个小物并给原心愿增加一条记录，心愿总数仍为 1、ledger 为空。390px 另验证返回恢复步骤 1、刷新恢复步骤 2，以及完成后新一轮不重复保存。报告 `artifacts/keepsake-four-scenes/browser/report.json`，日志 `artifacts/keepsake-final-browser.log`，截图同报告目录。已逐一目视检查四项手机截图，并检查 320px 与桌面关键阶段；红绳说明卡片与操作标签没有相交。

全目录 320/390/1280px 共 93 组布局检查通过：提示不拦截输入、标签位于画布内、无横向溢出、辅助按钮可用；另有 5 个既有场景完成真实 cue 交互回归，0 脚本错误。报告 `artifacts/object-first-scenes/browser/report.json`，日志 `artifacts/keepsake-object-browser.log`。

开发版首次绘牌 320px 实际拖动曾未推进；原脚本单场景连续复验六次、额外坐标/指针诊断一次均通过，未取得足以断定原因的失败证据。观察到取消后几何立即复位，提示坐标在下一渲染帧更新，验收脚本改为等待两帧再读取提示坐标，没有扩大生产命中区域。最终验收使用源代码冻结后的生产构建，构建与读取 dist 的浏览器测试串行。诊断记录保存在 `artifacts/keepsake-exvoto-diagnostic.mjs` 与 `.log`，模块目录不保留临时诊断代码。

宿主既有约定：目录重新进入已完成场景会开始新一轮，进度重置为 0。浏览器据此检查重新进入不重复保存心愿或收藏；模块另验证直接恢复 `initialProgress: 3` 不重放副作用。

## 移动端与已知限制

在线 `npm run mobile:verify` 在 Expo 远程版本兼容检查失败，提示五个补丁版本差异：`@expo/ui` 57.0.22→~57.0.23、`expo` 57.0.27→~57.0.28、`expo-dev-client` 57.0.19→~57.0.20、`expo-splash-screen` 57.0.9→~57.0.10、`expo-widgets` 57.0.23→~57.0.24。与本批基线的提示相同，本批不混入依赖更新。在线日志：`artifacts/keepsake-mobile-online.log`。

`EXPO_OFFLINE=1 npm run mobile:verify` 以锁定 SDK 的内置兼容表通过 typecheck、8 项 Node 回归和 Android/iOS native+DOM 导出。2026-10-13T03:51:22.925Z 完成最终验证：每端 35 个 DOM 脚本、12 份离线资产（13,466,736 字节）哈希一致，iOS 另验证 24 份 widget 封面。输出 `apps/mobile-expo/.expo-export-check/verify-yR0vUF`，记录 `artifacts/mobile-verification/latest.json`，日志 `artifacts/keepsake-mobile-offline-final.log`。离线检查不替代在线补丁版本兼容检查，也不是实体 iOS/Android 设备运行测试。

额外单独运行 scenes 包 tsc 时，既有 `daruma-eye-painting/scene.test.ts:188` 与 `procedural-kit.test.ts:46` 报 DOM Iterable 测试配置错误；生产 app `tsc -b` 与移动端 typecheck 均通过。本批未修改这两处已有测试配置。

开发预览：http://127.0.0.1:5177/；已验收生产预览：http://127.0.0.1:5178/。
