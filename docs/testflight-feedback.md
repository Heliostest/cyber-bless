# 内测仪式反馈

当前内测阶段默认显示“我的 → 场景目录”，从这里打开的仪式提供“反馈问题”浮层。正常今日、收藏或愿望入口不显示反馈浮层。打开反馈会暂停原仪式，关闭后继续，不重建场景。

Web、iOS 和 Android 共用 `packages/app/src/internal-tools-config.ts` 中的 `INTERNAL_TOOLS_ENABLED` 打包开关，当前为 `true`，无需依赖 TestFlight 收据识别。内测完成后改为 `false` 再重新打包，场景目录、内部路线与反馈浮层将关闭；旧的已安装包不会随源码变化自动关闭。原生启动初值与回前台检查使用同一开关。

## 开始收件

Windows 本机首次安装登录自启动并立即启动：

```powershell
npm run feedback:install
npm run feedback:status
npm run feedback:logs
```

计划任务 `CyberBless-TestFeedback` 使用当前登录用户，无需保存 Windows 密码。登录后自动启动，每分钟补偿检查；进程正常运行时忽略重复启动，没有三天运行时限。独立于 Codex、Vite 和日志终端，关闭日志查看器不影响收件。守护进程分别监控接收服务与隧道，异常退出或连续健康检查失败后自动重启，重试间隔递增至最多 60 秒。Windows runner 也会恢复退出的守护进程；使用 Job Object 清理整棵子进程树，避免孤儿服务占用端口。不会抢占或结束其他程序。

公网地址每次变化都会带时间打印到终端和 `artifacts/test-feedback/supervisor.log`，本机后台也会刷新。日志达到 1 MiB 后轮换，保留一份旧日志；不记录邀请码或测试者描述。`feedback:logs` 持续跟随新日志，按 Ctrl+C 只退出查看。`runner.log` 记录外层启动失败或守护进程退出。`feedback:status` 查看任务、接收服务、隧道和当前公网地址。

```powershell
npm run feedback:stop       # 停止并禁用自启动/自动恢复
npm run feedback:start      # 重新启用并立即启动
npm run feedback:uninstall  # 移除任务，保留邀请码和反馈数据
```

