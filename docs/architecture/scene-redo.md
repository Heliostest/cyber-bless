# 场景重走：进度与结算规则

- 日期：2026-10-11
- 关联代码：`packages/app/src/scene-library.tsx`（`useOpenScene` / `useOpenRitual`、`SceneCatalog`）、`packages/app/src/pages.tsx`（`History`）
- 测试：`packages/app/src/ritual-scenes.test.ts`

## 问题：走完的场景再打开，落在完成页，感觉「重走被卡住了」

每个场景在存档里只有一个进度整数 `sceneRecords[id].progress`（core，跨访问模式共享）。原先只有带结算标志的访问（今日 `{daily}`、许愿 `{vessel}`、还愿 `wishId`、回看 `{replay}`）会先把进度置 0；而不带标志的入口直接裸跳转：

1. **场景目录**（`SceneCatalog`）用 `go({ page: "scene", ... })` 打开，从不重置进度；
2. **仪式时光**的场景卡（`sceneRecords` 列表）同样裸 `go(...)`。

于是一个已走完的场景（progress ≥ 步数）再打开时，进度仍是满步数，页面直接落在完成行（`SCENE_DONE_COPY`，只剩一个「完成」返回按钮）：木鱼敲不响（按钮 `disabled`），程序化场景也以完成态恢复。用户想再走一遍，却哪里也去不了。

（2D 仪式的「再次体验」走的是 `useOpenRitual`，它一直有「已完成则置 0」的规则，所以不受影响。）

## 规则：每个入口怎么打开、怎么结算

| 入口 | 打开方式 | 进度 | 结算 |
| --- | --- | --- | --- |
| 今日主仪式 | `openScene(primary, { daily })` | 半程续走（从今日中断再进不丢步）；已完成 → 置 0 重走 | 每天每场景只 mint 一次小物+功德（`daily.scene` 幂等）；已收下后再走完不重复发 |
| 今日「小天地里再走走」 | `{ replay: true }` | 置 0 | 不发小物（即便恰好是当日主仪式） |
| 小天地「回看这场仪式」 | `{ replay: true }` | 置 0 | 不发小物；已花费的许愿小物仍可回看 |
| 场景目录 / 仪式时光场景卡 | 无结算 flag | **已完成 → 置 0 重走；未完成 → 续走** | 走完的恰是当日主仪式时，同样结算当日小物+功德（幂等，一天只发一次）；其余不发小物、不花费 |
| 心愿 祈愿 / 还愿 | `{ vessel }` / `wishId` | 置 0（已花费、还欠「留下/不留下」选择的 vessel 例外：原样回到选择，不重走） | 花费小物（`collectible.spend`，一次） |

一句话：**带 `{daily}` 的访问半程续走、已完成重走；vessel／还愿／回看一定从头走；不带标志的访问「续走未完成的、重走已完成的」——唯一例外：不带标志走完当日主仪式，同样结算当日小物（一天一次），其余不发小物、不花费。**

## Hooks 与标志

- `useOpenScene(entry, visit?)`（`scene-library.tsx`）：3D 场景的统一入口。`visit` 是 `SceneVisit`（`daily` / `vessel` / `wishId` / `replay`）。`daily` 与无标志一样「半程续走、已完成重走」，所以从今日卡片中断后再进不丢步；`vessel`／`wishId`／`replay` 置 0（已花费且选择未决的 vessel 原样回到选择）。无 2D 兜底。
- `useOpenRitual(ritual, wishId?)`（`scene-library.tsx`）：把核心仪式（woodfish / crane / lantern）当 3D 场景打开，仪式时光 2D 会话的「再次体验」走这里；规则相同（未完成续走、已完成或还愿置 0），目录里没有可玩场景时兜底 2D 页。「再次体验」在路由上带 `replay` 标记：它绝不结算当日小物，还愿同理。

## 修复内容

1. `useOpenScene` 的置 0 条件从 `progress > 0 && visit` 改为 `progress > 0 && (visit || progress >= sceneSteps(entry))`，与 `useOpenRitual` 的「已完成」判断对齐。
2. `SceneCatalog` 改用 `useOpenScene()` 的 `openScene(entry)`，不再裸 `go`。
3. `History` 的场景卡同样改 `openScene(record)`（record 本身就是 CatalogEntry 形状）；2D 会话的「再次体验」保持 `useOpenRitual` 不变。
4. 不动的东西：今日每日一次的 mint（`daily.scene` 在当天已有小物时早退）；主仪式仍带 `{ daily }`，不强行加 replay。

测试覆盖：`useOpenScene` 单测的三态（未走过 / 半程续走 / 已完成重走，再加各 flag），以及两条集成用例——从「我的 › 场景目录」和「仪式时光」打开已完成的 crane，页面落在 `已完成 0 / 3`。

## 更新（2026-10-11，P0）：今日主仪式的跨入口语义

审计（`2026-10-11-ux-state-audit.md` §1.3/§2.1）发现两条缝隙，本节规则据此收紧：

1. **`{daily}` 半程续走**：`useOpenScene` 的置 0 条件里，`daily` 与无标志合并——从今日卡片中断后再进，进度原样保留；只有已完成才置 0 重走。vessel／还愿／回看仍一定从头走。
2. **无标志走完也结算**：`LoadedScene` 在走完最后一步时，若不带任何 flag 且该场景是当日主仪式（`dailyPrimaryScene(entries, localDay())`），同样 dispatch `daily.scene`——从场景目录/仪式时光续走完今日主仪式不再白走。幂等键不变（`daily:{day}:{sceneId}`），同日再走完不重复发；回看（`replay`，含仪式时光 2D 会话的「再次体验」）、vessel、还愿路径绝不结算。
