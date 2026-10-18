# 场景文化来源逐项核查 A 组

核查日期：2026-10-19。范围为输入 `artifacts/culture-audit/2026-10-19/group-a.json` 的全部 25 项。只新增本研究记录及 `findings-a.json`，不修改代码、既有来源卡或文案，不提交、推送。`malawi-sansi` 不在本组且未触碰。

核查读取了输入中每项的用户介绍、关联来源卡、真实 `scene.ts` / `woodfish.tsx` 的物件及操作段；所有存在的开发 README 也已读取文化范围与交互段。没有额外遗漏的场景 README。本文以输入快照作为待核查基线，实施中的后续变更由主代理统一处理。

采用 research 技能的主来源原则。博物馆藏品阐释、遗产项目、宗教机构公开说明、制作社群或参与机构自述可支持器物与文化关系；文学条目以原始文学文本判断，不用后来的产品心理比喻替代原义。搜索仅用于定位，页面403、超时或验证码明确记为未读；没有证据不等于某传统不存在。文化关联只需基本器物与语境对应，不要求简化模型完整复刻馆藏或完整传统流程。

结果：10 项保留（keep）、7 项重连（relink）、6 项文案/来源修正（copy-fix）、2 项改产品原创（original）。重连优先复用已有短册与风铃专卡；新增卡建议为 chinese-incense、jingmai-tea-forest、bai-tie-dye、chinese-woodblock-print、chinese-shadow-puppet。每项的事实列表可直接作为新卡的2–4条证据基础。

关于原创说明：花水与红绳的地区/宗教关联应撤去，但用户介绍只自然描述眼前动作。‘原创’、改编差异和详细边界放 README 与本研究，不为用户额外塞入重复免责声明。

共同高风险：`chinese-folk-and-confucian.md` 的 `https://www.ihchina.cn/project_details/12185.html` 实际是《白蛇传传说》，不是敬香或工艺证据。普通工艺即使能放在某地区文化目录，也不应让一张宗教总卡成为其来源卡。

| 场景 | 判定 | 建议来源卡 |
|---|---|---|
| 敲一敲木鱼 / woodfish | copy-fix | chinese-buddhism |
| 庭前一礼 / shinto-torii | keep | shinto |
| 短册系竹 / tanzaku-tanabata | relink | tanzaku-tanabata |
| 风铃一响 / furin-wind-chime | relink | furin-wind-chime |
| 廊前轻转 / tibetan-wheel | keep | tibetan-buddhism |
| 花水位一倾 / theravada-water | original | product-original |
| 灯旋一瞥 / diya-oil-lamp | copy-fix | diya-oil-lamp |
| 木牌记愿 / ema-votive-plaque | keep | ema-votive-plaque |
| 达摩点睛 / daruma-eye-painting | copy-fix | daruma-eye-painting |
| 水引结愿 / mizuhiki | keep | mizuhiki |
| 御守伴行 / omamori-cycle | copy-fix | omamori-cycle |
| 签纸慢读 / omikuji | copy-fix | omikuji |
| 庭前一铃 / shrine-suzu-bell | keep | shrine-suzu-bell |
| 串花寄意 / phuang-malai | copy-fix | phuang-malai |
| 红绳自持 / hongsheng-red-string | original | product-original |
| 炉前一炷 / chinese-incense | relink | chinese-incense |
| 茶山一盏 / blang-tea | relink | jingmai-tea-forest |
| 蓝白晾晴 / bai-indigo-cloth | relink | bai-tie-dye |
| 竹筛迎岁 / bokjori | keep | bokjori |
| 方巾裹礼 / korean-bojagi-wrap | keep | korean-bojagi |
| 木柶行棋 / korean-yutnori | keep | korean-yutnori |
| 鲤旗迎风 / japanese-koinobori | keep | japanese-koinobori |
| 木版留春 / chinese-woodblock-print | relink | chinese-woodblock-print |
| 影偶小戏 / chinese-shadow-puppet | relink | chinese-shadow-puppet |
| 叶舟寄意 / floating-lantern-loy-krathong | keep | floating-lantern-loy-krathong |

## 1. 敲一敲木鱼（woodfish）

**判定：copy-fix；建议 slug：chinese-buddhism。**

可证实事实：

- 中国云南馆藏木鱼被说明为伴随佛教诵唱的鱼形裂隙鼓。
- 馆方将鱼形与不眠、警醒的佛教象征相联系。
- 木槌以有节律的敲击发声；器形有较写实与抽象的变化。

对应主来源与实际阅读状态：

