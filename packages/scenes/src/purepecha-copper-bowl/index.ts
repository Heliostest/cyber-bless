import type { SceneModule } from '../contract'
import { createPurepechaCopperBowl } from './scene'
export { createPurepechaCopperBowl } from './scene'
export const meta: SceneModule['meta'] = { id: 'purepecha-copper-bowl', title: '铜碗拾暖', traditionSlug: "santa-clara-copper-craft", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createPurepechaCopperBowl
