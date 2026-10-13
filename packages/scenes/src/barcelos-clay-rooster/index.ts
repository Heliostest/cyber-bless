import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createBarcelosClayRooster } from './scene'
export const meta: SceneMeta = { id: 'barcelos-clay-rooster', title: '陶鸡报晓', traditionSlug: 'portuguese-romarias', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createBarcelosClayRooster(ctx) }
const mod: SceneModule = { meta, create }
export default mod
