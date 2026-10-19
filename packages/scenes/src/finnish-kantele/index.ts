import type { SceneModule } from '../contract'
import { createFinnishKantele } from './scene'
export const meta: SceneModule['meta'] = { id: 'finnish-kantele', title: '五弦轻拨', traditionSlug: 'finnish-kantele', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createFinnishKantele
