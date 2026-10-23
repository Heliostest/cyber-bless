# 首发移动端永久买断：IAP 兼容性与验证边界

研究日期：2026-10-13。范围为 iOS / Google Play Android；基于现有 React/Vite 共享 UI → Expo `"use dom"` → 原生 App。本文只做只读研究和方案记录，未安装依赖、修改产品代码、生成原生工程或操作商店。免费体验边界、价格、最终商品 ID 仍待产品决定；本文不代为设定。

## 结论

优先使用精确锁定的 **`expo-iap@6.0.1`**，保留项目现有 Expo 57 / RN 0.86 / React 19.2。这个建议有直接兼容性证据：发行版的官方 Expo setup 源码将 SDK 57 / RN 0.86 列为已验证基线，发行包的开发依赖也是 Expo 57、RN 0.86.2、React 19.2.3。通配 peerDependencies 本身不能证明原生构建通过；两个平台仍需 development build 和真实商店沙盒验收。[官方 Expo setup 源码][expo-setup-source]、[npm 发行元数据][expo-registry]

首发买断应对应 Apple **non-consumable** 和 Google Play **one-time product 的永久 buy 选项**，Android 不 consume。免费体验是 App 的内容访问规则，不需要把买断改成订阅免费试用。商品价格展示应使用商店返回的 `displayPrice`，不在共享 UI 写死金额。[Apple 商品类型][apple-product-types]、[Google one-time products][google-one-time]、[Expo IAP 产品类型源码][expo-types]

无账号可以实现按各自商店账号恢复购买，但不能据此承诺 iOS 与 Android 共用一次购买。iOS 可由 StoreKit 2 的已验证当前权益重建。Android 可使用本 App Play Licensing 公钥对原始购买 JSON 做原生 RSA 验签，再结合商店重查和签名快照支持离线；这只是客户端验证方案，不等于 Google Developer API 的实时权益核验，也不能承诺抵抗修改过的 App、复制购买凭据或实时发现离线退款。[Apple 当前权益][apple-current]、[Google 安全指南][google-security]

**Android 当前尚无已就绪的 Play 应用记录和该应用公钥时，真实验签与商店购买不能完成。** 可以先写实现和负向测试；不能填入编造的公钥、跳过签名验证、把 mock 成功当作买断已可上线。

## 1. 项目实际基线

以下版本从根 `package-lock.json` 的已解析包条目读取，不是依赖范围推测：

| 项目 | 实际锁定值 / 状态 |
| --- | --- |
| npm workspaces | `apps/*`、`packages/*` |
| 移动 workspace | `@wbr/mobile`，`apps/mobile-expo` |
| Expo | `57.0.27` |
| React Native | `0.86.3` |
| React / React DOM | `19.2.3` |
| expo-modules-core | `57.0.21` |
| expo-dev-client | `57.0.19`，已安装 |
| EAS CLI | `24.12.1`，package 与 `eas.json` 相符 |
| 原生工程 | 研究时 `apps/mobile-expo/ios`、`android` 目录不存在；采用 CNG / config plugins |
| IAP / Nitro / SecureStore | 研究时锁文件未包含 `expo-iap`、`react-native-iap`、`react-native-nitro-modules`、`expo-secure-store` |

本地依据：[`apps/mobile-expo/package.json`](../apps/mobile-expo/package.json)、[`package-lock.json`](../package-lock.json)、[`app.json`](../apps/mobile-expo/app.json)、[`eas.json`](../apps/mobile-expo/eas.json)。这里不复制凭据、私钥、联系人信息或商店账号身份数据。

现有 `App.tsx` 的 `Shell` 通过顶层异步 `readSave` / `writeSave` 等 prop 向 `BlessingDom.tsx` 传递原生能力。普通个人存档保存在 `AsyncStorage` 的 `cyber-bless:personal:v1` 下；`BlessingDom` 将这些回调组成共享 App 的 host。购买权益应有独立的原生 owner，不能混进这个普通存档或 DOM `localStorage` 的可写布尔值。本地依据：[`App.tsx`](../apps/mobile-expo/App.tsx)、[`BlessingDom.tsx`](../apps/mobile-expo/BlessingDom.tsx)。

## 2. SDK 对比与发行包核验

2026-10-13 直接查询 npm registry，得到：

