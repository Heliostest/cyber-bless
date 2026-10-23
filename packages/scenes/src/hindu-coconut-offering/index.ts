import type { SceneModule } from '../contract'
import { createCoconutOffering } from './scene'
export const meta: SceneModule['meta'] = { id: 'hindu-coconut-offering', title: '椰果献愿', traditionSlug: 'hindu-coconut-offering', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createCoconutOffering
