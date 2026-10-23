# 场景操作容错与到位反馈修正

核查日期：2026-10-23。用户已批准按[全场景操作审阅](2026-10-23-scene-interaction-audit.md)直接修复。本文记录最终产品输入规则、文化影响范围及验证证据；技术距离和采样条件都属于产品实现。

## 修正范围

- 53个旧方向场景：箭头与方向轴共用配置，正确长拖和小幅纠正保持有效；达到释放条件即提示动作已到位。
- 红绳、春锅、水引、奉谢小牌、油灯：按连续轨迹覆盖识别路线，保留有序检查点，减少事件采样频率导致的漏判，并显示进度。
- 木勺、彩车、彩蛋、草穗悬园、茉莉花环：修正物件接触与手指位置不一致、小触控区域和深度缩小落区的问题。
- 釉彩映晴、蓝白晾晴、彩心、花绣四种放置模板：加入相同近距离触控容差、握点对齐与到位提示；彩心相连挂带也可抓取。
- 木版留春：多次正常松手的刷印累积；取消当前笔划保留此前接受的覆盖。

## 当前产品输入规则

方向动作允许起手约20px的找准与纠正，保留最小有意位移，去除84px最大拖距和90px固定路径预算。小幅修正与合理斜拖不会让完成动作失效；回到起点、明显反向、取消和多指仍不会误推进。到位提示与最终释放使用同一个判定。模型动作、阶段顺序与技术ID不变。

放置只在画布内接纳操作，近邻容差最多22 CSS px，不允许绕过更近的前景实体。指针或实际握点/接触锚点进入接纳区时显示可以松手，目标提示环高亮，释放后通过既有落座动画归位。离开接纳区或取消、失焦、暂停后清除准备反馈。动态文字在既有提示行显示，不再被宿主裁成仅供读屏的内容；画布位置保持稳定。

轨迹按照前后事件之间的连续线段或弧段识别，不把每个事件点恰好落在小目标上作为完成要求。检查点顺序和路线覆盖仍然保留；小偏离可以回正，不能用直接起终点捷径替代整条路线。具体算法与边界由相关回归测试记录。

## 来源与文化影响

本次逐场核对了既有器物、动作、步骤与完成条件。改变的是触屏输入的解算、产品接受区及反馈，不是新增一套文化流程、次数、期限或寓意。器形、材料、原有文化叙述、场合、来源分类、标题、原生组件标题、宿主目录、注册表、模块metadata及存档版本均不因这些容错变化改写。

来源卡和场景README分别追加产品呈现说明，并链接本记录。product-original场景不创建传统来源卡。已有文化事实沿用各场景README和来源卡内的逐项研究记录，包括[2026-10-19核查](2026-10-19-scene-culture-audit.md)及2026-10-20专项核查；未将本次技术测试或代码当成传统证据。

本次没有新增/改变需要外部证明的文化事实，因此没有新登记外部正文为已读；也没有声称重新通读原有全部来源。若后续改变器物动作组合或文化叙述，应按[来源规范](../scene-provenance.md)另外核查相应主张。

## 对应场景与来源

