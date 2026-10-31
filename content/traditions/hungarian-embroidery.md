# 匈牙利民间刺绣

## 文化与器物

- 匈牙利民间刺绣的材料、密度和图案因地区而异，用于衣饰与家用织物。
- Hagyományok Háza记录亚麻、麻、棉布刺绣，并通过展览、作坊与教育传承民间手艺。

## 场景对应与范围

场景取用绷布、针线与花形刺绣的工艺关系。花叶轮廓为产品创作，不指定为 Matyó 或其他特定地区的完整图案，亦不把绣制或留言视为朝圣仪式。

对应场景：`hungarian-embroidery-hoop`。

## 参考来源

- [Hagyományok Háza — Embroidery](https://hagyomanyokhaza.hu/hu/embroidery)：已读正文，直接说明区域差异、布料及家户刺绣；玫瑰故事只作为当地传说，不作效力事实。（2026-10-19，read）
- [Hagyományok Háza — Virtual Hungarian Heritage House](https://hagyomanyokhaza.hu/en/virtual-hungarian-heritage-house)：机构自己的全国民间艺术展及教育项目，列刺绣作品、学校与作坊，支持活态传承。（2026-10-19，read）

逐项核查见[全场景来源审阅](../../docs/research/2026-10-19-scene-culture-audit.md)。

## 2026-10-20 介绍扩充核查

适用场景：`hungarian-embroidery-hoop`；当前来源 slug 仍为 `hungarian-embroidery`。本轮新增介绍的证据范围：地区差异、织物种类、村落家庭生产与二十世纪初集市绣品交易。

- [Hungarian Heritage House / Hagyományok Háza — Embroidery](https://hagyomanyokhaza.hu/hu/embroidery)：地区材料、生产与二十世纪初集市段；网页正文已读；访问日期 2026-10-20。

具体边界与缺口：不认定原创花样为 Matyó 或 Kalocsa，未移用玫瑰传说、护身意义；线轴拖动不等于传统针法。 无新增依赖的失访来源。

当前器物与动作：木绷、亚麻式布面、线轴、原创线花、展托；送线添花、移绷陈列。 短时画面和输入步骤只描述本场呈现，不反向证明传统。逐项研究见[B 组核查记录](../../docs/research/2026-10-20-scene-narratives-b.md#hungarian-embroidery-hoop)；用户介绍统一维护于 `packages/core/src/scene-narratives/b.ts`。

## 2026-10-23 产品操作容错

适用场景：`hungarian-embroidery-hoop`。本应用扩大近距离触控容差，按物件握点或接触位置识别安放，并增加可松手提示。原有器物与文化主张不变；触屏接受区、展托吸附和反馈属于产品交互，不是传统要求。

本次没有新增文化事实，也未重新登记外部来源为已读。具体实现、产品边界与验证见[操作修正记录](../../docs/research/2026-10-23-scene-interaction-fixes.md)。


### hungarian-embroidery-hoop：2026-10-26 产品操作更新

线轴握点到布面留白中心、绣圈底到展托自动落稳；初始源位不落在接受域中，前景遮挡仍阻止提交。 物件跟手、目标容差、自动吸附与提示标记是应用的输入安排，不是来源规定的传统步骤。沿用本卡既有事实与阅读状态，本轮没有新增文化主张或将外部资料登记为重新读过。实际实现与验证边界见[C 组记录](../../docs/research/2026-10-26-spatial-placement-audit-c.md)。

## 2026-10-31 本产品自动收尾

适用场景：`hungarian-embroidery-hoop`。

`hungarian-embroidery-hoop`（花绣寄语）：柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处，目标为 `hoop`。

末尾独立静看段按3秒活动时间播放，减少动态为0.6秒并关闭共享收尾的位移／旋转；随后自动完成，不再要求额外轻点静看或结束聆听。前面的物件操作及既有动作动画保持，固定器物不因收尾而漂离安放处。较早产品段中的最终点按条件仅记录历史实现。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

本次只更新本地代码所对应的产品表现。计时、动画、进度及自动完成不构成传统期限、传统动作或祈愿效力；本卡的文化事实、信仰语境、来源分类和外部来源读取状态均未改写。本轮未重新打开外链，也未把旧记录登记为今日已读；逐场目标、产品边界及最终验证待补项见[自动收尾集中记录](../../docs/research/2026-10-31-automatic-quiet-endings.md)。
