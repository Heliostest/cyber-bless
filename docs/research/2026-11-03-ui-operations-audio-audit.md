# App 操作与界面音效盘点

核查日期：2026-11-03（Asia/Shanghai）。代码基线：`caef7c3f`。本次按实际交互入口盘点，并为同一含义的操作分配统一声音类别。用户已选择按推荐直接接入与验证，音色细节交由代理确定；实际接入和验证结果见文末。

## 范围与接入前状态

范围包括正式 App 的共享 React 界面、场景外壳、原生宿主入口及独立分享网页的界面。Three.js 场景内的拖动、敲击、折叠、倒水、步骤辅助按钮、近看与旋转，以及木鱼暂停／结束等场景控制，不纳入本次新增音效。现有场景声音维持原状。

场景外壳的返回、设置、介绍、收藏、分享、心愿表单和结果页属于 App 界面操作，可以纳入；不能对整个 `.scene-experience` 一刀切禁声，也不能在整个场景容器上自动给点击加声音。

原有声音入口见 [App.tsx](../../packages/app/src/App.tsx)、[context.tsx](../../packages/app/src/context.tsx) 与 [soft-audio.ts](../../packages/shared/src/soft-audio.ts)：

- 心愿创建、补充努力记录、确认实现、完成还愿，在持久化成功后播放 `saved`；无效／失败／未变化操作不发成功音。
- 收下与奖励飞行播放 `collect`；场景／仪式／新手流程完成播放 `complete`。这些是现有覆盖，不能再叠加一般点击音。
- 心愿架的小物触碰已有材质声音和触觉反馈，见 [wish-ritual-rack.tsx](../../packages/app/src/wish-ritual-rack.tsx) 与 [wish-object-feedback.ts](../../packages/app/src/wish-object-feedback.ts)。保留这套反馈，不替换为按钮音。
- `go`、`back`、筛选、展开收起、设置、收藏、归档及分享界面没有统一界面声音。
- Web 与 Expo 主要使用同一 DOM 界面和 Web Audio；原生桥接提供触觉、存储、分享等能力，没有独立原生音频播放器。

## 统一声音分类

可爱风格按圆润、短促、轻弹性处理，避免尖锐点击、长铃声、街机金币与警报。下列时长是剪辑目标；选定素材仍需对照原文件调整。

| 类别 | 听感与目标时长 | 触发条件 |
| --- | --- | --- |
| `navigate` | 轻圆点／小木珠，60–120 ms | 用户主动切到另一个页面或有效浏览一屏；同一页面重按不响 |
| `back` | 略低的轻落点，70–140 ms | 用户确实离开一层页面；自动路由不响 |
| `select` | 柔软的短 plip，50–110 ms | 筛选、单选、范围等值确实变化 |
| `toggleOn` / `toggleOff` | 同音色的一高一低，70–140 ms | 有效开关变化；关闭声音本身立即静音 |
| `open` / `close` | 成对的小气泡展开／回落，100–180 ms | 弹层、介绍、输入区域的实际开合；一次手势仅一个声音 |
| `saved` | 两声温和确认，约 200–420 ms | 需要持久化的提交实际写入成功；复用现有结果语义 |
| `collect` | 轻弹起与落定，约 250–460 ms | 收下／飞行只响一次；复用现有结果语义 |
| `complete` | 小幅上行的短乐句，约 350–580 ms | 保留已有完成反馈；本次不新增场景触发点 |
| `notice` | 很轻的低双音，100–220 ms | 用户主动操作明确失败时一次；普通提示、输入校验和自动报错安静 |
| 安静 | 无声音 | 输入、滚动、连续拖动、悬停、焦点移动、自动状态变化、无效／禁用／重复操作 |

`favorite` 和 `archive` 采用 `toggleOn` / `toggleOff`，无需各建一套音色。收藏不是领取奖励，不能使用 `collect`。

## 用户操作清单与映射

同一组件的重复卡片按一个操作类型记录；不是按渲染出来的按钮数量计数。定位链接指向实际交互文件。

