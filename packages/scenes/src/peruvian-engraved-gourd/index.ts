import type { SceneModule } from '../contract'
import { createPeruvianEngravedGourd } from './scene'
export const meta: SceneModule['meta'] = { id: 'peruvian-engraved-gourd', title: '葫芦刻光', traditionSlug: 'peruvian-mate-burilado', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createPeruvianEngravedGourd
