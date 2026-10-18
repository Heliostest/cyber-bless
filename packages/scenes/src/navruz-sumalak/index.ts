import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createNavruzSumalak } from './scene'

export const meta: SceneMeta = {
  id: 'navruz-sumalak', title: '春锅共煮', traditionSlug: "uzbek-sumalak-cooking",
  grade: 'C', sensitivity: '中', gestures: ['drag'],
}
export function create(ctx: SceneContext) { return createNavruzSumalak(ctx) }
const mod: SceneModule = { meta, create }
export default mod
