# 棉线慢成


## 2026-11-06 Komorebi 默认画风

共享环境默认启用已校准的 Komorebi 草地、光照与调色；按用户后续要求，背景树恢复原先逐场配置（原树及原有场景推荐），Komorebi 树仅作为调试台可选树种、选择后加载。分享、恢复与退出调试使用同一默认组合；夜景、没有植被的环境与器物主题树按原场景保留。这是产品背景美术统一，不新增植物地域、传统寓意或仪式规则；主题器物、动作、文案、来源身份、引擎和存档保持。[范围、来源核查与验证](../../../../docs/research/2026-11-06-komorebi-defaults.md)。

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


`indian-charkha` / `indian-charkha-craft` is an original open-frame Indian spinning-wheel appreciation scene. Sources and cultural boundaries: `content/traditions/indian-charkha-craft.md`.

Direct material gestures: pull cotton left60px to draft while wheel turns, crank right60px to add twist, then guide cotton right60px. The final action pauses wheel rotation while moving the thread back before slowly winding onto the spindle. The wheel and spindle turn at a6:1 illustrative drive ratio. A tangent cord belt joins both pulleys, with a moving splice showing travel. Yarn buffers update in place; a layered cop grows during winding. Frame feet and the initial cotton rest on real supports. No table, sign, invisible hit proxy, wish form, textures or copied assets.

This is a slowed illustration, not fiber-tension physics, complete spinning instruction or a museum-object replica. Pointer-guided cotton is held during drafting. The scene retains the tool's Indian textile context and acknowledges its modern historical association without ritual or efficacy claims. Optional audio is a quiet acceptance tone.

Pending drags cancel on invalid release, blur or pause. Accepted motion freezes while inactive and resumes for .85 seconds of active settlement. Keyboard and reduced-motion actions reach identical endpoints; checkpoints0–3 restore silently. Tests cover transmission ratio, support, pause before winding, buffer ownership, physical ray hits, camera bounds, cancellation, reentrant callbacks and once-only disposal. Browser evidence: ignored `artifacts/indian-charkha/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `indian-charkha-craft`。核查范围：实物结构与手工纺线原理；二十世纪初甘地、swadeshi/khadi 与抗殖民纺织背景。

边界：没有把馆藏制作时间当 charkha 起源；不附加转轮治愈心灵或固定礼序。三段动画不构成纺线教学。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#indian-charkha)与[来源卡](../../../../content/traditions/indian-charkha-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
