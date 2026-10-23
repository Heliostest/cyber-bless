# 场景互动逐项审阅 B 组

核查日期：2026-10-24（Asia/Shanghai）。范围按 `packages/scenes/src` 中包含 `scene.ts` 的目录名称排序后取索引 `i % 3 === 1`，共 51 场；与 `artifacts/scene-interaction-2026-10-24-batches.json` 的 B 组清单一致。

本轮先读实际 `scene.ts`、物件目标、动作／模型姿态和 README，再判断步骤、可持续操作及触屏验收。遵守[场景来源规范](../scene-provenance.md)。步骤数是当前产品操作结构，不称传统规定；有据器物和宗教背景不因此删除。没有为凑四步而制造额外礼序。技术 ID、引擎版本、来源分类和存档编号保持兼容。

## 统一判断与落实

- 多数场景本就表示制作、摆放或送出的一小段，三个动作有实际区别，保留合理拆分。`korean-bojagi-wrap` 原本已有六个空间动作和第七个静看收尾，继续逐角、交叠、收紧及静看。
- `indonesian-angklung` 已有自由演奏，统一为首次发声后才显示「结束仪式」；`chinese-diabolo` 已有反复抛接和显式收杆，保留。
- `puerto-rican-guiro` 和 `spanish-castanets` 熟悉前两次动作后保持进度 2，可以持续轻刮或合拍；只点击「结束仪式」才进入收尾、报告 3。辅助按钮继续演奏，结束按钮另设且不重叠。
- `tibetan-wheel` 首次推转后可继续补推，自然停下也可再转；只有显式结束才收尾。移除会因手机姿态触发完成的陀螺仪入口，不把静立或时间流逝当作结束许可。保留顺时针方向。
- `alasita-miniature-house`、`lao-baci-wrist`、`yusheng-lohei` 仍留有 40–84 px 狭窄区间、90 px 路程上限、9 px 回退和 18 px 横偏硬门槛；接入既有 `completesDirectionalDrag`，接受同向长拖、合理斜拖和小幅纠正，显示实际可松手提示，拒绝明显反向、退回起点、非有限输入和取消。
- 主代理的共享指针修复会在有效按下后补采释放终点；33 个 B 组测试将“有效按下后仅有释放位移也应拒绝”的旧断言改为“无按下的孤立释放拒绝”。保留所有者、多指、取消和遮挡检查；这不是删除输入保护。

## 第一批：10 场

| 场景 ID | 当前步骤／持续性 | 实际验收发现与处理 |
| --- | --- | --- |
| alasita-miniature-house | 3：提起、转看、安放；有限 | 可见小屋命中正确；原长拖超限反弹，改共享方向容错和松手提示。增加无 move 的长触摸释放回归。器物与动作不变。 |
| bai-indigo-cloth | 3：送盆、搭杆、静看；有限 | 使用可见布料与 `placementHit`，已有落位反馈和辅助入口，保留。静看是产品收尾。 |
| basque-sunflower | 3：合花心、挂门、静看；有限 | 拖动物件子树排除、外部遮挡保留；已有 `placementHit`，不把手指偏离物件中心当失败，保留。 |
| bonfim-ribbon | 3：三个现有松结；有限 | 已共用方向配置与放宽验收；左右方向及松手提示一致，保留。三结已有对应文化核查，未新增数量。 |
| bulgarian-survakane | 3：提枝、移后、轻拍；有限 | 真实彩枝目标与对应方向，已有共享容错，保留，不增编迎新礼序。 |
| chinese-diabolo | 2 次熟悉＋可反复抛接＋收杆 | 已有「再抛一次」、左杆续抛和右杆收杆；进行中不自动结束，保留现有循环和显式收尾。 |
| chinese-longevity-lock | 3：托起、移匣、收妥；有限 | `createTouchTarget` 已照顾小型锁饰命中，方向拖动有共享容错，保留。 |
| chinese-shadow-puppet | 3：提主杆、移翼杆、静看；有限片段 | 实体杆操作、投影与动作对应；上提／右移有方向及横偏约束，另有辅助入口。没有把短片段扩成完整表演。 |
| chinese-tangram | 3：补入剩余三片；有限 | 实际四片已放、三片待拼，并非“七块却只准三步”；方向共用且长拖宽容，保留。自由拼图需要新的模型状态，不冒称本轮已实现。 |
| clootie-well-rag | 3：浸水、系枝、松手；有限 | 第三段本义为放下手，允许按下后松开；水面／枝端目标与动作相符，辅助按钮可完成。保留。 |

## 第二批：10 场

