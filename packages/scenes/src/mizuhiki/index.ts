import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createMizuhiki } from './scene'

export const meta: SceneMeta = {
  id: 'mizuhiki',
  title: '水引结愿',
  traditionSlug: 'mizuhiki',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createMizuhiki(ctx)
}

const mod: SceneModule = { meta, create }
export default mod
