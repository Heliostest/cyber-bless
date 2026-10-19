import type { SceneModule } from '../contract'
import { createFrenchPetanque } from './scene'
export const meta: SceneModule['meta'] = { id: 'french-petanque', title: '银球近靶', traditionSlug: 'french-petanque', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createFrenchPetanque
