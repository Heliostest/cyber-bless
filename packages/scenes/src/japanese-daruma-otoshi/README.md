# 木槌落片

场景技术 ID：`japanese-daruma-otoshi`。当前呈现：红达摩、三色木片、小木槌；对齐、敲出一片、抬槌。

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `japanese-daruma-otoshi`。核查范围：Reading Museum 的日本木制达摩落片玩法与达摩形象；江户东京馆藏昭和三十年代。

边界：馆藏是可考时期，不是发明日期；不把点眼许愿、七转八起等意义移植到敲片动作。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#japanese-daruma-otoshi)与[来源卡](../../../../content/traditions/japanese-daruma-otoshi.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 操作容错

箭头与方向判定共用动作方向配置；正确方向支持短拖、长拖、合理斜拖及小幅纠正，达到条件时显示可以松手。明显反向、回到起点、取消和多指仍不推进。仅调整产品输入容错与完成提示，未改变器物、文化主张、三步动作顺序、来源归属、技术 ID 或存档。核查与验证见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
