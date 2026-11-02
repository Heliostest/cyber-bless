# 通用 UI 音效素材来源核查

核查日期：2026-11-03。范围：Three.js 场景内部交互以外的应用操作反馈。本文保存素材下载与授权的研究依据；最终接入采用的派生文件见 [操作盘点与实施](2026-11-03-ui-operations-audio-audit.md) 和 [素材 README](../../assets/ui-sounds/README.md)。

## 结论与试听边界

建议先试听 **Kenney Interface Sounds 1.0** 作为统一基础音色：包内有相应的点击、选择、开关、展开、收起、确认和询问素材，100 个文件均已实际下载，包内授权明确为 CC0。它能让按钮、页面与提示使用同一套素材来源。[官方素材页](https://kenney.nl/assets/interface-sounds)

素材筛选依据覆盖范围、文件长度、体积与授权便利性；文件名不作为听感证明。用户已授权按推荐直接接入，最终派生短音经过低通、音头／尾音包络与低峰值处理；手机扬声器、耳机的主观听感仍需实际试听。下列 8 个原件是研究时的候选，保存／领取候选未替换产品中原有结果音。

更偏轻盈、音乐感的替代候选是 **Nomagician Cute, Cozy & Magical UI Sound Effects**：作者如此描述其用途，官网和包内 readme 均标注 CC BY 4.0。该包可以商用，但需要完整署名、许可证链接及修改说明。它的实际文件仅用字母命名，不能在未试听时给每个字母编造操作语义。[作者素材页](https://nomagician.itch.io/cute-ui-sound-effects)

所有下载原件和压缩包位于被 Git 忽略的 `artifacts/ui-sounds/`，没有覆盖改写。机器可读原件清单、时长、声道数与 SHA-256 分别保存在该目录的 `interface-inventory.json`、`ui-audio-inventory.json`、`nomagician-inventory.json`，首批候选见 `shortlist.json`。正式派生 WAV、原始许可和加工 manifest 单独保存在 `assets/ui-sounds/`。

## 首批 8 个代表文件

以下映射是试听用假设，最终按钮、导航、模态框、保存和奖励事件由应用操作审计统一确定。`gain=0.5` 只是试听起点，不是已归一化的生产音量。所有文件均为原包中的 44.1 kHz Ogg Vorbis；时长由容器的最终 granule position 和采样率计算，未进行听感验收。

| 暂定角色 | 原包路径 | 时长 | 原始字节数 | 本地原件 |
| --- | --- | ---: | ---: | --- |
| 轻触按钮 | `Audio/pluck_001.ogg` | 0.1024 秒 | 6,317 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/pluck_001.ogg) |
| 切换选项 | `Audio/select_001.ogg` | 0.0433 秒 | 5,468 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/select_001.ogg) |
| 打开面板 | `Audio/open_001.ogg` | 0.1478 秒 | 9,834 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/open_001.ogg) |
| 关闭面板 | `Audio/close_001.ogg` | 0.1478 秒 | 9,915 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/close_001.ogg) |
| 设置开关 | `Audio/toggle_001.ogg` | 0.1393 秒 | 7,369 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/toggle_001.ogg) |
| 保存成功 | `Audio/confirmation_001.ogg` | 0.2898 秒 | 8,968 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/confirmation_001.ogg) |
| 领取／完成 | `Audio/confirmation_002.ogg` | 0.5390 秒 | 14,169 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/confirmation_002.ogg) |
| 需要注意 | `Audio/question_002.ogg` | 0.3325 秒 | 9,455 | [试听原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/Audio/question_002.ogg) |

8 个原件共 71,495 字节。没有把 `glitch_*`、`scratch_*`、激光或长滚动声放入首批试听；这是避免刺耳、重复和过长反馈的产品假设，仍需要试听验证。注意提示先尝试 `question_*`，不预设每个失败都需要明显的错误蜂鸣声。

## 三套实际下载的素材

### A. Kenney Interface Sounds 1.0：优先试听

