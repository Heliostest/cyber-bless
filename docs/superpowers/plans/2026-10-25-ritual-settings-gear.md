# 仪式设置齿轮菜单

**目标：** 顶栏音效、震动、视觉风格收进一个齿轮按钮；同一圆角外壳向下展开，打开时齿轮持续按下，点击外部或再次点击齿轮收回。

**实现：** 延用 React/CSS 与现有图标、设置存储和视觉风格弹窗。菜单固定 52px 宽、关闭高 52px、24px 圆角，顶端位置固定，仅高度以 420ms 对称 ease-in-out 变化。设置按钮竖排且触摸区域至少 44px；不支持的震动和没有 renderer 的视觉风格继续隐藏。

**范围：** 只改产品设置呈现、焦点和事件交互。沿用既有 [场景核查](../../research/2026-10-24-scene-interaction-review.md)，不改场景器物、动作、正文、来源或传统主张。

- [x] FeedbackControls 先补行为回归，再实现外点/齿轮关闭、连续反向、减少动态、焦点恢复与 scope 内原生返回消费。
- [x] 顶栏保留单齿轮空间，新增 gear 图标，主 CSS 导入专用菜单样式。
- [x] VisualStyleControl 提供可选 `onOpenChange(open:boolean)`；父菜单在子弹窗打开时暂停外点/键盘拦截，保持子控件挂载。渲染器注销时清除旧弹窗并释放父菜单。
- [x] 返回顺序：先关闭视觉风格弹窗，再收回齿轮菜单，最后离开场景。
- [x] 更新设置入口测试，验证实际先打开齿轮再操作，保留设置持久化、风格保存和场景隔离。
- [x] app 测试、构建及 320×568/390×844/1132×1244 浏览器检查；记录高度动画、顶端/圆角不变、外点不穿透与子弹窗操作。

**重点边界：** 父菜单不能吞掉 portal 子弹窗输入；收回期间不能点击穿透；卸载不能留下滚动锁或文档监听；菜单不应挤压场景画布或标题。

**验证记录：** `npm.cmd run test -w @wbr/app`：29 个文件、1074 项通过；`npm.cmd run build` 通过。`EXPO_OFFLINE=1 npm.cmd run mobile:verify` 通过 Android/iOS 离线导出核验，两端各 158 个 DOM 脚本、14 个离线资源，iOS 另核验 465 个小组件封面哈希。日志位于 `artifacts/gear-menu-all-app-tests.log`、`artifacts/gear-menu-build.log`、`artifacts/gear-menu-mobile.log`；移动端结果为 `artifacts/mobile-verification/latest.json`。

**浏览器证据：** `node scripts/verify-feedback-menu.mjs` 在最新生产构建、同一 Edge 进程依次完成三个视口，3 项通过、0 项失败、0 pageerror/console error。报告与开合截图位于 `artifacts/feedback-menu-2026-10-25/`。菜单 52→196px 高度过渡各有 22 个中间帧，CSS transitionend 记录 420ms；宽度、顶端、右侧锚点和四角 24px 半径不变；测试覆盖竖排触点、设置存档、外点事件屏蔽、连续反向、视觉风格选择和焦点/锁恢复、下一次正常返回。验证的是浏览器交互和设置数据，不代表物理扬声器或震动输出。

**验收排查：** 初版脚本将收起的 `.ritual-narrative-body[inert]` 误判为菜单残留，已改为完整 inert 节点基线比较。首次 390px 运行出现过场景加载失败，截图保存为 `390x844-initial-renderer-failure.png`；当时未记录原始技术详情，未认定其原因或声称已修复。最新构建的独立 390px 和随后完整三视口均通过；脚本现会记录后续加载失败的技术详情。
