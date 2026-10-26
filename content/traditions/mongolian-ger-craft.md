# 蒙古包传统工艺

## 概览

蒙古包（Ger）是可拆装的圆形居所，以木格围壁、椽杆和顶圈组成框架，外覆毡与帆布，并用绳带收束。制作涉及木作、装饰、缝纫和制毡，知识通过家庭协作和匠人指导传承。蒙古包传统工艺及相关习俗于 2013 年列入 UNESCO 非物质文化遗产代表作名录。

## 本产品的场景呈现

「毡屋向阳」用原创缩略模型表现展开木格、支起屋顶、铺覆白毡的材料变化。为手机交互简化了杆件数量、支柱装配和覆层顺序，不是完整搭建教程，也不再现入居礼仪。门板几何装饰为原创，不赋予宗教或祈愿效果。

2026-10-19 操作更新：木格端头和顶圈对齐浅金轮廓后松手，白毡卷拖到木架覆盖区后松手。高亮目标、放置确认、三步进度和辅助按钮均为应用交互设计，不是传统搭建的固定规则；本次重新读取下列主要来源的 Description 正文与名录年份栏，器物与工艺关联未变化。具体核查及实现边界见[场景 README](../../packages/scenes/src/mongolian-felt-ger/README.md)。

## 手机互动适合度

- **档位：** C 可做致敬小品。
- **敏感度：** 中。
- **范围：** 公开的居住工艺与协作知识。
- **边界：** 当代工艺欣赏；不把多地生活方式概括为单一仪式。
- **评估状态：** 产品设计判断，不代表社区认证。

## 参考来源

- [蒙古国文化遗产国家中心 / ICHCAP ichLinks Mongolia · Traditional craftsmanship of Mongol ger](https://mongolia.ichlinks.com/archive/elements/elementsV.do?contentsI18NCd=en-US&elementsUid=13829896140267001030)，2026-10-19 阅读正文与名录年份栏。用于木格、顶圈、椽杆、双支柱与门的结构关系，制毡、缝制帆布、家庭协作与匠人指导传承，以及 2013 年列入名录的信息。未复制照片、纹样或音频。
- [UNESCO · Traditional craftsmanship of the Mongol Ger and its associated customs](https://ich.unesco.org/en/RL/traditional-craftsmanship-of-the-mongol-ger-and-its-associated-customs-00872)，保留访问记录：2026-10-15 曾核对搜索索引，2026-10-19 直达页仍遇人工验证；本轮以可读的蒙古国文化遗产机构正文为主要依据，不声称通读该页。

## 2026-10-20 介绍扩充核查

适用场景：`mongolian-felt-ger`；当前来源 slug 仍为 `mongolian-ger-craft`。本轮新增介绍的证据范围：蒙古国前杭爱/乌兰巴托记录、结构、家庭协作和匠人/师徒传承。

- [National Centre for Cultural Heritage of Mongolia / ichLinks — Traditional craftsmanship of the Mongol Ger and its associated customs](https://mongolia.ichlinks.com/archive/elements/elementsV.do?contentsI18NCd=en-US&elementsUid=13829896140267001030)：地域、Description、Value、Transmission；直接 HTML 已读；访问日期 2026-10-20。

具体边界与缺口：没有可据的首次建造年代；不把 2013 申报年当起源，不加朝向祭祀含义。当前不是完整可住结构/搭建指南。 无新增依赖的失访来源。

当前器物与动作：可展木格、顶圈/椽架、白毡；展格、稳圈、覆毡。 短时画面和输入步骤只描述本场呈现，不反向证明传统。逐项研究见[B 组核查记录](../../docs/research/2026-10-20-scene-narratives-b.md#mongolian-felt-ger)；用户介绍统一维护于 `packages/core/src/scene-narratives/b.ts`。


### mongolian-felt-ger：2026-10-26 产品操作更新

格架端、顶圈、毡卷分别跟手到真实目标，框架与毡面依进度连动；锚点入域自动落稳。 物件跟手、目标容差、自动吸附与提示标记是应用的输入安排，不是来源规定的传统步骤。沿用本卡既有事实与阅读状态，本轮没有新增文化主张或将外部资料登记为重新读过。实际实现与验证边界见[C 组记录](../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