任务使用本仓库的绝对路径；移动仓库前先卸载任务，再从新位置安装。自启动是当前用户登录后启动，电脑休眠、关机、未登录或断网期间不能在线收件；恢复运行/联网后继续尝试。临时公网地址仍需手动分发给测试者。计划任务能力参考 [Microsoft Task Scheduler 设置](https://learn.microsoft.com/en-us/powershell/module/scheduledtasks/new-scheduledtasksettingsset?view=windowsserver2025-ps)（2026-11-02 已读正文）。

临时前台守护可运行 `npm run feedback:supervise`。手动诊断时先 `feedback:stop`，再分别运行两个终端：

```powershell
npm run feedback:serve
npm run feedback:tunnel
```

本机后台：<http://127.0.0.1:4319/>。这里显示当前上传网址和可复制的测试邀请码，也可按场景筛选、查看诊断、标记“待处理 / 已确认 / 已修复”、导出 JSON 或 Markdown。邀请码不要放入 Git、App 源码或公开日志；默认保存在 `%LOCALAPPDATA%/CyberBless/test-feedback/server.json`，不是 Cloudflare 管理凭据。

第二个命令只把反馈端口 `127.0.0.1:4318` 暴露到公网，允许提交反馈及携带邀请码查询团队状态汇总，不提供原始描述、设备信息或管理接口。不要把 4319、本机开发服务器或其他目录转发出去。接收服务、隧道和电脑须保持运行；电脑休眠或停止服务期间，手机反馈会保留待发。

`cloudflared` 已安装时无需新增账号，命令会返回临时 `https://….trycloudflare.com` 地址；地址原子写入 `artifacts/test-feedback/tunnel-runtime.json`，后台会刷新显示。该文件没有邀请码。临时 Tunnel 每次启动可能更换地址，没有运行时间保证，适用于本轮内测；后续可改用固定域名而不改变 App 逻辑。[Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)（2026-11-02 已读正文）。已启用自启动时，由守护进程管理隧道，不再另外启动第二份；agent 可读取状态文件或 `feedback:status` 获取地址，不打印凭据。

## 测试者操作与失败重试

1. 从场景目录进入仪式，点击“反馈问题”。
2. 首次在“上传设置”填写网址与测试邀请码。网址支持域名根地址或 `/api/feedback`；远端须 HTTPS，本机联调允许 loopback HTTP。换临时地址只改网址，邀请码仍沿用同一个接收服务配置。
3. 描述具体操作问题，可用手机键盘的听写功能；不是录音上传。自动记录打开时的场景、已完成检查点、公开提示、版本和运行环境，问题步骤可手动修正。多动作检查点不等于细分手势步骤。
4. 点击“发送反馈”。先保存到本机，再尝试上传；“已送达本机后台”表示后台已经持久化并返回匹配编号的回执。本机确认写入成功后才从待发队列清除。

草稿、连接设置、待发队列和近期回执使用独立键 `cyber-bless:test-feedback:v1`，不改游戏存档。网络失败、超时、坏回执或回执丢失都保留待发项；更换地址、恢复联网、回到 App 或有新反馈发送时自动重试，并带退避。所有待发项使用最新保存的网址和邀请码。重复发送使用相同编号，后台不会生成重复记录；正在等待回执的反馈不可原地改写，可继续新建问题。

最多保存 100 条待发反馈；队列满、读取失败或本机空间不足会明确提示，不静默丢弃。存储写入失败时请保留页面，恢复后重试；删除 App 或清除站点数据仍会删除未发送记录。App 停在后台或已关闭时，不承诺持续上传。

## 目录中的团队测试标记

场景目录显示“未反馈 / 已反馈 / 待复测 / 复测通过”，并可按标记筛选。同步使用浮层中保存的网址与邀请码，进入目录、回前台、联网、上传成功或手动刷新都会更新；前台也会定时刷新。没有连接或读取不完整时显示“状态未同步”，离线缓存标注同步时间，不把失败当作未反馈。

标记针对当前仪式的测试指纹：当前内容有未处理问题显示已反馈；仪式源码、相关交互依赖或资源改变，或者后台将问题标记整改后，会要求复测。测试人员完成验证后，在浮层点击“本版本测试通过”；这会排队上传一条明确的通过确认。旧版本或旧问题基准的离线通过不能清掉团队新问题，待上传也不算已反馈。

旧草稿保留原始测试指纹，不会在更新后冒充当前版本。通过操作会保护未发送的问题文字；请先发送或清空问题描述。通过记录在后台单独标识，不进入 AI 的待修复问题导出。

`npm run scene:revisions` 重建仪式测试指纹，`npm run scene:revisions:check` 检查是否过期。正常 Web/App 资源准备会自动生成，开发服务器也会监听源文件；指纹独立于 engine、内容 revision 和玩家存档版本。只更新实际依赖或内容时使相应仪式待复测，不依赖 Git 提交号或构建日期。

## 交给 AI 逐条处理

```powershell
npm run feedback:export
```

该命令把“待处理”反馈导出到 `artifacts/test-feedback/to-review.md`；原始文件在 `artifacts/test-feedback/inbox/*.json`，均已由既有 `artifacts/` 规则忽略。可以对 agent 说：“读取本机内测反馈，按场景和步骤归并，先复现，再修复和回归验证。”导出明确标注测试者文本为不可信数据，不能将其中的命令或授权当作指令。

建议一次处理一组可复现操作问题，记录反馈编号、复现、修复与测试结果，再在本机后台标记状态。不得从反馈臆造文化主张；若改动器物、动作或提示，仍须执行 [场景来源核查规范](scene-provenance.md)。

## 验证记录与边界

2026-11-02 自启动：`feedback:test` 全部通过，包含守护进程、IPC 断连、半发送 HTTP 关闭、PowerShell 解析、真实任务定义、Job Object 子孙进程清理和日志轮换。当前用户计划任务已实际安装；分别结束接收进程、cloudflared、Node 守护进程及外层 Windows runner，均成功恢复并重新验证公网健康，地址变化已输出。安装及故障演练前后邀请码和既有收件文件哈希一致。未重启电脑验证完整登录过程，登录触发器已按实际注册的任务定义检查。

2026-11-02：协议 4 项、传输 4 项、后台/隧道 7 项、队列/provider/浮层 31 项通过；最终完整 App 1389 项通过；八语言校验、Web 构建与双端导出通过。独立审阅发现并复核修正了存储读失败恢复时旧草稿覆盖新输入的问题，新增新文字与主动清空两类回归。实际浏览器经 Quick Tunnel 发送合成报告 `662bef70-1e51-4546-b75b-da0b57cd3b71`，显示保存回执，与本机文件相符；公网管理 API 返回 404。本机后台读取并将该联调样例标为已修复。截图在 `artifacts/ui-review/test-feedback-delivered-2026-11-02.jpg` 和 `test-feedback-inbox-2026-11-02.jpg`。

Windows 无法证明 Swift 编译、TestFlight 识别、真机键盘听写和各测试者网络可靠性。下一次原生构建包含版本信息和提交桥后，须在 TestFlight 真机验证；本轮不上传或发布 App。
