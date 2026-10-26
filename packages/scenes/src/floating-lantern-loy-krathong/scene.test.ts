// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import { createInteractionCues, type InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Keep geometry, projection, raycasts and pointer events real; jsdom has no GPU.
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
    drawn.scene = scene; drawn.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))

import { createFloatingLantern } from './scene'

const live: ReturnType<typeof createFloatingLantern>[] = []
beforeEach(() => { drawn.scene = drawn.camera = null })
afterEach(() => {
  live.forEach(s => s.dispose()); live.length = 0
  document.body.replaceChildren(); vi.restoreAllMocks()
})
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createFloatingLantern({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start()
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = vi.fn(); hit.releasePointerCapture = vi.fn() }
  const run = (seconds = 1.6) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
  run(0.05)
  return { host, canvas, overlay, instance, hit, button, progress, saveWish, complete, haptic, run }
}
type Mounted = ReturnType<typeof mount>
type Point = [number, number]
function object(name: string) {
  const obj = drawn.scene?.getObjectByName(name)
  expect(obj, `${name} is present in the real scene`).toBeDefined()
  return obj!
}
function project(s: Mounted, obj: THREE.Object3D): Point {
  drawn.scene!.updateMatrixWorld(true); drawn.camera!.updateMatrixWorld(true)
  const p = obj.getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
  return [(p.x + 1) * s.canvas.clientWidth / 2, (1 - p.y) * 260]
}
function pointer(target: EventTarget, type: string, [x, y]: Point, pointerId = 1, extra: Record<string, unknown> = {}) {
  if (type === 'pointerdown') pendingStarts.set(target, [x,y] as [number, number])

  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra })
  target.dispatchEvent(e)
}

const sourceNames = ['krathong-flower-source', 'krathong-wick-source', 'krathong-boat-source']
const targetNames = ['krathong-flower-seat', 'krathong-wick-source', 'krathong-water-target']
function gesture(s: Mounted, step: number, end = 'pointerup') {
  const from = project(s, object(sourceNames[step])), to = project(s, object(targetNames[step]))
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, end, to); s.run()
}
function enabledCues() {
  const result: InteractionCue[] = []
  drawn.scene!.traverse(o => { for (const c of o.userData.interactionCues ?? []) if (c.enabled()) result.push(c) })
  return result
}
function submit(s: Mounted, text: string) {
  const input = s.overlay.querySelector<HTMLInputElement>('input')!
  input.value = text; input.dispatchEvent(new Event('input', { bubbles: true }))
  s.overlay.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  s.run()
}

