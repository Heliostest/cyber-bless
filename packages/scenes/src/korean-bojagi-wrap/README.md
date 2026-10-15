# 方巾裹礼 / Korean bojagi wrapping cloth

An original contemporary public craft study: a continuous coral, cream, sage and ochre patchwork cloth wraps a small rounded parcel on a simple woven floor mat. Visible seams, a perimeter hem, a reinforced near corner and four attached fabric bands make the cloth construction legible. This is an abbreviated craft appreciation, not a religious ritual or a complete lesson in a particular historical knot.

## Sources and original interpretation

[LACMA, “Bojagi: The Korean Wrapping Cloth”](https://unframed.lacma.org/2014/01/02/bojagi-the-korean-wrapping-cloth), verified 2026-10-15, describes square or rectangular cloth wrappers used to carry, store and cover objects; patchwork uses fabric remnants, including silk, ramie and cotton. The [Smithsonian wrapping-cloth collection record](https://www.si.edu/object/wrapping-cloth-bojagi%3Anmnhanthropology_8343143), also verified 2026-10-15, documents an example with tying ribbons at its four corners.

The palette, patch arrangement, seams, geometry and quiet feedback are original. No museum photographs, inherited motifs, symbols, music or third-party assets are copied. The broad wrapping and attached-band construction informs the scene; the specific parcel and knot-like closure are a contemporary interpretation.

## Physical actions

0. Drag the near reinforced cloth corner upward. Three corners begin loosely gathered; the near corner bends over the box shoulder while its sewn band follows. The same indexed cloth mesh remains connected throughout.
1. Pull the visible right band sideways. Its already-visible loose loop contracts while the attached tail curves over the parcel edge and sags beside the box.
2. Tap the wrapped cloth to quietly observe, or explicitly submit an optional wish. The auxiliary action button also completes without saving a draft.
3. Completed pose.

The moving cloth uses an authored path with rounded shoulders, low-amplitude folds and clearance around the parcel. This is not a cloth physics, stretch, friction or knot-topology simulation. The bands are continuous procedural ribbons attached to actual cloth corners; there is no independent floating knot. The immutable procedural texture stays in cloth UV space and survives the host's cached soft-toon material adapter. Cloth casts a shadow and uses soft lighting without receiving shadow-map artifacts. Every mat strand opts out of ink outlines so hidden mat edges cannot appear through the cloth.

## Capture contract

| Checkpoint | Mesh | Local cue anchor | Screen gesture |
| --- | --- | --- | --- |
| 0 | `bojagi-near-corner` | `[0, 0.012, 0]` | `[0, -60]` |
| 1 | `bojagi-band-right-tip` | `[0, 0.012, 0]` | `[60, 0]` |
| 2 | `bojagi-cloth` | `[0.031098, 0.452587, 0.590862]` | tap |

Subject group: `bojagi-subject`. The cue on the near corner is a sewn reinforcement; the right cue is the same attached band’s thickened end. The quiet anchor sits on a final cloth-wall vertex. The parcel is `bojagi-parcel`; its rounded lid is `bojagi-parcel-lid`. The four ribbons are `bojagi-band-near`, `bojagi-band-far`, `bojagi-band-left` and `bojagi-band-right`.

All subject vertices fit 284×390, 350×408 and 1280×600 canvases. Each cue is reachable as the first opaque rendered surface. A drag needs actual movement, a release 40–84px along its intended axis, a path within 90px of its start and at most 18px across the axis; a 60px gesture leaves a short settling movement. Wrong starts, short, oversized, reverse, diagonal, backtracked, cancelled, release-only, nonfinite and multitouch gestures do not advance. A native 44px action button supports keyboard operation.

## Lifecycle and verification

Checkpoints 0–3 and returning visits restore silently. Progress commits after settling; normal and reduced motion end with identical geometry. Accepted transitions freeze during pause, while blur, cancel, capture loss and inactive partial input restore the checkpoint. Callback guards prevent synchronous step skipping and suppress stale feedback after pause/resume or blur/focus, including `prepareFeedback`, `onProgress`, haptic and explicit wish saving. Wishes save only on explicit trimmed submission; quiet observation and returning visits never save drafts.

The 54 tests retain real Three geometry, raycasting, cues, the real wish form and the real soft-toon adapter; only GPU rendering is substituted. They verify cloth connectivity, attached ribbon endpoints, triangle samples outside the parcel, exact rounded-lid raycasts, sagging band tails, geometry reuse, first opaque cue hits, frame containment, lifecycle reentrancy and exactly-once cleanup of geometry, materials, the shared texture, listeners, cues and renderer.

Run `npm run test -w @wbr/scenes -- src/korean-bojagi-wrap/scene.test.ts`. Root integration owns browser mouse/keyboard/native-touch validation and complete repository checks.
