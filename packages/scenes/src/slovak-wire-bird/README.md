# 铁线栖鸟 · Slovak wire bird

An original contemporary craft appreciation exercise inspired by public Drotárstvo wire craft. A loose open-wire wing is joined to a bird's shoulder; the assembled bird is carried onto a wooden perch; a quiet tap finishes the scene. This is an original small sculpture and a public craft tribute, not a historical artifact reconstruction, a ceremony, or a claim of ritual efficacy. There is no wish writer or wish persistence.

## Sources and boundaries

Reviewed on 2026-10-13:

- Local `content/traditions/slovak-folk.md` was read in UTF-8. It concerns Slovak folk Catholicism and public pilgrimage, with C / 中 assessment and boundaries around sacraments and coercive folk-custom reenactments. This scene's broader Slovak association does not imply that wire birds are a Catholic ritual object.
- Local `content/traditions/slovak-folk.jpg` was inspected. It depicts the Basilica on Mariánska hora, Levoča, not wire craft. The local card credits [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Bazilika_Mari%C3%A1nska_hora,_Levo%C4%8Da_19_Slovakia199.jpg), CC BY-SA 4.0. The photograph was not copied into the scene; the Commons page itself was not independently opened.
- [ÚĽUV, Drotárstvo](https://uluv.sk/encyklopedia/drotarstvo/) was successfully opened and read. The encyclopedia identifies its author as Katarína Hallonová of Považské múzeum v Žiline. It describes wire shaped and joined by hand, a stronger framework supporting finer wire elements, and the structural as well as decorative role of connections. It also discusses animal figures among later artistic work. These public structural principles support an original open-wire sculpture; no named maker's composition is copied.
- [UNESCO, Drotárstvo, wire craft and art](https://ich.unesco.org/en/RL/drotarstvo-wire-craft-and-art-01478) was readable as indexed search-result text. That text describes manual bending, binding and interlacing without welding or soldering, and contemporary artistic practice. Direct English access had been blocked in the integrating task; this author did not independently open the English page. The [Spanish page](https://ich.unesco.org/es/RL/drotarstvo-practica-artistica-y-artesanal-con-alambre-01478) was opened twice and returned a human-verification challenge, so it was not treated as directly read evidence.
- [ÚĽUV, The year of wirecraft in ÚĽUV](https://uluv.sk/en/events/the-year-of-wirecraft-in-uluv/) was readable in indexed search results, but a direct open returned an internal error. It is supplementary context only; the successfully opened encyclopedia supplies the craft basis.

The bird uses newly composed loops, ribs, a beak and tail, with small bound-wire joints and a muted gray-green metal palette. There are no sacred motifs, emblems, church geometry, copied artisan designs, or ritual instructions. Thick structural wires and finer connected ribs make the open construction legible.

## Module and interaction contract

- Export: `createSlovakWireBird`, also exported as module `create`.
- Metadata: `slovak-wire-bird`, `铁线栖鸟`, `traditionSlug: 'slovak-folk'`, C, 中, `gestures: ['drag']`. The shared scene contract uses the singular tradition field; the root catalog owns its `traditionSlugs` array and blessing mode.
- Step 0: real mesh `wire-wing-grip` in group `wire-loose-wing` drags to `wire-shoulder-joint`. The source is the opaque metal center of a small visibly wrapped wire root. There is no transparent or oversized proxy. Any visible physical mesh in the loose wing can also start the drag.
- Step 1: real mesh `wire-bird-grip` drags the entire `wire-bird` group, including the attached wing, to `wire-perch-seat`. Other visible physical meshes in the bird are also draggable.
- Step 2: tapping the actual bird completes once; the main cue remains on `wire-bird-grip`. Auxiliary native click buttons share the same guarded checkpoint path.
- Whole-group restoration handles invalid drops, pointer cancellation, lost capture, multitouch, blur and host pause. Accepted animation freezes while inactive. Restoring checkpoints produces no progress, completion, wishes, or haptics.
- First-hit raycasts include all visible opaque meshes; drops exclude the entire held group. Targets behind other surfaces are invalid. A physical drag requires at least 8 CSS pixels of movement; a final tap must never have traveled 12 pixels.
- Reduced motion settles immediately. Normal animation bounds finite time steps. Completion state is guarded before callbacks. Progress callbacks may synchronously dispose or pause the host: activity is checked again before feedback, completion dispatch, and the frame's final render. Pausing at a committed terminal checkpoint does not replay completion when resumed. All owned resources/listeners are disposed once.

## Anchors and physical construction

| Part | Local/world center |
| --- | --- |
| Bird home group | world `(-0.55, 0.80, 0)` |
| Bird displayed group | world `(0.55, 0.96, 0)` |
| Loose wing home group | world `(-0.60, 0.914, 0.72)` |
| First source, `wire-wing-grip` | local `(0, 0, 0.02)`; initially world `(-0.60, 0.914, 0.74)` |
| First destination, `wire-shoulder-joint` | bird-local `(0.05, 1.13, 0.18)`; initially world `(-0.50, 1.93, 0.18)` |
| Attached wing group | bird-local `(0.05, 1.13, 0.26)` |
| Whole-bird grip, `wire-bird-grip` | bird-local `(0.05, 0.87, 0.25)` |
| Second destination, `wire-perch-seat` | world `(0.55, 0.935, 0.02)` |

`wire-body-front` and `wire-body-back` are closed tubular profiles separated by 0.24 units and connected by transverse ribs. The beak, eye bridge, tail, far wing, and two legs contact the supporting frame. Both wing loops are open, with fine connecting ribs. The front wing root's rear face meets the shoulder's front face at local z=0.23. The solid grips are small, visible bound-wire bundles with attached coil ridges, not surfaces filling the bird's hollow body.

Both closed foot loops have a bottom at local y=0; at home they rest on `wire-home-pad`, top y=0.80, and on display they rest on `wire-perch-seat`, top y=0.96. The perch's two posts meet both its base and top. The loose wing's lowest coil rests on `wire-wing-pad`, top y=0.80. The table top is y=0.76. The shared clear veranda background is owned by the root integration; this module supplies only the transparent-canvas workbench and sculpture.

## Verification

The initial public mount test ran against a minimal stub and failed as intended: `expected null not to be null` for the absent action. A later geometry regression exposed 0.009 units of coil/pad overlap; adjusting the loose wing's height corrected that physical contact.

```text
npm run test -w @wbr/scenes -- src/slovak-wire-bird/scene.test.ts
40 tests passed
```

The suite keeps real Three.js geometry, raycasting, pointer ownership and interaction cues, substituting the WebGL renderer only. It covers lifecycle, both drags and final tap, wrong/blocked destinations, wrong sources, stationary input, 320/390/1280 visibility, open cavities, wing attachment, physical wire contacts, both foot supports, full-group motion/cancellation, silent restore, paused animation, reentrant completion and disposal.

Follow-up callback regressions first reproduced an unwanted final render after progress 1 disposed the scene, and haptics after progress 1 or 3 paused the host. Four cases now check synchronous disposal/pause in progress callbacks, no subsequent feedback or completion, no frame-tail render after the callback, no renders after disposal, and stable progress after update/resume. All four pass with the additional activity guards.

The integrating task's 320px viewport screenshot revealed that its actual 284×390 canvas clipped the loose wing; 350×408 was also too close to the edge. A vertex-projection regression reproduced left extents of -1.063 and -0.999 NDC. The loose wing and its pad, bird home and home pad, and entire display perch were moved inward without changing the camera or sculpture scale. At checkpoints 0, 1 and 2, every vertex of the bird and loose wing now stays inside ±0.92 NDC on both actual canvas sizes, while both drag anchors and the final tap remain the first visible raycast hits. The all-vertex guard covers the displayed beak as well as the detached wing.

Actual GPU appearance and browser/mobile integration are left to the integrating parent task, which owns registry/catalog/background/build work. No shared files, dependencies, builds or mobile artifacts were modified by this module author.
