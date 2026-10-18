import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createCrane } from './scene'

export const meta: SceneMeta = {
  id: 'crane',
  title: '折一只纸鹤',
  traditionSlug: "origami-crane-senbazuru",
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createCrane(ctx)
}

const mod: SceneModule = { meta, create }
export default mod
