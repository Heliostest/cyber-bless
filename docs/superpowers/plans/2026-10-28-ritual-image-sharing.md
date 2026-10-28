# Ritual Image Sharing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Share a locally generated PNG of a completed ritual through system sharing or browser download.

**Architecture:** Capture a freshly rendered Three.js frame through the shared renderer and compose a 1080×1350 card. A shared preview UI calls the optional native Host capability, otherwise Web Share files; downloads remain available. Keep transient snapshots outside saved state.

**Tech Stack:** React DOM, Canvas 2D, Three.js, Expo DOM, expo-file-system, expo-sharing, Vitest.

**Spec:** docs/superpowers/specs/2026-10-28-ritual-image-sharing.md

## Global Constraints

- PNG dimensions: 1080×1350. Local generation; no upload or automatic sending.
- Scene titles, cultural sources, ritual operations, completion conditions and save format stay unchanged.
- Hide private scene writing during capture and restore it immediately afterward.
- Preserve the existing merge state and edits; do not commit or publish.
- All user visible copy uses the existing eight locale catalogs.

## Review Focus

- Paused/completed renderer: explicitly render before reading pixels.
- Private wishes: exclude DOM and marked meshes, restoring visibility even after failure.
- User activation: prepare preview first, call browser share directly on a later click.
- Cancellation/unsupported platforms: keep preview and download; no false success message.
- Scene navigation/retry: discard transient stale images and avoid capturing another scene.

### Task 1: Frame capture

Files: packages/scene-runtime/src/scene-capture.ts, debug-render-style.ts, index.ts and capture tests; private text marker in mizuhiki/scene.ts.

Produces: `captureSceneImage(root: Element): string | undefined`.

- [x] Write and run failing lifecycle, frame ordering and private mesh restoration tests.
- [x] Implement capture registration at the shared renderer; unregister on disposal.
- [x] Run focused scene-runtime tests.

### Task 2: Native image sharing

Files: packages/runtime/src/index.ts, apps/mobile-expo/App.tsx, BlessingDom.tsx, share-image.ts, dependency lock and tests.

Produces: `ShareImageRequest = {dataUrl: string; fileName: string; title: string}` and `Host.shareImage?(image): Promise<void>`.

- [x] Test invalid PNG payloads, file name safety and supported/unsupported bridge behavior.
- [x] Install SDK57 compatible expo-sharing; write PNG into a dedicated temporary cache and invoke native sharing through the stable DOM host.
- [x] Run boundary tests and mobile typecheck. Keep recent cache files long enough for recipients to read them; remove expired cache.

### Task 3: Card and completion UI

Files: packages/app/src/ritual-share.tsx, ritual-share-image.ts, ritual-share.css and tests; context.tsx, App.tsx, scene-experience.tsx, ritual.tsx.

Consumes: Task 1 capture and Task 2 Host capability.

- [x] Add failing tests for real preview behavior, native/browser file payloads, download, cancellation, failure and unchanged completion flow.
- [x] Compose card with contain framing, localized title and brand; use native dialog for accessible preview.
- [x] Add completion buttons, transient legacy route snapshot and optional Context capability.
- [x] Run focused app tests, renderer tests and build/typecheck where existing conflicts permit.

### Task 4: Localized copy and acceptance

Files: i18n source/catalogs/generated bundles and docs/research/2026-10-28-ritual-image-sharing.md.

- [x] Register and translate new product controls in all eight locales; update privacy wording from text to text/images.
- [x] Compile and validate catalogs; record self-review scope accurately.
- [x] Inspect actual PNG/card layout and mobile viewport in browser; request independent code review and fix findings.
- [x] Record provenance checklist applicability and verification limits.

## Acceptance

Implementation and focused checks are complete; see docs/research/2026-10-28-ritual-image-sharing.md for exact results. Root npm test reaches 1287 passing app tests and one existing ukrainian-didukh feedback failure; i18n verification also reports pre-existing widget generation drift. Native device acceptance remains outstanding. No commit or publication was requested.
