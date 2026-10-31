# 木马安放

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`horse`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `dalarna-wooden-horse`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 当前操作（2026-10-26）

将软布送到彩鞍接触范围后接续轻拭，再托着彩鞍把整匹木马送到木座；最后轻点静看。放置按四蹄底部接触木座验收，握点目标保留彩鞍高于座面的偏移，不要求把彩鞍压到座面。到位即可接受，没有最短拖距。

操作 0、1 在持有移动中按真实物件锚点或布面覆盖核对目标，到位即接续落定，不再以指定方向、固定拖距或松手作为摆放成功条件。未到位的取消恢复当前检查点；已经接受的同次触摸不能操作下一步。辅助按钮、减弱动态、暂停恢复和旧整数／variant 存档保持。

本次只更新产品输入及对应提示，器物、材料、动作顺序、文化含义与来源身份保持；没有新增传统规则。下方较早记录中关于方向、固定拖距和摆放松手验收的说明属于历史实现，当前输入以本节为准。具体逐场边界、来源状态与验证见[本轮 B 组记录](../../../../docs/research/2026-10-26-spatial-placement-audit-b.md)。

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

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。彩鞍木马、软布、木座；轻拭→放座→静看。

核查重点：1939为传播节点不是木马起源；不声称家屋护佑、统一纹样或保养三步传统。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#dalarna-wooden-horse)。

## 2026-10-22 共享渲染更新

保留可选水粉插画：柔和明暗、轻笔触与细轮廓；默认仍为柔和卡通，需在 Shader Lab 手动选择水粉。器物造型、纹样与材料身份、动作、完成条件、介绍及来源绑定均未改变；这是产品美术表达，不是传统风格主张。已读技术参考、既有文化核查索引与验证见[共享渲染记录](../../../../docs/research/2026-10-22-gouache-rendering.md)。

## 2026-10-22 Moebius 可选预览

Shader Lab 加入 Moebius 手绘漫画，可手动切换细墨线、色块与暗部排线。默认仍为柔和卡通，器物、纹样、材料身份、动作、介绍与文化来源保持。技术参考、产品表达边界和验证见[Moebius 渲染记录](../../../../docs/research/2026-10-22-moebius-rendering.md)。

## 2026-10-22 卡通描边可选预览

Shader Lab 新增手动卡通描边（三段明暗与深色外轮廓），默认仍为柔和卡通。器物、材料身份、纹样、操作与文化来源保持；技术参考及显示层核查见[卡通描边记录](../../../../docs/research/2026-10-22-toon-outline-rendering.md)。

## 2026-10-22 网点与像素可选预览

Shader Lab 新增手动网点印刷与复古像素，默认仍为柔和卡通。保留器形、材料身份、原纹样、动作、介绍与文化来源；本轮仅调整整体显示。技术参考、显示层核查和样本验证见[网点与像素记录](../../../../docs/research/2026-10-22-halftone-pixel-rendering.md)。
