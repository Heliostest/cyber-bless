import type { SceneModule } from '../contract'
import { createWeifangPaperKite } from './scene'

export const meta: SceneModule['meta'] = { id: 'weifang-paper-kite', title: '纸鸢乘风', traditionSlug: "weifang-kite-craft", grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createWeifangPaperKite
