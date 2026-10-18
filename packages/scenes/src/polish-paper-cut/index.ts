import type { SceneModule } from '../contract'
import { createPolishPaperCut } from './scene'

export const meta: SceneModule['meta'] = { id: 'polish-paper-cut', title: '剪纸开花', traditionSlug: "polish-wycinanki", grade: 'C', sensitivity: '低', gestures: ['drag', 'wishWrite'] }
export const create = createPolishPaperCut
