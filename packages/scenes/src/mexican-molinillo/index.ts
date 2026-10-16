import type { SceneModule } from '../contract'
import { createMexicanMolinillo } from './scene'
export const meta: SceneModule['meta'] = { id: 'mexican-molinillo', title: '木旋起沫', traditionSlug: 'molinillo-chocolate-craft', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createMexicanMolinillo
