# 共享 Three.js 水粉插画渲染

核查日期：2026-10-22。用户选择“柔和色彩、轻笔触、克制轮廓”的水粉插画方向。

同日后续决定：用户要求保留水粉实现，但取消默认接入。当前木鱼、程序化场景与环境注册的默认值均恢复 `toon-soft`；`gouache` 保留在 Shader Lab 供手动选择。下方首次验收记录中的水粉默认检查属于当时版本，不代表当前默认值。器物、动作、文案、来源与文化主张仍未改变。

取消默认后的定向验证：debug-styles、cozy-environment、toon-surfaces 共 93 项通过；真实 WebGL 用例及木马场景的柔和卡通默认、手动水粉切换、交互推进与手机尺寸缩放通过。没有重复执行耗时的全场景几何回归，因为本次仅恢复既有默认值。

## 已读参考与选择

| 来源 | 实际读取状态 | 本次使用范围与边界 |
| --- | --- | --- |
| Maxime Heckel, [On Crafting Painterly Shaders](https://blog.maximeheckel.com/posts/on-crafting-painterly-shaders/), 2024-10-29 | 2026-10-22 已读相关正文：Kuwahara 四象限均值／方差、核大小与细节损失、Papari 改进和性能讨论 | 保边平滑的技术参考。本项目自行实现九点采样、连续方差权重的小核近似；没有移植文章的完整各向异性、多通道算法，不承诺同等笔触效果或性能。 |
| Maxime Heckel, [Moebius-style post-processing and other stylized shaders](https://blog.maximeheckel.com/posts/moebius-style-post-processing/), 2024-03-26 | 2026-10-22 已读引言及整体后处理章节 | 比较用备选：漫画描线、排线与色块。用户选择水粉，本次不引入排线。 |
| Maya Nedeljković Batić, Codrops, [Sketchy Pencil Effect with Three.js Post-Processing](https://tympanus.net/codrops/2022/11/29/sketchy-pencil-effect-with-three-js-post-processing/), 2022-11-29 | 2026-10-22 已读后处理、法线缓存与自定义 pass 的相关正文 | 比较用备选：铅笔轮廓。本次继续复用现有 pmndrs 轮廓效果，不移植该 shader。 |
| Three.js, [Toon Material with OutlineEffect](https://threejs.org/examples/webgl_materials_toon.html) | 2026-10-22 示例入口可访问；技术实现另核对本地 Three.js 0.170 与 postprocessing 类型、源码 | 卡通材质和几何轮廓的比较参考。示例页本身不是绘画风格实现依据，不因网页最新版本改变当前依赖。 |

上述均为图形技术资料，不能为任何器物、仪式或文化主张提供证据。未引入第三方贴图、模型或 shader 代码。

## 当前实现

- `packages/scene-runtime/src/gouache-effect.ts`：色调映射后的小核方差加权平滑；明暗边界降低平滑力度；轻微冷影暖光、黄绿色收敛和静态纸面颗粒。输出保留原 alpha；采样按 alpha 加权，透明邻域不渗黑。
- `render-style.ts`：同一 composer 中分开执行色调映射与笔触；轮廓为轻微蓝灰。保留旧模式和失败后恢复原始渲染的路径。
- `toon-surfaces.ts`：普通不透明器物使用连续明暗的哑光标准材质；已有玻璃、金属、釉面与清漆保留 PBR 特征。贴图、顶点色、动态着色和 glow 继续同步；只在绘制期间替换材质，原材质随后恢复。
- `cozy-environment.ts`：仅水粉模式的白天降低日光、增加天空补光、采用柔化阴影；夜间灯光与动态点光不受改写。切回旧模式恢复旧日光设置。
- 程序化场景共享默认值与木鱼宿主默认值保留 `toon-soft`；Shader Lab 提供可选 `gouache`。旧内容包缺省、技术 ID、引擎版本与存档结构保持兼容。
- 笔触只处理 3D 画布，页面标题、提示与按钮保持清晰。不新增网络资源或依赖。

## 文化影响核查

适用范围：采用共享程序化默认值的内置 Three.js 场景与木鱼；是显示层产品美术表达，不是新增传统样式。

本次核对实际试验场景：木马与彩鞍、未烧制的湿陶碗、蓝白釉陶花砖与展托、青绿玻珠与金属杆、蜡烛与石廊烛架。水粉模式没有替换器物、纹样或材料身份，未把湿陶变成釉陶，未改变操作、步骤、完成条件、场合、介绍、标题或来源。所有场景的颜色统一经过显示调色，未将此调色称为传统配色或增加颜色寓意。

文化来源沿用 [2026-10-19 全场景审阅](2026-10-19-scene-culture-audit.md) 与各场景 README 中 2026-10-20 的逐项介绍核查。本轮仅就显示差异复核，没有声称重新访问所有文化来源。

- 木马：`dalarna-wooden-horse`，既有木雕与彩绘工艺关联保持。
- 陶碗：`uzbek-clay-bowl`，来源 `uzbek-ceramic-craft`；仍止于未烧制湿陶成形。
- 花砖：`andalusian-ceramic-tile`，既有陶瓷工艺关联保持；无新增绘釉、烧制或图案寓意。
- 玻珠：`venetian-glass-bead`，来源 `italian-glass-beads`；简化工艺范围保持。
- 烛光：`votive-candle-catholic`，既有天主教献烛背景保持，没有改写为仅装饰或心理表达。
- 木鱼：既有 `chinese-buddhism` 专段关联保持；轻敲次数仍是产品规则。

核查清单：

- [x] 只改变显示层光色与滤镜，器物／材料身份、动作、场合、完成条件保持。
- [x] 无新增文化主张；技术参考与文化证据分别记录。
- [x] 没有改变来源绑定、寓意、起源、节期或真实信仰语境。
- [x] README 与共享渲染文档记录产品美术表达；来源卡、宿主目录、注册表、模块 metadata 和原生标题无需修改，因为对应字段及文化事实均未变化。
- [x] 技术验证与文化影响审阅分别列出；技术测试不作为文化事实证据。

## 验证方法

`node scripts/test-gouache-style.mjs` 在 Vite 开发服务器上执行真实 WebGL 验证。可附场景 ID 只检查指定场景。输出在被忽略的 `artifacts/gouache-review/`。

- 独立真实 WebGL 接口用例：透明角点、实体 alpha、动态源颜色、静态帧一致、DPR 1.5 下缩放、反复风格切换后纹理数量不增长、注入后处理异常后原材质和 renderer 状态恢复。
- 实际场景：桌面 1280×900 与手机视口 390×844，检查水粉默认、旧风格切换、操作推进、控制台错误并留对比截图。浏览器模拟手机尺寸不等于真机帧率验证。
- 单元检查覆盖样式白名单与旧包缺省、覆盖值恢复、材质纹样／动态颜色／清漆保留、日间光照切换与夜间点光保护。

首轮 `npm test` 的场景包出现 19 个 5000ms 超时及四个 worker 通信超时，其余 6868 个场景断言通过；无功能断言失败。其余已执行包为 core、runtime、app、gestures、shared，均通过。随后限制场景测试并发到两个 worker 复核，避免将机器争用误记为功能失败；最终结果以测试日志和下方验收记录为准。

独立只读代码审阅：未发现 Critical、Important 或可操作的 Minor 问题。核对了后处理色彩空间／顺序、alpha、玻璃与金属子类保留、恢复与回退、旧包和本机调试覆盖兼容。未将此审阅扩大为所有场景逐一美术验收、所有既有文化来源重查或手机真机 GPU 性能结论。

### 最终验收结果

- `npm run build`：通过；保留既有的 500 kB 分包体积提示。
- `npm run typecheck -w @wbr/mobile`：通过。
- content 37 项、scene-runtime 125 项测试全部通过；root 首轮已通过的 core 52、runtime 11、app 912、gestures 54、shared 3 项未再重复执行。
- `npm run test -w @wbr/scenes -- --maxWorkers=2`：194 个文件中 193 个通过，6886 项通过；仅 `src/russian-matryoshka/model.test.ts:46` 的嵌套半径检查仍触发默认 5000ms 超时，无功能断言失败。
- 隔离该文件再次运行默认超时：5 项通过、该项约 5872ms 后超时。保留测试与实现，运行 `npm run test -w @wbr/scenes -- src/russian-matryoshka/model.test.ts --maxWorkers=1 --testTimeout=15000` 后 6 项全部通过，其中嵌套半径检查 5786ms。默认超时的全量命令仍应报告为存在这一超时，不能写成全量命令全绿。
- `node scripts/check-woodfish-assets.mjs` 与 `git diff --check`：通过。
- `node scripts/test-gouache-style.mjs`（最初四个样本）及 `node scripts/test-gouache-style.mjs uzbek-clay-bowl`：WebGL 用例、五个实际场景切换／交互及两个视口全部通过，无页面或控制台错误。合并报告：`artifacts/gouache-review/combined-report.json`。
- 手动查看上述五个场景截图，核对木马彩鞍、湿陶沟槽、花砖细纹、玻璃透光和夜间火焰。交互前后对比页：`artifacts/gouache-review/index.html`，十张图片完整加载、滑块可用。没有手机真机帧率或温升数据。
