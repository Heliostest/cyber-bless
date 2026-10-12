import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createEmaVotivePlaque } from './scene'

export const meta: SceneMeta = {
  id: 'ema-votive-plaque',
  title: '木牌记愿',
  traditionSlug: 'ema-votive-plaque',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createEmaVotivePlaque(ctx)
}

const mod: SceneModule = { meta, create }
export default mod
