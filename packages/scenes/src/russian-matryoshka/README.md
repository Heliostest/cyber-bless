# 套娃相藏

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

`russian-matryoshka` presents two original painted wooden dolls, drawing on public museum descriptions of matryoshka structure. Sources and cultural boundaries are in `content/traditions/russian-matryoshka.md`.

Three real object drags lift and park the upper shell, carry the smaller doll over the rim into the hollow lower body, and lift the upper shell back into place. The nesting doll remains present inside. Both shells have actual interiors and joined lathe seams. Painted details follow the curved surface. A low felt pad protects the wooden forms; no table or display board.

The colors and flowers are original. This is an assisted object interaction, not a reproduction of a regional costume, museum artifact, manufacturing tutorial or full physics simulation. No wish form, entry sound or efficacy claim; optional quiet confirmation tone.

The scene follows existing lifecycle, cancellation, multitouch, callback ownership, silent restoration, keyboard and disposal contracts. Tests cover real raycasting, cavity clearance, contact, stable geometry and viewport framing. Browser evidence is retained in ignored `artifacts/russian-matryoshka/`.

## 2026-10-20 介绍扩充核查

适用场景：`russian-matryoshka`；最终来源：`russian-matryoshka`。

当前物件与动作：提外壳、收小娃、合接缝；两只原创彩绘木偶。

文化说明范围：1900展出、二十世纪生产及Semenov等地方差异。

简化边界：只展示两个尺寸，配色图案及相套辅助为产品。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#russian-matryoshka)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。

## 2026-10-26 跟手空间安放

三段搬运改为真实物件保持抓取偏移跟手移动；物件锚点进入目标范围后自动落稳，无须按固定方向或凑够像素距离。当前触点在松开前只接纳一次，取消／失焦／暂停复原、键盘辅助与整数存档保持。原器物、动作先后、宗教／民俗语境与来源身份不变；目标指引与触控容差属于产品输入安排，不是传统规则。逐项边界见[本轮 C 组审阅](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。


## 2026-10-26 空间跟手与到位完成

上壳停放、小娃到开口上方准备域再辅助落入、上壳接缝合拢均完整跟手到位；不把内部隐藏终点当目标。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
