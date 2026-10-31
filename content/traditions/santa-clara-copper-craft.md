# 圣克拉拉德尔科布雷锤锻铜艺

## 文化与器物

- 圣克拉拉德尔科布雷位于米却肯，考古和历史资料记录当地铜作。
- 当地公开作坊展示铜的加工，城市展售铜制民间工艺品。
- 当地锤锻铜工艺制作日用/烹饪容器等，存在家庭、个人与手工生产作坊。

## 场景对应与范围

场景以普通铜碗的锤纹、卷边和保养观看欣赏地方铜艺。擦拭和毡座是产品动作，不是 Purépecha 亡灵节、cargo 或主保节庆仪式；不据工艺申报文本作法律权利判断。

对应场景：`purepecha-copper-bowl`。

## 参考来源

- [INAH：Santa Clara del Cobre](https://lugares.inah.gob.mx/es/node/4804)：已读56–78行正文，米却肯、前西班牙铜作、现今作坊展示、民间铜艺展售；宗教/cargo另段不用于本场景。（2026-10-19，read）
- [墨西哥官方公报 / 米却肯州申报文本：Cobre Martillado de Santa Clara del Cobre](https://sidof.segob.gob.mx/notas/docFuente/5704188)：已读申报文本14–41行的器类/锻制/家庭与个人作坊说明。仅采工艺描述，不作地理标志法律权利结论。（2026-10-19，read）

逐项核查见[全场景来源审阅](../../docs/research/2026-10-19-scene-culture-audit.md)。

## 2026-10-20 介绍扩充核查

适用场景：`purepecha-copper-bowl`；最终来源：`santa-clara-copper-craft`。

米却肯Santa Clara地方铜业与日用容器；非普雷佩查宗教仪式。

本轮已读依据：

- [Instituto Nacional de Antropología e Historia — Santa Clara del Cobre](https://lugares.inah.gob.mx/es/node/4804)：正文56–78行，考古、殖民时期生产和当代作坊段；2026-10-20，`read`。
- [Casa de las Artesanías de Michoacán — Concurso del Cobre Martillado reúne 387 piezas en Santa Clara del Cobre](https://iam.gob.mx/public/concurso-del-cobre-martillado-reune-387-piezas-en-santa-clara-del-cobre)：正文38–43行，铜器竞赛、获奖器类与展售；2026-10-20，`read`。

范围限制：技术ID中的purepecha不据此扩大为全民族器物和信仰；无本碗祈福寓意。

当前呈现：软布擦铜碗、移到毡座、静看锤纹和卷边。 擦拭、毡座和铜色变化为欣赏片段，没有展示熔炼锤锻。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../docs/research/2026-10-20-scene-narratives-c.md#purepecha-copper-bowl)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。


### purepecha-copper-bowl：2026-10-26 产品操作更新

软布工作面到铜碗外壁开始原短擦、整碗底到毡座自动落稳，静看保留。 物件跟手、目标容差、自动吸附与提示标记是应用的输入安排，不是来源规定的传统步骤。沿用本卡既有事实与阅读状态，本轮没有新增文化主张或将外部资料登记为重新读过。实际实现与验证边界见[C 组记录](../../docs/research/2026-10-26-spatial-placement-audit-c.md)。

## 2026-10-31 本产品自动收尾

适用场景：`purepecha-copper-bowl`。

`purepecha-copper-bowl`（铜碗拾暖）：柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处，目标为 `bowl`。

末尾独立静看段按3秒活动时间播放，减少动态为0.6秒并关闭共享收尾的位移／旋转；随后自动完成，不再要求额外轻点静看或结束聆听。前面的物件操作及既有动作动画保持，固定器物不因收尾而漂离安放处。较早产品段中的最终点按条件仅记录历史实现。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

本次只更新本地代码所对应的产品表现。计时、动画、进度及自动完成不构成传统期限、传统动作或祈愿效力；本卡的文化事实、信仰语境、来源分类和外部来源读取状态均未改写。本轮未重新打开外链，也未把旧记录登记为今日已读；逐场目标、产品边界及最终验证待补项见[自动收尾集中记录](../../docs/research/2026-10-31-automatic-quiet-endings.md)。
