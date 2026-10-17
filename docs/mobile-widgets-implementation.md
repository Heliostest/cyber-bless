# 首版“今日仪式”小组件实现与本地验证

## 2026-10-17：整卡进入与大尺寸

- 所有尺寸移除右下角按钮，只在左下保留名称。iOS 根视图的 `widgetURL` 与 Android 根卡片的显式 Activity Intent 让整张卡片打开对应场景；已有链接校验、过期回退和编辑保护继续生效。
- iOS 支持 `systemSmall`、`systemMedium`、`systemLarge`。Android 保留原 provider，支持水平和垂直调整，以约 140×140、300×140、300×300 dp 的响应布局对应 2×2、4×2、4×4；实际格数和可用面积由桌面启动器决定。
- 大尺寸使用单独从真实 Three.js 场景渲染的 1200×1200 PNG，不裁用宽卡预览。现有 600×600 和 1280×600 预览也按当前目录重新生成。当前 75 个内置场景加公共兜底，各有三种尺寸，共 228 张图片。
- `mobile:widgets:render` 同时生成 iOS 静态资源导入表与 Android 公共元数据／图片资源表，避免新增场景后原生白名单继续停留在旧目录。默认使用 SwiftShader；本地 Windows GPU 可通过 `$env:WBR_WIDGET_GPU='1'` 选择 D3D11。
- iOS 图片桥等待三种尺寸全部复制完成后再发布时间线，离线导出校验覆盖三种尺寸的全部图片。Android 不同尺寸都使用同一套日期选择与深链。

本轮本地验证：

- 全量 `npm test`：3579 项通过。默认高并发运行时，`korean-bojagi-wrap` 的完整拖动路径用例触及 5 秒超时；该用例独立运行通过，限制 Vitest 为 4 个 worker 后全套通过，未修改场景代码或超时阈值。
- `npm run mobile:widgets:test`：core 8 项、runtime 5 项、应用导航 5 项及 Node 专项 15 项通过。覆盖三种 iOS 布局、整卡深链、旧时间线的大图回退、图片复制屏障、75 个场景和公共兜底的三尺寸 PNG 哈希与两端字节一致性。
- `$env:EXPO_OFFLINE='1'; npm run mobile:verify`：TypeScript、8 项移动打包检查、Android／iOS production JS 与 DOM 离线导出通过；核对 14 个应用离线素材和 iOS 全部 228 张小组件封面。在线版本检查提示 SDK 57 有新补丁，本轮按锁定 Expo 57.0.27 自带的 `bundledNativeModules.json` 校验，未升级依赖或改动锁文件。
- 在原有隔离 Expo Android 项目中同步本轮模块源码，执行 `:blessing-widgets:compileDebugKotlin :blessing-widgets:testDebugUnitTest`：`BUILD SUCCESSFUL`，11 项 JUnit 测试通过，包含三尺寸选图、75 个公共场景的原生验证和原有缓存／日期边界测试。
- Windows 本轮未运行 iOS 原生编译或真机桌面验收，未生成新版安装包。Android 新增高度调整能力与 iOS 新增系统尺寸都需要重建并安装原生包；安装后打开应用一次，再添加或调整组件。Android 长按已有组件调整至 4×4；iOS 在组件选择器选择大号。

