# 场景本地化实施记录

日期：2026-10-27。对应[批准的八语言设计](../superpowers/specs/2026-10-27-i18n-design.md)与[实施计划](../superpowers/plans/2026-10-27-i18n.md)。

## 范围与来源边界

本次保持 154 个随包场景的器物、动作、条件、来源 slug、技术 ID、引擎版本、原始中文 metadata 与历史存档身份不变。覆盖包括 87 个当前公开场景以及旧存档／开发入口可达场景。中文基准取自实际实现、`packages/core/src/daily-scenes.ts`、`scene-intentions.ts` 与 `scene-narratives/`，这些文件用于确定待翻译内容，不作为新增文化事实的独立证据。

文化事实边界复用[现行核查规范](../scene-provenance.md)、[2026-10-19 场景来源审阅](2026-10-19-scene-culture-audit.md)和各场景 README／介绍对应的既有核查记录。本次未添加传统起源、统一步骤、资格、数量、节期、宗教效果等文化主张。翻译须保持真实宗教与祈愿背景、地方差异、产品动作安排和不保证现实效果等限定；不得以自动化词表覆盖代替语言或文化语义审阅。研究仓库的 1,600 份来源卡不由当前 App 加载，不在本轮整体翻译范围内。

新增“查看纸面文字”仅是对水引场景已有留言的完整阅读入口；“辅助”标签解释既有操作按钮。这些是界面功能，不是传统实践。用户原文不进入翻译查表。

### 翻译术语复核：日本柊

