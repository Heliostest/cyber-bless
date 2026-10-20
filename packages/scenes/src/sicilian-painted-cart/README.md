# 彩车迎晴 · Sicilian painted cart

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/sicilian-carretto-craft.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original contemporary appreciation of everyday Sicilian **carretto** woodworking, wheel carving and painting. The miniature has an open cargo bed, a real through axle, two large twelve-spoke wheels, joined draw shafts and a small wooden display support. Its muted mustard, teal, coral and cream bars are original simple geometric decoration. No museum vehicle, artist's painting, narrative scene, sacred motif or identifiable composition is copied.

This is **not** the holy **Carro Trionfale** used during Santa Rosalia's Festino. It contains no saint, shrine, relic, pilgrimage reenactment, liturgy, vow, efficacy claim or wish writer. The `sicilian-carretto-craft` source card documents everyday decorated carts. The quiet courtyard background is owned by the host.

## Sources and access record

Read and inspected on **2026-10-13**:

- Local `content/traditions/sicilian-santa-rosalia.md`: used for the distinction between public festival context and religious practice, and for sensitivity boundaries. This card alone is not a source for everyday cart construction.
- Local `content/traditions/sicilian-santa-rosalia.jpg`: visually inspected. The actual photograph shows a street drum group during the Festino, despite the broad float/procession caption. It does not show a useful cart construction reference and was not traced, textured or used to derive the model.
- [Sicilian Cart Museum, Aci Sant'Antonio — Home](https://www.museodelcarrettosiciliano.it/en/home-en/): successfully read. The museum presents decorated everyday carts, wheel carving and craft workshops; these general craft features informed the choice of object.
- [Sicilian Cart Museum — Our Story](https://www.museodelcarrettosiciliano.it/en/story/): successfully read. The museum describes carts' agricultural function and painted/sculpted decoration. Used for context only; the model does not reproduce the site's pictures or narrative art.

No attempted source above was unavailable. The card's external Santa Rosalia links were not opened for this implementation; they are not claimed as newly verified construction sources.

## Interaction and integration

- ID `sicilian-painted-cart`; title `彩车迎晴`; grade `C`; sensitivity `中`; gestures `['drag']`.
- `index.ts` exports `create`, `createSicilianPaintedCart`, and `meta`; the `SceneMeta` interface uses `traditionSlug: 'sicilian-carretto-craft'`.
- Step 0: grip opaque **`cart-wheel-hub`** on group **`cart-detached-wheel`**, and drag onto opaque **`cart-axle-end`**.
- Step 1: grip opaque **`cart-rail-grip`** on **`cart-miniature`**, and drag the full assembly onto opaque **`cart-display-mat`**.
- Step 2: tap **`cart-rail-grip`** to quietly finish once. Native keyboard `click` buttons share the same guarded transitions and have a 44px minimum size.

Anchors, before any camera projection:

| Object | Coordinate space | Position |
| --- | --- | --- |
| Cart home | world | `[-0.65, 0.72, -0.08]` |
| Cart display | world | `[0.95, 0.88, -0.08]` |
| Loose wheel home | world | `[-1.76, 1.24, 0.85]` |
| Wheel joined to cart | cart local | `[0, 0.5, 0.66]` |
| Wheel hub grip | wheel local | `[0, 0, 0.085]` |
| Axle destination | cart local | `[0, 0.5, 0.66]` |
| Carrying rail grip | cart local | `[0, 1.43, 0.44]` |
| Display mat | world | `[1.05, 0.87, -0.08]` |

Only actual opaque visible surfaces count as first hits. Start raycasts traverse all visible opaque scene meshes; accepted drops exclude the held group and all its descendants. There are no invisible or enlarged proxy targets. Wrong, blocked, stationary, multi-touch and out-and-back tap gestures do not advance. Cancellation restores the entire assembly including wheel, painted bands, body and shafts. Accepted movement freezes during blur/host pause; restoration is silent, completion is guarded before callbacks, and disposal is idempotent.

## Physical support and validation

`cart-table` has top y=0.72. The loose wheel's real outer rim radius is 0.5, with its bottom at y=0.74 on `cart-wheel-pad`. The cart's `cart-stand-foot` and both joined wheel rims rest at y=0.72 initially and y=0.88 on the final mat. Stand uprights meet the axle cradle; the cradle meets chassis rails; rails support the floor. The axle intersects both wheel hub bodies. Each spoke overlaps the hub and enters the wooden rim; each painted band is supported by its spoke. The cargo walls, painted fields, rail grip, draw shafts and crosspiece have connected geometry. Display supports fit within the mat footprint.

Targeted validation command:

```text
npm run test -w @wbr/scenes -- src/sicilian-painted-cart/scene.test.ts
```

Initial RED: a minimal lifecycle stub failed the public mount test with `expected null not to be null` for the missing visible assembly action. Then implemented the real scene. Current suite: **42 tests passing** using real Three.js geometry/raycast/cues and replacing only WebGL rendering. Includes complete direct gesture flow, foreground occlusion, 320/390/1280 anchor visibility, source and destination contact, spoke/paint/body support, whole-cart cancellation, blur/pause, mixed touch ownership, silent/invalid restoration, reduced motion, reentrancy, disposal during progress, resource and listener cleanup.

Visual/callback repair RED reproduced five failures: terminal progress/feedback pause still dispatched completion, the settling update rendered once after callback pause, and the loose wheel exceeded framing bounds on both actual phone canvases. Camera distance now scales with the canvas aspect below 1, preserving its viewing angle. Every vertex of every cart and wheel mesh at checkpoints 0, 1 and 2 is tested within absolute NDC x/y <0.95 on the real **284×390** and **350×408** inner canvases. The completed shafts also remain in frame. Callback pause/disposal now prevents stale feedback, completion and the settling update's tail render; terminal progress remains 3 and resuming cannot replay completion. No geometry, poses or anchors changed in this repair. GPU appearance and host integration are validated by the root agent after registration.

## 2026-10-20 介绍扩充核查

适用场景：`sicilian-painted-cart`；最终来源：`sicilian-carretto-craft`。

当前物件与动作：装木轮到车轴，整车移展垫，静看。

文化说明范围：十九世纪运输农业与雕绘工艺；不是圣人节大型花车。

简化边界：装轮和展示为缩略，不是制车全过程。

完整来源、访问状态、年代限定和不能外推的范围见[本轮逐项核查](../../../../docs/research/2026-10-20-scene-narratives-c.md#sicilian-painted-cart)。用户介绍集中维护于 `packages/core/src/scene-narratives/c.ts`，此处不复制正文。
