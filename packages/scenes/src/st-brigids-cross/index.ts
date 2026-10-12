import type { SceneContext, SceneModule } from '../contract'
import { createBrigidsCross } from './scene'
export const meta: SceneModule['meta'] = { id: 'st-brigids-cross', title: '草编迎春', traditionSlug: 'st-brigids-cross', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export function create(ctx: SceneContext) { return createBrigidsCross(ctx) }
export default { meta, create } satisfies SceneModule
