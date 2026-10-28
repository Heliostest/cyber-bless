import { describe, expect, it } from 'vitest'
import { BLESSING_SCENE_IDS, WISH_SCENE_IDS, builtInScenes, isSceneVisibleInApp } from '@wbr/core/daily-scenes'
import { sceneIntention } from '../../../core/src/scene-intentions'
import { loadScene, sceneRegistry } from '../registry'

describe('Bodhi water-offering identity', () => {
  it('opens as a visible blessing with its own source and no compulsory writing', () => {
    const entry = builtInScenes.find(scene => scene.id === 'sri-lankan-bodhi-puja')!
    expect(entry).toMatchObject({ title: '菩提供水', engine: 'sri-lankan-bodhi-puja@1', traditionSlug: 'sri-lankan-bodhi-puja' })
    expect(isSceneVisibleInApp(entry)).toBe(true)
    expect(BLESSING_SCENE_IDS).toContain(entry.id)
    expect(WISH_SCENE_IDS).not.toContain(entry.id)
    expect(sceneIntention(entry.id)).toMatchObject({ kind: 'blessing', optionalWish: false })
    expect(entry.narrative).toContain('佛陀觉悟')
    expect(entry.narrative).toContain('倾')
    expect(entry.narrative).not.toMatch(/三段|产品|必定|保证|阿努拉达普拉/)
  })
  it('loads the real module with matching dedicated provenance', async () => {
    const loaded = await loadScene('sri-lankan-bodhi-puja')
    expect(loaded.meta).toEqual(sceneRegistry.find(scene => scene.id === 'sri-lankan-bodhi-puja'))
    expect(loaded.meta).toMatchObject({ grade: 'C', sensitivity: '中', gestures: ['drag'] })
    expect(typeof loaded.create).toBe('function')
  })
})
