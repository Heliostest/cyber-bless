# 全场景操作与完成判定检查

检查日期：2026-10-23。本报告保留修正前的问题与证据；用户随后批准修复，当前实现、修正范围与最终验证见[操作修正记录](2026-10-23-scene-interaction-fixes.md)。下文行号对应审阅时版本，修复后可能移动。

范围为 130 个场景模块及宿主木鱼，共 131 个条目。当前 App 可见 64 个，另有 67 个历史／开发条目被目录隐藏；隐藏不代表引擎和旧存档已移除。以下逐项区分当前影响与潜在问题。

## 结论与优先级

最主要的问题是把放松操作做成了隐形的精度测试。用户方向正确、物件已经看似到位，仍可能因为多拖几十像素、手指没覆盖落点、输入事件刚好错过小检查点而失败。辅助按钮普遍存在，但不能证明直接操作体验合格。

| 编号 | 问题 | 全部引擎范围 | 当前 App 可见范围 | 建议 |
| --- | --- | --- | --- | --- |
| A | 正确方向只接受40–84px，另有路径、回退、横偏限制 | 53场景 | 29场景 | 第一批处理 |
| B | 未配置方向时箭头默认朝上，与实际方向冲突 | 30场景、64步骤 | 7场景、16步骤 | 第一批处理 |
| C | 连续轨迹经过检查点，事件采样没落在点上仍失败 | 红绳、苏玛莱克、水引 | 苏玛莱克、水引 | 第一批处理 |
| D | 勺底已落稳，仍要求手指落在展托 | 木勺寄情 | 可见 | 第一批处理 |
| E | 真实接受区远小于可见对象或手指 | 彩车、彩蛋、草编花园、茉莉花环等 | 彩蛋、草编花园、茉莉花环可见 | 第二批处理 |
| F | 描线、绕圈限制事件数或单次步幅，修正后仍整笔失效 | 奉谢小牌、油灯 | 均可见 | 第二批处理 |
| G | 摩擦进度隐藏，抬手后不能跨笔划累积 | 木版留春 | 当前隐藏 | 后续处理 |

各类问题有重叠，不能将行数相加当作不同场景数。没有证明某个场景“所有路径都无法完成”。已确认的是正常、合理的直接操作会被拒绝。失败一般重置当前未完成动作，保留之前已提交的阶段；绕圈和描线可能清掉本圈／本笔进度，并非一律全场清零。

## A 隐藏拖动窗口与反馈脱节

53个场景复制了以下释放限制：

~~~ts
along >= 40 && end >= 40 && end <= 84
&& travel <= 90
&& minAlong >= -8
&& backtrack <= 9 && maxAlong - end <= 9
&& maxCross <= 18 && Math.abs(cross) <= 18
~~~

用户沿正确方向直拖60px可完成，继续拖到85或120px再松手却失败。拖到60px后回退10px也会超过回撤限制。小幅画弧可能同时触及横偏和总路程限制。提示中的“短拖”不能让用户知道这些隐藏参数。

