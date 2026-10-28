# 连续拿放与可选查看：全量审查与交付记录

日期：2026-10-28。用户要求逐一检查像「蓝珠祈安」一样，把同一件物品的提起、平移、落稳硬拆成数次操作的场景，让用户可以拿住自由移动、可选转看，再连续放好。查看不算完成，也不要求转满一圈。

本轮按实际源码覆盖注册表 **153** 个模块，并补入由宿主实现的「敲一敲木鱼」，共 **154** 个入口。检查的是场景动作、对象、阶段分支和完成条件；pose 场景进一步核对 roots／targets／anchors、完整物件与局部联动。没有仅凭标题、「三步」总数或同一个 root 判断可合并，也没有用代码证明文化传统。

[逐项机器清单](../../artifacts/continuous-placement-2026-10-28/scene-audit.json)保存每个 ID、标题、分类、理由、源码路径和详细审阅入口；[注册表快照](../../artifacts/continuous-placement-2026-10-28/registry-inventory.json)是清单基数。以下表格与机器清单均为154条、无重复。

## 覆盖与结论

| 分类 | 数量 | 判断标准 |
| --- | ---: | --- |
| 本轮修改 | 28 | 同物搬运停点合并，或把纯展示的强制转角改成可选查看 |
| 已连续拿放 | 28 | 搬运本来只有一次，前后为制作、组装、明确选择、文字提交或静看 |
| 真实不同动作 | 50 | 实际呈现的接触、浇水、蘸蜜、投掷、书写、交换、组装或不同物件，不合并其内容 |
| 机构或作法约束 | 42 | 铰链、绳长、线圈、转轴、轨道、磨面或已有核查的具体作法方向，不任意刚体化 |
| 不属于拿放 | 6 | 持续演奏、敲击、走近鞠躬、已悬铃或一次上移后静看，没有同物分段拿挂 |

「真实不同动作」指本应用确实呈现了独立内容，不表示本应用的所有阶段都属于传统要求。分类互斥；例如制作后一次挂放归「已连续拿放」，不表示制作步骤应删除。没有改动的126场也逐项记录原因，不能以全量扫描之名把它们全改成装饰品拿放。

详细模型与边界见[A组](2026-10-28-continuous-placement-audit-a.md)、[B组](2026-10-28-continuous-placement-audit-b.md)、[C组](2026-10-28-continuous-placement-audit-c.md)。A组补做陶玉与纸伞两项：陶玉准备搬运与真实投掷分开；纸伞展开后的固定查看角度不再是前置要求。

## 当前交互与保存

蓝珠等完整刚体采用单指／鼠标主拖连续拿放；同一物件上的双指、Shift + 主拖或右键拖动可以转看。两指回到单指会重建抓取平面与偏移，避免跳动；第三指、无关第二指、取消、失焦与停用处理输入归属。旋看本身不触发落区验收，不增加路程或保存进度；右键和纯查看释放保留姿态。普通画布内离手未到位可停留，再次拿起继续；画布外释放、取消、失焦、暂停与尺寸变化恢复旧检查点完整变换。已接受的短程归正落定在暂停时冻结。

开放查看的场景复用原辅助按钮：方向键查看、Enter 执行对应的实际动作、Escape 放回。不会新增必须进入的查看模式。辅助动作从当前实际变换起步，不先回跳旧中间姿态。供盘花色方位、杆秤梁盘关系、经幡绳端和固定支承机构依各场约束处理；没有为了复用提示而开放任意翻转。

实际App检查发现既有短操作提示会在视觉上替换长提示，因此将可选旋看说明同时放入短提示所在的底部区域，随当前阶段与语言更新；只在支持旋看的阶段显示。它不覆盖画布、不新增按钮，区域高度沿既有测量机制调整。`interaction-cues.test.ts` 新回归先RED、修复后13／13通过，见 `artifacts/continuous-inspection-guide-{red,green}.log`。

各技术 ID、引擎版本和旧存档整数保持。纯搬运的旧0／1／2入口静默恢复原位置后可一次完成3，旧3保持完成；部分合并场景仍只在真正独立内容处保存，例如准备到2后再拍背、投果、投玉、交接或倾水到3，旧鸟返纳到1后新鸟搬放到3。经幡新路径为0→1→3，旧2仍可恢复后挂到右高点。中间兼容整数不再被界面画成必须逐段完成的路程；不重放旧进度回调、音效或完成事件。

## 重点场景与实际对象

**蓝珠祈安。** 同一完整蓝珠与金属环自由拿取、可选查看后送到最终木架横轴，短程归正、落环悬稳。玻璃珠表面透射仍可被实际网格拾取，不以通透外观当作不存在的物件。护眼珠的避厄护佑语境保留，器形、材质身份、来源与最终悬挂接触不由自由查看重定义。

蓝珠专项核对了 `nazar-charm`、挂环与横轴的真实几何：自由姿态只用于查看，接近最终挂点后以短程动画恢复挂环与横轴的接触关系；旧0／1／2入口均直接保存3。`continuous.test.ts`覆盖连续完成、画布内停放重抓、双指查看不推进、取消与单次辅助完成。浏览器另测完整一圈的鼠标／双指查看和最终接触，数值与截图记入[浏览器报告](../../artifacts/continuous-placement-2026-10-28/report.json)。本轮仅读取既有[源卡](../../content/traditions/turkish-nazar-bead.md)及本地核查记录，没有新增外部正文读取声明。

**经幡迎风。** 自由拿的是两个实际绳端，不把整串刚体旋转。取消右端的临时低支点强制停靠，两端分别移到各自真实高挂点；固定绳长2.5、绳索下垂、五片布面和风动随当前端点重算，布面保持离地。五色咒语旗、众生祈愿与敬重语境保留；长度、挂点与辅助支架均是产品几何安排。

经幡专项把实际绳端作为控制点，按当前端距重建绳索与布面；端距受总绳长约束，低点不足时抬高自由端，避免用拉长绳索或让布片穿地来满足指针。`model.test.ts`包含极端端点采样的绳长与离地检查，`scene.test.ts`覆盖离开旧屏幕轨道的移动、左右真实挂点、旧1／2入口直达右挂点和取消恢复。完成只报告0→1→3；旧2仍可继续。读取边界沿用[源卡](../../content/traditions/tibetan-prayer-flags.md)既有记录，没有把本产品2.5单位绳长、夹具和临时支承写成传统规则。

**珠星与纸伞。** 珠星仍须接上最后珠串；组装后可以直接静看，也可以围绕竖直挂环自由yaw查看整圈，不要求转到固定角或转满一圈，避免pitch使挂环脱钩。纸伞的推环展骨、撑杆和纸面折褶、沿轴收拢保留；展开后的查看不再要求固定π/4角度。这里改变的是产品查看验收，不把接珠与伞骨机构取消。

