import type { SceneModule } from '../contract'
import { createEnglishHearthBellows } from './scene'
export const meta: SceneModule['meta'] = { id: 'english-hearth-bellows', title: '风囊轻送', traditionSlug: 'english-hearth-bellows', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createEnglishHearthBellows
