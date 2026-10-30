# 场景产品分组统一为祈福与祈愿

核查日期：2026-10-30（Asia/Shanghai）。本轮范围：主目录分组、`SceneIntentionKind`、心愿入口共享判定和心意提示的 DOM 分类。用户要求只保留「祈福」「祈愿」两种产品分类；原感谢、自省、礼敬、庆祝类别统一归入祈福。

## 本轮实现与最终范围

- [`SceneIntentionKind`](../../packages/core/src/scene-intentions.ts) 仅保留 `wish`（祈愿）与 `blessing`（祈福）。原10个非二元类别场景均改为 `blessing`；`remembrance` 原本只有类型声明、没有场景实例，本次一并移除该类型成员。
- [`daily-scenes.ts`](../../packages/core/src/daily-scenes.ts) 将下表标记的5项从 `WISH_SCENE_IDS` 移入 `BLESSING_SCENE_IDS`。另外13项原二元 `kind` 与主目录不一致的场景跟随主目录对齐，见下文；主目录不再依靠额外用途类别来排除历史导入项。
- [`vessels.ts`](../../packages/app/src/vessels.ts) 的 `isWishCollectionScene` 简化为 `isWishScene`。顶部收藏架、`usableVessels` 及新建愿望免费入口共用主分类，不再叠加第二套用途分类判定。现有目录可见性、已获收藏、未消耗等各入口自身条件继续沿用。
- 当前用户可见的91项场景分为**祈愿21项、祈福70项**。此前[主分类收窄记录](2026-10-30-wish-primary-category-shelf.md)列出的祈愿21项维持不变；其中「主分类与当前用途交集」为该轮实施记录，本轮已由两种分类对齐后的单一主分类替代。
- [`scene-experience.tsx`](../../packages/app/src/scene-experience.tsx) 的还愿心意提示 `data-kind` 从硬编码 `gratitude` 改为 `blessing`。场景心意提示的类别属性只表达祈福／祈愿；感谢、还愿等具体文案继续保留。这不涉及手势提示中 `drag`、`tap` 等其他用途的同名 DOM 属性。
- Android 小组件的 `WidgetCatalog.kt`、测试目录 `widget-catalog.json` 同步5项主目录归属，`WidgetLocalization.kt` 通过既有生成器更新两个轮换池。`WidgetSnapshotTest.kt` 的花环样例同步为祈福，保持现有严格类别校验；图片、标题和素材哈希不变。

这些是**产品分组和入口规则，不是一次新的传统用途或文化事实判定**。数量是当前可见场景的分类数量，不代表每位用户已经拥有对应收藏。

## 原额外类别统一归祈福：10项

| 中文标题 | 场景 ID | 原类别 | 主目录处理 |
| --- | --- | --- | --- |
| 舟模寄谢 | `aland-votive-ship` | `gratitude`（感谢） | **从祈愿移入祈福** |
| 绘牌记谢 | `italian-ex-voto` | `gratitude`（感谢） | **从祈愿移入祈福** |
| 一篮春食 | `polish-blessing-basket` | `gratitude`（感谢） | **从祈愿移入祈福** |
| 串花寄意 | `phuang-malai` | `gratitude`（感谢） | **从祈愿移入祈福** |
| 火边花环 | `slavic-wreath` | `reflection`（自省） | **从祈愿移入祈福** |
| 签纸慢读 | `omikuji` | `reflection`（自省） | 仍属祈福 |
| 敲一敲木鱼 | `woodfish` | `reflection`（自省） | 仍属祈福 |
| 春锅共煮 | `navruz-sumalak` | `celebration`（庆祝） | 仍属祈福 |
| 庭前一铃 | `shrine-suzu-bell` | `reverence`（礼敬） | 仍属祈福 |
| 灯旋一瞥 | `diya-oil-lamp` | `reverence`（礼敬） | 仍属祈福 |

合计感谢4项、自省3项、礼敬2项、庆祝1项。表中5项主目录迁移避免它们在取消额外类别后重新进入祈愿收藏架；另外5项的主目录未变。

## 原二元类别与主目录对齐：13项

下列场景的主目录不变，只将运行时 `kind` 对齐已有主分类。

