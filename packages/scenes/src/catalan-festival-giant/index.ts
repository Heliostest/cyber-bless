import type { SceneModule } from '../contract'
import { createCatalanFestivalGiant } from './scene'
export const meta: SceneModule['meta'] = { id: 'catalan-festival-giant', title: '巨偶待游', traditionSlug: "catalan-gegants", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createCatalanFestivalGiant
