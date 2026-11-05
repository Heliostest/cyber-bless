# 调试预览：地区树形候选与证据边界

**后续状态（同日）：** 用户已明确要求默认使用场景推荐树木。九个既有映射及所有排除项保持，相关正文已重新阅读；正式启用范围、分享行为与逐场复核见[默认布景记录](2026-11-05-environment-defaults.md)。下文“仅调试／默认未变”保留为本证据收集阶段的历史状态，当前以该默认记录及各场景 README 为准。

核查日期：2026-11-05。范围：共享环境的背景树形；仅供用户主动选择的 DEBUG 预览，不改变正式默认、仪式主体、来源分类、标题、介绍、动作或完成条件。

遵循 [场景来源与文化关联核查规范](../scene-provenance.md)。本记录只证明有限地点的植物／园林存在，以及据此作出的产品布景选择；不证明某种树是一个国家“最有代表性”的树，更不证明它是某项祈愿的必备植物、传统寓意或规定场地。没有用现有代码／来源卡证明植物事实。

## 先核对的实际呈现

已读 `packages/scene-runtime/src/cozy-environment.ts` 的场景 profiles、种植分支和树木替换边界，以及 `packages/core/src/daily-scenes.ts` 的以下宿主条目。九个正向候选各自的 README、对应来源卡相关正文也已阅读：

| 场景 | 当前对象、语境与来源 |
| --- | --- |
| `japanese-wagasa` | 竹骨纸伞开合，晴日草地边；`japanese-wagasa` 卡直接涉及岐阜工艺。 |
| `ema-votive-plaque` | 木牌翻面／可选书写与悬挂；`ema-votive-plaque`。通用寺社语境，未限定一所神社或固定节日。 |
| `shrine-suzu-bell` | 铃绳拉放及礼敬语境；`shrine-suzu-bell`。无固定季节。 |
| `omikuji` | 签筒、编号签棒、纸签及收封；`omikuji`。卡保留问运背景，应用提醒和信封是产品表达；无固定季节。 |
| `shinto-torii` | 走近鸟居、低头、静立；`shinto`。当前场景不锁定初诣，也不是绘马流程。 |
| `german-nutcracker` | 背杆、活动下颌、胡桃与木偶；`erzgebirge-nutcracker-craft`，涉及塞芬／厄尔士山木作。 |
| `chinese-diabolo` | 竹木空竹、杆绳、起转及可重复抛接；晴日庭园。`chinese-diabolo` 卡包含北京资料，但未指定北海实景。 |
| `neapolitan-cornicello` | 那不勒斯角形护符、纸卡和礼盒；`neapolitan-cornicello`。不模拟佩戴或开光；一般化庭院。 |
| `valencian-folding-fan` | 木骨布面折扇展开、轻摇、收半开；`valencian-folding-fan`，对应瓦伦西亚／阿尔代亚工艺；一般化草地环境。 |

另读了 `japanese-shishi-odoshi`、`kitano-nadeushi`、`kameido-usokae`、`japanese-kadomatsu`、`finnish-birch-basket`、`russian-matryoshka`、`scottish-plunge-churn`、`andalusian-ceramic-tile`、`barcelos-clay-rooster`、`sicilian-painted-cart`、`sri-lankan-bodhi-puja`、`mongolian-ovoo` 的相关卡片或 README，以识别地点、主体与季节限制。此处不是对这些场景全部历史外链的重新通读认证。

## 已实际阅读的外部证据

访问状态中的“已读”仅指表中定位的相关正文。网页摘录行号用于记录此次定位，日后页面更新时应依标题和小节复核。

