# Ritual Wish Badges Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement and verify these steps in this session.

**Goal:** 用每种仪式已有的图标，通过统一的金色纪念章变换呈现对应的如愿纪念章。

**Architecture:** 展示层通过收藏的 `wishId` 查找心愿的 `sourceSceneId`，复用本地 WebP 图标。共用圆形章框与金色浮雕效果；缺失、未知或加载失败时显示中性星形章。无须修改 reducer、存档或原始图标。

**Tech Stack:** React、TypeScript、CSS、Vitest、Playwright。

**Spec:** 用户 2026-11-02 在本会话要求「用每种仪式的图标生成对应的如愿纪念章，可以是一种统一的图形变换」。具体呈现由实现选择金色圆章、双层边缘与同色压印。

## Global Constraints

- 保留本次之前已有的导航栏修改和其他任务未提交的心愿小物、反馈服务修改。
- 按心愿原始来源关联，不按标题、最近仪式、还愿笔记或后来使用的小物推断。
- 图形变换是产品视觉表达，不新增传统材质、纪念品或功效主张；遵守 `docs/scene-provenance.md`。
- 保持 version=1 存档、技术 ID、图标文件和所有来源绑定不变。

## Review Focus

- 房间、收藏网格、详情、还愿预览图案一致。
- 旧心愿、未知来源、历史隐藏场景、图片加载失败。
- 不同还愿仪式不会改变原始来源图案。
- 多张纪念章共存、窄屏小尺寸、离线资源与大图显示。
- 同一展示变换适用于全部内置与保留的历史图标。

## Steps

- [x] 先新增行为测试，验证来源关联、全部图标、中性兜底、预览和加载失败，观察缺失实现导致的失败。
- [x] 在 `art.tsx` 实现共用纪念章，在 `pages.tsx` 与 `wishes.tsx` 传入原始来源；通过 CSS 统一框形和金色效果。
- [x] 运行相关测试、App 测试及构建；在真实页面检查小图、大图、多图标对照和手机布局。
- [x] 独立审阅变更，修正问题，补充文化影响与验证记录；交付工作区修改。

最终验证与文化边界见[研究记录](../../research/2026-11-02-ritual-wish-badges.md)。本轮仅交付工作区修改，不混入其他任务的提交。
