# 2026-10-20 场景中文介绍扩充 A 组

本轮逐项对照 `scene.ts` 的当前器物、提示与动作，读取现有来源卡、可用场景 README 及 2026-10-19 研究线索后，重新打开下列直接来源。旧核查仅用于寻找材料，不作为本轮新增事实证据。访问日期均为 **2026-10-20**；“HTTP 正文已读”表示同一官方网址实际返回正文并已阅读，既不把 HTTP 成功当作正文证明，也不把搜索摘要、验证码或失败页列为已读。

42 项均保留当前专卡 slug。历史时间分别标注为器物年代、书面记载、传播节点、当代活动或有据的传承阶段；遗产申报年不作起源。介绍正文只保存在 `packages/core/src/scene-narratives/a.ts`，本记录保存其证据边界；卡与 README 用锚点回链，避免维护多份完整介绍。

范围：扩充介绍及文化文档，并收窄舟模与陶鸡的少量旧提示，使其与已读证据一致；不改变技术 ID、引擎、隐藏策略、动作、音效、震动、完成条件或存档。宿主接入与显示验证由主代理统一进行。


## aland-votive-ship

标题：舟模寄谢。最终来源 slug：`aland-votive-ship`。

**实际器物与动作：** 原创木船模、帆桅、黄铜桅座与船架；插桅杆→整船放架→静看/可选感谢。

