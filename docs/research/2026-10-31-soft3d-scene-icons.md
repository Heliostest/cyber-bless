# 仪式图标柔和 3D 风格落地核查

核查日期：2026-10-31。用户先确认 `assets/design-previews/ritual-soft3d-samples-v1.png` 的六物件风格，再明确授权替换全部仪式图标。范围是共享 SceneIcon 的 158 个 ID（当前可见 91，历史兼容 67）。

## 实际改动

原手绘平涂 SVG 换成独立的 256×256 透明 WebP，沿用 SceneBadge / SceneArt 及 Animal Island 现有槽位、配色、边框和圆角。图像统一柔光、柔和立体明暗与视觉占幅；纸、木、玻璃、陶、织物和金属身份分别保留。全部生产图共 7,368,868 bytes，约 7.03 MiB。原 PNG、原图集、提示词及精确裁切记录存于 `assets/scene-icons/soft3d/`；EAS 和离线 App 仅带顶层生产 WebP。

图片使用空 alt、aria-hidden，避免重复朗读标题。未知 ID 保留原叶子后备；已知图像失败也回退叶子，切换 ID 后可重新加载，避免失败时无限请求。Web、Expo DOM 和离线资源沿用 assetUrl 与原打包链。

## 来源影响与实物核对

本次已阅读 `AGENTS.md` 和 `docs/scene-provenance.md`，并逐项对照旧 SVG、当前宿主标题、适用的当前场景 README/实现，形成 `subjects.json`。这些本地资料用于核对本产品正在呈现什么，不作为新增传统事实证据。本轮未重新阅读外部文化来源，不把既有来源卡的访问状态写成已于本日重新核验。

未新增起源、节期、资格、数量规则、效力或寓意；图标中的物件数仅保持原产品简化。场景操作、完成条件、文化介绍、source slug、注册表、metadata、原生标题、技术 ID、引擎和存档未改。无须为了 UI 贴图重绑来源或改写传统资料。宿主标题与 158 项 ID 清单已核对一致。

人工图像审阅与技术检查分别执行。生成初稿出现的方孔币、门柱金星、单眼玩具头、错误木鷽器形、断绳、多片七巧板、少壳贝链、竹管误成风铃、蜻蜓支点与新增装饰等均重生成修正；供杯邻格叶片碎片以精确裁切移除。必要原字形保留，未把真实宗教语境改成普通装饰。香炉采用当前场景的单支细香，未延续旧 SVG 两支香的偏差。来源分类与文化说明保持原值。

## 核查清单

- [x] 实际器物、部件、材质与状态逐项对照；生成结果不反向证明传统。
- [x] 无新增文化主张；无需补造外部来源或变更访问状态。
- [x] 无地域、社群或视觉相似式错绑；来源绑定均未改变。
- [x] 无新增寓意、规则、起源、期限或节期；保留真实文化背景。
- [x] 生产视觉属产品表达；原生成图、提示词、审核清单和修复记录可复核。
- [x] 宿主、注册表、metadata、原生标题、ID 与存档分类保持一致；相关展示与测试已同步。
- [x] 用户可见介绍、提示和结束语均未改；图标不承载新增文字主张。
- [x] 素材校验、相关测试、构建、双端拷贝及真实浏览器验收分开完成。

## 技术验证

- `node scripts/prepare-scene-soft3d-icons.mjs verify`：158/158，0 errors、0 warnings；视觉主体最长边 224–225px，保留连续透明度，无不透明源背景。
- `node --test scripts/prepare-scene-soft3d-icons.test.mjs`：8 项通过，覆盖玻璃透明度、远端极淡像素、图集精确裁框、透明间隙裁切及源图保留。
- `npm run test -w @wbr/app -- src/scene-icons.test.ts src/scene-catalog.test.ts src/assets.test.ts`：37 项通过；集成阶段其他受影响的样式、资源及展示测试亦已通过。
- 生产构建通过，保留原有大分块提示。158 个源 WebP 与 Web public、Expo public、dist 哈希一致，报告见 `artifacts/soft3d-scene-icons/asset-copy-report.json`。
- 生产浏览器检查 320 / 390 / 1440px，共 16 路由状态、19 张截图；目录 91 个图标和历史收藏 158 个唯一 ID 均正常加载，无图像请求失败、404、页面异常或槽位溢出。报告见同目录 `browser-report.json`。
- 全量 App 测试仍有 43 项 `hourly-scene-lifecycle.test.ts` 失败，其依赖为当前工作区的场景交互实现，与图像组件、素材映射及打包检查分开记录。未为本轮图标修改这些场景。完整列表在同目录 `known-app-test-failures.json`；全量结果是 1262 passed / 43 failed，不能表述为全套通过。

