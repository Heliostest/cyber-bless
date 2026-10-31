# 2026-10-31 自动动态收尾与文化边界核查

核查日期：2026-10-31。范围以实际引入 `createQuietEnding` 的52个 `scene.ts` 为准；逐项读取收尾配置，并对照注册表、模块 metadata、场景 README 及对应来源卡的产品说明。本轮改变屏幕收尾表现和完成触发，不改变器物身份、文化事实、信仰语境、来源分类、技术ID、引擎版本或存档格式。

本地依据：[项目协作规范](../../AGENTS.md)、[场景来源与文化关联核查规范](../scene-provenance.md)、[共享收尾实现](../../packages/scenes/src/quiet-ending.ts)、[场景注册表](../../packages/scenes/src/registry.ts)、[宿主原生写愿适配](../../packages/app/src/procedural-scene.ts)。代码只能证明本产品怎样运行，不能反向证明传统要求。

## 当前产品行为

- 52场在原有真实操作完成、进入独立静看／静候段后，播放3秒活动时间的自然动态并自动完成。减少动态使用0.6秒，关闭共享收尾的位移／旋转。之前的折叠、倾茶、上升等动作动画不包含在这3秒内。
- `glow` 共40场，只改变柔和光泽，不额外移动固定展品；`sway` 共10场，小幅转动挂物；`bob` 共2场，只用于原有水面或悬浮物的起落。共享效果结束复原，不把固定器物、供物或展台漂走。纸鹤另用已有翼部折痕轻扇，属于产品动画。
- 原末尾“再点静看／静听／静立”的物件点按和辅助按钮不再是完成条件；此前 README、产品卡段落或历史测试中的此类说明由本次当前产品说明取代。尚未完成的真实物件操作仍需原验收，不能因文案包含“静看”便自动跳过。
- 收尾期间只保留不明显的细进度条，不显示“正在收尾”等可见文字。此次显示调整不改变3秒／0.6秒计时、自动完成或原生输入暂停逻辑。
- 暂停、失焦、页面隐藏以及实际原生编辑暂停计时；销毁取消，不补发完成。结束前先记录终态，防止宿主回调重入造成重复完成。旧末尾未完成档重新播放；已完成档静默显示，不再发奖励。
- 原生写愿输入框获得焦点、IME组合输入或留有非空白未提交草稿时，保留文字并暂停计时；明确提交沿用原保存路径。App的 `deferWishWriting` 仍把可选祈愿放在动作完成之后，不因空写愿容器而停住，也不要求写字才能完成。
- `bokjori` 的共享3秒后保留约0.55秒收稳，普通模式约3.55秒；`clootie-well-rag` 保留约0.65秒垂落，约3.65秒。减少动态时这两段原有落定立即结算。
- 珠星旧检查点1、2均表示已组装后的查看阶段，都可恢复自动收尾；其他物理前置步骤不因此跳过。

## 逐场实际配置与原来源

以下字段直接取自本轮源码和注册表。目标列为 `targets()` 返回的对象表达式；`glow` 不承诺每种材质完全相同的外观。52场的注册表与模块 metadata 来源字段静态对照一致。本表不新增文化归属，5个 `product-original` 场景没有创建传统卡。

