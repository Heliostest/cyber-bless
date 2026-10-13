import type { SceneMeta } from '@wbr/shared'
import type { SceneModule } from './contract'

/**
 * Slug for product-original scenes (crane, lantern) that do not represent a
 * specific religious or folk tradition; there is intentionally no
 * content/traditions card for it.
 */
export const PRODUCT_ORIGINAL = 'product-original'

export const sceneRegistry: SceneMeta[] = [
  { id: 'slovak-wire-bird', title: '铁线栖鸟', traditionSlug: 'slovak-folk', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'hungarian-embroidery-hoop', title: '花绣寄语', traditionSlug: 'hungarian-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'andalusian-ceramic-tile', title: '釉彩映晴', traditionSlug: 'andalusian-folk', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'sicilian-painted-cart', title: '彩车迎晴', traditionSlug: 'sicilian-santa-rosalia', grade: 'C', sensitivity: '中', gestures: ['drag'] },

  { id: 'bai-indigo-cloth', title: '蓝白晾晴', traditionSlug: 'bai-benzhu', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'ndebele-painted-house', title: '彩墙寄家', traditionSlug: 'ndebele-traditional', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'purepecha-copper-bowl', title: '铜碗拾暖', traditionSlug: 'purepecha', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'welsh-love-spoon', title: '木勺寄情', traditionSlug: 'welsh-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'barcelos-clay-rooster', title: '陶鸡报晓', traditionSlug: 'portuguese-romarias', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'finnish-birch-basket', title: '桦篮拾光', traditionSlug: 'finnish-karelian-folk', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'croatian-licitar-heart', title: '彩心相赠', traditionSlug: 'croatian-folk', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'catalan-festival-giant', title: '巨偶待游', traditionSlug: 'catalan-folk', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'sorbian-painted-egg', title: '彩蛋寄春', traditionSlug: 'sorbian-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'basque-sunflower', title: '太阳花迎门', traditionSlug: 'basque-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'breton-banner', title: '节旗轻展', traditionSlug: 'breton-pardons', grade: 'C', sensitivity: '低', gestures: ['drag'] },
  { id: 'lithuanian-straw-garden', title: '草穗悬园', traditionSlug: 'baltic-folk', grade: 'C', sensitivity: '低', gestures: ['drag'] },
  { id: 'dalarna-wooden-horse', title: '木马安放', traditionSlug: 'dalecarlian-folk', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'aland-votive-ship', title: '舟模寄谢', traditionSlug: 'aland-folk', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'blang-tea', title: '茶山一盏', traditionSlug: 'blang-traditional', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'minangkabau-spinning-top', title: '归乡轻转', traditionSlug: 'minangkabau-adat', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'chinese-incense', title: '炉前一炷', traditionSlug: 'chinese-folk-and-confucian', grade: 'C', sensitivity: '低', gestures: ['drag'] },
  { id: 'hongsheng-red-string', title: '红绳自持', traditionSlug: 'hongsheng-red-string', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'italian-ex-voto', title: '绘牌记谢', traditionSlug: 'italian-ex-voto', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'czech-pilgrim-journal', title: '旅途一页', traditionSlug: 'czech-moravian-folk', grade: 'C', sensitivity: '低', gestures: ['drag'] },
  { id: 'omikuji', title: '签纸慢读', traditionSlug: 'omikuji', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'polish-blessing-basket', title: '一篮春食', traditionSlug: 'polish-folk-catholic', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'navruz-sumalak', title: '春锅共煮', traditionSlug: 'uzbek-folk', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'floating-lantern-loy-krathong', title: '叶舟寄意', traditionSlug: 'floating-lantern-loy-krathong', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'omamori-cycle', title: '御守伴行', traditionSlug: 'omamori-cycle', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'shrine-suzu-bell', title: '庭前一铃', traditionSlug: 'shrine-suzu-bell', grade: 'C', sensitivity: '低', gestures: ['drag'] },
  { id: 'st-brigids-cross', title: '草编迎春', traditionSlug: 'st-brigids-cross', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'bokjori', title: '竹筛迎岁', traditionSlug: 'bokjori', grade: 'C', sensitivity: '低', gestures: ['drag'] },
  { id: 'ema-votive-plaque', title: '木牌记愿', traditionSlug: 'ema-votive-plaque', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'clootie-well-rag', title: '井边放下', traditionSlug: 'clootie-well-rag', grade: 'C', sensitivity: '中', gestures: ['drag'] },
  { id: 'diya-oil-lamp', title: '灯旋一瞥', traditionSlug: 'diya-oil-lamp', grade: 'C', sensitivity: '中', gestures: ['drag', 'spin'] },
  { id: 'votive-candle-catholic', title: '留一盏烛光', traditionSlug: 'votive-candle-catholic', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'daruma-eye-painting', title: '达摩点睛', traditionSlug: 'daruma-eye-painting', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'mizuhiki', title: '水引结愿', traditionSlug: 'mizuhiki', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] },
  { id: 'milagros', title: '留一枚感谢', traditionSlug: 'milagros', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  { id: 'phuang-malai', title: '串花寄意', traditionSlug: 'phuang-malai', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] },
  {
    id: 'celtic-folk-spring',
    title: '泉边一念',
    traditionSlug: 'celtic-folk',
    grade: 'C',
    sensitivity: '低',
    gestures: ['gyro', 'drag', 'wishWrite'],
  },
  {
    id: 'shinto-torii',
    title: '庭前一礼',
    traditionSlug: 'shinto',
    grade: 'C',
    sensitivity: '低',
    gestures: ['gyro', 'drag', 'wishWrite'],
  },
  {
    id: 'theravada-water',
    title: '花水位一倾',
    traditionSlug: 'theravada-buddhism',
    grade: 'C',
    sensitivity: '低',
    gestures: ['tilt', 'drag'],
  },
  {
    id: 'tibetan-wheel',
    title: '廊前轻转',
    traditionSlug: 'tibetan-buddhism',
    grade: 'C',
    sensitivity: '中',
    gestures: ['spin', 'gyro', 'drag'],
  },
  {
    id: 'slavic-wreath',
    title: '火边花环',
    traditionSlug: 'slavic-folk',
    grade: 'C',
    sensitivity: '低',
    gestures: ['drag', 'wishWrite'],
  },
  {
    id: 'tanzaku-tanabata',
    title: '短册系竹',
    traditionSlug: 'shinto',
    grade: 'C',
    sensitivity: '低',
    gestures: ['drag', 'wishWrite'],
  },
  {
    id: 'yeondeunghoe',
    title: '燃灯上浮',
    traditionSlug: 'won-buddhism',
    grade: 'C',
    sensitivity: '低',
    gestures: ['drag'],
  },
  {
    id: 'furin-wind-chime',
    title: '风铃一响',
    traditionSlug: 'shinto',
    grade: 'C',
    sensitivity: '低',
    gestures: ['tilt'],
  },
  {
    id: 'crane',
    title: '折一只纸鹤',
    // Product-original practice: deliberately not tied to a tradition card.
    traditionSlug: PRODUCT_ORIGINAL,
    grade: 'C',
    sensitivity: '低',
    gestures: ['drag', 'wishWrite'],
  },
  {
    id: 'lantern',
    title: '月下一灯',
    traditionSlug: PRODUCT_ORIGINAL,
    grade: 'C',
    sensitivity: '低',
    gestures: ['drag', 'wishWrite'],
  },
]

const IMPLEMENTED = new Set([
  'slovak-wire-bird', 'hungarian-embroidery-hoop', 'andalusian-ceramic-tile', 'sicilian-painted-cart',
  'bai-indigo-cloth', 'ndebele-painted-house', 'purepecha-copper-bowl', 'welsh-love-spoon',
  'barcelos-clay-rooster', 'finnish-birch-basket', 'croatian-licitar-heart', 'catalan-festival-giant',
  'sorbian-painted-egg', 'basque-sunflower', 'breton-banner', 'lithuanian-straw-garden',
  'dalarna-wooden-horse', 'aland-votive-ship', 'blang-tea', 'minangkabau-spinning-top',
  'chinese-incense', 'hongsheng-red-string', 'italian-ex-voto', 'czech-pilgrim-journal',
  'omikuji', 'polish-blessing-basket', 'navruz-sumalak', 'floating-lantern-loy-krathong',
  'omamori-cycle', 'shrine-suzu-bell', 'st-brigids-cross', 'bokjori',
  'ema-votive-plaque', 'clootie-well-rag', 'diya-oil-lamp', 'votive-candle-catholic',
  'daruma-eye-painting', 'mizuhiki', 'milagros', 'phuang-malai',
  'celtic-folk-spring',
  'theravada-water',
  'tanzaku-tanabata',
  'yeondeunghoe',
  'furin-wind-chime',
  'shinto-torii',
  'tibetan-wheel',
  'slavic-wreath',
  'crane',
  'lantern',
])

/** Whether `loadScene(id)` can resolve a module. */
export function isSceneImplemented(id: string): boolean {
  return IMPLEMENTED.has(id)
}

/** Dynamic-import implemented scenes; unknown ids throw. */
export async function loadScene(id: string): Promise<SceneModule> {
  switch (id) {
    case 'slovak-wire-bird': return import('./slovak-wire-bird')
    case 'hungarian-embroidery-hoop': return import('./hungarian-embroidery-hoop')
    case 'andalusian-ceramic-tile': return import('./andalusian-ceramic-tile')
    case 'sicilian-painted-cart': return import('./sicilian-painted-cart')

    case 'bai-indigo-cloth': return import('./bai-indigo-cloth')
    case 'ndebele-painted-house': return import('./ndebele-painted-house')
    case 'purepecha-copper-bowl': return import('./purepecha-copper-bowl')
    case 'welsh-love-spoon': return import('./welsh-love-spoon')
    case 'barcelos-clay-rooster': return import('./barcelos-clay-rooster')
    case 'finnish-birch-basket': return import('./finnish-birch-basket')
    case 'croatian-licitar-heart': return import('./croatian-licitar-heart')
    case 'catalan-festival-giant': return import('./catalan-festival-giant')
    case 'sorbian-painted-egg': return import('./sorbian-painted-egg')
    case 'basque-sunflower': return import('./basque-sunflower')
    case 'breton-banner': return import('./breton-banner')
    case 'lithuanian-straw-garden': return import('./lithuanian-straw-garden')
    case 'dalarna-wooden-horse': return import('./dalarna-wooden-horse')
    case 'aland-votive-ship': return import('./aland-votive-ship')
    case 'blang-tea': return import('./blang-tea')
    case 'minangkabau-spinning-top': return import('./minangkabau-spinning-top')
    case 'chinese-incense': return import('./chinese-incense')
    case 'hongsheng-red-string': return import('./hongsheng-red-string')
    case 'italian-ex-voto': return import('./italian-ex-voto')
    case 'czech-pilgrim-journal': return import('./czech-pilgrim-journal')
    case 'omikuji': return import('./omikuji')
    case 'polish-blessing-basket': return import('./polish-blessing-basket')
    case 'navruz-sumalak': return import('./navruz-sumalak')
    case 'floating-lantern-loy-krathong': return import('./floating-lantern-loy-krathong')
    case 'omamori-cycle': return import('./omamori-cycle')
    case 'shrine-suzu-bell': return import('./shrine-suzu-bell')
    case 'st-brigids-cross': return import('./st-brigids-cross')
    case 'bokjori': return import('./bokjori')
    case 'ema-votive-plaque': return import('./ema-votive-plaque')
    case 'clootie-well-rag': return import('./clootie-well-rag')
    case 'diya-oil-lamp': return import('./diya-oil-lamp')
    case 'votive-candle-catholic': return import('./votive-candle-catholic')
    case 'daruma-eye-painting': return import('./daruma-eye-painting')
    case 'mizuhiki': return import('./mizuhiki')
    case 'milagros': return import('./milagros')
    case 'phuang-malai': return import('./phuang-malai')
    case 'celtic-folk-spring':
      return import('./celtic-folk-spring')
    case 'theravada-water':
      return import('./theravada-water')
    case 'tanzaku-tanabata':
      return import('./tanzaku-tanabata')
    case 'yeondeunghoe':
      return import('./yeondeunghoe')
    case 'furin-wind-chime':
      return import('./furin-wind-chime')
    case 'shinto-torii':
      return import('./shinto-torii')
    case 'tibetan-wheel':
      return import('./tibetan-wheel')
    case 'slavic-wreath':
      return import('./slavic-wreath')
    case 'crane':
      return import('./crane')
    case 'lantern':
      return import('./lantern')
    default:
      throw new Error('scene not implemented: ' + id)
  }
}
