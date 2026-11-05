# Ritual Interaction Improvements Implementation Plan

> **For agentic workers:** Use `superpowers:dispatching-parallel-agents` for the independent scene domains and integrate in the current isolated worktree. Write behavior tests before implementation.

**Goal:** Implement all five scene improvements and manual close inspection accepted by the user on 2026-11-05.

**Architecture:** Keep existing Three.js models, host contracts, IDs, engines and three-checkpoint saves. Make play repeatable and responsive within the existing scene lifecycle; use explicit finishing/physical replacement to complete. Change shared close inspection to remain open by default.

**Tech Stack:** TypeScript, Three.js, Vitest/jsdom, eight locale catalogs.

**Spec:** The user's “都改进了吧” accepts the preceding assessment: paper pinwheel pickup/free spin/put back; mallet pickup/continuous shake/replace; hanging nazar and martisor remain playable after hanging until explicitly finished; independently responsive castanets; shared close inspection waits for continue.

## Global Constraints

- Read `docs/scene-provenance.md` and affected source cards/READMEs. Added handling is product behavior; preserve supported cultural context and do not invent traditional orders or powers.
- Preserve earlier uncommitted furin flow work; do not commit, merge or push during this request.
- Preserve IDs, engines, completed legacy saves, pause/focus/disposal guards, reduced motion, touch and keyboard/button alternatives.
- New text belongs in all eight catalogs; root owns localization generation and shared files.

## Review Focus

- Cancelled/second-pointer gestures must not advance or emit completion.
- Pausing or disposing during callbacks must prevent subsequent feedback/progress.
- Old completed saves must mount complete without replay or awards.
- Repeatable playing must remain available without per-action animation locks.
- Finishing and continuing must not share a double-click tail with a new action.

### Task 1: Shared inspection (root)

Files: `packages/scenes/src/close-inspection.ts`, its tests and affected automatic-inspection fixtures.
- [x] Test default viewing remains open after twelve seconds; explicit continue restores camera/actor and hands off once.
- [x] Make auto-return opt-in; preserve explicit `autoReturn: true` capability.
- [x] Run shared inspection and placement regression tests; update fixtures to continue explicitly.

### Task 2: Continuous toys (toys agent)

Files: `paper-pinwheel/`, `uchide-wishing-mallet/`, local tests/READMEs and their source cards.
- [x] Write failing tests for repeated play without forced completion, velocity/movement response, explicit replacement, restore/cancel/pause/reduced motion.
- [x] Implement pickup, continuous play, physical return/button finish; keep three durable checkpoints and old completed saves.
- [x] Verify local tests and scene typecheck; report changed text and affected legacy fixtures to root.

### Task 3: Playable hanging ornaments (hanging agent)

Files: `turkish-nazar-bead/`, `romanian-martisor/`, local tests/READMEs and source cards.
- [x] Write failing tests for hanging without immediate completion, repeated post-hang interaction, explicit finish, restored completed saves and lifecycle guards.
- [x] Preserve close inspection and placement; record hung as checkpoint 2 and explicit finish as 3; keep post-hang motion anchored at the actual support.
- [x] Verify local tests/typecheck; report text and affected fixture expectations to root.

### Task 4: Responsive castanets (castanets agent)

Files: `spanish-castanets/`, local tests/README and source card.
- [x] Write failing tests for independently playable left/right shells, rapid alternation and contact feedback, no animation lock, explicit finish and lifecycle guards.
- [x] Implement continuous per-side press/release behavior with accessible alternatives and stable geometry.
- [x] Verify local tests/typecheck; report text and affected fixture expectations to root.

### Task 5: Integration (root)

Files: locale source/catalog/generated files, scene narratives/intentions when needed, shared regression tests, research record, generated testing revisions.
- [x] Review every scene diff against the accepted behavior and provenance.
- [x] Register changed text in eight locales; preserve original factual narrative paragraphs, update only product instructions.
- [x] Run full repository tests, production build and revision consistency; fix meaningful failures.
- [x] Browser-check all five scenes plus manual viewing, save screenshots and leave preview available.
- [x] Record results and any limits in research; report the delivered behavior without claiming unrun verification.