- [The Met — Mu Yu](https://www.metmuseum.org/art/collection/search/505614)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：中国云南木鱼、槌击伴佛教诵唱、鱼形与醒觉的关联。
- [The Met — Mokugyo (木魚)](https://www.metmuseum.org/art/collection/search/502274)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：日本木鱼用于佛道教诵唱，鱼形警醒寓意；用于交叉确认东亚范围。

不能由这些来源推出的内容：

- 当前来源卡主要链接放生研究，不能单独证明木鱼器形、与磬相配或寺院晨昏集众的具体说法。
- 轻点屏幕后的余音、计次及静心收尾属于产品体验，不能说成完成佛教课诵。

具体建议：实际动作是点按敲击木鱼。文化与器物对应成立，可保留汉传佛教卡；在卡中补中国木鱼馆藏链接，删去无直接证据的‘禅寺常与磬相配、晨昏集众’扩写，不必要求模型复制馆藏。

建议用户介绍：木鱼见于东亚佛教课诵，是用木槌敲击、为诵唱伴奏的响器。鱼形常被解释为警醒与专注。轻点木鱼，听敲击与余音相接，为自己留一刻静心。

## 2. 庭前一礼（shinto-torii）

**判定：keep；建议 slug：shinto。**

可证实事实：

- 鸟居标示神社空间与日常世界的边界。
- 神社本厅公开导览说明许多人在通过前停下并微低头。

对应主来源与实际阅读状态：

- [Jinja Honcho — Entering a Jinja](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：鸟居界分神社神圣空间与外界，许多人入内前暂停轻低头；参拜为礼敬神明。

不能由这些来源推出的内容：

- 手机低头/滑动的判定、走近动画和木牌旁静立并非该来源规定的完整参拜程序。

具体建议：实际动作走近鸟居→低头抬头→木牌旁停驻。intro 保守且与主来源相合，宗教总卡在这里对象对应，保留。木牌/心愿输入作为产品附加，不声称完成正式参拜即可。

## 3. 短册系竹（tanzaku-tanabata）

**判定：relink；建议 slug：tanzaku-tanabata。**

可证实事实：

- 仙台七夕的七种装饰包括纸质短册。
- 当地官方给短册对应的愿望是学业、书艺精进。
- 七夕博物馆说明今天也常书写身边的愿望。

对应主来源与实际阅读状态：

- [Sendai Tanabata Festival — Decorations](https://www.sendaitanabata.com/english/pc/outline/decoration/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：仙台七夕七饰中的短册，学业与书艺进步愿。
- [鐘崎・七夕ミュージアム — 仙台七夕の飾り](https://www.kanezaki.co.jp/shop/belle_factory/tanabata_kazari.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：短册为基本七夕饰物；从学问书道愿发展到书写身边愿望。

不能由这些来源推出的内容：

- 神道总卡及严岛鸟居照片不能作为这件七夕纸饰的直接来源。
- 先挂再在屏幕写字是产品步骤，不是必须遵循的传统顺序。

具体建议：实际动作拾纸条→挂竹枝→可选写愿。现存 content/traditions/tanzaku-tanabata.md 已读且对象正确，直接改 traditionSlug 复用；无需新建。卡中可用已读 PC 官方页替换旧 mobile URL。intro 文化事实可留。

## 4. 风铃一响（furin-wind-chime）

**判定：relink；建议 slug：furin-wind-chime。**

可证实事实：

- 江户风铃有玻璃球体与下垂短册。
- 东京官方以凉爽的声音与风吹发声介绍该工艺品。
- 江户风铃由工匠吹制，传统产品可在内侧绘画。

对应主来源与实际阅读状态：

- [Tokyo Tokyo Official Website — Tokyo Tokyo江戸風鈴](https://tokyotokyo.jp/ja/action/omiyage/id26/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：东京官方合作产品说明玻璃球、短册、手工吹制、内侧绘画、风吹发声与清凉感。
- [篠原風鈴本舗 — 官方网站](https://www.edofurin.com/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：江户川区制造者的一手介绍及持续制作江户风铃。
- [Highlighting Japan — Edo Furin](https://www.gov-online.go.jp/eng/publicity/book/hlj/html/201407/201407_04_en.html)。状态：直接打开失败；未把搜索摘要当作已读正文。支持范围：本次不能据该页独立验证；已换已读东京官方及制造者来源。

不能由这些来源推出的内容：

- 神道总卡无法证明眼前风铃的工艺与用途。
- 不能从风铃出现在寺社活动推导所有风铃都有神道祈福作用。
- 点击即响、再点停止是产品控制。

具体建议：实际是玻璃铃身和纸条发声、停音。现存 furin-wind-chime 专卡可复用；换下 shinto。专卡‘夏季限定’宜改常见夏日风物，不设普遍强制收放季节；不新增未经验证的寺院风铎演变史。

## 5. 廊前轻转（tibetan-wheel）

**判定：keep；建议 slug：tibetan-buddhism。**

可证实事实：

- 藏传佛教转经筒内放置卷绕的经咒纸。
- 转筒顺时针转动，传统解释与诵持经咒、利益众生及发心相关。
- 寺院和朝圣地可见较大型转经筒，区别于手持小筒。

对应主来源与实际阅读状态：

- [Rubin Museum / Project Himalayan Art — Prayer Wheel, Accumulating Merit Every Day](https://rubinmuseum.org/projecthimalayanart/essays/prayer-wheel/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：转经筒内藏经咒，顺时针绕轴；寺院较大固定筒、持咒与发心及功德的传统解释。

不能由这些来源推出的内容：

- 屏幕从右向左滑、点击减速、静立步骤是产品交互映射。
- 虚拟旋转不能直接宣称已获得现实功德。

具体建议：实际固定式筒身、CLOCKWISE_FROM_ABOVE 与从右向左滑提示相配。来源卡已有 Rubin 器物专文，文化/物件/旋转方向相合；保持现关联，README 记录滑动映射和虚拟静观即可。

## 6. 花水位一倾（theravada-water）

**判定：original；建议 slug：product-original。**

可证实事实：

- 泰国确有浇水回向功德实践。
- 宋干节浴佛与向长辈手上浇香水是具体而不同的行为。
- 回向倾水的宗教教育来源描述杯碗、诵念和回向对象。

对应主来源与实际阅读状态：

- [Tourism Authority of Thailand — Songkran 2022](https://www.tatnews.org/2022/04/tat-announces-songkran-2022-festivities-in-new-normal/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：具体传统包括洗浴佛像、以玫瑰茉莉香水洗长辈手，并非任意空水面花瓣流程。
- [Buddha Dharma Education Association / BuddhaNet — Sharing or Dedication of Merits](https://www.buddhanet.net/e-learning/history/devotion/devotion05/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：回向仪式中由壶向杯/碗倾水，配合布施、诵念及亡亲回向；器物和意义有具体场合。
- [Phuket Rajabhat University — Buddhist Chanting and Merit-Making Ceremony, 12 August 2026](https://phuli.pkru.ac.th/en/news/681-pkru2026-103.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：参与机构的一手活动记录确认泰国佛教作福场合有浇水回向。
- [UNESCO — Songkran in Thailand](https://ich.unesco.org/en/RL/songkran-in-thailand-traditional-thai-new-year-festival-01719)。状态：搜索可定位，未取得可读正文。支持范围：本次主页面有访问限制，不将页面当作已读证据。

不能由这些来源推出的内容：

- 当前没有佛像、长辈或回向场合；壶往空水面倾注→放花瓣→点水合十不能由上述来源拼成一种泰国/上座部传统。
- 未找到对应证据不等于断言任何地方绝无相似动作。

具体建议：实际 scene.ts 明确 tilt/drag/anjali，水注入开放水面且没有佛像。建议保留画面与手势、改 product-original，去地区/上座部来源关联。用户介绍自然描述眼前体验；原创判定、传统差别留研究和 README。

建议用户介绍：从一壶清水开始，缓缓倾注，把花瓣放上水面。看涟漪一圈圈散开，再停驻片刻，在水声与花影之间留一刻安静。

## 7. 灯旋一瞥（diya-oil-lamp）

**判定：copy-fix；建议 slug：diya-oil-lamp。**

可证实事实：

- 印度教母题的印度油灯有明确博物馆实物例证。
- 当代寺庙说明 aarati 涉及在神像前旋动灯盘。

对应主来源与实际阅读状态：

- [Science Museum Group — Oil lamp decorated with Hindu motifs](https://collection.sciencemuseumgroup.org.uk/objects/co123880/oil-lamp-decorated-with-hindu-motifs)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：印度黄铜油灯，1801–1900，带印度教母题；器物专证，不能独自证明旋灯程序。
- [Hindu Temple — Temple Visit FAQ](https://www.thehindutemple.org/temple-information--47/pages/temple-visit-faq)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：寺庙自身说明 Aarati 是在神像前旋动装有小油灯的盘，灯光关联知识。
- [V&A — Diwali family activity](https://www.vam.ac.uk/blog/museum-life/letsmakewednesdays-diwali)。状态：直接打开403；未读可用正文。支持范围：搜索能找到博物馆对 diya/排灯节介绍，但本次直接403，不以此新增排灯节细节。

不能由这些来源推出的内容：

- 三盏固定数、先逐盏点灯→取单灯沿金色圆轨一圈→放回盘上不是该馆藏证明的传统流程。
- 无神像的单灯轨道不能直接被称为已经完成 aarati。
- ‘最常见’等绝对频率和特定门槛/窗台通例不由现两件馆藏独立证明。

具体建议：器物基本对应，无需改原创或复制馆藏。保留专卡，补宗教机构直接来源；卡里把完整 aarati 语境与眼前单灯手势分开，不把产品圆轨描述成传统步骤。

建议用户介绍：Diya 是南亚常见的油灯，在印度教礼敬与节庆中可见。点灯和旋灯有各自的场合与含义。依次点亮三盏小灯，托一盏沿圆弧缓缓转过，再轻轻放回盘上。

## 8. 木牌记愿（ema-votive-plaque）

**判定：keep；建议 slug：ema-votive-plaque。**

可证实事实：

- 绘马用于表达祈愿和感谢，见于神社、寺院及其他礼敬场所。
- 题材从马形发展为多种图像，小型悬挂木牌延续至今。

对应主来源与实际阅读状态：

- [Kokugakuin University — Ema](https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9608)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：祈愿和感谢木牌、神社与寺院分布、多样图像及悬挂传统。

不能由这些来源推出的内容：

- 花叶图样、双孔造型、左右翻面动画和下次来同一木牌前感谢为本产品选型；不必伪称特定社例。

具体建议：实际翻面→书愿/留白→悬挂，回访致谢。intro 对象和含义有直接证据，保留。花叶原创图案不构成文化失真，不要求复制具体神社木牌。

## 9. 达摩点睛（daruma-eye-painting）

**判定：copy-fix；建议 slug：daruma-eye-painting。**

可证实事实：

- 高崎市公开介绍先许愿点一目。
- 另一目在愿望达成或平安度一年后补上。
- 英文左眼与日文观者右眼可由观看视角解释，不能据此夸大成这两个来源互相矛盾。

对应主来源与实际阅读状态：

- [高崎市 — 高崎だるま（R）について](https://www.city.takasaki.gunma.jp/site/sightseeing/3052.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：先在观者右眼点墨许愿，事成或平安度一年后补另一目；高崎生产与装饰。
- [Gunma Prefectural Government — Takasaki Daruma](https://www.visit-gunma.jp/en/spots/takasaki-daruma/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：手工达摩与先一目、愿成再一目；新年更新。

不能由这些来源推出的内容：

- 再次打开应用本身不是来源给出的补目条件。
- 当前 intro‘日后回访时，再补另一目’弱化了事成/年终的具体语境。
- ‘点睛没有任何宗教加持语义’不能从市售工艺属性推出普遍否定。

具体建议：实际 first visit 单目、returning 可补目。建议介绍与回访提示写清传统条件，产品仍由用户决定回访；不要求实现复杂成就判定。卡中不能把高崎官方两种视角表述误记为地区顺序冲突。

建议用户介绍：达摩是日本常见的不倒翁形祈愿摆偶。常见习惯是先点上一目立愿，目标有了着落，或平安度过一年后，再补另一目。先为一个目标点上一目，让另一目留白；日后回来时，再回看自己走过的路。

## 10. 水引结愿（mizuhiki）

**判定：keep；建议 slug：mizuhiki。**

可证实事实：

- 水引是用和纸纸捻加糊、干燥固结形成的装饰绳。
- 饭田等地传承制作，用于赠答与工艺表达。
- 工艺赠礼可用联结和心意说明，但具体结形用途有场合差异。

对应主来源与实际阅读状态：

- [津田水引折型 — 水引についてのよくあるご質問](https://mizuhiki.jp/manner/mizuhikinituite.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：制作者一手解释水引由和纸纸捻、糊固成绳；607起源自己使用‘据说’。
- [長野県 — 長野県伝統的工芸品（飯田水引）](https://www.pref.nagano.lg.jp/mono/sangyo/shokogyo/seikatsu/kogehin.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：饭田水引和纸材料、赠礼和招待心意、地方工艺身份。
- [飯田市 — G20 飯田水引胸章](https://www.city.iida.lg.jp/soshiki/26/iidamizuhikikenjo.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：产地机构将联结、连接作为该次工艺赠礼的表达。
- [Highlighting Japan — Showing Thoughtfulness with Paper Cords](https://www.gov-online.go.jp/eng/publicity/book/hlj/html/202003/202003_03_en.html)。状态：直接403；不冒充已读正文。支持范围：索引提供细节，但本次直接403，改补制作者与政府来源。

不能由这些来源推出的内容：

- 当前两条路径构成无命名的产品装饰结，不代表任何特定传统结的完整教学。
- 在纸封上写个人短愿是本应用附加，不应写成水引的普遍传统步骤。

具体建议：实际绕环→穿结/收紧→纸封短愿，scene 注释明确不命名结型。intro 保守、文化对应可保留；替换/补充不可访问gov来源，保留‘据说’起源限定。

## 11. 御守伴行（omamori-cycle）

**判定：copy-fix；建议 slug：omamori-cycle。**

可证实事实：

- 锦袋式守札可随身携带，文化对象成立。
- 神社本厅说明常见年末返还更新，也允许佩持至愿望达成。
- 佩持时可依各社说明，不存在仅由这组来源推出的统一强制到期。

对应主来源与实际阅读状态：

- [Kokugakuin University — Shinsatsu, Mamorifuda](https://d-museum.kokugakuin.ac.jp/eos/detail/id=9633)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：小锦袋守札可随身，与较大安置神札不同；寺院与神社历史关联。
- [Jinja Honcho — Entering a Jinja](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：御守不是普通纪念品，可自持或赠亲友。
- [神社本庁 — お神札、お守り](https://www.jinjahoncho.or.jp/omairi/omamori/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：年末返还并更新，也明确可一直佩持到愿望实现。

不能由这些来源推出的内容：

- 来源卡‘不是永久收藏’和‘有期限’容易误导成绝对义务。
- 将袋子扣在旅行包、回访便投木箱是产品处理，不可当作所有神社的固定规范。

具体建议：用户 intro 已写各处佩持返还习惯不同，基本正确。建议只修专卡：补神社本厅直接原文，撤‘必须到期归还’式推论，去掉过时‘待核实必须一年’疑问并表述可佩持至愿成。

## 12. 签纸慢读（omikuji）

**判定：copy-fix；建议 slug：omikuji。**

可证实事实：

- 传统御神签包含问运、吉凶和神意的宗教/占卜语境。
- 编号签棒与对应纸签是常见方法之一。
- 阅读、携回或折系因寺社规定而异。

对应主来源与实际阅读状态：

- [Kokugakuin University — Omikuji](https://d-museum.kokugakuin.ac.jp/eos/detail/?id=9959)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：明确将御神签定义为占卜/询神意，有抽编号签棒再取签文的方法。
- [JNTO — Draw an Omikuji Fortune Slip](https://www.japan.travel/en/japan-magazine/2007_omikuji/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：寺社纸签含吉凶及生活提示，摇筒/编号、携回或指定处折系，地方不同。

不能由这些来源推出的内容：

- 专卡‘不是算命交易’若被理解为传统没有占卜意义，与来源不符。
- 当前固定一句自省提醒、信封收纳和不判吉凶属于产品改编。

具体建议：实际摇筒→抽棒展纸→读固定原创提醒→信封收好。intro 已说‘这里的纸签…不判吉凶’，可留文化关联；专卡应明确传统有吉凶问运，产品采取原创提醒，不以现代心理学解释替代真实传统。

## 13. 庭前一铃（shrine-suzu-bell）

**判定：keep；建议 slug：shrine-suzu-bell。**

可证实事实：

- 神社参拜空间可设铃绳与赛钱箱。
- 导览建议有铃绳时可摇铃，再行参拜礼节。
- 该物件不同于夏日玻璃风铃。

对应主来源与实际阅读状态：

- [Jinja Honcho — Entering a Jinja](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：拝殿前常有赛钱箱与铃绳，有铃可摇，铃声被解释为清净；礼敬程序。

不能由这些来源推出的内容：

- ‘轻收铃绳→点金铃身问安’不是来源记载的参拜步骤。
- 源卡草稿‘上拉’与实际向下拉不应混作固定传统手势。

具体建议：实际粗绳带铃、向下轻拉听铃，器物/文化对应可留。更新源卡手机草稿以匹配实际动作；UI 点铃的静观收尾无需称宗教规定。

## 14. 串花寄意（phuang-malai）

**判定：copy-fix；建议 slug：phuang-malai。**

可证实事实：

- Phuang malai 是泰国用于欢迎和礼敬客人的花环。
- 茉莉花环在母亲节具体用于向母亲表达感谢与敬爱。

对应主来源与实际阅读状态：

- [Thailand Ministry of Foreign Affairs — Thailand’s ASEAN Chairmanship 2019](https://www.mfa.go.th/en/content/5d5bd1fe15e39c3060027598)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：外交机构一手说明 phuang malai 花环在泰国用于迎宾礼敬；勿把标识十穗当所有花环规定。
- [Thailand Foundation — Thai Mother’s Day](https://thailandfoundation.or.th/th/thai-mothers-day/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：母亲节赠茉莉花环表达爱、感谢与尊敬，是具体人际场合。
- [Cornell eCommons — 现卡民族志资料](https://hdl.handle.net/1813/33431)。状态：直接打开失败；不作为已读证据。支持范围：本次未取得可读正文；且泛神屋背景不能替专属花环制作史背书。

不能由这些来源推出的内容：

- 本次未读到能支撑全部车辆后视镜求安、神屋供养和花艺断代细节的直接专源。
- 四簇简化串入环体→向上拉结→放小台写感谢不是普遍规定的泰国仪式步骤。

具体建议：现用户介绍的欢迎/感谢/礼敬有主来源补证，保留专卡与基本场景；来源卡应新增这些器物直接来源，收缩仅靠Cornell泛神屋推导的宽泛列举。不把 ASEAN 标识十穗复制为所有花环标准。

## 15. 红绳自持（hongsheng-red-string）

**判定：original；建议 slug：product-original。**

可证实事实：

- 文学故事的赤绳用于系定夫妇之足，讲的是姻缘。
- 这段原文不是现代绕支架、合扣成手环和自我关照写句的操作依据。

对应主来源与实际阅读状态：

- [《太平广记》卷159〈定婚店〉原文（维基文库转录）](https://zh.wikisource.org/zh/太平廣記_(四庫全書本)/卷159)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：已读原文赤绳系夫妇之足、婚牍叙事；这是文学原始文本，不是百科归纳。
- [识典古籍 — 续幽怪录〈定婚店〉](https://www.shidianguji.com/zh/book/SBCK371/chapter/SBCK371_23)。状态：条目已打开；正文提取有限，主要阅读以卷159原文为准。支持范围：已定位原始文本条目，可作版本对照；本次网页正文提取有限。
- [Chinese Text Project — 定婚店](https://ctext.org/taiping-guangji/159/dinghundian/zhs)。状态：直接403。支持范围：旧链接直接403，已换可读原文；未据其宣称全文已读。

不能由这些来源推出的内容：

- 把自我关照手环标成‘当代习惯’，没有被现有文学来源证明。
- 本命年扎红、月老姻缘和照看自己的产品隐喻不能自动串成同一条传统。
- 本次未找到证据不表示红绳在任何现代社群都没有自我关照含义。
- 旧卡的‘UI必须文学/习惯分层标签’是产品策划要求，不能当成民族志事实或为自爱玩法提供传统来源。

具体建议：实际完全是当代自我关照手作。建议 product-original、去汉人民俗来源与地域；COPY.contemporary/contemporaryText 不应继续以‘当代习惯’背书自爱，改‘手作心意’等自然产品标签，或取消文学/习惯并列卡。月老文学只保留于研究或独立阅读材料。 对当代层逐项结论：本命年扎红、旅游许愿红绳在现卡虽有概括，但本次没有取得可读的社区/宗教机构/田野或遗产主来源，不把这些概括升级为已证实事实；更无主源支持‘本命年红绳=照看自己的心理安放’。撤回将‘照看自己’写成传统意义的文案，撤回‘文学典故/当代习惯双标签是互动成立前提’要求；这套双标签是旧卡的产品策划，不是文献要求。真正有据的〈定婚店〉姻缘文学记录可保留在旧卡，且与本应用自爱手作明确脱钩。

建议用户介绍：沿着收线架绕好红绳，把扣头收拢成环。看一看红绳的弧线，也可以留一句照看自己的话，让这份心意陪伴平常的一天。

## 16. 炉前一炷（chinese-incense）

**判定：relink；建议 slug：chinese-incense。**

可证实事实：

- 中国有香炉的明确馆藏器物。
- 博物馆家庭访谈记载在家中点线香并以容器安放的例子。
- 家庭和具体礼敬场合的香数、供品与动作应保留差异。

对应主来源与实际阅读状态：

- [The Met — Incense Burner, China, 17th–18th century](https://www.metmuseum.org/art/collection/search/61108)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：中国香炉实物与器形历史，为香具基本文化关联提供证据。
- [Smithsonian — Ancestor Worship, Looking at the Altar, Teresa Kan interview](https://archive.asia.si.edu/exhibitions/online/teen/altarinterview3.htm)。状态：网页及直接HTTP正文均已读。支持范围：博物馆所载第一人称家庭回忆：点线香、置小容器、静看；仅此家庭例而非全国规范。
- [中国非遗网 — 白蛇传传说（现卡错误链接）](https://www.ihchina.cn/project_details/12185.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：实际标题白蛇传传说，与敬香器物或动作无关。

不能由这些来源推出的内容：

- 眼前原创三足陶炉、盖托、纸套握点、一炷插孔和轻点茶托不是来源规定的传统程序。
- 清明烧纸照片不是当前香炉静物的器物依据。
- 白蛇传 URL 不能用于证明敬香、雕版或皮影。

具体建议：实际开盖→安一炷细香→轻点茶托/炉身静烟。建议新 chinese-incense 器物卡，2–3条事实如上，不再让祭祖/儒礼大卡替原创香具静物背书。可保留中国香具文化背景，物件明显有证，不需全部降为原创。用户介绍可去过宽的统一敬香步骤，仅保留各地有差异与眼前动作。

## 17. 茶山一盏（blang-tea）

**判定：relink；建议 slug：jingmai-tea-forest。**

可证实事实：

- 景迈山茶林文化景观由布朗族与傣族社区长期维护。
- 林下茶树栽培与当地山地生态和社区管理相联系。
- 遗产说明记录茶祖信仰与相关仪式节庆，但不等于日常倒茶就是祭茶祖。

对应主来源与实际阅读状态：

- [UNESCO World Heritage Centre — Cultural Landscape of Old Tea Forests of the Jingmai Mountain in Pu’er](https://whc.unesco.org/en/list/1665/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：布朗族和傣族社区、林下茶树栽培、森林村落、管理制度与茶祖信仰的具体景迈遗产。

不能由这些来源推出的内容：

- 原创陶壶、添叶和倒一杯茶没有被来源确认为布朗族专属器形或仪式。
- 广泛布朗宗教总卡中的接木龙、祭龙、供僧与此现代茶歇不能自动合并。

具体建议：实际添叶→提壶倒茶→静看茶杯，README 已明确原创当代茶歇。新 jingmai-tea-forest 生态/文化景观卡会比 blang-traditional 的佛寺讲坛更准确；事实可按上面3条建立。intro 对茶山照料者的感谢是当下体验，可以保留地区背景而不假称独有茶礼。

## 18. 蓝白晾晴（bai-indigo-cloth）

**判定：relink；建议 slug：bai-tie-dye。**

可证实事实：

- 大理周城等地传承白族扎染。
- 绞扎形成防染部位，经染色和拆线呈现留白纹样。
- 蓝白是常见基调，工艺可包含反复浸染、漂洗与晾晒。
- 染缸、染棒、晒架是资料列举工具。

对应主来源与实际阅读状态：

- [中国非遗网 — 白族扎染技艺](https://www.ihchina.cn/project_details/14304.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：大理/周城、棉布与植物蓝靛、绞扎染色工艺、晒架；国家级项目直源。
- [中国非遗网 — 大理周城白族的扎染工艺](https://www.ihchina.cn/news_1_details/11139.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：扎花、反复浸染、拆线、蓝白图案、漂洗晾晒与木竹晒架；原调查描述。
- [云南非遗保护网 — 白族扎染技艺](https://www.ynich.cn/item/148.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：交叉确认大理周城等地与扎染技艺身份。

不能由这些来源推出的内容：

- 本主信仰总卡及本主庙图片不是扎染工艺证据。
- 一盆清水中的拆线/展开合并是产品压缩，不能当成完整技艺次序。
- 旧调查里的药效/辟邪解释不可据蓝白工艺推出。

具体建议：实际已染扎布送漂洗盆→展开→搭木杆，README 已说明压缩和原创纹样。新 bai-tie-dye 专卡，以上4条事实足够，不要求模型复刻某一作坊或器具。intro 基本准确，替换来源关联即可。

## 19. 竹筛迎岁（bokjori）

**判定：keep；建议 slug：bokjori。**

可证实事实：

- Bokjori 是岁首新购并悬挂的竹制淘米器。
- 韩国研究院与国立民俗博物馆记录以淘米比拟取福的含义。
- 可挂在门上或墙面，盛放内容随习惯不同。

对应主来源与实际阅读状态：

- [Academy of Korean Studies — 복조리](https://encykorea.aks.ac.kr/Article/E0023713)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：新年购置悬挂淘米器、将福比作米粒；原作者学术条目由研究院发布。
- [National Folk Museum of Korea — 복조리, 무엇에 쓰는 물건일까?](https://webzine.nfm.go.kr/2016/11/30/복조리/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：细竹编淘米器，岁首购买悬挂，线/火柴/糖等盛放例；民俗解释。

不能由这些来源推出的内容：

- 先在米盘纳一撮米再挂墙不是这两个来源明确列出的固定程序。
- 不能把产品米粒称作实际招福媒介或把每次纳米说成必要步骤。

具体建议：实际纳米→提竹柄悬挂→静观。基本器物、悬挂和纳福寓意均有主来源，符合允许简化的标准。保留专卡和当前介绍；将先纳米的产品演绎放 README 说明即可，不据未找到固定流程而否定传统。

## 20. 方巾裹礼（korean-bojagi-wrap）

**判定：keep；建议 slug：korean-bojagi。**

可证实事实：

- 包袱布用于包裹、运输、储存物件，也可遮盖食物。
- 方形和长方形皆有，拼接余布是一类做法。
- 材料、图案及阶层用途存在差异。

对应主来源与实际阅读状态：

- [LACMA, curator Virginia Moon — Bojagi: The Korean Wrapping Cloth](https://unframed.lacma.org/2014/01/02/bojagi-the-korean-wrapping-cloth)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：博物馆策展人对包裹携带收纳遮食用途、方/长方形、材料与拼布的一手藏品阐释。
- [Smithsonian — Wrapping Cloth (Bojagi)](https://www.si.edu/object/wrapping-cloth-bojagi%3Anmnhanthropology_8343143)。状态：直接访问失败/HTTP403；未读正文。支持范围：该馆藏四角系带本次未能直接复核；不作为新结论支点。

不能由这些来源推出的内容：

- 当前四角系带与收结几何的具体结构不由 LACMA 这篇概览单独证明。
- 可选写愿和静看针脚是产品附加，不是包袱布传统步骤。

具体建议：实际翻近角包盒→拉相连带收拢→静观，README 明确现代缩略包装。保留；Smithsonian 本次访问失败须诚实标注但不等于否定存在四角系带实物。核心织物与用途已由 LACMA 支撑，用户允许形制简化，不需因为第二条URL失败而降为原创。

## 21. 木柶行棋（korean-yutnori）

**判定：keep；建议 slug：korean-yutnori。**

可证实事实：

- 四根一平一圆木柶的落面对应一至五步。
- 传统玩法可轮流投掷、按结果行棋，yut和mo可再投。
- 国立民俗博物馆记录从春节至正月十五共玩，男女老幼可参与。

对应主来源与实际阅读状态：

- [National Folk Museum of Korea — 윷놀이](https://www.nfm.go.kr/kids/elecontents/view.do?topic=46)。状态：web工具定位后直接HTTP读取韩文正文（2026-10-19）。支持范围：四根木柶、五种结果1–5步、yut/mo再投、节日亲友共玩。
- [Leslie Burnham — Yut: A Traditional Korean Game (Ohio State hosted teaching document)](https://bpb-us-w2.wpmucdn.com/u.osu.edu/dist/a/43197/files/2017/02/Burnham-Korea-1zj2mdp.pdf)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：第3页四根平圆木柶、落面对应、规则，第4页棋盘；属教师课程原件，非大学民族志研究。

不能由这些来源推出的内容：

- 一枚棋子沿外圈不断绕行、任意结果后可继续，是产品自由玩法，不代表传统多人规则全集。
- 随机公平面抽样、助手动画、蓝色棋子与端纹不是来源所载历史概率和样式。

具体建议：实际规则和 README 已明确一棋子自由玩法、无对手/捷径/吃子。保留卡与intro，不需强行补完整传统游戏，更不要把学校课程文件误标为大学原始田野研究。

## 22. 鲤旗迎风（japanese-koinobori）

**判定：keep；建议 slug：japanese-koinobori。**

可证实事实：

- 鲤旗是日本儿童节前后的布制鲤鱼形风物。
- 公开介绍将它与儿童健康成长、勇敢坚强的祝愿联系。
- 色彩、大小和展示方法随着时代变化。

对应主来源与实际阅读状态：

- [Web Japan / Japan Ministry of Foreign Affairs — May: Carp Streamers](https://web-japan.org/kidsweb/manga/0705/index.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：四月底至5月5日儿童节布鲤、成长祝愿、色彩与家庭陈设的变化。
- [Japan Society — Children’s Day: Kodomo No Hi](https://japansociety.org/events/childrens-day-2024/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：机构主办的家庭活动及制作鲤旗、对孩子勇敢强健的祝愿。
- [Watanabe Koinobori — Official Site](https://watanabe-koinobori.jp/en)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：制作者对鲤旗形态、儿童成长与家庭祝愿的自述。

不能由这些来源推出的内容：

- 单尾青绿色、三步木坠滑轮升挂是产品选型，不是唯一完整儿童节陈设。

具体建议：实际开布尾→牵绳升起→挂稳，来源卡与 README 已讲清抽取器物和原创选择。基本轮廓与文化关联充分，保留；无需固定颜色对应性别或补全鲤旗套件。

## 23. 木版留春（chinese-woodblock-print）

**判定：relink；建议 slug：chinese-woodblock-print。**

可证实事实：

- 雕版刷印使用刻好的木版、纸与墨。
- 棕把用以刷色，棕擦可以棕皮与木芯等制作。
- 刷印流程含固版、刷色、覆纸及在纸上刷印。

对应主来源与实际阅读状态：

- [中国非遗保护中心 — 中国雕版印刷技艺](https://www.ihchina.cn/tjq_information_detail/22182.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：木版、纸墨、棕把/棕擦、刷印等官方完整技艺介绍。
- [UNESCO — China engraved block printing technique](https://ich.unesco.org/en/RL/china-engraved-block-printing-technique-00229)。状态：JS/验证码挑战；不可读。支持范围：本次JS挑战，未以搜索摘要冒充正文。
- [扬州中国雕版印刷博物馆 — 中韩日现存古籍雕版印刷技术分析](https://yzmuseum.com/index.php?a=show&g=home&id=258&m=article)。状态：HTTP503；未读正文。支持范围：README 所引馆页本次503，已换非遗中心直源。

不能由这些来源推出的内容：

- 民间信仰/祭祖/儒礼总卡及清明烧纸图与普通枝叶木版不对应。
- 场景枝叶图案、心愿输入和‘留春’是产品创作，不是传统祈福印式。

具体建议：实际拿棕擦刷纸背→揭纸角→看枝叶印，README 已清楚不是宗教。新 chinese-woodblock-print 专卡用上述3条事实和已读非遗中心URL；去儒礼总卡导航，不需改现自然工艺文案。

## 24. 影偶小戏（chinese-shadow-puppet）

**判定：relink；建议 slug：chinese-shadow-puppet。**

可证实事实：

- 中国皮影戏以兽皮或纸板剪制形象，借灯光投影表演。
- 分件相接并用竹扦等操纵是可证实的工艺关系。
- 艺人、戏班及不同地方声腔构成传承，不能把某一地方格式视作全国唯一。

对应主来源与实际阅读状态：

- [中国非遗网 — 皮影戏（海宁皮影戏）](https://www.ihchina.cn/project_details/13397.html)。状态：web打开并直接HTTP读取正文。支持范围：官定项目页的全国工艺概述：兽皮或纸板、灯光投影、分件连结、竹扦操作，并具体区分海宁声腔。
- [中国非遗网 — 争取让皮影一代代传下去（毛美亚访谈报道）](https://www.ihchina.cn/character_detail/8848.html)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：传承人演出和自制纸影偶的一手采访场景，佐证操纵杆与纸材；不是所有皮影派别通则。
- [UNESCO — Chinese shadow puppetry](https://ich.unesco.org/en/RL/chinese-shadow-puppetry-00421)。状态：JS/验证码挑战；不可读。支持范围：本次主页面JS挑战；替换为可读官方项目页。

不能由这些来源推出的内容：

- 民间信仰/儒礼大卡不等于普通影偶工艺的来源。
- 原创纸鸟、一片铰接翼、双杆与棕色几何影子是简化模型，不是已知传统角色、剧目或完整戏班演出。

具体建议：实际从幕后提主杆、移翼杆观看投影；README 已记录 lamp→puppet→screen。新 chinese-shadow-puppet 卡按3条基本事实编写，参考海宁页的全国工艺概述，勿将小鸟命名为海宁传统角色，也不要求复刻馆藏/传统人物。

## 25. 叶舟寄意（floating-lantern-loy-krathong）

**判定：keep；建议 slug：floating-lantern-loy-krathong。**

可证实事实：

- 泰国水灯节在河、湖等水面漂放装饰有花与蜡烛的 krathong。
- 官方介绍包含礼敬水神与寄托祝愿的语境。
- 官方活动介绍包含自然/可降解材料的水灯制作。

对应主来源与实际阅读状态：

- [Tourism Authority of Thailand — Loi Krathong Festival 2024](https://www.tatnews.org/2024/11/loi-krathong-festival-2024-experience-thailands-enchanting-festival-of-lights/)。状态：已打开并阅读相关正文（2026-10-19）。支持范围：装饰花与蜡烛的水灯漂于河湖，礼水与愿望语境；自然材料制作及当次满月日。

不能由这些来源推出的内容：

- 现源卡还分述中国中元河灯，不可把该支纪念亡亲的意义移植到眼前泰国叶舟。
- 花朵→点芯→轻推的三步是简化呈现，不等于复现全部节庆。
- 不可仅因都是灯而混作天灯或寺院供灯。

具体建议：实际折叶舟/花座/烛芯/水面，泰国对象准确。保留现专卡与intro。卡中中国河灯应维持独立分述或日后独立建卡；当前场景只使用泰国部分证据，不需把基本文化关联降为原创。
