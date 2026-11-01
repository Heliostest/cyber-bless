# 单步场景拿近查看

核查日期：2026-10-29（Asia/Shanghai）。适用范围是[操作步数核查](2026-10-29-scene-step-audit.md)发现的 15 个单次输入场景。用户选择先把完整物件拿近，默认自动绕看，同时允许手动接管，然后继续原安放。设计与约束见[规格](../superpowers/specs/2026-10-29-close-object-inspection-design.md)和[实施计划](../superpowers/plans/2026-10-29-close-object-inspection.md)。本轮扩充产品观察操作，没有增加文化事实、传统仪序主张或圈数要求。

## 实际产品变化

初次点按物件、拖动后松手或点「拿近看看」，整体抬起可搬动物件，镜头约 0.65 秒靠近，约 6 秒环绕一周，再用约 0.5 秒恢复原安放视角。「继续安放」可以提前返回。单指拖动或方向键接管后停止自动环绕，由用户自行继续。减少动态时直接进入稳定近景，不自动环绕，仍可手动查看或继续。

镜头围绕完整物件的视觉中心观察，承板上的成对陶牛、锁饰与项绳、纸雏草托、糖袋及内容物均保持整体关系；没有把托盘上的物件翻倒。查看过程中关闭原安放输入与落点提示，查看不提交进度、心愿或完成。恢复原视角后，仍用原连续拿放完成真实最终接触；界面显示查看、安放两个动作点。查看只是新增产品阶段，不要求等满时长或转满一圈。

技术 ID、引擎标识、来源 slug、存档结构与完成值 `3` 保留。旧 `0/1/2` 从保存姿态进入查看，旧完成状态不重播。取消、失焦、暂停、尺寸变化和销毁须恢复未提交查看的物件、相机与环境；原安放阶段的既有生命周期规则保留。

## 逐场器物与最终接触

下表对照已读的本地场景 README、原安放实现以及来源卡的产品呈现段。来源身份不因添加镜头观察而变化。