| 场景 | 输入修正 | 来源身份 |
| --- | --- | --- |
| 七巧归方 `chinese-tangram` | 方向与过拖 | [chinese-tangram](../../content/traditions/chinese-tangram.md) |
| 拨浪轻响 `chinese-rattle-drum` | 方向与过拖 | [chinese-rattle-drum](../../content/traditions/chinese-rattle-drum.md) |
| 木窝播籽 `ghanaian-oware` | 方向与过拖 | [ghanaian-oware](../../content/traditions/ghanaian-oware.md) |
| 木压成圆 `mexican-tortilla-press` | 方向与过拖 | [mexican-tortilla-press](../../content/traditions/mexican-tortilla-press.md) |
| 柊鰯守门 `hiiragi-iwashi` | 方向与过拖 | [hiiragi-iwashi](../../content/traditions/hiiragi-iwashi.md) |
| 玉串奉愿 `tamagushi-offering` | 方向与过拖 | [tamagushi-offering](../../content/traditions/tamagushi-offering.md) |
| 清水七供 `tibetan-water-bowls` | 方向与过拖 | [tibetan-water-bowls](../../content/traditions/tibetan-water-bowls.md) |
| 开樽祝愿 `kagami-biraki-sake` | 方向与过拖 | [kagami-biraki-sake](../../content/traditions/kagami-biraki-sake.md) |
| 经幡迎风 `tibetan-prayer-flags` | 方向与过拖 | [tibetan-prayer-flags](../../content/traditions/tibetan-prayer-flags.md) |
| 蘸蜜迎岁 `rosh-hashanah-apple-honey` | 方向与过拖 | [rosh-hashanah-apple-honey](../../content/traditions/rosh-hashanah-apple-honey.md) |
| 浇水敬老 `thai-songkran-elders` | 方向与过拖 | [thai-songkran-elders](../../content/traditions/thai-songkran-elders.md) |
| 木鷽迎福 `kameido-usokae` | 方向与过拖 | [kameido-usokae](../../content/traditions/kameido-usokae.md) |
| 熏籽祈安 `persian-esfand` | 方向与过拖 | [persian-esfand](../../content/traditions/persian-esfand.md) |
| 纸雏祈安 `mochigase-nagashibina` | 方向与过拖 | [mochigase-nagashibina](../../content/traditions/mochigase-nagashibina.md) |
| 新岁分糕 `greek-vasilopita` | 方向与过拖 | [greek-vasilopita](../../content/traditions/greek-vasilopita.md) |
| 白绢迎客 `tibetan-khata-greeting` | 方向与过拖 | [tibetan-khata-greeting](../../content/traditions/tibetan-khata-greeting.md) |
| 千岁赠糖 `shichigosan-chitose-ame` | 方向与过拖 | [shichigosan-chitose-ame](../../content/traditions/shichigosan-chitose-ame.md) |
| 敖包祈护 `mongolian-ovoo` | 方向与过拖 | [mongolian-ovoo](../../content/traditions/mongolian-ovoo.md) |
| 浴佛发愿 `fgs-buddha-bathing` | 方向与过拖 | [fgs-buddha-bathing](../../content/traditions/fgs-buddha-bathing.md) |
| 叶盘献谢 `balinese-canang-sari` | 方向与过拖 | [balinese-canang-sari](../../content/traditions/balinese-canang-sari.md) |
| 彩枝贺年 `bulgarian-survakane` | 方向与过拖 | [bulgarian-survakane](../../content/traditions/bulgarian-survakane.md) |
| 节分撒豆 `setsubun-mamemaki` | 方向与过拖 | [setsubun-mamemaki](../../content/traditions/setsubun-mamemaki.md) |
| 门楣祝家 `sternsinger-house-blessing` | 方向与过拖 | [sternsinger-house-blessing](../../content/traditions/sternsinger-house-blessing.md) |
| 林村抛愿 `lam-tsuen-wishing-tree` | 方向与过拖 | [lam-tsuen-wishing-tree](../../content/traditions/lam-tsuen-wishing-tree.md) |
| 镜饼迎岁 `kagami-mochi-offering` | 方向与过拖 | [kagami-mochi-offering](../../content/traditions/kagami-mochi-offering.md) |
| 红白寄春 `romanian-martisor` | 方向与过拖 | [romanian-martisor](../../content/traditions/romanian-martisor.md) |
| 三石寄愿 `sumiyoshi-godairiki` | 方向与过拖 | [sumiyoshi-godairiki](../../content/traditions/sumiyoshi-godairiki.md) |
| 薄饼相祝 `polish-oplatek-sharing` | 方向与过拖 | [polish-oplatek-sharing](../../content/traditions/polish-oplatek-sharing.md) |
| 破榴迎新 `greek-new-year-pomegranate` | 方向与过拖 | [greek-new-year-pomegranate](../../content/traditions/greek-new-year-pomegranate.md) |
| 栏前结愿 `bonfim-ribbon` | 方向与过拖 | [bonfim-ribbon](../../content/traditions/bonfim-ribbon.md) |
| 茅环祈安 `chinowa-kuguri` | 方向与过拖 | [chinowa-kuguri](../../content/traditions/chinowa-kuguri.md) |
| 泉水净币 `zeniarai-coin-washing` | 方向与过拖 | [zeniarai-coin-washing](../../content/traditions/zeniarai-coin-washing.md) |
| 龟岩投愿 `udo-undama` | 方向与过拖 | [udo-undama](../../content/traditions/udo-undama.md) |
| 木槌落片 `japanese-daruma-otoshi` | 方向与过拖 | [japanese-daruma-otoshi](../../content/traditions/japanese-daruma-otoshi.md) |
| 纸翼转风 `paper-pinwheel` | 方向与过拖 | [paper-pinwheel](../../content/traditions/paper-pinwheel.md) |
| 移砣平衡 `chinese-steelyard` | 方向与过拖 | [chinese-steelyard](../../content/traditions/chinese-steelyard.md) |
| 草坪过门 `garden-croquet` | 方向与过拖 | [garden-croquet](../../content/traditions/garden-croquet.md) |
| 悬锤纺线 `welsh-drop-spindle` | 方向与过拖 | [welsh-drop-spindle](../../content/traditions/welsh-drop-spindle.md) |
| 木杆搅乳 `scottish-plunge-churn` | 方向与过拖 | [scottish-plunge-churn](../../content/traditions/scottish-plunge-churn.md) |
| 鼓面轻拍 `irish-bodhran` | 方向与过拖 | [irish-bodhran](../../content/traditions/irish-bodhran.md) |
| 手磨晨光 `french-coffee-mill` | 方向与过拖 | [french-coffee-mill](../../content/traditions/french-coffee-mill.md) |
| 纸伞舒晴 `japanese-wagasa` | 方向与过拖 | [japanese-wagasa](../../content/traditions/japanese-wagasa.md) |
| 木壳轻拍 `spanish-castanets` | 方向与过拖 | [spanish-castanets](../../content/traditions/spanish-castanets.md) |
| 竹筒叩石 `japanese-shishi-odoshi` | 方向与过拖 | [japanese-shishi-odoshi](../../content/traditions/japanese-shishi-odoshi.md) |
| 牵绳木偶 `german-jumping-jack` | 方向与过拖 | [german-jumping-jack](../../content/traditions/german-jumping-jack.md) |
| 五弦轻拨 `finnish-kantele` | 方向与过拖 | [finnish-kantele](../../content/traditions/finnish-kantele.md) |
| 秋千轻荡 `estonian-village-swing` | 方向与过拖 | [estonian-village-swing](../../content/traditions/estonian-village-swing.md) |
| 银球近靶 `french-petanque` | 方向与过拖 | [french-petanque](../../content/traditions/french-petanque.md) |
| 风囊轻送 `english-hearth-bellows` | 方向与过拖 | [english-hearth-bellows](../../content/traditions/english-hearth-bellows.md) |
| 石面磨香 `mexican-metate` | 方向与过拖 | [mexican-metate](../../content/traditions/mexican-metate.md) |
| 木齿轻转 `czech-wooden-ratchet` | 方向与过拖 | [czech-wooden-ratchet](../../content/traditions/czech-wooden-ratchet.md) |
| 瓜棱轻奏 `puerto-rican-guiro` | 方向与过拖 | [puerto-rican-guiro](../../content/traditions/puerto-rican-guiro.md) |
| 折扇轻风 `valencian-folding-fan` | 方向与过拖 | [valencian-folding-fan](../../content/traditions/valencian-folding-fan.md) |
| 木版留春 `chinese-woodblock-print` | 跨笔划刷印 | [chinese-woodblock-print](../../content/traditions/chinese-woodblock-print.md) |
| 花绣寄语 `hungarian-embroidery-hoop` | 触控与落座 | [hungarian-embroidery](../../content/traditions/hungarian-embroidery.md) |
| 釉彩映晴 `andalusian-ceramic-tile` | 触控与落座 | [andalusian-ceramic-tile](../../content/traditions/andalusian-ceramic-tile.md) |
| 彩车迎晴 `sicilian-painted-cart` | 触控与落座 | [sicilian-carretto-craft](../../content/traditions/sicilian-carretto-craft.md) |
| 蓝白晾晴 `bai-indigo-cloth` | 触控与落座 | [bai-tie-dye](../../content/traditions/bai-tie-dye.md) |
| 木勺寄情 `welsh-love-spoon` | 触控与落座 | [welsh-love-spoons](../../content/traditions/welsh-love-spoons.md) |
| 彩心相赠 `croatian-licitar-heart` | 触控与落座 | [croatian-licitar](../../content/traditions/croatian-licitar.md) |
| 彩蛋寄春 `sorbian-painted-egg` | 触控与落座 | [sorbian-easter-eggs](../../content/traditions/sorbian-easter-eggs.md) |
| 草穗悬园 `lithuanian-straw-garden` | 触控与落座 | [lithuanian-straw-gardens](../../content/traditions/lithuanian-straw-gardens.md) |
| 红绳自持 `hongsheng-red-string` | 连续轨迹 | product-original |
| 绘牌记谢 `italian-ex-voto` | 连续轨迹 | [italian-ex-voto](../../content/traditions/italian-ex-voto.md) |
| 春锅共煮 `navruz-sumalak` | 连续轨迹 | [uzbek-sumalak-cooking](../../content/traditions/uzbek-sumalak-cooking.md) |
| 灯旋一瞥 `diya-oil-lamp` | 连续轨迹 | [diya-oil-lamp](../../content/traditions/diya-oil-lamp.md) |
| 水引结愿 `mizuhiki` | 连续轨迹 | [mizuhiki](../../content/traditions/mizuhiki.md) |
| 串花寄意 `phuang-malai` | 触控与落座 | [phuang-malai](../../content/traditions/phuang-malai.md) |
| 铁舌轻鸣 `malawi-sansi` | 共享方向容差 | [mbira-sansi-craft](../../content/traditions/mbira-sansi-craft.md) |
| 剑玉轻接 `japanese-kendama` | 共享方向容差 | [japanese-kendama-craft](../../content/traditions/japanese-kendama-craft.md) |
| 鲤旗迎风 `japanese-koinobori` | 共享方向容差 | [japanese-koinobori](../../content/traditions/japanese-koinobori.md) |
| 套娃相藏 `russian-matryoshka` | 共享方向容差 | [russian-matryoshka](../../content/traditions/russian-matryoshka.md) |
| 木柶行棋 `korean-yutnori` | 共享方向容差 | [korean-yutnori](../../content/traditions/korean-yutnori.md) |
| 空竹轻扬 `chinese-diabolo` | 共享方向容差 | [chinese-diabolo](../../content/traditions/chinese-diabolo.md) |
| 棉线慢成 `indian-charkha` | 共享方向容差 | [indian-charkha-craft](../../content/traditions/indian-charkha-craft.md) |
| 木偶开果 `german-nutcracker` | 共享方向容差 | [erzgebirge-nutcracker-craft](../../content/traditions/erzgebirge-nutcracker-craft.md) |
| 木旋起沫 `mexican-molinillo` | 共享方向容差 | [molinillo-chocolate-craft](../../content/traditions/molinillo-chocolate-craft.md) |
| 拨珠见数 `chinese-suanpan` | 共享方向容差 | [chinese-zhusuan](../../content/traditions/chinese-zhusuan.md) |
| 葫芦刻光 `peruvian-engraved-gourd` | 共享方向容差 | [peruvian-mate-burilado](../../content/traditions/peruvian-mate-burilado.md) |
| 玻珠凝彩 `venetian-glass-bead` | 共享方向容差 | [italian-glass-beads](../../content/traditions/italian-glass-beads.md) |
| 竹蜓点风 `vietnamese-bamboo-dragonfly` | 共享方向容差 | [thach-xa-bamboo-dragonfly](../../content/traditions/thach-xa-bamboo-dragonfly.md) |
| 浮彩成笺 `turkish-ebru-paper` | 共享方向容差 | [turkish-ebru](../../content/traditions/turkish-ebru.md) |
| 纸鸢乘风 `weifang-paper-kite` | 共享方向容差 | [weifang-kite-craft](../../content/traditions/weifang-kite-craft.md) |
| 影偶小戏 `chinese-shadow-puppet` | 共享方向容差 | [chinese-shadow-puppet](../../content/traditions/chinese-shadow-puppet.md) |
| 毛线织暖 `faroese-wool-knit` | 共享方向容差 | [faroese-wool-knitting](../../content/traditions/faroese-wool-knitting.md) |
| 贝链留光 `niue-shell-necklace` | 共享方向容差 | [niue-kahoa-hihi](../../content/traditions/niue-kahoa-hihi.md) |