代码例证：[浇水敬老释放判定](../../packages/scenes/src/thai-songkran-elders/scene.ts#L69)、[折扇释放判定](../../packages/scenes/src/valencian-folding-fan/scene.ts#L68)。a–h分组中的20个场景已经逐一用真实几何与输入验证：第一步同源、同方向60px成功，120px失败，辅助按钮仍可继续。其余33个场景逐项核对同一表达式。

部分场景还把反馈压缩得很弱：茅环仅预览动作的4%，银球仅8%，多种供奉场景仅20%；达到60px后预览便不再前进。用户看不出已经足够，自然会继续拖，随后撞上84px上限。见[茅环](../../packages/scenes/src/chinowa-kuguri/scene.ts#L66)、[银球](../../packages/scenes/src/french-petanque/scene.ts#L65)。另一些场景在60px已呈现完整形态，过拖失败更与画面矛盾。

改法：

- 复用现有 [completesDirectionalDrag](../../packages/scenes/src/directional-drag.ts#L17) 的宽容规则，去除固定最大拖距和固定总路程预算。已到位且松手仍在合理方向时保持成功。
- 允许与行程成比例的小幅偏移和纠正；明显回到起点可视为撤销。
- 根据当前姿态显示“可以松手”，或在达到完成量时锁定本动作完成资格。让触觉、颜色或轻声反馈与实际成功条件同时发生。
- 长提示、箭头、方向轴、完成阈值从同一份动作配置读取，避免复制后分叉。

## B 箭头与操作方向相反

[提示渲染器第98行](../../packages/scene-runtime/src/interaction-cues.ts#L98)在没有direction和destination时使用[0,-1]，箭头朝上。旧窗口组中32场没有配置方向，其中2场三步恰好全部上拖；另30场有64步实际要求左、右或下拖。

当前可见且受影响的7场：

| 场景 | 第1步正确方向 | 第2步正确方向 | 第3步正确方向 | 错误箭头步骤 |
| --- | --- | --- | --- | --- |
| 栏前结愿 bonfim-ribbon | 右 | 左 | 右 | 1、2、3 |
| 茅环祈安 chinowa-kuguri | 左 | 右 | 左 | 1、2、3 |
| 破榴迎新 greek-new-year-pomegranate | 上 | 右 | 下 | 2、3 |
| 红白寄春 romanian-martisor | 上 | 右 | 下 | 2、3 |
| 三石寄愿 sumiyoshi-godairiki | 右 | 右 | 右 | 1、2、3 |
| 龟岩投愿 udo-undama | 上 | 右 | 上 | 2 |
| 泉水净币 zeniarai-coin-washing | 上 | 左 | 右 | 2、3 |

普通复现：在“三石寄愿”按向上的箭头拖60px，判定拒绝；按长提示向右拖才有效。不是用户不够精确，而是界面给出了错误方向。

改法：每一步显式配置方向，并与判定共用配置。不能只改箭头而继续维护另一份独立axes表达式。全量历史条目的错误步骤列在末尾表中。

## C 轨迹正确却因事件采样漏判

浏览器不会沿手指路径的每一个像素都产生事件。现在这些场景把“事件点命中下一颗小球”当成“路径经过下一颗小球”，两者不等价。

| 场景 | 证据位置 | 本轮真实几何实验 | 改法 |
| --- | --- | --- | --- |
| 红绳自持 hongsheng-red-string | [158行单点检测](../../packages/scenes/src/hongsheng-red-string/scene.ts#L158)、168行释放 | 半径.64的准确圆，同样24个等角事件：采样包含珠心时成功，统一错开半个采样间距时失败。小球半径.057，事件间隔15°，中点距珠心7.5°超过约5.1°接受半角。 | 检测连续线段或角度扫掠，允许一事件跨过多个有序检查点，保留完成段。 |
| 苏玛莱克 navruz-sumalak | [163–169行](../../packages/scenes/src/navruz-sumalak/scene.ts#L163)、194–198行 | 同一理想半圆，12个均匀移动样本失败；16、24、32、60个样本成功。半径.62、珠半径.072，12样本时首珠最近点约差.081。 | 按输入段扫过判定，保留八点顺序，不要求逐珠停顿。 |
| 水引 mizuhiki | [386–395行](../../packages/scenes/src/mizuhiki/scene.ts#L386)、416–420行 | 第一金点前后各.18世界单位发事件，两点屏幕相距37.318px，连线穿过半径.17门区；其余金点逐个命中仍失败。逐点中心输入可成功。 | 判断输入段与有序门区相交，允许在交叉点按当前顺序继续。 |

这些缺陷会让慢慢逐点“喂事件”的自动化通过，让普通较快的一笔失败。改法仍需保留路线顺序、自交辨识和明显离轨撤销，不能直接将起点到终点的一条捷径当成完成。

## D 木勺已经放稳却失败

[提示第15行](../../packages/scenes/src/welsh-love-spoon/scene.ts#L15)让用户握住木柄，把勺底落稳在展托；[131行](../../packages/scenes/src/welsh-love-spoon/scene.ts#L131)却只检查释放手指是否命中展托。

本轮真实Three几何与输入实验：390×560画布，从木柄抓取，把spoon-body底点精确对齐REST(.78,.88,.02)的投影，误差约1.1e-13px。手指坐标约(291.14,313.89)，勺底落点约(295.72,435.76)，松手后没有进度并回原位。

这是可见物件位置与判定对象不一致。已有[偏心放置测试](../../packages/scenes/src/placement-scenes.test.ts#L201)跳过木勺第2步，不能用其全绿证明此路径正确。

改法：把勺底锚点与展托接纳区域的对齐作为成功路径，保留手指直接落区的辅助路径。进入接纳范围就吸附或亮起；抓住不同柄位置应得到一致结果。

## E 小命中区与“看起来合理”不一致

下面尺寸是指定相机、画布下真实几何投影的包围盒；实际可命中轮廓通常更小，尺寸不是所有设备的固定值。

| 场景 | 实测／计算 | 证据 | 改法 |
| --- | --- | --- | --- |
| 彩车迎晴 sicilian-painted-cart | 390×390画布：轮毂约20.43×18.80px，车轴17.18×18.97px，扶手35.15×7.55px | [143行起点](../../packages/scenes/src/sicilian-painted-cart/scene.ts#L143)、150行落点 | 允许抓整个轮子或车厢；轴端增加屏幕容差和近距离吸附。 |
| 彩蛋 sorbian-painted-egg | 390×560画布：可见杯沿约92.09×31.30px，接受椭球仅32.30×14.36px；落在左右杯沿不被接受 | [75–76行目标](../../packages/scenes/src/sorbian-painted-egg/scene.ts#L75)、152行释放 | 接纳整个杯口／杯沿与蛋底的接触，别让文案描述大区域、代码只认前面一点。 |
| 草编花园 lithuanian-straw-garden | 390×408：起点18.25×18.07px、接点16.15×16.10px、挂点17.92×18.25px | [63行](../../packages/scenes/src/lithuanian-straw-garden/scene.ts#L63)、83/85行、113/118行 | 放大触控接纳区，连接珠靠近即预告可释放。 |
| 茉莉花环 phuang-malai | 拖动平面z=.05，目标z=.18，3D距离阈值.155，使平面半径缩成sqrt(.155²-.13²)≈.0844 | [299–303行](../../packages/scenes/src/phuang-malai/scene.ts#L299)、325行 | 将比较点投到同一平面，或直接使用屏幕接近与花簇接触判定。 |

建议先以约44 CSS px作为触控接受区域的设计起点，再按相邻目标、遮挡与误触校准；这是待体验验证的产品参数，不是统一放大所有模型或任意远距离吸附。

已有 [placementHit](../../packages/scenes/src/placement-hit.ts) 的场景支持指针与握点双判定，相关偏心测试已通过。不能把所有放置场景都归为同一种错位缺陷，也不应粗暴扩大射线穿透导致隔着其他物体仍能抓取。

## F 描线与绕圈的额外硬门槛

**奉谢小牌 italian-ex-voto。** [160–166行](../../packages/scenes/src/italian-ex-voto/scene.ts#L160)要求距线不超过.09世界单位，回退不超过.16进度，单事件前进不超过.42；[193行](../../packages/scenes/src/italian-ex-voto/scene.ts#L193)又要求至少3个推进事件、覆盖≥.86且指针释放命中小终点。一次偏出再拉回，本笔仍永久失效。代码已确认这些限制，本轮未额外做动态失败复现。建议按连续段累计覆盖，允许回到线内修正；用覆盖量与终点接近判断，取消事件数量要求。

**油灯 diya-oil-lamp。** [326行](../../packages/scenes/src/diya-oil-lamp/scene.ts#L326)将单次角变化>.75rad判为无效；[349行](../../packages/scenes/src/diya-oil-lamp/scene.ts#L349)要求累计≥1.83π且接近闭环。慢速密集采样路线可完成，较稀疏输入存在漏判风险。本轮未在真机测量事件间隔，因此列为风险而非已证明的真机必现问题。建议连续弧段累计，显示绕行完成量，对短暂偏离允许恢复。

## G 刷印抬手不能继续累计

木版留春[156行](../../packages/scenes/src/chinese-woodblock-print/scene.ts#L156)每次按下都重置摩擦量与横向范围；[170行](../../packages/scenes/src/chinese-woodblock-print/scene.ts#L170)要求单次摩擦路程≥.75世界单位、横向跨度≥.45、释放仍命中纸面。用户刷一下、抬手换位置、再刷，无法累积；界面也没有相应覆盖量提示。

这属于与放松目标不合的体验限制，不是已经证明无法完成。建议按纸面覆盖跨笔划累积，呈现已刷范围；取消或明显撤回只处理当前笔划。

## 建议的修改批次与验收方式

判定还存在“简单但苛刻”的结构问题：多个名字和画面不同的动作，实际都由同一个固定方向短拖触发预制动画；同时又对手指轨迹施加严格限制。后续应按动作意图判断结果：接合看部件是否接上，放置看物件是否落稳，擦拭看覆盖量，绕行看有序路径覆盖，演奏看是否产生输入并由用户主动结束。每类提供几条合理成功路径，而不是增加更多隐藏条件，或把全部物件操作退化成同一个点击。

1. **第一批：修正明确误导与合理输入被拒绝。** 当前可见29场的A、7场的B，木勺物件落座，以及苏玛莱克和水引的连续采样。共享层修复后补齐同类隐藏引擎，避免旧存档或未来重开暴露旧问题。
2. **第二批：让直接操作可预期。** 彩蛋、草编、茉莉等触摸接受区；进入目标时给“可以松手”的反馈；让描线、绕圈允许修正与累积。
3. **第三批：逐类丰富成功路径。** 放置同时接受指针、握点或真实接触；方向动作接受短拖、长拖和合理斜拖；描画接受跨笔划覆盖；演奏允许自由玩和主动结束。每类保留一个明确、可发现的辅助完成入口，不把所有场景都改成一个相同按钮。

验收应从“理想中心路径可完成”改为“正常操作也可完成”：

- 方向：正确60、85、120、180px；小幅斜拉、10–20px修正；完成后继续拖。反向、取消、多指与明确撤销仍不误完成。
- 放置：中心与偏心抓取；物体已经对齐但手指不在落区；目标边缘；不同手机尺寸；不能隔着实物穿透抓取。
- 轨迹：同一路径用12、16、24、60等采样数及半步错相；输入段穿过检查点；掉帧后可恢复；不能通过捷径跳过有序路线。
- 反馈：达到判定条件与画面提示同步；无效操作有可理解原因；当前动作失败不清除已完成阶段。
- 流程：开始、连续步骤、恢复进度、辅助入口、主动结束和完成事件只触发一次。

[旧伞测试](../../packages/scenes/src/japanese-wagasa/scene.test.ts#L133)等目前明确把3倍同方向拖距和部分路径纠正列为应拒绝输入。这些验收本身需要随产品目标调整。不能为保住全部旧断言而继续保留已确认的体验问题。

## 验证记录与边界

主审本轮运行：

~~~text
npm run test -w @wbr/scenes -- src/directional-drag-scenes.test.ts src/placement-scenes.test.ts src/legacy-interaction-audit.test.ts
3 files, 347 tests passed

npm run test -w @wbr/app -- src/woodfish-press.test.ts src/woodfish-motion.test.ts
2 files, 9 tests passed
~~~

分组核查另用保留真实Three几何、相机、射线和指针事件的临时harness复现20场过拖、三种轨迹漏判、木勺落座失败，并测量小目标。临时验证文件均已清理；这些实验尚未转成持久回归测试。

Chromium检查中，“浇水敬老”首步在相同起点正确上拖60px进到1/3，上拖85和120px不推进；这与静态条件吻合。其他批量浏览器探索出现过理想控制输入也未推进，期间开发服务器还记录到工作区样式和菜单模块的热更新；未以这些不稳定结果追加缺陷结论。正式修改时需使用等待状态稳定的浏览器验证，并补真实手机触控。没有将全场景代码审阅说成131场逐一真机实测。

本轮没有产品实现改动，因此未重新构建发布包。现有绿色测试证明已覆盖路径可完成，不证明容错足够，也不证明文化事实。

## 来源与文化影响核查

已阅读[项目核查规范](../scene-provenance.md)，并参考[既有文化审阅记录](2026-10-19-scene-culture-audit.md)的适用范围。此次仅审阅代码并新增检查报告：

- 器物、材料、传统动作叙述、文化来源、寓意、标题、宿主目录、注册表、模块metadata、技术ID、存档均未改。
- 本文的距离、容差、辅助输入、采样和反馈建议属于产品实现判断，不能被写成传统步骤或要求。
- 未新增文化主张，因此没有进行外部来源正文复查，也没有声称本轮重新核验了全部传统。
- 后续若调整动作组合、次数、顺序、提示含义，按规范重新核对受影响主张并同步来源卡、README与研究记录；纯技术判定容错需说明文化内容未变。

## 逐场景清单

“相对正常”表示本次代码检查及已覆盖的操作路径未发现上述确定性严重问题，不是所有设备和所有手势均已通过。表中A–G对应前文；B后标注错误箭头的步骤。所有“隐藏”条目仍可在开发检查或旧引擎上下文出现。

| 场景 | 当前目录 | 检查结论与改法 |
| --- | --- | --- |
| 舟模寄谢 `aland-votive-ship` | 可见 | 相对正常：双放置＋轻点，已有握点补偿；可改善吸附预告。 |
| 织毯寄暖 `amazigh-woven-rug` | 隐藏 | 相对正常：木梭、夹杆放置；偏心抓取路径已有测试。 |
| 釉彩映晴 `andalusian-ceramic-tile` | 隐藏 | 相对正常：补砖、上架；精确落点与失败反馈可改善。 |
| 蓝白晾晴 `bai-indigo-cloth` | 隐藏 | 相对正常：漂洗、晾杆放置；仍可扩大触摸容差。 |
| 叶盘献谢 `balinese-canang-sari` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/balinese-canang-sari/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 陶鸡报晓 `barcelos-clay-rooster` | 可见 | 相对正常：画笔装饰、上台；精确落点可改善。 |
| 太阳花迎门 `basque-sunflower` | 可见 | 相对正常：花心装配、挂门；已有握点补偿。 |
| 茶山一盏 `blang-tea` | 隐藏 | 相对正常：添叶、倒茶、点杯；倒茶落区可进一步扩大。 |
| 竹筛迎岁 `bokjori` | 可见 | 相对正常：舀米、挂放、轻点；目标可达。 |
| 栏前结愿 `bonfim-ribbon` | 可见 | A：窄拖动窗口；[判定第64行](../../packages/scenes/src/bonfim-ribbon/scene.ts#L64)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次右／左／右。 |
| 节旗轻展 `breton-banner` | 隐藏 | 相对正常：布耳接杆、立旗；已有握点补偿。 |
| 彩枝贺年 `bulgarian-survakane` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/bulgarian-survakane/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 巨偶待游 `catalan-festival-giant` | 隐藏 | 相对正常：花章、底座放置；失败反馈可改善。 |
| 泉边一念 `celtic-folk-spring` | 隐藏 | 相对正常：点按或倾斜、物件入水、留言；未真机验证陀螺仪。 |
| 空竹轻扬 `chinese-diabolo` | 隐藏 | 相对正常：已用宽容方向判定，支持抛接重玩、主动结束。 |
| 炉前一炷 `chinese-incense` | 可见 | 相对正常：目标可达；小香孔触摸容差可扩大。 |
| 拨浪轻响 `chinese-rattle-drum` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/chinese-rattle-drum/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次右／左／下。 |
| 影偶小戏 `chinese-shadow-puppet` | 隐藏 | 相对正常：已用宽容方向判定，长拖可完成。 |
| 移砣平衡 `chinese-steelyard` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/chinese-steelyard/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、3步箭头错误；正确方向依次右／上／下。 |
| 拨珠见数 `chinese-suanpan` | 隐藏 | 相对正常：已用宽容方向判定。 |
| 七巧归方 `chinese-tangram` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/chinese-tangram/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1、3步箭头错误；正确方向依次左／上／右。 |
| 木版留春 `chinese-woodblock-print` | 隐藏 | G：刷印量不显露，抬手不累积；建议跨笔划累计覆盖。 |
| 茅环祈安 `chinowa-kuguri` | 可见 | A：窄拖动窗口；[判定第70行](../../packages/scenes/src/chinowa-kuguri/scene.ts#L70)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次左／右／左。 |
| 井边放下 `clootie-well-rag` | 可见 | 相对正常：入水、挂枝、结束；无严格路径预算。 |
| 折一只纸鹤 `crane` | 可见 | 相对正常：点击折纸、提起放置；物件路径已有测试。 |
| 彩心相赠 `croatian-licitar-heart` | 可见 | 相对正常：装饰、挂放、静看；可改善吸附与容差。 |
| 珠星映光 `czech-bead-star` | 隐藏 | 相对正常：接珠、转动；长拖与完全转到位后的纠正可接受。 |
| 旅途一页 `czech-pilgrim-journal` | 隐藏 | 相对正常：翻开、夹书签、轻点；无绝对路径预算。 |
| 木齿轻转 `czech-wooden-ratchet` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/czech-wooden-ratchet/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1、2步箭头错误；正确方向依次右／左／上。 |
| 木马安放 `dalarna-wooden-horse` | 隐藏 | 相对正常：画笔装饰、上台；精确落点可改善。 |
| 达摩点睛 `daruma-eye-painting` | 可见 | 相对正常：眼部与归台目标可达；按钮辅助齐全。 |
| 灯旋一瞥 `diya-oil-lamp` | 可见 | F：绕灯有单事件角度上限与近整圈闭环要求；需改连续弧段判断。 |
| 木牌记愿 `ema-votive-plaque` | 可见 | 相对正常：翻面、可留白留言、拖挂；辅助路径齐全。 |
| 风囊轻送 `english-hearth-bellows` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/english-hearth-bellows/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第2步箭头错误；正确方向依次上／下／上。 |
| 秋千轻荡 `estonian-village-swing` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/estonian-village-swing/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第2步箭头错误；正确方向依次上／下／上。 |
| 毛线织暖 `faroese-wool-knit` | 隐藏 | 相对正常：已用宽容方向判定；可进一步统一对角提示与方向轴。 |
| 浴佛发愿 `fgs-buddha-bathing` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/fgs-buddha-bathing/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 叶扇纳凉 `fijian-woven-fan` | 隐藏 | 相对正常：绑圈接头、扇柄入托；已有握点补偿。 |
| 桦篮拾光 `finnish-birch-basket` | 隐藏 | 相对正常：接提柄、篮上垫；已有握点补偿。 |
| 五弦轻拨 `finnish-kantele` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/finnish-kantele/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第2步箭头错误；正确方向依次上／下／上。 |
| 叶舟寄意 `floating-lantern-loy-krathong` | 可见 | 相对正常：放花、点芯、推舟入水；辅助路径齐全。 |
| 手磨晨光 `french-coffee-mill` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/french-coffee-mill/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次左／右／下。 |
| 银球近靶 `french-petanque` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/french-petanque/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 风铃一响 `furin-wind-chime` | 可见 | 相对正常：点钟或上拖启动，静听后点钟；未真机验证倾斜。 |
| 草坪过门 `garden-croquet` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/garden-croquet/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次左／右／右。 |
| 牵绳木偶 `german-jumping-jack` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/german-jumping-jack/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次下／下／下。 |
| 木偶开果 `german-nutcracker` | 隐藏 | 相对正常：宽容方向判定；放嘴部或上拖均可。 |
| 木窝播籽 `ghanaian-oware` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/ghanaian-oware/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第2、3步箭头错误；正确方向依次上／右／左。 |
| 破榴迎新 `greek-new-year-pomegranate` | 可见 | A：窄拖动窗口；[判定第64行](../../packages/scenes/src/greek-new-year-pomegranate/scene.ts#L64)。取消最大距离，允许合理纠正。 B：第2、3步箭头错误；正确方向依次上／右／下。 |
| 新岁分糕 `greek-vasilopita` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/greek-vasilopita/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 柊鰯守门 `hiiragi-iwashi` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/hiiragi-iwashi/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 红绳自持 `hongsheng-red-string` | 隐藏 | C：同一准确圆轨迹仅改变事件采样相位即可失败，整圈重置。 |
| 花绣寄语 `hungarian-embroidery-hoop` | 隐藏 | 相对正常：线轴入布、圈上架；目标可达，反馈可改善。 |
| 棉线慢成 `indian-charkha` | 隐藏 | 相对正常：已用宽容方向判定；长拖可完成。 |
| 竹音轻摇 `indonesian-angklung` | 隐藏 | 相对正常：自由摇奏，可反复演奏，独立结束按钮。 |
| 鼓面轻拍 `irish-bodhran` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/irish-bodhran/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、3步箭头错误；正确方向依次下／上／右。 |
| 绘牌记谢 `italian-ex-voto` | 可见 | F：短描线要求≥3推进事件、单跳≤42%，一次偏线即锁死本笔。 |
| 木槌落片 `japanese-daruma-otoshi` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/japanese-daruma-otoshi/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2步箭头错误；正确方向依次下／右／上。 |
| 剑玉轻接 `japanese-kendama` | 隐藏 | 相对正常：宽容上拖；不要求真实抛接时机。 |
| 鲤旗迎风 `japanese-koinobori` | 可见 | 相对正常：宽容方向判定，允许长拖与修正。 |
| 竹筒叩石 `japanese-shishi-odoshi` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/japanese-shishi-odoshi/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次左／下／下。 |
| 纸伞舒晴 `japanese-wagasa` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/japanese-wagasa/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第2、3步箭头错误；正确方向依次上／右／下。 |
| 开樽祝愿 `kagami-biraki-sake` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/kagami-biraki-sake/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 镜饼迎岁 `kagami-mochi-offering` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/kagami-mochi-offering/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 木鷽迎福 `kameido-usokae` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/kameido-usokae/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 方巾裹礼 `korean-bojagi-wrap` | 可见 | 相对正常：六次空间操作，按覆盖、交叠、收紧判断；有可释放提示。 |
| 木柶行棋 `korean-yutnori` | 隐藏 | 相对正常：宽容方向判定；投掷、走棋、结束状态独立。 |
| 林村抛愿 `lam-tsuen-wishing-tree` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/lam-tsuen-wishing-tree/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 月下一灯 `lantern` | 隐藏 | 相对正常：点灯、挂牌、静看；挂牌仍可补物件接触判定。 |
| 草穗悬园 `lithuanian-straw-garden` | 可见 | E：起点、接点、挂点投影仅约16–18px；需扩大触控容差。 |
| 铁舌轻鸣 `malawi-sansi` | 隐藏 | 相对正常：自由点奏、下拨、九键及数字键；无唯一旋律。 |
| 石面磨香 `mexican-metate` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/mexican-metate/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1步箭头错误；正确方向依次下／上／上。 |
| 木旋起沫 `mexican-molinillo` | 隐藏 | 相对正常：已用宽容方向判定。 |
| 木压成圆 `mexican-tortilla-press` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/mexican-tortilla-press/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1、2步箭头错误；正确方向依次下／下／上。 |
| 留一枚感谢 `milagros` | 可见 | 相对正常：可选多种饰物；钉位仍可扩大触控容差。 |
| 木陀轻转 `minangkabau-spinning-top` | 隐藏 | 相对正常：已有握点补偿；拉珠、点帽、静看或留言。 |
| 水引结愿 `mizuhiki` | 可见 | C：输入线段穿过金点，但事件点未落门内时整环失败。 |
| 纸雏祈安 `mochigase-nagashibina` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/mochigase-nagashibina/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 毡屋向阳 `mongolian-felt-ger` | 隐藏 | 相对正常：已有握点补偿、可释放反馈与按钮。 |
| 敖包祈护 `mongolian-ovoo` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/mongolian-ovoo/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 春锅共煮 `navruz-sumalak` | 可见 | C：同一理想半圆12个移动样本失败，16个样本成功。 |
| 彩墙寄家 `ndebele-painted-house` | 隐藏 | 相对正常：小板、展台可达；释放仅看指针，可补物件对齐路径。 |
| 贝链留光 `niue-shell-necklace` | 隐藏 | 相对正常：穿壳、拉线宽容；末步可点、留言或按钮。 |
| 御守伴行 `omamori-cycle` | 可见 | 相对正常：多袋选择、扣环、返还、致谢可完成；扣环触控容差可改善。 |
| 签纸慢读 `omikuji` | 可见 | 相对正常：摇签、抽签、收签可达；释放仍偏重指针命中。 |
| 纸翼转风 `paper-pinwheel` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/paper-pinwheel/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、3步箭头错误；正确方向依次右／上／右。 |
| 熏籽祈安 `persian-esfand` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/persian-esfand/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 葫芦刻光 `peruvian-engraved-gourd` | 隐藏 | 相对正常：横刻、下擦宽容；末步可点、留言或按钮。 |
| 串花寄意 `phuang-malai` | 可见 | E：目标和拖动平面深度差使实际平面落区半径缩到约.0844世界单位。 |
| 一篮春食 `polish-blessing-basket` | 可见 | 相对正常：食物目标较大，多物体可静看；有辅助路径。 |
| 薄饼相祝 `polish-oplatek-sharing` | 可见 | A：窄拖动窗口；[判定第72行](../../packages/scenes/src/polish-oplatek-sharing/scene.ts#L72)。取消最大距离，允许合理纠正。 |
| 剪纸开花 `polish-paper-cut` | 隐藏 | 相对正常：长拖可完成；展开起点的纸边触控容差可改善。 |
| 瓜棱轻奏 `puerto-rican-guiro` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/puerto-rican-guiro/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1、3步箭头错误；正确方向依次下／上／右。 |
| 铜碗拾暖 `purepecha-copper-bowl` | 隐藏 | 相对正常：拭布、铜碗、毡座可达；偏心抓取已有测试。 |
| 红白寄春 `romanian-martisor` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/romanian-martisor/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第2、3步箭头错误；正确方向依次上／右／下。 |
| 蘸蜜迎岁 `rosh-hashanah-apple-honey` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/rosh-hashanah-apple-honey/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 套娃相藏 `russian-matryoshka` | 隐藏 | 相对正常：宽容方向判定，方向提示明确。 |
| 木杆搅乳 `scottish-plunge-churn` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/scottish-plunge-churn/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1步箭头错误；正确方向依次下／上／上。 |
| 节分撒豆 `setsubun-mamemaki` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/setsubun-mamemaki/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 千岁赠糖 `shichigosan-chitose-ame` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/shichigosan-chitose-ame/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 庭前一礼 `shinto-torii` | 可见 | 相对正常：点按、滑动、倾斜与按钮路径；无拖动距离上限。 |
| 庭前一铃 `shrine-suzu-bell` | 可见 | 相对正常：下拉≥45px且允许斜拉，后续点按。 |
| 彩车迎晴 `sicilian-painted-cart` | 隐藏 | E：轮毂约20×19px、车轴约17×19px、扶手约35×8px。 |
| 火边花环 `slavic-wreath` | 可见 | 相对正常：点按编织、下拖放水、可选留言；有辅助路径。 |
| 铁线栖鸟 `slovak-wire-bird` | 隐藏 | 相对正常：本体可抓，肩部接点较细；可补物件接触判定。 |
| 彩蛋寄春 `sorbian-painted-egg` | 可见 | E：提示杯沿，实际只认杯前约32×14px小椭球。 |
| 木壳轻拍 `spanish-castanets` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/spanish-castanets/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次下／下／下。 |
| 草编迎春 `st-brigids-cross` | 可见 | 相对正常：四束逐次编入；失败保留已编束数，未满一阶段退出不保存。 |
| 门楣祝家 `sternsinger-house-blessing` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/sternsinger-house-blessing/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 三石寄愿 `sumiyoshi-godairiki` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/sumiyoshi-godairiki/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次右／右／右。 |
| 玉串奉愿 `tamagushi-offering` | 可见 | A：窄拖动窗口；[判定第71行](../../packages/scenes/src/tamagushi-offering/scene.ts#L71)。取消最大距离，允许合理纠正。 |
| 短册系竹 `tanzaku-tanabata` | 可见 | 相对正常：纸条抓取有外扩，竹枝目标可达。 |
| 浇水敬老 `thai-songkran-elders` | 可见 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/thai-songkran-elders/scene.ts#L69)。取消最大距离，允许合理纠正。 |
| 花水位一倾 `theravada-water` | 隐藏 | 相对正常：倾注无距离上限，花瓣落水面较宽。 |
| 白绢迎客 `tibetan-khata-greeting` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/tibetan-khata-greeting/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 经幡迎风 `tibetan-prayer-flags` | 可见 | A：窄拖动窗口；[判定第70行](../../packages/scenes/src/tibetan-prayer-flags/scene.ts#L70)。取消最大距离，允许合理纠正。 |
| 清水七供 `tibetan-water-bowls` | 可见 | A：窄拖动窗口；[判定第65行](../../packages/scenes/src/tibetan-water-bowls/scene.ts#L65)。取消最大距离，允许合理纠正。 |
| 廊前轻转 `tibetan-wheel` | 可见 | 相对正常：可反复旋转或点按，反向有反馈，有停止和结束路径。 |
| 浮彩成笺 `turkish-ebru-paper` | 隐藏 | 相对正常：纸面可揭，完整伸展后继续拖仍可完成。 |
| 龟岩投愿 `udo-undama` | 可见 | A：窄拖动窗口；[判定第71行](../../packages/scenes/src/udo-undama/scene.ts#L71)。取消最大距离，允许合理纠正。 B：第2步箭头错误；正确方向依次上／右／上。 |
| 陶轮慢成 `uzbek-clay-bowl` | 隐藏 | 相对正常：转轮、提壁容差随距离扩大，完成形态可继续拖。 |
| 折扇轻风 `valencian-folding-fan` | 隐藏 | A：窄拖动窗口；[判定第68行](../../packages/scenes/src/valencian-folding-fan/scene.ts#L68)。取消最大距离，允许合理纠正。 B：第1、2、3步箭头错误；正确方向依次右／左／左。 |
| 玻珠凝彩 `venetian-glass-bead` | 隐藏 | 相对正常：玻珠本体可抓，使用宽容方向判定。 |
| 竹蜓点风 `vietnamese-bamboo-dragonfly` | 隐藏 | 相对正常：上送后可拨翼或身体，主动结束。 |
| 留一盏烛光 `votive-candle-catholic` | 可见 | 相对正常：灯芯有较宽代理，静看可按钮或留言完成。 |
| 纸鸢乘风 `weifang-paper-kite` | 隐藏 | 相对正常：纸翼、线轮整体可抓，允许长拖与修正。 |
| 悬锤纺线 `welsh-drop-spindle` | 隐藏 | A：窄拖动窗口；[判定第69行](../../packages/scenes/src/welsh-drop-spindle/scene.ts#L69)。取消最大距离，允许合理纠正。 B：第1、2步箭头错误；正确方向依次右／下／上。 |
| 木勺寄情 `welsh-love-spoon` | 可见 | D：勺底已经落稳展托，手指未落展托时仍失败。 |
| 燃灯上浮 `yeondeunghoe` | 可见 | 相对正常：点按或竖拖启动，升起后点灯或按钮结束。 |
| 泉水净币 `zeniarai-coin-washing` | 可见 | A：窄拖动窗口；[判定第77行](../../packages/scenes/src/zeniarai-coin-washing/scene.ts#L77)。取消最大距离，允许合理纠正。 B：第2、3步箭头错误；正确方向依次上／左／右。 |
| 木鱼 `woodfish` | 可见 | 相对正常：原生按钮可点、长按后松手仍可敲；移动超过8px不算敲击是明确的防拖动规则，是否对手抖过严需真机体验验证，未认定为本轮确定性缺陷。 |
