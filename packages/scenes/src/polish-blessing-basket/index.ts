import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createPolishBlessingBasket } from './scene'

export const meta: SceneMeta = {
  id: 'polish-blessing-basket', title: '一篮春食', traditionSlug: "polish-folk-catholic",
  grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createPolishBlessingBasket(ctx) }
const mod: SceneModule = { meta, create }
export default mod
