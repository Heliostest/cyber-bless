import type { SceneModule } from '../contract'
import { createValencianFoldingFan } from './scene'
export const meta: SceneModule['meta'] = { id: 'valencian-folding-fan', title: '折扇轻风', traditionSlug: 'valencian-folding-fan', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createValencianFoldingFan
