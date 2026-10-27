# 心愿页减法 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** 用简洁列表和真实仪式入口替换通用灯图及直接填表许愿。

**Architecture:** 保留 `new` 路由，改为现有场景及小物选择器；首页只保留列表与该路由的一个入口。复用 `useOpenScene`、`sceneIntention`、现有完成后写愿及小物草稿机制；仅调整局部版式，完整保留 Animal Island UI 正式皮肤。

**Tech Stack:** React / TypeScript / CSS / Vitest / Playwright。

**Spec:** `docs/superpowers/specs/2026-10-27-wishes-simplification-design.md`（用户已于 2026-10-27 确认直接实施）。

## Global Constraints

- 不修改存档版本、场景技术 ID、隐藏策略、动作或来源分类；不新增文化主张。
- 直接场景入口仅含可见且 `sceneIntention(id)` 为 `kind: wish`、`optionalWish: true` 的条目。
- 旧待处理草稿不受上述新增筛选删除；可用小物优先，相同场景不重复提供直接入口。
- 完整保留 Animal Island 原有 token、波点、飘带、圆体、沙色面板、软白边、按压台阶、糖果按钮与四色底栏；不覆盖配色、不新增字体或依赖。
- 用户已要求直接实施，不再设置计划审批或阶段确认；交付本地可审阅修改，不发布。

## Review Focus

- 无小物的新用户当场可开始可记录心愿的仪式，不能依赖今日推荐。
- 已消耗但留有待处理草稿的小物保留原选择，不重置或清除草稿。
- 普通心愿来源是已保存的 sourceSceneId；未知或隐藏来源不被替换为虚构来源。
- 去掉灯插画后奖励仍可通过 data-wish-id、data-arriving 及 reward-landed 找到卡片。
- 旧测试入口需跟随 new 路由；直接保存不可因残留界面绕过完成门槛。

---

### Task 1: 新仪式选择页及其导航

**Files:** Create `packages/app/src/wish-ritual-picker.tsx`; Modify `packages/app/src/wishes.tsx`, `packages/app/src/pages.tsx`; Test `packages/app/src/new-wish.test.ts`, `packages/app/src/scene-icons.test.ts`, `packages/app/src/ritual-scenes.test.ts`, `packages/app/src/scene-candy.test.ts`。

**Interfaces:** `NewWish(): ReactElement` 消费现有 App/SceneLibrary Context 并渲染选择页；选择器消费 `pendingVessels`、`usableVessels`、`sceneIntention`，通过 `useOpenScene()(entry, visit?)` 打开场景。首页按钮只 `go({page: 'new'})`。

- [x] 写行为回归：无小物也有直接入口且无表单；隐藏或不可写愿条目被排除；可用小物不会出现重复直接入口；pending 草稿仍以对应 vessel 打开。
- [x] 运行 `npm.cmd run test -w @wbr/app -- src/new-wish.test.ts`，确认新要求失败。
- [x] 实现选择器及 NewWish 替换；将首页旧折叠入口改为单一导航；更新依赖旧入口的现有集成测试。
- [x] 运行上述四个测试文件，确认普通入口、可用小物及旧草稿全通过。

### Task 2: 首页与详情减法

**Files:** Modify `packages/app/src/pages.tsx`, `packages/app/src/wishes.tsx`, `packages/app/src/App.tsx`, `packages/app/src/style.css`; Create `packages/app/src/wishes.css`; Test `packages/app/src/wish-detail.test.ts`, existing reward/ritual tests。

**Interfaces:** 保留 `.wish-card[data-wish-id]`、到达状态；详情通过 `state.sceneRecords` 或目录中相同 sourceSceneId 读取真实标题，未知来源只省略显示。

- [x] 补来源显示行为测试：真实 sourceSceneId 呈现实际标题，无来源旧记录正常显示原正文及下一步。
- [x] 运行 `npm.cmd run test -w @wbr/app -- src/wish-detail.test.ts`，确认新增来源要求失败。
- [x] 删除宣传横幅、灯缩略图、重复创建按钮；使用文字筛选和内容行；删除详情、还愿与记一笔的装饰插画，保留功能。
- [x] 用局部 CSS 精简卡片内容并排列双列小物选择；沿用 Animal Island 正式皮肤，保留键盘焦点及 reduced-motion。
- [x] 运行 App 测试并检查受影响功能，不为纯 CSS 或文案增加镜像测试。

### Task 3: 真实浏览器验证与来源记录

**Files:** Create `scripts/verify-wishes-simplification.mjs`, `docs/research/2026-10-27-wishes-simplification.md`; update spec 状态和本计划进度。

**Interfaces:** 浏览器脚本使用现有存储格式及实际 App，报告写入 `artifacts/wishes-simplification/`。

- [x] 真实浏览器验证空状态、有历史记录、筛选、选择页、详情、完成后记愿及取消不保存；检查 320 / 390 / 1280px，无横向溢出与页面异常，保存截图。
- [x] 运行 `npm.cmd test` 与 `npm.cmd run build`，保留输出和准确失败范围。
- [x] 完成来源核查清单：仅宿主和布局变化，引用既有场景心意核查，无新增传统事实；列明最终文件及验证。
- [x] 独立代码审阅并修复影响用户的发现；`git diff --check` 检查本次文件。保留本地修改供审阅。

## 执行记录

- 用户确认了具体设计及直接实施；无需再次批准执行方法。采用当前会话执行，委派独立审阅与验证。
- 2026-10-27：已识别原工作区有无关商店改动，使用原生管理工具创建隔离工作区。
- 执行回退：原生工作区位置不在当前沙箱可写范围，按技能回退到原项目 `D:\ws\app\cyber-bless`，本次只修改上列文件，保留原有商店素材差异。未执行发布或分支合并。
- 最终结果：全部步骤完成；全仓库 321 文件／10,835 测试、生产构建、320／390／1280px 生产浏览器验证通过，独立审阅的两项样式优先级问题已修复。详细结果见 `docs/research/2026-10-27-wishes-simplification.md`。
- 后续用户纠正：首轮视觉误将“减法”做成风格替换，用户要求回退重做。已撤回 flat `wish-space` 整套主题覆盖及 App 类名改动，恢复 Animal Island 皮肤；保留已确认的真实仪式路径。当前重做验证与截图见 `docs/research/2026-10-27-wishes-animal-island-redo.md`，前条为首轮历史结果。
