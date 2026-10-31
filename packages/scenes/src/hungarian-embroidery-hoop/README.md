# 花绣寄语 — Hungarian embroidery hoop

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`hoop`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `hungarian-embroidery`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/hungarian-embroidery.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original, contemporary craft appreciation scene. A wooden hoop holds warm linen and raised rose/teal thread flowers. The player carries a real thread spool to a blank cloth patch to add one floral flourish, moves the whole hoop onto a solid display cradle, then taps the hoop to quietly finish. At the last checkpoint only, an optional explicit wish submission can save one trimmed line of up to 40 characters. Quiet completion discards the draft; returning visits never mount a new writer.

This is not a reconstruction of Matyó stitching instruction, an authentic community pattern, a sacred motif, or a simulated religious ritual. The five-petal flowers and branching composition were composed for this scene from procedural geometry; no artwork, artisan design, photo texture, or downloaded model is used. Spool movement is an accessible visual craft gesture, not an assertion that this is how embroidery is physically made.

## Sources and access

Reviewed 2026-10-13:

- Local `content/traditions/hungarian-folk.md` and `hungarian-folk.jpg`: read and visually inspected. The card concerns Hungarian Catholic pilgrimage and the image shows a crowned Madonna and Child at a shrine. It provides the existing catalog context and C/low-sensitivity boundary, **not an embroidery source**. No shrine objects or religious imagery are used here.
- [Hagyományok Háza — Embroidery](https://hagyomanyokhaza.hu/hu/embroidery): successfully opened readable institutional primary text. It describes regional differences, linen/hemp/cotton embroidery and household textiles, and a Matyó story involving colorful embroidered roses. Used only for broad material and floral craft context. The story's supernatural claims are not game mechanics or product promises.
- [Hungarian Cultural Heritage Days — Matyó Museum](https://oroksegnapok.gov.hu/helyszin/2057): successfully opened readable government cultural-program text in Hungarian and English. It describes Matyó embroidery and distinguishes the embroidery/costumes of Mezőkövesd, Tard and Szentistván. The scene does not label its original pattern as any one of these local traditions.
- [UNESCO canonical listing](https://ich.unesco.org/en/RL/folk-art-of-the-matyo-embroidery-of-a-traditional-community-00633) and [French-language variant](https://ich.unesco.org/fr/RL/l-art-populaire-des-matyo-la-broderie-d-une-communaute-traditionnelle-00633): access attempted; both returned JavaScript/human-verification challenge content in this environment. They remain leads, not successfully read evidence. The readable institutional sources above supply the craft context.

## Module and physical anchors

`createHungarianEmbroideryHoop` is exported from `scene.ts`; `index.ts` supplies `create`, default SceneModule, and metadata: `hungarian-embroidery-hoop`, `花绣寄语`, `traditionSlug: hungarian-embroidery`, grade C, sensitivity 低, gestures drag/wishWrite. The shared module schema uses singular `traditionSlug`.

| Checkpoint | Source | Destination |
| --- | --- | --- |
| 0 | `hoop-spool-cap`, local `[0,0,0]`; actual spool meshes accept pickup | blank `hoop-linen` at local `[.25,.017,.22]`, equivalent to `hoop-body` local `[.25,-.22,.017]` |
| 1 | `hoop-clamp-bridge`, local `[0,0,0]`; any visible hoop mesh accepts pickup | `hoop-cradle-seat`, local `[0,0,0]` |
| 2 | `hoop-clamp-bridge`, local `[0,0,0]`; any visible hoop mesh accepts quiet tap | optional explicit wish writer, or quiet tap |

- `hoop-thread-spool` rests at `[-.98,.99,.64]`, with bottom flange on tabletop y=.76. Cap, wound thread, coils and loose tail are its children.
- `hoop-body` rests at `[-.72,1.535,.015]` on `hoop-home-pad` top y=.80, then `[.82,1.615,.015]` on `hoop-cradle-seat` top y=.88. Its outer ring radius is .735, giving exact bottom support at both checkpoints.
- `hoop-home-back-rest` and `hoop-cradle-back-rest` touch the rear ring surface; cradle base rests on the worktable. Table legs reach the ground.
- `hoop-linen` is a thick cylinder rotated X π/2. Floral TubeGeometry endpoints enter its front face; lifted middle points make the stitches visibly three-dimensional. `hoop-floral-stitches`, `hoop-completed-flourish`, cloth weave and copper-colored clamp are all descendants of the moving hoop group.
- `hoop-completed-flourish` is hidden at checkpoint 0 and visible from checkpoint 1 onward. Cues only appear for the active supported checkpoint.

## Verification

First meaningful RED: the public native-button lifecycle test failed with `expected [] to deeply equal [1]` against a minimal inert scene stub. The scene was implemented after observing that failure.

Run `npm run test -w @wbr/scenes -- src/hungarian-embroidery-hoop/scene.test.ts` for 43 focused tests. Only GPU rendering is replaced: real Three meshes/raycasts, interaction cues and wish forms exercise lifecycle, valid/invalid object drops, opaque foreground blocking, travel thresholds, pointer ownership, multitouch, blur/pause/cancellation, motion resumption, silent restoration, reduced motion, explicit wishes, reentrancy, returning visits, physical contacts, connected decorations, 320/390/1280 framing and disposal. Root owns shared integration, browser visual review, full builds and mobile checks.

Callback-disposal regression RED: seven added tests exposed feedback after progress-callback disposal, one extra settled frame rendered after disposal, progress after a saving callback closed the scene, completion after a feedback callback closed it, and feedback continuing after host deactivation. A follow-up RED caught a save callback that only paused the scene preventing accepted progress from reaching the host. Saving now checks disposal before notifying progress 3; a pause still allows this accepted progress commit, while actual disposal stops it. Progress and feedback callbacks then recheck activity, suppressing feedback/completion while paused. The final update render also checks activity. Completion state is committed before callbacks, so closing, pausing, resuming or reentering cannot duplicate wishes or progress.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `hungarian-embroidery`。核查范围：地区差异、织物种类、村落家庭生产与二十世纪初集市绣品交易。

边界：不认定原创花样为 Matyó 或 Kalocsa，未移用玫瑰传说、护身意义；线轴拖动不等于传统针法。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#hungarian-embroidery-hoop)与[来源卡](../../../../content/traditions/hungarian-embroidery.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。

## 2026-10-23 操作容错

近距离拾取与落点增加最多22 CSS px的触控容差，保留前景遮挡和画布边界。指针或物件握点对齐均可安放；有效时显示可以松手，释放后落稳。取消、暂停或失焦会清除到位提示。以上属于产品输入与反馈修正，不新增传统规则；详见[操作修正记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 空间跟手与到位完成

线轴握点到布面留白中心、绣圈底到展托自动落稳；初始源位不落在接受域中，前景遮挡仍阻止提交。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。


## 2026-10-28 光学材质技术更新

仅亚麻底布加入极弱背光漫透射与细织纹；现有线几何、花绣、木圈与背托维持原样。

本轮为材质显示层技术变化，纸、布与有机表面保持不透明；几何、原有配色/印字、动作、完成条件、来源字段、标题、技术 ID 和存档兼容性不变。文化影响沿用[本 README 既有来源核查与产品边界](README.md)，未新增材料出处、传统步骤或信仰功效主张；技术实现不作为文化证据。统一方案、已读技术来源与验证范围见[本轮接入记录](../../../../docs/research/2026-10-28-ritual-optics-integration.md)。
