/** Public bundled metadata; safe in native/extension code, without DOM imports. */
type CatalogEntry = { id: string; title: string; engine: string; revision: string; manifestUrl: string };
/**
 * Scenes that can come up on 今日's daily set as 祈福 (blessing) practices:
 * quiet listening, an entrance bow, a slow turn, a strike, a pour.
 */
/** App curation only: keep these engines, source entries and saved records reusable. */
export const APP_HIDDEN_SCENE_IDS = [
  "malawi-sansi",
  "japanese-kendama",
  "russian-matryoshka",
  "korean-yutnori",
  "chinese-diabolo",
  "indian-charkha",
  "german-nutcracker",
  "mexican-molinillo",
  "chinese-suanpan",
  "mongolian-felt-ger",
  "peruvian-engraved-gourd",
  "venetian-glass-bead",
  "vietnamese-bamboo-dragonfly",
  "turkish-ebru-paper",
  "indonesian-angklung",
  "weifang-paper-kite",
  "chinese-shadow-puppet",
  "faroese-wool-knit",
  "niue-shell-necklace",
  "polish-paper-cut",
  "uzbek-clay-bowl",
  "chinese-woodblock-print",
  "czech-bead-star",
  "fijian-woven-fan",
  "amazigh-woven-rug",
  "slovak-wire-bird",
  "hungarian-embroidery-hoop",
  "andalusian-ceramic-tile",
  "sicilian-painted-cart",
  "bai-indigo-cloth",
  "ndebele-painted-house",
  "purepecha-copper-bowl",
  "finnish-birch-basket",
  "catalan-festival-giant",
  "breton-banner",
  "dalarna-wooden-horse",
  "blang-tea",
  "minangkabau-spinning-top",
  "hongsheng-red-string",
  "czech-pilgrim-journal",
  "celtic-folk-spring",
  "theravada-water",
  "lantern"
] as const;
export function isSceneVisibleInApp(entry: { id: string; engine?: string }): boolean {
  return !APP_HIDDEN_SCENE_IDS.some(id => entry.id === id || entry.engine?.startsWith(`${id}@`));
}

export const BLESSING_SCENE_IDS = [
  "woodfish",
  "furin-wind-chime",
  "shinto-torii",
  "tibetan-wheel",
  "celtic-folk-spring",
  "theravada-water",
  "clootie-well-rag",
  "diya-oil-lamp",
  "shrine-suzu-bell",
  "st-brigids-cross",
  "bokjori",
  "omikuji",
  "navruz-sumalak",
  "chinese-incense",
  "czech-pilgrim-journal",
  "dalarna-wooden-horse",
  "blang-tea",
  "breton-banner",
  "lithuanian-straw-garden",
  "finnish-birch-basket",
  "catalan-festival-giant",
  "ndebele-painted-house",
  "purepecha-copper-bowl",
  "slovak-wire-bird", "sicilian-painted-cart", "fijian-woven-fan",
  "czech-bead-star", "uzbek-clay-bowl",
  "faroese-wool-knit",
  "weifang-paper-kite",
  "indonesian-angklung",
  "vietnamese-bamboo-dragonfly",
  "venetian-glass-bead",
  "malawi-sansi",
  "japanese-kendama",
  "japanese-koinobori",
  "russian-matryoshka",
  "korean-yutnori",
  "chinese-diabolo",
  "indian-charkha",
  "german-nutcracker",
  "mexican-molinillo",
  "chinese-suanpan",
  "mongolian-felt-ger",
] as const;

/** Scenes that can come up on 今日's daily set as 许愿 (wish-making) practices. */
export const WISH_SCENE_IDS = [
  "tanzaku-tanabata",
  "yeondeunghoe",
  "crane",
  "lantern",
  "slavic-wreath",
  "daruma-eye-painting",
  "mizuhiki",
  "milagros",
  "phuang-malai",
  "ema-votive-plaque",
  "votive-candle-catholic",
  "omamori-cycle",
  "polish-blessing-basket",
  "floating-lantern-loy-krathong",
  "hongsheng-red-string",
  "italian-ex-voto",
  "aland-votive-ship",
  "minangkabau-spinning-top",
  "sorbian-painted-egg",
  "basque-sunflower",
  "barcelos-clay-rooster",
  "croatian-licitar-heart",
  "bai-indigo-cloth",
  "welsh-love-spoon",
  "hungarian-embroidery-hoop", "andalusian-ceramic-tile", "amazigh-woven-rug",
  "chinese-woodblock-print", "polish-paper-cut",
  "niue-shell-necklace",
  "chinese-shadow-puppet",
  "turkish-ebru-paper",
  "korean-bojagi-wrap",
  "peruvian-engraved-gourd",
] as const;


