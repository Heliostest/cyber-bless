import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createDiyaOilLamp } from './scene'

export const meta: SceneMeta = {
  id: 'diya-oil-lamp',
  title: '灯旋一瞥',
  traditionSlug: "diya-oil-lamp",
  grade: 'C',
  sensitivity: '中',
  gestures: ['drag', 'spin'],
}

export function create(ctx: SceneContext) { return createDiyaOilLamp(ctx) }
const mod: SceneModule = { meta, create }
export default mod
