# 木旋起沫

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

`mexican-molinillo` / `molinillo-chocolate-craft` is an original wooden chocolate-whisk appreciation scene. The source rationale and cultural boundaries are in `content/traditions/molinillo-chocolate-craft.md`.

Three direct-material gestures: lower the handle 60 screen pixels, roll right 60 pixels, then left 60 pixels. The fluted head straddles the opaque chocolate surface; two loose rings rest on their collars and rotate with a lag relative to the shaft. Illustrative foam grows inside the cup. The cup remains fixed. No furniture, wish form, copied media, custom shaders, recipe, regional replica, or efficacy claim.

Immediate drag poses reset silently on invalid release, cancellation, pause or blur. Valid release settles within .85 seconds before reporting progress. Keyboard actions are equivalent; reduced motion snaps to the same endpoint. Checkpoints 0–3 restore silently. Sound is an optional quiet acceptance tone, not a recording of the utensil.

Real geometry/raycast tests cover partial immersion, grounded cup, collar contact, bounded foam, alternating rotations, cancellation, full camera bounds, input ownership, reentrant host callbacks, pause/restore and once-only disposal. Browser evidence lives in ignored `artifacts/mexican-molinillo/`.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `molinillo-chocolate-craft`。核查范围：墨西哥厨房用途、双掌转柄、靠近液面起泡原理和十九世纪晚期实物。

边界：不采用有争论的前西班牙起源断言；环数不代表统一地方类型，两次短拖泡沫为示意而非配方。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#mexican-molinillo)与[来源卡](../../../../content/traditions/molinillo-chocolate-craft.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
