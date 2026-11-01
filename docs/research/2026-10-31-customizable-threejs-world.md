# 可触屏摆放收藏模型的 Three.js 小天地：交互库调研

实际核查日期：2026-10-31，Asia/Shanghai。状态：方案研究，未安装依赖、未修改产品代码、未做集成或手机实机验证。在线 `latest` 仅表示本次查询结果，不表示已在本项目安装。

本记录应用 [research skill](C:/Users/helio/.codex/skills/research/SKILL.md)，采用官方文档、维护者源码和发布包元数据。已阅读 [场景来源与文化关联核查规范](../scene-provenance.md)。本次只研究展示与编辑能力，不增加器物、文化来源、传统动作或寓意主张；后续若改动这些内容，仍需按该规范逐项核查。

## 结论

优先保留现有 vanilla Three.js 架构，以 `OrbitControls` 管理观察，以自定义 Pointer Events + Raycaster 将收藏物拖到指定台面／墙面；需要精调工具时再用 `TransformControls`。原生 `DragControls` 可做拖拽小样，但其默认拖动平面朝向相机，不能直接充当台面摆放系统。上述判断依据为 [r170 DragControls 源码](https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/controls/DragControls.js) 的 `onPointerDown/onPointerMove` 和 [r170 OrbitControls 源码](https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/controls/OrbitControls.js)。这是针对当前架构的工程建议，尚非已验证实现。

`@pmndrs/handle` 是值得验证的更强交互候选，确实可独立于 React 使用；它需要另一套 3D 指针事件接线。Drei 的两个控件能力合适，但依赖 R3F 上下文，当前仅为这些控件引入 R3F 的收益不足。相机若需要更完善的过渡与程序控制，可单独评估 `camera-controls`。

## 项目事实与推断

- 本地 `package-lock.json` 实际锁定 `three 0.170.0`、`react 19.2.3`，未安装 `@react-three/fiber` 或 `@react-three/drei`；相关 workspace 声明 `three ^0.170.0`。`^0.170.0` 不应被当成自动采用最新版 Three.js。
- 主代理对工作区的核查：现有 157 个 `scene.ts`，91 个 `model.ts` builder；World 当前使用最近三项的 `SceneArt` WebP。独立 builder 的数量不等于无需改造即可收藏的模型数量。例见 [蓝珠模型](../../packages/scenes/src/turkish-nazar-bead/model.ts)、[叶盘模型](../../packages/scenes/src/balinese-canang-sari/model.ts)、[短册场景](../../packages/scenes/src/tanzaku-tanabata/scene.ts) 与 [World 所在页面](../../packages/app/src/pages.tsx)。模型 root 可能包含准备托、神龛等场景附属；短册几何则内嵌场景，需要提取收藏物主体与完成态。
- 主代理核查确认 Expo DOM／WebView 复用 `@wbr/app`。因此可在共享 DOM 中实现单 canvas 小天地，无须先迁移到原生 3D；这是架构推断，WebView 手势、内存与恢复行为仍待实机验证。

## 能力与接入成本