| 维度 | expo-iap 6.0.1 | react-native-iap 17.0.1 |
| --- | --- | --- |
| 当前官方定位 | Expo Modules；适用于 Expo managed / CNG | Nitro Modules；bare React Native CLI |
| 本项目 Expo 支持 | 官方明确 SDK 57 / RN 0.86 为 validated baseline | 官方明确自 v15.0.0 起结束 Expo 支持 |
| peerDependencies | `expo: *`、`react: *`、`react-native: *` | `react: *`、`react-native: *`、Nitro `>=0.36.5` |
| 可选 Amazon peers | 两个 Amazon 包是 optional；本产品 iOS / Play 不需安装 | 同左 |
| Config plugin | npm 包含 `app.plugin.js`、`plugin/build/withIAP.js` | 当前不是 Expo 集成路径；不要依赖旧版 Expo plugin 文档 |
| 与本项目接近的开发依赖 | Expo `^57.0.12`、RN `0.86.2`、React `19.2.3` | 即使包含 Expo 开发工具，也不代表 Expo consumer 支持 |
| 选择 | **首选，锁 6.0.1** | 当前不选；不为绕过支持边界引入 Nitro 或任意退回旧版 |

依据：[Expo 官方 IAP 指南][expo-guide]、[Expo setup][expo-setup-source]、[RN setup 源码][rn-setup-source]、[expo-iap npm][expo-npm] / [发行元数据][expo-registry]、[react-native-iap npm][rn-npm] / [发行元数据][rn-registry]。旧 `hyochan/expo-iap` 仓库已迁移；不要沿用旧 FAQ 中“另一库即将弃用”等表述作为当前结论。

本次同时从 npm 官方 tarball 内存解包核查 `expo-iap-6.0.1.tgz`，未写入依赖或临时安装目录：

- `openiap-versions.json` 实际内容：`apple: 4.0.1`、`google: 4.0.1`、`clientProtocol: 1.0.1`。
- 必需文件存在：`app.plugin.js`、`plugin/build/withIAP.js`、`ios/ExpoIap.podspec`、`android/build.gradle`、`android/openiap-android-sdk.gradle`、`android/openiap-store.gradle`。
- `expo-module.config.json` 注册 iOS `ExpoIapModule` / app-delegate subscriber 与 Android `expo.modules.iap.ExpoIapModule`。
- 对照源码使用 npm `gitHead`：`16717c677d89efc90e35c7f7229b331e162c564d`。RN 17.0.1 npm `gitHead` 为 `ca01c821955db1d1c4d4656b65cb2de93b60ee1f`。

来源：[expo-iap 官方 tarball][expo-tarball]、[发行版本文件][versions-source]、[原生模块配置][module-config-source]。源码分析不是已发布原生二进制的逐字节审计。

### 原生构建条件

在 `expo.plugins` 添加 `"expo-iap"`；必须重新构建 native binary，EAS Update / Metro 重启不会把未安装的 IAP 模块补进旧客户端。当前 `mobile:start` 默认 `--go`，购买测试应使用已有 `mobile:dev-client` 和 development build。Expo Go 不含所需自定义原生 IAP 能力。[Expo IAP 指南][expo-guide]

该版本 plugin 为 Android 添加 `com.android.vending.BILLING`，整理 Gradle / store 配置；OpenIAP dependency 由 expo-iap Android module 持有。iOS Podspec 依赖 `ExpoModulesCore` 与 `openiap`；plugin 确保 CocoaPods CDN 等配置。不要另加旧版 SDK 的 Gradle / Pod 手工注入，也不要开启可选 IAPKit、Onside、Amazon、Horizon 等功能。[plugin 源码][plugin-source]、[Android Gradle][expo-gradle-source]、[iOS Podspec][expo-podspec-source]

官方 SDK 57 基线：iOS 16.4+，Android Expo 基线 API 24+（IAP native module 自身 minSdk 23、compileSdk 36）。OpenIAP Google 4.0.1 使用 Google Play Billing 9.1.0。保留 Expo / RN 对应的 Kotlin **2.1.20** 工具链，不复制 standalone OpenIAP 的 Kotlin 2.4.x 发布编译器；当前默认工具链应优先复用，只有实际生成配置不符时才加入 `expo-build-properties`。[Expo setup 源码][expo-setup-source]、[Google native Gradle][google-gradle-source]、[生成版本元数据][metadata-source]

