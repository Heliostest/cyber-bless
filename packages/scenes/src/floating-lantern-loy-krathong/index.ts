import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createFloatingLantern } from './scene'

export const meta: SceneMeta = {
  id: 'floating-lantern-loy-krathong', title: '叶舟寄意', traditionSlug: 'floating-lantern-loy-krathong',
  grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'],
}
export function create(ctx: SceneContext) { return createFloatingLantern(ctx) }
const mod: SceneModule = { meta, create }
export default mod
