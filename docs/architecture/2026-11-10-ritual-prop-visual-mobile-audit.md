# Ritual prop visual and mobile-interaction audit

Date: 2026-11-10. Branch: `feat/ritual-prop-visual-mobile`, from `master` at `a2d06ac1`.

Scope: the objects a ritual is performed with, meaning their geometry, materials, silhouette, scale on a phone, readable details, object-local light, idle and handling motion, and touch handling. Shared backgrounds (cozy environment, sky, Komorebi, meadow, trees, water, clouds), look presets and postprocessing are out of scope. So are completion rules, catalog and unlock rules, and narrative copy. This is a product art and input audit. It is not a cultural-source review. Any batch change that touches an object's form is re-checked against that scene's existing source card under [the provenance rules](../scene-provenance.md).

Art direction used for visual decisions: 画面风格为三渲二，强调浓厚的日式二次元动画氛围，材质表现干净，轮廓明确，色彩柔和但富有…

## Method

- **Real-app captures.** I ran the dev route `/scene-review?scene=<id>` (the real App on a fresh in-memory save) in headless Chrome with SwiftShader. The viewport was iPhone-size, 390x844 CSS px at 2x, with `zh-CN` locale and the review header hidden. The ritual canvas in that layout is **346x332 CSS px**. All 157 module scenes were captured at checkpoint 0. Fifteen blank first captures were slow first frames, not render bugs (for example, a water-heavy scene needs about 8 s under SwiftShader). They were re-shot with longer waits and all render. Captures are local only and are not committed.
- **Probe.** A temporary jsdom Vitest probe (deleted, not committed) mounted every registered scene at 346x332. It measured the projected bounds of each object carrying an enabled interaction cue at checkpoint 0, so "cue NxM px" below is the visible size of the thing you are asked to touch on a phone.
- **Code survey.** I checked how each scene decides a press belongs to an object (`canStart` / custom pointer handlers), and searched for hover-only highlights, `OrbitControls`, and camera movement during object drags.

## Cross-cutting findings

1. **Exact picking with no finger margin is the most common mobile defect.** 54 scenes (31 visible) copy a `nearest()` helper that requires the first opaque mesh under the exact finger ray to belong to the target. About 20 more use exact `ray.hits`/visible-hit raycasts. The shared `createTouchTarget(...).hit()` already adds a bounded 22 CSS px margin and never reaches through a nearer surface, but only about half of the scenes use it. On a small handle this is the difference between "it ignores me" and "it picked up".
   - Visible scenes using `nearest()`: alasita-miniature-house, bonfim-ribbon, bulgarian-survakane, chinese-ruyi-scepter, chinowa-kuguri, finnish-virpominen, greek-new-year-pomegranate, greek-vasilopita, horseshoe-doorway-luck, japanese-kumade, kagami-biraki-sake, kagami-mochi-offering, kitano-nadeushi, lam-tsuen-wishing-tree, lao-baci-wrist, mochigase-nagashibina, mongolian-ovoo, neapolitan-cornicello, persian-esfand, polish-oplatek-sharing, romanian-martisor, rosh-hashanah-apple-honey, scottish-first-footing, shichigosan-chitose-ame, sternsinger-house-blessing, tamagushi-offering, tibetan-khata-greeting, tibetan-water-bowls, turkish-nazar-bead, vietnamese-five-fruit-tray, yusheng-lohei.
   - Swapping to `touch.hit(x, y, root)` keeps the same root ownership rule and adds the margin. Use the whole visible assembly as the root; a sub-mesh root is occluded by its own badge, face or decoration (found and fixed in omikuji and daruma).
