# 框架定型后的架构评估：继续扩展 Three.js 互动场景

- 日期：2026-10-11
- 基线：`master` @ `0313ca9`（PR #24，今日主仪式嵌入 live 预览）；评估分支与 master 同一提交
- 依据：逐个阅读 `packages/*`、`apps/*` 源码与测试，以及 `docs/app-framework.md`、`docs/scene-content.md`、`docs/mobile-app.md`
- 本地验证：`npm test` 共 8 个包、501 项单测，加上木鱼资源检查，全部通过（本机 Node 20.19.2；仓库要求 ≥22.18，未在 22 上复跑）
- 未做真机或浏览器实测。涉及运行表现的判断均来自代码推断，文中已标注

## 结论

**不需要大重构，只需要小补强。** 现有的场景契约、生命周期宿主、程序化公共件、渲染风格和"每日—收藏—许愿/还愿—回看"闭环，已经足够支撑继续往上加程序化 Three.js 场景。App 壳、四个 Tab 和存档格式都不用动。

加场景前建议先做 4 件小事（P0，合计约 3 人日，粗估）：

1. 步数写进场景元数据。目前步数写死为 3，第一个非三步场景会提前结算。
2. 今日轮换改用"日序号"。现算法一年只有 19 个不同取值，池子到 20 个场景就会有场景全年不出现。
3. 场景注册收敛为一张描述表，并加一致性测试。新增一个场景目前要改 8 个文件、约 12 处。
4. 契约测试自动遍历注册表，让新场景自动获得最低质量线。

真正的瓶颈不在框架：

- 研究素材的齐备度不够：C 档 156 个候选中只有 2 个"文字齐备"（`docs/material-readiness/2026-10-04/README.md`）。
- 缺少真机性能基线。

---

## 1. 当前架构快照

### 1.1 包与依赖

```
apps/cyber-bless (Vite Web, localStorage, /dev 画廊)  ─┐
apps/mobile-expo (Expo 原生壳 → 'use dom' BlessingDom) ─┴─► @wbr/app (React DOM, Web/移动共用)
@wbr/app ─► core · runtime · content · scene-runtime · scenes · gestures · shared
@wbr/scenes ─► scene-runtime(debug-render-style) · gestures · shared · three
```

| 包 | 职责 | 备注 |
| --- | --- | --- |
| `packages/core` | 纯 TS 状态与 reducer：心愿、旧 2D 仪式 session、`sceneRecords`、`daily.scene`、`collectible.spend`、功德 ledger、存档校验 `restore` | 存档 v1，只用一个 key `cyber-bless:personal:v1` |
| `packages/runtime` | `createStore`：乐观更新、串行写入、失败重试；`Host`（read/write/haptic）抽象 | 与 React 无关 |
| `packages/content` | 目录/清单/租约（`catalog.ts`）、预算 LRU 缓存（`cache.ts`）、Web IndexedDB 与 Native 桥 IO | 根导出的 `Pack`/`createContentClient` 是木鱼专用 |
| `packages/scene-runtime` | `mountScene` 生命周期宿主、`createSceneRegistry`、toon 渲染风格、调试样式面板 | 不包含具体场景 |
| `packages/scenes` | 10 个程序化场景、`contract.ts`、`registry.ts`、`procedural-kit.ts`（399 行公共件） | 单个场景 406–595 行；120 项测试 |
| `packages/gestures` | drag / tilt / spin / gyro（含 iOS 授权与按钮回退）/ wishWrite | 43 项测试 |
| `packages/shared` | `SceneMeta` 类型、`assertSafeCopy` 文案红线 | |
| `packages/app` | 四 Tab 路由栈、场景目录/体验/预览、木鱼 GLB 引擎、奖励飞行层、`style.css`（4282 行） | 253 项测试 |
| `apps/mobile-expo` | 安全区、返回键、前后台、震动、AsyncStorage、场景文件缓存（`scene-cache.ts`） | 新场景不需要改原生；DOM 组件不支持 OTA |

### 1.2 四个 Tab 与场景入口

- **今日**（`packages/app/src/home.tsx`）：
  - 今日主仪式 `dailyPrimaryScene`：祈福、许愿两个池子交替，按日轮换。
  - 卡片内 live 预览 `DailyScenePreview`：只读、`inert`，离屏或后台时暂停。
  - 「小天地里再走走」：最多 3 张回看卡 `dailyCollectedPicks`，其中恰好 1 张许愿。
  - 旧 2D 会话的续接横幅。
