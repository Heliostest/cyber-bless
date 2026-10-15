import type { SceneModule } from '../contract'
import { createTurkishEbruPaper } from './scene'
export const meta: SceneModule['meta'] = { id: 'turkish-ebru-paper', title: '浮彩成笺', traditionSlug: 'turkish-ebru', grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createTurkishEbruPaper
