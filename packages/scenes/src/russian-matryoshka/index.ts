import type { SceneModule } from '../contract'
import { createRussianMatryoshka } from './scene'
export const meta: SceneModule['meta'] = { id: 'russian-matryoshka', title: '套娃相藏', traditionSlug: 'russian-matryoshka', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createRussianMatryoshka