- **心愿**（`pages.tsx` `Wishes` + `wishes.tsx`）：心愿生命周期；「祈愿」展开许愿小物选择器，用一场行走消耗小物来许愿；还愿也可以用小物。
- **小天地**（`pages.tsx` `World`/`CollectionDetail`）：收藏货架；场景小物可以回看（replay）。
- **我的**（`pages.tsx` `Me`/`History`）：场景目录、资源缓存、仪式时光（历史重开）、法务。场景目录只从这里进入。

内置场景共 11 个：木鱼加 10 个程序化场景。分布在 `scene-placement.ts`：

- 祈福池 6 个，许愿池 5 个。
- 夜间舞台 2 个（lantern、yeondeunghoe）。
- 10 个程序化场景都是 3 步。

### 1.3 一次场景"行走"的数据流

1. **打开**：入口调用 `useOpenScene(entry, visit)`（`scene-library.tsx:221`）。带 daily / vessel / wishId / replay 标志的访问，会先把 `sceneRecords[id].progress` 置 0。
2. **准备**：进入 `SceneExperience`（`scene-experience.tsx:536`），依次是 `supportsScene` 检查、`scene.visit` 写入存档、有 `manifestUrl` 时用 `library.open` 拿租约（下载、校验、缓存），然后进入 `LoadedScene`。
3. **挂载**，按引擎分两路：
   - 木鱼：`Woodfish`。输入由 React 按钮处理，引擎只负责画面。
   - 其他场景：`ProceduralScene` → `mountScene` → `proceduralEngine(id)` 适配器（`procedural-scene.ts`）→ `SceneModule.create(ctx)`。
4. **结算**：场景每完成一步调用 `ctx.onProgress(k)`，经 `checkpoint` 写入 `scene.progress`。当 `k >= sceneSteps(entry)` 时，按访问类型结算：
   - `daily.scene`：每天每个场景一次，给一个小物和 10 功德（`core/src/index.ts:391`）。
   - `collectible.spend`：许愿或还愿时消耗小物（`:424`）。
   - `ritual.scene`：旧仪式的还愿记录。
5. **完成反馈**：完成行（`scene-experience.tsx:363–511`）调用 `launchReward`，由 `RewardFlightLayer` 把小物（`SceneArt`，按 sceneId 取图标，没有就用叶子）从完成卡飞到小天地或心愿。随后 Tab 跳一下、显示 +1、读屏播报。
   - 飞行层放在按路由重建的 `<main>` 之外，换页不会打断动画。
   - 遵守减少动态效果设置。

> **2026-10-11 补记**：上文第 1 步只描述了带标志的访问。同日修复了不带标志的入口（场景目录、仪式时光场景卡）：原先它们以完成态打开、落在完成页，现改为「已完成则置 0 重走、未完成则续走」，与 `useOpenRitual` 对齐。规则全表见 [`scene-redo.md`](./scene-redo.md)。

### 1.4 两类引擎

| | 木鱼 `woodfish@1` | 程序化 `<id>@1` ×10 |
| --- | --- | --- |
| 位置 | `packages/app`（`woodfish-scene.ts` 592 行 + model/motion/input） | `packages/scenes/src/<id>/` |
| 资源 | GLB，本地优先，后台更新，内置兜底 | 几何体与振荡器音效全部写在代码里 |
| 输入 | React 按钮（`woodfish.tsx`）+ 控制器 `strike/movePointer` | 场景自己在 overlay 里建 HUD 和手势 |
| 渲染 | 按需渲染，DPR ≤ 1.75 | 活跃时常驻 rAF，DPR ≤ 2，默认 toon-ink |
| 失败 | 退回可敲击的 2D 图 | 显示错误页，可重试 |

---

## 2. 已经够扎实的部分

1. **生命周期宿主成熟**
   - `mountScene`（`packages/scene-runtime/src/index.ts`）统一处理：异步加载的取消、`create()` 同步失败、ready/failed 只报一次、页面可见性。
   - 适配器 `procedural-scene.ts` 补齐了：rAF 暂停、dt 上限 50ms（`:69`）、`webglcontextlost` 转 failed、`update` 抛错转 failed、非活跃时 `overlay.inert`（`:79`）。
   - 新场景零成本继承以上全部能力。
2. **场景契约小而纯**
   - `SceneModule { meta, create(ctx) }` 加 `SceneInstance { start, update(dt), dispose }`（`packages/scenes/src/contract.ts`）。
   - 场景不依赖 React 或 App；手势、文案校验、音效/震动、saveWish、stage 都从 ctx 注入。
   - 用 jsdom 加一个 mock 的 `WebGLRenderer` 就能跑行为测试（`five-scenes.test.ts:8–30`）。
