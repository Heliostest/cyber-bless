import type { SceneModule } from '../contract'
import { createFijianWovenFan } from './scene'
export const meta: SceneModule['meta'] = { id: 'fijian-woven-fan', title: '叶扇纳凉', traditionSlug: 'fijian-vanua', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createFijianWovenFan
