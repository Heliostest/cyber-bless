import type { SceneModule } from '../contract'
import { createChineseDiabolo } from './scene'
export const meta: SceneModule['meta'] = { id: 'chinese-diabolo', title: '空竹轻扬', traditionSlug: 'chinese-diabolo', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createChineseDiabolo
