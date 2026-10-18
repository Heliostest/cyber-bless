# 全场景文化来源核查：B组（2026-10-19）

基线：`artifacts/culture-audit/2026-10-19/group-b.json` 的25项。此记录只评估该组场景的文化归属、物件、实际动作和介绍；不评定模型是否逐件复制馆藏，不把页面所属国家或博物馆所在地当作器物产地。铁舌轻鸣 `malawi-sansi` 未查看、未修改。未提交或推送。

使用 research 技能。已核对输入介绍、`scene.ts` 的COPY/物件/交互锚点、清单中已有README及其文化边界、现来源卡概述/仪式/材料/手机构思与来源列表。清单未给README的条目检查了实际文件；其中泉景与旅途手记在审查期间由主代理新增了修正README，已补读。无README的条目以实际代码与来源卡交叉核查。

结论为17项 `relink`（保留真实器物关联，改挂专卡）、5项 `copy-fix`（保留归属，修正来源/概括）、2项 `original`（转入 `product-original`）、1项 `keep`。这是实施前的判断，不表示主代理尚未实施。

判据：主源能直接支持器物/材料与文化关联即可；原创配色、几何和简化动作并不自动消除文化关联。但来源没有支持的操作、纹样含义、许愿顺序、护佑或疗效不能伪装成传统。没有找到支持不等于断言某种传统从未存在。专卡不应继承旧大卡中不相干的朝圣、火跑、熊礼、链舞图片作为器物证据。

来源状态 `read` 表示本次实际打开并读取相关正文（包含普通HTTP正文读取）；`index-only`、`blocked-challenge`、`failed` 或重定向列表均不冒称正文已读。人机验证未绕过；失败后优先改用承传机构、地方教会、政府、博物馆、官方申报原文件等替代。官方资料中的古老起源或神效也只按有依据的特定事实采用。

## 调整索引

| 场景 | 当前slug（审查基线） | 判断 | 推荐slug |
| --- | --- | --- | --- |
| aland-votive-ship | aland-folk | relink | aland-votive-ship |
| andalusian-ceramic-tile | andalusian-folk | relink | andalusian-ceramic-tile |
| barcelos-clay-rooster | portuguese-romarias | relink | barcelos-clay-rooster |
| basque-sunflower | basque-folk | relink | basque-eguzkilore |
| breton-banner | breton-pardons | copy-fix | breton-pardons |
| catalan-festival-giant | catalan-folk | relink | catalan-gegants |
| celtic-folk-spring | celtic-folk | original | product-original |
| clootie-well-rag | clootie-well-rag | copy-fix | clootie-well-rag |
| croatian-licitar-heart | croatian-folk | relink | croatian-licitar |
| czech-bead-star | czech-moravian-folk | relink | czech-glass-bead-ornaments |
| czech-pilgrim-journal | czech-moravian-folk | original | product-original |
| dalarna-wooden-horse | dalecarlian-folk | relink | dalarna-wooden-horse |
| faroese-wool-knit | faroese-folk | relink | faroese-wool-knitting |
| finnish-birch-basket | finnish-karelian-folk | relink | finnish-birch-bark-craft |
| hungarian-embroidery-hoop | hungarian-folk | relink | hungarian-embroidery |
| italian-ex-voto | italian-ex-voto | copy-fix | italian-ex-voto |
| lithuanian-straw-garden | baltic-folk | relink | lithuanian-straw-gardens |
| polish-blessing-basket | polish-folk-catholic | copy-fix | polish-folk-catholic |
| polish-paper-cut | polish-folk-catholic | relink | polish-wycinanki |
| slavic-wreath | slavic-folk | relink | kupala-wreath |
| slovak-wire-bird | slovak-folk | relink | slovak-wire-craft |
| sorbian-painted-egg | sorbian-folk | relink | sorbian-easter-eggs |
| st-brigids-cross | st-brigids-cross | keep | st-brigids-cross |
| votive-candle-catholic | votive-candle-catholic | copy-fix | votive-candle-catholic |
| welsh-love-spoon | welsh-folk | relink | welsh-love-spoons |

## 1. 舟模寄谢 · aland-votive-ship

**结论：relink；推荐 `aland-votive-ship`（奥兰教堂船模）。**

实际动作：插桅杆→船模放船架→静看或写感谢。本地核查入口：`packages/scenes/src/aland-votive-ship/scene.ts`；来源卡 `content/traditions/aland-folk.md`。README：`packages/scenes/src/aland-votive-ship/README.md`。

