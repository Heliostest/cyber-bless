# 鲤旗迎风

`japanese-koinobori` is an original single-carp appreciation scene inspired by public Children's Day decorations and craft activities. References and boundaries are in `content/traditions/japanese-koinobori.md`.

Three actual object drags unfold the cloth tail to the right, pull the wooden halyard toggle downward to raise the carp, and slide the toggle right into a cleat. A real open cloth tube, original scale colors, paired tail flaps, mouth bridles, pulley and grounded pole form the scene. The free halyard end descends by the same distance that the carp rises. A continuous breeze bends the free cloth and flicks the tail, growing smoothly with actual hoisting height before the rope is secured. Dragging and settlement preserve wind phase; reduced motion, focus and pauses remain respected. No extra display furniture or invisible hit proxy.

The cloth uses an original 1024 × 512 anti-aliased print with staggered curved scales, gill arcs, a light belly and tail rays. UVs follow the cloth through unfurling and flutter; the print does not depend on mesh vertex colors. Layered eye rings conform to both curved sides. Texture pixels are generated locally without DOM, downloads or runtime assets, and each rig releases its own GPU texture with the cloth material.

Original colors and rig; not a complete traditional display, copied workshop design, physics simulation or real hoisting instruction. Cultural wishes are described without efficacy claims or fixed gender/color mappings. No wish form or entry sound; optional quiet confirmation tone.

Lifecycle, invalid gestures, callbacks, silent checkpoints0–3 and idempotent cleanup follow the existing scene contract. Tests retain real geometry/raycasting and cover cloth openings, actual targets, reciprocal hoisting, support, stable buffers and all-vertex framing. Browser evidence is retained under ignored `artifacts/japanese-koinobori/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `japanese-koinobori`。核查范围：日本儿童节、江户时期的有限追溯、鲤鱼跃龙传说及男孩成长祝愿；颜色/家庭组合与住宅尺度的变化。

边界：来源用据说追溯，介绍保留限定；不把中国传说当真实动物史，不固定颜色对每位家庭成员的含义。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#japanese-koinobori)与[来源卡](../../../../content/traditions/japanese-koinobori.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。
