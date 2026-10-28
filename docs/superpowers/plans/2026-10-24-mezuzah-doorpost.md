# 门柱祈安 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Steps use checkbox syntax for tracking.

**Goal:** 实现一个不重复且有直接祈福来源的Three.js安放场景。
**Architecture:** 复用对象指针／生命周期／风格和宿主契约，独立模型负责实体与pose，专卡区分信仰与产品片段。
**Tech Stack:** TypeScript, Three.js, Vitest, Playwright, Expo.
**Spec:** ../specs/2026-10-24-mezuzah-doorpost-design.md

## Global Constraints

一个ID mezuzah-doorpost，来源slug相同；不造经文／传统规则／效验；主目录未提交内容保留；仅本地提交。

## Review Focus

上三分之一与右侧观察方向；初始承托与最终胶背接触；运输中门柱／门扇碰撞；小屏180px终点；来源／产品文字对应。

### Task 1: 模型与场景

Files: packages/scenes/src/mezuzah-doorpost/{model,scene,index}.ts及测试。
Produces: createMezuzahModel(), createMezuzah(ctx), SceneModule。
- [x] 缺失模块时交互测试先失败。
- [x] 实现闭合经盒、准备托、完整门框与上／右／下动作。
- [x] 运行模型与交互测试，修复真实失败。

### Task 2: 宿主与来源

Files: core/scenes/app/runtime注册、目录测试、专卡／研究／README、原生封面。
Consumes: Task1模块。
- [x] 目录测试先失败再接入来源／叙事／意图／图标／引擎／场景池。
- [x] 保存来源主张矩阵与实际访问状态，核对三步产品边界。
- [x] 只新增三种真实WebGL封面，保留旧154记录并同步原生目录。

### Task 3: 验收与本地交付

- [x] 相关测试、正式构建、三宽鼠标／键盘／恢复及双宽触摸模拟、普通动画。
- [x] 风格持久化与GPU回收、Android/iOS离线和封面哈希。
- [x] 独立来源／代码／最终实图复核，补记录。
- [x] 本地提交，只完成一个后停止。

完成依据：新场景75检查、相关宿主测试、生产构建、44最终网页截图、4上下文全部释放、双方离线导出与iOS468封面hash，独立来源／代码／画面复核无阻塞。仅本地提交并停止。