- 官方正文实际已读：列出 100 个文件、2020 年 1.0 版本与 Creative Commons CC0。[官方页](https://kenney.nl/assets/interface-sounds)
- 包内 `License.txt` 实际已读全文：作者为 Kenney，允许个人、教育、商业项目，署名非强制。原文保存在 [本地授权原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-interface/License.txt)。
- 实际解包确认：`Audio/` 下 100 个 `.ogg`，含 `back_*`、`click_*`、`close_*`、`confirmation_*`、`drop_*`、`error_*`、`glass_*`、`glitch_*`、`maximize_*`、`minimize_*`、`open_*`、`pluck_*`、`question_*`、`scratch_*`、`scroll_*`、`select_*`、`switch_*`、`tick_*`、`toggle_*`。
- 压缩包：[kenney_interface-sounds.zip](D:/ws/app/cyber-bless/artifacts/ui-sounds/originals/kenney_interface-sounds.zip)，834,536 字节。
- ZIP SHA-256：`f2193d072726d6758a5f7871b2dcc54dcce0d5c35c6f0a62f92549b327c81232`。
- 主要限制：原件只有 Ogg，原生 WebView 的解码与离线载入仍需在实际支持的 iOS／Android 版本上验证。本文没有运行终端设备测试；格式可用不等于实际设备音频已经验收。

当前下载方式：在官方页选择 Download → Continue without donating。实时页面调用 [官方下载链接端点](https://kenney.nl/download-link/6173736574732f696e746572666163652d736f756e6473) 取得短期签名 URL，再下载文件；端点需要该站会话／来源信息。核查时，搜索工具暴露的旧静态 URL `https://kenney.nl/media/pages/assets/interface-sounds/fa43c1dd4d-1677589452/kenney_interface-sounds.zip` 返回 HTML，不能当作音频包保存或作为成功下载证明。最终采用当前页面流程取得的有效 ZIP，并通过实际解包和魔数确认。

### B. Kenney UI Audio：短操作备选

- [官方正文](https://kenney.nl/assets/ui-audio) 实际已读：页称 50 个文件、2012 年 1.0 版本、CC0。
- 包内 `License.txt` 实际已读全文：内容名称为 UI SFX Set，作者 Kenney Vleugels；个人与商业项目可用，署名非强制。[本地授权原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/kenney-ui/License.txt)
- 实际解包有 **51 个** `Audio/*.ogg`：`click1`–`click5`、`mouseclick1`、`mouserelease1`、`rollover1`–`rollover6`、`switch1`–`switch38`；另有压缩包根目录的 `Preview.ogg`。因此“50”是页面描述，不作为本地文件数量断言。
- 压缩包：[kenney_ui-audio.zip](D:/ws/app/cyber-bless/artifacts/ui-sounds/originals/kenney_ui-audio.zip)，411,949 字节。
- ZIP SHA-256：`946fc23a63d535d693eb31b2eabb80c8c28d6351e2186b344ceb71b2cb1d5eb6`。
- 下载使用 [官方下载链接端点](https://kenney.nl/download-link/6173736574732f75692d617564696f) 和官方页面的短期签名流程；旧静态路径不作为可持续的直链入口。
- 适用判断：可补充轻触和开关的不同候选，但缺少第一套清晰的开合、确认、询问分类。不能仅凭 `switch*` 文件名判断哪个柔和。

### C. Nomagician Cute, Cozy & Magical UI SFX：音乐感备选

- [作者官方正文](https://nomagician.itch.io/cute-ui-sound-effects) 实际已读：描述为适合轻松体验的 UI 声，标注 WAV 24-bit／48 kHz、MP3 320 kbps／48 kHz、CC BY 4.0，作者建议署名 `Nomagician Music`；说明声音采用 C 与 G 大调。
- 包内 `readme.txt` 实际已读全文：作者为 Nomagician Music／Roman T.，写明来自合成器或免费 VST 加处理，并明确指向 CC BY 4.0。[本地 readme 原件](D:/ws/app/cyber-bless/artifacts/ui-sounds/nomagician/readme.txt)
- 页面称 22 个声音；实际解包为 **26 个 WAV、24 个 MP3**。WAV 名称为 `a`–`w` 加 `h2`、`i2`、`u2`；MP3 缺少 `n`、`o`。不会据官网数量假设每个格式都一一齐全。
- WAV 容器实测均为 48 kHz、24-bit、双声道；文件长度约 0.4286–2.5714 秒。`u.wav`（0.4286 秒）、`u2.wav`（0.5357 秒）、`l.wav`（0.6429 秒）可以作为短备选的试听入口，**字母不具有官方操作含义**。
- 压缩包：[nomagician-cute-ui.zip](D:/ws/app/cyber-bless/artifacts/ui-sounds/originals/nomagician-cute-ui.zip)，8,679,257 字节；作者提供的原始下载名为 `Cute, Cozy & Magical UI SFX - by Nomagician.zip`。
- ZIP SHA-256：`ddcda60fca933b3b16c5ba614e2513f19503bbfb1bf871999f69b118329fdb50`。
- 下载入口为 [作者下载页](https://nomagician.itch.io/cute-ui-sound-effects/purchase)，选择免费继续下载；本次实际取得上传编号 `15647651` 的文件。itch.io 的 `/cute-ui-sound-effects/download_url`、`/cute-ui-sound-effects/file/15647651?source=game_download` 生成临时地址，不应把带签名参数的 CDN URL 写为永久素材来源。

如果采用这套，需要在应用素材致谢中记录作者、作品来源、[CC BY 4.0 链接](https://creativecommons.org/licenses/by/4.0/) 和实际处理说明（如增益、裁尾、转码）。[CC 官方正文](https://creativecommons.org/licenses/by/4.0/)明确允许商业复制、分发和改编，同时要求署名、许可证链接、变更说明，不得附加妨碍该许可自由的限制。

## 许可正文与访问状态

以下全部为本次实际打开并阅读的第一方正文，不使用搜索摘要替代授权核查。

| 正文 | 访问状态 | 本文采用的支持范围 |
| --- | --- | --- |
| [Kenney Interface Sounds](https://kenney.nl/assets/interface-sounds) | 已读官网正文；已下载并阅读包内 License.txt | 发布者、CC0、页面文件数、版本；文件名与 hash 依据实际 ZIP |
| [Kenney UI Audio](https://kenney.nl/assets/ui-audio) | 已读官网正文；已下载并阅读包内 License.txt | 发布者、CC0；页面数量与实际数量分别记录 |
| [Nomagician Cute UI SFX](https://nomagician.itch.io/cute-ui-sound-effects) | 已读作者正文；已下载并阅读包内 readme.txt | 作者、格式描述、CC BY 4.0；实测数量另列 |
| [CC0 官方说明](https://creativecommons.org/publicdomain/zero/1.0/) | 已读正文 | 允许复制、修改、商业分发，无需另行请求许可 |
| [CC0 法律文本](https://creativecommons.org/publicdomain/zero/1.0/legalcode.en) | 已读第 1–4 节正文 | 权利放弃、失效时后备许可、限制与不作担保；不把 CC0 解释成商标背书 |
| [CC BY 4.0 官方说明](https://creativecommons.org/licenses/by/4.0/) | 已读正文 | 允许商业使用／改编，署名、许可链接、变更标记与不得附加限制的要求 |

保留包内原始授权文件和下载 hash，可让后续资源入库时追溯具体输入。CC0 不强制署名，但仍建议在第三方素材记录中保留 Kenney、来源 URL、版本、输入 hash 和处理步骤。

## 已核对但未选入首批的来源

| 来源 | 读取与结果 | 本轮处理 |
| --- | --- | --- |
| [SFXMint Soft UI](https://sfxmint.com/sets/ui-soft)、[其授权页](https://sfxmint.com/license) | 两页正文已读。当前包页列 61 声；授权页称站内库为 CC0，可商用、修改、随付费产品分发；同时当前下载服务每日 3 次，ZIP 随付费提供。作者说明音频来自自身 AI 模型生成或程序合成。 | 没有把搜索结果里的“12 声免费整包”沿用为当前下载承诺。本轮未下载、未调用生成服务；优先现成 CC0 原包。 |
| [R4orce Free Cute UI Sound Pack](https://r4orce.itch.io/cute-ui-sound-pack) | 作者正文已读：40 个 WAV、48 kHz／24-bit／mono，个人与商业项目可用，同时禁止原件再分发／转售，完整条款在包内 LICENSE.txt。 | 未下载、未读包内完整条款，不把“royalty-free”当作可向公开仓库提交原件的证明。 |
| [Kenney Digital Audio](https://kenney.nl/assets/digital-audio) | 官网正文已读：60 个文件、CC0，标签为 space／laser。 | 本轮不下载；这类声音是否适合轻柔操作没有已试听证据，也没有必要为日常操作引入太空／激光候选。 |

## 后续制作与验收约束

- 先用首批候选进行有限试听，再定每类操作的最终音色。避免为每个按钮分配独立声音；相同语义复用同一音色，完成、保存和领取只在操作真正成功后响。
- 保留原件；如需要去掉首尾空白、缩短尾音、微调包络、改变增益或转码，生成派生文件并记录处理。当前文件时长由容器计算，不表示其中每个采样点都有声音，也不表示尾音已裁到合适长度。
- 试听时用实际快速操作核对重叠与疲劳，注意按钮轻触不能持续盖过确认／奖励。高频操作需要短、轻；奖励不应每次导航都出现。不要自动把普通不可用操作处理成刺耳蜂鸣。
- 实现时继续使用应用统一静音／音量、用户手势解锁和离线资源机制；是否增加开关需要与既有设置行为一致。不能把研究网页热链当成离线发布资源。
- 本文的素材来源研究证明下载、容器和授权；后续应用接线、浏览器解码、交互回归与资源打包验证单独记录在 [实施记录](2026-11-03-ui-operations-audio-audit.md)。主观听感、原生实机解码／硬件静音键及其他播放音频的混音策略尚未验收。

本次没有修改器物、场景动作、寓意、标题、介绍或来源卡，也没有把通用 UI 音色附会为任何地区、民族或传统音效。
