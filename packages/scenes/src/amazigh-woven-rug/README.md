# 织毯寄暖 — Amazigh wool-textile appreciation

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/moroccan-amazigh-textiles.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original contemporary appreciation of wool weaving associated with Moroccan Amazigh communities. The player moves a real wooden shuttle to the lower unfinished row, carries the entire clamped rug onto a wooden display stand, then quietly taps it or explicitly submits an optional wish. This is a short visual craft gesture, not a reconstruction of a loom or a claim to teach traditional weaving.

The rug uses warm ivory `#e6d9bd`, ochre `#b78343`, rust `#a95f4c` and muted indigo `#566e83`. Its simple stripes and offset rectangles are composed specifically for this scene. No museum pattern, protective symbol, image texture or downloaded model is copied. No universal meaning is assigned to the colors or marks. This is not a shrine visit, a Moussem or rain ceremony, a wedding textile, or a simulation of sacred practices.

## Sources reviewed, 2026-10-13

- Local `content/traditions/amazigh-berber.md`: read in full for the existing catalog context and C / medium sensitivity boundary. Its proposed shrine interaction is not implemented here.
- Local `content/traditions/amazigh-berber.jpg`: visually inspected. It depicts a marabout shrine near Meknes, **not a carpet or weaving reference**. It is not used as a texture, model reference or craft evidence.
- Khalid Loukid, National Museum of Weaving and Carpets (Dar Si Said), Morocco, [Traditional Dyeing Techniques in Moroccan Amazigh Textiles: Ancestral Knowledge and Regional Practices](https://costume.mini.icom.museum/wp-content/uploads/sites/10/2025/01/Loukid_article_VF.pdf), hosted by ICOM: downloaded primary paper, pages 1–6 read; page 7 figures inspected. Pages 1–3 describe wool, regional dye variation and woven geometric ornament. Figure 1 shows museum dye-color samples; figure 2 shows a twentieth-century Haouz carpet. These inform broad material and color appreciation only. The paper also describes wedding veils and ritual meanings on pages 5–6; those designs and practices are excluded from this scene.

The downloaded paper and rendered source figures remain research artifacts outside the product. The display stand, modern clamp, shuttle and pattern are original procedural geometry, not historical reconstructions.

## Public module and exact object cues

`scene.ts` exports `createAmazighWovenRug`; `index.ts` supplies `create`, default `SceneModule` and metadata: `amazigh-woven-rug`, `织毯寄暖`, `traditionSlug: moroccan-amazigh-textiles`, grade C, sensitivity 中, gestures `drag` / `wishWrite`.

| Checkpoint | Source mesh / local offset | Destination mesh / local offset |
| --- | --- | --- |
| 0 | `rug-shuttle-grip` / `[0,0,0]` | `rug-weft-gap` / `[0,0,0]` |
| 1 | `rug-top-grip` / `[0,0,0]` | `rug-display-seat` / `[0,0,0]` |
| 2 | tap `rug-top-grip` / `[0,0,0]` | quiet completion or explicit wish form |

Every source and destination is an opaque visible physical mesh and the first ray hit at its cue. Pickup accepts the visible shuttle or rug assembly, while drops require the specific finishing row or display seat. There are no invisible hit proxies.

- `rug-body` rests at `[-.75,1.63,.10]`, then `[.75,1.63,.10]`. The wooden clamp, pegs, thick wool front/back/sides, colored weft ridges, edge binding, final row and 36 yarn fringes all belong to that moving group.
- `rug-top-grip` has a flat bottom at y=2.28. The fixed support's rear lip reaches y=2.28 and ends behind the wool, avoiding intersection with the hanging textile. A real upward ray at the contact confirms touching faces, beyond bounding-box overlap. Uprights contact their base, bases contact the table at y=.74, and table legs contact the ground.
- Wool measures 1.08 × 1.34 × .068. Actual tubes form the colored ridges, back weft, bound edges and lower fringes. The fringe clears the tabletop.
- `rug-shuttle` rests at `[-.73,.78,.62]`; its hull bottom meets the tabletop at y=.74. Yarn winding and tail move with the hull. Accepted finishing motion returns it to the table.

## Lifecycle and verification

Restores checkpoints 0–3 without feedback. Cancellation, lost capture, blur, pause and multitouch return the whole dragged group to its supported pose. An accepted animation freezes and resumes. Reduced motion commits immediately. Native buttons provide the same three actions for keyboard access.

Only an explicit nonempty trimmed submission can save one wish (up to 40 characters). A quiet finish discards drafts; returning visits do not mount a writer. Completion state commits before callbacks. A saving callback that pauses still receives the accepted progress 3 commit; actual disposal prevents further callbacks. Progress or haptic callbacks that pause/dispose suppress subsequent feedback, completion and the current update's render.

Input and reentrant updates remain locked throughout progress, saving, completion and feedback callbacks. A callback cannot consume the next user action through the native button, pointer or wish form, and feedback preparation cannot replace the original explicit wish with a nested submission. Input resumes after the accepted action's callback boundary returns.

If preparation pauses the host, the initial pointer is explicitly cancelled even when the host's synchronous cleanup update was suppressed by the callback lock. Its stale release cannot finish the scene; a fresh pointer works after resuming. Cue DOM hides synchronously during the pause without requiring another GPU frame, then reappears on resume.

The initial meaningful RED was the inert public scene failing to produce checkpoint 1. Additional REDs caught narrow-canvas tabletop clipping, a support rail intersecting cloth, and rounded support surfaces whose bounds overlapped but whose actual faces did not contact.

Run `npm run test -w @wbr/scenes -- src/amazigh-woven-rug/scene.test.ts`. The 67 tests use real Three geometry/raycasting, interaction cues and wish forms; only the GPU boundary is replaced. Coverage includes all visible vertices at checkpoints 0/1/2 in 284×390, 350×408 and 1280×600 canvases, physical contacts, actual first-hit cues, invalid input, occlusion, pointer ownership, touch cancellation, pause/resume, callback lifetime, normal-motion callback reentry, explicit wish preservation, silent restoration and complete resource/listener disposal. Nine added reentry regressions were observed failing before the callback lock was introduced; five pause-cleanup regressions then verified stale-pointer cancellation, fresh-pointer recovery at checkpoints 0/2 and immediate cue hiding. Shared integration and production browser/build/mobile verification are performed by the root task.
