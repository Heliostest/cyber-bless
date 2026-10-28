# 连续拿取与查看审查：B 组

日期：2026-10-28。范围为 `packages/scenes/src/` 目录首字母 n–z，`turkish-nazar-bead` 由 A 组／宿主专项处理。已读 [场景来源规范](../scene-provenance.md)，逐项核对下表 scene、model（适用时）与 README 的实际动作；本记录中的源码审查不冒充真实浏览器操作或重新阅读外部文化来源。

## 完整清单（24 个 pose placement 用者＋2 个非 pose 悬挂者）

| 场景 ID | 实际对象与动作 | 本轮处理／不合并原因 |
| --- | --- | --- |
| nanakusa-gayu | 同一木勺入锅轻拌、舀粥移碗、倾勺盛碗归托；前两步 placement | 搅拌、取粥、倾倒具有不同内容，不作为纯悬挂搬运合并；保持粥量转移 |
| neapolitan-cornicello | roots 为 horn、card、giftBox，分别入盒／入卡／整盒前送 | 三个不同物件或装配状态，每个安放已跟手；不合并 |
| persian-esfand | roots 为 pan、pan、clothRoot；提锅、放炉、挥巾 | 合并前两段到炉盘，保留挥巾与烟的实际状态变化 |
| polish-oplatek-sharing | placement roots 为 holder、holder、pieceCarrier；递饼、分角、收下 | 分角和人物接触为真实不同内容；不把它们改成最终放置 |
| pucara-rooftop-bulls | 三步同 actor：托起承板、移屋脊、落稳 | 改为一次连续拿取到最终屋脊承台；保留整板和两牛及最终接触 |
| romanian-martisor | 三步同 cord：提起、套枝、轻放 | 改为连续拿取／可选查看／最终枝上挂放；最终绳环仍由树枝承托 |
| rosh-hashanah-apple-honey | 同 apple：移蜜上、蘸入、回盘 | 实际蘸蜜事件不可删；不得直接回盘就出现蜜层。本轮不改此流程 |
| russian-matryoshka | roots 为 upper、small、upper：开壳、纳入小娃、合壳 | 不同装配动作，各段内部已自由安放；不合并 |
| scottish-first-footing | 同 coal：提起、携过门槛、送入主人炉膛 | 由宿主处理连续路径；必须保留真实敞门与炉口边界，不能透墙 |
| shichigosan-chitose-ame | 三步同 bag/grip：提起、递近、孩子双手接稳 | 搬运合并为最终接收范围；最后接手动画和提手接触保留 |
| sorbian-painted-egg | 画笔彩绘、egg 放陶杯、静看 | 绘画与安放是不同实际行为；不合并 |
| spanish-twelve-grapes | 三个独立 portions 盘组分别安放 | 非同一盘分段；不合并，不修改十二颗总数 |
| sternsinger-house-blessing | chalk 拿到首笔、实际书写、归槽 | 书写不能被普通搬运或旋转查看替代；不合并 |
| sumiyoshi-godairiki | 三个独立五／大／力字石分别入袋 | 非同物分段，每颗内部搬运已连续；不合并 |
| tamagushi-offering | branch 顺时针 90°、换持继续 180°、根向神前供案 | 两段转向与双手持奉有现有直接作法核查，不能当机械搬运删去；仅最终供案是 placement，本轮不改 |
| thai-songkran-elders | cup 捧起、移到双手边、倾水后归位 | 合并前两段搬运，保留倾碗、实际接水与回碗；水平水面继续同步 |
| tibetan-khata-greeting | scarf 托起、递向客、接触后赠者撤手 | 合并前两段搬运；赠者双手跟随，末段交接仍独立 |
| tibetan-water-bowls | jug 提起、七碗分别添水、归壶，共九检查点 | 七个实际接水事件与水位不可变成普通转看；保留现有 0–9 存档，本轮不改 |
| uchide-wishing-mallet | actor 拿起、轻摇、归托 | 摇动本身是所选实践，不由自由查看替代；不合并 |
| vietnamese-bamboo-dragonfly | pivot/head 一次安放，随后可重复任意方向拨弄 | 已有自由持续操作，无同物固定搬运停点；不改 |
| vietnamese-five-fruit-tray | 三个独立水果分别安放 | 非同果分段；不合并 |
| votive-candle-catholic | main.group 一次安放、点芯、静看／可选留言 | 三种不同动作；不合并 |
| weifang-paper-kite | prepared/rightSkin 贴骨、reel 拉线升鸢、body 静看 | 不同对象与实质动作；保留真实牵线与风动，不合并 |
| zeniarai-coin-washing | ladle 举勺、倾水洗币、cloth 擦拭 | 浇水与擦拭均有实际内容；本轮不改，不以普通放置替代 |
| tanzaku-tanabata（非 pose） | 同次 pointerdown 已由 pick 转 hang 并继续跟手，近竹枝后 goWish | 不存在强制重新拿起问题；查看增强由宿主处理，保留静看／文字步骤 |
| tibetan-prayer-flags（非 pose） | 左端抬挂、右端横移低支点、右端抬高；moveRail 投影到屏幕轨道 | 属轨道问题，由宿主处理；绳端、绳长、布面和临时支架应实时重算，不能刚体旋转整个旗串 |

