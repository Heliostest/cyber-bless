import type { SceneModule } from '../contract'
import { createVotiveCandleCatholic } from './scene'
export const meta: SceneModule['meta'] = { id: 'votive-candle-catholic', title: '留一盏烛光', traditionSlug: 'votive-candle-catholic', grade: 'C', sensitivity: '中', gestures: ['drag','wishWrite'] }
export const create = createVotiveCandleCatholic
