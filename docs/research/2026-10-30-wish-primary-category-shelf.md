# 心愿页按主祈愿分类收窄收藏范围

核查日期：2026-10-30（Asia/Shanghai）。变更范围：心愿页顶部收藏架、许愿／还愿的可用收藏筛选，以及新建愿望的免费场景入口。场景 ID 与完整候选清单见下文。

## 实际呈现与筛选标准

此前[2026-10-28 的筛选](2026-10-28-wish-rack-prayer-only.md)只要求当前 `sceneIntention.kind` 为 `wish` 或 `blessing`，因此主目录归为祈福类的「陶牛护家」「门松迎岁」「千岁赠糖」仍会出现在心愿页顶部。仅凭这三项出现在截图，不能判断用户加载了旧版本或旧数据；上一版现行规则本身就会允许新获得的这些收藏上架。

本轮按用户要求，心愿页采用主目录的祈愿类范围，并继续保留上一轮对当前用途的收窄。共享判定 `isWishCollectionScene` 位于 [`packages/app/src/vessels.ts`](../../packages/app/src/vessels.ts)，条件为：

1. 场景属于 [`WISH_SCENE_IDS`](../../packages/core/src/daily-scenes.ts) 主祈愿分类。
2. [`sceneIntention`](../../packages/core/src/scene-intentions.ts) 的当前用途仍为 `wish` 或 `blessing`，避免历史主分类名单中的感谢、自省等场景重新进入心愿入口。
3. 实际宿主仍沿用当前目录的可见性限制；没有获得相应收藏的用户不会因此新增收藏。

这是**产品主分类与当前用途的交集，不是一次新的文化事实判定**。`optionalWish` 是本应用的可选写愿权限，`wishScene` 是已存收藏的用途标记，均不代替主分类，也不能证明器物有无祈愿背景。

## 本轮实现与兼容边界

| 位置 | 本轮处理 |
| --- | --- |
| [`WishRitualRack`](../../packages/app/src/wish-ritual-rack.tsx) | 顶部仅陈列通过共享判定的已获收藏，继续保持逐份副本、状态排序和具体收藏入口；没有符合条件的收藏时不显示空架。点按和浏览不删除或改写收藏。 |
| [`usableVessels`](../../packages/app/src/vessels.ts) | 在原有 `kind: scene`、`wishScene: true`、未消耗和目录存在条件上增加共享判定，供许愿选择器和还愿选择器使用。旧标记不能使主祈福类或当前其他用途的收藏继续成为新的可用入口。 |
| [`WishRitualPicker`](../../packages/app/src/wish-ritual-picker.tsx) | 已有收藏经 `usableVessels` 筛选后，继续检查当前 `optionalWish`；新建愿望的免费场景入口增加共享判定，原有当前用途为 `wish`、允许可选写愿和去重条件继续沿用。不会因为顶部允许陈列就自动获得写愿权限。 |
| [`FulfillWish`](../../packages/app/src/wishes.tsx) | 沿用 `usableVessels`，因此还愿的可用收藏同步收窄。已完成的旧还愿、原心愿记录和纪念物不回滚。 |
| `pendingVessels` 与旧草稿 | 独立接续逻辑保持不变。已有消耗记录和 `vesselDrafts` 的旧收藏仍可在「接着刚才」完成原文字的保存／放弃选择；不因本轮筛选删除旧文字，也不借兼容接续给该场景开放新的写愿能力。被顶部筛除的旧草稿仍有此独立接续入口。 |
| 存档与场景身份 | 原收藏页、旧心愿、已提交文字、草稿、收藏副本及消耗记录保留。技术 ID、引擎版本、来源 slug／`product-original` 和存档结构不变；没有迁移或清空用户数据。 |

### 重要边界

