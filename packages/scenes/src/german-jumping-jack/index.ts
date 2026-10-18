import type { SceneModule } from '../contract'
import { createGermanJumpingJack } from './scene'
export const meta: SceneModule['meta'] = { id: 'german-jumping-jack', title: '牵绳木偶', traditionSlug: 'german-jumping-jack', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createGermanJumpingJack
