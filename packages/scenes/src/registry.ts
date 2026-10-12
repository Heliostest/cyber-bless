import type { SceneMeta } from '@wbr/shared'
import type { SceneModule } from './contract'

/**
 * Slug for product-original scenes (crane, lantern) that do not represent a
 * specific religious or folk tradition; there is intentionally no
 * content/traditions card for it.
 */
export const PRODUCT_ORIGINAL = 'product-original'

export const sceneRegistry: SceneMeta[] = [
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