| 编号 | 来源、机构、日期及 URL | 实际读取位置和状态（2026-11-05） | 支持范围与限制 |
| --- | --- | --- | --- |
| E1 | 岐阜市公园整备课：[桜（岐阜公園ほか お花見スポット）（3月～4月）](https://www.city.gifu.lg.jp/info/machizukuri/1007994/1008001/1008003.html)，页面更新 2024-03-06。 | **已读相关正文**：“市内のさくら”表，正文约 L188–211。 | 岐阜公园和市内多处有不同樱树，页面明确以三至四月赏樱为题。支持岐阜春日园林的樱树候选；不证明伞具与樱树有仪式关系，也不证明下载模型对应某个品种。 |
| E2 | 平安神宫：[平安神宮の四季](https://www.heianjingu.or.jp/map/season/)，未见文章发布日期。 | **已读相关正文**：春／梅／樱／新绿与夏季段，约 L60–98。 | 神宫自身记南神苑樱花在三月下旬至四月上旬；夏景另述常绿林。支持京都某一真实神社的春季园景参照。把它用于通用鸟居、铃、绘马、签筒背景，是产品美术推断；不将这些场景冒称平安神宫复刻。 |
| E3 | 宫内厅：[Flower Calendar](https://www.kunaicho.go.jp/en/visit/event/higashigyoen/hanadayori-cal/index.html)，未见文章发布日期。 | **已读相关正文**：Spring／Autumn／Winter 列表，L0–76。 | 皇居东御苑樱树花期随品种不同；另列秋冬品种。故不能把“樱只在春天开”说成绝对植物事实。但当前通用粉花资产没有冬樱品种依据，不能借此把正月仪式一律改成盛放粉樱。 |
| E4 | 萨克森州 Natura 2000／环境主管部门：[Montane Fichtenwälder — Lebensraumtyp 9410](https://www.natura2000.sachsen.de/montane-fichtenwalder-23788.html)，正文未见发布日期。 | **已读相关正文**：约 L136–147。 | 记录厄尔士山高处的云杉林及云杉／冷杉等群落，并说明天然林与人工云杉林有差别。支持该地区针叶树景观的有限美术参照；不证明木偶必须摆在森林中，更不把分层针叶模型鉴定为某一树种。 |
| E5 | 北京市人民政府／首都之窗：[北海及团城](https://www.beijing.gov.cn/renwen/rwzyd/qgzdwwbhdw/bhjtc/202210/t20221027_2846104.html)，URL 所示 2022-10-27。 | **已读相关正文**：L3–5。另读同机构 2026-07-13 的 [夏日赏荷之北海公园](https://www.beijing.gov.cn/fuwu/bmfw/bmzt/jxqlzn/shdw/202607/t20260713_4760044.html) L18。 | 北京北海确有环湖垂柳，后者明确为夏日景观。支持北京园林柳形候选；不能由此声称空竹起源于北海、北海是规定练习场地，或当前没有湖面的草地场景就是北海。 |
| E6 | 那不勒斯费德里科二世大学植物园：[Index Seminum 2016–2017](https://www.ortobotaniconapoli.it/images/index-seminum/Index%20seminum%202016_2017%20Orto%20Botanico%20Napoli%20IT.pdf)。 | **已读 PDF 相关解析正文**：封面及出版机构 p1–3；印刷 p18（PDF 第18页，索引17），Cupressaceae 条目 `Cupressus sempervirens L. / XX-0-NAP-983 / G`。页面截图请求 cache miss，**未声称已目视 PDF 表格**。 | 园方自身历史目录直接记录地中海柏种名与园内编号。支持那不勒斯园林可采用这一树形家族；不代表今日存活盘点、全城优势树种或角符赠礼习俗用树。资产柱形姿态另有 E8 支持。 |
| E7 | 瓦伦西亚大学植物园：[Catàleg virtual d'espècies vegetals — Gespes i coníferes](https://www.jardibotanic.org/?apid=cataleg_virtual_despecies-220&cadbusc=Gespes+i+con%C3%ADferes&idioma=_eng&idioma=_val&tipobusc=planta_colid)，未见发布日期。 | **已读机构收藏目录正文**：L60–74，明确列 Cupressus sempervirens 及园内草地／针叶、植物学校等收藏。不是搜索结果摘要。 | 足以证明瓦伦西亚当地植物园栽培此类树，支持瓦伦西亚折扇场景的产品庭园候选；不说明阿尔代亚每个作坊或折扇传统均配置柏树。 |
| E8 | 阿尔罕布拉宫与赫内拉利费管理机构：[Los cipreses de la Alhambra](https://www.alhambra-patronato.es/los-cipreses-de-la-alhambra)，2015-01-21；另读 [CIPRÉS COMÚN](https://www.alhambra-patronato.es/elemento-del-mes/cipres-comun)。 | **已读相关正文**：前篇约 L88–90，后篇物种介绍相关段。 | 园方描述地中海柏的直立与展开形态，以及园林采用直立形；格拉纳达当地的实际栽培有据。不能单凭格拉纳达资料断定塞维利亚、巴塞卢什、那不勒斯或所有地中海仪式的场地。此证据主要帮助确认树形概念，不独自给上述地点背书。 |
| E9 | 北野天满宫：[境内のご案内](https://kitanotenmangu.or.jp/guidance/)，未见文章日期。 | **已读相关正文**：梅苑及影向松小节；影向松约 L110–114。 | 北野自身的梅苑与松有直接记录。支持排除“日本场景一律樱花”的规则。影向松传说只归于该社叙述，本产品不把它改成新功效或到处复制这株树。 |
| E10 | 京都市建设局：[中京区・区民の誇りの木 エリアA](https://www.city.kyoto.lg.jp/kensetu/page/0000021641.html)，2012-02-10。 | **已读相关正文**：A16，高濑川沿岸シダレヤナギ，约 L110–112。 | 京都沿水柳树有直接地点证据。可为未来京都水边方案提供参照；本轮没有据此把所有日本庭园、诗仙堂或鹿威装置背景都配成垂柳。 |

## 九个可启用的调试候选

下表是**产品美术选择**。五个樱树条目都应显示“樱花树（春景）”或同等季节限定，不能显示“当地最代表性树种”。点击地区候选只影响调试预览，退出／重置沿用原场景；它不成为生产默认或季节规则。

| sceneId | 候选家族／建议显示名 | 依据与具体选择边界 |
| --- | --- | --- |
| `japanese-wagasa` | cherry／樱花树（春景） | E1；岐阜春日庭园配景，纸伞工艺与花树没有新增传统关联。 |
| `ema-votive-plaque` | cherry／樱花树（春景） | E2；通用神社春景。背景树不替代绘马架，不把悬挂树枝变成新增步骤。 |
| `shrine-suzu-bell` | cherry／樱花树（春景） | E2；通用神社春景，铃与铃绳主体、礼敬背景不变。 |
| `omikuji` | cherry／樱花树（春景） | E2；无固定节期的通用寺社春景；不增加把签纸系在樱树上的要求。 |
| `shinto-torii` | cherry／樱花树（春景） | E2；当前一般入社礼敬可用春景预览；不把它改成仅限赏樱或初诣的活动。 |
| `german-nutcracker` | layered-conifer／层叠针叶树 | E4；厄尔士山针叶林的简化背景。资产来源中即使内部键叫 pine，也不能由此称为日本观赏松或作松叶材料证据。 |
| `chinese-diabolo` | willow／垂柳 | E5；北京园林的季节兼容候选，近水景观仅作参照。保持当前草地和空竹操作，不虚构北海实景身份。 |
| `neapolitan-cornicello` | columnar-cypress／柱形柏树 | E6＋E8；有那不勒斯当地栽培依据的地中海柏形庭院。无赠礼规则、驱邪功效或“护符必须配柏树”的主张。 |
| `valencian-folding-fan` | columnar-cypress／柱形柏树 | E7＋E8；瓦伦西亚园林候选，属于折扇外的产品布景。 |

没有证据说这些树都“最漂亮”；高低、疏密、花色与画面是否协调由调试中的实际视觉评审决定。保留用户手动比较所有已安装树形的能力，能看到某个模型不等于它获得地区推荐。

## 保留原景与明确排除

未列入九个候选的场景，地区建议回落 `original`。如提供中性阔叶树，它只是无特定树种／地域承诺的手动美术选项；不能把一个球冠模型称为所有地区的橡树、菩提树、榕树或橄榄树。

| 场景或范围 | 本轮处理与原因 |
| --- | --- |
| `kitano-nadeushi`、`kameido-usokae` | 保留原景。前者具体天满宫与梅的关联强，不能拿樱花资产充当梅；后者涉及正月鷽替，也不安排通用盛放粉樱。E9 是北野的直接参照，不自动证明龟户同一株树。 |
| `japanese-kadomatsu`、`nanakusa-gayu`、`japanese-hamaya`、`kagami-mochi-offering` 等固定正月／冬季语境 | 保留原景。现有层叠针叶资产不是门松所需松枝的植物学复刻；也不利用 E3 的特殊冬樱名录为通用粉樱开脱。 |
| `shichigosan-chitose-ame`、`tanzaku-tanabata`、`japanese-koinobori`、`furin-wind-chime`、`chinowa-kuguri` | 保留原景，避免将春花布景自动覆盖秋日、初夏、盛夏等具体语境。 |
| `sri-lankan-bodhi-puja` | 保留原景，尤其不替换前景 Ficus religiosa、心形长尖叶、树根及供水对象；通用阔叶、柏、樱或棕榈均不可冒名“菩提树”。 |
| `mongolian-ovoo`、`mongolian-felt-ger` | 保留原景。当前草地／敖包不因地域按钮被强行变成森林；稀疏草原与无树地平线可作为未来独立美术方案，不声称蒙古全境无树。 |
| `scottish-plunge-churn` | 保留原景。实际来源涉及泰里岛，不拿苏格兰高地松林自动代替该岛；更不能把 Scots pine 与当前层叠冷杉式资产视为同种。 |
| `andalusian-ceramic-tile` | 保留原景。实际工艺是塞维利亚特里亚纳；本轮塞维利亚直接柏树园林页失访，格拉纳达 E8 不单独填补这个缺口。 |
| `sicilian-painted-cart` | 保留原景。本轮西西里植物园和地区树木名录有检索线索，但相关 PDF 未成功直读，不能登记为已读证据。工艺本身不因此解除来源绑定。 |
| `barcelos-clay-rooster` | 保留原景；不从“葡萄牙”推导柏树、橄榄或棕榈。北部巴塞卢什需要自己的景观论证。 |
| 热带、喜马拉雅、安第斯及其他尚未选定地点的场景 | 保留原景；不以“亚洲／热带／高山”当作统一植物区，也不把暂无的棕榈、橄榄、石榴硬换成球冠或柏树。 |

## 访问失败与后续资产方向

以下线索**没有用于九个正向推荐**：

| 线索 | 本次实际访问与处理 |
| --- | --- |
| 塞维利亚市 [Paseo de la Palmera](https://www.sevilla.org/servicios/medio-ambiente-parques-jardines/parques/paseos-arbolados/paseo-de-la-palmera) 及该市 Jardín de los Leones 页面 | 检索索引出现直立柏种名，但直接打开多次超时；不是已读正文。一次本机 HTTP 读取又被环境网络策略阻止。停止以摘要补足，不启用塞维利亚条目。 |
| 西西里 [2025 地区名录](https://www.regione.sicilia.it/sites/default/files/2025-11/Elenco%20degli%20alberi%20monumentali%20di%20Sicilia%20aggiornata%20e%20corretta%20al%20%2030.10.2025.pdf)、[2023 名录](https://www.regione.sicilia.it/sites/default/files/2023-05/Elenco%20degli%20alberi%20monumentali%20di%20Sicilia%20-%20%28aggiornamento%20al%2019.05.2023%29.pdf)、[I grandi alberi di Sicilia](https://www.regione.sicilia.it/sites/default/files/2022-02/I%20grandi%20alberi%20di%20Sicilia.pdf) | 搜索可见柏树与具体地点；直接读取分别 404／404／超时。未读取正文，不据此给西西里木车场景配树。 |
| 巴勒莫大学植物园 [Index Seminum 2024](https://www.ortobotanico.unipa.it/assets/orto-botanico-di-palermo_index-seminum2024.pdf) | 搜索有记录；直读重定向失败／cache miss。旧 2022 索引 404。未读正文。 |
| 瓦伦西亚植物园 [The Monumental Arboretum](https://www.jardibotanic.org/fotos/pdf/publicacion_3_82_THE-MONUMENTAL-ARBORETUM-ENGLISH.pdf) | 文件约 53 MB，浏览工具拒绝大文件；未读 PDF 正文。E7 的实际机构收藏目录另已读，足以支持本轮有限栽培事实。 |

未来如增加资产，可继续分开检查植物依据与资产身份。已读的 [芬兰 Pilke 科学中心／Metsähallitus：Birches (Betula)](https://expo.tiedekeskus-pilke.fi/en/northern-finland-tree-species/birches-betula/) 相关正文 L1–6，支持芬兰有垂枝桦、绒毛桦等及其不同生境；可供 `finnish-birch-basket` 的未来桦树背景研究。已读 [新加坡 NParks：Cocos nucifera](https://www.nparks.gov.sg/florafaunaweb/flora/5/6/5618) 的植物形态、海岸景观用途段，支持椰棕的形态与生境，不单独证明巴厘、斯里兰卡、泰国或太平洋某个具体场景的种植。两者本轮均无新增可用资产／地区映射；不伪造 Quaternius 免费包不存在的树。

## 核查结论与同步范围

- [x] 从实际场景、宿主及来源卡确定对象、地域和季节；背景选择不改变主体。
- [x] 九个候选均有已读的有限植物证据；从地点事实到布景选择的推断单独标明。
- [x] 没有国家等于一种树、把仪式与背景植物绑定、将层叠针叶称为日本松或把樱当梅。
- [x] 访问失败没有登记为已读；缺证条目保留原景。
- [x] 本文件不改来源卡的传统事实、注册表和 metadata 的来源身份、技术 ID 或存档。本轮调试参数与资源实现的改动、许可核查、测试及截图由主实现记录负责；本文没有据此宣称运行时已通过测试。

本记录的变更文件只有本 Markdown。正式默认、场景文案和文化归属未在本子任务中修改，因此不重复改写全部来源卡；若以后把候选升为正式布景、改变特定季节或寺社身份，应重新按核查规范逐项审阅并同步实际受影响文件。
