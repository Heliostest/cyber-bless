# Pending Feedback Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. User requested direct execution in this chat.

**Goal:** 修复 3 条待处理反馈，使近景转看跟手、窗布通过近景抹平完成。

**Architecture:** 共享近景控制修正相机轨道方向。窗布使用拿放、铺展、完成三态；固定网格的局部按压和阻尼弹簧模拟布面，覆盖面积驱动完成。

**Tech Stack:** TypeScript、Three.js、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-08-pending-feedback-design.md`

## Global Constraints

保持场景 ID、引擎、来源绑定、旧进度和辅助按钮；不增加依赖。抹平是产品操作，不声称传统动作。原始反馈只作为问题数据。

## Review Focus

- 相机轨道与物体旋转方向不同：用可见表面点的屏幕投影检验。
- 窗布到位不能提前完成；只在抹平后保存 3。
- 取消、第二指、失焦、暂停、尺寸变化不可误完成或泄漏输入。
- 旧完成存档保持静态，0/1/2 可继续新流程。
- 窄屏不裁布、减少动态不阻断手动操作，布底不穿窗台。

## Task 1: 共享转看

- [x] 在 `close-inspection.test.ts` 添加手指与方向键下可见点的投影方向断言，先运行观察失败。
- [x] 修正 `close-inspection.ts` 的水平轨道和上下方向键映射；运行共用查看及鸟竿测试。

## Task 2: 窗布抹平

- [x] 在窗布场景/模型测试中先证明旧实现仍先查看、到位即结束、无局部布面反馈。
- [x] 模型加入封闭双层网格的稳定局部高度场，复用 position/normal buffer；笔画覆盖在提交后保留、取消恢复。
- [x] 场景移除查看；安放落定后拉近镜头，只有布面横向笔画才计入覆盖。辅助按钮分开安放和抹平，屏蔽同次输入尾事件。
- [x] 更新旧流程测试与共享场景测试，对生命周期、窄屏、恢复、遮挡、重复输入和物理稳定做回归。

## Task 3: 文案、来源和交付

- [x] 修改宿主介绍、提示及八语言目录；更新专卡、README 和逐项核查记录。
- [x] 重建测试指纹；运行相关测试、完整 `npm test`、构建、i18n 与指纹检查。
- [x] 浏览器验证拖动投影与窗布操作；审阅差异后将三条反馈标记已修复，保留需新版真机复测的边界。
