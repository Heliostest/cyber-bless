# 一日一念商店发布记录

## 后续发布入口：Git tag 固定源码与工具

正式 Mac mini 构建改用[参数化 tag 发布入口](../scripts/ios-release/README.md)：先提交业务源码、素材、发布工具、依赖锁及版本输入，合并／推送 `master` 后创建并推送附注 tag；Mac 直接获取该 tag 和 LFS 实体，执行同版本工具并串行验证、构建和交付。不再把未提交工作区生成的 `source.tgz` 用于新正式发布。构建号尚未分配时保持 release input 的 `null` 并拒绝执行，不猜测下一个编号。

本节是后续流程约定，不改变既有构建 18 及更早工作区快照的历史身份，也不表示本轮已创建 tag、构建或上传。既有回执保留；源码或工具修复须使用新提交和新 tag。

## 2026-10-27 构建 13：3D 交互更新与内部测试

北京时间 17:11:51，新的 **1.0.0 (13)** 已完成 Mac mini 本地 Xcode 26.6 归档、App Store 签名导出、上传及 Apple 处理。源码为 `c2c449233402d949ac08f3054e7a6d2b4b070292`，包含 3D 首帧就绪后才接受交互、加载错误与重试、旧会话恢复至 3D 及共享场景布局更新。冻结归档包含 2,198 个文件，SHA-256 为 `bb19422e0ee91e9414f1ee360ca380a219a078fd3e68d956e5e5fc4941b3bfd9`，已在 Mac 逐项核对文件哈希。

实际 IPA 为 209,002,445 字节，SHA-256 为 `dbb33be173a211a5588420ab328c161212ce428ff0587a2d6384f4b75b5561f6`。主应用与小组件扩展的身份、构建号 13、App Group、App Store profiles、实际代码签名及分发证书有效期均已核验；原生 `main.jsbundle`、DOM 本地依赖、14 项离线资源和 465 张小组件封面与本次源码匹配。上传回执为 `UPLOAD_ACCEPTED`。

Apple build UUID 为 `89557e0a-2466-463e-8159-fedb0780e6fa`，已读回 `VALID / IN_BETA_TESTING` 并关联原内部组 `Team (Expo)`。构建 13 的测试说明已保存并读回；组内仍为 1 位既有直接成员，其测试员记录状态为 `INSTALLED`。该状态不作为本轮构建 13 已完成真机安装或 3D 验收的证明。本轮没有新增邀请、修改权限或提交审核，正式 App Store 版本仍关联构建 12。

`mobile:verify` 已通过。针对本次变更的现有交互回归测试另有 32 项通过、38 项按范围跳过，覆盖 3D 就绪门槛、失败重试、旧纸鹤检查点恢复与单次结算、木鱼至少十二次后的主动结束及恢复路径。这些是 jsdom／模拟控制器测试与包资源检查，不等同于真实 WebGL、iOS GPU 或真机 3D 验收。小组件本轮未修改，显示、刷新及点击行为仍待生产签名包真机验证；不将本轮打包成功视为先前显示问题已修复。

本机详细回执位于 `artifacts/ios-testflight-20261027/`：`source-verification-mac.json`、`build-report.json`、`certificate-validation.json`、`offline-validation.json`、`upload-receipt.json`、`testflight-completion.json`；相关测试日志为 `mobile-verify.log` 与 `interaction-tests.log`。不含个人资料的持久摘要仍见 [TestFlight 状态](../store/ios/testflight-status.json)。

EAS 远端 iOS 构建计数已由 12 同步为 13，写入后已重新读取确认，后续自动递增将从其后继续；同步前确认本项目没有排队或运行中的云构建。回执为 `artifacts/ios-testflight-20261027/counter-sync.json`。

## 2026-10-26 商店资料与真实原生截图更新

北京时间 22:27 已将简体中文介绍、关键词、推广文字、正式审核说明、Beta 审核说明及构建 12 的测试说明保存到本应用并逐项读回。正式版本已关联 `1.0.0 (12)`，仍为 `PREPARE_FOR_SUBMISSION / MANUAL`；没有提交正式审核、外部 Beta Review 或公开发布。审核联系人、公开支持与隐私 URL 保留。

截图来自冻结提交 `7cf95e9f31eea3463c4624ad5b00cc21493245e4` 的原生 Release 模拟器安装：iPhone 17 Pro（1206 × 2622）与 iPhone 17 Pro Max（1320 × 2868），Xcode 26.6、iOS 26.5。两台安装包的 `Info.plist` 均核对为 1.0.0、构建 12。各组按今日、心愿、风铃、完整纸鹤、小天地排列，使用虚构本地记录；没有拉伸、设备框或合成系统界面。完整来源和每图哈希见本机 `artifacts/store-refresh-20261026/manifest.json`。

原拟加入的真实系统小组件截图因验证失败撤下：扩展可注册并添加，但 Release 模拟器的预览与主屏持续白卡，系统报告 `CHSErrorDomain 1101`、空视图集合。没有确认唯一根因，也不能据此断言生产签名包必然故障或只是模拟器问题。公开介绍、推广和关键词暂不宣传小组件；内部测试与审核说明如实记录此情况，正常签名 IPA 仍需真机验证。木鱼在模拟器进入“轻量模式”的现象同样保留待查；本轮没有修改产品源码或声称已修复。

北京时间 22:46:19，十张新图全部 `COMPLETE` 后，已精确移除旧 40 张并核对两组各五张的顺序、字节数与 checksum；其余六个旧截图组为空。旧图原字节、ID、checksum 与顺序保存在本机 `artifacts/store-refresh-20261026/backup`。22:47:45 独立 Apple API 读取再次确认最终十图、构建 12 的 `VALID` 状态与正式关联，所有读取无错误；网页媒体管理也显示两组新图。

