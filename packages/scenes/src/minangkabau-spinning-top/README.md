# 木陀轻转

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`rotor`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源仍为 `product-original`，不新建传统卡。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

An original tabletop wooden-top toy: pull the wooden bead to unwind the cord, tap the cap to slow the top, then quietly look or submit an optional line. It has no regional or ritual provenance assignment.

## Provenance correction · 2026-10-19

- The former title and Minangkabau association combined the local editorial brief's suggested departure/return metaphor with an invented tabletop mechanism. [Traditional Settlement at Nagari Sijunjung](https://whc.unesco.org/en/tentativelists/6059/) describes settlement and matrilineal houses; it does not establish the top's mechanism or a homecoming meaning.
- Official Indonesian documentation does record regional gasiang games. That fact alone does not establish this model's board-mounted pull-bead choreography or its former departure/return narrative. Evidence and reading limits are recorded in [the source review](../../../../docs/research/2026-10-19-yeondeunghoe-spinning-top.md).
- The scene now uses `PRODUCT_ORIGINAL`; the app catalog has no `traditionSlug`. No other culture is substituted. `minangkabau-spinning-top`, `minangkabau-spinning-top@1` and the factory export keep their legacy names for record and engine compatibility.

## Pointer choreography

1. Checkpoint 0: press visible opaque mesh `top-pull-bead`, move it toward visible opaque mesh `top-pull-anchor` on the board, and release over the anchor. At least one pointer move with more than eight pixels of travel is required. The cotton cord follows the bead, coils unwind, and the top starts rotating around its vertical spindle.
2. Checkpoint 1: press and release `top-cap` without more than twelve pixels of travel. The top decelerates and settles on its board contact point.
3. Checkpoint 2: tap `top-cap` quietly, or explicitly submit the optional wish form. A quiet tap discards the draft. Returning visits have no writer and create no new wish.

The auxiliary button runs the same acceptance and completion paths. Pointer starts and releases require the nearest visible opaque mesh to be the intended object; another opaque surface blocks the gesture. During a drop only the held bead and its moving cord are excluded. Progress is exactly 0 → 1 → 2 → 3. Reduced motion settles each accepted operation immediately, with no continuing spin or wobble. Pause and blur cancel unfinished input and freeze accepted animation.

## 2026-10-20 介绍扩充

“了解这个仪式”补充木陀、棉绳、木珠与起转、停下的关系，将短暂停留的意义留给体验者。文案在 [`scene-narratives/original.ts`](../../../core/src/scene-narratives/original.ts) 维护；没有新增米南加保、返乡或古老起源主张，来源分类仍为 `product-original`。实际呈现和边界见[本轮研究](../../../../docs/research/2026-10-20-scene-narratives-original.md#六个产品原创场景)。未改交互或结束条件。

## Validation

`npm run test -w @wbr/scenes -- src/minangkabau-spinning-top/scene.test.ts`

The 25 tests preserve real Three geometry, whole-scene occlusion raycasts and projected DOM cues, mocking only GPU rendering. They exercise 320/390/1280px framing, pointer ownership, invalid start/drop, cancellation, pause/blur, explicit wishes, silent restore, reduced motion and disposal. Six added regressions first failed on a real opaque occluder in front of the source or release target, then passed with nearest-surface validation. Root handles application integration, full-suite/build/mobile and actual browser review.


## 2026-10-26 空间跟手与到位完成

木拉珠与棉绳联动到板上锚点自动拉绳起转；点帽停转与静看保留。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
