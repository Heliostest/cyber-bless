import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createSorbianPaintedEgg } from './scene'
export const meta: SceneMeta = { id: 'sorbian-painted-egg', title: '彩蛋寄春', traditionSlug: 'sorbian-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createSorbianPaintedEgg(ctx) }
const mod: SceneModule = { meta, create }
export default mod
