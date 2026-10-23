import type { SceneModule } from '../contract'
import { createMezuzah } from './scene'
export const meta: SceneModule['meta'] = { id: 'mezuzah-doorpost', title: '门柱祈安', traditionSlug: 'mezuzah-doorpost', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createMezuzah
