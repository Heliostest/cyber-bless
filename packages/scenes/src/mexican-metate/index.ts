import type { SceneModule } from '../contract'
import { createMexicanMetate } from './scene'
export const meta: SceneModule['meta'] = { id: 'mexican-metate', title: '石面磨香', traditionSlug: 'mexican-metate', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createMexicanMetate
