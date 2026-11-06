# 毡屋向阳


## 2026-11-06 Komorebi 默认画风

共享环境默认启用已校准的 Komorebi 草地、光照与调色；按用户后续要求，背景树恢复原先逐场配置（原树及原有场景推荐），Komorebi 树仅作为调试台可选树种、选择后加载。分享、恢复与退出调试使用同一默认组合；夜景、没有植被的环境与器物主题树按原场景保留。这是产品背景美术统一，不新增植物地域、传统寓意或仪式规则；主题器物、动作、文案、来源身份、引擎和存档保持。[范围、来源核查与验证](../../../../docs/research/2026-11-06-komorebi-defaults.md)。

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

当代蒙古包工艺欣赏，三步：把红色木格端头拖到展开位置，将红色顶圈抬到屋顶轮廓，把白毡卷拖到屋顶或围壁覆盖区。每步在目标区域松手确认，也可用辅助按钮的 Enter/Space 完成。

保存 0–3 整数进度。恢复静默，不建立心愿；完成仅派发一次事件。普通与减少动态效果使用同一最终形态。物体前表面命中后才获取手势，按相机平面跟随鼠标或手指；木格展开和框架跟随作为预览，释放时按固定空间目标判断，不依赖固定屏幕方向、最小滑动距离或路径形状。浅金色目标在可放置时变绿，并显示松手提示。抓取偏离中心时也检查实际抓手对齐情况；落在画面外、未命中目标、非有限坐标、多点、取消或失焦均复位，不推进。

原创木格、顶圈、椽杆、支柱、毡卷、带开口的厚度覆层与门板；共享阳光草地和柔和三渲二。模型省略实际结构连接、施工顺序与杆件数量，不是建筑教学。资料见 content/traditions/mongolian-ger-craft.md。

运行证据保存在 artifacts/mongolian-felt-ger；长期进度在 artifacts/hourly-scenes/progress.md。

## 2026-10-19 拖放改动与来源核查

已重新读取蒙古国文化遗产国家中心／ichLinks Mongolia 的 [Traditional craftsmanship of Mongol ger](https://mongolia.ichlinks.com/archive/elements/elementsV.do?contentsI18NCd=en-US&elementsUid=13829896140267001030) 英文正文 Description（木格、顶圈、椽杆、门、双支柱，木作、缝制、制毡与家庭协作）及 UNESCO 名录年份栏；正文可读，名录栏为 2013。仅核对上述有限事实，未以该页的通用蒙古文化附件证明具体搭建步骤。

本次浅金目标、绿色确认、三步顺序、缩略模型跟随与松手吸附均为手机交互设计；没有新增传统规则、宗教寓意或建筑施工主张。来源保持 `mongolian-ger-craft`，注册表和模块 metadata 不变，App 隐藏策略不变。来源卡的产品呈现同步记录本次操作。

### 验证

- 本场景 71 项测试覆盖曲线路径、不到 40px 的有效落点、偏心抓取、固定目标、松手确认、错放／越界／非有限坐标、多点、取消／失焦／暂停、进度恢复和资源释放。
- 全量场景测试以 `npm run test -w @wbr/scenes -- --maxWorkers=2 --reporter=dot` 复跑，87 个文件、3327 项通过；核心 51、运行时 11、App 632、手势 54、共享 3、内容 37、场景运行时 118 项也通过，木鱼资产检查通过。
- 首轮 `npm test` 在默认并发下的 14 个超时涉及 `directional-drag-scenes.test.ts`、`amazigh-woven-rug/scene.test.ts`、`japanese-koinobori/scene.test.ts`、`korean-bojagi-wrap/scene.test.ts`、`peruvian-engraved-gourd/scene.test.ts`、`russian-matryoshka/model.test.ts`、`russian-matryoshka/scene.test.ts`、`turkish-ebru-paper/scene.test.ts`，并伴随两条 worker RPC 超时；完整名称与输出见 `artifacts/mongolian-felt-ger-drop-tests.log`。复跑仅限制并发，使用默认超时，结果见 `artifacts/mongolian-felt-ger-drop-scenes.log`。
- `scripts/verify-ger-drop.mjs` 以原生鼠标／CDP 触屏操作检查 390px 鼠标、320px 触屏和 1280px 鼠标。三种尺寸均走完三步，每步误放不推进、到位按住不结算、松手后推进，确认可见指引与目标高亮一致；页面无异常或横向溢出。报告与截图见 `artifacts/mongolian-felt-ger/drop/`。
- 生产构建与独立代码审阅通过；审阅未发现 P1／P2。技术验证与上文文化来源核查分别完成。

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `mongolian-ger-craft`。核查范围：蒙古国前杭爱/乌兰巴托记录、结构、家庭协作和匠人/师徒传承。

边界：没有可据的首次建造年代；不把 2013 申报年当起源，不加朝向祭祀含义。当前不是完整可住结构/搭建指南。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#mongolian-felt-ger)与[来源卡](../../../../content/traditions/mongolian-ger-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-26 空间跟手与到位完成

格架端、顶圈、毡卷分别跟手到真实目标，框架与毡面依进度连动；锚点入域自动落稳。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