2. **Tiny touch handles on visible scenes** (visible size of the cued object at 346x332): bulgarian-survakane grip 6x13, phuang-malai flower 5x8, mongolian-ovoo stone 7x8, korean-bojagi-wrap corner 10x9, barcelos-clay-rooster brush 33x9, sternsinger chalk 22x9, sorbian egg brush 35x10, zeniarai coin tray 42x12, floating-lantern flower 12x12, italian-ex-voto brush 13x12, balinese-canang-sari flower 19x14, aland-votive-ship grip 15x14, lithuanian-straw-garden 15x15. These need a finger margin and, ideally, a visually larger grip.
3. **Props are small on the phone stage.** Many scenes frame a whole table or plinth, so the thing being handled fills a small fraction of the 346x332 card. The model-based pose-placement scenes often place the object on a bare grey or white slab. The slab reads as a placeholder and pulls attention from the object (chinese-ruyi-scepter, chinese-longevity-lock, japanese-hamaya, japanese-kumade, hiiragi-iwashi, greek-new-year-pomegranate, horseshoe-doorway-luck, neapolitan-cornicello).
4. **Objects lying flat lose their silhouette** from the 3/4 camera: chinese-longevity-lock, chinese-ruyi-scepter, japanese-hamaya, korean-sotdae.
5. **Ungrounded or off-frame handles.** Daruma's brush floated about 0.23 above its stand at the right edge and was partly cut off at phone width (fixed in this batch).
6. **Feedback on the item.** Few scenes show a visible held state on press. Haptics are deliberately limited to the successful moment (`createSceneFeedback`; scene tests assert one haptic per accepted step). This batch keeps that contract and adds visual-only held feedback.
7. **No hover-only cues, no camera fighting.** Interaction cues are always-on in-world placards and markers; hover only changes the desktop cursor. No scene uses `OrbitControls`. Object drags never move the camera. Close inspection orbits only after an explicit pick-up. These stay as they are.
8. **Presentation versus documented claim (daruma).** The narrative and the `daruma-eye-painting` source card (Takasaki city page, read 2026-10-19) say the first eye is the one on the viewer's right. The 3D scene painted the viewer's left. Fixed in this batch; see the session summary.
9. **Composition oddities worth a design pass.** tamagushi-offering (a giant disembodied arm crosses the frame), polish-oplatek-sharing (a white wafer on a white sheet beside a floating forearm), lao-baci-wrist (a forearm lying on a mat), bonfim-ribbon (the ribbon reads as tangled wire).

## Priority rubric

- **High:** a visible scene where the handled object is tiny, flat or confusing on the phone stage, or where a concrete mobile defect blocks comfortable one-finger use.
- **Mid:** a visible scene whose object reads but is plain or small, or whose handle needs a margin.
- **Low:** the object reads well, or the scene is hidden from the App catalog (`APP_HIDDEN_SCENE_IDS`, low traffic).

Counts: 14 visible High, 41 visible Mid, 35 visible Low, and 67 hidden (all Low).

## Batch selection

The brief's starting set was crane, lantern, daruma-eye-painting, chinese-incense, omikuji, furin-wind-chime, ema-votive-plaque, shrine-suzu-bell, tibetan-wheel, diya-oil-lamp, omamori-cycle and chinese-fu-paper. The audit changed the order:

- `lantern` is hidden in the App catalog, so it was deferred.
- `crane` (real crease-pattern folding with a generous tap sphere), `tibetan-wheel`, `ema-votive-plaque` and `furin-wind-chime` (recently polished) already read well on the phone. They are next-batch candidates.
- The first batch therefore pairs the three High flagships from that set (omikuji, daruma-eye-painting, shrine-suzu-bell) and chinese-fu-paper with clearly weak visible scenes that share the flat-display pattern or have tiny handles: chinese-longevity-lock, chinese-ruyi-scepter, japanese-hamaya, korean-sotdae, bulgarian-survakane and mongolian-ovoo.

## Per-scene audit

Visible scenes first, by priority. "Margin picker" means `createTouchTarget`-style picking with the 22 px fingertip margin. "Exact" means the press must land on the object's pixels.

