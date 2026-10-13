import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createItalianExVoto } from './scene'

export const meta: SceneMeta = {
  id: 'italian-ex-voto', title: '绘牌记谢', traditionSlug: 'italian-ex-voto',
  grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createItalianExVoto(ctx) }
const mod: SceneModule = { meta, create }
export default mod
