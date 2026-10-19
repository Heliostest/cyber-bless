import type { SceneModule } from '../contract'
import { createChineseRattleDrum } from './scene'
export const meta: SceneModule['meta'] = { id: 'chinese-rattle-drum', title: '拨浪轻响', traditionSlug: 'chinese-rattle-drum', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createChineseRattleDrum
