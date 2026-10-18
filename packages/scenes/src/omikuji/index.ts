import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createOmikuji } from './scene'

export const meta: SceneMeta = {
  id: 'omikuji', title: '签纸慢读', traditionSlug: "omikuji",
  grade: 'C', sensitivity: '中', gestures: ['drag'],
}
export function create(ctx: SceneContext) { return createOmikuji(ctx) }
const mod: SceneModule = { meta, create }
export default mod
