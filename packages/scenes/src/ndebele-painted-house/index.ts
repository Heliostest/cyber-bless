import type { SceneModule } from '../contract'
import { createNdebelePaintedHouse } from './scene'

export const meta: SceneModule['meta'] = { id: 'ndebele-painted-house', title: '彩墙寄家', traditionSlug: "ndebele-wall-painting", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createNdebelePaintedHouse