| 界面 | 实际操作 | 分类与边界 | 接入前覆盖 | 代码 |
| --- | --- | --- | --- | --- |
| 全局 | 切换今日／心愿／小天地／我的 | `navigate`，重按当前标签安静 | 无 | [App](../../packages/app/src/App.tsx) |
| 全局 | 顶栏返回、法务页返回 | `back`，优先关弹层时仅 `close` | 无 | [App](../../packages/app/src/App.tsx)、[legal](../../packages/app/src/legal.tsx) |
| 全局 | 存档读取失败后重新读取 | 启动时 `select`；失败可 `notice`；读取成功不冒充保存 | 无 | [App](../../packages/app/src/App.tsx) |
| 全局 | 重试保存、关闭错误提示 | 重试 `select`；关闭 `close`；成功由待保存动作决定 | 保存成功已有部分覆盖 | [App](../../packages/app/src/App.tsx) |
| 今日 | 进入每日场景、回看已收下场景 | `navigate`，以主动入口触发，不等资源加载结束再响 | 无 | [home](../../packages/app/src/home.tsx) |
| 今日 | 接着未完的仪式 | `navigate` | 无 | [home](../../packages/app/src/home.tsx) |
| 今日 | 展开／收起已收下说明 | `open` / `close`，外部点击同时导航时不叠播 | 无 | [home](../../packages/app/src/home.tsx) |
| 新手 | 开始／继续当前场景 | `navigate` | 无 | [opening](../../packages/app/src/opening.tsx) |
| 新手 | 收下并进入下一件 | `collect`，不叠加导航 | 已有 | [opening](../../packages/app/src/opening.tsx) |
| 新手 | 完成初次体验 | `complete`，不叠加导航 | 已有 | [opening](../../packages/app/src/opening.tsx) |
| 心愿 | 切换进行中／已如愿／先放下 | `select`，值未变安静 | 无 | [pages](../../packages/app/src/pages.tsx) |
| 心愿 | 打开心愿、去许愿、进入详情空态引导 | `navigate` | 无 | [pages](../../packages/app/src/pages.tsx)、[wishes](../../packages/app/src/wishes.tsx) |
| 许愿选择 | 选择已解锁小物、已有小物 | `navigate`，锁定卡片安静 | 无 | [wish-ritual-picker](../../packages/app/src/wish-ritual-picker.tsx) |
| 心愿架 | 轻点小物听回应 | 保留既有材质音；不加 UI 音 | 已有 | [wish-ritual-rack](../../packages/app/src/wish-ritual-rack.tsx) |
| 心愿架 | 前后浏览按钮 | `navigate`，到边界禁用时安静；手指滑动安静 | 无 | [wish-ritual-rack](../../packages/app/src/wish-ritual-rack.tsx) |
| 心愿架 | 进入仪式／查看收藏 | `navigate` | 无 | [wish-ritual-rack](../../packages/app/src/wish-ritual-rack.tsx) |
| 心愿详情 | 记一笔入口、来还个愿 | `navigate` | 无 | [wishes](../../packages/app/src/wishes.tsx) |
| 心愿详情 | 展开／收起全部记录 | `open` / `close` | 无 | [wishes](../../packages/app/src/wishes.tsx) |
| 心愿详情 | 确认心愿实现 | `saved`，等写入成功；不把页面跳转再响一次 | 已有 | [wishes](../../packages/app/src/wishes.tsx)、[App](../../packages/app/src/App.tsx) |
| 心愿详情 | 先放下／重新拾起心愿 | `toggleOff` / `toggleOn`，有效状态变化后一次；不使用奖励旋律 | 无 | [wishes](../../packages/app/src/wishes.tsx) |
| 努力记录 | 编辑正文、中文输入法组合、保存 | 编辑安静；有效保存只响 `saved` | 保存已有 | [wishes](../../packages/app/src/wishes.tsx) |
| 还愿 | 编辑善意行动、完成还愿 | 编辑安静；写入成功只响 `saved`，后续跳转安静 | 保存已有；此入口没有奖励飞行 | [wishes](../../packages/app/src/wishes.tsx) |
| 小天地 | 打开架上小物、网格收藏卡、空态引导 | `navigate`，多个视觉入口复用一种含义 | 无 | [pages](../../packages/app/src/pages.tsx) |
| 收藏详情 | 回看仪式、查看关联心愿 | `navigate` | 无 | [pages](../../packages/app/src/pages.tsx) |
| 仪式时光 | 打开场景记录、再次体验 | `navigate` | 无 | [pages](../../packages/app/src/pages.tsx) |
| 我的／仪式设置 | 声音、触觉、减少动态开关 | `toggleOn` / `toggleOff`；总声音关闭立即停止，关闭动作不发声 | 无 | [pages](../../packages/app/src/pages.tsx)、[feedback-controls](../../packages/app/src/feedback-controls.tsx) |
| 我的 | 隐私政策、技术支持、内测目录入口 | `navigate` | 无 | [pages](../../packages/app/src/pages.tsx) |
| 隐私／支持 | 点击联系邮箱打开系统邮件应用 | `select`，不声称邮件已发送 | 无 | [legal](../../packages/app/src/legal.tsx) |
| 语言 | 打开／关闭语言选择 | `open` / `close`，遮罩／Esc／系统返回等关闭路径一致 | 无 | [language-setting](../../packages/app/src/language-setting.tsx) |
| 语言 | 选择语言或跟随系统 | 有效变化 `select`，自动关闭不另响；重选原值仅 `close` | 无 | [language-setting](../../packages/app/src/language-setting.tsx) |
| 场景外壳 | 设置菜单开合、点外部／Esc／系统返回收起 | `open` / `close`，嵌套菜单不能双响 | 无 | [feedback-controls](../../packages/app/src/feedback-controls.tsx) |
| 场景外壳 | 介绍气泡展开／收起 | `open` / `close` | 无 | [ritual-narrative](../../packages/app/src/ritual-narrative.tsx) |
| 场景外壳 | 收藏／取消收藏场景 | `toggleOn` / `toggleOff`；不等于领取纪念物 | 无 | [scene-experience](../../packages/app/src/scene-experience.tsx) |
| 场景加载 | 取消并返回、重试打开 | `back` / `select`；自动加载与就绪安静 | 无 | [scene-experience](../../packages/app/src/scene-experience.tsx)、[scene-load-failure](../../packages/app/src/scene-load-failure.tsx) |
| 场景加载 | 查看／收起技术细节 | `open` / `close`；自动出现错误不响 | 无 | [scene-load-failure](../../packages/app/src/scene-load-failure.tsx) |
| 场景结果 | 收下、返回今日、去看看心愿、完成页关闭 | 有奖励飞行只响 `collect`，纯返回使用 `back` / `navigate` | 奖励已有 | [scene-experience](../../packages/app/src/scene-experience.tsx)、[ritual](../../packages/app/src/ritual.tsx)、[App](../../packages/app/src/App.tsx) |
| 场景结果 | 打开祈愿输入、暂不记录 | `open` / `close` | 无 | [scene-experience](../../packages/app/src/scene-experience.tsx)、[optional-scene-wish](../../packages/app/src/optional-scene-wish.tsx) |
| 场景结果 | 提交祈愿、把暂存文字留下 | `saved`，有效持久化后一次 | 已有 | [scene-experience](../../packages/app/src/scene-experience.tsx)、[App](../../packages/app/src/App.tsx) |
| 场景结果 | 不留下暂存文字 | `close`，不发错误或奖励音 | 无 | [scene-experience](../../packages/app/src/scene-experience.tsx) |
| 视觉风格 | 打开／关闭风格面板、进入／离开看画面 | `open` / `close` | 无 | [visual-style-menu](../../packages/app/src/visual-style-menu.tsx) |
| 视觉风格 | 点选风格、当前／全部范围、展开调节、重置参数、恢复默认 | 值变化 `select`；调节展开使用开合音；重置与恢复确有变化才响应 | 无 | [visual-style-menu](../../packages/app/src/visual-style-menu.tsx) |
| 视觉风格 | 横向拖动、惯性滚动、连续参数滑块 | 安静；点选卡片可响一次，不能在 `scroll` 或每个参数变化发声 | 无 | [visual-style-menu](../../packages/app/src/visual-style-menu.tsx) |
| 视觉风格 | 完成并保存、未改动退出 | 有效写入 `saved`；未修改仅 `close`；取消预览不冒充保存 | 无 | [visual-style-menu](../../packages/app/src/visual-style-menu.tsx) |
| 分享 | 打开预览、关闭、重新生成图片 | `open` / `close` / `select`；生成完成安静 | 无 | [ritual-share](../../packages/app/src/ritual-share.tsx) |
| 分享 | 复制链接、手动复制回退 | 实际复制成功 `saved`；只显示待复制文本不能发成功音 | 无 | [ritual-share](../../packages/app/src/ritual-share.tsx) |
| 分享 | 分享互动场景／图片、预览网页、前往商店、下载图片 | 主动触发可 `select`；系统分享取消安静；下载／系统面板返回不等于发送或保存成功 | 无 | [ritual-share](../../packages/app/src/ritual-share.tsx) |
| 外部入口 | 小组件／深链自动打开场景、回到前台、恢复存档 | 安静；没有用户在 App 内确认操作 | 无 | [widget-navigation](../../packages/app/src/widget-navigation.tsx) |
| 外部入口 | 小组件等待提示中的“留在这里” | `close` | 无 | [widget-navigation](../../packages/app/src/widget-navigation.tsx) |
| 原生宿主 | Android 返回键、WebView 出错后的“重新打开” | 返回沿用共享界面开合／返回规则；WebView 尚不可用时原生重试保持安静 | 无独立原生音频 | [App](../../apps/mobile-expo/App.tsx) |
| 独立分享网页 | 开启／关闭声音、重新体验、重试 | 独立局部设置，不能借用 App 存档；本轮保持安静，避免引入第二套播放器 | 场景声音局部可切换 | [public-scene](../../packages/app/src/public-scene.tsx) |
| 内部目录／缓存 | 搜索、测试筛选、刷新状态、清除筛选、更多、缓存预算／清理 | 默认安静，避免干扰测试现场；入口导航可统一处理 | 无 | [scene-library](../../packages/app/src/scene-library.tsx) |
| 内部反馈 | 打开关闭报告、选择步骤、编辑、连接、发送、标记通过、重试、新报告 | 默认安静；不把上传／队列状态混入正式用户的保存成功反馈 | 无 | [test-feedback-overlay](../../packages/app/src/test-feedback-overlay.tsx) |

