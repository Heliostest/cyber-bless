import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createChineseIncense } from './scene'

export const meta: SceneMeta = {
  id: 'chinese-incense', title: '炉前一炷', traditionSlug: 'chinese-folk-and-confucian',
  grade: 'C', sensitivity: '低', gestures: ['drag'],
}
export function create(ctx: SceneContext) { return createChineseIncense(ctx) }
const mod: SceneModule = { meta, create }
export default mod
