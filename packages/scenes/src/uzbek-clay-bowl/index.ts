import type { SceneModule } from '../contract'
import { createUzbekClayBowl } from './scene'

export const meta: SceneModule['meta'] = { id: 'uzbek-clay-bowl', title: '陶轮慢成', traditionSlug: 'uzbek-folk', grade: 'C', sensitivity: '低', gestures: ['drag', 'spin'] }
export const create = createUzbekClayBowl
