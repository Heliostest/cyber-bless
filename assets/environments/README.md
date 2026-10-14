# 场景环境素材

现有 59 个场景共享自然道具与天空资源，按场景配置庭院、泉边、木廊、手作桌或河岸。日景使用明亮蓝天、方向明确的阳光和五段柔和色阶；环境保留连续哑光着色，主体保留各自的织物、陶土、木材和釉面差异。花园使用成组花草和不同树冠，庭院弯路带疏落石径，河岸使用岸边植物和石块；中央留给交互物件。夜间仍保持原有灯火布置。

- Kenney [Nature Kit](https://kenney.nl/assets/nature-kit)：精选 CC0 源模型保存在 `source/kenney/`。运行 `node scripts/prepare-nature-props.mjs` 重建精简几何数据，源文件与哈希记录随模型保存。原有五个道具沿用平滑法线，新增道具保留各自的源法线。
- Poly Haven [Kloppenheim 06 天空](https://polyhaven.com/a/kloppenheim_06_puresky) 与 [Kloppenheim 02 夜空](https://polyhaven.com/a/kloppenheim_02_puresky)：原始 1K HDR，约 1.12 MiB 与 1.33 MiB。日间 HDR 只提供柔和环境光，可见天空由本地生成的 4×64 渐变纹理绘制；夜间仍使用适度模糊和压暗的 HDR 背景，突出灯火。
- 两个天空和许可由 `prepare-app-assets.mjs` 同步到 Web 与 Expo DOM 的 public 目录；体验时使用本地路径，不请求外部素材网站。HDR 读取失败仍保留环境几何、日间渐变天空或夜间底色。
- 各场景实例拥有自己的几何、材质、渐变和 HDR 纹理；退出立即释放，迟到的纹理也会释放。停止或减少动态效果沿用现有宿主管理。
- 日间重复植物按模型部件合批为 `InstancedMesh`，各场景的布置由场景 ID 稳定决定；退出时单独释放实例缓冲。布置测试检查实际模型包围盒避开中央交互空间，浏览器检查完整渲染与退出后的 GPU 资源。

2026-10-14 素材选型：还比较了 [Quaternius Stylized Nature MegaKit](https://quaternius.com/packs/stylizednaturemegakit.html) 和 [KayKit Forest Nature Pack](https://kaylousberg.itch.io/kaykit-forest)。两者的官方页面均列有 CC0 素材及免费档。Quaternius 的细密贴图植被适合更大幅度的场景升级；KayKit 使用共享渐变图集。本次采用 Kenney 的少量补充模型，与现有手作主体的简洁造型保持一致，也可直接沿用本地几何管线。另两套未随应用分发。

完整来源及改动记录见 [LICENSE.txt](LICENSE.txt)。截图验证工具：`node scripts/preview-cozy-scenes.mjs`，输出到 `artifacts/cozy-scenes/after/`。
