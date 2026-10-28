import { describe, it, expect } from 'vitest'
import { builtInScenes, BLESSING_SCENE_IDS, isSceneVisibleInApp } from '@wbr/core/daily-scenes'
import { sceneIntention } from '../../../core/src/scene-intentions'
import { sceneRegistry, loadScene } from '../registry'

describe('Mezuzah doorpost host identity', () => {
  it('offers the prepared mezuzah case as a visible blessing without writing', () => {
    const entry = builtInScenes.find(scene => scene.id === 'mezuzah-doorpost')
    expect(entry).toMatchObject({ title: '门柱祈安', engine: 'mezuzah-doorpost@1', traditionSlug: 'mezuzah-doorpost' })
    expect(isSceneVisibleInApp(entry!)).toBe(true)
    expect(BLESSING_SCENE_IDS).toContain('mezuzah-doorpost')
    expect(sceneIntention('mezuzah-doorpost')).toMatchObject({ kind: 'blessing', optionalWish: false })
  })

  it('loads a module with the same dedicated source and drag contract', async () => {
    const loaded = await loadScene('mezuzah-doorpost')
    expect(loaded.meta).toEqual(sceneRegistry.find(scene => scene.id === 'mezuzah-doorpost'))
    expect(loaded.meta).toMatchObject({ grade: 'C', sensitivity: '中', gestures: ['drag'] })
    expect(typeof loaded.create).toBe('function')
  })
})