**煤火迎年。** 同一煤礼从旧0／1／2都可一次连续送入主人炉火，但必须实际穿过敞开门洞、由炉膛正面进入。煤块完整边界与沿途扫掠检查门柱、门槛、炉壁；检查全部旋转中间姿态，不能因为整圈最后四元数相同就漏过中途碰撞。水平搬运和yaw查看保留平底，辅助路径从实际停放处搜索净空路线。首屏仍是午夜后首位来客送给主人家煤礼与祝愿，不是为自己捡煤取暖。具体采样界限与非物理仿真边界见C组。

**局部联动。** 纸雏草托、纸雏、桃枝与点心整体搬运，完成先触水后短漂行；宋干敬老水碗保持水平水面并保留倾水、实际接水与回碗；白绢随赠者双手到接触范围，随后保留接收与撤手；糕铲与糕片虽为兄弟节点，也按同一刚体变换搬运，先落糕再抽铲，最后取币仍独立；彩枝、石榴、陶玉不以普通搬放替代真实拍背、碰槛破果或松手投掷。

**油灯与机构边界。** 已实际阅读本地 diya scene 与[源卡](../../content/traditions/diya-oil-lamp.md)：点芯、沿圆弧旋灯、一次归盘是不同内容；旋灯关联所引寺庙献光、祈祷与观看神像的公开说明，不能降格为仅装饰转看。本场无神像、三灯数量和单灯轨道仍是产品简化，不能声称完成完整aarati或puja。本轮没有重新读取远程正文。纸风车拨翼、一次提柄、续转停稳不属于三段搬运；咖啡磨转柄磨粉后拉屉受转轴和轨道约束；算盘沿杆拨珠、纺线、磨石、鼓与响板等也保留实际机构。其方向、次数是否属于传统，仍以各自来源卡的有限证据为准，不从本清单推导。

## 审阅发现与修复

| 审阅问题 | 本轮修正与验证范围 |
| --- | --- |
| 低处原点的物件pitch后穿进支承面 | 共享旋看改绕实际几何中心，补偿世界位置；同次查看保持固定中心／支承基线，不以每一帧新低点反复抬升 |
| 反复查看后上漂或下漂，平移后支承基线失配 | 旋看保存连续pivot／floor；平移的世界delta同步基线，真实模型多圈查看检查漂移与净空 |
| 普通离手后无指针owner，pause／blur／resize未恢复完整姿态 | 旧检查点保存完整子树位置、四元数与scale，显式恢复；不是只重设部分y值 |
| 画布外松手仍停留自由物件 | 未接受的画布外释放恢复检查点；普通画布内离手才保留停放 |
| 同手势尾事件或宿主回调重入推动下一步 | 已接受后消费整手势尾巴，回调期间锁输入；失焦、取消、暂停与dispose边界回归 |
| 煤块整圈最终姿态相同而遗漏中途碰柱 | yaw按小段检查扫掠，碰撞回退；模型原303姿态几何检查保留 |

上述共享修复的新专项回归 **136/136** 通过，其中含真实模型多圈旋看净空／漂移／恢复与120条场景恢复回归；这些用例也已被最终全仓测试覆盖。实际浏览器和设备范围分别见下方，不把jsdom GPU替身测试称为真实WebGL或真机。

合并前补查发现两类画布外释放仍会保留未提交姿态：纯旋看结束，以及经幡绳端搬运。共享指针使用实际画布边界，在采样画布外的纯旋看／双指查看终点前取消，双指剩余尾事件继续保持归属；普通搬运和实质动作仍交由各场原有 `onRelease` 验收，不能拦截挥巾、白绢交接等独立动作的有效长拖释放。经幡另显式恢复画布外松手，并将首次离开木钉的前移限制为每个检查点一次，避免已停放绳端反复拿取时逐次向前漂移。画布内停放、最初退钉、完成回调与旧存档保持原义；没有新增文化主张。

最初8条新增回归先失败，局部3文件曾 **219/219** 通过；该结果没有覆盖后续整仓发现的独立动作回归。原生捕获释放后的 `lostpointercapture` 也先复现仍按下首指被提前清除，再修正为仅真实结束事件清除。最终将共享边界判断收窄至旋看结束，新增普通画布外释放仍交给场景的回归先失败，再通过；捷克珠星整圈查看改以画布内6次120px拖动证明超过一圈、挂环不移且不推进。共享指针、珠星、Esfand及集中方向容错4文件 **250/250** 通过，场景 TypeScript 检查通过；全仓最终复验由合并流程统一执行。

## 来源、文档与核查边界

已遵守[场景来源与文化关联核查规范](../scene-provenance.md)。各owner同步修改场景README、来源卡的产品呈现与本地研究记录，明确自由查看、路线合并、容差、采样、辅助按钮和保存节点属于产品。文化事实、真实宗教／祈愿／节期／家庭语境、来源slug与既有访问记录保留；没有新增传统圈数、方向、资格、起源、功效或期限。外部链接只作既有记录入口，不登记为本轮重新读到正文。

技术测试证明输入、几何、局部联动与字段一致；它们不能证明传统。28个修改项既有来源身份和技术ID保持，没有因合并控制擅自改分类；未涉及的宿主目录、注册表、metadata、介绍与原生标题保持原对应关系。Udo／Wagasa新增提示已同步叙述和八语翻译。字面仍为三段的历史产品记录明确为历史，当前机制以2026-10-28更新为准。

## 最终集成验证

