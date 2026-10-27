# i18n 与排版审计（2026-10-27）

范围：当前工作区中的 Web、Expo DOM、React Native 宿主、场景及桌面小组件。包含尚未提交的心愿页改版；审计没有回退或覆盖这些改动。实施设计见 [八语言方案](../superpowers/specs/2026-10-27-i18n-design.md)。

## 当前实现

应用目前是简体中文应用，没有 i18n 库、语言注册表、语言偏好或翻译词表。

| 位置 | 现状与影响 |
| --- | --- |
| `apps/cyber-bless/index.html:2` | `lang="zh-CN"` 固定；无法表达实际内容语言 |
| `packages/app/src/context.tsx:65`、`wishes.tsx:136` | 日期、时间固定 `zh-CN`，句子拼接中文单位 |
| `packages/core/src/index.ts:119,206` | 设置和设置动作只处理布尔值；不能把语言字符串直接塞进现有动作 |
| `packages/runtime/src/index.ts` | 保存、读取失败为中文字符串 |
| `packages/app/src/scene-load-error.ts` | 用“是否含汉字”区分用户提示与诊断；与八语言不兼容 |
| `packages/scenes/src/contract.ts:5` | SceneContext 没有 locale、formatter、语言变化通道 |
| `packages/app/src/scene-experience.tsx:72` | 引擎单次挂载；React Provider 更新不会自动翻译场景 DOM |
| `packages/core/src/index.ts:75,235,522` | 收藏标题、场景标题和部分系统笔记保存了中文；需区分身份、用户原文与系统事件 |
| `packages/content/src/catalog.ts:10` | 远端目录只有单语言 title，且有长度、结构和版本校验 |
| `packages/core/src/widgets.ts:65,88` | 小组件写入并严格校验中文标题；单纯翻译 snapshot 会使校验失败 |
| Android `WidgetSnapshot.kt:48,95` | 拒绝未知字段，并按中文目录检查标题；协议升级必须显式处理 |
| `apps/mobile-expo/BlessingDom.tsx` | RN→DOM 没有语言参数；Native 失败页不会受 React DOM Provider 影响 |
| `apps/mobile-expo/widget-sync.ts:33` | 刷新签名没有语言；改语言可能不刷新组件 |
| `apps/mobile-expo/widgets/TodayWidget.tsx` | iOS widget 函数独立序列化，不能普通 import App 词表 |
| SDK57 `expo-widgets` 的 WidgetEnvironment | 已安装版本不提供 locale，App 关闭后的跟随系统切换需要原生扩展适配 |

## 文案规模

使用 TypeScript AST 扫描非测试源文件中的字符串、模板文本和 JSX 文本，按是否含汉字计数。下表是**候选出现次数**，包含重复、开发界面和不可见场景；不是最终 message ID 数，也不是翻译质量证明。

| 范围 | 候选数 |
| --- | ---: |
| packages/app | 437 |
| packages/core | 572 |
| packages/shared | 8 |
| packages/scenes | 2,971 |
| packages/content | 1 |
| packages/runtime | 3 |
| packages/gestures | 7 |
| apps/cyber-bless/src（含开发界面） | 77 |
| 合计 | 4,076 |

内置目录有 154 个场景和 154 篇介绍，当前 App 可见 87 个。全部介绍共 36,021 字符，可见介绍共 20,244 字符；87 个可见场景的实现中有约 1,500 个候选文案。应继续覆盖可由旧记录重开的实现，不能以“当前不推荐”代替实际入口检查。

`content/traditions` 有 1,600 份 Markdown 研究卡；`daily-scenes.ts:244` 说明 App 当前不读取其正文。研究资料不属于本轮批量全文翻译范围。当前场景介绍、来源字段或以后真正展示的来源卡则属于用户内容，应按实际入口列入清单。

## 排版与输入问题

| 位置 | 问题 | 处理方向 |
| --- | --- | --- |
| `page-heading.tsx:6`、`style.css` 的 title-ribbon | 按码点数估算字号，单行、省略并限制最小字号；中英等宽假设不成立 | 自适应行高、可换行标题、可访问完整文本；不要靠无限缩字解决 |
| `assets.ts:9`、`style.css:17` | 只打包 SC 字体；Nunito 只声明 U+0000–00FF；Hant/日/韩缺少专用字形优先级 | 按 lang 配字体栈，覆盖扩展拉丁与组合重音，核验离线回退与字体许可 |
| 按钮、分栏、过滤器、设置项、底部导航 | 四字中文适配不证明长译文适配；固定高度和 nowrap 有风险 | minmax(0,1fr)、min-inline-size:0、自动高度、合理换行和必要的纵向排列 |
| 沉浸场景、顶部介绍、底部提示 | 可用高度由安全区、键盘、导航与多行文案共同决定 | 测量真实 overlay 高度分配舞台；小屏提供可滚动信息区域，操作保持可达 |
| `mizuhiki/scene.ts:169` | Canvas 固定 SC 字体，并按 14/14/12 码点分行，超出部分不画 | 按 measureText 和词/字素边界布局；默认文字可译，用户原文完整保留并有可访问文本 |
| `auto-grow.ts` | 文本框目前只随 value 重新测量 | 加入语言、字体加载、容器宽度变化后的测量 |
| `core/index.ts:51`、`gestures/wishWrite.ts` | 长度单位是 UTF-16；组合符、emoji 与“字数”不等价 | 统一字素契约、IME 组合输入与持久化兼容；不要在输入组合中切断字符 |
| `scene-library.tsx:305` | 标题包含匹配；没有当前语言标题和重音处理 | 搜索本地译名、原名及稳定 ID；locale-aware 排序/匹配 |

