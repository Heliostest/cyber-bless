# 场景介绍扩充与文化来源核查：C 组

核查日期：2026-10-20（Asia/Shanghai）。范围为 `artifacts/narrative-expansion/assignment-c.json` 的40项；介绍实现位于 `packages/core/src/scene-narratives/c.ts`。本轮只扩充说明与追溯文档，保留技术ID、来源slug、隐藏策略、模型、交互、音效、触感和完成条件。宿主接入与界面分段由主代理负责；未提交、未推送。

每项已对照当前 `scene.ts` 的实际物件与用户文字、已有 README（无文件时建立最小追溯文档）、来源卡、现有研究。旧记录只提供检索线索；下表列的是本轮重新打开阅读的外部证据。旧全场景核查、题材专项研究与当前场景事实均不充当新增文化史的证据。

`read` 表示网页工具直接取得并阅读所列正文；`read-direct-http` 表示网页工具不稳定后直接请求该机构页面或PDF，用 BeautifulSoup/pypdf 提取并实际阅读所列段落。没有把HTTP200本身、搜索摘要、导航页、验证码或乱码当作正文。未下载素材用于产品。机构综述按综述使用，访谈按受访者对自身实践的叙述使用，馆藏年代只证明该实例，不作为普遍起源。

本轮正文每条两段，约204–255字，主要说明地区/社群、可考历史或当代延续、生活用途及真实信念。礼俗保留敬神、供养、占问或祈愿语境；工艺不补造神圣用途。无法确定起源的事项收窄到有证据的时代或现行实践，未用遗产申报年份替代起源。访问失败和不能外推的细节留在本文，不以研发标签堆入用户介绍。

## 重要证据边界

- 套娃以1900年巴黎展出为时间锚点；不能据此确定唯一发明者。威尔士爱勺1667年款也是存世物件年代。
- 运玉约1954年前后是现行陶土球改制的沿革；不等于鵜户神宫或龟岩信仰的起源。
- 石舍竹蜻蜓的1990年代线索来自越南旅游信息机构的地方手工业介绍；未改写成古老仪式。
- 转经筒的十二至十三世纪线索精确对应Rubin文章图3的经咒卷与金属轴图注，不是文中主图手持转筒的日期。
- 燃灯会真实动作包括制灯、悬灯和巡行；当前场景只有轻点/上推后莲灯上移和静看，未实现制灯，动画也不是放天灯传统。
- 供水本轮读到CGC的1998公开教导；LDC与FPMT讲义重访失败，不冒称重读成功。七只铜碗与由左至右添水只在介绍末段描述眼前场景，不在本轮扩为所有寺院通行规则。

## 逐项核查


<a id="polish-blessing-basket"></a>

### 一篮春食 · `polish-blessing-basket`

最终来源 slug：`polish-folk-catholic`。当前实现：`packages/scenes/src/polish-blessing-basket/scene.ts`。

**实际器物与动作：** 圆面包和彩蛋先后放入白布篮，完成后静看或自愿写感谢。

