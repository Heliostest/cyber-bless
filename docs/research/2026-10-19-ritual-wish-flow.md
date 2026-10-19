# 仪式动作与可选心愿记录（2026-10-19）

## 本次实现

- 方巾裹礼从两次主要动作扩为六次独立拖放：近角、远角、左角、右角、交叉系带、拉紧布结；最终按布角覆盖盒顶区域、实际带面交叠、结环缩紧分别判定，松手确认，完成包裹后由用户手动结束。后续判定细化与最新验证见[覆盖与收结记录](2026-10-19-bojagi-coverage.md)。
- 所有 35 项 App 可见场景从开始就展示与眼前动作对应的心意提示。祈愿、赠礼祝福、感谢、自省、礼敬与节庆分别表达，不把全部活动重新定义为许愿。
- App 通过适配器延后独立场景的书写控件；免输入的实际动作照常执行。许愿／祝福场景完成后才出现「记下心愿（可选）」入口，默认不展开输入框。
- 主动展开并点「写好了」才创建心愿。空白、输入中、取消和直接完成退出均不创建心愿；同一次提交不重复保存。完成与收藏仍同排。
- 已有小物、每日收集、还愿与新手流程保留。旧版已明确输入的小物草稿继续支持保留／放弃；达摩、御守等还愿提示根据本次实际动作切换为感谢。
- 四次折角的细分进度使用 `bojagi-step-N` 记录，原整数 0–3 检查点和引擎 ID 保持兼容；新一轮重新体验清除细分进度，未完成的每日／普通访问继续上次操作。
- 隐藏的 43 项继续隐藏，源码及独立模块保留。另修复隐藏泉景唯一的强制书写门槛，以及花环／小符结束时读取未提交草稿的问题。

## 来源与文化边界

六步拖放顺序、目标标记、动画、音效、震动、手动结束和完成后记录均为产品安排。包袱布的物类与赠礼心意沿用 [LACMA](https://unframed.lacma.org/2014/01/02/bojagi-the-korean-wrapping-cloth) 和[首尔旅游组织](https://english.visitseoul.net/walking-tour/koreangiftwrappingbogaji/ENN033541)已读正文；不称六步为传统规定或完整结法教学。[来源卡](../../content/traditions/korean-bojagi.md)与场景 README 同步记录支持范围。

其他提示逐项核对见[场景心意核查](2026-10-19-ritual-intentions.md)；输入与保存边界全目录核对见[写愿门槛核查](2026-10-19-wish-completion-gates.md)。传统事实中的真实祈求、礼敬、占问、谢恩及书写语境保持原义，应用免输入安排不反过来证明传统本来不书写。

## 验证记录

- 全仓库 `npm test` 一次完整运行通过，139 个测试文件、4243 项：core 52、runtime 11、App 644、gestures 54、shared 3、scenes 3324、content 37、scene-runtime 118。`VITEST_MAX_THREADS`／`VITEST_MAX_FORKS` 为 2，对应最小值为 1，不改默认测试超时。木鱼素材结构检查也通过；日志 `artifacts/ritual-wish-flow-tests.log`。
- 生产 `npm run build` 通过 TypeScript 与 Vite，保留既有的大分块体积提示；日志 `artifacts/ritual-wish-flow-build.log`。
- 方巾专项 52 项、宿主六步生命周期夹具 6 项通过；真实浏览器覆盖 390 正常动画鼠标、284 减少动态鼠标、320 Chrome 原生触屏、1280 桌面鼠标。每一组均检验六次错误落点被拒绝、目标处持有不提前提交、松手落定及手动结束。最终抓取范围／近景调整后另复核 320 原生触屏全流程，含向内偏移 12px 仍在可见布面上的抓取、可见松手提示、实时关闭／开启震动与准确强度；`artifacts/korean-bojagi-wrap/drop-final/browser.json`。
- 音效使用真实反馈实现、仅替换 WebAudio 硬件边界验证：开启时播放，实时静音后不增加振荡器，再开启恢复播放；资源只关闭一次。浏览器的震动检查验证实际 App 的反馈调用，不将桌面 API 记录写成实体触觉主观评测。
- 独立审阅发现的窗口缩放重置实时布面、还愿提示误用首次许愿内容两项问题均已修复并复核；新增回归先失败后通过。

- `node scripts/verify-optional-scene-wishes.mjs` 完整通过：35 项可见场景的心意标题、动作提示均实际可见，动作中没有文字输入框；另以 320px 实际 App 页面验证短册主动提交只生成 1 张心愿卡、方巾取消草稿后直接退出为 0 张、御神签不另设许愿入口且直接完成为 0 张。空白不可提交、输入不自动保存、取消后草稿清空均通过；报告 `artifacts/optional-scene-wishes/browser.json`。首次脚本误把目录页当作含底部导航的主页面而超时，修正返回路径后整轮重跑通过；该错误没有改动产品导航。
- `node scripts/verify-scene-completion-layout.mjs` 完整通过：御神签普通完成、纸鹤明确保存心愿后两种状态，各检查 390／320／284／1280px 共 8 项，完成状态与完成／收藏按钮同排且右对齐、单行，按钮至少 44px，无横向溢出、无页面异常；报告 `artifacts/scene-completion-layout/browser.json`。
- 最终相关文件 `git diff --check` 通过。

人工来源核对与技术验证分别记录；不将浏览器通过视为文化事实的证明。

### 额外的独立测试文件类型检查

`npx tsc --noEmit -p packages/scenes/tsconfig.json` 返回 1，报出以下七条既有测试类型诊断。已逐行与 `git show HEAD` 核对，这五个文件没有本次差异，错误行相同；本次生产构建的 TypeScript 与 Vite 编译已通过。

| 未修改的测试文件 | 位置与诊断 |
| --- | --- |
| `chinese-woodblock-print/scene.test.ts` | 174:67、176:100，TS2367，比较 `void` 与 `HTMLElement` |
| `polish-paper-cut/scene.test.ts` | 308:70、311:58，TS2367，同上 |
| `daruma-eye-painting/scene.test.ts` | 188:22，TS2488，独立包 lib 未含 DOM.Iterable 的 NodeList 迭代类型 |
| `procedural-kit.test.ts` | 46:16，TS2488，同上，DOMTokenList 迭代类型 |
| `welsh-love-spoon/scene.test.ts` | 254:75，TS2339，`Shape \| Shape[]` 未收窄即读取 `holes` |

该额外检查的失败不登记为通过，也不与本次全仓库运行测试或生产编译混为同一检查。独立场景模块的运行验证结果另列于上方集成记录。
