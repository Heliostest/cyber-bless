# Gallery 可选视觉预设接入

核查日期：2026-10-28。用户选择沿用现有「视觉风格」菜单，增加独立预设。本轮不扩展为材质与后处理自由组合。

## 实际接入

保留原有 8 项，新增 8 项，共 16 项。新项沿用当前场景／全部场景应用、参数调整、实时场景缩略图、取消草稿、保存及重新打开恢复。

| Gallery 对照效果 | 新预设 ID | 本产品实现与边界 |
| --- | --- | --- |
| Toon Material | `gallery-toon` | 原受光材质明暗分层、弱轮廓光；保留纹理、顶点色与原光学补丁 |
| Waterfall Hatching | `pencil-hatch` | 世界坐标三平面铅笔排线，暗部交叉排线，保留原色；不依赖 UV |
| Cartoon Ride terrain | `height-palette` | 按实际不透明网格世界高度范围归一化，固定五档配色；不增加峡谷／道路等演示几何 |
| Fractal Land normals | `normal-palette` | 世界法线朝向配色与原色混合；不引入分形地形、音乐或原作场景 |
| Sketch Contour | `sketch-contour` | 主体纸色填充、静态细微纸纹与手绘轮廓；保留主体以外的原场景 |
| Toon Outline | `gallery-outline` | 主体法线／深度外轮廓、折角线及保色相的亮度分阶 |
| Space Grade | `space-grade` | 全画面小半径柔光扩散、暗角和静态颗粒；非阈值 Bloom，无时间闪烁 |
| Depth Rim | `depth-rim` | 方向可调的深度边缘光与深色细轮廓；以实际场景深度阻止遮挡物后面的漏线 |

四种表面风格仅临时适配不透明受光网格。透明／透射、alpha 裁剪、Basic／Shader、文字卡片与粒子保持原材质管线；同一网格含这些材质槽时整体保留。表面风格保留 authored maps、双面与多材质组，继承 Three 的蒙皮、morph、instancing 和 batching 着色片段，不改变几何或命中区域。`toonSurface.outline:false` 仅控制轮廓选择，仍允许表面风格。

后处理复用现有 composer 与主体法线预渲染，按宿主 CSS 尺寸和 DPR 处理，只实例化当前预设。保持既有 ACES 色调映射，最终 pass 进行一次显示颜色转换；颜色目标、法线深度目标与材质分别由其创建者释放。缩略图使用相同真实渲染路径并恢复主画面。

高度配色不读取图库卡通的色阶参数，避免不同预设间的隐藏依赖和缩略图缓存失效遗漏。所有新效果均为静态着色，不自行推进仪式动画或装饰时钟。

## 本轮未作为通用预设接入的效果

| 效果 | 具体原因与后续接入条件 |
| --- | --- |
| Toon Water | 连续 UV、水面细分与时间驱动波浪依赖实际水网格；应与既有 stylized-water／ritual-optics 按部件适配 |
| Toon Fire | 需要火焰卡片／条带、透明混合与指定 UV；不能替换实体器物 |
| Egyptian Parallax | 天空、山丘、金字塔、仙人掌是专用分层背景几何；直接引入会改变仪式的空间与文化呈现 |
| Toon Cloud | 专用透明分层平面，且改编材质明确保留 CC BY-NC-SA 4.0，未作为本应用的发布依赖 |

以上条目没有隐藏的未启用运行时代码或另行下载资源。

## 代码来源与读取范围

已实际阅读本机 `D:/ws/art/shader/shader-gallery/src/three-materials/` 工厂、参数、渲染器，以及 12 个 `src/cases/three-*/ATTRIBUTION.md` 的相关正文。读取状态为 **本地改编实现与声明已读**，不是远程 Shadertoy 原作正文或网络授权审查。

- Toon Cloud 本地声明明确保留 Antoine Clappier 的 CC BY-NC-SA 4.0。
- 其他 11 个本地声明说明归档原作没有显式授权，不增加再分发权；这些声明不能用作本应用复制原作的授权。
- 本轮 `gallery-surfaces.ts` 和 `gallery-effects.ts` 是在现有 Three r170／postprocessing 管线中独立实现的通用着色算法，没有导入 Gallery 或 Shadertoy GLSL、纹理、演示网格、音频或 Gallery 运行时依赖。与 Gallery 的对应是视觉功能对照，不宣称逐像素移植或复制原作。
- 没有更换 Three 版本或新增运行时包依赖。

