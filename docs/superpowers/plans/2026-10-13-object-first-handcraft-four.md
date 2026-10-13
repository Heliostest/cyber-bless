# Handcraft Four 实施与验证记录

Spec: docs/superpowers/specs/2026-10-13-object-first-handcraft-four-design.md

基线为干净 `codex/object-first-keepsake-four` 的 `24fa09a`，实现分支 `codex/object-first-handcraft-four`。继续用户已授权的四场景扩展、自主实现、集成、验收及本地提交；保留功能分支，不合并、不推送。沿用既有架构，不新增依赖或运行时外网资产。按 dispatching-parallel-agents 技能分派三个独立模块，root 实现木马、共享集成和全局验收，另安排只读独立审查。

- [x] 木马安放：原创四腿红色木马、叶形彩鞍、软布、底座；擦拭、安放、静看。
- [x] 舟模寄谢：原创曲腹船体、独立桅帆、索具、双鞍船架；立桅、落架、静看或明确书写。
- [x] 茶山一盏：原创空心陶壶、曲嘴、环把、茶匙、杯与托盘；添叶、倾倒、静看。
- [x] 归乡轻转：原创旋转体木陀螺、缠绕棉绳、拉珠与木板；拉绳、停稳、静看或明确书写。
- [x] registry、engine、icons、native-safe catalog、叙事、分类、环境、UTC 全年推荐覆盖。
- [x] 指针所有权、真实可见几何、取消与暂停、静默恢复、保存与还愿、资源释放。
- [x] 全套测试、生产构建与独立审查。
- [x] 最终生产浏览器三宽度流程、全目录布局、GPU 释放和移动端导出。
- [x] 本地提交（`feat(scenes): add four object-first handcraft scenes`）。

## 几何、交互与审查

四个模块共 88 项测试：木马 20、船模 22、茶具 21、陀螺 25。使用真实 Three.js 几何与射线，只替换 GPU 边界。起落点均为真实可见网格；木马四腿与底座接触、船腹与双鞍接触、桅杆随船体移动、茶壶倾斜与水流、陀螺绕接触点旋转均有相应检查。取消、丢失捕获、失焦、宿主暂停、多指及错误起落点不推进。恢复检查点 0/1/2/3 不重放声音、保存或完成副作用。船模与陀螺只有明确提交才新增心愿；静看不保存草稿，还愿不新建心愿。另新增四个宿主适配器生命周期回归。

失败证据包括共享集成五项缺项回归、陀螺两项框定检查，以及真实前景遮挡物回归。独立审查发现木马与陀螺原先过滤对象后求交会穿透前景物；分别新增 5 项和 6 项实物遮挡失败回归，再改为全场首可见不透明网格判定，仅落点检测排除当前手持物。修复后 88 项模块测试全部通过。船模恢复原位再判断落点的方案经 330 个桅座、745 个船架采样点检查，与排除手持物的接受结果一致；当前几何无新增问题。审查未留重要问题。

首轮生产浏览器截图发现陀螺步骤 1 的木帽提示遮住文化说明。浏览器新增说明卡与提示标签矩形相交断言，在旧构建上明确失败（`artifacts/handcraft-top-layout-red.log`）。移至 top10 后，390px 通过但 320px 三行卡片仍与标签相交；最终精简说明并移至 top4，保留当代原创、非宗教、出发与归乡及大屋社区背景。开发浏览器实测 320px 最小间隔 20.56px、390/1280px 为 20.97px；生产验收断言额外要求至少 8px 间隙。

全套回归最初另有两个既有今日推荐测试失败：新增目录项后，推荐场景可落在前 24 项分页之外。按产品现有行为，测试在卡片不可见时先点“显示更多”；没有修改产品分页或推荐逻辑。窄回归先失败后通过，最终全套通过。

## 验证结果

遮挡修复后 `npm test` 通过 1,376 项测试和木鱼资产校验；陀螺最终文案及布局调整后，其 25 项模块回归再次通过，`npm run build` 再次成功，保留已有 chunk 大小提示。日志：`artifacts/handcraft-final-tests.log`、`artifacts/handcraft-final-build.log`。构建与依赖 dist 的浏览器验收串行。

