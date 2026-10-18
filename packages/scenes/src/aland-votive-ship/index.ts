import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createAlandVotiveShip } from './scene'
export const meta: SceneMeta = {
  id: 'aland-votive-ship', title: '舟模寄谢', traditionSlug: "aland-votive-ship",
  grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createAlandVotiveShip(ctx) }
const mod: SceneModule = { meta, create }
export default mod
