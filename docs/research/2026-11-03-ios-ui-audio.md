# iOS 构建 23 文件音效无声排查

用户确认 TestFlight 为 `1.0.0 (23)`，系统未静音；「祈愿仪式 → 点按小物，听听回应」可以发声。该入口使用 `createSoftSoundPlayer` 现场合成，而导航、按钮、保存、收下与完成提示使用 `createUiSoundPlayer` 读取 WAV。

后续澄清：用户只确认界面按钮无声，尚未确认具体仪式内部操作是否无声；本轮按界面文件音效处理。

## 已确认原因

构建 23 的实际 IPA 包含全部 10 个 Soft Garden WAV，逐项 SHA-256 与源码相同。问题在读取方式：生产 Expo DOM 页面运行在 `file:` 来源，播放器直接 `fetch(assetUrl(...))`。在 iOS 模拟器的 WKWebView 中，使用相同的媒体设置、`loadFileURL` 和读访问根目录，存在的 WAV 仍返回 `TypeError: Load failed`；普通 XHR 同样失败。因此没有数据进入解码缓存，后续点击持续返回 `unready`。原代码吞掉了可选音效加载错误，所以界面不报错。

原生宿主此前没有为 UI WAV 提供读取桥。`AudioContext` 本身可用；此次播放器对照中修复前后均为 `running`。系统静音不能解释这项已复现的失败。这个结论针对文件音效，不将其扩展为所有独立场景合成音效的真机验收。

## 修复

- iOS 正式宿主经现有 Expo FileSystem 从 `Paths.bundle/www.bundle` 读取音效，返回可序列化的 base64。
- 只允许 `UI_SOUND_FILES` 中的路径，拒绝空文件及超过 100,000 字节的文件，不提供任意文件读取。
- 顶层异步 DOM action 接入稳定的 host，播放器收到字节后继续使用原有 Web Audio 解码与播放；Web、Metro 开发宿主和 Android 保持原来的读取路径。
- 预加载不播放，解码完成不补播，继续遵守音效开关、后台停播和并发限制。现有 WAV、音量、音色不变。

## 验证与边界

1. 修复前新增回归失败：原生字节无法进入播放器，真实 App 的 UI 声音未调度；修复后通过。
2. 原生读取回归覆盖全部 10 个源 WAV、白名单和大小边界；App 回归覆盖关闭音效及异步读取不补播。
3. iOS 26.5 模拟器的最小 WKWebView 探针：实际编译构建 23 原播放器和修复后的播放器，使用相同音频上下文及 WAV。旧代码 10 个 cue 全为 `unready`、零解码／播放；新代码全部 `played`，实际 Web Audio 成功解码并调用 `AudioBufferSourceNode.start`。探针以 Swift 本地文件读取模拟原生异步 action，并非完整 Expo App 的实机验收；WebKit UA 中的兼容版本字符串不代表模拟器系统版本。
4. 完整 App 测试：64 文件、1,524 项通过；移动 TypeScript 和 Web 生产构建通过，Web 保留既有 chunk 大小提示。
5. iOS `export:embed` 及离线校验通过：原生／DOM HTML、JS、CSS、182 项离线资源及 477 张小组件图片哈希一致。

本地证据位于 `artifacts/ios-audio-diagnosis/`：`transport-result.json`、`player-result.json`、`app-tests.log`、`build.log`，以及可重跑的探针源码。Mac 探针位于 `/Users/heli/ios-builds/cyber-bless/diagnostics/audio-23`；测试 App 已卸载，本轮启动的模拟器已关闭。

此修复尚未生成、上传新的正式 IPA。构建 23 及其来源 tag 不变。后续按正式发布入口分配新构建号、冻结提交和新 tag；设备仍需验收扬声器／耳机、前后台恢复及具体场景的操作音。

## 文化影响

按 [场景来源与文化关联核查规范](../scene-provenance.md) 审阅，本次只修改产品 UI 音效的文件传输。沿用 [操作与音效核查](2026-11-03-ui-operations-audio-audit.md) 与 `assets/ui-sounds/soft-garden-v1/README.md` 的产品原创归属。未修改器物、材料、场景动作、文字、寓意、来源卡或来源绑定；无新增文化事实，技术 ID、引擎版本和存档格式不变。资源准备流程重新核对了场景测试签名，本次未引起签名变化。