- 全仓库`npm test`退出0：357个Vitest文件、11,588项测试全部通过，另20项Node脚本测试通过；场景包279个文件、9,894项全部通过。包含新控制、旧存档、射线遮挡、局部联动、全圈支承／漂移、取消／失焦／暂停／尺寸变化、回调重入与资源释放。日志：`artifacts/continuous-placement-final-test.log`。首次并行开发期间的旧断言失败保留在早期日志，最终已按真实动作与新检查点精确更新并重跑，没有把失败用例跳过。
- 场景TypeScript检查通过；`npm run build`退出0，包含八语提取、ICU／参数／段落与生成物核验、i18n类型检查、宿主`tsc -b`与Vite生产构建。日志：`artifacts/continuous-placement-final-build.log`。保留既有大chunk提示，没有为通过检查调高阈值。
- 移动端本地验证：主机以`EXPO_OFFLINE=1 npm run mobile:verify`退出0，类型检查、8项桥接／嵌入测试、Android／iOS离线打包及14项离线资源哈希、465项iOS组件封面检查通过；日志：`artifacts/continuous-placement-mobile-final-verify.log`。离线模式的依赖版本检查有官方警告，因此不据此宣称远程最新版本已验证。最初沙箱内回环请求被EACCES拦截的日志保留；没有修改应用以绕开测试，也未上传或安装应用。
- 浏览器：Chromium 151、Three r170、SwiftShader真实WebGL，最终28场×旧0／1／2入口共84项均按各自真实节点报告进度并且只完成一次；非空像素、GL程序与页面错误检查通过，最终相关轮次GL／页面错误均为0。蓝珠另做鼠标与CDP双指完整一圈查看、放手重抓与最终挂环接触；其余依实际约束验证查看／搬运，供盘和杆秤不要求旋转。证据按`scene ID + old checkpoint`取最后一轮，保留历史失败与源码hash，见[浏览器报告](../../artifacts/continuous-placement-2026-10-28/report.json)及同目录截图。
- 实际App中文390×844验证了可见旋看帮助与拿放后悬稳；英文320×568帮助在画布下方、可完整滚动查看，画布外侧真实CDP触摸使内容scrollTop 0→141→0，辅助按钮46.8×44，页面／body均无横向溢出。触控模拟中wheel不滚动的初始断言已用真实触摸方法复核，不据此改生产。截图：`attempt-9-app-blue-{inspection,hung}.png`、`attempt-11-app-english-320-{help,action}.png`。这是桌面浏览器触摸模拟与本地WebGL证据，未宣称iPhone／Android真机触感、帧率或Safari兼容实测。
- 新增Udo／Wagasa：2场scene／model共175／175，宿主生命周期109／109；集中方向／机构测试208／208；可见帮助接入后2场175项复测通过。日志：`artifacts/continuous-placement-udo-wagasa-after-help.log`、`artifacts/continuous-placement-central-current.log`、`artifacts/continuous-placement-hourly-lifecycle.log`。
- 独立只读审阅覆盖共享控制、恢复接线、煤块扫掠、新增2场与可视帮助增量，未发现新的可复现生产缺陷。独立运行37／37专项通过；日志：`artifacts/continuous-placement-final-review.log`。审阅不替代浏览器与真机检查。
- 最终八语各2969条目录消息、缺失0，i18n运行时22项和脚本20项测试通过；详细范围与生成证据见[i18n记录](2026-10-28-continuous-placement-i18n.md)。
- A／B／C定向TDD、真实Three几何／射线与生命周期证据分别见对应记录；不与本轮shader／光学材质任务重复计算或混为本次拿放验证。

### 合并前固定源码复验

2026-10-28 17:25:32（北京时间）固定上述边界修复及测试路径后，重新执行根 `npm.cmd test`，退出0：357个Vitest文件共11,597项通过，另20项Node脚本测试通过，总计11,617项、零失败。场景包279文件、9,903项通过，包含画布外旋看、经幡重复拿取、原生捕获丢失及普通实质动作释放的回归；没有跳过用例或放宽断言。日志：`artifacts/batch-final-test.log`。此前过宽的共享边界检查造成13项失败的记录保留在 `artifacts/batch-before-inspection-scope-fix.log`，不能当作最终结果。

同一固定源码的根 `npm.cmd run build` 与 `npm.cmd run mobile:verify` 均退出0，包含八语核验、TypeScript、Vite、Expo依赖检查、8项桥接／构建脚本测试、Android／iOS离线打包、14项离线资源哈希及465项iOS组件封面校验。日志：`artifacts/batch-final-build.log`、`artifacts/batch-final-mobile.log`。保留既有Vite大chunk提示；未进行商店提交或真机性能认证。

## 来源规范交付核对

- [x] 已逐项对照实际器物、材料、动作、对象、场合与完成条件；产品查看与连续输入未反向当作传统证据。
- [x] 本轮没有新增文化主张；控制变化已明确记录为产品呈现，并引用各场已有核查记录，没有新增远程正文已读状态。
- [x] 既有专卡与来源分类保持，未新增地域／民族／视觉相似的错误关联。
- [x] 宗教、民俗、护佑与祈愿语境保留；未把传统改说成纯装饰或自省，也未增加圈数、资格、期限或功效。
- [x] 28场README、源卡产品段、本地研究与8语叙述／提示已同步，旧实现文字按历史记录保留。
- [x] 宿主目录、注册、metadata及技术ID／引擎／存档兼容未因输入变化调整；本轮没有标题或来源身份变化需要改原生标题。
- [x] 当前提示、状态、完成语与新操作对应；供盘与杆秤没有错误承诺自由旋转。
- [x] 技术检查与人工来源边界分别报告；测试通过不作文化事实证明。

## 全部154项逐场结论

每个ID直接链接实际交互源码；机器清单另列model等相关路径。详细入口“A/B/C”引用相应模型与来源边界，集中补查的其他模块标“本表”。

