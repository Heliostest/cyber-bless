# Four Craft Scenes Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans for integration, and superpowers:dispatching-parallel-agents for the independent scene folders. One fresh review checks the completed branch.

**Goal:** Ship four independently playable scenes with recognizable craft objects and the existing cozy environment.

**Architecture:** Each scene owns its geometry, gestures and three-step state. The existing scene runtime owns loading and visibility; the App owns wishes and reward settlement. Scene metadata remains safe to import into native code.

**Tech Stack:** Three.js, React, Vitest, Playwright, existing Expo DOM.

**Spec:** `docs/superpowers/specs/2026-10-12-four-craft-scenes-design.md`

## Global Constraints

- No new dependencies, external runtime asset requests or game assets.
- Three integer checkpoints (0–3), no save/progress effects while restoring.
- `returning?: boolean` is optional and backwards compatible.
- Respect pause, reduced motion, keyboard fallback, touch cancellation and full disposal.
- Cultural descriptions are product adaptations grounded in the existing topic cards.

## Review Focus

- Repeated click/drag completion must settle each checkpoint and wish once.
- Restoring steps 1–3 must restore visible objects and leave callbacks silent.
- Pointercancel/multiple pointers must not finish a craft action.
- Narrow-screen object targets must remain within the scene canvas and leave empty space scrollable.
- Daruma's second eye belongs only to the explicit returning branch, including reload/reopen.

### Task 1: Four independent scene modules

**Files:** Create `packages/scenes/src/{daruma-eye-painting,mizuhiki,milagros,phuang-malai}/{index.ts,scene.ts,scene.test.ts}`.

**Interfaces:** Consume `SceneContext`, shared procedural kit, gestures; produce `SceneModule` with matching id and topic slug, C grade, independent interaction and `SceneInstance` lifecycle. Daruma consumes optional `ctx.returning`.

- [x] Add failing behavioral tests for all three checkpoints, restoration, paused/reduced-motion input, idempotent completion and cancellation.
- [x] Build source-informed, rounded 3D objects and guided gestures; buttons perform the same actions.
- [x] Mount with `createWarmStage`, `createDebugRenderStyle`, `CEL_STYLE`, shared sound/haptic feedback; release every owned texture, geometry, light and listener.
- [x] Run each module's tests and inspect its three visible states.

### Task 2: Catalog, host, environment and UI integration

**Files:** Modify `packages/scenes/src/{contract.ts,registry.ts}`, `packages/core/src/daily-scenes.ts`, `packages/app/src/{scene-engines.ts,scene-experience.tsx,procedural-scene.ts,scene-icons.tsx,style.css}`, and `packages/scene-runtime/src/cozy-environment.ts`.

**Interfaces:** Host passes `returning: Boolean(returnWish)` to the procedural adapter/context. New engines use `<id>@1`. All four ids join WISH_SCENE_IDS and builtInScenes, retaining the shared existing settlement path.

- [x] Add failing catalog/scene icon tests and verify returning reaches a scene without enabling duplicate saving.
- [x] Register all modules/engines, narratives, drawn icons, palettes and environment profiles; extend exact catalog expectations intentionally.
- [x] Verify old daily picks, primary settlement, returning and local resources still work.
- [x] Run `npm test` and `npm run build`.

### Task 3: Visual acceptance and final review

**Files:** Extend `scripts/preview-cozy-scenes.mjs` and create `scripts/test-craft-scenes.mjs`; record source/validation results in the spec.

- [x] Capture all four at 390px, 320px and desktop; exercise direct gestures and keyboard/button completion.
- [x] Verify progress restoration, pause, reduced motion, returning eye and one-time wish saves; verify GPU resources return to zero.
- [x] Run `npm run mobile:verify` for local assets in both exported DOM bundles.
- [x] Request an independent branch review, fix confirmed issues and rerun affected tests.
- [x] Commit the finished new-scene batch on its feature branch; report the previous master push separately.
