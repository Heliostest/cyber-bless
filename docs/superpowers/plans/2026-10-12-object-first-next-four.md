# Object-first Next Four Scenes Implementation Plan

> Use dispatching-parallel-agents for the three disjoint scene folders; execute the Brigid scene and shared integration inline. Request one fresh final review.

**Goal:** Add four complete Three.js practices with physical object gestures as the primary controls.
**Architecture:** Independent procedural scene modules reuse warm stage, render style, object pointer, projected cues and the existing three-checkpoint contract. Core catalog remains the shared native-safe metadata source.
**Tech Stack:** TypeScript, Three.js, React, Vitest, Playwright, Expo DOM.
**Spec:** docs/superpowers/specs/2026-10-12-object-first-next-four-design.md

## Global constraints
- Closed omamori; no new ritual scoring, storage schema, timers, alerts or remote runtime requests.
- Actual object hit tests and targets; fresh single pointer only; cancellation/pause cannot advance; source/target prompts move with geometry.
- Each physical step has an auxiliary keyboard button using the same action; writing requires explicit submission.
- Restore silently; complete once; returning omamori never saves a new wish; native/browser cleanup complete.

## Tasks
- [x] Merge c05f6f4 and its scene dependency into master, verify 884 tests, push 3173bdf and create feature branch.
- [x] Omamori module/index and real-geometry tests (closed selection, clasp/return target, writing/ack, restore and lifecycle).
- [x] Suzu module/index and tests (rope pull, settle and quiet tap, no arbitrary canvas start, cancellation and silent restore).
- [x] Brigid module/index and tests (four ordered rush placements, hanging and quiet tap, actual targets, restore and cleanup).
- [x] Bokjori module/index and tests (scoop to grain tray, hanging and quiet tap, actual targets, restore and cleanup).
- [x] Register modules in scenes registry, app engine loaders, core catalog/placement, SVG icons and cozy profiles; update corresponding contract tests.
- [x] Browser three-width step captures, displayed-source/target gesture flows, restore and omamori return; update 23-scene allocation loop.
- [x] Full tests, production build, Android/iOS offline verification; independent review/fixes; local feature commit and user-visible preview.

Each module starts with failing behavioral tests and a stub, implements the real visual model and gestures, then verifies the tests. Agents edit only their assigned scene folders; root owns shared integration, scripts and Git.

## Final verification (2026-10-12)
- Existing interactions and their scene dependency were merged and pushed to `master` at `3173bdfa32f6ad9c6a3d2ac97649b56ea2df6d26`; 884 tests passed on that merge tree.
- The new modules have 107 scene tests: Omamori 31, Suzu 30, Brigid 18, Bokjori 28. Final `npm test` passed all 1016 tests (`artifacts/next-four-final-tests.log`).
- Production Web build passed (`artifacts/next-four-build.log`). `npm run mobile:verify` passed Android/iOS native and DOM exports, including offline asset and widget-cover hashes (`artifacts/next-four-mobile.log`).
- Browser QA passed 12 flows at 320/390/1280px with 50 captures, all four flows using the displayed object cues, keyboard alternatives and restore. The actual Omamori return entry spent one vessel and saved only its return note. Final report: `artifacts/next-four-scenes/browser/report.json`, errors empty.
- The 23-scene allocation loop reported no errors or external requests; all 25 WebGL contexts were released and zero remained live (`artifacts/cozy-scenes/next-four/report.json`).
- Independent final review had no outstanding actionable issues. Fixes include Bokjori's tap travel limit, Brigid's stable woven-cross scale/table clearance/hanging-loop alignment and shadow-map disposal, and Omamori's blur cue lifecycle and explicit wish/return gates.
- Real displayed-cue QA exposed a shared 4px border-origin offset. The cue layer now compensates for its host border and scroll position; the border regression and actual return drag pass without changing the return-box geometry or hit area.
- The enlarged catalog exposed unreachable daily entries under the old date digit sum. Primary daily selection now uses a UTC day ordinal; a yearly reachability regression passes. Collected-pick ordering and stored settlement data remain unchanged.
- The new batch is retained on `codex/object-first-next-four-scenes` as a local feature commit. The production preview is available at `http://127.0.0.1:5178/`.
