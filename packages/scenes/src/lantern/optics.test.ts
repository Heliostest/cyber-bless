// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import { createLantern } from './scene'
import type { SceneContext } from '../contract'

// Keep the real scene graph and materials; jsdom cannot create a WebGL context.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const built = vi.hoisted(() => ({ scene: null as THREE.Scene | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene) => {
    built.scene = scene
    return { setStyle() {}, resize() {}, render() {}, dispose() {} }
  },
}))

const mounted: ReturnType<typeof createLantern>[] = []
function mount(stage: SceneContext['stage'] = 'night', initialProgress = 0) {
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  const instance = createLantern({
    canvas, overlay, gestures: Gestures, shared: Shared, stage, initialProgress,
    isReducedMotion: () => true, isSoundEnabled: () => false,
  })
  mounted.push(instance)
  instance.start()
  instance.update(.05)
  const body = built.scene!.getObjectByName('lantern-body')!
  const shade = body.children.find((o) => o instanceof THREE.Mesh && o.geometry instanceof THREE.LatheGeometry) as THREE.Mesh<THREE.LatheGeometry, THREE.MeshStandardMaterial>
  const ribs = body.children.filter((o) => o instanceof THREE.Mesh && o.geometry instanceof THREE.TorusGeometry) as THREE.Mesh<THREE.TorusGeometry, THREE.MeshStandardMaterial>[]
  const glow = body.children.find((o) => o instanceof THREE.PointLight) as THREE.PointLight
  const halo = body.getObjectByName('lamp-halo') as THREE.Sprite | undefined
  const tap = () => overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
  return { instance, shade, ribs, glow, halo, tap }
}

afterEach(() => {
  for (const instance of mounted.splice(0)) instance.dispose()
  document.body.replaceChildren()
})

describe('lantern paper optics', () => {
  it('aligns opaque paper support shadows with the actual horizontal ribs', () => {
    const { shade, ribs } = mount()
    const optics = shade.material.userData.ritualOptics
    expect(optics.paper?.layout).toBe('bands')
    expect(optics.paper.contrast).toBeGreaterThanOrEqual(.5)
    expect(optics.paper.width).toBeGreaterThan(0)
    expect(optics.paper.width).toBeLessThan(.25)
    // The seven supports divide the 0.68-high shade into eight paper bays.
    expect(ribs).toHaveLength(7)
    for (const rib of ribs) {
      const phase = (rib.position.y + optics.paper.halfHeight) / optics.paper.spacing
      expect(phase).toBeCloseTo(Math.round(phase), 5)
    }
    expect(shade.material.transparent).toBe(false)
    expect(shade.material.opacity).toBe(1)
  })

  it.each(['day', 'night'] as const)('retains paper contrast as the %s lantern lights without making its ribs emit light', (stage) => {
    const { instance, shade, ribs, glow, halo, tap } = mount(stage)
    const darkPaper = shade.material.emissiveIntensity
    expect(glow.intensity).toBe(0)
    if (halo) expect((halo.material as THREE.SpriteMaterial).opacity).toBe(0)
    tap()
    instance.update(2)
    expect(shade.material.emissiveIntensity).toBeGreaterThan(darkPaper + .25)
    expect(shade.material.emissiveIntensity).toBeLessThanOrEqual(.7)
    expect(glow.intensity).toBeGreaterThan(2)
    if (halo) expect((halo.material as THREE.SpriteMaterial).opacity).toBeGreaterThan(.3)
    for (const rib of ribs) {
      expect(rib.material.emissive.getHex()).toBe(0)
      expect(rib.material.color.getHSL({ h: 0, s: 0, l: 0 }).l).toBeLessThan(.2)
    }
  })
})