平台尺寸依据：[Glance 响应布局](https://developer.android.com/develop/ui/compose/glance/build-ui)、[Android provider 尺寸与调整属性](https://developer.android.com/develop/ui/compose/glance/create-app-widget)、[WidgetKit systemLarge](https://developer.apple.com/documentation/widgetkit/widgetfamily/systemlarge)。

下面记录 2026-10-11 首版的实现和验证；尺寸与按钮行为以上述更新为准。本轮不进行云构建或发布。

日期：2026-10-11。按 [实施评估](mobile-widgets.md) 的推荐方案实现，基线为 `0313ca98a90c496ada6e7472cabf42542c21ae3c`，工作分支为 `codex/today-widgets`。本轮完成源代码和可运行的本地检查；没有云构建、上传、证书／provisioning profile 操作或发布。

## 已实现的行为

- iOS 使用 SDK 57 的官方 `expo-widgets`／`@expo/ui`，仅声明 `systemSmall`、`systemMedium`；Android 使用本地 Expo module + Glance 的紧凑／宽卡片，横向调整到约 300dp 时显示宽版。两种尺寸均以真实场景预览铺满卡片，左下显示仪式名称，右下显示“进入仪式 ↗”。按钮和整张卡片打开相同的场景深链。
- 共享 `dailyPrimaryScene` 和 11 个内置场景的公共元数据。预览图由项目现有 Three.js 场景引擎实际渲染，木鱼使用现有 GLB；生成方形 600×600、宽版 1280×600，共 22 张场景图和 2 张通用兜底图，每端约 2 MB。运行时小组件读取本地静态图片；点击进入应用后才运行可交互场景。
- iOS 将随包图片复制到专用 App Group，按素材 revision 分目录，等待临时文件复制和移动全部完成后发布时间线；失败清理临时文件并允许重试。Android 直接使用对应 `drawable-nodpi` 本地图片，包含通用和初始相册预览。两端使用底部渐变保证名称与按钮可读，iOS 关闭系统内容边距以铺满卡片。
- 主存档仍由应用独占写入。原生壳只在实际读取成功、或对应 raw 的写入成功后生成独立七天快照；缓存错误不会改变主存档的保存结果。读取失败／非法存档会发布公共兜底，而不会覆盖或重建主存档。
- 快照只有版本、哈希、时区、日期、公共场景字段和最小状态标记；没有心愿、笔记、账本、会话或完整存档。首版两端可见文案均为公共内容。SDK 57 的 iOS 相册预览会复用首条时间线，因此本版不显示“已收下”等完成状态。
- iOS 按本地日历生成七天时间线，在第八天进入通用入口。Android 从 `noBackupFilesDir` 的独立 AtomicFile 缓存读取当前日期，过期或损坏则兜底；安装实例存在时才安排午夜和六小时 WorkManager 刷新，并响应时间／时区／重启事件。系统可能延迟后台刷新。
- 深链限定为 `cyber-bless://widget/today?v=1` 和经过校验的日期／内置场景 ID。原生到 DOM 使用请求 ID 与消费确认；等存档载入且应用活跃后才进入场景。过期推荐回到“今日”；正在填写、仪式、场景或结算时保留页面，提供稍后打开／留在这里的提示。
- Expo Go 继续运行现有应用；缺少原生 widget module 时不加载 iOS widget UI。添加系统小组件需要安装 development client。先打开应用一次，让扩展注册布局和独立缓存。

## 主要代码

| 部分 | 入口 |
| --- | --- |
| 推荐与公共快照、链接校验 | [daily-scenes.ts](../packages/core/src/daily-scenes.ts)、[widgets.ts](../packages/core/src/widgets.ts) |
| 保存成功后的独立投影队列 | [projected-storage.ts](../packages/runtime/src/projected-storage.ts) |
| 原生壳同步与 DOM 深链桥 | [App.tsx](../apps/mobile-expo/App.tsx)、[widget-sync.ts](../apps/mobile-expo/widget-sync.ts)、[widget-navigation.tsx](../packages/app/src/widget-navigation.tsx) |
| iOS 视图和 CNG 配置 | [TodayWidget.tsx](../apps/mobile-expo/widgets/TodayWidget.tsx)、[app.json](../apps/mobile-expo/app.json) |
| 真实场景封面生成与 iOS 图片桥接 | [render-widget-previews.mjs](../scripts/render-widget-previews.mjs)、[scene.ts](../scripts/widget-preview/scene.ts)、[widget-images.ts](../apps/mobile-expo/widget-images.ts)、[素材清单](../assets/widgets/today/manifest.json) |
| Android module、Glance、缓存和调度 | [模块说明](../apps/mobile-expo/modules/blessing-widgets/README.md)、[config plugin](../apps/mobile-expo/plugins/withBlessingWidgets.cjs) |

主包标识仍为 `com.helio.cyberbless`，scheme 为 `cyber-bless`。iOS 扩展为 `com.helio.cyberbless.widgets`，专用 App Group 为 `group.com.helio.cyberbless.widgets`；CNG introspection 核对了主应用与扩展的同组 entitlement。这里只生成配置，没有向 Apple 创建或修改 capability／provisioning profile。Android provider 来自模块 manifest merge，重复 CNG 不会复制接收器。

## 已通过的本地检查

```powershell
npm run mobile:widgets:test
npm run verify
npm run mobile:archive:verify
```

- `verify`：519 项现有与新增业务测试通过，Web production build、移动端 TypeScript、Expo SDK 依赖一致性和 8 项原有移动打包检查通过；Android／iOS production JS 与 DOM 离线导出通过，核对了 9 个原有离线素材的哈希。iOS 导出另外核对全部 24 张小组件封面哈希。
- 小组件专项：core 8 项、runtime 5 项、DOM 导航 5 项，以及 13 项 Node 检查通过。Node 检查调用真实 Expo autolinking、config plugin、官方 iOS source generator 和 SDK Babel preset，验证两种尺寸、再生成一致性、隔离运行时的闭包序列化、Expo Go 降级、读取失败后的通用布局注册、图片准备完成前禁止发布、复制失败重试。素材测试核对全部内置场景的真实 WebGL 渲染证据、两种 PNG 尺寸、哈希与 Android 图片字节一致性。
- 独立 JVM harness 使用项目相同的 Kotlin 2.1.20 编译真实 `WidgetSnapshot.kt` 和 `WidgetSnapshotTest.kt`，8 项测试通过，包括元数据白名单、隐私字段拒绝、空快照失效、跨午夜和 23／25 小时 DST 边界。它不替代 Expo／Glance 集成编译。
- 独立 Android library harness 使用 AGP 8.12.0、Kotlin／Compose compiler 2.1.20、Glance 1.2.0 和 WorkManager 2.11.1，编译通过真实 Glance 视图、缓存、调度和快照代码及 XML 资源。该 harness 排除了依赖 Expo 的 `BlessingWidgetsModule.kt`，因此不算完整原生模块集成通过。
- `mobile:archive:verify` 只执行本地 `eas build:inspect --stage archive`，核对源包包含 Kotlin／XML／插件／共享代码及两端全部封面图片，在隔离目录 `npm ci` 后导出两端；没有发起远程构建。检查已捕获并修复 `.easignore` 排除新封面目录的问题。
- 审查修复并增加回归：场景渲染后即确认导航请求，避免附带保存阻塞后续点击；读取失败发布不可用兜底并捕获后台重试异常；两端预览与可见文案不泄露完成状态。

最新封面改动的日志在本地忽略目录 `artifacts/widget-work/`：`cover-render-repro.log`、`cover-verify.log`、`cover-widgets.log`、`cover-widgets-final.log`、`cover-glance-compile.log`、`cover-archive.log`；独立 harness 源码分别在同目录的 `parser-jvm/`、`glance-library/`。两端导出证据位于 `artifacts/mobile-verification/`，最终干净归档证据位于 `artifacts/eas-archive-latest.json`。`cover-gallery.png` 是全部真实场景图片的布局示意，供检查裁切和可读性，不能视为原生设备截图。

## 重新生成场景封面

```powershell
npx playwright install chromium
npm run mobile:widgets:render
npm run mobile:widgets:test
```

Playwright 已加入开发依赖与锁文件；首次生成需安装 Chromium，也可以设置 `WBR_CHROME` 指向已有 Chrome，跳过浏览器安装。本机验证使用 `$env:WBR_CHROME = 'C:/Program Files/Google/Chrome/Application/chrome.exe'`。使用随机可用端口和独立无头浏览器，不占用 8082。场景直接挂载现有引擎、CSS 和模型，固定公开展示姿态，不读取存档，不记录进度或发出声音；纸鹤和花灯使用可识别的折好／点亮姿态。输出同步写入 iOS 源素材与 Android 资源，清单记录引擎、尺寸、哈希和素材 revision。生成后的 PNG 是随代码保存的离线输入，应用打包无需启动浏览器生成。

## 原生验证边界与继续方法

在隔离副本中执行 Android `expo prebuild --no-install` 已成功；真实 Expo autolinker发现且只发现一个 Android module。此 Windows 环境的完整 Android Gradle 编译尚未通过：默认全局 init script 调用已移除的 `jcenter()`；绕过全局脚本后，React Native 自身 Kotlin DSL 在 `settings.gradle.kts`／`build.gradle.kts` 的 `plugins` 引用处失败，尚未编译到小组件。没有修改全局 Gradle 配置、React Native 源码或降低项目依赖版本。iOS 本地原生编译需要 macOS／Xcode，本轮仅验证生成配置、Swift 源文件和 JS 打包。

独立 Android library 的测试类也编译成功，但其 Gradle test executor 在此机器报 `ClassNotFoundException: Files`，未运行测试；上述同一份快照测试是在独立 JVM harness 中实际运行并通过的。Glance 库检查过程中 Android Gradle plugin 自动安装了 SDK Build-Tools 35.0.0；所有 Gradle 调试配置和 JDK 路径别名只留在 `artifacts/widget-work/`。

可重新准备隔离副本，避免在现有测试 checkout 写入 CNG 目录：

```powershell
node scripts/prepare-widget-native-check.mjs
$widgetCheck = Get-Content artifacts/widget-native-latest.json -Raw | ConvertFrom-Json
Set-Location $widgetCheck.app
npx expo prebuild --no-install --platform android
Set-Location android
.\gradlew.bat :blessing-widgets:compileDebugKotlin :blessing-widgets:testDebugUnitTest
```

该副本通过 junction／symlink 复用工作区依赖与公共代码；清理时不要递归遍历链接目标。实际 Android/iOS 安装后仍需验收：添加与调整两种尺寸、离线／应用关闭显示、冷／热启动点击、填写中点击的保护、跨午夜／时区／过期、字体放大和辅助功能。iOS 还需核对 Xcode target、App Group 与设备签名。

以后启动已安装的 development client 可使用 `npm run mobile:dev-client -- --port 8083`。本轮没有启动这个服务，原有 8082 服务保留；原 `docs/mobile-app.md` 的已有修改也完整保留，文件哈希与实施前一致。
