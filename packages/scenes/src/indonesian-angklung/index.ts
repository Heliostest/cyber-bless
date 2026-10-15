import type { SceneModule } from '../contract'
import { createIndonesianAngklung } from './scene'
export const meta: SceneModule['meta'] = { id: 'indonesian-angklung', title: '竹音轻摇', traditionSlug: 'indonesian-angklung', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createIndonesianAngklung
