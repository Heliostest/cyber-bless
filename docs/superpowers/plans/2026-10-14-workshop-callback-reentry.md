# Workshop 回调重入修复与合并

用户要求完成提交、合并、推送后，新开会话继续开发并逐场景提供实际运行截图。核对时，最新编扇/织毯批次及验收记录已在 master/origin/master（0e9059c）；当前 codex/workshop-callback-reentry 留有上一轮未完成的跨场景回归测试，因此先接续该项再交接。

## 范围与根因

只修改铁线栖鸟、花绣寄语、釉彩映晴、彩车迎晴四个模块及其跨模块测试。宿主在 onProgress、haptic 或 prepareFeedback 中同步触发输入，会在同一动作结算中连续消费检查点，或提前接受心愿提交。原有 42 项回归有 22 项失败，日志 artifacts/workshop-callback-reentry-baseline.log。

每个模块在通知宿主期间建立局部输入保护，用 try/finally 恢复状态。保护覆盖键盘、物品起点与移动、内部动作接受和心愿提交；检查点仍在通知之前提交，暂停/销毁、已经接受的保存、恢复和完成事件语义保持。造型、文化文案、背景、相机、资源与共享指针接口不改动。

保留并行发布工作的 67 个未提交文件，内容哈希记录为 artifacts/workshop-callback-reentry/preserved-before.json。暂存仅限本修复明确拥有的四份源码、回归测试和本记录，不包含商店、法律页、package.json 或其他发布改动。

## 验证

- 50 项跨场景回归（含新增 8 项实际物品拖动重入）与四模块原测试共 213 项通过：artifacts/workshop-callback-reentry-targeted.log。
- 完整测试 2,188 项和木鱼资产校验通过：artifacts/workshop-callback-reentry/full-tests.log。
- 生产构建通过，保留既有 chunk 大小提示：artifacts/workshop-callback-reentry/build.log。独立生产目录 artifacts/workshop-callback-reentry/production，预览 http://127.0.0.1:5194/。
- 移动端 typecheck 通过：artifacts/workshop-callback-reentry/mobile-typecheck.log。本修复不改变原生配置或依赖；在线 Expo 的既有五项补丁版本差异没有作为本轮成功项，不混入依赖升级。
- 独立审查通过，无阻塞或次要发现；审查者只读复跑 213 项相关测试，全部通过。未配对指针按下仍遵循共享指针层既有释放/取消规则；异步排队输入与宿主查询函数主动重入不在本次同步通知保护范围内。
- 三宽度生产浏览器验收通过：320、390、1280px 下共 12 条键盘/恢复流程、12 条真实物品交互流程和 2 条还愿流程，100 张截图，0 浏览器错误、0 外部请求。报告：artifacts/workshop-callback-reentry/browser/report.json。逐场景查看截图，物体、手势提示、表单与窄屏布局正常。
- 合并采用已验证的同一源码树；推送后核对本地 master、origin/master 与远端 master，并再次核对并行文件哈希。最终提交号记录在会话交付中，避免为记录自身提交号反复增加提交。

## 下一会话

从最终 origin/master 继续既有的 C 级公开工艺题材路线，最多四个新场景一批，先排除已有 ID 与内容来源，保留清透安静背景和物品优先交互。检查并行发布工作，避免同目录构建与浏览器验收冲突；完成后每个新场景直接内嵌至少一张实际运行截图。不要重复开始本次已完成的回调修复，也不要将旧日志的测试数字当作下一批的新验证结果。
