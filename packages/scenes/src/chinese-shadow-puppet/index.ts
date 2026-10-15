import type { SceneModule } from '../contract'
import { createChineseShadowPuppet } from './scene'
export const meta: SceneModule['meta'] = { id: 'chinese-shadow-puppet', title: '影偶小戏', traditionSlug: 'chinese-folk-and-confucian', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createChineseShadowPuppet
