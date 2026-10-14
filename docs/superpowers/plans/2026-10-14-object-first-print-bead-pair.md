# 印纸与珠星：实施及验收

沿用用户批准的 C 级公开工艺路线，自主选择最多四件，本批两件。基线 a7ddc66；工作区 object-first-paper-pair，分支 codex/object-first-print-bead-pair。主工作区及移动端发布文件不属于本批。开始时实际目录 53 件，交付后为 55 件。

## 设计

| ID / 标题 | 地区索引 | 材料与交互 | 分类 |
| --- | --- | --- | --- |
| chinese-woodblock-print / 木版留春 | chinese-folk-and-confucian | 已上墨木版、覆纸、棕擦；真实棕擦擦过纸背，提起纸角揭出原创枝叶印纹，静看或明确保存一句心愿 | C / 低，许愿 |
| czech-bead-star / 珠星映光 | czech-moravian-folk | 银蓝色空心玻璃珠、细铁线、木托；将最后一串珠穿入星臂，真实横向拖转珠星观察光泽，轻点静看 | C / 低，祈福 |

两件采用真实物体射线命中。动作必须造成可见材料变化；不可仅换文案做装配—安放模板。保持三检查点，不改宿主接口。主体清楚、环境安静清透；木版靛墨 #334c5b、纸白 #eee6cc、木色 #b59467、浅鼠尾草 #91a89a；珠星银白 #dce8e8、浅蓝 #739daf、淡金 #c8b779、木色 #bfa587。沿用 App 字体与辅助按钮，主体承担视觉特征。

来源：
- UNESCO [China engraved block printing technique](https://ich.unesco.org/en/RL/china-engraved-block-printing-technique-00229)，木版、墨、纸与手工转印。长链接读取遇到站点验证，2026-10-14 搜索索引提供机构正文摘要。
- 扬州中国雕版印刷博物馆 [中韩日现存古籍雕版印刷技术分析](https://yzmuseum.com/index.php?a=show&g=home&id=258&m=article)，纸背刷印工具及材料。
- UNESCO [Handmade production of Christmas tree decorations from blown glass beads](https://ich.unesco.org/en/RL/handmade-production-of-christmas-tree-decorations-from-blown-glass-beads-01559)，2026-10-14 已读取搜索索引中的完整机构介绍：北波希米亚 Giant/Jizera 地区、吹制空心珠、镀银着色、裁分与穿线组装。长链接直接打开遇到站点验证。

地区卡的 C/低是内部设计分级，不是机构对 App 的授权。卡片只作地区索引，两件另有工艺证据，不声称工艺来自卡内宗教礼仪。原创枝叶、星形结构，不复制具体作品；不涉及经书、族谱、神像、圣事或灵验承诺。

## 执行与验收

- [x] 核查目录、工作区、并行会话和来源；隔离工作区、安装锁定依赖。
- [x] Task 1：木版印纸模块及真实几何行为测试（packages/scenes/src/chinese-woodblock-print/*）。
- [x] Task 2：珠星模块及真实几何行为测试（packages/scenes/src/czech-bead-star/*）。
- [x] Task 3：目录、每日分组、图标、引擎、环境、宿主取消与浏览器脚本整合。
- [x] Task 4：独立审查；完整测试、生产构建、移动端类型检查；320/390/1280 宽度真实触摸/鼠标及键盘、恢复、心愿/还愿、错误手势；每件真实截图和可点击报告。

Task 1/2 独立，只写各自目录；Task 3 独占共享注册文件。模块输出 create(ctx: SceneContext): SceneInstance 与 meta，遵循现有 contract。使用 TDD 保存 RED/GREEN，GPU 以外使用真实 Three 几何。所选执行方法为隔离模块并行实现，根任务整合后统一审查。

重点检查：暂停或销毁中断时零额外进度、回调同步重入不能跨步、touchcancel/blur 清理指针、错误方向与错误落点不完成、显式保存只发生一次且回访不重存。覆盖 0–3 恢复、正常与减少动态效果、所有主体顶点窄屏可见、提示命中真实不透明网格、对象接触合理、资源释放。

首次基线因 worktree 的 LFS 模型未展开在 content/glb.test.ts 两项失败；日志 artifacts/print-bead-pair/baseline-tests.log。随后从本地 LFS 缓存展开并复验，不将首次失败当作通过。

git lfs checkout 从本地缓存展开 828 项资源后，完整基线通过（2,188 项及木鱼资产校验），记录于 baseline-hydrated-tests.log。主目录的 67 项并行文件已独立哈希记录于 preserved-main-before.json。新场景 placement 测试先出现 3 项预期失败（新条目及分组），加入注册后 60 项通过；文化叙事测试等待两个模块文件落地再运行。环境测试 39 项通过。

本批完成后先交付结果与截图。前一会话的提交/合并/推送指令已经兑现，本批不据此假定新的共享分支推送授权。

## 中间验证记录

- 诊断版 390px：2 条键盘/恢复、2 条实际鼠标操作、1 条还愿流程，18 张截图，零浏览器错误和外部请求。另一次正常动画原生触摸：2 条物品流程、8 张截图，通过。此版本早于独立审查的指针回调修复，不作为最终交付版本。
- 266 项目录/叙事/真实宿主生命周期整合检查通过；Web TypeScript 编译通过。
- 初次整批 npm test 捕获两项中间问题：珠星测试临时使用未导出的 toon-surfaces 模块入口（已改为实际相对路径）；木版 284px 逐顶点测试在并行负载下超时，需优化全部顶点投影的断言开销，保持阈值与覆盖范围。最终完整复验另存日志。
- 独立审查实测 prepareFeedback 同步发送 pointermove 会取消木版当前真实手势，已交实现者修复并增加公共输入回归，必须复验后才交付。

## 最终验收（冻结源码）

- 完整 npm test：2,273 / 2,273 通过；Web TypeScript 与生产构建通过。Vite 保留已有大分块提示。
- 独立复查 80 / 80 通过，木版指针回调重入取消问题已修复，暂无未解决的重要发现。
- 320 / 390 / 1280px：6 条键盘/恢复、6 条真实鼠标网格交互、1 条还愿流程，50 张截图。320 / 390px 正常动画 Chromium 触摸：4 条流程，16 张截图。两组均零页面/控制台错误、零外部请求。
- 55 场景及桌面复查共 56 张截图；57 个 GPU 上下文全部释放，跟踪资源归零。
- EXPO_OFFLINE=1 npm run mobile:verify 通过：类型检查、依赖检查、框架与嵌入相关测试、Android/iOS 离线导出；两端各 59 份 DOM 脚本、12 份离线资产及 iOS 24 张组件封面哈希通过。未执行真机 WebView 测试或商店发布。
- 最终 22 个源码/测试/脚本/模块说明文件与生产构建时 SHA-256 一致。主工作区 67 个并行文件哈希均未改变。
- 已实际查看最终两场景 390px 四检查点、320px 主体/提示及 1280px 布局。具体过程、文化来源、早期失败与修复、限制、截图及全部日志见 [最终报告](../../../artifacts/print-bead-pair/report.md) 和 [可视画廊](../../../artifacts/print-bead-pair/index.html)。
- 保留独立工作区及本地分支，不合并或推送共享分支。
