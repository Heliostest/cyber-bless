import type { SceneModule } from '../contract'
import { createBodhiPuja } from './scene'
export const meta: SceneModule['meta'] = { id: 'sri-lankan-bodhi-puja', title: '菩提供水', traditionSlug: 'sri-lankan-bodhi-puja', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createBodhiPuja
