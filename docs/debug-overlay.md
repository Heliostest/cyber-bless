# 场景 Shader 调试面板（历史记录）

2026-11-05 最新：用户确认后，正式默认改为「按场景推荐树木＋暖阳小镇」。调试台保留所有原景比较项；树木恢复按钮恢复推荐，退出调试也恢复正式默认。分享使用推荐树木与暖阳配色，不夹带临时比较。九个映射与其余保留原树的范围见[默认布景核查](research/2026-11-05-environment-defaults.md)。下文当日“仅预览／正式默认不变”均为此前阶段的历史记录。

2026-11-05：开发版「调试台 → 环境色调 → 背景配色」增加「原有色调 / Tiny Delivery · 暖阳小镇」，协同预览共用环境的天空、云、草地、树木、道路、木平台及光照。默认保留原景；选择在本次调试会话中跨场景保留，折叠不撤销，卸载恢复，不写正式存档。原有水体／树木比较项保留，稍后加载的树也应用当前色调；正式分享临时恢复原景。参考读取范围、文化影响与验证见[环境色调记录](research/2026-11-05-environment-tone.md)，验收命令为 `node scripts/verify-environment-tone.mjs --serve`。

2026-11-05：近景树预览进一步柔化投影与叶簇明暗，修正 Simple Tree 簇法线在双面叶卡背面的反转，并在普通材质中使用低反差包裹漫反射。仅替代树可见时使用较浅、较宽的 PCF 树影；原景／正式分享和卸载恢复原设置。详情见[柔和树影与叶簇](research/2026-11-05-soft-tree-preview.md)。

2026-11-05：按用户后续要求，已选替代树采用「树下」近景构图：两侧局部枝干、上沿枝叶及后方树丛，根据实际模型轮廓留出中央操作空间。适配平视／俯视及窗口变化，不跟随互动镜头逐帧移动。仍为调试预览，恢复原树及正式分享保留原有布局。实现与核对见[树下构图](research/2026-11-05-under-tree-preview.md)。

2026-11-05：用户选择先做调试预览，树木选择进一步增加「按场景推荐」及「樱花树（春景）/ 柱形柏树 / 垂柳 / 层叠针叶树」。九个经场地／季节证据核查的产品园林推荐见[地区树形证据](research/2026-11-05-regional-tree-evidence.md)，其余保留原景，不按国家名称批量套树。按用户后续选择，四类特色树形统一使用固定 MIT 的 Just a simple tree；樱花基于其分枝和叶簇管线改编开张树冠与五瓣花纹，属于产品美术。正式默认与文化主题树不变，原有两个来源比较项保留。

2026-11-05：当前开发版「调试台 → 树木样式」增加「原有树木 / Quaternius Stylized Nature / Just a simple tree」。切换真实共享环境树，不重置相机、场景进度或正式偏好；折叠保留，恢复按钮或卸载调试台恢复原树。支持共享日景／夜景，主题树和没有环境树的场景不替换。加载时保留画面，失败恢复原树并提示；竞争和退出后的迟到资源会释放。来源与许可见[树木资源](../assets/environments/trees/README.md)，浏览器验收脚本为 `scripts/verify-tree-debug.mjs`。

2026-11-04：当前开发版「调试台」增加独立的「水体渲染」选择，可在 15 个实际含水场景中切换原有水体与 Shader Gallery Toon Water，不启用下述旧 Shader Lab。普通 App 和 `/scene-review` 均可使用；收起面板保留预览，恢复按钮或卸载调试台撤销本 App 的覆盖，不写正式存档。场景清单、排除项、来源状态与验证见[水体盘点](research/2026-11-04-toon-water.md)。

2026-11-03：已删除停用的 Shader 悬浮面板组件、样式、专属翻译和旧 UI 测试。正式视觉风格菜单及共用渲染器继续保留；下文旧面板操作仅作历史记录。

当前验证：`node scripts/test-shader-parameters.mjs` 检查真实 WebGL 参数效果；`node scripts/test-gouache-style.mjs` 及同类风格脚本通过正式“仪式设置 → 视觉风格”菜单检查场景；`node scripts/verify-visual-style-filmstrip.mjs` 检查正式菜单布局与操作。均支持 `WBR_URL`。

2026-11-03：Web 开发版新增独立「调试台 → 界面音效覆盖」，操作方式和当前范围见 [音效检查说明](audio-inspector.md)。它不启用下述旧 Shader 面板，生产版与原生包不显示。

2026-10-31：已从所有 App 路由移除悬浮 Shader 调试台及入口，开发环境和 `?debug=1` 均不再挂载，也不再加载旧的浏览器调试覆盖。仪式内的正式“视觉风格”菜单继续使用用户保存的设置。下文保留旧实现与历史验证记录，其中悬浮面板的入口和 UI 回归命令不再适用于当前 App。

正式 App 已在仪式音效／震动旁提供“视觉风格”菜单，按仪式经主机保存，默认不变；当时的 Shader Lab 为开发工具。二者共用风格与参数定义，正式菜单不读取开发存储。开发覆盖优先；正式编辑清除对应调试项，开发面板清除覆盖时恢复用户已保存的选择。见 [App 接入评估](research/2026-10-23-app-visual-style.md)。

运行 `npm run dev -- --port 5176`，进入场景后点击右侧 **SHADER LAB**。开发环境默认显示入口；生产构建需在页面地址添加 `?debug=1` 才启用。手机上入口和紧凑面板位于右下方。

