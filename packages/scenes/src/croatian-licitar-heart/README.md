# 彩心相赠 · Croatian licitar heart

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/croatian-licitar.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


`croatian-licitar-heart` is an original, contemporary gift-making homage to northern Croatian licitar craft. It uses the `croatian-licitar` craft card (grade C, sensitivity 中), uses the courtyard environment, and supports the WISH flow. It does not reproduce a named craftsperson's decoration.

## Product brief

A bright red dough ornament is the central object: a closed, thick, rounded-bevel heart with cream piped edges, three invented floral motifs, green sprigs and a tiny pale inset referring to a mirror. A cloth ribbon joins its body and hangs from a wooden display peg. The left workbench holds the undecorated heart, a cream icing bag and a small icing bowl. A quiet, open wooden gift stand occupies the right side. The palette is licitar red `#ce293c`, cream icing `#ffedc9`, leaf green `#6e9780`, muted blue `#85a7b3` and oak `#c29e6b`; host typography and step controls are retained. The signature is the heart's rounded edible-craft thickness and surface-attached piping, rather than a flat pictogram.

Exactly three checkpoints:

1. **给红心添上糖霜** — grip the real icing bag and drag to the real red heart. The original icing appears, then the bag returns to its cloth rest.
2. **把彩心挂上木钉** — drag the decorated heart body to the cream end of the stand peg. The entire heart settles with its ribbon's inner ceiling touching the shaft's top.
3. **轻点彩心静看** — tap the actual heart to finish quietly, or explicitly submit a nonempty wish of up to 40 characters. Quiet completion removes the unsubmitted draft. Returning mode creates no writer and finishes by quiet tap.

The hint copy calls this a craft homage. The final line is “一颗彩心，留下一份相赠的心意。”. Native buttons invoke the same checkpoint transitions for keyboard access. The action button does not imply that an unwritten or unsubmitted wish has been saved.

## Cultural context and research

The local source `content/traditions/croatian-folk.md` was read and its JPG viewed. The photo shows the large outdoor worship space at Marija Bistrica, with a congregation, church buildings and wooded hills. That card discusses Croatian Catholic pilgrimage and public festivities. This small gift-craft scene is based on the dedicated licitar sources, not a reconstruction of the photographed Mass, an actual pilgrimage, the Eucharist, a priestly blessing, or a claim of protective efficacy.

Primary references consulted on 2026-10-13:

- [Croatian Ministry of Culture and Media: Gingerbread craft from Northern Croatia](https://min-kulture.gov.hr/kulturna-bastina/nematerijalna-kulturna-bastina/nematerijalna-dobra-upisana-na-unesco-ov-reprezentativni-popis-nematerijalne-kulturne-bastine-covjecanstva/gingerbread-craft-from-northern-croatia-eng/6291): supports moulded, baked, dried, painted dough; individual artisan decoration; hearts, small mirrors, messages; family transmission and community festivities. Only broad materials and object categories inform this work.
- [Krapina-Zagorje County Tourist Board: Wooden toys and licitars](https://visitzagorje.hr/en/wooden-toys-licitari/): supports bright red ornaments, white sugar decoration, small mirrors, gift-giving, and an educational licitar craft collection in Marija Bistrica. The account establishes a craft connection to the town without equating it with a religious ritual.
- [UNESCO: Gingerbread craft from northern Croatia, 00356](https://ich.unesco.org/en/RL/gingerbread-craft-from-northern-croatia-00356): attempted directly; a human-verification challenge prevented reading. The challenge was respected. The primary Ministry and official regional tourism references above supply the readable evidence.

The icing arrangement, gift stand, rounded geometry and interaction sequence are original design choices. The pale inset is opaque and has no live reflection. This scene is not a food recipe or an authoritative account of all licitar styles.

## Input, anchors and lifecycle

- Whole-scene nearest opaque intersections determine pickup, release and tap. External opaque objects block interaction. Drop tests exclude only the held object's own subtree; there are no invisible target colliders.
- Each carried object settles automatically when its contact anchor reaches the current target. Quiet tapping must stay below 12 px. Empty space, wrong objects, wrong drops and multi-pointer gestures do not advance; the attached ribbon remains part of the heart for picking it up.
- Cancellation, lost capture, blur and host pause restore unfinished drags. Accepted animation freezes on pause/blur. Reduced motion settles immediately. Silent restore supports checkpoints 0/1/2/3, and completion/disposal are idempotent.
- `licitar-icing-grip`, local `[0, 0, 0]`: visible bag pickup.
- `licitar-heart-body`, local `[0.20, -0.10, 0.158]`: red front surface used by decoration destination, body pickup and quiet tap. The mesh origin is at heart-local y = 0.55.
- `licitar-stand-peg-cap`, local `[0, 0, 0]`: visible peg destination.
- Moving groups: `licitar-icing-cone`, `licitar-heart`; revealed geometry group: `licitar-original-icing`.

## Verification

Run `npm run test -w @wbr/scenes -- src/croatian-licitar-heart/scene.test.ts`.

The tests replace GPU rendering only. Real Three.js geometry, matrices, raycasts, interaction cues, pointer ownership and the shared wish form remain active. They cover full object flow; explicit/empty/overlength/reentrant wish submission; unsaved quiet drafts; returning mode; wrong or blocked starts/drops; travel and tap thresholds; cancellation and owner/multitouch recovery; paused motion; silent restore and native action fallback; 320/390/1280 projected first-hit anchors; real heart thickness/bevel; support and loop/peg contact; every icing piece's surface contact; and single resource/listener/shadow/DOM cleanup. Integration build, full suite and browser/mobile visual review are handled by the parent task.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。红色面团心、裱花袋糖霜、布带、展架木钉；装饰→悬挂→静看/可选留言。

核查重点：中世纪欧洲修道院背景非克罗地亚本地精确起源；原创纹样/挂架/留言不是固定礼赠仪式；非现实食品教程。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#croatian-licitar-heart)。

## 2026-10-23 操作容错

近距离拾取与落点增加最多22 CSS px的触控容差，保留前景遮挡和画布边界。指针或物件握点对齐均可安放；有效时显示可以松手，释放后落稳。取消、暂停或失焦会清除到位提示。彩心的相连挂带也可用于托起和轻点。以上属于产品输入与反馈修正，不新增传统规则；详见[操作修正记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。
