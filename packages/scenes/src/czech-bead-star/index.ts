import type { SceneModule } from '../contract'
import { createCzechBeadStar } from './scene'
export const meta: SceneModule['meta'] = { id: 'czech-bead-star', title: '珠星映光', traditionSlug: "czech-glass-bead-ornaments", grade: 'C', sensitivity: '低', gestures: ['drag', 'spin'] }
export const create = createCzechBeadStar
