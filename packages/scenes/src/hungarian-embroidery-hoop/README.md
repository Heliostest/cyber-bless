# 花绣寄语 — Hungarian embroidery hoop

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/hungarian-embroidery.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original, contemporary craft appreciation scene. A wooden hoop holds warm linen and raised rose/teal thread flowers. The player carries a real thread spool to a blank cloth patch to add one floral flourish, moves the whole hoop onto a solid display cradle, then taps the hoop to quietly finish. At the last checkpoint only, an optional explicit wish submission can save one trimmed line of up to 40 characters. Quiet completion discards the draft; returning visits never mount a new writer.

This is not a reconstruction of Matyó stitching instruction, an authentic community pattern, a sacred motif, or a simulated religious ritual. The five-petal flowers and branching composition were composed for this scene from procedural geometry; no artwork, artisan design, photo texture, or downloaded model is used. Spool movement is an accessible visual craft gesture, not an assertion that this is how embroidery is physically made.

## Sources and access

Reviewed 2026-10-13:

- Local `content/traditions/hungarian-folk.md` and `hungarian-folk.jpg`: read and visually inspected. The card concerns Hungarian Catholic pilgrimage and the image shows a crowned Madonna and Child at a shrine. It provides the existing catalog context and C/low-sensitivity boundary, **not an embroidery source**. No shrine objects or religious imagery are used here.
- [Hagyományok Háza — Embroidery](https://hagyomanyokhaza.hu/hu/embroidery): successfully opened readable institutional primary text. It describes regional differences, linen/hemp/cotton embroidery and household textiles, and a Matyó story involving colorful embroidered roses. Used only for broad material and floral craft context. The story's supernatural claims are not game mechanics or product promises.
- [Hungarian Cultural Heritage Days — Matyó Museum](https://oroksegnapok.gov.hu/helyszin/2057): successfully opened readable government cultural-program text in Hungarian and English. It describes Matyó embroidery and distinguishes the embroidery/costumes of Mezőkövesd, Tard and Szentistván. The scene does not label its original pattern as any one of these local traditions.
- [UNESCO canonical listing](https://ich.unesco.org/en/RL/folk-art-of-the-matyo-embroidery-of-a-traditional-community-00633) and [French-language variant](https://ich.unesco.org/fr/RL/l-art-populaire-des-matyo-la-broderie-d-une-communaute-traditionnelle-00633): access attempted; both returned JavaScript/human-verification challenge content in this environment. They remain leads, not successfully read evidence. The readable institutional sources above supply the craft context.

## Module and physical anchors

`createHungarianEmbroideryHoop` is exported from `scene.ts`; `index.ts` supplies `create`, default SceneModule, and metadata: `hungarian-embroidery-hoop`, `花绣寄语`, `traditionSlug: hungarian-embroidery`, grade C, sensitivity 低, gestures drag/wishWrite. The shared module schema uses singular `traditionSlug`.

| Checkpoint | Source | Destination |
| --- | --- | --- |
| 0 | `hoop-spool-cap`, local `[0,0,0]`; actual spool meshes accept pickup | blank `hoop-linen` at local `[.25,.017,.22]`, equivalent to `hoop-body` local `[.25,-.22,.017]` |
| 1 | `hoop-clamp-bridge`, local `[0,0,0]`; any visible hoop mesh accepts pickup | `hoop-cradle-seat`, local `[0,0,0]` |
| 2 | `hoop-clamp-bridge`, local `[0,0,0]`; any visible hoop mesh accepts quiet tap | optional explicit wish writer, or quiet tap |

- `hoop-thread-spool` rests at `[-.98,.99,.64]`, with bottom flange on tabletop y=.76. Cap, wound thread, coils and loose tail are its children.
- `hoop-body` rests at `[-.72,1.535,.015]` on `hoop-home-pad` top y=.80, then `[.82,1.615,.015]` on `hoop-cradle-seat` top y=.88. Its outer ring radius is .735, giving exact bottom support at both checkpoints.
- `hoop-home-back-rest` and `hoop-cradle-back-rest` touch the rear ring surface; cradle base rests on the worktable. Table legs reach the ground.
- `hoop-linen` is a thick cylinder rotated X π/2. Floral TubeGeometry endpoints enter its front face; lifted middle points make the stitches visibly three-dimensional. `hoop-floral-stitches`, `hoop-completed-flourish`, cloth weave and copper-colored clamp are all descendants of the moving hoop group.
- `hoop-completed-flourish` is hidden at checkpoint 0 and visible from checkpoint 1 onward. Cues only appear for the active supported checkpoint.

## Verification

First meaningful RED: the public native-button lifecycle test failed with `expected [] to deeply equal [1]` against a minimal inert scene stub. The scene was implemented after observing that failure.

Run `npm run test -w @wbr/scenes -- src/hungarian-embroidery-hoop/scene.test.ts` for 43 focused tests. Only GPU rendering is replaced: real Three meshes/raycasts, interaction cues and wish forms exercise lifecycle, valid/invalid object drops, opaque foreground blocking, travel thresholds, pointer ownership, multitouch, blur/pause/cancellation, motion resumption, silent restoration, reduced motion, explicit wishes, reentrancy, returning visits, physical contacts, connected decorations, 320/390/1280 framing and disposal. Root owns shared integration, browser visual review, full builds and mobile checks.

Callback-disposal regression RED: seven added tests exposed feedback after progress-callback disposal, one extra settled frame rendered after disposal, progress after a saving callback closed the scene, completion after a feedback callback closed it, and feedback continuing after host deactivation. A follow-up RED caught a save callback that only paused the scene preventing accepted progress from reaching the host. Saving now checks disposal before notifying progress 3; a pause still allows this accepted progress commit, while actual disposal stops it. Progress and feedback callbacks then recheck activity, suppressing feedback/completion while paused. The final update render also checks activity. Completion state is committed before callbacks, so closing, pausing, resuming or reentering cannot duplicate wishes or progress.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `hungarian-embroidery`。核查范围：地区差异、织物种类、村落家庭生产与二十世纪初集市绣品交易。

边界：不认定原创花样为 Matyó 或 Kalocsa，未移用玫瑰传说、护身意义；线轴拖动不等于传统针法。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#hungarian-embroidery-hoop)与[来源卡](../../../../content/traditions/hungarian-embroidery.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。
