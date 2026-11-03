# Soft Garden v1

用户试听确认后的十段原创产品音效，来自 [本地合成配方](../../../design/audio/soft-garden-v1/generate.mjs)。不含外部采样或游戏音频。素材以软木、气泡和短旋律为设计意象，不对应传统或宗教音乐。

进入、返回、选择、展开、收起、开关、保存、收集、完成统一使用本套文件；预留 `notice` 复用 `select`。材质交互仍由共享材质合成器处理。

```powershell
node assets/ui-sounds/soft-garden-v1/build.mjs
node scripts/prepare-app-assets.mjs
```

构建只依赖仓库内生成器，无下载或模型服务。保持试听版音色、时序和相对动态，统一乘以 0.45 作为 App 操作反馈电平。48 kHz、单声道、16-bit PCM，十段共 382,520 字节。单段 160–930 ms；首尾样本为零。

`manifest.json` 保存生成器哈希、对应试听版哈希和实际输出哈希。`UI_SOUND_FILES` 为 Web、Expo 和调试提示共享路径；两宿主离线清单校验同一组实体。旧 Kenney 素材与构建文件已按用户要求删除，历史版本保留在 Git 记录中。

检查：`node --test scripts/bundled-app-assets.test.mjs`、App 音效测试、`node scripts/verify-ui-audio.mjs` 和 `node scripts/verify-audio-inspector.mjs`。自动检查覆盖格式、幅度、解码、交互与生命周期；本轮用户试听认可的是原始试听稿，手机扬声器仍需实机听感确认。
