import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createBlangTea } from './scene'
export { createBlangTea } from './scene'
export const meta: SceneMeta = { id: 'blang-tea', title: '茶山一盏', traditionSlug: "jingmai-tea-forest", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export function create(ctx: SceneContext) { return createBlangTea(ctx) }
const mod: SceneModule = { meta, create }
export default mod
