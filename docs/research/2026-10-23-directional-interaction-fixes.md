# 方向场景输入容错修复

日期：2026-10-23。本记录是[全场景修复记录](2026-10-23-scene-interaction-fixes.md)的 A/B 技术分项，问题依据见[操作审计](2026-10-23-scene-interaction-audit.md)。

## 范围与行为

- 53个旧方向场景取消40–84px固定窗口与90px路径预算，复用共享 completesDirectionalDrag。60、85、120、180px正确方向拖动、10–20px纠正和合理斜拖可完成；明显反向、返回起点、取消、多指及非有限输入不推进。
- 每场景的 directions 同时驱动真实操作箭头与 directionalAxes，避免箭头和释放判定分叉。投影轴按方向向量长度归一化，阈值保持CSS像素含义。
- 提示使用与释放相同的成功谓词；当前输入已合格时显示“动作已到位，可以松手。”并设置 hint 的 data-ready=true，撤回或取消时清除。仍只在释放后开始原有动画，动画落定后提交检查点。
- 保留所有模型、材质、动作预览幅度、动画、次数与顺序；对原来只预览4%或8%的动作，以明确松手信号消除继续加大行程的猜测。
- 共享规则允许至少24px或按行程比例计算的小纠正和横向余量，完成姿态仍在合理方向时允许早先小幅摇摆；有限数、真实移动、起点命中、取消和指针归属保护保留。最低距离比较加入浮点误差容限，避免准确40px因坐标相减成为40−ε而拒绝。
- 53个README新增技术说明，18个共享消费者README补充容差变更，同时直接修正旧现行的过长拒绝说明；既有毛线、纸鸢、贝链等README旧窗口、路径和回撤阈值一并更新，未把冲突段落保留作当前规则。

## 持久回归与红绿证据

新文件 packages/scenes/src/directional-tolerance-scenes.test.ts 保留真实Three几何、相机、射线、交互提示与输入控制器，仅替换GPU。53个场景全部三步在320/390 CSS px画布上验证60/85/120/180px、最终退10/20px、30px横向的合理斜拖、轻微曲折，以及反向、纯横轴、回起点、取消、多指、仅释放、NaN及稀疏pointerup。方向预期为独立字面夹具，同时检查data-ready与松手提示。

- RED：新增106个跨场景测试和20px纠正单测共107项按预期失败；旧箭头缺失、没有到位反馈、宽容动作被拒绝均能触发失败。
- GREEN：新53场跨场景106/106通过；方向工具单测第一轮5/5通过。第一轮新回归还捕获9个40−ε纠正边界，补浮点容限后全绿。
- 归一化的独立RED/GREEN：[-1,-1]方向上的[-30,-30]输入原投影错误给60px，修复后给42.426406871px，单测已观察先红后绿。
- 已有模块验收修正：把3倍同方向、18px纠正、轻微zigzag由“应失败”改为明确成功；拒绝例子改为真正退回起点/不足阈值、纯横轴或明显反向，不直接删掉断言。
- 7个重点模块完整专项共425/425通过；既有共享消费者拒绝路径筛查17文件200测试通过，葫芦另外4个纠正/明显撤回测试修正过时夹具后通过。
- 已有19场方向跨场景回归保留，另加70px到50px的20px纠正用例，本轮最后一次运行56项通过、鲤旗一项因默认5秒预算超时；只延长该参数化几何测试预算至30秒后，鲤旗全部3项专项重跑通过（其余54项跳过）。已有19场全部行为回归已各自取得绿色结果，整合任务仍统一全量验收。

本分项未把模拟GPU测试称为真机验证。全仓测试和生产构建由主任务统一执行，避免其他分项仍在编辑时重复占用资源。

## 来源与文化影响

已读并遵守 docs/scene-provenance.md。本次改变的是产品输入容错、方向箭头与技术完成提示，不新增传统动作、器形、寓意、资格、节期、顺序、次数或来源主张；不把新容差和辅助机制写成传统要求。文化关联沿用各README现有逐项研究及2026-10-19来源审阅，未声称重新阅读外部来源正文。宿主目录、注册表、模块metadata、原生标题、技术ID和存档保持原值；源卡产品说明由整合任务统一同步。

## 53场方向清单