支持的文化事实：奥兰伦帕兰堂区的圣安德烈教堂保存捐赠船模。 克卡尔市镇记述圣安娜教堂木船模型，并把它与当地海上遭遇传说联系；教堂船各有献置背景。 [Lemland-Lumparlands församling — S:t Andreas](https://www.lemland-lumparland.evl.ax/kyrkor-och-lokaler/st-andreas)；[Kökar municipality — St Anna's church](https://www.kokar.ax/st-annas-kyrka?lang=en)。

不支持或须收缩的主张：

- 不能将所有奥兰教堂船概括为海难脱险后的还愿或感谢平安归来。
- 本场景组桅杆、放船架、写短句没有被证实为当地传统献置程序。

具体修正：替换aland-folk宗教与仲夏大卡。专卡限定教堂船的器物、捐赠与海洋记忆，不把帆船模型当作某件馆藏复原；不要继承通用护佑/功德解释。

可采用的用户介绍：

> 奥兰群岛的教堂里保存着航海船模，捐赠与地方故事让它们承载不同的海洋记忆。将木桅杆接入小船的桅座，再把船模放上船架，静看帆桅与木纹，也可以留一句感谢。

来源已读状态与可支持范围：

- **read** — [Lemland-Lumparlands församling — S:t Andreas](https://www.lemland-lumparland.evl.ax/kyrkor-och-lokaler/st-andreas)：堂区直接记载现存votivskepp及捐赠者；HTTP正文已读。
- **read** — [Kökar municipality — St Anna's church](https://www.kokar.ax/st-annas-kyrka?lang=en)：市镇正文记述木制教堂船及Olle遭遇海盗船的传说；HTTP正文已读。
- **failed-timeout; index-only** — [Kyrkor.ax — Lumparland church](https://www.kyrkor.ax/churches/lumparland-chapelchurch/)：直接访问超时，索引中捐赠日期互异；不据此作日期结论。

## 2. 釉彩映晴 · andalusian-ceramic-tile

**结论：relink；推荐 `andalusian-ceramic-tile`（特里亚纳陶瓷与花砖）。**

实际动作：嵌入中央花砖→整幅放展托→静看或写短句。本地核查入口：`packages/scenes/src/andalusian-ceramic-tile/scene.ts`；来源卡 `content/traditions/andalusian-folk.md`。README：`packages/scenes/src/andalusian-ceramic-tile/README.md`。

支持的文化事实：塞维利亚特里亚纳有明确的陶瓷生产传统。 Centro Cerámica Triana保存旧Santa Ana陶厂窑炉、颜料容器、陶轮及绘制花砖面板的工作设施。 [Visita Sevilla — Triana Ceramic Center](https://visitasevilla.es/en/triana-ceramic-center/)；[Junta de Andalucía — Centro Cerámica Triana](https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/evento/centro-ceramica-triana)。

不支持或须收缩的主张：

- El Rocío或圣周朝圣资料不能为花砖工艺提供直接依据。
- 蓝白配色、花瓣纹、九砖拼合与木框展托不应被称为特里亚纳固定传统或祈福步骤。

具体修正：README已有正确直接来源，但用户入口仍指向andalusian-folk宗教大卡；换专卡，当前用户介绍可保留。不要用旧骑马朝圣图片作花砖的证据或配图。

来源已读状态与可支持范围：

- **read** — [Visita Sevilla — Triana Ceramic Center](https://visitasevilla.es/en/triana-ceramic-center/)：城市官方旅游机构说明陶艺传统、原址窑炉、职业关系及陶瓷展览。
- **read** — [Junta de Andalucía — Centro Cerámica Triana](https://www.juntadeandalucia.es/cultura/agendaculturaldeandalucia/evento/centro-ceramica-triana)：明确列出旧陶厂、历史窑炉和大幅azulejos绘制作业台。

## 3. 陶鸡报晓 · barcelos-clay-rooster

**结论：relink；推荐 `barcelos-clay-rooster`（巴塞卢什彩绘陶鸡）。**

实际动作：画笔装饰陶鸡→置于展台→静看或写短句。本地核查入口：`packages/scenes/src/barcelos-clay-rooster/scene.ts`；来源卡 `content/traditions/portuguese-romarias.md`。README：`packages/scenes/src/barcelos-clay-rooster/README.md`。

支持的文化事实：巴塞卢什陶塑figurado是当地工艺传统，公鸡成为地方及葡萄牙文化形象。 陶塑历史上在集市、市场及朝圣集会等场所销售；公鸡造型与色彩存在多种表达。 [Portuguese Association of Cities and Villages of Ceramics — Barcelos](https://ceramicadeportugal.pt/en/barcelos-en/)；[Município de Barcelos — Galo de Barcelos](https://cm-barcelos.pt/visitar/artesanato/galo-de-barcelos/)。

不支持或须收缩的主张：

- 不能由Fátima朝圣或葡萄牙romarias推出陶鸡是统一宗教护符。
- 叶芽纹、圆台陈列和写心愿均无传统程序或固定吉祥含义的直接证据。

具体修正：新增器物专卡并取消portuguese-romarias绑定；不必抹去巴塞卢什真实关联。README将其称地区索引不能解决用户来源错配。当前介绍足够克制。

来源已读状态与可支持范围：

- **read** — [Portuguese Association of Cities and Villages of Ceramics — Barcelos](https://ceramicadeportugal.pt/en/barcelos-en/)：陶器、figurado、公鸡符号、市场/集市销售及当代制作。
- **read** — [Município de Barcelos — Galo de Barcelos](https://cm-barcelos.pt/visitar/artesanato/galo-de-barcelos/)：市政府说明彩色陶鸡、地方市场及20世纪旅游/国家形象的形成。

## 4. 太阳花迎门 · basque-sunflower

**结论：relink；推荐 `basque-eguzkilore`（巴斯克太阳蓟 Eguzkilore）。**

实际动作：拼装纸木花心→挂门钉→静看或写迎门短句。本地核查入口：`packages/scenes/src/basque-sunflower/scene.ts`；来源卡 `content/traditions/basque-folk.md`。README：`packages/scenes/src/basque-sunflower/README.md`。

支持的文化事实：Eguzkilore字面为太阳之花，是巴斯克文化中的太阳蓟形象。 地方民间信念将它置于农舍门口，与保护家宅的寄寓联系；机构也记录仿制工艺与饰物。 [Gobierno Vasco — El eguzkilore…](https://www.euskadi.eus/gobierno-vasco/-/noticia/2026/el-eguzkilore-uno-simbolos-mas-reconocibles-cultura-vasca-protagoniza-cupon-once-del-14-julio/)；[Museo Etnográfico de Orozko — Los pobladores de las Tierras Altas](https://www.orozkomuseoa.eus/los-pobladores-de-las-tierras-altas)。

不支持或须收缩的主张：

- 纸木花心拼装不是被证实的传统做法。
- 不能把民间保护寄寓写成真实效力，也不能由此推出Mari崇拜仪式。

具体修正：换器物专卡，保留介绍中的太阳蓟与纸木材质区别；代码ID保留。专卡无需泛述Mari洞穴或重建祭礼。

来源已读状态与可支持范围：

- **read** — [Gobierno Vasco — El eguzkilore…](https://www.euskadi.eus/gobierno-vasco/-/noticia/2026/el-eguzkilore-uno-simbolos-mas-reconocibles-cultura-vasca-protagoniza-cupon-once-del-14-julio/)：政府正文直接支持名称、门口放置、民俗保护象征、野生植物与工艺转化。
- **read** — [Museo Etnográfico de Orozko — Los pobladores de las Tierras Altas](https://www.orozkomuseoa.eus/los-pobladores-de-las-tierras-altas)：民族志馆解释牧人及农家门口太阳之花及其民俗寄寓。

## 5. 节旗轻展 · breton-banner

**结论：copy-fix；推荐 `breton-pardons`（布列塔尼 pardon 朝圣旗帜）。**

实际动作：展开布旗、扣横杆→旗杆入展座→静看。本地核查入口：`packages/scenes/src/breton-banner/scene.ts`；来源卡 `content/traditions/breton-pardons.md`。README：`packages/scenes/src/breton-banner/README.md`。

支持的文化事实：布列塔尼pardon是地方主保圣人节庆与朝圣活动。 法国文化部正文明确记录队伍在旗帜、十字或圣像后行进，活动依靠堂区成员和志愿者准备。 [Ministère de la Culture — La Bretagne, terre des pardons](https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons)。

不支持或须收缩的主张：

- 海浪和太阳纹没有被证明是pardon旗帜的统一传统图案或寓意。
- 展旗、扣布耳及桌上陈列无证据是当地固定仪式；不能说做完模型便完成pardon。

具体修正：现卡不是纯地区空壳，明确涉及实际旗帜，可保留。补入该直接来源并在卡中区分文化背景与模型制作，避免把原创纹样接到堂区记忆/语言的固定象征上。介绍可微收窄。

可采用的用户介绍：

> 布列塔尼的 pardon 朝圣队伍中常见旗帜，地方堂区与志愿者共同准备节庆。扣好横杆上的布耳，让海浪与太阳纹样展开，再将木杆安放到展座圆孔里，欣赏一面小旗怎样准备妥当。

来源已读状态与可支持范围：

- **read** — [Ministère de la Culture — La Bretagne, terre des pardons](https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons)：直接支持旗帜在游行中的使用、节庆与社区准备。

## 6. 巨偶待游 · catalan-festival-giant

**结论：relink；推荐 `catalan-gegants`（加泰罗尼亚节庆巨偶 Gegants）。**

实际动作：别上花章→巨偶小模型移圆台→静看。本地核查入口：`packages/scenes/src/catalan-festival-giant/scene.ts`；来源卡 `content/traditions/catalan-folk.md`。README：`packages/scenes/src/catalan-festival-giant/README.md`。

支持的文化事实：加泰罗尼亚gegants与地方节庆、音乐、巨偶舞蹈及协会活动有直接关联。 协会开展巨偶的传播、保存、研究与培训；l'Arboç遗产档案记述当地巨偶与后来的复制替换。 [Agrupació de Colles Geganteres de Catalunya — Agrupació](https://gegants.cat/agrupacio/)；[Generalitat de Catalunya — Els Gegants, l'Arboç](https://patrimonifestiu.cultura.gencat.cat/Festes-i-elements-festius-catalogats-o-declarats/Festes-Majors/La-Festa-Major-de-l-Arboc/Els-gegants)。

不支持或须收缩的主张：

- 人塔castells或correfoc不能单独为巨偶工艺背书。
- 花章、小模型、圆台与三步准备并非已证实的巨偶巡游仪式。

具体修正：替换catalan-folk大卡，专卡聚焦gegants；不要将l'Arboç特定人物、年代或造型套到本模型上。当前介绍可以保留。

来源已读状态与可支持范围：

- **read** — [Agrupació de Colles Geganteres de Catalunya — Agrupació](https://gegants.cat/agrupacio/)：承传者协会直接说明巨偶、音乐、舞蹈、保存与研究。
- **read** — [Generalitat de Catalunya — Els Gegants, l'Arboç](https://patrimonifestiu.cultura.gencat.cat/Festes-i-elements-festius-catalogats-o-declarats/Festes-Majors/La-Festa-Major-de-l-Arboc/Els-gegants)：政府遗产清单记述特定地方巨偶及制作复制史。

## 7. 泉边一念 · celtic-folk-spring

**结论：original；推荐 `product-original`（泉边停驻）。**

实际动作：俯身/点泉沿→金属信物放水→输入短句。本地核查入口：`packages/scenes/src/celtic-folk-spring/scene.ts`；来源卡 `content/traditions/celtic-folk.md`。基线未列README。

支持的文化事实：爱尔兰圣井有具体井址、圣人节期、绕行、祷告及留物等不同地方实践。 Munlochy的clootie是浸布并系树，不是把无名金属信物放入泉面。 [The Heritage Council — Holy wells in Ireland (2023)](https://www.heritagecouncil.ie/content/files/Holy-Wells-of-Ireland.pdf)；[Forestry and Land Scotland — Munlochy Clootie Well](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well)。

不支持或须收缩的主张：

- 未找到可以证实本场景「鞠躬—金属信物放水—写愿」序列的特定社区或时代一手来源。
- 不能从古代水域奉献考古、现代布条圣井及泛凯尔特概览拼成统一传统。

具体修正：主代理已确认移入product-original。保留ID、引擎、标题、动作和布局；只撤去文化归属。没有证据不等于断言此类行为从未存在。面向用户只写眼前泉景与动作，不自称虚构或原创。 审查期间主代理新增的2026-10-19修正README已补读，与本记录一致。

可采用的用户介绍：

> 在泉沿停驻，俯身向清水一礼。把掌中的小信物轻放水面，再写一句此刻想说的话，静看涟漪慢慢散开。

来源已读状态与可支持范围：

- **read** — [The Heritage Council — Holy wells in Ireland (2023)](https://www.heritagecouncil.ie/content/files/Holy-Wells-of-Ireland.pdf)：已读PDF，说明地方基督教圣井、不同起源与仪式差别；不能支持本混合序列。
- **read** — [Forestry and Land Scotland — Munlochy Clootie Well](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well)：已读井址管理方的浸布系树记述，供明确区分。

## 8. 井边放下 · clootie-well-rag

**结论：copy-fix；推荐 `clootie-well-rag`（Clootie 布条圣井）。**

实际动作：纯棉布浸井水→系低枝→松手静看。本地核查入口：`packages/scenes/src/clootie-well-rag/scene.ts`；来源卡 `content/traditions/clootie-well-rag.md`。基线未列README。

支持的文化事实：苏格兰Munlochy井址管理方记述：cloot是浸井水后系树的布片。 当地信念把病苦渐退与布片朽坏相联系；管理方要求小、适当且可生物降解的布片，推荐纯棉或纯羊毛。 [Forestry and Land Scotland — Munlochy Clootie Well](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well)。

不支持或须收缩的主张：

- 不应把现代心理疗愈解释当作传统自身的唯一意义。
- 「不可取回」「全年无节历」等绝对通则未从此次直接来源得到证实；不能推广到所有井址。

具体修正：器物与动作来源直接，专卡可保留。当前介绍已提醒当地养护规范，适当。修源卡中的心理化改写、普遍化规则与失效链接；不要将布的变淡动画描述成病愈结果。

来源已读状态与可支持范围：

- **read** — [Forestry and Land Scotland — Munlochy Clootie Well](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well)：直接支持物件、动作、民间求愈信念与材料要求。
- **redirect-list; article-unread** — [Forestry and Land Scotland — Clootie Well Clean Up Day](https://forestryandland.gov.scot/news-releases/clootie-well-clean-up-day)：旧URL现重定向新闻列表，未取得原清理报道正文；不据此新增具体清理事实。

## 9. 彩心相赠 · croatian-licitar-heart

**结论：relink；推荐 `croatian-licitar`（克罗地亚北部 Licitar 彩饰心）。**

实际动作：裱花袋添糖霜→布带挂木钉→静看或写短句。本地核查入口：`packages/scenes/src/croatian-licitar-heart/scene.ts`；来源卡 `content/traditions/croatian-folk.md`。README：`packages/scenes/src/croatian-licitar-heart/README.md`。

支持的文化事实：克罗地亚北部姜饼工艺包括成型、烘烤、干燥、彩绘；心形是常见造型。 工匠以白糖饰、小镜片、文字等装饰licitar，红色常见；礼赠、婚礼与地方节庆均有直接记录。 [Croatian Ministry of Culture and Media — Gingerbread craft from Northern Croatia](https://min-kulture.gov.hr/kulturna-bastina/nematerijalna-kulturna-bastina/nematerijalna-dobra-upisana-na-unesco-ov-reprezentativni-popis-nematerijalne-kulturne-bastine-covjecanstva/gingerbread-craft-from-northern-croatia-eng/6291)；[Krapina-Zagorje County Tourist Board — Wooden toys and licitars](https://visitzagorje.hr/en/wooden-toys-licitari/)。

不支持或须收缩的主张：

- 北部工艺不能只由Sinj骑士赛会、Hvar游行或Dubrovnik主保节资料背书。
- 挂在本场景展架并提交短句不是一套传统祝福程序，具体花纹不可加固定寓意。

具体修正：取消croatian-folk朝圣大卡绑定并建专卡。器物文化关联成立；简化糖霜与原创纹样不需逐一复制某位匠人的作品。当前用户介绍可保留。

来源已读状态与可支持范围：

- **read** — [Croatian Ministry of Culture and Media — Gingerbread craft from Northern Croatia](https://min-kulture.gov.hr/kulturna-bastina/nematerijalna-kulturna-bastina/nematerijalna-dobra-upisana-na-unesco-ov-reprezentativni-popis-nematerijalne-kulturne-bastine-covjecanstva/gingerbread-craft-from-northern-croatia-eng/6291)：已读网页正文73–87行；说明面团工艺、心形、小镜、信息、传承及节庆。
- **read** — [Krapina-Zagorje County Tourist Board — Wooden toys and licitars](https://visitzagorje.hr/en/wooden-toys-licitari/)：已读HTTP正文，直接记录红色、白糖装饰、礼赠和Marija Bistrica展示教学。
- **blocked-challenge** — [UNESCO — Gingerbread craft from Northern Croatia](https://ich.unesco.org/en/RL/gingerbread-craft-from-northern-croatia-00356)：直接访问为人机验证；索引有正文但不当作直读。

## 10. 珠星映光 · czech-bead-star

**结论：relink；推荐 `czech-glass-bead-ornaments`（捷克北波希米亚吹珠圣诞饰物）。**

实际动作：接玻璃珠串→向右旋转珠星→静看。本地核查入口：`packages/scenes/src/czech-bead-star/scene.ts`；来源卡 `content/traditions/czech-moravian-folk.md`。README：`packages/scenes/src/czech-bead-star/README.md`。

支持的文化事实：该传统位于捷克北波希米亚Krkonoše及Jizerské hory地区，包含Poniklá等社区。 加热玻璃管吹出轻薄空心珠，经镀银、着色、手饰和裁切，再用铁线穿接成饰物；用于圣诞树装饰并通过家族、作坊及教学传承。 [NÚLK — Nomination file No. 01559 (2020)](https://www.nulk.cz/wp-content/uploads/2020/12/Ozdoby_z_foukanych_sklenenych_perli_EN.pdf)；[Czech Embassy in Tallinn — Technique of the production of Christmas decorations](https://mzv.gov.cz/tallinn/en/culture_and_education/technique_of_the_production_of_christmas.html)。

不支持或须收缩的主张：

- 不能把北波希米亚工艺归到摩拉维亚天主教朝圣。
- 银蓝六角星及转动赏光不具已证实的统一传统祈愿含义。

具体修正：必须解除czech-moravian-folk绑定。当前介绍地理正确，可以保留；README所谓地区索引不能使来源错配成立。

来源已读状态与可支持范围：

- **read** — [NÚLK — Nomination file No. 01559 (2020)](https://www.nulk.cz/wp-content/uploads/2020/12/Ozdoby_z_foukanych_sklenenych_perli_EN.pdf)：已读官方申报原文件PDF，第2–4页直接说明社区、空心珠、制作穿线及传承。
- **read** — [Czech Embassy in Tallinn — Technique of the production of Christmas decorations](https://mzv.gov.cz/tallinn/en/culture_and_education/technique_of_the_production_of_christmas.html)：已读HTTP全文，说明Poniklá、珠星、家庭及参与式组装。
- **read** — [Rautis — About Rautis](https://www.rautis.cz/jsme-rautis/?lang=en)：已打开制造承传者自述；支持吹珠、镀银、染绘、裁切、穿接与作坊教学。
- **blocked-challenge** — [UNESCO — Handmade production of Christmas tree decorations from blown glass beads](https://ich.unesco.org/en/RL/handmade-production-of-christmas-tree-decorations-from-blown-glass-beads-01559)：直接为人机验证，已用NÚLK公开申报文件替代。

## 11. 旅途一页 · czech-pilgrim-journal

**结论：original；推荐 `product-original`（旅途手记）。**

实际动作：向左翻封面→布书签放黄铜夹口→点叶形记号静看。本地核查入口：`packages/scenes/src/czech-pilgrim-journal/scene.ts`；来源卡 `content/traditions/czech-moravian-folk.md`。基线未列README。

支持的文化事实：南摩拉维亚官方旅游机构确认西里尔与美多德步行网络及维莱赫拉德朝圣目的地。 这仅证明路线背景，不证明山路图手记、夹式布书签或当前翻书动作属于捷克传统。 [Tourist Authority South Moravia — Cyril and Methodius Routes](https://www.south-moravia.com/en/pilgrimage-through-south-moravia/cyril-and-methodius-routes/)。

不支持或须收缩的主张：

- 未找到把本物件与具体捷克/摩拉维亚传统直接相连的一手来源。
- 不能以朝圣地真实存在，推出任意旅人笔记本就是该文化仪式。

具体修正：主代理已确认移入product-original并保留ID、引擎、标题和动作。委派基线未列README；审查期间主代理新增了2026-10-19修正README，已补读，其结论与本记录一致。面向用户只介绍当前旅途手记，不自称原创/虚构。

可采用的用户介绍：

> 翻开桌上的山路手记，让纸上的小径在眼前展开。把布书签放进页边夹口，为走过的一段路留一处标记，再静看这一页，带着从容继续走。

来源已读状态与可支持范围：

- **read** — [Tourist Authority South Moravia — Cyril and Methodius Routes](https://www.south-moravia.com/en/pilgrimage-through-south-moravia/cyril-and-methodius-routes/)：已读全文，支持步行路线及Velehrad；不支持手记器物或动作的传统性。

## 12. 木马安放 · dalarna-wooden-horse

**结论：relink；推荐 `dalarna-wooden-horse`（达拉纳木马）。**

实际动作：软布拭彩鞍→木马移木座→静看。本地核查入口：`packages/scenes/src/dalarna-wooden-horse/scene.ts`；来源卡 `content/traditions/dalecarlian-folk.md`。README：`packages/scenes/src/dalarna-wooden-horse/README.md`。

支持的文化事实：Dalahäst是达拉纳的木雕工艺形象，由地方纪念物发展为瑞典文化符号。 达拉纳博物馆展示从较早样本到当代自由创作的多种木马。 [Dalarnas museum — Dalahästar](https://dalarnasmuseum.se/utstallningar/fasta-utstallningar/dalahastar/)；[Nordiska museet — Dalahäst stor, täljd](https://webbshop.nordiskamuseet.se/products/dalahast-17-cm-taljd)。

不支持或须收缩的主张：

- 现大卡所谓家屋护佑意象未由已读博物馆来源证实。
- 轻拭、安置、静看的顺序不是已证实的木马祝福仪式。

具体修正：取消dalecarlian-folk中仲夏/教堂船/木马护佑混合内容的直接绑定。保留真实地方工艺关联和当前克制介绍。

来源已读状态与可支持范围：

- **read** — [Dalarnas museum — Dalahästar](https://dalarnasmuseum.se/utstallningar/fasta-utstallningar/dalahastar/)：博物馆直接说明地方纪念物变成国家符号及多样藏品。
- **read** — [Nordiska museet — Dalahäst stor, täljd](https://webbshop.nordiskamuseet.se/products/dalahast-17-cm-taljd)：博物馆自营工艺材料说明手雕松木木马、打磨与自由上色；仅作当代公开工艺语境。

## 13. 毛线织暖 · faroese-wool-knit

**结论：relink；推荐 `faroese-wool-knitting`（法罗羊毛与编织）。**

实际动作：普通下针穿旧圈→绕线抽新圈退旧圈→静看。本地核查入口：`packages/scenes/src/faroese-wool-knit/scene.ts`；来源卡 `content/traditions/faroese-folk.md`。README：`packages/scenes/src/faroese-wool-knit/README.md`。

支持的文化事实：羊毛与针织与法罗经济、衣物和日常生活有长期联系。 法罗羊毛有白、灰、褐、黑等自然毛色；当代编织聚会与代际手艺仍在延续。 [Faroe Islands government portal — Wool Fashion](https://www.faroeislands.fo/arts-culture/wool-fashion)；[Visit Faroe Islands — The Importance of Faroese Wool](https://visitfaroeislands.com/en/see-do/cultural-experiences/heim-experiences/the-faroese-wool)。

不支持或须收缩的主张：

- 链舞、Ólavsøka国庆资料不能替代羊毛与编织来源。
- 普通下针不专属于法罗；奶白灰条纹织片不可声称为当地特有图案或祝福含义。

具体修正：取消faroese-folk链舞大卡绑定。现README已明确普通针法和原创织片范围，用户介绍可保留。专卡只介绍材料与编织文化，不把通用针法声称为专属。

来源已读状态与可支持范围：

- **read** — [Faroe Islands government portal — Wool Fashion](https://www.faroeislands.fo/arts-culture/wool-fashion)：政府门户直接记录羊毛加工、品牌、日常针织和编织聚会。
- **read** — [Visit Faroe Islands — The Importance of Faroese Wool](https://visitfaroeislands.com/en/see-do/cultural-experiences/heim-experiences/the-faroese-wool)：官方旅游门户直接说明自然毛色、织物历史和编织圈传承。

## 14. 桦篮拾光 · finnish-birch-basket

**结论：relink；推荐 `finnish-birch-bark-craft`（芬兰桦皮编织）。**

实际动作：装提柄→桦篮放布垫→静看。本地核查入口：`packages/scenes/src/finnish-birch-basket/scene.ts`；来源卡 `content/traditions/finnish-karelian-folk.md`。README：`packages/scenes/src/finnish-birch-basket/README.md`。

支持的文化事实：芬兰国家博物馆记述东芬兰kylvinkopsa用桦皮编成，可用于储存面粉、谷物及盐。 Taito承传者采访直接记录桦皮编织由卡累利阿祖母传习、当代制作、展览与授课。 [National Museum of Finland — Seedlip (kylvövakka)](https://suomenkansallismuseo.fi/en/exhibit/siemenpoenttoe-nauriin-ja-pellavan-siemenien-saeilyttaemiseen-4/)；[Taito — Maija Nurminen on tuohityön taitaja ja Vuoden korinpunoja](https://www.taito.fi/ajankohtaista/kasityoblogi/maija-nurminen-on-tuohityon-taitaja-ja-vuoden-korinpunoja/)。

不支持或须收缩的主张：

- 芬兰—卡累利阿熊礼、自然神灵与Kekri篝火不能为桦篮制作背书。
- 博物馆文章主图是西芬兰弯曲白杨板容器，不能说场景复制该馆藏；提柄拼装和长方篮形不是原物复原。

具体修正：换专卡。排除了Finna上由芬兰博物馆收藏但实际来自西伯利亚Khanty的桦皮器物，馆藏机构所在地不能证明产地。当前介绍与东芬兰句子相符。

来源已读状态与可支持范围：

- **read** — [National Museum of Finland — Seedlip (kylvövakka)](https://suomenkansallismuseo.fi/en/exhibit/siemenpoenttoe-nauriin-ja-pellavan-siemenien-saeilyttaemiseen-4/)：已读正文，明确区分东芬兰桦皮编织容器与西芬兰白杨板器物。
- **read** — [Taito — Maija Nurminen on tuohityön taitaja ja Vuoden korinpunoja](https://www.taito.fi/ajankohtaista/kasityoblogi/maija-nurminen-on-tuohityon-taitaja-ja-vuoden-korinpunoja/)：工艺组织直接采访承传者，支持家族传承、当代桦皮编织与教学。

## 15. 花绣寄语 · hungarian-embroidery-hoop

**结论：relink；推荐 `hungarian-embroidery`（匈牙利民间刺绣）。**

实际动作：线轴到亚麻布添线花→绣圈放展托→静看或写短句。本地核查入口：`packages/scenes/src/hungarian-embroidery-hoop/scene.ts`；来源卡 `content/traditions/hungarian-folk.md`。README：`packages/scenes/src/hungarian-embroidery-hoop/README.md`。

支持的文化事实：匈牙利民间刺绣的材料、密度和图案因地区而异，用于衣饰与家用织物。 Hagyományok Háza记录亚麻、麻、棉布刺绣，并通过展览、作坊与教育传承民间手艺。 [Hagyományok Háza — Embroidery](https://hagyomanyokhaza.hu/hu/embroidery)；[Hagyományok Háza — Virtual Hungarian Heritage House](https://hagyomanyokhaza.hu/en/virtual-hungarian-heritage-house)。

不支持或须收缩的主张：

- Szentkút圣母朝圣、圣王与新粮祝福不能作为刺绣工艺的证据。
- 本场景的玫瑰/青绿花纹不能称为经过核实的Matyó或Kalocsa特定图式；拖线轴即开花不是传统针法。

具体修正：换工艺专卡，可用两个同一承传机构的不同直接页面，不需要把原创花纹硬说成某个UNESCO地方分支。当前用户介绍可保留，卡中明确互动是简化呈现。

来源已读状态与可支持范围：

- **read** — [Hagyományok Háza — Embroidery](https://hagyomanyokhaza.hu/hu/embroidery)：已读正文，直接说明区域差异、布料及家户刺绣；玫瑰故事只作为当地传说，不作效力事实。
- **read** — [Hagyományok Háza — Virtual Hungarian Heritage House](https://hagyomanyokhaza.hu/en/virtual-hungarian-heritage-house)：机构自己的全国民间艺术展及教育项目，列刺绣作品、学校与作坊，支持活态传承。
- **failed** — [Hungarian Cultural Heritage Days — Matyó Museum](https://oroksegnapok.gov.hu/helyszin/2057)：本次无法读取；不凭先前README的访问声明追加具体断言。

## 16. 绘牌记谢 · italian-ex-voto

**结论：copy-fix；推荐 `italian-ex-voto`（意大利釉陶还愿绘牌）。**

实际动作：绘归途→描窗光→静看或写感谢。本地核查入口：`packages/scenes/src/italian-ex-voto/scene.ts`；来源卡 `content/traditions/italian-ex-voto.md`。基线未列README。

支持的文化事实：德鲁塔陶工为圣所信众制作釉陶ex-voto，图像记录地方生活中的危难与感谢。 Deruta陶瓷博物馆直接说明Madonna del Bagno圣所的釉陶绘牌、委托制作及圣母图像的当地传统。 [Museo Regionale della Ceramica di Deruta — Il santuario della Madonna del Bagno](https://www.museoceramicadideruta.it/it/santuario-madonna-del-bagno_20.html)。

不支持或须收缩的主张：

- 墨西哥ex-voto展览不能单独证明意大利具体材料和图式。
- 不能把「危难＋代祷＋结局」或P.G.R.当所有意大利绘牌都遵循的固定公式；归途/窗光画面与写短句没有证据是传统仪式。

具体修正：器物关联直接，现有专卡可保留；补入Deruta博物馆主来源，删除无证据的统一图式。场景是对绘牌感谢主题的转译，不能声称用户作画等于向教堂还愿。公开介绍可收窄材料，不需添加原创标签。

可采用的用户介绍：

> 意大利德鲁塔的釉陶还愿绘牌，以图像记下危难之后的感谢，也保存地方生活的片段。在陶牌上绘一段归途、描一线窗光，静看画面，想一想心中想感谢的人。

来源已读状态与可支持范围：

- **read** — [Museo Regionale della Ceramica di Deruta — Il santuario della Madonna del Bagno](https://www.museoceramicadideruta.it/it/santuario-madonna-del-bagno_20.html)：已读正文，直接支持德鲁塔釉陶绘牌、委托、敬奉圣母及危难叙事。
- **index-only; rate-limited** — [Science Museum Group — Votive earthenware plaque](https://collection.sciencemuseumgroup.org.uk/objects/co81737/votive-earthenware-plaque)：页面初次打开后重试429，未持续取得正文；搜索索引完整显示1724年Deruta器物，仅作已标明的补充。

## 17. 草穗悬园 · lithuanian-straw-garden

**结论：relink；推荐 `lithuanian-straw-gardens`（立陶宛草编悬园 Sodai）。**

实际动作：接下方小菱形→整体挂木架→静看。本地核查入口：`packages/scenes/src/lithuanian-straw-garden/scene.ts`；来源卡 `content/traditions/baltic-folk.md`。README：`packages/scenes/src/lithuanian-straw-garden/README.md`。

支持的文化事实：立陶宛sodai是由草秆连接成精确几何形体的悬饰，常见两座共方底的相反金字塔。 草编花园用于婚礼、婴儿摇篮上方、家庭餐桌及岁时节庆，也用于当代居室；和谐、福祉的寄寓有国家文化中心直接记述。 [Lithuanian National Culture Centre — Tradition of straw gardens](https://savadas.lnkc.lt/en/elements/element-list/tradition-of-straw-gardens/)；[Ministry of Culture of Lithuania — Nomination application Tradition of Straw Gardens](https://lrkm.lrv.lt/en/news/nomination-application-tradition-of-straw-gardens-submitted-to-unesco/)。

不支持或须收缩的主张：

- 拉脱维亚仲夏火把、波罗的海十字制作或歌舞节不能代替sodai工艺来源。
- 木珠、装接下方菱形、木架与三个动作不应写成固定古礼。

具体修正：换专卡。和谐寄寓有直接依据，可保留，须写作文化寄寓而非功能保证；无需因模型是简化双锥而移入product-original。

来源已读状态与可支持范围：

- **read** — [Lithuanian National Culture Centre — Tradition of straw gardens](https://savadas.lnkc.lt/en/elements/element-list/tradition-of-straw-gardens/)：已读国家非遗清单全文，直接说明几何、双锥、家户和谐寄寓、地方节庆与当代传承。
- **read** — [Ministry of Culture of Lithuania — Nomination application Tradition of Straw Gardens](https://lrkm.lrv.lt/en/news/nomination-application-tradition-of-straw-gardens-submitted-to-unesco/)：已读正文，支持共底双锥、家户/节庆用途与多代工艺传承。
- **read** — [Lithuania government portal — Lithuanian Straw Garden Making Added to UNESCO](https://lithuania.lt/news/culture-in-lithuania/preserving-heritage-lithuanian-straw-mobiles-added-to-unesco-intangible-heritage-list/)：已读正文，支持2023列入与公共/私人空间中的传承实践。
- **failed-timeout; forbidden** — [Lithuanian National Commission for UNESCO — Šiaudinių sodų tradicija](https://unesco.lt/kultura/nematerialaus-kulturos-paveldo-sarasai/siaudiniu-sodu-tradicija/)：本次后续请求超时/403，未用其未见正文作依据。

## 18. 一篮春食 · polish-blessing-basket

**结论：copy-fix；推荐 `polish-folk-catholic`（波兰复活节食物篮 Święconka）。**

实际动作：面包入篮→彩蛋入篮→静看或写感谢。本地核查入口：`packages/scenes/src/polish-blessing-basket/scene.ts`；来源卡 `content/traditions/polish-folk-catholic.md`。基线未列README。

支持的文化事实：波兰天主教家庭在圣周六准备食物篮并带往教堂祝福。 小波兰官方旅游资料记述面包、蛋等食物、亚麻盖布和绿色枝叶；实际篮中内容有地区差异。 [Official Tourism Portal of Małopolska — Traditional Easter basket and customs of Holy Saturday](https://ww.visitmalopolska.pl/en_GB/web/visitmalopolska/-/tradycyjny-koszyczek-wielkanocny-i-zwyczaje-wielkiej-soboty)；[Holy Trinity Parish — Święconka, Blessing of Easter Baskets](https://holytrinityparish.ie/2026/03/swieconka-blessing-of-easter-baskets-2/)。

不支持或须收缩的主张：

- 整理篮子不等于已经由圣职人员祝福；不能把应用完成反馈写成祝圣完成。
- 篮中两件食物是缩略场景，不是完整通用清单；日用食粮感谢短句是产品自愿表达。

具体修正：现卡精确讲święconka，可保留slug；补一手来源即可。当前用户介绍已把真实教堂祝福与这里只准备篮子的动作分开，不应为去宗教化而抹掉真实传统。

来源已读状态与可支持范围：

- **read** — [Official Tourism Portal of Małopolska — Traditional Easter basket and customs of Holy Saturday](https://ww.visitmalopolska.pl/en_GB/web/visitmalopolska/-/tradycyjny-koszyczek-wielkanocny-i-zwyczaje-wielkiej-soboty)：已读正文，支持食物、盖布、枝叶与地区差异。
- **read** — [Holy Trinity Parish — Święconka, Blessing of Easter Baskets](https://holytrinityparish.ie/2026/03/swieconka-blessing-of-easter-baskets-2/)：已读堂区实际活动公告，直接确认2026圣周六家庭携篮到教堂祝福。

## 19. 剪纸开花 · polish-paper-cut

**结论：relink；推荐 `polish-wycinanki`（波兰剪纸 Wycinanki）。**

实际动作：剪最后纸边→向左展开→静看或写短句。本地核查入口：`packages/scenes/src/polish-paper-cut/scene.ts`；来源卡 `content/traditions/polish-folk-catholic.md`。README：`packages/scenes/src/polish-paper-cut/README.md`。

支持的文化事实：波兰民间剪纸有折叠后切出对称镂空的工艺。 Łowicz、Kurpie等地区形成不同风格；当代博物馆和文化机构收藏并开展剪纸教学。 [Adam Mickiewicz Institute / Culture.pl — A Brief Guide to Paper Cutouts](https://culture.pl/en/article/kurpie-lowicz-kashubian-architectural-a-brief-guide-to-paper-cutouts)；[Konstancin-Jeziorna municipal portal — Muzeum Wycinanki](https://www.konstancinjeziorna.pl/museum/muzeum-wycinanki)。

不支持或须收缩的主张：

- 复活节食物祝福、收获节或朝圣大卡不能证明剪纸工艺。
- 本场景花叶图案、最后一道剪口和写短句不可称为特定地区的完整传统过程或祈福寓意。

具体修正：换专卡。已有真实器物与工艺关联，现有用户介绍可保留；不强行归为单一Kurpie分支。

来源已读状态与可支持范围：

- **read** — [Adam Mickiewicz Institute / Culture.pl — A Brief Guide to Paper Cutouts](https://culture.pl/en/article/kurpie-lowicz-kashubian-architectural-a-brief-guide-to-paper-cutouts)：网页工具偶发403；成功读取普通HTTP正文，明确折叠多轴、切出对称镂空及区域差异。
- **read** — [Konstancin-Jeziorna municipal portal — Muzeum Wycinanki](https://www.konstancinjeziorna.pl/museum/muzeum-wycinanki)：已读正文315–352行，直接说明多地区剪纸藏品、地方文化机构经营和公众工艺教学。
- **failed-fetch; index-only** — [State Ethnographic Museum in Warsaw — Kobiece ręce](https://ethnomuseum.pl/kobiece-rece/)：直接访问失败且本地HTTP证书验证失败；索引可见彩纸与剪羊毛剪刀，未当本次直读来源。

## 20. 火边花环 · slavic-wreath

**结论：relink；推荐 `kupala-wreath`（乌克兰与波兰仲夏花环）。**

实际动作：点按编草花环→放水面→目送或写祝愿。本地核查入口：`packages/scenes/src/slavic-wreath/scene.ts`；来源卡 `content/traditions/slavic-folk.md`。基线未列README。

支持的文化事实：乌克兰Kupala和波兰部分地区Sobótki/圣若翰前夜有鲜花草编环、歌唱、火与水的节庆实践。 波兰Radom乡村博物馆明确记录花环放水与年轻女性的婚恋占卜背景；乌克兰Pyrohiv博物馆公开活动有野花芳草编环和Kupala歌舞。 [Muzeum Wsi Radomskiej — Noc Świętojańska](https://muzeum-radom.pl/wydarzenia/noc-swietojanska/2609)；[National Museum of Folk Architecture and Folkways of Ukraine — Купала у Музеї просто неба](https://www.pyrohiv.com/events/kupala_2026)。

不支持或须收缩的主张：

- 不能概括所有斯拉夫民族均遵循同一节日、日期与花环含义。
- 让任意一句心愿随花环漂走，不是此次直接来源所记载的共同传统意义；不能由漂流结果预测或保证愿望。

具体修正：建议从泛slavic-folk改为针对花环习俗的专卡。保留ID/模型/动作；介绍点出历史婚恋寄寓，再用当前动作承载自愿祝愿，避免将后者冒充传统。不要硬写古代诸神史为确凿。

可采用的用户介绍：

> 乌克兰与波兰部分地区的仲夏习俗中，花环、歌唱、火光与水相伴；一些地方以水上花环寄寓婚恋愿望，各地做法与节期不同。将草茎与野花编成一圈，轻放水面，再目送花环漂远，也可以留一句此刻的祝愿。

来源已读状态与可支持范围：

- **read** — [Muzeum Wsi Radomskiej — Noc Świętojańska](https://muzeum-radom.pl/wydarzenia/noc-swietojanska/2609)：已打开博物馆自己的专题正文；支持野花编环、火边歌舞、放水与历史婚恋占卜。
- **read** — [National Museum of Folk Architecture and Folkways of Ukraine — Купала у Музеї просто неба](https://www.pyrohiv.com/events/kupala_2026)：已打开实际2026活动页面，支持Kupala草花编环教学、歌舞与当代延续。
- **read-institutional-secondary** — [Canadian Institute of Ukrainian Studies — Kupalo festival](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CU%5CKupalofestival.htm)：已读学术机构百科正文，支持水上花环与命运占卜，但为机构综述，不充作田野原始记录。

## 21. 铁线栖鸟 · slovak-wire-bird

**结论：relink；推荐 `slovak-wire-craft`（斯洛伐克铁线工艺 Drotárstvo）。**

实际动作：接翅膀→小鸟放木栖座→静看。本地核查入口：`packages/scenes/src/slovak-wire-bird/scene.ts`；来源卡 `content/traditions/slovak-folk.md`。README：`packages/scenes/src/slovak-wire-bird/README.md`。

支持的文化事实：斯洛伐克drotárstvo包括日用装饰器物、玩具和后来发展的线材雕塑与当代艺术。 手工缠接铁线的创作在斯洛伐克艺术中持续发展；ÚĽUV承传者档案直接收录铁线鸟作品及工艺教学。 [Považská galéria umenia / Považské múzeum — Drotárstvo](https://www.pgu.sk/v%C3%BDstavy/drotarstvo/)；[ÚĽUV — Juríková Dagmar](https://uluv.sk/en/producers/jurikova-dagmar-2/)。

不支持或须收缩的主张：

- Levoča圣母朝圣或复活节鞭梢/泼水资料不能为铁线鸟提供工艺来源。
- 本鸟肩部装配与木栖座属于模型设计，不是传统祈福步骤；小鸟不可附会统一护佑寓意。

具体修正：换专卡。若只采用本次稳定直读来源，介绍可从修补起源收窄为日用物/玩具到雕塑发展；保留真实地域关联与线材欣赏。

可采用的用户介绍：

> 斯洛伐克的铁线工艺既用于日常器物，也发展出玩具与装饰雕塑，手工缠接的线条在匠人和工艺机构之间延续。把小翅膀接到鸟身肩部，再将小鸟放上木栖座，看看铁线绕结与线条之间的留白。

来源已读状态与可支持范围：

- **read** — [Považská galéria umenia / Považské múzeum — Drotárstvo](https://www.pgu.sk/v%C3%BDstavy/drotarstvo/)：已读联展正文，说明日用品、玩具、1940年代雕塑、1960年代以来缠接线艺术及多种技法。
- **read** — [ÚĽUV — Juríková Dagmar](https://uluv.sk/en/producers/jurikova-dagmar-2/)：已读承传机构作者档案，含铁线工艺教学与数种鸟形作品；不复制该作者图样。
- **failed-timeout; index-only** — [ÚĽUV — Drotárstvo encyclopedia](https://uluv.sk/encyklopedia/drotarstvo/)：正文直接访问反复超时/连接重置；索引有修补与弯折技法，仅补充线索。

## 22. 彩蛋寄春 · sorbian-painted-egg

**结论：relink；推荐 `sorbian-easter-eggs`（索布族复活节彩蛋）。**

实际动作：画笔添青蓝蛋纹→蛋放陶杯→静看或写短句。本地核查入口：`packages/scenes/src/sorbian-painted-egg/scene.ts`；来源卡 `content/traditions/sorbian-folk.md`。README：`packages/scenes/src/sorbian-painted-egg/README.md`。

支持的文化事实：索布族复活节彩蛋工艺在卢萨蒂亚公共市场、家庭礼赠及文化机构中延续。 承传者文化中心记述蜡绘、染色、刮刻等技法；当代博物馆也开设公众彩绘体验。 [City of Bautzen — Sorbian Traditions and Customs](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs)；[Museum Sorbische Webstube Drebkau — Ostereiermarkt 2025](https://www.sorbische-webstube.de/veranstaltungen/2670118/2025/03/30/ostereiermarkt-2025.html)。

不支持或须收缩的主张：

- 不能用复活节骑乘巡游资料代替彩蛋工艺来源，也不能限定为上卢萨蒂亚天主教骑乘社群。
- 画笔添纹、青蓝蛋、叶枝短笔触与陶杯展放不应声称为传统蜡染教程或固定纹样寓意。

具体修正：换器物专卡；不要求原有画笔变为热蜡工具，但来源卡需诚实区分传统技法和当前数字添纹动作。当前介绍未声称蜡绘教程，可以保留。

来源已读状态与可支持范围：

- **read** — [City of Bautzen — Sorbian Traditions and Customs](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs)：已读正文的Sorbian Easter Egg Market，直接说明蜡绘、染色、擦拭、刮刻与参与体验。
- **read** — [Museum Sorbische Webstube Drebkau — Ostereiermarkt 2025](https://www.sorbische-webstube.de/veranstaltungen/2670118/2025/03/30/ostereiermarkt-2025.html)：已读博物馆实际活动，说明艺术家示范与公众绘蛋体验。
- **read** — [Sorbian Cultural Information Centre — Sorbian Customs](https://info.sorben.com/wp-content/uploads/2020/06/Br%C3%A4ucheENG.pdf)：已读PDF第9–10页，直接说明彩蛋礼赠与蜡绘等技法。

## 23. 草编迎春 · st-brigids-cross

**结论：keep；推荐 `st-brigids-cross`（圣布里吉德十字）。**

实际动作：四束草简化折编→挂门楣→静看。本地核查入口：`packages/scenes/src/st-brigids-cross/scene.ts`；来源卡 `content/traditions/st-brigids-cross.md`。基线未列README。

支持的文化事实：爱尔兰圣布里吉德节前夕1月31日有制作灯心草/麦秆十字的家庭习俗。 十字挂于住宅及牛棚马厩，以尊崇圣人和寄托家户/牲畜保护心意，形制因地区而异。 [Galway City Museum — St Brigid and St Brigid's Cross](https://galwaycitymuseum.ie/blog/st-bridget-and-st-bridgets-cross/)。

不支持或须收缩的主张：

- 四束草的缩略拼装不是完整编织教学。
- 不能把该家庭民俗直接说成铁器时代德鲁伊古礼的连续复原。

具体修正：现专卡、介绍与动作层级相符，可保留。补可读博物馆来源，修复参考列表中被截断的URL。当前介绍已经有节期和地区差异。

来源已读状态与可支持范围：

- **read** — [Galway City Museum — St Brigid and St Brigid's Cross](https://galwaycitymuseum.ie/blog/st-bridget-and-st-bridgets-cross/)：已读正文，直接支持1月31日、草料、家屋与畜棚、地方样式与制作示范。
- **failed-timeout; forbidden** — [National Museum of Ireland — St Brigid's Cross](https://www.museum.ie/en-IE/Collections-Research/Collection/Top-things-to-see-in-the-Irish-Folklife-Collection/Artefact/St-Brigid-s-Cross/0385e3ce-ebe8-455a-94ec-4d6a8aa684ff)：本次先返回条目后重试超时/403；未取得足够正文，使用Galway城市博物馆替代。

## 24. 留一盏烛光 · votive-candle-catholic

**结论：copy-fix；推荐 `votive-candle-catholic`（天主教献烛 / Votive candles）。**

实际动作：安放蜡烛→点灯芯→意向短句或静看。本地核查入口：`packages/scenes/src/votive-candle-catholic/scene.ts`；来源卡 `content/traditions/votive-candle-catholic.md`。基线未列README。

支持的文化事实：天主教堂区设有votive烛架，信众可点烛祈祷。 堂区直接解释献烛表示向基督祈求或请求圣人代祷，人离开后仍象征在祷告中临在。 [Saint Patrick Catholic Church — Why do Catholics Light Votive Candles?](https://www.saintpats.org/parish/catholics-light-votive-candles/)；[Congregation for Divine Worship — Directory on Popular Piety and the Liturgy](https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html)。

不支持或须收缩的主张：

- 不是每次献烛都先有许愿后还愿，中文还愿烛应说明也含祈求与代祷。
- 「常配意向簿/卡」「电子烛普遍通行」等概括未被此次直接来源证实；不能承诺祷告结果。

具体修正：专卡可以保留，用献烛/祈愿烛解释votive比只写还愿更全。当前用户介绍已包括祈求、代祷与感谢，基本成立；删除卡中未经证实的普遍实务。

来源已读状态与可支持范围：

- **read** — [Saint Patrick Catholic Church — Why do Catholics Light Votive Candles?](https://www.saintpats.org/parish/catholics-light-votive-candles/)：已读堂区正文115–136行，直接说明烛架、祈求/代祷、人离开后的象征与自愿捐献。
- **read** — [Congregation for Divine Worship — Directory on Popular Piety and the Liturgy](https://www.vatican.va/roman_curia/congregations/ccdds/documents/rc_con_ccdds_doc_20020513_vers-direttorio_en.html)：已读官方文件相关序言与原则，支持民间虔诚与礼仪的关系；不单独证明每个地方点烛细节。

## 25. 木勺寄情 · welsh-love-spoon

**结论：relink；推荐 `welsh-love-spoons`（威尔士爱勺 Lovespoons）。**

实际动作：软布拭凹勺→木勺放展托→静看或写心意。本地核查入口：`packages/scenes/src/welsh-love-spoon/scene.ts`；来源卡 `content/traditions/welsh-folk.md`。README：`packages/scenes/src/welsh-love-spoon/README.md`。

支持的文化事实：威尔士爱勺是精雕木勺礼物，表达爱意与感情；博物馆收藏历史与当代多种作品。 Museum Wales最早有明确日期的馆藏为1667年，机构也明确说起源仍不确定；当代用于多种纪念赠礼。 [Amgueddfa Cymru / Museum Wales — Welsh love spoons](https://museum.wales/blog/1033/Welsh-love-spoons/)；[Visit Wales — Traditional Welsh craft activities](https://www.visitwales.com/things-do/culture/cultural-activities/have-go-some-traditional-welsh-crafts)。

不支持或须收缩的主张：

- Mari Lwyd、Eisteddfod及圣井朝圣不能为爱勺工艺背书。
- 不能把1667当发明年份，不能将每个心形/菱形图案解释为唯一固定含义；拭勺与展放非传统仪式。

具体修正：换工艺专卡；当前介绍可保留，主题赠礼与器物真实关联充分，不需要为了未复刻某件馆藏移入product-original。

来源已读状态与可支持范围：

- **read** — [Amgueddfa Cymru / Museum Wales — Welsh love spoons](https://museum.wales/blog/1033/Welsh-love-spoons/)：已读HTTP全文与网页正文，直接说明赠礼、木雕、风格差异及起源不确定。
- **read** — [Visit Wales — Traditional Welsh craft activities](https://www.visitwales.com/things-do/culture/cultural-activities/have-go-some-traditional-welsh-crafts)：已读官方旅游正文，直接说明爱勺雕刻作坊、当代礼赠与定制实践。

## 记录与实施界限

研究完成后，主代理另行授权本代理修订8张既有卡：`breton-pardons`、`clootie-well-rag`、`italian-ex-voto`、`polish-folk-catholic`、`votive-candle-catholic`、`st-brigids-cross`、`celtic-folk`、`czech-moravian-folk`。修订已完成；没有修改代码、README或其他来源卡。布列塔尼与食物篮保留真实宗教背景；献烛不再等同每次还愿；井布保留当地求愈信念；意大利绘牌撤回统一三格与印章规则；凯尔特概览与捷克朝圣卡撤回虚构的手机传统流程。

修卡阶段补读的直接来源已同步到JSON：

- [爱尔兰国家博物馆：St Brigid's Day](https://source.museum.ie/en-IE/Collections-Research/Folklife-Collections/Folklife-Collections-List-%281%29/Religion-and-Calendar-Customs/St-Brigid-s-Day)：**read**，已读策展人正文。支持制作前洒圣水、地方形制、家庭/畜棚悬挂及新居/新婚赠礼，URL已完整编码；此前另一馆藏URL的403记录仍保留。
- [Hostýnsko：Svatý Hostýn–Velehrad route](https://www.hostynsko.cz/trasa/556/pesi-poutni-bystrice-pod-hostynem-velehrad)：**read**，已读路线正文，确认真实多日步道，不支持手记/夹式布书签。
- [Coflein／RCAHMW：Llyn Cerrig Bach](https://coflein.gov.uk/en/sites/401097)：**read**，已读遗址档案，用于把古代金属器水域奉献的考古解释与现代圣井分开，不支持本场景的组合动作。
- [Jasna Góra新闻处：收获花环](https://news.jasnagora.pl/aktualno%C5%9Bci-2026/wie%C5%84ce-%C5%BCniwne-na-do%C5%BCynkach-jasnog%C3%B3rskich/)：**read**，已读教会现场实录；仅用于既有波兰大卡保留收获感恩与教会背景，不为剪纸等无关工艺背书。

机器可读结论位于 `artifacts/culture-audit/2026-10-19/findings-b.json`，25个ID均逐项覆盖。该文件的中文facts可作为新卡事实骨架；sources保留了失败与仅索引状态，生成新卡时应优先采用read主源。公共介绍与数字互动须分开：真实宗教背景可以保留，当前完成动作不得宣称已经实现献置、祝圣、蒙恩或疗效。