- **截图中的三项移出顶部。**「陶牛护家」`pucara-rooftop-bulls`、「门松迎岁」`japanese-kadomatsu`、「千岁赠糖」`shichigosan-chitose-ame` 主分类均属 `BLESSING_SCENE_IDS`，当前用途为 `blessing`，`optionalWish: false`。本次因产品主分类范围移出，不撤回其已有祝愿背景。现有来源卡分别说明陶牛安放、门松迎岁陈设和向孩子赠送千岁饴的有限片段：[陶牛](../../content/traditions/pucara-rooftop-bulls.md)、[门松](../../content/traditions/japanese-kadomatsu.md)、[千岁饴](../../content/traditions/shichigosan-chitose-ame.md)。
- **「风铃一响」也移出。**`furin-wind-chime` 虽然当前用途为 `blessing`、`optionalWish: true`，主分类仍属 `BLESSING_SCENE_IDS`。此前曾允许其收藏陈列，本轮同步收窄；不是再次宣称风铃没有祈愿用途。[现有来源卡](../../content/traditions/furin-wind-chime.md)保留おふさ观音寺平安度夏等具体宗教语境。
- **当前用途为 `wish` 也不单独决定陈列。**「庭前一礼」`shinto-torii`、「栏前结愿」`bonfim-ribbon` 的主分类属祈福类，因此本轮移出。
- **不能写愿也不自动移出。**「微屋寄愿」`alasita-miniature-house`、「林村抛愿」`lam-tsuen-wishing-tree`、「三石寄愿」`sumiyoshi-godairiki` 主分类与当前用途均为祈愿，虽然 `optionalWish: false`，仍保留为候选；本轮不为它们新增写愿表单或改变既有权限。
- **历史主祈愿名单不自动恢复其他用途。**「舟模寄谢」`aland-votive-ship`、「绘牌记谢」`italian-ex-voto`、「一篮春食」`polish-blessing-basket`、「串花寄意」`phuang-malai` 当前属于感谢，「火边花环」`slavic-wreath` 当前属于自省，继续被排除。它们上一轮已经不显示，不计入本轮新增移出的60项。
- **标题不代替实际分类。**「留一枚感谢」`milagros` 当前用途为 `wish`，且属于主祈愿目录，因此继续保留；不能只因标题出现「感谢」就将其移出。

## 完整候选清单

以下清单直接读取当前宿主目录、可见性规则、主分类和当前用途交集，按宿主目录顺序列出。当前可见目录共91项；上一轮 `wish`／`blessing` 用途筛选允许81项，本轮保留21项、相对上一轮移出60项。下列均为**候选，不代表每位用户都已经拥有**；实际顶部仅显示该用户已经获得且满足当前筛选的收藏。这些数量不是对全球文化用途的分类统计。

### 最终保留：21项

| 中文标题 | 场景 ID |
| --- | --- |
| 微屋寄愿 | `alasita-miniature-house` |
| 林村抛愿 | `lam-tsuen-wishing-tree` |
| 三石寄愿 | `sumiyoshi-godairiki` |
| 泉水净币 | `zeniarai-coin-washing` |
| 龟岩投愿 | `udo-undama` |
| 方巾裹礼 | `korean-bojagi-wrap` |
| 木勺寄情 | `welsh-love-spoon` |
| 陶鸡报晓 | `barcelos-clay-rooster` |
| 彩心相赠 | `croatian-licitar-heart` |
| 彩蛋寄春 | `sorbian-painted-egg` |
| 太阳花迎门 | `basque-sunflower` |
| 叶舟寄意 | `floating-lantern-loy-krathong` |
| 御守伴行 | `omamori-cycle` |
| 木牌记愿 | `ema-votive-plaque` |
| 留一盏烛光 | `votive-candle-catholic` |
| 达摩点睛 | `daruma-eye-painting` |
| 水引结愿 | `mizuhiki` |
| 留一枚感谢 | `milagros` |
| 短册系竹 | `tanzaku-tanabata` |
| 燃灯上浮 | `yeondeunghoe` |
| 折一只纸鹤 | `crane` |

### 相对上一轮移出：60项

