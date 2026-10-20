# 节旗轻展

A contemporary miniature flag-making tribute to the public preparation and banner imagery of Breton pardons. This is **not an actual pardon, a pilgrimage simulation, a church role, or an act granting absolution**. The sea-green cloth, small sun and wave decoration are original; no parish banner, saint image, coat of arms or national/regional flag is copied.

Read `content/traditions/breton-pardons.md` and viewed `breton-pardons.jpg` on 2026-10-13. The photo shows a flower-decorated devotional shelter and is contextual research only; it is neither a flag template nor a runtime asset. Verified the French Ministry of Culture's [La Bretagne, terre des pardons](https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons), published 2025-09-08. It describes the living religious and community tradition, including banners in processions and volunteers preparing events. That source establishes cultural context only; the three-step miniature craft choreography here is our invention.

Physical sequence:

1. `banner-hem-tab` → `banner-crossbar-clip`: pull the actual cloth corner to the wooden crossbar's gold clip. The fabric's mesh vertices spread from accordion folds, carrying its sewn hems, original painted decoration and three tassels.
2. `banner-staff-grip` → `banner-stand-socket`: move the full staff and cloth assembly into the visible recessed wooden stand. The bottom of the pole contacts the socket floor; both the initial pole and stand base rest on the workbench.
3. Tap the staff or cloth for a quiet finish. No wish form or wish write.

Cues point to real visible meshes. Starts use the first visible mesh across the scene; drop checks exclude only the held subtree, preserving occlusion by all other objects. Drags require 8 px movement; quiet taps require less than 12 px maximum travel. The native action button follows the same checkpoints.

Narrow tests use real Three.js geometry, raycasting and interaction cues, replacing only the GPU rendering boundary. They cover cloth deformation and fixed attachment, support contact, source/destination occlusion, 320/390/1280 px cue projection, cancellation, capture loss, multiple pointers, host pause, blur, reduced motion, silent restores for checkpoints 0–3 and idempotent resource disposal. The root task owns full-suite, build and browser visual validation. No external asset is requested at runtime.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。原创太阳海浪布旗、横杆布耳、旗杆展座；展开扣杆→入座→静看。

核查重点：14世纪是文化部综述的发展背景，不是所有堂区同年创设。太阳海浪无统一宗教解释，桌上陈列不完成 pardon。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#breton-banner)。