3. **公共件够用**
   - `procedural-kit.ts` 覆盖：透明舞台、日/夜 cel 灯组、步骤 HUD、跟随 App 开关的音效/震动、射线拾取、对象触摸占用（其他区域仍可滚动页面）、尺寸与竖屏退镜、灯晕、`disposeTree`。
   - 一个 Design A 场景写 400–450 行就能完成。
4. **渲染风格统一且安全**
   - toon 用 `MeshToonMaterial` 加 pmndrs `OutlineEffect`，没有自写 GLSL。
   - 着色器失败时自动退回 original（`scene-runtime/src/render-style.ts`）。
   - `userData.toonSurface` 提供每个网格的美术提示；调试面板可以逐场景切换风格。
5. **手势库独立且有测试**：5 种手势共 43 项测试；陀螺仪已处理 Safari 只能在 click 中请求授权的限制，并有按钮回退。
6. **产品闭环按 sceneId 泛化**
   - `daily.scene` 幂等；收藏用 `kind:"scene"`；带 `wishScene` 的小物可以许愿或还愿；小天地可回看；奖励飞行按 id 取图标。
   - 新场景只要进入池子就自动参与全部闭环，`core` 不用改。
7. **内容分发与引擎解耦**
   - catalog / manifest / lease / 预算 LRU，并通过 `supports`/`validate` 注入（`content/src/catalog.ts:133–157`）。
   - 未注册的引擎在下载前就提示"需更新 App"（`scene-experience.tsx:577`）。
   - 存档对引擎版本变化做了防护（`core/src/index.ts:202`）。
8. **包体按场景切块**
   - `loadScene` 对每个场景做动态 import。
   - 2026-10-06 的 export-check 产物中，每个程序化场景块约 7–12 KB（纸鹤约 50 KB），three 和 postprocessing 在公共块里。
9. **复杂玩法能拆出纯逻辑**：纸鹤把折叠运动学与折痕数据拆成纯模块并单测（`crane/fold-kinematics.ts`），是后续复杂场景的好范式。
10. **文化与文案有护栏**
    - `assertSafeCopy` 在场景创建时校验。
    - 叙事 80–120 汉字、`traditionSlug` 必须指向真实的传统卡，都有测试（`ritual-narrative.test.ts`）。
11. **路由只渲染栈顶页**（`App.tsx:461–467`），同一时刻只有一个活动画布；dispose 时已调用 `forceContextLoss`。

---

## 3. 妨碍场景扩展的痛点、技术债与耦合

### 3.1 场景注册扇出：新增一个程序化场景要改 8 个文件、约 12 处，其中一环没有测试兜底

| 位置 | 内容 | 漏改的后果 |
| --- | --- | --- |
| `packages/scenes/src/<id>/index.ts` | meta + create | — |
| `packages/scenes/src/registry.ts:11` | `sceneRegistry` 再写一遍 meta | dev 画廊不显示；精确列表测试失败 |
| `packages/scenes/src/registry.ts:95`、`:114` | `IMPLEMENTED` 集合与 `loadScene` 的 switch | `scene not implemented` |
| `packages/app/src/scene-engines.ts:19–32` | `"<id>@1": () => proceduralEngine("<id>")` | **没有测试**；用户点开后才报 `Unknown scene engine` |
| `packages/app/src/scene-library.tsx:30–137` | `builtInScenes`：title / engine / traditionSlug / narrative 再写一遍 | 目录和今日都不出现；`supportsScene` 为 false |
| `packages/app/src/scene-placement.ts:13–36` | 祈福/许愿池、夜间舞台 | 永远不会成为今日主仪式；夜景场景用日间灯组 |
| `packages/app/src/scene-icons.tsx`、`style.css` | SVG 图标，`[data-scene]` candy 色（5 档变量） | 叶子占位，默认色 |
| 测试精确列表：`registry.test.ts:11–24`、`scene-placement.test.ts:74–92`、`:118–128`、`five-scenes.test.ts:53–62` | 每次都要手改 | — |

其他问题：

- 同一个标题有 4 份：`index.ts`、`registry.ts`、`builtInScenes`、场景内的 `COPY.title`。
- 带类型的注册表被调用方的强转架空了：
  - `scene-experience.tsx:75–80` 的联合类型只列了 5 个引擎，已经过期。
  - `daily-scene-preview.tsx:91` 又强转了一次。

### 3.2 步数写死为 3，完成信号有两套

