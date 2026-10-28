# Drag Regression Recovery Plan

> **For agentic workers:** Use superpowers:executing-plans, systematic-debugging and test-first regression verification.

**Goal:** Fix the remaining drag regression and translation registration failures, then pass root `npm test` and `npm run build`.
**Architecture:** Preserve the current continuous placement and inspection design. Separate stale test contracts from pointer/geometry defects; keep source ownership disjoint between App, scenes and i18n.
**Tech Stack:** TypeScript, Three.js, Vitest, React, existing i18n scripts.
**Spec:** User request in this chat; current scene contracts in README and `docs/superpowers/plans/2026-10-28-continuous-inspect-placement.md`.

## Global Constraints

- Preserve the existing dirty worktree and audio changes. No resets, skipped tests, weakened completion/cancellation assertions or unrelated commits.
- Follow `docs/scene-provenance.md`; this repair preserves current objects, culturally reviewed actions, copy meaning, provenance and save IDs.
- Current translated hints may already be registered by parallel work. Verify before editing; do not overwrite reviewed translations.

## Review Focus

- Pure continuous placement reaches the explicit final checkpoint once, including legacy intermediate saves.
- Mixed workflows preserve meaningful separate operations such as pouring; do not treat every scene as a one-step completion.
- Pausing an unfinished grab cancels it; its stale release must not commit after resume.
- Inspection, touch ownership and pointer end events must not advance another object.
- Root test/build commands must finish green without bypassing i18n or narrowing the suite.

## Tasks

- [x] Reproduce current App and scene failures; classify stale contracts versus actual input defects.
- [x] Verify all i18n registration, eight-language translations, generated artifacts and review hashes.
- [x] Repair only the incorrect tests or production causes, with red/green evidence at the real integration seam.
- [x] Focused scene suites and App lifecycle tests pass; independent review found no P1/P2. The complete App suite is included in the final root run.
- [x] Run root `npm test` and root `npm run build` to exit 0; record totals and any genuine remaining limits.

## Progress

2026-10-28: App lifecycle suite reproduced 19 checkpoint-expectation failures after continuous destination placement. Representative current scene/controller suites pass 236/236. i18n verify and all 42 i18n tests pass without changes. Production build verification is running. No commit or publish requested.

Current diagnosis: root build exits 0. A second scene group passes 530/544 with all 14 failures confined to the aggregate `spatial-placement-c.test.ts`; its old pose targets/next-checkpoint assumptions lag the explicit continuous placement README contracts. Fix ownership is confined to the two aggregate test files; production input and reviewed translations remain intact.

Repair verified: App lifecycle went from 19 failures/76 cases to 109/109 passing; scene aggregate went from 14 failures to 101/101 passing, with another 679 scene/controller tests passing. No production, culture or translation changes were needed. A fresh reviewer checked independent model endpoints, mixed action boundaries, pause rollback and stale-release/once-only assertions without finding material issues. Final root test and build are running with unmodified commands.

First root run: all prior failures cleared; App 1243 passed with one newly exposed stale `czech-bead-star` assembly assertion (expected 1, current contract reports 2). The craft adapter test now separately verifies assembly→2, optional inspection with no checkpoint, pause/old release, and explicit quiet-view→3 for legacy 0/1/2; focused suite 93/93 passed and independent review found no material issue. Root build passed again. A second complete root test is running.

Second root run completed: App 1246/1246 passed; scene scan exposed the remaining five aggregate groups (106 failures, 9629 passes) and one worker notification timeout during concurrent checks. Follow-up focused fixes pass: placement 170/170, directional 106/106, spatial A 150/150, spatial B 290/290. The concurrently updated first-footing production now independently passes 71/71; its App adapter case uses the physical doorway route and only final checkpoint 3. The final root test→build chain now runs exclusively, with no concurrent test suites or source edits.

Final: late inspection-center tests and wagasa/udo adapter contracts were corrected without weakening precision, physical paths or action boundaries; the new wagasa hint was registered in all eight locales with preserved unrelated hashes/evidence. Independent reviews found no P1/P2. Root `npm.cmd test` then `npm.cmd run build` both exited 0: 11,588 Vitest tests in 357 files plus 20 Node script tests (11,608 total), zero failures or skips; assets, i18n, TypeScript and Vite all pass. Root logs and detailed history: `docs/research/2026-10-28-drag-test-recovery.md`. No commit or publication requested/performed.
