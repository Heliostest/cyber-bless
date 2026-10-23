import type { SceneModule } from '../contract'
import { createDidukh } from './scene'
export const meta: SceneModule['meta'] = { id: 'ukrainian-didukh', title: '迪杜赫麦束', traditionSlug: 'ukrainian-didukh', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createDidukh
