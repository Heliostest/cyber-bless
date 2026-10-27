# 八语言实现独立复核

日期：2026-10-27。审阅对象为当前工作区，参照 [批准设计](../superpowers/specs/2026-10-27-i18n-design.md)、[来源规范](../scene-provenance.md)和三个实施记录。审阅期间主实现者仍在修改文件；下列位置是发现时的位置，修复状态另列，不把“已告知”当作修复通过。

本次没有修改实现、词表或依赖，没有重新运行已经完成的 9,422 项场景测试。既有心愿／商店未提交改动不归为本次缺陷。西文介绍正在由另一任务补齐，是已知工作项，不作为新发现。技术审阅不证明八语言的母语自然度或文化语义已经人工审校。

## 行为问题

1. **P2：搜索使用中文来源标题，无法找到显示的译名。** `packages/app/src/scene-library.tsx:272` 用 `e.title.includes(query.trim())` 筛选，而第 302 行卡片显示 `localizedTitle(entry)`。英文、日文等用户复制眼前的场景名搜索，会得到空结果。第 292–294 行的搜索标签和 placeholder 也直接显示 `CATALOG_SEARCH_COPY`。应以当前展示标题为搜索依据，保留有意支持的原文匹配；标签在显示时翻译。

2. **P2：木鱼的提示及交互标签在切换语言后保留旧语言。** `packages/app/src/ritual.tsx:32`、`scene-experience.tsx:139` 把 `tr(...)` 结果存入 state；`woodfish.tsx:139` 直接显示该 instruction。`woodfish-scene.ts:126` 给 runtime 的 cue 也是创建时翻译的普通字符串，没有 locale getter／订阅。第 225 行加载内容后又把 `lease.pack.copy.instruction` 原文传入 state。跟随系统语言变化时，React 重绘和场景不销毁是正确的，但这些文字不会随之更新。应保存原文 descriptor／受信任内容身份，在显示和 cue getter 中翻译；未知远端原文应保留并标明实际语言。

3. **P2：提前翻译的错误消息失去恢复语义。** `scene-experience.tsx:452` 抛出已经翻译的“更新 App 后打开”错误；`scene-load-error.ts:17–25` 只识别中文来源、来源索引或少量英文正则。实际运行探针中，en 的 `Update the app to open this scene`、ja 的 `このシーンを開くには、アプリの更新が必要です`、fr 的 `Mettez l’app à jour pour ouvrir cette scène` 均被归类为网络不稳并建议重试／刷新，更新要求只剩在技术详情里。应传稳定 code 或来源 descriptor，在错误展示处才格式化。

4. **P2：无 Intl.Segmenter 时会丢失用户字符，并错误拆分韩文。** `packages/i18n/src/text.ts:4` 的正则要求每个片段从非 Mark 字符起始，因此 `graphemes('\u0301A')` 返回 `['A']`，而 Intl 返回 `['\u0301', 'A']`；`graphemes('\u1100\u1161')` 返回两个片段，而 Intl 返回一个韩文音节簇。`packages/app/src/scene-wish.ts:18–23` 用此 fallback 切取标题和正文，因此这不只是计数误差。实际运行探针通过暂时关闭 Intl.Segmenter 复现。肤色 emoji+ZWJ 示例已正确，不把它重复列为缺陷。应使用可靠的字素实现，并验证不丢任何原始码点及韩文组合边界。

5. **P2：笔记／还愿输入仍受 UTF-16 上限限制。** `packages/app/src/wishes.tsx:138–140,218–220` 仍用 `text.length` 和 `maxLength={500}`／`{60}`，与已经按字素验证的 core 不一致；例如一个肤色 ZWJ emoji 消耗多个可见“字”的额度。相应表单还需要核对 composition 提交保护。应与场景输入使用同一字素计数及宽编码上限，在提交时验证产品上限。

6. **P2：部分可达产品文案和页面标题仍绕过翻译。** `ritual.tsx:113,116` 的 `meta.name`、`intention.label/action` 和 `wish-ritual-picker.tsx:38–39` 的 `VESSEL_COPY.heading` 直接进入 ARIA／正文。审阅时 `packages/app/src` 没有 `document.title` 更新，Web HTML 仍为中文标题。这些并非需要保留的用户原文或器物书法。应修复显示入口，并给硬编码／显示 sink 检查提供实际覆盖，避免只校验词表键数。

以上六项均已即时发送主实现者。此列表保留发现时证据；随后修复的独立关闭结果见文末。

## 已检查的边界

- locale 匹配按首选列表顺序，中文显式 script 优先，消息语言与地区格式标签分离；主界面没有以 locale 为 key 重建场景。主实现者另外正在加启动偏好和异步读取的 owner 保护，最终应验证旧读取不能改写新宿主语言。
- `localizedTitle` 对已知身份取本地标题，对未知历史标题保留原文；新系统笔记有结构化类型，普通用户笔记没有整体送入翻译器。旧系统笔记适配采用机器 ID、时间和精确文本联合判断。未发现新的整份存档覆盖操作。
- imperative 场景通过显式绑定更新文字，`proceduralEngine` 注册 overlay 订阅并在 dispose 取消；绑定没有普遍改写 input value。此点不自动覆盖单独的木鱼实现。
- widget v2 的 JS reader 明确限定字段集、ID、连续日期、目录版本、图键和链接；生成器缺少任何 locale 标题会失败。Android 与 Swift 有各自系统语言解析，iOS adapter 使用已安装 Expo 模块的公开 `evaluateLayout`／`getWidgetEnvironment`／`WidgetsDynamicView` 接口。没有据此声称 Swift 实际编译或设备切换已经通过。

