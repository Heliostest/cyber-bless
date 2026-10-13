import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createBasqueSunflower } from './scene'

export const meta: SceneMeta = {
  id: 'basque-sunflower', title: '太阳花迎门', traditionSlug: 'basque-folk',
  grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createBasqueSunflower(ctx) }
const mod: SceneModule = { meta, create }
export default mod