## 浏览器实测

使用当前代码、临时 Vite 与已安装 Chromium，在独立浏览器内注入八语言草稿标签；没有把草稿翻译或测试样式写入产品。临时测试进程已停止。正常文字尺寸检查覆盖八语言 × 320/390/430px；大字压力测试在 320×568px 将已有 HTML 文本的计算字号翻倍。这是文本放大的浏览器模拟，不是真机 Dynamic Type 验证，也不是译文审校。

| 实测 | 结果与判断 |
| --- | --- |
| 标题字号 | 320px 下中/日/韩为 19px，英文 13.33px，西/葡/法为 12px。原因是按码点数除宽度，不能维持各语言标题层级 |
| 场景标题 | 葡语草稿 `Escreva um desejo de Tanabata` 在 12px 时仍是 scrollWidth 193px / 可用 170px，被省略 |
| 介绍浮层 | 200% 模拟 + 葡语时按钮 460×58px，面板 464px，而可用 header 294px；展开后仍超宽。`Math.max(closedWidth, available cap)` 与固定 48px 高度共同造成，外层隐藏 overflow 会掩盖 |
| 交互舞台 | 320×568px 的同一大字模拟使短册场景 canvas 高度从 196px 缩至 69px；需要最小可用交互区和短屏回流 |
| 底部导航 | 320px 草稿标签使 dock 高度从中文/日文约 72px 变成英文/法文 86px、西/葡文 102px；当前固定预留 128px，正常字号未证明遮挡，但大字适配不能继续依赖固定预留 |
| 字体 | Windows Chromium 中，繁体 `直骨令願` 实际全用 Noto Sans SC；日文 `直骨令かな` 混用 Noto Sans SC / Microsoft YaHei；韩文 `나의 소원` 混用 Malgun Gothic / Nunito；法文 `cœur Aujourd’hui œuvre` 混用 Nunito / Noto Sans SC / Microsoft YaHei |

正常字号草稿检查没有 document 横向溢出；这不能排除内部裁切、overflow:hidden 掩盖和字号过小。验收需测元素自身尺寸、交叠、完整阅读路径及实际字体，不能只断言 scrollWidth ≤ viewport。

补充发现：`style.css:2978,3705–3733` 用伪元素绘制中文“辅助”并隐藏真实操作文本。应把可见本地化标签放入 DOM，并维护动作自身的可访问名称。新心愿选择器的两列 minmax 布局基础较好，但窄屏三列器物架及 `overflow-wrap:anywhere` 仍需用长译名和大字检查。

## 技术与文化边界

已阅读 `AGENTS.md` 和 [场景来源规范](../scene-provenance.md)。本次只审计并提出本地化方案，没有改变器物、动作、来源身份、场景标题或任何文化主张，也没有重新声称已读全部文化来源。现有核查上下文见 [2026-10-19 来源审阅](2026-10-19-scene-culture-audit.md) 和 [介绍扩充](2026-10-20-scene-narratives.md)。

翻译实施必须逐条保留有据传统与产品安排的区分；物件上的“福”等真实对象文字不能因为 UI 换语言而自动换成外文。技术测试及中文禁用词扫描不能代替多语言文化语义审阅。

## 基线验证

- `npm.cmd run test -w @wbr/app`：32 个文件、1,112 项测试通过。
- `npm run build`：TypeScript 与 Vite 构建通过；存在大于 500 kB 的 chunk 警告。
- 以上是当前中文程序的基线，不代表八语言实现或真机验收已经完成。

## 已核对的技术资料

- [FormatJS 纯 JS API](https://formatjs.github.io/docs/intl/)：提供与 React Intl 共用的命令式 formatter；locale/messages 改变时重建实例并复用缓存。
- [React Intl](https://formatjs.github.io/docs/react-intl/)：React 适配、Intl 能力及运行环境要求。
- [FormatJS CLI](https://formatjs.github.io/docs/tooling/cli/)：抽取和编译；当前编译依赖原生 binding，实施时检查 Windows 与构建机支持。
- [Expo SDK57 Localization](https://docs.expo.dev/versions/v57.0.0/sdk/localization/)：系统首选语言、语言变化与前台更新。使用项目 SDK57 对应依赖，不要求升级整个 SDK。
- [CSS Text Level 3](https://www.w3.org/TR/css-text-3/)：语言相关的断行与文本处理。浏览器实际支持仍需单独测试。

以上技术页面于 2026-10-27 阅读了对应正文；不是文化来源证据。