## 场景来源与文化影响核查

实际器物、传统材料身份、器形、纹样数据、动作、对象、场合和完成条件沿用各场景。新增变化是用户可选的配色、光照分层、排线与屏幕轮廓表达，不将其解释为传统材质、工艺或仪式要求。现有来源关联沿用[2026-10-19 场景来源审阅](2026-10-19-scene-culture-audit.md)及后续各场景记录；本轮不把这些旧记录作为新文化事实的证据。

与正在进行的[光学材质接入](2026-10-28-ritual-optics-integration.md)共存：保留原材质数据、光学编译钩子和共享纤维资源所有权。新表面风格是用户选择的视觉表达，不将彩色法线或纸墨滤镜改写为器物的真实物理材料。

按 [scene-provenance.md](../scene-provenance.md) 核对：

- [x] 实际实现不增加器物、动作、场合或完成条件。
- [x] 不新增文化主张、寓意、规则、起源或节期；无需编造或另查无关传统证据。
- [x] 不按视觉相似或同地区新增来源绑定。
- [x] 保留已有宗教、求愿及其他经核查语境，不重定义为纯装饰或自省。
- [x] 本记录区分产品新增视觉表达和已有传统事实；读取范围如实记录。
- [x] 来源卡、场景 README、宿主目录、注册表、metadata、原生标题无需改动，因为本轮没有修改这些内容；技术 ID、引擎和仪式进度存档保持兼容。
- [x] 场景介绍、提示、状态和结束语不变；仅新增中性的视觉效果名称／参数及八语翻译。
- [x] 技术测试、构建与浏览器显示验证结果见下段；技术检查不替代文化事实审阅。

## 验证

- `npm.cmd test` 完整通过：i18n 22 项包测试及 20 项脚本测试、core 82、runtime 12、App 1150、gestures 55、shared 3、scenes 9437（269 文件）、content 37、scene-runtime 190；末尾木鱼及 Blender 模型资产检查通过。完整输出：`artifacts/gallery-visual-styles-2026-10-28/full-test.log`。
- `npm.cmd run build` 通过，包括 i18n 提取／审阅／生成物验证、TypeScript 和 Vite 生产构建。保留既有大包提示，没有因此调整打包或依赖。日志：`artifacts/gallery-visual-styles-2026-10-28/build.log`。
- 真实浏览器：`$env:WBR_URL='http://127.0.0.1:5182'; node scripts/verify-gallery-visual-styles.mjs`。Chromium 151、Three r170、SwiftShader WebGL，5 场 × 原图与 8 新预设，共 **45/45** 渲染通过；实际风格均匹配请求，shader link／无效 program／空白黑帧／page／console 错误均为 0。底层场景覆盖纸鹤、玻璃风铃、纸灯笼、七碗水、天主教烛火；底层测试不改变目录可见性，`lantern` 仍按现有隐藏策略处理。
- 真实 App 的 390×844 视口验证：**16 张真实场景缩略图**全部生成；新预设参数预览不写入存档，关闭取消草稿；柔光局部保存及 reload 恢复参数；返回目录后切到公开的风铃，另一场景保留独立偏好，保存新风格后两场均正确。没有场景加载或 shader 错误。
- 独立审阅发现的两项问题均先用回归测试复现再修正：无描边主体仍适配表面；高度色阶与其他预设参数隔离。浏览器另复现了 GLSL 保留字 `flat` 引起的法线描边回退，改名后整套 45 帧和 App 缩略图验证通过；首轮错误保留于 `initial-failed-report.json`，不作为最终通过结果。
- 已人工查看纸墨纸鹤、夜间灯笼排线与最终八预设对比图。最终报告、截图与拼图位于 `artifacts/gallery-visual-styles-2026-10-28/`，其中 `report.json` 与 `README.md` 是最后的通过结果，`new-styles-preview.png` 是交付对比图。

本轮没有测量 iPhone／WebView 真机的 FPS、GPU 时间或功耗；桌面软件 WebGL 的通过结果不代表移动设备性能结论。计划见[实施记录](../superpowers/plans/2026-10-28-gallery-visual-styles.md)，翻译见[多语言接入记录](2026-10-28-gallery-shader-i18n.md)。
