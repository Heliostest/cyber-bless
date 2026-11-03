# Soft Garden v1 — 原创合成试听

方向：轻巧、圆润、带软木和气泡质感的生活模拟游戏操作反馈。用户希望参考《动物森友会》的温暖感；本试听包使用原创振荡器、衰减包络和确定性噪声，不包含游戏录音、采样或已有旋律。

使用本地 Node.js 生成，不需要网络、模型、插件或额外依赖：

```powershell
node design/audio/soft-garden-v1/generate.mjs
```

输出到 `artifacts/audio-design/soft-garden-v1/`：十个单独的单声道 48 kHz / 16-bit PCM WAV、整套串听 `00-full-preview.wav`、带独立播放器和下载链接的自包含 `index.html`、记录配方与声学指标的 `manifest.json`。页面可以直接在浏览器打开。

| 音效 | 听感目标 |
| --- | --- |
| navigate / back | 高低成对的软木音，区分进入与返回 |
| select | 更短、更轻，适合连续切换 |
| open / close | 两颗方向相反的小木音 |
| toggleOn / toggleOff | 高低成对的弹性气泡 |
| saved | 两音落定 |
| collect | 短促上扬的小奖励 |
| complete | 稍长的原创完成动机 |

音色由阻尼正弦模态、轻微音高弯曲、低通滤波和极少量早期反射组成。每个文件首尾归零；生成器验证有限值、峰值和边缘，清单记录 PCM 指标与 SHA-256。这些检查不替代主观试听。

该试听稿已获用户确认并要求接入应用。试听导出保留原电平；App 使用 `assets/ui-sounds/soft-garden-v1/build.mjs` 从相同配方导出 0.45 倍振幅的版本。`renderSounds(gain)` 可复用生成结果，导入模块不会写文件。
