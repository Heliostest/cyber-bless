# 窗布祈护 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Read the spec and provenance protocol first.

**Goal:** 新增一个不重复、有直接祈护依据的窗布Three.js场景，完成后停止。

**Architecture:** 独立model管理有厚度的方布、窗台与木凳及连续pose；scene复用当前物件指针、方向容差、风格和宿主生命周期契约，单独注册来源与意图。

**Tech Stack:** 既有TypeScript、Three.js、Vitest、Playwright/CDP、Expo DOM；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-brat-bride-cloth-design.md`

## Global Constraints

- 基线2750df5；独立`codex/brat-bride-cloth`，保留所有旧工作区、预览和主目录。
- 依据`docs/scene-provenance.md`分记信仰事实、产品安排、访问缺口；不保证健康效果。
- 仅这一项、本地提交；不合并、推送、恢复自动化或启动下一题。

## Review Focus

- 布顶面可见且命中近处实体，不能用透明代理掩盖遮挡。
- 完成后的布底真实接窗台，603姿态不穿凳面/窗沿/窗框。
- 形态与几何缓冲在取消、保存恢复、减弱动画下保持一致。
- 拖动方向与提示一致，180px仍在屏内，不让误触或回退完成。
- 节期/求愈为真实信念，不把三步或模型过夜当作传统规则及效验。

## Task 1：模型与身份

Create `packages/scenes/src/brat-bride-cloth/{model.ts,model.test.ts,index.ts,catalog.test.ts,README.md}`；修改core目录、意图、介绍、注册表；新建对应专卡、研究及来源索引。

Interface：`createBratBrideModel()`返回`root,cloth,board,bench,sill,pose(step,t),targets,roots,anchors,dispose()`；pose固定拓扑、检查点连续。常量尺寸、承托面与路径以spec为准。

- [x] 先写目录可加载/身份与几何承托测试，运行缺项红灯。
- [x] 实现闭合布与支撑、连续pose、实体边界/法线/603姿态与buffer复用检查；红绿验证。
- [x] 来源卡、研究、README及宿主目录/metadata一致，区分产品新增。

## Task 2：输入与宿主接入

Create `scene.ts,scene.test.ts`；修改`packages/app/src/{scene-engines.ts,scene-icons.tsx,scene-placement.test.ts,ritual-narrative.test.ts,hourly-scene-lifecycle.test.ts}`、`packages/scene-runtime/src/cozy-environment.ts`、`scripts/{test-next-four-scenes.mjs,widget-preview/scene.ts}`。不改共享指针或外壳行为。

Interface：`createBratBrideCloth(ctx:SceneContext):SceneInstance`；提示上/上/下，ACTIONS提起方布/移到窗前/铺布寄愿；结束语“窗边已铺好一方布，愿你与牵挂的人平安。”。

- [x] 先写真实几何/射线/cue的63项输入生命周期测试，仅替换GPU边界；观察模块缺失红灯。
- [x] 实现40px及长拖、错误面/回退/取消、暂停冻结、回调重入、44px键盘和完整释放；普通与减弱动画/恢复几何一致。
- [x] 同步引擎、图标、夜间环境、宿主和显式期望，运行相关回归。

## Task 3：最终验证与收尾

- [x] 渲染三尺寸真实WebGL封面、同步Android/Expo/iOS目录，旧记录保持。
- [x] 生产构建、全仓测试、原生相关守卫与实际两平台离线验证；避开浏览器并发重负载。
- [x] 320/390/1280正常动画鼠标/键盘/恢复/无效输入，320/390CDP触摸和180px长拖，真实阶段图及菜单持久化。
- [x] 独立来源/代码/几何/实图终审，填文化清单、验证限制和图片哈希，当前构建预览。
- [x] 仅本地提交、本项原子登记，随后停止。

最终正式`npm test`全包8694用例、当前生产构建、`mobile:verify`与16组件守卫通过；三宽鼠标与两宽CDP触摸、180px长拖、菜单恢复和57实图均已核对。中间错误、红绿、文化核查、独立终审与本地提交/登记收据见`artifacts/brat-bride-cloth/validation.md`。模拟不等于实体手机或原生编译；本轮不继续新题。