- `scene-placement.ts:61–62` 写死 `sceneSteps = woodfish@1 ? 12 : 3`；`SceneMeta`（`packages/shared/src/types.ts:5`）没有 steps 字段；各场景的 `STEP_ORDER` 是私有的。
- 第一个 4 步场景走到第 3 步时就会出问题：
  - 已经触发 `daily.scene`（发小物和功德）或 `collectible.spend`。
  - 进度显示"3 / 3"，场景却还在继续。
  - `useOpenRitual` 的"已完成"判断也跟着错（`scene-library.tsx:200`）。
- 完成信号有两套：App 只看 `onProgress(k) >= steps`，`scene:complete` 事件只有 dev 画廊在监听。契约里没写清哪个才算数。

### 3.3 今日轮换算法跟不上场景数增长

- `scene-placement.ts:106–113` 用 `YYYY-MM-DD` 的字符编码之和做种子，一年内只有 **19 个不同取值**（已用脚本复算）。
- 按池子大小看（统计的是轮换位置，大致对应场景）：
  - 11 个（现状）：每个场景一年出现 27–36 天。
  - 15 个：12–36 天，明显不均。
  - 20 个起：有场景全年不会成为今日主仪式。
  - 30 个：11 个场景从不出现。
- 10-11、10-20、11-10 这三天的主仪式相同。
- `PRIMARY_ORDER`（`:116–118`）按下标交错两个池子；两池大小一旦失衡，"祈福/许愿交替"也会失效。
- `dailyCollectedPicks` 用的是同一个 `rotate`（`:157–161`），同样受影响。

### 3.4 今日预览没有"预览模式"

- `daily-scene-preview.tsx:78–84` 只是传入一个空操作的上下文。HUD 靠 CSS `display:none`（`style.css:3998–4000`）和 `inert` 隐藏。
- 场景照常建立全部 HUD、手势和 toon 合成器。
- 陀螺仪手势的 `enabled` 默认为 true（`packages/gestures/src/gyro.ts:33`）。在不需要授权的平台（Android），挂载时就开始监听 window 的 `deviceorientation`（`:98–101`、`:151–165`）。
- **按代码推断，未实机验证**：今日卡片上的「泉边一念」可能被"手机前倾再竖起"推进到第 2 步。不会写入存档，但画面会偏离"第一步"。
- 以后带自动推进、计时或音频的场景，都只能靠作者自觉做到"预览安全"。

### 3.5 渲染开销没有统一预算

- 程序化场景活跃时常驻 rAF（`procedural-scene.ts:65–86`），DPR 上限为 2（`procedural-kit.ts:85`）。
- toon 路径每帧都跑 HalfFloat + MSAA×2 合成和 Outline（`render-style.ts:33–44`），每帧还会 `scene.traverse` 建数组、`new THREE.Color()`（`:65`、`:76`）。
- 木鱼则是按需渲染，DPR ≤ 1.75（`woodfish-scene.ts:29`、`:258`）。
- 今日预览同样常驻按 rAF 渲染（通常 60fps）。
- 目前没有任何真机帧率或功耗数据（`docs/mobile-app.md` 仍列为"待设备验收"）。场景越多，越难回头统一。

### 3.6 资源型场景没有通道，只有木鱼走得通

- `scene-library.tsx:151–169` 的 `validate` 只分"木鱼 / 其他"两支：其他场景只能带不超过 8 KiB 的 `presentation` JSON，`config` 必须为空。
- 只有木鱼会把租约变成内容客户端（`scene-experience.tsx:299–319`）。`ProceduralContext`（`procedural-scene.ts:5–17`）和 `SceneContext` 都没有读取资源的接口。
- `@wbr/content` 的 `Pack` 写死了 `sceneId: "woodfish"`（`content/src/index.ts:22–30`），GLB 校验函数叫 `validateWoodfishGLB`（`glb.ts:5`）。
- 随包的离线资源是写死的白名单（`scripts/prepare-app-assets.mjs:7–17`）。
- 内容发布脚本把标题表和场景列表写死为 3 个（`scripts/publish-scene-content.mjs:104–111`）。
- 后果：第一个需要模型、贴图或采样音的研究场景，只能硬塞进 JS 包，或者照抄木鱼的专用路径。

### 3.7 木鱼是第二套引擎模型（目前可以接受）

- 木鱼引擎放在 `packages/app` 而不是 `packages/scenes`，输入在 React 层处理。
- App 层有 7 处 `engine === "woodfish@1"` 分支：`scene-experience.tsx:301/331/512/528`、`daily-scene-preview.tsx:69`、`scene-placement.ts:62`、`scene-library.tsx:152`。
- 只有一个特例时没问题。如果再出现"宿主驱动输入"或"带资源"的引擎，分支会成倍增长。

