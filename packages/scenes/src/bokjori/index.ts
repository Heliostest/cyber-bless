import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createBokjori } from './scene'

export const meta: SceneMeta = {
  id: 'bokjori',
  title: '竹筛迎岁',
  traditionSlug: 'bokjori',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag'],
}

export function create(ctx: SceneContext) { return createBokjori(ctx) }
const mod: SceneModule = { meta, create }
export default mod
