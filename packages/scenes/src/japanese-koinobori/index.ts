import type { SceneModule } from '../contract'
import { createJapaneseKoinobori } from './scene'
export const meta: SceneModule['meta'] = { id: 'japanese-koinobori', title: '鲤旗迎风', traditionSlug: 'japanese-koinobori', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createJapaneseKoinobori
