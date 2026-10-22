/** The purpose of the current scene, not a claim that its virtual actions complete a religious rite. */
export type SceneIntentionKind =
  | 'wish' | 'blessing' | 'gratitude' | 'reflection'
  | 'remembrance' | 'celebration' | 'reverence';

export type SceneIntention = Readonly<{
  kind: SceneIntentionKind;
  label: string;
  /** A cue to carry the intention through the actions already present in the scene. */
  action: string;
  /** Whether the host may offer a separate, optional personal wish record. */
  optionalWish: boolean;
}>;

// Reviewed against the current scene actions and their bounded cultural contexts.
// Evidence and product-expression boundaries: docs/research/2026-10-19-ritual-intentions.md.
const intentions: Readonly<Record<string, SceneIntention>> = {
  // Source/action boundaries: docs/research/2026-10-19-hourly-scene-integration.md.
  'kitano-nadeushi': { kind: 'blessing', label: '抚额寄愿，愿学业顺遂', optionalWish: false, action: '抬手靠近卧牛额面，轻抚牛额，再收回手掌。' },
  'hiiragi-iwashi': {
    kind: 'blessing', label: '门边安放，寄托护家心意', optionalWish: false,
    action: '拿起柊枝，插合烤鱼头，再安放门边。',
  },
  'tamagushi-offering': {
    kind: 'blessing', label: '向神明奉上祈愿', optionalWish: false,
    action: '手持玉串转向，将家人平安的祈愿寄于枝叶，再向前供放。',
  },
  'tibetan-water-bowls': {
    kind: 'blessing', label: '供养清水，愿众生离苦', optionalWish: false,
    action: '提起水壶，从左至右逐碗添水，再收回供台一侧。',
  },
  'kagami-biraki-sake': {
    kind: 'blessing', label: '祝愿新开始健康幸福', optionalWish: false,
    action: '取起木槌，轻叩预松盖缝，再收回樽旁。',
  },
  'tibetan-prayer-flags': {
    kind: 'blessing', label: '为众生祈愿安康', optionalWish: false,
    action: '把完整经幡挂到离地的高处，寄托愿众生受益安乐的心意。',
  },
  'rosh-hashanah-apple-honey': {
    kind: 'blessing', label: '祈愿美好甜蜜的新年', optionalWish: false,
    action: '拿起苹果片，蘸入蜂蜜，再提起回盘。',
  },
  'thai-songkran-elders': {
    kind: 'blessing', label: '向长辈求一份新岁祝福', optionalWish: false,
    action: '向长辈手上缓缓浇水，表达敬意，祝愿长辈安康。',
  },
  'kameido-usokae': {
    kind: 'blessing', label: '祈愿凶事转吉，迎接新年', optionalWish: false,
    action: '送还旧木鷽，接取新木鷽，将它安放好。',
  },
  'persian-esfand': {
    kind: 'blessing', label: '为家人寄一份平安', optionalWish: false,
    action: '让锅中的种子生烟，挥巾散开烟气，寄托家人平安的心愿。',
  },
  'mochigase-nagashibina': {
    kind: 'blessing', label: '祈愿无病息灾与平安成长', optionalWish: false,
    action: '托起圆形草托，移向缓流，让纸雏随水漂去。',
  },
  'greek-vasilopita': {
    kind: 'blessing', label: '把新年祝愿带给家人', optionalWish: false,
    action: '将切好的新年糕送到家人盘里，愿家人在新年里健康安好。',
  },
  'tibetan-khata-greeting': {
    kind: 'blessing', label: '向来客送上幸福祝愿', optionalWish: false,
    action: '双手托起白绢，递给来客，送上幸福祝愿。',
  },
  'shichigosan-chitose-ame': {
    kind: 'blessing', label: '把成长祝愿送给孩子', optionalWish: false,
    action: '提起千岁饴糖袋，递给眼前的孩子，愿孩子健康成长、长寿安好。',
  },
  'mongolian-ovoo': {
    kind: 'blessing', label: '向山岳与湖泊祈求护佑', optionalWish: false,
    action: '携石顺时针绕行三圈，向敖包添石。',
  },
  'fgs-buddha-bathing': {
    kind: 'blessing', label: '浴佛发愿，愿众生离苦', optionalWish: false,
    action: '提起水杓，向太子像右肩、左肩、右肩依次倾水，发愿止恶行善、度众生。',
  },
  'balinese-canang-sari': {
    kind: 'blessing', label: '向神明献上感恩', optionalWish: false,
    action: '放入白花，托起盛好供品的叶盘，轻放到田边供台上。',
  },
  'bulgarian-survakane': {
    kind: 'blessing', label: '新年问候，祝亲友健康', optionalWish: false,
    action: '提起彩枝，移到亲友背后，轻拍后收回，送上健康祝愿。',
  },
  'setsubun-mamemaki': {
    kind: 'blessing', label: '迎福入家，祝家人安康', optionalWish: false,
    action: '推开木扇，将木枡中的炒豆先撒向屋外，再轻撒到屋内。',
  },
  'sternsinger-house-blessing': {
    kind: 'blessing', label: '愿基督祝福这所房屋', optionalWish: false,
    action: '拿起粉笔，在门楣写下年份、星与 C+M+B，再把粉笔收好。',
  },
  'lam-tsuen-wishing-tree': {
    kind: 'wish', label: '把平安的心愿挂上树枝', optionalWish: false,
    action: '写下平安，将宝牒与塑料橙系在一起，再抛挂到仿真许愿树的枝头。',
  },
  'kagami-mochi-offering': {
    kind: 'blessing', label: '寄一份代代兴盛的祝愿', optionalWish: false,
    action: '叠好两层圆饼，顶上放橙，准备迎接年神的供物，寄托家族代代兴盛的祝愿。',
  },
  'romanian-martisor': {
    kind: 'blessing', label: '留一份迎春的健康祝愿', optionalWish: false,
    action: '提起已解下的红白春绳，将绳环套上开花的树枝，轻放流苏，寄托迎春的健康祝愿。',
  },
  'sumiyoshi-godairiki': {
    kind: 'wish', label: '随三石寄托心愿', optionalWish: false,
    action: '拾起五、大、力三颗字石，逐一放入御守袋，带着向神明祈愿的心意把它们收好。',
  },
  'polish-oplatek-sharing': {
    kind: 'blessing', label: '向家人送上祝愿', optionalWish: false,
    action: '平安夜分一片薄饼，与家人互致健康平安的祝愿。',
  },
  'udo-undama': {
    kind: 'wish', label: '怀着心愿投出陶玉', optionalWish: true,
    action: '取起陶玉、对准龟岩的方形凹处，想着此刻的心愿，轻轻投出。',
  },
  'zeniarai-coin-washing': {
    kind: 'wish', label: '寄托一份财福祈愿', optionalWish: true,
    action: '举起柄杓、浇洗筛中的钱币，再用布巾拭水，寄托一份财福的心愿。',
  },
  'chinowa-kuguri': {
    kind: 'blessing', label: '祈愿平安健康', optionalWish: false,
    action: '穿过茅环，依次向左、向右、再向左绕行，带着平安健康的心意走回环前。',
  },
  'bonfim-ribbon': {
    kind: 'wish', label: '把三个心愿系在彩带上', optionalWish: false,
    action: '在栏前逐一收紧彩带的三个结，每收一结，在心中留一个愿望。',
  },
  'greek-new-year-pomegranate': {
    kind: 'blessing', label: '为家人寄托新年祝愿', optionalWish: false,
    action: '拿起石榴、移到门槛上方，向下落果，借破开的果实与散落红籽寄托新年好运和丰足。',
  },
  'japanese-koinobori': {
    kind: 'blessing', label: '祝愿孩子健康成长', optionalWish: true,
    action: '展开布鲤、牵绳升起，把对孩子成长的祝愿留在迎风的鲤旗旁。',
  },
  'korean-bojagi-wrap': {
    kind: 'blessing', label: '为收礼的人送祝福', optionalWish: true,
    action: '想着要收礼的人，拢起布角、包好礼盒，把给对方的祝愿系进这份赠礼。',
  },
  'welsh-love-spoon': {
    kind: 'blessing', label: '为在意的人准备赠礼', optionalWish: true,
    action: '想着一位在意的人，轻拭木勺、安放到展托，让这份礼物承载爱意与祝愿。',
  },
  'barcelos-clay-rooster': {
    kind: 'blessing', label: '寄托一份好运祝愿', optionalWish: true,
    action: '为陶鸡添纹、放上展台，借它的好运寓意，寄托一份你此刻的美好祝愿。',
  },
  'croatian-licitar-heart': {
    kind: 'blessing', label: '把爱意与祝福送给对方', optionalWish: true,
    action: '想着想赠予的人，给彩心添上糖霜、挂好布带，为对方准备一份情谊。',
  },
  'sorbian-painted-egg': {
    kind: 'blessing', label: '为收礼的人祝福', optionalWish: true,
    action: '给彩蛋添纹、安放在陶杯，想着要赠予的人，留一份复活节的美好祝愿。',
  },
  'basque-sunflower': {
    kind: 'blessing', label: '祝愿家宅平安', optionalWish: true,
    action: '装好纸木太阳花、挂到门框上，为家人与归来的人寄托一份平安的祝愿。',
  },
  'lithuanian-straw-garden': {
    kind: 'blessing', label: '祝愿家人和睦', optionalWish: true,
    action: '接好草编菱形、挂上木架，静赏悬园时，想起你愿祝福的家人。',
  },
  'aland-votive-ship': {
    kind: 'gratitude', label: '感谢平安归来', optionalWish: false,
    action: '立好桅杆、将舟模安放到船架，想起一段平安归来的旅程与想感谢的人。',
  },
  'chinese-incense': {
    kind: 'blessing', label: '体会敬香祈安的心意', optionalWish: true,
    action: '移开炉盖、安放细香，在轻烟前，为自己与牵挂的人留一份平安的祝愿。',
  },
  'italian-ex-voto': {
    kind: 'gratitude', label: '留住一份感谢', optionalWish: false,
    action: '画一段归途、描一线窗光，让这幅记谢小画留住你感念的人与事。',
  },
  'omikuji': {
    kind: 'reflection', label: '给今天一刻自省', optionalWish: false,
    action: '摇筒、展纸，读过这句原创提醒，想想今天能照顾的一件小事，再把纸签收好。',
  },
  'polish-blessing-basket': {
    kind: 'gratitude', label: '感谢食粮与备餐的人', optionalWish: false,
    action: '把面包和彩蛋放入复活节食物篮，备篮时想起日用食粮与为家人备餐的人。',
  },
  'navruz-sumalak': {
    kind: 'celebration', label: '与邻里分享春日祝愿', optionalWish: false,
    action: '缓搅苏玛拉克、盛入陶碗，把一份春日甜食留给邻里，带着善意迎接新岁。',
  },
  'floating-lantern-loy-krathong': {
    kind: 'wish', label: '把感谢与心愿送上水面', optionalWish: true,
    action: '安花、点烛、轻推叶舟，在水灯节的小小浮灯旁，留一份感谢或心愿。',
  },
  'omamori-cycle': {
    kind: 'blessing', label: '祝愿这一程平安', optionalWish: true,
    action: '把小袋别在旅行包上，为接下来的一程寄托平安；回访送还时，再留一份感谢。',
  },
  'shrine-suzu-bell': {
    kind: 'reverence', label: '带着敬意问安', optionalWish: false,
    action: '轻拉铃绳、收回绳端，在余音落下时收拾心神，留一句无声的问安。',
  },
  'st-brigids-cross': {
    kind: 'blessing', label: '为家人祈福', optionalWish: true,
    action: '编起草十字、挂上门楣，想着家中的人，寄托一份平安的祝愿。',
  },
  'bokjori': {
    kind: 'blessing', label: '迎新纳福', optionalWish: true,
    action: '试过竹筛的舀米用途后，把福笊篱挂上墙，为新岁寄托一份纳福的心意。',
  },
  'ema-votive-plaque': {
    kind: 'wish', label: '把心愿留在木牌上', optionalWish: true,
    action: '翻过绘马、挂到横梁下，把一个心愿或一份感谢留在木牌前，也可以不写下来。',
  },
  'clootie-well-rag': {
    kind: 'blessing', label: '寄托康复的心愿', optionalWish: true,
    action: '浸湿棉布、系上低枝，为自己或牵挂的人留一份康复祝愿，再轻轻松手。',
  },
  'diya-oil-lamp': {
    kind: 'reverence', label: '体会献光的敬意', optionalWish: false,
    action: '点亮陶灯、沿弧轻旋，在灯光中体会献光礼的敬意，再将小灯放回盘上。',
  },
  'votive-candle-catholic': {
    kind: 'blessing', label: '为牵挂的人留一盏光', optionalWish: true,
    action: '安放蜡烛、点亮灯芯，为牵挂的人寄托祈求、代祷或感谢，静看烛光留下。',
  },
  'daruma-eye-painting': {
    kind: 'wish', label: '立下一个愿望或目标', optionalWish: true,
    action: '点好达摩的一目，把心愿放在心里；另一目留待愿成，或平安一年后的谢恩时刻。',
  },
  'mizuhiki': {
    kind: 'blessing', label: '为对方系一份祝愿', optionalWish: true,
    action: '为赠礼纸封绕环、穿环、收结，想着收礼的人，把给对方的祝愿系好。',
  },
  'milagros': {
    kind: 'wish', label: '留一份祈求或谢恩', optionalWish: true,
    action: '选一枚小符、挂到木架上，想起你愿向圣者祈求帮助，或为蒙恩道谢的事。',
  },
  'phuang-malai': {
    kind: 'gratitude', label: '感谢敬重的人', optionalWish: false,
    action: '串起茉莉、收好绳结、捧放花环，想着想感谢的人，让这串花环承载敬意与谢意。',
  },
  'woodfish': {
    kind: 'reflection', label: '听声，留一刻警醒', optionalWish: false,
    action: '轻敲木鱼、听余音相接，让这段节奏提醒自己收拾心神，专注眼前。',
  },
  'tanzaku-tanabata': {
    kind: 'wish', label: '把心愿系上竹枝', optionalWish: true,
    action: '拾起短册、系上笹竹，想着想要精进的一件事，留一个七夕的心愿。',
  },
  'yeondeunghoe': {
    kind: 'blessing', label: '借莲灯寄托祝愿', optionalWish: true,
    action: '带着一份祝愿轻推莲灯，静看画面中的灯光移向高处，照亮这一刻。',
  },
  'furin-wind-chime': {
    kind: 'blessing', label: '祈愿平安度夏', optionalWish: true,
    action: '轻拂纸条、听一声风铃，为自己与牵挂的人留一份平安度夏的祝愿。',
  },
  'shinto-torii': {
    kind: 'wish', label: '带着敬意祈愿', optionalWish: true,
    action: '走近鸟居、轻轻一礼，在绘马架旁留一个祈愿，也可以在心中默念。',
  },
  'tibetan-wheel': {
    kind: 'blessing', label: '祈愿众人安好', optionalWish: true,
    action: '顺时针轻转经筒，让一份愿众人安好的善愿伴着转动，再静立片刻。',
  },
  'slavic-wreath': {
    kind: 'reflection', label: '静看仲夏花环', optionalWish: false,
    action: '编好花环、轻放水面，认识 Kupala 婚恋占问的来处，目送时留一点自己的感想。',
  },
  'crane': {
    kind: 'blessing', label: '祈愿世界和平', optionalWish: true,
    action: '折出纸鹤的双翼、托到眼前，把对和平与孩子们的祝愿放进这一刻。',
  },
};

/** Unknown and App-hidden scenes receive no invented intention or generic wish prompt. */
export function sceneIntention(sceneId: string): SceneIntention | undefined {
  return Object.hasOwn(intentions, sceneId) ? intentions[sceneId] : undefined;
}