**本轮文化范围：** 保留波兰天主教、圣周六、教堂祝福及面包/蛋的基督教语境。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Holy Trinity Parish — Święconka – Blessing of Easter Baskets](https://holytrinityparish.ie/2026/03/swieconka-blessing-of-easter-baskets-2/) | 正文“On Holy Saturday”至邀请家庭携篮段 | `read`；2026-10-20；原日期：2026-03-26 | 2026年爱尔兰堂区延续波兰圣周六祝福食物篮。 |
| [Holy Trinity Parish — Swieconka: Polish Blessing of the Baskets](https://holytrinityparish.ie/download/swieconka-blessing-of-easter-baskets/) | PDF第1–3页：篮子、食物祝福、面包和彩蛋祷词及象征说明 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 白布篮、食物、教堂祝福与基督复活/新生命信念；不是全国唯一清单。 |


**具体缺口与处理：** 没有确证此习俗起始年份；仅述当代家庭与移民堂区实践。

**产品简化与新增表达：** 两件食物为节选，日景和感谢输入为产品；未模拟司铎祝福。

**访问异常：** 小波兰旧旅游入口本轮HTTP403；堂区PDF网页工具超时后直接HTTP成功，已读第1–3页。

**同步：** [来源卡](../../content/traditions/polish-folk-catholic.md)、[场景README](../../packages/scenes/src/polish-blessing-basket/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="polish-oplatek-sharing"></a>

### 薄饼相祝 · `polish-oplatek-sharing`

最终来源 slug：`polish-oplatek-sharing`。当前实现：`packages/scenes/src/polish-oplatek-sharing/scene.ts`。

**实际器物与动作：** 两位家人的手递出薄饼、分角、交接。

**本轮文化范围：** 平安夜家庭祝愿、面粉水薄饼和和解有当代堂区自述。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [North Oxford Catholic Family of Parishes — Wigilia i Pasterka](https://nocfop.dol.ca/wigilia-i-pasterka) | Wigilia正文148–168行：第一颗星、祈祷、分享薄饼和祝愿 | `read`；2026-10-20；原日期：未见发布日期 | 波兰家庭平安夜、面粉水薄饼、和解关怀；不采用不相关礼仪年断言。 |


**具体缺口与处理：** 起源及最早年代未证实，不写千年源流。

**产品简化与新增表达：** 一对人的一次分饼，不是完整晚餐、圣餐或祈祷顺序。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/polish-oplatek-sharing.md)、[场景README](../../packages/scenes/src/polish-oplatek-sharing/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="polish-paper-cut"></a>

### 剪纸开花 · `polish-paper-cut`

最终来源 slug：`polish-wycinanki`。当前实现：`packages/scenes/src/polish-paper-cut/scene.ts`。

**实际器物与动作：** 剪最后纸边、向左展开对称花叶，静看或附短句。

**本轮文化范围：** 十九世纪家庭装饰、Kurpie/Łowicz区别；普通工艺。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Adam Mickiewicz Institute / Culture.pl — Kurpie, Łowicz, Kashubian, Architectural: A Brief Guide to Paper Cutouts](https://culture.pl/en/article/kurpie-lowicz-kashubian-architectural-a-brief-guide-to-paper-cutouts) | 正文28–71行，乡村起源、制作、地方流派段 | `read`；2026-10-20；原日期：未见发布日期 | 十九世纪发展、居家装饰、折剪与地域差异；不支持本场原创花枝的固定吉祥义。 |


**具体缺口与处理：** 模型不是特定地区传承图样，不解释为普遍祈福图案。

**产品简化与新增表达：** 末道剪口、原创花枝和留言为产品节选。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/polish-wycinanki.md)、[场景README](../../packages/scenes/src/polish-paper-cut/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="puerto-rican-guiro"></a>

### 瓜棱轻奏 · `puerto-rican-guiro`

最终来源 slug：`puerto-rican-guiro`。当前实现：`packages/scenes/src/puerto-rican-guiro/scene.ts`。

**实际器物与动作：** 素色中空瓜壳横棱，木棒下刮、回刮、移开。

**本轮文化范围：** 十九世纪波多黎各实物与加勒比节奏用途。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [The Metropolitan Museum of Art — Güiro, 89.4.2758](https://www.metmuseum.org/art/collection/search/502789) | 器物说明及Object Details，3–44行 | `read`；2026-10-20；原日期：未见发布日期 | 十九世纪波多黎各馆藏、瓜壳木材、刮擦棱纹发声、加勒比节奏用途。 |


**具体缺口与处理：** 未确定更早起源与特定族群发明关系；不追加仪式信念。

**产品简化与新增表达：** 器物原创，声音合成、两次刮擦并非曲谱或演奏教学。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/puerto-rican-guiro.md)、[场景README](../../packages/scenes/src/puerto-rican-guiro/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="purepecha-copper-bowl"></a>

### 铜碗拾暖 · `purepecha-copper-bowl`

最终来源 slug：`santa-clara-copper-craft`。当前实现：`packages/scenes/src/purepecha-copper-bowl/scene.ts`。

**实际器物与动作：** 软布擦铜碗、移到毡座、静看锤纹和卷边。

**本轮文化范围：** 米却肯Santa Clara地方铜业与日用容器；非普雷佩查宗教仪式。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Instituto Nacional de Antropología e Historia — Santa Clara del Cobre](https://lugares.inah.gob.mx/es/node/4804) | 正文56–78行，考古、殖民时期生产和当代作坊段 | `read`；2026-10-20；原日期：未见发布日期 | 米却肯地方铜作、前西班牙遗存、十七世纪冶炼厂及现代工坊；不把族群宗教移到普通碗。 |
| [Casa de las Artesanías de Michoacán — Concurso del Cobre Martillado reúne 387 piezas en Santa Clara del Cobre](https://iam.gob.mx/public/concurso-del-cobre-martillado-reune-387-piezas-en-santa-clara-del-cobre) | 正文38–43行，铜器竞赛、获奖器类与展售 | `read`；2026-10-20；原日期：网页2026-08-17；报道日期2026-08-09 | 当地锤锻锅、盘、果盘、花瓶等器类与当代匠人；不作法律权利结论。 |


**具体缺口与处理：** 技术ID中的purepecha不据此扩大为全民族器物和信仰；无本碗祈福寓意。

**产品简化与新增表达：** 擦拭、毡座和铜色变化为欣赏片段，没有展示熔炼锤锻。

**访问异常：** 旧官方公报入口本轮网页超时、HTTP发生TLS错误；改读州工艺机构2026报道器类。文化旅游旧页跳404，未采用。

**同步：** [来源卡](../../content/traditions/santa-clara-copper-craft.md)、[场景README](../../packages/scenes/src/purepecha-copper-bowl/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="romanian-martisor"></a>

### 红白寄春 · `romanian-martisor`

最终来源 slug：`romanian-martisor`。当前实现：`packages/scenes/src/romanian-martisor/scene.ts`。

**实际器物与动作：** 已取下红白绳环，提起、套花枝、轻放两流苏。

**本轮文化范围：** 十九世纪文字线索及当代迎春/挂树实践，健康好运归为信念。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [罗马尼亚农民博物馆 / Irina Nicolau — Povestea mărțișorului](https://sitevechi.muzeultaranuluiroman.ro/history/povestea-martisorului-en.html) | 正文红白绳、1800年记述、十九世纪民族志、佩戴差异段 | `read-direct-http`；2026-10-20；原日期：文末署1997-03-01 | 红白绳、健康好运、地方变体及十九世纪可考记录；不确立远古发明者。 |
| [Dimitrie Gusti National Village Museum — Primăvara în sat. Târg de Mărțișor](https://muzeul-satului.ro/events/primavara-in-sat-targ-de-martisor-3/) | 正文143–148行，2026年春季集市与佩戴/树枝习俗段 | `read`；2026-10-20；原日期：2026年活动 | 当代3月迎春、佩戴后挂开花树枝、礼物和手工艺。 |


**具体缺口与处理：** 没有统一期限、年龄、性别或红白唯一象征；未证实古代起源。

**产品简化与新增表达：** 挂环路径和三拖为简化，不包含送礼与佩戴全过程。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/romanian-martisor.md)、[场景README](../../packages/scenes/src/romanian-martisor/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="rosh-hashanah-apple-honey"></a>

### 蘸蜜迎岁 · `rosh-hashanah-apple-honey`

最终来源 slug：`rosh-hashanah-apple-honey`。当前实现：`packages/scenes/src/rosh-hashanah-apple-honey/scene.ts`。

**实际器物与动作：** 苹果片拿起、蘸入实体蜜面、提起回盘。

**本轮文化范围：** 犹太新年宗教祝福、好甜新年祈求；中世纪法国记录为线索。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Chabad.org / Rabbi Yehuda Shurpin — Why Do We Dip the Apple Into Honey on Rosh Hashanah?](https://www.chabad.org/library/article_cdo/aid/591014/jewish/Why-Do-We-Dip-the-Apple-Into-Honey-on-Rosh-Hashanah.htm) | 正文260–271行及注释：新年餐食、祝福、甜蜜年祈愿、Simcha of Vitri记录 | `read`；2026-10-20；原日期：未见发布日期 | 当代犹太新年蘸蜜与宗教祷愿；中世纪法国文献作为流传线索，不采用不确定的Geonic起源。 |


**具体缺口与处理：** 不是单一国家独有；不宣称确定起源或全体统一祷词顺序。

**产品简化与新增表达：** 苹果颜色、陶碟、回盘、白昼庭院为产品安排，未模拟食用。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/rosh-hashanah-apple-honey.md)、[场景README](../../packages/scenes/src/rosh-hashanah-apple-honey/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="russian-matryoshka"></a>

### 套娃相藏 · `russian-matryoshka`

最终来源 slug：`russian-matryoshka`。当前实现：`packages/scenes/src/russian-matryoshka/scene.ts`。

**实际器物与动作：** 提外壳、收小娃、合接缝；两只原创彩绘木偶。

**本轮文化范围：** 1900展出、二十世纪生产及Semenov等地方差异。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [The Museum of Russian Art — A Thousand Nesting Dolls](https://tmora.org/2024/08/27/a-thousand-nesting-dolls/) | 展览正文：起源传说、1900巴黎、革命前产业、苏联生产、1990年代及Semenov作品 | `read-direct-http`；2026-10-20；原日期：2024-08-27 | 1900年已展出、二十世纪产业与地方/作者差异；不选择唯一发明传说。 |


**具体缺口与处理：** 最早创作者与起源传说不确定；不把多子多福/母性当全部套娃固定意涵。

**产品简化与新增表达：** 只展示两个尺寸，配色图案及相套辅助为产品。

**访问异常：** Museums Victoria对象页本轮网页工具内部错误，未将旧已读记录当新证据。

**同步：** [来源卡](../../content/traditions/russian-matryoshka.md)、[场景README](../../packages/scenes/src/russian-matryoshka/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="scottish-plunge-churn"></a>

### 木杆搅乳 · `scottish-plunge-churn`

最终来源 slug：`scottish-plunge-churn`。当前实现：`packages/scenes/src/scottish-plunge-churn/scene.ts`。

**实际器物与动作：** 木杆下压、上提回转、轻提盖；木桶金属箍与静态乳面。

**本轮文化范围：** 泰里岛家庭乳业史、二十世纪中叶仍用与劳动用途。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [An Iodhlann / Dr John Holliday — The History of Tiree in 100 Objects: 62. The Plunge-Churn](https://www.aniodhlann.org.uk/wp-content/uploads/object-no.-62-plunge-churn.pdf) | PDF第1–3页，木桶构造、起落轻转、妇女儿童劳动、1950年代回忆与黄油储存 | `read`；2026-10-20；原日期：未见发布日期 | 泰里岛乡村乳品生产和十九至二十世纪生活史；不把后列传说当本场祈福。 |


**具体缺口与处理：** 器型精确始年未定；不搬用史料中的巫术故事为当前用途。

**产品简化与新增表达：** 两次动作不制造黄油；结构与尺寸原创，不是制作教程。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/scottish-plunge-churn.md)、[场景README](../../packages/scenes/src/scottish-plunge-churn/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="setsubun-mamemaki"></a>

### 节分撒豆 · `setsubun-mamemaki`

最终来源 slug：`setsubun-mamemaki`。当前实现：`packages/scenes/src/setsubun-mamemaki/scene.ts`。

**实际器物与动作：** 推开木扇，木枡豆子向外再向内撒。

**本轮文化范围：** 日本立春前节分、炒黄豆木枡、驱厄迎福的真实民俗语境。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [日本外务省 Web Japan / Kids Web Japan — Setsubun](https://web-japan.org/kidsweb/explore/calendar/february/setsubun.html) | 正文38–48行，节分含义、masu、炒豆及驱厄祝愿 | `read`；2026-10-20；原日期：未见发布日期 | 日本立春前节分撒豆和民间信念；不采用页面可能过时的固定公历日。 |


**具体缺口与处理：** 起源年代未核实，不写固定公历日、必吃数量或通用次数。

**产品简化与新增表达：** 三步和粒数为画面简化，反馈不代表现实驱厄。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/setsubun-mamemaki.md)、[场景README](../../packages/scenes/src/setsubun-mamemaki/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="shichigosan-chitose-ame"></a>

### 千岁赠糖 · `shichigosan-chitose-ame`

最终来源 slug：`shichigosan-chitose-ame`。当前实现：`packages/scenes/src/shichigosan-chitose-ame/scene.ts`。

**实际器物与动作：** 长纸袋、绳提手、红白包装长糖；家长提起递近放低，儿童接稳。

**本轮文化范围：** 江户关东传播、成长长寿、千岁糖赠礼。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [神奈川县 — 11月 霜月（文化介绍）](https://www.pref.kanagawa.jp/documents/79520/culture11.pdf) | PDF第2页16–79行，七五三与千岁饴段 | `read`；2026-10-20；原日期：未见发布日期 | 江户关东到各地、成长长寿、父母赠糖及红白长糖；多种起源说不选其一。 |


**具体缺口与处理：** 不以某糖商传说确立发明年份，糖支数和袋纹不作规定。

**产品简化与新增表达：** 只模拟赠礼，不含神社参拜、吃糖或完整七五三。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/shichigosan-chitose-ame.md)、[场景README](../../packages/scenes/src/shichigosan-chitose-ame/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="shinto-torii"></a>

### 庭前一礼 · `shinto-torii`

最终来源 slug：`shinto`。当前实现：`packages/scenes/src/shinto-torii/scene.ts`。

**实际器物与动作：** 走近鸟居、低头、静立；宿主完成后可自愿附记。

**本轮文化范围：** 日本神社空间边界、敬神与当代入社礼节。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [神社本厅 — Entering a Jinja](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/) | 正文Entering、Purification及Paying Respects相关段9–56行 | `read`；2026-10-20；原日期：未见发布日期 | 鸟居界线、入内前停步礼敬、铃绳及铃声清净；当代参拜说明，不是年代史料。 |


**具体缺口与处理：** 未核实鸟居最早年代；不虚写远古起源。

**产品简化与新增表达：** 宿主当前不是绘马挂牌流程；旧介绍的绘马叙述已从本轮正文移除。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/shinto.md)、[场景README](../../packages/scenes/src/shinto-torii/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="shrine-suzu-bell"></a>

### 庭前一铃 · `shrine-suzu-bell`

最终来源 slug：`shrine-suzu-bell`。当前实现：`packages/scenes/src/shrine-suzu-bell/scene.ts`。

**实际器物与动作：** 拉铃绳、松手、收回，听余音，可自愿文字。

**本轮文化范围：** 参拜金属铃及宗教清净语境。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [神社本厅 — Entering a Jinja](https://www.jinjahoncho.or.jp/en/at-a-jinja/entering/) | 正文Entering、Purification及Paying Respects相关段9–56行 | `read`；2026-10-20；原日期：未见发布日期 | 鸟居界线、入内前停步礼敬、铃绳及铃声清净；当代参拜说明，不是年代史料。 |


**具体缺口与处理：** 无本轮可靠起源年代，不称全国必有或统一次数。

**产品简化与新增表达：** 不模拟完整二礼二拍一礼，也不以完成反馈表示获护佑。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/shrine-suzu-bell.md)、[场景README](../../packages/scenes/src/shrine-suzu-bell/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="sicilian-painted-cart"></a>

### 彩车迎晴 · `sicilian-painted-cart`

最终来源 slug：`sicilian-carretto-craft`。当前实现：`packages/scenes/src/sicilian-painted-cart/scene.ts`。

**实际器物与动作：** 装木轮到车轴，整车移展垫，静看。

**本轮文化范围：** 十九世纪运输农业与雕绘工艺；不是圣人节大型花车。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Museo del Carretto Siciliano, Aci Sant’Antonio — Our Story](https://www.museodelcarrettosiciliano.it/en/story/) | 正文24–39行，十九世纪道路运输、农用、雕刻和彩绘题材 | `read`；2026-10-20；原日期：未见发布日期 | 西西里carretto社会用途及工艺；不是Santa Rosalia圣人节花车。 |


**具体缺口与处理：** 不将博物馆2014开馆当起源，原创色块没有传统叙事题材。

**产品简化与新增表达：** 装轮和展示为缩略，不是制车全过程。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/sicilian-carretto-craft.md)、[场景README](../../packages/scenes/src/sicilian-painted-cart/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="slavic-wreath"></a>

### 火边花环 · `slavic-wreath`

最终来源 slug：`kupala-wreath`。当前实现：`packages/scenes/src/slavic-wreath/scene.ts`。

**实际器物与动作：** 点按编草花环、放水面、目送或附记。

**本轮文化范围：** 乌克兰Kupala与圣若翰交织、真实婚恋占问；波兰仅比较。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Canadian Institute of Ukrainian Studies / Mykola Mushynka — Kupalo festival, Encyclopedia of Ukraine](https://www.encyclopediaofukraine.com/display.asp?linkpath=pages%5CK%5CU%5CKupalofestival.htm) | 正文34–48行，仲夏、基督教圣若翰、青年、花冠水流占问及文字记录 | `read`；2026-10-20；原日期：未见发布日期 | 乌克兰地方习俗和历史层次；学术综述，不将中古节庆记录精确断代为每项花环动作。 |
| [Muzeum Wsi Radomskiej — Noc Świętojańska](https://muzeum-radom.pl/wydarzenia/noc-swietojanska/2609) | 正文63–75行，Sobótki、未婚女性花环与婚恋占问 | `read`；2026-10-20；原日期：2021-06-22 | 波兰相邻习俗作比较；不把木板/烛台等当地细节移作乌克兰统一规则。 |


**具体缺口与处理：** 中古记载不确立花环动作始年，不概括全体斯拉夫人。

**产品简化与新增表达：** 本场漂流轨迹无占卜结果，未再现完整节庆。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/kupala-wreath.md)、[场景README](../../packages/scenes/src/slavic-wreath/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="slovak-wire-bird"></a>

### 铁线栖鸟 · `slovak-wire-bird`

最终来源 slug：`slovak-wire-craft`。当前实现：`packages/scenes/src/slovak-wire-bird/scene.ts`。

**实际器物与动作：** 铁线鸟接翅、落木栖座、静看。

**本轮文化范围：** 斯洛伐克修补业到家用品、玩具及1940/1960年代艺术变化。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Považská galéria umenia v Žiline / Považské múzeum — Drotárstvo](https://www.pgu.sk/v%C3%BDstavy/drotarstvo/) | 展览正文，修补业、家庭器物玩具、1940年代雕塑和1960年代线艺段 | `read-direct-http`；2026-10-20；原日期：2010年展览 | 斯洛伐克铁线从实用到装饰艺术的变化；不能证明原创小鸟有固定寓意。 |


**具体缺口与处理：** 不把鸟形写作护佑或统一民族象征；更早铁线工艺起源未定。

**产品简化与新增表达：** 线鸟形体、接一翼和木座为原创展示。

**访问异常：** PGU网页工具超时后直接HTTP正文成功；ÚĽUV个人作者页超时不作为已读证据。

**同步：** [来源卡](../../content/traditions/slovak-wire-craft.md)、[场景README](../../packages/scenes/src/slovak-wire-bird/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="sorbian-painted-egg"></a>

### 彩蛋寄春 · `sorbian-painted-egg`

最终来源 slug：`sorbian-easter-eggs`。当前实现：`packages/scenes/src/sorbian-painted-egg/scene.ts`。

**实际器物与动作：** 画笔添原创花枝、彩蛋放陶杯、静看或祝愿。

**本轮文化范围：** 德国卢萨蒂亚索布社群、教父母礼赠地域实例及生命力信念，真实技术多样。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [City of Bautzen — Sorbian Traditions and Customs](https://www.bautzen.de/en/citizens-town-hall-politics/city-portrait/the-sorbs/sorbian-traditions-and-customs) | Sorbian Easter Egg Market正文 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 卢萨蒂亚索布族复活节彩蛋、蜡绘染色擦拭刮刻及公众示范；不借骑乘巡游说明蛋纹。 |
| [Museum Sorbische Webstube Drebkau — Ostereiermarkt 2025](https://www.sorbische-webstube.de/veranstaltungen/2670118/2025/03/30/ostereiermarkt-2025.html) | 活动正文6–22行 | `read`；2026-10-20；原日期：活动2025-03-30 | Drebkau/Drjowk当代彩蛋艺术家示范、售卖和公众绘蛋；不证实古代起源。 |
| [Sorbian Cultural Information Centre — Sorbian Customs](https://info.sorben.com/wp-content/uploads/2020/06/Br%C3%A4ucheENG.pdf) | PDF印刷页9–11，Easter Egg Decoration：赠礼、教父母、蜡绘染色与公开市场 | `read-direct-http`；2026-10-20；原日期：版面署2005-12-19；网页目录2020 | 索布族彩蛋礼赠和生命力信念、当代仍延续、技术差异；“自古”泛称不作断代。 |


**具体缺口与处理：** “数世纪”不作精确始年；本场花枝没有传统纹样释义。

**产品简化与新增表达：** 画笔显纹不冒称热蜡多次染色教程，陶杯为展示。

**访问异常：** 文化中心PDF网页工具超时，直接HTTP取得可读PDF，已读印刷页9–11。

**同步：** [来源卡](../../content/traditions/sorbian-easter-eggs.md)、[场景README](../../packages/scenes/src/sorbian-painted-egg/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="spanish-castanets"></a>

### 木壳轻拍 · `spanish-castanets`

最终来源 slug：`spanish-castanets`。当前实现：`packages/scenes/src/spanish-castanets/scene.ts`。

**实际器物与动作：** 无手的两副系绳凹木壳，左合、右合、一起合。

**本轮文化范围：** 西班牙二十世纪实物、舞蹈和游客器物，木壳空腔系绳。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [The Metropolitan Museum of Art — José Tárrega Peiró: Castanets](https://www.metmuseum.org/art/collection/search/504450) | Object Details，制作者、地点、日期、材质及分类 | `read`；2026-10-20；原日期：未见发布日期 | 西班牙二十世纪晚期木响板；1890是制作者品牌成立年，不是乐器起源。 |
| [Duke University Musical Instrument Collections — Castanets](https://sites.duke.edu/dumic/instruments/percussion/west-europe/castanets/) | Details及Description 470–482行 | `read`；2026-10-20；原日期：未见发布日期 | 馆藏木壳、空腔、系绳与西班牙舞蹈语境；不采用其未经交叉核实的腓尼基起源与所有演奏者概括。 |


**具体缺口与处理：** 不采三千年前腓尼基起源；不称所有弗拉门戈必用或左右音高固定。

**产品简化与新增表达：** 无真人指法，合拍和合成声音非具体曲式。

**访问异常：** 西班牙文化词典TLS失败、服装博物馆429；改用Met实物与Duke器物正文。

**同步：** [来源卡](../../content/traditions/spanish-castanets.md)、[场景README](../../packages/scenes/src/spanish-castanets/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="st-brigids-cross"></a>

### 草编迎春 · `st-brigids-cross`

最终来源 slug：`st-brigids-cross`。当前实现：`packages/scenes/src/st-brigids-cross/scene.ts`。

**实际器物与动作：** 四束草送折点成四臂十字、挂门楣。

**本轮文化范围：** 爱尔兰圣人节、家庭与牲畜保护信念、形态变化及1960年代传播。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Galway City Museum / Brendan McGowan — St Bridget and St Bridget’s Cross](https://galwaycitymuseum.ie/blog/st-bridget-and-st-bridgets-cross/) | 正文59–72行，节前编草、住房牲畜棚、地区形态、RTÉ段 | `read`；2026-10-20；原日期：2026-01-29 | 爱尔兰节庆保护信念、草材料与多样形制；四臂样式二十世纪传播不等于习俗起源。 |


**具体缺口与处理：** 不将圣人传奇当实证起源；四臂不代表所有地区。

**产品简化与新增表达：** 四束成形压缩真实编织，没有模拟祝圣。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/st-brigids-cross.md)、[场景README](../../packages/scenes/src/st-brigids-cross/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="sternsinger-house-blessing"></a>

### 门楣祝家 · `sternsinger-house-blessing`

最终来源 slug：`sternsinger-house-blessing`。当前实现：`packages/scenes/src/sternsinger-house-blessing/scene.ts`。

**实际器物与动作：** 粉笔拿起、写当年两端数字与C+M+B、停看门楣。

**本轮文化范围：** 德国当代儿童登门祝家、援助、拉丁词义；保留基督教背景。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Kindermissionswerk Die Sternsinger — Häufig gestellte Fragen zur Sternsingeraktion](https://www.sternsinger.de/sternsingen/faq/) | FAQ27–89行，参与者、访问安排、教会及儿童助儿童 | `read`；2026-10-20；原日期：未见发布日期 | 德国天主教背景、跨教派参与、登门祝福和援助；不要求所有参加者同信仰。 |
| [Pfarrei St. Willibrord Merkstein — Sternsinger](https://pfarrei-st-willibrord.de/gruppierungen/gruppierungen-03/sternsinger/) | 正文90–106行，门楣20*C+M+B+26说明和援助活动 | `read`；2026-10-20；原日期：2026年活动 | CMB拉丁祝家词、年份两端、基督教背景及2026儿童援助。 |


**具体缺口与处理：** 活动最初起源未核实；不把首字母仅作三王人名缩写。

**产品简化与新增表达：** 书写自动轨迹，无实际募款或教会祝福完成认证。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/sternsinger-house-blessing.md)、[场景README](../../packages/scenes/src/sternsinger-house-blessing/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="sumiyoshi-godairiki"></a>

### 三石寄愿 · `sumiyoshi-godairiki`

最终来源 slug：`sumiyoshi-godairiki`。当前实现：`packages/scenes/src/sumiyoshi-godairiki/scene.ts`。

**实际器物与动作：** 五、大、力三字石逐一拾起落入布袋。

**本轮文化范围：** 大阪单一神社五所御前、五种力量与祈求/还纳语境。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [住吉大社 — 五大力石守について](https://sumiyoshitaisha.net/news/detail.php?seq=208) | 正文54–59行，五所御前、五种力量、御守袋和还石 | `read`；2026-10-20；原日期：2026-01-05 | 大阪该社特定五大力信仰与感谢还石；不证明起始年代或保证愿望实现。 |


**具体缺口与处理：** 起源不明；不推广为日本所有神社习俗。

**产品简化与新增表达：** 三次方向拖动、字石预置和袋形为产品，未模拟还纳或应验。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/sumiyoshi-godairiki.md)、[场景README](../../packages/scenes/src/sumiyoshi-godairiki/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="tamagushi-offering"></a>

### 玉串奉愿 · `tamagushi-offering`

最终来源 slug：`tamagushi-offering`。当前实现：`packages/scenes/src/tamagushi-offering/scene.ts`。

**实际器物与动作：** 带纸垂榊枝顺时针转正、静心、再转枝根向前供案落置。

**本轮文化范围：** 神社祭典祈愿、神恩、枝物作为媒介，方向有公开作法依据。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [神社本厅 — 玉串の意味](https://www.jinjahoncho.or.jp/omairi/tamagushi/) | 正文9–27行，玉串寓意、媒介及语源诸说 | `read`；2026-10-20；原日期：未见发布日期 | 神前诚意、神恩与祈愿媒介；《古事记》故事是神话关联，非可考起源日期。 |
| [神社本厅 — 参拝方法](https://www.jinjahoncho.or.jp/omairi/sanpai/) | 玉串拝礼の作法74–97行 | `read`；2026-10-20；原日期：未见发布日期 | 榊枝附纸垂/木绵，祈愿祭典供奉及转枝根朝神前；不等于全日本每社完全一致。 |


**具体缺口与处理：** 神话/词源诸说不确立历史始年。

**产品简化与新增表达：** 省略接受玉串、行进、完整礼拜与神职环节，不称全仪完成。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/tamagushi-offering.md)、[场景README](../../packages/scenes/src/tamagushi-offering/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="tanzaku-tanabata"></a>

### 短册系竹 · `tanzaku-tanabata`

最终来源 slug：`tanzaku-tanabata`。当前实现：`packages/scenes/src/tanzaku-tanabata/scene.ts`。

**实际器物与动作：** 拾纸条、系竹枝、静看；宿主完成时可选文字。

**本轮文化范围：** 日本七夕，聚焦宫城仙台江户史料及短册学艺愿。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [仙台商工会议所 — Sendai Tanabata Festival: Decorations](https://www.sendaitanabata.com/english/pc/outline/decoration/) | Short paper strips及七饰说明8–15行 | `read`；2026-10-20；原日期：未见发布日期 | 仙台短册的书艺、学业愿望；其他装饰寓意不套到本场纸条。 |
| [仙台商工会议所 — Sendai Tanabata Festival: History](https://www.sendaitanabata.com/english/pc/outline/history/) | Edo Period、伊达政宗诗歌及1873笔记所载彩纸/竹枝段8–24行 | `read`；2026-10-20；原日期：未见发布日期 | 江户仙台七夕已有史料线索和祭星、纸饰；英译页部分近代年份明显矛盾，未采用其1920年代/1952/1973/1987表述。 |


**具体缺口与处理：** 不将七饰全部意义套给短册，英译史页明显错误近代年份未用。

**产品简化与新增表达：** 书写在本产品为可选附记，未声称挂后写字是传统顺序。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/tanzaku-tanabata.md)、[场景README](../../packages/scenes/src/tanzaku-tanabata/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="thai-songkran-elders"></a>

### 浇水敬老 · `thai-songkran-elders`

最终来源 slug：`thai-songkran-elders`。当前实现：`packages/scenes/src/thai-songkran-elders/scene.ts`。

**实际器物与动作：** 晚辈捧碗、移长者手边倾清水、放回。

**本轮文化范围：** 泰国家庭宋干、敬长求福；2016海外社群为当代锚点。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [泰国外交部 — Songkran/Thingyan celebrated in Riyadh](https://www.mfa.go.th/en/content/5d5bcfe115e39c306001c1c3?cate=5d5bcb4e15e39c3060006838) | 正文162–168行，2016活动和Rod Nam Dum Hua说明 | `read`；2026-10-20；原日期：2016-04-27，更新2022-11-28 | 泰国新年、清水或香水浇长者手、尊敬与求福；缅甸段的树枝与器物不移用。 |


**具体缺口与处理：** 不套缅甸Thingyan细节，不写所有长辈60岁或单一起源。

**产品简化与新增表达：** 普通衣着、碗形、庭院和三拖为产品；未完整呈现长者回应祝词。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/thai-songkran-elders.md)、[场景README](../../packages/scenes/src/thai-songkran-elders/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="tibetan-khata-greeting"></a>

### 白绢迎客 · `tibetan-khata-greeting`

最终来源 slug：`tibetan-khata-greeting`。当前实现：`packages/scenes/src/tibetan-khata-greeting/scene.ts`。

**实际器物与动作：** 普通人物之间双手托起预折白绢并递交。

**本轮文化范围：** 藏族及喜马拉雅迎送礼、真诚欢迎；不淡化礼巾亦有宗教用途。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Tibetan Nuns Project — Why Do Tibetans Give White Scarves or Kataks?](https://tnp.org/why-do-tibetans-give-white-scarves-or-kataks/) | 正文20–55行，地区、普通迎送礼与颜色、呈献段 | `read`；2026-10-20；原日期：2023-06-13 | 藏族及喜马拉雅社群迎客、送行、感谢，白色真诚善意；师长特定礼法不套给普通来客。 |


**具体缺口与处理：** 无法确立始年，颜色与对象礼法有差别，不给全区域统一规定。

**产品简化与新增表达：** 无师长、颈上披挂、神圣图文或加持表现。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/tibetan-khata-greeting.md)、[场景README](../../packages/scenes/src/tibetan-khata-greeting/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="tibetan-prayer-flags"></a>

### 经幡迎风 · `tibetan-prayer-flags`

最终来源 slug：`tibetan-prayer-flags`。当前实现：`packages/scenes/src/tibetan-prayer-flags/scene.ts`。

**实际器物与动作：** 五色咒语小旗串，抬蓝端、展开、抬黄端挂稳。

**本轮文化范围：** 藏传佛教经幡、众生利益、恭敬与无常。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Tibetan Nuns Project — How to Hang and Dispose of Prayer Flags](https://tnp.org/how-to-hang-and-dispose-of-prayer-flags/) | 正文18–40行，咒语、发心、户外悬挂、五色和褪色段 | `read`；2026-10-20；原日期：2017-03-13 | 藏传佛教经幡、利益众生和五元素颜色；不采用泛称数百年作为精确起源。 |


**具体缺口与处理：** 最早年代未定；五色对应依Tibetan Nuns Project正文39行（blue sky/space, white air/wind, red fire, green water, yellow earth），未概括所有旗型。

**产品简化与新增表达：** 旗面罗马字分行、尺寸和三步为产品，未再现印制或完整悬挂仪式。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/tibetan-prayer-flags.md)、[场景README](../../packages/scenes/src/tibetan-prayer-flags/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="tibetan-water-bowls"></a>

### 清水七供 · `tibetan-water-bowls`

最终来源 slug：`tibetan-water-bowls`。当前实现：`packages/scenes/src/tibetan-water-bowls/scene.ts`。

**实际器物与动作：** 佛像高供台、七只铜碗已留少水，壶从左至右添至沿下再收回。

**本轮文化范围：** 藏传佛教供养、恭敬、利益众生及1998公开教导。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [FPMT Chokyi Gyaltsen Centre / Lama Zopa Rinpoche — Making Water Bowls Offering](https://www.fpmt-cgc.org/resources/advice_from_rinpoche/nov2008.html) | 1998讲授说明21–22行、How to do water offerings 55–67行、Dedications108–116行 | `read`；2026-10-20；原日期：所载教导1998年7月于美国Madison | 供佛、碗先有水、尊敬注水不溢、菩提心和利益众生；非求个人财富健康的交换。 |


**具体缺口与处理：** 七同形铜碗及左右顺序本轮LDC重访失效；仍是先前已核实当前场景的可观察设置，不新增其普遍规范主张。

**产品简化与新增表达：** 只描述现有七碗添水片段，未声称完成清洁、礼拜、念诵、回向与晚间收供。

**访问异常：** LDC反复超时/HTTP403；FPMT讲义PDF HTTP403；CGC教导正文成功读取。

**同步：** [来源卡](../../content/traditions/tibetan-water-bowls.md)、[场景README](../../packages/scenes/src/tibetan-water-bowls/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="tibetan-wheel"></a>

### 廊前轻转 · `tibetan-wheel`

最终来源 slug：`tibetan-buddhism`。当前实现：`packages/scenes/src/tibetan-wheel/scene.ts`。

**实际器物与动作：** 固定转经筒沿顺时针转动，右向左滑动起转、减速停、静立。

**本轮文化范围：** 藏传佛教持咒利益众生，观音、寺院/朝圣与12–13世纪卷轴。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Rubin Museum / Elena Pakhoutova — Prayer Wheel: Accumulating Merit Every Day](https://rubinmuseum.org/projecthimalayanart/essays/prayer-wheel/) | 正文61–70行（动作、持咒、对象），图3图注74–76行：Roll of Mantras for a Prayer Wheel and Its Spindle; Tibet; ca. 12th–13th century; black ink on paper with metal spindle; Private collection；另读80–120行作形式和背景区分 | `read`；2026-10-20；原日期：2023 | 图3把一件西藏经咒卷与金属轴定为约十二至十三世纪，属于策展研究中的实物年代字段，不是转经筒发明年代；本文并未独立重新测年。保留顺时针、观音咒、僧俗日常与寺院朝圣实践。 |


**具体缺口与处理：** 图3是私人收藏经咒卷和金属轴的策展断代，不是本次测年，也不是转经筒发明年份；旋转经书库影响仅假说，未采用。

**产品简化与新增表达：** 不计转数抵换福报，不模拟真实诵念。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/tibetan-buddhism.md)、[场景README](../../packages/scenes/src/tibetan-wheel/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="turkish-ebru-paper"></a>

### 浮彩成笺 · `turkish-ebru-paper`

最终来源 slug：`turkish-ebru`。当前实现：`packages/scenes/src/turkish-ebru-paper/scene.ts`。

**实际器物与动作：** 梳具右移显彩纹、自动落纸、近边揭纸转印、静看。

**本轮文化范围：** 土耳其纸艺、书籍装饰、师徒经验与当代交流。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [土耳其文化旅游部驻法文化信息处 — Ebru, l’art turc du papier marbré](https://turquietourisme.ktb.gov.tr/FR-133473/unesco.html) | EBRU专节全部正文，缓存23–27行及对应后段 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 调制液面浮彩转纸、书籍装饰、师徒实践和社群交流；不据名录年推起源。 |


**具体缺口与处理：** 缺乏本轮可靠的早期作品年代，未拿2014名录年当起源。

**产品简化与新增表达：** 预制液面与颜料、自动贴纸、即时固色和留言为产品，不是配方教学。

**访问异常：** UNESCO长/数字入口为验证码；采用土耳其文化旅游部完整Ebru专节。

**同步：** [来源卡](../../content/traditions/turkish-ebru.md)、[场景README](../../packages/scenes/src/turkish-ebru-paper/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="udo-undama"></a>

### 龟岩投愿 · `udo-undama`

最终来源 slug：`udo-undama`。当前实现：`packages/scenes/src/udo-undama/scene.ts`。

**实际器物与动作：** 取一颗運字陶球、瞄龟岩方凹、上拖抛入预定落点。

**本轮文化范围：** 宫崎日南神社投愿，1954前后陶球形成与学校关系。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [鵜戸神宮 — 亀石と運玉](https://www.udojingu.or.jp/history/%E4%BA%80%E7%9F%B3%E3%81%A8%E9%81%8B%E7%8E%89/) | 正文15–23行，龟石凹处、旧投钱和昭和29年运玉制作 | `read`；2026-10-20；原日期：未见发布日期 | 宫崎日南当地投愿，约1954陶球取代投钱的沿革、制作；传说与历史分开。 |


**具体缺口与处理：** 龟石神话不作历史事实；不把1954写为整个神社/龟岩信仰起源。

**产品简化与新增表达：** 固定成功弧线不代表现实占问结果；未引入男女用手规则。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/udo-undama.md)、[场景README](../../packages/scenes/src/udo-undama/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="uzbek-clay-bowl"></a>

### 陶轮慢成 · `uzbek-clay-bowl`

最终来源 slug：`uzbek-ceramic-craft`。当前实现：`packages/scenes/src/uzbek-clay-bowl/scene.ts`。

**实际器物与动作：** 木陶轮转动、提湿泥碗壁、停轮；无釉色与窑火。

**本轮文化范围：** 乌兹别克日用陶器、十九世纪流派与泥坯后续工序。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [ICHCAP — Intangible Cultural Heritage of Uzbekistan: Artistic Ceramics](https://archive.unesco-ichcap.org/eng/ek/sub2017_7/pdf_down/6.%20KNOWLEDGE%20AND%20PRACTICES%20CONCERNING%20TRADITIONAL%20CRAFTSMANSHIP/10.%20Artistic%20ceramics.pdf) | PDF4页，印刷页214–217，制泥/陶轮/烧制和十九世纪地方流派段 | `read`；2026-10-20；原日期：未见发布日期 | 乌兹别克日用陶器与各地学校，成形后干燥烧制；不将整个中亚新石器史当本碗起源。 |


**具体缺口与处理：** 不为原创素坯认定某地釉色或独有器型，不追溯泛中亚起源。

**产品简化与新增表达：** 自动拉壁几何、木轮外形和短时长是产品缩略。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/uzbek-ceramic-craft.md)、[场景README](../../packages/scenes/src/uzbek-clay-bowl/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="valencian-folding-fan"></a>

### 折扇轻风 · `valencian-folding-fan`

最终来源 slug：`valencian-folding-fan`。当前实现：`packages/scenes/src/valencian-folding-fan/scene.ts`。

**实际器物与动作：** 素色木骨布面折扇展开、轻摇、收半开。

**本轮文化范围：** 阿尔代亚1857家庭记录、十九二十世纪产业、分工女性劳动。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Ajuntament d’Aldaia / MUPA — Colección permanente](https://aldaia.es/es/cultura/mupa-museo-del-abanico-de-aldaia/coleccion-permanente/) | 正文32–46行，十九世纪作坊、1857年家庭、二十世纪产业和工序分工 | `read`；2026-10-20；原日期：未见发布日期 | 瓦伦西亚阿尔代亚制扇史、骨架/扇面/工种与女性劳动；未用页面远古亚洲扇起源说。 |


**具体缺口与处理：** 不把亚洲古代扇史变成瓦伦西亚折扇起源；不添加手势传情字典。

**产品简化与新增表达：** 素扇配色、铆轴比例和摇扇节奏原创，不展示生产全程。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/valencian-folding-fan.md)、[场景README](../../packages/scenes/src/valencian-folding-fan/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="venetian-glass-bead"></a>

### 玻珠凝彩 · `venetian-glass-bead`

最终来源 slug：`italian-glass-beads`。当前实现：`packages/scenes/src/venetian-glass-bead/scene.ts`。

**实际器物与动作：** 青绿玻珠金属杆绕彩线，冷却示意后穿绳、静看。

**本轮文化范围：** 威尼斯十四世纪生产、不同技法、贸易与妇女劳动；不把赠礼作为本轮新增主张。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Fondazione Musei Civici di Venezia / Museo del Vetro — Le perle veneziane](https://museovetro.visitmuve.it/it/il-museo/percorsi-e-collezioni/perle-veneziane/) | 正文52–56行，十四世纪生产、玻璃管/灯工分类、十九世纪和穿珠妇女 | `read`；2026-10-20；原日期：未见发布日期 | 威尼斯穆拉诺珠艺、装饰贸易和妇女劳动；不采用另页有分歧的灯工精确发明世纪。 |


**具体缺口与处理：** 灯工起源世纪在同馆不同页面有差异，正文不定为十六或十七世纪。

**产品简化与新增表达：** 未呈火焰退火等工序，配色与芯棒轨迹原创。

**访问异常：** UNESCO数字和长名入口本轮均验证码；改用MUVE玻璃博物馆馆藏正文。

**同步：** [来源卡](../../content/traditions/italian-glass-beads.md)、[场景README](../../packages/scenes/src/venetian-glass-bead/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="vietnamese-bamboo-dragonfly"></a>

### 竹蜓点风 · `vietnamese-bamboo-dragonfly`

最终来源 slug：`thach-xa-bamboo-dragonfly`。当前实现：`packages/scenes/src/vietnamese-bamboo-dragonfly/scene.ts`。

**实际器物与动作：** 尖喙落枝尖，随后可重复轻推/拖不同部位，手动结束观察。

**本轮文化范围：** 河内石舍今西芳、1990年代出现、竹材平衡工艺及生计。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [越南国家旅游局信息中心 — Làng chuồn chuồn tre Thạch Xá – nét đẹp sáng tạo từ tre Việt](https://nongthon.vietnamtourism.gov.vn/lang-chuon-chuon-tre-thach-xa-net-dep-sang-tao-tu-tre-viet/) | 越文正文全部：1990年代出现、地点、成熟竹材、部件配重、上色和市场 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 河内石舍（今西芳）现代竹玩具、平衡结构及手工业生计；不造古老仪式或护佑意涵。 |


**具体缺口与处理：** 不写越南古老祈愿物；不臆造每位匠人相同配重公式。

**产品简化与新增表达：** 模拟平衡、光色和枝座为产品，末步不限一次长翼推。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/thach-xa-bamboo-dragonfly.md)、[场景README](../../packages/scenes/src/vietnamese-bamboo-dragonfly/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="votive-candle-catholic"></a>

### 留一盏烛光 · `votive-candle-catholic`

最终来源 slug：`votive-candle-catholic`。当前实现：`packages/scenes/src/votive-candle-catholic/scene.ts`。

**实际器物与动作：** 安放蜡烛到石廊烛架、点芯、可写句子或静看。

**本轮文化范围：** 天主教跨地域实践，以美国华盛顿州Tacoma堂区自述为具体例；基督之光和圣人代祷，献烛非只履行还愿。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Saint Patrick Catholic Church & School — Why do Catholics Light Votive Candles?](https://www.saintpats.org/parish/catholics-light-votive-candles/) | A Symbol of Christ及The Light Is A Reminder to Stay Present to the Lord段 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 天主教点烛、基督之光、向上主祷告/请圣人代祷、离开后象征持续临在；不把前文古代概述当确证起源。 |
| [Saint Patrick Catholic Church — Contact Us](https://www.saintpats.org/parish/contact-us/) | Parish Center及Saint Patrick Catholic Church地址101–120行 | `read`；2026-10-20；原日期：未见发布日期 | 确认该当代堂区位于美国华盛顿州Tacoma；不能作为献烛起源地。 |


**具体缺口与处理：** 不确立献烛起源国家/最早年代；美国华盛顿州Tacoma只是本轮直接材料中的当代堂区实例。

**产品简化与新增表达：** 此处文字输入与石廊场景为产品，未代替教会礼仪或保证祷告效果。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/votive-candle-catholic.md)、[场景README](../../packages/scenes/src/votive-candle-catholic/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="weifang-paper-kite"></a>

### 纸鸢乘风 · `weifang-paper-kite`

最终来源 slug：`weifang-kite-craft`。当前实现：`packages/scenes/src/weifang-paper-kite/scene.ts`。

**实际器物与动作：** 贴合预裁燕形纸翼、拉线轮起飞、静看。

**本轮文化范围：** 山东潍坊杨家埠明清发展、类型材料与传承。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [中国非物质文化遗产网 / 中国非物质文化遗产保护中心 — 风筝制作技艺（潍坊风筝）](https://www.ihchina.cn/niansu/html/wuDongChunFeng_weiFangFengZheng.html) | 项目全部正文，明清发展、类型、竹骨对称和传承人段 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 山东潍坊杨家埠、清乾隆时期产业、扎绘糊放和传承；不套其他地区放晦气习俗。 |


**具体缺口与处理：** 明代是机构概述而非本轮考古确年；不套断线放晦气或祈福意义。

**产品简化与新增表达：** 燕形配色结构原创，合翼及自动抬升不是完整扎绘糊放。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/weifang-kite-craft.md)、[场景README](../../packages/scenes/src/weifang-paper-kite/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="welsh-drop-spindle"></a>

### 悬锤纺线 · `welsh-drop-spindle`

最终来源 slug：`welsh-drop-spindle`。当前实现：`packages/scenes/src/welsh-drop-spindle/scene.ts`。

**实际器物与动作：** 低位木纺轮与已绕纱团、静态毛束；旋转、下放、提回。

**本轮文化范围：** 威尔士教学与当代卡马森郡课程，纺织工具与历史劳动。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Cadw — Sewing and braiding](https://cadw.gov.wales/sites/default/files/2019-05/150923Tudorsewingbraiding.pdf) | PDF第3页Drop spindle全页 | `read`；2026-10-20；原日期：未见发布日期 | 木杆加重纺轮、捻纤维成纱、悬垂再绕线及历史劳动；材料为都铎教学背景，不证明威尔士独创。 |
| [Amgueddfa Cymru / National Wool Museum — Introduction to Spinning: From Fleece to Fabric](https://museum.wales/wool/whatson/12338/Introduction-to-Spinning-From-Fleece-to-Fabric-/) | 2026课程正文，羊毛处理、drop spindle、地点和讲师段 | `read-direct-http`；2026-10-20；原日期：活动2026-04-18 | 威尔士Carmarthenshire的当代纺织传授；不把2026课程当技艺起源。 |


**具体缺口与处理：** 不称威尔士发明，不把教材都铎背景推为起源。

**产品简化与新增表达：** 没有纤维持续牵伸或真正生出纱线，短动作不算完整纺线。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/welsh-drop-spindle.md)、[场景README](../../packages/scenes/src/welsh-drop-spindle/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="welsh-love-spoon"></a>

### 木勺寄情 · `welsh-love-spoon`

最终来源 slug：`welsh-love-spoons`。当前实现：`packages/scenes/src/welsh-love-spoon/scene.ts`。

**实际器物与动作：** 布擦凹勺，持柄放展托，静看或留言。

**本轮文化范围：** 威尔士1667有年款存世例、十八十九世纪求爱工艺及现代纪念礼。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [Amgueddfa Cymru / Museum Wales — Welsh love spoons](https://museum.wales/blog/1033/Welsh-love-spoons/) | 正文21–38行及symbols段，1667、十八十九世纪、制作和当代用途 | `read-direct-http`；2026-10-20；原日期：2024-01-25 | 起源不明但1667存世例、求爱木勺及现代多场合赠礼；图案不作统一密码。 |


**具体缺口与处理：** 1667不是发明年；本场镂空不作固定寓意解码。

**产品简化与新增表达：** 擦拭展示为产品照料动作，无完整雕刻或固定赠勺仪式。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/welsh-love-spoons.md)、[场景README](../../packages/scenes/src/welsh-love-spoon/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="yeondeunghoe"></a>

### 燃灯上浮 · `yeondeunghoe`

最终来源 slug：`yeondeunghoe`。当前实现：`packages/scenes/src/yeondeunghoe/scene.ts`。

**实际器物与动作：** 已成型莲灯点按或上推后上浮、静看；无组装。

**本轮文化范围：** 韩国佛诞佛教节庆、新罗灯会历史背景与现代公众参与。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [韩国国家遗产门户 — 연등회（燃灯会）](https://www.heritage.go.kr/heri/html/HtmlPage.do?pageNo=2_1_1_1&pageNo=5_3_2_0&pg=%2Funesco%2FCulHeritage%2FCulHeritage_21.jsp) | 韩文介绍正文及宣传片文字转录：缓存10–13、45–62、74–109行 | `read-direct-http`；2026-10-20；原日期：未见发布日期 | 佛诞、制灯悬灯巡行、智慧与共同祝愿、寺院和社区传授；不据上浮动画主张放天灯。 |


**具体缺口与处理：** 不采用宣传片笼统1300年作起始年份，不把2020列入遗产当起源。

**产品简化与新增表达：** 上浮为数字意象，不能解释为现实放天灯；旧卡组装设计须明确为历史方案。

**访问异常：** UNESCO入口验证码、主办HTTPS超时；国家遗产门户直接HTTP成功，主办HTTP也取得正文但未以客流数等扩写。

**同步：** [来源卡](../../content/traditions/yeondeunghoe.md)、[场景README](../../packages/scenes/src/yeondeunghoe/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


<a id="zeniarai-coin-washing"></a>

### 泉水净币 · `zeniarai-coin-washing`

最终来源 slug：`zeniarai-coin-washing`。当前实现：`packages/scenes/src/zeniarai-coin-washing/scene.ts`。

**实际器物与动作：** 筛中硬币，提杓、倾泉水、布擦；币最终仍在筛里。

**本轮文化范围：** 镰仓具体神社财福信念及2025神社代表实践说明。

| 来源标题、机构与完整URL | 实际阅读位置 | 状态、访问日期及原日期 | 支持范围与不能外推 |
| --- | --- | --- | --- |
| [FMヨコハマ / まめラボ — 鎌倉「銭洗弁財天宇賀福神社」访谈](https://www.fmyokohama.jp/mamet/2025/01/post-256.html) | 正文神社代表飯塚弘史受访、祈愿和清洗方法段 | `read-direct-http`；2026-10-20；原日期：2025-01-18 | 神奈川镰仓特定神社、筛/杓/擦拭与财福信念；不证实源赖朝传说为史实。 |


**具体缺口与处理：** 源赖朝传说和创立年未作本轮史实，不宣称洗钱增值。

**产品简化与新增表达：** 没有钱包收回动作；水流时长、币形、三拖为产品。

**访问异常：** 无新增失败来源。

**同步：** [来源卡](../../content/traditions/zeniarai-coin-washing.md)、[场景README](../../packages/scenes/src/zeniarai-coin-washing/README.md)、`c.ts` 同ID介绍。来源绑定保持不变。


## 未用于新增事实的访问失败

以下均于2026-10-20访问；失败不证明该传统不存在，也不撤销以前独立读取成功的历史记录。已找到替代正文的项目仍在逐项表中明确区分。

| 来源入口 | 本轮实际结果与处理 |
| --- | --- |
| [Małopolska — Traditional Easter basket](https://ww.visitmalopolska.pl/en_GB/web/visitmalopolska/-/tradycyjny-koszyczek-wielkanocny-i-zwyczaje-wielkiej-soboty) | 直接HTTP403；改读Holy Trinity堂区及其PDF。 |
| [Museums Victoria — Russian Babushka, 251505](https://collections.museumsvictoria.com.au/items/251505) | 网页工具内部错误；本轮年代来自TMORA。 |
| [西班牙文化遗产词典 — Castañuelas](https://tesauros.cultura.gob.es/tesauros/bienesculturales/1011075.html?desplegar=&replegar=-949739981) | TLS连接失败；索引文本未作为已读正文。 |
| [Museo del Traje — Castañuelas](https://www.cultura.gob.es/mtraje/visita/visita-virtual/sala-indumentaria-tradicional/pervivencias-identidades/castanuelas.html) | HTTP429；响板改用Met与Duke器物说明。 |
| [Losang Dragpa Centre — Altar Set-up](https://fpmt-ldc.org/altar-set-up/) | 网页工具反复超时、直接HTTP403；供水意义改读CGC。 |
| [FPMT — Altar Set-up and Water Bowl Offerings, 2016 PDF](https://shop.fpmt.org/assets/images/eproducts/altar_set_up_and_water_bowls_c5.pdf) | HTTP403，不登记本轮读到讲义。 |
| [UNESCO — Ebru, 00644](https://ich.unesco.org/en/RL/00644) | 验证码；采用土耳其文化旅游部专节。 |
| [UNESCO — The art of glass beads, 01591](https://ich.unesco.org/en/RL/01591) | 验证码，长名称入口也未取得正文；采用MUVE玻璃博物馆。 |
| [UNESCO — Yeondeunghoe, 00882](https://ich.unesco.org/en/RL/yeondeunghoe-lantern-lighting-festival-in-the-republic-of-korea-00882) | 验证码；采用韩国国家遗产门户。 |
| [燃灯会主办方](https://www.llf.or.kr/bbs/content_e.php?co_id=day) | HTTPS超时；同地址HTTP直接取得当代首尔活动介绍，但未以其中概括性1200年和客流数新增事实。 |
| [Korea.net — 2023灯会介绍PDF](https://newsroom.korea.net/upload/content/editImage/20230323190106906_DF5A4WQ7.pdf) | 网页工具不可访问，直接HTTP取得PDF但主要段落提取为字形编码；未将该PDF登记为正文证据。 |
| [墨西哥公报 — Cobre Martillado, 5704188](https://sidof.segob.gob.mx/notas/docFuente/5704188) | 网页超时、直接HTTP发生TLS错误；替代为州工艺机构2026报道。 |
| [墨西哥文化部门旧Santa Clara旅游页](https://www.cultura.gob.mx/turismocultural/destino_mes/santa_clara/index.html) | 跳转404；未使用搜索所得全文替代正文。 |

Holy Trinity祷词PDF、Sorbian Customs PDF和韩国国家遗产门户虽在网页工具中超时/受阻，但直接HTTP取得可读正文后已逐段阅读，故各项表格可记为`read-direct-http`。这些结果与上表纯失败项不同。

## 同步与核查

- [x] 40项逐一核对物件、动作、场合和可见文字；未将程序轨迹反证传统。
- [x] 新增事实有本轮所列已读正文；失败状态、具体缺口与限定分别记录。
- [x] 全部保留已有对应来源slug，没有用同地区总卡为普通工艺背书。
- [x] 介绍、来源卡和README互相追溯；来源卡保留既有研究，并纠正燃灯会当前操作与历史方案的混写。
- [x] 40项均为两段文字，技术ID、交互、隐藏及完成条件未改。
- [ ] 主代理的宿主目录集成、相关包检查与页面分段验证另记；本文件不宣称子任务单独完成整体验收。

本组结构检查只验证数量、键集合、段落和文档链接；不以技术通过替代上面的事实核查。

## 本组验证结果

2026-10-20 运行 `node artifacts/narrative-expansion/verify-c.mjs`，退出码0。实际导入TypeScript模块，核对40个键与分工清单完全相同，40条均为两段、204–255字符；禁用词扫描通过。40张来源卡、40份README与40个研究锚点对应，新增相对链接存在，Markdown表格行连续，限定本组路径的 `git diff --check` 通过。Git提示工作区CRLF将按仓库规则转LF，不是空白错误。结果保存在 `artifacts/narrative-expansion/verification-c.json`。

主代理对套娃和水拓画作了用词润色；本组验证直接读取最终 `c.ts`，没有用生成脚本覆盖主代理修改。献烛介绍另补已核实的塔科马堂区位置作为具体当代实例，不将美国写成该习俗的起源地。
