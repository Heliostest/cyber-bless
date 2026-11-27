// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'

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

const built = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    built.scene = scene
    built.camera = camera
    return {
      setStyle() {},
      resize() {},
      dispose() {},
      render() {
        scene.updateMatrixWorld(true)
        camera.updateMatrixWorld(true)
      },
    }
  },
}))

import { create } from './index'

const instances: SceneInstance[] = []

function mount(initialProgress = 0, extra: Partial<SceneContext> = {}) {
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 520 }) as DOMRect
  document.body.append(canvas, overlay)
  const progress: number[] = []
  const instance = create({
    canvas,
    overlay,
    initialProgress,
    gestures: Gestures,
    shared: Shared,
    onProgress: (n) => progress.push(n),
    isSoundEnabled: () => false,
    ...extra,
  })
  instances.push(instance)
  instance.start()
  instance.update(0.05)
  return { instance, overlay, canvas, progress, scene: built.scene! }
}

afterEach(() => {
  for (const inst of instances.splice(0)) inst.dispose()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('Slavic Kupala wreath botanical craft', () => {
  it('builds leaves and blossoms with clone-preserving botanical shaders', () => {
    const s = mount(1, { isReducedMotion: () => true })
    const wreath = s.scene.getObjectByName('slavic-wreath')!
    expect(wreath).toBeDefined()

    let leafCount = 0
    let daisyCount = 0
    let poppyCount = 0
    let cornflowerCount = 0

    wreath.traverse((obj) => {
      if (obj.name.startsWith('wreath-leaf-')) leafCount++
      if (obj.name === 'wreath-daisy') daisyCount++
      if (obj.name === 'wreath-poppy') poppyCount++
      if (obj.name === 'wreath-cornflower') cornflowerCount++
      if (!(obj instanceof THREE.Mesh)) return
      const mat = obj.material as THREE.MeshStandardMaterial
      expect(mat.side, obj.name || 'wreath-mesh').toBe(THREE.FrontSide)
      if (mat.customProgramCacheKey().includes('wbr-slavic-botanical-v1')) {
        const cloned = mat.clone()
        expect(cloned.customProgramCacheKey()).toContain('wbr-slavic-botanical-v1')
        cloned.dispose()
      }
    })

    expect(leafCount).toBe(18)
    expect(daisyCount).toBe(5)
    expect(poppyCount).toBe(3)
    expect(cornflowerCount).toBe(3)
  })

  it('keeps weave setDrawRange at progress=0 and reveals all blooms at progress=1', () => {
    const s0 = mount(0, { isReducedMotion: () => true })
    const stem0 = s0.scene.getObjectByName('wreath-stem-0') as THREE.Mesh
    const total0 = stem0.geometry.index!.count
    expect(stem0.geometry.drawRange.count).toBeLessThan(total0 * 0.4)
    expect(s0.scene.getObjectByName('wreath-leaf-0')!.visible).toBe(false)
    expect(s0.scene.getObjectByName('wreath-daisy')!.visible).toBe(false)

    const s1 = mount(1, { isReducedMotion: () => true })
    const stem1 = s1.scene.getObjectByName('wreath-stem-0') as THREE.Mesh
    expect(stem1.geometry.drawRange.count).toBe(stem1.geometry.index!.count)
    expect(s1.scene.getObjectByName('wreath-leaf-0')!.visible).toBe(true)
    expect(s1.scene.getObjectByName('wreath-daisy')!.visible).toBe(true)
    expect(s1.scene.getObjectByName('wreath-poppy')!.visible).toBe(true)
    expect(s1.scene.getObjectByName('wreath-cornflower')!.visible).toBe(true)
  })

  it('disposes all wreath geometries and materials cleanly on idempotent disposal', () => {
    const s = mount(1, { isReducedMotion: () => true })
    const resources = new Set<{ dispose(): void }>()
    const wreath = s.scene.getObjectByName('slavic-wreath')!
    wreath.traverse((obj) => {
      if (!(obj instanceof THREE.Mesh)) return
      resources.add(obj.geometry)
      resources.add(obj.material as THREE.Material)
    })
    const spies = [...resources].map((r) => vi.spyOn(r, 'dispose'))
    s.instance.dispose()
    s.instance.dispose()
    for (const spy of spies) expect(spy).toHaveBeenCalledTimes(1)
  })
})
