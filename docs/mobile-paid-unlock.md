# 首发永久买断：实施与实际状态

2026-10-13，开发者确认首发加入体验后买断。实现位于本项目托管工作目录 `C:\Users\helio\.codex\worktrees\mobile-paid-unlock\world-blessing-rituals`，分支 `codex/mobile-paid-unlock`；主工作目录已有修改保持不变。**当前是计费接口和购买/恢复页面已实现，体验权限门槛尚未完成；还不是可提审的付费版本。**

免费体验范围和基础价格仍待开发者答复。当前共享业务仍可进入所有体验，不会凭一个未确认的计时器或回合数开始收费。商店草稿未定价，付费入口在查不到有效商品时禁用购买。不应将此检查点打包作为最终首发。

## 身份与商店状态

| 项目 | 已核实的值或状态 |
| --- | --- |
| App / bundle | 一日一念 / `com.helio.cyberbless` |
| ASC App | `6821271597` |
| EAS project | `8bd96afd-5d35-4c3c-8ccc-3735696a4973` |
| 一次性商品 SKU | `com.helio.cyberbless.full_unlock`，独立于其他应用 |
| Apple 商品记录 | `6822274692`；非消耗型，2026-10-13T11:11:58.455Z 创建并独立读回 |
| 草稿状态 | API 返回 `MISSING_METADATA`；新商店 UI 的草稿列表显示“准备提交”，不能据此认定必填资料齐全 |
| 中文元数据 | 已保存并读回：一日一念永久解锁 / 永久解锁完整体验，一次购买，没有订阅。草稿版本 `88375b0a-5ef9-4857-9fde-6d8664b0ce88`，2026-10-13T11:25:52.186Z 核实 |
| 基础价格 / 地区可售 / 内购审核截图 | 未完成，未提交内购审核 |
| DSA | 开发者已授权现有联系资料公开使用；已填写 Apple 表单，停在邮箱验证码；尚未完成验证 |
| 付费 App 协议 | 已打开 Schedule 2/3 供审阅，尚未接受；银行/税务资料未核验或填写 |
| 已上传旧包 | 1.0.0(4)，不包含这次买断实现，不作为买断验收包 |
| 正式 App Review / 外部 Beta Review | 未提交；公开上架保持手动 |
| Google | 先前核查为开发者身份验证未完成，没有本应用记录、Licensing 公钥或商品；本轮未宣称这些状态已解决 |

商店回执为 `store/ios/in-app-purchase-status.json`；商店截图为主工作目录 `artifacts/store-evidence/iap-draft-created-20261013.jpg`。回执中的 `ByThisRun` 仅说明该次脚本动作，不能替代整体发布状态。

## 代码与依赖

原生 `App.tsx` 持有单一计费协调器；`BlessingDom.tsx` 只传递 `BillingSnapshot` 和顶层异步 `purchaseFullUnlock` / `restoreFullUnlock`。凭据、收据、Google token、原始签名不会进入 DOM、心愿存档、小组件或日志。共享 UI 在“我的 → 购买与恢复”显示商店本地化价格、非订阅说明和恢复入口。

`packages/runtime/src/billing.ts` 将购买请求返回值、监听事件、前台查询放进串行处理；pending 不授予/确认，验证或持久化失败不显示解锁成功，重复交付幂等。Android acknowledge 返回 false 或抛出异常时保持待确认并可重试。成功查询到空权益会撤销访问；网络失败保留此前已验证权益，不把断网当成退款。

`apps/mobile-expo/store-billing-port.ts` 使用 `expo-iap@6.0.1`。iOS 查询明确指定 active current entitlements，仅匹配原生已验证、仍有效的本商品交易；用户主动点击恢复时才执行 StoreKit sync，启动不弹出 sync 登录。iOS 交易由 StoreKit 持久管理；启动查询失败且无法取得既有权益时不会从普通布尔值伪造解锁。

Android 的 `modules/blessing-purchases` 使用 Java 原生 RSA 验签，核对原始 UTF-8 JSON、签名、本包名、单一 SKU、明确 purchased 原始状态 0 和一致 token；拒绝取消/退款/pending、缺字段、歧义商品与篡改。已验证证据保存在本应用私有 SharedPreferences `cyber-bless-purchase-evidence-v1`，写入 commit 成功后才授予；读取损坏不覆盖原文。它与 `cyber-bless:personal:v1` 业务存档分离，旧存档 schema 不迁移购买字段。

Android 公钥来自**本应用** Play Licensing，使用 EAS 项目构建环境 `EXPO_PUBLIC_PLAY_BILLING_PUBLIC_KEY` 注入原生 metadata。它是可公开的验证公钥，不是 upload key、服务账号或私钥。当前尚未取得真实公钥，原生验证 fail closed，Android 购买不可用。没有客户端 OAuth/服务账号，也未启用 RevenueCat、IAPKit、替代商店或外部支付。Gradle 与 Expo 插件均固定 Play provider。

