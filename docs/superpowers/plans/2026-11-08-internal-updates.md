# Internal Scene Updates Implementation Plan

> **For agentic workers:** Use superpowers:subagent-driven-development for the independent backend and asset tasks, then integrate the native client inline. User approved implementation of the design in this chat.

**Goal:** 在现有反馈后台发布和回退兼容内测更新，让手机 App 下载 Three.js 代码及资源，减少原生重打包。

**Architecture:** `expo-updates` 负责原生校验、缓存和启动；现有 Node 服务提供协议和本机管理。public 资产通过 Metro 注册并映射本地 URI。共享 UI 只在内测入口显示更新控制。

**Tech Stack:** Expo SDK 57、expo-updates ~57.0.26、Node 24、TypeScript、React DOM/React Native、Vitest、node:test、Playwright。

**Spec:** `docs/superpowers/specs/2026-11-08-internal-updates-design.md`（已确认；设计复核无重大未决项）。

## Global Constraints

- 第一阶段仅本人/内测人员；正式随包发布保留；不创建或覆盖旧发布 tag。
- 不在源码/包/日志中放邀请码或私钥；本机管理端不暴露公网；包只含验证过的导出文件。
- 代码与资产共同冻结，平台/runtime 不兼容就拒绝更新；初次接入仍需新的原生安装包。
- 玩家存档、反馈队列、Widget 投影不能被资源清理或更新删除；仪式中不强制 reload。
- 纯分发/路径改造不增加文化主张；实际场景内容发布仍执行来源规范。

## Review Focus

- DOM 导出、字体、HDR、GLB、声音不得漏入更新包或继续误用旧 public 资源。
- 提交下载中断、错误签名、错误哈希、错平台/runtime 时旧版本继续可运行。
- 取消/后台/保存失败/仍有仪式时不得 reload；更新应用只操作兼容内测包。
- 回退旧内容必须以新的更新 ID/时间发布，避免数据库继续选择坏版。
- 公网提交邀请码无发布权限；管理员输入不能变成路径穿越或任意命令执行。

## Task 1: 签名更新包与协议（独立后台任务）

Files: 新建 `scripts/internal-updates/` 的发布存储、签名、Expo v1 协议、CLI 与测试；现有反馈服务的接入由 root 完成。

Interface: `createInternalUpdateService(options)` 提供 `handlePublic(req,res,{authorized})`、`handleAdmin(req,res)`（返回是否匹配路由）。本机 GET 列表，POST 选择已验证版本发布/回退；公网按平台/runtime 和邀请码读取清单，资产只读取清单内哈希白名单。具体类型作为模块导出并在任务报告中说明。

- [x] 先写失败测试：真实 HTTP、签名/哈希验证、不可变发布、错 runtime、鉴权、路径穿越、坏导出、原子回退与 source 身份。
- [x] 解析 Metro `metadata.json`，纳入 launch bundle、DOM HTML/JS/CSS 与注册资源；发布只从完整验证产物切换通道。
- [x] 生成/加载 Git 外签名私钥与随包公钥证书；拒绝未配置签名发布。实现新身份回退与嵌入回退指令。
- [x] CLI 准备导出/import/list/publish/rollback；导出来源记录真实 commit/tree，脏来源不得伪装为已提交源码。
- [x] 运行模块测试，记录接口供 root 集成，独立审阅。

## Task 2: 更新可携带的本地资产（独立资产任务）

Files: `scripts/prepare-app-assets.mjs`、`apps/mobile-expo/bundled-assets.ts` 及生成注册表、`packages/scene-runtime/src/asset-urls.ts`、实际资源读取点和相关测试。不改 `App.tsx`/`BlessingDom.tsx`（由 root 集成）。

Interfaces: 原生 `resolveBundledAssetUris(): Promise<Record<string,string>>`，允许路径到本机已下载文件 URI；DOM 调用 `installNativeAssetMap(map)` 后再挂载 App。资源读取统一调用共享解析器，网页仍使用原路径。iOS 声音只读允许的已注册文件。

- [x] 先写失败测试：注册表覆盖真实 assetFiles、更新 URI 优先、嵌入/网页回退、字体在映射安装后解析、无未知路径/不安全 URI、声音限制。
- [x] 保持源码资源与生成 public 流程；以静态 require 将更新资产纳入 Metro，适配必要扩展名。
- [x] 修正实际模型/HDR/树/字体/声音路径；复用各场景内容与来源，不修改器形动作。
- [x] 运行相关测试和类型检查；报告生成/接入步骤，独立审阅。

## Task 3: 手机更新控制与后台接入（root）

Files: mobile `internal-updates.ts`、app config、App/BlessingDom；runtime 可序列化更新桥与纯控制器；shared UI 内测面板及多语言；feedback server/dashboard/cli 接入；package scripts/lock。

- [x] 安装 SDK 匹配的 expo-updates；构建开关控制内测 URL、runtime 和签名证书；正式配置禁用内测。
- [x] 测试控制器 check/download/apply；复用已保存邀请码设请求头；应用前等待真实写入且锁定安全 UI，失败可重试。
- [x] 原生先准备 URI 映射，再挂载 DOM；内测面板显示当前/可用/已下载版本、说明、下载状态、回退与重载边界。
- [x] 反馈诊断增加可选真实更新身份，兼容旧记录和旧协议。
- [x] 在本机后台增加版本列表和发布/回退操作；复用原有同源/Host 管理保护与邀请码验证，保持接收服务可用。
- [x] 相关控制器、服务集成与 UI 测试先红后绿；八语言与说明同步。

## Task 4: 联调、来源记录与交付

- [ ] 生成证书并在 Git 外保管私钥；准备受审阅的测试发布候选，不混入反馈/凭据。
- [x] 双平台 Metro 导出，真实协议请求/签名/资产完整性验证；浏览器后台和内测面板验证。
- [x] 项目完整测试、构建、i18n、指纹和发布脚本相关检查；核对 Pod 锁及首次原生接入包需求。
- [x] 更新当前文档中的旧 DOM OTA 断言，保留正式随包策略与访问事实；完成独立整体验收。
- [ ] 代码和本机服务联调完成后，按已授权范围处理首次原生接入包；正式构建前必须先提交/合并/推送、分配真实编号、冻结新 tag。未实际真机验证不宣称手机已可用。

执行记录：主功能、独立审阅、13,369 项全量测试、构建、串行双平台嵌入导出、OTA 导出及浏览器验证通过。Pod 锁已在独立 Mac 依赖验证副本刷新并通过冻结安装与迁移检查。待干净源码提交后的签名候选准备，以及首次新原生包和真机验收；未创建发布 tag、归档或上传。详见 docs/research/2026-11-08-internal-updates-implementation.md。