### 3.8 场景样板重复，且有两套模板

- 每个 Design A 场景都手写同一套逻辑：restoring / `canAct` / 步骤机 / `syncOverlayForStep` / start 时恢复 / dispose 清单。每个场景约 100–150 行（参见 `lantern/scene.ts` 的 `completeScene`、`goRest`、`goWish`、`start`、`dispose`）。
- 两个早期场景 `celtic-folk-spring` 和 `theravada-water` 绕开了 kit：
  - 自建 `WebGLRenderer`，复制了一份 `setSafeText`，没有设置 CEL_STYLE。
  - 画不透明的深色背景加雾（`celtic-folk-spring/scene.ts:101–109`，`theravada-water/scene.ts:103–111`），违背"透明画布落在宿主舞台上"的约定（`procedural-kit.ts:79–81`）。
  - 按代码推断，它们在今日卡片和场景页上会显示成深色矩形（未截图验证）。
  - 行为测试的 SCRIPTS（`five-scenes.test.ts:53–62`）手选了 8 个场景，不包括这两个。
  - 新作者很容易复制错模板。
- HUD 依赖 App 的样式类名（`.scene-title`、`.scene-step-dots`、`.scene-hint`、`.scene-bow-tap`、`.scene-wish-slot`），这是契约里没写的隐式依赖。这些样式在 `packages/app/src/style.css` 和 `apps/cyber-bless/src/styles.css` 里各有一份。

### 3.9 访问模式与结算逻辑集中在一个组件里

- `LoadedScene`（`scene-experience.tsx:151–535`）用 3 个可选 prop（`daily`、`vessel`、`wishId`）加若干 state，组合出 6 种以上结局。
- 完成行是一段约 150 行的嵌套三元（`:363–511`）。
- 它与具体场景无关，这是好事；但它也是完成反馈唯一的改动点，后续改 UX 的风险都集中在这里。

### 3.10 新旧两套仪式模型并存，存档粒度较粗

- core 里的 `rituals`、session、`ritual.*` 动作，以及 2D 的 `Ritual`/`Complete` 页（`ritual.tsx`，372 行）还在，用于续接旧会话和"旧仪式还愿"。
- 存档校验 `kind()` 写死了三种仪式（`core/src/index.ts:490–491`）。
- 新场景不碰这套模型，但读代码的人要同时理解两套。
- `SceneRecord.progress` 是每个场景 id 一个整数，跨访问模式共享（`core/src/index.ts:79–82`、`:207–209`），每次 dispatch 都把整份 State 写盘。对 3 步场景足够；对需要中间状态（摆放位置、多分支）的玩法不够，`docs/scene-content.md` 也已承认这一点。

### 3.11 作者工具与工程卫生

- **dev 画廊是第三个宿主**：`apps/cyber-bless/src/pages/ScenePage.tsx` 直接调用 `loadScene` 并自带 rAF，不传 stage / isActive / saveWish，所以夜景场景在这里用的是日间灯组。无头截图每次都要临时搭 harness。
- **行尾混用**：`woodfish-scene.ts` 592 行中有 579 行是 CRLF，`.gitattributes` 没有 eol 规则。
- **代码风格不统一**：没有 formatter 或 linter；scenes 包不写分号、用单引号，app 包写分号、用双引号。
- **类型检查不完整**：`packages/app` 和 `packages/scenes` 没有自己的 typecheck，只靠 cyber-bless 的 `tsc -b` 顺带覆盖，测试文件不参与检查。
- **文档漂移**：
  - `docs/app-framework.md` 的"模块"一节没有列 scenes / scene-runtime / gestures / shared。
  - `docs/scene-content.md` 仍写着只有三个引擎。
  - `procedural-scene.ts:19` 的注释仍是 "two independent interaction implementations"。

---

## 4. 建议重构

### P0：加场景前必须做（合计约 3 人日，粗估）

**P0-1 步数写进元数据，完成信号只保留一套**

- Why：修复 3.2 的静默提前结算，成本极低。即使坚持"三步规范"，也建议先做，因为研究里的流程长短不一。
- Scope：
  - `SceneMeta` 增加 `steps`（`packages/shared/src/types.ts`），10 个场景的 `index.ts` 补上 `steps: 3`。
  - `sceneSteps` 改为查注册表；木鱼取 `rituals.woodfish.steps`。
  - 同步修改 `scene-library.tsx:200`。
  - 契约写明"完成 = `onProgress(meta.steps)`"，`scene:complete` 只作 DOM 通知。
