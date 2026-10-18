# 全场景来源与文化关联核查

核查日期：2026-10-19。范围是应用目录的全部 78 个条目：本轮逐项核查其余 75 个场景；燃灯会与木陀螺沿用[本日上一轮专项修正](2026-10-19-yeondeunghoe-spinning-top.md)；铁舌轻鸣（`malawi-sansi`）按用户要求留给原会话，未编辑其实现、模块、源卡及目录条目。核查阶段按用户要求保持未提交，后续集成见文末记录。

## 结论与实际改动

- 34 个场景改用直接对应器物、工艺或节庆行为的来源：其中 31 张新专卡；七夕短册、风铃和纸鹤复用已有专卡。不能用同地区的宗教总卡替代器物来源，也不能以“只是导航索引”保留错误绑定。
- 泉边一念、旅途一页、花水位一倾、红绳自持共 4 个场景取消传统绑定，归为 `product-original`。现有组合动作缺乏对应证据，产品说明改为描述眼前体验，不给它们补造另一套地域背景。木陀轻转为上轮同类修正；月下一灯继续保留产品创作分类。
- 11 个场景保留原关联并修正来源卡中的无据概括、过期手机提案或资料缺口；其余 25 个保留关联，其中玻珠介绍把日常赠礼收窄为有据的赠礼表述。传统本身的占卜、宗教礼敬或祈愿语境予以保留，不因应用采用温和体验而改写传统定义。
- 共调整 16 条场景介绍。场景实现只改红绳和达摩的中文提示与说明，不改手势、完成条件、几何、布局、样式或存档结构。其余改动为目录／模块来源字段、来源卡、开发文档和对应测试期望。

## 具体纠正的类型

**来源错配。** 白族扎染不再绑定本主信仰；西西里日常彩绘木车不再绑定圣罗莎莉亚节的庆典花车；纽埃贝链不再借宗教总述和实际为 Hiapo 图样书的馆藏链接背书；铜碗改用圣克拉拉地方铜艺，而非亡灵节及 cargo。七夕短册、江户风铃、纸鹤均有对应专卡。中国民俗总卡中实际指向《白蛇传传说》的项目链接已从敬香参考来源移除。

**产品构思误当传统。** 空水面倾水、放花瓣、合十不能把浴佛、回向、敬老拼成一种上座部传统；翻山路手记、夹黄铜书签不能由捷克朝圣路线推成传统动作；红绳绕架、合扣与自爱留言不能由月老姻缘文学推成民俗仪轨。产品留意、静看、展架、留言、计时或辅助按钮只在产品说明里记录，不反推成传统规定。

**寓意与规则过度概括。** 奥兰教堂船模各有捐赠与地方叙事，不一概写成海难获救还愿；达摩补另一目保留愿成或平安度年的条件，不把任意回访说成传统事成；御守不强加统一一年到期；御神签真实存在问运、占卜，不定义为“本来只是自省”；花环说明限于已核实的迎宾和母亲节感谢。草编花园的和谐寄寓、部分仲夏花环的婚恋背景有来源支持，予以保留；不承诺现实效果。

## 查证方法与读取限制

逐项对照当前 `scene.ts` 的实际器物、操作与中文界面，核对宿主 `daily-scenes.ts`、注册表、模块 metadata、来源卡和 README。优先使用博物馆器物记录、社区／宗教机构自述、政府遗产清单、官方申报原件及原始研究。机构综述如作为补充会标明，不冒充田野原始记录。

UNESCO 等页面本轮多次出现验证码、超时或拒绝访问。逐项记录实际读取状态，采用可读的国家级申报文件、文化主管部门正文或对应机构原件补证；不把搜索摘要写作已通读。明确错误和访问失败的旧链接可作为纠错／研究历史保留在审阅稿，不列为新专卡的正面证据。未找到匹配证据不等于宣称现实中绝无相似行为。

逐项证据、当前动作、不能支持的主张与阅读记录分列于 [A：东亚、南亚与东南亚](2026-10-19-scene-culture-audit-a.md)、[B：欧洲](2026-10-19-scene-culture-audit-b.md)、[C：器物工艺与其他地区](2026-10-19-scene-culture-audit-c.md)。这些是完整清单核查，不是只抽几个画面代替来源审阅。

