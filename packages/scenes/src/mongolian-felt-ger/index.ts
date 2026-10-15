import type { SceneModule } from '../contract'
import { createMongolianFeltGer } from './scene'
export const meta: SceneModule['meta'] = { id: 'mongolian-felt-ger', title: '毡屋向阳', traditionSlug: 'mongolian-ger-craft', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createMongolianFeltGer