本轮 Expo 官方检查要求五个同 SDK 补丁更新，已针对性调整：Expo 57.0.28、@expo/ui 57.0.23、expo-dev-client 57.0.20、expo-splash-screen 57.0.10、expo-widgets 57.0.24。RN 0.86.3、React/DOM 19.2.3、WebView 13.16.1、AsyncStorage 2.2.0 保持；根 npm 锁文件已保存。`expo install --check` 通过，实际 React 为单实例。技术证据和限制见 [兼容性研究](mobile-iap-compatibility.md)。

签名验证使用标准平台认证能力，未引入自研通用加密或私钥；原有 export-compliance 声明保留，最终 IPA 仍需核对实际 SDK/系统加密使用与 Apple 问卷。不能仅凭 DOM 导出认定生产包最终隐私审计完成。

## 可重复执行

以下命令在上面的托管工作目录运行：

```powershell
npm ci
npm run mobile:go
npm run mobile:dev-client
npm run mobile:iap:test
npm run verify
npm run mobile:archive:verify
npm run mobile:store:iap:prepare
```

Expo Go 仅适合原有免费界面与桥接不可用提示，不包含真实计费或本应用小组件。购买测试必须新建 development client 或 TestFlight / Play 测试安装包。不能用当前二维码或旧 build4 证明支付可用。

`mobile:store:iap:prepare` 验证本应用身份、沿用已有相同 SKU 的非消耗型商品，使用当前 Apple 版本化内购元数据 API 准备草稿，避免重复创建；不自动定价、开放可售地区或提交审核。最终价格和体验门槛完成后，根目录已有 EAS production / 指定构建 submit 命令仍按 `docs/mobile-app.md` 使用，保持 appVersionSource=remote、production autoIncrement 与手动公开发布。

CI 增加 JDK21 和计费边界检查，只跑验证，不默认云构建、上传或提交。`.easignore` 补入 HDR、来源许可证；归档检查要求计费代码、插件和原生模块随包进入云端。资源源文件准备流程仍共用，实际按长度/SHA-256验证。

## 实际验证和未验证

2026-10-13 实际通过：根业务套件 1,999 个测试、Web 生产构建、移动类型/版本检查、Android 与 iOS 生产导出，原生主包、DOM HTML/55 个脚本及 CSS，12 项离线资源长度/哈希，iOS 24 张小组件素材哈希。新增计费检查为 15 个协调器/适配测试、2 个真实共享 UI 路径测试和3项原生验签/Autolinking检查。

干净 EAS 上传归档已实际解包、`npm ci`、资源准备、双平台生产导出，验证没有引用其他导出目录的旧绝对路径；每次验证使用独立 Metro/TEMP 缓存。验签模块 Android Kotlin/Java 与 expo-iap 原生模块 Kotlin 均已通过真实 Gradle 编译；曾发现缺少 versionName，补齐后成功。

EAS 的代理请求通道曾两次连接 Apple API 超时；官方 API 直连可达。客户端现对该固定 HTTPS API host 选择 Node 标准 fetch，禁止重定向，密钥仅内存发送给同一 Apple 端点；不重试不确定结果的写请求。修复后商品版本和中文本地化已保存及独立读回，没有重复创建商品。

对应日志为托管工作目录 `artifacts/paid-verify.log`、`artifacts/paid-archive-final.log`、`artifacts/eas-archive-latest.json`、`artifacts/widget-native-pQz0hx/purchase-compile.log` 和 `iap-sdk-compile.log`。原生编译带有 Expo 上游弃用提示；不是编译失败。最初隔离目录的 GLB 单测因 Git LFS 指针失败，`git lfs checkout` 取回真实源资源后整个业务套件通过。

未完成：免费体验门槛/所有入口权限测试、当前商品/价格/审核图、原生真实沙盒购买/恢复/延迟付款/退款/重装/冷启动离线、独立安装包 UI 验收、新签名 IPA/APK/AAB 与上传、首次内购与版本联合审核。客户端离线历史签名无法实时发现退款，资源仍可被提取，也不承诺抗修改客户端；这些限制不能用测试密钥的验签成功替代真实商店验收。

App 内法务源已经为计费安装版本补充商店支付、本机凭据和恢复边界；公开 Notion 政策当前仍对应已发布的免费版本，尚未把阶段性文案替换为最终付费政策。最终包应再审计 SDK 请求、聚合 PrivacyInfo、权限、业务网络、无广告/分析/开发者收据服务器等事实，然后更新公开政策/商店答案。开发者未提供的测试邀请对象不邀请。

参考：[Apple 当前内购 API](https://developer.apple.com/documentation/appstoreconnectapi/managing-in-app-purchases)、[Expo 内购](https://docs.expo.dev/guides/in-app-purchases/)、[Apple 3.1.1](https://developer.apple.com/app-store/review/guidelines/)。