**可支持的文化与时间范围：** 芬兰奥兰伦帕兰教堂1836年船模、1837年商人捐赠；克卡尔教堂船模及1733年海盗遭遇的地方叙事。年代分别属于器物/捐赠和传说中的事件。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Lemland-Lumparlands församling — St: Andreas](https://www.lemland-lumparland.evl.ax/kyrkor-och-lokaler/st-andreas) | 正文 votivskepp 段：1836、Carl-Gustav Löthman、1837 | 直接 HTTP 200 正文已读（网页工具超时后替代读取）；2026-10-20 |
| [Kökar municipality — St Anna's church](https://www.kokar.ax/st-annas-kyrka?lang=en) | 木制教堂船及 Olle、1733 年海盗故事段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 没有证实所有教堂船都为海难脱险还愿；组装、桌面安放、留言均非已证实献置程序。旧 UI returning 的“向海上谢恩传统致意”由主代理本轮改为“记录航海记忆的小景”，撤回无据泛化。教堂页网页工具超时，改以同 URL 的 HTTP 200 实际正文读取，未引用失败索引日期。

**同步：** [来源卡](../../content/traditions/aland-votive-ship.md)、[场景 README](../../packages/scenes/src/aland-votive-ship/README.md)；介绍字段按此范围扩充。


## amazigh-woven-rug

标题：织毯寄暖。最终来源 slug：`moroccan-amazigh-textiles`。

**实际器物与动作：** 羊毛条纹几何毯、木梭、夹杆和展架；补末行→整毯移架→静看/可选留言。

**可支持的文化与时间范围：** 摩洛哥阿马齐格母女传承染织、阿特拉斯地区染材差异、19世纪末后合成染料进入；20世纪豪兹毯为馆藏年代例证。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Khalid Loukid／Dar Si Said 国家织造与地毯博物馆，ICOM Costume — Traditional Dyeing Techniques in Moroccan Amazigh Textiles: Ancestral Knowledge and Regional Practices](https://costume.mini.icom.museum/wp-content/uploads/sites/10/2025/01/Loukid_article_VF.pdf) | PDF 第1–3页地区、母女传习及染料变化；第7页图2豪兹20世纪毯（第5–6页婚礼披巾不外推） | PDF 相关正文与图注已读；2026-10-20 |

**缺口、不能外推及产品简化：** 不能将文中婚礼披巾的特定保护解释移给普通毯；条纹配色、木夹和三步是产品安排。没有确证织毯统一起源。

**同步：** [来源卡](../../content/traditions/moroccan-amazigh-textiles.md)、[场景 README](../../packages/scenes/src/amazigh-woven-rug/README.md)；介绍字段按此范围扩充。


## andalusian-ceramic-tile

标题：釉彩映晴。最终来源 slug：`andalusian-ceramic-tile`。

**实际器物与动作：** 九片蓝白釉陶花砖、木框、展托；补中央花砖→整框移托→静看。无绘色或烧窑动作。

**可支持的文化与时间范围：** 西班牙塞维利亚特里亚纳旧圣安娜陶厂，19世纪末/20世纪初窑炉与绘花砖工作台；该厂制作西班牙广场花砖。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Junta de Andalucía — Centro Cerámica Triana](https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/evento/centro-ceramica-triana) | 旧 Santa Ana 工厂、窑炉、储泥池、矿物磨和大幅花砖绘画台两段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 历史窑炉年代不是当地陶瓷起源；蓝白图案和装框陈列无特定祈愿寓意，补装花砖不得写成绘制釉色。

**同步：** [来源卡](../../content/traditions/andalusian-ceramic-tile.md)、[场景 README](../../packages/scenes/src/andalusian-ceramic-tile/README.md)；介绍字段按此范围扩充。


## bai-indigo-cloth

标题：蓝白晾晴。最终来源 slug：`bai-tie-dye`。

**实际器物与动作：** 已染扎棉布、清水盆与木晾杆；入盆展开→搭杆→静看。

**可支持的文化与时间范围：** 中国云南大理喜洲周城白族扎染，民国时期家庭作坊；防染、反复浸染、拆线洗晒及衣物桌布门帘用途。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [中国非遗网／董秀团调查 — 大理周城白族的扎染工艺（2009-04-14）](https://www.ihchina.cn/news_1_details/11139.html) | 村落概况、扎染溯源、扎花染色及家庭用品相关段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 调查明确周城开始扎染年代难定；中国4世纪绞缬不能直接当周城起源；不采用旧文药效和辟邪解释。拆线/展开/漂洗合并、原创纹样为简化。

**同步：** [来源卡](../../content/traditions/bai-tie-dye.md)、[场景 README](../../packages/scenes/src/bai-indigo-cloth/README.md)；介绍字段按此范围扩充。


## balinese-canang-sari

标题：叶盘献谢。最终来源 slug：`balinese-canang-sari`。

**实际器物与动作：** 椰叶盘、porosan、食物与花材，白花补东侧→托盘→田边供奉台安放；未演出焚香、完整祈祷。

**可支持的文化与时间范围：** 印度尼西亚巴厘印度教日常献供；SAKA 所述家庭、寺庙、路口、田边供奉及向 Ida Sang Hyang Widhi Wasa 感谢祈安；PHDI 对诚意和材料方位的宗教解释。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [SAKA Museum — Metanding Canang Sari](https://www.sakamuseum.org/en/subaktranslation/interactive-canang-sari) | 互动说明第1–2段：日常献供、位置、材料、感谢与平衡 | 网页相关正文已读；2026-10-20 |
| [PHDI／Ida Pandita MPU Jaya Prema Ananda — Canang Sari Sebagai Persembahan](https://www.phdi.parisada.or.id/artikel.php?id=canang-sari-sebagai-persembahan) | 正文 canang、porosan、各色花材方向及献供诚意段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** PHDI 的传说性创制人说法没有可用历史年代，介绍不写确切起源；动作只截取供盘安放，不能视作全部 puja。

**同步：** [来源卡](../../content/traditions/balinese-canang-sari.md)、[场景 README](../../packages/scenes/src/balinese-canang-sari/README.md)；介绍字段按此范围扩充。


## barcelos-clay-rooster

标题：陶鸡报晓。最终来源 slug：`barcelos-clay-rooster`。

**实际器物与动作：** 彩绘陶鸡、画笔和圆台；胸前添叶芽→移圆台→静看/可选留言。

**可支持的文化与时间范围：** 葡萄牙布拉加区巴塞卢什的 figurado 陶塑、手捏/模制、集市和朝圣集会销售；20世纪中叶罗莎·拉马略等制作者受到关注、公鸡成为地方标志。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Portuguese Association of Cities and Villages of Ceramics — Barcelos](https://ceramicadeportugal.pt/en/barcelos-en/) | Pottery／Figurado 段：生活经济、制造方式、20世纪中叶工匠、公鸡和市场 | 网页正文已读；另行 HTTP 403 不作为正文来源；2026-10-20 |

**缺口、不能外推及产品简化：** 陶器总体历史不能当公鸡造型同样古老；本轮撤回旧 UI 对当前陶鸡“寓意好运”的泛化，主代理同步将 quiet/returning/done 收窄到叶芽彩纹、彩绘陈设及手作纹样。胸前叶芽和台座无传统仪式依据。市政府公鸡页失访，地方市方“Retratos do Galo no Comércio Local”PDF仅检索可见、直读超时/连接重置，不作为好运寓意已读证据；保留工艺与地方标志关联。

**同步：** [来源卡](../../content/traditions/barcelos-clay-rooster.md)、[场景 README](../../packages/scenes/src/barcelos-clay-rooster/README.md)；介绍字段按此范围扩充。


## basque-sunflower

标题：太阳花迎门。最终来源 slug：`basque-eguzkilore`。

**实际器物与动作：** 纸木太阳蓟花饰，装花心→挂门框木钉→静看/可选留言。

**可支持的文化与时间范围：** 西班牙巴斯克奥罗斯科高地牧人/农家门口 eguzkilore；太阳之花名称及保护家宅、抵御恶灵疾病雷暴的民俗信念。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Museo Etnográfico de Orozko — Los pobladores de las Tierras Altas](https://www.orozkomuseoa.eus/los-pobladores-de-las-tierras-altas) | Eguzkilore 段：牧人、baserritarras、门口及保护信念 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 没有确定起始年代；馆述信念不是产品效力。纸木拼装不是采放真植物的固定传统，不据此重建 Mari 仪式。巴斯克政府原链接失败未采用。

**同步：** [来源卡](../../content/traditions/basque-eguzkilore.md)、[场景 README](../../packages/scenes/src/basque-sunflower/README.md)；介绍字段按此范围扩充。


## blang-tea

标题：茶山一盏。最终来源 slug：`jingmai-tea-forest`。

**实际器物与动作：** 原创陶壶、茶叶、茶杯；添叶→倒杯→静看，不是祭茶祖。

**可支持的文化与时间范围：** 云南普洱惠民景迈山，布朗/傣族社区林下茶园；UNESCO 说明10世纪以来实践、森林村落系统、管理制度和茶祖/自然神灵信仰。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [UNESCO World Heritage Centre — Cultural Landscape of Old Tea Forests of the Jingmai Mountain in Pu’er](https://whc.unesco.org/en/list/1665/) | Description、Brief synthesis、社区管理和传统信仰相关段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 2023列名不是起源；不能由景观管理证明当前壶形和三步泡茶为布朗族独有茶礼；饮茶感谢是当下表达。

**同步：** [来源卡](../../content/traditions/jingmai-tea-forest.md)、[场景 README](../../packages/scenes/src/blang-tea/README.md)；介绍字段按此范围扩充。


## bokjori

标题：竹筛迎岁。最终来源 slug：`bokjori`。

**实际器物与动作：** 竹制淘米笊篱、米盘、墙挂点；舀少量米认识炊具→挂墙→静看。

**可支持的文化与时间范围：** 韩国岁首购买、悬挂竹笊篱，以捞米联想取福；除夕/初晨卖笊篱、全罗庆尚地方习惯、冬季家庭生产。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [韩国学中央研究院／崔常寿 — 복조리（1995编写，2023修订）](https://encykorea.aks.ac.kr/Article/E0023713) | 定义、内容段：岁首购挂、取福类比、商贩与地区制作 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 研究院条目是署名研究综述，支持被记录的习俗，不是起源文献。先舀米再挂墙不是固定迎岁程序；不设米粒数量效力。

**同步：** [来源卡](../../content/traditions/bokjori.md)、[场景 README](../../packages/scenes/src/bokjori/README.md)；介绍字段按此范围扩充。


## bonfim-ribbon

标题：栏前结愿。最终来源 slug：`bonfim-ribbon`。

**实际器物与动作：** 彩带已绕栏且预成三个松结；右/左/右收紧；无输入心愿表单。

**可支持的文化与时间范围：** 巴西萨尔瓦多 Senhor do Bonfim 信仰、腕踝和教堂栏杆系带、三个结对应三个心愿；19世纪 medida 与20世纪中叶纪念带形态变化。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Salvador da Bahia 市文旅／Jorge Gauthier — 10 histórias e curiosidades sobre as fitinhas do Bonfim](https://www.salvadordabahia.com/10-historias-e-curiosidades-sobre-as-fitinhas-do-bonfim/) | 第1–6节：系带、三个结、旧 medida、19世纪和1950年代变化 | 直接 HTTP 200 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 来源列1809首创又引更早1804记载，故只取19世纪前身、不下精确起源结论；不采用统一长度与颜色神灵通则；预成松结与交替拖动是简化。

**同步：** [来源卡](../../content/traditions/bonfim-ribbon.md)、[场景 README](../../packages/scenes/src/bonfim-ribbon/README.md)；介绍字段按此范围扩充。


## breton-banner

标题：节旗轻展。最终来源 slug：`breton-pardons`。

**实际器物与动作：** 原创太阳海浪布旗、横杆布耳、旗杆展座；展开扣杆→入座→静看。

**可支持的文化与时间范围：** 法国布列塔尼 pardon 的天主教赦罪/朝圣、14世纪虔敬背景、后来社区歌舞；游行旗帜/十字/圣像与志愿者准备。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [法国文化部 — La Bretagne, terre des pardons（2025-09-08）](https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons) | 起源于中世纪虔敬、主保弥撒、旗帜游行、社区准备与传承段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 14世纪是文化部综述的发展背景，不是所有堂区同年创设。太阳海浪无统一宗教解释，桌上陈列不完成 pardon。

**同步：** [来源卡](../../content/traditions/breton-pardons.md)、[场景 README](../../packages/scenes/src/breton-banner/README.md)；介绍字段按此范围扩充。


## bulgarian-survakane

标题：彩枝贺年。最终来源 slug：`bulgarian-survakane`。

**实际器物与动作：** 山茱萸枝、羊毛线爆米花装饰、坐着的亲友；提枝→移到背后→轻拍收回。

**可支持的文化与时间范围：** 保加利亚新年儿童持 survachka 拍背念健康幸福祝词；布尔加斯/斯特兰查材料象征与装饰差异。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Regional Historical Museum Burgas — Сурвачка](https://www.burgasmuseums.bg/bg/encdetail/survachka-227) | 山茱萸及 Странджа 信念、枝环、羊毛/爆米花/干果装饰段 | 网页相关正文已读；2026-10-20 |
| [Ana Popova／Institute for a Greater Europe — The Institute Presents: Traditions of New Years 2020-21（2020-12-31）](https://www.institutegreatereurope.com/articles/the-institute-presents-traditions-of-new-years-2020-21) | Bulgaria – Ana Popova 署名亲历段，尤其最后一段儿童枝条、拍背和祝词 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 无确证统一起源；枝材信念按博物馆记述归属，不能承诺健康。孩子身体、完整祝词和拜年往来未展现；三短拖只是控制。

**同步：** [来源卡](../../content/traditions/bulgarian-survakane.md)、[场景 README](../../packages/scenes/src/bulgarian-survakane/README.md)；介绍字段按此范围扩充。


## catalan-festival-giant

标题：巨偶待游。最终来源 slug：`catalan-gegants`。

**实际器物与动作：** 节庆巨偶小模型、花章、底座木把与圆台；别花→移模型→静看。

**可支持的文化与时间范围：** 西班牙加泰罗尼亚巨偶/音乐/舞蹈及协会传习；拉尔博斯1770书面记载、1827具名偶、1984复制偶。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Generalitat de Catalunya — Els Gegants, La Festa Major de l’Arboç](https://patrimonifestiu.cultura.gencat.cat/Festes-i-elements-festius-catalogats-o-declarats/Festes-Majors/La-Festa-Major-de-l-Arboc/Els-gegants) | 巨偶历史两段：1770、1827、1984 | 网页相关正文已读；2026-10-20 |
| [Agrupació de Colles Geganteres de Catalunya — Agrupació](https://gegants.cat/agrupacio/) | 协会目标、巨偶音乐舞蹈、研究保存和培训段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 地方档案年代不等于全加泰罗尼亚起源；本模型不对应 Llúcia/Chabran 等具名角色；花章与桌上陈列非巡游程序。

**同步：** [来源卡](../../content/traditions/catalan-gegants.md)、[场景 README](../../packages/scenes/src/catalan-festival-giant/README.md)；介绍字段按此范围扩充。


## chinese-diabolo

标题：空竹轻扬。最终来源 slug：`chinese-diabolo`。

**实际器物与动作：** 竹木双轮空竹、木轴、双杆细绳；提杆旋转→抛接（可重复）→收低停稳。

**可支持的文化与时间范围：** 北京天津等地竹木空竹、单/双轮、抖玩发声；明《帝京景物略》与定陵实物作为已有历史线索。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [中国非遗网 — 抖空竹](https://www.ihchina.cn/Article/Index/detail?id=13780) | 项目正文：明代文献/出土物、双轮竹木构造、牵绳抖玩及传承 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 明代证据非发明时间/发明人；不采用保健治疗主张；拖动阈值、抛接次数和反馈是简化，不是传统考级规则。

**同步：** [来源卡](../../content/traditions/chinese-diabolo.md)、[场景 README](../../packages/scenes/src/chinese-diabolo/README.md)；介绍字段按此范围扩充。


## chinese-incense

标题：炉前一炷。最终来源 slug：`chinese-incense`。

**实际器物与动作：** 三足陶炉、炉盖盖托、单支细香及纸套；开盖→插香孔→静烟，UI 当前明确妈祖语境。

**可支持的文化与时间范围：** 福建莆田湄洲相关妈祖信仰与海外移民传播；1150碑记为早期文献线索；泰国妈祖庙田野研究直接记录敬香/祈安。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [中国非遗网 — 妈祖信俗](https://www.ihchina.cn/mazuxinsu.html) | 信仰地域、海洋保护、祭祀及传播相关正文 | 网页相关正文已读；2026-10-20 |
| [何冬梅、王天玉 — 从妈祖信仰中的语言融合看泰国华人移民共同体的形成，《怀化学院学报》45卷1期，2026年2月，山东大学网站公开原文](https://ims.sdu.edu.cn/__local/5/BC/4A/07761FD1891987FDC2B100986DA_0198A60F_366C1.pdf) | PDF第1页早期文献和莆田；第2页移民社群；第4页（三）祭祀仪式，点香、上香及祈安 | PDF 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 旧卡一般香炉与祖先访谈不能单独证明妈祖，已补直接妈祖材料并撤回“未指定神明”描述。田野所述三炷/神位次序不移植为全国通则；当前一炷、盖托、纸套是产品选型。UNESCO 页面验证码、团标链接系统错误均未作为已读。

**同步：** [来源卡](../../content/traditions/chinese-incense.md)、[场景 README](../../packages/scenes/src/chinese-incense/README.md)；介绍字段按此范围扩充。


## chinese-rattle-drum

标题：拨浪轻响。最终来源 slug：`chinese-rattle-drum`。

**实际器物与动作：** 单个双面鼓、木柄、两根绳和木珠；右旋→左旋→收低，木珠交替击皮。

**可支持的文化与时间范围：** 台北故宫所藏南宋钱塘画家李嵩《市担婴戏》中的货郎摇鼓；货郎走村串巷、吟唱介绍杂货，儿童围拢。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [国立故宫博物院 — 畫琳瑯－貨郎圖特展（2021）](https://theme.npm.edu.tw/exh110/GemsofPainting/) | 展览概述及宋李嵩《市担婴戏》作品说明、作者时代 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 画作可证明南宋图像语境，不证明最初发明、现模型精确形制或古代礼乐身份。Grinnell 1517 页/接口超时、黄岩博物馆页超时，未称已读；新介绍不依赖这些失访源的玩具年代。

**同步：** [来源卡](../../content/traditions/chinese-rattle-drum.md)、[场景 README](../../packages/scenes/src/chinese-rattle-drum/README.md)；介绍字段按此范围扩充。


## chinese-shadow-puppet

标题：影偶小戏。最终来源 slug：`chinese-shadow-puppet`。

**实际器物与动作：** 原创纸制彩鸟、单片关节翼、双操纵杆、灯与幕；提主杆→移翼杆→静看。

**可支持的文化与时间范围：** 中国兽皮/纸影偶、分件竹扦与灯幕演出；宋代较成熟影戏记载；海宁方言声腔及婚寿/祈神场合是地方例。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [中国非遗网 — 皮影戏（海宁皮影戏）](https://www.ihchina.cn/project_details/13397.html) | 全国概述中的宋代文献/壁画、兽皮纸板与操杆；海宁项目地方声腔与使用场合 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 形成时代仍不确定；不能把海宁声腔、蚕花戏或任一传统角色套给原创小鸟。没有完整剧目、乐队和戏班表演。

**同步：** [来源卡](../../content/traditions/chinese-shadow-puppet.md)、[场景 README](../../packages/scenes/src/chinese-shadow-puppet/README.md)；介绍字段按此范围扩充。


## chinese-steelyard

标题：移砣平衡。最终来源 slug：`chinese-steelyard`。

**实际器物与动作：** 木杆、金属砣、垂直吊绳、柑橘浅盘、提环；移砣找平→提环→缓放。

**可支持的文化与时间范围：** 中国19世纪馆藏杆秤有配重、盘、木盒与不同支点/量程，支持移动配重找平的称量关系。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Science Museum Group — Chinese steelyard balance, 19th century](https://collection.sciencemuseumgroup.org.uk/objects/co57930/chinese-steelyard-balance-19th-century) | 馆藏描述、材料、19世纪和三支点/标尺说明 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 馆藏象牙梁而当前木梁，未复制精确器物；19世纪是馆藏年代非发明时间。当前无校准读数和真实称量，不赋予公平祈愿等未经证实寓意。台湾馆藏 URL 失败未采用。

**同步：** [来源卡](../../content/traditions/chinese-steelyard.md)、[场景 README](../../packages/scenes/src/chinese-steelyard/README.md)；介绍字段按此范围扩充。


## chinese-suanpan

标题：拨珠见数。最终来源 slug：`chinese-zhusuan`。

**实际器物与动作：** 七档上二下五算盘；依次拨出3、8、18，靠梁计数。

**可支持的文化与时间范围：** 珠算工具、明代商业发展与程大位算书传播；上珠五下珠一、位值及进位关系。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [中国非遗网 — 珠算](https://www.ihchina.cn/project_details/15272.html) | 项目正文中明代商品经济、《直指算法统宗》及向日本朝鲜东南亚传播 | 网页相关正文已读；2026-10-20 |
| [J. J. O’Connor、E. F. Robertson／University of St Andrews — Chinese numerals（2004-01）](https://mathshistory.st-andrews.ac.uk/HistTopics/Chinese_numerals/) | 算盘示数46802及上下珠计数、进位说明；不采用其起源推测 | 直接 HTTP 200 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 各源对早期算盘起源表述不同，本次不用汉代/14世纪发明断言，只用明代传播阶段；固定数字和动作是教学示例。

**同步：** [来源卡](../../content/traditions/chinese-zhusuan.md)、[场景 README](../../packages/scenes/src/chinese-suanpan/README.md)；介绍字段按此范围扩充。


## chinese-tangram

标题：七巧归方。最终来源 slug：`chinese-tangram`。

**实际器物与动作：** 七块几何板，四片已放，移小三角/方片/平行四边形合方。

**可支持的文化与时间范围：** 五三角、一方、一平行四边形；1813图谱、19世纪初贸易出口及1817–1818欧美传播记录。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [ChinesePuzzles.org — Tangram Puzzle（藏品与图谱研究）](https://chinesepuzzles.org/tangram-puzzle/) | 七片组成、1813图谱、早期出口盒、1817/1818传播及早期家具关联讨论 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 使用收藏者对实物和图谱的原始研究，不能将宋代燕几与明蝶几推测写成已证实起源；配色和三片步骤原创。

**同步：** [来源卡](../../content/traditions/chinese-tangram.md)、[场景 README](../../packages/scenes/src/chinese-tangram/README.md)；介绍字段按此范围扩充。


## chinese-woodblock-print

标题：木版留春。最终来源 slug：`chinese-woodblock-print`。

**实际器物与动作：** 木版枝叶图、纸、棕擦；纸背刷压→揭角→看印迹/可选留言。

**可支持的文化与时间范围：** 中国反刻木版、唐宋线索、雕版持续书籍应用、扬州清代及近现代作坊/教学，棕把与棕擦分工。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [中国非遗网／文旅中国杨晓君 — 中国雕版印刷技艺（2020-12-29）](https://www.ihchina.cn/tjq_information_detail/22182.html) | 历史、扬州清代和1958年印刷机构、刻版和刷印工具工序段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 不定精确隋朝发明年；枝叶图、短句及留春寓意不是传统祈愿印式。制版/着墨/覆纸省略，仅演刷印揭纸。

**同步：** [来源卡](../../content/traditions/chinese-woodblock-print.md)、[场景 README](../../packages/scenes/src/chinese-woodblock-print/README.md)；介绍字段按此范围扩充。


## chinowa-kuguri

标题：茅环祈安。最终来源 slug：`chinowa-kuguri`。

**实际器物与动作：** 已扎茅草环与双柱；左绕/右绕/左绕穿环，最后停环前。

**可支持的文化与时间范围：** 东京葛西神社六月三十夏越大祓、罪秽净祓和后半年无病息灾；左/右/左绕、之后赴本殿。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [葛西神社 — 夏越の大祓](https://www.kasaijinja.jp/event/nagoshi.html) | 夏越大祓说明、茅の輪くぐり、作法与图示相关正文 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 具体社例不推广全国唯一；文献歌句年代非穿环起源。人形、唱诵与本殿礼敬未演出，不以三圈代表全部大祓。

**同步：** [来源卡](../../content/traditions/chinowa-kuguri.md)、[场景 README](../../packages/scenes/src/chinowa-kuguri/README.md)；介绍字段按此范围扩充。


## clootie-well-rag

标题：井边放下。最终来源 slug：`clootie-well-rag`。

**实际器物与动作：** 纯棉布、水井与低枝；浸水→系枝→松手，布变化不作病愈反馈。

**可支持的文化与时间范围：** 苏格兰曼洛希管理方记述 cloot、浸井系树及布朽病退信念；当代养护要求小片天然可降解材料。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Forestry and Land Scotland — Munlochy Clootie Well](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well) | Clootie Well 解释、病苦/布朽信念与纯棉纯羊毛材料要求 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 未确定起源或连续传承年代；不设不可取回等统一禁忌，不把求愈改成纯心理疗愈。只对应本井址，其他圣井另查。

**同步：** [来源卡](../../content/traditions/clootie-well-rag.md)、[场景 README](../../packages/scenes/src/clootie-well-rag/README.md)；介绍字段按此范围扩充。


## crane

标题：折一只纸鹤。最终来源 slug：`origami-crane-senbazuru`。

**实际器物与动作：** 纸折颈尾双翼→托起→可留和平愿望；单只纸鹤。

**可支持的文化与时间范围：** 广岛佐佐木祯子经历、1955年折鹤求康复和去世、儿童纪念碑与世界奉献纸鹤的和平纪念。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [广岛市 — Paper Cranes and the Children’s Peace Monument](https://www.city.hiroshima.lg.jp/english/peace/1033408/1009685.html) | Sadako Sasaki、儿童和平纪念碑与世界送鹤段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 1955属于具体人物/纪念史，不是折纸鹤工艺起源；不称一只等同千羽、数量保证康复；留言和简化折法是产品。

**同步：** [来源卡](../../content/traditions/origami-crane-senbazuru.md)、[场景 README](../../packages/scenes/src/crane/README.md)；介绍字段按此范围扩充。


## croatian-licitar-heart

标题：彩心相赠。最终来源 slug：`croatian-licitar`。

**实际器物与动作：** 红色面团心、裱花袋糖霜、布带、展架木钉；装饰→悬挂→静看/可选留言。

**可支持的文化与时间范围：** 克罗地亚北部姜饼工艺、蜂蜜蜡烛兼业、烤干彩饰；婚礼心形、姓名日期、小镜及代际传习。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Croatian Ministry of Culture and Media — Gingerbread craft from Northern Croatia](https://min-kulture.gov.hr/kulturna-bastina/nematerijalna-kulturna-bastina/nematerijalna-dobra-upisana-na-unesco-ov-reprezentativni-popis-nematerijalne-kulturne-bastine-covjecanstva/gingerbread-craft-from-northern-croatia-eng/6291) | 工艺来源背景、面团制作、心形婚礼纪念及传承段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 中世纪欧洲修道院背景非克罗地亚本地精确起源；原创纹样/挂架/留言不是固定礼赠仪式；非现实食品教程。

**同步：** [来源卡](../../content/traditions/croatian-licitar.md)、[场景 README](../../packages/scenes/src/croatian-licitar-heart/README.md)；介绍字段按此范围扩充。


## czech-bead-star

标题：珠星映光。最终来源 slug：`czech-glass-bead-ornaments`。

**实际器物与动作：** 银蓝空心珠六角星、铁线骨架；补最后珠串→右旋→静看。

**可支持的文化与时间范围：** 捷克波尼克拉/克尔科诺谢地区19世纪末随圣诞树风尚生产吹玻璃珠饰；家庭和 Rautis 延续、玻璃处理裁切着色组装。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Embassy of the Czech Republic in Tallinn — Technique of the production of Christmas decorations on the UNESCO list（2020-12-26）](https://mzv.gov.cz/tallinn/en/culture_and_education/technique_of_the_production_of_christmas.html) | 开头19世纪末、Poniklá/Rautis、十二人制作及体验组装段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 2020列名非起源；银蓝六角星不赋固定祈愿意义。NÚLK申报PDF本轮超时、Rautis页403/超时未视已读；新介绍只用已读使馆正文支持的工艺范围。

**同步：** [来源卡](../../content/traditions/czech-glass-bead-ornaments.md)、[场景 README](../../packages/scenes/src/czech-bead-star/README.md)；介绍字段按此范围扩充。


## czech-wooden-ratchet

标题：木齿轻转。最终来源 slug：`czech-wooden-ratchet`。

**实际器物与动作：** 素色木框绕固定柄转动、齿轮拨弹性木舌；三段合一圈，合成反馈非录音。

**可支持的文化与时间范围：** 捷克杜布博物馆的圣周四至六停钟、响器召集礼拜、复活节习俗及多种馆藏形态。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Podještědské muzeum／Muzeum Český Dub — Předmět / téma měsíce dubna (2024): Velikonoční řehtačka（2024-03-26）](https://www.muzeumceskydub.cz/540-predmet-tema-mesice-dubna-2024.html) | 圣周停钟/召集礼拜、馆藏大小不同及用途变化三段 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 未定捷克仪式起源；博物馆列举欧洲其他用途不等于捷克同一谱系。Grinnell975及API失败不记已读；结构按实际模型描述，不冒充馆藏复刻。

**同步：** [来源卡](../../content/traditions/czech-wooden-ratchet.md)、[场景 README](../../packages/scenes/src/czech-wooden-ratchet/README.md)；介绍字段按此范围扩充。


## dalarna-wooden-horse

标题：木马安放。最终来源 slug：`dalarna-wooden-horse`。

**实际器物与动作：** 彩鞍木马、软布、木座；轻拭→放座→静看。

**可支持的文化与时间范围：** 瑞典达拉纳地方木马、1939纽约世博会瑞典馆大红马与国家象征传播；博物馆多样历史/当代作品。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Dalarnas museum — Dalahästar: En Sverigesymbol](https://dalarnasmuseum.se/utstallningar/fasta-utstallningar/dalahastar/) | 1939世博会与馆内较早/当代木马展示段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 1939为传播节点不是木马起源；不声称家屋护佑、统一纹样或保养三步传统。

**同步：** [来源卡](../../content/traditions/dalarna-wooden-horse.md)、[场景 README](../../packages/scenes/src/dalarna-wooden-horse/README.md)；介绍字段按此范围扩充。


## daruma-eye-painting

标题：达摩点睛。最终来源 slug：`daruma-eye-painting`。

**实际器物与动作：** 纸偶式达摩与笔、木座；首次点一目/留愿/归座，回访仅在愿成或平安一年时补目。

**可支持的文化与时间范围：** 日本高崎丰冈传承、1829售偶图文、1859进口颜料、张子工法；鹤眉龟须、立愿与事成/一年平安后补目。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [高崎市 — 高崎だるま（R）の歴史について（2023-12-18更新）](https://www.city.takasaki.gunma.jp/page/3053.html) | 高崎历史、1829资料发现、木型/张子、1859颜料与脸部象征段 | 网页相关正文已读；2026-10-20 |
| [高崎市 — 高崎だるま（R）について（2023-12-18更新）](https://www.city.takasaki.gunma.jp/site/sightseeing/3052.html) | 鹤眉龟须及点一目、愿成/一年平安补另一目正文 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 不用旅游页的概括起源推测；观者右=偶自身左是视角差异。任意回访不构成补目条件；目标输入和归座动画属于产品。

**同步：** [来源卡](../../content/traditions/daruma-eye-painting.md)、[场景 README](../../packages/scenes/src/daruma-eye-painting/README.md)；介绍字段按此范围扩充。


## diya-oil-lamp

标题：灯旋一瞥。最终来源 slug：`diya-oil-lamp`。

**实际器物与动作：** 三盏陶灯、棉芯、托盘，无神像；点三灯→单灯沿金弧一圈→归盘。

**可支持的文化与时间范围：** 密歇根坎顿 Hindu Temple 对自身 Aarati 的说明：灯盘在神像前顺时针移动、光代表知识/指引、驱不利影响信念。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Hindu Temple, Canton, Michigan — Temple Visit FAQ](https://www.thehindutemple.org/temple-information--47/pages/temple-visit-faq) | “Priest holding a plate with small oil lamps”问答全文、末尾寺址 | 直接 HTTP 200 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 仅有当代社群说明，不确定古代起源，也不代表所有印度教派；三灯数量和单灯圆轨非来源完整献光。SMG油灯429失访，未复用旧已读年代表述；不混作排灯节全流程。

**同步：** [来源卡](../../content/traditions/diya-oil-lamp.md)、[场景 README](../../packages/scenes/src/diya-oil-lamp/README.md)；介绍字段按此范围扩充。


## ema-votive-plaque

标题：木牌记愿。最终来源 slug：`ema-votive-plaque`。

**实际器物与动作：** 花叶木牌、双孔绳、横梁；翻背→短愿/留白→挂，回访致谢。

**可支持的文化与时间范围：** 日本绘马用于神社寺院等祈愿感谢；马的奉献物背景、奈良时代遗址实物、室町后图像尺寸多样。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Iwai Hiroshi／Kokugakuin University, Encyclopedia of Shinto — Ema](https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9608) | 祈愿感谢、献马与木板、Iba/Hieda奈良遗址、室町及小型绘马段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 奈良实物是已见年代非发明时刻；花叶图、翻面及同牌回访为产品，不给所有神社规定相同流程。

**同步：** [来源卡](../../content/traditions/ema-votive-plaque.md)、[场景 README](../../packages/scenes/src/ema-votive-plaque/README.md)；介绍字段按此范围扩充。


## english-hearth-bellows

标题：风囊轻送。最终来源 slug：`english-hearth-bellows`。

**实际器物与动作：** 原创木叶皮革风囊黄铜嘴；抬柄展开→压合送气→松柄。

**可支持的文化与时间范围：** 英国国民信托德罗戈城堡约1900木皮风箱为英国使用例证；另一博物馆家居实物说明风箱炉火用途和木皮铜结构。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [National Trust Collections — Bellows, 903156](https://www.nationaltrustcollections.org.uk/object/903156) | 馆藏摘要、wood and leather、1900、Castle Drogo／Drewe collection | 直接 HTTP 200 相关正文已读；2026-10-20 |
| [Northwest Museum of Arts and Culture — Bellows](https://collectionsportal.northwestmuseum.org/document/bellows/666c014f2863bc4c5f8271a2) | Campbell House 壁炉、木皮铜嘴、1898–1924记录；只取工作用途 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 1900为器物年代非起源，不能推英国独有；美国馆藏仅证结构/用途，不标成英国产；眼前无炉火及真实风量。

**同步：** [来源卡](../../content/traditions/english-hearth-bellows.md)、[场景 README](../../packages/scenes/src/english-hearth-bellows/README.md)；介绍字段按此范围扩充。


## estonian-village-swing

标题：秋千轻荡。最终来源 slug：`estonian-village-swing`。

**实际器物与动作：** 原创木架、双木臂悬台；推远→回摆→收稳。

**可支持的文化与时间范围：** 爱沙尼亚露天博物馆复活节/秋千节说明，青年搭秋千、姑娘携礼答谢；当代博物馆秋千场仍办仲夏聚会。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Estonian Open Air Museum — Spring](https://evm.ee/about/folk-calendar/spring) | Moving holiday – Easter 完整段落 | 直接 HTTP 200 相关正文已读；2026-10-20 |
| [Estonian Open Air Museum — Swing grounds](https://evm.ee/venue-hire/event-spaces/swing-grounds) | 场地用于仲夏夜及聚会的首段（不用价格） | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 没有最初起源或统一古代年代；当前台式秋千不是某村实物复原，单人短拖不演完整男女社交礼俗。

**同步：** [来源卡](../../content/traditions/estonian-village-swing.md)、[场景 README](../../packages/scenes/src/estonian-village-swing/README.md)；介绍字段按此范围扩充。


## faroese-wool-knit

标题：毛线织暖。最终来源 slug：`faroese-wool-knitting`。

**实际器物与动作：** 普通下针、木针、奶白灰条纹织片；穿旧圈→带新圈退旧圈→静看。

**可支持的文化与时间范围：** 法罗群岛羊毛加工、衣物/当代设计产业，家校旅途中编织与定期女性编织圈。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Faroe Islands official portal — Wool & Fashion](https://www.faroeislands.fo/arts-culture/wool-fashion) | 羊毛是黄金、材料处理、针织日常及 knitting clubs 段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 本轮使用当代官方生活文化说明，无针织起源年代；普通下针非当地独有，奶白灰纹无固定神圣/祈福意义。

**同步：** [来源卡](../../content/traditions/faroese-wool-knitting.md)、[场景 README](../../packages/scenes/src/faroese-wool-knit/README.md)；介绍字段按此范围扩充。


## fgs-buddha-bathing

标题：浴佛发愿。最终来源 slug：`fgs-buddha-bathing`。

**实际器物与动作：** 太子像一手指天一手指地、莲座水盆木杓；右肩/左肩/右肩三杓，与止恶/行善/度众生对应。

**可支持的文化与时间范围：** 佛光山机构自身解释佛诞叙事、香水浴像、净化贪瞋痴与身口意；台湾宜兰1954年星云法师庆典包括浴佛。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [佛光山 English Dharma Services／智同法师与 Kathryn — Buddhist Festivals: Buddha’s Birthday Celebration（页面并列2022-05-07、2024-03-30，未推定后者性质）](https://fgseds.foguangpedia.org/2022/05/07/buddha_birthday/) | II诞生故事、III浴佛步骤、V四重意义、VI宜兰1954庆典 | 直接 HTTP 200 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 佛传是信仰叙事非可直接定年的起源；1954仅佛光山前史庆典节点非浴佛起源；三杓按该机构而非全佛教统一规则。礼拜跪坐、完整唱诵未演出。

**同步：** [来源卡](../../content/traditions/fgs-buddha-bathing.md)、[场景 README](../../packages/scenes/src/fgs-buddha-bathing/README.md)；介绍字段按此范围扩充。


## fijian-woven-fan

标题：叶扇纳凉。最终来源 slug：`fijian-iri-fan`。

**实际器物与动作：** 露兜叶交织扇面、骨架、劈柄绑带；接绑带→放展座→静看。

**可支持的文化与时间范围：** 斐济19世纪编扇收藏与叶材日用；奥克兰 iri 馆藏叶条盘绕芦框、劈木柄夹叶绑固。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Torquay Museum — Fijian Hand Fan (Irubali)](https://torquaymuseum.org/collections-spotlight/fijian-hand-fan-irubali) | 19世纪斐济藏品与 pandanus 制衣/席/扇段 | 直接 HTTP 200 正文已读；2026-10-20 |
| [Auckland War Memorial Museum／Google Arts & Culture — Iri (Fan)](https://artsandculture.google.com/asset/PgGAsAZ1GYOt6g) | 藏品说明：voivoi 盘绕 titi、劈柄及绑定 | 直接 HTTP 200 馆藏正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 19世纪是馆藏范围非编扇起源；原物盘绕与当前交织不同；不能由编扇推卡瓦礼或 sevusevu 要求；展座/静看是当代欣赏。

**同步：** [来源卡](../../content/traditions/fijian-iri-fan.md)、[场景 README](../../packages/scenes/src/fijian-woven-fan/README.md)；介绍字段按此范围扩充。


## finnish-birch-basket

标题：桦篮拾光。最终来源 slug：`finnish-birch-bark-craft`。

**实际器物与动作：** 长方桦皮交织篮、可拆弯柄、谷粒、木勺布垫；接柄→放垫→静看。

**可支持的文化与时间范围：** 芬兰东部桦皮 kylvinkopsa 的粮盐面粉/播种用途，与西芬兰白杨板容器不同；1920–1930年代机械播种扩展。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Leena Furu-Kallio／National Museum of Finland — Seedlip (kylvövakka)（2020-06-01）](https://suomenkansallismuseo.fi/en/exhibit/siemenpoenttoe-nauriin-ja-pellavan-siemenien-saeilyttaemiseen-4/) | 手播/机械、东部桦皮容器与西部弯白杨板区分段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 博物馆主图是西芬兰白杨板，不能称其为桦篮复刻；机械年代不是桦编起源；弯柄拼装与灰绿垫无祈愿程序。

**同步：** [来源卡](../../content/traditions/finnish-birch-bark-craft.md)、[场景 README](../../packages/scenes/src/finnish-birch-basket/README.md)；介绍字段按此范围扩充。


## finnish-kantele

标题：五弦轻拨。最终来源 slug：`finnish-kantele`。

**实际器物与动作：** 原创五钢弦木琴、长中短三弦拨动回振，合成声音。

**可支持的文化与时间范围：** 芬兰康特勒协会说明5至39弦乐器家族、波罗的海近缘乐器、木体金属弦、音乐教育和当代多风格演出。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Eija Kankaanranta、Satu Sopanen／Kantele Association — The Kantele](https://www.kantele.net/kantele/in-english) | 乐器家族、Baltic psaltery、制作/指拨、教育与当代音乐段 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 没有五弦琴最早年代；不采用神话发明或泛化疗愈。三次拨弦非传统曲目，音色非真实乐器录制。

**同步：** [来源卡](../../content/traditions/finnish-kantele.md)、[场景 README](../../packages/scenes/src/finnish-kantele/README.md)；介绍字段按此范围扩充。


## floating-lantern-loy-krathong

标题：叶舟寄意。最终来源 slug：`floating-lantern-loy-krathong`。

**实际器物与动作：** 折叶舟、花座、蜡烛芯、水面；添花→点芯→推水，非天灯。

**可支持的文化与时间范围：** 泰国阴历十二月满月水灯节、礼敬水神/送厄迎福；夜功府美功河香蕉茎杯与地区差异、当代素可泰节庆约五十年。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Tourism Authority of Thailand — Loi Krathong Festival 2024: Experience Thailand’s Enchanting Festival of Lights（2024-11-06）](https://www.tatnews.org/2024/11/loi-krathong-festival-2024-experience-thailands-enchanting-festival-of-lights/) | 开头历日/水神意义；Sukhothai、Loi Krathong Kap Kluai Mueang Mae Klong、Tak 各地段 | 直接 HTTP 200 相关正文已读；2026-10-20 |
| [中国非遗网 — 中元节（资源河灯节）](https://www.ihchina.cn/project_details/15278/) | 资江航运悼亡、设道场超度、祈求平安段；只用于修正源卡另述的中国支系，未移入泰国场景介绍 | 直接 HTTP 200 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 官方旅游页中的传说不能确定古代起源，2024举办日期不是传统年代；不移植中国中元悼亡意义。三步和短句是简化，现实按当地清理规则。

**同步：** [来源卡](../../content/traditions/floating-lantern-loy-krathong.md)、[场景 README](../../packages/scenes/src/floating-lantern-loy-krathong/README.md)；介绍字段按此范围扩充。


## french-coffee-mill

标题：手磨晨光。最终来源 slug：`french-coffee-mill`。

**实际器物与动作：** 木盒、金属料斗、曲柄钢轴、抽屉与豆粉；两半周→开屉。

**可支持的文化与时间范围：** 法国标致自述1840起咖啡磨制造，现售 Brésil 木盒曲柄磨的料斗、磨芯与抽屉结构。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Peugeot Saveurs — Brésil, manual coffee mill in walnut stained beechwood, 21 cm](https://fr.peugeot-saveurs.com/en_fr/bresil-manual-coffee-mill-in-walnut-stained-beechwood-21-cm-8in.html) | 产品正文 “since 1840”、方木盒、曲柄、料斗和抽屉说明 | 网页相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 生产者1840沿革非咖啡磨发明时间；产品介绍作为自身制造证据，不当全法国史；原创模型与两半圈出粉非实物性能/完整研磨。

**同步：** [来源卡](../../content/traditions/french-coffee-mill.md)、[场景 README](../../packages/scenes/src/french-coffee-mill/README.md)；介绍字段按此范围扩充。


## french-petanque

标题：银球近靶。最终来源 slug：`french-petanque`。

**实际器物与动作：** 木靶、两金属球、砂地圈线；送靶→第一球→第二球，未计分。

**可支持的文化与时间范围：** 法国拉西奥塔对儒勒·于格/欧内斯特·皮蒂奥的地方起源叙事，风湿限制助跑、双脚留圈与短距、1910首场正式赛。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [Office de Tourisme de La Ciotat — La pétanque](https://www.destinationlaciotat.com/profiter/loisirs-en-plein-air/la-petanque/) | la longue、Jules Hugues/Ernest Pitiot、缩距站圈、1910比赛及地方传承 | 直接 HTTP 200 正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 以当地机构叙事归属，不把口述起源扩成所有滚球起源；现三抛没有队伍计分和完整规则，不称完整比赛。

**同步：** [来源卡](../../content/traditions/french-petanque.md)、[场景 README](../../packages/scenes/src/french-petanque/README.md)；介绍字段按此范围扩充。


## furin-wind-chime

标题：风铃一响。最终来源 slug：`furin-wind-chime`。

**实际器物与动作：** 玻璃铃、悬绳、舌和纸条；点铃/拂条→听余音→点止，UI明确平安度夏。

**可支持的文化与时间范围：** 奈良橿原真言宗おふさ观音寺夏季求平安背景及2003开始风铃祭、寺方祓厄/清凉解释；江户玻璃风铃吹制内画及纸条发声。

| 直接来源、机构与完整 URL | 实际阅读位置 | 访问状态及日期 |
| --- | --- | --- |
| [高野山真言宗別格本山 おふさ観音 — 風鈴まつり](https://www.ofusa.jp/highlights/windbell) | 风铃祭缘起、当地夏季疾病/参拜、2003年开始及祓厄清凉段 | 网页相关正文已读；2026-10-20 |
| [Tokyo Tokyo official website — Tokyo Tokyo江戸風鈴](https://tokyotokyo.jp/ja/action/omiyage/id26/) | 玻璃、手吹、内侧绘画、短册和清凉声音产品正文 | 直接 HTTP 200 相关正文已读；2026-10-20 |

**缺口、不能外推及产品简化：** 2003仅该寺现代祭典启动年；不从寺方说明外推全日本风铃或神道统一规则。旧卡当前仅生活听觉的范围已更新，保留宗教性；点击和停音非寺院仪轨。

**同步：** [来源卡](../../content/traditions/furin-wind-chime.md)、[场景 README](../../packages/scenes/src/furin-wind-chime/README.md)；介绍字段按此范围扩充。

## 本组交付核查

- [x] 42 项实际器物、提示、步骤、返回行为与介绍逐项对照；来源卡中花砖绘色、茶壶煮茶、木马描饰、桦篮末端编织等与当前操作不符的旧描述已直接纠正。
- [x] 42 项均有本轮实际读取的直接来源；54 条来源记录保留阅读章节、读取方式及日期。失访、验证码及摘要不计已读，文献、馆藏年代、当代节庆起点与起源有明确区分。
- [x] 妈祖敬香补入直接信仰资料，奈良风铃补入寺方祈安解释；普通工艺不借同地区宗教总卡，宗教实践不改写成单纯放松。
- [x] 42 张专卡与 42 份 README 均有且仅有一个本轮核查区段，并回链对应研究锚点。所有最终 slug 与分配清单一致，无来源重绑。
- [x] 舟模回访的“海上谢恩传统”和陶鸡旧提示的统一好运寓意，已由主代理按本组建议收窄；记录保留撤回依据。交互、完成条件和技术 ID 不变。
- [x] Node 直接加载 `a.ts` 成功；42 个键与分配清单完全一致，均为两段，移除分段符后为 201–265 个字符；禁用文案词检查通过。
- [x] 本组 84 份卡/README 与介绍、研究文件范围的 `git diff --check` 通过。没有提交或推送。

宿主接入、统一测试、构建与浏览器分段显示验证由主代理记录；上述字段与语法检查不替代逐项文化证据审阅。
