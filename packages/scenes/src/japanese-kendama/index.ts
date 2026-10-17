import type { SceneModule } from '../contract'
import { createJapaneseKendama } from './scene'
export const meta: SceneModule['meta'] = { id: 'japanese-kendama', title: '剑玉轻接', traditionSlug: 'japanese-kendama-craft', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createJapaneseKendama
