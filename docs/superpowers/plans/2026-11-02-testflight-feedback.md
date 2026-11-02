# 内测反馈实施计划

规格：[内测仪式反馈](../specs/2026-11-02-testflight-feedback.md)。保留当前所有未提交的画风与内置资源改动。

1. 后台和协议：packages/shared/src/test-feedback.ts 定义 v1 协议/校验/接收地址；scripts/test-feedback/* 实现独立提交与本机管理监听、幂等文件收件、状态整理/导出、可重复启动的本机配置、cloudflared 启动辅助与协议安全回归。
2. 客户端可靠队列：packages/app/src/test-feedback-client.ts 实现独立存储、草稿/设置/待发、先写后发、严格回执、失败保留、换址/联网/前台/成功重试与退避；不使用游戏 save。提供 provider/hook 适配同一 App 实例。
3. 浮层：Route/SceneVisit 增加 testFeedback 瞬时标志，仅目录导航传递，纠正 fresh 判断避免标志重置未完成进度。SceneExperience/LoadedScene 插入可折叠反馈入口，打开时快照并暂停原实例；显示可编辑步骤、文本、连接、待发/成功状态，不上传私人状态。保持正式版隐藏。
4. 主代理：runtime Host 增加独立 testFeedback adapter，Web/native 宿主桥接/版本信息；统一多语言与隐私帮助说明、入口脚本与文档。整合检查后启动本机服务和临时 Tunnel，用合成反馈完成端到端收件，打开反馈界面供用户继续评审。

接口：TestFeedbackHost extends Storage，send(endpoint, token, reportJSON):Promise<string> 返回回执 JSON，info 可选平台/版本/构建/OS。协议具体结构见 shared/test-feedback；队列 agent 与 overlay agent 直接约定 adapter API，原生能力跨 DOM 均为顶层异步函数 props。

## 实施记录

任务 1–4 已完成，使用说明见 [内测反馈](../../testflight-feedback.md)。本机接收服务、仅提交的临时 Tunnel 与后台已启动；邀请码在 Git 外部，反馈与隧道运行状态在忽略的 artifacts/test-feedback。临时地址没有写死到 App。

浏览器实际经 Quick Tunnel 上传合成反馈并收到保存回执，同编号已在磁盘和后台核对；公网管理 API 返回 404。联调样例已标记已修复，导出待处理反馈为空，避免进入真实问题队列。两页预览均保留。

独立审阅发现读取失败恢复旧草稿时可能覆盖新输入，已增加脏草稿版本保护及恢复写入，包含新输入与清空两类回归。队列收到批量回执后按 ID 保留成功状态；本地 ACK 写入未完成不提前显示成功。

验证：协议 4 项、传输 4 项、后台/隧道 7 项、队列/provider 20 项、浮层 11 项通过；八语言检查、Web 构建与 mobile:verify 通过。双端 native/DOM JS/HTML/CSS 和 171 项离线资源哈希、iOS 477 项组件封面校验通过。最后草稿恢复修正后再次通过浮层与移动类型检查，并复跑完整 App 与 Web 构建。

发布边界：本轮未生成发布 tag 或上传 App，也没有创建周期任务。Windows 未验证 Swift 编译或 TestFlight 真机听写/联网，需下一次原生构建验收。内置资源、反馈与画风工作统一集成，提交与合并状态以 Git 历史为准。
