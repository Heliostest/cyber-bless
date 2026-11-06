# 巨偶待游


## 2026-11-06 Komorebi 默认画风

共享环境默认启用已校准的 Komorebi 草地、光照与调色；按用户后续要求，背景树恢复原先逐场配置（原树及原有场景推荐），Komorebi 树仅作为调试台可选树种、选择后加载。分享、恢复与退出调试使用同一默认组合；夜景、没有植被的环境与器物主题树按原场景保留。这是产品背景美术统一，不新增植物地域、传统寓意或仪式规则；主题器物、动作、文案、来源身份、引擎和存档保持。[范围、来源核查与验证](../../../../docs/research/2026-11-06-komorebi-defaults.md)。

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`figure`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `catalan-gegants`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 2026-10-24 交互审阅

已按实际器物、步骤、可持续性与触屏验收逐项审阅。保留有实际用途的阶段，不因总数是三而增删传统动作；本轮手势容错与放手采样属于产品输入安排。器物身份、文化归属与传统主张没有增加。

逐场发现、处理、来源边界与验证见[本轮 C 组记录](../../../../docs/research/2026-10-24-scene-interaction-review-c.md#逐场记录)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/catalan-gegants.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original contemporary miniature inspired by the public gegants craft tradition: fluted textile skirt, dressed torso, sculpted head and hat, removable flower rosette and wooden handling base. Pin the flower, seat the whole model on its display plinth and pause. No wish writer.

Read `content/traditions/catalan-folk.md` and viewed its JPG: the photograph depicts correfoc, not a giant or a model source. No photo, historical character or artisan pattern is copied. This workshop sequence is invented for this app; it does not reconstruct a parade, sacred role, fire-running or human towers.

Primary sources read 2026-10-13:

- [Generalitat de Catalunya — Els Gegants, l’Arboç](https://patrimonifestiu.cultura.gencat.cat/Festes-i-elements-festius-catalogats-o-declarats/Festes-Majors/La-Festa-Major-de-l-Arboc/Els-gegants): local historical figures and the preservation/replacement of their crafted forms. This app depicts neither named giant.
- [Agrupació de Colles Geganteres de Catalunya](https://gegants.cat/agrupacio/): the association’s work in celebration, conservation, research, music and dance transmission.
- [Barcelona municipal civic centre — Barcelona Gegantera](https://ajuntament.barcelona.cat/ccivics/elsortidor/p/64785/barcelona-gegantera): public exhibition context and six centuries of documented local giants. Separate Cultura Popular detail and workshop PDF URLs failed direct fetch; they are not claimed as fully read.

Physical anchors: `giant-rosette-grip` → `giant-lapel`; `giant-base-grip` → `giant-display-seat`; final tap `giant-base-grip`. `giant-rosette` reparents into `giant-figure` after the first step. Initial and final base/support contact, front-facing cloth geometry, visible first-hit rays, opaque occlusion, pointer cancellation/ownership, pause/focus, silent checkpoints and resource disposal are exercised with real Three.js geometry. GPU and browser verification belongs to the root batch.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。节庆巨偶小模型、花章、底座木把与圆台；别花→移模型→静看。

核查重点：地方档案年代不等于全加泰罗尼亚起源；本模型不对应 Llúcia/Chabran 等具名角色；花章与桌上陈列非巡游程序。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#catalan-festival-giant)。


## 2026-10-26 空间跟手与到位完成

花章接衣襟、整巨偶底座到展台自动落稳，已接花章随整偶移动。

这是产品输入与落稳机制调整；器物、文化语境、原先后与来源身份沿用已有核查，不新增传统步骤或效力主张。抓取偏移、单指归属、取消复原、暂停冻结与辅助按钮保留。已到位提交的指针尾事件不会再推动下一步；尚未到位取消会复原。最终逐场结论与验证范围见[C 组落地记录](../../../../docs/research/2026-10-26-spatial-placement-audit-c.md)。
