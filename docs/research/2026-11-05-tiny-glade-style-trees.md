# 接近 Tiny Glade 气质的树木方案

核查日期：2026-11-05。本次只研究与记录，没有修改场景、依赖、素材或文化来源。已阅读 `AGENTS.md` 与[场景来源规范](../scene-provenance.md)；以下“接近 Tiny Glade”是美术方向判断，不是声称获得了 Tiny Glade 的素材或实现。

## 结论

优先看 **Just a simple tree**：它明确采用“叶卡＋叶簇法线＋冠内 AO”，比把树冠换成更多低多边形团块更符合柔软、茂密、有细枝的目标。若希望直接挑选现成资产，选 **Quaternius Stylized Nature MegaKit**；若希望保留程序化形态控制并贴近当前 Three.js 版本，选 **EZ-Tree**。

| 方案 | 类型与许可 | 适合本项目的路线 | 主要代价 |
| --- | --- | --- | --- |
| [Just a simple tree](https://github.com/MikeFernandez-Pro/just-a-simple-tree) | MIT 开源生成器；代码绘制叶纹 | 离线生成数种 GLB，保留叶卡、法线和顶点色，再接现有 WebGL | cel 材质、风和 LOD 切换需要在宿主接入 |
| [Quaternius MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) | CC0 素材包；免费 Standard 是完整包的一部分 | 从 glTF 挑选现成树，统一叶片材质与光照 | 宣传图的风格 shader 属 Unity／Unreal／Godot 工程，Three.js 需适配 |
| [EZ-Tree](https://github.com/dgreenheck/ez-tree) | MIT 开源 Three.js 生成器 | 固定 seed／预设，离线导 GLB，或取几何后沿用实例化 | 默认外观偏自然主义，柔和卡通光照需要调整 |

## 1. Just a simple tree：风格首选

[在线编辑器](https://justasimpletree.com/) · [作者动图预览](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/docs/tree.gif) · [README](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/README.md)

作者正文说明：有橡树、松树、柏树、垂柳、灌木及枯怪树六种；细枝延伸到每个叶簇，叶卡借用簇的法线形成整体柔和明暗，提供枝条摆动、叶片 flutter、季节、年龄、LOD 和 impostor。这些结构与目标相符；最终是否达到所需气质，还要用本项目镜头和光照看样树。[依据：Features、Exporting](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/README.md#features)

GLB 使用普通 `MeshStandardMaterial`，双面 alpha-mask 叶卡保留簇法线与顶点色渐变／AO。**GLB 不含风、草地或落叶**；README 另给 WebGLRenderer 与 WebGPURenderer 两种 cel 材质代码，LOD 的 `MSFT_lod` 数据在 Three.js 中也需要建立切换逻辑。编辑器依赖 `three ^0.186.1`，不能据此断言整套源码直接兼容项目的 0.170；先离线导 GLB 更容易控制改动范围。[导出与宿主接入](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/README.md#exporting)、[依赖](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/package.json)

代码为 [MIT](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/LICENSE)，保留版权及许可声明。叶纹由代码生成；用户另行拖入的图片按图片自身授权处理。仓库音乐、whoosh／pop 为 Pixabay Content License，不能笼统归入 MIT；本项目若只使用生成器及树模型，无需携带这些音频。[许可范围与 Credits](https://github.com/MikeFernandez-Pro/just-a-simple-tree/blob/main/README.md#license)

## 2. Quaternius：现成素材首选

[作者介绍与预览](https://quaternius.com/packs/stylizednaturemegakit.html) · [下载与版本](https://quaternius.itch.io/stylized-nature-megakit)

作者将完整套装定位为 Ghibli-inspired，列出 116 个自然模型、其中 40 棵树，叶片可换 7 种，提供 glTF／FBX／OBJ／Blend；资产标注 CC0，可用于商业项目。这是素材授权，不是 Three.js 开源生成器。模型和纹理仍应随实际下载包留存来源与许可证。[作者正文 Features](https://quaternius.com/packs/stylizednaturemegakit.html)

免费 Standard 约为完整套装的 60–70%，不能把“40 棵树／116 模型”都写成免费版内容。2026-11-05 itch 页面列 Pro 9.99 美元、Source 14.99 美元；Source 附带 Unity URP、Unreal、Godot 风与风格化 shader，未列 Three.js。判断：它适合快速得到美术统一的树形，但 glTF 导入后仍需重建目标叶片明暗及风，不能保证直接出现宣传图效果。[版本及售价](https://quaternius.itch.io/stylized-nature-megakit)、[版本差异](https://quaternius.com/packs/stylizednaturemegakit.html)

## 3. EZ-Tree：程序化与版本兼容备选

[编辑器](https://eztree.dev/) · [仓库与预览](https://github.com/dgreenheck/ez-tree)

官方提供 npm 库与网页编辑器，可导 PNG／GLB；能控制种子、分枝级数、弯曲、叶片数量／大小／颜色、single／double billboard 与 alphaTest。当前 README 还描述从相同骨架生成 LOD，并能用 `createGeometry()` 提取枝干／叶片几何，方便接入自有实例化系统。[README](https://github.com/dgreenheck/ez-tree/blob/main/README.md)

`package.json` 的 peer dependency 是 `three >=0.167`，项目的 `^0.170.0` 在其声明范围内；这只是版本声明吻合，尚未运行兼容性测试。仓库 [MIT](https://github.com/dgreenheck/ez-tree/blob/main/LICENSE) 需保留声明；本轮未逐张核对随包树皮／叶纹的原始作者和单独授权，不把代码许可当作任意外部纹理的授权。若进入实施，应检查所选资源及通知文件，或使用自制／明确 CC0 的叶纹。[包依赖](https://github.com/dgreenheck/ez-tree/blob/main/package.json)

## 与现有实现的关系及手机验证范围

本地 [stylized-trees.ts](../../packages/scene-runtime/src/stylized-trees.ts) 当前使用两种 KayKit CC0 树，把 atlas 烘为顶点色，以 `InstancedMesh` 批量绘制；风只是移动整块叶冠。项目 [scene-runtime/package.json](../../packages/scene-runtime/package.json) 使用 `three ^0.170.0`。因此关键变化是叶卡、细枝及光照表达，单改树冠轮廓很难改变当前观感。

适合的试验是先生成少量固定变体，沿用实例化，近处保留叶卡与簇法线，远处减少叶卡或用 impostor。手机需要实测透明叶片重叠的填充开销、阴影通道、纹理内存、树的屏幕占比与 LOD 切换；没有真机结果，本文不承诺帧率。上述接入建议是工程判断，尚未实现或跑分。

## 其他线索与读取状态

- [Tree It](https://www.evolved-software.com/treeit/treeit)：已读官网 Overview／FAQ，免费、可调 LOD、导出 FBX／OBJ，可出售自己制作的树；未见开源许可证，因此不作为“开源生成器”推荐，且 GLB 需中转。
- [Blender Sapling](https://extensions.blender.org/add-ons/sapling-tree-gen/)／[MTree](https://github.com/MaximeHerpin/modular_tree)：已读官方扩展页／仓库 README，属离线制作路线；前者 GPL-3.0-or-later，后者 Blender 插件 GPLv3、核心库 MIT。它们还需要叶片资产、风格材质和导出整理，本轮不优先于上述三选。
- `dklar/three-tree`、`gsimone/three-procedural-tree` 未核实为可用目标仓库，不凭名称推荐。Just a simple tree 官网通过文本浏览工具失访；EZ-Tree 的 `www.eztree.dev` 只读到加载页，未运行交互演示。两者已通过 GitHub 连接器及官方仓库读取相关正文／源码。Just 的 `docs/tree.gif` 已确认文件元数据，未实际播放。Quaternius 作者站及 itch 下载页已读相关正文。未下载付费包，也未做实际 GLB 导入或手机性能测试。

核查范围：工具／资产事实及许可分界；未变更任何场景器物、操作、文案、寓意或来源卡，场景文化主张核查不适用。本次交付仅此研究文件。
