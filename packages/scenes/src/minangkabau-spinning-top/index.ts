import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createMinangkabauSpinningTop } from './scene'
export const meta: SceneMeta = {
  id: 'minangkabau-spinning-top', title: '归乡轻转', traditionSlug: 'minangkabau-adat',
  grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createMinangkabauSpinningTop(ctx) }
const mod: SceneModule = { meta, create }
export default mod
