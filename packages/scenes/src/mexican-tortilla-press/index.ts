import type { SceneModule } from '../contract'
import { createMexicanTortillaPress } from './scene'
export const meta: SceneModule['meta'] = { id: 'mexican-tortilla-press', title: '木压成圆', traditionSlug: 'mexican-tortilla-press', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createMexicanTortillaPress
