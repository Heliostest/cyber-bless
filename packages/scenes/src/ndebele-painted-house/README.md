# 彩墙寄家 · Ndebele painted house

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/ndebele-wall-painting.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original, public craft appreciation exercise inspired by southern South African Ndebele domestic wall art. This is a small workshop house model, not a representation of an occupied home, a sacred building, or an authentic ceremony. The user places an original color panel on a solid cream facade, carries the complete model to a display plinth, and quietly taps its base to finish. There is no wish form or wish persistence.

## Sources and visual boundaries

Reviewed on 2026-10-13:

- Local `content/traditions/ndebele-traditional.md`: reviewed its southern South African scope, public house-painting layer, and restrictions around initiation and other private practices. Its card assessment is C / 低–中. `SceneMeta` only accepts 低, 中, or 高; this module conservatively uses 中.
- Local `content/traditions/ndebele-traditional.jpg`: viewed in full. The card identifies it as a painted house at Lesedi Cultural Village and credits [Wikimedia Commons, Ndebele Architecture](https://commons.wikimedia.org/wiki/File:Ndebele_Architecture.jpg), CC BY 4.0. The photograph shows dense outlined wall fields, door/window recesses, and substantial plaster walls. It supplies context only; the image, building, outline arrangement, and patterns are not copied or embedded in this scene. The Commons page itself was not independently opened.
- [Iziko Museums, “Then I Knew I Was Good at Painting”: Esther Mahlangu, A Retrospective](https://www.iziko.org.za/news/iziko-museums-of-south-africa-presentsthen-i-knew-i-was-good-at-painting-esthermahlangu-a-retrospective/), published 2024-01-17: successfully opened and read. The museum describes the artist's training by her mother and grandmother, the relationship of her work to Ndebele wall painting and beadwork, and her distinct contemporary agency across many surfaces. This supports acknowledging artists and public house-art practice; no artwork or distinctive artist pattern is reproduced.
- [South African Tourism, Culture and expression of identity: the Ndebele of South Africa](https://www.southafrica.net/ao/en/travel/article/culture-and-expression-of-identity-the-ndebele-of-south-africa): attempted twice; the browsing service reported fetch timeout. Its contents were not used as verified evidence.

The design uses a low, thick-walled cream house, a genuinely recessed dark doorway, a low roof, and a restrained arrangement of teal, ochre, and terracotta rectangles with thin dark framing. These fields are newly composed. There are no clan-specific motifs, copied artist compositions, religious emblems, ritual acts, or claims of efficacy. The local card's wider religious topics are not interaction material.

## Contract and geometry

- Export: `createNdebelePaintedHouse`; module `create` alias. Metadata: `ndebele-painted-house`, `彩墙寄家`, tradition `ndebele-wall-painting`, C, 中, `['drag']`.
- Step 0: the actual teal mesh `house-color-panel`, in `house-paint-panel`, drags to the opaque `house-facade-slot` on the left wall. The doorway is an invalid destination. The attached panel's rear rests against the slot surface.
- Step 1: the actual wooden `house-base-grip` drags the whole `house-miniature`, including every wall field and the attached panel, onto the solid `house-display-seat`.
- Step 2: tap `house-base-grip` to complete once. Auxiliary native buttons use the same guarded advancement path.
- House group home `(-0.85, 0.72, 0)`; displayed pose `(0.95, 0.88, 0)`. Loose panel group home `(-1.5, 0.96, 0.88)`; attached local pose `(-0.44, 0.65, 0.495)`.
- Source and destination cues attach to real meshes. Source grip is local `(0, 0.065, 0.595)` on the house. The facade slot is local `(-0.44, 0.65, 0.455)`. Display-seat center is world `(0.95, 0.87, 0)`.
- Both base poses have physical support: table top `y=0.72`, display-seat top `y=0.88`. The loose panel rests on `house-panel-pad`, top `y=0.745`.
- All opaque visible scene meshes participate in first-hit input checks. Drops exclude the entire held group. Invalid drops, stationary drags, blocked targets, multiple pointers, lost capture, cancellation, blur, and host pause cannot advance a checkpoint. Pending drags restore the complete house group. Accepted animation freezes while inactive and resumes on activation.
- Reduced motion settles directly; finite bounded time steps drive normal animation. Restoring progress is silent. Sound/haptic preferences follow the shared feedback helper. All owned resources and listeners are disposed once.

## Verification

TDD began with the public mount lifecycle test against a minimal scene stub. The expected RED was `expected null not to be null` for the first visible action. After implementation:

```text
npm run test -w @wbr/scenes -- src/ndebele-painted-house/scene.test.ts
30 tests passed
```

The focused suite retains real Three.js geometry, raycasts, pointer ownership, and interaction cues; it substitutes WebGL rendering only. It covers both physical drags and final tap, foreground occlusion, invalid drops, doorway rejection, 320/390/1280 anchor visibility, wall depth and recessed doorway, support contact, panel attachment and group motion, full-group cancellation, silent restore, reentrant completion, and disposal.

GPU/browser appearance and shared registry/catalog/mobile integration are verified by the integrating parent task. No shared environment, registry, dependencies, build outputs, or mobile assets are edited by this module author.

## 2026-10-20 介绍扩充核查

当前简介已补充地域、文化语境及有据的历史节点，保留来源 `ndebele-wall-painting`。核查范围：南非 Ndebele 女性家墙绘画、马兰古母祖传艺亲述和 1989 巴黎国际展览节点。

边界：没有壁画起源年；不复制艺术家作品或声称色块有统一护佑含义。小板拼贴/模型是产品表达，不是真实绘壁方式。

来源正文的完整链接、实际阅读位置、访问状态及产品简化见[B 组逐项记录](../../../../docs/research/2026-10-20-scene-narratives-b.md#ndebele-painted-house)与[来源卡](../../../../content/traditions/ndebele-wall-painting.md)。本节不更改现有交互；用户介绍集中维护于 `packages/core/src/scene-narratives/b.ts`。
