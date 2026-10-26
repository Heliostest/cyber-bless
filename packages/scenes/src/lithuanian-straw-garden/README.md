# 草穗悬园

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/lithuanian-straw-gardens.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。

Original hollow straw double-pyramid mobile with two side ornaments, a separate lower diamond, thread joins, visible wooden handling beads and two workshop supports. Assemble the lower piece, suspend the complete garden and pause quietly. No wish writer.

Read `content/traditions/baltic-folk.md` and viewed its JPG (a Latvian midsummer torch photograph, not a straw garden); no source image is copied. The broad Baltic card supplies context only: this scene specifically concerns Lithuanian craft.

Primary sources checked 2026-10-13:

- [Lithuanian National Commission for UNESCO — Šiaudinių sodų tradicija](https://unesco.lt/kultura/nematerialaus-kulturos-paveldo-sarasai/siaudiniu-sodu-tradicija/): straw structures, commonly two pyramids sharing a base, used for family festivities and contemporary interiors, and their living transmission.
- [Lithuania government portal](https://lithuania.lt/news/culture-in-lithuania/preserving-heritage-lithuanian-straw-mobiles-added-to-unesco-intangible-heritage-list/): 2023 intangible-heritage inscription and public/private craft display. The central UNESCO listing initially returned an access challenge; the national commission's full text was read instead.

The original arrangement and handling beads are designed for this contemporary craft exercise. The scene does not claim household protection, perform a wedding or birth rite, or simulate Romuva leadership. Sources explain context, not this invented three-step sequence.

Physical anchors:
1. `straw-pendant-grip` → `straw-join-bead`, connecting the lower diamond.
2. `straw-lift-bead` → `straw-display-peg`, hanging the entire attached structure.
3. `straw-lift-bead`, a quiet tap.

Real whole-scene rays reject foreground occluders; drops exclude only the held part. Tests cover 320/390/1280 first-visible hits, reparented lower ornament, hanging contact, input cancellation and ownership, pause/blur, silent restore, reduced motion, no wish side effects and complete resource cleanup. Browser integration is verified by the root task.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `lithuanian-straw-gardens`。核查范围：立陶宛地域、Aukštaitija 延续、结构、摇篮/婚桌/家庭节庆及幸福丰育和睦意义。

边界：未定最初年代；不以遗产入选年作起源。不把工坊木架当传统礼仪空间，木珠/接法是产品设计。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#lithuanian-straw-garden)与[来源卡](../../../../content/traditions/lithuanian-straw-gardens.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。

## 2026-10-23 产品交互容错

下部小菱形的可见草编与木珠都可拿取，连接珠、顶部木珠和木架挂点采用屏幕邻近容差。

可见目标周边最多扩展 22 CSS px，触摸与鼠标共用判定；画布外、远处空白及更近的不相关实物遮挡仍不接纳。进入有效落区显示「可以松手，轻轻落稳」，离开或取消、失焦、暂停时清除提示；有效释放后用已有动画落稳，保留原有步骤与存档。

这些是产品操作容错与反馈，不增加传统步骤、数量或寓意；文化关联沿用上方已核查范围。变更与验证见[本轮交互修正记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 空间跟手与到位完成

下菱形接珠、完整悬饰挂线到木架挂点自动落稳，已接部分随整园移动。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
