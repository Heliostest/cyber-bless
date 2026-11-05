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


function vertex(mesh: THREE.Mesh, index: number) {
  return mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(mesh.geometry.getAttribute('position'), index))
}

describe.each([1, 2, 3].flatMap(initial => [false, true].map(reduced => ({ initial, reduced }))))('workshop supports from $initial, reduced=$reduced', ({ initial, reduced }) => {
  it('keeps the entire banner top seam and both ties attached while its free hem moves', async () => {
    const s = await mount('breton-banner', initial, { isReducedMotion: () => reduced })
    if (initial === 1) { s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click(); s.run(.85) }
    const cloth = s.scene.getObjectByName('banner-cloth') as THREE.Mesh
    const fixed = s.scene.getObjectByName('banner-fixed-hem')!, tab = s.scene.getObjectByName('banner-hem-tab')!
    const seam = Array.from({ length: 41 }, (_, i) => new THREE.Vector3(.32 + 1.14 * i / 40, 2.60, .33))
    const fixedStart = new THREE.Vector3(.32, 2.60, .336), tabStart = new THREE.Vector3(1.46, 2.60, .38)
    const lower = vertex(cloth, 20 * 41 + 20); let movement = 0
    for (let i = 0; i < 160; i++) {
      s.instance.update(.025); s.scene.updateMatrixWorld(true)
      seam.forEach((point, index) => expect(vertex(cloth, index).distanceTo(point), `seam ${index}, frame ${i}`).toBeLessThan(1e-7))
      expect(fixed.getWorldPosition(new THREE.Vector3()).distanceTo(fixedStart)).toBeLessThan(1e-8)
      expect(tab.getWorldPosition(new THREE.Vector3()).distanceTo(tabStart)).toBeLessThan(1e-8)
      movement = Math.max(movement, vertex(cloth, 20 * 41 + 20).distanceTo(lower))
    }
    if (reduced || initial === 3) expect(movement).toBeLessThan(1e-7)
    else expect(movement).toBeGreaterThan(.01)
    expect(vertex(cloth, 20 * 41 + 20).distanceTo(new THREE.Vector3(.89, 1.615, .33))).toBeLessThan(1e-7)
    expect(s.complete).toHaveBeenCalledTimes(initial === 3 ? 0 : 1)
  })

  it('keeps the real straw suspension thread endpoint on the display peg while the body swings', async () => {
    const s = await mount('lithuanian-straw-garden', initial, { isReducedMotion: () => reduced })
    if (initial === 1) { s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click(); s.run(.8) }
    const mobile = s.scene.getObjectByName('straw-mobile')!, peg = s.scene.getObjectByName('straw-display-peg')!
    const thread = s.scene.getObjectByName('straw-suspension-thread') as THREE.Mesh
    expect(thread).toBeTruthy()
    const height = (thread.geometry as THREE.CylinderGeometry).parameters.height
    let movement = 0
    for (let i = 0; i < 160; i++) {
      s.instance.update(.025); s.scene.updateMatrixWorld(true)
      expect(thread.localToWorld(new THREE.Vector3(0, height / 2, 0)).distanceTo(peg.getWorldPosition(new THREE.Vector3())), `thread frame ${i}`).toBeLessThan(1e-8)
      movement = Math.max(movement, mobile.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(.72, 2.12, 0)))
    }
    if (reduced || initial === 3) expect(movement).toBeLessThan(1e-8)
    else expect(movement).toBeGreaterThan(.01)
    expect(mobile.getWorldPosition(new THREE.Vector3()).distanceTo(new THREE.Vector3(.72, 2.12, 0))).toBeLessThan(1e-8)
    expect(s.complete).toHaveBeenCalledTimes(initial === 3 ? 0 : 1)
  })
})
