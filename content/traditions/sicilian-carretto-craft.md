# 西西里 Carretto 彩绘木车

## 文化与器物

- 西西里carretto是日常运输/农业历史中的木车，也是地方工艺记忆载体。
- 木车有彩绘及雕刻装饰；博物馆专门展示车轮雕工。
- 车身绘画题材可以包含地方历史、史诗与宗教形象，不等同某一圣人节花车。

## 场景对应与范围

场景表现日常 carretto 的木车、车轮和装饰关系。装轮、移展垫是产品操作；它不是 Santa Rosalia 节承载圣人的 Carro Trionfale，几何色块也不复刻历史叙事画。

对应场景：`sicilian-painted-cart`。

## 参考来源

- [Sicilian Cart Museum, Aci Sant’Antonio：Home](https://www.museodelcarrettosiciliano.it/en/home-en/)：已读博物馆首页，carretto/农用车、轮雕、全车绘饰展陈。（2026-10-19，read）
- [Sicilian Cart Museum：Our Story](https://www.museodelcarrettosiciliano.it/en/story/)：已读正文，运输/农业背景、绘画/雕刻及地方工艺记忆。（2026-10-19，read）

逐项核查见[全场景来源审阅](../../docs/research/2026-10-19-scene-culture-audit.md)。

## 2026-10-20 介绍扩充核查

适用场景：`sicilian-painted-cart`；最终来源：`sicilian-carretto-craft`。

十九世纪运输农业与雕绘工艺；不是圣人节大型花车。

本轮已读依据：

- [Museo del Carretto Siciliano, Aci Sant’Antonio — Our Story](https://www.museodelcarrettosiciliano.it/en/story/)：正文24–39行，十九世纪道路运输、农用、雕刻和彩绘题材；2026-10-20，`read`。

范围限制：不将博物馆2014开馆当起源，原创色块没有传统叙事题材。

当前呈现：装木轮到车轴，整车移展垫，静看。 装轮和展示为缩略，不是制车全过程。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../docs/research/2026-10-20-scene-narratives-c.md#sicilian-painted-cart)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。

## 2026-10-23 产品操作容错

适用场景：`sicilian-painted-cart`。本应用扩大近距离触控容差，按物件握点或接触位置识别安放，并增加可松手提示。原有器物与文化主张不变；触屏接受区、展托吸附和反馈属于产品交互，不是传统要求。

本次没有新增文化事实，也未重新登记外部来源为已读。具体实现、产品边界与验证见[操作修正记录](../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 产品输入记录

适用场景：`sicilian-painted-cart`。当前搬运验收与技术验证见[跟手摆放逐场审阅 A 组](../../docs/research/2026-10-26-spatial-placement-audit-a.md)。未更改上述文化与器物／公开实践、来源身份或宗教语境。

## 2026-10-31 本产品自动收尾

适用场景：`sicilian-painted-cart`。

`sicilian-painted-cart`（彩车迎晴）：柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处，目标为 `cart`。

末尾独立静看段按3秒活动时间播放，减少动态为0.6秒并关闭共享收尾的位移／旋转；随后自动完成，不再要求额外轻点静看或结束聆听。前面的物件操作及既有动作动画保持，固定器物不因收尾而漂离安放处。较早产品段中的最终点按条件仅记录历史实现。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

本次只更新本地代码所对应的产品表现。计时、动画、进度及自动完成不构成传统期限、传统动作或祈愿效力；本卡的文化事实、信仰语境、来源分类和外部来源读取状态均未改写。本轮未重新打开外链，也未把旧记录登记为今日已读；逐场目标、产品边界及最终验证待补项见[自动收尾集中记录](../../docs/research/2026-10-31-automatic-quiet-endings.md)。
