/** Public bundled metadata; safe in native/extension code, without DOM imports. */
type CatalogEntry = { id: string; title: string; engine: string; revision: string; manifestUrl: string };
/**
 * Scenes that can come up on 今日's daily set as 祈福 (blessing) practices:
 * quiet listening, an entrance bow, a slow turn, a strike, a pour.
 */
export const BLESSING_SCENE_IDS = [
  "woodfish",
  "furin-wind-chime",
  "shinto-torii",
  "tibetan-wheel",
  "celtic-folk-spring",
  "theravada-water",
  "clootie-well-rag",
  "diya-oil-lamp",
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
] as const;


export type BuiltInSceneEntry = CatalogEntry & {
  /** 一段 80–120 汉字：起源 + 历史脉络 + 基本意涵；练习／致敬语气。缺省 → 隐藏折叠块。 */
  narrative?: string;
  /** 指向 content/traditions/<slug>.md（单文件，非目录）；仅元数据，本期 app 不加载。产品原创场景（crane、lantern）省略。 */
  traditionSlug?: string;
};
export const builtInScenes: BuiltInSceneEntry[] = [
  {
    id: "ema-votive-plaque", title: "木牌记愿", engine: "ema-votive-plaque@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "ema-votive-plaque",
    narrative: "绘马是日本神社与部分寺院常见的祈愿木牌，既可书写愿望，也可表达感谢。早期献马的习惯逐渐转为木牌图像，今日题材十分多样。这里用原创花叶装饰一块小牌，让你翻面、留字、悬挂，整理此刻心意。本体验为产品改编的致敬练习，不代表正式参拜，也不代替任何神社宣布回应。",
  },
  {
    id: "clootie-well-rag", title: "井边放下", engine: "clootie-well-rag@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "clootie-well-rag",
    narrative: "Clootie 布条圣井见于苏格兰等地的地方民俗，人们把小布片浸过井水，再系于附近树枝，寄托放下病苦的心意。现实井址需要养护，材料应小而可降解，以纯棉或羊毛为宜。这里借浸布与系枝做一段安静的致敬练习，布条仍留在眼前。本体验为产品改编，不承诺疗效，也不模拟疾病消退。",
  },
  {
    id: "diya-oil-lamp", title: "灯旋一瞥", engine: "diya-oil-lamp@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "diya-oil-lamp",
    narrative: "Diya 是南亚常见的油灯，陶或金属小盏盛油置芯，见于印度教家庭敬礼，也在排灯节的门槛与窗台连成灯火。点光与旋灯有各自的地方语境。这里以敞口陶盏为灵感，让你点亮一小排，托一盏缓缓绕圈，再放回盘上。本体验为产品改编的致敬练习，不模拟完整普迦，也不以灯数衡量功效。",
  },
  {
    id: "votive-candle-catholic", title: "留一盏烛光", engine: "votive-candle-catholic@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "votive-candle-catholic",
    narrative: "还愿烛是天主教民间虔诚中的可见记号，点烛可寄托祈求、代祷或感谢，人离开后光仍留在烛架。它从属于宗教生活中的礼仪，不能替代圣事。这里用原创石廊和一支蜡烛，邀请你安放、点亮并留下短意向。本体验为产品改编的致敬练习，不复制特定圣所，也不把烛光说成恩宠或疗效保证。",
  },
  {
    id: "daruma-eye-painting", title: "达摩点睛", engine: "daruma-eye-painting@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "daruma-eye-painting",
    narrative: "达摩是不倒翁形的日本民俗祈愿工艺摆偶。常见习惯是先点上一目立愿，事成后再补另一目；左右顺序的说法会因地区与观看视角而异。这里借点睛与轻摆，给一个目标留出位置。本体验为产品改编的练习，不代表宗教加持，也不催促心愿实现。",
  },
  {
    id: "mizuhiki", title: "水引结愿", engine: "mizuhiki@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "mizuhiki",
    narrative: "水引是日本礼赠文化中的装饰纸绳工艺，细绳由和纸捻成，常用于礼金袋、礼盒和工艺结饰。配色与结形因赠答场合而异。这里将绕环、穿结与收紧改编为一段短手作练习，让一句祝愿落在礼笺上。本体验不作为完整工艺或礼法教程。",
  },
  {
    id: "milagros", title: "留一枚感谢", engine: "milagros@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "milagros",
    narrative: "Milagros 是拉丁美洲民间虔诚中常见的金属还愿小符，尤其见于墨西哥，可用于祈求与谢恩。形象的解释具有地方差异，并无统一的图解字典。这里以原创小符和木架承接一句心意，是产品改编的致敬练习，不复制特定圣地，也不承诺任何功效。",
  },
  {
    id: "phuang-malai", title: "串花寄意", engine: "phuang-malai@1", revision: "bundled", manifestUrl: "",
    traditionSlug: "phuang-malai",
    narrative: "Phuang malai 是泰国鲜花串环，常以茉莉等花材组成环体与花穗，见于欢迎、感谢和礼敬的场合。这里以几簇奶油白花苞为灵感，让你逐段串成一环，再留下想说的话。本体验为产品改编的手作练习，聚焦心意，不模拟完整礼仪。",
  },
  {
    id: "woodfish",
    title: "敲一敲木鱼",
    engine: "woodfish@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "chinese-buddhism",
    narrative:
      "木鱼是东亚佛教课诵与集众时常见的响器，圆型腹空，轻敲以应诵经节拍，禅寺中常与磬相配。鱼形无睑，常被理解为精勤醒觉，并与寺院晨昏的日常节律相连。本页只作静心练习与文化致敬，非宗教仪轨。",
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
      "日本七夕时，人们把愿望写在色纸短册上，系于笹竹；仙台七夕的七种装饰中，短册多寄托学业与书艺精进之愿。它与绘马同属书写悬挂的祈愿习惯，却是七月星祭的岁时语境。本页只作许愿练习与致敬，非宗教仪轨。",
  },
  {
    id: "yeondeunghoe",
    title: "燃灯上浮",
    engine: "yeondeunghoe@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "won-buddhism",
    narrative:
      "韩国燃灯会是佛诞前后点亮莲灯的节庆，二〇二〇年列入联合国教科文组织人类非物质文化遗产代表作名录。灯火象征光明与共同祝愿，如今也延伸为公众可自制莲灯参与的开放春日共庆。本页只作许愿练习与致敬，非宗教仪轨。",
  },
  {
    id: "furin-wind-chime",
    title: "风铃一响",
    engine: "furin-wind-chime@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "风铃是日本夏日常见的风物与工艺：江户玻璃或南部铁器的铃身下系纸短册，风过轻响，带来听觉上的清凉感。常述由古时悬于檐角的风铎演变而来，渐成民俗美学。本页只作静听练习与致敬，非宗教仪轨。",
  },
  {
    id: "shinto-torii",
    title: "庭前一礼",
    engine: "shinto-torii@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "shinto",
    narrative:
      "在日本神社，鸟居标示日常空间与神圣空间的边界，入内前的轻轻一礼表达敬意。不同神社的参拜礼节并不完全相同。这里以庭前停步、低头与安静致意为灵感，是一段产品改编的致敬练习，不替代真实参拜，也不代表任何神社。",
  },
  {
    id: "tibetan-wheel",
    title: "廊前轻转",
    engine: "tibetan-wheel@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "tibetan-buddhism",
    narrative:
      "转经筒见于藏传佛教的日常实践，转动与祈愿、诵念相联系。这里以廊前固定式转筒为灵感，邀请你用一次轻缓的触碰，让筒身沿顺时针方向转动。本体验为产品改编的致敬练习，保留安静的节奏，不代替修持，也不以转数计量任何成效。",
  },
  {
    id: "slavic-wreath",
    title: "火边花环",
    engine: "slavic-wreath@1",
    revision: "bundled",
    manifestUrl: "",
    traditionSlug: "slavic-folk",
    narrative:
      "乌克兰与波兰部分地区的仲夏习俗中，可以见到花环、歌唱、火光与水上放环，各地做法与节期有所不同。这里借这些公开的民俗意象，让一圈花叶载着祝愿缓缓漂远。本体验为产品改编的致敬练习，不代表所有斯拉夫传统，也不以花环预测命运。",
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
      "纸鹤承载着手作与祝愿，也在战后的广岛成为和平的象征。这里以一张纸的折痕与展开为灵感，邀请你缓缓折出一只鹤，留下想送给自己或他人的话。本体验为产品改编的练习，不代表特定宗教仪式，也不承诺心愿必然实现。",
  },
  {
    id: "lantern",
    title: "月下一灯",
    engine: "lantern@1",
    revision: "bundled",
    manifestUrl: "",
    narrative:
      "一盏柔和的灯，可以为一句祝愿留出安静的位置。这里借鉴纸灯笼的竹骨与透光纸面，将点亮、写愿与悬挂组成一段缓慢的体验。本场景为产品原创的练习，不对应某项真实供灯仪式；灯留在眼前，陪你记住此刻的心意。",
  },
];

export function dailyPrimaryScene<T extends { id: string }>(entries: readonly T[], day: string): T | undefined {
  const order = Array.from({ length: Math.max(BLESSING_SCENE_IDS.length, WISH_SCENE_IDS.length) }, (_, i) =>
    [BLESSING_SCENE_IDS[i], WISH_SCENE_IDS[i]].filter((id): id is typeof BLESSING_SCENE_IDS[number] | typeof WISH_SCENE_IDS[number] => Boolean(id)),
  ).flat();
  const pool = order.map(id => entries.find(e => e.id === id)).filter((e): e is T => !!e);
  const n = Array.from(day).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return pool[n % Math.max(pool.length, 1)];
}