## 78 个目录条目的结果

| 场景 | 处理 | 当前来源及变更 | 证据入口 |
| --- | --- | --- | --- |
| 空竹轻扬 · `chinese-diabolo` | 保留关联 | [chinese-diabolo](../../content/traditions/chinese-diabolo.md) | [主来源](https://www.ihchina.cn/Article/Index/detail?id=13780)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 木柶行棋 · `korean-yutnori` | 保留关联 | [korean-yutnori](../../content/traditions/korean-yutnori.md) | [主来源](https://www.nfm.go.kr/kids/elecontents/view.do?topic=46)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 套娃相藏 · `russian-matryoshka` | 保留关联 | [russian-matryoshka](../../content/traditions/russian-matryoshka.md) | [主来源](https://collections.museumsvictoria.com.au/items/251505)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 鲤旗迎风 · `japanese-koinobori` | 保留关联 | [japanese-koinobori](../../content/traditions/japanese-koinobori.md) | [主来源](https://web-japan.org/kidsweb/manga/0705/index.html)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 剑玉轻接 · `japanese-kendama` | 保留关联 | [japanese-kendama-craft](../../content/traditions/japanese-kendama-craft.md) | [主来源](https://web-japan.org/kidsweb/virtual/kendama/kendama04.html)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 棉线慢成 · `indian-charkha` | 保留关联 | [indian-charkha-craft](../../content/traditions/indian-charkha-craft.md) | [主来源](https://collection.powerhouse.com.au/object/754652)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 木偶开果 · `german-nutcracker` | 保留关联 | [erzgebirge-nutcracker-craft](../../content/traditions/erzgebirge-nutcracker-craft.md) | [主来源](https://www.stadtmuseum.leipzig.de/document/objekt/Z0056134)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 木旋起沫 · `mexican-molinillo` | 保留关联 | [molinillo-chocolate-craft](../../content/traditions/molinillo-chocolate-craft.md) | [主来源](https://revista.unam.mx/vol.15/num5/art37/art37.pdf)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 铁舌轻鸣 · `malawi-sansi` | 留原会话处理 | 本次未编辑 | 不纳入本次结论 |
| 拨珠见数 · `chinese-suanpan` | 保留关联 | [chinese-zhusuan](../../content/traditions/chinese-zhusuan.md) | [主来源](https://mathshistory.st-andrews.ac.uk/HistTopics/Chinese_numerals/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 毡屋向阳 · `mongolian-felt-ger` | 保留关联 | [mongolian-ger-craft](../../content/traditions/mongolian-ger-craft.md) | [主来源](https://mongolia.ichlinks.com/archive/elements/elementsV.do?contentsI18NCd=en-US&elementsUid=13829896140267001030)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 葫芦刻光 · `peruvian-engraved-gourd` | 保留关联 | [peruvian-mate-burilado](../../content/traditions/peruvian-mate-burilado.md) | [主来源](https://cdn.www.gob.pe/uploads/document/file/31579/22220_22_L_C3_ADnea_artesanal_de_mates_burilados_2012_.pdf20180706-19116-sf0cai.pdf)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 玻珠凝彩 · `venetian-glass-bead` | 保留关联 | [italian-glass-beads](../../content/traditions/italian-glass-beads.md) | [主来源](https://ich.unesco.org/en/RL/01591)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 方巾裹礼 · `korean-bojagi-wrap` | 保留关联 | [korean-bojagi](../../content/traditions/korean-bojagi.md) | [主来源](https://unframed.lacma.org/2014/01/02/bojagi-the-korean-wrapping-cloth)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 竹蜓点风 · `vietnamese-bamboo-dragonfly` | 保留关联 | [thach-xa-bamboo-dragonfly](../../content/traditions/thach-xa-bamboo-dragonfly.md) | [主来源](https://nongthon.vietnamtourism.gov.vn/lang-chuon-chuon-tre-thach-xa-net-dep-sang-tao-tu-tre-viet/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 浮彩成笺 · `turkish-ebru-paper` | 保留关联 | [turkish-ebru](../../content/traditions/turkish-ebru.md) | [主来源](https://turquietourisme.ktb.gov.tr/FR-133473/unesco.html)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 竹音轻摇 · `indonesian-angklung` | 保留关联 | [indonesian-angklung](../../content/traditions/indonesian-angklung.md) | [主来源](https://ichlinks.com/archive/elements/elementsV.do?elementsUid=13829896117698900089&ichDomains=UD_05&mode=list&nation=ID&orderCd=E&page=12)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 纸鸢乘风 · `weifang-paper-kite` | 修正关联 | `chinese-folk-and-confucian` → [weifang-kite-craft](../../content/traditions/weifang-kite-craft.md) | [主来源](https://www.ihchina.cn/niansu/html/wuDongChunFeng_weiFangFengZheng.html)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 影偶小戏 · `chinese-shadow-puppet` | 修正关联 | `chinese-folk-and-confucian` → [chinese-shadow-puppet](../../content/traditions/chinese-shadow-puppet.md) | [主来源](https://www.ihchina.cn/project_details/13397.html)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 毛线织暖 · `faroese-wool-knit` | 修正关联 | `faroese-folk` → [faroese-wool-knitting](../../content/traditions/faroese-wool-knitting.md) | [主来源](https://www.faroeislands.fo/arts-culture/wool-fashion)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 贝链留光 · `niue-shell-necklace` | 修正关联 | `niuean-traditional` → [niue-kahoa-hihi](../../content/traditions/niue-kahoa-hihi.md) | [主来源](https://blog.tepapa.govt.nz/2014/10/16/the-beautiful-kahoa-hihi-of-niue-island-niue-language-week-2014/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 剪纸开花 · `polish-paper-cut` | 修正关联 | `polish-folk-catholic` → [polish-wycinanki](../../content/traditions/polish-wycinanki.md) | [主来源](https://culture.pl/en/article/kurpie-lowicz-kashubian-architectural-a-brief-guide-to-paper-cutouts)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 陶轮慢成 · `uzbek-clay-bowl` | 修正关联 | `uzbek-folk` → [uzbek-ceramic-craft](../../content/traditions/uzbek-ceramic-craft.md) | [主来源](https://archive.unesco-ichcap.org/eng/ek/sub2017_7/pdf_down/6.%20KNOWLEDGE%20AND%20PRACTICES%20CONCERNING%20TRADITIONAL%20CRAFTSMANSHIP/10.%20Artistic%20ceramics.pdf)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 木版留春 · `chinese-woodblock-print` | 修正关联 | `chinese-folk-and-confucian` → [chinese-woodblock-print](../../content/traditions/chinese-woodblock-print.md) | [主来源](https://www.ihchina.cn/tjq_information_detail/22182.html)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 珠星映光 · `czech-bead-star` | 修正关联 | `czech-moravian-folk` → [czech-glass-bead-ornaments](../../content/traditions/czech-glass-bead-ornaments.md) | [主来源](https://www.nulk.cz/wp-content/uploads/2020/12/Ozdoby_z_foukanych_sklenenych_perli_EN.pdf)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 叶扇纳凉 · `fijian-woven-fan` | 修正关联 | `fijian-vanua` → [fijian-iri-fan](../../content/traditions/fijian-iri-fan.md) | [主来源](https://torquaymuseum.org/collections-spotlight/fijian-hand-fan-irubali)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 织毯寄暖 · `amazigh-woven-rug` | 修正关联 | `amazigh-berber` → [moroccan-amazigh-textiles](../../content/traditions/moroccan-amazigh-textiles.md) | [主来源](https://costume.mini.icom.museum/wp-content/uploads/sites/10/2025/01/Loukid_article_VF.pdf)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 铁线栖鸟 · `slovak-wire-bird` | 修正关联 | `slovak-folk` → [slovak-wire-craft](../../content/traditions/slovak-wire-craft.md) | [主来源](https://www.pgu.sk/v%C3%BDstavy/drotarstvo/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 花绣寄语 · `hungarian-embroidery-hoop` | 修正关联 | `hungarian-folk` → [hungarian-embroidery](../../content/traditions/hungarian-embroidery.md) | [主来源](https://hagyomanyokhaza.hu/hu/embroidery)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 釉彩映晴 · `andalusian-ceramic-tile` | 修正关联 | `andalusian-folk` → [andalusian-ceramic-tile](../../content/traditions/andalusian-ceramic-tile.md) | [主来源](https://visitasevilla.es/en/triana-ceramic-center/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 彩车迎晴 · `sicilian-painted-cart` | 修正关联 | `sicilian-santa-rosalia` → [sicilian-carretto-craft](../../content/traditions/sicilian-carretto-craft.md) | [主来源](https://www.museodelcarrettosiciliano.it/en/home-en/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 蓝白晾晴 · `bai-indigo-cloth` | 修正关联 | `bai-benzhu` → [bai-tie-dye](../../content/traditions/bai-tie-dye.md) | [主来源](https://www.ihchina.cn/project_details/14304.html)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 彩墙寄家 · `ndebele-painted-house` | 修正关联 | `ndebele-traditional` → [ndebele-wall-painting](../../content/traditions/ndebele-wall-painting.md) | [主来源](https://www.iziko.org.za/news/iziko-museums-of-south-africa-presentsthen-i-knew-i-was-good-at-painting-esthermahlangu-a-retrospective/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 铜碗拾暖 · `purepecha-copper-bowl` | 修正关联 | `purepecha` → [santa-clara-copper-craft](../../content/traditions/santa-clara-copper-craft.md) | [主来源](https://lugares.inah.gob.mx/es/node/4804)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 木勺寄情 · `welsh-love-spoon` | 修正关联 | `welsh-folk` → [welsh-love-spoons](../../content/traditions/welsh-love-spoons.md) | [主来源](https://museum.wales/blog/1033/Welsh-love-spoons/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 陶鸡报晓 · `barcelos-clay-rooster` | 修正关联 | `portuguese-romarias` → [barcelos-clay-rooster](../../content/traditions/barcelos-clay-rooster.md) | [主来源](https://ceramicadeportugal.pt/en/barcelos-en/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 桦篮拾光 · `finnish-birch-basket` | 修正关联 | `finnish-karelian-folk` → [finnish-birch-bark-craft](../../content/traditions/finnish-birch-bark-craft.md) | [主来源](https://suomenkansallismuseo.fi/en/exhibit/siemenpoenttoe-nauriin-ja-pellavan-siemenien-saeilyttaemiseen-4/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 彩心相赠 · `croatian-licitar-heart` | 修正关联 | `croatian-folk` → [croatian-licitar](../../content/traditions/croatian-licitar.md) | [主来源](https://min-kulture.gov.hr/kulturna-bastina/nematerijalna-kulturna-bastina/nematerijalna-dobra-upisana-na-unesco-ov-reprezentativni-popis-nematerijalne-kulturne-bastine-covjecanstva/gingerbread-craft-from-northern-croatia-eng/6291)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 巨偶待游 · `catalan-festival-giant` | 修正关联 | `catalan-folk` → [catalan-gegants](../../content/traditions/catalan-gegants.md) | [主来源](https://gegants.cat/agrupacio/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 彩蛋寄春 · `sorbian-painted-egg` | 修正关联 | `sorbian-folk` → [sorbian-easter-eggs](../../content/traditions/sorbian-easter-eggs.md) | [主来源](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 太阳花迎门 · `basque-sunflower` | 修正关联 | `basque-folk` → [basque-eguzkilore](../../content/traditions/basque-eguzkilore.md) | [主来源](https://www.euskadi.eus/gobierno-vasco/-/noticia/2026/el-eguzkilore-uno-simbolos-mas-reconocibles-cultura-vasca-protagoniza-cupon-once-del-14-julio/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 节旗轻展 · `breton-banner` | 修正原卡表述 | [breton-pardons](../../content/traditions/breton-pardons.md) | [主来源](https://www.culture.gouv.fr/thematiques/patrimoine-culturel-immateriel/vivre-le-patrimoine-culturel-immateriel/reportages/la-bretagne-terre-des-pardons)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 草穗悬园 · `lithuanian-straw-garden` | 修正关联 | `baltic-folk` → [lithuanian-straw-gardens](../../content/traditions/lithuanian-straw-gardens.md) | [主来源](https://savadas.lnkc.lt/en/elements/element-list/tradition-of-straw-gardens/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 木马安放 · `dalarna-wooden-horse` | 修正关联 | `dalecarlian-folk` → [dalarna-wooden-horse](../../content/traditions/dalarna-wooden-horse.md) | [主来源](https://dalarnasmuseum.se/utstallningar/fasta-utstallningar/dalahastar/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 舟模寄谢 · `aland-votive-ship` | 修正关联 | `aland-folk` → [aland-votive-ship](../../content/traditions/aland-votive-ship.md) | [主来源](https://www.lemland-lumparland.evl.ax/kyrkor-och-lokaler/st-andreas)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 茶山一盏 · `blang-tea` | 修正关联 | `blang-traditional` → [jingmai-tea-forest](../../content/traditions/jingmai-tea-forest.md) | [主来源](https://whc.unesco.org/en/list/1665/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 木陀轻转 · `minangkabau-spinning-top` | 上轮已修正 | `product-original` | [专项查证](2026-10-19-yeondeunghoe-spinning-top.md) |
| 炉前一炷 · `chinese-incense` | 修正关联 | `chinese-folk-and-confucian` → [chinese-incense](../../content/traditions/chinese-incense.md) | [主来源](https://www.metmuseum.org/art/collection/search/61108)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 红绳自持 · `hongsheng-red-string` | 产品创作 | `hongsheng-red-string` → `product-original`（无传统绑定） | [主来源](https://zh.wikisource.org/zh/太平廣記_(四庫全書本)/卷159)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 绘牌记谢 · `italian-ex-voto` | 修正原卡表述 | [italian-ex-voto](../../content/traditions/italian-ex-voto.md) | [主来源](https://www.museoceramicadideruta.it/it/santuario-madonna-del-bagno_20.html)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 旅途一页 · `czech-pilgrim-journal` | 产品创作 | `czech-moravian-folk` → `product-original`（无传统绑定） | [主来源](https://www.south-moravia.com/en/pilgrimage-through-south-moravia/cyril-and-methodius-routes/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 签纸慢读 · `omikuji` | 修正原卡表述 | [omikuji](../../content/traditions/omikuji.md) | [主来源](https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9959)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 一篮春食 · `polish-blessing-basket` | 修正原卡表述 | [polish-folk-catholic](../../content/traditions/polish-folk-catholic.md) | [主来源](https://ww.visitmalopolska.pl/en_GB/web/visitmalopolska/-/tradycyjny-koszyczek-wielkanocny-i-zwyczaje-wielkiej-soboty)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 春锅共煮 · `navruz-sumalak` | 修正关联 | `uzbek-folk` → [uzbek-sumalak-cooking](../../content/traditions/uzbek-sumalak-cooking.md) | [主来源](https://uzbekistan.travel/en/o/navruz-and-spring-equinox/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 叶舟寄意 · `floating-lantern-loy-krathong` | 保留关联 | [floating-lantern-loy-krathong](../../content/traditions/floating-lantern-loy-krathong.md) | [主来源](https://www.tatnews.org/2024/11/loi-krathong-festival-2024-experience-thailands-enchanting-festival-of-lights/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 御守伴行 · `omamori-cycle` | 修正原卡表述 | [omamori-cycle](../../content/traditions/omamori-cycle.md) | [主来源](https://d-museum.kokugakuin.ac.jp/eos/detail/id=9633)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 庭前一铃 · `shrine-suzu-bell` | 保留关联 | [shrine-suzu-bell](../../content/traditions/shrine-suzu-bell.md) | [主来源](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 草编迎春 · `st-brigids-cross` | 保留关联 | [st-brigids-cross](../../content/traditions/st-brigids-cross.md) | [主来源](https://galwaycitymuseum.ie/blog/st-bridget-and-st-bridgets-cross/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 竹筛迎岁 · `bokjori` | 保留关联 | [bokjori](../../content/traditions/bokjori.md) | [主来源](https://encykorea.aks.ac.kr/Article/E0023713)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 木牌记愿 · `ema-votive-plaque` | 保留关联 | [ema-votive-plaque](../../content/traditions/ema-votive-plaque.md) | [主来源](https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9608)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 井边放下 · `clootie-well-rag` | 修正原卡表述 | [clootie-well-rag](../../content/traditions/clootie-well-rag.md) | [主来源](https://forestryandland.gov.scot/visit/destinations/munlochy-clootie-well)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 灯旋一瞥 · `diya-oil-lamp` | 修正原卡表述 | [diya-oil-lamp](../../content/traditions/diya-oil-lamp.md) | [主来源](https://collection.sciencemuseumgroup.org.uk/objects/co123880/oil-lamp-decorated-with-hindu-motifs)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 留一盏烛光 · `votive-candle-catholic` | 修正原卡表述 | [votive-candle-catholic](../../content/traditions/votive-candle-catholic.md) | [主来源](https://www.saintpats.org/parish/catholics-light-votive-candles/)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 达摩点睛 · `daruma-eye-painting` | 修正原卡表述 | [daruma-eye-painting](../../content/traditions/daruma-eye-painting.md) | [主来源](https://www.city.takasaki.gunma.jp/site/sightseeing/3052.html)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 水引结愿 · `mizuhiki` | 保留关联 | [mizuhiki](../../content/traditions/mizuhiki.md) | [主来源](https://mizuhiki.jp/manner/mizuhikinituite.html)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 留一枚感谢 · `milagros` | 保留关联 | [milagros](../../content/traditions/milagros.md) | [主来源](https://lammuseum.wfu.edu/2024/10/mexican-milagros/)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 串花寄意 · `phuang-malai` | 修正原卡表述 | [phuang-malai](../../content/traditions/phuang-malai.md) | [主来源](https://www.mfa.go.th/en/content/5d5bd1fe15e39c3060027598)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 敲一敲木鱼 · `woodfish` | 修正原卡表述 | [chinese-buddhism](../../content/traditions/chinese-buddhism.md) | [主来源](https://www.metmuseum.org/art/collection/search/505614)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 泉边一念 · `celtic-folk-spring` | 产品创作 | `celtic-folk` → `product-original`（无传统绑定） | [主来源](https://www.heritagecouncil.ie/content/files/Holy-Wells-of-Ireland.pdf)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 花水位一倾 · `theravada-water` | 产品创作 | `theravada-buddhism` → `product-original`（无传统绑定） | [主来源](https://www.tatnews.org/2022/04/tat-announces-songkran-2022-festivities-in-new-normal/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 短册系竹 · `tanzaku-tanabata` | 修正关联 | `shinto` → [tanzaku-tanabata](../../content/traditions/tanzaku-tanabata.md) | [主来源](https://www.sendaitanabata.com/english/pc/outline/decoration/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 燃灯上浮 · `yeondeunghoe` | 上轮已修正 | `yeondeunghoe` | [专项查证](2026-10-19-yeondeunghoe-spinning-top.md) |
| 风铃一响 · `furin-wind-chime` | 修正关联 | `shinto` → [furin-wind-chime](../../content/traditions/furin-wind-chime.md) | [主来源](https://tokyotokyo.jp/ja/action/omiyage/id26/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 庭前一礼 · `shinto-torii` | 保留关联 | [shinto](../../content/traditions/shinto.md) | [主来源](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 廊前轻转 · `tibetan-wheel` | 保留关联 | [tibetan-buddhism](../../content/traditions/tibetan-buddhism.md) | [主来源](https://rubinmuseum.org/projecthimalayanart/essays/prayer-wheel/)；[逐项记录 A](2026-10-19-scene-culture-audit-a.md) |
| 火边花环 · `slavic-wreath` | 修正关联 | `slavic-folk` → [kupala-wreath](../../content/traditions/kupala-wreath.md) | [主来源](https://muzeum-radom.pl/wydarzenia/noc-swietojanska/2609)；[逐项记录 B](2026-10-19-scene-culture-audit-b.md) |
| 折一只纸鹤 · `crane` | 修正关联 | `product-original` → [origami-crane-senbazuru](../../content/traditions/origami-crane-senbazuru.md) | [主来源](https://www.city.hiroshima.lg.jp/english/peace/1033408/1009685.html)；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |
| 月下一灯 · `lantern` | 保留产品创作分类 | `product-original`（无传统绑定） | 不赋予地域传统；[逐项记录 C](2026-10-19-scene-culture-audit-c.md) |

## 验证

静态检查确认 78 个宿主条目、77 个模块的标题与引擎标识保持原样，宿主／注册表／模块来源一致，所有当前来源卡实际存在。对本轮前后的场景代码做 token 比较，去除注释与中文文案后保持一致；铁舌轻鸣目录条目与本轮前一致：是。

- 场景测试：86 个文件、3,289 项通过，明确排除 `src/malawi-sansi/**`。日志 `scenes-test.log`。
- App 负责范围：24 个文件、616 项通过、5 项名称含 `malawi-sansi` 的检查跳过；另排除不属于本次改动的 `scene-load-error.test.ts`。日志 `app-in-scope-test.log`。
- 核心 49 项、内容层 37 项通过。日志 `core-test.log`、`content-test.log`。
- 纸鹤最后合并复用已有卡后，再次通过注册表 84 项、介绍与来源放置 312 项（跳过 4 项铁舌轻鸣）、TypeScript/Vite 生产构建。日志 `final-registry-test.log`、`final-catalog-test.log`、`final-build.log`。构建有既有的大包体积提示，无构建错误。
- 390px 浏览器检查：红绳、花水、泉景、旅途手记、舟模、彩墙、铜碗、达摩、纸鹤 9 个样例；新介绍与标签、初始操作提示、页面无横向溢出、无页面错误均通过。截图与 `browser-check.json` 保存在同目录。这是对显示的补充检查，文化查证本身覆盖全部 75 项。
- `git diff --check` 通过。静态检查 `static-check.json` 确认 78 个目录条目与 77 个模块来源对应、所有卡存在、标题与引擎标识保持原样、场景代码去除中文文案与注释后 token 一致；铁舌轻鸣目录条目未变。

**全量 App 的未通过项如实保留：** `app-test.log` 记录 629 项通过、2 项失败。第一处是 `procedural-craft-lifecycle.test.ts` 中铁舌轻鸣的旧进度断言（预期1，实际2），按分工未修复；第二处是已有 `scene-library.tsx` 的场景可见性改动导致 `scene-load-error.test.ts` 的测试 provider 缺少 `entries`，调用 `filter` 失败。本次仅写入 App 的介绍及来源期望文件，未编辑这两个实现／测试，也未将这两处失败报告为通过。上列616项为明确排除该文件和铁舌轻鸣用例后的结果。

以上为核查阶段记录；当时未提交、未推送，未发布外部内容。

详细运行记录留在本地 `artifacts/culture-audit/2026-10-19/`，该目录不纳入提交。

## 提交前全量复验

用户后续授权提交、合并及推送。在已包含其他会话提交的 `master`（基点 `24d3c65`）上重新验证：

- 完整运行根 `npm test` 对应的全部 8 个工作区与木鱼资产检查，统一使用 `--maxWorkers=4`：共 4223 项通过，无跳过。各工作区通过数依次为 51、11、632、54、3、3317、37、118。
- 原默认并发运行有 6 项几何计算触及 5 秒超时；未改断言、阈值或业务代码，限制并发后的完整重跑全部通过。上轮 App 两处失败在当前主线均已通过，本次没有介入其修复。
- TypeScript/Vite 生产构建通过；Android 模块发现 2 项和小组件封面／目录一致性 1 项通过。
- 提交差异仅包含文案、文化来源与来源字段、研究记录、对应测试及木陀轻转的小组件标题；不包含铁舌轻鸣的新差异或商店发布的未提交文件。

本轮日志保存在忽略目录 `artifacts/commit-review/`。
