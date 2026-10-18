import { PRODUCT_ORIGINAL } from '../registry'
import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createCelticFolkSpring } from './scene'

export const meta: SceneMeta = {
  id: 'celtic-folk-spring',
  title: '泉边一念',
  traditionSlug: PRODUCT_ORIGINAL,
  grade: 'C',
  sensitivity: '低',
  gestures: ['gyro', 'drag', 'wishWrite'],
}

export function create(ctx: SceneContext) {
  return createCelticFolkSpring(ctx)
}

const mod: SceneModule = { meta, create }
export default mod