最终截图：`artifacts/soft3d-scene-icons/390-today.png`、`390-catalog.png`、`390-wish-picker.png`。原生 widget 使用独立 Three.js 场景封面，不引用这套 UI 图标，因此本轮没有把封面替换成另一套素材。

## 提交前旧生产图标清理

用户随后明确要求提交、合并、推送并删除旧图标。补查历史 `woodfish` / `crane` / `lantern` 收藏与旧奖励飞行，将这些入口也映射到对应 SceneArt；删除 Art 中三套旧裁切和 `assets/reference-ui/rituals.png`，同步移除运行时、打包与现行版权校验中的旧图读取。纪念章 `wishes.png`、木鱼模型/贴图及原生 widget 封面继续使用；生成参考与审阅历史保留。

历史 kind 兼容回归与相关测试通过；独立 Chromium 验证 60px 奖励飞行中图像保持 78% 居中、无溢出。为排除工作区其他场景改动，在 `origin/master` 的干净隔离工作区运行 App 基线：46 文件、1310 项全部通过，前述 43 项生命周期失败未出现。本次提交只包含图标及旧生产图清理，不包含其他未提交场景改动。

## 同日清理旧仪式拼图

用户要求删除旧图标后，再次追查发现历史 `woodfish` / `crane` / `lantern` 收藏和奖励飞行仍走旧 `Art` 裁切。这三种旧 kind 现映射到对应的 `SceneArt`，保留原存档结构；纪念章继续由 `Art` 裁切 `wishes.png`，全局 `Icon` 保持。已删除 `art.tsx` 的仪式裁切和无调用的旧变体，以及 `assets/reference-ui/rituals.png`，同步移除打包和 iOS 源归档必需输入；版权校验只核对当前资源清单仍随包的参考图，旧授权事实与 Apple 回执不改。

此清理不改变场景器物、动作、文化文案、来源或模型/贴图；沿用本记录既有来源影响审阅。图标生成参考和历史源归档保留，未删除。新增回归先观察到 7 项预期失败，再确认历史收藏陈列/详情、奖励飞行与退役资源清理正确；纪念章兼容用例同步通过。六文件 83 项相关测试、i18n 校验与生产构建、木鱼网格/两套贴图/两版 GLB 检查通过。全量 App 为 1270 passed / 43 failed，失败仍限于先前记录的 `hourly-scene-lifecycle.test.ts`。重新生成的 Web public、Expo public 与 Web dist 中均不再存在旧 `rituals.png`。

## 小天地透明底显示

2026-10-31 按用户要求，移除小天地置物架、收藏卡片和收藏详情中 SceneArt 容器的底色、边框与阴影，让现有透明 WebP 主体直接显示。收藏卡片本身的可点击外框、其他页面的图标容器及独立纪念章裁切保留原样。逐张检查 158 张生产 WebP 均含透明像素；未修改图片、器物、动作、文案或来源分类，文化影响沿用本记录既有核查，未新增文化主张。

以实际样式表、生产图片及对应页面结构搭建独立浏览器核验，320 / 390 / 1440px 下共 6 个页面状态、30 处图标均为透明底，无边框阴影、图片溢出或横向滚动，槽位尺寸和收藏卡片样式保持原值。对照截图及报告存于 `artifacts/world-icon-transparency/`。该核验未启动完整应用：本地 npm 测试入口缺少 Windows 可执行 shim，直接运行 Vite 缺少 `@rollup/rollup-win32-x64-msvc`、Vitest 缺少 `@vitest/utils`，因此本次不将应用测试或生产构建登记为通过。