| 场景ID | 当前标题 | 最终 motion | target 对象 | 原 sourceSlug |
| --- | --- | --- | --- | --- |
| [`aland-votive-ship`](../../packages/scenes/src/aland-votive-ship/scene.ts) | 舟模寄谢 | `glow` | `ship` | [`aland-votive-ship`](../../content/traditions/aland-votive-ship.md) |
| [`amazigh-woven-rug`](../../packages/scenes/src/amazigh-woven-rug/scene.ts) | 织毯寄暖 | `glow` | `rug` | [`moroccan-amazigh-textiles`](../../content/traditions/moroccan-amazigh-textiles.md) |
| [`andalusian-ceramic-tile`](../../packages/scenes/src/andalusian-ceramic-tile/scene.ts) | 釉彩映晴 | `glow` | `panel` | [`andalusian-ceramic-tile`](../../content/traditions/andalusian-ceramic-tile.md) |
| [`bai-indigo-cloth`](../../packages/scenes/src/bai-indigo-cloth/scene.ts) | 蓝白晾晴 | `glow` | `cloth` | [`bai-tie-dye`](../../content/traditions/bai-tie-dye.md) |
| [`barcelos-clay-rooster`](../../packages/scenes/src/barcelos-clay-rooster/scene.ts) | 陶鸡报晓 | `glow` | `rooster` | [`barcelos-clay-rooster`](../../content/traditions/barcelos-clay-rooster.md) |
| [`basque-sunflower`](../../packages/scenes/src/basque-sunflower/scene.ts) | 太阳花迎门 | `glow` | `flower` | [`basque-eguzkilore`](../../content/traditions/basque-eguzkilore.md) |
| [`blang-tea`](../../packages/scenes/src/blang-tea/scene.ts) | 茶山一盏 | `glow` | `cup` | [`jingmai-tea-forest`](../../content/traditions/jingmai-tea-forest.md) |
| [`bokjori`](../../packages/scenes/src/bokjori/scene.ts) | 竹筛迎岁 | `sway` | `scoop` | [`bokjori`](../../content/traditions/bokjori.md) |
| [`breton-banner`](../../packages/scenes/src/breton-banner/scene.ts) | 节旗轻展 | `sway` | `cloth` | [`breton-pardons`](../../content/traditions/breton-pardons.md) |
| [`catalan-festival-giant`](../../packages/scenes/src/catalan-festival-giant/scene.ts) | 巨偶待游 | `glow` | `figure` | [`catalan-gegants`](../../content/traditions/catalan-gegants.md) |
| [`celtic-folk-spring`](../../packages/scenes/src/celtic-folk-spring/scene.ts) | 泉边一念 | `bob` | `token` | `product-original` |
| [`chinese-incense`](../../packages/scenes/src/chinese-incense/scene.ts) | 炉前一炷 | `glow` | `censer` | [`chinese-incense`](../../content/traditions/chinese-incense.md) |
| [`chinese-shadow-puppet`](../../packages/scenes/src/chinese-shadow-puppet/scene.ts) | 影偶小戏 | `glow` | `bird` | [`chinese-shadow-puppet`](../../content/traditions/chinese-shadow-puppet.md) |
| [`chinese-woodblock-print`](../../packages/scenes/src/chinese-woodblock-print/scene.ts) | 木版留春 | `glow` | `face` | [`chinese-woodblock-print`](../../content/traditions/chinese-woodblock-print.md) |
| [`clootie-well-rag`](../../packages/scenes/src/clootie-well-rag/scene.ts) | 井边放下 | `sway` | `rag` | [`clootie-well-rag`](../../content/traditions/clootie-well-rag.md) |
| [`crane`](../../packages/scenes/src/crane/scene.ts) | 折一只纸鹤 | `glow` | `sheet.object` | [`origami-crane-senbazuru`](../../content/traditions/origami-crane-senbazuru.md) |
| [`croatian-licitar-heart`](../../packages/scenes/src/croatian-licitar-heart/scene.ts) | 彩心相赠 | `glow` | `heart` | [`croatian-licitar`](../../content/traditions/croatian-licitar.md) |
| [`czech-bead-star`](../../packages/scenes/src/czech-bead-star/scene.ts) | 珠星映光 | `glow` | `star` | [`czech-glass-bead-ornaments`](../../content/traditions/czech-glass-bead-ornaments.md) |
| [`czech-pilgrim-journal`](../../packages/scenes/src/czech-pilgrim-journal/scene.ts) | 旅途一页 | `glow` | `hinge` | `product-original` |
| [`dalarna-wooden-horse`](../../packages/scenes/src/dalarna-wooden-horse/scene.ts) | 木马安放 | `glow` | `horse` | [`dalarna-wooden-horse`](../../content/traditions/dalarna-wooden-horse.md) |
| [`faroese-wool-knit`](../../packages/scenes/src/faroese-wool-knit/scene.ts) | 毛线织暖 | `glow` | `swatch` | [`faroese-wool-knitting`](../../content/traditions/faroese-wool-knitting.md) |
| [`fijian-woven-fan`](../../packages/scenes/src/fijian-woven-fan/scene.ts) | 叶扇纳凉 | `glow` | `fan` | [`fijian-iri-fan`](../../content/traditions/fijian-iri-fan.md) |
| [`finnish-birch-basket`](../../packages/scenes/src/finnish-birch-basket/scene.ts) | 桦篮拾光 | `glow` | `basket` | [`finnish-birch-bark-craft`](../../content/traditions/finnish-birch-bark-craft.md) |
| [`furin-wind-chime`](../../packages/scenes/src/furin-wind-chime/scene.ts) | 风铃一响 | `sway` | `pivot` | [`furin-wind-chime`](../../content/traditions/furin-wind-chime.md) |
| [`hongsheng-red-string`](../../packages/scenes/src/hongsheng-red-string/scene.ts) | 红绳自持 | `glow` | `ring` | `product-original` |
| [`hungarian-embroidery-hoop`](../../packages/scenes/src/hungarian-embroidery-hoop/scene.ts) | 花绣寄语 | `glow` | `hoop` | [`hungarian-embroidery`](../../content/traditions/hungarian-embroidery.md) |
| [`italian-ex-voto`](../../packages/scenes/src/italian-ex-voto/scene.ts) | 绘牌记谢 | `glow` | `plaque` | [`italian-ex-voto`](../../content/traditions/italian-ex-voto.md) |
| [`lantern`](../../packages/scenes/src/lantern/scene.ts) | 月下一灯 | `sway` | `pivot` | `product-original` |
| [`lithuanian-straw-garden`](../../packages/scenes/src/lithuanian-straw-garden/scene.ts) | 草穗悬园 | `sway` | `mobile` | [`lithuanian-straw-gardens`](../../content/traditions/lithuanian-straw-gardens.md) |
| [`milagros`](../../packages/scenes/src/milagros/scene.ts) | 留一枚感谢 | `sway` | `charmGroups[selected]` | [`milagros`](../../content/traditions/milagros.md) |
| [`minangkabau-spinning-top`](../../packages/scenes/src/minangkabau-spinning-top/scene.ts) | 木陀轻转 | `glow` | `rotor` | `product-original` |
| [`ndebele-painted-house`](../../packages/scenes/src/ndebele-painted-house/scene.ts) | 彩墙寄家 | `glow` | `house` | [`ndebele-wall-painting`](../../content/traditions/ndebele-wall-painting.md) |
| [`niue-shell-necklace`](../../packages/scenes/src/niue-shell-necklace/scene.ts) | 贝链留光 | `glow` | `quietBody` | [`niue-kahoa-hihi`](../../content/traditions/niue-kahoa-hihi.md) |
| [`omamori-cycle`](../../packages/scenes/src/omamori-cycle/scene.ts) | 御守伴行 | `sway` | `pouches[selected].root` | [`omamori-cycle`](../../content/traditions/omamori-cycle.md) |
| [`peruvian-engraved-gourd`](../../packages/scenes/src/peruvian-engraved-gourd/scene.ts) | 葫芦刻光 | `glow` | `shell` | [`peruvian-mate-burilado`](../../content/traditions/peruvian-mate-burilado.md) |
| [`polish-blessing-basket`](../../packages/scenes/src/polish-blessing-basket/scene.ts) | 一篮春食 | `glow` | `basket` | [`polish-folk-catholic`](../../content/traditions/polish-folk-catholic.md) |
| [`polish-paper-cut`](../../packages/scenes/src/polish-paper-cut/scene.ts) | 剪纸开花 | `glow` | `fixed, folded` | [`polish-wycinanki`](../../content/traditions/polish-wycinanki.md) |
| [`purepecha-copper-bowl`](../../packages/scenes/src/purepecha-copper-bowl/scene.ts) | 铜碗拾暖 | `glow` | `bowl` | [`santa-clara-copper-craft`](../../content/traditions/santa-clara-copper-craft.md) |
| [`shinto-torii`](../../packages/scenes/src/shinto-torii/scene.ts) | 庭前一礼 | `glow` | `torii` | [`shinto`](../../content/traditions/shinto.md) |
| [`sicilian-painted-cart`](../../packages/scenes/src/sicilian-painted-cart/scene.ts) | 彩车迎晴 | `glow` | `cart` | [`sicilian-carretto-craft`](../../content/traditions/sicilian-carretto-craft.md) |
| [`slovak-wire-bird`](../../packages/scenes/src/slovak-wire-bird/scene.ts) | 铁线栖鸟 | `glow` | `bird` | [`slovak-wire-craft`](../../content/traditions/slovak-wire-craft.md) |
| [`sorbian-painted-egg`](../../packages/scenes/src/sorbian-painted-egg/scene.ts) | 彩蛋寄春 | `glow` | `egg` | [`sorbian-easter-eggs`](../../content/traditions/sorbian-easter-eggs.md) |
| [`st-brigids-cross`](../../packages/scenes/src/st-brigids-cross/scene.ts) | 草编迎春 | `sway` | `cross` | [`st-brigids-cross`](../../content/traditions/st-brigids-cross.md) |
| [`tanzaku-tanabata`](../../packages/scenes/src/tanzaku-tanabata/scene.ts) | 短册系竹 | `sway` | `loose` | [`tanzaku-tanabata`](../../content/traditions/tanzaku-tanabata.md) |
| [`tibetan-wheel`](../../packages/scenes/src/tibetan-wheel/scene.ts) | 廊前轻转 | `glow` | `main.drum` | [`tibetan-buddhism`](../../content/traditions/tibetan-buddhism.md) |
| [`turkish-ebru-paper`](../../packages/scenes/src/turkish-ebru-paper/scene.ts) | 浮彩成笺 | `glow` | `print` | [`turkish-ebru`](../../content/traditions/turkish-ebru.md) |
| [`uzbek-clay-bowl`](../../packages/scenes/src/uzbek-clay-bowl/scene.ts) | 陶轮慢成 | `glow` | `clay` | [`uzbek-ceramic-craft`](../../content/traditions/uzbek-ceramic-craft.md) |
| [`venetian-glass-bead`](../../packages/scenes/src/venetian-glass-bead/scene.ts) | 玻珠凝彩 | `glow` | `bead` | [`italian-glass-beads`](../../content/traditions/italian-glass-beads.md) |
| [`votive-candle-catholic`](../../packages/scenes/src/votive-candle-catholic/scene.ts) | 留一盏烛光 | `glow` | `main.group` | [`votive-candle-catholic`](../../content/traditions/votive-candle-catholic.md) |
| [`weifang-paper-kite`](../../packages/scenes/src/weifang-paper-kite/scene.ts) | 纸鸢乘风 | `glow` | `kite` | [`weifang-kite-craft`](../../content/traditions/weifang-kite-craft.md) |
| [`welsh-love-spoon`](../../packages/scenes/src/welsh-love-spoon/scene.ts) | 木勺寄情 | `glow` | `spoon` | [`welsh-love-spoons`](../../content/traditions/welsh-love-spoons.md) |
| [`yeondeunghoe`](../../packages/scenes/src/yeondeunghoe/scene.ts) | 燃灯上浮 | `bob` | `main.group` | [`yeondeunghoe`](../../content/traditions/yeondeunghoe.md) |

