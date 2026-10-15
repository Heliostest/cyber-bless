# 浮彩成笺 / Turkish Ebru paper

An original contemporary public craft appreciation: a shallow copper tray, floating teal/coral/ochre pigment, a wooden comb with nine metal pins, and a flexible sheet. There is no miniature table or display board. This is an abbreviated appreciation of paper marbling, not a religious ceremony, complete craft lesson, or claim of efficacy.

## Source and original interpretation

[UNESCO, Ebru, Turkish art of marbling, 00644](https://ich.unesco.org/en/RL/ebru-turkish-art-of-marbling-00644), checked 2026-10-15 through its indexed entry, describes applying pigment onto prepared water and transferring the pattern to paper. The broad process is also corroborated by the [Turkish National Commission for UNESCO](https://www.unesco.org.tr/Home/Page/1980?slug=List-of-the-Intangible-Cultural-Heritage-of-T%C3%BCrkiye). The procedural palette and flow field here are original. No source photographs, traditional motifs, music, or third-party assets are copied. The public craft has its own `turkish-ebru` tradition card.

## Physical interaction and checkpoints

0. Drag the actual wooden comb grip right. Its pins move through the liquid while a bounded inverse flow field deforms the floating pigment. Accepted settling clears the comb and lays the blank sheet onto the liquid.
1. Pull the near paper edge upward. Peeling starts at that edge while the far strip remains in contact during the early pull. The sheet reveals its printed underside as it lifts.
2. Tap the printed paper to quietly observe, or explicitly submit an optional wish.
3. Completed pose.

The paper and floating pattern use identical UV coordinates and one shared procedural texture. The underside remains blank until full contact. At contact its immutable blank material is replaced with the immutable mapped material; this is compatible with the host's cached soft-toon materials. The covered water layer is omitted at contact to prevent coplanar depth conflict. The blank upper face and printed underside retain opposite culling, so the pattern is exposed by the sheet's actual geometry.

The prepared paper curl, comb flow, and peel are authored geometric approximations. They do not simulate fluid viscosity, pigment chemistry, capillary absorption, or exact paper inextensibility. Sound is restrained original feedback, not a traditional composition.

## Capture contract

| Checkpoint | Mesh | Local cue anchor | Screen gesture |
| --- | --- | --- | --- |
| 0 | `ebru-comb-grip` | `[0, 0, 0.09]` | `[60, 0]` |
| 1 | `ebru-paper-edge` | `[0, 0.021, -0.05]` | `[0, -60]` |
| 2 | `ebru-paper-print` | `[0, 1.6, 0.28]` | tap |

The mesh vertices of the sheet are deformed in subject coordinates; its final quiet anchor therefore uses the raised sheet coordinates. Subject group: `ebru-subject`. Floating pigment: `ebru-floating-pattern`. Blank paper top: `ebru-paper-blank`. Paper underside: `ebru-paper-print`. Moving tool: `ebru-comb`.

Each cue hits the nearest opaque rendered surface at 284×390, 350×408, and 1280×600. The paper-edge anchor sits behind the front rim rather than behind its occlusion. A deliberate drag needs actual movement and at least 40px along the intended axis; 60px reaches the authored pose. Wrong starts, short, reverse, cross-axis, backtracked, cancelled and multitouch inputs do not advance. A native 44px action button supports Enter/Space.

## Lifecycle and verification

Checkpoints 0–3 and returning visits restore silently. Progress commits only after settling; reduced motion produces identical final geometry. Pauses freeze accepted transitions, while blur/cancel/lost capture discard partial input. Callback reentry is guarded, including input injected outside the hit layer and pause/resume boundaries during preparation. A callback lifecycle version also suppresses stale sound, haptic and completion continuations when the host synchronously pauses/resumes or blurs/refocuses. Quiet observation and returning visits never save wish drafts; explicit submission trims and saves once. A committed wish still reports progress atomically after a host pause, while stale feedback is suppressed. Both immutable underside materials, the shared texture, geometry, UI, cues, listeners, feedback, lights and renderer are disposed exactly once.

Run `npm run test -w @wbr/scenes -- src/turkish-ebru-paper/scene.test.ts`. The tests retain real Three geometry, raycasting, interaction cues, the actual wish form, and an explicit real soft-toon adapter regression; only GPU rendering is substituted. Root integration owns browser mouse/keyboard/native touch verification and full repository checks.
