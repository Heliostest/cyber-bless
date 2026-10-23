import { describe, it, expect } from 'vitest'
import { builtInScenes, BLESSING_SCENE_IDS, isSceneVisibleInApp } from '@wbr/core/daily-scenes'
import { sceneIntention } from '../../../core/src/scene-intentions'
import { sceneRegistry, loadScene } from '../registry'

describe('Didukh host identity', () => {
  it('offers a visible blessing with dedicated provenance and no compulsory writing', () => {
    const entry = builtInScenes.find(scene => scene.id === 'ukrainian-didukh')
    expect(entry).toMatchObject({ title: '迪杜赫麦束', engine: 'ukrainian-didukh@1', traditionSlug: 'ukrainian-didukh' })
    expect(isSceneVisibleInApp(entry!)).toBe(true)
    expect(BLESSING_SCENE_IDS).toContain('ukrainian-didukh')
    expect(sceneIntention('ukrainian-didukh')).toMatchObject({ kind: 'blessing', optionalWish: false })
  })

  it('loads a module with matching source and drag metadata', async () => {
    const loaded = await loadScene('ukrainian-didukh')
    expect(loaded.meta).toEqual(sceneRegistry.find(scene => scene.id === 'ukrainian-didukh'))
    expect(loaded.meta).toMatchObject({ grade: 'C', sensitivity: '中', gestures: ['drag'] })
    expect(typeof loaded.create).toBe('function')
  })
})
