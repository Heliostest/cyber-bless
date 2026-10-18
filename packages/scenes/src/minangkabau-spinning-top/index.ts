import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { PRODUCT_ORIGINAL } from '../registry'
import { createMinangkabauSpinningTop } from './scene'
export const meta: SceneMeta = {
  id: 'minangkabau-spinning-top', title: '木陀轻转', traditionSlug: PRODUCT_ORIGINAL,
  grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createMinangkabauSpinningTop(ctx) }
const mod: SceneModule = { meta, create }
export default mod