`hiiragi-iwashi` 的英文／西文／法文／葡文初稿使用了未限定的 holly／acebo／houx／azevinho，容易把日本柊混同为西洋冬青。2026-10-27 实际重读同志社女子大学吉海直人（发表时日本語日本文学科教授）2019-01-15 的[《節分の「鰯の頭」と「柊鰯」》](https://www.dwc.doshisha.ac.jp/research/faculty_column/2019-01-15-12-55)正文第 93 行：明确区分日本柊（モクセイ科、对生叶）与西洋柊（モチノキ科、互生叶、红果）。本次访问状态为已读相关正文；仅采用该植物区分，不使用相邻历史推测、节日日期或基督教象征段落。

处理：相应标题／短文案／介绍采用 `hiiragi` 原名，保留来源原本的尖叶与鱼气味等描述；不新增拉丁学名。日／韩／繁中标题本已保留柊或 hiiragi 原名。中文源文案、技术 ID、source hash、引擎与绑定不变，重新生成原生译名目录。该纠正使译文回到既有来源范围，不改变传统身份。相关来源卡和场景 README 同步记录。

## 机制与不变量

- `scene-localization.ts` 在产品文字写入点显式登记原文 descriptor；`localizeSceneOverlay` 只重绘已登记的 text／ARIA／title／placeholder，不根据“含中文”扫描或改写任意 DOM。输入 value、用户正文、节点、监听器、焦点与选择区不受其写入。
- `setSafeText` 保留原有中文来源文案的文化措辞检查，随后本地化展示。步骤及提示状态继续由场景控制；语言订阅不调用 create/start/dispose，不提交进度和奖励。
- 相同中文在不同范围可有不同语义：导航的“留在这里”表示本人继续停留，Milagros 表示将小符留在此处。场景 renderer 使用 foundation 的 `translateScene` 优先查场景源索引，不让 App 字典排序覆盖场景语义；失败回归先观察到 Stay here，再确认切语后为 Leave it here／Dejarlo aquí。
- `sceneTemplate` 保留动态值的源模板，`sceneJoin` 组合完整产品子句；模板输出注册有界，DOM 绑定另行持有 descriptor，切语言不会依赖反向猜译显示文字。
- 模板的普通参数严格保留原值，即使用户输入恰好等于“写好了”等产品源文，也不递归查译。只有代码显式用 `sceneProductCopy` 标记的产品子句才继续翻译；已用实际同文碰撞失败回归确认此边界。
- 物体操作提示通过局部 `addInteractionCue` 包装器，在现有每帧更新中读取当前译文。其 getter 继续读取场景持有的可变 cue spec，因此梧柶、包袱布与毡房的动态落点／松手提示仍有效。
- cue 自身持有当前 label／targetLabel descriptor，只在场景修改原 spec 时更新；不会依赖 512 项临时注册表永久保留过去组合。七供碗的模板也在实际使用时建立，而非让已缓存模块长期保存可被逐出的组合原文。600 个无关组合之后的 cue 与再次进入供碗场景均有失败再修复的回归。
- 放置提示记录可恢复的 descriptor，并同时检查当前显示值，避免覆盖后来由场景写入的新提示。
- 手势留言框按字素显示与验证上限；HTML maxLength 只保留较宽的编码大小上限。composition 期间不提交，不裁切文本；语言更新不修改草稿。dispose 取消语言订阅。
- 水引 Canvas 使用真实测宽、词／字素换行与 locale 字体；不再按 14/14/12 个码点截断。原始用户留言另有 DOM 阅读入口；默认产品文字与用户文字分别处理，只有前者可翻译。语言／字体加载后重绘，dispose 取消订阅。
- Canvas 的字素处理复用 `@wbr/i18n/text`，不再维护另一份正则近似；foundation 统一用 `Intl.Segmenter` 或经测试的 Unicode 分段库。Canvas 无 Segmenter 回归包括前导组合符、韩文 Jamo、带肤色 ZWJ emoji 与组合重音。

## 词表与覆盖记录

`packages/i18n/src/scene-source.json` 是 exact trusted source → stable ID 的普通对象；标题优先登记为 `scene.<sceneId>.title.<sourceHash>`。介绍放在各语言 `narratives.json`，短文案、标题与场景意图放在 `scenes.json`。源字串 hash 用于识别源文案修订，不改变 sceneId。

机械迁移后登记 2,363 条源文案，其中短文案 2,209 条、介绍 154 条。这个数量包含共享源文案去重后的条目以及部分旧实现候选，不等于所有字串都出现在当前公开页面。翻译进度由实际文件和根目录 i18n 覆盖检查确认；未译条目不得以复制中文／英文凑齐。

2026-10-27 续办后的实际文件进度：八语言短词表均为 2,209/2,209，八语言 App 词表均为 440/440，介绍均为 154/154。英文与西文介绍各 308 段，西文为 23,671 词；西文后续 118 条由独占该文件的介绍译者完成，保留前 36 条与作者 Kip Hutchins 的校正。繁中 154 个标题经过逐条翻译，其他内容由主实现者用离线转换生成初稿并复核；转换覆盖不等于人工语言审校。共享 controls／common、Hant 复核、App 集成与全局 CI 由主实现者记录。

英文与西文短词表保留全部动作、方向、数量、完成条件和文化／产品限定；梧柶动态步数与次数的六条消息补充 ICU plural，单数 1 不再显示 spaces／throws 等复数。既有场景原始中文、ID、版本和存档字段不改写。器物上的五／大／力、運与品牌图形“念”等原字不构成假译文；应翻译的是解释与无障碍说明。各语言文件结构校验及自动生成目录不代表已完成独立母语审校、真机或读屏验收。

## 已运行的验证

- `npm.cmd exec -w @wbr/scenes -- vitest run src/canvas-text.test.ts src/scene-localization.test.ts src/drop-feedback.test.ts`：8 个测试通过，覆盖同一节点更新、输入同文不误译、焦点、事件、取消订阅、动态值、可变 cue、辅助标签、测宽与有／无 Segmenter 时的 emoji／组合重音。
- `npm.cmd run test -w @wbr/gestures`：55 个测试通过，新增字素／IME／切语言草稿回归。测试先观察到旧 UTF-16 计数为 9/2、旧 maxLength 为 40 的失败，再完成修正。
- 初次完整场景 suite：9,395 通过、26 失败（263 文件、9,421 测试）。失败包括 Canvas 测试替身缺少 measureText、旧 UTF-16 maxlength 断言、辅助标签改变后需检查完整 aria-label 的断言，以及 Sansi 完成按钮先生成辅助标签后才添加 finish class 的真实显示问题。已为后者补写完整完成文案。另新增两场景 emoji 回归，修正蜡烛与叶舟回调中残留的 UTF-16 长度拒绝。
- 对全部受影响文件进行完整回归：18 文件、860 测试通过。未删除 40／41 字素的实际提交边界断言，仅将旧编码长度断言改为宽编码安全上限。
- 最终 `npm.cmd run test -w @wbr/scenes`：263 文件、9,422 测试全部通过，包含 TypeScript 检查，耗时约 294 秒。输出在本任务临时目录 `scenes-final.log`。另新增并单独通过 live scene locale 测试：真实泉边场景同一引擎、物件、进度回调、焦点及 composition 草稿均保留；未调用 start/dispose 来切语言。
- 随后将完整纸面阅读入口归入既有 wish shelf，并限制入口自身可滚动高度，避免自动 grid 放进 canvas 区；水引／测宽回归 33 测试通过。这个小改动发生在上述全量 run 之后，未据此虚构另一次全量 run。
- 模板用户文本碰撞修复后，五个关联文件 200 测试通过；后续注册表逐出问题先观察到两条新增回归失败，再修复并完整运行 localizer／七供碗两文件 95 测试，全部通过。后续 `npm.cmd run typecheck -w @wbr/scenes` 零错误。
- 再次补充场景／导航同文异义与韩文 Jamo 失败回归后，使用 scoped lookup 与统一字素分段；localizer、Canvas、drop feedback、水引、七供碗、梧柶六文件完整运行 191 测试通过，场景 TypeScript 再次零错误。
- 英文／西文 App 与短文案合计 5,298 条通过 JSON、完整 ID、非空、ICU 解析与参数名一致性检查；独立语言任务另核对日／韩／葡词表的参数类型与出现数。西文 154 条介绍完成后，全部 ID、非空、ICU 解析／参数类型、308 段落数与编码检查通过，无源文整段复制。另对六种非中文译文逐条核对源文三位以上阿拉伯数字，未发现遗漏；这只是事实保留的辅助检查，不能证明全部语义正确。浏览器／真实手机／读屏和母语审校应分别记录，不能由上述单元测试推断已完成。

## 宿主集成续办（主实现者所有的文件）

以下是 2026-10-27 主实现者模型容量错误期间留下的历史只读检查点。主实现者恢复后已接入正常 procedural adapter、语言选择器和系统偏好、日期与结构化系统消息，并继续执行全局检查；以下各条不再代表当前未完成清单，最终状态以主实现者的集成记录和实际测试为准。场景 helper 与词表机制通过测试，仍不等于 App 已接通全部路径。

1. `packages/app/src/procedural-scene.ts` 在 `module.create(...)` 后调用导出的 `localizeSceneOverlay(overlay)`，dispose 时在 `instance.dispose()` 前取消订阅。检查 `/dev` 与 SceneReview 的直接挂载路径。当前主 App adapter 尚未接入；已有 DOM 的动态更新不能只依赖 React Provider。
2. `pages.tsx` 的语言选择器尚待接入；心愿时间仍有固定 `zh-CN`。已知 sceneId 的标题／介绍、旧收藏、历史记录和结构化系统笔记展示仍需按主计划逐项确认。
3. 自动迁移误将 `scene-icons.tsx` 的五／大／力石字与“運”器物字样包进 `tr(...)`。这些是有来源的物件文字，应保留原字，译解释和无障碍说明；不能用“所有 JSX 文本都必须翻译”替代器物语义判断。
4. `opening.tsx` 等仍有“第”＋数量＋“场”这类分片 JSX，心愿来源也有“记于「”＋标题＋闭引号的拼接；应改成完整 ICU 句子，支持目标语言语序。
5. `scripts/i18n-compile.mjs` 已可用；永久 scene 抽取／严格缺译与陈旧译文检查尚需主实现者补齐。临时来源清单位于 `.superpowers/sdd/2026-10-27-i18n/scene-extraction.json`；不是新文化事实证据。
6. Foundation 的无 Segmenter 字素 fallback 仍需检查 Emoji_Modifier；场景 Canvas 的 fallback 已有失败再修复的回归覆盖。具体问题已发送主实现者，未越权修改其实现。

## 永久抽取检查与开发入口续办

`scripts/i18n-extract.mjs` 是只读检查器，不执行迁移、安装或词表重写。它读取全部 `*-source.json` 及简中词表核对源 ID，并扫描工作区 TS／TSX 的显式 tr／translateScene／sceneTemplate／sceneJoin／sceneProductCopy／productError、绑定 API、JSX 文本／可读属性、DOM／Canvas 写入、模块级常量和具名 COPY 容器，以及 core 目录、场景 module metadata、介绍与意图字段。新增未登记产品文案、未经本地化的字面写入或动态预插值会失败；现有 ID 不重新生成。

当前扫描 538 个文件、3,289 处已登记字面位置，11 个正反回归通过。另有 491 处动态表达式只列为未解析，不将用户／远端文本猜作产品文案，也不声称完成完整跨函数数据流证明。纯技术字段、测试、生成文件、CSS、独立 HTML 和 Swift／Kotlin 由各自检查覆盖。八个明确豁免位置涉及原器物 SVG 字形、IEC 单位 MiB、Three.js 库名、特定 desktop-note 品牌锁定字样及操作提示图标。图标只允许精确 SVG 外壳与词法范围内的纯几何标签表；增加文字节点或可读 ARIA／title 属性会使豁免失效，没有按整个路由文件关闭检查。

剩余 Web 开发入口全部迁移，而非排除：新增 developer 源组 70 条，八语言均完整翻译并通过 ICU／参数检查，覆盖启动占位、Shader 工具、场景遍历、开场预览、旧场景目录、手势状态与说明、约束说明及完成／错误页。技术 ID、禁止词的原文示例、JSON／函数标识和器物字样保持原样。入口复用 browserHost 提供的早期语言偏好，不另读／写个人存档；独立检查／预览存档只继承语言偏好。locale 订阅只更新文案，不重建当前手势或场景。

开发入口实测为法语／日语 × `/dev/gallery`／真实 `/dev/scene/tanzaku-tanabata`，320×640 CSS 视口、模拟 200% 计算文字尺寸，共四例。首轮发现旧绝对定位导致标题、退出、提示重叠，以及固定调试入口遮挡操作；随后旧适配器复用 library-scene-stage 的测量托盘，标题和工具栏改为文档流，并保留画布交互区域及页面滚动。最终四例无横向裁切、提示／按钮重叠或浏览器异常，辅助按钮可滚动到可操作位置。报告及截图在 `artifacts/dev-i18n-layout/`；不据此宣称 154 场景或原生文字缩放全部验收。Web TypeScript 与保留草稿节点的 locale 回归通过。

两例真实开发场景还先完成一段操作，再由法／日语切为英文并切回；同一个 Canvas、辅助按钮节点及已完成 checkpoint 均保留，操作说明随语言变化并可恢复原译文。结果记录在报告的 `liveLocale` 字段，全项通过。
