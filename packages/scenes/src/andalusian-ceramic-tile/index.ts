import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createAndalusianCeramicTile } from './scene'
export const meta: SceneMeta = { id: 'andalusian-ceramic-tile', title: '釉彩映晴', traditionSlug: "andalusian-ceramic-tile", grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createAndalusianCeramicTile(ctx) }
const mod: SceneModule = { meta, create }
export default mod
