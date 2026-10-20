# 木偶开果

`german-nutcracker` / `erzgebirge-nutcracker-craft` is an original wooden figure for appreciating a rear-lever nutcracker mechanism. Source rationale and cultural boundaries: `content/traditions/erzgebirge-nutcracker-craft.md`.

Three direct-material drags: raise the rear lever 60 screen pixels, place the walnut, then lower the lever 60 pixels. Walnut placement accepts either the original upward swipe or a drag released over the open mouth, with a small tolerance around the jaw's actual nut seat. The mouth has a projected destination cue; release, pointer ownership and cancellation remain required. The lower jaw and lever share one axle; the beard is attached to the moving jaw. A clear curved path places the nut in the open mouth. Two capped shell halves separate to reveal a kernel. The plinth supports both boots and the resting walnut. No invisible hit proxies, furniture, wish form, copied media, textures or custom shaders.

Original outfit, proportions and slowed mechanics are illustrative, not a collection replica, physical fracture simulation or instructions to operate modern ornaments. Optional audio is a quiet acceptance tone, not a recorded cracking sound.

Invalid release or cancellation restores a pending drag to its checkpoint silently; pause and blur cancel that pending drag. After valid release, settling motion freezes while inactive and resumes on return, using .85 seconds of active time. Keyboard and reduced-motion actions produce the same checkpoint poses. Checkpoints 0–3 restore without feedback. Geometry/raycast tests cover physical targets, jaw linkage, nut placement, shell clearance, cancellation, camera bounds, pointer ownership, reentrant callbacks and once-only disposal. Real browser evidence is retained in ignored `artifacts/german-nutcracker/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `erzgebirge-nutcracker-craft`。核查范围：赛芬矿业向木作转变、十八世纪中叶玩具生产及约 1957 年具体胡桃夹子机制；圣诞陈设由馆藏主题支持。

边界：不把单件年代当胡桃夹子起源；未给造型附加守护或驱邪寓意。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#german-nutcracker)与[来源卡](../../../../content/traditions/erzgebirge-nutcracker-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。