Android Play release 可通过 EAS profile 的 `ORG_GRADLE_PROJECT_openiapStore=play` 明确 store，避免多商店自动探测误选；这是本产品的部署建议，不改变商品或价格。[store 选择源码][plugin-source]

## 3. expo-iap 6.0.1 的确切 API

这里记录 root API 的发行类型。不要把旧 `getProducts` / `requestIAP`、旧 `request.ios/android` 形状混入新代码。

| API / 字段 | 6.0.1 类型与实施要点 |
| --- | --- |
| `initConnection(config?)` | `Promise<boolean>`；`true` 才连接就绪。先注册监听，再发购买请求；连接由 App 原生单一 owner 管理 |
| `endConnection()` | `Promise<boolean>`；owner 真正退出时清理，不能随付费页打开关闭频繁断连接 |
| `fetchProducts({skus, type:'in-app'})` | `Promise<ProductOrSubscription[] \| Product[] \| ProductSubscription[] \| null>`；查到配置的精确 SKU、类型和有效商品才启用购买 |
| `Product` | `id:string`、`displayPrice:string`、`currency:string`、`type:'in-app' \| 'subs'`；`price?:number \| null` |
| `requestPurchase(...)` | root 返回 `Promise<Purchase \| Purchase[] \| null>`。形状是 `{request:{apple:{sku},google:{skus:[sku]}},type:'in-app'}`。请求返回与 purchase-updated 事件可能交付同一笔，必须共用幂等处理 |
| `getAvailablePurchases(options?)` | `Promise<Purchase[]>`；显式用 `onlyIncludeActiveItemsIOS:true`、`alsoPublishToEventListenerIOS:false`。Expo wrapper 默认 active 为 true，而底层 Apple native 方法自己的默认值为 false，显式传参避免歧义 |
| `restorePurchases()` | `Promise<void>`；内部 sync / 查询不等于返回权益列表，完成后仍由 owner 调 `getAvailablePurchases` 更新状态 |
| `finishTransaction({purchase,isConsumable:false})` | `Promise<void>`；iOS finish 交易，Android wrapper 调 acknowledge；不要 consume 永久买断 |
| `acknowledgePurchaseAndroid(token)` | 参数是 `string`，返回 `Promise<boolean>`；必须检查 `true` 或重查已确认状态 |
| `Purchase.purchaseState` | **`'pending' \| 'purchased' \| 'unknown'`**，不是数字 |
| `Purchase.purchaseToken` | `string \| null \| undefined`；Android 是 purchaseToken，iOS 是 JWS。不要把二者当同一格式 |
| Android 校验材料 | `dataAndroid?:string \| null` = 原始 JSON；`signatureAndroid?:string \| null` = 原始签名；`packageNameAndroid?:string \| null`；`isAcknowledgedAndroid?:boolean \| null` |
| 交易身份 | Android 使用签名材料里的 purchaseToken 去重；iOS 使用 transactionId；Android `orderId` 可缺失，不可作为唯一键 |

依据：[发行类型][expo-types]、[root API 源码][expo-index]、[Android API wrapper][expo-android-api]、[Google Purchase → OpenIAP 映射][google-converters]、[Google token / orderId 建议][google-security]。

**确认购买的实现陷阱：** 6.0.1 `finishTransaction` Android 分支 `await ExpoIapModule.acknowledgePurchaseAndroid(token)` 后没有检查布尔值；native acknowledgement 失败会返回 `false`。因此该 Promise fulfilled 不能独立证明确认完成。直接调用 exported `acknowledgePurchaseAndroid` 检查布尔值并再次查询，或 finish 后查询 `isAcknowledgedAndroid===true`；失败保留 retry 状态。Google 要求在授予权益后及时 acknowledge；正式购买三天未确认会自动退款，测试买断通常三分钟。[root 源码][expo-index]、[Android wrapper][expo-android-api]、[Google native acknowledgement][google-module]、[正式确认要求][google-integrate]、[测试确认要求][google-test]

`useIAP` 可管理连接、监听与 normalized errors，也可采用 root API 的原生 controller。该版本 hook 对返回值与 listener 做 **30 秒交付去重**，iOS listener 默认另有 session 内 transaction 去重；这不能代替本产品持久化幂等性。`onPurchaseSuccess` 名称不构成已付款证明，hook 调用该回调处没有把 pending 排除。每条输入仍须验证 `purchaseState==='purchased'`。[hook 源码][expo-hook]、[listener 源码][expo-index]

