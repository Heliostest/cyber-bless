# 舟模寄谢

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
