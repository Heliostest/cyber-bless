# 内测场景热更新

在现有反馈后台准备、发布和回退整套内测 JavaScript 与已注册资源。手机下载并校验后，在“我的 → 内测更新”应用。Three.js 场景、仪式逻辑、文案、模型、贴图、字体和声音都可随同一更新分发；不是在场景里执行后台填写的脚本。

## 首次接入

旧安装包没有 `expo-updates`，必须先安装一次新内测包。新包需要正确的原生依赖锁、更新地址、公钥证书、平台 runtime，以及所有离线资产。普通/default 与正式构建关闭更新；指定内测构建必须同时满足共享 `INTERNAL_TOOLS_ENABLED` 和 `EXPO_INTERNAL_UPDATES=1`。EAS `preview` 已明确开启，`production` 没有开启。Mac 构建由已冻结的 `store/ios/release-input.json` 中 `internalUpdates` 布尔值决定，缺省为 false；指定内测接入包改为 true，连同真实新编号审阅、提交和冻结。仍按[发布入口](../scripts/ios-release/README.md)操作，不能把环境变量临时加到旧 tag 上冒充冻结输入。

原生依赖、权限、桥接口或公钥根改变时，需要新安装包。不能用命令参数把不兼容更新伪装成旧 runtime。每个平台分别准备，fingerprint 可能不同。

先在发布机执行 `npm run updates:setup`。默认私钥位于 `%LOCALAPPDATA%/CyberBless/internal-updates/private-key.pem`，只把公钥证书 `apps/mobile-expo/certs/internal-updates.pem` 纳入 Git。已有证书不能随意替换；备份私钥时沿用本机凭据保管方式，不复制到仓库、日志或更新包。

## 每次修改后的操作

1. 修改并验证场景，按[来源规范](scene-provenance.md)审阅实际内容，再提交本次全部源码、资产和生成文件。更新准备要求干净 Git 工作树。
2. 打开本机反馈后台 `http://127.0.0.1:4319` 的“内测更新”，选择平台并填写更新说明，点击“准备更新”。它只运行固定的项目准备/导出流程，导入已验证候选，不自动发布。
3. 核对候选的提交、平台、runtime 和说明，点击“发布”。当前通道按平台及 runtime 切换；没有兼容原生包的设备不会收到该更新。
4. 手机上先保存有效的测试邀请码，在“我的 → 内测更新”检查、下载。下载期间仍可退出页面；应用需回到“我的”，等待记录保存后点击“应用并重新打开”。应用时锁定导航，并在原生实际写入完成后重载。
5. 有问题时在后台选择旧候选“回退”，或把某个明确的平台/runtime 回退到安装包内版本。手机再次检查并下载/应用。回退旧内容会获得新的发布身份和时间。

命令行导入、发布、回退和存储配置见[更新服务说明](../scripts/internal-updates/README.md)。默认公网入口仍为 `https://feedback.heliosoft.win`，只转发接收端 4318，管理端 4319 保持本机访问。公网邀请码没有发布权限。更新资产通过已发布哈希白名单读取，不用于保密内容。

## 下载、资源与记录

客户端手动请求更新，服务按邀请码、平台和 runtime 筛选。原生验证签名及资产完整性；未完成下载或校验失败继续运行当前版本。后台不接受 HTTP 自定义 shell 命令、导出路径或任意文件上传。

Expo `public/` 资源不会自动进入 OTA。资产准备脚本从实际源码生成静态 Metro 注册表，逐项记录 MD5、大小与来源；原生解析当前已下载资产的本地 URI，再挂载 DOM。PNG/WebP/JSON 等使用字节不变的 `.bin` 别名，避免 Android 图片编译改变校验字节。原生映射缺项会报错，不能回落到安装包中的旧同名文件。网页仍使用自己的 public 资源。当前已安装 Expo 的 DOM 分块导出兼容处理见 Metro 配置和回归测试。

更新缓存与个人存档、反馈队列、Widget 投影分开。应用前共享存储与原生写入均等待完成；仪式页面不能应用更新。反馈诊断保留真实原生版本/构建号，并附当前更新 ID、runtime、提交和 tree（有则记录），不会把 OTA 提交伪装成原生构建号。

DOM 资源失败、渲染错误或前台启动超过 30 秒未就绪时，宿主停止网页并显示独立的原生修复入口。管理员先发布修复或嵌入回退，手机仍可在此检查、下载、手动应用；重载前等待存档、反馈写入及 Widget 投影完成。该入口提供在线修复，不承诺损坏的 DOM 在离线状态自动切回嵌入版；Expo 自身的原生 JS 启动恢复与网页错误不同。

指纹配置统一文本换行，保留二进制字节，并补齐已安装 SDK 在 Windows 配置加载路径上的排除规则；冻结 Pod 锁与生成原生 Widget 的文案数据纳入指纹。纯 Three.js 代码改动可复用兼容 runtime；原生 Widget 输入变更仍需要新安装包。

## 验收边界

`npm run updates:test` 验证协议、签名、资源、来源、配置、控制器、面板和实际 Expo Asset 行为；`npm test`、`npm run build`、`npm run mobile:verify` 与发布脚本测试覆盖现有系统。Metro 导出和 HTTP/浏览器验证不等于手机验收。

首次新包安装后，必须在真实 iOS/Android 设备依次验证：嵌入版离线启动 → A 下载应用 → B 修改 Three.js/模型/字体/声音 → 回退 A → 嵌入回退 → 断网重启；同时检查存档、未上传反馈、Widget、后台恢复和下载中断。错误签名、错误 runtime 和损坏资产应拒绝应用。未运行的真机步骤不能记录为通过。

## 来源核查

2026-11-08 实读官方 [DOM 文档的 Public assets 段](https://docs.expo.dev/guides/dom-components/#public-assets)、[SDK 53 的 Expo CLI 更新段](https://expo.dev/changelog/sdk-53)、[Expo Updates v1 协议正文](https://docs.expo.dev/technical-specs/expo-updates-1/)。前者说明 public 资源需要改用注册资产，SDK 53 记录 DOM 更新支持的引入，协议定义清单、资产、签名和回退；不能据此推导任意原生模块可远程替换或任何商店分发均可直接启用。SDK 57 的具体运行与文件行为还核对了本项目安装的 Expo DOM、Asset、Updates 和 CLI 源码。

本次只改变技术分发和资产定位。对照实际 diff，器物、材质内容、造型、动作、完成条件、标题、提示、寓意、来源 slug 和引擎/存档契约未改变；沿用[2026-10-19 文化核查](research/2026-10-19-scene-culture-audit.md)及既有场景记录。未新增文化主张，来源卡与场景 README 无需重写。将来通过本通道发布场景仍须逐次执行来源规范，签名与技术测试不能代替文化审阅。
