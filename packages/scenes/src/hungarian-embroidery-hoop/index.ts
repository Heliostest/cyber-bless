import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createHungarianEmbroideryHoop } from './scene'
export const meta: SceneMeta = { id: 'hungarian-embroidery-hoop', title: '花绣寄语', traditionSlug: 'hungarian-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createHungarianEmbroideryHoop(ctx) }
const mod: SceneModule = { meta, create }
export default mod
