import { PRODUCT_ORIGINAL } from '../registry'
import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createCzechPilgrimJournal } from './scene'

export const meta: SceneMeta = { id: 'czech-pilgrim-journal', title: '旅途一页', traditionSlug: PRODUCT_ORIGINAL, grade: 'C', sensitivity: '低', gestures: ['drag'] }
export function create(ctx: SceneContext) { return createCzechPilgrimJournal(ctx) }
const mod: SceneModule = { meta, create }
export default mod
