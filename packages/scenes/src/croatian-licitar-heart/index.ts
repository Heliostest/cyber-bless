import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createCroatianLicitarHeart } from './scene'
export const meta: SceneMeta = { id: 'croatian-licitar-heart', title: '彩心相赠', traditionSlug: "croatian-licitar", grade: 'C', sensitivity: '中', gestures: ['drag', 'wishWrite'] }
export function create(ctx: SceneContext) { return createCroatianLicitarHeart(ctx) }
const mod: SceneModule = { meta, create }
export default mod
