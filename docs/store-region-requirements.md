# 一日一念：首发地区备案与资质核查

核查日期：2026-10-13。应用：一日一念，`com.helio.cyberbless`，App Store Connect `6821271597`。本文为本次发布的资料核查记录；没有修改商店地区，也没有办理或取得任何许可证。

本次研究前，商店选中了 175 个地区。已知德国状态包含 `TRADER_STATUS_NOT_PROVIDED`；中国大陆和越南当时只有尚未发布相关状态，没有读到明确的缺少 ICP、游戏许可错误。因此下表中的条件性许可，不能写成 Apple 已确认本应用缺证。

开发者最初确认个人爱好用途，随后明确首发加入体验后买断。非商业用途的DSA判断已由此更新，现按经营者方向准备，已获授权填写公开联系资料，仍停在邮箱验证码验证。旧生产包与主工作目录仍免费、无广告或内购；隔离工作目录已实现计费接口和购买/恢复页面，体验门槛和价格待选择。当前发布配置无账号、云同步或在线内容目录地址，基本功能和素材在本机运行。应用包含文化/民俗互动、木鱼、心愿记录与收藏；是否属于受管制游戏、宗教信息或出版服务，要按实际画面、文案及功能判断，不能仅凭 `LIFESTYLE` 分类、免费或离线作结论。

## 哪些地区需要重点处理

| 地区 | 事项及触发条件 | 对本应用的当前结论 |
| --- | --- | --- |
| 中国大陆 | 提供互联网信息服务的 APP 备案；游戏、宗教信息、网络出版、新闻另有许可 | ICP 的纯离线适用性，以及游戏/宗教内容性质尚需核实。建议首发暂缓大陆，或取得主管部门和 Apple 对适用性的确认后再保留。 |
| 越南 | 游戏服务资质及每款游戏发行许可/确认，范围包含联网下载后离线运行的 G4 游戏 | 若被认定为游戏，离线不能排除许可；个人开发者需越南合资格发行主体。建议在性质确认或许可完成前暂缓。 |
| 韩国 | 达到 Apple 指定敏感内容/成人游戏条件时需要 GRAC 分级类别号码 RCN | 当前没有证据显示达到条件，不应笼统要求所有 App 办韩国游戏牌照。 |
| 欧盟 27 国 | DSA 经营者身份声明；经营者需验证并公开联系资料 | 开发者补充商业化意图后，现按经营者方向准备；DSA不是要购买的许可证。公开地址、电话、邮箱须明确授权并完成验证。 |
| 印度尼西亚 | 符合范围的在线电子系统 PSE 登记；游戏另有 IGRS 分类程序 | 纯离线普通工具与在线服务有区别，但交互场景是否落入当地游戏定义尚未确认。需确认分类及现行登记入口，不能默认已被 Apple 判缺证。 |
| 巴西 | 通常的年龄分级由商店问卷生成；儿童数字保护 ECA Digital 可能另要求年龄信号和境内法律代表；投注产品另需许可证 | 本应用不是投注产品。低龄可访问的文化互动 App 是否落入 ECA 范围、可适用哪些义务/例外，需专项核查；不是所有免费 App 都要办营业执照。 |
| 澳大利亚、新加坡、英国、美国 | 年龄分级、特定年龄核验；医疗、赌博等功能另有行业义务 | 没有发现本应用当前功能导致通用 APP 备案要求。年龄核验与经营许可证是不同问题，见后文。 |

Apple 的地区许可证字段主要涉及中国大陆、越南和韩国；DSA 是另一项身份声明。这不是对 175 个司法辖区全部法律的穷尽确认。[Apple 应用信息及地区要求](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)

## 中国大陆怎么办

### 1. APP 备案号与 ICP 经营许可证不是一回事

