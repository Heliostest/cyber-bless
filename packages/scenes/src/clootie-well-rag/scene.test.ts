// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// jsdom has no GPU; keep the real geometry, raycaster and DOM input.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    drawn.scene = scene
    drawn.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))

import { createClootieWellRag } from './scene'

const live: ReturnType<typeof createClootieWellRag>[] = []
beforeEach(() => { drawn.scene = drawn.camera = null })
afterEach(() => {
  live.forEach((s) => s.dispose())
  live.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createClootieWellRag({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: (n) => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  live.push(instance)
  instance.start()
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = vi.fn()
  hit.releasePointerCapture = vi.fn()
  const run = (seconds = 1.8) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
  run(0.05)
  return { canvas, overlay, instance, button, hit, progress, saveWish, complete, haptic, run }
}
type Mounted = ReturnType<typeof mount>
type Point = [number, number]
function object(name: string) {
  const obj = drawn.scene!.getObjectByName(name)
  expect(obj, `${name} is available in the real scene`).toBeDefined()
  return obj!
}
function project(s: Mounted, obj: THREE.Object3D): Point {
  drawn.scene!.updateMatrixWorld(true)
  drawn.camera!.updateMatrixWorld(true)
  const p = obj.getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
  return [(p.x + 1) * s.canvas.clientWidth / 2, (1 - p.y) * s.canvas.clientHeight / 2]
}
function pointer(target: EventTarget, type: string, [x, y]: Point, pointerId = 1) {
  if (type === 'pointerdown') pendingStarts.set(target, [x,y] as [number, number])

  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 })
  target.dispatchEvent(e)
}
function drag(s: Mounted, destination: string, finish = 'pointerup') {
  const from = project(s, object('clootie-rag-handle')), to = project(s, object(destination))
  pointer(s.hit, 'pointerdown', from)
  pointer(s.hit, 'pointermove', finish === 'pointerup' ? to : pendingPoint(s.hit, to))
  pointer(s.hit, finish, to)
  s.run()
}
function dots(s: Mounted) { return s.overlay.querySelectorAll('[data-state="done"]').length }
function cloth() { return object('clootie-cotton-rag') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> }

describe('clootie cloth checkpoints', () => {
  it.each([0, 1, 2, 3])('restores the cloth gesture and destination for checkpoint %i and hides it when paused', checkpoint => {
    let active = true
    mount(checkpoint, { isActive: () => active })
    const cues = object('clootie-rag-handle').userData.interactionCues as InteractionCue[] | undefined
    expect(cues).toHaveLength(3)
    const enabled = () => cues!.filter(cue => cue.enabled())
    expect(enabled().map(cue => cue.kind)).toEqual(checkpoint < 2 ? ['drag'] : checkpoint === 2 ? ['tap'] : [])
    if (checkpoint < 2) expect(enabled()[0].destination).toBe(object(checkpoint === 0 ? 'clootie-water-target' : 'clootie-branch-target'))
    active = false
    expect(enabled()).toEqual([])
  })

  it('dips, ties and releases once through keyboard buttons without saving a wish', () => {
    const s = mount()
    for (const [idx, action] of ['浸一下布', '系到枝上', '松手静看'].entries()) {
      expect(s.button.getAttribute('aria-label')).toBe(action)
      s.button.click()
      s.button.click()
      s.run()
      expect(s.progress).toEqual([1, 2, 3].slice(0, idx + 1))
    }
    expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('form')).toBeNull()
    expect(cloth().visible).toBe(true)
    expect(cloth().material.opacity).toBe(1)
    s.button.click()
    s.run(5)
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2, 3])('silently restores visible checkpoint %i', (initial) => {
    const s = mount(initial)
    s.run()
    expect(dots(s)).toBe(initial)
    expect(s.button.hidden).toBe(initial === 3)
    expect(s.progress).toEqual([])
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.haptic).not.toHaveBeenCalled()
    expect(cloth().visible).toBe(true)
    expect(cloth().material.opacity).toBe(1)
    const bounds = new THREE.Box3().setFromObject(cloth())
    expect(bounds.min.y).toBeGreaterThan(0)
    if (initial >= 2) {
      const branch = object('clootie-branch-target').getWorldPosition(new THREE.Vector3())
      expect(bounds.max.y).toBeCloseTo(branch.y, 1)
      expect(bounds.min.y).toBeLessThan(branch.y - 0.5)
    }
  })

  it('deforms cotton vertices when unfolding and dipping, and retains its woven texture', () => {
    const s = mount()
    const folded = Array.from(cloth().geometry.getAttribute('position').array)
    expect(cloth().material.map).toBeInstanceOf(THREE.DataTexture)
    s.button.click()
    s.run(0.3)
    const dipping = Array.from(cloth().geometry.getAttribute('position').array)
    expect(dipping).not.toEqual(folded)
    s.run()
    const wet = Array.from(cloth().geometry.getAttribute('position').array)
    expect(wet).not.toEqual(folded)
    expect(cloth().material.color.getHex()).not.toBe(0xf6e8c9)
  })

  it('allows all three actions immediately in reduced motion and keeps the final cloth still', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.button.click()
    expect(s.progress).toEqual([1])
    s.button.click()
    expect(s.progress).toEqual([1, 2])
    s.button.click()
    expect(s.progress).toEqual([1, 2, 3])
    const settled = Array.from(cloth().geometry.getAttribute('position').array)
    s.run(4)
    expect(Array.from(cloth().geometry.getAttribute('position').array)).toEqual(settled)
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('rejects inactive actions and cancels a gesture across pause/resume', () => {
    let active = false
    const s = mount(0, { isActive: () => active })
    s.button.click()
    drag(s, 'clootie-water-target')
    expect(s.progress).toEqual([])
    active = true
    const from = project(s, object('clootie-rag-handle')), to = project(s, object('clootie-water-target'))
    pointer(s.hit, 'pointerdown', from)
    pointer(s.hit, 'pointermove', pendingPoint(s.hit, to))
    active = false
    s.run(0.1)
    active = true
    pointer(s.hit, 'pointerup', to)
    s.run()
    expect(s.progress).toEqual([])
    s.button.click()
    s.run()
    expect(s.progress).toEqual([1])
  })

  it('freezes an accepted dip while inactive and resumes to a single checkpoint', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    s.button.click()
    s.run(0.25)
    const position = object('clootie-rag').position.clone()
    const shape = Array.from(cloth().geometry.getAttribute('position').array)
    active = false
    s.run(2)
    expect(object('clootie-rag').position.equals(position)).toBe(true)
    expect(Array.from(cloth().geometry.getAttribute('position').array)).toEqual(shape)
    expect(s.progress).toEqual([])
    active = true
    s.run()
    expect(s.progress).toEqual([1])
  })
})

