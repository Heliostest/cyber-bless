# 木勺寄情 / Welsh love spoon

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`spoon`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `welsh-love-spoons`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/welsh-love-spoons.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。

Original procedural carved-wood gift scene. Three checkpoints: drag the real folded cloth onto the concave bowl; carry the complete spoon by its carved handle to the felt seat; tap the spoon quietly or explicitly submit an optional 40-character wish. Quiet completion discards drafts. Returning suppresses the writer. No promise of ritual efficacy.

## Sources and scope

Read on 2026-10-13:
- Local `content/traditions/welsh-folk.md`: C, low sensitivity; public folk-craft context. Viewed its JPG: a Mari Lwyd horse-head performance, **not a love-spoon reference**; no visual details borrowed.
- Amgueddfa Cymru / Museum Wales, https://museum.wales/blog/1033/Welsh-love-spoons/ (the articles/1033/Welsh-lovespoons route redirects here): public gift-craft history, decorative wooden spoons and the museum's earliest dated example (1667). This does not establish a universal invention date. Origins and motif meanings are not reduced to one rule.
- Visit Wales, https://www.visitwales.com/things-do/culture/cultural-activities/have-go-some-traditional-welsh-crafts : contemporary public craft participation and love-spoon carving.
- Initial `/articles/1033/en/lovespoon/` route and a truncated PDF lead were unavailable; not used as evidence.

The single heart opening and lozenge are invented geometry, not a copy of an identifiable maker's design. No Mari Lwyd, bardic ceremony, sacred object or universal symbolism is enacted. Registry category is 许愿; metadata grade C, sensitivity 低, gestures drag + wishWrite, tradition welsh-love-spoons, veranda environment.

## Geometry and input

`spoon-body` contains a closed oval bowl profile, beveled handle with an actual cut-out, grip and attached fine grain. The bowl has measurable inner depth and a convex back. Its lower edge rests at y=.80 on the home pad, then y=.88 on the display seat. Low rear rests steady both poses. No floating decorations or transparent hitboxes.

Step 0: `spoon-cloth-grip` → `spoon-bowl` (both mesh-local origin).
Step 1: `spoon-handle-grip` → `spoon-display-seat` (both origin).
Step 2: tap `spoon-handle-grip`; other visible spoon surfaces also accepted.

Only the first opaque scene hit counts; held descendants are excluded when checking a drop. Pointer ownership, cancellation, pause/blur, accepted animation freezing, checkpoint restore, explicit writing, reentry and disposal are covered with real geometry/raycast/form tests (GPU renderer mocked). Minimal-stub RED observed before implementation. Browser screenshots and integration evidence are recorded in the atelier plan.

## 2026-10-20 介绍扩充核查

适用场景：`welsh-love-spoon`；最终来源：`welsh-love-spoons`。

当前物件与动作：布擦凹勺，持柄放展托，静看或留言。

文化说明范围：威尔士1667有年款存世例、十八十九世纪求爱工艺及现代纪念礼。

简化边界：擦拭展示为产品照料动作，无完整雕刻或固定赠勺仪式。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#welsh-love-spoon)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。

## 2026-10-23 产品交互容错

可拿软布和木勺的可见表面；安放时既接纳手指落在展托，也接纳勺底已经对准展托，避免持柄时手指高于展托而回退。

可见目标周边最多扩展 22 CSS px，触摸与鼠标共用判定；画布外、远处空白及更近的不相关实物遮挡仍不接纳。进入有效落区显示「可以松手，轻轻落稳」，离开或取消、失焦、暂停时清除提示；有效释放后用已有动画落稳，保留原有步骤与存档。

这些是产品操作容错与反馈，不增加传统步骤、数量或寓意；文化关联沿用上方已核查范围。变更与验证见[本轮交互修正记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 空间跟手与到位完成

布工作面到勺面开始原短拭、整勺底到展托自动落稳；静看与可选留言保留。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
