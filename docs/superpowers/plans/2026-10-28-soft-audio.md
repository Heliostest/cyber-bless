# Soft Audio Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans with parallel independent implementation and final review.

**Goal:** 补齐轻柔可爱的结果音和主要操作音，统一现有音效开关。
**Architecture:** 共享合成器复用调用方 AudioContext；App 管结果音与木鱼，场景 helper 管操作音。
**Tech Stack:** TypeScript, Web Audio, React, Vitest, Playwright.
**Spec:** `docs/superpowers/specs/2026-10-28-soft-audio-design.md`

## Global Constraints

- 当前分支 `codex/ritual-shader-filmstrip` 有用户其它工作，原地增量修改，不撤销或提交无关差异。
- 无新增依赖、录音下载、文化主张或场景可见性变动。
- 先测试失败再实现；活读音效开关；恢复不补播；资源回收、音量/并发受限。

## Review Focus

- 重复 checkpoint／重新打开已完成场景不能再次响完成音。
- 无效或失败写入不能响保存成功；幂等动作不重复响。
- 正在排程时静音／后台须停止；恢复不响旧声音。
- 指针取消、错误目标、暂停不能产生操作成功反馈。
- 旧 AudioContext 测试边界和无声音宿主继续工作，不破坏内容音频包。

## Tasks

### Task 1: Shared sound synthesis

Files: `packages/shared/src/soft-audio.ts`, `soft-audio.test.ts`, `index.ts`.
Interface: `createSoftSoundPlayer({context,enabled})` → `play(SoftSound,{duration?,strength?})`, `stop()`, `dispose()`.
- [x] Write failing scheduling, gate, bounds, concurrency and resource tests; run `npm run test -w @wbr/shared`.
- [x] Implement bounded gentle tonal/noise voices; run the same tests.

### Task 2: App result sounds and woodfish

Files: `packages/app/src/App.tsx`, `scene-experience.tsx`, `ritual.tsx`, new behavioral tests.
Consumes Task 1 sound player; completion is only a new progress transition, saves only accepted new actions, collection only explicit collection/flight.
- [x] Add failing real-App tests for completion, save, collect, duplicate/restore, mute/background.
- [x] Integrate shared cues and replace woodfish fallback; run relevant App tests.

### Task 3: Scene operation sounds

Files: `procedural-kit.ts`, crane and six identified scene modules, tests, affected README appendices.
Consumes Task 1; adds `createSceneFeedback.sound` and `stop` while preserving old tone API.
- [x] Add failing lifecycle/gesture/audio tests; run focused scene tests.
- [x] Add paper, water, wood contact and beans aligned to animation; validate reduced-motion and restore. Fish utensils keep existing stage tones because no matching water/contact appears.

### Task 4: Integration and review

- [x] Run complete `npm test`, build, and browser coverage; record actual limitations/failures. Root tests fail at 17 hourly placement cases; root build rerun sees 2 unrelated i18n drift issues. Latest production code build/mobile typecheck and all audio tests pass.
- [x] Fresh agent review and fix material issues with regression evidence.
- [x] Record source/culture non-impact checklist and final verification in research note.

## Progress

2026-10-28: design and interfaces fixed from the user's approved order. Tasks 1 and 3 delegated with disjoint file ownership; Task 2 inline. No commit or publish requested.

2026-10-28 final: all feature tasks implemented. 68 new audio tests plus retained helper checks pass; five real browser scenes and eight rendered WAVs pass. Review findings (legacy haptic and local woodfish audio cancellation) fixed and independently rechecked. Full-repo exceptions and old-helper attribution evidence are recorded in `docs/research/2026-10-28-soft-audio.md`; no claim of a green full repository suite.
