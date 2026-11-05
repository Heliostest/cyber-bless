# Tree debug selection implementation plan

> **For agentic workers:** Use the existing debug-console and scene-runtime patterns; independent asset preparation runs in parallel while the primary agent implements integration.

**Goal:** 在调试台切换原有树、Quaternius 和 Just a simple tree，保持当前场景进度。
**Architecture:** 固定 GLB 资产 + 共享实例化加载器 + App 作用域调试选择；成功后原位替换背景树。
**Tech Stack:** Three.js 0.170、React、Vitest、Playwright。
**Spec:** `docs/superpowers/specs/2026-11-05-tree-debug-selection-design.md`

## Constraints and review focus

- 保留 source/hash/license；免费资产，不购买，不带外部音频。
- 异步竞争／失败／卸载不泄漏或覆盖新选择；原有树可恢复。
- 日夜均可选；无树和主体文化树不误报支持。
- 叶片 alpha 和簇法线保留；暂停／截图不推进风。
- 不重建 App/场景会话；折叠保留、调试卸载恢复，不写正式偏好。

## Tasks

- [x] 获取两套真实源资产，各输出 `assets/environments/trees/{quaternius,simple-tree}/{round,cluster}.glb`，保留来源和可重复生成脚本。
- [x] 先写调试注册表作用域／恢复测试及加载器竞争／释放测试，运行确认缺少实现而失败。
- [x] 实现 `debug-trees.ts`、`imported-trees.ts` 和环境树切换，沿用原有布局／实例化和动态偏好。
- [x] 先写调试 UI 操作测试，再实现 `TreeDebugControls`，接入现有调试台与八语言词表。
- [x] 同步离线资源、来源文档和调试台说明；校验两宿主资源完整性。
- [x] 运行相关 Vitest、类型／构建、i18n 校验，真实浏览器比较三档并检查快速切换、恢复、日夜和资源释放。

完成记录：来源生成器 byte check、全部包的 Vitest、Web 构建、八语言校验、158 场景版本检查均通过。全量命令在沙箱中的最后一组本地网络／Windows Node 测试遭遇访问限制；将该组和最后的版本测试移到本机环境重跑，41/41 通过。真实 WebGL 34 个“来源×风格”组合无 shader 错误，反复恢复后的 GPU 几何／纹理数量稳定。独立代码审阅提出的三个问题均经回归修正；没有待处理的功能问题。详见 `docs/research/2026-11-05-tree-debug-selection.md` 与 `artifacts/tree-debug/`。
