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

const ids = [
  'polish-blessing-basket', 'blang-tea', 'breton-banner', 'catalan-festival-giant',
  'czech-pilgrim-journal', 'dalarna-wooden-horse', 'fijian-woven-fan', 'finnish-birch-basket',
  'lithuanian-straw-garden', 'ndebele-painted-house', 'purepecha-copper-bowl', 'sicilian-painted-cart',
  'slovak-wire-bird', 'uzbek-clay-bowl', 'faroese-wool-knit', 'venetian-glass-bead',
  'weifang-paper-kite', 'bokjori', 'czech-bead-star', 'st-brigids-cross',
] as const
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

function appearance(scene: THREE.Scene) {
  const values: number[] = []
  scene.traverse(object => {
    values.push(...object.quaternion.toArray())
    const value = (object as THREE.Mesh).material
    for (const material of Array.isArray(value) ? value : value ? [value] : []) {
      if (material instanceof THREE.MeshStandardMaterial) values.push(...material.emissive.toArray(), material.emissiveIntensity)
    }
  })
  return values
}

describe.each(ids)('%s automatic quiet ending', id => {
  it('finishes naturally after the quiet interval without a final click and never repeats', async () => {
    const s = await mount(id)
    expect(s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.hidden).toBe(true)
    for (let i = 0; i < 20; i++) s.instance.update(0)
    expect(s.complete).not.toHaveBeenCalled(); expect(s.onProgress).not.toHaveBeenCalled()
    s.run(2.45); expect(s.complete).not.toHaveBeenCalled(); expect(s.onProgress).not.toHaveBeenCalled()
    s.run(1.5)
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
    s.run(4); s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
    expect(s.onProgress).toHaveBeenCalledOnce(); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('pauses the ending clock and cancels it on disposal', async () => {
    let active = true
    const s = await mount(id, 2, { isActive: () => active })
    s.run(.5); active = false; s.run(5)
    expect(s.complete).not.toHaveBeenCalled()
    active = true; s.run(.5); expect(s.complete).not.toHaveBeenCalled()
    s.instance.dispose(); s.run(5)
    expect(s.complete).not.toHaveBeenCalled(); expect(s.onProgress).not.toHaveBeenCalled(); expect(frames.late).toBe(0)
  })

  it('animates the actual object during the quiet interval', async () => {
    const s = await mount(id), before = appearance(s.scene)
    s.run(.55)
    expect(appearance(s.scene)).not.toEqual(before)
    expect(s.complete).not.toHaveBeenCalled()
  })

  it('keeps a short reduced-motion interval and does not save a returning wish', async () => {
    const s = await mount(id, 2, { isReducedMotion: () => true, returning: true })
    s.run(.5); expect(s.complete).not.toHaveBeenCalled()
    s.run(.2); expect(s.complete).toHaveBeenCalledOnce(); expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('restores a completed archive without reporting progress or issuing another completion', async () => {
    const s = await mount(id, 3)
    s.run(5)
    expect(s.complete).not.toHaveBeenCalled(); expect(s.onProgress).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it.each(id === 'czech-bead-star' ? [0] : [0, 1])('does not skip unfinished physical checkpoint %i', async checkpoint => {
    const s = await mount(id, checkpoint)
    s.run(5)
    expect(s.onProgress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('stops the completion frame when progress synchronously disposes the scene', async () => {
    let dispose = () => {}
    const s = await mount(id, 2, { onProgress(n) { if (n === 3) dispose() } })
    dispose = () => s.instance.dispose()
    s.run(4)
    expect(s.complete).not.toHaveBeenCalled(); expect(frames.late).toBe(0)
  })
})

it('keeps the native basket writer and its unsubmitted draft until an explicit submission', async () => {
  const s = await mount('polish-blessing-basket')
  const input = s.overlay.querySelector<HTMLInputElement>('input')!
  input.value = '  愿亲友安康  '; input.dispatchEvent(new Event('input', { bubbles: true }))
  s.run(5)
  expect(s.complete).not.toHaveBeenCalled(); expect(input.value).toBe('  愿亲友安康  ')
  input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿亲友安康')
  s.run(5); expect(s.saveWish).toHaveBeenCalledOnce()
})

it('finishes the App basket presentation when deferred writing supplies no native editor', async () => {
  const s = await mount('polish-blessing-basket', 2, { deferWishWriting: true, gestures: {
    ...Gestures, createWishWrite: () => ({ mount(target) { target.hidden = true }, update() {}, setEnabled() {}, dispose() {} }),
  } })
  expect(s.overlay.querySelector('input,textarea')).toBeNull()
  s.run(3.1)
  expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
})

it('also resumes the bead star archive whose older quiet checkpoint was numbered one', async () => {
  const s = await mount('czech-bead-star', 1)
  s.run(2.5); expect(s.complete).not.toHaveBeenCalled()
  s.run(.6)
  expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3); expect(s.complete).toHaveBeenCalledOnce()
})

describe.each([
  { id: 'bokjori', name: 'bokjori-scoop', anchor: [0, 1.23, .075], fixed: [.5, 2.09, -.245] },
  { id: 'st-brigids-cross', name: 'brigid-cross', anchor: [0, .98, .02], fixed: [0, 1.98, .2656] },
])('$id suspension', ({ id, name, anchor, fixed }) => {
  it.each([1, 2, 3].flatMap(initial => [false, true].map(reduced => ({ initial, reduced }))))('keeps the hanging point fixed through sway and settling from checkpoint $initial, reduced=$reduced', async ({ initial, reduced }) => {
    const s = await mount(id, initial, { isReducedMotion: () => reduced }), object = s.scene.getObjectByName(name)!
    if (initial === 1) s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
    const pin = new THREE.Vector3(...fixed), local = new THREE.Vector3(...anchor)
    let firstBody: THREE.Vector3 | undefined, movement = 0, samples = 0
    for (let i = 0; i < 220; i++) {
      s.instance.update(.025)
      if (initial === 1 && !s.onProgress.mock.calls.some(([step]) => step >= 2)) continue
      s.scene.updateMatrixWorld(true)
      expect(object.localToWorld(local.clone()).distanceTo(pin), `attachment at frame ${i}`).toBeLessThan(1e-8)
      const body = object.getWorldPosition(new THREE.Vector3())
      firstBody ??= body.clone(); movement = Math.max(movement, body.distanceTo(firstBody)); samples++
    }
    expect(samples).toBeGreaterThan(150)
    if (reduced) expect(movement).toBeLessThan(1e-8)
    if (initial < 3) {
      if (!reduced) expect(movement).toBeGreaterThan(.01)
      expect(s.complete).toHaveBeenCalledOnce()
    } else expect(s.complete).not.toHaveBeenCalled()
  })
})
