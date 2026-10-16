import type { SceneModule } from '../contract'
import { createChineseSuanpan } from './scene'
export const meta: SceneModule['meta'] = { id: 'chinese-suanpan', title: '拨珠见数', traditionSlug: 'chinese-zhusuan', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createChineseSuanpan
