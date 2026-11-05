# Just a simple tree：离线树形样本

本目录包含通过 [Mike Fernandez 的 Just a simple tree](https://github.com/MikeFernandez-Pro/just-a-simple-tree) 实际代码生成的十六个静态 GLB：四种上游树形与花樱、椿树、槭树、枫树四种产品改编，各两个种子变体。上游树形使用各自的分枝算法；产品改编使用 oak/wood 的实际分枝，再加入明确记录的冠形参数与原创 Canvas 叶纹。所有样本沿用源码的叶簇表面撒卡、簇法线、射线 AO、簇间色差和 GLB 导出路径，没有用球体网格近似树冠。

来源固定为提交 [`8fd94b8edc7ef1b87c086694382a0808c059971c`](https://github.com/MikeFernandez-Pro/just-a-simple-tree/commit/8fd94b8edc7ef1b87c086694382a0808c059971c)（2026-11-01）。2026-11-05 从作者官方仓库读取并保存相关正文与代码；完整原件在 `source/`，原始 Git blob SHA-1 与本地 SHA-256 在 `source-manifest.json`，输出校验与几何统计在 `statistics.json`。

上游代码许可为 MIT，Copyright (c) 2026 Mike Fernandez。完整许可保存在 `LICENSE.txt` 和未经修改的 `source/LICENSE`。本目录没有上游的音乐、声音、外部用户图片或其他素材。上游程序叶纹来自 `foliage.js` 的 `round cluster` / `pointed cluster` / `willow leaves` 路径；花樱的五瓣缺口花纹由本产品编写，在 `product-extensions/cherry-blossoms.mjs` 中保存。椿树的羽状复叶、绿槭的七深裂掌状叶及秋枫的三／五宽裂叶保存在 `product-extensions/broadleaf-atlases.mjs`；这些扩展均不属于上游原件。

| 输出 | seed | 叶簇 | 叶卡 | 顶点 | 三角形 | 字节 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: |
| `round.glb` | 8263 | 13 | 336 | 4068 | 4288 | 232588 |
| `cluster.glb` | 29017 | 17 | 416 | 5103 | 5408 | 288708 |
| `cypress-round.glb` | 8263 | 89 | 2319 | 10761 | 6878 | 532112 |
| `cypress-cluster.glb` | 29017 | 95 | 2741 | 12557 | 7882 | 616804 |
| `pine-round.glb` | 8263 | 102 | 1321 | 7651 | 6274 | 389388 |
| `pine-cluster.glb` | 29017 | 117 | 1511 | 8717 | 7118 | 440476 |
| `willow-round.glb` | 8263 | 416 | 1603 | 8955 | 6422 | 443048 |
| `willow-cluster.glb` | 29017 | 377 | 1456 | 8559 | 6368 | 424436 |
| `cherry-round.glb` | 49271 | 21 | 544 | 6507 | 6816 | 355712 |
| `cherry-cluster.glb` | 67103 | 20 | 522 | 6372 | 6736 | 349104 |
| `toona-round.glb` | 18317 | 16 | 380 | 4779 | 5120 | 287456 |
| `toona-cluster.glb` | 59129 | 16 | 376 | 4743 | 5088 | 285680 |
| `acer-round.glb` | 27137 | 20 | 499 | 6102 | 6456 | 341128 |
| `acer-cluster.glb` | 48121 | 20 | 500 | 6111 | 6464 | 341568 |
| `maple-round.glb` | 36241 | 18 | 406 | 5013 | 5328 | 275620 |
| `maple-cluster.glb` | 74231 | 16 | 386 | 4833 | 5168 | 266704 |

文件后缀 `round` / `cluster` 仅沿用宿主的两个变体槽位，并不声称所有树形都具有圆冠。原有两个橡树文件的字节保持不变（SHA-256 仍分别为 `1d8ef922aeb08f1c7edd08084cbaf019aadae60df6b83c48cf8907c59cca43e0`、`9939dfc87478caf72e239e634e77afb53fd8476cec9892b6cd90bc7bb7417c76`）。

新增花樱时，原有八个 GLB 均保持逐字节一致；其 SHA-256 固定记录于 manifest 的 `preCherryAssetBaselines`，生成与 `--check` 均核对这些值。产品扩展代码单独记录在 `productExtensions`，包含作者归属、功能边界和 SHA-256，不伪装成固定提交的上游代码。

新增椿／槭／枫前，另外捕获当时全部十个 GLB（含已统一全粉色的花樱）为 `preToonaMapleAssetBaselines`，保留早先八份基线。生成器先核对磁盘现有资源，再核对重建字节，防止覆盖并发修改；原有十二张树形／花纹预览也以 `preToonaMaplePreviewBaselines` 核对。此次六份新增不会恢复旧版粉白花樱。

源码命名与本产品边界：

- `oak.js`：低位分枝的阔叶橡树形。
- `cypress.js`：原始注释明确写 Italian cypress，形态为窄长火焰／柱形冠。不能将此源码名称当作中国园林侧柏、圆柏或全部“柏树”的物种证明。
- `pine.js`：导出键为 `pine`，但原始注释明确写固定规则为 fir-like 的层叠锥形冠。因此界面宜称“层叠针叶树”，不能仅凭文件名解释为特定松属树种或日本庭园造型松。
- `willow.js`：原始名称为 weeping willow，通过向外拱起的主枝、弯垂的细长枝条和竖向叶簇形成垂柳形；没有据此确认某个拉丁学名。
- `cherry-*.glb`：基于引擎的产品花樱美术改编（source-derived flowering cherry）。上游没有原生 Prunus 物种生成器；这里的名称不证明具体樱属树种、园艺品种或文化身份。
- `toona-*.glb`：椿树按香椿（Toona sinensis）的羽状复叶取得造型灵感；并非上游原生香椿算法，也不是臭椿的植物学标本。
- `acer-*.glb`：以 Acer palmatum 的深裂掌状叶和较低、展开分层的树冠为灵感，采用七裂圆润指状轮廓与夏季绿叶。
- `maple-*.glb`：以 Acer rubrum 的三／五宽裂叶、上升枝和圆／卵形冠为灵感，采用较高紧凑冠及锈红秋色。槭树与枫树在这里是两个美术槽位，两者参考植物都属于 Acer；不能从槽位名称推出互斥的植物分类。

这些是调试预览的技术树形类型。它们本身不能证明某场景的历史植栽、地域代表性或文化寓意；地域建议须由宿主另行核查。默认场景配树不因本目录增加样本而改变。

所有树均只有 `wood`、`leaves` 两个网格，各自使用一个普通 `MeshStandardMaterial`。叶卡包含 512×512 的嵌入式 RGBA 叶纹、`alphaMode: MASK`（阈值 0.5）、双面、簇法线和顶点色。没有外部纹理 URI、动画、草地、落叶、增长属性或 LOD 扩展。GLB 保留源码尺度和树根位置，宿主负责落地、归一化与实例化。

叶材质的基色与顶点 AO 共同组成最终颜色，不能因存在 `vertexColors` 就将材质基色设白。2026-11-05 先修正了环境色调覆盖这一基色的问题，随后按用户要求将两份樱花资源统一为全粉色：粉色高光、中粉花瓣与深粉阴影，不再使用近白变体。改动保存在 `source-manifest.json` 的产品色板并重新生成 GLB、预览及统计哈希；冠形、花纹、源代码、其他八份树形与许可证不变。实际资源回归与截图见[环境色调修复记录](../../../../docs/research/2026-11-05-environment-tone.md)。

## 离线复现

从仓库根目录运行：

```powershell
node scripts/prepare-simple-trees.mjs
node scripts/prepare-simple-trees.mjs --check
```

转换使用项目已锁定的 Three 0.170 与 Playwright，以及一份本地 Chromium 浏览器。不下载 npm 包、浏览器或远程素材；Playwright 请求由内存及本地文件直接回应，没有 HTTP 监听端口或网络连接。可用 `SIMPLE_TREE_CHROMIUM` 指定浏览器路径。正常应用构建直接复制已经生成的 GLB，不需要运行生成器。

`--check` 会从固定原件重新生成、逐字节比较全部十六个 GLB 和统计记录，并验证打包许可与单列的产品扩展代码哈希。还会重新使用 Three r170 `GLTFLoader` 导入产物，检查有限值、索引、单位法线、每张卡共有的簇法线、顶点色、叶纹大小、透明裁剪、双面设置及源码材质 celRamp／shadeScale 元数据。每个输出的硬预算为 8000 三角形及 700000 字节。

需要独立查看静态树时：

```powershell
node scripts/prepare-simple-trees.mjs --check --preview
```

该可选参数为每个输出生成被 Git 忽略的 `<key>.preview.png`，包含原有 `round.preview.png` / `cluster.preview.png` 和新增的树形前缀文件。四类产品改编另输出 `<key>.atlas.preview.png`，可检查实际五瓣花簇、羽状复叶、七深裂叶和三／五宽裂叶遮罩。预览使用普通 PBR 材质、半球光和方向光，不代表宿主场景的最终光照，也没有应用源码 WebGL cel 包装器。普通双面 PBR 翻转背面法线时会产生明显的暗色簇边；宿主已有的柔和叶簇处理维持源码朝外簇法线，应另行检查宿主效果，不能据素材预览承诺最终场景外观。

## 版本适配与参数

原项目声明 Three `^0.186.1`，界面材质使用 WebGPU / TSL。本项目运行 Three 0.170 WebGL，因此转换脚本只运行源码的 CPU 路径：

- `oak.js`、`cypress.js`、`pine.js`、`willow.js`、`wood.js` 的几何算法保持原样，仅将 `three/webgpu` 导入改为 `three`；`wind.js` 提取原始 `liftBelow`、`packSwing`。
- `foliage.js` 保留源码常量、`update()`、`bake()`、`bakeCards()`、邻簇搜索、AO 与 Canvas 叶纹代码；TSL 材质和调试网格初始化替换为只保存 `.value` 的数据对象。静态转换不调用任何节点材质。
- `regenerate.js` 仅提取原始 CPU `leafStart` 计算。`glb.js` 沿用原始材质与 GLTFExporter 路径，将下载动作改为返回 ArrayBuffer；`textures.js` 原样编码带透明边缘补色的 PNG。
- 原件按提交哈希校验后，适配内容仅在内存中生成。源码边界变化会使转换失败；`source/` 中没有修改后的影子副本。
- 产品花樱的 Canvas painter 仅在内存中的 `LEAVES` 表注册为 `product cherry blossoms`，沿用原始 `paintAtlas(42)` 的四格纹理、遮罩导出、采样与透明边缘补色；所有上游 painter 和源码文件保持原样。
- 椿／槭／枫的产品 painter 同样仅注册于内存 `LEAVES` 表，键分别为 `product toona compound`、`product acer seven lobes`、`product maple broad lobes`。三类拥有不同的真实 alpha 轮廓；没有复用 oak 叶纹后只换颜色，也没有引入另一套分枝生成器。

参数选择使用源码已有控制，完整值在 manifest；浏览器导入实际物种模块，先读取它的 `settings`，再应用 manifest 记录的完整参数。四种上游树形分别使用其真实算法；花樱明确作为 oak 管线的产品扩展，包含花纹与冠形改编，不将单纯染色当作另一个原生物种。

- 橡树保留第一版参数：相对默认值，枝条侧面数从 10 降到 8、端帽环数从 3 降到 2、每簇平均卡数从 35 降到 26，并使用源码 `cardGrowth = sqrt(35 / 26)` 补偿覆盖。叶卡仍为 2×2 分段、`roundness = 0.58`。`round` 为三主枝、四子枝、圆叶簇；`cluster` 为四主枝、四子枝、较窄展开角、错层分枝、尖叶簇。
- 柱形 cypress 保留原物种 preset 的高冠、`trunkHeight = 1.22`、上升枝条、`droop = -0.16` 和 `roundness = 0`。为避免远景中浅色稀疏叶冠近似细杆，使用源码已有控制将 slenderness 调为 0.85 / 0.9、枝条数调为 24 / 26、clumpSize 调为 1.1；每簇恢复为默认 35 卡，cardGrowth 1，cardSize 从 preset 的 0.46 调为 0.66，使同一叶簇及相邻叶簇的卡片更充分重叠。保持原 preset 的 `willow leaves` 叶纹、渐尖轮廓与实际分枝算法。上述调整是本产品的远景可读性选择，不是另一种植物来源主张。
- 层叠针叶树使用原 preset 的 `clumpSize = 1.25`、`cardsPerClump = 13`、`cardSize = 0.8`、`roundness = 0` 和 `willow leaves` 叶纹。原源码为此树形选择的确实是这一叶纹，未替换成另一套针叶图片。轮生枝由默认 9 层×6 枝降为 7 / 8 层×5 枝，端帽 1 环；保留各枝上的扁平叶垫、上部核心簇和渐尖顶部。
- 垂柳使用原 preset 的五主枝、`size = 6.82`、`trunkThickness = 0.18`、`cardsPerClump = 4`、`cardSize = 2.05`、`roundness = 0.27`、`clumpSize = 0.9`。将默认 111 条垂枝降为 80 / 88 条，hang 为 0.8 / 0.75，使用源码已有的 `willow leaves` 纹理选项（物种 preset 本身未覆盖主程序的 `round cluster`，此选择为产品参数）。所有垂枝实体保留，木材侧面 6、端帽 1 环，以源码 `ringStep = 3` 降低管道采样；叶簇位置仍根据完整 12 段垂枝轨迹生成。
- 产品花樱的结构从实际 `oak.grow()` 生成：4 / 5 主枝、5 / 4 子枝、spread 1.02 / 1.08、splitHeight 0.24 / 0.21、splitScatter 0.42、trunkHeight 0，以低位分枝、展开的碗／瓶形枝架和较少高裸干作为美术方向。clumpSize 为 0.77 / 0.74，利用引擎已有的椭球叶簇 API 设置 flatten 0.78，保留枝位与簇法线，形成带间隙的软花冠；每簇平均 26 卡、2×2 分段、roundness 0.48。花纹由产品 Canvas 路径绘制：每朵五瓣，每瓣尖端有浅缺口；每格以确定性随机撒放 46 朵小花，构成四种不规则花簇。它不是重新染色后的上游圆叶纹，也不是外部樱树的转换。
- 椿树采用 4 主枝×4 子枝、spread 0.73 / 0.77、splitHeight 0.36、额外裸干 0.25、clumpSize 0.92，形成较直立、带枝架空隙的宽冠。每格 10 组羽状复叶，每组以六对椭圆小叶加一片顶叶组成；13 片为产品简化。每簇平均 24 卡，卡片大小 1.02、cardGrowth 1.08、flatten 1。
- 绿色槭树采用 4 主枝×5 子枝、spread 0.96 / 1、splitHeight 0.22、无额外裸干、clumpSize 1.08 与 flatten 0.58，形成更低、更宽和错层的树冠。每格 31 片七深裂叶，裂片肩部和顶端均以二次曲线连接，保留叶柄和深裂隙；不使用锋利多边星形。每簇平均 25 卡，卡片大小 0.99、cardGrowth 1.1。
- 秋色枫树采用 4 主枝×4 子枝、spread 0.55 / 0.59、splitHeight 0.36、额外裸干 0.6、clumpSize 0.97 与 flatten 1.08，形成上升枝和较高、紧凑的圆／卵形冠。每格 28 片宽裂叶，以三裂为主，每三片加入一片五裂；轮廓有轻微圆角，没有照搬叶脉或细锯齿。每簇平均 26 卡，卡片大小 1.02、cardGrowth 1.1。

椿／槭／枫六份均为 2×2 曲面卡、roundness 0.7，保持源码簇法线与 AO 计算；使用较低的 shadowSide 0.22、AO 0.3 / 0.32 及色差，避免额外压黑。不同枝型、叶纹和配色均属于明确记录的产品美术选择，不是物种鉴定结果。植物正文支持范围与来源规范核查见[椿／槭／枫来源记录](provenance-broadleaf.md)。

cypress 与层叠针叶树的源码 roundness 为 0，因此使用 1×1 叶卡与更细分卡具有同样的几何平面。垂柳也使用 1×1 叶卡作为静态 LOD，保留源码的 roundness 值；每张卡的曲面采样比编辑器默认 2×2 更粗。四种上游树形采用成熟夏季叶量，产品花樱采用盛花冠；不生成仅在嫩叶／落叶季节露出的额外细枝。无源外几何简化器、外部重建或全新树形算法。

橡树、层叠针叶树与垂柳配色直接采用源码 `themes.js` 的 spring：叶色 `#4ea276 / #a8ff75 / #d7f08c`，木色 `#837282 / #8a796a / #b4a088`。cypress 为提高浅色草地背景中的辨识度，通过同一源码颜色 uniforms 使用本产品的深绿调色：`#28573e / #5d9458 / #9ec886`；这组颜色不是作者 spring preset，已作为每个 cypress 模型的 `product evergreen contrast palette` 明确保存在 manifest。木色保持 spring。GLB 的 `celRamp`、`shadeScale` extras 保留源码意义；宿主若直接使用普通 PBR / Lambert，会得到普通灯光下的中间色乘顶点 AO，不会自动复现编辑器的 cel 效果。源码 README 的 Exporting / Cel shading 提供 WebGL 包装器。

花樱两份统一使用单列的产品全粉色调色：`#ad4875 / #e57ca8 / #ffb5d1`；木色为 `#674b48 / #8b6254 / #bc8a73`。椿树叶色为 `#486540 / #819e60 / #bfce98`，绿色槭树为 `#3e704b / #78ad72 / #c6d993`，秋色枫树为 `#753b2e / #ae5136 / #dba366`；三类新树的木色均为 `#675749 / #8e7560 / #b69b79`。只使用源码已有颜色 uniforms，不将美术配色表述为某个真实品种的颜色标准。

顶点色还烘焙了源码默认太阳方向的冠内明暗梯度（角度约 1.0784、高度角 0.49）；这是静态外观取舍。宿主额外风动是应用实现，GLB 不包含原编辑器的噪声风、分枝摆动或叶卡 flutter。透明叶片的实际填充开销仍需宿主镜头及真机验证，本目录统计不构成手机帧率保证。

## 来源与文化关联核查

宿主调试预览随后加入柔和叶簇处理：双面叶卡使用一致的朝外簇法线、降低静态顶点 AO／色差反差，并对普通连续光照使用包裹式漫反射。墨线档保留分段光照。调整仅作用于运行时材质和可恢复的投影参数，不改变本目录 GLB、法线、透明遮罩或配色数据；独立素材预览仍显示普通 PBR，宿主效果与验证见[柔和树影与叶簇](../../../../docs/research/2026-11-05-soft-tree-preview.md)。

已阅读项目 `AGENTS.md`、[场景来源规范](../../../../docs/scene-provenance.md) 与 [2026-11-05 树木研究](../../../../docs/research/2026-11-05-tiny-glade-style-trees.md)。本次扩展仅供用户明确选择的调试预览，增加现代程序环境树形，没有改变默认场景器物、动作、文案、寓意、完成条件或传统来源；不新增地域、民俗、宗教、历史或 Tiny Glade 素材身份主张。

花樱改编只观察了既有 Jogoss 预览图的总体特征（展开花冠和可见枝架），没有读取／复用其几何、UV、贴图、代码，也未将该外部资产作为生成输入。此处产物仅依赖保留的 MIT 引擎代码与本产品 Canvas 扩展。地区景观建议的独立证据不由花纹、粉色或引擎名称替代。

已读的直接材料是上述固定提交的 README（Features、Every control、Exporting、License）、LICENSE、package.json，以及 manifest 列出的生成、配色和导出相关源码。它们支持技术实现、来源作者、代码许可与产品参数，不支持任何传统文化关联。文化来源卡、宿主传统 slug 与宗教／民俗 metadata 变更不适用；已有场景来源身份由宿主维持。本目录将美术变体和参数调整明确记为应用的环境呈现选择。
