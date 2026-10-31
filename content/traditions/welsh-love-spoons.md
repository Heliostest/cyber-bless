# 威尔士爱勺木雕

## 文化与器物

- 威尔士爱勺是精雕木勺礼物，表达爱意与感情；博物馆收藏历史与当代多种作品。
- Museum Wales最早有明确日期的馆藏为1667年，机构也明确说起源仍不确定；当代用于多种纪念赠礼。

## 场景对应与范围

场景以木勺表面处理和礼赠心意呼应爱勺工艺。心形孔、菱形及纹样为产品组合，不设置一套通用传统符号字典，也不将它关联到 Mari Lwyd 表演。

对应场景：`welsh-love-spoon`。

## 参考来源

- [Amgueddfa Cymru / Museum Wales — Welsh love spoons](https://museum.wales/blog/1033/Welsh-love-spoons/)：已读HTTP全文与网页正文，直接说明赠礼、木雕、风格差异及起源不确定。（2026-10-19，read）
- [Visit Wales — Traditional Welsh craft activities](https://www.visitwales.com/things-do/culture/cultural-activities/have-go-some-traditional-welsh-crafts)：已读官方旅游正文，直接说明爱勺雕刻作坊、当代礼赠与定制实践。（2026-10-19，read）

逐项核查见[全场景来源审阅](../../docs/research/2026-10-19-scene-culture-audit.md)。

## 2026-10-20 介绍扩充核查

适用场景：`welsh-love-spoon`；最终来源：`welsh-love-spoons`。

威尔士1667有年款存世例、十八十九世纪求爱工艺及现代纪念礼。

本轮已读依据：

- [Amgueddfa Cymru / Museum Wales — Welsh love spoons](https://museum.wales/blog/1033/Welsh-love-spoons/)：正文21–38行及symbols段，1667、十八十九世纪、制作和当代用途；2026-10-20，`read-direct-http`。

范围限制：1667不是发明年；本场镂空不作固定寓意解码。

当前呈现：布擦凹勺，持柄放展托，静看或留言。 擦拭展示为产品照料动作，无完整雕刻或固定赠勺仪式。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../docs/research/2026-10-20-scene-narratives-c.md#welsh-love-spoon)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。

## 2026-10-23 产品操作容错

适用场景：`welsh-love-spoon`。本应用扩大近距离触控容差，按物件握点或接触位置识别安放，并增加可松手提示。原有器物与文化主张不变；触屏接受区、展托吸附和反馈属于产品交互，不是传统要求。

本次没有新增文化事实，也未重新登记外部来源为已读。具体实现、产品边界与验证见[操作修正记录](../../docs/research/2026-10-23-scene-interaction-fixes.md)。


### welsh-love-spoon：2026-10-26 产品操作更新

布工作面到勺面开始原短拭、整勺底到展托自动落稳；静看与可选留言保留。 物件跟手、目标容差、自动吸附与提示标记是应用的输入安排，不是来源规定的传统步骤。沿用本卡既有事实与阅读状态，本轮没有新增文化主张或将外部资料登记为重新读过。实际实现与验证边界见[C 组记录](../../docs/research/2026-10-26-spatial-placement-audit-c.md)。

## 2026-10-31 本产品自动收尾

适用场景：`welsh-love-spoon`。

`welsh-love-spoon`（木勺寄情）：柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处，目标为 `spoon`。

末尾独立静看段按3秒活动时间播放，减少动态为0.6秒并关闭共享收尾的位移／旋转；随后自动完成，不再要求额外轻点静看或结束聆听。前面的物件操作及既有动作动画保持，固定器物不因收尾而漂离安放处。较早产品段中的最终点按条件仅记录历史实现。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

本次只更新本地代码所对应的产品表现。计时、动画、进度及自动完成不构成传统期限、传统动作或祈愿效力；本卡的文化事实、信仰语境、来源分类和外部来源读取状态均未改写。本轮未重新打开外链，也未把旧记录登记为今日已读；逐场目标、产品边界及最终验证待补项见[自动收尾集中记录](../../docs/research/2026-10-31-automatic-quiet-endings.md)。
