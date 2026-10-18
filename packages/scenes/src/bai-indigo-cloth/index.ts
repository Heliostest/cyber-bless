import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createBaiIndigoCloth } from './scene'
export const meta: SceneMeta = { id: 'bai-indigo-cloth', title: '蓝白晾晴', traditionSlug: "bai-tie-dye", grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createBaiIndigoCloth(ctx) }
const mod: SceneModule = { meta, create }
export default mod
