import type { SceneMeta } from '@wbr/shared'
import type { SceneContext } from '../contract'
import { createMilagros } from './scene'
export const meta: SceneMeta = {
  id: 'milagros', title: '留一枚感谢', traditionSlug: 'milagros', grade: 'C',
  sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export const create = (ctx: SceneContext) => createMilagros(ctx)
export default { meta, create }