| 场景 ID | 当前步骤／持续性 | 实际验收发现与处理 |
| --- | --- | --- |
| czech-bead-star | 3：接珠、右转、静看；有限 | 已有目标投放容错；右转接受与幅度成比例的横偏，满转后不受之前小幅纠正锁死。保留。 |
| dalarna-wooden-horse | 3：轻拭、安放、静看；有限 | 抓布或彩鞍、目标真实可见；当前采用光标投放与辅助按钮。未观察到应增加传统步骤的证据，保留。 |
| ema-votive-plaque | 3：翻背、留言或留白、挂起；有限 | 翻面支持左右两向；按画布宽度设触发量但至少 36 px，挂点与辅助按钮均可完成；保留。 |
| faroese-wool-knit | 3：穿圈、抽圈、静看；有限一针 | 两条斜向动作已用投影方向与共享容错；42 px 最低量、60／62.29 px 完整姿态不设最大拖距，保留。 |
| finnish-birch-basket | 3：装柄、安放、静看；有限 | 细提柄有实际抓点，目标已用 `placementHit`，可偏移抓取后放置；保留。 |
| floating-lantern-loy-krathong | 3：安花、点芯、入水；有限 | 点火用短点，装饰／入水用真实目标投放；水面目标大于舟体抓点且有辅助按钮，保留。没有将放流扩成无据统一礼序。 |
| furin-wind-chime | 3：触发、听余音、结束聆听；有限 | 轻点铃身或拂动纸条均有入口，倾角触发和按钮可替代。本轮保留这一声余音的片段；重复奏铃列为可独立扩展，不假称已经自由奏铃。 |
| german-nutcracker | 3：抬杆、入果、压杆；有限 | 入果已同时接受向上拖或投放到张口；杆动作共享长拖容错，保留。 |
| greek-vasilopita | 3：托份、送盘、取币；有限 | 对应现有糕铲和硬币，取币镜头可见；共享方向／松手提示已有，保留。既有三段不是完整家庭分糕礼序。 |
| horseshoe-doorway-luck | 3：逐枚悬挂；有限 | 实际三枚待安放，已有共享方向容错，不为多步而添加不存在的钉装或祝圣动作。 |

## 第三批：10 场

| 场景 ID | 当前步骤／持续性 | 实际验收发现与处理 |
| --- | --- | --- |
| indonesian-angklung | 自由摇动，最低一次发声后手动结束 | 已在一次抓取内连续发声、松手后再摇；本轮将结束按钮在首次发声前隐藏，文案统一「结束仪式」，加入共享连续结束样式。 |
| japanese-daruma-otoshi | 3：对齐、敲出一片、抬槌；有限 | 对应一片底片的实际模型，方向共享容错；保留而不在几何不支持时假造清空全部叠片。 |
| japanese-kendama | 3：大皿、小皿、入尖；有限教学片段 | 自动轨迹已分清先抛再接，向上短拖且有辅助入口；可作为未来细拆抛／接候选，但不能将悬空中间姿态伪称稳定检查点。保留。 |
| japanese-shishi-odoshi | 3：引水、倾筒、回叩；有限一循环 | 实体竹筒转轴与有方向的共享验收，保留。将来可循环观察，需要另行组织注水状态，本轮不假称持续物理供水。 |
| kagami-mochi-offering | 3：大饼、小饼、橙；有限 | 每步对应实物的一层放置，已有共享容错；保留，不添食用或祭祀完成主张。 |
| korean-bojagi-wrap | 6 个空间动作＋第 7 个静看：四角覆盖、交叠、收紧、静看 | 本就没有三步限制。布角目标、系带交叠和收紧量各有实际姿态，不压缩。原有 variant 记录 0–7，旧进度 0／1／2／3 分别映射到 0／4／6／7，维持兼容。 |
| lam-tsuen-wishing-tree | 3：示例写愿、系橙、抛挂；有限 | 同向长拖／斜拖／纠正已可用；书写和抛挂均为既有产品辅助路径，保留。 |
| lao-baci-wrist | 3：拿线、绕腕、收结；有限 | 细棉线已有周围真实网格采样；但仍有长拖硬上限，改共享容错与松手提示，补无 move 长释放回归。不新增结数／佩戴期限。 |
| mexican-metate | 3：前推、回磨、收杵；有限 | 方向与石杵动作对应，共享容错已存在；没有把两次动作当完成真实研磨，保留片段。 |
| milagros | 3：选择、挂起、留下祈求或谢意；有限 | 四个选择按钮及可见小符、挂点与辅助入口可用；保留真实宗教奉献语境，不改称普通装饰。 |

## 第四批：10 场

