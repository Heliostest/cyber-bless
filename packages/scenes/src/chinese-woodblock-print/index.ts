import type { SceneModule } from '../contract'
import { createChineseWoodblockPrint } from './scene'
export const meta: SceneModule['meta'] = { id: 'chinese-woodblock-print', title: '木版留春', traditionSlug: 'chinese-folk-and-confucian', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createChineseWoodblockPrint
