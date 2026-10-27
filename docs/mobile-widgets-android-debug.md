# Android 小组件本地 debug APK

日期：2026-10-11。此轮只做本地原生构建与模拟器检查，没有调用 EAS 云构建或发布。现有文档修改保留；此文件单独记录后续 Android 验证。

## 修复 Gradle

1. 用户全局 `~/.gradle/init.gradle` 调用 Gradle 9 已移除的 `jcenter()`。构建使用工作区专用 `GRADLE_USER_HOME`，不加载、不修改全局 init script。
2. 此前专用缓存中的 `wrapper` 是指向全局 wrapper 缓存的 Windows junction。通过该链接启动 Gradle 9.3.1 时，React Native `settings.gradle.kts` 报 `Unresolved reference 'plugins'`。同一源码、JDK 和缓存改用 Gradle 实际安装路径后，React Native／Expo 的 Kotlin 配置插件编译通过。无需修改依赖源码或降低 Gradle、Kotlin、React Native 版本。
3. 完整 Expo 集成随后发现本地 `blessing-widgets` library 未设置 `defaultConfig.versionName`。SDK 57 的 Expo Maven publication 配置要求该字段，已补 `versionCode` 与对应 library version。
4. SDK 57 的 `AsyncFunctionBuilder.Coroutine` 同时提供零参数和单参数重载；`refresh` 的 lambda 改为显式零参数 `{ -> ... }`，修复原生 Kotlin 编译中的重载歧义。完整应用构建包含 Expo module bridge，能够检查先前纯 Glance 编译未覆盖的这段代码。
5. SDK 的 Ninja 1.10.2 在深层目录编译 React Native C++ codegen，以及读取 Gradle prefab 缓存中的头文件时，遇到 `Filename longer than 260 characters`。系统原本已开启长路径支持。Windows 脚本在工作区下载[官方 Ninja 1.12.1](https://github.com/ninja-build/ninja/releases/tag/v1.12.1)，通过 `CMAKE_MAKE_PROGRAM` 仅供此次原生构建使用；并通过专用 init script 设置应用的 [`Cmake.buildStagingDirectory`](https://developer.android.com/reference/tools/gradle-api/8.10/com/android/build/api/dsl/Cmake)，将输出移到较短的 `artifacts/cxx-*` 路径。没有替换 SDK 内的 Ninja、更改系统长路径策略或依赖源码；也可用 `WBR_ANDROID_NINJA` 指向已有支持长路径的 Ninja。
6. 宿主 PATH 中有一项以多余双引号结尾。AGP 将 PATH 放进测试 JVM 的 `java.library.path`，该引号破坏 Windows 启动参数，导致 `ClassNotFoundException: Files`。脚本只在构建子进程环境中去掉 PATH 引号，保留全部目录，不修改全局 PATH。原生 8 项单元测试随后通过。

`scripts/build-mobile-android-debug.mjs` 将应用复制到 `artifacts/widget-native-*`，在该应用目录运行 CNG，解析生成 wrapper 所指定的版本并用 `realpath` 找到实际 Gradle 安装。通过 Java 启动 canonical Gradle launcher，避免 Windows batch／链接路径问题。缓存和日志留在工作区，既不改现有 native checkout，也不启动 Metro 服务。

## 构建与安装

```powershell
npm run mobile:android:debug -- --widget-qa --test
# 仅复用本轮已准备的隔离原生目录时：
npm run mobile:android:debug -- --prepared --widget-qa --test
```

需已安装 Android SDK、API 36、Build-Tools 36.0.0、NDK 27.1.12297006，并设置 `ANDROID_HOME` 和 `JAVA_HOME`（Gradle 9.3.1 需要 JDK 17 或更高版本）。脚本优先复用 wrapper 缓存中的同版本 Gradle，否则通过生成 wrapper 安装；也可设置 `WBR_GRADLE_HOME` 指向实际 Gradle 9.3.1 安装目录。首次运行会下载原生依赖。

当前脚本产物为 `artifacts/android-debug/cyber-bless-debug.apk`，旁边 `latest.json` 记录源码副本、Gradle 路径、生成时间、字节数与 SHA-256。此包使用标准 debug 签名，applicationId 为 `com.helio.cyberbless`，支持 Android 7.0/API 24 以上的 arm64-v8a 和 x86_64 设备。

`--widget-qa` 在隔离副本的 Android autolinking 中排除 `expo-dev-client`、`expo-dev-launcher`、`expo-dev-menu`，生成普通 React Native debug APK。Expo Dev Client 的外部 ACTION_VIEW 冷启动会先进入开发启动器；普通 debug host 可直接保留仪式链接并加载场景。主项目的 dependencies 和配置没有因此改变。不加该参数仍可生成标准 Expo Dev Client debug APK；本次也保留了 `world-blessing-rituals-dev-client-debug.apk`。`--test` 同时运行小组件原生单元测试。

普通 debug APK 仍需本地 Metro 加载应用 JS：

```powershell
$env:NODE_OPTIONS='--dns-result-order=ipv4first'
$env:CI='1'
npm run mobile:dev-client -- --port 8083 --host localhost
adb install -r artifacts/android-debug/cyber-bless-debug.apk
adb reverse tcp:8083 tcp:8083
adb shell am start -n com.helio.cyberbless/.MainActivity
```

连接多台设备时给每条 adb 命令加 `-s <serial>`。IPv4 优先用于解决本机 localhost 默认只绑定 `::1` 而 ADB reverse 连接 IPv4 的问题；CI 模式关闭文件监听，本轮测试无需热更新。先打开应用一次以生成公共七天缓存，再从启动器添加“今日仪式”小组件。默认紧凑版；横向扩大到宽卡片后展示第二种尺寸。场景封面来自 APK 中的本地 PNG，应用关闭后小组件可继续显示；通过按钮进入应用时，debug 包仍需 Metro 连接。

## 本轮验证结果

最终小组件测试 APK：`artifacts/android-debug/world-blessing-rituals-debug.apk`，98,193,378 字节（约 93.6 MiB）。SHA-256：`85aa0dcb9de70b2a3055acc6217d5a963ec0c634acd16eb0005edc49930ad2e7`。`apksigner verify` 通过，证书为 Android Debug；`aapt` 确认 debuggable、API 24/36、arm64-v8a 与 x86_64。

- `npm run mobile:android:debug -- --prepared --widget-qa --test`：`BUILD SUCCESSFUL`，360 tasks，包含完整应用 Java/Kotlin/C++ 编译和 APK 打包。
- 小组件原生 JUnit：8 项通过，0 failure/error/skip。业务测试与 Android 插件／自动链接检查也通过。
- 在 `emulator-5556` 的 API 36.1 / Pixel Launcher 上安装成功。使用已有 AVD 的只读、冷启动副本，未覆盖其快照或数据。
- 从系统启动器实际添加 2 × 2 小组件，拖动右侧尺寸手柄扩展为 4 × 2，再缩回；两种布局均显示满卡片 Three.js 渲染封面、左下仪式名、右下“进入仪式”按钮。
- 今日公开快照的仪式为 `yeondeunghoe` / “燃灯上浮”。两种尺寸的按钮都触发真实 ACTION_VIEW PendingIntent：`cyber-bless://widget/today?v=1&day=2026-10-11&scene=yeondeunghoe`，目标为 `.MainActivity`。应用已运行时及进程退出后的冷启动，均进入“场景体验 / 燃灯上浮”，Three.js 场景实际渲染；没有通过直接发送测试 URI 替代按钮点击。
- 退出应用进程后，小组件封面仍可见。宽卡冷启动由 PID 7235 退出后进入 PID 7366；紧凑卡在 PID 7366 退出后进入 PID 7655。没有清除应用数据或强制停止整个包。

截图与系统活动证据位于 `artifacts/widget-work/`：

| 检查 | 卡片截图 | 点击后场景截图 | 活动 Intent 日志 |
| --- | --- | --- | --- |
| 紧凑 / 2 × 2 | `android-widget-qa-small.png` | `android-widget-qa-small-cold-open-scene.png` | `android-widget-qa-small-cold-activity.txt` |
| 宽卡 / 4 × 2 | `android-widget-qa-wide.png` | `android-widget-qa-wide-cold-open-scene.png` | `android-widget-qa-wide-cold-activity.txt` |

构建日志为 `android-widget-qa-debug-build.log`；签名与 SDK/ABI 检查为 `android-widget-qa-apk-signature.log`、`android-widget-qa-apk-badging.log`。设备验证范围为本地 API 36.1 模拟器，尚未在实体手机或其他厂商启动器上测试。

`docs/mobile-app.md` 的 SHA-256 仍为 `716DA2D141BAC908E28638AF20A8A6C689A0056C0C824B04EE7CC7CB335678F0`，与本轮开始时一致。8082 在本轮开始时已无监听，本轮没有占用、停止或重启该端口；另开的 IPv4 8083 Metro 保持运行。未执行云构建或发布。
