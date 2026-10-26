# 炉前一炷

## 2026-10-24 触摸容错

炉盖、香孔等真实可见表面附近22 CSS px内可触摸，到位显示可以松手，实际握点已对齐也接受偏心持握。安香时手持细香与纸套一起忽略，其他前景仍阻挡。保留开盖、安香、静烟及妈祖礼敬来源范围，不新增文化主张。[逐场审阅与验证](../../../../docs/research/2026-10-24-scene-interaction-review-a.md)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/chinese-incense.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original procedural still life for `chinese-incense`, grade C, low sensitivity. Category: 祈福. The experience does not write a wish or reproduce an ancestral or priest-led rite.

## Cultural scope and sources

- Read `content/traditions/chinese-folk-and-confucian.md` and visually inspected its associated `chinese-folk-and-confucian.jpg` on 2026-10-13. The photograph depicts Tomb Sweeping Day paper burning; its cemetery, burning paper, and family ritual are deliberately outside this scene's scope.
- [UNESCO — Mazu belief and customs](https://ich.unesco.org/en/RL/mazu-belief-and-customs-00227): the official entry describes smaller public and domestic observances that may include incense and flowers. Verified via the search-indexed official entry on 2026-10-13; direct opening returned a JavaScript challenge.
- [China Intangible Cultural Heritage — 妈祖信俗](https://www.ihchina.cn/mazuxinsu.html): official description places customary practice in its community and cultural context. This supports the broad context, not the specific interactive sequence or a universal Chinese ritual.

The rounded three-foot ceramic censer, its double scroll ears and seed-shaped knob are an original composition, not a scan or replica. The three interactions are ordinary object handling for a cultural tribute: lift the lid to its rest; move one fine stick into the visible socket; touch the tea saucer or vessel to look quietly. No deity, ancestral tablet, paper burning, clerical action, efficacy promise or ritual-completion claim is presented. The paper sleeve is an original visual accommodation for a real mobile touch target; it returns to the table as the stick is seated.

## Geometry and interaction contracts

- `incense-lid-knob` → `incense-lid-rest`: visible physical lid knob and ceramic support.
- `incense-paper-grip` → `incense-socket`: opaque paper sleeve and recessed dark ceramic insertion socket. `incense-stick-foot` marks the actual stick's final seating point.
- `incense-tea-saucer`: cue anchored to its exposed front lip. The cup and censer body also accept the final quiet tap.
- `incense-censer`, `incense-three-feet`, `incense-scroll-ear-*`, `incense-lid`, `incense-stick`, `incense-tea`, `incense-table`, `incense-smoke`: named original scene objects.

All assets are generated locally in Three.js. No texture URLs, network runtime assets or additional dependencies. All native-button actions use the same placement/finish transitions as direct object input. Checkpoints 0–3 restore without reporting progress, completion, wish writes, sound or vibration.

## Verification

`npm run test -w @wbr/scenes -- src/chinese-incense/scene.test.ts`

GPU rendering alone is mocked in jsdom; scene geometry, raycasting, projected cues, object pointer ownership and native DOM actions are real. The tests cover placement, incorrect input, direct mobile coordinates, restoration, pause/focus/cancellation, mixed page pointers, frozen animations and disposal of all owned resources/listeners.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。三足陶炉、炉盖盖托、单支细香及纸套；开盖→插香孔→静烟，UI 当前明确妈祖语境。

核查重点：旧卡一般香炉与祖先访谈不能单独证明妈祖，已补直接妈祖材料并撤回“未指定神明”描述。田野所述三炷/神位次序不移植为全国通则；当前一炷、盖托、纸套是产品选型。UNESCO 页面验证码、团标链接系统错误均未作为已读。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#chinese-incense)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。
