# 八语言 Native / Widget 实施记录

日期：2026-10-27。对应已批准的 [i18n 设计](../superpowers/specs/2026-10-27-i18n-design.md)。

本次只改变语言呈现与公开快照协议，不改场景器物、动作、文化归属、推荐种子、奖励规则、技术 ID、scheme 或个人存档版本。文化事实范围沿用 [2026-10-19 核查记录](2026-10-19-scene-culture-audit.md)，遵守 [场景来源规范](../scene-provenance.md)。翻译不得作为新文化事实的依据。

## 实现

- RN 通过 SDK57 `expo-localization` 读取有序首选语言。启动时先读已有主存档，仅提取经白名单校验的语言偏好，不写回；DOM 复用同一次读取，挂载前已经有系统语言和原生失败页语言。回前台重读首选语言，桥传 `preferredLanguages`，共享 App 接收 `systemLocales`。
- 失败页、重试、应用显示名、widget gallery、占位、无障碍模板来自八份 `native.json`。原生不需要长介绍、网络翻译或任何新增权限。`locales/*.json` 和 Android `values-b+...` 由同一生成器写出。
- 公开快照 v2 不携带 title、心愿、留言或私人标题，只包含 ID、日期、类别、图键、完成状态、白名单链接、语言偏好和文案版本等公开数据。JS 和 Kotlin 严格校验字段集、七日连续日期、目录、hash、时区、未来完成状态与链接；v2 按同一日历序号规则核对当日 sceneId。旧 v1 按旧版公开标题白名单读取。
- Android worker 只读取独立缓存，以偏好或系统语言本地查 ID 译名；增加 LOCALE_CHANGED，保留时间、时区、启动和更新事件。可见日期本地格式化，机器 YYYY-MM-DD 和 DST 计算不变。
- iOS 项目 config plugin 适配实际 SDK57 生成模板，将本地 Swift adapter 加入已有 `BlessingToday.swift` 的 Sources 编译单元。每次 SwiftUI 重绘读取原生首选语言，注入 `resolvedLocale` 和格式化日期。通过 ExpoWidgets 的公开 `evaluateLayout` / `WidgetsDynamicView` 执行自包含 renderer，避开 SDK57 没有 locale 的 WidgetEnvironment 和非公开的 TimelineEntry 初始化。gallery / 首次占位在没有 JS layout 时仍由 Swift 本地文案显示。extension Info.plist 明确声明八语言。未改 node_modules；不支持的 SDK/template 明确构建失败。
- renderer 不信任旧 timeline 的 title；显示只能由公开 sceneId 查询随包译名。隐藏场景守卫在 Swift adapter 和序列化函数内均保留。
- `generate-widget-localization.mjs` 默认严格要求每个内置 sceneId 的八语言标题，生成 copy hash、RN/Swift 输入、Android 目录与资源、自包含 JS 字典。`--check` 验证无漂移。早期 `--native-only` 仅用于 adapter 原型门槛，不能视为完整发行产物；全部译名就绪后必须用默认模式覆盖并检查。

## 已执行验证（持续更新）

- 两个新增 SDK57 adapter 测试先失败，再实现并通过：实际渲染注入、gallery 安全回退和不匹配模板显式失败。
- `node --test scripts/widget-localization-catalog.test.mjs scripts/mobile-widgets-ios.test.mjs scripts/widget-localization-plugin.test.mjs scripts/blessing-widgets-plugin.test.mjs scripts/blessing-widgets-native.test.mjs scripts/mobile-widget-images.test.mjs scripts/mobile-widget-previews.test.mjs`：21 项通过。含真正 Expo Babel 序列化、八语言隔离函数执行、旧 title 不信任、隐藏目录、语言切换重新发布、实际 Expo 源码生成、App Group/三尺寸保留、真实封面素材校验和生成物漂移检查。
- `node scripts/check-widget-jvm.mjs`：离线编译 Kotlin parser/localization，13 项通过；含 v1、v2、私有字段拒绝、日历选择、语言脚本优先级、支持语言顺序和 DST。初次受沙箱 loopback 限制无法连接 Gradle daemon；自动审查允许提升后实际通过。
- `node ../../node_modules/vitest/vitest.mjs run src/widgets.test.ts`（core 目录）：10 项通过。
- `node node_modules/typescript/bin/tsc --noEmit -p apps/mobile-expo/tsconfig.json`：通过。
- 隔离目录 `artifacts/widget-native-Pgplxd/apps/mobile-expo` 的实际 Android prebuild 通过，locale config 包含八语言；`:blessing-widgets:compileDebugKotlin` 和 `:blessing-widgets:testDebugUnitTest` 通过，包含 Glance 视图、实际 Android XML 资源和本地模块编译。首次测试进程因 PATH 内引号导致 Java `ClassNotFoundException: Files`；仅在测试进程环境移除 PATH 引号后重跑成功，未修改项目依赖或业务代码来绕过失败。
- 所有八语言的 154 个标题就绪后，已执行默认 `node scripts/generate-widget-localization.mjs` 和严格 `--check`，21 个文件生成/无漂移；发行生成物已覆盖早期 `--native-only` adapter 原型。对应标题覆盖 154×8，Native 语句 9×8。源文或英文未被用作缺失目标译文的填充。

## 验证边界

没有在 Windows 上声称 Swift 编译或 iPhone 实机通过。源码生成/序列化测试和 JVM parser 测试不能代替签名 iOS extension、Android launcher、VoiceOver/TalkBack、字体缩放和系统语言切换的设备验证。系统决定何时重绘/调度；实现要求下次系统重绘读取新语言，不承诺关闭 App 后即时更新。

当前仍需 iOS 编译与设备检查，以及各语言自然度与文化语义人工复核。技术覆盖不等于母语审校完成。

## 翻译工作接续

Native 词表八语言各 9 项已译。后续协作分配的 ja/ko 场景翻译，目前每语言已有 154 项标题与 300 项非标题短文案（共 454 项），对应 `zh-Hans/scenes.json` 过滤 `.title.` 后第 0–299 项；另各完成 `zh-Hans/narratives.json` 第 0–4 项的完整介绍。均为实际翻译，保留原字段、事实限定、产品/传统区分与占位符。其余短文案及 149 份介绍仍待翻译，不将当前子集记为完整八语言覆盖。共享动作名暂用日语「書けた」及韩语「다 썼어요」对应「写好了」。
