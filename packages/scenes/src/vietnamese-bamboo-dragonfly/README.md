# 竹蜓点风 · Vietnamese bamboo dragonfly

An original contemporary appreciation of the public bamboo toy craft associated with Thạch Xá, Hanoi. Scene ID `vietnamese-bamboo-dragonfly`; tradition slug `thach-xa-bamboo-dragonfly`; grade C / sensitivity 低. Place it, repeatedly touch any visible dragonfly surface, then manually finish. No wish is created or saved.

The [Vietnam tourism information centre's craft account](https://nongthon.vietnamtourism.gov.vn/thach-xa-bamboo-dragonfly-village-the-art-of-vietnamese-creativity-in-bamboo/?lang=en) supports the bamboo-strip body, wings and tail, colourful decoration and single-point balance. [Hanoi's culture and sports department](https://sovhtt.hanoi.gov.vn/en/unique-bamboo-dragonfly-made-thach-xa/) describes shaping the head and tail, balancing the proportions of the wings and body, and perching the toy by its beak on a finger or branch. No disputed origin date, religious ritual, or spinning-propeller interpretation is used.

## Original object and visual choices

Four solid, swept bamboo wings are individually modelled. Teal front wings and coral rear wings carry gold borders and oval painted motifs, with warm exposed bamboo beneath. The visible outer ends contain more material and sweep forward and below the beak. A closed, tapered bamboo tail has seven painted bands, and paired dark eyes identify the head. A slim bamboo twig rises from a rounded stone resting at garden floor `y = -.04`. There is no table, display board, concealed support or hidden counterweight.

The camera looks down sufficiently to separate all four wings. It fits every subject vertex across prepared, placed and swaying poses, without moving during the gesture. The host supplies the sunny garden environment; the scene uses the established soft toon rendering and warm light rig.

## Physical interaction anchors

The placement anchor is local to the head and verified as the nearest opaque ray intersection. After placement, all opaque children of `dragonfly-balance-pivot` are interactive: all four wings, head, thorax, tail and painted parts. The right-wing cue is a guide, not a restriction on the touchable area. Empty space, the stone, support and unrelated occluders cannot start a poke.

| Step | Source mesh | Cue anchor | Screen displacement |
| --- | --- | --- | --- |
| 0: place on twig | `dragonfly-head` | `[0, .035, .13]` | `[0, -60]` px |
| 1: first poke | any visible dragonfly mesh | actual ray hit | tap or drag in any direction |
| 2: continue freely, then manually finish | any visible dragonfly mesh | actual ray hit | repeated taps/drags; `结束体验` button |

The previous prepared pivot `[0, 1.06, .45]` put the thorax through the support. The revised prepared pivot `[-.28, 1.50, 1.05]` keeps the body above the upright and visibly beside it before moving back onto the twig tip `[0, 1.58, .10]`. Actual support-axis intersections are checked at thirteen placement samples. The real tapered beak vertex and `dragonfly-beak-contact` marker both occupy local zero in `dragonfly-balance-pivot`. Only this group's rotation changes after placement, preserving exact beak contact. Ordinary and reduced motion have identical settled transforms.

`balance-motion.ts` integrates three damped angular springs in substeps no larger than 1/120s. Taps apply a small downward impulse at the actual hit point; lever arms produce opposite roll from opposite wings and different pitch from the head or tail. Drag displacement uses the captured grip orientation. Recent flicks retain bounded angular velocity; holding before release damps it. Repeated pokes add momentum without restarting a recorded animation. Reduced motion gives a small held response and returns to rest on release.

Angular damping is one quarter of the initial free-play version, retaining the same restoring forces and input impulses. For a .4 rad/s impulse, the last angular excursion above .005 rad occurs at 9.308s pitch, 8.025s twist and 8.233s roll (previously 2.108s, 2.225s and 1.850s). `balance-motion.test.ts` freezes those original measurements and requires at least three times their duration at 30/60/120 fps, followed by exact rest within 60 simulated seconds. These are product tuning measurements, not bamboo material properties.

This is a small-angle model, not full rigid-body contact/friction simulation. The geometric centre-of-volume check is a plausibility check for the original shape, not a material-density or manufacturing claim. Force values, bounds, damping, feedback and manual finish are product arrangements, not traditional requirements. The [source card](../../../../content/traditions/thach-xa-bamboo-dragonfly.md) and [2026-10-19 audit](../../../../docs/research/2026-10-19-scene-culture-audit-c.md) record the directly read Vietnamese official text and failed English/Hanoi re-accesses; no new cultural claim is introduced here.

## Lifecycle and verification

Checkpoint compatibility remains 0–3: unplaced, placed, freely playable after the first poke, manually finished. The first accepted poke reports 2 once; subsequent pokes never advance or complete. Restored 1 and 2 remain playable without entry feedback. A keyboard button places, offers a poke, then becomes `结束体验`. Placement retains directional validation; free play accepts all directions. Invalid coordinates, cancel, occluders and multi-touch cannot submit a gesture. Each accepted poke has quiet optional sound and light haptics, with medium haptics on longer flicks; both obey live host switches.

At checkpoint 2, the button uses `scene-dragonfly-finish` to show its complete `结束体验` label in the lower-right tray. This overrides the host's small `辅助` fallback appearance; its title also reflects the finish action. The browser check verifies that the label is painted, fits without clipping and is not covered by the fallback pseudo-element before clicking it.

Pause/blur cancel unfinished grabs and freeze released dynamics. Resize preserves held pose and free momentum, rebasing the hand plane and drag origin after real dimension changes while retaining the original cancellation snapshot. Fixed framing samples every combination of bounded pitch, roll and yaw. Lifecycle revisions protect synchronous feedback/progress reentry. Geometry, materials, input, cues, audio and DOM are disposed once.

Run `npm run test -w @wbr/scenes -- src/vietnamese-bamboo-dragonfly --maxWorkers=2`. Tests retain real Three geometry, rays, camera transforms and cues, replacing only GPU work and optional audio hardware. They cover placement clearance, all body surfaces, repeated/opposite responses, damping duration, fixed contact, manual finish, legacy restoration, real dimension changes, cancel/pause/reentry, framing and disposal.

`node scripts/verify-dragonfly-balance.mjs` uses the running Vite server and actual scene-review App, mouse and native Chrome touch. It observes the real scene/camera through a test-time module response and seeds only the review host's reduced-motion setting; no production test API or mocked model is added. Results and source boundaries are recorded in [the interaction review](../../../../docs/research/2026-10-19-dragonfly-balance.md).

## 2026-10-20 介绍扩充核查

适用场景：`vietnamese-bamboo-dragonfly`；最终来源：`thach-xa-bamboo-dragonfly`。

当前物件与动作：尖喙落枝尖，随后可重复轻推/拖不同部位，手动结束观察。

文化说明范围：河内石舍今西芳、1990年代出现、竹材平衡工艺及生计。

简化边界：模拟平衡、光色和枝座为产品，末步不限一次长翼推。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#vietnamese-bamboo-dragonfly)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。
