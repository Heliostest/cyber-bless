import type { SceneModule } from '../contract'
import { createEstonianVillageSwing } from './scene'
export const meta: SceneModule['meta'] = { id: 'estonian-village-swing', title: '秋千轻荡', traditionSlug: 'estonian-village-swing', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createEstonianVillageSwing
