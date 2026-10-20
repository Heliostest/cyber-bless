# 木勺寄情 / Welsh love spoon

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/welsh-love-spoons.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original procedural carved-wood gift scene. Three checkpoints: drag the real folded cloth onto the concave bowl; carry the complete spoon by its carved handle to the felt seat; tap the spoon quietly or explicitly submit an optional 40-character wish. Quiet completion discards drafts. Returning suppresses the writer. No promise of ritual efficacy.

## Sources and scope

Read on 2026-10-13:
- Local `content/traditions/welsh-folk.md`: C, low sensitivity; public folk-craft context. Viewed its JPG: a Mari Lwyd horse-head performance, **not a love-spoon reference**; no visual details borrowed.
- Amgueddfa Cymru / Museum Wales, https://museum.wales/blog/1033/Welsh-love-spoons/ (the articles/1033/Welsh-lovespoons route redirects here): public gift-craft history, decorative wooden spoons and the museum's earliest dated example (1667). This does not establish a universal invention date. Origins and motif meanings are not reduced to one rule.
- Visit Wales, https://www.visitwales.com/things-do/culture/cultural-activities/have-go-some-traditional-welsh-crafts : contemporary public craft participation and love-spoon carving.
- Initial `/articles/1033/en/lovespoon/` route and a truncated PDF lead were unavailable; not used as evidence.

The single heart opening and lozenge are invented geometry, not a copy of an identifiable maker's design. No Mari Lwyd, bardic ceremony, sacred object or universal symbolism is enacted. Registry category is 许愿; metadata grade C, sensitivity 低, gestures drag + wishWrite, tradition welsh-love-spoons, veranda environment.

## Geometry and input

`spoon-body` contains a closed oval bowl profile, beveled handle with an actual cut-out, grip and attached fine grain. The bowl has measurable inner depth and a convex back. Its lower edge rests at y=.80 on the home pad, then y=.88 on the display seat. Low rear rests steady both poses. No floating decorations or transparent hitboxes.

Step 0: `spoon-cloth-grip` → `spoon-bowl` (both mesh-local origin).
Step 1: `spoon-handle-grip` → `spoon-display-seat` (both origin).
Step 2: tap `spoon-handle-grip`; other visible spoon surfaces also accepted.

Only the first opaque scene hit counts; held descendants are excluded when checking a drop. Pointer ownership, cancellation, pause/blur, accepted animation freezing, checkpoint restore, explicit writing, reentry and disposal are covered with real geometry/raycast/form tests (GPU renderer mocked). Minimal-stub RED observed before implementation. Browser screenshots and integration evidence are recorded in the atelier plan.

## 2026-10-20 介绍扩充核查

适用场景：`welsh-love-spoon`；最终来源：`welsh-love-spoons`。

当前物件与动作：布擦凹勺，持柄放展托，静看或留言。

文化说明范围：威尔士1667有年款存世例、十八十九世纪求爱工艺及现代纪念礼。

简化边界：擦拭展示为产品照料动作，无完整雕刻或固定赠勺仪式。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#welsh-love-spoon)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。
