# Feedback History Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans inline, task by task.

**Goal:** 在当前仪式反馈面板对照旧问题进行复测。
**Architecture:** 新增窄化的历史 DTO 和鉴权分页接口；现有 readStatus JSON 桥按 history 类型转发；客户端按连接/仪式隔离异步回复，UI 展示只读历史。
**Tech Stack:** TypeScript、React、Node HTTP、Vitest、node:test、Playwright。
**Spec:** docs/superpowers/specs/2026-11-08-feedback-history-design.md（用户已确认功能与字段）。

## Global Constraints

- 仅内测，沿用邀请码；不返回投稿人身份、邀请码、存档或完整设备诊断。
- 每页 20，游标绑定仪式；旧状态协议不变；不增加原生桥函数。
- 历史正文作为纯文本；读取不修改报告、通过凭据、上传队列或存档。

## Review Focus

- 换仪式/连接后的晚到回复不得串用；错误及旧后台不得显示成空历史。
- 旧版本和已修复意见仍可见；通过报告不当作问题。
- 分页同时间记录不遗漏，非法跨仪式游标拒绝；仅授权可读。
- 手机长意见、错误、刷新和继续加载可操作，八语言文案完整。

## Tasks

- [x] 先写失败的 shared/runtime/server 测试；实现 history 查询/回复校验、桥转发、只读分页鉴权；运行对应测试。
- [x] 先写失败的 client/UI 测试；实现连接与生命周期保护、面板和纯文本渲染；验证分页/错误/晚到回复/存档不变。
- [x] 接入八语言与生成文件，跑反馈全套、构建、移动类型与相关嵌入检查；浏览器 390px 核对。
- [x] 独立审阅修正，重启现有服务验证只读历史，记录交付与发布边界。

Ruling: 本次按用户已确认的四项字段与入口直接实施；分页/窄化 DTO/同桥路由为实现判断，无新原生接口。工作区并发的 cue-placard、交互提示测试和生成仪式修订保留，不纳入本次提交；因此不从混合脏工作区准备新签名热更新候选。

验证与交付见 docs/research/2026-11-08-feedback-history.md；原生打包、发布与真机验收未执行。