## 验证

### 回归与生产构建

| 检查 | 结果与范围 |
| --- | --- |
| core、runtime、app、gestures、shared | 首五个工作区1037项通过；包含目录、元数据、可选留言及样式回归。 |
| scenes完整套件 | 198文件7257项在同一次最终运行中全部通过，耗时198.48秒；常规入口先检查全部场景及测试源码，再以4个worker、每项30秒预算运行，无未处理错误。 |
| content | 5文件37项通过。 |
| scene-runtime | 8文件141项通过。 |
| 木鱼资产检查 | 全部通过，资源与闭合几何未回归。 |
| npm run build | tsc -b与Vite生产构建通过；仍有既有大于500kB的分包体积提示。 |
| npm run verify | 补齐测试源码类型与Expo兼容补丁后，从根目录完整重跑，退出码0；8472项业务测试、8项移动构建脚本测试、Web生产构建、移动类型和依赖检查，以及Android/iOS原生与DOM生产导出均通过。两平台各14项离线资源哈希和iOS的396项离线widget封面哈希通过。 |
| 浏览器真实输入 | 六场景、鼠标与CDP原生触摸共42条步骤/流程记录通过，页面错误0。 |
| 文档与来源一致性 | 86场景README均链接本记录；85张来源卡原有正文与基线逐字一致，只追加产品容错说明。 |
| git diff --check | 本轮文件检查通过；存在Windows换行提示，不影响检查结果。 |