## 4. iOS：已验证当前权益、恢复与离线

StoreKit 2 将 App Store 签名的交易包装为 `VerificationResult`；只有 `.verified` 才是验证通过。本版本 OpenIAP Apple 在成功购买、交易监听和 available purchases 路径使用 `checkVerified`，`.unverified` 抛出 transaction validation failed。因此应通过原生 store API 查询本次配置商品的已验证当前权益，再映射为共享 UI 的权限状态。[Apple 验证结果][apple-verification]、[OpenIAP Apple 源码][apple-native-source]

启动、回到前台、完成购买、用户恢复购买后，用 `getAvailablePurchases({onlyIncludeActiveItemsIOS:true,alsoPublishToEventListenerIOS:false})` 重建权益。它对应 `Transaction.currentEntitlements`，包含非消耗型购买，排除 Apple 已退款 / 撤销的产品。不要使用包含全部历史交易的列表来永久解锁。[Apple 当前权益][apple-current]、[Expo 查询源码][expo-index]

`isTransactionVerifiedIOS(sku)` 验证的是 `Product.latestTransaction` 的签名；**签名正确不代表该 SKU 当前仍有权益**，不能单独用它授予买断。其实现还需要获取 Product；离线路径应优先使用 current-entitlements 查询，而不是强制依赖商品价格查询成功。[OpenIAP Apple 实现][apple-native-source]

显式“恢复购买”按钮调用 `restorePurchases`，最终触发 `AppStore.sync()`，然后重查当前权益。Apple 要求 sync 只响应用户主动操作，因为它可能弹出商店认证；不要每次启动都 sync。StoreKit 自动维护交易信息，重装 / 新设备在正常条件下可获取已有交易；这不意味着首次离线安装能完成远端商店账号验证。[Apple sync][apple-sync]

离线策略建议：价格查询失败不清除已验证权益；StoreKit 当前权益仍可提供已有交易时按 verified 结果解锁。商店查询失败应区分“未知 / 暂不可验证”和成功返回的“当前没有权益”。已有原生验证材料可以作离线缓存，但不能因为 DOM 或普通存档带了 `unlocked:true` 而授予权益。任何断网客户端都不能即时获知远端新发生的退款；恢复联网后重新协调是必要边界。

## 5. Android：原生 RSA 验签的可行范围

### 原始材料、算法、公钥

当前 Google Billing `Purchase` API 明确 `getOriginalJson()` 返回购买原始 JSON、`getSignature()` 返回其签名，scheme 为 **RSASSA-PKCS1-v1_5**。OpenIAP 将两者原样映射到 `dataAndroid` / `signatureAndroid`。[当前 Google Purchase API][google-purchase]、[映射源码][google-converters]

找到并内存读取了 **Google 官方 SDK 样例归档** `play_billing_r05.zip`，其中 `play_billing/samples/TrivialDrive/src/com/example/android/trivialdrivesample/util/Security.java` 明确：

- `KeyFactory` 算法 `RSA`；`Signature` 算法 **`SHA1withRSA`**。
- Base64 解码应用公钥，使用 `X509EncodedKeySpec`。
- 对 `signedData.getBytes()` 原文验签，Base64 解码签名后调用 `Signature.verify`。
- 归档 SHA-256：`381f66d796a7f396f1d9bc2a0ed4599414aab07ec16f0e7390dc4e4e2a3d2ec3`。

这是 Google 自有历史 Android 样例，不是博客转述；当前 Google Native PC 文档也明确 SHA1withRSA，但 PC 页面不是 Android SDK 兼容性保证。当前 Android Purchase 文档公开保证 scheme，未同样列出 digest。**建议 Android 模块按 SHA1withRSA 实现，且必须用本 App 的 Billing 9.1.0 真实沙盒原始 JSON / signature 完成正向与篡改负向验证才验收。** 不可通过对多个算法“任意一个过了就解锁”来模糊协议。[Google 官方样例归档][google-legacy-sample]、[当前 Google PC 文档][google-pc]

Google 自有 AOSP Android billing 文档明确：Google Play 为每个应用生成 RSA 密钥对；用于 purchase 验证的公钥是 Play Console 中该应用的 **Licensing public key**，Base64 编码的 **X.509 SubjectPublicKeyInfo DER**，与该应用 licensing 使用同一公钥。它不是 APK upload key、公钥证书指纹、开发者账号通用 key，也不需要开发者把私钥发给 App。旧文档导航名称已过时，当前 Console 需以实际应用的 monetization/licensing 设置查取。[Google 自有 Android billing 文档][google-historical-integrate]

