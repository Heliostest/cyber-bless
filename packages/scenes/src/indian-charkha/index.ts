import type { SceneModule } from '../contract'
import { createIndianCharkha } from './scene'
export const meta: SceneModule['meta'] = { id: 'indian-charkha', title: '棉线慢成', traditionSlug: 'indian-charkha-craft', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createIndianCharkha
