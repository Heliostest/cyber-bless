# 场景环境素材

现有 51 个场景共享自然道具与天空资源，按场景配置庭院、泉边、木廊、手作桌或河岸。日景使用浅蓝渐变天空、柔绿草坡、暖木前景和两侧树木，中央留给交互物件；雾只用于远景，庭院弯路与少量边角花丛提供层次。默认 `toon-soft` 使用 Three.js 哑光 `MeshStandardMaterial` 保留体积与柔和接触阴影；调试页的 `toon-ink` 保留原有色阶。主体原有几何、手势与步骤保持。

- Kenney [Nature Kit](https://kenney.nl/assets/nature-kit)：五个 CC0 源模型保存在 `source/kenney/`。运行 `node scripts/prepare-nature-props.mjs` 重建带平滑法线的精简几何数据。
- Poly Haven [Kloppenheim 06 天空](https://polyhaven.com/a/kloppenheim_06_puresky) 与 [Kloppenheim 02 夜空](https://polyhaven.com/a/kloppenheim_02_puresky)：原始 1K HDR，约 1.12 MiB 与 1.33 MiB。日间 HDR 只提供柔和环境光，可见天空由本地生成的 4×64 渐变纹理绘制；夜间仍使用适度模糊和压暗的 HDR 背景，突出灯火。
- 两个天空和许可由 `prepare-app-assets.mjs` 同步到 Web 与 Expo DOM 的 public 目录；体验时使用本地路径，不请求外部素材网站。HDR 读取失败仍保留环境几何、日间渐变天空或夜间底色。
- 各场景实例拥有自己的几何、材质、渐变和 HDR 纹理；退出立即释放，迟到的纹理也会释放。停止或减少动态效果沿用现有宿主管理。

完整来源及改动记录见 [LICENSE.txt](LICENSE.txt)。截图验证工具：`node scripts/preview-cozy-scenes.mjs`，输出到 `artifacts/cozy-scenes/after/`。
