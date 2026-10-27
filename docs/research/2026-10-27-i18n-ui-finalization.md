# 八语言 UI 复核问题修复记录

日期：2026-10-27。依据：[八语言设计](../superpowers/specs/2026-10-27-i18n-design.md)、[独立复核](2026-10-27-i18n-independent-review.md)、[场景来源规范](../scene-provenance.md)。本记录只覆盖本次 UI 收尾；不代替主实现者的全量构建、浏览器矩阵或设备验收。

## 修复范围

- `packages/app/src/scene-library.tsx`：搜索同时匹配当前译名、原始标题和技术 ID，忽略大小写和重音差异；搜索标签与 placeholder 在渲染时翻译。语言变化也更新筛选结果对应的缓存状态。缓存提示保留源字符串、显示时翻译，MiB 数值按地区格式化。未知标题标记 `lang="und"`。
- `ritual.tsx`、`scene-experience.tsx`、`woodfish.tsx`：木鱼说明在 state 中保留源字符串，在展示入口调用 `translateScene`；保留引擎实例，不增加 locale key。旧仪式的名称、心意标签和动作也在显示处翻译。木鱼进度、心愿还愿摘要和笔记上下文使用完整 ICU 消息。
- `woodfish-scene.ts`：交互 cue 使用 `@wbr/scenes` 导出的 locale-aware `addInteractionCue`，传入源字符串，由 getter 获取当前语言。未修改木鱼模型、敲击、完成条件或存档语义。
- `scene-experience.tsx`：升级、记录失败及文案配置错误抛出 `productError(source)`，不把译文放入 `Error.message`。异常兜底也保留源字符串，错误展示处再翻译；en/ja/fr 的升级要求保持正确恢复语义。
- `wishes.tsx`：笔记 500 字、还愿 60 字统一按字素计数及切片；textarea 的 UTF-16 安全上限为 8192。composition 期间保留输入、不截断、不提交，结束后按字素限制；提交再次检查上限。计数器用 `app.input.counter`，用户标题和文本不经过翻译器。保留既有未提交的心愿页面改动。
- `wish-ritual-picker.tsx`：器物区标题、ARIA、待处理/使用说明均进入翻译。

新语义消息 `app.woodfish.progress(n,min)` 与 `app.wish.returnSummary(status,method)` 由主实现者统一维护八语言词表。本次未修改词表、包依赖、锁文件、App 宿主或其他工作者拥有的文件。

## 复现与验证

新增 `packages/app/src/i18n-ui-finalization.test.ts`。修复前，最初 7 项行为复现全部失败，分别覆盖搜索显示入口、笔记输入上限、还愿上限、木鱼实时语言和三种语言的升级恢复。修复后扩为 10 项，补充还愿草稿/IME、旧仪式语言变化、未知远端说明的保留边界。

最终定向命令：

```text
npm.cmd run test -w @wbr/app -- src/i18n-ui-finalization.test.ts src/scene-catalog.test.ts src/wish-detail.test.ts src/woodfish-press.test.ts src/ritual-complete.test.ts src/wish-ritual-rack.test.ts src/scene-load-error.test.ts
```

结果：7 个文件、60 项测试通过；无 React act 警告。还执行了 `npx.cmd tsc -p apps/cyber-bless/tsconfig.app.json --noEmit`，退出码 0。未重复运行已完成的 9,422 项场景测试。

## 来源核查与验收边界

本次核对了实际显示入口、木鱼 cue 和输入/错误流。更改只调整已有文案的本地化时机、搜索、字素处理和语言标记；没有新增或改变器物、材质、动作、先后/数量要求、寓意、宗教背景、标题内容或来源绑定。沿用现有 [2026-10-19 来源审阅](2026-10-19-scene-culture-audit.md) 及本轮批准设计；来源卡、注册表、metadata、场景 README 与技术 ID 无需因这些技术修复改写。

旧远端 Pack/CatalogEntry 没有来源语言字段。未知说明、标题和 presentation caption 保留原文并标记 `lang="und"`，不推断语言或伪称已有目标译文；准确来源语言需要后续有明确元数据的协议。内置内容仍使用已登记的本地词表。

技术测试证明上述行为和显示入口一致；不证明八语言母语自然度、文化语义人工审校、真实 iOS/Android 输入法/读屏或完整浏览器布局矩阵已经验收。document.title、启动偏好所有权、其他页面完整句 ICU 和发布门禁由主实现者收尾。
