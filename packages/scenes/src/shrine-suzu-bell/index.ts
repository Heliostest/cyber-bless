import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createShrineSuzuBell } from './scene'

export const meta: SceneMeta = {
  id: 'shrine-suzu-bell',
  title: '庭前一铃',
  traditionSlug: 'shrine-suzu-bell',
  grade: 'C',
  sensitivity: '低',
  gestures: ['drag'],
}

export function create(ctx: SceneContext) { return createShrineSuzuBell(ctx) }
const mod: SceneModule = { meta, create }
export default mod
