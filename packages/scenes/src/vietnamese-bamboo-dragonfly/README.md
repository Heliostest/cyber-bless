# 竹蜓点风 · Vietnamese bamboo dragonfly

An original contemporary appreciation of the public bamboo toy craft associated with Thạch Xá, Hanoi. Scene ID `vietnamese-bamboo-dragonfly`; tradition slug `thach-xa-bamboo-dragonfly`; grade C / sensitivity 低. The scene uses physical drags and a quiet final tap; it never creates or saves a wish.

The [Vietnam tourism information centre's craft account](https://nongthon.vietnamtourism.gov.vn/thach-xa-bamboo-dragonfly-village-the-art-of-vietnamese-creativity-in-bamboo/?lang=en) supports the bamboo-strip body, wings and tail, colourful decoration and single-point balance. [Hanoi's culture and sports department](https://sovhtt.hanoi.gov.vn/en/unique-bamboo-dragonfly-made-thach-xa/) describes shaping the head and tail, balancing the proportions of the wings and body, and perching the toy by its beak on a finger or branch. No disputed origin date, religious ritual, or spinning-propeller interpretation is used.

## Original object and visual choices

Four solid, swept bamboo wings are individually modelled. Teal front wings and coral rear wings carry gold borders and oval painted motifs, with warm exposed bamboo beneath. The visible outer ends contain more material and sweep forward and below the beak. A closed, tapered bamboo tail has seven painted bands, and paired dark eyes identify the head. A slim bamboo twig rises from a rounded stone resting at garden floor `y = -.04`. There is no table, display board, concealed support or hidden counterweight.

The camera looks down sufficiently to separate all four wings. It fits every subject vertex across prepared, placed and swaying poses, without moving during the gesture. The host supplies the sunny garden environment; the scene uses the established soft toon rendering and warm light rig.

## Physical interaction anchors

All anchors are local to their named opaque mesh and are verified as the nearest opaque ray intersection.

| Step | Source mesh | Cue anchor | Screen displacement |
| --- | --- | --- | --- |
| 0: place on twig | `dragonfly-head` | `[0, .035, .13]` | `[0, -60]` px |
| 1: gently push and release | `dragonfly-wing-front-right` | `[1.18, -.14, .545]` | `[60, 0]` px |
| 2: quietly observe | `dragonfly-head` | `[0, .035, .13]` | tap |

The prepared pivot starts at `[0, 1.06, .45]` and moves continuously to the twig tip `[0, 1.58, .10]`. The real tapered beak vertex and `dragonfly-beak-contact` marker both occupy local `[0, 0, 0]` in `dragonfly-balance-pivot`. Once placed, only this group's rotation changes. The beak therefore keeps exact contact with `dragonfly-support-tip` throughout damped sway and at completion. The normal and reduced-motion paths have identical settled transforms.

This is authored motion, not a rigid-body simulation. A uniform-density geometric volume check keeps the assembled dragonfly's centre below and near the contact point. It is a plausibility check for this original model, not a manufacturing or material-density claim.

## Lifecycle and verification

The scene supports silent restoration at checkpoints 0–3, returning visits, live sound settings, a native action button of at least 44×44 px, and pointer interaction with the actual object. Optional sound is a soft app acknowledgement. Progress advances only after settling. Short, reverse, cross-axis, overshooting, backtracked, nonfinite, cancelled, occluded and multitouch input is rejected, including invalid terminal release coordinates.

Pause/blur cancel unfinished drags and freeze accepted transitions. Lifecycle revisions protect synchronous feedback/progress callbacks, including pause/resume reentry. Geometry and materials are reused during animation and disposed exactly once along with input listeners, cues, audio and DOM.

Run `npm run test -w @wbr/scenes -- src/vietnamese-bamboo-dragonfly/scene.test.ts` from the repository root. The 51 scoped tests use real Three.js geometry, transforms, normals, projected bounds and ray intersections. GPU rendering is replaced at the boundary, and the optional audio test provides a Web Audio boundary. Coverage includes every subject vertex at 284×390, 350×408 and 1280×600, intermediate placement and all sampled sway frames, beak contact, weighted geometry, both outward-facing tail surfaces, input validation, restore, callbacks and exact-once disposal. Root integration performs browser visual review and full-project checks.
