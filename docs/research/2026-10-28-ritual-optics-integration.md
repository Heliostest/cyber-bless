# 仪式场景光学材质接入记录

日期：2026-10-28。范围来自[154 场逐场审查](2026-10-28-material-lighting-audit.md)与[开源方案研究](2026-10-28-open-source-optics-materials.md)：5 个优先、40 个可选，共 45 场。用户授权接入。本次只改变已核查部件的技术显示；其余 109 场保持原有材质。

后续用户查看真实对比后，灯笼与纸伞继续增强了骨架遮光和纸面层次；其最终参数、上一版工作区快照对比及新增验证见[二次调校记录](2026-10-28-paper-lighting-refinement.md)。本文件以下的测试数字与边界记录首轮接入，后续结果以该记录为准。

## 实现与边界

共享入口为 [`@wbr/scene-runtime/ritual-optics`](../../packages/scene-runtime/src/ritual-optics.ts)。采用现有 Three.js 0.170.0，无新增依赖。`createRitualMaterial` 保留各场景的颜色、贴图、顶点色、动画引用及适用的深度／双面设置；`copyRitualOptics` 将补丁与纹理生命周期转移到风格化材质。原图、柔和卡通、墨线卡通和水粉四种风格均纳入真实 WebGL 编译核验。

- **纸、布、叶、薄蜡、玉、皮肤、果肉：** 在现有直接光受阴影衰减后，加少量方向性背光散射。纸布仍为实体遮挡，不靠降低整体 alpha 制造透光，也不新增自发光。它是单次着色的艺术近似，没有厚度贴图、体积积分或多层散射求解。
- **玻璃、茶、蜂蜜：** 使用原生 `MeshPhysicalMaterial` 的 transmission、IOR、thickness 与有色吸收，opacity 为 1。默认保留 `transparent:true` 以兼容宿主的阴影分类；宿主不会据此把透射介质提升为实心投影物。原生 transmission 仍有 Three 内部渲染成本，不宣称零附加 pass。
- **小水面、水流与水滴：** 使用受光、非金属、低粗糙度 Standard 材质，加入很弱的静态微波法线及掠射边缘响应。保持各场景的水位、流线、透明动画与既有 `createStylizedWater` 大水面；不是实时折射或屏幕空间水体。
- **粥、浓糊与油面：** 用不透明 Physical 湿润反射与 clearcoat 表达。米粒、陶器、木材等独立材质不随共享颜色一起改变。
- **光源：** 沿用既有火焰、点光、光晕及点燃／冷却反馈；水灯只补与既有火焰同步的小光晕。没有给普通木器、纸工艺或食物新增光源。未引入全屏 Bloom、MTM、BVH 或另一套后处理管线。

## 45 场部件覆盖

每场的 `packages/scenes/src/<ID>/README.md` 记录实际部件、技术近似及既有文化核查的引用。表中的材料名称沿用原有器物身份，不由所用纹理库反推其地域或历史。

