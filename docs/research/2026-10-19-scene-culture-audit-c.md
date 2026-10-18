# 全场景文化来源核查：C组（25项）

核查日期：2026-10-19。输入快照：`artifacts/culture-audit/2026-10-19/group-c.json`。本轮只新增研究记录；未编辑场景、来源卡、界面、目录或已有工作区改动；未提交、未推送；未触碰 `malawi-sansi`。

## 方法与判断范围

逐项对照了输入中的用户介绍、场景 `scene.ts` 的动作/文案、现有来源卡，以及存在的开发 README。末四项 navruz-sumalak、milagros、crane、lantern 在输入中未列 README，实际目录检查也未发现 README。本报告针对文化归属、物件、动作与寓意的对应；不是对旧宗教大卡全部历史陈述的重写。

仅把本轮实际读到的机构正文、馆方记录、社区访谈或原始研究用作新增事实依据。`read-direct-http` 表示网页工具不稳定后，以 Python urllib 直接读官方正文/官方PDF；PDF用pypdf提取对应页。`blocked` 是验证码、超时、404、403或SSL失败，未将搜索摘要伪称全文。失访不等于相关传统不存在。馆方发表的社区采访（Te Papa/Salote Talagi）作为第一方社区材料；它不是普通旅行博客。

实物与文化关联有直接依据即可；原创简化模型不需要复刻特定馆藏。动作简化、展座、原创色块与个人文字要归于产品设计，不可为留地域而拼接神圣寓意。对“寄暖、拾暖、相藏”等体验性标题不推导固定传统象征。

## 结论

共 25 项：keep 14，relink 10，original 1。

需要调整来源的10项见下表：新建9张器物专卡，纸鹤复用已有专题卡。除 lantern 的产品原创归属外，地域/社区物件关联都有直接主来源，建议保留原场景ID、标题、动作和布局。

| 场景ID | 当前错绑/缺卡 | 建议专卡slug |
| --- | --- | --- |
| weifang-paper-kite | chinese-folk-and-confucian | weifang-kite-craft |
| niue-shell-necklace | niuean-traditional | niue-kahoa-hihi |
| uzbek-clay-bowl | uzbek-folk | uzbek-ceramic-craft |
| fijian-woven-fan | fijian-vanua | fijian-iri-fan |
| amazigh-woven-rug | amazigh-berber | moroccan-amazigh-textiles |
| sicilian-painted-cart | sicilian-santa-rosalia | sicilian-carretto-craft |
| ndebele-painted-house | ndebele-traditional | ndebele-wall-painting |
| purepecha-copper-bowl | purepecha | santa-clara-copper-craft |
| navruz-sumalak | uzbek-folk | uzbek-sumalak-cooking |
| crane | 未关联来源卡 | origami-crane-senbazuru |

其中 `niuean-traditional` 旧引用的 Auckland object/1134301 实为 **Hiapo图样书**，不是黄螺贝链。`sicilian-painted-cart` 的日常 **carretto** 不能沿用 Santa Rosalia 的 **Carro Trionfale** 卡。`lantern` 的纸灯与心愿木牌组合按产品原创处理；未发现成套传统证据，也不声称现实中绝不存在此习惯。

## 逐项记录

### 1. chinese-diabolo — keep

建议来源：`chinese-diabolo`。真实动作：提右杆起转→展左杆辅助抛接（可重复）→收杆停转。

**可用于来源卡的事实**

- 空竹以竹木制成中空轮盘，分单轮和双轮，轴由竹杆系绳带动。
- 公开抖空竹技艺包含抛起、接回等游艺动作。

**已读来源、访问状态与支持范围**