| 中文标题 | 场景 ID |
| --- | --- |
| 七草祈安 | `nanakusa-gayu` |
| 窗布祈护 | `brat-bride-cloth` |
| 鸟竿祈安 | `korean-sotdae` |
| 门松迎岁 | `japanese-kadomatsu` |
| 陶牛护家 | `pucara-rooftop-bulls` |
| 银锁寄安 | `chinese-longevity-lock` |
| 振槌寄愿 | `uchide-wishing-mallet` |
| 迪杜赫麦束 | `ukrainian-didukh` |
| 菩提供水 | `sri-lankan-bodhi-puja` |
| 门柱祈安 | `mezuzah-doorpost` |
| 鱼生捞起 | `yusheng-lohei` |
| 抚牛寄愿 | `kitano-nadeushi` |
| 白线祝归 | `lao-baci-wrist` |
| 柳枝祝春 | `finnish-virpominen` |
| 煤火迎年 | `scottish-first-footing` |
| 柊鰯守门 | `hiiragi-iwashi` |
| 玉串奉愿 | `tamagushi-offering` |
| 清水七供 | `tibetan-water-bowls` |
| 开樽祝愿 | `kagami-biraki-sake` |
| 经幡迎风 | `tibetan-prayer-flags` |
| 蘸蜜迎岁 | `rosh-hashanah-apple-honey` |
| 浇水敬老 | `thai-songkran-elders` |
| 木鷽迎福 | `kameido-usokae` |
| 熏籽祈安 | `persian-esfand` |
| 纸雏祈安 | `mochigase-nagashibina` |
| 新岁分糕 | `greek-vasilopita` |
| 白绢迎客 | `tibetan-khata-greeting` |
| 千岁赠糖 | `shichigosan-chitose-ame` |
| 敖包祈护 | `mongolian-ovoo` |
| 浴佛发愿 | `fgs-buddha-bathing` |
| 叶盘献谢 | `balinese-canang-sari` |
| 彩枝贺年 | `bulgarian-survakane` |
| 沙塔献幡 | `lanna-sand-pagoda` |
| 贴福迎春 | `chinese-fu-paper` |
| 蓝珠祈安 | `turkish-nazar-bead` |
| 饰矢祈安 | `japanese-hamaya` |
| 五果迎春 | `vietnamese-five-fruit-tray` |
| 如意寄愿 | `chinese-ruyi-scepter` |
| 熊手纳福 | `japanese-kumade` |
| 红角赠福 | `neapolitan-cornicello` |
| 葡萄迎岁 | `spanish-twelve-grapes` |
| 蹄铁护家 | `horseshoe-doorway-luck` |
| 节分撒豆 | `setsubun-mamemaki` |
| 门楣祝家 | `sternsinger-house-blessing` |
| 镜饼迎岁 | `kagami-mochi-offering` |
| 红白寄春 | `romanian-martisor` |
| 薄饼相祝 | `polish-oplatek-sharing` |
| 破榴迎新 | `greek-new-year-pomegranate` |
| 椰果献愿 | `hindu-coconut-offering` |
| 栏前结愿 | `bonfim-ribbon` |
| 茅环祈安 | `chinowa-kuguri` |
| 鲤旗迎风 | `japanese-koinobori` |
| 草穗悬园 | `lithuanian-straw-garden` |
| 炉前一炷 | `chinese-incense` |
| 草编迎春 | `st-brigids-cross` |
| 竹筛迎岁 | `bokjori` |
| 井边放下 | `clootie-well-rag` |
| 风铃一响 | `furin-wind-chime` |
| 庭前一礼 | `shinto-torii` |
| 廊前轻转 | `tibetan-wheel` |

## 文化影响、证据范围与访问状态

本轮已阅读[场景来源与文化关联核查规范](../scene-provenance.md)，对照实际宿主筛选、主分类、当前用途与可选记录权限，并沿用[既有逐场景文化审阅](2026-10-19-scene-culture-audit.md)、[心意提示核查](2026-10-19-ritual-intentions.md)、[上一轮陈列筛选记录](2026-10-28-wish-rack-prayer-only.md)及各场景既有来源卡中保存的证据边界。此处的本地记录只用于确认产品原有定位与已记录的支持范围，不能作为新增传统事实的独立来源。

**本次没有重新读取外部来源，没有将既有来源的读取状态升级为本轮重新核验。**既有记录中的已读、部分可读、仅索引或失访及其限制继续保留。未开展全场景重新考据，也不因产品目录名称或技术测试给器物增加、撤回文化事实。

| 核查项 | 实际读取／对照状态 | 支持范围及不能外推的内容 |
| --- | --- | --- |
| 主分类与当前用途交集 | 2026-10-30 已读取当前本地 `daily-scenes.ts`、`scene-intentions.ts`、收藏架及选择器实现；通过真实 TypeScript 导出只读计算清单 | 证明当前产品候选范围及21／60差集，不证明任何物件的传统用途或全球文化分类。 |
| 截图三项与风铃的边界 | 2026-10-30 已阅读上文所链四张本地来源卡相关产品呈现与边界，沿用其既有外部核查 | 本次只改变入口和陈列范围；不否定已记录的护家、迎岁、成长祝愿或具体寺院祈愿语境。不能把「从心愿页移出」改写成「没有祈愿用途」。 |
| 器物、材料、动作、场合和完成条件 | 已对照本次改动范围；沿用各场景既有记录 | 本次不改变模型、材质、动作顺序、完成条件、场景介绍、点按反馈或原有祈愿／宗教对象。 |
| 新增文化主张 | 不适用：本轮未新增 | 没有新增起源、地域、社群、寓意、数量、期限、顺序、资格、节期或现实效力主张；也未将产品写愿权限描述为传统规定。 |
| 来源身份与同步范围 | 沿用原来源分类 | 来源卡、场景 README、宿主目录、注册表、模块 metadata 与原生标题的文化身份及标题未改变，无需更换来源绑定。产品范围变更由本研究记录和对应设计／历史记录的后续说明维护。 |
| 技术兼容与历史数据 | 本轮回归与生产浏览器已核对 | 不改变技术 ID、引擎版本或存档格式；原收藏、心愿、文字和旧草稿保留。兼容接续仅用于已有选择，不是新增传统事实或新建愿望资格。 |