## 5个文本匹配但不改为自动收尾的场景

这些项目不在上述52场中；本轮不改变其实际完成条件，也不为其追加自动收尾来源卡说明。

| 场景ID | 实际含义与保留条件 |
| --- | --- |
| [`spanish-twelve-grapes`](../../packages/scenes/src/spanish-twelve-grapes/scene.ts) | “静候钟声”只在 done 提示中；末步仍须安放第三盘葡萄。 |
| [`scottish-plunge-churn`](../../packages/scenes/src/scottish-plunge-churn/scene.ts) | “提盖静看”包含实际提盖动作；保留提盖验收。 |
| [`diya-oil-lamp`](../../packages/scenes/src/diya-oil-lamp/scene.ts) | “静看献光所用的灯盏”只在 done 文案中；末步仍是归盘。 |
| [`daruma-eye-painting`](../../packages/scenes/src/daruma-eye-painting/scene.ts) | returning 的 step1“静看并记谢”是中间确认，后面仍须把达摩归座。 |
| [`ema-votive-plaque`](../../packages/scenes/src/ema-votive-plaque/scene.ts) | returning 的 step1静看是中间确认，后面仍须挂木牌。 |

## 文化核查范围、证据与读取状态

| 本轮对应事项 | 依据与支持范围 | 本轮实际读取状态 | 不可外推的内容 |
| --- | --- | --- | --- |
| 物件和现有动作的文化关联 | 47张既有来源卡及其链接的原逐项研究；保留已有事实与原证据边界 | 读取本地产品说明；未在本轮重新打开外部URL | 本轮不重新证明起源、神圣意义、地域唯一性或完整仪轨，也不把旧访问状态改为今日已读 |
| 3秒／0.6秒、光泽、轻摆、轻浮和自动结算 | 本地实现、当前README及本记录，只支持“本应用的产品安排” | 已对照本地配置与共享生命周期代码 | 不构成传统的停留期限、祈愿必需动作、数量规则或现实功效 |
| 草稿与可选祈愿 | 共享收尾的编辑保护、原生表单以及宿主 deferWishWriting 适配 | 已读相关本地实现；真实 helper 测试覆盖草稿、IME、提交回调销毁与重入 | 可选留言不变成传统工艺步骤，也不变成完成门槛 |
| 5个原产品原创场景 | 注册表和模块 metadata 的既有 `product-original` 字段及旧来源审阅 | 本轮静态对照；字段未改 | 不借地区、宗教总卡或动画相似性重新绑定传统 |