浏览器命令：`node scripts/verify-scene-interaction-tolerance.mjs`，配合`npm run dev -- --host 127.0.0.1 --port 5182`。覆盖三石、茅环、浇水三场的85/120/180px长拖及20px回拉，以及木勺、草编、彩蛋的前两步真实放置；同时断言可松手文字确实可见。其他场景由真实Three几何、相机、射线与指针回归覆盖，未冒称逐场真机触控验收。

### 超时与重跑记录

最初`npm test`的场景套件在并行负载下出现5秒预算超时和worker RPC上报超时；限制4个worker后仍有7文件、8项超时（其余7249项通过），没有功能断言失败。浏览器验证结束后，以下7文件以单worker、30秒预算重新完整执行，260项全部通过，未改断言：

- `puerto-rican-guiro/scene.test.ts`
- `tibetan-prayer-flags/scene.test.ts`
- `turkish-ebru-paper/scene.test.ts`
- `amazigh-woven-rug/scene.test.ts`
- `tibetan-prayer-flags/model.test.ts`
- `russian-matryoshka/model.test.ts`
- `valencian-folding-fan/model.test.ts`

首轮交付最后一次完整运行`npm run test -w @wbr/scenes -- --maxWorkers=4 --testTimeout=30000`：198文件7257项全部通过，无worker RPC或其他未处理错误。结合其他7个工作区，总计8472项测试获得通过结果。该轮超时预算调整仅用于验证命令，没有将反向、取消、遮挡或错误路径的断言放宽成任意成功；后续将相同参数写入常规测试配置，见下。

