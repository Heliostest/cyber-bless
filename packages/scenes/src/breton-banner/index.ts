import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createBretonBanner } from './scene'
export const meta: SceneMeta = { id: 'breton-banner', title: '节旗轻展', traditionSlug: "breton-pardons", grade: 'C', sensitivity: '低', gestures: ['drag'] }
export function create(ctx: SceneContext) { return createBretonBanner(ctx) }
const mod: SceneModule = { meta, create }
export default mod
