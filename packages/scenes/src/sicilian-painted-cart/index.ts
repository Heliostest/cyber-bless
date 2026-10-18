import type { SceneModule } from '../contract'
import { createSicilianPaintedCart } from './scene'

export const meta: SceneModule['meta'] = { id: 'sicilian-painted-cart', title: '彩车迎晴', traditionSlug: "sicilian-carretto-craft", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createSicilianPaintedCart
export { createSicilianPaintedCart }
