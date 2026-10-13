import type { SceneModule } from '../contract'
import { createLithuanianStrawGarden } from './scene'
export const meta: SceneModule['meta'] = { id: 'lithuanian-straw-garden', title: '草穗悬园', traditionSlug: 'baltic-folk', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createLithuanianStrawGarden