| 场景 ID | 拿近的完整物件 | 查看之后的原最终动作／接触 | 最终来源 |
| --- | --- | --- | --- |
| `brat-bride-cloth` | 整片双层方布 | 铺到窗户户外侧的窗台 | [brat-bride-cloth](../../content/traditions/brat-bride-cloth.md) |
| `korean-sotdae` | 木鸟与整根长竿 | 扶正，竿脚落入开放承孔 | [korean-sotdae](../../content/traditions/korean-sotdae.md) |
| `japanese-kadomatsu` | 右侧完整门松 | 落在门前石面，与左侧成对 | [japanese-kadomatsu](../../content/traditions/japanese-kadomatsu.md) |
| `pucara-rooftop-bulls` | 共同承板及一对陶牛 | 承板落到屋脊承台，双牛仍站在同一板上 | [pucara-rooftop-bulls](../../content/traditions/pucara-rooftop-bulls.md) |
| `chinese-longevity-lock` | 承板、锁片、项绳及坠饰 | 完整承板落到礼匣内垫 | [chinese-longevity-lock](../../content/traditions/chinese-longevity-lock.md) |
| `alasita-miniature-house` | 完整微型小屋 | 放到前方软垫 | [aymara 的 Alasita 专段](../../content/traditions/aymara.md#2026-10-23alasita微型房屋场景补充) |
| `scottish-first-footing` | 带来的整块煤礼 | 通过敞开的主人家门洞，再从炉膛正面送入；门柱、门槛和炉壁净空保留 | [scottish-first-footing](../../content/traditions/scottish-first-footing.md) |
| `mochigase-nagashibina` | 草托及其纸雏、桃枝、点心 | 草托触水后接续短漂行，托上物件同组 | [mochigase-nagashibina](../../content/traditions/mochigase-nagashibina.md) |
| `shichigosan-chitose-ame` | 糖袋、提手及袋内包装糖 | 放低后等待孩子双手接稳提手 | [shichigosan-chitose-ame](../../content/traditions/shichigosan-chitose-ame.md) |
| `lanna-sand-pagoda` | 整幅纸幡与竹杆 | 裸杆尖插入塔旁沙座 | [lanna-sand-pagoda](../../content/traditions/lanna-sand-pagoda.md) |
| `chinese-fu-paper` | 整张红纸及字形 | 贴稳在木门最终位置 | [chinese-fu-paper](../../content/traditions/chinese-fu-paper.md) |
| `turkish-nazar-bead` | 护眼珠及金属挂环 | 挂环落到木架横轴，完整挂件悬稳 | [turkish-nazar-bead](../../content/traditions/turkish-nazar-bead.md) |
| `japanese-hamaya` | 饰矢、羽片、红带及小铃 | 木杆落在后方双托木架 | [japanese-hamaya](../../content/traditions/japanese-hamaya.md) |
| `chinese-ruyi-scepter` | 完整云头曲柄如意 | 放稳在右侧双托木座 | [chinese-ruyi-scepter](../../content/traditions/chinese-ruyi-scepter.md) |
| `romanian-martisor` | 绳环与红白双流苏 | 花枝承托绳环，两流苏垂下 | [romanian-martisor](../../content/traditions/romanian-martisor.md) |

## 来源与文化影响复核

本轮实际阅读的是以上 15 张本地来源卡的器物／公开实践、产品呈现、证据支持范围和访问状态，以及对应 README。外部正文没有重新访问；卡内逐来源的标题、机构、URL、相关段落、原阅读日期与访问差异继续保留。本轮没有把本地卡片或实现测试当作新增传统事实的独立证据，也没有将“部分可读／失访／仅文本”升级为已读全文或看过图片。

| 本地复核范围 | 保留的事实与信仰语境 | 本轮不能据此增加的主张 |
| --- | --- | --- |
| Brat Bríde、Sotdae、门松、陶牛、长命锁的器物与公开实践段；各卡 2026-10-23 的证据范围 | 留布祈护、村落向天祈愿、迎接年神、陶牛护家及礼俗容器历史、锁饰护子等已有有限关联 | 拿近查看或环绕属于传统程序；统一造型、资格、颜色、次数或现实效果 |
| Aymara 卡 Alasita 专段及其 UNESCO／MUSEF 已读记录 | 愿望微型物、房屋实例、Ekeko、安第斯祝圣与天主教祝福的已有范围 | 镜头绕看等于祝圣或完整仪式；房产／财富承诺；本卡其他主题为本场背书 |
| First-footing 的文化与器物段及 2026-10-23 访问差异 | 午夜后首位来客向主人家庭赠煤、祝温暖安康，并保留地区差异 | 普遍资格、固定煤数、统一投煤礼序，或将其改成给自己捡煤取暖 |
| 用瀬流雏、千岁饴、Mărțișor 的器物／公开实践与 2026-10-19／20 证据段 | 形代祓厄与成长祝愿、家长给孩子的成长赠礼、佩戴后挂花枝及地方差异 | 环绕次数、额外祈祷、固定佩戴期限或保证健康；把赠礼／放流片段说成完整礼程 |
| 沙塔、贴福、护眼珠、饰矢、如意的器物／公开实践及 2026-10-23 对应证据 | 兰纳佛教修福与地方救度信念、春节贴福纳祥、避恶眼信念、神道祈护、如意吉祥寄愿 | 统一礼法、方位、时长、圈数、期限或功效；将有信仰背景的器物改写为原本只是装饰 |

结论：这次变化全部归入产品观察安排。没有新增起源、寓意、节期、资格、数量或效力主张；已有宗教、民俗、赠礼对象和文化限定保留，不需要更换来源绑定或建立 `product-original` 卡。具体器物事实和原访问缺口继续由各专卡及其链接的逐项研究承担，不因本次产品扩充而补造证据。

## 文案与八语同步

15 个 README 顶部记录当前查看与原安放；较早输入说明保留并标明历史。15 张来源卡新增的内容全部位于“本产品拿近查看”段，文化事实与旧证据段没有改写。Core 的 15 条介绍与八语 narratives 保留原段落、文化限定和稳定 ID，只替换旧的可选旋看尾句，明确先查看、再原安放，以及手动接管、提前继续、减少动态和不必转满一圈。

共用 7 句提示登记在 `scene-source.json` 和八语 scenes 目录，使用 `scene.close-inspection.*` 稳定 ID。翻译按 `zh-Hans`、`zh-Hant`、`en`、`ja`、`ko`、`es`、`pt`、`fr` 自审新增操作的含义、按键、自动／手动转换与文化限定；没有声称母语认证或设备读屏验证。按既有提取、词表验证、内容 hash 审阅、编译及原生生成流程更新生成物，不直接修改生成代码。

## 核查清单与验证范围

- [x] 对照完整搬动物件、原安放对象、场合及最终接触；观察阶段没有反向当成传统依据。
- [x] 本轮新增内容全部明确为产品操作，没有新增需要外部证据的文化主张。
- [x] 原专卡及 Aymara 的 Alasita 专段继续直接对应物件，没有改用地区索引或无关总卡。
- [x] 原信仰、地区差异、赠礼对象及不保证现实效果的边界保留。
- [x] README、产品来源段、研究记录、介绍和八语目录同步；旧正文读取状态保持原样。
- [x] 不改技术 ID、引擎、来源分类、可见标题或完成值；无需变更宿主目录、注册表、metadata 或原生标题。
- [x] 逐条自审 7 句共用提示和 15 条介绍的八语改动，未把 hash 校验当作事实审查。
- [x] 文案与场景回归、类型检查、完整 App 构建及浏览器验证均已执行，具体范围和结果见下文。

本任务的文案验证结果：

- `npm.cmd run i18n:extract`：571 个源文件、3,391 个已登记文字位置，无提取漂移。另列 537 个动态位置，未据此宣称所有动态内容已经审查。
- `node scripts/i18n-check.mjs`：八语各 3,063 个词条，缺失为 0；ID、ICU、参数及介绍段落一致。
- 按既有流程执行 `i18n:record-review`、`i18n:compile`、`i18n:generate-native`：记录内容 hash，自审范围如上，编译 3,024 个源词条并生成／核对原生资源。
- `npm.cmd run i18n:test`：22 项 Vitest 与 20 项 Node 测试通过。
- `npm.cmd run i18n:verify`：提取、带审阅 hash 的完整词表检查、编译产物漂移、21 份原生生成文件检查及 i18n 类型检查通过。
- Core 场景记录、App 可见性、意图文案共 3 文件 20 项通过；Content catalog 1 文件 5 项通过。
- `git diff --check` 通过。旧正文访问状态及文化限定采用人工差异复核；这些测试结果不代替来源事实审阅。

上述文字与来源边界为本地自审，未进行母语或真机认证。实际场景集成验证如下。

## 场景集成与实际浏览器验证

15 场保留原连续拿放与实体接触实现，新增共用控制器。共用输入拥有权隔离了查看和安放，查看结束后显示第二个动作点。查看只改变完整 actor 的位置和相机，零件相对变换、材质及旧完成值保持。

独立审阅发现并修复两处输入边界：指针取消恢复完整近景状态；减少动态下，继续按钮瞬时返回后的连点不再穿透到安放。两项均取得实际失败回归后修复通过。浏览器复查还把查看按钮由通用“辅助”改为直接显示“继续安放”，并为夜间近景增加可撤回的相机补光，让煤块表面可辨；未把黑色煤块改为发光或改换材质。

- App 相关 4 文件 222 项通过，覆盖目录、入口／回访、宿主进度、可选文字和适配器。
- 最终场景回归 19 文件、1,370 项通过，包含全部 15 场、共用查看、文字绑定、蓝珠连续拿放与跨场景恢复。日志见[最终场景回归](../../artifacts/close-inspection-2026-10-29/scenes-final.log)。
- 15 场原模型与煤块搬运的专项几何、接触和净空测试通过；近景测试另覆盖 284／390／1280 宽度、真实 actor 全周顶点构图与相对变换稳定。
- `npm.cmd run build` 在最终代码上通过，包含八语 verify、类型构建及生产打包。构建仍报告既有大分包提示，不影响退出码；本轮没有进行分包重构。
- 实际 Chromium／WebGL、390×844：15 场均走通拾取、原生触摸转看、提前继续和原安放，页面错误为 0。另走通陶牛、蓝珠、饰矢的完整自动一圈后返回安放，页面错误为 0；夜间布与煤块在补光后再验完成。

可复核资料：[浏览器报告](../../artifacts/close-inspection-2026-10-29/browser/report.json)、[自动环视报告](../../artifacts/close-inspection-2026-10-29/browser/report-automatic.json)、[15 场近景图](../../artifacts/close-inspection-2026-10-29/browser/close-contact-sheet.png)、[生产构建日志](../../artifacts/close-inspection-2026-10-29/build.log)。浏览器使用真实 GPU 渲染接口与原生触摸事件；单元测试用真实几何并替代 GPU 边界，两种证据分别保留。未据此宣称 iPhone 真机、所有画风／分辨率或母语审核完成。
