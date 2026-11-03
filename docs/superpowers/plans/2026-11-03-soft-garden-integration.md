# Soft Garden Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 将用户确认的十段 Soft Garden 音效接入 Web 和移动端共享 App。

**Architecture:** 复用确定性生成器导出统一衰减的 WAV；现有 UI 播放器承接按钮和结果音。共享素材映射驱动离线复制和调试提示，结果音时长保持一致。

**Tech Stack:** Node.js、TypeScript、Web Audio、Vitest、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-03-soft-garden-integration-design.md`

## Global Constraints

- 无新依赖；保留用户已确认的合成配方。
- 不改变场景、文化关联或存档；不进行发布。
- 不覆盖或撤销本工作区已有音效调试台工作。

## Review Focus

- 长于 0.5 秒的结果音应能解码并完整调度。
- 结果音不能被同一次操作的导航声叠加或覆盖。
- 写盘失败不能播放保存成功提示。
- 静音、后台和失焦取消音频且不延迟补播。
- Web 和 Expo 离线文件必须与来源清单一致。

## Task 1: 素材及播放接入

Files: `design/audio/soft-garden-v1/generate.mjs`, `assets/ui-sounds/soft-garden-v1/*`, `packages/app/src/ui-sound-assets.ts`, `packages/app/src/ui-sounds.ts`, `packages/app/src/App.tsx`, `scripts/prepare-app-assets.mjs`。

- [x] 更新结果音调度回归并确认旧实现失败；更新离线素材和成功写入检查。
- [x] 导出可复用合成函数和新文件／来源清单；十个唯一 WAV，notice 复用 select。
- [x] 更新共享映射、长音解码预算、结果音路由与完整时长优先级。
- [x] 运行针对性回归并更新实际浏览器核验脚本和说明。

## Task 2: 验证与交付

- [x] 两宿主离线素材哈希及预算检查；完整 App 测试、Web 构建、移动端类型检查。
- [x] 实际浏览器验证新文件、结果操作、静音、后台和调试提示。
- [x] 审阅最终改动并处理发现；同步场景测试签名与验证记录。

## 验证记录

- App：63 文件、1,514 项测试通过；旧 `soft-feedback` 测试边界补齐实际 WAV 字节、解码头信息和用户手势准备，保留原业务断言并明确检查新音效时长。
- 离线打包：3 项通过；Web／Expo 十段文件及来源清单哈希一致，382,520 字节。
- `npm run build`、移动端 TypeScript、158 个场景测试签名和 diff 格式检查通过。构建仅有既有的大 chunk 警告。
- 真实 Edge：20 项 UI 生命周期／操作检查，新保存声音在实际持久化后只播放一次且时长 520 ms；十段 WAV 均解码成功。调试台另有 9 项隔离、路径提示、静音与布局检查通过。
- 独立审阅确认生成 WAV 与 0.45 倍配方逐字节一致，原始配方与用户已试听文件一致；脚本旧路径断言已修正，未发现其余重要问题。
- 日志在 `artifacts/audio-design/soft-garden-v1/`；浏览器报告分别在 `artifacts/ui-sounds/verification/` 和 `artifacts/audio-inspector/`。未执行正式移动端构建或发布。

## 用户确认后的清理

用户进一步要求只保留新声音并提交、合并、推送。已删除旧八段 WAV、旧构建脚本、许可副本和素材清单，并更新当前素材说明；旧发布版本的来源与许可仍可通过 Git 历史追溯。活动素材目录只保留 Soft Garden 十段文件及其生成、来源记录。

首次清理时，本地 `artifacts/ui-sounds/` 历史下载缓存的递归删除被环境自动审批拒绝。用户随后要求继续清理全部可清内容；再次核对明确路径、不含目录链接后，已成功删除四个旧下载目录和旧 `verification/notice.wav`。原始机器可读清单、研究记录及新 Soft Garden 验证素材保留。独立审阅确认没有遗漏活跃引用或混入无关文件。
