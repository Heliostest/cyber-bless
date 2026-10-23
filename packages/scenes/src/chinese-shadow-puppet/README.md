# 影偶小戏 / Chinese shadow puppet

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/chinese-shadow-puppet.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


This is an original, contemporary public craft appreciation scene. Its small freestanding timber theatre contains a pierced paper bird, one wing hinge, two attached control rods, a visible lamp and a warm cloth screen. It is not a traditional character, complete performance, religious ceremony, or a claim of efficacy.

## Source and interpretation

[UNESCO, Chinese shadow puppetry, nomination 00421](https://ich.unesco.org/en/RL/chinese-shadow-puppetry-00421), checked 2026-10-15, describes colourful leather or paper figures, rod manipulation, movable joints and a backlit translucent cloth screen. Those broad craft features inform this original bird. No source images, music, recorded performance, traditional character design or third-party assets are copied. The current source card is `chinese-shadow-puppet`, directly documenting the puppet craft and performance.

The backstage view deliberately shows the physical order lamp → puppet → cloth. The screen is rendered as a warm unlit textile gradient to keep its projection readable under the application's cel lighting. The shadow is a geometric point-light projection of the actual current source triangles, clipped to the cloth rectangle. Body and wing cutouts, hinge and rods all contribute to it. Its uniform warm-brown shadow colour is a readability choice; it does not simulate translucent leather colour transmission or a finite lamp's penumbra.

## Interaction and checkpoints

0. Lift the main rod with an upward drag.
1. Move the wing rod right to rotate the jointed wing.
2. Tap the bird to quietly observe, or explicitly submit an optional written wish.
3. Completed pose.

Checkpoints restore silently. Returning visits do not mount a wish writer. Drafts are never saved by observation, restore or return. A native 44px action button supports Enter/Space. The real object grips own the drag, including on touch, and cancellation restores the corresponding checkpoint pose. Accepted animation finishes before progress commits. Reduced motion settles at the same final pose.

## Capture contract

| Step | Mesh | Local cue anchor | Screen gesture |
| --- | --- | --- | --- |
| 0 | `shadow-main-grip` | `[0, 0, 0.075]` | `[0, -60]` |
| 1 | `shadow-wing-grip` | `[0, 0, 0.075]` | `[60, 0]` |
| 2 | `shadow-bird-body` | `[0.16, 0, 0.028]` | tap |

At least 40px along-axis travel is required; 60px reaches the authored pose. A valid owned pointerdown may finish at a displaced pointerup even when the browser omitted move events. Pure cross-axis, clear reverse, returned-to-start, cancelled and second-pointer gestures do not advance. Longer same-direction drags, gentle diagonals and 10–20px corrections remain valid. Cues target the nearest opaque rendered surface, not hidden planes.

## Verification

The scene tests use real Three geometry/raycasting and the actual wish writer, substituting only GPU rendering. They cover physical rod attachment, projection against independent lamp rays (including open holes), all-vertex portrait/desktop framing, nearest-surface cues, gesture rejection, pause/blur/capture loss, callback re-entry, atomic wish saving and exact-once resource disposal. Run `npm run test -w @wbr/scenes -- src/chinese-shadow-puppet/scene.test.ts` from the repository root.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。原创纸制彩鸟、单片关节翼、双操纵杆、灯与幕；提主杆→移翼杆→静看。

核查重点：形成时代仍不确定；不能把海宁声腔、蚕花戏或任一传统角色套给原创小鸟。没有完整剧目、乐队和戏班表演。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#chinese-shadow-puppet)。


## 2026-10-23 共享方向容错

共享方向判定支持同向长拖、合理斜拖与10–20px的小幅纠正，到位后继续同向拖不会丢失成功资格；明显反向、退回起点、取消及多指仍不提交。保留本模块的真实起点、动作与主动结束／留言流程。仅调整产品技术容错，未改变器物、文化主张、动作顺序、来源归属、技术 ID 或存档。验证与文化影响边界见[本轮修复记录](../../../../docs/research/2026-10-23-scene-interaction-fixes.md)。