当前没有渲染出来的“删除心愿”“删除收藏”“清空用户数据”操作，也没有可点击的来源卡页面。心愿详情的来源图标和标题为静态内容，不能凭数据结构虚构入口。暂存文字舍弃、心愿归档和内部缓存清理在上表单独列明。

## 接入约束

1. 事件在语义明确的组件／动作边界触发，不监听全局任意 click，不对所有按钮统一点响。原生触摸、鼠标与键盘激活应等价；拖动后被抑制的 click 不应发音。
2. 导航声音必须区分主动导航与奖励飞行后的跳转、小组件导航、恢复和 effect 自动路由。仅给 `go` 全局加声会使这些路径误响。
3. 新界面播放器与场景反馈分离，复用 App 所有的 AudioContext。现有 `feedback()` 会同时发触觉，不能把它当作所有 UI 声音的入口；此次用户要求不授权普遍新增震动。
4. `settings.sound` 仍是总开关。开启动作可在新值生效后短促试听；关闭立刻停止所有自有声音，无关闭尾音。保留独立的 haptics 设置。
5. 同一次手势优先结果反馈，其次明确状态变化，再次开合／导航。提交／收下／语言选择与自动关层不会再叠一个点击音。连续输入、滚动、滑块与重复当前选项保持安静。
6. 需要写盘的 `saved` 必须使用存储成功回执，不能用 reducer 接受动作代替；失败、无变化、取消和过期异步结果都不能播放成功音。现有 pending 标记需按实际提交／奖励路径核对，避免旧回执串入后续操作。
7. 音频在首次主动手势中解锁。音效文件在本地打包与预解码，不能点击后联网下载，也不能让 decode 完成后迟到补响。没有准备好时静默跳过。
8. 静音、后台、失焦、销毁应立即停止并丢弃待播声音；回来不补播。限制并发和短间隔重触发，错误音只用于显式失败且限频。
9. iOS 静音键与其他音频混音策略在仓库里没有明确 AVAudioSession 配置；必须实机验证，不能根据 Android 或桌面 Web Audio 结果声称已经支持。