持久摘要为 [商店资料状态](../store/ios/materials-refresh-status.json) 和 [截图上传状态](../store/ios/screenshot-upload-state.json)。本机文案、执行、独立读取和控制台证明分别为 `artifacts/store-refresh-20261026/metadata-final-result.json`、`report.json`、`asc-audit.json`、`asc-updated.png`。截图复用流程见 [iPhone 截图说明](iphone-screenshots.md)。输入与替换保护共 19 项离线检查通过，包括此次修正的 POST 上传指令保存/恢复；最后一张曾停留在 Apple `UPLOAD_COMPLETE`，等其转为 `COMPLETE` 后才清理旧图，没有重复传输已提交的分段。

Mac 空间不足时，本项目旧构建 7–10 的八个 archive/export 目录已先流式保全到本机 `artifacts/store-refresh-20261026/mac-legacy-builds-7-10.tgz`，两端 SHA-256 均为 `a7519d3c4e1d6978c5d73816d55a672505dfe8b98a4b79890c8595e32915e8d0`，压缩包读取校验通过后才清理远端旧副本。另清理本任务可重建的 DerivedData、失败驱动临时目录及冻结工作目录的 node_modules，保留源码、lockfile、最新正式签名归档和 IPA。两台截图模拟器均已关闭。

本次资料核查时，开发者新协议仍待账号持有人接受，DSA 仍未完成，付费协议处于等待用户信息且银行/税务资料待补；地区许可与备案须按实际发行范围核实。构建 12 不含应用内购买，未推广或配置尚未完成资料的买断商品。本次没有签署协议或修改定价、地区、法律声明。

## 2026-10-26 Mac mini 本地构建与内部测试

北京时间 19:28 已完成 SSH → Mac mini → Xcode 26.6 归档／商店签名导出 → Apple 上传 → TestFlight 内部邀请。源码为当前提交 `7cf95e9f31eea3463c4624ad5b00cc21493245e4`，版本为 **1.0.0 (12)**。主应用 `com.helio.cyberbless` 与小组件 `com.helio.cyberbless.widgets` 均使用 Team `6PG2WW6L6N`，两者构建号、App Group、有效 App Store profiles 与实际代码签名已逐项核验。

Apple build UUID 为 `c0729860-3f40-4392-992e-d1c16d9f83c4`，已读回 `processingState=VALID`、`internalBuildState=IN_BETA_TESTING`；构建已关联内部组 `Team (Expo)`。用户指定的既有 Marketing 用户已获得本 App 访问权限，原角色与其他 App 权限保留；网页及官方 API 均确认内部组有 1 位测试员，状态为 `INVITED`。测试员邮箱仅保存在本机忽略的回执中。内部邀请经 App Store Connect 网页完成，公开 API 对既有外部 betaTester 记录返回 409，未重复该失败请求。

已运行 `npm run mobile:verify`：类型检查、Expo 依赖兼容检查、8 项基础测试及双端嵌入导出通过。另对实际签名 IPA 的原生 JS、DOM 本地依赖、14 项离线资源和 465 张小组件封面执行哈希核验。IPA 为 209,002,157 字节，SHA-256 为 `6d28a54ee5d0caae146a8e1a5abaf9f649f079faa32a84a2a241ac638b6afdf5`。这些检查覆盖构建与资源完整性；本次未执行该新包的真机安装验收。

