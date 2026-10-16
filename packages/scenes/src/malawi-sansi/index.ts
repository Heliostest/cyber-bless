import type { SceneModule } from '../contract'
import { createMalawiSansi } from './scene'
export const meta: SceneModule['meta'] = { id: 'malawi-sansi', title: '铁舌轻鸣', traditionSlug: 'mbira-sansi-craft', grade: 'C', sensitivity: '中', gestures: ['drag'] }
export const create = createMalawiSansi
