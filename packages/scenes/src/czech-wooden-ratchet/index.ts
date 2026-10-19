import type { SceneModule } from '../contract'
import { createCzechWoodenRatchet } from './scene'
export const meta: SceneModule['meta'] = { id: 'czech-wooden-ratchet', title: '木齿轻转', traditionSlug: 'czech-wooden-ratchet', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createCzechWoodenRatchet