describe('Loy Krathong leaf float', () => {
  it('places a flower, lights the wick and launches once via the same auxiliary actions', () => {
    const s = mount()
    expect(s.button).not.toBeNull()
    for (const n of [1, 2, 3]) { s.button.click(); s.button.click(); s.run(); expect(s.progress).toEqual([1, 2, 3].slice(0, n)) }
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(true); expect(enabledCues()).toEqual([])
  })
  it.each([320, 390, 1280])('follows the actual displayed cue geometry at %ipx', width => {
    const s = mount(0, {}, width), view = createInteractionCues(s.canvas, drawn.scene!, drawn.camera!)
    for (let step = 0; step < 3; step++) {
      view.update()
      const cues = Array.from(s.host.querySelectorAll<HTMLElement>('.scene-object-cue'))
      expect(cues).toHaveLength(step === 1 ? 1 : 2)
      for (const c of cues) {
        expect(Number(c.dataset.x)).toBeGreaterThan(12); expect(Number(c.dataset.x)).toBeLessThan(width - 12)
        expect(Number(c.dataset.y)).toBeGreaterThan(45); expect(Number(c.dataset.y)).toBeLessThan(460)
      }
      const point = (el: HTMLElement): Point => [Number(el.dataset.x), Number(el.dataset.y)]
      pointer(s.hit, 'pointerdown', point(cues[0])); pointer(s.hit, 'pointermove', point(cues.at(-1)!)); pointer(s.hit, 'pointerup', point(cues.at(-1)!)); s.run()
      expect(s.progress).toEqual([1, 2, 3].slice(0, step + 1))
    }
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(0); view.dispose()
    expect(new THREE.Box3().setFromObject(object('krathong-banana-base')).min.y).toBeCloseTo(-.04)
    expect(object('krathong-flame').visible).toBe(true)
  })
  it('rejects empty starts, wrong drops and a wick drag that returns to its origin', () => {
    const s = mount(), flower = project(s, object(sourceNames[0])), seat = project(s, object(targetNames[0]))
    pointer(s.hit, 'pointerdown', [2, 2]); pointer(s.hit, 'pointerup', seat); s.run()
    pointer(s.hit, 'pointerdown', flower); pointer(s.hit, 'pointerup', [2, 2]); s.run()
    expect(s.progress).toEqual([]); gesture(s, 0)
    const wick = project(s, object(sourceNames[1]))
    pointer(s.hit, 'pointerdown', wick); pointer(s.hit, 'pointermove', [wick[0] + 90, wick[1]]); pointer(s.hit, 'pointermove', wick); pointer(s.hit, 'pointerup', wick); s.run()
    expect(s.progress).toEqual([1]); gesture(s, 1); expect(s.progress).toEqual([1, 2])
  })
  it('binds the wick and boat cues to visible geometry rather than empty hit volumes', () => {
    const s = mount(1)
    const wick = object(sourceNames[1]) as THREE.Mesh, mat = wick.material as THREE.Material
    expect(mat.visible && mat.opacity > .5).toBe(true)
    const point = project(s, wick), empty: Point = [point[0] + 6, point[1] - 7]
    pointer(s.hit, 'pointerdown', empty); pointer(s.hit, 'pointerup', point); s.run()
    expect(s.progress).toEqual([])
    gesture(s, 1)
    const binding = object(sourceNames[2]) as THREE.Mesh
    expect((binding.material as THREE.Material).opacity).toBe(1)
    const p = binding.getWorldPosition(new THREE.Vector3()).project(drawn.camera!), ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(p.x, p.y), drawn.camera!)
    expect(ray.intersectObject(object('krathong-boat'), true)[0].object).toBe(binding)
    gesture(s, 2); expect(s.progress).toEqual([2, 3])
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur'])('cancels %s without advancing and requires a fresh pointer', event => {
    const s = mount(), from = project(s, object(sourceNames[0])), to = project(s, object(targetNames[0]))
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', pendingPoint(s.hit, to))
    if (event === 'blur') { window.dispatchEvent(new Event('blur')); s.run(); expect(enabledCues()).toEqual([]); window.dispatchEvent(new Event('focus')) }
    else pointer(s.hit, event, to)
    pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    gesture(s, 0); expect(s.progress).toEqual([1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i without side effects', n => {
    const s = mount(n)
    expect(s.overlay.querySelectorAll('[data-state="done"]')).toHaveLength(n)
    expect(object('krathong-flame').visible).toBe(n >= 2)
    expect(enabledCues()).toHaveLength(n === 3 ? 0 : 1)
    s.run(4); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
  })
  it.each([0, 1, 2])('cancels pause at step %i and hides projected cues', n => {
    let active = true; const s = mount(n, { isActive: () => active })
    const from = project(s, object(sourceNames[n])), to = project(s, object(targetNames[n]))
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', pendingPoint(s.hit, to))
    active = false; s.run(); s.button.click(); expect(enabledCues()).toEqual([])
    active = true; pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    gesture(s, n); expect(s.progress).toEqual([n + 1])
  })
  it('freezes accepted animation during pause and finishes it only once', () => {
    let active = true; const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(.2); active = false
    const p = object('krathong-flower').position.clone(); s.run(3)
    expect(object('krathong-flower').position.equals(p)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([1])
  })
  it.each(['outside-first', 'outside-second', 'object-second'])('rejects multi-touch %s and busy auxiliary clicks', order => {
    const s = mount(), from = project(s, object(sourceNames[0])), to = project(s, object(targetNames[0]))
    if (order === 'outside-first') pointer(document.body, 'pointerdown', [2, 2], 2)
    pointer(s.hit, 'pointerdown', from)
    if (order === 'outside-second') pointer(document.body, 'pointerdown', [2, 2], 2)
    if (order === 'object-second') pointer(s.hit, 'pointerdown', from, 2)
    s.button.click(); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); pointer(document.body, 'pointerup', [2, 2], 2); s.run()
    expect(s.progress).toEqual([]); gesture(s, 0); expect(s.progress).toEqual([1])
  })
  it('saves only an explicitly submitted line once', () => {
    const s = mount(2); submit(s, '  愿河岸清明  ')
    expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿河岸清明'); expect(s.complete).toHaveBeenCalledOnce()
    s.button.click(); s.run(); expect(s.saveWish).toHaveBeenCalledOnce()
  })
  it('does not accept submission before the leaf boat is ready', () => {
    const s = mount(0); submit(s, '过早的提交')
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('quiet launch ignores a typed draft, and returning never offers or saves a new wish', () => {
    const s = mount(2); const input = s.overlay.querySelector<HTMLInputElement>('input')!
    input.value = '未提交'; input.dispatchEvent(new Event('input', { bubbles: true })); gesture(s, 2)
    expect(s.saveWish).not.toHaveBeenCalled()
    const r = mount(2, { returning: true }); expect(r.overlay.querySelector('input')).toBeNull()
    gesture(r, 2); expect(r.progress).toEqual([3]); expect(r.saveWish).not.toHaveBeenCalled()
  })
  it('retains the complete physical flow with reduced motion and rejects inactive submission', () => {
    let active = true; const s = mount(0, { isReducedMotion: () => true, isActive: () => active })
    gesture(s, 0); gesture(s, 1); active = false; s.run(); submit(s, '尚未提交')
    expect(s.saveWish).not.toHaveBeenCalled(); expect(s.progress).toEqual([1, 2])
    active = true; s.run(); gesture(s, 2); expect(s.progress).toEqual([1, 2, 3])
    const pose = object('krathong-boat').matrixWorld.clone(); s.run(3); expect(object('krathong-boat').matrixWorld.equals(pose)).toBe(true)
  })
  it('frees geometry, materials, lights, shadows and input on idempotent disposal', () => {
    const s = mount(), resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse(o => {
      const m = o as THREE.Mesh
      if (m.geometry) resources.add(m.geometry)
      if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(r => resources.add(r))
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
      const shadow = (o as THREE.DirectionalLight).shadow; if (shadow) resources.add(shadow)
    })
    const spies = [...resources].map(r => vi.spyOn(r, 'dispose'))
    s.instance.dispose(); s.instance.dispose(); spies.forEach(spy => expect(spy).toHaveBeenCalledOnce())
    s.button.click(); s.instance.update(4); expect(s.progress).toEqual([])
    expect(s.overlay.childElementCount).toBe(0); expect(drawn.scene!.children).toHaveLength(0)
  })
})

// Cancellation happens before arrival; a completed placement already owns its result.
const pendingStarts = new WeakMap<EventTarget, [number, number]>()
function pendingPoint(layer: EventTarget, point: [number, number]): [number, number] {
 const start = pendingStarts.get(layer) ?? point
 return [start[0]+(point[0]-start[0])*.20,start[1]+(point[1]-start[1])*.20]
}
