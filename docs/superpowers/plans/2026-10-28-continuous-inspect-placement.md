# Continuous pickup, inspection and placement

**Goal:** audit every scene for hanging/carrying interactions split into artificial intermediate checkpoints; replace those with continuous pickup, optional free inspection and the real final placement.

**User direction:** all similar cases, starting with `turkish-nazar-bead`. Rotation is optional, never a mandatory full revolution. Preserve distinct actions such as assembling, tying, dipping, pouring, writing, returning an old object, receiving a new object and prescribed ritual orientations.

## Implementation

- [x] Audit all scene entry points, with detailed A–M and N–Z records and reasons to retain meaningful stages.
- [x] Add an opt-in free placement pointer: one finger/primary mouse translates, two fingers or Shift/right drag rotates, with complete gesture ownership and cancellation. Preserve the existing default object pointer for other interactions.
- [x] Extend the existing pose placement helper with rotate/rebase/release while retaining authored transforms, anchors, physical target checks and final seating.
- [x] Merge pure carrying phases into one final target; map old 0/1/2 checkpoints to resumable source poses and report only the existing final checkpoint once.
- [x] Merge carrying portions around meaningful actions without skipping those actions; preserve hand/water/cloth synchronization.
- [x] Remove the prayer-flag screen rail while keeping its two real cord endpoints and cloth/cord geometry; remove arbitrary forced inspection angles.
- [x] Add shared discoverable inspection hints and keyboard support on the existing auxiliary control.
- [x] Update affected scene READMEs, source-card product descriptions, translations and research records. No new claims of traditional gestures, counts, efficacy or provenance.
- [x] Verify tests before and after each change, run project checks/build, independently review, then test real browser touch/mouse/keyboard pickup, a complete optional turn and final hang.

## Constraints and expected behavior

- No ID, engine or historical progress-schema changes. Core progress permits a direct jump to the existing final checkpoint; do not manufacture intermediate callbacks.
- Off-target ordinary release leaves the object available for inspection and re-grabbing. Explicit cancel, loss of focus or host inactivity restores the saved checkpoint. Resize cancels an unfinished grab before using a new camera plane.
- Rotation never completes placement; settling restores the authored final orientation and real support/contact geometry.
- Retain topmost visible-object hit checks, foreground obstruction, grouped parts, shared material ownership, reduced-motion behavior, host callback reentrancy and completion exactly once.
- Existing pending changes from other work remain intact. Work directly in the current checkout because these scene/material changes are the required starting state.

Detailed scope and source-impact decisions are recorded in `docs/research/2026-10-28-continuous-placement-audit-{a,b,c}.md` and `docs/research/2026-10-28-continuous-placement.md`. Final coverage: 154 audited entries, 28 improved scenes; complete project tests, production build, offline mobile checks and 84 browser checkpoint cases passed. No commit or publication was requested.
