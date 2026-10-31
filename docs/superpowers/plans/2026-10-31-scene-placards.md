# 场景卡片与提词板实施计划

> **For agentic workers:** Use the existing session's parallel implementation tasks. Steps use checkbox syntax for tracking.

**Goal:** 把完整心意文字放进场景卡片下部，把原先画布下方的箭头与动作短句变成连接实际白点的 Three.js 提词板。

**Architecture:** 沿用唯一的业务场景、画布与手势。卡片增加正常文档流 footer；共享 interaction-cues 使用同一场景中的专用渲染层绘制面向相机的 Sprite 与连接线，主画面后处理后再叠加，避免风格损伤文字。白点仍投影真实交互目标。

**Tech Stack:** React、CSS、Three.js、Vitest、现有八语文字绑定。

**Spec:** 当前会话 2026-10-31 用户对 .scene-intention 与动作提示的两项标注。

## 本次提交范围与验证身份

本次提交在隔离工作树中基于 `origin/master` 的 `b1a9679d` 整理；原工作区另有的15场 `close-inspection` 改动及其相关 i18n、narratives 和发布记录未纳入。原工作区的43项宿主与109项场景失败属于历史工作树检查，不等同本次提交快照；旧 cue 的模块alias对照不能证明这些失败全部属于既有基线。本次隔离快照的全量 `npm test` 与 `npm run build` 结果待补录。

## 约束与文化影响

- 完整保留心意标题、动作文字、还愿状态与来源身份；只改显示位置，不增删文化主张。遵循 docs/scene-provenance.md，既有内容核查见 docs/research/2026-10-19-scene-culture-audit.md。
- 不增加画布或改变操作、完成判定、存档、辅助按钮；同一提词板连接当前有效物件白点。
- 屏幕边缘、长译文、多个目标、暂停/卸载、切换语言、缩略图与分享截图均须处理。
- 系统字体与地区语言回退沿用现有 CSS；正文保持 DOM 可读，提词板复用已本地化 cue getter。

## Task 1：卡片 footer

- [x] 在 LoadedScene 与旧木鱼入口复用卡片壳，将原 intention 放到真实圆角边界内下部。
- [x] 更新 immersive 主区域尺寸预算，确保 footer 不覆盖拖拽/辅助按钮；运行相关布局与场景测试。

## Task 2：连接物件的 Three.js 提词板

- [x] 先增加有效 cue 创建 Sprite/Line、移动同步、边缘布局、隐藏及资源释放行为测试，确认旧实现失败。
- [x] 新增小型 placard 绘制器：复用本地化文字、纹理重用、可读尺寸、候选位置避让、相机平面定位、连接真实白点。
- [x] interaction-cues 保留白点、手势光标和无障碍提示，将图形提示移出底部托盘。
- [x] 在主画面后处理后绘制专用层，并恢复相机、背景、渲染目标与自动清屏状态；捕获默认不包含提示层。
- [x] 验证步骤切换、语言、紧凑点、拖拽/暂停、销毁和长文案不越界，运行共享渲染与相关引擎测试。

## Task 3：集成验证

- [x] 原工作区历史浏览器检查叶盘场景、木鱼；多个目标/320px边缘由共享 cue 测试验证。该次手机宽度卡片与短桌面视口均可读。
- [x] 原工作区完成类型检查、相关测试、生产构建及差异检查；历史结果、浏览器观察与43项模块对照的证据边界见[验证记录](../../research/2026-10-31-scene-placards.md)，不将该对照称为全部既有基线失败的证明。
- [x] 本次隔离提交快照的完整 `npm test`、`npm run build` 与差异检查通过，已补录结果。
