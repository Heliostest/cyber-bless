# 木偶开果

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


## 当前操作（2026-10-26）

开口后将胡桃跟手送到木偶口中范围；抬杠杆与压杠杆仍保持下颌和杠杆的转轴联动。

操作 1 在持有移动中按真实物件锚点或布面覆盖核对目标，到位即接续落定，不再以指定方向、固定拖距或松手作为摆放成功条件。未到位的取消恢复当前检查点；已经接受的同次触摸不能操作下一步。辅助按钮、减弱动态、暂停恢复和旧整数／variant 存档保持。

本次只更新产品输入及对应提示，器物、材料、动作顺序、文化含义与来源身份保持；没有新增传统规则。下方较早记录中关于方向、固定拖距和摆放松手验收的说明属于历史实现，当前输入以本节为准。具体逐场边界、来源状态与验证见[本轮 B 组记录](../../../../docs/research/2026-10-26-spatial-placement-audit-b.md)。

`german-nutcracker` / `erzgebirge-nutcracker-craft` is an original wooden figure for appreciating a rear-lever nutcracker mechanism. Source rationale and cultural boundaries: `content/traditions/erzgebirge-nutcracker-craft.md`.

Three direct-material drags: raise the rear lever 60 screen pixels, place the walnut, then lower the lever 60 pixels. Walnut placement accepts either the original upward swipe or a drag released over the open mouth, with a small tolerance around the jaw's actual nut seat. The mouth has a projected destination cue; release, pointer ownership and cancellation remain required. The lower jaw and lever share one axle; the beard is attached to the moving jaw. A clear curved path places the nut in the open mouth. Two capped shell halves separate to reveal a kernel. The plinth supports both boots and the resting walnut. No invisible hit proxies, furniture, wish form, copied media, textures or custom shaders.

Original outfit, proportions and slowed mechanics are illustrative, not a collection replica, physical fracture simulation or instructions to operate modern ornaments. Optional audio is a quiet acceptance tone, not a recorded cracking sound.

Invalid release or cancellation restores a pending drag to its checkpoint silently; pause and blur cancel that pending drag. After valid release, settling motion freezes while inactive and resumes on return, using .85 seconds of active time. Keyboard and reduced-motion actions produce the same checkpoint poses. Checkpoints 0–3 restore without feedback. Geometry/raycast tests cover physical targets, jaw linkage, nut placement, shell clearance, cancellation, camera bounds, pointer ownership, reentrant callbacks and once-only disposal. Real browser evidence is retained in ignored `artifacts/german-nutcracker/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `erzgebirge-nutcracker-craft`。核查范围：赛芬矿业向木作转变、十八世纪中叶玩具生产及约 1957 年具体胡桃夹子机制；圣诞陈设由馆藏主题支持。

边界：不把单件年代当胡桃夹子起源；未给造型附加守护或驱邪寓意。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#german-nutcracker)与[来源卡](../../../../content/traditions/erzgebirge-nutcracker-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 默认推荐树木与暖阳配色（2026-11-05）

按用户指定，正式默认背景采用层叠针叶树。配色默认采用暖阳小镇。这是考虑地区园林与季节的产品布景，不改变主题器物、动作或文化来源，也不表示该树是仪式必需植物；春景属于产品选景，不构成真实季节或仪式门槛。实际已读证据、对应范围与排除项见[地区树形记录](../../../../docs/research/2026-11-05-regional-tree-evidence.md)；默认启用与分享行为见[默认布景核查](../../../../docs/research/2026-11-05-environment-defaults.md)；树形与许可见[素材记录](../../../../assets/environments/trees/README.md)。
