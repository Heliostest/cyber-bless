# 仪式结束后的场景图片分享

核查日期：2026-10-28。用户明确选择「带场景画面的分享图片」。设计与边界见[设计](../superpowers/specs/2026-10-28-ritual-image-sharing.md)，[文案核对](2026-10-28-ritual-image-sharing-i18n.md)。

## 最终行为

- 普通／每日／开场／还愿／回看场景完成后出现「分享画面」，不替代收下、收藏、心愿保留选择或继续还愿。
- 分享先显示本地预览。卡片为 1080×1350 PNG：完整场景帧按 contain 放入图片区域，加当前语言的场景标题、应用名和「已完成」。不增加来源、寓意或功效文案。
- Web 在预览后的下一次用户点击中调用 Web Share files，避免图片准备耗尽用户激活。不能分享的浏览器仍可下载 PNG，取消不报错。
- Expo 原生使用稳定异步 DOM host 与 expo-sharing ~57.0.24，写入专用缓存后打开系统面板。目标应用由操作系统决定；不提示送达成功。原生不显示 WebView 不支持的浏览器下载链接。
- 旧会话在离开场景前保留瞬时帧，仅存在 Route 中；重新打开且没有瞬时帧的旧完成页保留原文字分享。保存格式、会话、奖励和进度不变。
- 图片不上传开发者服务器。原生只清理专用导出目录中超过 48 小时的文件，保留近期文件供接收应用延后读取。PNG payload 限 12 MiB，文件名不能逃逸专用目录。

## 实际呈现与文化影响

这是产品辅助按钮、截图和完成反馈。已阅读现行[核查规范](../scene-provenance.md)、[全场景来源审阅](2026-10-19-scene-culture-audit.md)中水引／木鱼条目与[水引 README](../../packages/scenes/src/mizuhiki/README.md)。本次不新增或改变器物、材料、形状、动作、次数、先后、场合、起源、地域、社群、信念或寓意主张，无新增文化事实需要外部来源。不会以分享卡中的「已完成」反向证明传统仪式要求。

唯一场景文件变化为水引用户文字隐私标记：该场景将可选留言绘为 `mizuhiki-written-wish` 纹理。用户文字标记 `privateShare`，捕获时隐藏、finally 恢复，并在同一任务内重绘正常画面；产品默认文字保留。正常体验及完成条件不变。核查其他场景的 CanvasTexture/fillText 路径，未发现其他用户文字入 WebGL 的路径；截图不抓 DOM 留言、提示或操作按钮。

| 核查项目 | 结论 |
| --- | --- |
| 实际器物／材料／动作／对象／场合／完成条件 | 均未改变；仅增加完成后产品按钮及导出画面 |
| 新增文化主张及直接证据 | 无；无需借用新的传统、地域或宗教背景 |
| 来源错绑、规则及功效外推 | 不新增、不改变来源或规则 |
| 来源卡／宿主／注册表／metadata／原生标题 | 不涉及其内容变化，保持一致；无需改来源卡或技术 ID |
| 场景 README 与产品表达 | 水引 README 追加截图隐私说明；产品文案审阅另有记录 |
| 用户结束语 | 复用已存在的「已完成」，不承诺现实效果 |
| 技术验证与事实审阅 | 分别记录；测试不被视为文化事实证据 |

## 验证记录

- 新分享 UI 与文件边界测试：11 项通过。覆盖预览先于系统调用、真实 File/MIME/文件名、取消、不支持、失败重试、原生无虚假下载、Android 返回关闭预览。
- 分享／旧完成页／心愿专项：29 项通过。完成页状态按钮的原测试增加对分享辅助按钮的区分；`ritual-scenes` 的 38 项及新分享 11 项通过。
- `node --test scripts/mobile-share-image.test.mjs`：8 项通过，含缓存保留与过期清理、PNG 校验、错误传播及写入后再分享。
- `npm.cmd run test -w @wbr/scene-runtime`：14 文件、207 项通过。
- `npm.cmd run test -w @wbr/scenes -- src/mizuhiki/scene.test.ts`：场景类型检查和 31 项测试通过。
- `npm.cmd run build -w @wbr/cyber-bless`：TypeScript 与 Vite 生产构建通过；仍有现有大分块提示。
- `npm.cmd run typecheck -w @wbr/mobile`：通过。
- `node scripts/verify-ritual-sharing.mjs`：在真实 Chromium WebGL 中，使用正式 `Woodfish` 组件及真实引擎、内置模型、veranda 环境、HDR 光照与 `toon-soft` shader 生成 PNG，确认1080×1350、可见场景像素、320/390宽度不横溢、下载文件名与 Escape 关闭。断言实际环境、当前 shader、环境 ready 及成功读取 HDR，而非仅检查图片非空。产物在 `artifacts/ritual-sharing/`；仅隔离存储与本地资源交付，不冒充整应用导航或真机验收。
- 国际化的字面量提取、8语言完整性／ICU／review、编译一致性通过。总 `i18n:verify` 在已有小组件生成漂移 `apps/mobile-expo/widget-copy.generated.json` 停止；生成器只依赖 native/scenes 目录，本次新增 app 消息不影响其计算。未覆盖其他工作区已有场景翻译。
- 根 `npm.cmd test` 已运行：国际化／core／runtime 阶段通过，app 阶段 1287 项通过、1 项失败，失败是既有 `wish-object-feedback.test.ts` 的 `ukrainian-didukh` 反馈覆盖；反馈实现与场景目录不是本次修改内容。根脚本在此停止，未冒充后续工作区完整通过。完整日志保存在 `artifacts/ritual-sharing/full-test.log`。

开工时原有合并冲突曾阻断整库检查，随后外部工作解决了冲突，已重新运行构建与相关回归。未提交、发布、创建 PR 或向任何接收应用自动发送内容。

系统分享面板、取消返回及已安装社交／即时通信应用的实际接收仍需 iOS/Android 真机验收；本机测试不保证每个第三方应用都提供分享目标。

## 预览纠正

用户指出第一张预览缺少场景与 shader。核对发现原浏览器 fixture 只用正式 GLB 的木鱼主体，加自建相机和灯光，没有走正式 `Woodfish`／`createWoodfishScene`，漏掉木槌、环境与 shader。该图只能证明基础文件分享边界，不应作为正式视觉效果交付。

已删除这条简化渲染路径，直接挂载正式组件，资源客户端在内存中提供同一内置包，环境 HDR 通过本地路由读取。先增加正式环境断言，原 fixture 因 environment 为 undefined 而失败；改用正式组件后完整浏览器检查通过，原预览文件已替换。正式场景与分享捕获原本保留当前 shader，本次没有修改产品场景、器形、动作、材质、文化文案或来源绑定。

## 实现依据

2026-10-28 实际阅读 [Expo SDK57 Sharing](https://docs.expo.dev/versions/v57.0.0/sdk/sharing/) 的安装、平台与分享接口说明，以及 [MDN Navigator.share](https://developer.mozilla.org/en-US/docs/Web/API/Navigator/share) 的 files、用户激活、取消与平台限制段落。用于技术接口选型，不作为文化来源。

## 2026-10-29 提交前复核

上一轮已有的收藏反馈失败已按[四场景反馈补齐](2026-10-29-four-scenes-object-feedback.md)修复。完整 `npm.cmd run verify` 重新通过，包含全部工作区测试、国际化、Web 构建、移动端检查及双端离线嵌入验证；不以此声称真机分享或公网部署已验收。
