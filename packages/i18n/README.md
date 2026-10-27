# 八语言本地化

`@wbr/i18n` 是离线 JS 基础包，支持 `zh-Hans`、`zh-Hant`、`en`、`ja`、`ko`、`es`、`pt`、`fr`。`system` 是偏好而非第九份词表。有序匹配系统语言，中文显式 script 优先于地区；系统模式保留地区格式，手选语言与系统时区、12/24 小时设置分别处理。

## 使用

`message('app.input.counter', { n, max })` 使用稳定 ID；生成的 `MessageArguments` 检查已知 ID 的 ICU 参数。`translate(source)` / `translateScene(source)` 只接受可信产品原文，后者保留场景语境。用户心愿、笔记、未知旧标题和远端文字直接渲染，不送入原文查找器。新增系统笔记存结构化事件，显示时翻译。

React 由 App 的 locale subscription 更新；命令式场景通过显式 text/attribute/cue 绑定更新现有实例。语言切换不创建新引擎。Canvas 使用字素分段和实际测量；输入使用完整字素计数并保护 IME composition。Native 只导入小入口 `./locales`、`./text`、`./errors`，不把完整场景词表拉入原生失败页。

## 更新词条

1. 在 `src/catalogs/zh-Hans/<group>.json` 添加稳定 ID，并在对应 `*-source.json` 登记可信源文。修改原文时保留原 ID；不同语境使用各自 ID，场景用 scene 查找域。
2. 同步八份完整词表。使用整句 ICU number/plural/select，保留变量、段落、文化限定和实际按钮术语。对象原有铭文可保持原样；新增文化主张先按项目来源规范核实。
3. 运行 `npm run i18n:extract` 与 `node scripts/i18n-check.mjs`。提取器只读检查 TS/TSX 可识别的显示入口，输出动态表达式清单；不能据此声称所有动态内容、CSS、HTML 或文化事实已审校。
4. 实际检查译文后运行 `npm run i18n:record-review`，记录源文／译文内容 hash、时间及真实审阅范围。该命令仅记录，不翻译、不代替母语审校。任何后续内容变化都会使记录过期。
5. 运行 `npm run i18n:compile` 和 `npm run i18n:generate-native`。FormatJS 编译 AST 与参数类型；原生生成器生成公开标题、小词表与文案版本。生成物入库，勿直接编辑。
6. 运行 `npm run i18n:test`、`npm run i18n:verify`，涉及排版时运行 `npm run i18n:verify-layout`。`npm run i18n:pseudo` 可生成真实 FormatJS 伪语言供隔离测试。

Web build 与 EAS post-install 会检查完整性、ICU、重复 ID、原文登记、审阅 hash 和生成物漂移。缺少译文会失败，不能复制源文来伪造完成；运行时降级只是故障保护。独立语言审校、iOS 编译、真机字体／读屏结果应另行记录。
