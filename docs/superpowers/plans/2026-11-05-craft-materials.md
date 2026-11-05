# Craft Materials Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为用户确认的木牌、陶鸡、铃、御守增加柔和手作质感。

**Architecture:** 在 scene-runtime 新建显式材质工厂及可复制的局部坐标着色补丁；卡通与画廊材质适配器组合该补丁。仅四场选定部件调用工厂，沿用现有生命周期。

**Tech Stack:** Three.js r170, TypeScript, Vitest, Chromium/WebGL。

**Spec:** `docs/superpowers/specs/2026-11-05-craft-materials-design.md`

## Global Constraints

- 无新依赖、网络材质请求、透射或额外渲染目标。
- 保持原有器物材料身份、颜色、纹样、几何、交互和文化绑定。
- 仅四场；小屏幕按像素足迹减弱细纹；退出恢复源材质并释放自有资源。

## Review Focus

- 卡通克隆不会复制 onBeforeCompile：测试转换后补丁仍生效。
- 材质数组、动画色与粗糙度：测试每个材质恢复及动态数值同步。
- 无 UV 的陶鸡主体：真实 WebGL 使用局部投影，不能依赖 UV。
- 风格切换与外部贴图所有权：测试转换器只释放自有材质。
- 320px 织纹与木纹：实截图检查细纹不过密、不出现明显闪烁。

### Task 1: Shared craft material and style compatibility

**Files:** Create `packages/scene-runtime/src/craft-surfaces.ts`, `.test.ts`; modify `toon-surfaces.ts`, `gallery-surfaces.ts`, package exports.

**Interfaces:** `createCraftMaterial(parameters, {kind, scale?, strength?, axis?})` returns MeshStandardMaterial; `copyCraftSurface(source,target)` composes shader hooks; `hasCraftFinish(material)` identifies ceramic/metal reflection preservation.

- [x] 写转换后纹理保留、物理高光、动态数值、恢复与资源所有权测试并确认失败。
- [x] 实现 wood/ceramic/metal/fabric/cord 程序细节，组合到两套转换器。
- [x] 运行 scene-runtime 测试，确认通过。

### Task 2: Four scene integrations and provenance

**Files:** Four scene.ts and README files; `docs/research/2026-11-05-craft-materials.md`.

- [x] 按已有材料变量明确替换木、陶、铃、袋与绳；绘画/装饰色保留，彩绘陶鸡仍是陶。
- [x] 运行四场既有真实几何、指针、恢复和销毁测试。
- [x] 记录逐场实际材料、产品美术表现与既有文化证据边界，不新增事实。

### Task 3: Actual rendering and completion

- [x] 拍摄相同状态的前后对比；验证四风格、日夜、320/390px 及材质编译错误。
- [x] 完成适用测试与生产构建，更新场景修订索引并核查 diff。
- [x] 人工审阅补丁组合、原材质恢复和文化核查清单，交付对比图与限制。

## Execution record

- 2026-11-05：用户已确认四场首批方向，在当前干净工作区创建功能分支；不另建大资源副本。按本会话直接执行，保持可审阅 diff。
- 完成：最终 260 项运行时测试、四场 113 项定向交互测试、完整测试链分段通过及生产构建通过。最终固定源码 WebGL 194 次渲染无错误，包含真实场景的原有夜间灯组。独立审阅提出的导数和夜间覆盖问题均已修复；详细数字与日志见研究记录。
