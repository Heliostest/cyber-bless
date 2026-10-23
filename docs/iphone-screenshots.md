# 一日一念 iPhone 商店截图

2026-10-13 按 [Apple 当前截图规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)补齐八个 iPhone API 截图组。一个组内列出的多个分辨率是可选规格，不需要重复上传全部像素变体；每组最多十张。本应用为竖屏且不支持 iPad，本轮只处理 iPhone 竖屏截图。

| API 组 | 本轮分辨率 | 张数 |
| --- | --- | --- |
| APP_IPHONE_67，灵动岛大屏 | 1320 × 2868 | 5 |
| APP_IPHONE_65，Face ID 大屏 | 1284 × 2778 | 5 |
| APP_IPHONE_61，灵动岛中屏 | 1206 × 2622 | 5，保留原图 |
| APP_IPHONE_58，Face ID 中屏 | 1170 × 2532 | 5 |
| APP_IPHONE_55，Home 键大屏 | 1242 × 2208 | 5 |
| APP_IPHONE_47，Home 键中屏 | 750 × 1334 | 5 |
| APP_IPHONE_40，4 英寸旧规格 | 640 × 1096，无系统状态栏 | 5 |
| APP_IPHONE_35，3.5 英寸旧规格 | 640 × 920，无系统状态栏 | 5 |

4 英寸和 3.5 英寸是旧的素材槽位。本轮上传这些素材不会改变应用的最低 iOS 版本，也不表示已在相应旧设备上安装运行。现代 iPhone 的同组其他分辨率由 App Store 的显示适配处理。

每组包含今日、心愿、木鱼、小天地和隐私政策。原 APP_IPHONE_61 的五张图片及已有 Apple 资源 ID 保留；其余七组新增 35 张。截图均为实际 Web 产品页面，含虚构的本地示例记录，没有假设备框或系统状态栏。新图使用 2026-10-10 稳定 EAS 源码归档 `artifacts/eas-archive-awdd99/source` 的生产 Web 构建，在 Edge 中按各组 CSS 视口和 DPR 重新截取，不拉伸原截图，也不截取其他会话尚在修改的场景。

新截图于 2026-10-13 捕获，示例日期固定为 2026-10-10，以保持原截图系列的内容。源图位于 `store/screenshots/ios/zh-Hans/iphone-*`，规格位于 `store/ios/screenshot-sizes.json`，完整像素、字节、SHA-256、MD5、视口和来源清单位于 `store/screenshots/ios-sizes-manifest.json`。所有图片为无 alpha 的 PNG，捕获时检查页面渲染错误、字体加载和水平溢出，并检查了两张缩略总览。

## 重复捕获和上传

多尺寸截图 `store/screenshots/ios/zh-Hans/iphone-*/*.png` 和捕获清单 `store/screenshots/ios-sizes-manifest.json` 是本地生成产物，由 Git 忽略；截图规格、捕获／上传脚本、原有 APP_IPHONE_61 图片及发布回执继续纳入版本管理。新检出仓库后，先按下列步骤捕获生成图片和清单，再执行上传；不能直接使用缺少本地素材的上传命令。若需复核历史发布图片，应另行保留对应发布源码、图片和清单的归档。

先在选定的发布源码中完成 Web 生产构建，并在本机启动其 preview 服务。当前捕获脚本的页面导航对应本轮旧版截图系列；产品流程改版时应同步更新导航，不能将新界面和旧构建混用。

在根项目的 PowerShell 中指定实际来源后捕获：

```powershell
$env:WBR_SCREENSHOT_URL = 'http://127.0.0.1:4198'
$env:WBR_SCREENSHOT_SOURCE = '实际使用的发布源码版本或归档来源'
npm run mobile:store:screenshots:capture
```

默认使用已安装的 Edge，可用 `WBR_SCREENSHOT_BROWSER` 指定 Playwright 支持且本机已安装的浏览器 channel。捕获只允许 localhost/127.0.0.1；不会读取真实手机存档。APP_IPHONE_61 原图默认保留。

```powershell
npm run mobile:store:screenshots
```

上传前验证八个组的图片数量、分辨率、PNG 格式、透明通道、长度与哈希；通过本应用 EAS 远程凭据在内存中访问 Apple API，核对 owner、bundle ID、SKU 和当前可编辑版本。只增补截图，不删除已有图片、修改审核资料、邀请测试者或提交审核。相同文件名和 checksum 的现有图片直接复用；同名内容不一致时停止，避免覆盖未经核对的图片。上传后重新读取全部资产，要求 Apple 状态为 COMPLETE 且 checksum 一致。

本轮目标为 App Store Connect 应用 `6821271597`、bundle ID `com.helio.cyberbless`、1.0.0 的 zh-Hans 草稿。图片处理与幂等验证记录位于 `artifacts/mobile-verification/iphone-screenshot-upload.json`、`iphone-screenshot-first-upload.json` 和 `iphone-screenshot-repeat.log`；这些本地日志不进入 Git，仓库内保存不含凭据的上传结果摘要。

## 暂未增加的规格

Apple 规格页已列出 iPhone Duo 外屏 1398 × 2034 和内屏 2007 × 2853，但当前 ScreenshotDisplayType 尚无 Duo 目标。[Apple DTS 的回复](https://developer.apple.com/forums/thread/845505)说明上传支持会在 2026 年稍后开放，使用 iOS 27.1 SDK 的相关强制要求从 2027 年 4 月开始。当前没有可用的 Duo 上传入口，未向其他截图组上传尺寸不匹配的图片。

后续正式提审前仍需将截图、审核说明与最终生产安装包核对。本轮旧版页面与当前新增场景/桌面小组件开发代码有区别，补齐截图规格不代表新功能已进入已上传的构建 4，也不代表正式审核已提交。
