# 剑玉轻接

`japanese-kendama` / `japanese-kendama-craft` is an original Japanese cup-and-ball appreciation scene. Primary references and boundaries are in `content/traditions/japanese-kendama-craft.md`.

Three direct upward60px handle drags lift the ball into the large cup, transfer it to the small cup, then align the socket over the spike. Each toss first clears the receiving surface before the handle turns. The pointer represents a hand holding the wooden ken. The toy starts and finishes on a cloth; no display furniture or invisible hit proxy. Concave cups fit the ball's sphere, and the open socket's internal stop meets the spike. The string stays attached at both ends and reuses its geometry buffer. Ball paint uses three material batches rather than one draw per face.

Assisted trajectories/string shape illustrate timing and orientation; they are not full collision/tension physics, complete technique instruction or grading. Original proportions and paint, no copied media or association marks. No wish form, efficacy claim or entry sound. Optional feedback is a quiet acceptance tone.

Input ownership, invalid gestures, interruptions, callback reentry and disposal use the established scene lifecycle. Reduced motion, keyboard and silent checkpoints0–3 reach the same poses. Real geometry tests cover cup contact, socket/spike seating, grounded starting pose, string endpoints, all-vertex framing and stable buffers. Browser evidence is saved in ignored `artifacts/japanese-kendama/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `japanese-kendama-craft`。核查范围：剑玉结构、1876 教育报告、1919 日月球及 1975 协会等发展节点。

边界：不采全球起源争论；自动接球不是真实难度，三接不等于传统固定练法或竞技资格。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#japanese-kendama)与[来源卡](../../../../content/traditions/japanese-kendama-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。
