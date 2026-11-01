# 单步场景拿近查看实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 给 15 个单步仪式增加抬起、近景自动环视和手动转看，再继续原安放。

**Architecture:** 共用查看控制器维护本地镜头和物件状态；场景通过输入开关、UI 装饰及生命周期接入，原安放引擎保持。各组修改分开的场景文件，统一文案由单独任务维护。

**Tech Stack:** TypeScript、Three.js、现有 DOM 手势、Vitest、Playwright、项目八语目录。

**Spec:** `docs/superpowers/specs/2026-10-29-close-object-inspection-design.md`

## Global Constraints

- 保持 15 个技术 ID、引擎版本、完成值 `3` 和旧 `0/1/2/3` 存档兼容。
- 整体抬起 actor，绕镜头而不翻转承托物。近景不提交进度或完成，不改变文化事实与来源身份。
- 保留已有未提交修改，仅修改任务涉及内容；不提交、推送或发布。
- 自动绕看 6 秒；单指／键盘接管后停止自动；允许提前继续。减少动态不自动绕看。

## Review Focus

- 第二指、跨控件、拖动尾事件不能穿过查看阶段误触安放或结束。
- 各种比例下全周可见，细长旗、饰矢和宽托板不裁切；环境不挡背面。
- 暂停、失焦、resize、销毁恢复镜头、对象和背景，且旧完成态不重播。
- 整体查看不脱开挂环、双牛、锁链、纸雏和糖袋内容，原最终接触仍成立。
- 八语介绍与提示描述新增产品查看阶段，原文化主张和正文访问状态保持。

## Task 1 共用查看控制器

**Files:** 新建 `packages/scenes/src/close-inspection.ts` 和 `close-inspection.test.ts`。

**Interface:** `createCloseInspection({canvas,scene,camera,actor,ui,isActive,isReducedMotion,prepare,safe,changed})`，返回 `canPlace():boolean`、`decorate(completed:boolean):void`、`update(dt:number):void`、`cancel():void`、`dispose():void`。点击捕获处理第一次拾取和查看时继续，自己的对象指针处理查看，`decorate` 在 scene 的 `sync` 最后调用。

- [x] 先写测试并运行得到预期失败：首次动作只查看；相机近景全周且 actor 四元数不变；手动接管；减少动态；取消／销毁完整恢复；早退不完成。
- [x] 实现控制器，先通过共用专项测试，再交付其稳定接口给场景组。

## Task 2 九场接入

**Files:** `brat-bride-cloth`、`korean-sotdae`、`japanese-kadomatsu`、`pucara-rooftop-bulls`、`chinese-longevity-lock`、`alasita-miniature-house`、`scottish-first-footing`、`mochigase-nagashibina`、`shichigosan-chitose-ame` 下的 `scene.ts` 与测试。

- [x] 测试先验证首个输入不完成、真实查看后才允许安放，观察旧实现失败。
- [x] 接入 Task 1：原 pointer、旧键盘旋看和落点 cue 均加 `canPlace()`；`sync` 末尾 `decorate(at===3)`；update 调用 `update(delta)`；取消、blur、resize、inactive、dispose 清理查看。
- [x] 既有安放测试先通过真实查看阶段再执行原断言，不能删去遮挡、旧状态、回调重入或接触检查。运行九场测试。

## Task 3 六场接入

**Files:** `lanna-sand-pagoda`、`chinese-fu-paper`、`turkish-nazar-bead`、`japanese-hamaya`、`chinese-ruyi-scepter`、`romanian-martisor` 下的 `scene.ts` 与测试。

- [x] 先验证首次拾取不完成、整件近景和原安放通过，再按 Task 2 同一接口接入。
- [x] 验证纸背、蓝珠挂环、饰矢悬铃、红白绳双流苏均纳入全周构图；运行六场和连续拿放恢复回归。

## Task 4 介绍 来源记录 八语和浏览器

**Files:** 15 场 README、对应来源卡产品段、`packages/core/src/scene-narratives/`、`packages/i18n/src/`、本轮研究记录及浏览器脚本。

- [x] 同步新增查看说明，仅改产品呈现，逐一核对现有来源和器物约束，不扩大文化事实。
- [x] 注册共用新提示并补齐八语，更新生成物与审阅记录，通过 i18n verify/test。
- [x] 浏览器走完 15 场查看和安放，保存近景截图与构图／错误记录。运行场景类型检查、相关回归、App 构建。
- [x] 独立代码审阅并修复有效发现；在研究记录分别报告实现验证与来源边界。
