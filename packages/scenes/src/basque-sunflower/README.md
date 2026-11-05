# 太阳花迎门

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`flower`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `basque-eguzkilore`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 当前操作（2026-10-26）

先把独立花心送入尖瓣中心，再把完整花饰送到门钉；接合后的花心、花瓣与挂环一起移动。最后静看或明确提交留言。

操作 0、1 在持有移动中按真实物件锚点或布面覆盖核对目标，到位即接续落定，不再以指定方向、固定拖距或松手作为摆放成功条件。未到位的取消恢复当前检查点；已经接受的同次触摸不能操作下一步。辅助按钮、减弱动态、暂停恢复和旧整数／variant 存档保持。

本次只更新产品输入及对应提示，器物、材料、动作顺序、文化含义与来源身份保持；没有新增传统规则。下方较早记录中关于方向、固定拖距和摆放松手验收的说明属于历史实现，当前输入以本节为准。具体逐场边界、来源状态与验证见[本轮 B 组记录](../../../../docs/research/2026-10-26-spatial-placement-audit-b.md)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/basque-eguzkilore.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original procedural paper-and-wood sun-thistle ornament inspired by the public Basque Eguzkilore motif. Sixty-four narrow, pointed, pale paper blades radiate around an independently assembled wooden seed center. A flax loop hangs on a wooden peg in a small doorframe display; the ornament's wooden backing touches the door board. The separate center rests on a sage pad before assembly. All geometry is authored here; no runtime image, model, font or audio download is used.

Reviewed `content/traditions/basque-folk.md` and its farmhouse-door JPG for cultural and visual context. The source image is not a texture and no specific jewelry, coupon illustration or protected decorative design is reproduced.

Primary context verified 2026-10-13: [Basque Government, “El eguzkilore…” (2026-07-10)](https://www.euskadi.eus/gobierno-vasco/-/noticia/2026/el-eguzkilore-uno-simbolos-mas-reconocibles-cultura-vasca-protagoniza-cupon-once-del-14-julio/). The government describes the name as “sun flower,” its traditional placement at farmhouse doors, its symbolic protective meaning in popular belief, and an artisan tradition derived from a protected wild plant. These are cultural accounts, not evidence of protective efficacy. The scene uses an artificial paper/wood flower, does not invite wild-plant harvesting, and does not enact a religious rite, summon Mari, or reconstruct a historical ceremony. Compact scene hints carry the artificial-flower and folklore boundaries; no extra overlay card covers the craft.

| Checkpoint | Visible source → visible destination | Result |
| --- | --- | --- |
| 0 → 1 | `sunflower-center` → `sunflower-center-seat` | Carry the separate textured center from the left pad into the radial petal base. The center piece becomes a child of the ornament. |
| 1 → 2 | `sunflower-center` → `sunflower-peg-cap` | Carry the assembled ornament by its center to the visible peg. The loop settles onto the shaft and the wood backing rests against the door mount. |
| 2 → 3 | `sunflower-center`, or explicit wish submission | A quiet tap completes without saving a draft. Only explicit nonempty trimmed form submission saves one wish. Returning visits omit the writer. |

Stable support/group names: `sunflower-center-piece`, `sunflower-ornament`, `sunflower-wood-backing`, `sunflower-mount-board`, `sunflower-hanging-loop`, `sunflower-peg-shaft`, `sunflower-center-rest`. The main scene group is `sunflower-courtyard-workshop`.

Pointer checks use the nearest visible hit across the entire scene. Only the held subtree is excluded for a drop, so external opaque objects still block both start and destination. Drags require at least 8px of travel; quiet taps require less than 12px, including displacement at release. Native button activation uses the same settlement paths. Accepted placement takes 0.7 seconds with a restrained lift; reduced motion settles immediately. Pause/blur freeze accepted placement and cancel unfinished gestures. Every checkpoint restores silently.

Verification: 26 focused Vitest tests exercise real Three.js geometry and raycasting, cues and wish forms, replacing GPU calls only. Coverage includes 320/390/1280px first-hit visibility and ornament framing; complete physical drags; solid external occlusion at both drag steps; exact drag/tap thresholds; peg-loop and mount-backing contact; loose-center support; pause/blur/cancel/capture loss/multitouch; silent restoration of 0/1/2/3; explicit saving, quiet drafts and returning visits; attached-center motion; and idempotent GPU/geometry/material/shadow/DOM/listener cleanup. Root integration owns the full repository suite, build and native browser visual/keyboard checks.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。纸木太阳蓟花饰，装花心→挂门框木钉→静看/可选留言。

核查重点：没有确定起始年代；馆述信念不是产品效力。纸木拼装不是采放真植物的固定传统，不据此重建 Mari 仪式。巴斯克政府原链接失败未采用。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#basque-sunflower)。


## 2026-10-28 光学材质技术更新

两圈纸瓣加入克制的纸纤维与薄纸漫透射，内圈采用更低强度；木花心、背板与挂绳不受影响。呈现仍是纸木手作，不改成真实植物。

本轮为材质显示层技术变化，纸、布与有机表面保持不透明；几何、原有配色/印字、动作、完成条件、来源字段、标题、技术 ID 和存档兼容性不变。文化影响沿用[本 README 既有来源核查与产品边界](README.md)，未新增材料出处、传统步骤或信仰功效主张；技术实现不作为文化证据。统一方案、已读技术来源与验证范围见[本轮接入记录](../../../../docs/research/2026-10-28-ritual-optics-integration.md)。

## 2026-11-04 共享日景远景云

共享白天环境接入 Toon Cloud 远景云带；只在镜头露出的天空中显示，俯视时由地面和主体自然遮挡。云为产品布景，器物、材料、动作、信仰/节庆语境、完成条件、文案及来源沿用本 README 既有核查，不增加天气规则、传统云纹或功效主张。[本轮范围、署名许可与验证](../../../../docs/research/2026-11-04-toon-cloud-daylight-expansion.md)。

## 2026-11-05 材质显示扩展

接入木门/架、木花心、挂绳与石脚细纹。纸瓣既有纤维和透光保留；纸折线与挂绳分材质。新增细纹为产品美术，沿用既有文化主张与来源；几何、动作及完成条件未改。本轮外链未重读，详见[材质扩展研究记录](../../../../docs/research/2026-11-05-craft-material-rollout.md)。
