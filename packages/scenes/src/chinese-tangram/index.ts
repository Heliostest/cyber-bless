import type { SceneModule } from '../contract'
import { createChineseTangram } from './scene'
export const meta: SceneModule['meta'] = { id: 'chinese-tangram', title: '七巧归方', traditionSlug: 'chinese-tangram', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createChineseTangram