本轮没有新增文化事实、来源分类或外部证据。真实的宗教礼敬、求祈、谢恩、纪念和手工艺背景保留原支持范围，没有被改写成“本来只是装饰／自省”。新增计时与动画只归于本产品；不将它们解释为任何社群必须等待3秒、让器物摇动或使供物漂浮的要求。

## 同步范围、提交边界与验证

已同步52份场景 README 的最新产品收尾节、47张现有来源卡的新增产品呈现节，以及本集中记录。保留此前用户和协作者的内容；较早产品说明继续作为历史记录。未改宿主目录、注册表、模块 metadata、技术ID、引擎或存档字段。现有来源均存在，5个产品原创场景不造卡。`docs/README.md` 仅为时间轴地图使用说明，没有同类研究索引，本轮不添加无关入口。

本次提交在隔离工作树中基于 `origin/master` 的 `b1a9679d` 整理。原工作区另有的15场 `close-inspection` 改动及其相关 i18n、narratives 和发布记录未纳入本次提交。下列历史检查来自包含其他未提交改动的原工作区，不能视为本次隔离提交快照的测试结果，也不能据此判断本次快照是否全绿。

### 原工作区历史验证

| 检查 | 记录 |
| --- | --- |
| 52场清单、motion、target、原来源静态对照 | 已核对52处接入与本表；40场光泽、10场轻摆、2场轻浮，来源字段保持一致 |
| 真实共享收尾与52场集成 | `npm exec -w @wbr/scenes -- vitest run src/quiet-ending.test.ts src/quiet-ending-atelier-scenes.test.ts src/quiet-ending-eight-crafts.test.ts src/quiet-ending-workshop-scenes.test.ts`：338/338；`npm run test -w @wbr/scenes -- src/quiet-ending-legacy-scenes.test.ts src/tibetan-wheel/scene.test.ts`：86/86。合计424项，包含暂停、减少动态、草稿／IME、旧档、重入与同步销毁；没有用旧测试中的时钟替身代替这些真实 helper 验收 |
| 原工作区全量场景与宿主历史快照 | `npm run test -w @wbr/scenes`：10753项，10642通过、111失败；其中转筒2项旧手动收尾预期已更新并在上述专项通过，其余109项空间／方向手势失败涉及52场之外的15个场景。`npm run test -w @wbr/app`：1314项，1271通过、43失败，全部在 `hourly-scene-lifecycle.test.ts`；这些不是本次隔离提交快照的结果，详见下方边界说明 |
| 原工作区运行时、类型、构建和八语 | 运行时专项217/217通过；scenes TypeScript通过。该工作区当时的 `npm run build` 退出0，包含八语提取、目录／审阅、生成文件一致性和i18n类型检查，Vite生产构建通过。保留原有大分包警告，没有把该警告登记为失败 |
| 页面实际查看 | 此前版本在独立 `/scene-review` 中验收短册悬挂轻摆、烛光柔光、莲灯上浮后的收尾，均从2/3自动到3/3，辅助按钮消失并显示自动完成进度；完成后祈愿／分享入口正常。该次查看了Three.js实画面，未把单元测试替作浏览器验收，也未声称逐个目视52场；其截图属于显示调整前的历史版本 |
| 无文字进度条的原工作区验收 | 按本次显示要求去掉可见文字及底板，仅保留88×3 CSS px、65%不透明度的细进度条；辅助技术仍读取原隐藏提示。原工作区的 `npm run test -w @wbr/scenes -- src/quiet-ending.test.ts src/quiet-ending-legacy-scenes.test.ts` 含类型检查，89/89通过。独立短册页面实际确认无文字／底板、进度条推进及自动完成；该次截图 `.tmp/quiet-ending-subtle-progress.png`，测试报告 `.tmp/quiet-ending-subtle-progress-tests.json`。该次显示调整后未重跑上述全量构建和全量测试；不沿用更早的带文字截图证明无文字样式 |
| 文化事实复审 | 本轮未新增／重写文化事实；保留原研究及外部访问状态，不声称重新读过外链 |