| 场景 ID | 当前步骤／持续性 | 实际验收发现与处理 |
| --- | --- | --- |
| mochigase-nagashibina | 3：托起、移流、入水；有限 | 一条流雏放流片段，拖向与相应投影一致，已有共享容错，保留。 |
| nanakusa-gayu | 3：轻拌、舀起、盛碗；有限 | 实际为已煮粥的盛食片段，勺目标有 22 px 可见网格容差；保留，不增设辨七草／烹煮等未实现动作。 |
| neapolitan-cornicello | 3：安角符、放卡、备赠；有限 | 三个实际物件及递送路径，方向共用验收；保留产品赠礼片段。 |
| omikuji | 3：摇筒、抽棒展纸、收签；有限 | 对象与目的地不同，18 px 最低位移配合投放及按钮；保持原创提醒与宗教抽签背景的区分。 |
| peruvian-engraved-gourd | 3：刻纹、转看、静看；有限 | 刻纹轨迹与转看使用既有方向容错，保留；没有把重复刮刻虚构为完成另一件作品。 |
| polish-oplatek-sharing | 3：递出、分角、分享祝愿；有限 | 每步对应现有手和薄饼的支撑状态，共享方向验收已存在；保留。 |
| puerto-rican-guiro | 2 次熟悉＋持续刮奏＋显式结束 | 原三段做完就结束；现最低下刮／回刮后可无限来回轻刮，辅助操作同样继续，进度停在 2，按钮才触发移开木棒并完成 3。 |
| rosh-hashanah-apple-honey | 3：拿片、蘸蜜、回盘；有限 | 现有有限蘸蜜片段，长拖容错与姿态一致；保留，不追加祷告或已食用主张。 |
| scottish-plunge-churn | 3：落杆、回提、揭盖；有限 | 真实杆／盖目标与方向对应，已有共享容错；本轮保留观察机械片段，不能把短操作或无限重复称为实际产黄油。 |
| shinto-torii | 3：走近、一礼、静立；有限 | 上／下拖、点击和姿态辅助都有入口；保留现有一礼片段，不增编统一神社参拜流程。 |

## 第五批：11 场

| 场景 ID | 当前步骤／持续性 | 实际验收发现与处理 |
| --- | --- | --- |
| slavic-wreath | 3：编合、入水、漂看；有限 | 编合和放流各有对象与辅助入口，向下拖入水不要求细小指定角度；保留，不把婚恋占卜背景改写为纯欣赏。 |
| spanish-castanets | 2 次熟悉＋持续合拍＋显式结束 | 原左／右／双拍后自动结束；现左／右后可无限双拍，进度 2 保持。结束按钮触发最后一次轻合、张开并完成 3，音效仍为合成反馈。 |
| sternsinger-house-blessing | 3：取粉笔、书写、收笔；有限 | 真实粉笔的方向／可松手提示已有，三段包含实际书写动画，保留；不把短划称完整逐户祝福。 |
| tanzaku-tanabata | 3：取纸、挂竹、短愿；有限 | 纸条拖放至系结处、辅助按钮可代替；保留，个人留言不作为追加传统规定。 |
| tibetan-khata-greeting | 3：托起、递出、接稳；有限 | 白绢／手的支撑连续，方向提示和共享容错一致；保留，不新增身份、资格或绕颈规则。 |
| tibetan-wheel | 起转、可持续补推／停稳再转、手动结束 | 旧自然停稳会锁死续转，旧手机姿态能直接完成。现仍只接受顺时针，停稳后可重新推，结束按钮才要求减速并报告 3；静默恢复不再触发完成事件。 |
| uchide-wishing-mallet | 3：托槌、轻摇、放稳；有限 | 物件抓取范围已用 `createTouchTarget`，方向长拖容错已有；保留短暂托摇片段，不假称一套统一祈愿仪轨。 |
| valencian-folding-fan | 3：展开、轻摇、收半开；有限 | 扇骨和铆钉分别为目标，方向提示／共享验收一致。可持续扇风是后续候选；本轮保留三种不同器械动作，不宣称已自由扇风。 |
| vietnamese-five-fruit-tray | 3：放橙、苹果、梨；有限 | 实际青蕉和柚已预置，三类待放，合理保留三次摆果；五类选择和次序仍为产品布置，不新增统一祭祖礼序。 |
| welsh-drop-spindle | 3：轻旋、缓落、提回；有限 | 纺轮实体与方向共享验收，保留器械观察片段；静态线束不冒称已完成真实纺线。 |
| yusheng-lohei | 3：探筷、捞起、落回；有限一次捞拌 | 原硬上限使手机长拖无效；接共享容错与松手提示，补无 move 长释放回归。仍为一次共同捞拌片段，不增加无据次数或效验。 |

## 本轮实际重读的外部正文

