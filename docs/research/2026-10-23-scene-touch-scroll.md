# 场景画布与页面触摸滚动分区

日期：2026-10-23。用户批准的规则是画布内的触摸手势全部归场景处理，画布外保留正常页面滚动。

## 原因与修正

宿主的 `.scene-overlay--stage .scene-hit-layer` 把原有 `touch-action: none` 覆盖为 `manipulation`，有意允许从画布空白处滚动。`claimObjectTouches` 只在首触命中物体时阻止默认行为；用户起手稍偏时，浏览器会开始滚动并发送 `pointercancel`，中止场景操作。

将该触控层恢复为 `touch-action: none`，并为宿主的 `.scene-canvas` 明确设置相同规则。限制只作用于画布与其触控层，舞台、整层 overlay、操作托盘、介绍和留言区域不设置全局滚动锁。沿用现有指针捕获、释放和取消逻辑；没有新增手势模式切换或正文滚动拦截。

`procedural-kit.ts` 的注释同步说明 JS 命中保护是兼容处理，画布内的滚动归属由宿主 CSS 预先确定。

## 回归证据

新增 `scripts/verify-scene-touch-scroll.mjs`，使用 Playwright 的 Chromium CDP 原生触摸输入，逐步移动时为浏览器滚动识别留出时间。运行前启动 `npm run dev -- --host 127.0.0.1 --port 5182`，然后执行 `node scripts/verify-scene-touch-scroll.mjs`；也可用 `WBR_URL` 指定地址。

在 390×800 与 320×720 视口，各验证木勺、三石的画布空白触摸、真实物体拖放与画布外滚动，另验证木勺拖出画布、无效释放后重新拖放。共14项，检查页面位移、无原生滚动导致的 `pointercancel`、物体操作确实推进阶段，以及无效落点不推进但可重试。

- RED：新增样式断言在旧规则下失败；14项浏览器回归中4项画布空白触摸失败，页面均从40px滚到125px。其余10项通过，页面运行错误为0。
- GREEN：相同14项浏览器回归全部通过；画布内的页面位置保持40px，画布外仍从40px滚到125px，页面运行错误为0。
- App全部27文件915项测试通过；其中样式测试66项通过。全部场景及测试源码类型检查通过。
- 修正旧测试名称和注释后，`procedural-kit`、水引和铃绳3文件67项定向回归再次通过；断言内容保持不变，明确区分 JS 物体命中保护与宿主 CSS 滚动归属。
- Web生产构建通过；移动端类型与Expo依赖检查、8项移动构建脚本测试、Android/iOS原生及嵌入DOM生产导出通过。两平台各14项离线资源哈希及iOS的396项widget封面哈希通过。构建保留既有的大分包和颜色环境变量提示。

红绿日志分别是 `artifacts/interaction-fixes-2026-10-23/touch-scroll-red.log` 与 `touch-scroll-green.log`；结构化报告保存在 `artifacts/scene-touch-scroll/report-red.json` 与 `report.json`。浏览器回归测试的是实际 App 与 Three.js 对象，未用合成 DOM 指针事件代替原生触摸，也不将浏览器仿真称为手机真机验收。

## 文化影响核查

已按[来源核查规范](../scene-provenance.md)核对范围。本次是宿主触控事件分配修复，没有改变器物、材质、造型、三步动作、完成条件、标题、介绍、提示、寓意、文化主张或来源分类。沿用[场景交互修正记录](2026-10-23-scene-interaction-fixes.md)及各场景既有来源核查，不新增外部文化事实或已读来源登记。

来源卡、场景 README、宿主目录、注册表、模块 metadata 和原生组件标题的文化内容均无需变更；技术 ID、引擎版本与存档保持兼容。人工文化影响审阅与上述技术测试分别记录，技术通过不用于证明传统事实。
