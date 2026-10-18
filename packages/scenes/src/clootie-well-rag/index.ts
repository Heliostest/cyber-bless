import type { SceneMeta } from '@wbr/shared'
import type { SceneContext, SceneModule } from '../contract'
import { createClootieWellRag } from './scene'

export const meta: SceneMeta = {
  id: 'clootie-well-rag',
  title: '井边放下',
  traditionSlug: "clootie-well-rag",
  grade: 'C',
  sensitivity: '中',
  gestures: ['drag'],
}

export function create(ctx: SceneContext) { return createClootieWellRag(ctx) }

const mod: SceneModule = { meta, create }
export default mod
