# 节旗轻展

## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用悬挂物的轻摆（`sway`），只作小幅转动，不让物件离开挂点漂走。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`cloth`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `breton-pardons`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

A contemporary miniature flag-making tribute to the public preparation and banner imagery of Breton pardons. This is **not an actual pardon, a pilgrimage simulation, a church role, or an act granting absolution**. The sea-green cloth, small sun and wave decoration are original; no parish banner, saint image, coat of arms or national/regional flag is copied.

Read `content/traditions/breton-pardons.md` and viewed `breton-pardons.jpg` on 2026-10-13. The photo shows a flower-decorated devotional shelter and is contextual research only; it is neither a flag template nor a runtime asset. Verified the French Ministry of Culture's [La Bretagne, terre des pardons](https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons), published 2025-09-08. It describes the living religious and community tradition, including banners in processions and volunteers preparing events. That source establishes cultural context only; the three-step miniature craft choreography here is our invention.

Physical sequence:

1. `banner-hem-tab` → `banner-crossbar-clip`: pull the actual cloth corner to the wooden crossbar's gold clip. The fabric's mesh vertices spread from accordion folds, carrying its sewn hems, original painted decoration and three tassels.
2. `banner-staff-grip` → `banner-stand-socket`: move the full staff and cloth assembly into the visible recessed wooden stand. The bottom of the pole contacts the socket floor; both the initial pole and stand base rest on the workbench.
3. Tap the staff or cloth for a quiet finish. No wish form or wish write.

Cues point to real visible meshes. Starts use the first visible mesh across the scene; drop checks exclude only the held subtree, preserving occlusion by all other objects. The cloth tab and staff settle on reaching their targets; quiet taps require less than 12 px maximum travel. The native action button follows the same checkpoints.

Narrow tests use real Three.js geometry, raycasting and interaction cues, replacing only the GPU rendering boundary. They cover cloth deformation and fixed attachment, support contact, source/destination occlusion, 320/390/1280 px cue projection, cancellation, capture loss, multiple pointers, host pause, blur, reduced motion, silent restores for checkpoints 0–3 and idempotent resource disposal. The root task owns full-suite, build and browser visual validation. No external asset is requested at runtime.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。原创太阳海浪布旗、横杆布耳、旗杆展座；展开扣杆→入座→静看。

核查重点：14世纪是文化部综述的发展背景，不是所有堂区同年创设。太阳海浪无统一宗教解释，桌上陈列不完成 pardon。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#breton-banner)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。


## 2026-10-28 光学材质技术更新

仅主布旗加入低强度漫透射与织纹，另外建立布面材质；布边、图案、余布、木杆与支座保留原材质。

本轮为材质显示层技术变化，纸、布与有机表面保持不透明；几何、原有配色/印字、动作、完成条件、来源字段、标题、技术 ID 和存档兼容性不变。文化影响沿用[本 README 既有来源核查与产品边界](README.md)，未新增材料出处、传统步骤或信仰功效主张；技术实现不作为文化证据。统一方案、已读技术来源与验证范围见[本轮接入记录](../../../../docs/research/2026-10-28-ritual-optics-integration.md)。