当前接入木鱼和共享渲染器下的程序化场景，包括 `/scene-review?scene=blang-tea` 的实际场景预览。切换风格会立即更新当前画布，不重置仪式进度。多个已挂载场景可以通过下拉框分别选择；离开场景会移除其调试项并释放后处理资源。

2026-09-24：正式应用的场景目录也接入上述三个引擎，并按目录场景 ID 区分调试覆盖。同一引擎的不同场景不会互相覆盖选择。手机底部存在主导航时，调试入口上移到导航上方，避免挡住“我的”和缓存管理入口。新的下载/缓存链路不改变 `MeshToonMaterial` 或 pmndrs/postprocessing 渲染实现。

选择按场景 ID 保存到当前浏览器的 `wbr.debug.scene-styles.v1`，刷新或重新进入场景后仍然有效。存储不可用时仍可实时预览。点击“恢复内容默认”清除该场景覆盖，重新使用当前内容默认风格；应用内木鱼与程序化场景仍默认为柔和卡通。普通生产页面不读取或应用调试覆盖；面板不修改内容包或用户存档。Shader 绘制失败后回退到原始光照，并显示实际生效状态。

选择“网点印刷”后显示网点大小（2–16 CSS px）与效果强度（0–100%）；选择“复古像素”后显示像素大小（1–12 CSS px）。拖动即时生效，支持键盘方向键及 Home/End。初始值保持此前的 4 px／58%／3 px。“重置参数”只恢复当前风格的参数；“恢复内容默认”清除风格覆盖，调试参数仍可留待下次比较。参数按场景保存在独立的 `wbr.debug.scene-parameters.v1`，旧版风格存储保持兼容，仅在调试模式应用。实现与文化影响边界见[网点与像素记录](research/2026-10-22-halftone-pixel-rendering.md)。

“Moebius 手绘漫画”可调描边采样宽度（0.25–3 CSS px）、亮度色阶（2–12 级）及排线强度（0–100%，0 关闭排线），初值分别为 0.85 px、8 级、50%；“卡通描边”可调相对粗细（0.5–4×）及漫反射色阶（2–8 级），初值为 1×、3 级。卡通粗细改变遮罩边缘的采样距离，保留深浅遮挡判断；色阶只调整原有卡通漫反射材质，玻璃／金属／釉面仍保留。两种风格独立记忆与重置，旧参数记录会补齐新初值，默认风格仍为柔和卡通。详见 [Moebius](research/2026-10-22-moebius-rendering.md)与[卡通描边](research/2026-10-22-toon-outline-rendering.md)记录。

新 Three.js 场景可使用 `@wbr/scene-runtime/debug-render-style` 的 `createDebugRenderStyle(renderer, scene, camera, { id, label, invalidate })`。`id` 应稳定且独立；按需渲染场景通过 `invalidate` 请求新帧，持续渲染场景可省略。通过返回对象的 `setStyle` 设置内容默认风格，并接入 `render`、`resize` 和 `dispose`。渲染集成位于 `packages/scene-runtime/src/render-style.ts`，材质适配位于 `toon-surfaces.ts`。

## 开源实现与材质

2026-09-23 查询 GitHub：

| 项目 | Star | 许可证 | 用途 |
| --- | ---: | --- | --- |
| [Three.js](https://github.com/mrdoob/three.js) | 115,790 | MIT | 已采用官方 `MeshToonMaterial` 和 gradient map 配置 |
| [pmndrs/postprocessing](https://github.com/pmndrs/postprocessing) | 2,862 | Zlib | 已采用 `OutlineEffect`、`ToneMappingEffect` 和 composer；6.39.5 支持项目使用的 Three.js 0.170 |
| [pmndrs/drei](https://github.com/pmndrs/drei) | 9,886 | MIT | React Three Fiber 辅助库，当前原生 Three.js 场景无需增加 R3F 依赖 |
| [THREE-CustomShaderMaterial](https://github.com/FarazzShaikh/THREE-CustomShaderMaterial) | 1,337 | MIT | 适合扩展自定义 GLSL；本次直接使用成熟材质，因此未引入 |

旧的屏幕颜色量化与颜色差描边 Shader 已移除。墨线卡通采用较少光照层次和细棕色几何轮廓；柔和卡通增加光照层次、减轻轮廓。描边来自模型遮罩，不把木纹识别为边线。后处理使用半浮点缓冲和一次色调映射，保留透明背景。

木鱼卡通模式按“插画玩具”方向设置涂装底色，停用密集的木纹 albedo 和微法线，降低 AO 强度。通过 `mesh.userData.toonSurface = { color, simplifyMap: true, aoIntensity }` 指定场景美术参数。原贴图和 GLB 不做永久修改；每帧结束恢复原材质，切回原始光照或效果失败时即可恢复原 PBR 表现。透明水面、接触阴影和粒子保留各自材质。材质缓存、轮廓选择和 GPU 资源随风格切换及场景卸载释放。

历史面板浏览器回归脚本已移除，原测试与结果可从 Git 历史查阅。木鱼渲染测试 `scripts/test-woodfish-style.py` 保留。

可调参数回归：`node scripts/test-shader-parameters.mjs`，默认 `http://127.0.0.1:5173/`，支持 `WBR_URL`。目前保留真实 WebGL 参数效果、透明度和重复调整的纹理数量检查；已移除停用面板的操作步骤，正式菜单操作由上述 App 测试负责。
