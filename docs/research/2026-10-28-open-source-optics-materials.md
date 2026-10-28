# 仪式光效可借鉴的开源库与材质

研究日期：2026-10-28。状态：已查一手文档、版本源码和许可；未安装依赖、下载材质包、修改场景或验证实机性能。对应[上轮逐场审查](2026-10-28-material-lighting-audit.md)的 **5 个优先场景 + 40 个可选场景**。

## 建议采用的路线

第一批以现有 Three.js 材质、官方轻量散射代码和少量 CC0 纹理为主。纸布借 Khronos 漫透射公式，蜡玉借 Three 浅散射公式，玻璃/液体先试原生 Physical，粥面先拆湿面材质；更细腻的玻璃可与 @pmndrs/vanilla 对照。新装一整套材质库不是这些场景共同的前提。

本地核查版本是 **three 0.170.0、postprocessing 6.39.5**；场景使用原生 WebGLRenderer，未安装 R3F、drei、CSM。现有 toon-soft、HDR 环境、水效和 halo 都继续参与比较。下文性能判断来自源码路径与额外渲染工作量，是工程推断，不是手机 FPS、耗电或 GPU 时间实测。许可证事实与适用建议分开记录，具体源码与贴图各按自身许可使用。

## 五个优先场景先参考什么

| 场景 | 首选参考 | 试验目标与边界 |
| --- | --- | --- |
| 风铃一响 / furin-wind-chime | Three MeshPhysicalMaterial；@pmndrs/vanilla MeshTransmissionMaterial 作对照 | 保留玻璃反光、薄壁透射与铃舌可见性；先减少均匀蓝色自亮。原生 r170 透射缓冲的限制要纳入试验。 |
| 七草祈安 / nanakusa-gayu | Three MeshStandardMaterial；可选 Physical clearcoat | 将粥面/倒流与米粒拆材质，让湿面受光，保持乳浊。无需先引入玻璃或屏幕空间 SSS 系统。 |
| 蓝白晾晴 / bai-indigo-cloth（当前隐藏） | 现有 stylized-water 的法线/受光思路；Three 基础液面材质 | 漂洗水有深浅与反光；水底结构须适合容器，不能照搬沙池。透明度变更须检查放置命中。 |
| 茶山一盏 / blang-tea（当前隐藏） | Three Physical 的色吸收/厚度；轻量透明 Standard 作对照 | 茶色保留，细流与杯面分开调；按收益决定是否值得付出透射预渲染成本。 |
| 纸伞舒晴 / japanese-wagasa（当前隐藏） | Khronos Sample Renderer 漫透射公式；Three SSS 作艺术近似备选，CSM/vanilla 或局部 shader patch 为实现工具 | 背光透暖、骨架和折层遮光；优先移植公式到现有风格，非直接替换成整个 Phong 材质。 |