EAS 远端 iOS 构建号已从 6 同步到 12，以便下次自动递增。Mac 构建目录为 `/Users/heli/world-blessing-testflight-20261026`；本机详细源码、签名、上传、离线核验及邀请回执位于忽略目录 `artifacts/ios-testflight-20261026/`。不含个人资料的持久状态见 [TestFlight 状态](../store/ios/testflight-status.json)，控制台入口为 [本应用 TestFlight](https://appstoreconnect.apple.com/apps/6821271597/testflight)。正式 App Review、外部 Beta Review 和公开发布均未执行。

下方 10 月 10–13 日内容为历史快照；最新内部测试构建与邀请状态以上述记录为准。

2026-10-13 19:30 更新：首发体验后买断已经授权，原生计费协调、验证、购买/恢复桥接与页面正在 `codex/mobile-paid-unlock` 托管工作目录实施，尚未合入主工作目录。已创建本应用非消耗型商品6822274692（com.helio.cyberbless.full_unlock），版本88375b0a-5ef9-4857-9fde-6d8664b0ce88及简体中文名称/描述已保存并读回；价格、销售范围和审核截图尚未填写。DSA已按授权填写联系资料，但仍待邮箱验证码；付费协议供审阅，未签署。最新实现和验证见 [mobile-paid-unlock.md](mobile-paid-unlock.md)，旧免费包不能作为买断验收包。没有新付费版本构建、上传或提审。

最新核查：2026-10-13 18:52（北京时间）。本应用名称、副标题、描述、关键词、类别、年龄问卷、审核联系人、免费定价、175地区选择、40张iPhone截图及Notion隐私/支持URL已保存。开发者确认两张UI图片可用于发行后，内容版权字段已实际保存为 USES_THIRD_PARTY_CONTENT，并通过独立读取确认；完整声明见 [内容版权](../store/ios/content-rights.zh-Hans.md)，可重复执行 `npm run mobile:store:content-rights`，保存回执为 store/ios/content-rights-status.json。

用户恢复页面访问并确认Apple最终法律承诺后，已实际点击App Privacy最终“发布”。点击响应曾超时，未重复点击；恢复浏览器绑定并重新加载后，页面明确显示“3 分钟前由力 何发布”，内容为“未收集数据”，政策URL为本应用Notion公开页。已发布证据为 artifacts/store-evidence/app-privacy-published-20261013.jpg，安全状态记录为 store/ios/compliance-status.json；UI只显示相对时间，没有编造精确发布时刻。URL保存脚本的回执现明确使用ByThisRun字段，避免后续重填URL时误报隐私问卷未发布。

开发者已确认首发加入“体验后买断”，此前纯个人爱好、无商业化目的的DSA判断已更新，现按经营者方向准备。开发者已明确授权将Apple账号现有邮寄地址、此前提供的审核电话及共用邮箱用于欧盟公开展示。已填写并进入Apple邮箱验证码页面，验证码已发送，仍待用户完成邮箱/电话验证及后续证明；尚未宣称DSA完成。仅向Apple授权表单输入联系资料，不把地址/电话写入仓库或Notion。账号商务页免费App协议有效，付费App协议仍为“新”，没有签署该协议或输入银行、税务资料。

当前线上商店资料与旧生产包仍为免费、无内购；首发加入永久买断已经确认，隔离工作目录正在实施，免费体验门槛和基础价格仍待用户选择。永久解锁对应非消耗型IAP，需要购买、恢复购买、原生沙盒测试和正确的审核资料；限时试用须另按Apple 3.1.1准备，不把普通计时器当作已符合规则。App Privacy已发布与正式App Review未提交是两个独立状态。依据见[内购类型](https://developer.apple.com/help/app-store-connect/reference/in-app-purchases-and-subscriptions/in-app-purchase-types/)、[审核规则3.1.1](https://developer.apple.com/app-store/review/guidelines/)。

正式版本仍为PREPARE_FOR_SUBMISSION、MANUAL，正式reviewSubmissions为空，版本尚未关联构建；Apple只有旧1.0.0(4)。最新代码、截图与生产包的一致性仍须完成验证及新构建。各地区的适用性与办理路径另见 [地区要求](store-region-requirements.md)；当前175地区选择未因此修改。下方逐时段记录属于历史核查，不应把较早的空字段结果当作最新状态。

记录日期：2026-10-10，以下时间均为北京时间（UTC+8）。已配置并验证；四种构建完成；iOS 上传完成且 Apple 处理成功；**外部 TestFlight 审核未提交、正式 App Review 未提交、Google Play 未上传、未公开上架**。iOS 已保存手动发布，Android 仅授权推进 internal。

## 2026-10-13 提审材料复核

14:38 通过本应用的 App Store Connect 官方 API 重新核查：1.0.0 仍为 PREPARE_FOR_SUBMISSION、MANUAL；正式 reviewSubmissions 为空。名称、副标题、描述、关键词、生活分类、年龄问卷已经保存；八个 iPhone 截图组各五张，40项全部 COMPLETE。本次只读核查，没有上传、关联构建或提交审核。

| 项目 | 本次核查结果与剩余材料 |
| --- | --- |
| 审核联系人 | 姓、名、邮箱、电话四项均为空；须提供本应用真实联系人与国际格式电话 |
| 隐私与支持 | privacyPolicyUrl、supportUrl 均为空；需要公开支持/反馈邮箱和可匿名访问的两个页面。现有站点配置仍为 private；本次匿名访问 /privacy/、/support/ 返回403/Cloudflare，不能确认审核员能访问 |
| 版权与内容权利 | copyright、contentRightsDeclaration 均为空；须确认发行主体及 assets/reference-ui/wishes.png、rituals.png 的商业发行权 |
| 正式构建 | 版本未关联 build；Apple 只存在 1.0.0(4)，processingState=VALID，最低iOS16.4。该包不含最近新增场景、小组件和法务补充；需以最终发布内容重新验证、构建、上传并关联，截图和审核步骤同时更新 |
| 审核说明 | 现有备注仍含“不存在服务器账号、用户分享或云同步”，与主动系统分享功能不一致；本地修正版已准备，联系人补齐后保存，并按最终页面重新核对操作步骤 |
| App Privacy 发布 | 10月10日核查为“未收集数据”草稿；本次浏览器桥接连接失败，未重新确认最终发布状态。必须基于最终包重新审计并确认发布，不能把保存草稿当作发布 |
| 价格、供应地区、地区声明与协议 | 本次价格明细/availability API 返回404，无法据此认定已配置或缺失；浏览器尚不可用。需要确认免费或具体定价、首发地区；在控制台核实适用的DSA、地区资质和当前协议提示 |
| 外部 TestFlight | Beta Review 联系人同样四项为空；betaAppLocalizations为空，没有反馈邮箱资料；build4 没有 Beta Review submission。外部测试资料和正式 App Review 分别完成，不把其中一个提交当作另一个 |

Apple要求先提供必填资料、选择正确构建，然后“添加以供审核”并继续“提交以供审核”，见[正式提交步骤](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-app)。隐私政策URL对所有App必填，隐私答案保存后还需发布，见[App Privacy](https://developer.apple.com/help/app-store-connect/manage-app-information/manage-app-privacy/)。DSA经营者身份需按账号/应用真实情况核查，不能由是否免费推断，见[Apple地区合规说明](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)。

安全核查摘要保存在 artifacts/mobile-verification/review-readiness-20261013.json，仅记录联系人字段是否存在，不保存联系人值或凭据。当前尚没有正式提交ID、审核结果或公开上架记录；保留手动发布。

## 2026-10-13 复用 ThumbNote 的发行信息

用户明确授权“看看thumbnote中的信息是怎么填写的，照搬就行了”。通过同一Apple Team的官方API核对 ThumbNote（Apple ID6758052904，com.thumbrain.thumbnotes）真实商店记录；参考源码只读，未修改参考App或其商店记录。该记录当前版本1.0为REJECTED，不应把它当作已经完成审核的模板。

14:51 实际保存到一日一念自己的记录（Apple ID6821271597，com.helio.cyberbless），14:52再次读回验证：

| 复用项 | 已保存并验证的本应用值 |
| --- | --- |
| 版权发行信息 | Copyright (c) 2026 He Li |
| 定价 | 免费；美国为基础地区，175个地区的实际价格均为0 |
| 供应地区选择 | 与参考一致，175个地区选中；availableInNewTerritories=true |
| 正式发布方式 | MANUAL保持不变，版本仍PREPARE_FOR_SUBMISSION；未提交审核、未公开上架 |

本应用配置摘要与地区列表保存在 store/ios/release-settings.json。它记录本应用身份和已核实的发行设置，reference中的ThumbNote身份仅用于来源记录，不供本应用构建或上传绑定。API客户端增加了Apple当前正式使用的/v2/路径支持，地区读取和保存使用/v2/appAvailabilities；其余/v1/流程保持兼容。

ThumbNote的正式审核联系人四项、Beta审核联系人四项都为空，betaAppLocalizations也为空；没有可复制的审核电话或反馈邮箱。已集中请求本应用联系人姓名、邮箱、国际格式电话和可公开的支持/反馈邮箱；不能把Expo提交配置里的Apple登录邮箱直接当作公开支持邮箱。

参考App的支持和隐私URL均为ThumbNotes的Notion页面。此次页面正文未能读取，未确认其适用于一日一念，因此没有覆盖本应用自己的支持/隐私URL和披露；原已准备的本应用页面仍待补邮箱并完成公开访问核验。参考声明DOES_NOT_USE_THIRD_PARTY_CONTENT也未复制：本应用两张UI参考图的商业发行事实须独立核对。

地区选中只表示分发意向，不表示已获当地销售资格。源App及一日一念的德国等欧盟地区均返回TRADER_STATUS_NOT_PROVIDED，地区经营者资料仍待补齐；中国大陆、越南等适用资质也未由本次复制确认。正式App Review及外部TestFlight均未提交。

执行与独立读回摘要为 artifacts/mobile-verification/thumbnote-publisher-applied.json、thumbnote-publisher-readback.json。此前14:38核查中“版权、价格、地区待定”的部分已由本节更新；联系人、隐私发布、产品素材权利、最终新构建及资料一致性仍未完成。

## 2026-10-13 联系人与 Notion 页面准备

用户确认正式审核与公开支持/反馈共用 heliosthu@163.com，并提供 He Li 的国际格式审核电话。15:21已实际保存并读回核对本应用的正式 App Review 联系人、Beta Review 联系人、两处审核说明和中文 TestFlight 反馈邮箱；联系人姓名为He Li，电话仅提交给Apple，不保存在仓库、页面或状态摘要中。中文betaAppLocalization ID为00abd1ab-e16a-411e-a47a-b5d04ca9d217。

此前联系人空值导致无法保存审核备注的问题已解除。新说明按当前源码的今日场景、心愿加号、小天地、我的隐私/支持入口编写，删除了“不存在用户分享”的错误披露；它面向待构建的新版本，不能把旧build4当作已经包含新流程和小组件的包。没有提交App Review、Beta Review或邀请测试者。

公开邮箱已加入 packages/app/src/legal-content.ts；生效日期改为2026-10-13。App内离线隐私/支持、已有静态站点生成文件以及Notion待创建页面使用同一正文。隐私补充桌面小组件仅使用本机缓存、不展示心愿全文的说明，支持步骤与当前今日场景入口一致。

两份Notion正文为 store/notion/privacy.zh-Hans.md、support.zh-Hans.md；来源可通过 `npm run mobile:legal:notion` 重建。store/notion/pages.json记录本应用身份及创建/公开访问状态；Notion尚未安装连接，pageId和publicUrl均为空，不能声称页面已创建或把本地文件当作商店URL。已请求用户安装并连接Notion、授权存放页面的工作区；连接后先检查同名页面避免重复，再创建、核验正文和匿名访问，最后填本应用privacyPolicyUrl、supportUrl及TestFlight隐私URL。

更新联系人使用 `npm run mobile:store:contact`，由标准输入接收一行JSON（contactFirstName、contactLastName、contactEmail、contactPhone）。避免把电话写入已跟踪文件、公开文档或CI日志；脚本拒绝缺失字段/无效国际电话，对Windows输入BOM和格式错误做处理，错误信息不输出联系人原文。此次读取确认与状态摘要为 artifacts/mobile-verification/app-store-contact-status.json，只保存ID和字段完成状态。

15:23本地检查确认两份页面和静态HTML含公开邮箱、无审核电话或发布准备占位；无效联系人输入不会打印原文，Windows双BOM输入可进入字段校验。检查结果为 artifacts/mobile-verification/contact-and-legal-checks.json。首次Web构建与移动类型检查因另一会话正在编写的bai-indigo-cloth场景缺少返回值而失败；该会话随后补全代码，复查 `npm run build`、`npm run typecheck -w @wbr/mobile` 均通过，本轮未修改该场景。最终完整发布验证仍需在新功能和页面地址落实后执行。

Notion公开页面创建完成后需确认公开发布状态和实际对外URL，匿名访问应能看到正确正文和联系邮箱；工作区内编辑链接不能代替公开链接。当前官方发布入口见[Notion公开页面说明](https://www.notion.com/help/public-pages-and-web-publishing)。本次结束前再次查询连接状态仍为未安装，未创建远程Notion页面，商店两个URL仍待填入。

## 2026-10-13 Notion 公开发布与商店 URL 保存完成

用户完成Notion插件连接，并在Codex内置浏览器登录Chelio Helio的工作空间后，已实际创建、公开发布两份本应用页面。Notion页ID分别为隐私3f8b5fdf-16fd-8107-82ff-cfc4590d8b42、支持3f8b5fdf-16fd-8140-83a1-d4d5db26c704，未覆盖ThumbNotes旧页面。完整正文及已确认的公开邮箱均读回核对；生效日期显示为固定2026-10-13，审核电话未进入页面。没有发邀请或扩大工作区成员权限。

| 用途 | 已发布并保存的公开链接 |
| --- | --- |
| App Store 隐私政策 | https://alive-resonance-9ba.notion.site/3f8b5fdf16fd810782ffcfc4590d8b42 |
| App Store 技术支持 | https://alive-resonance-9ba.notion.site/3f8b5fdf16fd814083a1d4d5db26c704 |
| TestFlight 隐私政策 | 与本应用上述隐私链接一致 |

Notion发布面板显示公开域名/页面路径、“取消发布”和“查看网站”；公开Site查看器显示完整正文和邮箱，没有登录拦截。两个URL的不带Cookie HTTP请求均返回200；HTTP响应为Notion前端壳，实际正文由公开Site浏览器页面核验。web文本抓取工具未能读取Notion页面，没有将该工具失败误判为页面私有，也没有宣称完成独立无Cookie浏览器会话的测试。

16:48:28（北京时间，2026-10-13T08:48:28.454Z）通过本应用Apple API实际保存并逐项读回验证：appInfoLocalization 7c6b226e-457e-4aab-8b9c-3a043c590412的privacyPolicyUrl、versionLocalization b2c0e7de-2fdd-40e3-b1f2-dfa5adb96f2e的supportUrl、betaAppLocalization 00abd1ab-e16a-411e-a47a-b5d04ca9d217的privacyPolicyUrl。目标App仍为6821271597、com.helio.cyberbless，版本1.0.0；没有关联或替换构建、发布App Privacy答案、提交App Review或Beta Review。

页面身份、公开状态及URL保存在store/notion/pages.json；Apple实际保存摘要为store/notion/app-store-link-status.json。重复保存同一已核验的链接使用 `npm run mobile:store:legal`，脚本先检查本应用身份、页面ID、公开访问和正文核验标记，然后只更新这三个URL字段，不触发审核或上架。公开截图保存在 artifacts/store-evidence/notion-privacy-public-20261013.jpg、notion-support-public-20261013.jpg。

此前“Notion未连接、页面未创建、URL待填写”的记录已由本节更新为完成。正式提审仍需完成最终新构建与截图一致性、App Privacy答案最终发布、素材权利和适用地区资格核对。iOS仍保留手动公开发布。

2026-10-11 已整合 origin/master 的 588e30a，包含 PR #20 的三入口场景、PR #21 的今日日常集合／心愿祈愿容器选择，以及 PR #22 的今日主仪式／已收藏三选一祈愿。移动发布修改已保留，包括新场景参数和离线法务入口。本记录下面的 iOS4／Android3 安装包均在这些产品改动之前生成，尚未包含 #20、#21、#22；后续需重新构建安装包，并同步更新截图和审核说明。源码合并与生产导出不会更新现有 TestFlight 或 Android 安装包。

2026-10-11 合并后的 `npm run verify` 和 `npm run mobile:archive:verify` 均通过：业务测试、Web 构建、移动类型和官方依赖检查、iOS／Android 原生与 DOM 生产导出，以及实际 EAS 上传归档在干净目录中的安装和双平台导出。两个平台各验证 9 项离线资源、共 10,898,848 字节的长度和哈希；未进行新一轮 EAS 云构建或商店提交。此次本地日志分别为 artifacts/git-merged-verify-20261011.log 和 artifacts/git-merged-archive-20261011.log。

## 实际构建、上传和 Apple 状态

| 用途 | 版本/构建号 | EAS build ID | 完成时间/结果 |
| --- | --- | --- | --- |
| iOS 商店 IPA | 1.0.0 (4) | [c62983e4-f64e-420d-8175-a7f36f029c6d](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/c62983e4-f64e-420d-8175-a7f36f029c6d) | 15:56:49 FINISHED |
| iOS Ad Hoc IPA | 1.0.0 (4) | [684115fb-db82-4b08-9da9-8f9c47d3b3f4](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/684115fb-db82-4b08-9da9-8f9c47d3b3f4) | 16:09:51 FINISHED |
| Android production AAB | 1.0.0 (3) | [e48070df-7315-47c1-b014-fc07cf76fb4d](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/e48070df-7315-47c1-b014-fc07cf76fb4d) | 16:13:23 FINISHED |
| Android preview APK | 1.0.0 (3) | [19fdef42-3a5f-4103-875a-9bc96891d51a](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/19fdef42-3a5f-4103-875a-9bc96891d51a) | 16:18:16 FINISHED |

iOS EAS submission [5cd5aac3-1748-48e9-8ec4-63b140ccd0c9](https://expo.dev/accounts/cheblito/projects/cyber-bless/submissions/5cd5aac3-1748-48e9-8ec4-63b140ccd0c9) 于15:57:02 FINISHED，明确关联生产 build c62983e4。Apple 上传时间15:57:44；16:20官方API核查 processingState=VALID、版本1.0.0、构建4、com.helio.cyberbless、非豁免加密=false。Apple build UUID 是 `5f5a12fb-7cb7-4256-a20f-228b85ba1c40`，最低iOS16.4。内部状态 READY_FOR_BETA_TESTING，外部 READY_FOR_BETA_SUBMISSION。不要重复上传此包。

App Store 草稿 version ID `84ab28c1-b40b-4d0c-ade2-d3e02d2eaf62`，状态 PREPARE_FOR_SUBMISSION，releaseType=MANUAL。本轮未点击最终正式提交，没有正式 review submission ID、时间或审核结果。EAS submission ID 只代表上传，不代表 App Review。

历史失败：iOS build3 [789e6a31-fcdb-4885-8663-a999e13850ff](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/789e6a31-fcdb-4885-8663-a999e13850ff) 在15:49:23因Sharp安装失败；其submission `3a824bec-2205-44ea-a248-767c211376d3` 为 CANCELED。构建1/2在签名准备阶段消耗远程号，没有云构建任务。修复后成功构建4，不回退号。Android旧APK1、AAB2已被移除悬浮窗权限后的版本3取代，均未上传Play。第一次过大源码归档在云构建创建前中断，build:list确认当时无任务。

本地包与哈希：

| 文件（artifacts/packages） | 字节 | SHA-256 |
| --- | --- | --- |
| cyber-bless-4.ipa | 20,178,252 | 9117053345dc98d529f7519ed47f8953b2646aab467b892f94f2f2a015315741 |
| cyber-bless-preview-4.ipa | 18,427,084 | ff081f8ba6a3498025d2117297e3de8a8f956c7a269f8850ec5463c38e7a3bc9 |
| cyber-bless-3.aab | 59,414,522 | a64a12f398773a99d7f7141f4a4667bc7d3cb572210b35dc4a9be37a851e73fa |
| cyber-bless-preview-3.apk | 81,741,457 | a490ed5da77d2b945d26cb1f72b4e778c8cf6daa0124524ae77102fecadba6c4 |

签名凭据、最低系统、配置和重复运行命令见 [mobile-app.md](mobile-app.md)。不把IPA下载地址当作TestFlight安装链接；商店签名IPA也不供普通iPhone直接安装。

## iOS 资料与审核摘要

[本应用商店草稿](https://appstoreconnect.apple.com/apps/6821271597/distribution/ios/version/inflight) 的身份：一日一念，中文主语言，1.0.0，SKU cyber-bless-ios，Apple ID6821271597，Team6PG2WW6L6N。Developer会员已核查有效至2027-04-08，最新Developer协议于2026-10-10已接受，未发现当前协议待处理提示。本轮没有代替用户接受协议、付款或复制其他应用的私密联系人。

| 资料 | 当前结果 |
| --- | --- |
| 名称/副标题 | 一日一念 / 心愿记录与轻松日常仪式，已保存 |
| 分类 | 生活（LIFESTYLE），已保存 |
| 描述/关键词/推广文本 | store/ios/zh-Hans.json，已保存到本应用草稿 |
| 截图 | 2026-10-13 补齐八个 iPhone 组，每组五张、共40张无alpha PNG；全部官方API处理COMPLETE，重复运行验证无重复资源；详见 iphone-screenshots.md |
| 年龄问卷 | store/ios/age-rating.json，已保存；因含日常放松/自我照顾主题，healthOrWellnessTopics=true；没有医疗建议、赌注、广告、聊天或公开UGC |
| 商店当前分级 | UI显示9+（172个地区）、越南12+，韩国全部；低于OS26的旧分级全球4+（区域有例外）。API旧字段FOUR_PLUS不能代替当前UI的9+ |
| 登录 | 不需要，已选；无需审核账号 |
| 审核步骤 | 修正版已在JSON中准备；Apple要求联系人齐全才能保存更新，暂未保存修正版 |
| 审核联系人/版权主体 | 尚未获得本应用事实，未填写 |
| App Privacy | 已保存“未收集数据”草稿；隐私URL和最终发布待完成 |
| 内容版权声明 | 待确认两张UI图商业发行权后填写；未虚构全部原创或许可证 |
| 价格/供应地区/相关资质 | 待确认；建议免费，未直接启用中国大陆/越南或推断DSA经营者身份 |
| 正式构建关联 | 尚未关联，待最终法务内容重建、处理和完整摘要核对后选择对应Apple build |
| 发布方式 | MANUAL已保存；不自动公开发布 |

原五张截图来自本项目生产Web界面的Chrome浏览器移动视口，使用CDP截图生成实际像素，包含今日、心愿、木鱼交互、小天地、离线隐私页。示例心愿为测试文字，没有真机或模拟器状态栏。未使用Historia截图，也没有拼接或假设备框。源文件保存在 store/screenshots/ios/zh-Hans。原API截图集ID `c57bd4cf-09fa-40f0-81c8-55c596eac4cc`、类型APP_IPHONE_61的五项及原资源ID保持不变。

2026-10-13 新增其余七个 iPhone API 组各五张，共新增35张，总计八组40张；全部达到COMPLETE。新增素材来自2026-10-10生产源码归档的实际Web页面，在Edge中按不同视口重新截取；已检查图片格式、长度、哈希及缩略总览。追加的是同一旧版页面系列，当前新场景/小组件功能仍需与最终新构建同步更新后再提审。规格、像素和来源清单为store/ios/screenshot-sizes.json、store/screenshots/ios-sizes-manifest.json，八组Apple资源ID与状态保存在store/ios/screenshot-upload-state.json；[捕获和重复上传说明](iphone-screenshots.md)记录了具体尺寸、边界和命令。Apple当前Dynamic Island medium接受1206×2622，见[官方规格](https://developer.apple.com/help/app-store-connect/reference/app-information/screenshot-specifications/)。Duo暂不在当前API类型中，未上传尺寸不匹配的图片；后续真机安全区验收后可按实际发布版本更新截图。

审核操作：冷启动 → 今日/许个愿 → 输入保存 → 木鱼轻敲12次 → 收藏 → 心愿/小天地查记录 → 退出重开 → 我的隐私与帮助。仪式是娱乐、创意与日常放松，不承诺实现愿望、宗教效力或健康改善。仪式文字可以由用户主动系统分享或复制；没有开发者分享服务器。当前商店已有旧备注含“不存在用户分享”的不准确句子，修正版已准备，必须在正式提审前替换；联系人为空时API和网页保存均被必填校验拒绝。

首次正式提审的剩余动作：填本应用联系人与版权/内容声明，确认价格与地区和必要资质；公开支持/隐私页并匿名核验，填URL，发布隐私答案；完成最终法务内容的下一生产构建、上传和处理，关联对应Apple build；展示完整最终摘要，核对后“添加以供审核”，继续最终“提交以供审核”。必须确认 App Review 的 Waiting for Review/In Review 等实际状态并保存正式submission ID、时间和截图。当前并未达到这个阶段，不把TestFlight提交代替它。

若补充App内联系方式、修改法务文字或其他产品代码，需要先验证并重建下一生产构建号，再上传、处理和关联该新构建。当前工作区新增了分享隐私说明；已上传4与已构建Android3的原文尚未包含该补充。最终提审必须核对所选包与最终法务资料，不能只凭“最新上传”选择旧包。

## TestFlight 与 iPhone 安装

[本应用TestFlight](https://appstoreconnect.apple.com/teams/35eae2d8-e82b-42cb-b481-f0b20d0fb72f/apps/6821271597/testflight) 已建立：

| 组 | ID | 构建/测试者/链接 |
| --- | --- | --- |
| Team (Expo)，内部 | f6096459-cc7f-421b-ad5c-b6cc1fbf8683 | 已关联Apple build4；0测试者 |
| 一日一念 External，外部 | e70946c3-b95d-4ba6-a9d9-c223e1c706ed | 未关联外部可测构建；0测试者；publicLinkEnabled=false，无链接 |

构建4中文“测试内容”已保存，betaBuildLocalization ID `af7c5c8d-42f6-4a98-a6a6-60c9d16e5b86`。反馈邮箱、Beta Review联系人和隐私URL仍缺，因此首次外部Beta审核未提交。没有邀请团队，也没有开启公开邀请。

自己测试：在iPhone安装Apple官方TestFlight；使用获本应用访问权限的App Store Connect用户，把本人加入内部组后，用邀请邮件/兑换入口在TestFlight接受并安装1.0.0(4)。内部组成员须具备适用的App Store Connect角色和本应用访问权限，不要求注册UDID。当前0测试者，所以仅有包上传成功，尚无本人安装邀请。

团队测试：用户先提供授权邀请的邮箱名单；外部组在必填信息齐全后提交首次Beta App Review，等待批准，再发邀请或明确授权后开启公开链接。测试者用TestFlight接受、安装、通过TestFlight发送反馈。外部测试者不必成为App Store Connect用户，也不要求注册UDID。TestFlight构建最长90天有效，本轮Apple记录到期2027-01-08北京时间约15:57。

iOS内部Ad Hoc安装是另一条路径：[preview构建页](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/684115fb-db82-4b08-9da9-8f9c47d3b3f4)。当前profile只有一个既有注册设备。新增iPhone先在本项目目录运行EAS device:create，让设备持有人按登记链接安装描述文件提交UDID；通过本Team注册后重建preview或针对指定preview执行build:resign。EAS安装页面只对profile包含的设备有效；达到Apple年度设备注册限制后不能靠公开链接绕过。商店/TestFlight包不受Ad Hoc设备列表限制。

## 支持/隐私页面与数据审计

共享离线文本已进入App。“我的 → 隐私说明/使用帮助”可离线阅读。公开页面源由 `npm run mobile:legal:prepare` 重建，不需要Web SDK或分析脚本。Sites项目、部署ID及来源commit保存在 store/support-site.json；生成目录sites/cyber-bless-support是本应用独立Sites源码checkout，排除根Git和EAS归档。页面源逻辑和共享文本在根项目中保存，可在新checkout重建并沿用原Sites项目，不能重复创建新站点身份。

私有审阅部署于16:01:15完成，项目 `appgprj_6ac9ef2b05948191ac9ad8cb7bf4c9d5`，deployment `appgdep_6ac9f0bd26c88191937290cb7080078a`：[审阅站点](https://cyber-bless-support.syrupyfern16.chatgpt.site)。这不是匿名可访问的商店合规URL。拟定公开路径为 /privacy/ 和 /support/，待公开邮箱确认并更新部署/公开访问后再填写商店。发布准备时必须检查匿名HTTP200和实际正文，不能仅看Sites私有部署成功。

| 审计项 | 当前1.0.0构建事实与披露 |
| --- | --- |
| 账号/登录/云同步 | 无；记录仅本机，不上传开发者服务器 |
| 权限 | Android INTERNET、VIBRATE及自身广播权限；无危险权限。iOS无相机、麦克风、定位请求 |
| 分析/广告/崩溃/支付 | 无相应SDK、跟踪、订阅或IAP；构建工具遥测不属于App运行时SDK |
| 网络 | 当前未配置在线目录/manifest；基础资源随包。以后启用内容服务须核对IP/日志保存及第三方收集 |
| 用户分享 | 主动调用系统分享/复制文本；接收服务由用户选择，无开发者分享服务器 |
| 支持/TestFlight/系统备份 | 用户主动反馈及平台系统行为按平台政策处理；不得把开发者主动加入的SDK收集当作平台例外 |
| iOS Privacy Manifest | 实际IPA包含九份manifest；数据收集列表为空，tracking=false；聚合required API理由为UserDefaults CA92.1、文件时间戳C617.1、启动时间35F9.1 |
| 加密 | 无自定义业务加密；实际用途为系统HTTPS和资源SHA-256完整性，不以哈希当作加密。Apple处理确认usesNonExemptEncryption=false |
| 版权 | 字体两份OFL随包；模型本项目制作；两张用户UI图片发行权需确认 |

当前App Privacy无收集答案已保存但未最终发布。Android Data safety草稿同样基于当前无服务端收集/分享，必须在Play记录建立后核对实际问卷并保存；目前不能声称Play已填写。以后增加账号、线上日志、分析、广告、诊断或支付时必须重新审计和披露。

## Google Play 独立核查与 Android 安装

[当前Play Developer控制台](https://play.google.com/console/u/0/developers/9079668922252340806/app-list) 为个人账号。开发者记录存在，但身份文件验证未完成；电话验证依赖身份批准，“创建应用”禁用。付款状态与设备验证完成状态未获得独立确认。没有本应用Play记录、Play App Signing设置、有效的应用发布服务账号或internal测试链接；没有尝试上传到错误应用。

17:02通过EAS官方SDK按本项目ID和包名读取远程凭据，确认Android keystore存在、默认构建凭据属于本应用，googleServiceAccountKeyForSubmissions为空；未读取或输出私钥到文件。安全摘要保存在artifacts/mobile-verification/android-credentials-status.json。

用户必须在该控制台完成其要求的身份文件、电话、必要的实体Android设备验证及任何付款/协议提示。身份文件、OTP、付款与协议由用户本人处理。解锁后创建本应用：一日一念，应用，默认中文，包名com.helio.cyberbless；进入App Integrity核对Play App Signing，保留本轮EAS上传密钥。不要选择Historia的商店记录。

按[Expo当前EAS Submit Android官方流程](https://docs.expo.dev/submit/android/)在Google Cloud启用Android Developer API，并为本应用配置Google服务账号。Play用户/权限只授予该服务账号本应用所需测试轨道发布权限与必要查看权限，避免全局Admin或无关应用访问。通过 `npm exec -w @wbr/mobile -- eas credentials -p android` 的EAS Submit凭据入口上传JSON到EAS远程，不提交JSON到Git。当前官方流程可用EAS Submit完成首次上传；若本账号/应用实际返回必须控制台处理的错误，再根据错误安排手动步骤，不采用“首次必然手动”的旧结论。

凭据就绪后只上传已完成的AAB3：`npm run mobile:eas:submit:android -- e48070df-7315-47c1-b014-fc07cf76fb4d`。本轮没有执行该上传，因为账号尚无法创建应用。核对实际versionCode3、包名、internal轨道、release状态及可加入测试入口。后续新版本使用mobile:eas:android:internal构建并自动提交，production公开轨道必须另获明确授权。

商店中文名称、简介、说明、图标/置顶图与手机截图准备在store/android和store/screenshots/android；隐私、无广告、无登录的应用访问说明与Data safety依据本审计填写。内容分级需要在控制台完成真实问卷，不能将Apple9+直接当作IARC结果。目标受众与地区需用户确认，未宣称儿童专用；闭测/生产访问也未申请。

新个人账号的后续公开生产访问通常要求至少12位测试者连续加入封闭测试14天，并通过生产访问申请；以当前账号实际控制台要求为准，[Google官方说明](https://support.google.com/googleplay/android-developer/answer/14151465)。internal测试不替代此闭测要求，本轮范围止于internal。

现在安装APK：在Android设备打开[APK preview构建页](https://expo.dev/accounts/cheblito/projects/cyber-bless/builds/19fdef42-3a5f-4103-875a-9bc96891d51a)，下载APK，为该下载来源临时允许安装未知应用，核对一日一念后安装；安装后可关闭该来源许可。最低Android7.0。AAB不能直接点击安装。Play就绪后：把用户授权的Google邮箱加入internal测试者列表，测试者用该账号访问真实加入测试链接，接受测试并通过Play安装。当前没有链接或邀请，不能凭包名猜测测试URL。

## 继续工作所需的最少用户事实

1. 公开支持/反馈邮箱；本应用版权发行主体；App Review与Beta Review联系人的名字、姓氏、邮箱、国际格式电话。可以明确授权复用指定已有事实；不能默认跨应用复制私密信息。
2. 确认两张现有UI参考图具备商业发行权；确认免费或其他定价、首发地区（建议先排除未提供相关资质的地区），以及适用的地区资格/DSA经营者事实。需要法律承诺的最终操作在具体资料准备后核对。
3. 在Play控制台完成阻塞的身份、电话及控制台要求的付款/设备验证；提供被授权邀请的测试者名单后才发邀请。没有名单也可以先完成构建和审核准备。

Chrome原版本页出现“未保存的更改将会丢失”确认框，用户选择稍后处理；未强行关闭。已用官方API和新页继续完成独立资料、隐私草稿及终端工作。审核联系人空值是独立且真实的提审阻塞；解除浏览器框不会代替必填事实。

本轮证据位于 artifacts/store-evidence：apple-bundle-id.png、app-store-record.png、apple-processing-build-4.png、app-review-contact-required.png、app-privacy-draft.png、app-info-9plus.png、google-play-verification-required.png。API原始状态的安全摘要位于artifacts/mobile-verification，构建/提交/包检查脚本可重取最新状态。最终正式审核与Play发布截图目前不存在，因为尚未提交。验证详细边界见mobile-app.md。
