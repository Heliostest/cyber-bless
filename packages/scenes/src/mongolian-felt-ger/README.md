# 毡屋向阳

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
