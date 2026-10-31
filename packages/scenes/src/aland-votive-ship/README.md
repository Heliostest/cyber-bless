# 舟模寄谢

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`ship`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `aland-votive-ship`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/aland-votive-ship.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original procedural wooden sailing miniature for the host veranda. The hull is a tapered loft with a curved belly and raised sheer; the independent mast assembly carries a curved cloth sail, wooden boom, hem and seams. Tubular stays and shrouds attach to the deck after the mast is seated. Two padded, curved cradle saddles follow the hull belly at their support sections. All assets are authored in Three.js with no runtime downloads.

The local `content/traditions/aland-folk.md` and its church exterior JPG were reviewed for cultural context. No photograph or previous scene model is copied. This scene is a contemporary cultural tribute to maritime memory. It does not enact a church donation, religious efficacy, a sacrament, or a historical model reconstruction.

Public primary context checked 2026-10-13:

- [Municipality of Kökar, St Anna's church](https://www.kokar.ax/st-annas-kyrka?lang=en): describes the wooden church ship and its maritime legend. The scene does not reproduce that armed ship or the legend.
- [Kyrkor.ax, Lumparland church](https://www.kyrkor.ax/churches/lumparland-chapelchurch/): documents a votive ship within an Åland church. Its page contains differing donation dates, so this scene makes no date claim.

Three persisted checkpoints:

| Checkpoint | Visible source → visible target | Settlement |
| --- | --- | --- |
| 0 → 1 | `ship-mast-grip` → `ship-mast-socket` | Lower mast grip is carried to the recessed floor inside the raised brass socket. The pin settles into it; rigging becomes visible. |
| 1 → 2 | `ship-deck-handle` → `ship-cradle-target` | Carry the entire ship and attached mast from the deck handle to the warm wood/brass buckle on the cradle's front end; place its belly into both padded saddles. |
| 2 → 3 | Visible ship surface, with cue on `ship-deck-handle`, or explicit wish form submission | Quiet tap completes without saving a draft. Only explicit, nonempty trimmed form submission saves one new wish. Returning visits have no writer. |

Native button click activation shares each settlement path, including browser Enter/Space activation. Accepted placement takes 0.75 seconds with gentle lift and easing; reduced motion settles immediately. Host pause and blur freeze accepted motion, cancel unfinished input, and disable writing. Cancel, capture loss, mixed pointers and incorrect origins/destinations never advance progress. Restoring 0/1/2/3 is silent.

Verification: targeted Vitest exercises real Three geometry and whole-scene first visible opaque rays for every cue and destination at 320, 390 and 1280px; support-contact rays; attached mast motion; persistence and duplicate/reentrant completion; explicit wish saving; return visits; pointer lifecycle, pause and reduced motion; idempotent geometry/material/shadow/renderer/DOM/listener cleanup. GPU rendering alone is mocked. Browser native keyboard activation and visual screenshots are verified by the parent integration task.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。原创木船模、帆桅、黄铜桅座与船架；插桅杆→整船放架→静看/可选感谢。

核查重点：没有证实所有教堂船都为海难脱险还愿；组装、桌面安放、留言均非已证实献置程序。旧 UI returning 的“向海上谢恩传统致意”由主代理本轮改为“记录航海记忆的小景”，撤回无据泛化。教堂页网页工具超时，改以同 URL 的 HTTP 200 实际正文读取，未引用失败索引日期。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#aland-votive-ship)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。


## 2026-10-28 光学材质技术更新

仅独立的奶油色帆布加入低强度背光漫透射与细织纹；船舱顶、木船、索具和帆缝维持原材质。

本轮为材质显示层技术变化，纸、布与有机表面保持不透明；几何、原有配色/印字、动作、完成条件、来源字段、标题、技术 ID 和存档兼容性不变。文化影响沿用[本 README 既有来源核查与产品边界](README.md)，未新增材料出处、传统步骤或信仰功效主张；技术实现不作为文化证据。统一方案、已读技术来源与验证范围见[本轮接入记录](../../../../docs/research/2026-10-28-ritual-optics-integration.md)。