## 实际接入

素材作者、下载、许可和候选对比见 [界面音效素材来源](2026-11-03-ui-sound-sources.md)。正式选择 Kenney Interface Sounds 1.0 的 CC0 素材，保留原有 `saved/collect/complete`。8 个派生 WAV 与原始许可已入库，音频总计 52,580 字节；具体原件、加工、hash 和指标见 [素材 README](../../assets/ui-sounds/README.md) 与 [manifest](../../assets/ui-sounds/manifest.json)。

| UI 语义 | 原包素材 | 最终时长 |
| --- | --- | ---: |
| 进入页面／主动浏览 | `pluck_001.ogg` | 100 ms |
| 返回 | `pluck_002.ogg` | 140 ms |
| 切换选项 | `select_001.ogg` | 60 ms |
| 展开／收起 | `open_001.ogg` / `close_001.ogg` | 各 148 ms |
| 开启／关闭普通选项 | `toggle_001.ogg` / `toggle_002.ogg` | 各 136 ms |
| 温和提示候选 | `question_002.ogg` | 220 ms |

`notice` 已作为受限播放器能力保留，本轮没有给普通校验或自动错误接入提示音。主界面声音开关使用已有译文“音效”，并与场景内声音共用总开关。Three.js 内部动作、原生故障恢复按钮、独立分享落地页和内部测试工具继续按上表范围保持原行为。