- Risk：低。存档里的 progress 仍是整数，格式不变。

**P0-2 今日轮换改用"日序号"**

- Why：修复 3.3。池子到 15 个就明显不均，到 20 个会有场景全年不出现。
- Scope：
  - `scene-placement.ts:105–163`：把本地日期字符串换算成连续的日序号。
  - 主仪式按日序号奇偶选祈福或许愿池，池内按 ⌊序号/2⌋ 取模；回看三选同样改。
  - 测试改为不变量：365 天内每个已投放场景都会出现；各场景出现天数之差不超过 1；两池都不空时类型严格交替。
- Risk：低。
  - 上线当天的主仪式可能变化；已收的小物按"日期+场景"存储，不会丢。
  - 同一天可能多收一个小物。可以接受，也可以让新算法从次日生效。

**P0-3 场景注册收敛为一张描述表，并加一致性测试**

- Why：修复 3.1。漏改 `scene-engines.ts` 只有在用户点开时才报错；标题有 4 份。
- Scope：
  - 在 `packages/app` 新增一张描述表（例如 `scene-descriptors.ts`）。投放池、叙事、图标都属于产品层，所以放在 app。
  - 每项包含 `id、title、engine、steps、pool: blessing|wish|catalog-only、stage、traditionSlug?、narrative?`。
  - `builtInScenes`、`supportsScene`、各个池子列表、`sceneEngines` 的程序化条目都从这张表派生。
  - `packages/scenes` 侧把 `sceneRegistry`、`IMPLEMENTED`、`loadScene` 收成一张 `id → import()` 表；meta 只在 `<id>/index.ts` 定义一次。
  - 去掉 `scene-experience.tsx:75–80` 和 `daily-scene-preview.tsx:91` 的强转，改用 `isEngineId` 守卫。
  - 一致性测试：描述表、scenes 注册表、引擎表、图标、candy 一一对应，标题一致。
  - 3.1 中的精确列表测试改为不变量。
- Risk：低到中。
  - id / engine / title 必须字节不变，因为 core 在引擎变化时会拒绝 `scene.visit`。
  - `builtInScenes` 的顺序要保持（它决定场景目录的展示顺序）。
  - 这一步纯属重排，不改行为，由现有 501 项测试兜底。

**P0-4 契约测试自动遍历注册表**

- Why：新场景的最低质量线不应该依赖作者手写 SCRIPTS。
- Scope：在 `packages/scenes` 新增一个遍历测试，复用 `five-scenes.test.ts` 的 mock。对每个已注册场景，在日、夜两种 stage 下：
  - create → start → update。
  - 只用动作按钮加推进 dt 走完全程，断言 onProgress 依次为 1..steps，完成只报一次。
  - 对每个 k 静默恢复，不触发 onProgress。
  - dispose 幂等，window 上没有残留监听。
  - HUD 文案通过 `assertSafeCopy`。
  - 顺带把"每一步都有可见按钮回退"从规范变成测试。
- Risk：低。两个早期场景的按钮结构不同，需要暂列白名单，或者在 P1-4 中迁移。

### P1：尽快做，随第一批新场景一起

**P1-1 `SceneContext` 增加 `mode: 'walk' | 'preview'`**

- Why：修复 3.4。
- Scope：
  - `contract.ts` 增加字段。
  - preview 模式下，kit 不建 HUD、不发声，场景不挂手势（kit 提供一个统一判断）。
  - `daily-scene-preview.tsx` 传入 preview；木鱼预览已经是只读，不用改。
- Risk：低；需要对 11 个场景做一次预览截图回归。

**P1-2 先测真机，再定帧预算**

- Why：修复 3.5。没有数据就统一降画质，等于盲改。
- Scope：
  - 在一台低端 Android 和一台较旧的 iPhone 上，测场景页和今日预览的帧率、GPU 内存和发热。
  - 根据数据定策略：程序化场景的 DPR 上限（对齐木鱼的 1.75 或更低）、预览降到 30fps 或静止时停帧、合成器的 MSAA 档位。
  - `render-style.ts` 的每帧分配改为复用对象。
  - 策略只落在适配器和 kit，场景代码不改。
- Risk：中，画面会有变化；用截图对比验收。

**P1-3 资源型场景通道（第一个需要模型、贴图或采样音的场景到来时再做）**