## 本组实际修改的六场

前三场 `romanian-martisor`、`pucara-rooftop-bulls`、`shichigosan-chitose-ame` 只在最终挂放／接稳后报告既有进度 3。旧 0、1、2 均按各自原姿态恢复后允许直达终点，不改技术 ID、引擎和终点语义。

后三场 `persian-esfand`、`thai-songkran-elders`、`tibetan-khata-greeting` 合并旧 0、1 的机械搬运，落定仍报告旧检查点 2，最后挥巾／浇水／交接继续报告 3。水面与手部托持同步是实现约束，任意检查不会绕过实际末动作。

离手未到位时保留拿取姿态，以便重新握住继续移动或查看；取消、失焦、宿主停用和 resize 仍撤回未提交拿取。查看旋转是可选的产品操作，不要求转满一圈，不单独保存进度，不描述为传统程序。辅助按钮执行相同搬运终点；减少动态与旧存档恢复保持一致。

## 文化与来源边界

各场 README 和对应来源卡的传统正文、来源身份及证据访问状态保留。本轮只更新来源卡“本产品呈现”中的输入组织：原本提起／移近／落稳的三段产品分镜不再需要用户分别走完。没有新增传统次数、方向、期限、效力或资格。表中 tamagushi 的传统方向、供水、蘸蜜、书写等有内容的动作没有因共用同一 root 而被删去。

六场既有核查入口分别为同 ID 的 `content/traditions/*.md` 与 `docs/research/2026-10-19-romanian-martisor.md`、`2026-10-23-pucara-rooftop-bulls.md`、`2026-10-20-shichigosan-chitose-ame.md`、`2026-10-20-persian-esfand.md`、`2026-10-20-thai-songkran-elders.md`、`2026-10-20-tibetan-khata-greeting.md`。引用它们是记录未变的文化范围，不声称本轮重新通读外部来源；本轮不新增文化事实主张。

## 验证记录

新增直达终点／旧检查点用例先在旧实现出现 9 项预期失败（红灯日志 `artifacts/continuous-placement-b-red.log`），再修改生产逻辑。旧三段进度断言改为纯搬运 `[3]` 或部分合并 `[2,3]`，保留真实射线／遮挡、错误起手、取消、暂停、失焦、回调重入、反馈、旧进度静默恢复、三宽构图及资源释放的检查意义。

定向命令：`npm.cmd exec -w @wbr/scenes -- vitest run src/romanian-martisor/scene.test.ts src/pucara-rooftop-bulls/scene.test.ts src/shichigosan-chitose-ame/scene.test.ts src/persian-esfand/scene.test.ts src/thai-songkran-elders/scene.test.ts src/tibetan-khata-greeting/scene.test.ts --reporter=dot`，最终 **6 文件、407 项全部通过**，日志为 `artifacts/continuous-placement-b-tests.log`。其中新增 15 项直达终点／旧检查点用例、6 项旋转查看不提交且后续可安放、18 项普通离手后 ownerless 姿态在 blur／pause／resize 恢复。白绢测试绕开真正接收目标来构造未提交放手，不把到位安放误当取消。

本组六场生产逻辑已通过 `npm.cmd run typecheck -w @wbr/scenes`。共享指针与 placement 的双指、鼠标修饰键、重定位、释放、辅助安放实现及其测试由共享代理提供；最终浏览器真实显示和集中提示／键盘／多语言接入由宿主完成，不以本组 jsdom 测试冒充真机或真实 WebGL。
