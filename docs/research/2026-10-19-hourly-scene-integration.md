# 累计场景合并与正式入口

用户于 2026-10-19 授权将累计新场景合入本地 master，保留新版界面及主目录其他改动，重新构建并更新预览；定时开发保持暂停。

本次以 master `561b783020da32e87b9634c8cfe6330118294e37` 合并累计分支 `f1458d0f77d02ce4cda7382e90f78a8dd358d5d3`。保留 master 的界面、原始 78 项来源修正与 35 项正式目录。合并 29 个场景的实现、来源和历史，其中最近 5 个有直接祈愿证据的场景进入正式入口，得到 40 项正式目录与 107 项可审阅实现。

79–102 的 24 项普通工艺、玩具或演奏并未被原始 78 项审阅覆盖。本次保留其代码、来源材料、存档 ID 和小组件资产，但不将其加入正式目录、推荐或原生小组件；这不是对其文化主张的批量验收。连同此前 43 项，App 隐藏集合共 67 项。来源审阅入口保留全部 107 项。

## 新增正式入口与新版提示的证据边界

以下具体来源及已读段落、访问状态、产品简化见对应 README 和专卡；本次沿用已验收核心动作，不新增数量、期限、起源或效力主张。

| ID | 具体实践与提示范围 | 证据记录 |
| --- | --- | --- |
| udo-undama | 鵜户神宫龟岩方凹投陶玉，怀愿投出；单玉与准备阶段为产品简化 | [README](../../packages/scenes/src/udo-undama/README.md)、[专卡](../../content/traditions/udo-undama.md) |
| zeniarai-coin-washing | 宇贺福神社净币片段，柄杓浇币、布巾拭水及财福祈愿；不声称完成全程参拜 | [README](../../packages/scenes/src/zeniarai-coin-washing/README.md)、[专卡](../../content/traditions/zeniarai-coin-washing.md) |
| chinowa-kuguri | 葛西神社夏越大祓的左／右／左穿环绕行与平安健康心意；不加第四穿或本殿参拜 | [README](../../packages/scenes/src/chinowa-kuguri/README.md)、[专卡](../../content/traditions/chinowa-kuguri.md) |
| bonfim-ribbon | Bonfim 栏前彩带三结、每结心中许愿；不加愿望表单或应验承诺 | [README](../../packages/scenes/src/bonfim-ribbon/README.md)、[专卡](../../content/traditions/bonfim-ribbon.md) |
| greek-new-year-pomegranate | 元旦门槛破石榴与家庭好运丰足祝愿；拿取对位是产品准备，不宣称传统三步礼 | [README](../../packages/scenes/src/greek-new-year-pomegranate/README.md)、[专卡](../../content/traditions/greek-new-year-pomegranate.md) |

前两项保留新版宿主可选个人心愿记录，明确是产品功能；后三项不加独立许愿框。现代界面提示只对应眼前动作与有据的对象、场合、心意，不以提示本身证明传统。

## 集成与验证记录

原有共享生命周期测试保持 master 字节不变，新增 29 项单独进入 `packages/app/src/hourly-scene-lifecycle.test.ts`，避免覆盖主目录未提交的 ebru 修改。Web、Android 和序列化 iOS Widget 同步 67 项隐藏集合；已有资产和存档兼容性保留。

验证日志、主目录改动备份与哈希、实际构建和新截图保存在 `artifacts/integrate-scenes-20261019/`；最终报告记录实际结果。后续分支规则见 [场景开发流程](../scene-development-workflow.md)。本次无新增第 108 场，无推送，无定时恢复。
