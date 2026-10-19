import type { SceneModule } from '../contract'
import { createPuertoRicanGuiro } from './scene'
export const meta: SceneModule['meta'] = { id: 'puerto-rican-guiro', title: '瓜棱轻奏', traditionSlug: 'puerto-rican-guiro', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createPuertoRicanGuiro