## 核查清单

- [x] 已对照实际宿主陈列、入口、主分类、当前用途与完成后写愿权限，未从产品分类反推传统。
- [x] 本次只调整产品入口与陈列范围，没有新增或变更器物、动作、场合、来源和文化主张；沿用既有核查记录及其限制。
- [x] 未新增地域、民族、视觉相似或导航索引式错绑；未将真实祈愿、宗教、占卜或感谢背景改写掉。
- [x] 主分类、当前用途、收藏标记和可选写愿权限分别处理；三项不能写愿的主祈愿候选仍保留。
- [x] 已列完整保留／移出候选，明确不代表用户已拥有；原收藏、心愿、文字及旧草稿接续均有兼容边界。
- [x] 已同步小物架设计，并在上一轮研究记录标明本次规则取代其旧范围；独立审阅核对实现与21／60清单一致。
- [x] 已完成相关回归、构建、生产浏览器和独立审阅，App 全套当前未通过项单列如下。

## 技术验证

以下为本轮实际执行结果，不把只读清单计算当作界面行为测试，也不借用上一轮运行结果。

- 修改现有架子与新建入口回归后，先观察到5项预期失败，确认原规则仍展示主祈福物件、允许其成为新建入口；再实现共享分类判断。架子、新建心愿、仪式流程、场景图标和心愿详情共5个文件86项通过。
- 顶层 `npm.cmd run build` 的 i18n 验证、TypeScript 和 Vite 生产构建通过，仍有既有的大分块提示。日志：`artifacts/wish-primary-category-build.log`。
- `scripts/verify-wish-ritual-rack.mjs` 对生产构建在320／390／1280px通过原交互与页面检查。混合收藏明确包含截图三项、风铃，以及旧 `wishScene:true` 的祈福物件，它们均不再上架、不影响未用计数；只有这些收藏时不留空架。收藏数组保持一致，原纸鹤／达摩点按、逐份已用／未用／旧草稿入口、鼠标／键盘／触屏浏览、静音／减少动态效果与无WebGL降级均通过，无页面异常。报告：`artifacts/wish-primary-category-shelf/browser.json`；筛选后截图：同目录 `prayer-only-390.png`；运行日志：`artifacts/wish-primary-category-browser.log`。
- 架子回归保留非写愿主祈愿收藏；新建入口回归确认被主分类筛除的旧风铃草稿仍可在独立入口继续，文字未变。还愿选择器复用的 `usableVessels` 已覆盖错误旧标记被排除，原还愿集成流程通过。
- 独立只读审阅未发现阻塞问题，并重新读取真实TypeScript导出，确认21项保留及60项移出名单的名称、ID、顺序、差集均与当前实现一致。本次相关差异 `git diff --check` 通过。

### 当前工作区的其他未通过项

`npm.cmd run test -w @wbr/app`：44个文件通过、1个失败，1,264项通过、43项失败。失败均在 `hourly-scene-lifecycle.test.ts`：42项在 `currentGesture:224` 无法找到当前可拖动物件，另1项 `scottish-first-footing:176` 没有触发预期完成检查点。

已沿失败路径核对：这些测试直接调用 `proceduralEngine(id)` 和场景 `engine.create(...)`，不经过本轮收藏架、`vessels` 或选择器的分类代码。工作区并行的“拿近查看”场景改动在查看前不开放拖动／放置，旧生命周期断言仍直接操作搬运阶段，因此出现上述前置阶段差异。本轮未修改该测试、相关场景或查看模块来掩盖结果。完整日志：`artifacts/wish-primary-category-app-tests.log`。

本轮是代码与本地生产构建修复，尚未生成或发布新的TestFlight安装包；现有构建15不会随本地源码修改自动更新。

技术验证只证明产品筛选、入口和存档行为，不替代文化事实与来源关联审阅。
