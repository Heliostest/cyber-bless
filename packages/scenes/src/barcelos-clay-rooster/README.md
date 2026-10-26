# 陶鸡报晓 · Barcelos clay rooster

## 2026-10-24 触摸容错

画笔、陶鸡和展台接入真实可见表面附近22 CSS px内触摸容差与可以松手提示；画笔尖或陶鸡握点已对齐目的面时也接受偏心持握。其他前景遮挡仍阻挡提交。保留原添纹、陈列、静看/可选留言与来源，不新增文化主张。[逐场审阅与验证](../../../../docs/research/2026-10-24-scene-interaction-review-a.md)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/barcelos-clay-rooster.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


An original contemporary ceramic-workshop homage: decorate a rooster, move its integrated clay base onto a round display plinth, then quietly view it or explicitly submit a short wish. The scene uses the `barcelos-clay-rooster` craft card (grade C, low sensitivity) and the veranda environment. It does not reconstruct a romaria, invoke a saint, recreate a miracle narrative, or claim protection or religious effects.

## Source and scope

- Read: [Portuguese Association of Cities and Villages of Ceramics — Barcelos](https://ceramicadeportugal.pt/en/barcelos-en/) (13 October 2026). The association describes Barcelos pottery and figurative ceramics, the rooster as a widely recognized regional/national emblem, and historical sale of ceramics at markets, fairs and pilgrimage gatherings. This supports a broad craft connection; it does not establish this scene's three actions as a traditional ritual.
- Read locally: `content/traditions/portuguese-romarias.md`; inspected its accompanying JPG of the Fátima sanctuary and pilgrims. That image concerns a living religious setting, so it is not used as a visual model for this workshop.
- Attempted [Visit Portugal page 132821](https://www.visitportugal.com/en/node/132821); direct fetch timed out. No claim or design detail depends on its unread contents.

The continuous chest/neck/head mesh, three arched tail feathers, scalloped comb, integrated base, leaf sprays and palette were composed for this scene. No artisan's pattern, signature, brand, photograph, texture or scanned object is copied. The cream/green leaves are an invented decoration without an assigned traditional symbolic meaning. No external assets or network requests are used at runtime.

## Interaction and support

1. Drag the visible wooden `rooster-brush-grip` onto the rooster. The solid curved `rooster-paint-surface` is the advertised chest destination; visible rooster surfaces also accept paint.
2. Drag the rooster's actual body/base onto the solid `rooster-plinth-top` or clay plinth edge. `barcelos-rooster` is the held assembly, including its attached legs and `rooster-clay-base`.
3. Tap the actual rooster to finish quietly, discarding any unsubmitted draft. Alternatively, submit the real optional wish form, limited to 40 characters. Returning visits do not mount a writer.

The named source and destination meshes are visible surfaces; there are no oversized invisible colliders. Occlusion uses the first opaque hit across the entire scene, excluding only the held assembly for drop testing. Cues do not intercept input. A carried object settles automatically on reaching its target; quiet tap requires less than 12 px of maximum travel. The native auxiliary button uses the same guarded transitions.

The clay base rests on the linen at first and directly on the display at the end. Both legs intersect the continuous chest and the base. Body paint follows the same curved surface with a paint-thin offset; tail strokes rest on the sculpted feather fronts. Pointer cancellation, lost capture, blur, pause and multiple contacts abandon pending drags. Pause freezes accepted motion. Checkpoints 0–3 restore silently. Disposal releases owned inputs, cues, geometry, materials, shadow maps, feedback and renderer resources.

## Validation

`npm run test -w @wbr/scenes -- src/barcelos-clay-rooster/scene.test.ts`

The focused suite uses actual Three.js geometry, raycasting, interaction cues and the real wish form; only the GPU rendering boundary is replaced. Coverage includes actual source/destination first hits and whole-rooster framing at 320, 390 and 1280 px, wrong input, occlusion, cancellation, pause, mixed contacts, silent restoration, explicit-only saving, support contacts, paint fit and resource cleanup. Root integration owns full-suite, production-browser and mobile verification.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。彩绘陶鸡、画笔和圆台；胸前添叶芽→移圆台→静看/可选留言。

核查重点：陶器总体历史不能当公鸡造型同样古老；本轮撤回旧 UI 对当前陶鸡“寓意好运”的泛化，主代理同步将 quiet/returning/done 收窄到叶芽彩纹、彩绘陈设及手作纹样。胸前叶芽和台座无传统仪式依据。市政府公鸡页失访，地方市方“Retratos do Galo no Comércio Local”PDF仅检索可见、直读超时/连接重置，不作为好运寓意已读证据；保留工艺与地方标志关联。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#barcelos-clay-rooster)。

## 2026-10-23 可选视觉风格

正式 App 在仪式音效／震动旁加入视觉风格菜单，按当前仪式保存可选滤镜与参数，默认仍为柔和卡通。器形、材料身份、纹样、动作、介绍和文化来源保持；这是用户可逆的产品显示偏好。实际入口、保存、交互与桌面／手机视口验证见 [App 视觉风格记录](../../../../docs/research/2026-10-23-app-visual-style.md)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。
