import type { SceneModule } from '../contract'
import { createLaoBaciWrist } from './scene'
export const meta: SceneModule['meta'] = { id: 'lao-baci-wrist', title: '白线祝归', traditionSlug: 'lao-baci-phi', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createLaoBaciWrist
