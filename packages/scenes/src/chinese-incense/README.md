# 炉前一炷

Original procedural still life for `chinese-folk-and-confucian`, grade C, low sensitivity. Category: 祈福. The experience does not write a wish or reproduce an ancestral or priest-led rite.

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