上述历史技术证据保存在原工作区的 `.tmp/automatic-ending-shared-and-crafts-final.json`、`.tmp/automatic-ending-legacy-final.json`、`.tmp/automatic-ending-scenes-final.json`、`.tmp/automatic-ending-app-final.json` 和 `.tmp/automatic-ending-final-build.log`；`.tmp/automatic-ending-tanzaku.png`、`.tmp/automatic-ending-candle.png` 是显示调整前的历史界面示例，不能代表无文字细进度条的样式。这些是原工作区本地验收产物，不是本次隔离提交快照的结果或新增文化来源。

原工作区历史失败的证据边界：109项分布在 `directional-tolerance-scenes.test.ts`（6）、`spatial-placement-a.test.ts`（57）、`spatial-placement-b.test.ts`（32）、`spatial-placement-c.test.ts`（14）。对应15场均未接入自动收尾，且原工作区两轮全量快照的同标题／首行错误一致；但没有本次实施前相同109项断言的完整工作树基线，因此不能认定全部都是既有失败，也未通过放宽断言使其消失。宿主43项另有19:52的原HEAD交互模块alias对照记录（`.tmp/debug-entry-cue-baseline-72fe1d9c-cb87-403c-afea-dd11c540bb3c/summary.json`），同样复现43项；这个对照只证明那组交互失败可在原交互模块下复现，不能外推为上述109项或全仓HEAD基线。这43+109项是历史工作树检查，不等同本次基于 `b1a9679d` 整理的提交快照，也没有证明它们全部属于该基线的失败。

