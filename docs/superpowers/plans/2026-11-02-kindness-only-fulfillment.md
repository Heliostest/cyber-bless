# 还愿只记录小善事 Implementation Plan

> **For agentic workers:** Execute the authorized change in this session, using independent core implementation and UI implementation with a final review. Steps use checkbox syntax for tracking.

**Goal:** 移除仪式还愿入口及门槛，新还愿统一保存为小善事。

**Architecture:** 精简既有 `FulfillWish`；核心写入统一 `kindness`，历史 `ritual` 保留读取和幂等兼容。旧会话收尾出口返回心愿详情。

**Tech Stack:** React、TypeScript、Vitest、现有八语言消息。

**Spec:** [还愿只记录小善事](../specs/2026-11-02-kindness-only-fulfillment-design.md)

## Global Constraints

- 保留旧存档 version=1、历史记录和上一轮小物使用状态修复。
- 复用现有文案、组件样式与输入法／字素校验。
- 不改场景传统、来源、操作与完成条件。

## Review Focus

- 未完成旧 ritual 计划无需仪式即可记录善事。
- 已完成历史 ritual 的方式和笔记不改写。
- 还愿不消费收藏小物、不新增仪式会话。
- 旧草稿文字、语言切换与输入法组合保留。
- 旧会话收尾不再引导仪式还愿。

## Tasks

- [x] 核心：先以 `packages/core/src/index.test.ts` 复现旧仪式门槛，再修改 `wish.fulfill`，运行 core 整包测试。
- [x] 界面：在 `fulfill-wish.test.ts`、`wish-detail.test.ts` 和旧还愿／完成页测试固定行为；精简 `wishes.tsx`，同步旧完成出口与旧草稿测试。
- [x] 验证：运行 app/core/runtime 相关包测试、国际化及构建；浏览器验证善事提交、旧记录、无小物消费。更新当前产品说明和文化影响记录。