工信部的 APP 备案流程面向互联网信息服务：由接入服务商或应用分发平台核验资料，提交主办者住所地省级通信管理局；结果可在备案系统查询。免费并不自动豁免备案，也不能把 APP 备案号当成 ICP 经营许可证。[工信部 APP 备案解读](https://www.miit.gov.cn/jgsj/xgj/hlwgl/art/2023/art_564bf0759d7e41d5b4aa8ce4996b9e84.html)

中国互联网协会的备案 FAQ 给出“单机不联网”应用无需核准的说明；这是协会的一手业务说明，不是 Apple 对本应用的豁免确认。当前发布配置没有在线内容地址，但仍应检查正式包的全部请求、更新模块及外链行为，并向住所地通信管理局和 Apple 说明真实网络边界；“断网仍能用”不足以证明从不提供互联网信息服务。[中国互联网协会：不需要核准的情形](https://www.isc.org.cn/article/17570944022605824.html)

如果需要备案，个人可按真实自然人主体准备身份证明、住所/联系资料，App 名称与图标、iOS/Android 包标识、签名公钥及 MD5、域名/接入信息、SDK 清单和服务内容；有前置审批内容时还要提交相应批件。由实际接入商或分发平台受理，不要为纯离线产品编造域名、服务器或业务。备案登记表有自然人和 APP 专用字段。[通信管理局备案登记表及填表说明](https://xzca.miit.gov.cn/bsfw/bszn/art/2024/art_5d3cc7f452c04fdd97b6881a20b656f9.html)

取得本应用备案后，在 [工信部备案查询](https://beian.miit.gov.cn/) 核对，再填入 App Store Connect → App 信息 → 中国大陆销售范围。备案名称、主体与商店元数据须匹配；不得复用另一款 App 的号码。[Apple ICP 信息匹配要求](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)

### 2. 如果被认定为游戏：出版审批/版号

国家新闻出版署的国产网络游戏审批要求具有游戏出版资质的出版单位参与，运营机构也有企业及 ICP 经营许可要求；个人作者不能凭 Apple 个人账号直接完成这套出版运营资质。实际路径是先取得主管部门对产品性质的判断；确需按游戏出版时，和具有相应资质的境内出版/运营主体合作，由其按省级出版部门→国家新闻出版署流程申报。[国家新闻出版署：出版国产网络游戏作品审批](https://www.nppa.gov.cn/bsfw/xksx/cbfxl/wlcbfwspsx/202210/t20221013_600725.html)

申报资料包括游戏申请表、著作权证明、运营主体资质、截图、中文脚本、内容审查材料及适用的防沉迷说明/测试信息；以出版单位采用的最新目录为准。通过后才有本游戏对应的批准文件/ISBN，向 Apple 提交与运营主体相匹配的证明。改成“生活方式”分类不会替代审批。[国家新闻出版署申报材料与填报说明](https://www.nppa.gov.cn/bsfw/xksx/tbsm/)

### 3. 如果涉及宗教信息：互联网宗教信息服务许可

许可范围包括面向公众的宗教教义、知识、文化、活动信息，不只包含直播或讲经。申请主体须为境内依法设立的法人组织或非法人组织，自然人个人不符合该主体条件；有许可也不代表可以自由组织线上宗教活动。[国家宗教事务局《互联网宗教信息服务管理办法》第六至七条、第十五至十七条](https://www.sara.gov.cn/static/content/xxgk/bmgz/2021-12-20/1306305918975082496.html)

本 App 的文化背景、木鱼及祈愿表现需要按全部实际内容核查。离线、民俗致敬说明或“不承诺功效”文案都不能自行证明不在范围内。应向所在地省级宗教事务部门提供画面、文案、内容目录及网络边界说明；确认需要许可后，由符合条件的主体申请，不能直接借用别人的号码。

正式申请需主体登记与负责人身份证明、受过相关培训的内容审核人员说明、信息与安全管理制度、技术保障、场所/资金、近三年守法承诺、栏目功能和域名资料。具体在住所地省级政务服务平台办理；国家宗教事务局给出的服务指南可用于对照资料。[国家宗教事务局行政许可服务指南](https://www.sara.gov.cn/image/attachDir/2023/06/2023061509025979652.PDF)

### 4. 网络出版、新闻及其他专项

如果产品提供受管制的图书/期刊等网络出版服务，需有相应出版许可；并非普通 App 有说明文字就当然成为出版服务。出版单位设立审批涉及主体、人员、出版平台及境内服务器等要求，应由有资质主体向省级出版部门申请后上报国家新闻出版署。[《网络出版服务管理规定》](https://www.nppa.gov.cn/xxgk/fdzdgknr/zcfg_210/bmgz_213/202112/t20211209_442163.html)

若以后增加互联网新闻采编、转载或传播平台，许可主体须为境内法人，采编还有限定主体；材料包括人员资质、制度、安全评估、场所资金和法人证明。当前没有发现本应用提供新闻服务，不把它列为已缺材料。[国家网信办《互联网新闻信息服务管理规定》](https://www.cac.gov.cn/2017-05/02/c_1120902760.htm)

以后增加校外培训、医疗、药品、金融或广播视听服务，还要另查前置审批。现在不因文化介绍或放松体验就要求办理这些行业许可。

## 越南怎么办

Apple 要求在越南发行的游戏具有当地许可。越南官方最新说明将 G4 定义为经网络下载、没有玩家之间或玩家与企业服务器交互的游戏，因此单机游戏仍可能进入许可体系。[Apple 越南游戏公告](https://developer.apple.com/news/?id=06h4gf33)、[越南官方 Decree 147 最新说明](https://game.gov.vn/tin-tuc/current-regulations-on-online-video-games-government-decree-1472024nd-cp-on-the-management-provision-and-use-of-internet-services-and-cyber-information-decree-147-38n3)

若本 App 被认定为 G4，个人作者通常需要越南合资格发行主体：先取得 G2/G3/G4 游戏服务证书，再为本款游戏取得发行通知确认。官方列有主体登记、服务方案、人员/资金、技术系统、域名/渠道和知识产权等材料；向发行主体所在地省级文化体育旅游主管部门办理，G1 则有中央 ABEI 路径。开发者不应自行给这个无账号产品添加实名系统去猜测满足全部游戏运营要求，应由当地合资格发行方确认适用技术义务。[越南官方服务及发行申请路径](https://game.gov.vn/tin-tuc/current-regulations-on-online-video-games-government-decree-1472024nd-cp-on-the-management-provision-and-use-of-internet-services-and-cyber-information-decree-147-38n3)

取得文件后，App Store Connect → App 信息 → 越南销售范围填写本游戏许可并附文件；Google Play 要求保留许可并展示法规规定的信息，可从 [越南 ABEI 许可入口](https://giayphep.abei.gov.vn/) 查询/办理。许可费用、审批时间及外国个人的合作方式应由实际发行主体核实，本文不承诺结果。[Google Play 越南要求](https://support.google.com/googleplay/android-developer/answer/6223646?hl=en)

## 韩国怎么办

Apple 指定的 RCN 条件包括 GRAC 的 KR-19 分级、特定成人 Casino 应用，或 Games/Entertainment 中频繁/强烈的模拟赌博、性裸露、酒烟毒品、写实暴力。当前低龄、无这些内容的 App 没有证据触发；所有 App 都办理 GRAC 的说法不成立。[Apple 韩国 RCN 条件](https://developer.apple.com/help/app-store-connect/reference/app-information/app-information/)

2026-08-12 起，已有 GRAC 官方分级的应用可在新版本提交时用 RCN 覆盖韩国年龄分级；2026 年 10 月部分低频粗俗语言/成人主题对应年龄上调。这是分级更新，并非对一日一念新增了通用营业许可。[Apple 韩国分级更新](https://developer.apple.com/news/?id=oj3r9pvw)

如果实际触发单独审批，向 [GRAC](https://www.grac.or.kr/english/) 咨询；境外开发者可能需韩国出版商/代理或本地机构，准备游戏说明、内容摘要、画面视频、游戏文件、费用证明及当地发行主体证明。评级机构 FAQ 说明，移动开放市场符合条件的低龄游戏可由平台分类；海外主体直接申请有资格限制。[韩国 GCRB 申请说明](https://www.gcrb.or.kr/English/Enforcement/Enforcement.aspx)

Apple 的韩国经营信息规则另有“开发者本身位于韩国”的适用条件，不等于中国个人仅勾选韩国地区就必须注册韩国企业。[Apple 韩国经营信息说明](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-korea-compliance-information)

## 欧盟 27 国：DSA 不是许可证

DSA经营者包括与商业、手艺或职业相关活动中的自然人，个人账号不自动等于非经营者。Apple的非经营者爱好者示例要求没有商业化意图；开发者随后明确考虑买断收费，因此本项目不再按早先非商业用途信息填写非经营者，现按经营者方向准备。[Apple DSA 自评及填写路径](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)

当前实测入口为：一日一念 → App 信息 → App Store法规和许可 → DSA“设置”，Apple要求先在商务 → 协议完成账号级声明。按当前商业化意图，已进入经营者联系资料表单，但尚未填资料或完成提交；经营者需要经明确授权的公开地址或邮政信箱、电话、邮箱，以及相应验证和地址证明。账号级声明完成后，再核对各应用自己的状态；不能把某个应用的纯爱好用途自动扩展到整个账号，也不能把审核用途的电话号码自动公开。即使不在欧盟发行，Apple仍要求声明身份。[Apple DSA 保存与验证步骤](https://developer.apple.com/help/app-store-connect/manage-compliance-information/manage-european-union-digital-services-act-trader-requirements/)

27 国为：奥地利、比利时、保加利亚、克罗地亚、塞浦路斯、捷克、丹麦、爱沙尼亚、芬兰、法国、德国、希腊、匈牙利、爱尔兰、意大利、拉脱维亚、立陶宛、卢森堡、马耳他、荷兰、波兰、葡萄牙、罗马尼亚、斯洛伐克、斯洛文尼亚、西班牙、瑞典。英国、挪威、冰岛、瑞士不在这个欧盟 27 国名单内。[欧盟官方成员名单](https://european-union.europa.eu/easy-read_en)

## 印度尼西亚：条件性的 PSE 与游戏分类

Komdigi 的 PSE 登记标准面向通过互联网提供特定电子信息、交易、通信、内容或个人数据处理服务的电子系统，外国提供者也可能适用。纯离线、本机记录 App 的适用性要结合真正联网功能判断；不能仅凭在商店下载就断言本应用已被认定为 PSE。[Komdigi PSE 登记范围](https://pse.komdigi.go.id/panduan/kriteria-pendaftaran-pse-lingkup-privat)

但《游戏分类》2/2024 对游戏的定义和发行者范围较广，列有 PSE 登记、发行者自行分类及主管部门确认程序，包含自然人发行者。当前互动仪式是否属于当地游戏定义尚未确认，不能用 Lifestyle 分类替代判断。若确认属于游戏，需同时查 IGRS 分类和 PSE 路径。[印尼官方法规库：2/2024 游戏分类](https://peraturan.bpk.go.id/Details/282034/permenkominfo-no-2-tahun-2024)

办理从 [Komdigi PSE 指南](https://pse.komdigi.go.id/panduan) 和 [OSS](https://oss.go.id/) 开始，按外国主体路径准备身份、系统/域名、业务、数据与服务说明；游戏分类联系 [IGRS](https://igrs.id/) 或官方帮助渠道确认当前受理方式。2026 年监管机构曾明确平台自行展示的评分不当然等于官方 IGRS 结果；本次未验证系统能否顺利受理外国个人，不声称已完成登记或分级。[Komdigi 对 IGRS 官方结果的说明](https://eppid.komdigi.go.id/berita/detail/kemkomdigi-rating-gim-di-steam-bukan-rating-resmi-berpotensi-langgar-ketentuan-di-indonesia)

## 巴西：分级与儿童数字保护分别核查

普通内容分级通常由 App Store 问卷生成；Google Play 使用 IARC/ClassInd。并没有从官方材料发现“所有免费个人 App 都要先取得巴西营业执照”这一要求。[Apple 地区分级](https://developer.apple.com/help/app-store-connect/reference/app-information/age-ratings-values-and-definitions/)、[Google Play 内容分级](https://support.google.com/googleplay/android-developer/answer/9859655?hl=en)

另外，ECA Digital 已于 2026-03-17 生效：面向或很可能被儿童/青少年访问的技术产品/服务可能进入范围；第 40 条涉及巴西境内法律代表，第 12 条等涉及年龄信号。免费、开发者人在国外或没有广告不是直接豁免。当前 App 有低龄可访问的互动画面，不能直接确认该法不适用；同时，本次没有确认它是否满足法定范围或内容编辑类例外。[巴西现行 ECA Digital 法律](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm)

操作路径是对照实际受众、内容及网络边界，查 ANPD 指南/向其咨询适用性；适用时安排境内代表，并设计所需年龄信号与安全措施。ANPD 的实施说明和供应商范围指南仍有更新，不能把征求意见稿的设想当成已生效豁免。[ANPD ECA Digital 官方专题](https://www.gov.br/anpd/pt-br/assuntos/eca-digital)、[ANPD 2026 年 9 月监管议程](https://www.gov.br/anpd/pt-br/assuntos/regulacao/agenda-regulatoria-1)

Apple 提供 Declared Age Range，Google Play 提供 Age Signals；商店完成下载年龄核验不自动免除开发者自身义务。本应用暂无这些桥接的验证记录，属于待专项评估，不是已完成。[Apple 年龄核验开发者问答](https://developer.apple.com/support/age-assurance)、[Google 巴西 ECA 要求](https://support.google.com/googleplay/android-developer/answer/6223646?hl=en)

巴西 2026-05-08 的 SPA 投注许可证要求针对固定赔率投注功能；本应用无真实金钱投注，不把这份证书列为待办。[Apple 巴西投注许可公告](https://developer.apple.com/news/?id=x4eyetnp)

## 其他基础合规与当前年龄规则

- 澳大利亚、新加坡、巴西的 18+ 下载成年核验由 Apple 执行；巴西开箱内容可被提高到 18+。一日一念当前不是 18+，没有付费开箱。它们不是需要个人开发者办理的通用 APP 备案。[Apple 2026-02-24 年龄规则](https://developer.apple.com/news/?id=f5zj08ey)
- 美国 Texas 的规则不能沿用 2025 年“暂停”结论：Apple 于 2026-06-03 宣布禁令解除后，从 06-04 对新账户恢复相关年龄/家长许可流程；09-14 的支持页仍列 Texas。发布到美国时需专项核查 App 的年龄信号及重大更新处理，不是填一个许可证号即可。[Apple Texas 更新](https://developer.apple.com/news/?id=sg176nne)、[Apple 2026-09-14 地区账户规则](https://support.apple.com/en-us/125666)
- Utah 开发者义务经 2026 年修法推迟至 **2027-05-06**；Louisiana 新法为 **2027-07-01**。Apple 02-24 新闻里的 2026 日期较旧，应以现行法律为准。当前不把这两州的未来义务写成已缺许可证。[Utah 现行 13-76-202](https://le.utah.gov/xcode/Title13/Chapter76/C13-76-S202_2026031820260318.pdf)、[Louisiana 2026 Act 185 第六节](https://www.legis.la.gov/Legis/ViewDocument.aspx?d=1475238)
- 年龄问卷自 2026 年 9 月起还要求回答社交媒体能力问题。系统分享一段文字与提供社交发现流是不同功能；按实际能力作答，不能因选了 Lifestyle 而跳过。[Apple 社交媒体问卷更新](https://developer.apple.com/news/?id=tlur8uvi)
- 如果以后改为 Health & Fitness/Medical 或频繁医疗治疗信息，欧盟/EEA、英国、美国有受管制医疗器械声明。当前的文化放松体验不据此认定为医疗器械，不应宣称治疗效果。[Apple 医疗器械声明范围](https://developer.apple.com/help/app-store-connect/manage-app-information/declare-regulated-medical-device-status)

## Google Play 的实质区别

大陆 APP/行业规定不是只针对 iOS；但 Google Play 发行设置不能替代中国大陆本地安卓商店的审核和备案。越南游戏许可、韩国成人游戏审批、巴西 ECA 也应分别满足；Play 的 IARC 问卷不代替条件性许可证。[Google Play 地区要求](https://support.google.com/googleplay/android-developer/answer/6223646?hl=en)

此外，Android 开发者身份及包名登记从 **2026-09-30** 起在巴西、印度尼西亚、新加坡、泰国的指定参与商店、认证 Android 7+ 设备实施。这是 Google 平台身份/应用归属验证，不是这四国的当地企业牌照。Play Console 可管理验证和包登记，Play App Signing 符合条件的应用可自动认领；普通直接侧载及 ADB 在本阶段有不同规则，不能泛称所有 APK 都已禁止安装。[Android 官方实施范围](https://developer.android.com/developer-verification)、[官方 FAQ：账户、签名与侧载](https://developer.android.com/developer-verification/guides/faq)

本项目已有的 Play 个人身份/设备验证和应用记录仍应实际完成；本次授权的 Android 目标保持内部测试，未授权公开生产发布。

## 本次首发建议与下一步

1. 按开发者补充的买断商业化意图，先完成DSA经营者公开联系资料授权、电话/邮箱验证和地址证明；不用申请不存在的“DSA证”。此前纯爱好用途的判断已被更新，不能照旧提交非经营者。
2. **建议先暂缓中国大陆、越南**，保留材料后向相应主管部门/Apple 确认游戏、宗教及联网服务边界；确认可免除或取得匹配资质后再加回。本文没有执行地区移除。
3. **印尼、巴西做专项确认后再定**：印尼主要是游戏/PSE 范围及分类受理，巴西主要是儿童可访问范围/例外、境内代表及年龄信号。不能把“Apple 未显示缺证”当成法律已确认。
4. 韩国在真实问卷及最终内容没有成人/敏感条件时，可继续按一般商店分类路径；未来改变内容再评估 RCN。
5. 其余地区先按实际最终产品完成隐私、版权、年龄问卷、基础商店资料及审核；美国年龄信号是需要技术/适用性核查的独立项。若选择先不做美国适用性核查，需要由开发者决定是否调整美国整个商店地区，不能仅在 Apple 国家列表里去掉 Texas。
6. 取证前先固定最终功能、截图、文化内容目录和正式包网络清单，这些材料可复用在主管部门咨询与 App Review 说明；不复制其他 App 的备案号、许可或主体身份。

未完成：没有取得主管部门对本应用性质的个案答复；没有确认巴西 ECA 及印尼登记/分类的具体适用结论；没有完成任何本地许可证申请；没有修改 175 地区选择；没有据本文提交正式审核或公开上架。
