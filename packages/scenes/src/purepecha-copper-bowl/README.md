# 铜碗拾暖 / Purepecha copper bowl

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/santa-clara-copper-craft.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original contemporary workshop appreciation scene for public copper craft associated with Santa Clara del Cobre, Michoacán. It uses the `santa-clara-copper-craft` source card, grade C, and the shared veranda environment. The card says sensitivity 低至中; the runtime accepts only 低/中/高, so this module conservatively uses 中. Gestures: `['drag']`. Entry point: `createPurepechaCopperBowl` (also exported as `create`).

This is an invented small everyday bowl and a short appreciation exercise, not a ritual vessel, altar, memorial offering, cargo ceremony, afterlife practice, or reproduction of an identifiable artisan's work. No ritual efficacy, sacred motifs, community authority, or craft certification is claimed. The experience has no wish form and never calls `saveWish`.

## Source review

Reviewed 2026-10-13:

- Local `content/traditions/purepecha.md` and its adjacent JPG. The JPG depicts the Janitzio Noche de Muertos memorial vigil, including flowers and candles. It supplies cultural-boundary context only; it is not a copper bowl or a craft workshop reference, and none of that memorial imagery is reproduced.
- [Instituto Nacional de Antropología e Historia: Santa Clara del Cobre](https://lugares.inah.gob.mx/es/node/4804), readable primary source. It documents copper working in the locality before Spanish occupation, current public workshop demonstrations, and the display and sale of copper folk art. These facts ground the public craft setting; the bowl's shape, subdued hammer texture, pad, support and interaction are original design decisions. The source also discusses local religious and cargo institutions, which are outside this scene's scope. No source photographs or designs are imported.
- [Secretaría de Educación Pública: Artesanos de Santa Clara del Cobre, Michoacán](https://www.gob.mx/sep/acciones-y-programas/artesanos-de-santa-clara-del-cobre-michoacan?state=published), attempted but returned HTTP 403. It remains an unavailable lead, not evidence used for visual or factual claims.

## Object and interaction

1. Drag the actual soft polishing pad onto the visible bowl wall. The pad makes a short wipe on the exterior, then returns to its fabric rest. The copper warms slightly in color.
2. Drag the bowl by its exposed wall or rolled rim onto the right-hand felt cradle.
3. Tap the bowl to quietly finish the appreciation exercise. Completion fires once; the native auxiliary button uses the same guarded path.

The bowl is one closed lathe-generated mathematical cross-section: flat underside, thick floor, curved outer wall, inner concavity and an open mouth. The lathe is a geometry construction technique, not a claim about how local craftspeople make their work. Shallow hammer depressions deform the shell vertices rather than floating as dots above it. The rolled lip intersects the shell. Mesh `toonSurface` hints retain restrained copper metalness and roughness in the shared `toon-soft` render style.

The work felt, wood base, display felt and pad rest physically meet the tabletop. The finished bowl's underside meets the display felt. Pad stitches and folded edge remain children of the pad assembly during dragging and cancellation.

## Integration anchors and poses

| Role | Mesh or group | Anchor / pose |
| --- | --- | --- |
| First source | `copper-polishing-pad` | Mesh center; local to pad group `[0, .045, 0]` |
| First destination | `copper-bowl-shell` | Bowl local `[0, .43, .705]`, on the front exterior |
| Second source / finish tap | `copper-bowl-shell`, also accepts real `copper-rolled-lip` | Same exterior cue anchor; never the empty mouth center |
| Second destination | `copper-display-felt` | World mesh center `[.94, .855, -.12]` |
| Complete bowl group | `copper-bowl` | Home `[-.63, .745, -.12]`; displayed `[.94, .87, -.12]`; zero rotation |
| Complete pad group | `copper-pad-group` | Home `[-1.25, .74, .66]`; zero rotation |
| Pad contact during wipe | `copper-pad-group` | Bowl local `[0, .43, .708]`, rotation x `2.075`; its thickness extends outside the bowl |

All source and drop decisions use the first visible opaque scene mesh. Drops exclude the held assembly. Invalid or obscured targets, wrong sources, tiny drags, extra pointers, pointer cancellation, lost capture, blur and host inactivity cannot commit progress. Cancelled drags restore the complete assemblies. Accepted motion pauses while inactive. Reduced motion settles immediately. Restoration never emits progress, haptics, wishes, or completion.

## Verification

`npm test --workspace=@wbr/scenes -- src/purepecha-copper-bowl/scene.test.ts`

25 focused tests pass. Initial TDD RED was the real missing startup action against a minimal stub. A further physical-contact RED caught the initial pad orientation pushing its thickness toward the shell; the repaired positive tilt and contact point pass. Tests retain real Three geometry, raycasts, cues, pointer lifecycle and DOM; only WebGL/debug rendering is replaced at the renderer boundary. Covered: the three checkpoints, native action parity, no wish form, silent restoration, foreground blockers, invalid movement, cancellation of full groups, inactivity and reentrancy, camera-safe first-hit anchors at 320/390/1280 pixels, concavity and thickness, resting support, integral rim, polish contact and disposal.

GPU appearance, shared registration, full-suite integration, browser screenshots and mobile builds remain with the parent integration task. This module does not edit shared environment assets.

## 2026-10-20 介绍扩充核查

适用场景：`purepecha-copper-bowl`；最终来源：`santa-clara-copper-craft`。

当前物件与动作：软布擦铜碗、移到毡座、静看锤纹和卷边。

文化说明范围：米却肯Santa Clara地方铜业与日用容器；非普雷佩查宗教仪式。

简化边界：擦拭、毡座和铜色变化为欣赏片段，没有展示熔炼锤锻。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#purepecha-copper-bowl)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。


## 2026-10-26 空间跟手与到位完成

软布工作面到铜碗外壁开始原短擦、整碗底到毡座自动落稳，静看保留。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