实现建议：在现有 `apps/mobile-expo/modules` 约定下增加小型 Expo local native module；使用 Java `KeyFactory`、`X509EncodedKeySpec`、`Signature.getInstance("SHA1withRSA")`，对**未经 parse/re-stringify、格式化、字段排序或空白修改的原始字符串 UTF-8 字节**验签。公钥来自本应用商店记录，由 build configuration 进入原生模块；缺失、格式错误、算法错误、验签失败一律不能授予付费权益。不要允许 DOM 参数决定公钥、预期包名或“verified=true”。

### JSON 状态不等于 BillingClient enum

Google 历史 Android 原始 JSON 文档中 `purchaseState` 为 `0=purchased`、`1=canceled`、`2=refunded`。现代 BillingClient 公共 enum 则是 `PURCHASED=1`、`PENDING=2`；Expo 进一步映射为字符串。三者不能互换。[Google 自有原始 JSON 文档][google-historical-reference]、[当前 Purchase API][google-purchase]、[Expo 映射][google-converters]

本次内存读取 Google Maven 官方 `billing-9.1.0.aar` 的 `Purchase.class`，确认 `getPurchaseState()` 从原始 JSON `optInt("purchaseState",1)` 读取：raw `4` 返回 public PENDING `2`，其他值返回 public PURCHASED `1`；缺失字段也会被该便利方法判作 purchased。`getPurchaseToken()` 优先读取 `token`、fallback `purchaseToken`；产品列表使用 `productIds`，兼容 `productId`。这是该精确发行 artifact 的字节码观察，不是所有未来版本的 schema 保证。[Google 官方 Billing 9.1.0 artifact][google-billing-artifact]

本产品的本地授权需 **fail closed**，至少要求：

1. 原始 JSON 与签名都非空；配置的本 App RSA 公钥验证通过。
2. 验签后解析对象，`packageName` 与原生 build 的应用包名完全相符。
3. 签名 JSON 明确包含整数 `purchaseState===0`；缺失、`4`、canceled/refunded 或未知值均不授予权益。另核此次 Expo event / store query 的 normalized state 为 `'purchased'`。
4. `productId` 或 `productIds` 明确包含配置的永久买断 SKU；本产品只有单 SKU，拒绝歧义 / 不符合预期的多商品材料。
5. 取签名 JSON 的 `token` / `purchaseToken`，要求非空且与事件 token 一致；两者同时存在但不同则拒绝。签名原文提取的包名、商品、token 才是验证输入，不能相信旁边可改的 JS 字段。
6. 固定永久买断 entitlement；外部传入的 arbitrary SKU 不自动获得全内容权限。

这组严格 schema 要求是本产品验证策略，须通过实际 sandbox fixture 证明匹配当前 merchant 输出；如果实际材料格式不同，应更新并核验 schema，不能在 production 分支静默放宽。签名材料不必含 `orderId` 才算有效，Google 不保证所有购买都有 orderId。[Google 去重指南][google-security]

### 成功、pending、acknowledge、恢复

只在 `PURCHASED` / normalized `'purchased'` 且验证材料通过时持久化权益证据并授予访问，再及时 acknowledge。`PENDING` 仅显示等待完成支付，不授予权益，也不 acknowledge；三天期限从 pending 转为 purchased 后开始。App 启动 / 回前台重查 available purchases，以接收 App 关闭时完成的延迟付款。[Google pending 流程][google-integrate]

校验后保存**原文 + 签名 + 商品 / token 身份 + 确认重试状态**的原生快照；每次离线加载仍重新验签和核固定配置，不直接使用快照里的 `unlocked` 标记。个人存档清除不应伪造或丢弃购买记录；重装 / 换机应通过同一 Google Play 账号重查非消耗型购买，不能 consume 买断 token。恢复查询成功且无合法买断时撤销缓存权益；查询网络失败保留已通过验证的离线快照并标记待核验。项目可以对原生快照使用设备 key 的 MAC / 安全存储减少普通修改与跨设备复制，但这不是抗 root / patch 保证。

### 哪些仍需要服务端

