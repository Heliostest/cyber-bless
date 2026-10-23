# 椰果献愿 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** 一个不重复、有直接祈福来源的 Three.js 场景。
**Architecture:** 对象交互沿用现有指针与生命周期；独立模型；宿主通过目录和引擎注册。
**Tech Stack:** TypeScript, Three.js, Vitest, Playwright.
**Spec:** ../specs/2026-10-23-hindu-coconut-offering-design.md

## Global Constraints

单一ID hindu-coconut-offering，新专卡，不杜撰传统，不改主目录未提交内容，只本地提交。

## Review Focus

长拖终点；裂壳接触与真实内瓤；暂停回调重入；静默恢复；原生封面和离线资源。

### Task 1: 模型与物件交互

Files: packages/scenes/src/hindu-coconut-offering/{model,scene,index}.ts 及测试。
Produces: createCoconutOfferingModel(), createCoconutOffering(ctx), SceneModule。
- [x] 先加测试，缺失模块时失败。
- [x] 上/右/下三段和击石开壳，复用生命周期与指针契约。
- [x] 运行模型与交互测试并修复失败。

### Task 2: 来源与宿主集成

Files: 新专卡、README、研究记录，core/scenes/app/runtime注册与测试，widget-preview。
Consumes: Task 1 SceneModule。
- [x] 目录测试先失败。
- [x] 同步目录、叙事、意图、引擎、环境和来源边界。
- [x] 生成三种封面并同步原生目录。

### Task 3: 验收

- [x] 相关测试、生产构建和离线资源验证。
- [x] 三宽界面与输入，保存当前构建截图和状态。
- [x] 独立复核并修复问题，核对来源清单。
- [x] 仅本地提交，停止。

验收结果：77新场景检查、10,251全量测试、正式构建、44最终界面截图、4上下文全部释放、Android／iOS离线导出和465封面哈希均通过。独立复核无阻塞。只保留本地分支。
