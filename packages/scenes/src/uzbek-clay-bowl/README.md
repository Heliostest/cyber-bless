# 陶轮慢成 / Uzbek clay bowl

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/uzbek-ceramic-craft.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


`uzbek-clay-bowl` is a C / 低 contemporary craft appreciation scene, indexed under `uzbek-ceramic-craft`. Its three checkpoints are a rightward wheel-rim drag, an upward exterior-wall pull, and a quiet tap. The native 44px action button offers equivalent Enter/Space access.

The original bowl uses a closed lathed cross section with an open cavity, rounded lip, connected inner and outer walls, a 0.13-unit floor and geometric throwing grooves. Pulling rewrites that cross section from a squat vessel into a taller flared bowl; it never scales a solid primitive. A marked wooden wheel sits on a spindle, braces and a low wooden base. Warm damp-clay `#ad785a`, wood `#937452` and sand-toned lighting suit the host's transparent daytime veranda.

The final object remains damp, unglazed and **unfired**. There is no instantaneous firing, no change to a glazed material, no claim to reproduce a particular school or artisan's design, no religious efficacy claim and no wish input or `saveWish` call, including on returning visits.

## Evidence and scope

- [UNESCO — Ceramic arts in Uzbekistan](https://ich.unesco.org/en/RL/ceramic-arts-in-uzbekistan-01989): loess/pottery clay, everyday household objects and transmission through families, communities and education. The institution's indexed full description was read on 2026-10-14; the direct page returned a JavaScript verification screen.
- [Intangible Cultural Heritage of Uzbekistan — Kulolchilik](https://www.ich.uz/en/ich-of-uzbekistan/national-list/domain-5/440-kulolchilik): national inventory entry 05.06. The direct page timed out; the readable [traditional craftsmanship index](https://ich.uz/en/ich-of-uzbekistan/national-list/domain-5) verifies its listing. This does not establish a particular regional bowl profile.
- [UNESCO ICHCAP — Artistic ceramics](https://archive.unesco-ichcap.org/eng/ek/sub2017_7/pdf_down/6.%20KNOWLEDGE%20AND%20PRACTICES%20CONCERNING%20TRADITIONAL%20CRAFTSMANSHIP/10.%20Artistic%20ceramics.pdf): the batch's reviewed institutional process evidence distinguishes shaping, drying and firing. This scene intentionally ends after shaping.

The simplified gestures are an appreciation exercise, not a complete pottery lesson. The bowl silhouette and wooden apparatus are original procedural interpretations.

## Public gesture and geometry contract

All coordinates below are local mesh coordinates. Consumers should use the enabled `object.userData.interactionCues` anchor when projecting a cue.

| Checkpoint | Mesh / cue | Anchor | Accepted gesture |
| --- | --- | --- | --- |
| 0 | `clay-wheel-rim` / `rotate` | `[0, -0.025, 1.079]` | Start on the first opaque hit in its outer 0.08-unit annulus; move right at least 45 CSS px |
| 1 | `clay-body` / `drag` | `[0, 0.2675, 0.5172792206135786]` | Start on the first opaque exterior wall hit; move up at least 45 CSS px |
| 2 | `clay-body` / `tap` | `[0, 0.5525, 0.6197334941505714]` | Release on clay with maximum and final travel under 12 CSS px |
| 3 | No active cue | — | Completed, silent restore |

Both drags require a real move sample. Final cross-axis travel must stay within `max(18, primaryDistance * .4)`; maximum cross-axis excursion within `max(22, primaryDistance * .5)`. End-back, wrong-direction, short, empty-space, covered-surface and multi-pointer gestures do not advance. `+70px, 0` and `0, -70px` are reliable browser test movements. Pull acceptance also requires preview formation at least 0.5; wheel acceptance requires preview rotation at least 0.45 radians.

`clay-wheel` sits at world y=0.82 and turns from 0 to 0.9 radians. `clay-body` sits at world y=0.90 with identity scale and rotation. `clay-wheel-mark` provides a visible change in orientation. `clay-spindle` and `clay-wood-base` connect to the wheel without floating gaps. Exterior height changes from 0.58 to 1.15; the floor thickness remains 0.13. Material color, roughness and metalness stay unchanged through completion.

Normal accepted transitions take 0.75s and clamp each positive frame to 0.05s. Reduced motion settles directly with the same checkpoints. Invalid frame values do not progress. An unaccepted cancellation restores the prior profile/angle; accepted motion freezes during pause or blur and resumes later. Synchronous host callbacks are guarded on the hit layer and window capture without forfeiting the original pointer owner. Actual pause or blur remains observable during callbacks; even an immediate resume cannot resurrect a prepared gesture or button action. Completion and progress are emitted once per accepted action; restoration itself emits nothing.

## Verification

`npm run test -w @wbr/scenes -- src/uzbek-clay-bowl/scene.test.ts` uses real geometry, projection, opaque raycasting and object cues, mocking only the GPU renderer boundary. Coverage includes every visible vertex at 284×390, 350×408 and 1280×600; both motion modes; checkpoint restoration; gesture rejection; callback reentry; pause/cancel/blur/lost capture; unfired material continuity; and exact resource/listener release. RED and GREEN logs are in `artifacts/paper-clay-pair/clay-*.log`.

Browser appearance approval belongs to the root integration's final production screenshots; module tests do not establish visual approval.

## 2026-10-20 介绍扩充核查

适用场景：`uzbek-clay-bowl`；最终来源：`uzbek-ceramic-craft`。

当前物件与动作：木陶轮转动、提湿泥碗壁、停轮；无釉色与窑火。

文化说明范围：乌兹别克日用陶器、十九世纪流派与泥坯后续工序。

简化边界：自动拉壁几何、木轮外形和短时长是产品缩略。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#uzbek-clay-bowl)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。
