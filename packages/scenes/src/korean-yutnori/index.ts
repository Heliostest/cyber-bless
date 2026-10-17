import type { SceneModule } from '../contract'
import { createKoreanYutnori } from './scene'
export const meta: SceneModule['meta'] = { id: 'korean-yutnori', title: '木柶行棋', traditionSlug: 'korean-yutnori', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createKoreanYutnori