- Why：解决 3.6。
- Scope：
  - `validate` 改为按引擎注册的校验器表。
  - `SceneContext` 增加只读的 `assets.read(name)`（包装租约），由 `LoadedScene` 传入。
  - 从 `validateWoodfishGLB` 抽出通用的 GLB 预算校验。
  - 需要离线使用的资源加进 `prepare-app-assets.mjs` 白名单和哈希清单。
  - 发布脚本改为读描述表。
  - 不复制木鱼的本地优先更新客户端。
- Risk：中，涉及内容和缓存路径。木鱼路径保持不动，用 `scripts/test-scene-content.py` 回归。

**P1-4 收敛样板为 `createStepScene`，并明确模板**

- Why：解决 3.8。把"静默恢复、只完成一次、非活跃不响应、dispose 清单"这些不变量写在一处。
- Scope：
  - kit 增加步骤机帮助函数，新场景必须使用。
  - 旧场景只在 P0-4 契约测试保护下顺手迁移。
  - 两个早期场景优先处理：改为透明舞台加 CEL_STYLE，或者注明"legacy，不作模板"。
- Risk：新场景低；迁移旧场景中等（手感细节），逐个迁移、逐个截图。

**P1-5 场景作者工作台**

- Why：解决 3.11。作者需要在真实宿主里切换日夜、跳步骤、开减少动效、看预览。
- Scope：
  - `/dev/scene/:id` 改用 App 的 `proceduralEngine` 适配器。
  - 支持 `?stage=night&progress=2&reduced=1&mode=preview`。
  - 适配器可以注入确定性时钟，替代场景里的 `performance.now()` 装饰时间，方便无头截图。
  - dev 画廊不再单独维护一份 HUD 样式。
- Risk：低，只影响开发路由。

### P2：有空再做

| 项 | Why | Scope | Risk |
| --- | --- | --- | --- |
| P2-1 访问模式改成判别联合，拆分 `LoadedScene` | 3.9 | `Visit` 联合类型 + `useVisitSettlement` + `<SceneDoneRow>`；最好与下一次完成反馈改版合并 | 中：核心结算，靠 `ritual-scenes.test.ts`（674 行）兜底 |
| P2-2 引擎 UI 适配层 | 3.7 | 等到第二个"宿主输入或带资源"的引擎出现时，再引入 `{ steps, buildContext(lease), hud }`，消除 `woodfish@1` 分支 | 提前做就是过度设计 |
| P2-3 检查点 schema 版本化 | 3.10 | 某个场景确实需要非整数状态时，`SceneRecord` 增加可选的 `checkpoint` 与 `schema` 字段，并配迁移器 | 中：涉及存档兼容 |
| P2-4 退役 2D 仪式路径 | 3.10 | 确认真实存档里已没有 `activeSession` 后，移除 `Ritual`/`Complete` 的 UI 入口；`restore` 保持兼容 | 中：老存档 |
| P2-5 统一场景音频 | 每个场景实例自建 AudioContext（`procedural-kit.ts:240`），App 还有一个（`App.tsx:191`） | 由宿主注入发声能力，共用一个上下文 | 低 |
| P2-6 工程卫生 | 3.11 | 加 eol 规则并单独提交重归一化；引入 formatter，但只格式化改动过的文件；各包加 typecheck（包含测试） | 低：单独提交，避免污染 blame |
| P2-7 文档同步 | 3.11 | 更新 `app-framework.md`、`scene-content.md` 和注释；新增 `docs/scene-authoring.md`（内容即第 6 节） | 无 |

---

## 5. 明确非目标

- **不重做 App 壳、四个 Tab 和路由栈。** 沿用已定的精简策略，不为新场景在今日或心愿增加入口。新场景通过"今日轮换 + 小天地回看 + 我的 › 场景目录"露出。
- **不引入 react-three-fiber、ECS 或场景图框架。** 命令式 Three.js 模块加 `SceneModule` 契约，粒度正合适。
- **不做共享 WebGLRenderer 或多场景合成。** 目前每页只有一个活动画布，并且会主动销毁上下文。除非真机数据证明这是瓶颈。
- **不做"数据驱动换皮模板/DSL"。** 不同玩法仍是独立的 `engine@version` 代码，复用 kit，而不是收敛成模板（`docs/scene-content.md` 的既定原则）。
- **不做远端下发玩法代码或小游戏容器。** Expo DOM 不支持 OTA，商店政策也有限制；远端只下发数据。
- **不把木鱼搬进 `packages/scenes`，也不重写木鱼。** 它是稳定的特例，不要当作新场景的模板。
- **不批量重写或重排现有 10 个场景，不做全仓格式化。** 只在契约测试保护下按需迁移。
- **不提前做存档 v2、跨设备同步，或更换状态管理库。**