[UI 播放器](../../packages/app/src/ui-sounds.ts)只预取本地字节；首次主动手势解锁与解码，未就绪就跳过，异步完成不自行播放。单声道短音经过低通、音头与尾部包络及峰值调整；UI 总线最多一个声音，60 ms 同类重触发限制，`notice` 间隔 800 ms。现有结果音优先于 UI 声，静音／后台／失焦停止，恢复不补播。

主动路由通过显式参数选择声音，自动导航默认安静。收藏、归档、设置在有效值变化后反馈；视觉风格的有效保存加入已有持久化成功音。语言选择和各弹层在真实状态转换处去重；分享只在确认复制成功后反馈，关闭、静音、失焦或后台中断的旧请求不补响。

试听页及连播由 [浏览器核验脚本](../../scripts/verify-ui-audio.mjs)生成到 `artifacts/ui-sounds/verification/`，使用与产品打包相同的 WAV。信号检查不代表实机听感或硬件静音键已验收。

## 文化影响

已阅读 [场景来源与文化关联核查规范](../scene-provenance.md)。本次盘点与拟议界面声音均为产品反馈，不修改场景器物、材质身份、动作、次数、顺序、寓意、来源绑定或标题，不把 UI 素材说成传统音乐或仪式录音；Three.js 内部操作明确不在改动范围。现有来源卡、注册表、module metadata 与原生标题无须因本次盘点改变。

核查状态：操作与代码对应审阅、素材授权核对和 UI 产品代码接入已完成；具体技术验证结果见下。未进行手机扬声器／耳机的主观听感与硬件静音键验收。

## 验证结果

| 检查 | 最终结果 | 证据（仓库根目录相对路径） |
| --- | --- | --- |
| App 完整测试 | 62 文件、1,502 项通过，0 失败 | `artifacts/ui-sounds/app-tests-final.log` |
| UI 播放器 | 22 项通过，覆盖未就绪、停播、实时静音、并发与过期解码 | `packages/app/src/ui-sounds.test.ts`，包含在完整 App 测试中 |
| 新界面行为 | 核心 11、App 集成 8、菜单 16、场景外壳 5 项通过 | `core-ui-sounds.test.tsx`、`ui-sound-integration.test.tsx`、`ui-menu-sounds.test.tsx`、`ui-scene-shell-sounds.test.tsx` |
| 现有共享音库基线 | 41 项通过；共享合成器未改动 | 执行 `npm run test -w @wbr/shared -- src/soft-audio.test.ts` |
| 离线素材与嵌入资源 | 4 项通过，包括 Web／Expo 的 WAV、原始许可、hash 和 EAS 白名单 | `artifacts/ui-sounds/assets-tests.log` |
| 生产构建 | 完整 `npm run build` 退出 0，含 i18n 和 TypeScript；保留既有较大 chunk 提示 | `artifacts/ui-sounds/build-final.log` |
| 移动端 TypeScript | 退出 0 | `artifacts/ui-sounds/mobile-typecheck-final.log` |
| 内测修订 | 158 场景签名同步并检查通过；UI 共享外壳变化导致签名更新，没有改场景 ID／引擎／存档 | `artifacts/ui-sounds/revisions-final.log` |
| 真实 Edge 浏览器 | 17 项 UI 调度／生命周期检查通过，8 个本地 WAV 解码与信号检查通过，无页面错误 | `artifacts/ui-sounds/verification/browser-report.json`、`browser-run-final.log` |
| 独立审阅 | 2 项 P2 已复现并修复：语言弹层因 callback 变化关闭；复制跨失焦后补响。修复均先见测试失败，再通过 | 上述 App 集成与菜单行为回归；独立审阅未见其他生产问题 |

完整 App 首次按默认并发运行遇到旧导航 mock 参数断言以及 worker 堆内存耗尽；补齐显式声音参数断言后，使用 `--maxWorkers=2` 和本次命令局部的 8 GiB Node 堆限制完整重跑通过，没有改项目全局测试配置。最终复跑在两项审阅修复完成后执行。最后 `git diff --check` 通过。

声音加工指标只证明文件幅值、边缘、长度、格式和可解码性。实际设备音量平衡、硬件静音键与系统其他音频的混音仍属未验收项；没有将浏览器结果当作这些项目的证明。
