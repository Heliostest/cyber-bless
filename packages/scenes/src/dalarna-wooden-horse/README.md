# 木马安放

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/dalarna-wooden-horse.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original rounded wooden horse, polish cloth and display plinth. Inspired by Dalarna's public woodcraft identity; no protective-power claim or simulated religious ceremony. The carved silhouette and leaf decoration are original, not a particular maker's design.

Read `content/traditions/dalecarlian-folk.md` and viewed its associated photo on 2026-10-13. That photo depicts a midsummer pole, not a horse, and is not included in the runtime. Verified [Dalarnas museum's Dalahästar exhibition](https://dalarnasmuseum.se/utstallningar/fasta-utstallningar/dalahastar/) describing the regional souvenir's development into a Swedish cultural symbol and the variety of historical and contemporary interpretations. This supports background only, not the original handling sequence. [Nordiska museet's public craft collection](https://webbshop.nordiskamuseet.se/collections/dalahastar) provides further public craft context.

Physical input:

1. `horse-polishing-cloth` → `horse-painted-saddle`: lift the actual cloth to the painted flank.
2. `horse-painted-saddle` → `horse-plinth-inset`: place the horse on its display base.
3. `horse-painted-saddle`: quiet tap, no wish input or wish write.

All cue targets are real opaque mesh surfaces. Model has four separate legs with verified support contact at the final plinth height. Pointer cancellation, mixed fingers, blur, host pause, reduced motion, silent checkpoint restoration and full resource disposal are tested with real geometry and raycasting; only the GPU boundary is replaced in jsdom. Browser tests use displayed cue positions and capture the running scene.
