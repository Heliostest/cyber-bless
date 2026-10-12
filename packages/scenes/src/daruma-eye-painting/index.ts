import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createDarumaEyePainting } from './scene'

export const meta: SceneMeta = {
  id: 'daruma-eye-painting',
  title: '达摩点睛',
  traditionSlug: 'daruma-eye-painting',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createDarumaEyePainting(ctx)
}

const mod: SceneModule = { meta, create }
export default mod