export type BuiltInSceneEntry = CatalogEntry & {
  /** 简短介绍文化背景、物件特点与实际动作。缺省 → 隐藏折叠块。 */
  narrative?: string;
  /** 指向 content/traditions/<slug>.md（单文件，非目录）；仅元数据，本期 app 不加载。产品原创场景（crane、lantern）省略。 */
  traditionSlug?: string;
};
export const builtInScenes: BuiltInSceneEntry[] = [
  {
    id: "chinese-diabolo", title: "空竹轻扬", engine: "chinese-diabolo@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "chinese-diabolo",
    narrative: "空竹是中国传统游艺中的竹木玩具。双轮空竹的两端各有一个中空圆盘，以木轴相连；两根竹杆牵着细绳，带动木轴旋转。这里先提杆起转，再展绳轻抛、接回，最后缓缓收低。看双轮在绳间轻盈来回，把片刻专注留给眼前的竹木与阳光。",
  },
  {
    id: "korean-yutnori", title: "木柶行棋", engine: "korean-yutnori@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "korean-yutnori",
    narrative: "掷柶是韩国节日里亲友共玩的传统棋戏，以四根一面平、一面圆的木柶落面决定一至五步，人们轮流投掷，沿棋盘前行。这里合拢木柶，抛起后让一枚棋子按落面前行；可继续投掷，从当前位置接着走，想停时结束行棋，让木声与片刻轻松留在手边。",
  },
  {
    id: "russian-matryoshka", title: "套娃相藏", engine: "russian-matryoshka@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "russian-matryoshka",
    narrative: "俄罗斯套娃以大小相套的木偶著称，外层从腰间分开，里面容纳更小的一只。车制的圆润木身与彩绘相映，各地的颜色和花纹各有变化。这里提起原创花纹的外壳，把小娃收进空腔，再沿接缝合拢。让大与小相互容纳，把一份温暖留在手边。",
  },
  {
    id: "japanese-koinobori", title: "鲤旗迎风", engine: "japanese-koinobori@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "japanese-koinobori",
    narrative: "鲤鱼形的布旗是日本儿童节前后的春日风景，人们借它寄托对孩子成长的美好祝愿。鲤旗的颜色、数量和展示方式也在变化。这里展开一尾原创布鲤，牵绳升起，再把绳端挂稳，看它张口随风轻摆。升挂装置经过简化，不代表完整传统陈设或实际升挂教学。",
  },
  {
    id: "japanese-kendama", title: "剑玉轻接", engine: "japanese-kendama@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "japanese-kendama-craft",
    narrative: "剑玉由木柄、大小承皿、尖端、球和绳线组成。在日本的剑玉玩法中，球可依次落入大皿、小皿，再让球孔接住尖端。抛起与轻接之间，方向和节奏同样重要。这里以原创木作和红球放慢三个动作，接球动作经过辅助，不代表完整技法教学或段位认证。",
  },
  {
    id: "indian-charkha", title: "棉线慢成", engine: "indian-charkha@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "indian-charkha-craft",
    narrative: "印度手摇纺车以木轮、传动绳和金属纺锭，将棉纤维加捻成线。纺线时一手转轮，一手牵引，卷收前需要停下调整。它也与印度近代的本土纺织运动相连。这里用原创木架放慢拉纤、转轮、回送卷线三个动作。纤维变化以动画呈现，不代表完整纺线教学。",
  },
  {
    id: "german-nutcracker", title: "木偶开果", engine: "german-nutcracker@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "erzgebirge-nutcracker-craft",
    narrative: "德国厄尔士山的木作传统中，车削和彩绘造就了各式胡桃夹子。背部杠杆带动下颌开合，口中可以容纳胡桃。今天许多木偶主要用于装饰。这里用原创木偶放慢抬杆、放果、压合三个动作，观察转轴的配合。木偶的机构经过简化，不代表馆藏复刻或真实摆件的使用指导。",
  },
  {
    id: "mexican-molinillo", title: "木旋起沫", engine: "mexican-molinillo@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "molinillo-chocolate-craft",
    narrative: "墨西哥的木制巧克力搅拌器有长柄、沟槽与松动木环。双掌相搓，使器头在饮品表面来回旋转，带入空气，浮起泡沫。这里以原创器形和陶杯，放慢浸入、右转、左转三个动作，观察材料与变化。搅拌过程经过简化，不代表特定地区的配方、器形或仪式。",
  },
  {
    id: "malawi-sansi", title: "铁舌轻鸣", engine: "malawi-sansi@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "mbira-sansi-craft",
    narrative: "在马拉维与津巴布韦，Mbira/Sansi 的制作和演奏通过家庭与教学传承。金属簧片固定于木板，用拇指或配合其他手指拨奏，有时配有共鸣器。长短不同的铁舌，带来高低不同的声音。试着点按或轻拨这九根铁舌，让几个音轮流响起，也可以反复拨奏喜欢的音，慢慢找出自己的节奏。",
  },
  {
    id: "chinese-suanpan", title: "拨珠见数", engine: "chinese-suanpan@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "chinese-zhusuan",
    narrative: "中国珠算通过沿算杆拨动算珠来计算，知识经口传身授代代传承。这里采用上二下五的结构：同一档的上珠记五、下珠记一，靠近横梁的珠参与计数，向左一档数值增为十倍。原创七档缩略算盘带你依次拨出三、八、十八；这是当代数学文化欣赏，数字只是拨珠后的计数结果，不附会祈福寓意。",
  },
  {
    id: "mongolian-felt-ger", title: "毡屋向阳", engine: "mongolian-felt-ger@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "mongolian-ger-craft",
    narrative: "蒙古包由可拆装的木格围壁、椽杆与顶圈构成，外覆毡与帆布，以绳带收束。木作、缝制和制毡的知识在家庭与匠人之间传承。这里用原创缩略模型，展开木格、支起屋顶和铺覆白毡，静看材料共同围成一处居所。它是当代工艺欣赏，省略实际搭建细节，不是建筑教学或传统仪式。",
  },
  {
    id: "peruvian-engraved-gourd", title: "葫芦刻光", engine: "peruvian-engraved-gourd@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "peruvian-mate-burilado",
    narrative: "秘鲁曼塔罗河谷等地的匠人在干葫芦表面雕刻细线，记录农耕、动物与日常生活，手艺在家庭和作坊间延续。这里用原创叶片与山丘纹路，刻线、轻拭和静看，让暖色壳面显出层次。它是简化的工艺欣赏；个人心愿只在明确提交后保存。",
  },
  {
    id: "venetian-glass-bead", title: "玻珠凝彩", engine: "venetian-glass-bead@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "italian-glass-beads",
    narrative: "意大利玻璃珠工艺包含灯工成珠与玻璃管切磨等做法，匠人在作坊中传授对火、玻璃与装饰的掌握，珠饰也用于日常赠礼。这里以原创青绿玻珠和彩纹，旋绕、冷却后穿线与静看，感受光线透过玻璃的变化。动画省略退火等工序，是手艺欣赏而非完整制作教学。",
  },
  {
    id: "korean-bojagi-wrap", title: "方巾裹礼", engine: "korean-bojagi-wrap@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "korean-bojagi",
    narrative: "韩国的 bojagi 包袱布既用于包裹日常物品，也用于赠礼，寄托着把好运带给收礼人的心意。想着一位在意的人，拢起布角包住礼盒，收好系带，为对方准备一份祝愿。轻点包好的礼物细看，也可以留一句给收礼人的话。",
  },
  {
    id: "vietnamese-bamboo-dragonfly", title: "竹蜓点风", engine: "vietnamese-bamboo-dragonfly@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "thach-xa-bamboo-dragonfly",
    narrative: "越南河内石舍的竹蜻蜓以竹片制成身体、翅膀与细尾，再涂上鲜明色彩，经过平衡调整后能停在指尖或笔尖，成为当地公开制作的手工玩具。这里用原创配色的竹蜻蜓，轻放、微推与静看，观察翅尖回稳和头部支点。它是器物欣赏，不复现宗教仪式，也不教授完整制作技法。",
  },
  {
    id: "turkish-ebru-paper", title: "浮彩成笺", engine: "turkish-ebru-paper@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "turkish-ebru",
    narrative: "土耳其水拓画把颜料铺在调制过的液面上，拨开彩纹后转印到纸张，常见于书籍装饰与手工艺术，并在作坊教学中延续。这里用原创青绿与珊瑚色纹路，梳纹、取纸与静看。它是简化的手艺欣赏，不代替完整技法教学；心愿只在明确提交后保存。",
  },
  {
    id: "indonesian-angklung", title: "竹音轻摇", engine: "indonesian-angklung@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "indonesian-angklung",
    narrative: "印度尼西亚昂格隆用藤条把竹管悬在竹架内，摇动时发出音响，一件乐器通常负责一个音或和弦，合奏依靠彼此配合，也走入学校与社区教学。这里用原创竹架，轻轻左摇、回摇与静听。短音由程序生成，只作器物欣赏，不复现庆典仪式或传统曲目。",
  },
  {
    id: "weifang-paper-kite", title: "纸鸢乘风", engine: "weifang-paper-kite@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "chinese-folk-and-confucian",
    narrative: "潍坊风筝以竹骨、纸面和鲜明色彩形成轻巧的飞行器物，扎制、绘饰、糊面与放飞的经验在作坊和传承教学中延续。这里用原创燕形纸鸢，依次合上纸翼、牵线试飞和静看，欣赏手艺。竹骨与引线随物体相连，不复制匠人纹样，也不把放飞等同消灾礼仪。",
  },
  {
    id: "chinese-shadow-puppet", title: "影偶小戏", engine: "chinese-shadow-puppet@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "chinese-folk-and-confucian",
    narrative: "中国皮影戏以皮革或纸制成彩色影人，用操纵杆带动关节，在灯光与透光幕布之间演出，手艺与剧目由艺人和戏班传承。这里从幕后观看原创小鸟，提杆、展翅和静看影子。影偶采用简化结构，不复刻传统角色；心愿只在明确提交后保存。",
  },
  {
    id: "faroese-wool-knit", title: "毛线织暖", engine: "faroese-wool-knit@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "faroese-folk",
    narrative: "羊毛与编织长久陪伴法罗群岛的日常生活，自然毛色、代际手艺和今日的编织聚会延续着岛上的材料记忆。这里用原创双色织片，依次穿针、带出线圈和静看，欣赏编织。只演示一针的缩略过程，不复制匠人纹样，不把普通针法称作法罗独有仪式，也不承诺护佑。",
  },
  {
    id: "niue-shell-necklace", title: "贝链留光", engine: "niue-shell-necklace@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "niuean-traditional",
    narrative: "纽埃的黄螺贝链以细线串起小巧的黄色陆生螺壳，作为饰物与赠礼，承载岛民及海外社群的故乡记忆。这里用原创贝链，依次穿入一枚备好的小壳、收拢与静看，欣赏手艺。心愿只在明确提交后保存，不模拟采集、身体礼仪或授予身份，也不赋予贝链护佑效力。",
  },
  {
    id: "polish-paper-cut", title: "剪纸开花", engine: "polish-paper-cut@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "polish-folk-catholic",
    narrative: "波兰剪纸用折叠和彩纸剪切形成对称或层叠的装饰，库尔皮耶等地发展出各有特点的花树纹样，手艺在家庭与文化机构中延续。这里以原创花叶，剪开最后一道边线、展开和静看。心愿只在明确提交后保存；不复制匠人作品，不模拟圣事或承诺护佑。",
  },
  {
    id: "uzbek-clay-bowl", title: "陶轮慢成", engine: "uzbek-clay-bowl@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "uzbek-folk",
    narrative: "乌兹别克斯坦陶艺以当地黏土制作储器、壶碗等日用品，手艺在家庭、作坊和教学中代代延续。这里用原创泥坯与陶轮，依次启转、拉起器壁和静看，欣赏制坯。结束时仍是未烧成的泥坯，不模拟完整窑烧，也不把日常器物当作祭器或承诺祈愿效力。",
  },
  {
    id: "chinese-woodblock-print", title: "木版留春", engine: "chinese-woodblock-print@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "chinese-folk-and-confucian",
    narrative: "中国雕版印刷以木版、纸墨和手工刷印传递文字与图像，刻版和刷印经验在作坊与传承教学中延续。这里用原创枝叶图案，依次擦过纸背、揭纸显纹与静看，欣赏手艺。心愿只在明确提交后保存。不复制经书、族谱或具体版画，也不把印纸等同祭祖礼仪。",
  },
  {
    id: "czech-bead-star", title: "珠星映光", engine: "czech-bead-star@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "czech-moravian-folk",
    narrative: "捷克北波希米亚的空心玻璃珠装饰工艺，以吹制、镀银、着色和穿线组装延续家庭与作坊的手艺，常见于圣诞树装饰。这里用原创珠星，依次接入珠串、轻转观光与静看，欣赏材料。不复制具体工匠作品，不把装饰制作等同宗教礼仪，也不赋予星形护佑承诺。",
  },
  {
    id: "fijian-woven-fan", title: "叶扇纳凉", engine: "fijian-woven-fan@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "fijian-vanua",
    narrative: "斐济的编叶扇以露兜树叶材、骨架与木柄组成，交织和绑接显露日常手作对材料的认识，博物馆收藏保留着不同年代的制作经验。这里用原创叶扇，依次收拢绑带、安放与静看，欣赏手工。不复制具体馆藏纹样，不把编扇等同于迎宾仪式，也不承诺祈愿功效。",
  },
  {
    id: "amazigh-woven-rug", title: "织毯寄暖", engine: "amazigh-woven-rug@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "amazigh-berber",
    narrative: "摩洛哥阿马齐格羊毛织物在家庭与作坊中延续，地域材料和染色经验形成各具特点的配色，织毯记录着代际手作知识。这里用原创条纹与几何色块，依次补齐织边、悬放与静看，寄托关怀。不复制具体织品，不把图案解释为统一的护佑暗语，也不模拟圣陵或求雨仪式。",
  },
  {
    id: "slovak-wire-bird", title: "铁线栖鸟", engine: "slovak-wire-bird@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "slovak-folk",
    narrative: "斯洛伐克的铁线工艺从修补和制作日用器具逐渐发展出装饰创作，弯折与缠接的技巧在匠人和工艺机构之间延续。这里用原创铁线小鸟，依次接合翅膀、安放和静看，欣赏材料。不复制具体工匠作品，也不把日常工艺与朝圣礼仪混同，不承诺护佑效力。",
  },
  {
    id: "hungarian-embroidery-hoop", title: "花绣寄语", engine: "hungarian-embroidery-hoop@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "hungarian-folk",
    narrative: "匈牙利的民间刺绣在地方社区与工艺教学中传承，花卉纹样和细密针脚记录着手作经验，各地风格各有差别。这里用原创花绣、线轴和木绷，依次补绣、安放与静看，寄托关怀。不复制特定绣品，不把图案解释为统一祝福暗语，也不模拟宗教礼仪。",
  },
  {
    id: "andalusian-ceramic-tile", title: "釉彩映晴", engine: "andalusian-ceramic-tile@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "andalusian-folk",
    narrative: "塞维利亚特里亚纳的陶艺传统，在旧作坊、窑炉遗迹与陶瓷展览中留下日常手工的记忆。这里用原创蓝白釉彩花砖和木框，依次补齐、安放与静看，欣赏材料与图案。纹样不复制具体工匠作品，不把花砖当作朝圣或圣事用具，也不承诺祈愿功效。",
  },
  {
    id: "sicilian-painted-cart", title: "彩车迎晴", engine: "sicilian-painted-cart@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "sicilian-santa-rosalia",
    narrative: "西西里彩绘木车曾服务日常运输，车轮雕刻和车身绘画后来成为地方工艺记忆的一部分，博物馆保留着不同匠人的作品。这里用原创小木车，依次装轮、安放和静看，欣赏手作。不复制具体车画，不把日用木车等同圣罗萨莉亚节的圣车，也不模拟圣骸巡游。",
  },

  {
    id: "bai-indigo-cloth", title: "蓝白晾晴", engine: "bai-indigo-cloth@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "bai-benzhu",
    narrative: "大理周城等地的白族扎染，以扎结防染和反复染洗形成蓝白纹样，手艺在家庭与作坊之间延续。这里用原创布面、清水盆与晾架，依次漂洗、晾起和静看，欣赏日常手工。图案不复制特定匠人的作品，也不把扎染与本主祭祀混同，不承诺护佑效力。",
  },
  {
    id: "ndebele-painted-house", title: "彩墙寄家", engine: "ndebele-painted-house@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "ndebele-traditional",
    narrative: "南非恩德贝莱人的彩绘墙面，以几何构成和鲜明色彩表达家园记忆与文化认同，绘画经验在社区生活中传承。这里用原创小屋、彩片与木座，依次添彩、安放和静看，欣赏公共艺术。不复制艺术家作品或特定家族图案，不模拟成年礼与祖先仪式。",
  },
  {
    id: "purepecha-copper-bowl", title: "铜碗拾暖", engine: "purepecha-copper-bowl@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "purepecha",
    narrative: "墨西哥米却肯州圣克拉拉德尔科布雷延续着铜器锻制手艺，作坊与博物馆展示材料在反复加工中形成器物的过程。这里以原创铜碗、软垫与绒托，依次轻拭、安放和静看，体会手作温度。不把日常铜碗称作祭器，不复现亡者祭坛，也不许诺祈愿功效。",
  },
  {
    id: "welsh-love-spoon", title: "木勺寄情", engine: "welsh-love-spoon@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "welsh-folk",
    narrative: "威尔士爱勺以雕刻木勺表达爱意，也常作婚礼、生日与周年纪念的赠礼。想着一位在意的人，轻拭凹勺面，再握住木柄将木勺安放到展托上，细看木纹与镂空雕饰，也可以为这份准备赠人的礼物留一句祝愿。",
  },
  {
    id: "barcelos-clay-rooster", title: "陶鸡报晓", engine: "barcelos-clay-rooster@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "portuguese-romarias",
    narrative: "巴塞卢什彩绘陶鸡是葡萄牙的地方工艺形象，在当地也有好运的寓意。拿起画笔，为这只陶鸡胸前添上叶芽纹样，再把它放到圆形展台上，欣赏陶土造型、明亮色彩与陈设所寄托的美好祝愿。",
  },
  {
    id: "finnish-birch-basket", title: "桦篮拾光", engine: "finnish-birch-basket@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "finnish-karelian-folk",
    narrative: "芬兰东部曾用桦皮编织容器储放谷物、面粉与盐，条带交织的结构记录着人们对日常材料的认识。这里用原创小篮、弯提梁与木台，依次接合、安放和静看，亲近手工。关联民俗卡仅提供地区文化背景，不复现熊礼、咒语或宗教团体的仪式。",
  },
  {
    id: "croatian-licitar-heart", title: "彩心相赠", engine: "croatian-licitar-heart@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "croatian-folk",
    narrative: "克罗地亚北部的 licitar 红心常作婚礼纪念，也是表达爱与情谊的礼物。用裱花袋给红心添上糖霜，再把布带挂环挂到展架木钉上，为在意的人准备一份彩心赠礼，也可以写下一句给对方的祝愿。",
  },
  {
    id: "catalan-festival-giant", title: "巨偶待游", engine: "catalan-festival-giant@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "catalan-folk",
    narrative: "加泰罗尼亚的节庆巨偶常在街头巡游中与音乐相伴，地方协会持续传承制作、维护与展演的经验。这里以原创巨偶小模型、花章与圆台，依次装饰、安放和静看，欣赏公共节庆工艺。不复制具体历史巨偶，不扮演神职角色，也不模拟火跑或人体城堡。",
  },
  {
    id: "sorbian-painted-egg", title: "彩蛋寄春", engine: "sorbian-painted-egg@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "sorbian-folk",
    narrative: "卢萨蒂亚索布族在复活节赠送彩蛋，向收礼人传达生命力与美好祝愿。用画笔给青蓝蛋壳添上花枝纹，将它安放在陶杯中，为在意的人准备一枚节日彩蛋，也可以留下一句复活节祝愿。",
  },
  {
    id: "basque-sunflower", title: "太阳花迎门", engine: "basque-sunflower@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "basque-folk",
    narrative: "太阳蓟在巴斯克民间传说中被称作太阳之花，门边悬挂的形象寄托家宅安宁，也成为地方文化符号。这里用原创纸木花饰，依次合拢花心、悬起与静看，照料家门。不采集野生植物，不把民俗传说当作防护保证，也不模拟召唤或洞穴祭仪。",
  },
  {
    id: "breton-banner", title: "节旗轻展", engine: "breton-banner@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "breton-pardons",
    narrative: "布列塔尼地方朝圣与节庆中常见旗帜，图案与队伍承载堂区记忆、语言文化和社区联系。这里以原创布旗、木杆与展架，依次轻展、立起和静看，欣赏公共节庆工艺。不复制真实圣旗，不替用户带领朝圣队伍，不模拟告解或弥撒，也不宣称获得赦免。",
  },
  {
    id: "lithuanian-straw-garden", title: "草穗悬园", engine: "lithuanian-straw-garden@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "baltic-folk",
    narrative: "立陶宛的 Sodai 草编花园常悬于摇篮、婚桌或家庭桌上，寄托新生儿幸福、新婚者丰育与家人和睦的愿望。接好下部的小菱形，再把草编花园挂上工坊木架，在这里静赏这种承载家庭祝愿的悬饰与透光结构。",
  },
  {
    id: "dalarna-wooden-horse", title: "木马安放", engine: "dalarna-wooden-horse@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "dalecarlian-folk",
    narrative: "达拉纳木马源自瑞典地方木雕工艺，后来成为广为人知的文化符号，造型与彩绘因工匠而异。这里用原创木马、软布与木座，依次轻拭、安放和静看，照料手作。不复刻特定工匠作品，不把木马称为护身法器，也不模拟礼拜或承诺家宅平安。",
  },
  {
    id: "aland-votive-ship", title: "舟模寄谢", engine: "aland-votive-ship@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "aland-folk",
    narrative: "奥兰群岛的教堂保存着舟模。献置舟模的海事传统，也有感谢航程平安、祈愿未来安航的心意。立好桅杆，把舟模安放在船架上，欣赏这段向海上谢恩传统致意的船模小景，也可以写下一句自己的感谢。",
  },
  {
    id: "blang-tea", title: "茶山一盏", engine: "blang-tea@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "blang-traditional",
    narrative: "景迈山的布朗族等社区长期维护林下茶园，茶树、森林与村落生活相互联系，也承载各自的祖先记忆。这里以原创陶壶、茶叶与小杯，依次添叶、倒茶和静看，感谢山林的当代茶歇。不模拟茶祖祭仪、寨祭或供僧程序，不把这套茶具说成当地统一的仪式器物。",
  },
  {
    id: "minangkabau-spinning-top", title: "归乡轻转", engine: "minangkabau-spinning-top@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "minangkabau-adat",
    narrative: "米南加保文化中的外出与归乡，同母系大屋、亲属责任和家乡联系相伴，习俗法与伊斯兰传统也长期相互对话。这里用一枚原创木陀螺，让拉绳、轻转与停稳，寄托旅途从容与平安归来的心意。不声称这是米南专属古俗，不模拟浴礼、宗教职务或习俗法裁决。",
  },
  {
    id: "chinese-incense", title: "炉前一炷", engine: "chinese-incense@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "chinese-folk-and-confucian",
    narrative: "妈祖信俗中，人们在庙内或家中供献香烛，祈求平安与安康。这里欣赏香具安置的一小段：移开炉盖，把一炷细香安放入香孔，再静看轻烟，体会敬香祈安所寄托的心意。",
  },
  {
    id: "hongsheng-red-string", title: "红绳自持", engine: "hongsheng-red-string@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "hongsheng-red-string",
    narrative: "文学典故中的月老赤绳来自姻缘故事，是连结的想象；当代习惯中的红绳佩戴则做法多样，不能由故事推导为统一古礼。这里取当代照看自己的心意，以收线架绕绳、合扣和静看做手作致敬。本体验为产品改编，不判断缘分、不强制配对，也不与其他传统护身线混称。",
  },
  {
    id: "italian-ex-voto", title: "绘牌记谢", engine: "italian-ex-voto@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "italian-ex-voto",
    narrative: "意大利德鲁塔附近的天主教圣所，留存着信众委托陶工绘制的谢恩陶牌，记录蒙恩经历与对圣母的感谢。这里借这份以画记谢的传统，画一段归途，再描一线窗光。轻点陶牌静看，或写下自己感念的人与事，让这幅现代记谢小画留住一份感谢。",
  },
  {
    id: "czech-pilgrim-journal", title: "旅途一页", engine: "czech-pilgrim-journal@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "czech-moravian-folk",
    narrative: "摩拉维亚的霍斯廷与维莱赫拉德是捷克重要朝圣地，步行路线连接山丘、村落与圣所，旅行与信仰在此相遇。这里借旅人的片刻停歇，翻开一册原创山路手记、放入布书签并静看。这本现代手记是产品改编的文化致敬，不声称为历史仪轨，也不模拟弥撒、告解或真实朝圣完成。",
  },
  {
    id: "omikuji", title: "签纸慢读", engine: "omikuji@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "omikuji",
    narrative: "日本寺社的御神签用于抽签问意与问运，常见做法是摇筒抽出签棒，再按编号取得纸签；读后携回或折系的习惯因寺社而异。这里沿着摇筒、抽棒、展纸的动作，读一句原创的日常自省提醒，再将纸签收进信封。给自己一点时间，想想今天能照顾的一件小事。",
  },
  {
    id: "polish-blessing-basket", title: "一篮春食", engine: "polish-blessing-basket@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "polish-folk-catholic",
    narrative: "波兰天主教家庭常在圣周六准备复活节食物篮，带到教堂参加食物祝福。这里停留在家中备篮的片段：把圆面包和彩蛋放进衬着白布的篮子，再静看备好的春食，或写一句感谢。准备这一篮食物，也想起日用食粮与为家人备餐的人。",
  },
  {
    id: "navruz-sumalak", title: "春锅共煮", engine: "navruz-sumalak@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "uzbek-folk",
    narrative: "诺鲁孜春日到来，乌兹别克的亲友邻里围着大锅共煮苏玛拉克，轮流搅动麦芽甜食，熟后分给大家。这里按住木勺，沿锅边缓缓搅动，再盛入陶碗，放到共食垫上。把春日的一份甜食留给邻里，在共煮与分享间迎接新岁。",
  },
  {
    id: "floating-lantern-loy-krathong", title: "叶舟寄意", engine: "floating-lantern-loy-krathong@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "floating-lantern-loy-krathong",
    narrative: "泰国水灯节在一年一度的满月夜，人们将植物材料制成的小浮灯放入水面，寄托感谢与心愿。这里仅借泰国折叶水灯的形态，安放花朵、点烛、轻推叶舟，是产品改编的节俗致敬，与天灯、中元河灯和寺院供灯分开。现实漂放请选择可降解材料，遵守当地水域与清理规范。",
  },
  {
    id: "omamori-cycle", title: "御守伴行", engine: "omamori-cycle@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "omamori-cycle",
    narrative: "御守是日本神社和部分寺院授与的随身守护象征，常装于织锦小袋，佩持与返还都有各自的语境。这里以封闭小袋为灵感，邀请你选一只、挂到包上，或在回访时送回小箱。本体验为产品改编，不拆袋，不代表宗教授与，也不设真实到期提醒。",
  },
  {
    id: "shrine-suzu-bell", title: "庭前一铃", engine: "shrine-suzu-bell@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "shrine-suzu-bell",
    narrative: "神社铃绪是公开参拜空间中的铃绳，与夏日檐下的风铃属于不同器物。人们有铃时轻摇，收拾心神后再礼敬，各社做法可能不同。这里轻摇铃绳、松手收回，再静听余音，让动作随铃声慢慢停下。本体验是产品致敬，不模拟完整参拜，也不以铃响次数计算功效。",
  },
  {
    id: "st-brigids-cross", title: "草编迎春", engine: "st-brigids-cross@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "st-brigids-cross",
    narrative: "圣布里吉德十字是爱尔兰民俗与天主教家庭习俗中的草编挂饰，常与圣布里吉德节前夕相伴，用灯心草或麦秆编成，样式因地方而异。这里让四束草交织，再挂上原创门楣，是产品改编的手作致敬，不模拟圣水祝福，也不把编织说成护佑保证。",
  },
  {
    id: "bokjori", title: "竹筛迎岁", engine: "bokjori@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "bokjori",
    narrative: "韩国岁首有购置福笊篱、悬挂迎新的民俗，把淘米竹具寄予纳福的心意。先试试这件炊具舀米的用途，再把竹柄拖到墙上的木挂点，静看挂好的福笊篱。舀米让人认识器物，岁首购挂的习俗则承载迎新的祝愿。",
  },
  {
    id: "ema-votive-plaque", title: "木牌记愿", engine: "ema-votive-plaque@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "ema-votive-plaque",
    narrative: "绘马是日本神社与部分寺院常见的祈愿木牌，既可书写愿望，也可表达感谢。早期献马的习惯逐渐转为木牌图像，今日题材十分多样。这里用原创花叶装饰一块小牌，让你翻面、留字、悬挂，整理此刻心意。本体验为产品改编，不代表正式参拜，也不代替任何神社宣布回应。",
  },
  {
    id: "clootie-well-rag", title: "井边放下", engine: "clootie-well-rag@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "clootie-well-rag",
    narrative: "Clootie 布条圣井见于苏格兰等地的地方民俗，人们把小布片浸过井水，再系于附近树枝，寄托放下病苦的心意。现实井址需要养护，材料应小而可降解，以纯棉或羊毛为宜。这里浸润布片、系上树枝，留一刻安静，布条仍留在眼前。本体验为产品改编，不承诺疗效，也不模拟疾病消退。",
  },
  {
    id: "diya-oil-lamp", title: "灯旋一瞥", engine: "diya-oil-lamp@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "diya-oil-lamp",
    narrative: "印度教献光礼中，灯光在神圣形象前移动，表达礼敬与祈祷。这里取材于献光所用的油灯与旋灯姿态：依次点亮三盏陶灯，让前方一盏沿浅金圆弧缓缓转过，再放回盘中。留一瞥灯盏与光，也认识这份手势的礼敬来处。",
  },
  {
    id: "votive-candle-catholic", title: "留一盏烛光", engine: "votive-candle-catholic@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "votive-candle-catholic",
    narrative: "还愿烛是天主教民间虔诚中的可见记号，点烛可寄托祈求、代祷或感谢，人离开后光仍留在烛架。它从属于宗教生活中的礼仪，不能替代圣事。这里用原创石廊和一支蜡烛，邀请你安放、点亮并留下短意向。本体验为产品改编，不复制特定圣所，也不把烛光说成恩宠或疗效保证。",
  },
  {
    id: "daruma-eye-painting", title: "达摩点睛", engine: "daruma-eye-painting@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "daruma-eye-painting",
    narrative: "高崎达摩的点睛习惯，把立愿与谢恩分在两个时刻：先点一目，留下愿望；愿望实现，或平安度过一年后，再补另一目。轻点眼圈或拖动毛笔，写下一个愿望或短目标，再把达摩放回木座。另一目的留白，留待愿成或一年平安的谢恩时刻。",
  },
  {
    id: "mizuhiki", title: "水引结愿", engine: "mizuhiki@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "mizuhiki",
    narrative: "日本水引以和纸细绳结饰礼金封与礼物，把赠答的心意郑重系好。这里为一只纸封绕环、穿环、收结，再写一句送给对方的祝愿，或静静放好。纸绳与纸封相衬，留住一份准备赠予他人的心意。",
  },
  {
    id: "milagros", title: "留一枚感谢", engine: "milagros@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "milagros",
    narrative: "在墨西哥的天主教奉献习俗中，milagros 金属小符寄托向圣者祈求帮助、护佑，或在蒙恩后表达谢意。小符的形状与个人经历相连，并无统一释义。选一枚小符，挂到眼前木架上，再留下自己的祈求或感谢。",
  },
  {
    id: "phuang-malai", title: "串花寄意", engine: "phuang-malai@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "phuang-malai",
    narrative: "在泰国，phuang malai 是鲜花串成的花环，可用来向敬重的长辈表达敬意与感谢；母亲节的茉莉花环也承载对母亲的谢意。将托盘中的茉莉逐簇串起，收好绳结，捧放在小台上，为想感谢的人留一句话。",
  },
  {
    id: "woodfish",
    title: "敲一敲木鱼",
    engine: "woodfish@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "chinese-buddhism",
    narrative:
      "木鱼是佛教诵经礼忏中领节奏的法器，鱼形也寄托着警醒、精进的提醒。轻点眼前木鱼，听木槌敲击与余音相接；这一轮记录十二次轻敲，听声稍停。",
  },
  {
    id: "celtic-folk-spring",
    title: "泉边一念",
    engine: "celtic-folk-spring@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "celtic-folk",
  },
  {
    id: "theravada-water",
    title: "花水位一倾",
    engine: "theravada-water@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "theravada-buddhism",
  },
  {
    id: "tanzaku-tanabata",
    title: "短册系竹",
    engine: "tanzaku-tanabata@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "日本七夕时，人们把愿望写在色纸短册上，系于笹竹；仙台七夕的七种装饰中，短册多寄托学业与书艺精进之愿。它与绘马同属书写悬挂的祈愿习惯，却是七月星祭的岁时语境。这里留下一句当下的心愿，与自己的日常相伴，不代表宗教仪轨。",
  },
  {
    id: "yeondeunghoe",
    title: "燃灯上浮",
    engine: "yeondeunghoe@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "won-buddhism",
    narrative:
      "韩国燃灯会在佛诞节期举行，人们制作、悬挂彩灯，持灯巡行，表达祝愿。点按眼前莲灯或向上轻推，看画面中的莲灯缓缓移向高处，再静看灯光。",
  },
  {
    id: "furin-wind-chime",
    title: "风铃一响",
    engine: "furin-wind-chime@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "日本奈良おふさ观音寺的夏季风铃祭承接当地祈求平安度夏的参拜习俗，寺方将境内铃声与祓厄、清凉联系在一起。轻拂眼前玻璃风铃的纸条，或点按铃身，带着平安的祝愿听一声轻响与余音。",
  },
  {
    id: "shinto-torii",
    title: "庭前一礼",
    engine: "shinto-torii@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "鸟居标示日本神社境内与日常空间的界线，入社前停步低头，是表达敬意的礼节。先走近鸟居，再轻轻一礼；在绘马架旁，可写下祈愿，让一块木牌留在架上，也可静立片刻。",
  },
  {
    id: "tibetan-wheel",
    title: "廊前轻转",
    engine: "tibetan-wheel@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "tibetan-buddhism",
    narrative:
      "转经筒见于藏传佛教的日常实践，转动与祈愿、诵念相联系。这里以廊前固定式转筒为灵感，邀请你用一次轻缓的触碰，让筒身沿顺时针方向转动。本体验为产品改编，保留安静的节奏，不代替修持，也不以转数计量任何成效。",
  },
  {
    id: "slavic-wreath",
    title: "火边花环",
    engine: "slavic-wreath@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "slavic-folk",
    narrative:
      "乌克兰部分地区的 Kupala 仲夏习俗中，姑娘们把草花编成花环，放上水面，并从漂流情形占问婚恋。编好眼前花环，把它轻放到水面，静看它漂远；也可为这个仲夏片刻留一句感想。",
  },
  // Product-original practices: no traditionSlug, so no tradition is implied.
  // They share ids with the crane/lantern rituals, which open them (useOpenRitual).
  {
    id: "crane",
    title: "折一只纸鹤",
    engine: "crane@1",
    revision: "bundled",
    manifestUrl: "",
    narrative:
      "在广岛的和平纪念文化中，人们折叠并奉献纸鹤，纪念原爆中逝去的孩子，祈愿和平。点按纸面，逐步折出颈尾和双翼；把折好的纸鹤托到眼前，再留一句和平祝愿。",
  },
  {
    id: "lantern",
    title: "月下一灯",
    engine: "lantern@1",
    revision: "bundled",
    manifestUrl: "",
    narrative:
      "一盏柔和的灯，可以为一句祝愿留出安静的位置。这里借鉴纸灯笼的竹骨与透光纸面，将点亮、写愿与悬挂组成一段缓慢的体验。本场景为产品原创，不对应某项真实供灯仪式；灯留在眼前，陪你记住此刻的心意。",
  },
];

export function dailyPrimaryScene<T extends { id: string }>(entries: readonly T[], day: string, excluded: readonly string[] = []): T | undefined {
  const order = Array.from({ length: Math.max(BLESSING_SCENE_IDS.length, WISH_SCENE_IDS.length) }, (_, i) =>
    [BLESSING_SCENE_IDS[i], WISH_SCENE_IDS[i]].filter((id): id is typeof BLESSING_SCENE_IDS[number] | typeof WISH_SCENE_IDS[number] => Boolean(id)),
  ).flat();
  const pool = order.filter(id => !excluded.includes(id)).map(id => entries.find(e => e.id === id)).filter((e): e is T => !!e && isSceneVisibleInApp(e));
  // An ordinal covers every entry even as the catalog grows. A date's digit
  // sum has too few possible values and leaves new scenes unreachable.
  const utc = Date.parse(`${day}T00:00:00Z`);
  const n = Number.isFinite(utc) ? Math.floor(utc / 86_400_000) : Array.from(day).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return pool[((n % Math.max(pool.length, 1)) + pool.length) % Math.max(pool.length, 1)];
}