| Scene | App | Priority | Props on the phone stage | Mobile interaction |
| --- | --- | --- | --- | --- |
| `balinese-canang-sari` | visible | High | Canang tray is small beside a large plain grey altar block that dominates the frame. | Flower cue 19x14 px. |
| `bonfim-ribbon` | visible | High | Ribbon renders as a tangled yellow wire mass on a navy rail; does not read as cloth. | Exact nearest() picker. |
| `bulgarian-survakane` | visible | High | Decorated branch is a thin wire beside a large primitive seated figure; the ritual object barely reads. | Grip cue 6x13 px with exact nearest() picker. |
| `chinese-longevity-lock` | visible | High | Lock lies flat on a board, so its silhouette is lost; grey plate reads as a placeholder. | Close inspection; margin picker. |
| `chinese-ruyi-scepter` | visible | High | Ruyi lies flat on a bare grey slab with tiny stands; silhouette barely reads. | Exact nearest() picker. |
| `daruma-eye-painting` | visible | High | Doll is strong, but the brush floats ~0.23 above the stand at the right edge and is partly cut off at phone width. | Custom pointer, exact eye and brush raycasts; tip under the finger; first eye on the viewer's left contradicts the narrative and source (viewer's right). |
| `hindu-coconut-offering` | visible | High | Plain brown coconut ball and flat blue plate; no craft detail. | Margin picker. |
| `japanese-hamaya` | visible | High | Arrow lies flat and thin on a grey slab; reads as a stick. | Close inspection; margin picker. |
| `korean-sotdae` | visible | High | Bird pole lies flat and tiny on a disc; the pole silhouette is lost. | Close inspection; margin picker. |
| `mongolian-ovoo` | visible | High | Tiny figure and stone cairn on a disc; the stone being added is a speck. | Stone cue 7x8 px with exact nearest() picker. |
| `omikuji` | visible | High | Plain hexagon box with a slot block, thin stick, house-shaped envelope; props small on the stand. | Exact ray on a ~12 px-wide stick; no held-state feedback. |
| `polish-oplatek-sharing` | visible | High | White wafer on a white sheet plus a disembodied forearm; flat and odd. | Exact nearest(). |
| `shrine-suzu-bell` | visible | High | Bell small and high under a large frame; rope pull only stretches the rope. | Grip 19x24 px (margin picker); weak pull feedback on the bell itself. |
| `tamagushi-offering` | visible | High | Giant disembodied white arm crosses the frame; branch and table small. | Exact nearest(); props exceed the frame. |
| `aland-votive-ship` | visible | Mid | Hull, sail and rigging read, but the ship sits small on a long work table. | Grip/handle only ~15 px. |
| `alasita-miniature-house` | visible | Mid | Tiny house; a flat yellow placement mat dominates the foreground. | Close inspection helps; pick-up still exact. |
| `brat-bride-cloth` | visible | Mid | Night window and bench read; the cloth itself is small. | Cloth 104x32 px. |
| `chinese-fu-paper` | visible | Mid | Fu diamond is flat and unbevelled; plain plank door and box holder. | Close inspection; margin picker. |
| `chinese-incense` | visible | Mid | Censer, tea and sleeve read; props small on a wide table. | Margin picker; sleeve is the grip for the thin stick. |
| `croatian-licitar-heart` | visible | Mid | Plain glossy red heart; icing bag small. | Margin picker. |
| `diya-oil-lamp` | visible | Mid | Three small clay lamps on a dark tray; wicks are tiny. | Margin picker on wick and tip. |
| `fgs-buddha-bathing` | visible | Mid | Golden figure and basin read; ladle tiny. | Ladle cue 16x16 px (margin picker). |
| `finnish-virpominen` | visible | Mid | Large blue door frame dominates; willow twig small. | Exact nearest(). |
| `floating-lantern-loy-krathong` | visible | Mid | Krathong on a raft reads; flower cue 12x12 px. | Exact ray. |
| `furin-wind-chime` | visible | Mid | Recently polished glass bell, but it hangs at the far-left edge, small on the phone stage. | Custom bell hit test. |
| `greek-new-year-pomegranate` | visible | Mid | Small pomegranate before a large door on a white slab. | Exact nearest(). |
| `hiiragi-iwashi` | visible | Mid | Tiny holly sprig and fish on a white slab before a door. | Margin picker. |
| `horseshoe-doorway-luck` | visible | Mid | Horseshoes small on a slab under a door frame. | Exact nearest(). |
| `italian-ex-voto` | visible | Mid | Painted panel on an easel reads; brush small. | Brush cue 13x12 px. |
| `japanese-kadomatsu` | visible | Mid | Small kadomatsu beside a large door on a slab. | Close inspection; margin picker. |
| `japanese-kumade` | visible | Mid | Small rake beside a plain plaque on a grey slab. | Exact nearest(); cue 16x23 px. |
| `kagami-biraki-sake` | visible | Mid | Barrel and mallet read but small. | Exact nearest(). |
| `kagami-mochi-offering` | visible | Mid | Mochi and stand viewed from above; flat composition. | Exact nearest(). |
| `kameido-usokae` | visible | Mid | Wooden bullfinches read but low detail. | Margin picker. |
| `kitano-nadeushi` | visible | Mid | Stone ox reads; hand tiny. | Hand cue 25x25 px, exact nearest(). |
| `korean-bojagi-wrap` | visible | Mid | Patchwork reads from above. | Corner cue 10x9 px. |
| `lam-tsuen-wishing-tree` | visible | Mid | Stylised tree, red paper and orange; flat slab. | Exact nearest(). |
| `lao-baci-wrist` | visible | Mid | Disembodied forearm and hand lying on a mat looks odd. | Exact nearest(). |
| `mezuzah-doorpost` | visible | Mid | Large plain door frame; the case is tiny at its foot. | Margin picker. |
| `milagros` | visible | Mid | White board with small charms. | Custom pointer, exact charm raycasts. |
| `mochigase-nagashibina` | visible | Mid | Paper dolls small on a round tray; slow first frame (water). | Close inspection; exact nearest(). |
| `nanakusa-gayu` | visible | Mid | Pot and bowl read; ladle small. | Ladle cue 24x54 px (margin picker). |
| `neapolitan-cornicello` | visible | Mid | Small red horn on a slab with a glass box. | Exact nearest(); cue 18x43 px. |
| `omamori-cycle` | visible | Mid | Three soft pouches and a travel bag read; pouches small. | Margin picker; pouch 36x50 px. |
| `persian-esfand` | visible | Mid | Generic white kitchen counter; the seeds and pan do not read as the subject. | Exact nearest(). |
| `phuang-malai` | visible | Mid | Garland ring reads; flowers tiny. | Custom pointer with margin; flower cue 5x8 px. |
| `romanian-martisor` | visible | Mid | Branch reads; the red/white cord is a small speck. | Close inspection; exact nearest(). |
| `shichigosan-chitose-ame` | visible | Mid | Primitive child figure; candy bag small. | Close inspection; exact nearest(). |
| `spanish-twelve-grapes` | visible | Mid | Grapes small on a slab with a clock. | Margin picker. |
| `st-brigids-cross` | visible | Mid | Rush bundle and small spiral in a big frame read weakly. | Exact ray. |
| `sternsinger-house-blessing` | visible | Mid | Large blue door; chalk tiny. | Chalk cue 22x9 px, exact nearest(). |
| `thai-songkran-elders` | visible | Mid | Seated elder figure is primitive; bowl reads. | Margin picker. |
| `tibetan-khata-greeting` | visible | Mid | Two small figures; the khata is a tiny strip. | Exact nearest(). |
| `tibetan-water-bowls` | visible | Mid | Seven small bowls on a low table; jug small. | Exact nearest(). |
| `vietnamese-five-fruit-tray` | visible | Mid | Fruit tray small, flat composition. | Exact nearest(); cue 22x25 px. |
| `barcelos-clay-rooster` | visible | Low | Strong, characterful rooster. | Brush handle 33x9 px (margin picker). |
| `basque-sunflower` | visible | Low | Spiky paper flower reads; large plain door board. | Exact visible-hit picker; flower is large. |
| `bokjori` | visible | Low | Woven sieve is good; large plain board behind it. | Margin picker. |
| `chinowa-kuguri` | visible | Low | Large grass ring reads. | Exact nearest(); ring is large. |
| `clootie-well-rag` | visible | Low | Well, tree and rag read. | Exact ray. |
| `crane` | visible | Low | Origami folds from a real crease pattern; the starting plain white square is the weakest moment. | Generous invisible tap sphere. |
| `ema-votive-plaque` | visible | Low | Large plaque reads well. | Flip by horizontal drag; plaque large. |
| `greek-vasilopita` | visible | Low | Cake and plates read. | Exact nearest(); knife cue 31x18 px. |
| `japanese-koinobori` | visible | Low | Carp streamer reads well. | Margin picker. |
| `lanna-sand-pagoda` | visible | Low | Sand pagoda and flag read. | Close inspection; margin picker. |
| `lithuanian-straw-garden` | visible | Low | Straw garden reads. | Margin picker. |
| `mizuhiki` | visible | Low | Cord work reads. | Custom pointer with margin. |
| `navruz-sumalak` | visible | Low | Pot on a stove reads. | Margin picker. |
| `polish-blessing-basket` | visible | Low | Basket reads. | Margin picker. |
| `pucara-rooftop-bulls` | visible | Low | Clay bulls and roof read. | Close inspection; margin picker. |
| `rosh-hashanah-apple-honey` | visible | Low | Apple and honey read. | Exact nearest(). |
| `scottish-first-footing` | visible | Low | Night hearth and coal read. | Close inspection; exact nearest(). |
| `setsubun-mamemaki` | visible | Low | Shoji door and bean box read. | Margin picker. |
| `shinto-torii` | visible | Low | Torii reads well. | Custom pointer with zone. |
| `slavic-wreath` | visible | Low | Wreath on water reads. | Custom pointer with zone. |
| `sorbian-painted-egg` | visible | Low | Large egg reads. | Brush 35x10 px (margin picker). |
| `sri-lankan-bodhi-puja` | visible | Low | Tree and jug read. | Margin picker. |
| `sumiyoshi-godairiki` | visible | Low | Stones and basin read. | Margin picker. |
| `tanzaku-tanabata` | visible | Low | Bamboo and strips read. | Custom pointer. |
| `tibetan-prayer-flags` | visible | Low | Flags read. | Margin picker. |
| `tibetan-wheel` | visible | Low | Striped drums read well. | Custom pointer with a generous zone. |
| `turkish-nazar-bead` | visible | Low | Bead and stand read. | Close inspection; exact nearest(). |
| `uchide-wishing-mallet` | visible | Low | Mallet reads. | Margin picker. |
| `udo-undama` | visible | Low | Stones in water read. | Margin picker. |
| `ukrainian-didukh` | visible | Low | Wheat sheaf reads. | Margin picker. |
| `votive-candle-catholic` | visible | Low | Candle stand reads. | Exact ray. |
| `welsh-love-spoon` | visible | Low | Spoon reads. | Tool cue 43x16 px (margin picker). |
| `yeondeunghoe` | visible | Low | Lantern reads. | Custom lantern hit test. |
| `yusheng-lohei` | visible | Low | Platter reads. | Exact nearest(). |
| `zeniarai-coin-washing` | visible | Low | Basin and coins read. | Coin tray 42x12 px (margin picker). |
| `amazigh-woven-rug` | hidden | Low | Loom and striped rug read well. | Shuttle cue 10x6 px (margin picker). |
| `andalusian-ceramic-tile` | hidden | Low | Tile panel reads; small loose tile. | Tile handle 5x3 px (margin picker). |
| `bai-indigo-cloth` | hidden | Low | Small cloth bundle and basin on a beam rig; reads as a set, not an object. | Margin picker. |
| `blang-tea` | hidden | Low | Teapot, cup and tray read. | Leaf cue 33x7 px (margin picker). |
| `breton-banner` | hidden | Low | Small banner on a frame; plain table. | Exact visible-hit; clip cue 13x12 px. |
| `catalan-festival-giant` | hidden | Low | Giant figure reads. | Badge cue 10x10 px (margin picker). |
| `celtic-folk-spring` | hidden | Low | Pond and coin read. | Custom pointer; pond is large. |
| `chinese-diabolo` | hidden | Low | Diabolo and sticks read. | Exact nearest(). |
| `chinese-rattle-drum` | hidden | Low | Drum reads. | Handle 19x51 px, exact nearest(). |
| `chinese-shadow-puppet` | hidden | Low | Screen and puppet read. | Rod cue 9x18 px. |
| `chinese-steelyard` | hidden | Low | Steelyard reads. | Margin picker. |
| `chinese-suanpan` | hidden | Low | Abacus reads well. | Bead cue 24x18 px, exact nearest(). |
| `chinese-tangram` | hidden | Low | Tangram reads well. | Exact nearest(); pieces large. |
| `chinese-woodblock-print` | hidden | Low | Block and paper read. | Pad cue 18x6 px. |
| `czech-bead-star` | hidden | Low | Bead star reads well. | Margin picker. |
| `czech-pilgrim-journal` | hidden | Low | Journal reads. | Margin picker. |
| `czech-wooden-ratchet` | hidden | Low | Ratchet reads. | Exact nearest(). |
| `dalarna-wooden-horse` | hidden | Low | Horse reads. | Exact visible-hit. |
| `english-hearth-bellows` | hidden | Low | Bellows read. | Margin picker. |
| `estonian-village-swing` | hidden | Low | Swing reads. | Exact nearest(). |
| `faroese-wool-knit` | hidden | Low | Knit reads. | Exact hit. |
| `fijian-woven-fan` | hidden | Low | Fan reads. | Exact visible-hit. |
| `finnish-birch-basket` | hidden | Low | Basket reads. | Exact visible-hit; rim cue 22x4 px. |
| `finnish-kantele` | hidden | Low | Kantele reads. | Margin picker. |
| `french-coffee-mill` | hidden | Low | Mill reads. | Margin picker. |
| `french-petanque` | hidden | Low | Balls and jack read. | Exact nearest(). |
| `garden-croquet` | hidden | Low | Mallet and hoop read. | Margin picker. |
| `german-jumping-jack` | hidden | Low | Figure reads. | Exact nearest(). |
| `german-nutcracker` | hidden | Low | Blocky nutcracker. | Exact nearest(). |
| `ghanaian-oware` | hidden | Low | Board reads. | Seed cue 11x10 px (margin picker). |
| `hongsheng-red-string` | hidden | Low | Spool and frame read. | Margin picker. |
| `hungarian-embroidery-hoop` | hidden | Low | Hoop reads. | Margin picker. |
| `indian-charkha` | hidden | Low | Wheel reads. | Exact nearest(). |
| `indonesian-angklung` | hidden | Low | Angklung reads. | Exact hit. |
| `irish-bodhran` | hidden | Low | Drum reads. | Margin picker. |
| `japanese-daruma-otoshi` | hidden | Low | Stack reads. | Exact nearest(). |
| `japanese-kendama` | hidden | Low | Kendama reads. | Exact nearest(). |
| `japanese-shishi-odoshi` | hidden | Low | Bamboo and basin read. | Exact nearest(). |
| `japanese-wagasa` | hidden | Low | Umbrella reads. | Margin picker. |
| `korean-yutnori` | hidden | Low | Board and sticks read. | Exact nearest(). |
| `lantern` | hidden | Low | Hidden core ritual; lantern reads at night. | Exact ray on the lantern. |
| `malawi-sansi` | hidden | Low | Sansi reads. | Exact nearest(). |
| `mexican-metate` | hidden | Low | Metate reads. | Exact nearest(). |
| `mexican-molinillo` | hidden | Low | Molinillo reads. | Margin picker. |
| `mexican-tortilla-press` | hidden | Low | Press reads. | Exact nearest(). |
| `minangkabau-spinning-top` | hidden | Low | Top reads. | Margin picker. |
| `mongolian-felt-ger` | hidden | Low | Ger lattice reads. | Margin picker. |
| `ndebele-painted-house` | hidden | Low | House reads. | Margin picker. |
| `niue-shell-necklace` | hidden | Low | Necklace reads. | Margin picker. |
| `paper-pinwheel` | hidden | Low | Pinwheel reads. | Margin picker. |
| `peruvian-engraved-gourd` | hidden | Low | Gourd reads. | Exact hit. |
| `polish-paper-cut` | hidden | Low | Paper cut reads. | Margin picker. |
| `puerto-rican-guiro` | hidden | Low | Guiro reads. | Exact nearest(). |
| `purepecha-copper-bowl` | hidden | Low | Bowl reads. | Margin picker. |
| `russian-matryoshka` | hidden | Low | Dolls read well. | Margin picker. |
| `scottish-plunge-churn` | hidden | Low | Churn reads. | Exact nearest(). |
| `sicilian-painted-cart` | hidden | Low | Cart reads. | Margin picker. |
| `slovak-wire-bird` | hidden | Low | Wire bird reads. | Margin picker. |
| `spanish-castanets` | hidden | Low | Castanets read. | Side picker. |
| `theravada-water` | hidden | Low | Basin and jug read. | Custom pointer. |
| `turkish-ebru-paper` | hidden | Low | Marbled tray reads. | Margin picker. |
| `uzbek-clay-bowl` | hidden | Low | Wheel and bowl read. | Rotate hit. |
| `valencian-folding-fan` | hidden | Low | Fan reads. | Exact nearest(). |
| `venetian-glass-bead` | hidden | Low | Bead and plate read. | Margin picker. |
| `vietnamese-bamboo-dragonfly` | hidden | Low | Dragonfly reads well. | Exact hit. |
| `weifang-paper-kite` | hidden | Low | Kite reads. | Exact hit. |
| `welsh-drop-spindle` | hidden | Low | Spindle reads. | Exact nearest(). |

## First batch progress

Updated with each ritual commit; the session summary follows at the end of the batch.

