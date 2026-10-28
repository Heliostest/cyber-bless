# 一日一念 iPhone 商店截图

当前复用入口是导入实际 iOS Simulator 中运行的原生 Release 应用截图。规格见 [Apple 截图要求](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications)，项目为竖屏、仅 iPhone；配置位于 `store/ios/screenshot-sizes.json`。

## 2026-10-26 原生系列与执行结果

本次已在 App Store Connect 应用 `6821271597`、bundle ID `com.helio.cyberbless`、版本 `1.0.0`、构建 `12` 的 `zh-Hans` 草稿中完成截图替换。当前为以下两组原生截图，各组五张；较小设备尺寸使用 App Store 的缩放适配。

| API 组 | 输入子目录 | 原生像素 | 输出子目录 |
| --- | --- | --- | --- |
| APP_IPHONE_61，灵动岛中屏 | `medium` | 1206 × 2622 | `store/screenshots/ios/zh-Hans/` |
| APP_IPHONE_67，灵动岛大屏 | `large` | 1320 × 2868 | `store/screenshots/ios/zh-Hans/iphone-67/` |

两组输入都按以下文件名和顺序提供：

```text
01-today.png
02-wishes.png
03-windchime.png
04-crane.png
05-world.png
```

两组共十张原生截图已完成导入与 ASC 替换核验，两台模拟器安装信息均已核对为 `1.0.0 (12)`。小组件在 Release 模拟器中可添加，但持续显示白卡，并出现 `CHSError1101` 空视图错误，未取得可用截图证据。因此本次范围收窄为 `01`–`05`，未导入或上传 `06-widget`，小组件捕获仍记录为阻塞。

独立替换于 `2026-10-26T14:46:19.505Z` 完成：十张新图全部为 `COMPLETE`，四十张旧远端截图已删除，最终两组各五张的顺序与 checksum 全部核验通过；原四十张图的同字节备份保留在 `artifacts/store-refresh-20261026/backup`，原始 ID、checksum 与顺序记录在其中的 `baseline.json`。执行回执为 `artifacts/store-refresh-20261026/report.json`，当前十图状态摘要见 `store/ios/screenshot-upload-state.json`。

随后于 `2026-10-26T14:47:45.015Z` 完成独立 API 读回，回执为 `artifacts/store-refresh-20261026/asc-audit.json`：确认当前十张截图、已关联且状态为 `VALID` 的构建 `12`，版本仍为 `PREPARE_FOR_SUBMISSION`、发布方式为 `MANUAL`，`readErrors` 为空对象。本次未提交 App Review。

## 导入实际原生截图

先在实际安装的 Release 应用中完成截图采集，将 XCTest 或 `simctl` 输出的原始 PNG 和来源记录放到同一台电脑的目录中。目录结构为：

```text
native-screenshots/
├─ capture-source.json
├─ medium/    # 上述五个 PNG，1206 × 2622
└─ large/     # 上述五个 PNG，1320 × 2868
```

`capture-source.json` 必须包含以下字段。下面仅展示结构；采集时间、源码 commit 和设备信息必须填写本次实际记录，不能用示例替代采集证据。

```json
{
  "captureId": "20261026",
  "capturedAt": "2026-10-26T05:00:00.000Z",
  "appId": "6821271597",
  "bundleIdentifier": "com.helio.cyberbless",
  "version": "1.0.0",
  "buildNumber": "12",
  "sourceCommit": "7cf95e9f31eea3463c4624ad5b00cc21493245e4",
  "source": "iOS 26.5 Simulator / Release / Xcode26.6",
  "devices": {
    "medium": { "name": "实际中屏模拟器名称", "udid": "实际 UDID", "runtime": "iOS 26.5" },
    "large": { "name": "实际大屏模拟器名称", "udid": "实际 UDID", "runtime": "iOS 26.5" }
  }
}
```

`captureId` 为八位日期字符串，`capturedAt` 为带时区的 ISO 时间，`sourceCommit` 为完整四十位十六进制 commit；两个 device 记录都须为非空对象。`source` 说明实际 iOS Simulator、Release 构建及 Xcode 版本。导入器对照本地 `apps/mobile-expo/app.json` 和 `apps/mobile-expo/eas.json` 核对应用身份与版本，并保留构建号和设备来源；来源记录应与实际安装包一致。

