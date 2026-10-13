import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createHongshengRedString } from './scene'

export const meta: SceneMeta = {
  id: 'hongsheng-red-string', title: '红绳自持', traditionSlug: 'hongsheng-red-string',
  grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createHongshengRedString(ctx) }
const mod: SceneModule = { meta, create }
export default mod