- [中国非物质文化遗产网：抖空竹](https://www.ihchina.cn/Article/Index/detail?id=13780) — `read`：已读项目正文，结构与抛接对应；不采用其中健康效果概括。
- [北京市文物局：北京空竹博物馆](https://wwj.beijing.gov.cn/bjww/362771/362773/546616/index.html) — `read`：已读博物馆介绍，绳驱中空竹木玩具及工艺/娱乐关系。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

现有专卡与场景对象相符。省略双手与辅助绳路已在README/卡中明示，原创配色不需要复刻馆藏；没有祈福寓意或宗教错配。

### 2. russian-matryoshka — keep

建议来源：`russian-matryoshka`。真实动作：提开上壳→小娃放入空腔→对缝合回。

**可用于来源卡的事实**

- 俄罗斯套娃由大小递减的木偶相套，大只中央可分合。
- 不同地区与作者的车制形体、花卉彩绘有变化。

**已读来源、访问状态与支持范围**

- [Museums Victoria：National Doll — Russian, Babushka](https://collections.museumsvictoria.com.au/items/251505) — `read`：已读Summary与Physical Description；木质、中央分合、嵌套及实心最小娃。
- [Virtual Russian Museum：Polkhovsky Maidan, Matryoshkas](https://rusmuseumvrm.ru/data/collections/folk_art/oni-r_3260/?lang=en) — `read`：已读材料/工艺与正文，车制圆形、绘画与花卉。
- [The Museum of Russian Art：A Thousand Nesting Dolls](https://tmora.org/2024/08/27/a-thousand-nesting-dolls/) — `read`：已读展览正文，题材多样与起源传说的不确定性。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

套藏动作是器物结构的直接呈现。温暖、相互容纳应持续保留为产品感受，不能写成所有套娃的固定传统象征；现卡已作此区分。

### 3. japanese-kendama — keep

建议来源：`japanese-kendama-craft`。真实动作：上拖木柄接大皿→接小皿→球孔接尖端。

**可用于来源卡的事实**

- 剑玉包含承皿、尖端、球孔、木柄及连接绳。
- 大皿/小皿/尖端的连续转接在公开基础技巧中有据，皿的先后可以交换。

**已读来源、访问状态与支持范围**

- [Web Japan：Kendama Basics and Tricks](https://web-japan.org/kidsweb/virtual/kendama/kendama04.html) — `read`：已读Around Japan及相关基础动作段落；明确皿接与尖端接球，大/小皿先后可交换。
- [日本剑玉协会：級・準初段の技](https://kendama.or.jp/tricks/basic_tricks/) — `read`：已打开基础技巧表；作为动作名称交叉检查，不引入级位评价。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

真实动作与基础玩具玩法对应。自动接球与放慢轨迹已明示为辅助体验，无须因为不是完整竞技动作而撤去日本关联。

### 4. indian-charkha — keep

建议来源：`indian-charkha-craft`。真实动作：牵引棉束→转摇柄加捻→停轮调整后回送卷线。

**可用于来源卡的事实**

- Charkha是印度手摇纺车，木架与轮驱动金属纺锭。
- 纺线一手转轮一手牵引；卷纱前须停纺调整。
- 它与近代swadeshi、khadi及非暴力独立运动有关。

**已读来源、访问状态与支持范围**

- [Powerhouse：Charkha and spindles, 2024/102/52](https://collection.powerhouse.com.au/object/754652) — `read`：已读实物结构、Production Notes和历史背景；直接支持开放木架与停纺卷收。
- [Powerhouse：Charkha (spinning wheel), India, 2002/47/1](https://collection.powerhouse.com.au/object/11412) — `read`：已读箱式传动与Gandhi背景；不把箱式双级传动误当场景单级开放架复刻。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

现卡范围正确，保留近代社会历史。不得把Gandhi的历史言论变成本交互的疗效承诺；现文没有此问题。

### 5. german-nutcracker — keep

建议来源：`erzgebirge-nutcracker-craft`。真实动作：抬背杆打开下颌→放胡桃→压杆示意开果。

**可用于来源卡的事实**

- 塞芬木制人物胡桃夹子有背部杠杆和活动下颌，属于当地车削木作。
- 塞芬玩具博物馆把胡桃夹子列入当地木作与圣诞装饰展品。

**已读来源、访问状态与支持范围**

- [Stadtgeschichtliches Museum Leipzig：Nußknacker, Z0056134](https://www.stadtmuseum.leipzig.de/document/objekt/Z0056134) — `read`：已读馆藏全文，Seiffen、Drechselarbeit、木材、背杆/下颌及胡须连接。
- [Spielzeugmuseum Seiffen：Spielzeug im Museum](https://spielzeugmuseum-seiffen.de/spielzeug_im_museum.cfm) — `read`：已读木作起源与Tradition und Zeitgeist段落，支持地域工艺及当代装饰展陈。
- [LVR：Nussknacker](https://alltagskulturen.lvr.de/en/objekte/nussknacker/DE-MUS-377513/lido/dc00005490) — `blocked`：直接页面不可访问；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

专卡与日常器物对应。开裂是产品示意，现代装饰摆件未必可实际开果，卡已明示。若需最严谨文案，可把“今天许多木偶主要用于装饰”收窄为“胡桃夹子也见于当地圣诞装饰展陈”；不必改变互动。

### 6. mexican-molinillo — keep

建议来源：`molinillo-chocolate-craft`。真实动作：浅浸器头→向右搓转→向左搓转起示意泡沫。

**可用于来源卡的事实**

- Molinillo是墨西哥木制巧克力搅拌器，器形有沟槽、圆盘或木环变化。
- 双掌搓转产生往复转动；在空气与液体交界附近搅动可引入空气形成泡沫。

**已读来源、访问状态与支持范围**

- [UNAM：Producción de espuma en el chocolate con el molinillo tradicional](https://revista.unam.mx/vol.15/num5/art37/art37.pdf) — `read`：已读作者研究PDF，第6–9页：器形变化、双掌搓转、往复周期、浸入深度与起泡；不是根据搜索摘要。
- [UNAM Revista Digital Universitaria：同题论文页面](https://www.revista.unam.mx/ojs/index.php/rdu/article/view/332) — `read`：已读作者与摘要，确认研究出处与日常墨西哥背景。
- [The Met：Molinillo (chocolate stirrer)/rattle](https://www.metmuseum.org/art/collection/search/501933) — `read`：已读馆藏资料，名称、Mexico与木材；乐器分类不等于此处演示宗教音乐。
- [El Colegio de México：molinillo](https://dem.colmex.mx/ver/molinillo) — `blocked`：词典页读取超时；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

现来源卡、真实动作和介绍一致。原HTML论文入口不稳定，正式来源宜加可读PDF。木环不是泡沫或愿望功效的象征。

### 7. chinese-suanpan — keep

建议来源：`chinese-zhusuan`。真实动作：个位下珠靠梁3→上珠靠梁8→十位下珠靠梁18。

**可用于来源卡的事实**

- 上珠计五、下珠计一，拨向横梁的珠参与计数。
- 各档体现十进位值关系，3→8→18与场景珠位一致。
- 珠算在中国代代传承，2013年列入UNESCO名录由中国文化主管部门公告可核对。

**已读来源、访问状态与支持范围**

- [University of St Andrews / MacTutor：Chinese numerals](https://mathshistory.st-andrews.ac.uk/HistTopics/Chinese_numerals/) — `read`：已读末尾算盘段落，直接解释靠梁计数、上五下一与实例。
- [UNESCO：Chinese Zhusuan](https://ich.unesco.org/en/RL/chinese-zhusuan-knowledge-and-practices-of-mathematical-calculation-through-the-abacus-00853) — `blocked`：多次直达与数字/西语入口均返回人工验证；未把搜索摘要视为已读正文。
- [Smithsonian：Suan-p'an, or Chinese Abacus](https://www.si.edu/object/suan-pan-or-chinese-abacus%3Anmah_690528) — `blocked`：对象页404；Spotlight页另尝试HTTP403，未声称通读；未把搜索摘要视为已读正文。
- [中国非物质文化遗产网：珠算（珠算文化）](https://www.ihchina.cn/project_details/15272.html) — `read`：已读国家非遗项目正文，算盘计数、代代传承与中国文化关联；不引入其未经本轮单独史学核对的起源年代。
- [中国文化和旅游部非遗司：中国珠算被正式列入教科文组织非遗名录](https://www.mct.gov.cn/whzx/bnsj/fwzwhycs/201312/t20131205_765184.html) — `read`：已读2013年12月5日公告，确认2013年12月4日列入名录；不等同本轮读到UNESCO申报全文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

运算与中国珠算器物关系有可读学术与国家非遗正文支持，保留专卡。旧卡诚实记录了不可读来源；本轮补国家非遗项目与文旅部公告。口传表述在UNESCO搜索正文有一致描述，但直接页及原PDF仍受阻；不将它标为本轮已读全文。可把首句收窄为“这门知识代代传承”，无需声称原句错误或否认口授传承。

### 8. mongolian-felt-ger — keep

建议来源：`mongolian-ger-craft`。真实动作：展木格→支顶圈和椽杆→铺白毡。

**可用于来源卡的事实**

- 蒙古包框架含顶圈、椽杆、木格、门与支柱。
- 木作、绘饰、缝纫和制毡涉及家庭/群体协作，儿童观察长辈、匠人指导传承。

**已读来源、访问状态与支持范围**

- [ICHLinks / Mongolia National Center for Cultural Heritage：Traditional craftsmanship of Mongol ger](https://mongolia.ichlinks.com/archive/elements/elementsV.do?contentsI18NCd=en-US&elementsUid=13829896140267001030) — `read`：已读Description、transmission与名录年份栏；木构件、帆布/毡、家庭协作及2013。
- [UNESCO：Traditional craftsmanship of the Mongol Ger](https://ich.unesco.org/en/RL/traditional-craftsmanship-of-the-mongol-ger-and-its-associated-customs-00872) — `blocked`：直达页验证码；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

现卡是专门工艺卡且无居住礼仪错配。搭建顺序与构件数量是已有明确说明的缩略；“温暖居所”是普通体验描述，无固定传统吉祥含义主张。

### 9. peruvian-engraved-gourd — keep

建议来源：`peruvian-mate-burilado`。真实动作：壳面右拖显刻线→下拖轻拭→静看/自愿留心意。

**可用于来源卡的事实**

- Mate burilado以葫芦壳面为载体雕刻装饰，秘鲁曼塔罗河谷的Cochas是重要制作地区。
- 作品题材可来自当地日常生活、农事与自然。

**已读来源、访问状态与支持范围**

- [秘鲁文化部：Mates burilados, un arte ancestral peruano](https://www.gob.pe/institucion/cultura/noticias/47357-mates-burilados-un-arte-ancestral-peruano) — `blocked`：原新闻入口HTTP418；未把搜索摘要视为已读正文。
- [秘鲁外贸旅游部：Línea artesanal de mates burilados (2012)](https://cdn.www.gob.pe/uploads/document/file/31579/22220_22_L_C3_ADnea_artesanal_de_mates_burilados_2012_.pdf20180706-19116-sf0cai.pdf) — `read-direct-http`：已用Python urllib直接下载官方PDF，并用pypdf读取PDF页10、15、17、19、21、31–32、38–43；pp.40–43为Huancavelica/Huancayo/Cochas田野说明，涵盖工具、干葫芦、生活题材、家族学习与公开作坊。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

现卡文化关联有官方田野报告直接证据；更新为本轮可读主来源。叶片山丘、擦拭、心愿附记维持为产品设计，不把擦拭+写愿称作当地固定仪式。

### 10. venetian-glass-bead — keep

建议来源：`italian-glass-beads`。真实动作：转芯棒显彩纹→冷却后穿绳→静看。

**可用于来源卡的事实**

- 意大利玻璃珠技术包括a lume灯工与da canna管材切割、软化、抛光。
- 玻珠工艺在作坊中以观察与实践传承，珠饰礼物用于社会活动与特定时刻。

**已读来源、访问状态与支持范围**

- [UNESCO：The art of glass beads（数字入口）](https://ich.unesco.org/en/RL/01591) — `read`：数字入口成功返回完整正文，已读202–205行对应的工艺、作坊与礼物段落；同名长slug入口此前是验证码。

**错配、无依据外推与产品层边界**

- “日常赠礼”较源文“events and social occasions”略宽，宜写“珠饰也用于赠礼”。

**具体改法**

保留意大利专卡。来源的芯棒实例有法国段落，卡不应据此把每个微小动作都断言为某威尼斯工坊传统；现模型与绕纹可明确为灯工材料启发的原创缩略。建议仅收窄赠礼措辞。

可直接使用的介绍修订：

> 意大利玻璃珠工艺包含灯工成珠与玻璃管切磨等做法，匠人在作坊中传授对火、玻璃与装饰的掌握，珠饰也用于赠礼。转动金属杆，让彩色细带绕上青绿玻珠；待色带凝定，再把玻珠移到细绳上，静看透光的颜色。

### 11. vietnamese-bamboo-dragonfly — keep

建议来源：`thach-xa-bamboo-dragonfly`。真实动作：放到枝尖→轻推竹翼→观察单点回稳。

**可用于来源卡的事实**

- 河内Thạch Xá（今Tây Phương）制作竹蜻蜓平衡玩具。
- 竹片形成身体、翼与尾，彩绘后能以小接触点平衡于指尖、笔尖等位置。

**已读来源、访问状态与支持范围**

- [越南国家旅游局信息中心：Làng chuồn chuồn tre Thạch Xá](https://nongthon.vietnamtourism.gov.vn/lang-chuon-chuon-tre-thach-xa-net-dep-sang-tao-tu-tre-viet/) — `read-direct-http`：网页工具读取反复超时；随后Python urllib直接读取官方越文完整正文成功，已读竹材选择、部件、着色、指尖/笔尖平衡及现今地名。
- [河内文化体育部门：Unique Bamboo Dragonfly Made in Thach Xa](https://sovhtt.hanoi.gov.vn/en/unique-bamboo-dragonfly-made-thach-xa/) — `blocked`：直接读取502/SSL中断；搜索索引虽有全文，本轮不标已读；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

专卡与器物、动作相符；不得把寺庙周边销售玩具等同寺庙仪式。现文未把这一近现代地方手艺虚构成上古传统。

### 12. turkish-ebru-paper — keep

建议来源：`turkish-ebru`。真实动作：梳开彩纹→自动贴纸后揭边转印→静看/自愿写心意。

**可用于来源卡的事实**

- Ebru是土耳其把颜料铺于调制液面并转印到纸上的工艺。
- 作品用于传统书籍装帧，知识通过师徒间口授和实践传承。

**已读来源、访问状态与支持范围**

- [土耳其文化旅游部驻法文化信息处：Ebru, l’art turc du papier marbré](https://turquietourisme.ktb.gov.tr/FR-133473/unesco.html) — `read`：已读Ebru专段，液面颜料/纸转印、装帧用途、师徒传承；直接的国家文化部门正文。
- [UNESCO：Ebru, Turkish art of marbling](https://ich.unesco.org/en/RL/ebru-turkish-art-of-marbling-00644) — `blocked`：长slug及数字入口人工验证；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

已有专卡正确；心愿是应用附记，卡和README已明确。添加可读文化部门主来源替代本轮不可读UNESCO；不把它绑到苏菲旋转舞卡。

### 13. indonesian-angklung — keep

建议来源：`indonesian-angklung`。真实动作：握横柄左摇→回摇→点竹管静听合成反馈。

**可用于来源卡的事实**

- 昂格隆由竹框、以藤绑固定的竹共鸣管组成，摇框或敲框发声。
- 一件可发一个音或和弦，合奏需多位参与者协作。

**已读来源、访问状态与支持范围**

- [ICHCAP / ICHLinks：Indonesian Angklung, EE00000088](https://ichlinks.com/archive/elements/elementsV.do?elementsUid=13829896117698900089&ichDomains=UD_05&mode=list&nation=ID&orderCd=E&page=12) — `read`：已读90–95行器物结构、同音不同八度、单音/和弦及协作段落。
- [UNESCO：Indonesian Angklung](https://ich.unesco.org/en/RL/indonesian-angklung-00393) — `blocked`：直接/数字/参数入口均为验证码；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

来源专卡与器物相关。合成音不是传统曲目或真实调音，README已经明确。最后点竹管是界面静听步骤，不宣称完整传统演奏技法；保留现互动。

### 14. weifang-paper-kite — relink

建议来源：`weifang-kite-craft`。真实动作：贴合已裁纸翼→拉木线轮迎风抬升→静看。

**可用于来源卡的事实**

- 潍坊风筝有板式、硬翅、软翅和串式等形态，扎制注重竹条、对称与拴线。
- 制作可概述为扎、绘、糊、放，颜色与形态有地方工艺发展。
- 手艺在家庭学习、师徒与公开传授中延续。

**已读来源、访问状态与支持范围**

- [中国非物质文化遗产网：风筝制作技艺（潍坊风筝）](https://www.ihchina.cn/niansu/html/wuDongChunFeng_weiFangFengZheng.html) — `read`：已读国家非遗中心专题正文：类型、竹条对称、拴线、色彩与传承人。
- [中国文化报 / 中国非遗网：潍坊风筝：手造之美 匠心绽放](https://www.ihchina.cn/art/detail/id/29081.html) — `read`：已读60–71行工艺与当代创新；扎绘糊放、纸/绢/绸与线轮。

**错配、无依据外推与产品层边界**

- chinese-folk-and-confucian正文主干是上香/祭祖/清明纸钱，不能作为潍坊制风筝的来源卡。
- 三步贴翼与拉线是产品简化，不是儒家礼仪、祭祖步骤或祈福效力。

**具体改法**

新建器物专卡并改宿主与模块关联；README中“地区索引”不能充当错误绑定的豁免。保留燕形原创几何、标题与动作；不需复刻具体匠人纹样。

### 15. niue-shell-necklace — relink

建议来源：`niue-kahoa-hihi`。真实动作：最后一枚备好黄螺穿线→拉拢线端→静看/可选心意。

**可用于来源卡的事实**

- Kahoa hihi是纽埃以黄色陆生小螺壳串制的颈饰。
- 准备好的壳穿孔后以细尼龙线串连，亦用作赠礼和表演饰物。
- 当代岛民及海外纽埃社群用它表达纽埃认同与故乡联系。

**已读来源、访问状态与支持范围**

- [Te Papa / Salote Talagi：The beautiful Kahoa Hihi of Niue Island](https://blog.tepapa.govt.nz/2014/10/16/the-beautiful-kahoa-hihi-of-niue-island-niue-language-week-2014/) — `read`：已读全文材料、制法、当代用途/价值与采访注释；这是馆方太平洋文化团队发表的社区访谈材料，而非普通旅行博客。
- [Te Papa：Hihi lei (shell necklace), FE012781](https://collections.tepapa.govt.nz/object/1372486) — `read`：已读item details，制作者Mokaline Makaia、2013、Niue、shell与饰物分类。
- [Auckland Museum：Hiapo : a collection of patterns and motifs](https://www.aucklandmuseum.com/collection/object/1134301) — `read`：已打开并核对题名；只用于识别当前来源错配，不支持贝链事实。

**错配、无依据外推与产品层边界**

- niuean-traditional主要讲教会、生命礼仪及tokamotu，不是贝链工艺专卡。
- 现大卡Auckland object/1134301实际是Hiapo图样书记录，不能作为贝链证据。
- 可选心愿不是贝链的传统制作步骤。

**具体改法**

新建贝链专卡；保留纽埃地域，删掉把诸神/护岛mana借给普通贝链的机会。现叙事材料与故乡记忆有直接证据，可以保留。

### 16. uzbek-clay-bowl — relink

建议来源：`uzbek-ceramic-craft`。真实动作：转木轮→向上拉湿泥碗壁→停在未烧泥坯。

**可用于来源卡的事实**

- 乌兹别克陶艺制作壶、碗、盘与其他日用陶器，地区流派各有形态和色彩。
- 泥塑成形后仍须干燥和烧制，未上釉与上釉是不同工艺类别。
- 文献记载陶轮在当地制作体系中的使用，不能把三步成形误作完整成陶。

**已读来源、访问状态与支持范围**

- [ICHCAP：Intangible Cultural Heritage of Uzbekistan — Artistic Ceramics, pp.214–217](https://archive.unesco-ichcap.org/eng/ek/sub2017_7/pdf_down/6.%20KNOWLEDGE%20AND%20PRACTICES%20CONCERNING%20TRADITIONAL%20CRAFTSMANSHIP/10.%20Artistic%20ceramics.pdf) — `read`：已读4页PDF文字：clay/成形/干燥/陶轮/烧窑、地区学校与碗盘等器类。
- [UNESCO：Ceramic arts in Uzbekistan](https://ich.unesco.org/en/RL/ceramic-arts-in-uzbekistan-01989) — `blocked`：直接、数字、西语入口人工验证；未把搜索摘要视为已读正文。
- [乌兹别克国家非遗清单：Kulolchilik](https://www.ich.uz/en/ich-of-uzbekistan/national-list/domain-5/440-kulolchilik) — `blocked`：多次直达502/超时；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

- uzbek-folk是圣地朝拜/诺鲁孜/妇女祝福大卡，不能为普通陶轮作地域来源。
- 现有关于当地黏土、家庭/学校传承的UNESCO正文本轮被验证码阻挡；若无补证，新专卡采用已经读到的工艺与器类事实即可。

**具体改法**

新建陶艺专卡，不复用Sumalak图。当前泥坯结尾正确，应保留。可收窄开头以仅使用读到的专门资料。

可直接使用的介绍修订：

> 乌兹别克斯坦的陶艺制作碗、盘、壶等日用品，不同地区保留着各自的器形与装饰经验。转动木轮，沿湿泥外壁向上轻拉，慢慢提起碗壁。最后留在眼前的仍是湿润、未上釉、未经烧制的泥坯。

### 17. fijian-woven-fan — relink

建议来源：`fijian-iri-fan`。真实动作：接收口绑带→叶扇安放展座→点柄静看。

**可用于来源卡的事实**

- 斐济露兜树叶材用于扇子、席等用品。
- Auckland Museum的Iri扇记录露兜股条覆芦框、铲叶形扇面与劈木柄夹接。
- 该馆藏还用额外叶条绑定扇叶和木柄。

**已读来源、访问状态与支持范围**

- [Torquay Museum：Fijian Hand Fan (Irubali)](https://torquaymuseum.org/collections-spotlight/fijian-hand-fan-irubali) — `read`：已读馆藏专题，斐济/露兜材/扇子与日常用品。
- [Auckland War Memorial Museum：Iri (Fan)，Google Arts & Culture馆方发布](https://artsandculture.google.com/asset/PgGAsAZ1GYOt6g) — `read`：已读馆方完整说明，voivoi/pandanus、titi框、spade叶面、劈木柄和额外绑叶；此页是馆方馆藏记录。

**错配、无依据外推与产品层边界**

- fijian-vanua介绍祖先、sevusevu和卡瓦礼，未提供叶扇对应证据。
- 现模型交错纹不是馆藏的盘绕法复刻；收口/展座三步也不是sevusevu必需程序。

**具体改法**

新建器物专卡替换宗教/礼仪索引，换来源图或无图。保留现有器形与动作，明确交错纹为原创工艺欣赏，不能称完整传统编织教程。

### 18. amazigh-woven-rug — relink

建议来源：`moroccan-amazigh-textiles`。真实动作：木梭补最后一行→夹杆持毯移展架→静看/可选心意。

**可用于来源卡的事实**

- 摩洛哥阿马齐格纺织物使用羊毛，染色经验有地域差异。
- 染色和织物知识代际传授，地区植物与材料影响色彩。
- 馆方研究记录几何装饰，但具体图形释义依社群/作者情境，不能设通用寓意字典。

**已读来源、访问状态与支持范围**

- [Khalid Loukid, Dar Si Said National Museum：Traditional Dyeing Techniques in Moroccan Amazigh Textiles](https://costume.mini.icom.museum/wp-content/uploads/sites/10/2025/01/Loukid_article_VF.pdf) — `read`：已读ICOM托管9页论文，采用pp.1–3与Fig.1–2材料/染色/传承部分；pp.5–6婚礼罩纱仪式不能挪给普通地毯。

**错配、无依据外推与产品层边界**

- amazigh-berber当前宗教/圣徒陵寝/求雨卡及图片不对应织毯。
- 条纹色块、木夹/展架和写心意为产品设计，不能声称保暖/护佑等是该原创纹样的传统寓意。

**具体改法**

新建织物专卡保留摩洛哥阿马齐格关联。“寄暖”可作为标题感受。来源的植染历史不是本模型颜色的特定配方，仍标原创配色。

### 19. sicilian-painted-cart — relink

建议来源：`sicilian-carretto-craft`。真实动作：装木轮到车轴→小车移展垫→静看。

**可用于来源卡的事实**

- 西西里carretto是日常运输/农业历史中的木车，也是地方工艺记忆载体。
- 木车有彩绘及雕刻装饰；博物馆专门展示车轮雕工。
- 车身绘画题材可以包含地方历史、史诗与宗教形象，不等同某一圣人节花车。

**已读来源、访问状态与支持范围**

- [Sicilian Cart Museum, Aci Sant’Antonio：Home](https://www.museodelcarrettosiciliano.it/en/home-en/) — `read`：已读博物馆首页，carretto/农用车、轮雕、全车绘饰展陈。
- [Sicilian Cart Museum：Our Story](https://www.museodelcarrettosiciliano.it/en/story/) — `read`：已读正文，运输/农业背景、绘画/雕刻及地方工艺记忆。

**错配、无依据外推与产品层边界**

- sicilian-santa-rosalia讲Festino的Carro Trionfale与朝圣，不能当carretto来源。
- 日常小车与承载圣人/圣骸的庆典花车不是同一个物类；“地区索引”不足以修正。

**具体改法**

新建日常彩绘车专卡，保留西西里地域和现玩法。切断Santa Rosalia关联；不把原创几何色块描述为复刻叙事画。

### 20. ndebele-painted-house — relink

建议来源：`ndebele-wall-painting`。真实动作：彩色小板放墙槽→小屋模型移展台→静看。

**可用于来源卡的事实**

- 南非isiNdebele家屋壁画与珠饰为公开艺术实践。
- Esther Mahlangu回忆由母亲和祖母教导家墙彩绘。
- 该艺术也由当代艺术家主动拓展到新载体，不能把整个社群化为单一匿名风格。

**已读来源、访问状态与支持范围**

- [Iziko Museums：Then I Knew I Was Good at Painting — Esther Mahlangu retrospective](https://www.iziko.org.za/news/iziko-museums-of-south-africa-presentsthen-i-knew-i-was-good-at-painting-esthermahlangu-a-retrospective/) — `read`：已读馆方展览文本，含艺术家第一人称母/祖母学习经历，以及传统壁画/珠饰与当代创作分野。

**错配、无依据外推与产品层边界**

- ndebele-traditional主要是祖灵宗教/入会/聘礼，普通配色模型不应绑定这套仪式说明。
- 拼色板、展示小屋与“家园记忆”是产品表达，不能声称板件拼装为传统壁画工序或固定护佑寓意。

**具体改法**

建壁画艺术专卡，去掉祖灵/入会交互建议；不需要删除可辨的地域艺术背景。首句改得更具体，避免将原创小屋的家园寓意挂给所有恩德贝莱壁画。

可直接使用的介绍修订：

> 南非恩德贝莱的家屋壁画以几何构成和鲜明色彩为人所知。艺术家埃丝特·马兰古回忆，她从母亲和祖母那里学习在家墙上作画。这里以原创小屋模型欣赏色彩：把彩色小板补入墙面的留白，再将小屋移上展台，静看几何配色与家屋轮廓。

### 21. purepecha-copper-bowl — relink

建议来源：`santa-clara-copper-craft`。真实动作：软布擦碗→铜碗移软毡座→静看。

**可用于来源卡的事实**

- 圣克拉拉德尔科布雷位于米却肯，考古和历史资料记录当地铜作。
- 当地公开作坊展示铜的加工，城市展售铜制民间工艺品。
- 当地锤锻铜工艺制作日用/烹饪容器等，存在家庭、个人与手工生产作坊。

**已读来源、访问状态与支持范围**

- [INAH：Santa Clara del Cobre](https://lugares.inah.gob.mx/es/node/4804) — `read`：已读56–78行正文，米却肯、前西班牙铜作、现今作坊展示、民间铜艺展售；宗教/cargo另段不用于本场景。
- [墨西哥官方公报 / 米却肯州申报文本：Cobre Martillado de Santa Clara del Cobre](https://sidof.segob.gob.mx/notas/docFuente/5704188) — `read`：已读申报文本14–41行的器类/锻制/家庭与个人作坊说明。仅采工艺描述，不作地理标志法律权利结论。

**错配、无依据外推与产品层边界**

- purepecha当前卡主干是亡灵节/cargo/主保节庆，与普通铜碗保养不对应。
- 轻拭、铜色变暖与毡座属于产品观看动作，不是亡灵节、还愿或族群统一仪式。

**具体改法**

建以地名铜工艺命名的专卡，避免以整个Purépecha信仰为来源。锤锻与日常容器有官方申报原文支持，不需要删除地域或把模型改成馆藏复刻；博物馆“展示加工过程”可收窄为“地方展陈保存作品”。

可直接使用的介绍修订：

> 墨西哥米却肯州圣克拉拉德尔科布雷延续着铜器锻制手艺，家庭与作坊制作日用容器，也保存着地方工艺记忆。用软布轻拭这只原创铜碗，再将它安放到软毡托座，细看卷边、锤纹与温润的铜色。

### 22. navruz-sumalak — relink

建议来源：`uzbek-sumalak-cooking`。真实动作：沿锅边搅→舀碗→送共食垫。

**可用于来源卡的事实**

- 苏玛拉克是乌兹别克Navruz的重要麦芽食物。
- 社区成员可共同准备、整夜轮流搅拌，做成后向亲友邻里分食。

**已读来源、访问状态与支持范围**

- [乌兹别克国家旅游信息中心：Navruz and spring equinox](https://uzbekistan.travel/en/o/navruz-and-spring-equinox/) — `read`：已读104–118行主食与共煮部分：sprouted wheat、整夜搅动、轮流参与、邻里分食；其中神话和兆头仅是该页叙述，未转成产品功效。
- [UNESCO：Culture of Sumanak/Sumalak cooking](https://ich.unesco.org/en/RL/culture-of-sumanak-sumalak-cooking-02336) — `blocked`：直达与数字入口验证页面；未把搜索摘要视为已读正文。

**错配、无依据外推与产品层边界**

- uzbek-folk把Navruz、苏菲圣地、Bibiseshanba合在一张宗教大卡，场景只有共煮分食。
- 三步快速完成不是实际烹饪时长或完整食谱，不能保证食物带来好运。

**具体改法**

建sumalak共煮专卡；保持当前共享温暖的叙述，这是源文确有的社会层。不要把单纯共食动作改绑穆斯林朝圣，也不必把有真实节庆来源的食物改成无文化原创。

### 23. milagros — keep

建议来源：`milagros`。真实动作：选金属小符→挂原创木架→留句祈愿/感谢。

**可用于来源卡的事实**

- 拉丁美洲尤其墨西哥的milagros是金属祈愿和谢恩小物，常附于宗教形象、十字架或祭坛。
- 小符形态没有通用固定释义；可附短谢辞。

**已读来源、访问状态与支持范围**

- [Wake Forest Lam Museum：Mexican Milagros](https://lammuseum.wfu.edu/2024/10/mexican-milagros/) — `read`：已读全文139–150行，材料/奉献/manda/地方解释差异/附纸感谢。
- [US National Library of Medicine：Everyday Miracles — Mexican Traditions](https://www.nlm.nih.gov/exhibition/exvotos/mexican.html) — `read`：已读展览说明，只支持绘画ex-voto传统与小符区别，不拿它作为所有milagros的制作证据。

**错配、无依据外推与产品层边界**

未发现需要撤回的文化归属或固定寓意断言；程序轨迹与辅助操作按现有产品说明处理。

**具体改法**

文化归属与当前小符动作有直接来源。木架/40字输入是产品替代载体，宜在介绍或卡的“本产品”中明确；目前来源卡把它定为致敬小品，未声称完成真实圣地还愿。无需把小符改成普通无文化饰品。

### 24. crane — relink

建议来源：`origami-crane-senbazuru`。真实动作：纸面点按形成方形/鸟形底→折颈尾展翼→托起→可选一句话。

**可用于来源卡的事实**

- 纸鹤在日本折纸文化中常见。
- 战后广岛纸鹤和平象征与佐佐木祯子及儿童和平纪念碑有关。

**已读来源、访问状态与支持范围**

- [广岛市：Paper Cranes and Children’s Peace Monument](https://www.city.hiroshima.lg.jp/english/peace/1033408/1009685.html) — `read`：已读180–185行正文，折纸、日本、Sadako、战后和平象征及市民献鹤；不借病中愿望故事承诺疗效。
- [广岛县：Children’s Peace Monument](https://www.pref.hiroshima.lg.jp/site/hiroshimaforpeace-en/childrens-peace-monument.html) — `read`：主代理于整合时阅读全文，交叉核对祯子愿望、同学募建、1958年落成及和平象征。

**错配、无依据外推与产品层边界**

- 当前目录未绑定已有纸鹤专题卡，无法从场景追溯“广岛和平象征”说明。
- 屏幕连点折叠与个人文字是产品简化，不是保证愿望实现的千羽鹤仪式。

**具体改法**

复用已有折纸鹤与千羽鹤专题卡，补广岛市、县本轮已读原文并收窄旧稿未核实的断代。保留目前介绍核心事实与动作；可在最后补“这里以简化折叠动画表达手作，文字是自己的附记”。不需要把模型做成某纪念馆折法复刻。

### 25. lantern — original

建议来源：`product-original`。真实动作：点亮纸灯→写心意/留白→挂原创木牌→静看。

**可用于来源卡的事实**

无特定文化归属事实；作为产品原创记录。

**已读来源、访问状态与支持范围**

未给特定文化来源；已对照代码与用户介绍的原创组合。

**错配、无依据外推与产品层边界**

- 没有已读来源证明“点亮纸灯+将个人心愿木牌挂灯下”构成某一特定地区/宗教的成套传统。
- 纸灯和木牌各自可能存在多地文化用途；不能据此推导本组合是传统仪式，也不能因未找到来源断言现实绝无此习惯。

**具体改法**

按代码与当前叙事，这是有竹骨纸面、灯架、木牌的当代产品互动。保留id/标题/几何/布局，标product-original，不新增中国/日本/佛教等地域身份。现叙事不声称固定文化寓意，可以原文保留。

## 整合建议

1. 先创建9张范围明确的器物/工艺卡，纸鹤复用已有专题卡，采用各条上述2–4条事实和本轮已读主来源；同步更新宿主目录与模块metadata的关联。不要继续将宗教大卡称作“地区索引”来保留错误关系。
2. 新卡的“本产品呈现”只写实际已有动作。个人心愿、展架、擦拭、装配三步均明确为产品附加/简化，不写成传统操作规范。
3. 普通工艺新卡不继承旧卡的祭祀照片。可暂不设图；本报告没有复制或下载馆藏图片用于产品。
4. suanpan、ger、ebru、angklung等保留已有专卡，但补可读主来源；UNESCO验证码仍如实留访问记录。suanpan“口传”只在搜索全文可见，本轮新增已读主来源支持“代代传承”，可收窄这几个字，不将原句判作已证伪。
5. venetian-glass-bead把“日常赠礼”收窄为“赠礼”；ndebele与copper的建议介绍见逐项条目。其余介绍不为追求差异强改。

机器可读结论见 `artifacts/culture-audit/2026-10-19/findings-c.json`，字段与本报告一致。
