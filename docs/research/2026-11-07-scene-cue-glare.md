# 玻璃提示的周期高光

日期：2026-11-07。目标：保持现有半透明玻璃，在静置时周期性出现一束高反光扫光。

## 参考与选择

2026-11-07 实际阅读 React Bits [Glare Hover 说明](https://reactbits.dev/animations/glare-hover)、[TypeScript 源码](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Animations/GlareHover/GlareHover.tsx)、[CSS](https://github.com/DavidHDev/react-bits/blob/main/src/ts-default/Animations/GlareHover/GlareHover.css) 以及 [LICENSE.md](https://github.com/DavidHDev/react-bits/blob/main/LICENSE.md)。其中循环模式、斜向光带、较亮边缘适合本次玻璃提示。另读 [Shiny Text](https://reactbits.dev/text-animations/shiny-text) 的公开说明，其作用对象是字形，与本次玻璃表面的目标不同。

采用 Glare Hover 的视觉方向，在现有 Three.js 材质中独立实现亮带和边缘反射；不复制 React Bits 组件代码，不引入 DOM 包裹层或额外动画依赖。React Bits 当前许可为 MIT + Commons Clause；本次是视觉参考，非该组件的代码移植。

## 节奏与实现

- 提示稳定约 3.2 秒后首次扫光，每次约 1.1 秒；两次扫光之间静置 8.5 秒。
- 柔和的斜向亮带扫过表面，细边缘出现更明亮的反射；字形保留原有颜色。夜景表面亮度更低，边缘仍清楚。
- 等待时只有一个可取消定时器；高光期间复用已有按需／常驻帧调度，不为静置高光维持常驻渲染循环。
- 拖动、实时进度、提示换词、暂停、页面隐藏及减少动态效果时停止；恢复后重新等待，卸载时清除定时器与动画状态。

## 文化影响与核查

按 [场景来源规范](../scene-provenance.md)，本次只增加产品辅助界面的材质动画，沿用 [玻璃提示核查](2026-11-07-scene-cue-glass.md) 的范围与既有文化核查入口。器物、材质所指对象、手势、完成条件、文案、来源关联与技术 ID 不变；高光周期不代表传统要求，无新增文化主张。来源卡、宿主目录、注册表、metadata 与场景 README 无对应事实变化。

验证计划：测试延迟、重复周期、按需唤醒、取消与恢复、卸载清理；浏览器检查高光前／中／后、昼夜文字可读性、无 GL 错误及减少动态效果；更新场景测试版本指纹并执行相关测试与构建。

## 验证结果

- `npm test` 完整通过：App 1,708 项、场景 10,819 项、运行时 352 项，以及其余工作区、资源、Windows 工具和测试指纹脚本。合并前另跑共享提示／材质／定时器相关 43 项通过，TypeScript／Vite 构建通过。
- 真实 Edge / WebGL 验证定时唤醒、扫光结束后停止额外刷新、减少动态效果、拖动与取消、`inert` 暂停层、宿主暂停；无 JavaScript／GL 错误。空闲计数在独立同源文档中测量，避免 App 字体加载的合法单次刷新干扰。
- 评审指出 GLSL 对负底数 `pow` 的结果未定义，已将光带平方改为直接乘法，避免移动 GPU 兼容问题。
- 本地预览与接触表：`artifacts/scene-cue-glare/preview.gif`、`contact.png`；浏览器验证脚本与报告：`artifacts/verify-scene-cue-glare.mjs`、`artifacts/scene-cue-glare/report.json`。
- 158 个场景测试版本指纹已生成并核对；文化影响范围与上述记录一致，没有新增文化断言或操作规则。