| 中文标题 | 场景 ID | 原 `kind` → 当前 `kind` |
| --- | --- | --- |
| 方巾裹礼 | `korean-bojagi-wrap` | `blessing` → `wish` |
| 木勺寄情 | `welsh-love-spoon` | `blessing` → `wish` |
| 陶鸡报晓 | `barcelos-clay-rooster` | `blessing` → `wish` |
| 彩心相赠 | `croatian-licitar-heart` | `blessing` → `wish` |
| 彩蛋寄春 | `sorbian-painted-egg` | `blessing` → `wish` |
| 太阳花迎门 | `basque-sunflower` | `blessing` → `wish` |
| 御守伴行 | `omamori-cycle` | `blessing` → `wish` |
| 留一盏烛光 | `votive-candle-catholic` | `blessing` → `wish` |
| 水引结愿 | `mizuhiki` | `blessing` → `wish` |
| 燃灯上浮 | `yeondeunghoe` | `blessing` → `wish` |
| 折一只纸鹤 | `crane` | `blessing` → `wish` |
| 栏前结愿 | `bonfim-ribbon` | `wish` → `blessing` |
| 庭前一礼 | `shinto-torii` | `wish` → `blessing` |

本轮合计更新23个场景的 `kind`（10项额外类别归并、13项二元分类对齐），其中只有前表5项同时迁移主目录。

## 分类、写愿权限与免费入口分别处理

`optionalWish` 表示本应用是否提供独立、可选的心愿记录，所有场景的该字段均保持原值。`label`、`action`、具体感谢／自省／礼敬文字、场景动作及来源说明均保持。

[`WishRitualPicker`](../../packages/app/src/wish-ritual-picker.tsx) 的免费新建入口只按统一主祈愿分类、`optionalWish: true` 以及已有收藏去重筛选，不再重复检查第二套 `kind`。在没有已有收藏占位的基础候选中，对齐分类后有**18项**满足条件。新增进入这个基础候选集合的11项原本已经 `optionalWish: true`，只是其原运行时 `kind: blessing` 与主目录不一致；这不是给11项开启新的 `optionalWish` 权限，也不是变更原场景完成后的写愿能力。

主祈愿21项中的「微屋寄愿」`alasita-miniature-house`、「林村抛愿」`lam-tsuen-wishing-tree`、「三石寄愿」`sumiyoshi-godairiki` 仍为 `optionalWish: false`：保留祈愿分类和已获收藏的陈列资格，不新增写愿表单，也不进入上述18项免费写愿基础候选。已有收藏、是否消耗、重复场景和旧草稿会影响每位用户实际看到的入口数量。

## 旧数据与旧草稿

[`State`、`Collectible`、`SceneRecord` 及恢复校验](../../packages/core/src/index.ts)没有持久化 `SceneIntentionKind` 的类别枚举。这里调整的旧额外类别是运行时元数据与心意提示 DOM 属性，不需要存档类别迁移，**不迁移、不清空旧数据**。

需要区分几个已有字段：

- `Collectible.kind` 仍是 `scene`、纪念章或旧仪式物件等存档类型，不是本轮祈福／祈愿分类，不改写。
- `Wish.intention` 是用户保存的文字，不是类别字段，不作替换。
- 旧收藏的 `wishScene` 布尔标记继续保留原值；它不能越过当前主类别校验，使已迁入祈福的收藏重新成为新的祈愿入口。顶部和 `usableVessels` 按当前主分类筛选，原收藏仍在收藏页和存档中。
- `pendingVessels` 仍独立保留旧草稿接续。已消耗且已有 `vesselDrafts` 的收藏可继续处理既存文字的明确保存／放弃选择；本轮不删除草稿，不借兼容接续开放新的写愿资格。
- 既有心愿、已提交文字、已用收藏、消耗记录和已完成还愿继续保留，不追溯撤销。

技术 ID、引擎版本、收藏副本和存档结构均不变。

## 文化影响与证据范围

本轮遵循[场景来源与文化关联核查规范](../scene-provenance.md)。已对照本地实际主目录、运行时类型、入口、心意提示和持久化结构；沿用[既有文化审阅](2026-10-19-scene-culture-audit.md)、[心意提示核查](2026-10-19-ritual-intentions.md)、[上一轮陈列记录](2026-10-28-wish-rack-prayer-only.md)及各场景来源卡已保存的事实边界与访问限制。

**本次没有重新读取外部来源，不声明本轮重新核验了外部正文。**本地代码、分类表、历史研究记录及测试不能充当新增传统事实的独立证据。

