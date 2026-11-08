# 内测 Expo 更新服务

本模块由现有反馈服务挂载。仅用于本人和内测人员；正式安装包、发布 tag、原生构建号与文化审阅继续使用原有流程。首次必须安装带有 `expo-updates`、正确 runtime 和公钥证书的新原生包。

## 准备、导入与发布

先通过项目的密钥配置工具准备外部 RSA 私钥及随包公钥证书。私钥必须位于所有 Git 工作树之外，模块不会自动生成密钥。默认位置为系统配置目录下 `CyberBless/internal-updates/private-key.pem`，公钥证书为 `apps/mobile-expo/certs/internal-updates.pem`。

准备工作需要已经审阅和提交、没有已修改或未跟踪文件的 Git 工作树。`prepare` 会自行执行已提交的固定 i18n 编译和资产准备脚本，重新生成被 Git 忽略的 public 文件与注册别名；干净检出无需预先生成这些目录。如果生成流程改变了已跟踪文件，需先审阅并提交生成结果，再重试：

```powershell
node scripts/internal-updates/cli.mjs prepare --platform ios --out artifacts/internal-updates-packages/ios-candidate --message "本次更新说明"
node scripts/internal-updates/cli.mjs import --package artifacts/internal-updates-packages/ios-candidate
node scripts/internal-updates/cli.mjs list
node scripts/internal-updates/cli.mjs publish --release <已导入的版本 UUID>
```

Android 独立执行 `prepare --platform android`。平台的 fingerprint runtime 可能不同，所以每个平台分别准备和发布；服务按实际 platform/runtime 选择。`--runtime` 是对解析结果的额外断言，不能把任意字符串写成原生 runtime。

`prepare` 先运行已提交的 `scripts/i18n-compile.mjs` 和 `scripts/prepare-app-assets.mjs`，再直接运行项目安装的 Expo 导出工具及 `expo-updates runtimeversion:resolve`，在同一次准备操作前后核对实际 commit、tree、干净状态和 runtime。注册表和生成清单必须与已跟踪的 assets 来源、实际 require 目标的字节数及哈希一致；导出后重复检查，并验证每项注册资产确实以相同字节进入 Metro metadata。忽略目录中的陈旧或篡改别名会先重建；导出过程中源码、runtime 或生成输入变化，或 Metro 导出了不同资产字节时拒绝签名。默认设置 `EXPO_INTERNAL_UPDATES=1`、生产环境和 `EXPO_NO_DOTENV=1`；原生内测开关仍由项目 app config 决定。此命令不会自动提交、创建 tag、执行任意命令字符串或上传原生构建。

已准备目录包含签名的 `release.json`、`release.sig` 和白名单 `files/`。`metadata.json` 的原始结构规范化后保存在签名记录中；只复制其中声明的 launch bundle 与注册资产，包含 SDK 57 的 DOM HTML/JS/CSS。工作区、反馈、source map、公有目录中未注册的文件及凭据不进入更新包。公有 Expo 配置只保留少量公开标识字段，丢弃 `extra` 和请求头。缺文件、LFS 指针、软链接、非法路径、大小/哈希错误以及外部静态 DOM 依赖均会拒绝。

`import` 验证当前信任证书、包签名、来源记录、文件清单、字节数及 SHA-256。只有全部验证完成才显示为可发布候选。离线传输整个已准备目录后可在服务主机上导入。重复导入相同签名版本是幂等的；不可覆盖已有 UUID 的内容。

```powershell
node scripts/internal-updates/cli.mjs rollback --release <旧版本 UUID>
node scripts/internal-updates/cli.mjs rollback --embedded --platform ios --runtime <原生实际 runtime>
```

回退旧内容会重新签发新的更新 UUID 和晚于所有既有发布的时间；不会把旧日期重新指向当前通道。回到嵌入版使用签名的 `rollBackToEmbedded` 指令，客户端需要接受 `multipart/mixed`。当前指针一次原子切换，旧发布及其资产保留，已开始的下载可继续完成。不要删除仍可能被客户端请求的已发布资产。

## 配置

CLI 选项与对应环境变量：

| 选项 | 环境变量 | 默认值 |
| --- | --- | --- |
| `--store` | `INTERNAL_UPDATES_STORAGE` | `artifacts/internal-updates` |
| `--public-url` | `INTERNAL_UPDATES_PUBLIC_BASE_URL` | `https://feedback.heliosoft.win` |
| `--private-key` | `INTERNAL_UPDATES_PRIVATE_KEY` | 上述 Git 外部配置目录 |
| `--certificate` | `INTERNAL_UPDATES_CERTIFICATE` | `apps/mobile-expo/certs/internal-updates.pem` |