原生材质的 clearcoat、sheen、透射、厚度参数及成本说明来自[Three r170 官方材质文档](https://raw.githubusercontent.com/mrdoob/three.js/r170/docs/api/en/materials/MeshPhysicalMaterial.html)；散射参考来自[同版本官方 shader](https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/shaders/SubsurfaceScatteringShader.js)。薄纸漫透射另参考 [Khronos 官方光照实现](https://github.com/KhronosGroup/glTF-Sample-Renderer/blob/6e8a3d1aaa6f07e9f1310a488453e21325677786/source/Renderer/shaders/pbr.frag)。表中的选型与试验顺序是结合本项目的判断。

## 对应全部 45 个候选场景

以下把同类方案复用到具体部件；可选仍为可选，不因找到开源资源而升级成必改。

### 薄纸、灯罩（12 场）

优先借 Khronos Sample Renderer 的背面漫透射公式，Three SSS 作方向性暖边的备选；保留漫射遮蔽，以程序/手绘遮罩控制纸层、骨架、颜料。Paper001 可提供纤维微细节；灯罩叠加现有内亮与局部点光。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 太阳花迎门 / `basque-sunflower` | P2 可选 / App 可见 | sunflower-pointed-petal纸瓣 |
| 影偶小戏 / `chinese-shadow-puppet` | P2 可选 / 当前隐藏 | shadow-cloth布幕和灯孔的光场 |
| 木版留春 / `chinese-woodblock-print` | P2 可选 / 当前隐藏 | woodblock-paper揭起的纸面与纸角 |
| 折一只纸鹤 / `crane` | P2 可选 / App 可见 | origami-sheet纸鹤单层纸边 |
| 纸伞舒晴 / `japanese-wagasa` | P1 优先 / 当前隐藏 | 展开/旋转的整面和纸伞罩 |
| 月下一灯 / `lantern` | P2 可选 / 当前隐藏 | 桶形纸罩的内亮层次 |
| 纸翼转风 / `paper-pinwheel` | P2 可选 / 当前隐藏 | 四片彩纸风车翼 |
| 节分撒豆 / `setsubun-mamemaki` | P2 可选 / App 可见 | 木格纸门的纸面板 |
| 玉串奉愿 / `tamagushi-offering` | P2 可选 / App 可见 | 薄叶片与白色纸垂 |
| 短册系竹 / `tanzaku-tanabata` | P2 可选 / App 可见 | 悬挂短册纸条 |
| 纸鸢乘风 / `weifang-paper-kite` | P2 可选 / 当前隐藏 | 纸翼和浅色羽纹 |
| 燃灯上浮 / `yeondeunghoe` | P2 可选 / App 可见 | 莲灯纸瓣 |

### 薄布、帆布、鼓皮（9 场）

借 Khronos 的薄面漫透射或 Three 的轻量方向散射，保留现有纹样与折叠遮光。Rough Linen 可作粗布细节，Crepe Satin 仅给丝绢类作参考；鼓皮保持皮面身份。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 舟模寄谢 / `aland-votive-ship` | P2 可选 / App 可见 | ship-cream-cloth-sail |
| 节旗轻展 / `breton-banner` | P2 可选 / 当前隐藏 | banner-cloth布旗 |
| 花绣寄语 / `hungarian-embroidery-hoop` | P2 可选 / 当前隐藏 | 绣圈亚麻底布 |
| 鼓面轻拍 / `irish-bodhran` | P2 可选 / 当前隐藏 | 浅色薄鼓皮 |
| 鲤旗迎风 / `japanese-koinobori` | P2 可选 / App 可见 | 布鲤鱼身和双片尾布 |
| 方巾裹礼 / `korean-bojagi-wrap` | P2 可选 / App 可见 | 方巾及四角系带 |
| 白绢迎客 / `tibetan-khata-greeting` | P2 可选 / App 可见 | 白绢单层边缘和穗 |
| 经幡迎风 / `tibetan-prayer-flags` | P2 可选 / App 可见 | 五色旗布 |
| 折扇轻风 / `valencian-folding-fan` | P2 可选 / 当前隐藏 | 折扇布面 |

### 玉、果肉、皮肤、蜡（4 场）

借官方 SSS 的局部散射近似，单独制作薄边/厚度遮罩；蜡只作用于灯芯附近。此类不使用通体玻璃透射，Candle001 只补蜡表面细节。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 如意寄愿 / `chinese-ruyi-scepter` | P2 可选 / App 可见 | ruyi-jade-body玉如意 |
| 破榴迎新 / `greek-new-year-pomegranate` | P2 可选 / App 可见 | 破开后散落的石榴籽 |
| 白线祝归 / `lao-baci-wrist` | P2 可选 / App 可见 | 近景手掌/指尖的皮肤 |
| 留一盏烛光 / `votive-candle-catholic` | P2 可选 / App 可见 | 灯芯附近的蜡体顶部 |

### 玻璃（3 场）

先试现有 Three MeshPhysicalMaterial；@pmndrs/vanilla MeshTransmissionMaterial 作为可控离屏缓冲的对照。蓝珠保留实色眼纹；玻珠先校准已有透射。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 风铃一响 / `furin-wind-chime` | P1 优先 / App 可见 | 玻璃铃身 |
| 蓝珠祈安 / `turkish-nazar-bead` | P2 可选 / App 可见 | 深蓝玻璃外缘 |
| 玻珠凝彩 / `venetian-glass-bead` | P2 可选 / 当前隐藏 | 主珠与同伴玻珠 |

### 清液、带色液体（8 场）

小液面先试 Standard 透明受光/现有水法线，需要体积色时再试 Physical 透射和吸收。茶/蜜保持色浓，浮彩只处理揭纸后浴液；不为小液面引入整套反射水系统。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 蓝白晾晴 / `bai-indigo-cloth` | P1 优先 / 当前隐藏 | indigo-rinse-water |
| 茶山一盏 / `blang-tea` | P1 优先 / 当前隐藏 | tea-liquid与tea-stream |
| 炉前一炷 / `chinese-incense` | P2 可选 / App 可见 | incense-tea-surface辅助茶面 |
| 旅途一页 / `czech-pilgrim-journal` | P2 可选 / 当前隐藏 | 旅行杯内辅助茶面 |
| 开樽祝愿 / `kagami-biraki-sake` | P2 可选 / App 可见 | 樽内酒液 |
| 蘸蜜迎岁 / `rosh-hashanah-apple-honey` | P2 可选 / App 可见 | 蜂蜜体积与苹果上的蜜膜 |
| 清水七供 / `tibetan-water-bowls` | P2 可选 / App 可见 | 七碗水、壶内水及细流 |
| 浮彩成笺 / `turkish-ebru-paper` | P2 可选 / 当前隐藏 | 揭纸后露出的浅色浴液 |

### 湿润表面、近景水流（6 场）

优先原生 Standard 的独立粗糙度/法线与实际受光；需要透明表层时再试 Physical clearcoat。粥糊保持乳浊。Water001 法线仅按尺度选用，不给每杯液体添加反射相机。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 灯旋一瞥 / `diya-oil-lamp` | P2 可选 / App 可见 | 灯盏油面 |
| 七草祈安 / `nanakusa-gayu` | P1 优先 / App 可见 | 锅粥、勺中粥、倒流与碗中粥的湿表面 |
| 春锅共煮 / `navruz-sumalak` | P2 可选 / App 可见 | 锅内、勺中与碗中苏玛拉克甜糊表面 |
| 浇水敬老 / `thai-songkran-elders` | P2 可选 / App 可见 | 碗水、倾流水及手上薄水膜 |
| 花水位一倾 / `theravada-water` | P2 可选 / 当前隐藏 | 倾注水流 |
| 泉水净币 / `zeniarai-coin-washing` | P2 可选 / App 可见 | 近景勺水、水流与水珠 |

### 已有水光或灯火联系（3 场）

优先复用项目现有 stylized-water、受光水材质和 createLampHalo；Three Water/Water2 的反射与 Fresnel 仅作参考。Bloom 留作同画面比较后的条件选项。

| 场景 | 优先级 / 入口 | 对应部件 |
| --- | --- | --- |
| 井边放下 / `clootie-well-rag` | P2 可选 / App 可见 | clootie-well-water井水 |
| 浴佛发愿 / `fgs-buddha-bathing` | P2 可选 / App 可见 | 盆水、杓水、倾倒水流与水滴 |
| 叶舟寄意 / `floating-lantern-loy-krathong` | P2 可选 / App 可见 | 烛焰与水面相邻的暖光联系 |

## 接入前必须明确的项目约束

- 自定义 shader 不会因为装库就自动通过 toon-soft：当前普通不透明 Standard 通常重建；不透明 Physical 和需保留表面的部分 Standard 在 toon-soft 中 clone；透明材质直接保留。原生 clone 不复制 onBeforeCompile。CSM 是否能绕过现有 instanceof 分支属于源码推断，尚未完成编译/渲染验证。后续也要核查轮廓线是否被绕过，见 [toon-surfaces.ts](../../packages/scene-runtime/src/toon-surfaces.ts)。
- 动态材质参数也要同步：当前适配材质每帧只同步颜色、emissive、opacity、visible，动态 roughness/transmission/uniforms 另行处理。
- 透光、厚度和表面凹凸是不同数据：高度/位移图不是自动生成的厚度图。纸层、绣线、骨架、蜡顶和玉厚薄需要程序、手绘或烘焙的专用控制图；不要把整物体 alpha 降低来代替。
- 透明拾取约束沿用上轮：createTouchTarget 的透明物门槛为 opacity≥.5，某些局部 nearest 为≥1。材质试验要保持操作可用，见 [touch-target.ts](../../packages/scenes/src/touch-target.ts)。
- 纹理先使用少量、低对比、512–1K 的裁切/平铺版本做对比，这是起步建议；是否足够清晰、是否省时应以实际取景和手机测试确定。纸布上现有字、纹样、配色不因换通用贴图而被覆盖。
- 灯火优先复用 [createLampHalo](../../packages/scenes/src/procedural-kit.ts) 与实际点光；Bloom 需放在适当的 HDR/色调映射顺序并只作用于意图发光的区域。效果开销不能仅用“多一个库”衡量。

## 一手研究记录

下列记录区分源码事实、许可证事实、工程推断与尚未完成的运行验证。

### 玻璃、液体与离屏透射

# 玻璃与液体透射候选（研究片段）

核查日期：2026-10-28。仅研究；未安装包、修改生产代码／锁文件。已读 `AGENTS.md`、`docs/scene-provenance.md` 和上轮材质审查；不改变材料身份、器形、动作、文案或文化归属。以下成本为源码判断，未做 iPhone／Expo WebView 验证，不给 FPS 承诺。

## 五项候选

| 固定候选 | 可借鉴部分、成本及本项目建议 |
| --- | --- |
| **Three Physical r170／0.170.0** | **首选，无新依赖**。复用 HDR IBL，用 transmission＋thickness＋attenuationColor/Distance；官方要求透射时 opacity=1。厚度0是薄壁，非零也不是自动测量几何厚度。r170 每相机共享视口尺寸的透射 RT、4 MSAA samples、mipmap，**没有 transmissionResolutionScale**。先绘 opaque，另有条件补 DoubleSide 背面，不能完整透看其它 alpha／透射物；属于屏幕纹理近似。 |
| **vanilla MeshTransmissionMaterial v1.19.4** | **实验备选**。`@pmndrs/vanilla` 确有原生 class，仅 import three；可摘取 MIT helper，无需 R3F。peer three>=0.137，dev ^0.166.1；范围接受 r170，**不是运行保证**。class 不管理 FBO：官方例程宿主手动多渲染1次场景，backside时2次，之后才主渲染。默认 samples=6、每轮分别计算RGB；用 transmission=0、_transmission控制效果，避免 Three 再添 pass。先低采样／低分辨率、关backside／色散／噪声，仅在内部或多玻珠互见确实有问题时试。 |
| **Three Water.js r170** | 同版本 addon；平面镜反射、水法线、Fresnel。默认512² RT，面向相机时每水面增加1次反射场景渲染。没有体积透射／吸收；alpha只写输出，构造器不自动开启透明混合。**参考源码、优先保留现有水实现**；不替代茶流、蜜体或玻璃，不逐小碗加反射相机。 |
| **Three Water2.js r170** | Reflector＋Refractor、双法线／flow map。默认两张512² RT，通常每水面增加2次场景渲染；内部默认各4 MSAA samples，Water2未暴露该参数。平面裁切＋扭曲UV，不计算体积吸收，仍受透明排序限制。**仅参考**：较大浅盆可研究，小茶杯、七碗、蜜膜默认不用。 |
| **drei MeshRefractionMaterial v9.117.3＋BVH v0.7.8** | 几何BVH内逐像素弹射后采envMap，偏封闭刻面宝石。实际shader默认bounces=3（包装注释2）、IOR=2.4；非fastChroma色散多做RGB查询。静态HDR不添场景pass；动态CubeCamera每更新渲染6面。变形几何需refit／重建及重新上传。BVH peer three>=0.151.0；drei peer three>=0.137、Fiber>=8、React>=18。shader可提取，但需移植helper、BVH／相机／纹理defines管理；**当前场景不引入**。 |

drei v9.117.3 的透射 core 把未独立导出的实现 class 与 React useFrame/useFBO 放在一起；包装实际 samples=10，注释6。其 transmissionSampler=true 共享 Three 缓冲，也继承 opaque-only 限制；自建buffer能含其它透明物，但不是排序无关的多层真实折射。应优先参考上述原生 vanilla 固定源码。

## 场景与接入边界

- **furin**：先薄壁Physical，检查铃舌／涂饰；**venetian**：先校准既有透射与opacity .84叠加；**nazar**：仅深蓝薄缘试弱透射，白圈／瞳实色。
- **茶／漂洗水**：先弱吸收、湿反射；茶面当前薄圆柱不能靠参数自动变成深杯液体。**蜂蜜**：蜜体琥珀吸收，苹果蜜膜重湿高光；**清酒／七供水**：保留现有水位／体积和金属碗可读性，先共享内置缓冲，不逐对象重渲染整场景。
- 当前 toon-soft 对不透明原生 Physical 保留 PBR 参数但会克隆，并非只有 transparent 才能保留玻璃。自定义 MTM 子类的 onBeforeCompile、uniform、构造器、clone 与缓存键须另核对。手工FBO须恢复原render target／viewport／toneMapping／背景，线性捕获后交现有后处理；不可照抄例程setRenderTarget(null)。
- 推荐前三：**r170 Physical → 现有水管线／Water源码局部借鉴 → vanilla MTM实验**。Water2与BVH折射仅参考。这些清澈介质的镜面透射不适用于和纸、布、灯罩的漫透光。

## 一手来源与读取记录

下表均于 **2026-10-28 已读相关正文／源码段，许可为完整正文**，不是仅摘要。未安装、编译或实机运行候选；peer范围不等于兼容验收。

| 来源 | 已读范围／支持内容 |
| --- | --- |
| [Three r170 Physical文档](https://github.com/mrdoob/three.js/blob/r170/docs/api/en/materials/MeshPhysicalMaterial.html)、[透射shader](https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderChunk/transmission_pars_fragment.glsl.js) | opacity、厚度、吸收、屏幕取样、逐像素成本。 |
| [r170 Renderer](https://github.com/mrdoob/three.js/blob/r170/src/renderers/WebGLRenderer.js)、[Transparency](https://github.com/mrdoob/three.js/blob/r170/manual/en/transparency.html) | 完整renderTransmissionPass／renderObject；缓冲／双面／对象排序。 |
| [Water](https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/Water.js)、[Water2](https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/Water2.js)、[Reflector](https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/Reflector.js)、[Refractor](https://github.com/mrdoob/three.js/blob/r170/examples/jsm/objects/Refractor.js) | RT、onBeforeRender、片元shader；pass数不含其它场景辅助pass。 |
| [vanilla材质](https://github.com/pmndrs/drei-vanilla/blob/v1.19.4/src/materials/MeshTransmissionMaterial.ts)、[官方例程](https://github.com/pmndrs/drei-vanilla/blob/v1.19.4/.storybook/stories/MeshTransmissionMaterial.stories.ts)、[package](https://github.com/pmndrs/drei-vanilla/blob/v1.19.4/package.json) | 原生class、RGB循环、前背面FBO调度、peer／dev。 |
| [drei透射core](https://github.com/pmndrs/drei/blob/v9.117.3/src/core/MeshTransmissionMaterial.tsx)、[折射core](https://github.com/pmndrs/drei/blob/v9.117.3/src/core/MeshRefractionMaterial.tsx)、[折射shader](https://github.com/pmndrs/drei/blob/v9.117.3/src/materials/MeshRefractionMaterial.tsx)、[package](https://github.com/pmndrs/drei/blob/v9.117.3/package.json) | React依赖、实际默认、BVH／相机更新、环境采样与色散。 |
| [BVH README](https://github.com/gkjohnson/three-mesh-bvh/blob/v0.7.8/README.md)、[package](https://github.com/gkjohnson/three-mesh-bvh/blob/v0.7.8/package.json)、[r170 CubeCamera](https://github.com/mrdoob/three.js/blob/r170/src/cameras/CubeCamera.js) | Shader and Texture Packing API／Gotchas／refit；peer；6面render。 |
| 完整MIT：[Three](https://github.com/mrdoob/three.js/blob/r170/LICENSE)、[vanilla](https://github.com/pmndrs/drei-vanilla/blob/v1.19.4/LICENSE)、[drei](https://github.com/pmndrs/drei/blob/v9.117.3/LICENSE)、[BVH](https://github.com/gkjohnson/three-mesh-bvh/blob/v0.7.8/LICENSE) | 均允许复制、修改、商用分发；摘取实质源码须保留各自版权及许可。示例外链HDR／纹理需另查授权。 |

### 纸布与浅层散射

## 薄纸／布、浅散射与湿面：可借鉴的 4 条路径

核查日期：2026-10-28。仅研究，未安装依赖、编译 shader 或改动代码。沿用 [材质审查](2026-10-28-material-lighting-audit.md) 的 5 场优先／40 场可选范围；已读 `docs/scene-provenance.md`，不新增文化主张或改变材料身份。

**推荐：薄纸借 Khronos 漫透射公式，蜡／玉／皮肤浅散射借 Three r170 快速 SSS，保留 PBR／卡通基底；粥面先用原生粗糙度与 clearcoat。** 未找到适合本工程的现成通用“paper material”。完整 SSS 通常不必先做，这是针对本轮风格化部件的判断，未经真机测量。

| 候选与成熟度 | 用途与采用方式 | 原生 Three r170 适配、手机成本（定性推断） |
| --- | --- | --- |
| **Khronos Sample Renderer 漫透射**，官方参考实现，Apache-2.0 [S1][S2] | 薄纸／帆布：借背面 Lambert、透射颜色、反射能量分配；另有背向环境漫光。 | 非 Three 插件，自有 include／uniform／输出；只移植光照项，适配中等。精简直接光不需屏幕抓取／额外 pass，成本低至中。 |
| **Three r170 `SubsurfaceScatteringShader`**，官方 addon／示例，MIT [S3][S4][S5] | 蜡／玉／果肉／皮肤的弱散射公式参考，使用厚度 mask、颜色及方向性参数。 | 可直接导入建 `ShaderMaterial({lights:true})`，但基于 **Phong**，建议仅移植公式。非多重散射；单 pass，每灯增加运算与厚度采样，成本低至中。 |
| **CSM vanilla**，材质扩展工具，MIT [S6][S7][S8] | 组织 Standard／Physical shader 补丁；不提供纸或皮肤模型。 | main package 自报 **6.4.0**，非 npm 最新声明。`/vanilla`、`three >=0.159`，React／R3F peers 可选；dev 类型 r172，需验证 r170 编译。适配中等，不自动增加 pass，GPU 成本由补丁决定。 |
| **r170 `MeshPhysicalMaterial.clearcoat`**，原生 API，MIT [S5][S9] | 粥／甜糊湿面：粗糙基底叠平滑反射层，米粒较哑。 | 直接用 API；分离共用 cream 材质，保持乳浊、`transmission=0`，免另建透明层／折射 buffer。Physical 比 Standard 每像素成本高；局部使用低至中。 |

### 必须保留的边界

- **transmission 不是纸漫透射。** 规范区分微表面与漫反射 BTDF，后者反射粗糙度不控制透射模糊度。[S10] 降 alpha、粗糙玻璃或 emissive 均不等同纸。
- **SSS 不是透光阴影系统。** r170 追加散射时 `directLight.color` 已经过普通阴影衰减。[S3][S11] 不自动产生彩色投影、厚度、竹骨柔影或体积输运；厚薄／重叠 mask 和实际投影要另设计。
- **glTF 扩展不能直接用于 r170。** 实读 `KHR_materials_diffuse_transmission` 为 **Release Candidate，未 Ratified**；描述无限薄面及蜡的近似。[S10] r170 loader 无处理器，Physical 无对应属性。[S12] 借模型即可，无需因此升级全栈。

### 本项目接入风险

`toon-surfaces.ts` 先原样保留透明材质；普通不透明 Standard 通常重建，不透明 Physical／金属或低粗糙度 Standard 在 toon-soft 中 clone。缓存每帧只同步 color、emissive、opacity、visible。`outline:false`／`shading:smooth` 不保护回调。r170 的 `onBeforeCompile`、`customProgramCacheKey` 不随 clone／copy 保留。[S13] 必须在最终渲染材质上保存补丁／键／uniform，并验证风格切换。

CSM 继承 `THREE.Material`、合并基材字段而非 Physical 原型。**源码推断**本项目 `instanceof Standard/Phong/Lambert` 会跳过它；尚未运行验证，不作为风格豁免契约。其 clone 重建 shader，但沿用 `__csm.uniforms` 引用，不保证独立；默认键组合 shader／基材键，patchMap 变体需自定义键。[S7] 小规模公式移植可先用项目内补丁，CSM 非必需依赖。

试验先选纸伞／粥面各一处，以同光照／分辨率在 iPhone Expo WebView 比较画面、帧时间、内存及风格切换；本次无真机结果。

### 已读来源与访问状态

以下均于 **2026-10-28 已读相关正文／源码**，未通读整个仓库；核心代码已固定提交。

| 编号 | 一手来源完整 URL 与实读范围 |
| --- | --- |
| S1 | Khronos glTF Sample Renderer `pbr.frag`，`MATERIAL_DIFFUSE_TRANSMISSION` 的 IBL 与 punctual 分支（约 174–188、297–314 行）：https://github.com/KhronosGroup/glTF-Sample-Renderer/blob/6e8a3d1aaa6f07e9f1310a488453e21325677786/source/Renderer/shaders/pbr.frag |
| S2 | 同仓 Apache-2.0 LICENSE，许可与再分发条款：https://github.com/KhronosGroup/glTF-Sample-Renderer/blob/main/LICENSE.md |
| S3 | Three r170 SSS 源码，Phong 组装、厚度读取及直接光注入：https://github.com/mrdoob/three.js/blob/r170/examples/jsm/shaders/SubsurfaceScatteringShader.js |
| S4 | Three r170 SSS 示例，import 与 `initMaterial`：https://github.com/mrdoob/three.js/blob/r170/examples/webgl_materials_subsurface_scattering.html |
| S5 | Three r170 MIT LICENSE 正文：https://github.com/mrdoob/three.js/blob/r170/LICENSE |
| S6 | CSM 固定提交 package 版本、exports、peers：https://github.com/FarazzShaikh/THREE-CustomShaderMaterial/blob/cf86e956715bd6cd97e7ae61ffdf459e4a4c822e/package/package.json |
| S7 | CSM 同提交 `index.ts`，构造／注入／缓存／clone：https://github.com/FarazzShaikh/THREE-CustomShaderMaterial/blob/cf86e956715bd6cd97e7ae61ffdf459e4a4c822e/package/src/index.ts |
| S8 | CSM MIT LICENSE 正文：https://github.com/FarazzShaikh/THREE-CustomShaderMaterial/blob/main/LICENSE.md |
| S9 | Three r170 Physical 文档，湿面 clearcoat、性能及属性：https://github.com/mrdoob/three.js/blob/r170/docs/api/en/materials/MeshPhysicalMaterial.html |
| S10 | Khronos 漫透射规范，Status／Overview／Material Structure／Implementation／与 transmission 结合／版权附录：https://github.com/KhronosGroup/glTF/blob/1c84b58ba3338be4731ea546fa4138dcbb93d42d/extensions/2.0/Khronos/KHR_materials_diffuse_transmission/README.md |
| S11 | Three r170 直接光／阴影调用顺序：https://github.com/mrdoob/three.js/blob/r170/src/renderers/shaders/ShaderChunk/lights_fragment_begin.glsl.js |
| S12 | Three r170 loader 插件注册与扩展枚举：https://github.com/mrdoob/three.js/blob/r170/examples/jsm/loaders/GLTFLoader.js ；Physical 构造与 copy：https://github.com/mrdoob/three.js/blob/r170/src/materials/MeshPhysicalMaterial.js |
| S13 | Three r170 Material 文档，`onBeforeCompile`、`customProgramCacheKey` 与 clone 限制：https://github.com/mrdoob/three.js/blob/r170/docs/api/en/materials/Material.html |

历史核查：已读 r105 https://github.com/mrdoob/three.js/blob/r105/examples/webgl_materials_translucency.html 及 https://github.com/mrdoob/three.js/blob/r105/examples/js/ShaderTranslucent.js （旧全局 API）。r170 同旧示例／`TranslucentShader.js` 路径 404，**未记已读**；采用 S3/S4。复制 MIT 代码保留声明；Apache 片段保留许可／适用通知并标修改，资产另核许可。[S2][S5][S8]

### 表面贴图与灯火光晕

核查日期：2026-10-28。已读 `AGENTS.md`、`docs/scene-provenance.md`。仅研究技术外观，未改代码或文化主张；资产名和授权不能证明文化关联。未安装包、下载整库或做手机实测。

## 候选资产：PBR 图片素材，不是 shader 库

| 资产、完整来源 URL | 已读证据／许可 | 本项目映射与取舍 |
| --- | --- | --- |
| **ambientCG Paper 001** — https://ambientcg.com/view?id=Paper001 | 已读资产页：白纸、1K–4K JPG/PNG；官方 API `https://ambientcg.com/api/v2/full_json?id=Paper001&include=downloadData,mapData` 已读，列 color/displacement/normal/roughness。CC0 1.0。 | **可采用，优先。** 莲灯 `yeondeunghoe`、纸伞 `japanese-wagasa`、纸鹤 `crane` 的轻微纤维 normal/roughness；保留颜色、印刷、折线。不是和纸工艺证据。未列 thickness。 |
| **Poly Haven Rough Linen** — https://polyhaven.com/a/rough_linen | 已读下载表：Diffuse、Normal(GL/DX)、Rough、AO/ARM、Displacement、Mask、Metal、Spec IOR、各向异性强度／旋转。1K–8K，CC0；未列 thickness。 | **可采用，优先。** 绣框 `hungarian-embroidery-hoop` 的素底布；旗布 `tibetan-prayer-flags` 只试低强度纤维 normal/roughness，保留旗色与印字。Mask 不等于厚度。 |
| **Poly Haven Crepe Satin** — https://polyhaven.com/a/crepe_satin | 已读下载表：Diffuse、Normal(GL/DX)、Rough、AO/ARM、Displacement、Metal、Spec IOR、各向异性强度／旋转。1K–8K，CC0；未列 thickness。 | **只借鉴／条件采用。** 绣线或确定为缎面部件的定向高光参考，普通旗布不应一律变亮缎。当前绣布 `MeshStandardMaterial` 不会自动使用各向异性图，升级材质另有成本。 |
| **3DTextures.me Candle 001** — https://3dtextures.me/2020/06/16/candle-001/ | 已读正文：免费1024² seamless，Diffuse、Normal、Displacement、Roughness、AO；4K PNG/SBS为付费选项。CC0；未列 thickness/transmission/SSS。 | **可采用，次优先。** `votive-candle-catholic` 蜡顶微表面候选；贴图不会生成熔蜡轮廓或散射，不应用于油灯 `diya-oil-lamp` 陶碗与油面。 |
| **3DTextures.me Water 001** — https://3dtextures.me/2017/12/28/water-001/ | 已读正文：免费1024² seamless，Color、Normal、Displacement、Roughness、AO，CC0；未列 thickness。未下载包核对GL/DX约定。 | **只借鉴，优先级低。** 对照水面细节尺度。既有 `createStylizedWater` 已有波纹与水光，且 shader 重写法线，直接赋 `normalMap` 不代表能叠加；无视觉缺口时不值得增加。 |

五项均于2026-10-28已读相关正文，未读下载包。“未列thickness”仅指清单未提供该项；height/displacement不是已校准的透光厚度。玉如意 `chinese-ruyi-scepter` 无本批匹配资产，不能用蜡贴图冒充玉。

许可正文（均于 2026-10-28 已读相关条款）：

- ambientCG： https://docs.ambientcg.com/license/ — CC0 1.0，允许修改、商用、在游戏分发原文件，无强制署名。
- Poly Haven： https://polyhaven.com/license — 资产CC0；网页文案、logo、示例渲染等另有权利，不能把整个网站视为CC0。
- 3DTextures.me： https://3dtextures.me/about/ — 纹理CC0，允许商用、再分发，无强制署名，不得自称原作者。

## 灯火：保留现有 halo，Bloom 是条件备选

本地 `packages/scenes/src/procedural-kit.ts:192` 的 `createLampHalo` 已有64²径向透明DataTexture、线性过滤、Additive Sprite、`depthWrite:false` 与 `dispose()`；莲灯、蜡烛、油灯已有调用。**优先复用，无需增加glow依赖。** 光晕不等于照亮纸罩／桌面的光照。

| 方案 | 版本与许可证据 | 判断与手机风险 |
| --- | --- | --- |
| **既有 BloomEffect** | 已读6.39.5源码 https://raw.githubusercontent.com/pmndrs/postprocessing/v6.39.5/src/effects/BloomEffect.js 和API https://pmndrs.github.io/postprocessing/public/docs/class/src/effects/BloomEffect.js~BloomEffect.html 。支持阈值、强度、mipmapBlur、radius、levels；resolutionScale等已deprecated。 | **条件采用。** 灯芯溢光不足时做单场景对照。纸面、白瓷、HDR反射都可能随阈值发白；Bloom不负责透光。新增模糊与RT成本是源码推断，无手机实测值。 |
| **SelectiveBloomEffect** | 已读6.39.5源码 https://raw.githubusercontent.com/pmndrs/postprocessing/v6.39.5/src/effects/SelectiveBloomEffect.js 与API https://pmndrs.github.io/postprocessing/public/docs/class/src/effects/SelectiveBloomEffect.js~SelectiveBloomEffect.html 。含DepthPass、DepthMask ShaderPass、额外RT，支持selection与ignoreBackground。 | **只作升级备选。** 选灯芯／火焰控制更准，但透明纸、水、halo遮挡须验证；Group不能假定全部子网格入选。额外pass成本只据源码推断，不标实测倍率。 |
| **Three官方TSL VFX Flames** | 完整script经HTTPS已读： https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/webgpu_tsl_vfx_flames.html 。使用WebGPURenderer、SpriteNodeMaterial、three/tsl；UV扭曲、噪声、alpha与颜色梯度形成火舌。MIT正文已读： https://raw.githubusercontent.com/mrdoob/three.js/r170/LICENSE 。 | **只借鉴。** 无法原样接现有WebGLRenderer；移植GLSL思路前另核对随例噪声图授权。不引入流体模拟；既有轮廓足够时不值得移植。r170旧objects/Fire.js实访404，不能列可用addon。 |

本地Three **0.170.0**、postprocessing **6.39.5**。已读官方 https://raw.githubusercontent.com/pmndrs/postprocessing/v6.39.5/package.json ：peer为`three >=0.168.0 <0.187.0`，当前满足，但不代表WebView效果已验证。已读 https://raw.githubusercontent.com/pmndrs/postprocessing/v6.39.5/LICENSE.md ：**Zlib**，允许商用修改，不得歪曲原作者，修改版须标识，源码分发保留通知。Three为MIT，保留版权与许可通知。

## 后续小样约束（工程建议，未实施／未实测）

- 近景先试 **512–1K** normal＋必要roughness，保留现有颜色，不带整套4K/8K。JPG/PNG/WebP分发压缩不等于GPU内存下降；KTX2/Basis需验证加载、法线质量、设备格式回退。
- normal选GL；normal/roughness/thickness数据不按sRGB处理。手机检查UV接缝、重复尺度、远处摩尔纹；不为纸纤维开网格displacement。
- alpha透明不是透光。halo虽`depthWrite:false`仍有默认深度测试；检查灯体遮挡、透明排序、DoubleSide、水／油面。SelectiveBloom深度遮罩不保证透明物理遮挡正确。
- `render-style.ts` 的original直接render，其他风格用HalfFloat composer＋ACES。Bloom须进入同一链、在tone mapping前比较HDR阈值，避免独立composer、重复映射和抬曝光；看纸色、白瓷、玉面、轮廓线是否失真。
- 保留halo回退。后续同机同分辨率对照帧时间、内存、切换／销毁和画面再决定；本文无“稳定60fps”的承诺。

## 本轮核查范围

已阅读项目场景来源规范，沿用[材质审查的文化影响边界](2026-10-28-material-lighting-audit.md)。本轮只研究技术资源，不新增文化起源、信仰效果、器物身份或材料出处主张。未修改注册表、来源卡、文案、动作、标题、metadata、存档或生产代码。

已机械核对45个候选ID与上一轮表格完全一致（5个P1、40个P2），没有遗漏、重复或扩大到109个保持现状的场景。后续仍需做代表场景编译、原始/卡通风格对照、交互、日夜/暂停/恢复，以及iPhone/WebView GPU时间与内存验收；本研究不把peerDependencies范围或源码可读等同于运行通过。
