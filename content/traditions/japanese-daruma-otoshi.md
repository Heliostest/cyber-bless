# 木槌落片

达摩落片（だるま落し / daruma otoshi）是日本的木制叠片玩具。Reading Museum的Game馆藏记录说明从底部依次敲出木片，同时不让上方倒下；江户东京博物馆保留编号96007095的同名玩具。红色、带胡须的人物属于馆藏文字记载的一般达摩形象。

这里使用原创三片木片、圆润红色达摩、素面胡须与木槌。向下短拖槌柄对齐底片，向右短拖敲出一片，等上层落稳，再向上抬起木槌。只呈现一次辅助敲片，不表示已经取走全部木片，不承诺好运或宗教效果。

使用预设的接触、滑动与落稳路径；不计算真实冲量、摩擦、重力稳定或自由刚体，不模拟手、制造过程或真实声学。可选声音为合成反馈。形状、色彩、尺寸与面部线条均为原创，未复制馆藏照片、精确纹样、铭文、图章或尺寸，不是馆藏复刻，不代表机构认可。

来源：
- [Reading Museum：Game，REDMG2007.417.1=7](https://collections.readingmuseum.org.uk/index.asp?filename=REDMG&hitsStart=4&mwsquery=%28%7Bsearch%7D%3D%2A%7Bdoll%7D%29&page=record)，木制叠片与底部敲片玩法、一般红色胡须形象。
- [江户东京博物馆：玩具だるま落し，96007095](https://www.edohakuarchives.jp/detail-207470.html)，名称与馆藏语境；尺寸与年代仅为原馆藏资料，不映射到本场景。

## 2026-10-20 介绍扩充核查

适用场景：`japanese-daruma-otoshi`；当前来源 slug 仍为 `japanese-daruma-otoshi`。本轮新增介绍的证据范围：Reading Museum 的日本木制达摩落片玩法与达摩形象；江户东京馆藏昭和三十年代。

- [Reading Museum — Game, REDMG:2007.417.1=7](https://collections.readingmuseum.org.uk/index.asp?filename=REDMG&hitsStart=4&mwsquery=%28%7Bsearch%7D%3D%2A%7Bdoll%7D%29&page=record)：对象描述、玩法与 Daruma 解释；直接 HTML 已读；访问日期 2026-10-20。
- [江戸東京博物館デジタルアーカイブ — 玩具 だるま落し](https://www.edohakuarchives.jp/detail-207470.html)：资料 96007095、年代昭和三十年代；直接 HTML 已读；访问日期 2026-10-20。

具体边界与缺口：馆藏是可考时期，不是发明日期；不把点眼许愿、七转八起等意义移植到敲片动作。 无新增依赖的失访来源。

当前器物与动作：红达摩、三色木片、小木槌；对齐、敲出一片、抬槌。 短时画面和输入步骤只描述本场呈现，不反向证明传统。逐项研究见[B 组核查记录](../../docs/research/2026-10-20-scene-narratives-b.md#japanese-daruma-otoshi)；用户介绍统一维护于 `packages/core/src/scene-narratives/b.ts`。

## 2026-10-23 产品操作容错

适用场景：`japanese-daruma-otoshi`。本应用调整触屏方向提示、长拖与小幅纠正的识别，并提示何时可松手。原有器物、动作顺序与文化主张不变；这些距离、方向图标与容错规则是产品界面安排，不是传统要求。

本次没有新增文化事实，也未重新登记外部来源为已读。具体实现、产品边界与验证见[操作修正记录](../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 本产品输入更新

适用场景：`japanese-daruma-otoshi`。将完整木槌移到底片高度的提示范围，横敲继续保留槌头与底片接触，再把木槌抬离叠片。操作 0、2 的物件锚点或实际布面覆盖进入接收范围后自动接续短落定；方向和固定拖距不再充当这些摆放动作的成功条件。此处只描述本应用当前输入，较早产品呈现中的摆放松手验收已经更新。

原有器物、动作顺序与文化支持范围保持；接受区、自动落定、触摸所有权及辅助按钮是产品设计，不是新增传统要求。本轮未新增文化事实，未把既有卡片或技术测试作为传统证据，也未重新登记外部链接为已读。已有证据的正文段落、访问状态和限制沿用本卡及其链接的逐项研究；本次产品同步与技术验证见[B 组记录](../../docs/research/2026-10-26-spatial-placement-audit-b.md)。
