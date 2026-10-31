# 立陶宛 Sodai 草编花园

## 文化与器物

- 立陶宛sodai是由草秆连接成精确几何形体的悬饰，常见两座共方底的相反金字塔。
- 草编花园用于婚礼、婴儿摇篮上方、家庭餐桌及岁时节庆，也用于当代居室；和谐、福祉的寄寓有国家文化中心直接记述。

## 场景对应与范围

场景取用草秆、线与悬挂双锥几何的关系。和谐寄寓有文化中心记载；产品的拼装顺序、展架和可选留言不能被说成固定婚俗步骤或保证家庭和谐。

对应场景：`lithuanian-straw-garden`。

## 参考来源

- [Lithuanian National Culture Centre — Tradition of straw gardens](https://savadas.lnkc.lt/en/elements/element-list/tradition-of-straw-gardens/)：已读国家非遗清单全文，直接说明几何、双锥、家户和谐寄寓、地方节庆与当代传承。（2026-10-19，read）
- [Ministry of Culture of Lithuania — Nomination application Tradition of Straw Gardens](https://lrkm.lrv.lt/en/news/nomination-application-tradition-of-straw-gardens-submitted-to-unesco/)：已读正文，支持共底双锥、家户/节庆用途与多代工艺传承。（2026-10-19，read）
- [Lithuania government portal — Lithuanian Straw Garden Making Added to UNESCO](https://lithuania.lt/news/culture-in-lithuania/preserving-heritage-lithuanian-straw-mobiles-added-to-unesco-intangible-heritage-list/)：已读正文，支持2023列入与公共/私人空间中的传承实践。（2026-10-19，read）

逐项核查见[全场景来源审阅](../../docs/research/2026-10-19-scene-culture-audit.md)。

## 2026-10-20 介绍扩充核查

适用场景：`lithuanian-straw-garden`；当前来源 slug 仍为 `lithuanian-straw-gardens`。本轮新增介绍的证据范围：立陶宛地域、Aukštaitija 延续、结构、摇篮/婚桌/家庭节庆及幸福丰育和睦意义。

- [Lithuanian National Culture Centre — Tradition of straw gardens](https://savadas.lnkc.lt/en/elements/element-list/tradition-of-straw-gardens/)：Description、地域、摇篮婚礼节庆与传承正文；网页已读；访问日期 2026-10-20。

具体边界与缺口：未定最初年代；不以遗产入选年作起源。不把工坊木架当传统礼仪空间，木珠/接法是产品设计。 无新增依赖的失访来源。

当前器物与动作：中空草秆双锥、侧饰、下部菱形、木珠线和工坊架；拼接悬挂静赏。 短时画面和输入步骤只描述本场呈现，不反向证明传统。逐项研究见[B 组核查记录](../../docs/research/2026-10-20-scene-narratives-b.md#lithuanian-straw-garden)；用户介绍统一维护于 `packages/core/src/scene-narratives/b.ts`。

## 2026-10-23 产品操作容错

适用场景：`lithuanian-straw-garden`。本应用扩大近距离触控容差，按物件握点或接触位置识别安放，并增加可松手提示。原有器物与文化主张不变；触屏接受区、展托吸附和反馈属于产品交互，不是传统要求。

本次没有新增文化事实，也未重新登记外部来源为已读。具体实现、产品边界与验证见[操作修正记录](../../docs/research/2026-10-23-scene-interaction-fixes.md)。


### lithuanian-straw-garden：2026-10-26 产品操作更新

下菱形接珠、完整悬饰挂线到木架挂点自动落稳，已接部分随整园移动。 物件跟手、目标容差、自动吸附与提示标记是应用的输入安排，不是来源规定的传统步骤。沿用本卡既有事实与阅读状态，本轮没有新增文化主张或将外部资料登记为重新读过。实际实现与验证边界见[C 组记录](../../docs/research/2026-10-26-spatial-placement-audit-c.md)。

## 2026-10-31 本产品自动收尾

适用场景：`lithuanian-straw-garden`。

`lithuanian-straw-garden`（草穗悬园）：悬挂物的轻摆（`sway`），只作小幅转动，不让物件离开挂点漂走，目标为 `mobile`。

末尾独立静看段按3秒活动时间播放，减少动态为0.6秒并关闭共享收尾的位移／旋转；随后自动完成，不再要求额外轻点静看或结束聆听。前面的物件操作及既有动作动画保持，固定器物不因收尾而漂离安放处。较早产品段中的最终点按条件仅记录历史实现。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

本次只更新本地代码所对应的产品表现。计时、动画、进度及自动完成不构成传统期限、传统动作或祈愿效力；本卡的文化事实、信仰语境、来源分类和外部来源读取状态均未改写。本轮未重新打开外链，也未把旧记录登记为今日已读；逐场目标、产品边界及最终验证待补项见[自动收尾集中记录](../../docs/research/2026-10-31-automatic-quiet-endings.md)。
