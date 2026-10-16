import type { SceneModule } from '../contract'
import { createGermanNutcracker } from './scene'
export const meta: SceneModule['meta'] = { id: 'german-nutcracker', title: '木偶开果', traditionSlug: 'erzgebirge-nutcracker-craft', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createGermanNutcracker
