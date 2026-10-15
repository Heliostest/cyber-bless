import type { SceneModule } from '../contract'
import { createVietnameseBambooDragonfly } from './scene'
export const meta: SceneModule['meta'] = { id: 'vietnamese-bamboo-dragonfly', title: '竹蜓点风', traditionSlug: 'thach-xa-bamboo-dragonfly', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createVietnameseBambooDragonfly