交叉审阅另外发现并先红后绿修复四模板握点备用路径绕过手指前景（4项）、刷印四舍五入提前显示完成及离开纸面仍提示可松手（2项）；起手反向20px找准后正向完成也补入53场回归。

### 测试源码类型检查补齐

后续按用户要求修复额外检查发现的全部11处旧测试类型错误：方法spy通过`mock.contexts`核对调用时的this；Three几何、Shape数组、普通/交错顶点属性和DataTexture使用正确的联合类型收窄；DOM集合通过`Array.from`转换。手磨包围盒仍逐顶点计算，木齿与木勺新增明确的挤出几何和单Shape断言，没有用忽略指令或宽泛类型绕过检查。场景操作、文化说明和来源关联未因此更改。

`packages/scenes/package.json`新增`typecheck`，并使`test`先检查全部场景及测试源码，再运行Vitest。`vitest.config.ts`固定最大4个worker和每项30秒预算，沿用此前完整验证的参数，使根目录`npm test`与`npm run verify`自动执行同一检查流程。8个受影响文件的181项定向测试及源码类型检查已通过。

补齐类型检查后的首轮根目录`npm run verify`通过全部8472项测试、木鱼资产检查、Web生产构建和移动端类型检查，但因Expo兼容依赖落后而返回1，日志为`artifacts/interaction-fixes-2026-10-23/full-verify.log`。按Expo SDK 57兼容要求执行`expo install --fix`并同步依赖与锁文件：8个直接依赖的实际安装版本更新，另包含对应工具链与传递依赖更新；未跨SDK或React Native版本。随后`expo install --check`已返回`Dependencies are up to date`。该失败未登记为完整通过。

修正兼容依赖后再次从头执行`npm run verify`，本次退出码0，完整结果见上表；日志为`artifacts/interaction-fixes-2026-10-23/full-verify-final.log`，移动资源证据保存在`artifacts/mobile-verification`。保留既有Vite大分包和Metro颜色环境变量提示，没有通过跳过类型检查、删除断言或绕过依赖检查使流程通过。

随后重新执行`node scripts/verify-scene-interaction-tolerance.mjs`，退出码0：六个代表场景在鼠标与CDP原生触摸下共42条步骤/流程记录全部通过，页面错误数组为空。新日志为`artifacts/interaction-fixes-2026-10-23/browser-final.log`，报告为`artifacts/interaction-fixes-2026-10-23/browser/report.json`；覆盖长拖及回拉、木勺/草编/彩蛋放置和可见吸附反馈。

## 来源规范交付清单

- [x] 实际器物、动作与完成条件逐项对应；新增接受路径被记录为产品操作容错。
- [x] 未新增传统事实、起源、数量、期限或寓意；无用技术测试反证传统的情况。
- [x] 未替换来源或新增同地区错绑；来源分类与技术ID保持兼容。
- [x] 来源卡与README区分既有文化关联和本次产品输入变化。
- [x] 实现、提示、回归、构建与浏览器验证完成并记录；后续补齐测试源码类型错误，并将该检查接入常规测试入口。
