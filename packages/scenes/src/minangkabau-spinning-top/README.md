# 归乡轻转

A contemporary original, nonreligious departure/return hand gesture exercise. The wooden top and cord choreography are original; they are not presented as an ancient or uniquely Minangkabau top design or ritual.

## Cultural source checked

- [Traditional Settlement at Nagari Sijunjung, UNESCO World Heritage Centre](https://whc.unesco.org/en/tentativelists/6059/) — Indonesia's official tentative-list submission, 30 January 2015, checked 13 October 2026. The description places rumah gadang within living family/clan and community settings. The scene uses only that broad community context. This is a tentative-list entry, not an inscribed World Heritage property.
- Local editorial brief: `content/traditions/minangkabau-adat.md`. Its proposed nonreligious departure hand gesture informed the tribute; its reference photograph was inspected for cultural context only and is not embedded in the product.

## Pointer choreography

1. Checkpoint 0: press visible opaque mesh `top-pull-bead`, move it toward visible opaque mesh `top-pull-anchor` on the board, and release over the anchor. At least one pointer move with more than eight pixels of travel is required. The cotton cord follows the bead, coils unwind, and the top starts rotating around its vertical spindle.
2. Checkpoint 1: press and release `top-cap` without more than twelve pixels of travel. The top decelerates and settles on its board contact point.
3. Checkpoint 2: tap `top-cap` quietly, or explicitly submit the optional wish form. A quiet tap discards the draft. Returning visits have no writer and create no new wish.

The auxiliary button runs the same acceptance and completion paths. Pointer starts and releases require the nearest visible opaque mesh to be the intended object; another opaque surface blocks the gesture. During a drop only the held bead and its moving cord are excluded. Progress is exactly 0 → 1 → 2 → 3. Reduced motion settles each accepted operation immediately, with no continuing spin or wobble. Pause and blur cancel unfinished input and freeze accepted animation.

## Validation

`npm run test -w @wbr/scenes -- src/minangkabau-spinning-top/scene.test.ts`

The 25 tests preserve real Three geometry, whole-scene occlusion raycasts and projected DOM cues, mocking only GPU rendering. They exercise 320/390/1280px framing, pointer ownership, invalid start/drop, cancellation, pause/blur, explicit wishes, silent restore, reduced motion and disposal. Six added regressions first failed on a real opaque occluder in front of the source or release target, then passed with nearest-surface validation. Root handles application integration, full-suite/build/mobile and actual browser review.
