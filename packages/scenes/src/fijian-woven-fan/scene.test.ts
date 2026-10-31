// @vitest-environment jsdom
// jsdom has no Canvas 2D; exercise the explicit unavailable-texture fallback quietly.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })

// Isolate spatial gestures, geometry and save callbacks from shared ending scheduling.
// The real automatic timer, animation and lifecycle contract are covered across all
// 20 scenes in ../quiet-ending-workshop-scenes.test.ts without this mock.
vi.mock('../quiet-ending', () => ({
  createQuietEnding: () => ({ sync() {}, update() {}, dispose() {}, completing: true, running: false }),
}))

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import * as mod from './index'

const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, frames: 0 }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this }
    setClearColor() {} setPixelRatio() {} setSize() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera; rendered.frames = 0
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { rendered.frames++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390, height = width === 1280 ? 408 : 390) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  const left = 17, top = 89
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, shared: Shared, gestures: Gestures, initialProgress: at, isSoundEnabled: () => false,
    onProgress: n => progress.push(n), saveWish, haptic, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, overlay, host, hit, button, point, run, progress, saveWish, complete, haptic }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}
function drag(s: ReturnType<typeof mount>, source: string, target: string) {
  const a = s.point(source), b = s.point(target)
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('fan-handle-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

function beforeArrival(s: ReturnType<typeof mount>, goal: [number, number]): [number, number] {
  let selected: { object: THREE.Object3D; cue: InteractionCue } | undefined
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled() && cue.kind === 'drag' && cue.destination) selected = { object, cue } })
  if (!selected) return goal
  const { object, cue } = selected, canvas = s.overlay.parentElement!.querySelector('canvas')!, rect = canvas.getBoundingClientRect()
  const source = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
  const x = rect.left + (source.x + 1) * rect.width / 2, y = rect.top + (1 - source.y) * rect.height / 2
  return [Math.max(rect.left + 2, x - 48), Math.max(rect.top + 2, y - 48)]
}

