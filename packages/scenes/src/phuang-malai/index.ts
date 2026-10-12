import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createPhuangMalai } from './scene'

export const meta: SceneMeta = {
  id: 'phuang-malai',
  title: '串花寄意',
  traditionSlug: 'phuang-malai',
  grade: 'C',
  sensitivity: '中',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createPhuangMalai(ctx)
}

const mod: SceneModule = { meta, create }
export default mod