`expo-iap` 的 Android `verifyPurchase` **不是**“自动本地签名验证”：OpenIAP 代码要求 `packageName`、`purchaseToken`、`accessToken`，然后调用 AndroidPublisher API。不得把 service account 私钥、私有 OAuth access token 或刷新凭据嵌入客户端。`verifyPurchaseWithProvider` 的 IAPKit 也是第三方服务，不是当前无第三方方案的默认动作。[Google verification 源码][google-verification-source]、[Expo root API][expo-index]

需要实时退款 / 撤销查询、可靠的跨设备 token 去重与账号归属、App 不再启动时仍完成确认、跨平台共享权益或受控远端付费资源发放时，必须增加受控后端或明确选择托管购买服务。Google 推荐将 token 验证与 acknowledgement 放在 secure backend，调用 Play Developer API，并使用 RTDN / Voided Purchases 等机制协调退款。本地签名只能证明一段历史购买材料未被改写，不能证明购买**现在**未退款、材料未被另一台设备复用、运行中的客户端代码未被绕过。[Google 安全指南][google-security]

## 6. DOM UI 与原生权益 owner

复用 `packages/app` 的价格展示、免费体验入口、付费说明与恢复购买按钮；原生 `Shell` 或独立 controller 持有 IAP connection、listener、验证、ack / finish retry 和权益证据。DOM 只接受可序列化的权益投影及请求原生动作。[Expo DOM 官方桥接规则][expo-dom]

建议桥契约（仅示意，非本次实现）：

```ts
type PurchaseAccess = {
  status: 'checking' | 'free' | 'pending' | 'owned' | 'unavailable';
  canAccessPaidContent: boolean;
  displayPrice?: string;
  busy: boolean;
  message?: string;
  revision: number;
};

// 传给 BlessingDom 的顶层 prop；返回值 / 参数均可序列化。
readPurchaseAccess(): Promise<PurchaseAccess>;
purchaseLifetime(): Promise<PurchaseAccess>;
restoreLifetime(): Promise<PurchaseAccess>;
```

原生 owner 同时可通过普通 serializable `purchaseAccess` prop 投影状态；revision 处理异步桥旧响应覆盖新事件的问题。Expo 不允许将原生回调作为 nested props 传入 DOM；不能传 `purchaseHost={{purchase(){...}}}` 越过边界，应像现有 `readSave` 一样用顶层 async prop，在 `BlessingDom` 内组成共享 UI 所需对象。DOM 重建 / generation 重置不能重新创建多个 Billing owner。[Expo DOM 规则][expo-dom]

进程内按 Android token / iOS transactionId single-flight，并持久化已处理身份与待完成 transaction 状态。不能先写“已处理”后永远跳过 unfinished / unacknowledged 交易；完成失败在重连 / 启动 / 前台重试。用户取消回到免费 / 原有 owned 状态；`ErrorCode.UserCancelled` 不当作系统故障。already-owned 触发商店重查 / 恢复，不启动第二次收费；商品未就绪、网络失败、native module 缺失展示不可购买并保留免费体验。共享 UI 不接收任意 token 或“授予权益”动作。[API listener / error 源码][expo-index]、[hook 源码][expo-hook]

已有资源可按产品确定的买断范围离线保留。付费访问规则不删除用户个人记录，也不能让修改个人 save 获得权限。纯客户端资源包仍可被提取，这是离线内容本身的保护边界；远端资源真正受权限保护需要服务端按已验证权益授权。[Google 付费内容保护建议][google-security]

## 7. RevenueCat 的影响

Expo 官方同时列出 `react-native-purchases` / RevenueCat，它可以托管购买验证、产品管理与权益服务。但 RevenueCat 官方隐私指南明确其收集 purchase history，App Privacy 中需要申报 Purchases，最低用途包含 Analytics 与 App Functionality；使用匿名 ID 不意味着没有第三方购买数据。自定义用户 ID / 联系属性又增加关联身份影响。[Expo 指南][expo-guide]、[RevenueCat 官方隐私指南][revenuecat-privacy]

本项目当前无账号、无后端、无广告 / analytics，因此 **不默认引入 RevenueCat / IAPKit**。若产品后来要求后端级实时退款或跨平台权益且希望用托管服务，应先明确选择服务与隐私声明变化；无账号要求本身不阻止增加匿名 purchase-token verification 后端，但它仍是新增远端数据处理。

## 8. 依赖建议与可执行验证

本次仅执行了锁文件解析、官方 registry 查询、源码读取和发行归档内存检查；未运行 App 测试、native build 或真实购买。以下是实施后需执行的命令，**不是已经通过的结果**。

