# 场景环境素材

现有 59 个场景共享自然道具与天空资源，按场景配置庭院、泉边、木廊、手作桌或河岸。日景使用明亮蓝天、方向明确的阳光和五段柔和色阶；环境保留连续哑光着色，主体保留各自的织物、陶土、木材和釉面差异。草地带宽幅明暗图斑和随风摆动的草叶，圆润阔叶树与成组花草衬托石径和清浅水面；中央留给交互物件。夜间仍保持原有灯火布置。

- Kenney [Nature Kit](https://kenney.nl/assets/nature-kit)：精选 CC0 源模型保存在 `source/kenney/`。运行 `node scripts/prepare-nature-props.mjs` 重建精简几何数据，源文件与哈希记录随模型保存。原有五个道具沿用平滑法线，新增道具保留各自的源法线。
- KayKit [Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest)：日景使用两种 CC0 阔叶树，保留源模型、原始渐变图集和作者许可。`node scripts/prepare-tree-props.mjs` 校验来源哈希并生成顶点颜色几何；具体来源及镜像版本见 [trees/README.md](trees/README.md)。Kenney 继续提供灌木、花草、石块及夜间树木。
- 草地：本地生成明暗色块，实例化草叶接收阴影并随风轻动。草叶弯曲与根尖着色参考并改编自 MIT 开源项目 [boona13/threejs-grass-water-shaders](https://github.com/boona13/threejs-grass-water-shaders)，完整许可与改动说明在 [meadow/](meadow/README.md)。
- 水面：四处水体使用透明物理材质、缓慢交错波纹及水底风格化焦散光纹，是本项目实现；不含光学折射或物理焦散模拟。开源方案比较和接入说明见 [water/README.md](water/README.md)。
- 家具：21 个功能性手作桌增加圆角拼板、木纹、木销和不同支架，保持原台面尺寸与高度。程序几何由本项目编写，Kenney 与 KayKit 家具仅作视觉参考，见 [furniture/PROVENANCE.md](furniture/PROVENANCE.md)。
- Poly Haven [Kloppenheim 06 天空](https://polyhaven.com/a/kloppenheim_06_puresky) 与 [Kloppenheim 02 夜空](https://polyhaven.com/a/kloppenheim_02_puresky)：原始 1K HDR，约 1.12 MiB 与 1.33 MiB。日间 HDR 只提供柔和环境光，可见天空由本地生成的 4×64 渐变纹理绘制；夜间仍使用适度模糊和压暗的 HDR 背景，突出灯火。
- 两个天空、来源说明、草地 MIT 与树木 CC0 完整许可由 `prepare-app-assets.mjs` 同步到 Web 与 Expo DOM 的 public 目录；体验时使用本地路径，不请求外部素材网站。HDR 读取失败仍保留环境几何、日间渐变天空或夜间底色。
- 各场景实例拥有自己的几何、材质、渐变和 HDR 纹理；退出立即释放，迟到的纹理也会释放。停止或减少动态效果沿用现有宿主管理。
- 日间重复植物按模型部件合批为 `InstancedMesh`，各场景的布置由场景 ID 稳定决定；退出时单独释放实例缓冲。布置测试检查实际模型包围盒避开中央交互空间，浏览器检查完整渲染与退出后的 GPU 资源。

2026-10-14 素材选型：第一轮采用 Kenney 补充花草和河岸；本轮进一步选用 KayKit 的饱满树冠。还评估了 [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html)，但未分发其素材。水面评估过基于 WebGPU/TSL 的 [norio/three-stylized-water](https://github.com/norio/three-stylized-water) 及物理焦散示例，最终在现有 WebGL 管线实现轻量的浅水视觉，具体取舍见水面文档。

完整来源及改动记录见 [LICENSE.txt](LICENSE.txt)。截图验证工具：`node scripts/preview-cozy-scenes.mjs`，输出到 `artifacts/cozy-scenes/after/`。