在仓库根目录的 PowerShell 中设置必填的本机绝对路径，再运行导入。以下路径只是示例，须改为实际保存原图的目录；URL、网络共享和相对路径不接受。

```powershell
$env:WBR_SCREENSHOT_NATIVE_DIR = 'D:\captures\wbr-20261026\native-screenshots'
npm.cmd run mobile:store:screenshots:capture
```

`scripts/capture-iphone-screenshots.mjs` 读取现成原图和来源 JSON，不连接设备或网络。它先校验全部十张的 PNG 格式和精确尺寸，不裁切、拉伸或合成界面。原图无 alpha 时保留原字节；有 alpha 时，只有所有像素完全不透明才可去除通道，任一透明或半透明像素都会拒绝导入。输入和输出均检查目录边界及 symlink/junction，避免越界读取或写入。

输出文件名为 `captureId-view.png`，例如 `20261026-01-today.png`。既有同名文件只有 SHA-256 完全一致才复用，字节不一致则停止，不覆盖；旧系列的原文件不删除。

完成导入后生成 `store/screenshots/ios-sizes-manifest.json`，保留原有 `groups/files` 结构，并记录 `source`、`nativeStatusBar: true`、`sourceCommit`、`version`、`buildNumber`、`devices` 及来源 JSON 的 SHA-256。每图记录原图 `originalSha256`、原始字节数，以及标准化后的像素、字节数、SHA-256、MD5和是否移除了不透明 alpha。生成图片与清单是本地产物，新检出仓库后须从已保全的原生采集目录重新导入。

## 通用增补上传与本次替换

通用上传入口仍为：

```powershell
npm.cmd run mobile:store:screenshots
```

`scripts/upload-app-store-screenshots.mjs` 依当前两组五图配置校验本地清单、尺寸、PNG、alpha和哈希，再核对本应用身份与可编辑版本。它只增补截图；同名且 checksum 一致时复用，同名不同内容或每组超过十张时停止。它不删除旧图、不替换整组、不提交审核，也不修改介绍、审核资料或构建。上传后要求读回 `COMPLETE` 且 checksum 一致。

本次执行前每组有五张旧图，先并存五张新图，达到每组十个槽位；通用增补命令不能完成旧图清理和排序。旧四十张的保全、远端精确 ID 删除和排序，均由本次独立脚本 `artifacts/store-refresh-20261026/replace-screenshots.mjs` 执行：先核对旧清单与实时资产，复制同字节旧图并保存 ID、checksum 和顺序到 `artifacts/store-refresh-20261026/backup`；一次上传两组全部十张新图，十张全部 `COMPLETE` 后才删除四十张旧图，最终核验仅两组各五张新图及其顺序。没有第六张或第二波上传阶段。

独立脚本以 `checkpoint.json` 保存进度，未知网络 mutation 结果会停止并要求读回，最终核验通过后才写 `report.json`。备份可用于重传旧图和恢复顺序，但删除后的原 Apple 资源 ID 不能复原。此流程不提交 App Review；本次完成状态以本页列出的执行回执与独立读回回执为准。

## 2026-10-13 历史系列

历史系列共八个 API 组、每组五张，总计四十张：`APP_IPHONE_67 / 65 / 61 / 58 / 55 / 47 / 40 / 35`。内容为今日、心愿、木鱼、小天地和隐私政策；当时保留原 APP_IPHONE_61 五张并增补其余三十五张。

这些历史图片来自 `artifacts/eas-archive-awdd99/source` 中 2026-10-10 稳定源码的生产 Web 界面，2026-10-13 采集，包含虚构本地记录，没有原生系统状态栏。它们属于旧版展示，不能用来证明本次原生构建或小组件已经完成验证。旧 4 英寸、3.5 英寸槽位也不表示应用支持相应旧设备运行。

旧图源文件保留在 `store/screenshots/ios/zh-Hans` 及各 `iphone-*` 子目录；历史 ID、checksum 与来源路径见 Git 历史版本中本次替换前的 `store/ios/screenshot-upload-state.json`，以及归档 `artifacts/store-refresh-20261026/legacy-upload-state.json`。当时上传与重复运行日志位于 `artifacts/mobile-verification`。原四十张同字节备份及实时基线已另存至 `artifacts/store-refresh-20261026/backup`；当前 `store/ios/screenshot-upload-state.json` 记录新十图状态。历史成功回执仅说明当时系列的状态，不作为本次上传完成凭据。
