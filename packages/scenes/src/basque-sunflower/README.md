# 太阳花迎门

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