| 场景 ID | 接入部件与保留边界 |
| --- | --- |
| aland-votive-ship | 独立帆布散射与微纤维；舱顶木材保留原材质 |
| bai-indigo-cloth | 漂洗盆水面受光与边缘响应；扎染图案和布料保持覆盖 |
| basque-sunflower | 纸花瓣微纤维与弱背光；中心、支架不变 |
| blang-tea | 茶汤原生透射、琥珀色吸收；杯、叶片不变 |
| breton-banner | 主旗布微纤维与弱散射；边饰、旗杆等独立 |
| chinese-incense | 小茶面弱透射；保留香头和香烟的原反馈 |
| chinese-ruyi-scepter | 玉身弱浅层散射；陶、木、金属不随之变化 |
| chinese-shadow-puppet | 保留 Basic 幕布与数学影像投影，只加极弱程序织纹；此例没有新增真实透射或散射 |
| chinese-woodblock-print | 纸张与纸边微纤维／弱散射；印纹保持覆盖 |
| clootie-well-rag | 井内水面受光；井石及布结不改为透明 |
| crane | 三组折纸面／边材质微纤维与弱散射；保留折叠和光反馈引用 |
| czech-pilgrim-journal | 旅杯中的浅茶面弱透射；纸页及书皮不变 |
| diya-oil-lamp | 油面不透明湿润反射；保留陶灯、灯芯、火焰及既有光源 |
| fgs-buddha-bathing | 近景水体受光、零金属度；保留水位、人物与器物材质 |
| floating-lantern-loy-krathong | 既有火焰同步小光晕，随生命周期释放；保留水面管线和灯体 |
| furin-wind-chime | 玻璃铃罩原生透射、厚度和吸收；降低均匀蓝色自亮，保留互动反馈 |
| greek-new-year-pomegranate | 只给石榴籽果肉弱散射；外皮、白膜与容器不变 |
| hungarian-embroidery-hoop | 只给亚麻底布微纤维与弱散射；刺绣、绷圈不变 |
| irish-bodhran | 鼓皮弱背光；木框、鼓槌不变 |
| japanese-koinobori | 原贴图鱼身／尾布微纤维与弱散射；纹样保持覆盖 |
| japanese-wagasa | 顶点色纸伞面微纤维与弱散射；伞骨、柄仍实体 |
| kagami-biraki-sake | 桶内酒液受光与边缘响应；桶、绳及开盖流程不变 |
| korean-bojagi-wrap | 原贴图包布与带部弱散射；结、包裹状态不变 |
| lantern | 纸灯罩微纤维与弱散射；保留既有 emissive、点光和光晕 |
| lao-baci-wrist | 只给手掌、手指、拇指弱散射；前臂与棉线保留原材质 |
| nanakusa-gayu | 粥面独立为不透明湿润材质；米粒仍为原哑光材质 |
| navruz-sumalak | 浓糊与表面纹路不透明湿润反射；锅、勺和食材身份不变 |
| paper-pinwheel | 四片纸叶微纤维与弱散射；后部珠、杆与轴不变 |
| rosh-hashanah-apple-honey | 蜂蜜体积与薄膜独立原生透射、有色吸收；苹果及器皿不变 |
| setsubun-mamemaki | 纸门面微纤维与弱散射；木骨和豆粒不变 |
| tamagushi-offering | 纸垂微纤维与弱散射，叶片独立弱背光；枝与器皿不变 |
| tanzaku-tanabata | 挂纸与散纸微纤维、弱散射；竹与绳不变 |
| thai-songkran-elders | 现有连续水面／流线受光、零金属度；手、碗、操作不变 |
| theravada-water | 水流受光、降低均匀自亮；保留 opacity 从 0 起的倾注动画及原盆水 |
| tibetan-khata-greeting | 只给白绢自由端薄边与穗弱散射；中间折层及人物仍原材质，不套亚麻纹理 |
| tibetan-prayer-flags | 五片旗布微纤维与弱背光；颜色、印纹和实体遮挡保留 |
| tibetan-water-bowls | 七碗、壶内水与细流受光、零金属度；水位和金属碗保留 |
| turkish-ebru-paper | 仅揭纸后浅色浴液受光与边缘响应；漂浮颜料及纸上彩纹保持覆盖 |
| turkish-nazar-bead | 只给深蓝外层低强度有色透射；白圈、瞳及其他实色层不透明 |
| valencian-folding-fan | 三组布褶弱散射、微纤维；木骨和铆钉保持实体 |
| venetian-glass-bead | 主珠及同伴珠统一原生透射与吸收，取消 alpha 与 transmission 叠加削色；保留彩带冷却 |
| votive-candle-catholic | 仅蜡顶薄沿与浅蜡池弱散射；烛身、蜡滴实体，火焰及点光不变 |
| weifang-paper-kite | 分离各纸色与弱散射；竹骨、绑线、墨色独立保留 |
| yeondeunghoe | 莲灯纸瓣／尖端微纤维与弱散射；保留原灯芯、点光、光晕与升起亮度 |
| zeniarai-coin-washing | 勺水、水流、水滴改为受光的透明非金属；保留盆水管线与金属硬币 |

## 开源资源与许可

直接参考 Three r170 的 SSS 示例方向扰动概念和 Khronos 漫透射模型，自行实现小型着色补丁；未照搬带渲染目标的高级材质。研究中的原始链接、已读范围及许可见[开源方案研究](2026-10-28-open-source-optics-materials.md)。[Three MIT 声明](../../assets/materials/ritual-optics/LICENSE.three.txt)已保留。

运行时纤维细节来自 ambientCG `Paper001` 与 Poly Haven `rough_linen` 的真实 CC0 粗糙度图。已保留两张 512px 灰度衍生图、原始 URL／校验值、完整 CC0 文本、转换脚本和测试。详见[资产来源记录](../../assets/materials/ritual-optics/provenance.md)与[机器可读清单](../../assets/materials/ritual-optics/sources.json)。

运行时将每张图归一化为 64×64、96–160 范围的微细节标量，按物体局部坐标投影；两张基础纹理合计 8192 字节，非 sRGB，无异步图片加载。它们不是实测厚度、物理纤维几何或未经修改的粗糙度测量。共享引用计数使风格切换与退出不会提早或重复释放纹理，场景运行不联网。

## 验证与限制

当前已通过：

