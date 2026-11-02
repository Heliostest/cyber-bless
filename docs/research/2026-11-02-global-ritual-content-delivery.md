# 全球仪式内容下载分发研究

**状态：未采纳。** 用户于 2026-11-02 决定所有仪式及资源随 App 打包，仪式库通过更新 App 扩展；不部署本报告提出的下载服务。当前实施以[随包发布与内测目录规格](../superpowers/specs/2026-11-02-bundled-rituals-internal-catalog.md)为准。下文保留为当时的方案研究，不代表当前发布架构。

研究日期：2026-11-02。目标是在 App 发布后分发兼容的新内容，减少仅为资源变化而发布整个 App 的次数。本轮只读代码和官方文档，未创建云账号、存储桶或 CDN，未部署内容，未运行真实 CDN／App 集成测试，也未修改产品代码。

## 建议

首选 **Cloudflare R2 + 自有域名 + Cloudflare CDN 缓存规则**，把仪式目录、清单和资源放到例如 `https://content.example.com/`。这是基于本项目当前静态资源下载需求的工程建议，不是性能实测结论。R2 官方明确支持通过自定义域名接入 Cloudflare Cache；`r2.dev` 是开发入口，限流且不提供这些缓存能力，不应作为正式分发地址。[Cloudflare：Public buckets](https://developers.cloudflare.com/r2/buckets/public-buckets/)，[Enable cache in an R2 bucket](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)（本研究者于 2026-11-02 已读相关正文）。

| 方案 | 对本项目的建议 | 官方依据与读取状态 |
| --- | --- | --- |
| R2 + Cloudflare 自定义域名 | 作为首个全球分发方案；先做小规模真实设备验证，再决定区域补充。无需先引入应用服务器来分发公开静态内容。 | [R2 自定义域名与缓存](https://developers.cloudflare.com/r2/buckets/public-buckets/)；2026-11-02 已读相关正文。 |
| AWS S3 + CloudFront | 同样可行；已有 AWS 运维、权限和发布体系时更值得优先考虑。使用私有 S3 源站和 OAC，让用户通过 CloudFront 下载。选择 AWS 并非本项目实现远程下载的前提。 | [S3 作为 CloudFront origin](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html)，[OAC](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)；2026-11-02 已读相关正文，AWS 推荐 OAC。 |
| 腾讯云 COS + CDN 等大陆区域方案 | 大陆用户占比或实际失败率达到需要处理的程度时评估；可与全球端发布相同哈希资源，但源站、域名和目录选择需单独设计。 | [COS CDN 加速配置](https://cloud.tencent.com/document/product/436/18670)，[CDN 加速区域](https://cloud.tencent.com/document/product/228/43827)；2026-11-02 已读相关正文。 |

R2 当前按存储量和操作计费，官方说明不收取 R2 出站带宽费用；这不等于整套服务免费，存储、请求、低频取回和另外启用的产品仍应按实际方案核算。此处不冻结具体单价。[R2 Pricing](https://developers.cloudflare.com/r2/pricing/)（2026-11-02 已读相关正文）。S3 + CloudFront 也应同时估算对象存储与分发费用，不能只比较存储价格。[AWS：S3 origin 费用说明](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/DownloadDistS3AndCustomOrigins.html#concept_S3Origin)（2026-11-02 已读相关正文）。

“全球 CDN”不能解释为“中国大陆访问已经加速”，也不能承诺每个地区都快。Cloudflare 官方将 China Network 描述为使用大陆内部基础设施的方案，且它是 Enterprise 客户的单独订阅。[Cloudflare China Network](https://developers.cloudflare.com/china-network/)（2026-11-02 已读 Overview／Availability 正文）。腾讯 COS 可绑定自定义 CDN 域名；腾讯 CDN 区分境内、境外和全球加速，境内或全球加速域名需要先完成 ICP 备案。[COS CDN 配置](https://cloud.tencent.com/document/product/436/18670)，[腾讯 CDN 使用限制](https://cloud.tencent.com/document/product/228/37848)（2026-11-02 已读相关正文）。本记录只据此提出区域选择，未完成该 App 在任何地区的资格或内容合规评估。

## 当前代码能做什么

本节依据 2026-11-02 实际读取的本地工作区代码，读取时 `HEAD` 为 `bc6dcc3dd401c7edb5bde526c668eee67dee9e9a`。这是静态代码审阅；不以历史研究记录代替本轮测试，也不宣称远端目录已在正式版本启用。

| 已有能力／限制 | 本轮读取位置 |
| --- | --- |
| catalog 有 `id/title/engine/revision/manifestUrl`；清单有资源 `path/bytes/sha256` 和 `config`；正式内容 URL 要求 HTTPS，仅为本地开发放行 loopback HTTP。 | [catalog.ts](../../packages/content/src/catalog.ts#L10)，[index.ts](../../packages/content/src/index.ts#L72) |
| 可以读取远端 catalog，读取失败时回退到历史目录；打开场景时获取 manifest、检查身份、下载资源并校验字节数与 SHA-256。 | [catalog.ts](../../packages/content/src/catalog.ts#L133)，[verifyAsset](../../packages/content/src/index.ts#L148) |
| 有按哈希管理的资源缓存、容量预算、使用中的资源保护和按最近使用顺序清理；缓存存在不代表系统永不回收文件。 | [cache.ts](../../packages/content/src/cache.ts#L28)，[catalog.ts](../../packages/content/src/catalog.ts#L258) |
| 原生宿主已有 `EXPO_PUBLIC_SCENE_CATALOG_URL` 入口；原生资源桥与 Web 元数据读取通道已区分。 | [App.tsx](../../apps/mobile-expo/App.tsx#L177)，[native-web.ts](../../packages/content/src/native-web.ts#L20) |
| `supportsScene` 只认可内置目录中已知的 engine。注册表中大量场景分别使用自己的 `scene-id@1`，并导入 App 内的实现；它不是任意远程场景解释器。 | [scene-library.tsx](../../packages/app/src/scene-library.tsx#L17)，[scene-engines.ts](../../packages/app/src/scene-engines.ts#L19) |
| 木鱼有专用模型／声音协议。其他 engine 的 validator 只允许可选的 `presentation` JSON（最多 8192 bytes），`config` 必须为空；当前消费逻辑取其中最多 300 字符的 `caption`。 | [validate](../../packages/app/src/scene-library.tsx#L29)，[scene-experience.tsx](../../packages/app/src/scene-experience.tsx#L461) |

因此，把文件上传到 CDN **不会让当前 App 自动获得任意新仪式的模型、三步操作或新逻辑**。CDN 解决存储与传输；可下载内容的表达能力受已发版引擎和 validator 限制。引擎支持也只是必要条件，新场景 ID 仍涉及当前静态的意图、步数、来源卡及多语文案路径（主代理于 2026-11-02 的本轮架构审阅补充）。要持续增加不同仪式，建议先迁移高复用、边界明确的有限交互类型，通过正常 App 发版提供相应通用引擎和配置协议，再发布其已支持的内容包；不能把“复用 engine”解释成当前系统已完全具备新增仪式能力。新增原生能力、引擎行为或协议能力，仍需要相应 App 更新。

现有 [场景内容发布边界](../scene-content.md#L127) 已说明本仓库没有部署 CDN，新增引擎需增加本地模块、注册和配置校验，并禁止加载清单提供的 JavaScript（2026-11-02 已读相关正文）。因此，第一步是发一次包含通用数据驱动能力的 App，不能把现有 TypeScript 场景直接上传后视为可下载运行。

## 建议的内容组织与发布流程

以下为待实施设计，不表示当前协议、云配置或客户端均已具备。

1. **小 catalog，短缓存。** 固定入口如 `/catalog/v1/catalog.json`，仅列元数据、清单 URL 和兼容性信息。现有 [发布规范](../scene-content.md#L129) 使用 `Cache-Control: no-cache`，初次接入可先遵守此约定；未来可评估数分钟 CDN TTL，例如 `Cache-Control: public, max-age=60, s-maxage=300`，该示例是待验证候选，未修改现有发布约定。具体数值由新内容可见时效和请求成本决定。Cloudflare 的 JSON 默认不缓存，必须明确设置适用的 Cache Rule，并确认 Edge／Browser TTL 没有覆盖预期。[R2 CDN 的默认文件类型](https://developers.cloudflare.com/cache/interaction-cloudflare-products/r2/)，[Cloudflare Origin Cache Control](https://developers.cloudflare.com/cache/concepts/cache-control/)（2026-11-02 已读相关正文）。
2. **清单和资源不可变，长缓存。** 每份发布产物使用内容哈希或版本化路径，例如 `/manifests/<hash>.json`、`/assets/<sha256>.glb`；相同 URL 不覆盖为不同字节。可为这类对象采用一年 TTL 和 `immutable`，变化时发布新 URL。`immutable` 表示新鲜期内资源不会变化；在 Cloudflare 中它主要影响浏览器行为，CDN 的可缓存性与 TTL 仍需正确配置。[RFC 8246 §2](https://www.rfc-editor.org/rfc/rfc8246.html#section-2)，[Cloudflare 指令行为](https://developers.cloudflare.com/cache/concepts/cache-control/#directives)（2026-11-02 已读相关正文）。AWS 同样建议通过版本化文件名／目录更新内容，配合 TTL，无需等待旧 URL 过期才发布新资源。[AWS 版本化文件名](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/UpdatingExistingObjects.html)，[CloudFront TTL](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Expiration.html)（2026-11-02 已读相关正文）。
3. **先资源、后目录。** 完成内容审阅及离线校验，上传所有不可变资源和 manifest，验证每个引用可取回且哈希一致，再替换小 catalog。回滚时把 catalog 指回已验证的旧清单，保留仍被已发布目录引用的资源。此顺序是本项目建议；当前客户端会保存 manifest，尤其不宜覆盖同一 revision／URL 的内容。
4. **点选后下载。** 列表刷新只取目录与必要封面；用户打开时显示包体积和下载进度，支持取消、重试，校验通过后才使用。命中有效本地缓存则离线打开，并继续保留缓存预算及清理能力。现有 `library.open`、校验和缓存可以作为实现基础。
5. **先筛兼容版本。** 当前可依据 `engine` 判断支持与否；未来协议可增加 schema 能力或最低 App 版本字段，并将多语文案、来源信息及意图／步数等必要数据纳入经过审阅的内容协议。服务端目录和客户端都应避免把不兼容包当作可下载可玩的内容。`minAppVersion` 等字段是建议扩展，当前 `CatalogEntry` 并没有这些字段。
6. **验证真实请求。** 用正式 iOS／Android 包验证 HTTPS、目录更新、跨域、哈希失败、断网重开、容量清理和旧版兼容。当前原生 DOM 通道仍用 Web 读取 manifest，因此不能只在电脑浏览器中打开资源 URL 就算验收。R2 自定义域名按桶 CORS 配置响应；测试 CORS 时必须携带实际 `Origin`，更改策略后还需注意已有 CDN 缓存。[R2 CORS 自定义域名说明](https://developers.cloudflare.com/r2/buckets/cors/#use-cors-with-a-custom-domain)（2026-11-02 已读相关正文）。

针对网络选择，应实际抽样北美、欧洲、亚洲以及大陆的首下载耗时、错误率和缓存命中表现，再决定是否需要区域镜像／CDN。不能从厂商节点覆盖图推导本 App 的下载体验已经通过。

## App 商店边界

主代理于 2026-11-02 实际读取以下官方政策相关正文，并将结论提供给本研究记录；本文件编写者未单独复读这两页，读取归属在此保留。

- Apple §2.5.2 限制下载、安装或执行会引入或改变功能的代码；§4.7 又对 HTML5／JavaScript mini apps、mini games 等列有专门规则及 §4.7.1–4.7.5 的额外条件，不能概括成所有远程 JavaScript 都一律禁止。[App Review Guidelines §2.5.2／§4.7](https://developer.apple.com/app-store/review/guidelines/)
- Google Play 对 Play 外的应用自更新及下载 dex、JAR、`.so` 等可执行代码有限制；解释器／WebView JavaScript 有政策例外，但仍须遵守全部相关政策。[Google Play：Device and Network Abuse — Full Policy](https://support.google.com/googleplay/android-developer/answer/16559646?hl=en)

对本产品更稳妥的设计是：已审核 App 内提供有明确边界的引擎，远程下载该引擎支持的模型、音频、文案和有限配置；不要把新增 TypeScript／JavaScript 逻辑默认等同于普通资源更新，也不能承诺“使用 JSON 就一定通过审核”。这属于设计建议，具体送审范围仍需结合最终功能审查。

未来新增或修改仪式内容时，继续执行 [场景来源与文化关联核查规范](../scene-provenance.md)；传输方式和技术校验都不能代替来源、文化主张及实际呈现审阅。本轮未新增或修改任何仪式场景。
