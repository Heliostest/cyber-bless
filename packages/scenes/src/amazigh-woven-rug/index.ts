import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createAmazighWovenRug } from './scene'
export const meta: SceneMeta = { id: 'amazigh-woven-rug', title: '织毯寄暖', traditionSlug: 'amazigh-berber', grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createAmazighWovenRug(ctx) }
const mod: SceneModule = { meta, create }
export default mod
