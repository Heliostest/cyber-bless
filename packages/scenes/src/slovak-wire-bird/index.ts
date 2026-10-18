import type { SceneModule } from '../contract'
import { createSlovakWireBird } from './scene'

export const meta: SceneModule['meta'] = { id: 'slovak-wire-bird', title: '铁线栖鸟', traditionSlug: "slovak-wire-craft", grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createSlovakWireBird
