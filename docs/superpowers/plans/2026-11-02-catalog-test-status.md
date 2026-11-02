# 团队测试状态实施

规格：[团队测试状态](../specs/2026-11-02-catalog-test-status.md)。在 master 工作区实施，不自动发布 App。

1. 后台协议：共享可选字段、严格聚合查询/响应解析、按指纹与问题基准计算状态、公开窄范围 API、后台/导出区分通过记录；补充旧反馈和并发/离线回归。
2. 场景指纹：生成受管理的 sceneTestingRevisions TS，正确切断注册表/聚合翻译导入，纳入资源准备和生成校验；验证单场景与共享依赖修改、无关资料不影响及模型变化。
3. 目录与浮层：四类标记、未同步/缓存提示、状态筛选/刷新、待上传区分；明确通过操作不破坏问题草稿或旧报告，使用指纹与问题基准。i18n 交主代理统一生成。
4. 主代理：状态传输的 Web/native 顶层桥、outbox 状态缓存/刷新和竞态保护、provider 接入；集成多语言/文档、独立审阅、验证与浏览器演示。

接口归属：后台拥有 packages/shared/src/test-feedback.ts 和 scripts/test-feedback/*；指纹任务拥有 scripts/scene-testing-revisions.mjs、相关测试、app/src/scene-testing-revisions.generated.ts、prepare/vite 检查接入；UI 拥有 scene-library.tsx、test-feedback-overlay.tsx/css 与目录样式/测试；主代理拥有 runtime/native、test-feedback-client/provider、i18n 及文档。

## 验收（2026-11-02）

任务 1–4 完成。独立审阅发现并修正了两处缺口：上传后的状态同步不能复用上传前的迟到响应；指纹不能遗漏共享检查点、木鱼结束逻辑及核心 reducer。均有回归覆盖，复核无剩余阻塞。

- 完整 App 1409 项/55 文件通过；反馈专项中协议 6 项、传输 5 项、后台/隧道 12 项、客户端/provider/浮层/目录 51 项通过。
- 指纹生成器 11 项回归通过，真实仓库 158 个指纹生成与 --check 通过。只读状态协议按当前目录查询，不包含反馈原文或设备信息。
- 八语言登记/校验、Web 构建、移动类型与 mobile:verify 通过；双端嵌入导出检查 171 项离线资源哈希，iOS 477 个组件封面通过。
- 浏览器实际用现有临时公网连接同步目录、筛选待复测，浮层可见当前版本明确通过按钮；未提交任何新的虚假通过确认。原先七草的待复测来自前轮联调历史。
- 接收服务已重启加载汇总 API，保留原配置、邀请码、收件数据与隧道。提交与合并状态以 Git 历史为准；本轮未发布新 App，TestFlight 真机仍需下一次原生构建验收。
