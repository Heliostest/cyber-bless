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
] as const;

/** Scenes that can come up on 今日's daily set as 许愿 (wish-making) practices. */
export const WISH_SCENE_IDS = [
  "tanzaku-tanabata",
  "yeondeunghoe",
  "crane",
  "lantern",
  "slavic-wreath",
] as const;


export type BuiltInSceneEntry = CatalogEntry & {
  /** 一段 80–120 汉字：起源 + 历史脉络 + 基本意涵；练习／致敬语气。缺省 → 隐藏折叠块。 */
  narrative?: string;
  /** 指向 content/traditions/<slug>.md（单文件，非目录）；仅元数据，本期 app 不加载。产品原创场景（crane、lantern）省略。 */
  traditionSlug?: string;
};
export const builtInScenes: BuiltInSceneEntry[] = [
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
  const order = BLESSING_SCENE_IDS.flatMap((id, i) => i < WISH_SCENE_IDS.length ? [id, WISH_SCENE_IDS[i]] : [id]);
  const pool = order.map(id => entries.find(e => e.id === id)).filter((e): e is T => !!e);
  const n = Array.from(day).reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return pool[n % Math.max(pool.length, 1)];
}
