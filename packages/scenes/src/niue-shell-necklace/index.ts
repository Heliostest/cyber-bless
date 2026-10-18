import type { SceneModule } from '../contract'
import { createNiueShellNecklace } from './scene'
export const meta: SceneModule['meta'] = { id: 'niue-shell-necklace', title: '贝链留光', traditionSlug: "niue-kahoa-hihi", grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createNiueShellNecklace