全目录生产预览 GPU 巡检通过：35 个场景加桌面视口，0 脚本错误、0 外部请求，37 个 WebGL 上下文全部释放，最终 live GPU 资源为 0。报告 `artifacts/cozy-scenes/handcraft-four/report.json`，日志 `artifacts/handcraft-gpu-browser.log`。此轮之后仅调整陀螺说明卡文案和位置，未改资源管理。

最终构建的四场景 320/390/1280px 浏览器验收通过：12 组 Enter/Space 键盘与恢复流程、12 组实际物品与显示落点交互、2 组还愿流程，共 100 张实际截图，0 脚本错误、0 外部请求。错误起落点不推进，静看不保存未提交草稿，明确提交仅保存一个心愿；还愿消耗一个小物、给原心愿添加一条记录，心愿仍为 1、ledger 为空。390px 另验证返回恢复步骤 1、刷新恢复步骤 2，完成后新一轮不重复保存。报告 `artifacts/handcraft-four-scenes/browser/report.json`，日志 `artifacts/handcraft-final-browser.log`，截图同报告目录。已目视检查四项最终手机截图、320px 和桌面关键阶段，文化说明与操作提示互不遮挡。

宿主既有约定：从目录重新进入已完成场景会开始新一轮，进度重置为 0。浏览器据此检查重新进入不重复保存；模块另验证直接恢复 `initialProgress: 3` 不重放副作用。

最终构建的全目录 320/390/1280px 共 105 组布局检查通过：提示不拦截输入、标签位于画布内、无横向溢出、辅助按钮可用；另有 5 个既有场景完成真实提示位置交互回归，0 脚本错误。报告 `artifacts/object-first-scenes/browser/report.json`，日志 `artifacts/handcraft-object-browser.log`。

## 文化边界与来源

四项本地传统卡及图片已阅读，参考照片仅观察，不复制入产品。木马使用工艺文化背景；船模表达航海感谢，不模拟教堂献船；茶具取茶山生态欣赏层；陀螺为当代非宗教出行与归乡手势练习，不声称是米南加保专属古俗。来源与边界详见各模块 README。

- 木马：[Dalarnas museum](https://dalarnasmuseum.se/utstallningar/fasta-utstallningar/dalahastar/)、[Nordiska museet](https://webbshop.nordiskamuseet.se/collections/dalahastar)。本地照片实际为仲夏柱，不作为木马造型依据。
- 船模：[Kökar St Anna's church](https://www.kokar.ax/st-annas-kyrka?lang=en)、[Lumparland church](https://www.kyrkor.ax/churches/lumparland-chapelchurch/)。后者献船年份自相矛盾，产品不作年份声称。
- 茶具：[UNESCO 景迈山古茶林文化景观](https://whc.unesco.org/en/list/1665/)。原创器型不声称为布朗族专属传统器物。
- 陀螺：[UNESCO Nagari Sijunjung 暂定名录](https://whc.unesco.org/en/tentativelists/6059/)。仅采用家庭与社区背景；暂定名录不等同正式世界遗产。

## 移动端限制

在线 `npm run mobile:verify` 的 typecheck 通过，但 Expo 远程版本兼容检查仍提示与上批相同的五个补丁版本差异：`@expo/ui` 57.0.22→~57.0.23、`expo` 57.0.27→~57.0.28、`expo-dev-client` 57.0.19→~57.0.20、`expo-splash-screen` 57.0.9→~57.0.10、`expo-widgets` 57.0.23→~57.0.24。本批未混入依赖更新。日志 `artifacts/handcraft-mobile-online.log`。

最终源码的 `EXPO_OFFLINE=1 npm run mobile:verify` 通过 typecheck、8 项 Node 回归与 Android/iOS native+DOM 导出。2026-10-13T05:07:18.534Z 完成最终验证：每端 39 个 DOM 脚本、12 份离线资产（13,466,736 字节）哈希一致，iOS 另验证 24 份 widget 封面。输出 `apps/mobile-expo/.expo-export-check/verify-JwmmFH`，记录 `artifacts/mobile-verification/latest.json`，日志 `artifacts/handcraft-mobile-offline-final.log`。离线验证使用锁定 SDK 的内置兼容表，不替代在线补丁兼容检查，也不是实体 iOS/Android 设备运行测试。

开发预览：http://127.0.0.1:5177/；已验收生产预览：http://127.0.0.1:5178/。