| 方案 | 官方提供的能力 | 与本项目的关系、限制与判断 |
| --- | --- | --- |
| Three.js `DragControls`，r170 | 直接拖动物体，`dragstart/drag/dragend`，触屏 Pointer Events，`transformGroup`；源码也有旋转输入映射。 | 无新依赖。`touches.ONE` 默认平移，设置 `touchAction='none'`；源码按 `camera.getWorldDirection` 定义拖拽平面。没有面向地板／桌面选区、模型底面或碰撞规则。可参考拖拽结构，台面编辑仍需自定义投影。使用同版本 addon，避免复制最新实现混入 r170。[r170 源码](https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/controls/DragControls.js)、[当前文档](https://threejs.org/docs/pages/DragControls.html)。 |
| Three.js `TransformControls`，r170 | 平移、旋转、缩放 gizmo；`translationSnap/rotationSnap/scaleSnap`，`world/local`；`minX/maxX/minY/maxY/minZ/maxZ` 已存在于 r170。 | 无新依赖，适合精调。`attach(object)` 并将 `getHelper()` 加入场景；可监听 `dragging-changed` 暂停相机。位置范围约束和规则步进不等于对实际网格表面吸附。触屏走 pointer 输入，但 gizmo 对小屏手指的命中率未验证。这里的 min/max 直接核对 r170 源码 L107–112，未把最新新增 API 当成本地能力。[r170 源码](https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/controls/TransformControls.js)、[当前文档](https://threejs.org/docs/pages/TransformControls.html)。 |
| Three.js `OrbitControls`，r170 | 一指环绕、双指缩放与平移；可配置 `touches`、角度／距离／目标范围；支持阻尼。 | 仅控制相机，不能摆放模型。启用阻尼时需要循环 `update()`。物件编辑时需有明确手势互斥，避免同一触摸同时移动物件和相机。[r170 源码](https://raw.githubusercontent.com/mrdoob/three.js/r170/examples/jsm/controls/OrbitControls.js)、[当前文档](https://threejs.org/docs/pages/OrbitControls.html)。 |
| Drei `DragControls` | 受控／自动 matrix，`axisLock`、`dragLimits`、拖拽事件；源码由相机平面或指定法线平面投影，`axisLock='y'` 对应 XZ 平面。 | 当前发布查询为 `10.7.9`，peer 为 React／React DOM `^19`、Fiber `^9.0.0`、Three `>=0.159`，范围覆盖本地版本；但组件用 `useThree` 和 R3F 事件，需要 R3F 根。不能因本项目已有 React 就把它直接挂到现有 renderer。适合已选 R3F 的新场景，当前接入成本较高。[文档](https://drei.docs.pmnd.rs/gizmos/drag-controls)、[源码](https://raw.githubusercontent.com/pmndrs/drei/master/src/web/DragControls.tsx)、[发布元数据](https://registry.npmjs.org/@react-three/drei/10.7.9)。 |
| Drei `PivotControls` | 平移／旋转／缩放手柄，pivot／anchor，固定屏幕大小、禁用轴或操作、受控 matrix；源码包含三类变换 limits。 | 同样依赖 R3F。PlaneSlider 使用 pointer capture，并临时禁用 R3F 默认相机控件。它提供编辑器手柄，产品仍需定义摆放规则。官方页面标为 DOM only，不能据此视为原生 React Native 控件；本项目 DOM／WebView 路线可另行验证。[文档](https://drei.docs.pmnd.rs/gizmos/pivot-controls)、[组件源码](https://raw.githubusercontent.com/pmndrs/drei/master/src/web/pivotControls/index.tsx)、[PlaneSlider 源码](https://raw.githubusercontent.com/pmndrs/drei/master/src/web/pivotControls/PlaneSlider.tsx)。 |
| `@pmndrs/handle` | 官方 vanilla `HandleStore`；位移／旋转／缩放、轴与范围限制、自定义 `apply`、单／双指计算和可选 `multitouch`。 | 本次发布查询为 `6.6.32`。`handle` 与 `pointer-events` 的发布元数据均未声明 peerDependencies，**没有已声明的 Three 版本下限，也不等于已保证 r170 兼容**；仓库开发依赖使用 `three: latest`。无需 React／R3F；需先以本地 r170 做小样。[官方 vanilla README](https://raw.githubusercontent.com/pmndrs/xr/main/packages/handle/README.md)、[HandleStore 源码](https://raw.githubusercontent.com/pmndrs/xr/main/packages/handle/src/store.ts)、[发布元数据](https://registry.npmjs.org/@pmndrs/handle/6.6.32)、[仓库开发依赖](https://raw.githubusercontent.com/pmndrs/xr/main/package.json)。 |
| `camera-controls` | 相机一指 orbit、双指 pinch／truck、可配置输入与过渡；循环 `update()` 返回相机是否变化。 | 相机层候选，不处理收藏物拖拽。主代理已读官方 README、package 与 LICENSE；所读 `dev` manifest 的 Three peer 为 `>=0.126.1`，范围涵盖 r170，但应锁定具体发布版再验证。[官方 README](https://github.com/yomotsu/camera-controls/blob/dev/readme.md)、[package](https://github.com/yomotsu/camera-controls/blob/dev/package.json)、[LICENSE](https://github.com/yomotsu/camera-controls/blob/dev/LICENSE)。 |

### `@pmndrs/handle` 的 vanilla 接线边界

官方示例不是直接监听浏览器事件就完成拖拽：先用 `@pmndrs/pointer-events` 的 `forwardHtmlEvents(canvas, () => camera, scene)` 将鼠标／触屏事件转成带 3D 交点和 capture 的对象事件，每帧调用其 `update()`；再建立 `HandleStore(target, getOptions)`，执行 `store.bind(handleObject)` 并在循环调用 `store.update(time)`。卸载需要解绑 store 和销毁事件桥。`apply` 可拦截候选变换以执行产品规则。[pointer-events README](https://raw.githubusercontent.com/pmndrs/xr/main/packages/pointer-events/README.md)、[事件转发实现](https://raw.githubusercontent.com/pmndrs/xr/main/packages/pointer-events/src/forward.ts)、[store 实现](https://raw.githubusercontent.com/pmndrs/xr/main/packages/handle/src/store.ts)。

`handle 6.6.32` 依赖 `@pmndrs/pointer-events ~6.6.32` 与 `zustand ^4.5.2`；pointer-events 自身未列运行依赖或 peer。元数据通过 npm Registry 正文读取成功，web 工具对 Registry URL 失访后改用 PowerShell `Invoke-RestMethod`，未登记为浏览器已读。[handle 6.6.32](https://registry.npmjs.org/@pmndrs/handle/6.6.32)、[pointer-events 6.6.32](https://registry.npmjs.org/@pmndrs/pointer-events/6.6.32)。本次主要核查维护者 `main` 源码能力，发布包 API 与 r170 的组合尚未编译验证。

工程推断：该事件桥的 `stopPropagation` 不应被假定会自动停用独立监听 canvas 原生事件的 `OrbitControls`。继续用 OrbitControls 时应显式仲裁；若统一采用该包的 Screen Handles，也需另行验证迁移。它减少手势与变换计算工作，不会替项目决定物件能放在哪里。

## 产品仍需实现的部分

这些控件提供拖拽／变换或相机操作，没有提供本产品可直接使用的收藏空间规则。需自行定义：

1. 统一的收藏物 `subject` 根、展示尺度／缩放、底部 pivot 和完成态；当前模型单位不等于真实米制，不据此声称真实器物尺寸。不直接把完整仪式场景 root 当作收藏物。从供台拆出供物或改变陈设语境，可能影响器物／动作／用途主张，不能自动归为纯布局修改，应核对 `scene-provenance` 的相关要求。
2. 可摆放表面的身份与类型（台面、地面、墙挂）、Raycaster 命中、底面高度、朝向与有效区域；需要区分数值网格 snap 和几何表面吸附。
3. 物件 footprint／碰撞代理、越界与重叠判定、有效／无效预览及松手提交或恢复；是否允许叠放也属于产品规则。
4. 选择、拖拽与相机的状态机，双指加入、pointercancel、失焦、暂停及 WebView 恢复；移动端可触达的旋转／移除／撤销入口。
5. 独立 layout 存档：以 `collectible.id` 标识实例，而非仅用 `sceneId`，因为同场景可在不同日期重复收藏。首版可存 `position + yaw + surfaceId`；缺少布局字段的旧档使用默认摆放，拖放松手后提交一次。若开放缩放则另存 scale。保持仪式完成记录与收藏摆放语义分开。

以上为本项目需要的工程工作划分，不是对现有收藏场景文化性质的判断。

## 许可、读取状态与待验证事项

Three.js r170 为 [MIT](https://raw.githubusercontent.com/mrdoob/three.js/r170/LICENSE)；Drei [manifest](https://raw.githubusercontent.com/pmndrs/drei/master/package.json) 标记 MIT。`@pmndrs/handle` 元数据写 `SEE LICENSE IN LICENSE`，实际阅读其 [LICENSE](https://raw.githubusercontent.com/pmndrs/xr/main/packages/handle/LICENSE) 后确认是 MIT 授权条款：可使用、修改与分发，需保留版权与许可声明。上线资产仍要另核各自模型／贴图许可，库许可不覆盖资产。

上文官方 docs 与 raw 源码均已读相关正文／函数，未声称通读全部仓库。GitHub `packages/handle` 目录页曾失访，已改读同一仓库 raw 文件；未用搜索摘要补作已读来源。在线 `main/master/dev` 为移动分支，实施时应锁定发布版并复核，Three.js 对照则固定为 `r170`。

下一步若获准实施，优先做一块台面、三件不同体量藏品的最小交互验证：一指拖物／空白处转相机、双指进入／退出、松手吸附、越界恢复、存档重开。验证浏览器和 iOS／Android WebView 的触屏、取消、相机冲突、内存与帧率，再决定是否引入 handle。**本次未运行这些验证，也未运行构建或技术测试；当前交付是源码与文档调研。**
