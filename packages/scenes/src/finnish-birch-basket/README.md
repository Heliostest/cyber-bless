# 桦篮拾光

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/finnish-birch-bark-craft.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original, procedural Three.js still life for contemporary appreciation of Finnish birch-bark craft. A shallow, rounded rectangular basket has 56 thick diagonal strips, alternating over/under depth, an open interior, a curved detachable handle, grains, a hollow wooden scoop and bark offcuts on a braced veranda bench. Colors and geometry are original; no runtime images, external assets, copied maker pattern or wish writer.

## Read and visual reference access

On 2026-10-13, read `content/traditions/finnish-karelian-folk.md` in full and viewed its associated `finnish-karelian-folk.jpg`. The photo shows the nighttime Kekri bonfire at Strömfors, not a basket. The broad Finnish–Karelian nature/folklore card provides cultural context and boundaries only; it does not establish this craft handling sequence. Its image is not used in the scene. This is neither bear-ritual reenactment nor a sacred-pine offering, loitsut practice or Suomenusko ceremony.

Read the National Museum of Finland's [Seedlip (kylvövakka), 1 June 2020](https://suomenkansallismuseo.fi/en/exhibit/siemenpoenttoe-nauriin-ja-pellavan-siemenien-saeilyttaemiseen-4/) on 2026-10-13. It distinguishes Eastern Finnish birch-bark woven sowing containers, also used for flour, grain and salt, from its photographed Western Finnish vessel made from bent aspen board. That documented everyday material use supports this interpretation. The scene's rectangular form, detachable arch, furnishings and three handling actions are original choices, not a museum-object reconstruction or a claimed historical ritual. The original `kansallismuseo.fi/en/items-of-the-month/2020/...` address has moved to the linked museum page.

## Interaction and verification

1. Drag the solid curved crest `birch-handle-grip` onto the exposed finishing strip `birch-rim-grip` to attach the handle.
2. Drag `birch-rim-grip` onto `birch-display-mat`; the entire `birch-basket` subtree, including its attached handle and grains, moves together.
3. Tap `birch-rim-grip` quietly to finish. The native auxiliary button follows the same state transitions.

All anchors are visible opaque mesh surfaces. Starts and releases use the first visible mesh; a drop excludes only the held subtree. Tests cover valid and invalid input, foreground obstruction, the 7/8 px drag boundary, tap travel, pointer ownership, mixed fingers, cancellation, lost capture, pause/blur, silent progress restoration at 0/1/2/3, reduced motion and idempotent disposal. Geometry tests project anchors at 320, 390 and 1280 px, verify the open interior and base/grain support, and sample actual rim vertices inside both attached handle feet. The flattened spare handle rests at the bench's 0.72 top; the basket rests at 0.72 initially and 0.755 on the mat.

The no-op scaffold produced an observed RED behavioral assertion (`[]` rather than `[1, 2, 3]`) before implementation. A stronger physical-contact test also produced RED for the first handle width and was fixed by widening its arch. Final focused command: `npm run test -w @wbr/scenes -- src/finnish-birch-basket/scene.test.ts` — 27 tests pass. Tests preserve real Three.js geometry/raycasting and interaction cues, replacing the GPU renderer boundary only. Root integration owns the full suite, build, browser screenshots and mobile verification.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。长方桦皮交织篮、可拆弯柄、谷粒、木勺布垫；接柄→放垫→静看。

核查重点：博物馆主图是西芬兰白杨板，不能称其为桦篮复刻；机械年代不是桦编起源；弯柄拼装与灰绿垫无祈愿程序。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#finnish-birch-basket)。