describe('clootie real object gestures', () => {
  it.each([320, 390, 1280])('dips in water, ties to the low branch and releases the cloth in a %ipx frame', (width) => {
    const s = mount(0, {}, width)
    const bounds = new THREE.Box3().setFromObject(object('clootie-well-and-tree'))
    expect(bounds.min.y).toBeGreaterThanOrEqual(0)
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) {
      const p = new THREE.Vector3(x, y, bounds.min.z).project(drawn.camera!)
      expect(Math.abs(p.x), JSON.stringify({ width, min: bounds.min.toArray(), max: bounds.max.toArray(), camera: drawn.camera!.position.toArray() })).toBeLessThan(0.99)
      expect(Math.abs(p.y)).toBeLessThan(0.99)
    }
    for (const name of ['clootie-rag-handle', 'clootie-water-target', 'clootie-branch-target']) {
      const p = project(s, object(name))
      expect(p[0]).toBeGreaterThan(0)
      expect(p[0]).toBeLessThan(width)
      expect(p[1]).toBeGreaterThan(0)
      expect(p[1]).toBeLessThan(520)
    }
    drag(s, 'clootie-water-target')
    expect(s.progress).toEqual([1])
    const wetBounds = new THREE.Box3().setFromObject(cloth())
    expect(wetBounds.max.y - wetBounds.min.y).toBeGreaterThan(0.7)
    expect(wetBounds.min.y).toBeGreaterThan(0)
    drag(s, 'clootie-branch-target')
    expect(s.progress).toEqual([1, 2])
    const tiedBounds = new THREE.Box3().setFromObject(cloth())
    expect(tiedBounds.max.y - tiedBounds.min.y).toBeGreaterThan(0.7)
    expect(tiedBounds.min.y).toBeGreaterThan(0)
    const rag = project(s, object('clootie-rag-handle'))
    pointer(s.hit, 'pointerdown', rag)
    pointer(s.hit, 'pointerup', rag)
    s.run()
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('keeps unfolding cotton above the host floor after a low water drop', () => {
    const s = mount()
    const from = project(s, object('clootie-rag-handle')), to = project(s, object('clootie-water-target'))
    pointer(s.hit, 'pointerdown', from)
    pointer(s.hit, 'pointermove', to)
    pointer(s.hit, 'pointerup', to)
    for (let i = 0; i < 30; i++) {
      s.instance.update(0.05)
      expect(new THREE.Box3().setFromObject(cloth()).min.y).toBeGreaterThanOrEqual(0)
    }
    expect(s.progress).toEqual([1])
  })

  it('claims cotton touches only and rejects empty-space starts and wrong endpoints', () => {
    const s = mount()
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { touches: [{ clientX: p[0], clientY: p[1] }], changedTouches: [{ clientX: p[0], clientY: p[1] }] })
      s.hit.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(touch([3, 3])).toBe(false)
    expect(touch(project(s, object('clootie-rag-handle')))).toBe(true)
    const to = project(s, object('clootie-water-target'))
    pointer(s.hit, 'pointerdown', [3, 3])
    pointer(s.hit, 'pointerup', to)
    drag(s, 'clootie-branch-target')
    expect(s.progress).toEqual([])
  })

  it.each(['pointercancel', 'lostpointercapture'])('restores cotton after %s without accepting the valid destination', (finish) => {
    const s = mount()
    drag(s, 'clootie-water-target', finish)
    pointer(s.hit, 'pointerup', [3, 3])
    expect(s.progress).toEqual([])
    drag(s, 'clootie-water-target')
    expect(s.progress).toEqual([1])
  })

  it.each([1, 2])('keeps checkpoint %i after cancellation and permits a fresh cloth gesture', (initial) => {
    const s = mount(initial)
    drag(s, initial === 1 ? 'clootie-branch-target' : 'clootie-rag-handle', 'pointercancel')
    expect(s.progress).toEqual([])
    drag(s, initial === 1 ? 'clootie-branch-target' : 'clootie-rag-handle')
    expect(s.progress).toEqual([initial + 1])
  })

  it.each(['outside-first', 'outside-second', 'object-second'])('rejects %s multiple pointers and button clicks during that gesture', (order) => {
    const s = mount()
    const from = project(s, object('clootie-rag-handle')), to = project(s, object('clootie-water-target'))
    if (order === 'outside-first') pointer(document.body, 'pointerdown', [3, 3], 2)
    pointer(s.hit, 'pointerdown', from, 1)
    if (order === 'outside-second') pointer(document.body, 'pointerdown', [3, 3], 2)
    if (order === 'object-second') pointer(s.hit, 'pointerdown', from, 2)
    s.button.click()
    pointer(s.hit, 'pointermove', to, 1)
    pointer(s.hit, 'pointerup', to, 1)
    pointer(document.body, 'pointerup', [3, 3], 2)
    s.run()
    expect(s.progress).toEqual([])
    drag(s, 'clootie-water-target')
    expect(s.progress).toEqual([1])
  })

  it('does not let the button replace an in-progress single-pointer drag', () => {
    const s = mount()
    const from = project(s, object('clootie-rag-handle'))
    pointer(s.hit, 'pointerdown', from)
    s.button.click()
    pointer(s.hit, 'pointercancel', from)
    s.run()
    expect(s.progress).toEqual([])
  })

  it('disposes every owned mesh, texture, light shadow and listener exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount()
    const resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      const materials = mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []
      materials.forEach((m) => {
        resources.add(m)
        const map = (m as THREE.MeshStandardMaterial).map
        if (map) resources.add(map)
      })
      const shadow = (o as THREE.DirectionalLight).shadow
      if (shadow) resources.add(shadow)
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
    })
    const cleanup = [...resources].map((r) => vi.spyOn(r, 'dispose'))
    const from = project(s, object('clootie-rag-handle'))
    const button = s.button
    s.instance.dispose()
    s.instance.dispose()
    cleanup.forEach((spy) => expect(spy).toHaveBeenCalledOnce())
    for (const args of added.mock.calls.filter(([type]) => type.startsWith('pointer'))) {
      expect(removed.mock.calls.some((call) => call[0] === args[0] && call[1] === args[1] && call[2] === args[2])).toBe(true)
    }
    pointer(s.hit, 'pointerdown', from)
    pointer(s.hit, 'pointerup', from)
    button.click()
    s.instance.update(9)
    expect(s.progress).toEqual([])
    expect(s.overlay.childElementCount).toBe(0)
  })
})

// Cancellation happens before arrival; a completed placement already owns its result.
const pendingStarts = new WeakMap<EventTarget, [number, number]>()
function pendingPoint(layer: EventTarget, point: [number, number]): [number, number] {
 const start = pendingStarts.get(layer) ?? point
 return [start[0]+(point[0]-start[0])*.20,start[1]+(point[1]-start[1])*.20]
}
