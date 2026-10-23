# 浮彩成笺 / Turkish Ebru paper

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

An original contemporary public craft appreciation: a shallow copper tray, floating teal/coral/ochre pigment, a wooden comb with nine metal pins, and a flexible sheet. There is no miniature table or display board. This is an abbreviated appreciation of paper marbling, not a religious ceremony, complete craft lesson, or claim of efficacy.

## Source and original interpretation

The [source card](../../../../content/traditions/turkish-ebru.md) and [2026-10-19 source audit](../../../../docs/research/2026-10-19-scene-culture-audit-c.md) record the read Ebru section of the Turkish culture ministry's French information page, supporting pigment on prepared liquid and transfer to paper. The UNESCO entry could not be re-read on that date because of human verification; its index is not treated as a newly read primary text. The procedural palette and flow field here are original. No source photographs, traditional motifs, music, or third-party assets are copied. The public craft has its own `turkish-ebru` tradition card.

## Physical interaction and checkpoints

0. Drag the actual wooden comb grip right. Its pins move through the liquid while a bounded inverse flow field deforms the floating pigment. Accepted settling clears the comb and lays the blank sheet onto the liquid.
1. Grab any visible part of the paper and pull upward. The authored peel starts at the near edge while the far strip remains in contact during the early pull. The sheet reveals its printed underside as it lifts. This forgiving pickup area is a product interaction choice.
2. Tap the printed paper to quietly observe, or explicitly submit an optional wish.
3. Completed pose.

The paper and floating pattern use identical UV coordinates and one shared procedural texture. The underside remains blank until full contact. At contact its immutable blank material is replaced with the immutable mapped material; this is compatible with the host's cached soft-toon materials. The covered water layer is omitted at contact to prevent coplanar depth conflict. The blank upper face and printed underside retain opposite culling, so the pattern is exposed by the sheet's actual geometry.

The prepared paper curl, comb flow, and peel are authored geometric approximations. They do not simulate fluid viscosity, pigment chemistry, capillary absorption, or exact paper inextensibility. Sound is restrained original feedback, not a traditional composition.

## Capture contract

| Checkpoint | Mesh | Local cue anchor | Screen gesture |
| --- | --- | --- | --- |
| 0 | `ebru-comb-grip` | `[0, 0, 0.09]` | `[60, 0]` |
| 1 | `ebru-paper-blank` | initially `[0, 0.45, 0.7125]`, follows sheet UV `[.5,.125]` | `[0, -60]` |
| 2 | `ebru-paper-print` | `[0, 1.6, 0.28]` | tap |

The mesh vertices of the sheet are deformed in subject coordinates; its final quiet anchor therefore uses the raised sheet coordinates. Subject group: `ebru-subject`. Floating pigment: `ebru-floating-pattern`. Blank paper top: `ebru-paper-blank`. Paper underside: `ebru-paper-print`. Moving tool: `ebru-comb`.

Each cue hits the nearest opaque rendered surface at 284×390, 350×408, and 1280×600. The peel cue is inset onto exposed paper, away from the front rim. Pickup accepts either rendered paper face or the existing small paper-edge mesh, rather than only the .82-unit central edge strip. It does not add invisible geometry or reach through the tray rim or another opaque object. A deliberate drag needs actual movement and at least 40px along the intended axis; 60px reaches the authored pose. Wrong starts, too-short drags, clear reverse, pure cross-axis, returned-to-start, cancelled and multitouch inputs do not advance. Longer same-direction drags, gentle diagonals and 10–20px corrections remain valid. A native 44px action button supports Enter/Space.

## Lifecycle and verification

Checkpoints 0–3 and returning visits restore silently. Progress commits only after settling; reduced motion produces identical final geometry. Pauses freeze accepted transitions, while blur/cancel/lost capture discard partial input. Callback reentry is guarded, including input injected outside the hit layer and pause/resume boundaries during preparation. A callback lifecycle version also suppresses stale sound, haptic and completion continuations when the host synchronously pauses/resumes or blurs/refocuses. Quiet observation and returning visits never save wish drafts; explicit submission trims and saves once. A committed wish still reports progress atomically after a host pause, while stale feedback is suppressed. Both immutable underside materials, the shared texture, geometry, UI, cues, listeners, feedback, lights and renderer are disposed exactly once.

Run `npm run test -w @wbr/scenes -- src/turkish-ebru-paper/scene.test.ts`. The tests retain real Three geometry, raycasting, interaction cues, the actual wish form, and an explicit real soft-toon adapter regression; only GPU rendering is substituted. They include six pickup points over three viewport sizes, following the grab before release, and rejecting the rim and an opaque blocker. `node scripts/verify-ebru-paper-pickup.mjs` checks the actual scene-review App with mouse and native Chrome touch on the running development server. See the [pickup repair record](../../../../docs/research/2026-10-19-ebru-paper-pickup.md) for the verification and source boundaries.

## 2026-10-20 介绍扩充核查

适用场景：`turkish-ebru-paper`；最终来源：`turkish-ebru`。

当前物件与动作：梳具右移显彩纹、自动落纸、近边揭纸转印、静看。

文化说明范围：土耳其纸艺、书籍装饰、师徒经验与当代交流。

简化边界：预制液面与颜料、自动贴纸、即时固色和留言为产品，不是配方教学。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#turkish-ebru-paper)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
