# 炉前一炷


## 2026-11-06 Komorebi 默认画风

共享环境默认启用已校准的 Komorebi 草地、光照与调色；按用户后续要求，背景树恢复原先逐场配置（原树及原有场景推荐），Komorebi 树仅作为调试台可选树种、选择后加载。分享、恢复与退出调试使用同一默认组合；夜景、没有植被的环境与器物主题树按原场景保留。这是产品背景美术统一，不新增植物地域、传统寓意或仪式规则；主题器物、动作、文案、来源身份、引擎和存档保持。[范围、来源核查与验证](../../../../docs/research/2026-11-06-komorebi-defaults.md)。

## 2026-11-05 小物图标风格正式显示

默认柔和风格现使用连续明暗、减弱描边与柔和阴影，并参照本场图标在原色系内限幅校准明度/饱和度；保留既有材料、贴图、透光/反射及动态反馈。器形、部件、原创图案和动作不变。这些是产品美术参数，不增加传统材料工艺、寓意、规则或功效主张。来源绑定、标题、引擎版本及存档保持；文化外链未重新访问，沿用既有逐场核查支持范围和读取状态。[实际呈现、边界与验证](../../../../docs/research/2026-11-05-icon-style-rollout.md)。较早试做记录为其当时状态，本轮已正式接入。


## 当前产品收尾（2026-10-31）

进入独立的末尾静看／静候段后，使用柔和光泽变化（`glow`）；共享收尾不额外移动或转动目标，固定器物仍留在安放处。该段累计活动时间为3秒，减少动态为0.6秒并关闭共享收尾的位移／旋转；进度结束自动完成，无须再点物件或辅助按钮。前面的真实操作和既有动作动画不包含在这3秒内。

本场目标：`censer`。

独立模块若提供原生写愿表单，输入框获得焦点、IME组合输入或存在非空白未提交草稿时暂停自动计时，保留文字；明确提交仍沿用原保存路径。App继续在动作完成后提供可选祈愿，不把文字输入变成完成门槛。

暂停、失焦或页面隐藏时不计时；退出销毁不补发完成。恢复到原末尾静看检查点会重新播放收尾，已完成存档不重复奖励；尚未完成的物件操作保持原验收。

来源继续使用 `chinese-incense`，文化支持范围不变。3秒、0.6秒、柔光、轻摆、轻浮及自动结算均为产品表现，不是传统期限、仪式动作或功效。较早记录中的“再点静看／静听／静立”及以该点按结算的说明不再是当前完成条件。现有文化事实、外链读取状态、技术ID、引擎版本与存档格式保持；逐场范围与验证边界见[自动收尾集中记录](../../../../docs/research/2026-10-31-automatic-quiet-endings.md)。

## 2026-10-24 触摸容错

炉盖、香孔等真实可见表面附近22 CSS px内可触摸，到位显示可以松手，实际握点已对齐也接受偏心持握。安香时手持细香与纸套一起忽略，其他前景仍阻挡。保留开盖、安香、静烟及妈祖礼敬来源范围，不新增文化主张。[逐场审阅与验证](../../../../docs/research/2026-10-24-scene-interaction-review-a.md)。

## 2026-10-19 来源核查修正

现关联改为直接对应器物、工艺或节庆行为的专卡。原地区或宗教总卡不足以单独证明本场景的文化来源；具体证据及产品动作边界见下方审阅记录。

当前来源：`content/traditions/chinese-incense.md`。核查依据与原关联的问题见[全场景来源审阅](../../../../docs/research/2026-10-19-scene-culture-audit.md)。


Original procedural still life for `chinese-incense`, grade C, low sensitivity. Category: 祈福. The experience does not write a wish or reproduce an ancestral or priest-led rite.

## Cultural scope and sources