| 场景 | 三步屏幕方向 |
| --- | --- |
| balinese-canang-sari | 右 → 上 → 左 |
| bonfim-ribbon | 右 → 左 → 右 |
| bulgarian-survakane | 上 → 右 → 上 |
| chinese-rattle-drum | 右 → 左 → 下 |
| chinese-steelyard | 右 → 上 → 下 |
| chinese-tangram | 左 → 上 → 右 |
| chinowa-kuguri | 左 → 右 → 左 |
| czech-wooden-ratchet | 右 → 左 → 上 |
| english-hearth-bellows | 上 → 下 → 上 |
| estonian-village-swing | 上 → 下 → 上 |
| fgs-buddha-bathing | 上 → 上 → 上 |
| finnish-kantele | 上 → 下 → 上 |
| french-coffee-mill | 左 → 右 → 下 |
| french-petanque | 上 → 上 → 上 |
| garden-croquet | 左 → 右 → 右 |
| german-jumping-jack | 下 → 下 → 下 |
| ghanaian-oware | 上 → 右 → 左 |
| greek-new-year-pomegranate | 上 → 右 → 下 |
| greek-vasilopita | 上 → 右 → 下 |
| hiiragi-iwashi | 上 → 左 → 上 |
| irish-bodhran | 下 → 上 → 右 |
| japanese-daruma-otoshi | 下 → 右 → 上 |
| japanese-shishi-odoshi | 左 → 下 → 下 |
| japanese-wagasa | 上 → 右 → 下 |
| kagami-biraki-sake | 上 → 下 → 左 |
| kagami-mochi-offering | 上 → 上 → 上 |
| kameido-usokae | 上 → 左 → 下 |
| lam-tsuen-wishing-tree | 右 → 右 → 上 |
| mexican-metate | 下 → 上 → 上 |
| mexican-tortilla-press | 下 → 下 → 上 |
| mochigase-nagashibina | 上 → 右 → 下 |
| mongolian-ovoo | 左 → 左 → 左 |
| paper-pinwheel | 右 → 上 → 右 |
| persian-esfand | 上 → 右 → 下 |
| polish-oplatek-sharing | 上 → 右 → 上 |
| puerto-rican-guiro | 下 → 上 → 右 |
| romanian-martisor | 上 → 右 → 下 |
| rosh-hashanah-apple-honey | 右 → 下 → 左 |
| scottish-plunge-churn | 下 → 上 → 上 |
| setsubun-mamemaki | 右 → 上 → 下 |
| shichigosan-chitose-ame | 上 → 右 → 下 |
| spanish-castanets | 下 → 下 → 下 |
| sternsinger-house-blessing | 上 → 右 → 下 |
| sumiyoshi-godairiki | 右 → 右 → 右 |
| tamagushi-offering | 右 → 右 → 上 |
| thai-songkran-elders | 上 → 右 → 下 |
| tibetan-khata-greeting | 上 → 右 → 右 |
| tibetan-prayer-flags | 上 → 右 → 上 |
| tibetan-water-bowls | 上 → 右 → 下 |
| udo-undama | 上 → 右 → 上 |
| valencian-folding-fan | 右 → 左 → 左 |
| welsh-drop-spindle | 右 → 下 → 上 |
| zeniarai-coin-washing | 上 → 左 → 右 |

## 交叉复核后的起手纠正补充

复核指出共享规则仍保留起手反向8px的旧预算，9–20px找准握点再正拖仍会永久失败。已新增先反向20px再正向40/60/120px的独立单测，以及53场全三步双宽度的真实几何路径夹具。单测和七巧真实几何先红（2项），随后两条接受分支都把轻微反向起步预算放宽到24px，专项3/3通过；其中包含真实反向、回起点、取消、多指仍拒绝的检查。该最后补充之后的全量53场由整合任务统一复跑，未把补充前106绿当作补充后的全量结果。

## 本分项边界

未修改样式CSS、共享procedural-kit/object-pointer/placement-hit、轨迹五场或放置五场。既有19场实现未重写，仅随共享规则修正过时的测试拒绝夹具及README。部分53场仍展示较小动作预览，但到位提示和宽容释放条件已覆盖，不以扩大传统动作幅度替代输入修复。

## 整合验收

最后补充的起手纠正已随完整场景套件在同一次最终运行中通过：198文件7257项，无未处理错误。其余工作区、生产构建、真实浏览器输入与额外类型检查边界见[统一操作修正记录](2026-10-23-scene-interaction-fixes.md)。