---

## 6. 新仪式场景接入 checklist

### A. 选题与材料（写代码前）

- [ ] 从 `docs/material-readiness/2026-10-04/` 中选"文字齐备"的切片。不齐备的，先补写物件材质、空间关系、过程变化和声画表现，并把结果记回对应的 batch。
- [ ] `traditionSlug` 指向一个存在的 `content/traditions/<slug>.md`，或使用 `PRODUCT_ORIGINAL`。定好 grade 和 sensitivity；"中"敏感度需要额外评审。
- [ ] 文案用"练习/致敬"的语气，并通过 `assertSafeCopy`。叙事可选，写的话控制在 80–120 汉字；产品原创的场景要写明"产品原创/改编"。

### B. 交互设计

- [ ] 确定步数：默认 3 步；其他步数要先完成 P0-1。
- [ ] 每一步都有可见的按钮回退。
- [ ] 手势只用 `@wbr/gestures` 现有的 5 种；需要新手势时，先加进 gestures 包并带测试。
- [ ] 确定归属：祈福池、许愿池或仅目录。许愿场景要么带 wishWrite 框，要么依赖完成后的"留下它"表单。
- [ ] 确定舞台：日间或夜间。
- [ ] 减少动态效果时：装饰时间冻结，自动动画直接到终态，但手势计时照常进行。

### C. 代码（`packages/scenes/src/<id>/`）

- [ ] `index.ts` 只导出 meta（含 steps）和 create。
- [ ] `scene.ts` 基于 procedural-kit 编写，用到：
  - `createWarmStage`（透明画布）、`addStageLights(ctx.stage)`、`createStepOverlay`
  - `createSceneFeedback`、`claimObjectTouches`
  - `sizeStage` + `portraitBoost`、`observeCanvasResize`
  - `createDebugRenderStyle(sceneId)` + `CEL_STYLE`
- [ ] 不要以 celtic-folk-spring 或 theravada-water 为模板。
- [ ] 遵守不变量：
  - `initialProgress` 静默恢复；只有非恢复时才调用 `onProgress(k)`。
  - 用 `canAct()` 守卫；完成只报一次。
  - 不用 `setTimeout`，时间全部走 `update(dt)`。
- [ ] dispose 清单：监听、手势 handle、fx、styleRenderer、`renderer.dispose()` + `forceContextLoss()`、灯晕或 DataTexture、`disposeTree`、清空 overlay。
- [ ] 复杂运动或状态拆成纯函数模块并单测（参照 `crane/fold-kinematics.ts`）。
- [ ] 预算：几何体和 draw call 与现有场景同量级；P1-3 就绪前不用贴图或 GLB；代码块目标小于 20 KB（现有场景为 7–12 KB）。

### D. 注册

- [ ] P0-3 完成前，按顺序逐处修改：`registry.ts`（meta、IMPLEMENTED、loadScene）→ `scene-engines.ts` → `scene-library.tsx` 的 `builtInScenes` → `scene-placement.ts` 的池子与夜景列表 → `scene-icons.tsx` → `style.css` 的 candy。P0-3 完成后只需加描述表的一行。
- [ ] 引擎 id 用 `<id>@1`；交互契约改变时升为 `@2`，旧存档按原引擎保留。

### E. 测试

- [ ] 契约遍历测试自动覆盖（P0-4）。
- [ ] 补场景专属的行为测试：拖拽命中、方向、设备运动、夜间灯组。
- [ ] 跑通 `npm test`、`npm run build`、`npm run mobile:verify`。

### F. 在真实宿主中验证

- [ ] 在作者工作台检查：日/夜、各步恢复、减少动效、预览模式。
- [ ] 在 App 中走一遍：
  - 从我的 › 场景目录打开。
  - 作为今日主仪式走完，小物飞进小天地。
  - 许愿场景：在心愿 › 祈愿里使用小物。
  - 从小天地回看。
  - 检查 320px 宽与竖屏。
  - 检查 WebGL 失败时的提示。
- [ ] 生命周期：反复进出没有残留的上下文（参照 `scripts/test-scene-library.py`）；后台和 Android 返回键能正确暂停。
- [ ] 至少在一台低端 Android 上看帧率与发热；P1-2 定出预算后按预算验收。

### G. 发布

- [ ] 新引擎代码随商店版本发布（Expo DOM 不支持 OTA）。远端目录只能下发数据；没升级 App 的用户会看到"需更新 App"。
