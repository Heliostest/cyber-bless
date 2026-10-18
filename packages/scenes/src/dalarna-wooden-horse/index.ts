import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createDalarnaWoodenHorse } from './scene'
export const meta: SceneMeta = { id: 'dalarna-wooden-horse', title: '木马安放', traditionSlug: "dalarna-wooden-horse", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export function create(ctx: SceneContext) { return createDalarnaWoodenHorse(ctx) }
const mod: SceneModule = { meta, create }
export default mod
