// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'

// Keep real geometry and object transforms; replace only the GPU boundary.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const drawn = vi.hoisted(() => ({ scenes: [] as THREE.Scene[] }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    drawn.scenes.push(scene)
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))

import { createFurinWindChime } from './scene'

const live: ReturnType<typeof createFurinWindChime>[] = []
beforeEach(() => {
  drawn.scenes.length = 0
  vi.spyOn(performance, 'now').mockReturnValue(0)
})
afterEach(() => {
  live.forEach((instance) => instance.dispose())
  live.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mount(initialProgress = 3, extra: Partial<SceneContext> = {}, start = true) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 520 } })
  const progress = vi.fn(), complete = vi.fn(), saveWish = vi.fn(), variant = vi.fn(), haptic = vi.fn(), prepare = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createFurinWindChime({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: progress, saveWish, onVariantChange: variant, haptic, prepareFeedback: prepare, isSoundEnabled: () => false, ...extra })
  live.push(instance)
  const scene = drawn.scenes.at(-1)!
  if (start) { instance.start(); instance.update(0) }
  complete.mockClear()
  const object = (name: string) => {
    const found = scene.getObjectByName(name)
    expect(found, `${name} is part of the actual chime`).toBeDefined()
    return found!
  }
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 1 / 60) instance.update(1 / 60)
  }
  const snapshot = () => ['furin-pivot', 'furin-clapper-pivot', ...Array.from({ length: 4 }, (_, i) => `furin-ribbon-joint-${i}`)]
    .flatMap((name) => object(name).rotation.toArray().slice(0, 3))
  const unchanged = () => {
    expect(progress).not.toHaveBeenCalled()
    expect(complete).not.toHaveBeenCalled()
    expect(saveWish).not.toHaveBeenCalled()
    expect(variant).not.toHaveBeenCalled()
    expect(haptic).not.toHaveBeenCalled()
    expect(prepare).not.toHaveBeenCalled()
  }
  return { instance, overlay, scene, object, run, snapshot, unchanged }
}

describe('completed wind chime display motion', () => {
  it('leaves audio to the host even when scene sound is enabled', () => {
    const audioContext = vi.fn(function () { throw new Error('Display motion must not request scene audio') })
    vi.stubGlobal('AudioContext', audioContext)
    vi.stubGlobal('webkitAudioContext', audioContext)
    const s = mount(3, { isSoundEnabled: () => true })
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.3)
    expect(s.object('furin-pivot').rotation.z).toBeGreaterThan(0.025)
    expect(audioContext).not.toHaveBeenCalled()
    s.unchanged()
  })

  it('swings the hanging bell with separate clapper and ribbon follow-through, then restores the exact baseline', () => {
    const s = mount(), rest = s.snapshot(), ui = s.overlay.innerHTML
    const bell = s.object('furin-bell'), before = bell.getWorldPosition(new THREE.Vector3())
    const beam = s.object('furin-eave'), beamTransform = beam.matrixWorld.clone()
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.2)
    expect(s.object('furin-pivot').rotation.z).toBeGreaterThan(0.025)
    expect(bell.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(0.01)
    expect(s.object('furin-clapper-pivot').rotation.z).toBeLessThan(0)
    expect(s.object('furin-ribbon-joint-3').rotation.z).not.toBe(rest[15])
    expect(beam.matrixWorld.elements).toEqual(beamTransform.elements)
    s.run(5)
    expect(s.snapshot()).toEqual(rest)
    expect(s.overlay.innerHTML).toBe(ui)
    s.unchanged()
  })

  it('returns to the same moving breeze as an untapped scene', () => {
    const baseline = mount(), tapped = mount()
    expect(tapped.instance.tapPreview?.()).toBe(true)
    for (let frame = 1; frame <= 300; frame++) {
      vi.mocked(performance.now).mockReturnValue(frame * 1000 / 60)
      baseline.instance.update(1 / 60)
      tapped.instance.update(1 / 60)
      if (frame === 12) expect(tapped.snapshot()).not.toEqual(baseline.snapshot())
    }
    expect(tapped.snapshot()).toEqual(baseline.snapshot())
    expect((tapped.object('furin-bell') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.emissiveIntensity)
      .toBe((baseline.object('furin-bell') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>).material.emissiveIntensity)
    tapped.unchanged()
    baseline.unchanged()
  })

  it('bounds repeated impulses and still settles after the final tap', () => {
    const s = mount(), rest = s.snapshot()
    for (let i = 0; i < 120; i++) {
      expect(s.instance.tapPreview?.()).toBe(true)
      s.instance.update(1 / 60)
      expect(Math.abs(s.object('furin-pivot').rotation.z)).toBeLessThanOrEqual(0.24)
      expect(Math.abs(s.object('furin-ribbon-joint-3').rotation.z)).toBeLessThan(0.3)
    }
    s.run(5)
    expect(s.snapshot()).toEqual(rest)
    s.unchanged()
  })

  it.each([0, 1, 2])('does not expose display motion at ritual checkpoint %i', (checkpoint) => {
    const s = mount(checkpoint), before = s.snapshot()
    expect(s.instance.tapPreview?.()).toBe(false)
    expect(s.snapshot()).toEqual(before)
    s.unchanged()
  })

  it('requires a started, live, active scene and cancels display sway when paused', () => {
    let active = true
    const s = mount(3, { isActive: () => active }, false)
    expect(s.instance.tapPreview?.()).toBe(false)
    s.instance.start(); s.instance.update(0)
    const rest = s.snapshot()
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.2)
    active = false; s.instance.update(1 / 60)
    expect(s.instance.tapPreview?.()).toBe(false)
    expect(s.snapshot()).toEqual(rest)
    active = true; s.run(0.4)
    expect(s.snapshot()).toEqual(rest)
    s.instance.dispose()
    expect(s.instance.tapPreview?.()).toBe(false)
  })

  it('handles reduced motion without an animation or a host fallback, and immediately cancels an active sway', () => {
    let reduced = true
    const s = mount(3, { isReducedMotion: () => reduced }), rest = s.snapshot()
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.5)
    expect(s.snapshot()).toEqual(rest)
    reduced = false
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.2)
    expect(s.object('furin-pivot').rotation.z).toBeGreaterThan(0.025)
    reduced = true; s.instance.update(1 / 60)
    expect(s.snapshot()).toEqual(rest)
    reduced = false; s.run(0.3)
    expect(s.object('furin-pivot').rotation.z).toBe(0)
    s.unchanged()
  })
})
