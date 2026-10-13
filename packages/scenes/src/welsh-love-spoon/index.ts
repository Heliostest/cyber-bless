import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createWelshLoveSpoon } from './scene'
export const meta: SceneMeta = { id: 'welsh-love-spoon', title: '木勺寄情', traditionSlug: 'welsh-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createWelshLoveSpoon(ctx) }
const mod: SceneModule = { meta, create }
export default mod
