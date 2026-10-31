# 彩车迎晴 · Sicilian painted cart

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`cart`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `sicilian-carretto-craft`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

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

## 2026-10-23 产品交互容错

木轮的轮辐和轮缘都可拿取；轮毂、扶手与车轴采用有限的屏幕邻近容差。

可见目标周边最多扩展 22 CSS px，触摸与鼠标共用判定；画布外、远处空白及更近的不相关实物遮挡仍不接纳。进入有效落区显示「可以松手，轻轻落稳」，离开或取消、失焦、暂停时清除提示；有效释放后用已有动画落稳，保留原有步骤与存档。

这些是产品操作容错与反馈，不增加传统步骤、数量或寓意；文化关联沿用上方已核查范围。变更与验证见[本轮交互修正记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。
