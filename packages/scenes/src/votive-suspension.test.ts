// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from './contract'
import { loadScene } from './registry'

// Keep actual scene geometry, native writing and lifecycle callbacks; replace GPU work only.
const frames = vi.hoisted(() => ({ count: 0, late: 0, scene: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    frames.scene = scene
    let disposed = false
    return {
      setStyle() {}, resize() {},
      render() { frames.count++; if (disposed) frames.late++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) },
      dispose() { disposed = true },
    }
  },
}))

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren(); vi.restoreAllMocks(); frames.count = frames.late = 0
})

async function mount(id: string, progress = 2, overrides: Partial<SceneContext> = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  overlay.className = 'scene-overlay-host'; host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 560 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 560 }) as DOMRect
  const complete = vi.fn(), onProgress = vi.fn(), saveWish = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const module = await loadScene(id)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared,
    initialProgress: progress, isSoundEnabled: () => false, onProgress, saveWish, ...overrides })
  instances.push(instance); instance.start(); instance.update(0)
  const run = (seconds: number) => { for (let i = 0; i < Math.round(seconds / .025); i++) instance.update(.025) }
  return { instance, overlay, complete, onProgress, saveWish, run, scene: frames.scene as THREE.Scene }
}

// Real cord/ring attachment coordinates, independent of implementation pivots.
const cases = [
  ...['coral', 'sage', 'indigo'].map(variant => ({ id: 'omamori-cycle', variant, name: `omamori-pouch-${variant}`, anchor: [0, .64, -.015], fixed: [.58, 1.68, .25], checkpoint: 2 })),
  ...['heart', 'hand', 'home', 'flower'].map((variant, i) => ({ id: 'milagros', variant, name: `milagros-charm-${i}`, anchor: [0, .37, .025], fixed: [0, 1.69, .16], checkpoint: 2 })),
  { id: 'ema-votive-plaque', variant: '', name: 'ema-plaque', anchor: [0, .8, 0], fixed: [0, 1.84, .09], checkpoint: 3 },
]
describe.each(cases)('$id $variant suspension', ({ id, variant, name, anchor, fixed, checkpoint }) => {
  it.each([false, true])('holds actual attachment on the support through live settling and archive sway, reduced=%s', async reduced => {
    for (const initial of [1, checkpoint, 3]) {
      const s = await mount(id, initial, { initialVariant: variant, isReducedMotion: () => reduced })
      const object = s.scene.getObjectByName(name)!
      const attachment = object.children.find(child => {
        const geometry = (child as THREE.Mesh).geometry
        return id === 'milagros' ? geometry instanceof THREE.TorusGeometry
          : geometry instanceof THREE.TubeGeometry && geometry.parameters.path.getPoint(.5).distanceTo(new THREE.Vector3(...anchor)) < 1e-8
      }) as THREE.Mesh<THREE.TorusGeometry | THREE.TubeGeometry>
      expect(attachment).toBeDefined()
      const support = s.scene.getObjectByName(id === 'omamori-cycle' ? 'omamori-clasp' : id === 'milagros' ? 'milagros-pin' : 'ema-hang-target')!
      const supportContact = support.localToWorld(id === 'omamori-cycle' ? new THREE.Vector3(0, .08, .015) : new THREE.Vector3())
      expect(supportContact.distanceTo(new THREE.Vector3(...fixed))).toBeLessThan(1e-8)
      const contact = attachment.geometry instanceof THREE.TubeGeometry ? attachment.geometry.parameters.path.getPoint(.5) : new THREE.Vector3()
      const button = s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
      if (initial === 1) {
        button.click()
        if (id === 'ema-votive-plaque') button.click()
      }
      let first: THREE.Vector3 | undefined, movement = 0, samples = 0
      for (let i = 0; i < 220; i++) {
        s.instance.update(.025)
        if (initial === 1 && !s.onProgress.mock.calls.some(([step]) => step >= checkpoint)) continue
        s.scene.updateMatrixWorld(true)
        expect(attachment.localToWorld(contact.clone()).distanceTo(new THREE.Vector3(...fixed)), `initial ${initial}, frame ${i}`).toBeLessThan(1e-8)
        if (id === 'omamori-cycle') {
          // Keeping the original pouch scale must also keep its sealed body above the tabletop.
          const bodyMesh = s.scene.getObjectByName(`omamori-pouch-body-${variant}`)!
          expect(new THREE.Box3().setFromObject(bodyMesh, true).min.y).toBeGreaterThan(.77)
        }
        const body = object.getWorldPosition(new THREE.Vector3())
        first ??= body.clone(); movement = Math.max(movement, body.distanceTo(first)); samples++
      }
      expect(samples).toBeGreaterThan(150)
      if (reduced) expect(movement).toBeLessThan(1e-8)
      else expect(movement).toBeGreaterThan(.0001)
      if (initial === 3) expect(s.complete).not.toHaveBeenCalled()
      else if (id !== 'ema-votive-plaque' || initial === 1) expect(s.complete).toHaveBeenCalledOnce()
      expect(s.saveWish).not.toHaveBeenCalled()
    }
  })
})