describe('an original woven pandanus fan', () => {
  it('offers an assembly action without saving a checkpoint on mount', () => {
    const s = mount(); expect(s.button).not.toBeNull(); expect(s.progress).toEqual([])
  })
  it('attaches a tangible collar, carries the entire fan to its stand and completes once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'fan-binding-grip', 'fan-neck-joint'); expect(s.progress).toEqual([1])
    const fan = s.scene.getObjectByName('fan-body')!, collar = s.scene.getObjectByName('fan-loose-binding')!
    expect(collar.parent).toBe(fan)
    const before = collar.getWorldPosition(new THREE.Vector3()), fanBefore = fan.position.clone()
    drag(s, 'fan-handle-grip', 'fan-display-seat'); expect(s.progress).toEqual([1, 2])
    expect(collar.getWorldPosition(new THREE.Vector3()).sub(before).distanceTo(fan.position.clone().sub(fanBefore))).toBeLessThan(.00001)
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently with identical native action semantics', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input, textarea, form')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
    expect(s.scene.getObjectByName('fan-loose-binding')!.parent?.name).toBe(at ? 'fan-body' : 'fan-workbench')
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([[284, 390], [350, 408], [1280, 408]])('frames all fan vertices and exposes each real cue at %ix%i', (width, height) => {
    const s = mount(0, { isReducedMotion: () => true }, width, height)
    for (const [step, names] of [[0, ['fan-binding-grip', 'fan-neck-joint']], [1, ['fan-handle-grip', 'fan-display-seat']], [2, ['fan-handle-grip']], [3, []]] as const) {
      s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
      const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
      for (const groupName of step === 0 ? ['fan-body', 'fan-loose-binding'] : ['fan-body']) {
        s.scene.getObjectByName(groupName)!.traverseVisible(o => {
          const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
          const vertices = mesh.geometry.getAttribute('position')
          const bounds = new THREE.Box3(), projected = new THREE.Vector3()
          // Project every vertex, reusing current world matrices and scratch storage.
          // One bounds assertion retains all six limits without per-vertex expect overhead.
          for (let i = 0; i < vertices.count; i++) {
            projected.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(s.camera)
            bounds.expandByPoint(projected)
          }
          const extent = Math.max(Math.abs(bounds.min.x) / .92, Math.abs(bounds.max.x) / .92,
            Math.abs(bounds.min.y) / .92, Math.abs(bounds.max.y) / .92, Math.abs(bounds.min.z), Math.abs(bounds.max.z))
          expect(extent, `${mesh.name} at ${step}: NDC min ${bounds.min.toArray()} max ${bounds.max.toArray()}`).toBeLessThan(1)
        })
      }
      for (const [i, name] of names.entries()) {
        const object = s.scene.getObjectByName(name)!, p = object.getWorldPosition(new THREE.Vector3()).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(ray.intersectObjects(visible, false)[0]?.object, name).toBe(object)
        const cue = s.host.querySelector<HTMLElement>(`[data-cue-role="${i ? 'target' : 'source'}"]`)!
        expect(cue).not.toBeNull()
        expect(Number(cue.dataset.x)).toBeCloseTo((p.x + 1) * width / 2, 3)
        expect(Number(cue.dataset.y)).toBeCloseTo((1 - p.y) * height / 2, 3)
      }
      if (step < 2) drag(s, names[0]!, names[1]!); else if (step === 2) tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2, 3])('supports the fan, loose binding and display structure at checkpoint %i', at => {
    const s = mount(at), box = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    expect(Math.abs(box('fan-handle-grip').min.y - box(at < 2 ? 'fan-home-seat' : 'fan-display-seat').max.y)).toBeLessThan(.001)
    expect(Math.abs(box('fan-display-base').min.y - box('fan-table').max.y)).toBeLessThan(.001)
    expect(Math.abs(box('fan-display-post').min.y - box('fan-display-base').max.y)).toBeLessThan(.001)
    expect(Math.abs(box('fan-display-post').max.y - box('fan-display-seat').min.y)).toBeLessThan(.001)
    if (!at) expect(Math.abs(box('fan-loose-binding').min.y - box('fan-binding-pad').max.y)).toBeLessThan(.001)
    else {
      expect(box('fan-binding-grip').min.z).toBeLessThanOrEqual(box('fan-neck-joint').max.z + .002)
      expect(box('fan-binding-grip').max.z).toBeGreaterThan(box('fan-neck-joint').max.z)
    }
  })
  it('has a broad, thick leaf blade, connected reed edge and raised opaque weaving', () => {
    const s = mount(), blade = s.scene.getObjectByName('fan-woven-core') as THREE.Mesh
    const b = new THREE.Box3().setFromObject(blade), size = b.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(1.2); expect(size.y).toBeGreaterThan(1.4); expect(size.z).toBeGreaterThan(.025)
    let strips = 0
    s.scene.getObjectByName('fan-body')!.traverse(o => {
      const m = o as THREE.Mesh; if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      expect(mats.every(mat => !mat.transparent && mat.opacity === 1)).toBe(true)
      if (m.name === 'fan-woven-strip') {
        strips++; const bounds = new THREE.Box3().setFromObject(m); expect(bounds.intersectsBox(b)).toBe(true)
        const point = bounds.getCenter(new THREE.Vector3()); point.z = 2
        const front = new THREE.Raycaster(point, new THREE.Vector3(0, 0, -1)).intersectObject(m, false)[0]
        expect(front, 'raised strips must face the viewer').toBeDefined()
        expect(front.point.z, 'the front ray must reach the woven top, not the underside').toBeGreaterThan(.012)
      }
    })
    expect(strips).toBeGreaterThan(30)
    const edge = s.scene.getObjectByName('fan-bound-edge') as THREE.Mesh<THREE.TubeGeometry>
    expect(edge.geometry.parameters.closed).toBe(true)
    expect(new THREE.Box3().setFromObject(edge).intersectsBox(new THREE.Box3().setFromObject(s.scene.getObjectByName('fan-neck-joint')!))).toBe(true)
  })
  it.each([0, 1, 2])('cannot begin through an opaque blocker at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at ? 'fan-handle-grip' : 'fan-binding-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at ? 'fan-display-seat' : 'fan-neck-joint'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at ? 'fan-display-seat' : 'fan-neck-joint'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects an occluded drop at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at ? 'fan-handle-grip' : 'fan-binding-grip', target = at ? 'fan-display-seat' : 'fan-neck-joint'
    const a = s.point(source), b = s.point(target)
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', beforeArrival(s, b))
    const clear = block(s, target); pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it('rejects wrong targets, stationary drags and a tap that travels away and back', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'fan-binding-grip', 'fan-display-seat'); expect(s.progress).toEqual([])
    let p = s.point('fan-binding-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); s.button.click(); s.button.click(); p = s.point('fan-handle-grip')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 30, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause', 'multitouch'])('restores complete groups after %s', event => {
    for (const at of [0, 1]) {
      let active = true
      const s = mount(at, { isReducedMotion: () => true, isActive: () => active }), positions = new Map<THREE.Object3D, THREE.Vector3>()
      s.scene.getObjectByName(at ? 'fan-body' : 'fan-loose-binding')!.traverse(o => positions.set(o, o.getWorldPosition(new THREE.Vector3())))
      const a = s.point(at ? 'fan-handle-grip' : 'fan-binding-grip'), b = s.point(at ? 'fan-display-seat' : 'fan-neck-joint')
      pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', beforeArrival(s, b))
      if (event === 'blur') window.dispatchEvent(new Event('blur'))
      else if (event === 'pause') { active = false; s.run() }
      else if (event === 'multitouch') pointer(document.body, 'pointerdown', [1, 1], 2)
      else pointer(s.hit, event, b)
      pointer(s.hit, 'pointerup', b); pointer(document.body, 'pointerup', [1, 1], 2)
      expect(s.progress).toEqual([])
      for (const [o, p] of positions) expect(o.getWorldPosition(new THREE.Vector3()).distanceTo(p), o.name).toBeLessThan(.00001)
      window.dispatchEvent(new Event('focus'))
    }
  })
  it.each(['blur', 'pause'])('freezes accepted animation on %s and resumes once', event => {
    let active = true
    const s = mount(0, { isActive: () => active }); s.button.click(); s.run(.15)
    const binding = s.scene.getObjectByName('fan-loose-binding')!, pose = binding.position.clone()
    if (event === 'blur') window.dispatchEvent(new Event('blur')); else active = false
    s.run(2); expect(binding.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect((s.host.querySelector('.scene-object-cues') as HTMLElement).hidden).toBe(true)
    active = true; window.dispatchEvent(new Event('focus')); s.run(2); expect(s.progress).toEqual([1])
  })
  it.each([[1, 'dispose'], [3, 'dispose'], [1, 'pause'], [3, 'pause']] as const)('stops after progress %i synchronously triggers %s', (at, effect) => {
    let active = true, frames = -1
    const progress: number[] = []
    const s = mount(at === 1 ? 0 : 2, { isActive: () => active, onProgress(n) {
      progress.push(n); frames = rendered.frames
      if (effect === 'dispose') s.instance.dispose(); else active = false
    } })
    s.button.click(); for (let i = 0; i < 50 && !progress.length; i++) s.instance.update(.025)
    expect(progress).toEqual([at]); expect(rendered.frames).toBe(frames)
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    s.run(); expect(rendered.frames).toBe(frames)
  })
  it.each(['dispose', 'pause'] as const)('stops both pointer and native actions when prepareFeedback triggers %s', effect => {
    for (const input of ['pointer', 'button']) {
      let active = true, armed = false
      const s = mount(0, { isReducedMotion: () => true, isActive: () => active, prepareFeedback() {
        if (!armed) return
        if (effect === 'dispose') s.instance.dispose(); else active = false
      } })
      armed = true
      const binding = s.scene.getObjectByName('fan-loose-binding')!, origin = binding.position.clone(), frames = rendered.frames
      if (input === 'pointer') drag(s, 'fan-binding-grip', 'fan-neck-joint'); else { s.button.click(); s.run() }
      expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
      expect(binding.position.equals(origin)).toBe(true); expect(rendered.frames).toBe(frames)
    }
  })
  it.each(['dispose', 'pause'] as const)('does not complete or render after haptic triggers %s', effect => {
    let active = true
    const s = mount(2, { isActive: () => active, haptic() { if (effect === 'dispose') s.instance.dispose(); else active = false } })
    const frames = rendered.frames; tap(s); s.run()
    expect(s.progress).toEqual([3]); expect(s.complete).not.toHaveBeenCalled(); expect(rendered.frames).toBe(frames)
  })
  it.each(['progress', 'haptic'] as const)('does not consume another action from a normal-motion %s callback', callback => {
    let replay = () => {}
    const progress: number[] = []
    const s = mount(0, { onProgress(n) { progress.push(n); if (callback === 'progress') replay() }, haptic() { if (callback === 'haptic') replay() } })
    replay = () => { s.button.click(); s.instance.update(1) }
    s.button.click(); s.run(4)
    expect(progress).toEqual([1]); expect(s.complete).not.toHaveBeenCalled()
    s.button.click(); s.run(4); expect(progress).toEqual([1, 2])
    s.button.click(); expect(progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('does not consume a second reduced-motion action from prepareFeedback reentry', () => {
    let replay = () => {}, called = false
    const s = mount(0, { isReducedMotion: () => true, prepareFeedback() { if (!called) { called = true; replay() } } })
    replay = () => s.button.dispatchEvent(new Event('click')); s.button.click()
    expect(s.progress).toEqual([1]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('ignores reentrant completion and disposes all owned resources, cues and window listeners once', () => {
    let repeat = () => {}
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(2, { onProgress: () => repeat() }); repeat = () => s.button.click(); tap(s)
    expect(s.complete).toHaveBeenCalledOnce()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>()
    s.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    const cueObjects: THREE.Object3D[] = []; s.scene.traverse(o => { if (o.userData.interactionCues?.length) cueObjects.push(o) })
    s.instance.dispose(); s.instance.dispose(); s.button.click()
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull()
    for (const object of cueObjects) expect(object.userData.interactionCues).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
