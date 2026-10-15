import type { SceneModule } from '../contract'
import { createKoreanBojagiWrap } from './scene'

export const meta: SceneModule['meta'] = { id: 'korean-bojagi-wrap', title: '方巾裹礼', traditionSlug: 'korean-bojagi', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createKoreanBojagiWrap
