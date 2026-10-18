# Opening Rituals Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement inline. Steps use checkbox syntax for tracking.

**Goal:** First-time players complete two random blessing scenes and one wish scene, then enter a populated Today page.

**Architecture:** Persist an optional opening state in the existing version-1 save. Reuse SceneExperience with an opening visit flag, atomic ordered collection, and one compact guide per stage. Reuse dailyCollectedPicks; opening keepsakes are immediately eligible. Share the first-day daily exclusion with widgets.

**Tech Stack:** TypeScript, React, existing core reducer, Vitest, Vite.

**Spec:** ../specs/2026-10-18-opening-rituals.md

## Global Constraints

- Existing saves remain valid and bypass the opening; only a null host save starts it.
- Exactly two distinct blessing scenes followed by one wish scene, all bundled and offline.
- No scores, forced wish text, account, or network dependency.
- Keep guides outside the 3D subject and reuse existing visual tokens.
- Continue in the existing user-authorized workspace; preserve unrelated changes and do not publish.

## Review Focus

- Interrupted or reloaded walks resume the same queue and completed checkpoints.
- Repeated completion events and taps do not duplicate keepsakes or skip stages.
- Legacy saves, including empty saved states, keep their existing navigation.
- Crossing midnight still produces a distinct daily scene and consistent widget links.
- Optional wish writing and scene load errors never trap the player.

## Task 1: Durable ordered opening and daily selection

**Files:** Create packages/core/src/opening.ts and opening.test.ts; modify index.ts, daily-scenes.ts, widgets.ts and widgets.test.ts.

**Interfaces:** OpeningState (new/active/complete), chooseOpeningScenes(entries, random), openingCollectibleId(sceneId), openingExclusions(opening, day); reducer opening.start, opening.collect, opening.finish. dailyPrimaryScene accepts optional excluded IDs. Widget snapshots may include the public opening day and scene IDs.

- [x] Write and run failing tests for 2+1 distinct selection, sequential actual completion, idempotency, restore, legacy/null distinction, and first-day exclusions across midnight.
- [x] Implement reducer validation and persistence. Collect only after the scene record reaches its last checkpoint; grant and advance together.
- [x] Add widget parity tests and shared exclusions. Run core and runtime suites (44 + 10 passing).

## Task 2: Guided play through existing scenes

**Files:** Create packages/app/src/opening.tsx and opening.test.ts; modify App.tsx, context.tsx, scene-library.tsx, scene-experience.tsx, home.tsx, widget-navigation.tsx and style.css.

**Interfaces:** Route/SceneVisit opening?: boolean; Opening, OpeningGuide, OpeningDone components. Opening replaces Today only while the persisted opening is unfinished. Opening visits resume completed or partial checkpoints without daily rewards.

- [x] Write and run failing integration tests for the complete three-scene flow, refresh/resume, optional wishes and same-day homepage replay cards.
- [x] Implement compact entry/transition/summary screens, nonblocking scene guide, ordered collection CTA, and deferred widget navigation.
- [x] Update existing fresh-host navigation fixtures to represent legacy users where those tests exercise ordinary navigation. Run app tests (627 passing before additional wish/widget coverage).

## Task 3: Review and verification

- [x] Run relevant full suites and production build; check diff whitespace. All eight workspaces passed, including 2,922 scene tests; final app suite has 630 passing tests. Mobile typecheck and 15 widget integration checks pass.
- [x] Review state validation, duplicate actions, missing scenes, back navigation and date rollover. Independent review found Android's exact root-key check incompatible with opening metadata. Added a failing real parser test, then validated the optional public metadata and preserved strict privacy checks: all 11 JVM tests pass. Browser QA found the progress badge selector also positioning the icon; a rendered CSS regression failed before the fix and passes after it. No remaining Critical/Important or minor findings.
- [x] Verify first-time play in an isolated per-tab session preview, preserving the user's real browser records. Played all three real scenes, reloaded the third at checkpoint 1, saved an optional preview wish, and verified three immediate replay cards plus a distinct daily scene. Saved opening-completed-home.jpg and prepared a fresh /opening-preview tab at step one.

## Progress

- Planning: checked existing reducer, scene completion, replay selection, and widget projection. Selection and reward changes share a single core contract; no independent implementation tasks are delegated.
- Native parser verification uses an isolated JVM harness with real production parser/catalog and tests; Android drawable IDs are stubs. This is not an installed Android/iOS device validation.
