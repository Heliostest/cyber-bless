import type { SceneModule } from '../contract'
import { createFaroeseWoolKnit } from './scene'

export const meta: SceneModule['meta'] = { id: 'faroese-wool-knit', title: '毛线织暖', traditionSlug: 'faroese-folk', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createFaroeseWoolKnit
