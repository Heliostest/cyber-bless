# 鲤旗迎风

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

`japanese-koinobori` is an original single-carp appreciation scene inspired by public Children's Day decorations and craft activities. References and boundaries are in `content/traditions/japanese-koinobori.md`.

Three actual object drags unfold the cloth tail to the right, pull the wooden halyard toggle downward to raise the carp, and slide the toggle right into a cleat. A real open cloth tube, original scale colors, paired tail flaps, mouth bridles, pulley and grounded pole form the scene. The free halyard end descends by the same distance that the carp rises. A continuous breeze bends the free cloth and flicks the tail, growing smoothly with actual hoisting height before the rope is secured. Dragging and settlement preserve wind phase; reduced motion, focus and pauses remain respected. No extra display furniture or invisible hit proxy.

The cloth uses an original 1024 × 512 anti-aliased print with staggered curved scales, gill arcs, a light belly and tail rays. UVs follow the cloth through unfurling and flutter; the print does not depend on mesh vertex colors. Layered eye rings conform to both curved sides. Texture pixels are generated locally without DOM, downloads or runtime assets, and each rig releases its own GPU texture with the cloth material.

Original colors and rig; not a complete traditional display, copied workshop design, physics simulation or real hoisting instruction. Cultural wishes are described without efficacy claims or fixed gender/color mappings. No wish form or entry sound; optional quiet confirmation tone.

Lifecycle, invalid gestures, callbacks, silent checkpoints0–3 and idempotent cleanup follow the existing scene contract. Tests retain real geometry/raycasting and cover cloth openings, actual targets, reciprocal hoisting, support, stable buffers and all-vertex framing. Browser evidence is retained under ignored `artifacts/japanese-koinobori/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `japanese-koinobori`。核查范围：日本儿童节、江户时期的有限追溯、鲤鱼跃龙传说及男孩成长祝愿；颜色/家庭组合与住宅尺度的变化。

边界：来源用据说追溯，介绍保留限定；不把中国传说当真实动物史，不固定颜色对每位家庭成员的含义。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#japanese-koinobori)与[来源卡](../../../../content/traditions/japanese-koinobori.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 空间跟手与到位完成

鱼尾展开形变保留；木坠沿绳端跟手升鲤，再到实际挂座自动挂稳，绳长与鲤鱼反向位移关系保留。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。


## 2026-10-28 光学材质技术更新

印花鱼身与双片尾布接入低强度漫透射及织纹；保留原印花贴图、双面显示、动态顶点、贴图释放与不透明遮挡。

本轮为材质显示层技术变化，纸、布与有机表面保持不透明；几何、原有配色/印字、动作、完成条件、来源字段、标题、技术 ID 和存档兼容性不变。文化影响沿用[本 README 既有来源核查与产品边界](README.md)，未新增材料出处、传统步骤或信仰功效主张；技术实现不作为文化证据。统一方案、已读技术来源与验证范围见[本轮接入记录](../../../../docs/research/2026-10-28-ritual-optics-integration.md)。