| 场景ID（源码） | 标题 | 分类 | 实际动作／完成条件与处理理由 | 详细记录 |
| --- | --- | --- | --- | --- |
| [malawi-sansi](../../packages/scenes/src/malawi-sansi/scene.ts) | 铁舌轻鸣 | 不属于拿放 | 可持续点拨任意铁舌并主动结束；无物件搬运或挂点。 | 本表 |
| [japanese-kendama](../../packages/scenes/src/japanese-kendama/scene.ts) | 剑玉轻接 | 机构或作法约束 | 大皿接球、小皿换接、孔尖对合各是不同接球动作，球与绳联动。 | 本表 |
| [japanese-koinobori](../../packages/scenes/src/japanese-koinobori/scene.ts) | 鲤旗迎风 | 机构或作法约束 | 展尾、牵绳升鲤、绳坠挂座；绳长与鲤鱼反向运动有实际机构。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [russian-matryoshka](../../packages/scenes/src/russian-matryoshka/scene.ts) | 套娃相藏 | 真实不同动作 | 开外壳、纳入小娃、合外壳是不同装配动作，非同物提移落。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [korean-yutnori](../../packages/scenes/src/korean-yutnori/scene.ts) | 木柶行棋 | 真实不同动作 | 合柶、投掷、按掷数移棋；保留投掷与动态棋格目标。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [chinese-diabolo](../../packages/scenes/src/chinese-diabolo/scene.ts) | 空竹轻扬 | 机构或作法约束 | 提杆起转、展绳抛接、收杆停转；绳与轮的抛接不能变为摆放。 | 本表 |
| [chinese-tangram](../../packages/scenes/src/chinese-tangram/scene.ts) | 七巧归方 | 真实不同动作 | 三片不同形状的拼片各自一次入位，保持角度与拼图关系。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [chinese-rattle-drum](../../packages/scenes/src/chinese-rattle-drum/scene.ts) | 拨浪轻响 | 机构或作法约束 | 转柄带珠击鼓、反向回转、回正；可继续演奏并主动结束，非搬运。 | 本表 |
| [ghanaian-oware](../../packages/scenes/src/ghanaian-oware/scene.ts) | 木窝播籽 | 机构或作法约束 | 取四籽后逐窝分播，种子数量和落窝有真实状态变化。 | 本表 |
| [mexican-tortilla-press](../../packages/scenes/src/mexican-tortilla-press/scene.ts) | 木压成圆 | 机构或作法约束 | 合板、压柄展面团、松柄开盖；铰链与面团变形约束保留。 | 本表 |
| [nanakusa-gayu](../../packages/scenes/src/nanakusa-gayu/scene.ts) | 七草祈安 | 真实不同动作 | 入锅轻拌、舀粥移碗、倾勺归托；搅拌与粥量转移有实际内容。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [brat-bride-cloth](../../packages/scenes/src/brat-bride-cloth/scene.ts) | 窗布祈护 | 本轮修改 | 同布提起与移行合并为连续铺到户外窗台；旧0/1/2直接完成3。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [korean-sotdae](../../packages/scenes/src/korean-sotdae/scene.ts) | 鸟竿祈安 | 本轮修改 | 同鸟竿自由拿取查看，最终扶正竿脚入孔；不穿土座。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [japanese-kadomatsu](../../packages/scenes/src/japanese-kadomatsu/scene.ts) | 门松迎岁 | 本轮修改 | 同右门松自由拿取查看并放门边，固定左门松保留。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [pucara-rooftop-bulls](../../packages/scenes/src/pucara-rooftop-bulls/scene.ts) | 陶牛护家 | 本轮修改 | 两牛与承板整体连续送屋脊承台，最终接触与归正保留。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [chinese-longevity-lock](../../packages/scenes/src/chinese-longevity-lock/scene.ts) | 银锁寄安 | 本轮修改 | 锁、绳与坠随承板整体连续放入礼匣，不再分三段搬运。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [uchide-wishing-mallet](../../packages/scenes/src/uchide-wishing-mallet/scene.ts) | 振槌寄愿 | 真实不同动作 | 拿起、实际摇动、归托；所选摇槌内容不能用自由查看替代。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [alasita-miniature-house](../../packages/scenes/src/alasita-miniature-house/scene.ts) | 微屋寄愿 | 本轮修改 | 取消同屋搬运中的固定60度转看停点，一次自由查看后放垫。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [yusheng-lohei](../../packages/scenes/src/yusheng-lohei/scene.ts) | 鱼生捞起 | 真实不同动作 | 探筷、多人捞起、食材落回并拌合，是不同的共食动作。 | 本表 |
| [kitano-nadeushi](../../packages/scenes/src/kitano-nadeushi/scene.ts) | 抚牛寄愿 | 真实不同动作 | 手靠近、抚牛额、收手；牛保持原位，不拿牛旋看。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [lao-baci-wrist](../../packages/scenes/src/lao-baci-wrist/scene.ts) | 白线祝归 | 机构或作法约束 | 拿线、绕腕、收结涉及线形变化与腕部净空，非刚体搬放。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [finnish-virpominen](../../packages/scenes/src/finnish-virpominen/scene.ts) | 柳枝祝春 | 真实不同动作 | 挥枝祝福、递枝、收蛋涉及不同物件和交换内容。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [scottish-first-footing](../../packages/scenes/src/scottish-first-footing/scene.ts) | 煤火迎年 | 本轮修改 | 同煤连续穿实际敞门再从炉口入内；整件与扫掠碰撞约束，最终一次3。 | [B](2026-10-28-continuous-placement-audit-b.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [hiiragi-iwashi](../../packages/scenes/src/hiiragi-iwashi/scene.ts) | 柊鰯守门 | 真实不同动作 | 拿枝、插合鱼头、整件安门边；真实组装与最终安放各保留。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [tamagushi-offering](../../packages/scenes/src/tamagushi-offering/scene.ts) | 玉串奉愿 | 机构或作法约束 | 两段有来源核查的持奉转向与换手保留，末段供案安放不替代方向。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [tibetan-water-bowls](../../packages/scenes/src/tibetan-water-bowls/scene.ts) | 清水七供 | 真实不同动作 | 提壶、逐碗实际添水、归壶；七碗水量与0–9存档保留。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [kagami-biraki-sake](../../packages/scenes/src/kagami-biraki-sake/scene.ts) | 开樽祝愿 | 真实不同动作 | 取槌、叩盖开启、收槌；叩击和盖片打开不能跳过。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [tibetan-prayer-flags](../../packages/scenes/src/tibetan-prayer-flags/scene.ts) | 经幡迎风 | 本轮修改 | 左右绳端自由移到真实高挂点，取消临时低停点；固定绳长2.5与布面离地。 | 本表 |
| [rosh-hashanah-apple-honey](../../packages/scenes/src/rosh-hashanah-apple-honey/scene.ts) | 蘸蜜迎岁 | 真实不同动作 | 移到蜜上、实际蘸蜜、回盘；不允许跳过蘸蜜直接显蜜层。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [thai-songkran-elders](../../packages/scenes/src/thai-songkran-elders/scene.ts) | 浇水敬老 | 本轮修改 | 捧碗与移近合并到2，水平水面同步；实际倾水、接水和回碗保留到3。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [kameido-usokae](../../packages/scenes/src/kameido-usokae/scene.ts) | 木鷽迎福 | 本轮修改 | 旧鸟返纳仍到1，新鸟接取与安放连续到3；旧新是独立实体。 | [A](2026-10-28-continuous-placement-audit-a.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [persian-esfand](../../packages/scenes/src/persian-esfand/scene.ts) | 熏籽祈安 | 本轮修改 | 提锅和放炉合并到2，后续挥巾与烟的状态变化保留到3。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [mochigase-nagashibina](../../packages/scenes/src/mochigase-nagashibina/scene.ts) | 纸雏祈安 | 本轮修改 | 草托、纸雏、桃枝与点心整体自由拿取；先触水再短漂行，一次3。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [greek-vasilopita](../../packages/scenes/src/greek-vasilopita/scene.ts) | 新岁分糕 | 本轮修改 | 糕片与糕铲刚体同步搬到盘上到2，落盘再抽铲；取币仍独立到3。 | [A](2026-10-28-continuous-placement-audit-a.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [tibetan-khata-greeting](../../packages/scenes/src/tibetan-khata-greeting/scene.ts) | 白绢迎客 | 本轮修改 | 托起和递近合并到2，赠者双手同步；末段接触交接与撤手保留。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [shichigosan-chitose-ame](../../packages/scenes/src/shichigosan-chitose-ame/scene.ts) | 千岁赠糖 | 本轮修改 | 糖袋同物搬运合并到接收范围，末段孩子双手接稳与提手接触保留。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [mongolian-ovoo](../../packages/scenes/src/mongolian-ovoo/scene.ts) | 敖包祈护 | 机构或作法约束 | 来客绕行并每次添不同石，所选三圈实践与绕行方向不按搬运删除。 | 本表 |
| [fgs-buddha-bathing](../../packages/scenes/src/fgs-buddha-bathing/scene.ts) | 浴佛发愿 | 真实不同动作 | 取水、倾水、回杓与实际三愿水流；不是多余同物搬运。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [balinese-canang-sari](../../packages/scenes/src/balinese-canang-sari/scene.ts) | 叶盘献谢 | 本轮修改 | 白花入盘仍到1，整盘连续到3；禁止任意旋盘以保世界东南花色方位。 | [A](2026-10-28-continuous-placement-audit-a.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [bulgarian-survakane](../../packages/scenes/src/bulgarian-survakane/scene.ts) | 彩枝贺年 | 本轮修改 | 彩枝提起与移背合并到2，最后轻拍背部与撤回仍到3。 | [A](2026-10-28-continuous-placement-audit-a.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [lanna-sand-pagoda](../../packages/scenes/src/lanna-sand-pagoda/scene.ts) | 沙塔献幡 | 本轮修改 | 整幡自由拿取查看并插入沙座，取消固定中间搬运点，不穿沙塔。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [chinese-fu-paper](../../packages/scenes/src/chinese-fu-paper/scene.ts) | 贴福迎春 | 本轮修改 | 同张福纸自由查看后一次贴门，最终正向仅为产品选择。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [turkish-nazar-bead](../../packages/scenes/src/turkish-nazar-bead/scene.ts) | 蓝珠祈安 | 本轮修改 | 同蓝珠连续拿取与可选查看后落环悬稳，0/1/2恢复均直接完成3。 | 本表 |
| [japanese-hamaya](../../packages/scenes/src/japanese-hamaya/scene.ts) | 饰矢祈安 | 本轮修改 | 整矢连红绳小铃自由拿放到双托，不把它改成摇铃净化。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [vietnamese-five-fruit-tray](../../packages/scenes/src/vietnamese-five-fruit-tray/scene.ts) | 五果迎春 | 真实不同动作 | 三个独立水果各自放托盘，非同一果分段搬运。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [chinese-ruyi-scepter](../../packages/scenes/src/chinese-ruyi-scepter/scene.ts) | 如意寄愿 | 本轮修改 | 同如意可自由拿取查看后放双托，取消抬离横移下落三个强制停点。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [japanese-kumade](../../packages/scenes/src/japanese-kumade/scene.ts) | 熊手纳福 | 真实不同动作 | 三个不同饰牌各一次贴到熊手，非同物重复停点。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [neapolitan-cornicello](../../packages/scenes/src/neapolitan-cornicello/scene.ts) | 红角赠福 | 真实不同动作 | 红角、卡片、礼盒分别安放，三个物件或装配状态不同。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [spanish-twelve-grapes](../../packages/scenes/src/spanish-twelve-grapes/scene.ts) | 葡萄迎岁 | 真实不同动作 | 三个独立盘组分别安放，十二颗总数保留；非同一盘三段。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [horseshoe-doorway-luck](../../packages/scenes/src/horseshoe-doorway-luck/scene.ts) | 蹄铁护家 | 真实不同动作 | 三件独立蹄铁各挂一处，单件内部已经一次到点。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [setsubun-mamemaki](../../packages/scenes/src/setsubun-mamemaki/scene.ts) | 节分撒豆 | 真实不同动作 | 开门轨、向外撒豆、向内撒豆涉及门机构与两个豆批次。 | 本表 |
| [sternsinger-house-blessing](../../packages/scenes/src/sternsinger-house-blessing/scene.ts) | 门楣祝家 | 真实不同动作 | 取粉笔、实际书写、归槽；书写内容不能用摆放跳过。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [lam-tsuen-wishing-tree](../../packages/scenes/src/lam-tsuen-wishing-tree/scene.ts) | 林村抛愿 | 真实不同动作 | 写愿、系纸橙、向仿真树抛挂；保留塑料橙和抛物语境。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [kagami-mochi-offering](../../packages/scenes/src/kagami-mochi-offering/scene.ts) | 镜饼迎岁 | 真实不同动作 | 大饼、小饼、橙是三个根，各自叠放，高度递增。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [romanian-martisor](../../packages/scenes/src/romanian-martisor/scene.ts) | 红白寄春 | 本轮修改 | 同红白绳环连续自由查看后挂枝，最终由树枝承托。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [sumiyoshi-godairiki](../../packages/scenes/src/sumiyoshi-godairiki/scene.ts) | 三石寄愿 | 真实不同动作 | 五、大、力三颗不同字石分别入袋，单石搬运已经连续。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [polish-oplatek-sharing](../../packages/scenes/src/polish-oplatek-sharing/scene.ts) | 薄饼相祝 | 真实不同动作 | 递薄饼、分角、对方收下，分角和人物接触各有实际内容。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [greek-new-year-pomegranate](../../packages/scenes/src/greek-new-year-pomegranate/scene.ts) | 破榴迎新 | 本轮修改 | 完整果准备搬运合并到2，最后向下撞石槛破壳散籽保留到3。 | [A](2026-10-28-continuous-placement-audit-a.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [bonfim-ribbon](../../packages/scenes/src/bonfim-ribbon/scene.ts) | 栏前结愿 | 机构或作法约束 | 栏上三处不同松结依次收紧，绳形变化，不是搬同一段到挂点。 | 本表 |
| [chinowa-kuguri](../../packages/scenes/src/chinowa-kuguri/scene.ts) | 茅环祈安 | 机构或作法约束 | 来客穿环左、右、左绕行；茅环不搬走，保留既有作法方向。 | 本表 |
| [zeniarai-coin-washing](../../packages/scenes/src/zeniarai-coin-washing/scene.ts) | 泉水净币 | 真实不同动作 | 举勺、倾水洗币、布擦拭有不同内容，不能普通放置完成。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [udo-undama](../../packages/scenes/src/udo-undama/scene.ts) | 龟岩投愿 | 本轮修改 | 陶玉取起与移近准备合并为连续到2；真正松手投向岩凹的抛物线到3保留。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [japanese-daruma-otoshi](../../packages/scenes/src/japanese-daruma-otoshi/scene.ts) | 木槌落片 | 机构或作法约束 | 木槌对齐、击底片、抬离，底片移出和叠片下落是实际机构。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [paper-pinwheel](../../packages/scenes/src/paper-pinwheel/scene.ts) | 纸翼转风 | 机构或作法约束 | 拨翼起转、整柄仅一次上提、续转停稳；轴上纸翼运动非三段拿挂。 | 本表 |
| [chinese-steelyard](../../packages/scenes/src/chinese-steelyard/scene.ts) | 移砣平衡 | 本轮修改 | 移砣找平仍到1，整秤提放连续到3；不随意翻转梁盘，原位返回须真实移离。 | [A](2026-10-28-continuous-placement-audit-a.md)、[C](2026-10-28-continuous-placement-audit-c.md) |
| [garden-croquet](../../packages/scenes/src/garden-croquet/scene.ts) | 草坪过门 | 机构或作法约束 | 木槌蓄势、碰球过门、球继续滚动；不同接触与球体运动。 | 本表 |
| [welsh-drop-spindle](../../packages/scenes/src/welsh-drop-spindle/scene.ts) | 悬锤纺线 | 机构或作法约束 | 旋轮加捻、纺锤下落拉线、提锤停稳，纺线长度联动，不是展示搬运。 | 本表 |
| [scottish-plunge-churn](../../packages/scenes/src/scottish-plunge-churn/scene.ts) | 木杆搅乳 | 机构或作法约束 | 杆沿孔下搅、上提、提盖露桶内，桶盖与搅杆机构不同。 | 本表 |
| [irish-bodhran](../../packages/scenes/src/irish-bodhran/scene.ts) | 鼓面轻拍 | 机构或作法约束 | 槌两端交替触鼓面和回弹，可续拍并结束，非同物搬到挂点。 | 本表 |
| [french-coffee-mill](../../packages/scenes/src/french-coffee-mill/scene.ts) | 手磨晨光 | 机构或作法约束 | 曲柄两半周磨粉后沿轨抽屉；转轴、粉与木轨不作自由刚体搬运。 | 本表 |
| [japanese-wagasa](../../packages/scenes/src/japanese-wagasa/scene.ts) | 纸伞舒晴 | 本轮修改 | 推环展开与收拢机构保留；展开后转看可选，不再必须完成固定π/4转角。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [spanish-castanets](../../packages/scenes/src/spanish-castanets/scene.ts) | 木壳轻拍 | 机构或作法约束 | 两副壳片沿绳轴合拍，接触与回弹为演奏，可继续并主动结束。 | 本表 |
| [japanese-shishi-odoshi](../../packages/scenes/src/japanese-shishi-odoshi/scene.ts) | 竹筒叩石 | 机构或作法约束 | 导水、筒蓄水倾倒、竹尾碰石归位；转轴和水量是实际内容。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [german-jumping-jack](../../packages/scenes/src/german-jumping-jack/scene.ts) | 牵绳木偶 | 机构或作法约束 | 牵珠经绳结联动四肢并回落，不能摘下整偶搬放替代。 | 本表 |
| [finnish-kantele](../../packages/scenes/src/finnish-kantele/scene.ts) | 五弦轻拨 | 机构或作法约束 | 拨不同琴弦使其变形回振，非物件拿放。 | 本表 |
| [estonian-village-swing](../../packages/scenes/src/estonian-village-swing/scene.ts) | 秋千轻荡 | 机构或作法约束 | 悬挂秋千持续荡动，受悬点与绳长约束，不摘下搬移。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [french-petanque](../../packages/scenes/src/french-petanque/scene.ts) | 银球近靶 | 真实不同动作 | 木靶与两枚不同银球分别投掷滚近，非同球三停点。 | 本表 |
| [english-hearth-bellows](../../packages/scenes/src/english-hearth-bellows/scene.ts) | 风囊轻送 | 机构或作法约束 | 开木叶、压皮囊出气、松柄，铰链与皮革形变保留。 | 本表 |
| [mexican-metate](../../packages/scenes/src/mexican-metate/scene.ts) | 石面磨香 | 机构或作法约束 | 石杵沿磨面往复、收回露粉痕；接触磨面与粉化，不是摆放。 | 本表 |
| [czech-wooden-ratchet](../../packages/scenes/src/czech-wooden-ratchet/scene.ts) | 木齿轻转 | 机构或作法约束 | 木框沿握柄轴旋动，木舌随齿面弯回；声响机构非查看搬运。 | 本表 |
| [puerto-rican-guiro](../../packages/scenes/src/puerto-rican-guiro/scene.ts) | 瓜棱轻奏 | 机构或作法约束 | 刮棒沿瓜棱往复产生节拍，可续奏并结束，保留棱面接触。 | 本表 |
| [valencian-folding-fan](../../packages/scenes/src/valencian-folding-fan/scene.ts) | 折扇轻风 | 机构或作法约束 | 展骨、摇扇、收褶是折扇机构和扇动；非同物提移挂停点。 | 本表 |
| [indian-charkha](../../packages/scenes/src/indian-charkha/scene.ts) | 棉线慢成 | 机构或作法约束 | 拉纤、传动纺锭加捻、回送卷收，纤维与绳轮联动。 | 本表 |
| [german-nutcracker](../../packages/scenes/src/german-nutcracker/scene.ts) | 木偶开果 | 机构或作法约束 | 开杠杆、核桃入嘴、压杠杆破壳，装配与破裂不可删。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [mexican-molinillo](../../packages/scenes/src/mexican-molinillo/scene.ts) | 木旋起沫 | 机构或作法约束 | 器头沿杯轴浸入后左右搓柄起泡，木环与泡量联动，非展示旋看。 | 本表 |
| [chinese-suanpan](../../packages/scenes/src/chinese-suanpan/scene.ts) | 拨珠见数 | 机构或作法约束 | 下珠、上珠、十位珠沿各自竹杆靠梁，实际0→3→8→18计数。 | 本表 |
| [mongolian-felt-ger](../../packages/scenes/src/mongolian-felt-ger/scene.ts) | 毡屋向阳 | 真实不同动作 | 展开木格、支顶圈、铺白毡，各是不同构件的搭建与变形。 | 本表 |
| [peruvian-engraved-gourd](../../packages/scenes/src/peruvian-engraved-gourd/scene.ts) | 葫芦刻光 | 真实不同动作 | 刻纹、擦亮、静看或明确文字提交，制作与观看非搬运三停点。 | 本表 |
| [venetian-glass-bead](../../packages/scenes/src/venetian-glass-bead/scene.ts) | 玻珠凝彩 | 真实不同动作 | 绕彩凝定、脱杆穿绳、静看，珠孔与杆绳穿接约束有不同内容。 | 本表 |
| [korean-bojagi-wrap](../../packages/scenes/src/korean-bojagi-wrap/scene.ts) | 方巾裹礼 | 机构或作法约束 | 布角覆盖与布带交叠收紧是包裹形变，不做刚体搬放。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [vietnamese-bamboo-dragonfly](../../packages/scenes/src/vietnamese-bamboo-dragonfly/scene.ts) | 竹蜓点风 | 已连续拿放 | 一次放上支点后可任意方向持续拨弄，已无同物固定搬运停点。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [turkish-ebru-paper](../../packages/scenes/src/turkish-ebru-paper/scene.ts) | 浮彩成笺 | 真实不同动作 | 梳开水纹、纸贴水再揭起转印、静看，水纸内容变化不同。 | 本表 |
| [indonesian-angklung](../../packages/scenes/src/indonesian-angklung/scene.ts) | 竹音轻摇 | 不属于拿放 | 竹架与竹管可持续自由摇动并主动结束，非拿起悬挂。 | 本表 |
| [weifang-paper-kite](../../packages/scenes/src/weifang-paper-kite/scene.ts) | 纸鸢乘风 | 真实不同动作 | 纸皮贴骨、卷线牵鸢、静看，真实牵线与风动不同于摆放。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [chinese-shadow-puppet](../../packages/scenes/src/chinese-shadow-puppet/scene.ts) | 影偶小戏 | 机构或作法约束 | 主杆提偶与翼杆牵关节不同，影子和关节同步，不把偶当摆件搬运。 | 本表 |
| [faroese-wool-knit](../../packages/scenes/src/faroese-wool-knit/scene.ts) | 毛线织暖 | 机构或作法约束 | 针入旧圈、绕线抽新圈、旧圈滑落，线圈穿接形变保留。 | 本表 |
| [niue-shell-necklace](../../packages/scenes/src/niue-shell-necklace/scene.ts) | 贝链留光 | 机构或作法约束 | 最后一壳沿线穿孔、拉线端收成弧形，线形变化与组装不同。 | 本表 |
| [polish-paper-cut](../../packages/scenes/src/polish-paper-cut/scene.ts) | 剪纸开花 | 真实不同动作 | 剪最后纸边、落边料、展开折纸后静看，不是整物三段搬运。 | 本表 |
| [uzbek-clay-bowl](../../packages/scenes/src/uzbek-clay-bowl/scene.ts) | 陶轮慢成 | 机构或作法约束 | 转陶轮、拉湿泥壁、静看未烧泥坯，轮转与泥形变保留。 | 本表 |
| [chinese-woodblock-print](../../packages/scenes/src/chinese-woodblock-print/scene.ts) | 木版留春 | 真实不同动作 | 棕擦覆盖纸背转印、揭角显印、静看，实际印迹与揭纸不同。 | 本表 |
| [czech-bead-star](../../packages/scenes/src/czech-bead-star/scene.ts) | 珠星映光 | 本轮修改 | 接珠组装保留到2；自由整圈yaw可选，不转也可直接静看到3，旧1可继续。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [fijian-woven-fan](../../packages/scenes/src/fijian-woven-fan/scene.ts) | 叶扇纳凉 | 已连续拿放 | 绑带接木柄后整扇只一次放展座，再静看；无搬运三停点。 | 本表 |
| [amazigh-woven-rug](../../packages/scenes/src/amazigh-woven-rug/scene.ts) | 织毯寄暖 | 已连续拿放 | 收最后纬线后整毯一次上展架，再静看或明确文字提交。 | 本表 |
| [slovak-wire-bird](../../packages/scenes/src/slovak-wire-bird/scene.ts) | 铁线栖鸟 | 已连续拿放 | 接翅膀后整鸟一次落栖座，已接件随鸟，最后静看。 | 本表 |
| [hungarian-embroidery-hoop](../../packages/scenes/src/hungarian-embroidery-hoop/scene.ts) | 花绣寄语 | 已连续拿放 | 添线花后整绣圈一次到展托，最后静看或文字提交。 | 本表 |
| [andalusian-ceramic-tile](../../packages/scenes/src/andalusian-ceramic-tile/scene.ts) | 釉彩映晴 | 已连续拿放 | 嵌最后砖后完整木框一次上托，制作与安放不同。 | 本表 |
| [sicilian-painted-cart](../../packages/scenes/src/sicilian-painted-cart/scene.ts) | 彩车迎晴 | 已连续拿放 | 装轮后整车一次上展垫，最后静看；车轴装配保留。 | 本表 |
| [bai-indigo-cloth](../../packages/scenes/src/bai-indigo-cloth/scene.ts) | 蓝白晾晴 | 已连续拿放 | 漂洗与湿布一次搭晾杆是不同工艺内容，无同布三停点。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [ndebele-painted-house](../../packages/scenes/src/ndebele-painted-house/scene.ts) | 彩墙寄家 | 已连续拿放 | 补彩板后整屋一次移展台，再静看；板与屋不是同物搬运。 | 本表 |
| [purepecha-copper-bowl](../../packages/scenes/src/purepecha-copper-bowl/scene.ts) | 铜碗拾暖 | 已连续拿放 | 软布擦碗后整碗一次放软毡，再静看，擦拭与摆放不同。 | 本表 |
| [welsh-love-spoon](../../packages/scenes/src/welsh-love-spoon/scene.ts) | 木勺寄情 | 已连续拿放 | 擦拭赠礼木勺后一次上托，再细看；保留赠予对象。 | 本表 |
| [barcelos-clay-rooster](../../packages/scenes/src/barcelos-clay-rooster/scene.ts) | 陶鸡报晓 | 已连续拿放 | 添纹后陶鸡仅一次移展台，再静看，制作与安放不同。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [finnish-birch-basket](../../packages/scenes/src/finnish-birch-basket/scene.ts) | 桦篮拾光 | 已连续拿放 | 先装提柄后整篮一次放垫，再静看；组装不是空搬运。 | 本表 |
| [croatian-licitar-heart](../../packages/scenes/src/croatian-licitar-heart/scene.ts) | 彩心相赠 | 已连续拿放 | 裱糖霜后彩心一次挂钉，再静看；无同心三段拿挂。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [catalan-festival-giant](../../packages/scenes/src/catalan-festival-giant/scene.ts) | 巨偶待游 | 已连续拿放 | 别花章后完整巨偶一次移圆台，再静看，装饰与展示不同。 | 本表 |
| [sorbian-painted-egg](../../packages/scenes/src/sorbian-painted-egg/scene.ts) | 彩蛋寄春 | 已连续拿放 | 画笔彩绘后蛋仅一次放陶杯，再静看，绘画不能合并掉。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [basque-sunflower](../../packages/scenes/src/basque-sunflower/scene.ts) | 太阳花迎门 | 已连续拿放 | 花心组装后整花一次上门钉，已接件同组，无三段搬运。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [breton-banner](../../packages/scenes/src/breton-banner/scene.ts) | 节旗轻展 | 已连续拿放 | 扣布耳展开布面后整杆旗一次入座，再静看，布面变化保留。 | 本表 |
| [lithuanian-straw-garden](../../packages/scenes/src/lithuanian-straw-garden/scene.ts) | 草穗悬园 | 已连续拿放 | 接菱形后完整草园只一次上架，挂线与已接件随组。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [dalarna-wooden-horse](../../packages/scenes/src/dalarna-wooden-horse/scene.ts) | 木马安放 | 已连续拿放 | 软布擦彩鞍后木马一次放座，再静看，四蹄接触保留。 | 本表 |
| [aland-votive-ship](../../packages/scenes/src/aland-votive-ship/scene.ts) | 舟模寄谢 | 已连续拿放 | 立桅与索具就位后整船一次放船架，再静看寄谢。 | 本表 |
| [blang-tea](../../packages/scenes/src/blang-tea/scene.ts) | 茶山一盏 | 真实不同动作 | 茶叶入壶、实际壶倾倒茶、静看杯茶；水流与茶量不同。 | 本表 |
| [minangkabau-spinning-top](../../packages/scenes/src/minangkabau-spinning-top/scene.ts) | 木陀轻转 | 机构或作法约束 | 拉绳起转、点帽停稳、静看或文字提交，绳长与转速实际变化。 | 本表 |
| [chinese-incense](../../packages/scenes/src/chinese-incense/scene.ts) | 炉前一炷 | 真实不同动作 | 移炉盖、细香入孔并纸套撤回、静看烟；对象与动作不同。 | 本表 |
| [hongsheng-red-string](../../packages/scenes/src/hongsheng-red-string/scene.ts) | 红绳自持 | 机构或作法约束 | 绕线成环、扣头合拢、静看；绳形与合扣不同，现为产品自持表达。 | 本表 |
| [italian-ex-voto](../../packages/scenes/src/italian-ex-voto/scene.ts) | 绘牌记谢 | 真实不同动作 | 绘归途、描窗光、静看或记录感谢；两笔内容不同，不是挂牌搬运。 | 本表 |
| [czech-pilgrim-journal](../../packages/scenes/src/czech-pilgrim-journal/scene.ts) | 旅途一页 | 真实不同动作 | 翻封面、书签入夹、静看页记，铰链与书签对象不同。 | 本表 |
| [omikuji](../../packages/scenes/src/omikuji/scene.ts) | 签纸慢读 | 真实不同动作 | 摇筒、抽棒展开原创提醒、签纸入封；不把抽签与收纸合成摆放。 | 本表 |
| [polish-blessing-basket](../../packages/scenes/src/polish-blessing-basket/scene.ts) | 一篮春食 | 真实不同动作 | 面包与彩蛋分别入篮后静看备篮，两个食物对象不同。 | 本表 |
| [navruz-sumalak](../../packages/scenes/src/navruz-sumalak/scene.ts) | 春锅共煮 | 真实不同动作 | 锅内搅动、盛入陶碗、共食放碗，实际搅拌和份量转移保留。 | 本表 |
| [floating-lantern-loy-krathong](../../packages/scenes/src/floating-lantern-loy-krathong/scene.ts) | 叶舟寄意 | 真实不同动作 | 安花、点芯、整舟一次入水，制作与点亮不同，不是三段搬舟。 | 本表 |
| [omamori-cycle](../../packages/scenes/src/omamori-cycle/scene.ts) | 御守伴行 | 真实不同动作 | 明确选袋后一次别包或返还箱，再致谢；归返分支与明确选择保留。 | 本表 |
| [shrine-suzu-bell](../../packages/scenes/src/shrine-suzu-bell/scene.ts) | 庭前一铃 | 机构或作法约束 | 拉绳响铃、回绳停稳、铃前问安，保留铃绳机构，非摘铃悬挂。 | 本表 |
| [st-brigids-cross](../../packages/scenes/src/st-brigids-cross/scene.ts) | 草编迎春 | 已连续拿放 | 编草后完整草十字一次到门楣，最后静看，不是同物三段拿挂。 | 本表 |
| [bokjori](../../packages/scenes/src/bokjori/scene.ts) | 竹筛迎岁 | 已连续拿放 | 舀米认识炊具后竹筛一次挂墙，舀米与悬挂不同。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [ema-votive-plaque](../../packages/scenes/src/ema-votive-plaque/scene.ts) | 木牌记愿 | 已连续拿放 | 翻背、明确留言或留白后一次挂梁，保留文字提交边界。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [clootie-well-rag](../../packages/scenes/src/clootie-well-rag/scene.ts) | 井边放下 | 已连续拿放 | 浸湿后湿布一次系枝，再静看，湿态与系结内容保留。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [diya-oil-lamp](../../packages/scenes/src/diya-oil-lamp/scene.ts) | 灯旋一瞥 | 真实不同动作 | 点芯、献光相关圆弧旋灯、一次归盘；宗教旋灯非装饰查看或同物三停点。 | 本表 |
| [votive-candle-catholic](../../packages/scenes/src/votive-candle-catholic/scene.ts) | 留一盏烛光 | 真实不同动作 | 烛台一次安放、点芯、静看或留言，三种真实不同动作。 | [B](2026-10-28-continuous-placement-audit-b.md) |
| [daruma-eye-painting](../../packages/scenes/src/daruma-eye-painting/scene.ts) | 达摩点睛 | 真实不同动作 | 点睛、愿望与回访条件、偶体一次放稳，不能跳过明确内容条件。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [mizuhiki](../../packages/scenes/src/mizuhiki/scene.ts) | 水引结愿 | 机构或作法约束 | 绕环、穿交会并收结、静放赠礼，纸绳变形与结法不刚体搬移。 | 本表 |
| [milagros](../../packages/scenes/src/milagros/scene.ts) | 留一枚感谢 | 已连续拿放 | 明确选符后只一次挂架，再祈求或谢恩；保留最终明确提交。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [phuang-malai](../../packages/scenes/src/phuang-malai/scene.ts) | 串花寄意 | 真实不同动作 | 茉莉簇逐个串入、系结、一次捧放并明确致谢，组装与结形变化不同。 | 本表 |
| [celtic-folk-spring](../../packages/scenes/src/celtic-folk-spring/scene.ts) | 泉边一念 | 真实不同动作 | 泉沿鞠躬、信物一次放水、静看，产品动作不同，无同物三停点。 | 本表 |
| [shinto-torii](../../packages/scenes/src/shinto-torii/scene.ts) | 庭前一礼 | 不属于拿放 | 走近鸟居、低头示敬、静立，没有搬运悬挂对象。 | 本表 |
| [theravada-water](../../packages/scenes/src/theravada-water/scene.ts) | 花水位一倾 | 真实不同动作 | 倾水、花瓣一次入水、合十，三个对象或动作不同，维持产品原创分类。 | 本表 |
| [tibetan-wheel](../../packages/scenes/src/tibetan-wheel/scene.ts) | 廊前轻转 | 机构或作法约束 | 转筒可持续顺时针转动、停稳、主动结束，真实方向语境与转轴保留。 | 本表 |
| [slavic-wreath](../../packages/scenes/src/slavic-wreath/scene.ts) | 火边花环 | 已连续拿放 | 编环后整环一次到水面并目送漂远，无三段手持搬运。 | 本表 |
| [tanzaku-tanabata](../../packages/scenes/src/tanzaku-tanabata/scene.ts) | 短册系竹 | 已连续拿放 | 原同一次拿起即继续系竹枝，已连续跟手；保留最后静看或文字。 | 本表 |
| [yeondeunghoe](../../packages/scenes/src/yeondeunghoe/scene.ts) | 燃灯上浮 | 不属于拿放 | 一次轻推莲灯上移后静看，非同物三段搬运，不新增真实放飞含义。 | 本表 |
| [furin-wind-chime](../../packages/scenes/src/furin-wind-chime/scene.ts) | 风铃一响 | 不属于拿放 | 已悬铃的点铃、拂条、余音和止声，无摘下重挂。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [crane](../../packages/scenes/src/crane/scene.ts) | 折一只纸鹤 | 真实不同动作 | 纸折叠、纸鹤一次托起、静看或文字，折叠与搬运不同。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [lantern](../../packages/scenes/src/lantern/scene.ts) | 月下一灯 | 真实不同动作 | 点灯、愿牌一次挂灯下、静看，非灯体三段搬运，隐藏目录策略保留。 | [A](2026-10-28-continuous-placement-audit-a.md) |
| [woodfish](../../packages/app/src/woodfish.tsx) | 敲一敲木鱼 | 不属于拿放 | 木槌可移动与持续轻敲，十二次最低量后主动结束；拖动不记敲击，无拿挂。 | 本表 |
