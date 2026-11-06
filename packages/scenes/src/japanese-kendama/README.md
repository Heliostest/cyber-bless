# 剑玉轻接


## 2026-11-06 Komorebi 默认画风

共享环境默认启用已校准的 Komorebi 草地、光照与调色；按用户后续要求，背景树恢复原先逐场配置（原树及原有场景推荐），Komorebi 树仅作为调试台可选树种、选择后加载。分享、恢复与退出调试使用同一默认组合；夜景、没有植被的环境与器物主题树按原场景保留。这是产品背景美术统一，不新增植物地域、传统寓意或仪式规则；主题器物、动作、文案、来源身份、引擎和存档保持。[范围、来源核查与验证](../../../../docs/research/2026-11-06-komorebi-defaults.md)。

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


`japanese-kendama` / `japanese-kendama-craft` is an original Japanese cup-and-ball appreciation scene. Primary references and boundaries are in `content/traditions/japanese-kendama-craft.md`.

Three direct upward60px handle drags lift the ball into the large cup, transfer it to the small cup, then align the socket over the spike. Each toss first clears the receiving surface before the handle turns. The pointer represents a hand holding the wooden ken. The toy starts and finishes on a cloth; no display furniture or invisible hit proxy. Concave cups fit the ball's sphere, and the open socket's internal stop meets the spike. The string stays attached at both ends and reuses its geometry buffer. Ball paint uses three material batches rather than one draw per face.

Assisted trajectories/string shape illustrate timing and orientation; they are not full collision/tension physics, complete technique instruction or grading. Original proportions and paint, no copied media or association marks. No wish form, efficacy claim or entry sound. Optional feedback is a quiet acceptance tone.

Input ownership, invalid gestures, interruptions, callback reentry and disposal use the established scene lifecycle. Reduced motion, keyboard and silent checkpoints0–3 reach the same poses. Real geometry tests cover cup contact, socket/spike seating, grounded starting pose, string endpoints, all-vertex framing and stable buffers. Browser evidence is saved in ignored `artifacts/japanese-kendama/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `japanese-kendama-craft`。核查范围：剑玉结构、1876 教育报告、1919 日月球及 1975 协会等发展节点。

边界：不采全球起源争论；自动接球不是真实难度，三接不等于传统固定练法或竞技资格。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#japanese-kendama)与[来源卡](../../../../content/traditions/japanese-kendama-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
