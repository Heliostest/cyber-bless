import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createOmamoriCycle } from './scene'

export const meta: SceneMeta = {
  id: 'omamori-cycle', title: '御守伴行', traditionSlug: "omamori-cycle",
  grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createOmamoriCycle(ctx) }
const mod: SceneModule = { meta, create }
export default mod