| 核查项 | 本次支持范围与处理 |
| --- | --- |
| 产品分类 | 祈福／祈愿是本应用仅保留的两个产品分组。感谢、自省、礼敬、庆祝归入祈福，不等于这些实践在传统上都以泛化祈福为目的。 |
| 实际器物、材料、动作和完成条件 | 本轮不更改场景模型、材质、操作顺序、完成条件、具体对象或场合；只有主分组、运行时类别、DOM 类别及入口一致性发生变化。 |
| 原信仰与文化背景 | 御神签的问运／占卜、木鱼的伴诵与警醒、绘牌的谢恩、灯旋与铃的礼敬等原说明保留。不能将原有信仰、问运、谢恩或赠礼关系改写成传统本来只有泛祈福。 |
| 具体界面文案 | 标题、心意标签和动作说明可以继续明确写感谢、自省、礼敬、庆祝。取消独立类别不要求抹掉准确的具体表达，不将「感谢」一词批量替换为「祈福」。 |
| 新增文化主张 | 无新增起源、地域、社群、寓意、顺序、数量、期限、资格、节期或现实效力主张；写愿权限和产品分组不被解释为传统要求。 |
| 来源身份 | 来源 slug／`product-original`、注册表、模块 metadata、来源卡、场景 README 与原生标题的文化身份和内容不变，无需更换绑定或为二分类补造来源。 |
| 技术与事实审阅 | 下列技术检查与独立审阅已完成。技术通过只能证明分类与行为一致，不能证明传统文化主张。 |

## 核查清单

- [x] 已对照实际产品主目录、运行时类别、心意提示、写愿权限和持久化字段，未把代码反当作传统事实证据。
- [x] 仅作产品二分类归并和入口对齐，未改动器物、动作、完成条件及具体文化说明。
- [x] 未新增文化主张或外部正文已读声明；沿用既有来源记录的支持范围和访问限制。
- [x] 10项额外类别、5项主目录迁移和13项二元分类对齐已逐项记录，最终祈愿21项／祈福70项。
- [x] 分类与可选写愿权限分别处理；18项免费入口基础候选及3项不写愿的祈愿场景边界已记录。
- [x] 旧收藏、原心愿、用户文字和旧草稿保留；不修改无关的 `Collectible.kind` 或 `Wish.intention` 字段。
- [x] 已同步设计及历史记录的后续说明，核心分类一致性回归覆盖全部91项可见场景。
- [x] 已执行相关回归、构建、生产浏览器检查及独立审阅；原生JVM测试执行边界见下文。

## 技术验证

以下为本轮实际执行结果，不将只读分类计算或前轮运行结果当作本轮行为验证：

- 更新回归后先观察到核心2项分类不一致失败及App3项旧DOM类别失败，再实现二分类修正。
- 核心全套11个文件153项通过，包含91项可见场景的互斥二分类、21／70计数、5项迁移、旧存档和小组件逻辑。日志：`artifacts/two-scene-categories-core-tests.log`。
- App相关7个文件261项通过，覆盖主分类、首页轮换、图标及颜色映射、18项新建入口、心愿顶部、还愿提示、原写愿权限和旧草稿接续。分类变更后原颜色映射测试固定日期可能选到不写愿的祈愿场景，已将其跨页面共享样例明确限定为原本可写愿的收藏，未给不能写愿的场景补开权限。
- 顶层 `npm.cmd run build` 通过i18n验证、类型检查与Vite生产构建。分类迁移引起的小组件生成目录差异已同步，未忽略生成检查。日志：`artifacts/two-scene-categories-build.log`。
- `node --test scripts/blessing-widgets-native.test.mjs scripts/mobile-widget-previews.test.mjs` 共3项通过，覆盖模块发现、双平台图片对应及目录分类，既有封面图片和哈希不变。日志：`artifacts/two-scene-categories-widgets-tests.log`。本地没有生成的Android Gradle项目／wrapper，本轮没有执行Kotlin JUnit；修正的 `WidgetSnapshotTest.kt` 样例由独立源码审阅核对，不能称作原生单元测试已运行。
- 生产浏览器在320／390／1280px通过心愿页原交互、混合收藏过滤、仅祈福收藏不留空架、存档数组不写入、已用／未用／旧草稿导航、键盘／鼠标／触屏浏览、静音／减少动态效果和无WebGL降级；390px新建页显示18项可写愿祈愿入口，已归祈福的感谢／自省项及其他祈福类均不出现，无横向溢出、无页面异常。报告：`artifacts/two-scene-categories-shelf/browser.json`；截图：同目录 `two-category-picker-390.png`、`prayer-only-390.png`；日志：`artifacts/two-scene-categories-browser.log`。
- 独立审阅重新计算分类和候选数量，并逐字段对比23项场景仅改 `kind`，`label`、`action`、`optionalWish` 均未改变。审阅发现的Android花环测试旧类别已修正；本轮相关差异 `git diff --check` 通过。

仍沿用前轮的原工作区边界：并行“拿近查看”场景工作尚有未提交改动，本轮不修改这些场景来修复其生命周期检查。提交与主分支合并验证只包含本次二分类文件。

本轮尚未生成或发布新的TestFlight安装包；手机现有构建15不会随源码更新自动改变分类。

技术验证与文化事实审阅分别报告。
