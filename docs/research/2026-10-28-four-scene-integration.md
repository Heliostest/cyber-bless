# 四个本地场景分支合并核查

日期：2026-10-28。用户明确要求将四个既有本地场景合并并推送；旧 README 中的“仅本地提交”按历史交付条件保留说明，由本次指令授权继续整合。

## 范围与兼容

| 场景 ID／来源 slug | 原始场景提交 | 合并提交 |
| --- | --- | --- |
| hindu-coconut-offering | 932f752e | f7a1cf9b |
| mezuzah-doorpost | 996fe444 | cf501d38 |
| sri-lankan-bodhi-puja | 57ce0fd5 | d00b19a6 |
| ukrainian-didukh | 9b44c8d8 | 35847d57 |

基线为 `6f38a5a7`。四个原始提交均保留在合并历史中；技术 ID、各自 `@1` 引擎标识、旧检查点整数和已有存档语义保持。当前目录为158项，公开91项，隐藏67项；四个新增场景均进入公开目录及祈福池。已有场景、来源关联和当前连续拿放实现没有因旧分支覆盖而退回。

合并处理了宿主引擎、目录、意图、叙述、图标、场景注册表、环境配置、操作测试、浏览器工具、组件目录与三尺寸封面。原生目录顺序与实际宿主目录一致，封面按场景 ID 合并并重新计算 manifest revision。

旧分支将有效起点加终点释放视为无效输入，与当前共享指针会采样有限 pointerup 终点的契约不同。四场测试保留无起点、静止、反向、过短、横轴、回撤、取消和暂停等负例，并新增各检查点的终点采样正例；未修改共享输入或放宽精度、超时。新场景原有三段产品操作保持。

## 文化来源核查

已按[来源规范](../scene-provenance.md)阅读实际模型、动作、完成条件与可见文案，并由两组独立审阅重新读取相关一手机构正文。菩提供水另下载原始教育资料，目视读取 PDF 第2、28页；实际读取范围、访问状态和不能外推的主张分别写入以下记录。

- 椰果：[源卡](../../content/traditions/hindu-coconut-offering.md)、[研究](2026-10-23-hindu-coconut-offering.md)、[场景 README](../../packages/scenes/src/hindu-coconut-offering/README.md)。
- 门柱：[源卡](../../content/traditions/mezuzah-doorpost.md)、[研究](2026-10-24-mezuzah-doorpost.md)、[场景 README](../../packages/scenes/src/mezuzah-doorpost/README.md)。
- 菩提：[源卡](../../content/traditions/sri-lankan-bodhi-puja.md)、[研究](2026-10-24-sri-lankan-bodhi-puja.md)、[场景 README](../../packages/scenes/src/sri-lankan-bodhi-puja/README.md)。
- 迪杜赫：[源卡](../../content/traditions/ukrainian-didukh.md)、[研究](2026-10-24-ukrainian-didukh.md)、[场景 README](../../packages/scenes/src/ukrainian-didukh/README.md)。

- [x] 器物、材料、动作、对象、场合和完成条件逐项核对，产品构思未反向充当传统证据。
- [x] 四个专卡直接对应实际器物和实践，宿主、注册表及模块来源身份一致，没有地区索引式错绑。
- [x] 宗教礼敬、祈愿、家庭身份和祖先信念保留；信众相信的效果不写成产品保证。
- [x] 原创造型、三个输入、方向、时长、辅助操作和画面完成反馈明确为产品安排，没有新增传统数量、资格或期限。
- [x] 可见中文文化事实未改写，八语保持原有范围和限定；原生组件标题同步。
- [x] 历史分支的截图、测试和导出记录与本轮验证分开；旧 artifacts 在当前工作区不可复核的限制已标明。

## 本地化与收藏展示

新增57条来源文案，八语共456条新增目录消息，32个组件标题已逐项检查；所有旧场景／叙述译文保持。原生生成物从干净主线独立生成，详见[本地化记录](2026-10-28-four-scenes-i18n-integration.md)。四场的可见操作提示接入现有动态语言绑定。

四个新增收藏小物各有明确的现有声音／动作预设：椰壳的空腔轻响、护盒的克制金属回应、水壶的陶器回应和麦束的轻柔摆动。它们仅返回展示声音与关键帧数据，不推进仪式、不写心愿或变体，也不作为文化事实。新增回归先失败，随后反馈、物件预览、小物架等64项专项通过，独立复审无阻塞。

## 本轮技术验收

- 定向场景检查：椰果80、门柱78、菩提79、迪杜赫79项通过；共享目录、宿主生命周期、注册表、环境与组件图片对应检查通过。
- 八语提取、ICU／段落、审阅 hash、原生生成物和类型检查通过；旧译文与法律文案没有混入并行分享任务的改动。
- 生产构建退出0，保留既有大 chunk 提示；日志 `artifacts/four-scenes-final-build.log`。
- 三宽键盘／鼠标：320、390、1280px，共24条完整流程、96张截图，恢复、可见提示、实际对象操作、取消和完成检查通过，页面错误与外部请求均为0。日志 `artifacts/four-scenes-browser-mouse.log`。
- 英文320×640：四场可见标题、指引和辅助操作均正确，每场通过一个真实键盘检查点，无横向溢出或页面／控制台／请求错误。证据 `artifacts/four-scenes-english/`。
- Android／iOS离线导出退出0，各164份代码／HTML产物含四个新增 ID；477项iOS组件封面和14项离线资源哈希通过，未发现并行任务的 `app.share.*` 文案。日志 `artifacts/four-scenes-final-mobile-physical.log`。
- 隔离工作区的移动端验证仅在忽略的依赖目录补齐已锁定版本，并用 artifacts 中的测试专用 Metro 配置读取链接依赖；未改变应用 Metro 配置、依赖清单或锁文件。原跨盘依赖解析失败日志保留，没有修改应用规避验证。
- [x] 根 `npm.cmd test` 低并发完整复跑退出0：369个Vitest文件、11953项测试及20项Node脚本测试通过，总计11973项，零失败、零未处理错误。仅通过已安装Vitest支持的环境参数将线程／进程上限设为2、下限设为1，未跳过用例、修改断言或延长超时。最终日志 `artifacts/four-scenes-final-test.log`。上一轮10220项场景断言通过但发生 `onTaskUpdate` 通信超时的日志保留于 `artifacts/four-scenes-worker-timeout-test.log`，不作为最终通过结果。
- [x] 320、390px普通动画触摸模拟8/8条完整流程通过，32张截图，页面错误和外部请求均为0；日志 `artifacts/four-scenes-browser-touch.log`。

浏览器证据来自桌面 Chromium／SwiftShader和触摸模拟，不宣称手机真机性能、触感或宗教事实认证。本次仅合入四个场景；另一个聊天正在开发的分享功能保留在原工作区，没有纳入此主线提交。
