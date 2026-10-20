# 木陀轻转

An original tabletop wooden-top toy: pull the wooden bead to unwind the cord, tap the cap to slow the top, then quietly look or submit an optional line. It has no regional or ritual provenance assignment.

## Provenance correction · 2026-10-19

- The former title and Minangkabau association combined the local editorial brief's suggested departure/return metaphor with an invented tabletop mechanism. [Traditional Settlement at Nagari Sijunjung](https://whc.unesco.org/en/tentativelists/6059/) describes settlement and matrilineal houses; it does not establish the top's mechanism or a homecoming meaning.
- Official Indonesian documentation does record regional gasiang games. That fact alone does not establish this model's board-mounted pull-bead choreography or its former departure/return narrative. Evidence and reading limits are recorded in [the source review](../../../../docs/research/2026-10-19-yeondeunghoe-spinning-top.md).
- The scene now uses `PRODUCT_ORIGINAL`; the app catalog has no `traditionSlug`. No other culture is substituted. `minangkabau-spinning-top`, `minangkabau-spinning-top@1` and the factory export keep their legacy names for record and engine compatibility.

## Pointer choreography

1. Checkpoint 0: press visible opaque mesh `top-pull-bead`, move it toward visible opaque mesh `top-pull-anchor` on the board, and release over the anchor. At least one pointer move with more than eight pixels of travel is required. The cotton cord follows the bead, coils unwind, and the top starts rotating around its vertical spindle.
2. Checkpoint 1: press and release `top-cap` without more than twelve pixels of travel. The top decelerates and settles on its board contact point.
3. Checkpoint 2: tap `top-cap` quietly, or explicitly submit the optional wish form. A quiet tap discards the draft. Returning visits have no writer and create no new wish.

The auxiliary button runs the same acceptance and completion paths. Pointer starts and releases require the nearest visible opaque mesh to be the intended object; another opaque surface blocks the gesture. During a drop only the held bead and its moving cord are excluded. Progress is exactly 0 → 1 → 2 → 3. Reduced motion settles each accepted operation immediately, with no continuing spin or wobble. Pause and blur cancel unfinished input and freeze accepted animation.

## 2026-10-20 介绍扩充

“了解这个仪式”补充木陀、棉绳、木珠与起转、停下的关系，将短暂停留的意义留给体验者。文案在 [`scene-narratives/original.ts`](../../../core/src/scene-narratives/original.ts) 维护；没有新增米南加保、返乡或古老起源主张，来源分类仍为 `product-original`。实际呈现和边界见[本轮研究](../../../../docs/research/2026-10-20-scene-narratives-original.md#六个产品原创场景)。未改交互或结束条件。

## Validation

`npm run test -w @wbr/scenes -- src/minangkabau-spinning-top/scene.test.ts`

The 25 tests preserve real Three geometry, whole-scene occlusion raycasts and projected DOM cues, mocking only GPU rendering. They exercise 320/390/1280px framing, pointer ownership, invalid start/drop, cancellation, pause/blur, explicit wishes, silent restore, reduced motion and disposal. Six added regressions first failed on a real opaque occluder in front of the source or release target, then passed with nearest-surface validation. Root handles application integration, full-suite/build/mobile and actual browser review.