| 受影响事实 | 来源与实际阅读位置 | 状态／日期 | 支持范围与限制 |
| --- | --- | --- | --- |
| 刮瓜沿棱以木棒或梳刮奏 | [The Metropolitan Museum of Art — Güiro, 89.4.2758](https://www.metmuseum.org/art/collection/search/502789)，说明第 11 行，物件资料第 34–44 行 | 2026-10-24 已读相关正文 | 支持中空瓜壳、棱、刮奏和节奏用途；不能推导最低两次、固定曲谱或结束动作。 |
| 西班牙木响板与碰击发声的器物身份 | [The Metropolitan Museum of Art — José Tárrega Peiró: Castanets, 2005.421a–c](https://www.metmuseum.org/art/collection/search/504450)，Object Details 第 32–41 行 | 2026-10-24 已读相关正文 | 支持西班牙、木材、20 世纪晚期实物与碰击体鸣分类；凹壳／系绳结构沿用既有来源核查，不把本次藏品资料扩写为新读指法。最低两次和双合路径属于产品。 |
| 顺时针、反复转动及宗教发心背景 | [Rubin Museum / Elena Pakhoutova — Accumulating Merit Every Day](https://rubinmuseum.org/projecthimalayanart/essays/prayer-wheel/)，第 61–71、83–90 行 | 2026-10-24 已读相关正文 | 支持顺时针、日常／寺院中的重复转动与对功德的信仰解释。一次最低量、合成音、按钮与减速系数是产品安排，不与真实诵念或福报换算。 |

安格隆本轮只统一按钮文案与初始显隐，未改变既有摇动／发声或文化主张，沿用[来源卡](../../content/traditions/indonesian-angklung.md)所列 ICHCAP 已读记录，未把本次未重新打开的 UNESCO 验证页面登记为已读。三项方向容错修复沿用各场景 README、2026-10-23 逐项来源记录；不新增传统动作、数量或寓意。

## 验证与限制

- `npm.cmd run typecheck -w @wbr/scenes`：最终通过。
- `npm.cmd exec -w @wbr/scenes -- vitest run src/tibetan-wheel/scene.test.ts src/tibetan-wheel/spin-direction.test.ts --maxWorkers=1 --reporter=dot`：2 文件、6 项通过；覆盖反复推转、自然停稳再转、显式结束、暂停冻结及静默恢复。
- 最终局部回归：`npm.cmd exec -w @wbr/scenes -- vitest run src/korean-bojagi-wrap/scene.test.ts src/peruvian-engraved-gourd/scene.test.ts src/tibetan-wheel/scene.test.ts src/tibetan-wheel/spin-direction.test.ts src/alasita-miniature-house/scene.test.ts src/lao-baci-wrist/scene.test.ts src/yusheng-lohei/scene.test.ts src/indonesian-angklung/scene.test.ts src/puerto-rican-guiro/scene.test.ts src/spanish-castanets/scene.test.ts src/puerto-rican-guiro/model.test.ts src/spanish-castanets/model.test.ts --maxWorkers=2 --reporter=json --outputFile=../../artifacts/interaction-review-b-final-tests.json`：12 个文件、511 项全部通过。覆盖多次继续及显式结束、实际网格／射线、三宽度构图、取消、暂停、回调重入、恢复和资源释放；其中包袱布另补六个仅按下／释放样本的成功回归。报告在忽略目录 `artifacts/interaction-review-b-final-tests.json`。
- 全量检查后补齐两处旧断言：扎染和胡桃夹子的有效按下／释放投放原被误列为失败；改用真正的零位移作拒绝用例，并新增稀疏事件成功、孤立释放拒绝和零位移拒绝回归，覆盖普通／减少动画。`npm.cmd exec -w @wbr/scenes -- vitest run src/bai-indigo-cloth/scene.test.ts src/german-nutcracker/scene.test.ts --maxWorkers=2 --reporter=dot`：2 文件、105 项全部通过；未修改场景实现。
- 逐项静态审阅与技术测试不能替代真机手感测试；浏览器手机视口和触摸模拟由主代理集成验证，不能声称已实机通过。未实现自由拼图、反复扇风或完整乐器演奏教学。

## 核查清单

- [x] 对照实际器物、目标、动作、步骤、完成条件及用户提示。
- [x] 反复操作保留原有器物动作，不增加传统规定；最低量和结束按钮归产品。
- [x] 未改变来源分类、地区／宗教身份、技术 ID、引擎或历史存档编号。
- [x] 受影响的三张来源卡、场景 README、此报告同步；安格隆只调整界面规则并引用既有核查。
- [x] 最终局部类型检查和 511 项回归通过；主代理另负责集成构建／手机视口验证，本文不代称实机通过。
