# 木柶行棋

`korean-yutnori` is an original single-piece free-play scene based on public museum/educational descriptions of yutnori. Cultural sources and scope are in `content/traditions/korean-yutnori.md`.

Object drags gather four half-round wooden sticks, toss them, then move one blue token according to their visible landing faces. Each toss randomly samples the four faces: one to four flat faces up mean one to four steps; no flat faces up means five steps. The token follows adjacent stations around the 20-station outer loop, retaining its location between rounds and wrapping around the loop. After moving, the user may toss again or choose “结束行棋” to finish. The cloth board has 29 distinct stations and lies on a low woven playing mat. Stick bodies have real closed geometry, flat and curved faces, distinct end grain and original short marks. Every stick remains grounded at rest and clears its neighbors during flight.

This assisted free play allows another toss after every result. Traditional multiplayer yutnori grants an extra throw for yut or mo; this scene has no opponents, stacking, capture, shortcuts or victory condition. Random sampling does not model physical tossing or historical result probabilities. The set is an original design, with no divination or efficacy claim. No table, board stand, wish form or entry sound. Optional quiet settlement tone. Silent restoration, real material hit testing, callback/pointer ownership, cancellation, keyboard equivalence and disposal follow the accepted scene lifecycle. Evidence is retained in `artifacts/korean-yutnori/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `korean-yutnori`。核查范围：韩国新年至正月十五、四柶步数及重投、多年龄参与和过去胜方丰收信念。

边界：没有可靠起源年月；只一枚棋子，不含完整分队、拦截和胜负，不能把单次结果视作占断。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#korean-yutnori)与[来源卡](../../../../content/traditions/korean-yutnori.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