## 验收与工具边界

- `scripts/verify-i18n-layout.mjs` 的 6 个宽度 × 3 个文字倍率循环目前只覆盖 **空心愿页**；每种语言另测一个选择页和 320px 的 tanzaku 场景／介绍。即使全绿，也不能标为设计中的所有路由或 87 个公开场景矩阵；未见伪语言实际渲染、400% 桌面缩放回流、字体加载失败和软键盘覆盖。
- 本次只执行了小型运行探针：用 esbuild 内存打包真实模块并调用错误分类器、字素工具。没有借助网络翻译或更改词表。探针发现的初次 shell 编码失真已排除；上述结果使用 ASCII `\u...` 输入重新验证。
- 源文漂移、review manifest 与发行脚本接入仍由主实现者编写，不能用当前词表覆盖检查代替这部分最终复核。`i18n-catalogs.mjs` 可检查 ICU 解析和参数名／显式类型；仅能证明这些技术条件，不能证明对应语言的每个复数分支、自然度或文化限定正确。
- iOS 编译、iOS/Android 真实字体／文字放大／读屏、关闭 App 后系统重绘，以及八语言语义审校仍需独立证据。已有实施记录对此保留边界是必要的，不应由单元测试或 Chromium 模拟覆盖。

## 最终复核状态

初次审阅发现上述六组 P2 迁移缺口；未发现需要撤回原方案的 P0/P1 架构问题。

### 修复后的独立复核（2026-10-27 21:59）

再次阅读实际修改和 [UI 修复记录](2026-10-27-i18n-ui-finalization.md)，并独立执行定向测试；前述六组问题均可关闭：

| 原发现 | 关闭依据 |
| --- | --- |
| 1. 译名搜索 | 搜索匹配当前译名、原文和 ID；搜索标签与 placeholder 已翻译；真实渲染搜索测试通过。 |
| 2. 木鱼语言刷新 | instruction state 保留原文；Woodfish 在渲染时使用 `translateScene`；cue 改用带 locale getter 的场景 adapter；保持同一引擎的语言变化测试通过。 |
| 3. 升级错误丢失分类 | SceneExperience 抛出保留来源的 ProductError，显示处翻译；en／ja／fr 升级错误行为测试通过，不再落入网络错误。 |
| 4. Unicode fallback | 改用 `unicode-segmenter/grapheme`；独立运行关闭 Segmenter 的重音、韩文簇与 emoji 测试，全部通过。 |
| 5. 笔记／还愿限制 | 两入口使用字素计数和切片、宽编码上限以及 composition 保护；500 个 emoji 和还愿草稿／语言切换测试通过。 |
| 6. 显示入口／标题 | 原报告列出的 ritual 和 VESSEL_COPY 入口已翻译；App 同步 document.title；用户标题仍保持原文。 |

本轮独立执行结果：`packages/app` 的 `app-i18n.test.ts` 和 `i18n-ui-finalization.test.ts` 共 **15/15 通过**（21:58）；`packages/i18n` 的 `index.test.ts` 共 **21/21 通过**（21:59）。没有重复运行大型场景 suite，也没有将其他工作者的测试计作本次亲自执行。

另外复核了旧宿主读取完成后的 locale 所有权防护、Native 启动偏好的传递，以及 App／scene 同原文字串的分域翻译入口，未发现新的实质缺陷。主实现者正在接入的系统 12/24 小时设置曾存在通知与 React snapshot 不匹配的风险，已即时提醒；最新 App 已单独订阅 `getHour12`，主实现者继续补 prop-only 切换测试，该新增桥接不属于上列原六项的关闭证据。

**本轮结论：原六组 P2 已关闭，未发现新的确定性实质问题。** 这仅是代码与定向行为复核结论。发行门禁／review manifest、完整浏览器矩阵、原生构建与真机、语言及文化语义审校仍按各自实际产物验收；本报告上文的布局矩阵范围是初次审阅时的状态，不冒充正在扩展的最终运行结果。

### 发行门禁补充审阅与关闭

随后只读审阅 `i18n-catalogs/check/compile/review/extract.mjs`、根目录脚本和移动端 EAS post-install，发现并通知两项 P2：目标语言独有的 JSON 分组未进入源分组遍历，可能绕过未知 ID 和审核 hash 检查；ICU 校验只比较参数类型，允许 plural 被普通 number 替代，也没有要求目标语言的复数分支。

修复后再次阅读实现并独立验证，两项均已关闭：

- `readCatalogs()` 在返回前比较全部语言的分组，拒绝目标独有分组；覆盖检查和审核记录均调用此入口。
- validator 保留源 plural/select 控制结构、精确匹配分支及 plural offset；check/review 均传入目标 locale，按 `Intl.PluralRules` 的 cardinal／ordinal 类别检查分支。负例测试证明丢失 plural、select、`=0`、英文 `one` 和法文 `many` 会失败，日文仅 `other` 可通过。
- 独立执行 `node --test scripts/i18n-catalogs.test.mjs`：**9/9 通过**。
- 独立执行 `node scripts/i18n-check.mjs --review`：**八语言各 2,926 条、缺失 0，ICU／参数／分段及审核 hash 检查通过**。

根目录 production build 先执行 `i18n:verify`，EAS post-install 同样先执行门禁；编译和原生资源使用 `--check` 验证生成漂移，审核记录不会在这两个发布入口自动重写。本轮没有发现剩余的确定性发布门禁缺陷。上述检查只证明已声明的技术范围，不认证母语自然度、文化事实或设备显示；本次没有重跑主实现者报告的全量测试、生产构建或原生导出，也未修改实现和词表。