`--repo` 与 `--project` 可选择本机的干净 Git 根目录及其中的 Expo 工程。HTTP 管理接口没有路径、上传或命令参数。签名算法固定为 RSA PKCS#1 v1.5 SHA-256，key ID 为 `main`，唯一通道为 `internal`。客户端嵌入的公钥证书必须与服务匹配；换根证书需要新原生包。缺少签名配置时可启动原有反馈接收服务、列出空更新状态，但不能准备或发布更新。

存储目录只包含内容寻址 blobs、签名候选、签名发布、`channel.json` 和短期 `publish.lock`。管理写操作使用跨进程独占锁；进程崩溃留下锁时，确认锁内 PID 和主机已经停止后才清理。不要在运行中删除锁。发布状态失败不沿用未完成的产物；历史发布文件只有进入原子通道记录后才可对外读取。

## 宿主接口

```js
import { createInternalUpdateService } from './scripts/internal-updates/service.mjs';

const updates = createInternalUpdateService({
  storageDir, publicBaseUrl, privateKeyPath, certificatePath,
  keyId: 'main', channel: 'internal',
});

// 公网接收端：authorized 由现有邀请码校验给出。
if (await updates.handlePublic(req, res, { authorized })) return;
// 仅本机管理端：宿主必须先完成 Host、Origin、同源与监听地址检查。
if (await updates.handleAdmin(req, res)) return;
```

两个路由方法返回是否匹配路由，匹配时自行完成响应和错误转换。宿主不得将管理端转发到公网。

| 路由 | 行为 |
| --- | --- |
| 公网 `GET /api/internal-updates/check` | 邀请码鉴权；要求 Expo v1、platform、runtime；返回签名清单、multipart 指令或 204 |
| 公网 `GET /api/internal-updates/assets/<SHA-256 hex>` | 只读取已经发布历史中的签名哈希白名单，不接受原始文件路径 |
| 本机 `GET /api/internal-updates` | 返回签名配置状态、已验证候选、当前各 platform/runtime 指针及损坏记录 ID |
| 本机 `POST /api/internal-updates/publish` | JSON `{releaseId, platform?, runtimeVersion?}` |
| 本机 `POST /api/internal-updates/rollback` | 相同旧版本选择，或 `{embedded:true, platform, runtimeVersion}` |

资产 URL 无需重复邀请码，依赖不可变哈希白名单；代码资产不是保密边界。公网邀请码只允许检查兼容更新，不具备导入或发布权限。服务不将邀请码写入清单、客户端配置或存储。

本机 JS API 另提供 `list()`、`importRelease(packageDir)`、`publish(selection)`、`rollback(selection)`。`publish`/`rollback` 返回 `{publications:[...]}`；每条包含 `updateId`、`createdAt`、`platform`、`runtimeVersion`、`type` 和适用的 `releaseId`/来源。`list()` 返回 `{schemaVersion,channel,signingConfigured,releases,channels,invalidReleases}`。候选的来源为 `{commit,tree,dirty:false,method:'clean-git-metro-export'}`。

原生读取的已签名来源字段固定为 `manifest.extra.internalUpdates = {sourceCommit,sourceTree,message,releaseId}`，回退还含 `rollback` 与 `rollbackFromReleaseId`。`extra.expoClient` 只携带经过筛选的公开 Expo 标识。

`packageExpoExport()` 是 CLI 内部使用的受信本机封装函数；它接收已经由准备流程核对的 source，不能用手工填写的 commit/tree 为工作区旧导出补造来源身份。生产操作应使用 `prepare` 完成实际导出。

## 验证与依据

```powershell
node --test scripts/internal-updates/*.test.mjs
```

测试使用真实本机 HTTP、临时 RSA 证书和临时 Git 仓库，覆盖签名/哈希、鉴权、平台/runtime、不可变历史、错误产物拒绝、原子发布失败与两种回退。Windows 沙箱可能拒绝临时文件 rename 或本机监听；需在批准的普通本机环境执行完整测试，不能把沙箱限制当成协议通过。

协议依据：[Expo Updates v1 正文](https://docs.expo.dev/technical-specs/expo-updates-1/)、[官方自托管示例](https://github.com/expo/custom-expo-updates-server)。SDK 57 的具体文件结构核对了本机 `expo/node_modules/@expo/cli/build/src/export/createMetadataJson.js`、`exportDomComponents.js` 和 `expo/src/dom/base.ts`。这只能证明后端与导出协议；真机 A→B→回退→断网启动仍需新安装包后另行验证。
