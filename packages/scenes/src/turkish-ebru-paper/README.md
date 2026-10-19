# 浮彩成笺 / Turkish Ebru paper

An original contemporary public craft appreciation: a shallow copper tray, floating teal/coral/ochre pigment, a wooden comb with nine metal pins, and a flexible sheet. There is no miniature table or display board. This is an abbreviated appreciation of paper marbling, not a religious ceremony, complete craft lesson, or claim of efficacy.

## Source and original interpretation

The [source card](../../../../content/traditions/turkish-ebru.md) and [2026-10-19 source audit](../../../../docs/research/2026-10-19-scene-culture-audit-c.md) record the read Ebru section of the Turkish culture ministry's French information page, supporting pigment on prepared liquid and transfer to paper. The UNESCO entry could not be re-read on that date because of human verification; its index is not treated as a newly read primary text. The procedural palette and flow field here are original. No source photographs, traditional motifs, music, or third-party assets are copied. The public craft has its own `turkish-ebru` tradition card.

## Physical interaction and checkpoints

0. Drag the actual wooden comb grip right. Its pins move through the liquid while a bounded inverse flow field deforms the floating pigment. Accepted settling clears the comb and lays the blank sheet onto the liquid.
1. Grab any visible part of the paper and pull upward. The authored peel starts at the near edge while the far strip remains in contact during the early pull. The sheet reveals its printed underside as it lifts. This forgiving pickup area is a product interaction choice.
2. Tap the printed paper to quietly observe, or explicitly submit an optional wish.
3. Completed pose.

The paper and floating pattern use identical UV coordinates and one shared procedural texture. The underside remains blank until full contact. At contact its immutable blank material is replaced with the immutable mapped material; this is compatible with the host's cached soft-toon materials. The covered water layer is omitted at contact to prevent coplanar depth conflict. The blank upper face and printed underside retain opposite culling, so the pattern is exposed by the sheet's actual geometry.

The prepared paper curl, comb flow, and peel are authored geometric approximations. They do not simulate fluid viscosity, pigment chemistry, capillary absorption, or exact paper inextensibility. Sound is restrained original feedback, not a traditional composition.

## Capture contract

| Checkpoint | Mesh | Local cue anchor | Screen gesture |
| --- | --- | --- | --- |
| 0 | `ebru-comb-grip` | `[0, 0, 0.09]` | `[60, 0]` |
| 1 | `ebru-paper-blank` | initially `[0, 0.45, 0.7125]`, follows sheet UV `[.5,.125]` | `[0, -60]` |
| 2 | `ebru-paper-print` | `[0, 1.6, 0.28]` | tap |

The mesh vertices of the sheet are deformed in subject coordinates; its final quiet anchor therefore uses the raised sheet coordinates. Subject group: `ebru-subject`. Floating pigment: `ebru-floating-pattern`. Blank paper top: `ebru-paper-blank`. Paper underside: `ebru-paper-print`. Moving tool: `ebru-comb`.

Each cue hits the nearest opaque rendered surface at 284×390, 350×408, and 1280×600. The peel cue is inset onto exposed paper, away from the front rim. Pickup accepts either rendered paper face or the existing small paper-edge mesh, rather than only the .82-unit central edge strip. It does not add invisible geometry or reach through the tray rim or another opaque object. A deliberate drag needs actual movement and at least 40px along the intended axis; 60px reaches the authored pose. Wrong starts, short, reverse, cross-axis, backtracked, cancelled and multitouch inputs do not advance. A native 44px action button supports Enter/Space.

## Lifecycle and verification

Checkpoints 0–3 and returning visits restore silently. Progress commits only after settling; reduced motion produces identical final geometry. Pauses freeze accepted transitions, while blur/cancel/lost capture discard partial input. Callback reentry is guarded, including input injected outside the hit layer and pause/resume boundaries during preparation. A callback lifecycle version also suppresses stale sound, haptic and completion continuations when the host synchronously pauses/resumes or blurs/refocuses. Quiet observation and returning visits never save wish drafts; explicit submission trims and saves once. A committed wish still reports progress atomically after a host pause, while stale feedback is suppressed. Both immutable underside materials, the shared texture, geometry, UI, cues, listeners, feedback, lights and renderer are disposed exactly once.

Run `npm run test -w @wbr/scenes -- src/turkish-ebru-paper/scene.test.ts`. The tests retain real Three geometry, raycasting, interaction cues, the actual wish form, and an explicit real soft-toon adapter regression; only GPU rendering is substituted. They include six pickup points over three viewport sizes, following the grab before release, and rejecting the rim and an opaque blocker. `node scripts/verify-ebru-paper-pickup.mjs` checks the actual scene-review App with mouse and native Chrome touch on the running development server. See the [pickup repair record](../../../../docs/research/2026-10-19-ebru-paper-pickup.md) for the verification and source boundaries.
