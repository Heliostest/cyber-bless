import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createFinnishBirchBasket } from './scene'

export const meta: SceneMeta = {
  id: 'finnish-birch-basket', title: '桦篮拾光', traditionSlug: 'finnish-karelian-folk',
  grade: 'C', sensitivity: '中', gestures: ['drag'],
}
export function create(ctx: SceneContext) { return createFinnishBirchBasket(ctx) }
const mod: SceneModule = { meta, create }
export default mod