- `npm.cmd exec -w @wbr/scenes -- vitest run --reporter=dot`：268 个测试文件、9433 项全部通过（最终重跑 253 秒）。包含完整场景交互、恢复、可见命中、模型与资源生命周期回归。
- `npm.cmd run test -w @wbr/scene-runtime`：153 项，含光学补丁、四风格传递、参数动画、共享纹理释放及宿主透射物阴影分类。
- 手部／白绢局部材质与原模型相关测试：14 项；新增局部性断言先验证失败，再实施修正。
- 液体组 7 套定向测试：124 项。完整测试首次发现的 5 处失败已复现并核对：漂洗水面测试采用与生产相同的 opacity ≥ .5 命中范围；光晕检查区分 Three 共享 Sprite 几何与场景自有材质／贴图，后者逐一释放一次；玻珠以 opacity 1 加原生 transmission 和吸收验收。
- `npm.cmd run typecheck -w @wbr/scenes` 与 `npm.cmd run build`；生产构建保留既有大包警告。
- `npm.cmd run mobile:verify`：依赖检查、移动端类型检查、8 项引导／离线守卫测试及 Android／iOS 原生与 DOM 离线导出均通过，含 14 项资源和每平台 465 张组件封面的哈希检查。首次沙箱运行因本机回环访问受限退出，受控执行重跑通过；未改测试绕过网络限制。
- 资产完整性及离线数据重生成检查。
- 独立代码审阅及窄范围复审：手部、白绢范围和透射物投影分类三项均已修正，没有剩余重要或严重问题。
- 真实 Chromium 151／Three r170 WebGL：12 类材质 × 4 风格 = 48 项编译／显示检查；45 场 × 开始／进行中／恢复完成 = 135 个状态，检查原图与柔和卡通共 270 次风格渲染并执行暂停／恢复。清水七供完成状态为 progress 9，其余为 3。着色器错误、无效 program、静默风格回退、场景异常、console／page 错误、黑帧检查均为 0。已人工查看 10 场代表拼图及纸灯、风铃、纸伞和莲灯原尺寸画面。
- 45/45 场景 ID 与研究清单一致，每场实现、README 记录及新增相对链接均核对存在。

浏览器检查脚本为 [`scripts/verify-ritual-optics-webgl.mjs`](../../scripts/verify-ritual-optics-webgl.mjs)，实渲染产物保存在本地 `artifacts/ritual-optics/`（构建产物目录，不入版本控制）：`report.json`、`contact-sheet.png`、代表截图、`scenes-test.log` 及独立审阅／分组实施报告。截图是隔离场景的测试宿主，未加载完整产品 UI。最终 `git diff --check` 通过，预先存在的商店与截图工作保留。

浏览器复验：先运行 `npm.cmd run dev -w @wbr/cyber-bless -- --port 5177 --host 127.0.0.1`，在同一主机环境设置 `WBR_URL=http://127.0.0.1:5177` 后运行 `node scripts/verify-ritual-optics-webgl.mjs`。脚本支持 `--profiles-only`、`--scenes-only` 与 `--scene=<ID>`，完整模式核对 45 场并输出 JSON 和拼图。Windows 沙箱隔离本机回环时，服务与浏览器脚本须处于同一个受控执行环境。验收结束后已停止本轮创建的验证服务。

本次没有实测 iPhone／Android GPU 帧时间、温升或电量，桌面软件 WebGL 编译通过不能代替实机性能数据。没有声称全套前后 A/B 美术优劣或物理精确。夜间灯具保留原完成态的高亮反馈，新增散射不等于重新调校其全部亮度与瓣间遮挡。

## 文化关联核查

按[现行核查规范](../scene-provenance.md)先对照实际部件与材质，再检查文化影响。本轮沿用[2026-10-19 来源审阅](2026-10-19-scene-culture-audit.md)和各场景 README 的既有证据；没有把现有代码、CC0 许可、模型外观或技术测试当作传统事实的证据，也不声称重新打开了全部文化外部来源。

- [x] 实际器物、材料、动作、对象、场合与完成条件已对照；变化限于表列部件光学显示。
- [x] 无新增／变化的地域、历史、起源、寓意、顺序、数量、期限、资格或节期主张；记录了技术近似与既有核查引用。
- [x] 无新增来源绑定，未将普通工艺错绑为宗教或民俗索引；未改写已有真实信仰背景。
- [x] 研究记录与每场 README 区分文化事实、产品显示与读取状态；资源许可仅证明再利用许可。
- [x] 来源卡、宿主目录、注册表、metadata、标题及原生组件无需字段同步：本次未改变这些字段、分类和绑定；技术 ID 与存档兼容。
- [x] 用户介绍、提示、状态、结束语和操作均未新增文化断言。
- [x] 技术检查与文化审阅分开记录；没有用测试通过替代文化证据。