在仓库根目录安装到正确 workspace，精确锁定版本：

```powershell
npm view expo-iap@6.0.1 version peerDependencies peerDependenciesMeta repository gitHead dist.tarball --json
npm install -w @wbr/mobile --save-exact expo-iap@6.0.1
npm exec -w @wbr/mobile -- expo install --check
npm ls -w @wbr/mobile expo expo-iap react react-native expo-modules-core
npm run mobile:verify
npm run build
```

官方基础安装入口是 `npx expo install expo-iap`；这里用 npm workspaces 的 `--save-exact` 固定已经核实的第三方版本，再让 Expo 检查已有框架依赖。不要执行 `expo install --fix` 来无差别变更整体框架。按实际实现添加 controller / schema / 验签负向 / UI gating 测试到适当 workspace；静态类型和 Expo `--check` 不能替代原生 IAP 验收。[官方安装][expo-setup-source]

配置 plugin 与公钥后进行一次 CNG / 原生配置检查和两个平台 development build。沿用仓库受保护的 EAS wrapper：

```powershell
node scripts/run-mobile-eas.mjs build -p android --profile development
node scripts/run-mobile-eas.mjs build -p ios --profile development
npm run mobile:dev-client
```

构建命令会创建远端 build；本文没有执行，也不包含 submit / auto-submit。如果需要本地查看生成的 manifest / Gradle / Podspec，可在隔离 worktree 执行 `npm exec -w @wbr/mobile -- expo prebuild --platform android --no-install`，检查 BILLING permission、Play store 选择、Billing 9.1.0 resolution 和本地模块 autolinking；不要用 `--clean` 删除已有原生目录。

### 真实测试入口

**iOS：** 先可在 macOS Xcode 的 StoreKit configuration 做本地状态与失败模拟；本产品 merchant 接入验收必须再用 App Store Connect 产品与 development-signed device / TestFlight sandbox。Apple 沙盒不收取真实款项；需实际配置产品、协议 / 税务 / 银行信息、正确 bundle ID，并给审核员可复现的体验和购买步骤。[Apple StoreKit testing][apple-iap-testing]、[Apple Sandbox][apple-sandbox]

**Android：** 使用 Google Play app record、已启用的一次性产品、license tester Google account 与 Play Store。官方允许 license tester sideload 对应 package 的 debug build；并非每次都必须上传新版本，但首发仍需对 store-installed internal track artifact 验收。内部测试轨道的普通非 license tester 可能发生真实收费，不可笼统称“测试都免费”。[Google 测试指南][google-test]

### 必测场景和验收条件

| 场景 | 必须观察到的结果 |
| --- | --- |
| 合法买断 | 商品 localized price → 系统购买 → verified / RSA 有效 → 单次权益授予 → finish / ack 成功 |
| 用户取消、支付失败 | 不新增权益；保留原有 owned / 免费状态；允许重试 |
| Pending 成功 / 取消 | pending 不解锁、不 ack；App 退出后付款完成，重开能重查并处理；取消始终不授予 |
| 重复回调、请求返回与事件同时到达 | 一次幂等处理；不重复收费提示、不并发重复完成 |
| 在授予后 / finish 前杀进程 | 重开从商店和验证证据恢复，并完成未结束交易 |
| ack 返回 false / 网络断开 | 不宣称确认成功，保留待确认状态并重试；检查 Google 订单没有自动退款 |
| 个人存档修改、`unlocked:true`、清档 | 都不能制造合法权益；清个人数据与购买状态区分 |
| 修改签名 JSON、签名、包名、SKU、token，缺字段，公钥错误 / 空 | Android 原生验证 fail closed；包括 raw state=1/2/4/未知，禁止任意字段缺失 fallback 到 purchased |
| 同商店恢复、重装 / 换机 | 合法非消耗型可恢复；不要求 App 自有账号；不承诺两家商店互通 |
| 已购买后完全离线、商品查询失败 | 验证通过的权益及资源继续使用；不能把一次网络失败当退款 |
| 成功商店重查无权益、退款 / 撤销 | 更新权限；保留个人数据；离线期间无法即时感知退款的限制有明确记录 |
| Expo Go / 无模块 / 未配置商品与公钥 | 免费 UI 可运行；付费能力明确 unavailable，绝无 mock owned 自动回退 |