### 本次隔离提交快照验证

2026-10-31 21:22（Asia/Shanghai）完成本次提交快照验证：

- 全量 `npm test` 退出0：App 1314/1314、scenes 10642/10642、scene-runtime 217/217；其余i18n、core、runtime、gestures、shared、content及目录脚本检查全部通过。没有跳过或放宽此前失败的空间／手势断言。
- `npm run build` 退出0，包含八语完整性、审阅哈希、生成物与类型检查，Vite生产构建通过。仍有大分包提示。
- 新工作树最初保留了LFS指针，造成资源头检查及GLB构建失败；执行 `git lfs checkout` 从本地缓存还原2116个实体后，重新完整运行上述两条命令并通过，没有修改资源文件或断言。
- `git diff --cached --check` 通过。提交仅包括本轮UI、52场收尾及其文档／测试，原工作区的15场近览、发布回执、日志和预览图不在提交中。

原始日志保存在原工作区 `.tmp/scene-ui-integration-20261031/scene-ui-full-test-verified.log` 和 `scene-ui-build-verified.log`；不纳入Git。这里的通过结论来自隔离提交快照，不使用上节原工作区的历史结果替代。

按现行规范的本轮清单：

- [x] 对照实际收尾对象、动态和完成条件，未用产品动画反推传统。
- [x] 新增计时与动态明确归于产品；没有新增传统期限、数量、资格、起源或功效主张。
- [x] 沿用既有来源身份；52场模块 metadata 与注册表来源静态一致，47张源卡存在。
- [x] 来源卡、研究与 README 区分原文化事实和本次产品表达；外部读取状态未改。
- [x] 技术ID、引擎版本及存档字段未因收尾变更而改动；5个实际动作／done匹配项不跳过。
- [x] 已记录原工作区历史技术验证、真实界面查看及未通过项的证据边界；技术通过不能替代文化事实与来源关联审阅。
- [x] 已补录本次隔离提交快照的全量测试与构建结果。
