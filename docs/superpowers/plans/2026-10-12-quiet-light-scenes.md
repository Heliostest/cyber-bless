# Quiet Light Scenes Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for shared code and integration, superpowers:dispatching-parallel-agents for the three disjoint scene folders, then a fresh whole-branch reviewer.

**Goal:** Add four distinct playable objects grounded in their craft references.

**Architecture:** Existing lazy SceneModule and 0–3 checkpoints. Scene runtime owns environment/rendering; App owns wishes and settlement. A new object-pointer helper owns safe gestures for these four modules.

**Tech Stack:** Three.js, React, Vitest, Playwright, Expo DOM.

**Spec:** `docs/superpowers/specs/2026-10-12-quiet-light-scenes-design.md`

## Global Constraints
- No dependencies or runtime external asset requests.
- Restoration is silent; checkpoints and completion are idempotent.
- Pause, reduced motion, keyboard/button fallback and full disposal.
- Shape and interaction of the two lights must remain visibly distinct.

## Review Focus
- Outside-first and outside-second multiple pointers, action clicks while dragging, pointer cancellation and lost capture.
- Paused gesture resume and typed submission while inactive.
- Restore every checkpoint without duplicate saved wishes or settlement.
- Dynamic geometry and every texture/light/context/listener released.
- 320px target usability and readable controls, no canvas/form overlap.

### Task 1: Shared safe object pointer
**Files:** Create `packages/scenes/src/object-pointer.ts` and `.test.ts`.
**Interface:** `createObjectPointer(layer, {isActive, canStart, onStart, onMove, onRelease, onCancel})` returns `{cancel, isBusy, dispose}`. Coordinates are client x/y. Global pointer tracking, object-only touch claiming, matched listener disposal. `cancel()` clears state on pause.
- [x] Add real DOM input tests, run red, implement and verify green.

### Task 2: Four modules
**Files:** `packages/scenes/src/{ema-votive-plaque,clootie-well-rag,diya-oil-lamp,votive-candle-catholic}/{index.ts,scene.ts,scene.test.ts}`.
**Interface:** Existing SceneContext→SceneInstance. Functions createEmaVotivePlaque, createClootieWellRag, createDiyaOilLamp, createVotiveCandleCatholic.
- [x] Tests first: 0–3, restore, real rays, pause/reduced motion, exactly-once callbacks and disposal.
- [x] Build recognizable forms and all visible checkpoints; invoke pointer.cancel() on inactive update, guard fallback with pointer.isBusy().
- [x] Run each module suite and visual acceptance.

### Task 3: Integration
**Files:** core daily-scenes, scene registry, App engines/icons/styles/placement/narratives, cozy-environment, acceptance scripts.
- [x] Add failing catalog/pool/icon tests.
- [x] Register four scenes, two per daily pool, descriptions and environment profiles.
- [x] Run complete npm test and build.

### Task 4: Acceptance and commit
- [x] 320/390/1280 screenshots, direct actions, wishes/restoration and all19 resource loops.
- [x] Android/iOS offline export check.
- [x] Fresh branch review, fix demonstrated issues and verify.
- [x] Commit feature branch and report previous master push separately.
