# 柔和 3D 仪式图标

已由用户在 2026-10-31 确认六种仪式的预览风格，生产图使用内置 image_gen 生成。统一柔和立体体积、暖色漫射光、清楚轮廓；保留纸、木、布、玻璃、金属的不同材料身份。

- 生产文件：158 个 `<scene-id>.webp`，256×256，保留连续 alpha。用于现有 SceneIcon / SceneBadge / SceneArt 的全部 ID，含 67 个历史兼容条目。
- 规格：以 alpha>32 的视觉主体为中心，最长边 224–225px，周围透明留白。正常手机显示为原有 28–66px 槽位。
- `subjects.json`：当前标题、器物描述、可见性清单。它记录产品呈现，不是传统事实证据。
- `sources/`：各物件未修改色彩/alpha 的生成源切片与精确裁切、校验和、历史归档。
- `atlases/`：未重绘的原生成透明图集；`manifests/` 保留提示词、格子与修复记录；`references/` 为原图标几何核对资料。构建仅打包顶层生产 WebP。
- 已选风格参照：`assets/design-previews/ritual-soft3d-samples-v1.png`。

生成时使用规则九宫格统一同批光照，按透明间隙裁成单物件，不使用色键去背景。每项最终器形/数量/状态均与现有图标及适用的当前场景核对；修正了混入方孔钱币、单眼玩具、七巧板多片、绳环断开、错字形、竹管误成风铃等生成偏差。最终图只承担装饰性 UI 作用，不添加来源、寓意、操作或效力主张。

维护命令：

```powershell
node scripts/prepare-scene-soft3d-icons.mjs import-atlas assets/scene-icons/soft3d/manifests/batch-01.json
node scripts/prepare-scene-soft3d-icons.mjs rebuild
node scripts/prepare-scene-soft3d-icons.mjs verify
node scripts/prepare-scene-soft3d-icons.mjs contact-sheet
node scripts/prepare-app-assets.mjs
```

独立单图通过 `import <id> <source.png>` 导入。重新生成须遵守 `docs/scene-provenance.md`，尤其不得让模型擅加文字、图纹、文化部件或改变器物状态。完整核查与技术验证见 `docs/research/2026-10-31-soft3d-scene-icons.md`。
