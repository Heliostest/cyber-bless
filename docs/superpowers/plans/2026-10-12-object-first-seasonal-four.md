# Seasonal Four 实施记录

Spec: docs/superpowers/specs/2026-10-12-object-first-seasonal-four-design.md

按 dispatching-parallel-agents 技能将三个独立场景文件夹交给子代理；root 实现叶舟及共享集成、验证与 Git。各代理只编辑各自文件夹，不提交、不构建 dist；root 最后统一本地提交。用户已明确自行定题并直接执行，覆盖技能中重复设计审批流程。

- [x] 确认干净 master 94f0182；创建 codex/object-first-seasonal-four。
- [x] 阅读传统说明与参考图，写明选题、交互和文化边界。
- [x] 签纸慢读模块与真实几何/生命周期测试。
- [x] 一篮春食模块与明确书写/还愿/生命周期测试。
- [x] 春锅共煮模块与搅拌路径/几何/生命周期测试。
- [x] 叶舟寄意模块与真实几何/书写/生命周期测试。
- [x] registry、engine、icons、native-safe catalog、environment 与相关契约测试。
- [x] 浏览器三宽度真实 cue 流程、键盘、误操作、保存/还愿，27 场景 GPU/离线检查。
- [x] 全套测试、构建、移动端验证（在线补丁提示见下文，离线双端导出通过）、独立审查，修复并本地提交。

任务边界：前三模块互不共享文件；root 消费其 create/meta 导出并集成 ID，各模块共用 scene-runtime/procedural-kit/object-pointer 接口，没有接口重构。浏览器验收发现近距离拖动落点被误判为重复提示，root 在共享提示层修复这一缺陷。文化与动作约束以 spec 为准。

## 验证记录

模块测试共 106 项：签纸 33、春食篮 20、春锅 28、叶舟 25。均经过缺失实现或缺陷回归的红绿验证。

独立审查已修复：春锅初始陶碗悬空、搅拌错误接受勺柄起点；叶舟透明命中代理改为可见烛芯与前叶绑片，浮灯底面精确接水面；签筒和春锅失焦冻结已接受动作并隐藏提示。叶舟绑片移至叶片外侧，射线首命中回归通过。代理审查记录和实际代码均复核。

浏览器实际拖动发现共享提示层会隐藏距拖动起点不足 24px 的目标，导致春锅连续圆点的下个目标消失。新增失败回归后，将去重限制为重叠的点击提示；近距离拖动目标保持可见，原点击去重测试仍通过。独立复查无新增阻塞问题。

最终 `npm test` 通过 1,151 项测试及木鱼资产校验；`npm run build` 成功（保留既有 chunk 大小提示）。日志：artifacts/seasonal-four-final-tests.log、artifacts/seasonal-four-build.log。

生产预览全目录 GPU/离线检查通过：27 个场景与额外桌面视口，0 脚本错误、0 外部请求；29 个 WebGL 上下文全部释放，最终 live GPU 资源为 0。报告 artifacts/cozy-scenes/seasonal-four/report.json。

全目录 320/390/1280px 共 81 组布局检查通过：物品提示不拦截输入、标签在画布内、无横向溢出、辅助按钮可用；另 5 个既有场景完成真实 cue 交互回归，0 脚本错误。报告 artifacts/object-first-scenes/browser/report.json。

新四场景三宽度浏览器检查通过：12 组键盘/恢复流程、12 组实际显示物品与落点交互、2 组还愿流程，共 100 张截图，0 脚本错误、0 外部请求。实际拖动覆盖连续八点搅拌、错误起点/落点不推进；明确提交才保存，安静结束不保存未提交草稿；还愿仅追加原心愿的一条记录、消耗一个小物，心愿总数保持 1，ledger 保持空。390px 验证返回后恢复步骤 1、刷新后恢复步骤 2；各模块另覆盖恢复完成态不重放副作用。已目视检查 320/390/1280px 的主体支撑、提示、书写区和辅助按钮。报告 artifacts/seasonal-four-scenes/browser/report.json，截图同目录。

交付：本地分支 codex/object-first-seasonal-four，提交消息 `feat(scenes): add four seasonal object-first rituals`；不合并、不推送。开发预览 http://127.0.0.1:5177/，已验收的生产预览 http://127.0.0.1:5178/。

目录超过原有 24 项分页阈值；测试通过“显示更多”验证全部 27 项与旧纸鹤入口，产品分页保持原设计。UTC 日序全年可达回归现覆盖整个目录。

在线 `npm run mobile:verify` 的 Expo 远程兼容表提示五项刚发布的补丁版本：expo、@expo/ui、expo-dev-client、expo-splash-screen、expo-widgets。锁文件与已安装 SDK 的 bundledNativeModules.json 一致；本批不混入依赖升级。补充 `EXPO_OFFLINE=1 npm run mobile:verify` 按已锁定 SDK 内置表校验并执行完整 Android/iOS native+DOM 导出与离线资产哈希检查。在线检查提示记录保留在 artifacts/seasonal-four-mobile.log；离线导出证据见最终验证记录。

最终离线移动端验证于 2026-10-12T15:16:53Z 完成：typecheck、内置依赖版本检查、8 项 Node 回归、Android/iOS native+DOM 导出全部通过；每端 31 个 DOM 脚本、12 份离线资产（13,466,736 字节）验证一致，iOS 另验证 24 份 widget 封面。输出 apps/mobile-expo/.expo-export-check/verify-03lxyP；机器记录 artifacts/mobile-verification/latest.json，完整日志 artifacts/seasonal-four-mobile-offline.log。离线检查不能替代远程补丁版本兼容表，在线提示仍需单独升级依赖后复验。
