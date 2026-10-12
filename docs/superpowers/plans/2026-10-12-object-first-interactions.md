# Object-first Scene Interaction Plan

> Use executing-plans for shared rendering/UI and dispatching-parallel-agents for disjoint scene groups; request a fresh final reviewer.

**Goal:** Make every scene's actual object action discoverable, with accessible auxiliary buttons.
**Architecture:** Scene objects own enabled metadata. Render style owns projected passive hints and disposal. No change to persistence or settlement.
**Spec:** docs/superpowers/specs/2026-10-12-object-first-interactions-design.md

## Tasks
- [x] Write failing projection/visibility/hover/teardown tests; add shared interaction-cues module and runtime render hook.
- [x] Annotate eight recent craft/light modules with real action sources/targets and current-state labels.
- [x] Annotate five entrance/well/wheel/water/wreath modules; verify real gesture alignment.
- [x] Annotate five paper/chime/lantern modules; verify current-state cues and suppress during movement.
- [x] Add woodfish cue against the live hit body, respecting active/disabled/reduced motion.
- [x] Style passive in-scene hints and accessible secondary action buttons; preserve input controls and keyboard.
- [x] Run 19-scene screenshots/GPU loops, actual direct gesture flows and narrow-screen cue bounds.
- [x] Full tests, Web build, mobile export, independent review and fixes.
- [x] Prepare verified UI changes on the feature branch; keep the earlier scene batch ancestry.

## Review Focus
- No cue from decorative/inactive/completed objects, no misleading offscreen points.
- Cue layer cannot consume pointer events or change game progress, wishes or drag ownership.
- Dynamic scenes/pack replacement remove old nodes; exit removes listeners and restores cursor.
- Source labels stay legible at 320px; current drag keeps target visible; reduced motion stays static.
- Low-emphasis buttons retain 44px hit area, semantic accessible name and visible focus.

## Verification
- `npm test`: 884 tests passed; projected cues, ownership, cancellation, pause/resume and restored phases included.
- `npm run build`: TypeScript and Web production build passed.
- `npm run mobile:verify`: Android/iOS native and DOM exports passed; offline asset and widget cover hashes verified.
- Browser: all 19 initial scenes checked at 320/390/1280px for passive hints, bounded labels, static reduced motion, 44px auxiliary controls and cue disposal.
- Five physical flows used the displayed cue coordinates directly; source hints disappeared after the physical phase.
- Existing eight craft/light scenes: 24 browser flows, 100 captures, eight direct gestures and three return routes passed with no errors.
- 19-scene environment loop: no runtime external requests or browser errors, all 21 GPU contexts released.
- Independent review: final source/target rays, pointer ownership, cancellation, scrolling and keyboard routes passed after fixes.