- Read `content/traditions/chinese-folk-and-confucian.md` and visually inspected its associated `chinese-folk-and-confucian.jpg` on 2026-10-13. The photograph depicts Tomb Sweeping Day paper burning; its cemetery, burning paper, and family ritual are deliberately outside this scene's scope.
- [UNESCO — Mazu belief and customs](https://ich.unesco.org/en/RL/mazu-belief-and-customs-00227): the official entry describes smaller public and domestic observances that may include incense and flowers. Verified via the search-indexed official entry on 2026-10-13; direct opening returned a JavaScript challenge.
- [China Intangible Cultural Heritage — 妈祖信俗](https://www.ihchina.cn/mazuxinsu.html): official description places customary practice in its community and cultural context. This supports the broad context, not the specific interactive sequence or a universal Chinese ritual.

The rounded three-foot ceramic censer, its double scroll ears and seed-shaped knob are an original composition, not a scan or replica. The three interactions are ordinary object handling for a cultural tribute: lift the lid to its rest; move one fine stick into the visible socket; touch the tea saucer or vessel to look quietly. No deity, ancestral tablet, paper burning, clerical action, efficacy promise or ritual-completion claim is presented. The paper sleeve is an original visual accommodation for a real mobile touch target; it returns to the table as the stick is seated.

## Geometry and interaction contracts

- `incense-lid-knob` → `incense-lid-rest`: visible physical lid knob and ceramic support.
- `incense-paper-grip` → `incense-socket`: opaque paper sleeve and recessed dark ceramic insertion socket. `incense-stick-foot` marks the actual stick's final seating point.
- `incense-tea-saucer`: cue anchored to its exposed front lip. The cup and censer body also accept the final quiet tap.
- `incense-censer`, `incense-three-feet`, `incense-scroll-ear-*`, `incense-lid`, `incense-stick`, `incense-tea`, `incense-table`, `incense-smoke`: named original scene objects.

All assets are generated locally in Three.js. No texture URLs, network runtime assets or additional dependencies. All native-button actions use the same placement/finish transitions as direct object input. Checkpoints 0–3 restore without reporting progress, completion, wish writes, sound or vibration.

## Verification

`npm run test -w @wbr/scenes -- src/chinese-incense/scene.test.ts`

GPU rendering alone is mocked in jsdom; scene geometry, raycasting, projected cues, object pointer ownership and native DOM actions are real. The tests cover placement, incorrect input, direct mobile coordinates, restoration, pause/focus/cancellation, mixed page pointers, frozen animations and disposal of all owned resources/listeners.

## 2026-10-20 当前介绍核查

已按实际器物与用户提示扩充介绍。三足陶炉、炉盖盖托、单支细香及纸套；开盖→插香孔→静烟，UI 当前明确妈祖语境。

核查重点：旧卡一般香炉与祖先访谈不能单独证明妈祖，已补直接妈祖材料并撤回“未指定神明”描述。田野所述三炷/神位次序不移植为全国通则；当前一炷、盖托、纸套是产品选型。UNESCO 页面验证码、团标链接系统错误均未作为已读。

逐项证据、实际阅读位置和访问状态见[本轮介绍研究记录](../../../../docs/research/2026-10-20-scene-narratives-a.md#chinese-incense)。


## 2026-10-26 当前跟手安放

本轮的物件搬运步骤改为拿住真实物件跟随手指，移到当前提示范围即自动落稳。不再以固定方向、最短拖距或必须松手判断摆放成功。同一根手指的后续移动与释放不操作下一步；取消只撤回尚未接受的拿取。键盘辅助、减少动画、旧检查点和原有文化语境保留。此前段落中关于这些搬运步骤的短拖、20%预览和松手才接受描述为旧实现，以本节为当前机制。屏幕落区、吸附和短程落稳是产品输入安排，不新增传统礼序、次数或功效。[逐步审阅和本轮验证](../../../../docs/research/2026-10-26-spatial-placement-audit-a.md)。


## 2026-10-28 材质光效接入

辅助茶面接入弱茶色透射；香烬、烟与陶炉保持原实现。 仅调整已审查部件的技术光学表现，器物、材料身份、动作、文案、来源、技术 ID 与存档不变；文化边界沿用本 README 既有核查及[逐场材质审查](../../../../docs/research/2026-10-28-material-lighting-audit.md)，不新增传统主张。实现与验证见[集中记录](../../../../docs/research/2026-10-28-ritual-optics-integration.md)。

## 2026-11-04 共享日景远景云

共享白天环境接入 Toon Cloud 远景云带；只在镜头露出的天空中显示，俯视时由地面和主体自然遮挡。云为产品布景，器物、材料、动作、信仰/节庆语境、完成条件、文案及来源沿用本 README 既有核查，不增加天气规则、传统云纹或功效主张。[本轮范围、署名许可与验证](../../../../docs/research/2026-11-04-toon-cloud-daylight-expansion.md)。

## 2026-11-05 材质显示扩展

接入陶炉/盖/茶具、木桌、织垫与细香竹芯细纹。织垫、陶件、灰圈和纸套印纹已按用途分材质；茶水光学、香料与烟保持。新增细纹为产品美术，沿用既有文化主张与来源；几何、动作及完成条件未改。本轮外链未重读，详见[材质扩展研究记录](../../../../docs/research/2026-11-05-craft-material-rollout.md)。

## 2026-11-26 纸套中空折口与印纹纸感更新

将原实心厚圆角方盒纸套（及浮凸顶条、侧条、枝叶圆点）改为薄壁闭合中空折纸套（`createIncenseSleeveGeometry`：压平鼓腹折边截面、左侧微阶搭接折缝、闭合底折与上端前低后高的开放袋口，使细香自然穿出袋口且置香后空纸套显露中空内衬与纵深暗影），并将既有暖陶色纸面、浅米折边带与简约枝叶印纹转为直接印入纸纹的确定性 512×256 贴图，接入共享 `ritual-optics` 薄纸光学（`layout: 'sheet'` 纤维纸齿与 Komorebi 高光收敛）。纸套仍为产品触屏持握适配物；陶炉、茶具、细香、动作与妈祖敬香来源边界均保持，不新增传统纸套规制或仪式主张，沿用既有核查，未重读外链。

## 2026-11-26 风格化木桌与香托自然木纹流动与木眼去重优化

收敛受 Komorebi 日光直射冲白的浅色木桌面色阶，为矮木桌单板桌面、深暖横向围框、微差双组竖向桌腿（`axis: 'y'`）以及左侧细香纸套下的深暖油润木托分别配置不同木纹尺度与确定性 256×256 自然流动木纹与稀疏木眼，打破规整横纹重复感，同时使浅色织垫、青釉香炉、茶具与暖陶色折纸套在桌面上的明暗层次更沉静清晰。细香与竹芯、陶炉与炉盖／盖托、茶具与茶面、织垫以及中空折纸套均保持不动。本轮仅为产品美术与木纹轴向优化，不新增特定木材传统、神明规制或礼序主张；文案、步骤、来源身份（`chinese-incense`）、技术 ID 与存档兼容性不变，沿用本 README 既有核查记录，外链未重读。

## 2026-11-28 视觉材质与视听微动润色

将 `incense-smoke` 内的两条静态管状烟丝升级为程序化丝缕轻烟（`createSoftPlume`），为香烬补充温和呼吸发光、茶面补充淡雅温茶热气，对香炉炉身与茶杯内腔烘焙静态缝隙环境光遮蔽（`bakeCreviceAO`），并在矮桌、香炉、盖托、茶托与香托下补充接触阴影（`addContactShadow`）；同步接入轻柔的器物触碰材质反馈音（陶声、木触、纸声）。中空折纸套（`createIncenseSleeveGeometry` 与薄纸光学）、器物造型、三步交互、界面文案、妈祖敬香来源边界（`chinese-incense`）、技术 ID 与存档兼容性均保持不变；新增烟气、光影与材质声响纯属产品物理视听表现，不新增祥瑞烟形、占象或传统礼乐主张，沿用本 README 既有核查记录，外链未重读。
