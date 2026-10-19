import type { SceneModule } from '../contract'
import { createGhanaianOware } from './scene'
export const meta: SceneModule['meta'] = { id: 'ghanaian-oware', title: '木窝播籽', traditionSlug: 'ghanaian-oware', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createGhanaianOware
