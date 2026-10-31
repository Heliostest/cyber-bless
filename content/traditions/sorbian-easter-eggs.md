# 卢萨蒂亚索布族复活节彩蛋

## 文化与器物

- 索布族复活节彩蛋工艺在卢萨蒂亚公共市场、家庭礼赠及文化机构中延续。
- 承传者文化中心记述蜡绘、染色、刮刻等技法；当代博物馆也开设公众彩绘体验。

## 场景对应与范围

场景以彩蛋描饰和展示欣赏索布族公开工艺。屏幕画笔是简化交互，不声称演示蜡染、刮刻全套技法或以骑乘巡游照片作为纹样依据。

对应场景：`sorbian-painted-egg`。

## 参考来源

- [City of Bautzen — Sorbian Traditions and Customs](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs)：已读正文的Sorbian Easter Egg Market，直接说明蜡绘、染色、擦拭、刮刻与参与体验。（2026-10-19，read）
- [Museum Sorbische Webstube Drebkau — Ostereiermarkt 2025](https://www.sorbische-webstube.de/veranstaltungen/2670118/2025/03/30/ostereiermarkt-2025.html)：已读博物馆实际活动，说明艺术家示范与公众绘蛋体验。（2026-10-19，read）
- [Sorbian Cultural Information Centre — Sorbian Customs](https://info.sorben.com/wp-content/uploads/2020/06/Br%C3%A4ucheENG.pdf)：已读PDF第9–10页，直接说明彩蛋礼赠与蜡绘等技法。（2026-10-19，read）

逐项核查见[全场景来源审阅](../../docs/research/2026-10-19-scene-culture-audit.md)。

## 2026-10-20 介绍扩充核查

适用场景：`sorbian-painted-egg`；最终来源：`sorbian-easter-eggs`。

德国卢萨蒂亚索布社群、教父母礼赠地域实例及生命力信念，真实技术多样。

本轮已读依据：

- [City of Bautzen — Sorbian Traditions and Customs](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs)：Sorbian Easter Egg Market正文；2026-10-20，`read-direct-http`。
- [Museum Sorbische Webstube Drebkau — Ostereiermarkt 2025](https://www.sorbische-webstube.de/veranstaltungen/2670118/2025/03/30/ostereiermarkt-2025.html)：活动正文6–22行；2026-10-20，`read`。
- [Sorbian Cultural Information Centre — Sorbian Customs](https://info.sorben.com/wp-content/uploads/2020/06/Br%C3%A4ucheENG.pdf)：PDF印刷页9–11，Easter Egg Decoration：赠礼、教父母、蜡绘染色与公开市场；2026-10-20，`read-direct-http`。

范围限制：“数世纪”不作精确始年；本场花枝没有传统纹样释义。

当前呈现：画笔添原创花枝、彩蛋放陶杯、静看或祝愿。 画笔显纹不冒称热蜡多次染色教程，陶杯为展示。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../docs/research/2026-10-20-scene-narratives-c.md#sorbian-painted-egg)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。

## 2026-10-23 产品操作容错

适用场景：`sorbian-painted-egg`。本应用扩大近距离触控容差，按物件握点或接触位置识别安放，并增加可松手提示。原有器物与文化主张不变；触屏接受区、展托吸附和反馈属于产品交互，不是传统要求。

本次没有新增文化事实，也未重新登记外部来源为已读。具体实现、产品边界与验证见[操作修正记录](../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 产品输入记录

适用场景：`sorbian-painted-egg`。当前搬运验收与技术验证见[跟手摆放逐场审阅 A 组](../../docs/research/2026-10-26-spatial-placement-audit-a.md)。未更改上述文化与器物／公开实践、来源身份或宗教语境。

## 2026-10-31 本产品自动收尾

适用场景：`sorbian-painted-egg`。

`sorbian-painted-egg`（彩蛋寄春）：柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处，目标为 `egg`。

末尾独立静看段按3秒活动时间播放，减少动态为0.6秒并关闭共享收尾的位移／旋转；随后自动完成，不再要求额外轻点静看或结束聆听。前面的物件操作及既有动作动画保持，固定器物不因收尾而漂离安放处。较早产品段中的最终点按条件仅记录历史实现。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

本次只更新本地代码所对应的产品表现。计时、动画、进度及自动完成不构成传统期限、传统动作或祈愿效力；本卡的文化事实、信仰语境、来源分类和外部来源读取状态均未改写。本轮未重新打开外链，也未把旧记录登记为今日已读；逐场目标、产品边界及最终验证待补项见[自动收尾集中记录](../../docs/research/2026-10-31-automatic-quiet-endings.md)。
