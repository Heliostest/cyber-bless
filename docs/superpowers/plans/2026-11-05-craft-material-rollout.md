# Craft Material Rollout Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans and superpowers:dispatching-parallel-agents for the independent scene groups. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 审阅当前 91 个可见仪式并把安全对应的器物材质扩展到首批之外。

**Architecture:** 增加原位显式应用 API，使新程序表面与已有光学/物理材质组合；三组场景独立核查/接入，根任务处理共享 API、木鱼、来源同步、全量验证。

**Tech Stack:** Existing Three.js r170 / TypeScript / Vitest / Chromium WebGL。

**Spec:** `docs/superpowers/specs/2026-11-05-craft-material-rollout-design.md`

## Global Constraints

- 只改独立工作区，不混入原目录未提交的树木调试工作。
- 不按颜色或地域推断材质，不改变器物身份、原图/纹样、动作与文化来源。
- 保留原材质对象、子类、纹理、动画和所有权；不新增 GPU 纹理、透射或附加 pass。
- 每个可见场景有接入或保留的具体记录；隐藏场景不强行处理。

## Review Focus

- 同色材料混用在木/食物/布等不同对象时，显式拆分，防止误覆写。
- 补丁必须与 ritual-optics 和 Physical 克隆共存，不丢原透明度/透光/贴图。
- 竹、草、石保持自身哑光身份，不能套陶或木的反射/纹理。
- 无 UV、材质数组、动态发光与存档恢复保留；全量 WebGL 检查风格回退与源引用。
- 木鱼是独立宿主，单独检查 GLB 木质部件与真实 App 渲染，不能仅用程序场景证明覆盖。

### Task 1: Baseline, shared surface API and missing matte families

- [x] 保存可见场景清单与改动前实渲染基线。
- [x] 先验证原位应用/光学组合/幂等/导数约束的失败测试，再实现 `applyCraftSurface<T extends MeshStandardMaterial>(material:T, options):T`。
- [x] 补必要的竹、草、石模式并验证编译；原工厂调用同一原位 API。

### Task 2: Explicit scene groups

- [x] A 组 29 场审阅后接入；B 组 29 场；C 组 28 场。逐场说明接入材质变量与保留边界。
- [x] 根任务处理木鱼；共享家具保持，避免扩大隐藏场景。首批4场和纸鹤/莲灯按记录保留。
- [x] 同步受影响 README、来源卡的产品表达与逐场研究记录；复核所有 91 场的来源身份。

### Task 3: Validation and review

- [x] 定向交互、恢复、销毁及共享运行时测试通过；完整测试与生产构建。
- [x] 全可见场景真实 WebGL 风格/状态/小屏检查，选择代表前后图人工核对。
- [x] 独立审阅并修复，最终源码哈希对应回执；更新测试修订索引。

## Execution record

- 独立工作区基线 `f798f9d2`。原目录树木工作保持原状。现有 craft/toon 基线 28 项通过。
- 完成：85场新增、4场首批保持、2场保留专门纸光学；原位API与8类材质，12,976项全测试及生产构建通过。534次改动后真实渲染检查无异常，独立审阅无实质问题，回执源码哈希一致。详见研究记录和91场覆盖JSON。