上线前的 Android 验收材料必须包含**本应用真实 Licensing 公钥对应的 sandbox 正确签名样本**与负向结果；开发者自行生成的测试 key / signature 只证明验签函数逻辑，不能证明 Play merchant 接入已完成。

## 9. 当前仍待解决

- 产品：免费体验范围 / 门槛、买断覆盖内容和资源保留规则、地区价格、两个商店最终商品 ID。
- Google：开发者 / 应用记录、真实应用 Licensing public key、产品与 testers 就绪后完成真实签名和 PURCHASED / PENDING / acknowledgement 验收。
- Apple：非消耗型产品、sandbox / TestFlight 与正式审核元数据。
- 工程：实际 native build 与 store integration；本研究没有把它们记为通过。
- 若需要超出本地历史签名材料的安全边界：决定自建 verification backend 或明确选择托管服务，并相应更新隐私 / 数据说明。

[expo-guide]: https://docs.expo.dev/guides/in-app-purchases/
[expo-dom]: https://docs.expo.dev/guides/dom-components/
[expo-npm]: https://www.npmjs.com/package/expo-iap/v/6.0.1
[rn-npm]: https://www.npmjs.com/package/react-native-iap/v/17.0.1
[expo-registry]: https://registry.npmjs.org/expo-iap/6.0.1
[rn-registry]: https://registry.npmjs.org/react-native-iap/17.0.1
[expo-tarball]: https://registry.npmjs.org/expo-iap/-/expo-iap-6.0.1.tgz
[expo-setup-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/docs/src/pages/docs/setup/expo.tsx
[rn-setup-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/docs/src/pages/docs/setup/react-native.tsx
[expo-types]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/src/types.ts
[expo-index]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/src/index.ts
[expo-hook]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/src/useIAP.ts
[expo-android-api]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/src/modules/android.ts
[plugin-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/plugin/src/withIAP.ts
[expo-gradle-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/android/build.gradle
[expo-podspec-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/ios/ExpoIap.podspec
[versions-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/openiap-versions.json
[module-config-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/libraries/expo-iap/expo-module.config.json
[metadata-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/docs/src/generated/version-metadata.json
[apple-product-types]: https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types/
[apple-current]: https://developer.apple.com/documentation/storekit/transaction/currententitlements
[apple-verification]: https://developer.apple.com/documentation/storekit/verificationresult
[apple-sync]: https://developer.apple.com/documentation/storekit/appstore/sync()
[apple-native-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/apple/Sources/OpenIapStoreKitModule.swift
[apple-iap-testing]: https://developer.apple.com/documentation/storekit/in-app-purchase
[apple-sandbox]: https://developer.apple.com/documentation/storekit/testing-in-app-purchases-with-sandbox
[google-one-time]: https://developer.android.com/google/play/billing/one-time-products
[google-security]: https://developer.android.com/google/play/billing/security
[google-integrate]: https://developer.android.com/google/play/billing/integrate
[google-test]: https://developer.android.com/google/play/billing/test
[google-purchase]: https://developer.android.com/reference/com/android/billingclient/api/Purchase
[google-gradle-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/google/openiap/build.gradle.kts
[google-converters]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/google/openiap/src/play/java/dev/hyo/openiap/utils/BillingConverters.kt
[google-module]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/google/openiap/src/play/java/dev/hyo/openiap/OpenIapModule.kt
[google-verification-source]: https://github.com/hyodotdev/openiap/blob/16717c677d89efc90e35c7f7229b331e162c564d/packages/google/openiap/src/main/java/dev/hyo/openiap/utils/PurchaseVerificationValidator.kt
[google-legacy-sample]: https://dl.google.com/android/repository/play_billing_r05.zip
[google-pc]: https://developer.android.com/games/playgames/native-pc/billing
[google-historical-integrate]: https://android.googlesource.com/platform/frameworks/base/+/android-5.1.1_r1/docs/html/google/play/billing/billing_integrate.jd
[google-historical-reference]: https://android.googlesource.com/platform/frameworks/base/+/android-5.1.1_r1/docs/html/google/play/billing/billing_reference.jd
[google-billing-artifact]: https://dl.google.com/dl/android/maven2/com/android/billingclient/billing/9.1.0/billing-9.1.0.aar
[revenuecat-privacy]: https://www.revenuecat.com/docs/platform-resources/apple-platform-resources/apple-app-privacy
