import type { SceneModule } from '../contract'
import { createVenetianGlassBead } from './scene'

export const meta: SceneModule['meta'] = { id: 'venetian-glass-bead', title: '玻珠凝彩', traditionSlug: 'italian-glass-beads', grade: 'C', sensitivity: '低', gestures: ['drag'] }
export const create = createVenetianGlassBead
