# 七草祈安 Implementation Plan

> **For agentic workers:** Use superpowers:executing-plans to implement this plan task-by-task. Read the design and current source protocol first.

**Goal:** 新增一个已查重且有祈安依据的七草粥Three.js场景，验收后停止。

**Architecture:** 独立model管理锅、木勺、粥与承托的连续pose；scene接入现有指针、提示、方向容差、风格和生命周期契约。来源、宿主、原生封面目录同步。

**Tech Stack:** 现有TypeScript、Three.js、Vitest、Playwright/Chrome CDP、Expo DOM；不新增依赖。

**Spec:** `docs/superpowers/specs/2026-10-23-nanakusa-gayu-design.md`

## Global Constraints

- 基线2750df5；独立`codex/nanakusa-gayu`。保留主目录、既有分支与预览。
- 按`docs/scene-provenance.md`分别记录事实、产品分镜、证据支持范围与访问状态。
- 仅本地提交，不合并、推送、创建自动化或启动下一项。

## Task 1：模型与身份

- [x] 先运行目录缺项与model缺失红灯，保存结果。
- [x] `model.ts`实现封闭锅/碗/木勺、真实勺托、粥面/载粥/盛粥与流柱连续转移，复用buffer。
- [x] 模型测试通过检查点连续、承托、603姿态、流柱连接、有限正体积闭合网格与buffer复用。
- [x] 新来源卡、研究、README与核心目录/意图/介绍/注册表/metadata明确同一身份。

## Task 2：物件输入与接入

- [x] 以现有稳定输入/生命周期测试结构写本场测试，所有对象、文本与方向明确替换。
- [x] `scene.ts`实现入锅轻拌/舀起/盛粥，40px起正常长拖可完成，真实最近表面命中、取消恢复、暂停冻结、重入隔离、44px键盘辅助、完整释放。
- [x] 应用引擎、图标、环境、宿主生命周期与显式期望、浏览器操作脚本同步；不改共享外壳行为。
- [x] 运行新场景与宿主/核心/运行时相关测试，修复真实失败。

## Task 3：交付验证

- [x] 生产构建、三尺寸真实WebGL封面与旧记录完整性、原生目录及移动端实际离线验证。
- [x] 320/390/1280鼠标/键盘/恢复与有效/无效手势，320/390CDP触摸、长拖、正常动作阶段和菜单持久化实图。
- [x] 独立来源/几何/代码/实图审阅，填写文化清单和技术限制。
- [x] 验证结果、预览与截图哈希落档，本地提交，原子登记，仅此一项后停止。

最终验证组合：全部包8696个独立用例、生产构建、两平台实际离线资源、三宽鼠标/两宽触摸与独立终审。全仓首轮并发下出现旧场景和worker超时，保留失败后以2worker完整复跑206文件7463项通过；不称首次总命令全绿。详情与本地提交/登记收据见`artifacts/nanakusa-gayu/validation.md`。
