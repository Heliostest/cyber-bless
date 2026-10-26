// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown }))
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
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  const height = width === 1280 ? 408 : 390, left = 17, top = 89
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, shared: Shared, gestures: Gestures, initialProgress: at, isSoundEnabled: () => false,
    onProgress: n => progress.push(n), saveWish, haptic, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const point = (name: string): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, overlay, host, hit, button, point, run, progress, saveWish, complete, haptic }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  if (type === 'pointerdown') pendingStarts.set(el, [clientX,clientY] as [number, number])

  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}
function drag(s: ReturnType<typeof mount>, source: string, target: string) {
  const a = s.point(source), b = destinationPoint(s, source, target)
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function destinationPoint(s: ReturnType<typeof mount>, source: string, target: string): [number, number] {
  const cue = (s.scene.getObjectByName(source)!.userData.interactionCues as InteractionCue[] | undefined)?.find(c => c.enabled() && c.kind === 'drag' && c.destination)
  if (!cue || typeof cue.destination !== 'function') return s.point(target)
  const p = cue.destination().project(s.camera), r = s.host.querySelector('canvas')!.getBoundingClientRect()
  return [r.left+(p.x+1)*r.width/2,r.top+(1-p.y)*r.height/2]
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('birch-rim-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('a woven birch basket kept as everyday craft', () => {
  it('attaches the handle, places the basket and finishes once without creating a wish', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.scene.getObjectByName('birch-basket')).toBeDefined()
    drag(s, 'birch-handle-grip', 'birch-rim-grip'); expect(s.progress).toEqual([1])
    drag(s, 'birch-rim-grip', 'birch-display-mat'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    const basket = s.scene.getObjectByName('birch-basket')!, mat = s.scene.getObjectByName('birch-display-mat')!
    expect(basket.position.x).toBeCloseTo(mat.position.x)
    expect(new THREE.Box3().setFromObject(basket).min.y).toBeCloseTo(new THREE.Box3().setFromObject(mat).max.y, 3)
    expect(s.scene.getObjectByName('birch-handle')!.parent).toBe(basket)
  })
  it('rejects the wrong source, wrong drop and a quiet tap that travels away and returns', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'birch-display-mat', 'birch-rim-grip')
    pointer(s.hit, 'pointerdown', s.point('birch-handle-grip')); pointer(s.hit, 'pointermove', [1, 1]); pointer(s.hit, 'pointerup', [1, 1])
    expect(s.progress).toEqual([])
    s.button.click(); s.button.click(); const p = s.point('birch-rim-grip')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 35, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('ignores a non-owner release and can recover after cancellation', () => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('birch-handle-grip')
    const b = s.point('birch-rim-grip')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', pendingPoint(s.hit, b)); pointer(s.hit, 'pointerup', b, 9)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointercancel', b); drag(s, 'birch-handle-grip', 'birch-rim-grip')
    expect(s.progress).toEqual([1])
  })
  it.each([{ pixels: 0, progress: [] }, { pixels: 2, progress: [2] }, { pixels: 7, progress: [2] }])('accepts a nearby destination after nonzero travel: $pixels', ({ pixels, progress }) => {
    const s = mount(1, { isReducedMotion: () => true }), a = s.point('birch-rim-grip'), b: [number, number] = [a[0] + pixels, a[1]]
    pointer(s.hit, 'pointerdown', a)
    const mat = s.scene.getObjectByName('birch-display-mat')!, basket = s.scene.getObjectByName('birch-basket')!
    const ray = new THREE.Raycaster(), ndc = (q: [number,number]) => new THREE.Vector2((q[0]-17)/390*2-1,1-(q[1]-89)/390*2)
    const grip = s.scene.getObjectByName('birch-rim-grip')!.getWorldPosition(new THREE.Vector3()), plane = new THREE.Plane().setFromNormalAndCoplanarPoint(s.camera.getWorldDirection(new THREE.Vector3()),grip)
    ray.setFromCamera(ndc(a),s.camera); const from = ray.ray.intersectPlane(plane,new THREE.Vector3())!
    ray.setFromCamera(ndc(b),s.camera); const to = ray.ray.intersectPlane(plane,new THREE.Vector3())!
    const bottom = basket.getWorldPosition(new THREE.Vector3()).add(to.sub(from)).project(s.camera)
    ray.setFromCamera(new THREE.Vector2(bottom.x,bottom.y),s.camera)
    const p = ray.ray.intersectPlane(new THREE.Plane(new THREE.Vector3(0,1,0),-.755),new THREE.Vector3())!
    mat.position.set(p.x, .7375, p.z); s.scene.updateMatrixWorld(true)
    const visible: THREE.Object3D[] = []
    s.scene.traverseVisible(object => {
      if (!(object instanceof THREE.Mesh)) return
      for (let ancestor: THREE.Object3D | null = object; ancestor; ancestor = ancestor.parent) if (ancestor === basket) return
      visible.push(object)
    })
    expect(ray.intersectObjects(visible, false)[0]?.object).toBe(mat)
    pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b)
    expect(s.progress).toEqual(progress)
  })
  it.each([0, 1, 2, 3])('keeps the hollow basket, grains and handle physically supported at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true })
    const basket = s.scene.getObjectByName('birch-basket')!, handle = s.scene.getObjectByName('birch-handle')!
    const support = s.scene.getObjectByName(at < 2 ? 'birch-bench-top' : 'birch-display-mat')!
    const base = new THREE.Box3().setFromObject(s.scene.getObjectByName('birch-basket-base')!)
    expect(base.min.y).toBeCloseTo(new THREE.Box3().setFromObject(support).max.y, 3)
    if (at === 0) expect(new THREE.Box3().setFromObject(handle).min.y).toBeCloseTo(new THREE.Box3().setFromObject(support).max.y, 3)
    else {
      expect(handle.parent).toBe(basket)
      for (const name of ['birch-handle-foot-left', 'birch-handle-foot-right']) {
        const foot = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!), sample = new THREE.Vector3()
        let contact = false
        s.scene.getObjectByName('birch-rim')!.traverse(object => {
          if (!(object instanceof THREE.Mesh)) return
          const positions = object.geometry.getAttribute('position')
          for (let i = 0; i < positions.count; i++) if (foot.containsPoint(sample.fromBufferAttribute(positions, i).applyMatrix4(object.matrixWorld))) contact = true
        })
        expect(contact, `${name} must overlap actual rim geometry`).toBe(true)
      }
    }
    const ray = new THREE.Raycaster(new THREE.Vector3(basket.position.x + .32, 3, basket.position.z + .05), new THREE.Vector3(0, -1, 0))
    const surface = ray.intersectObject(basket, true)[0]
    expect(surface.point.y).toBeLessThan(basket.position.y + .22)
    expect(surface.point.y).toBeGreaterThanOrEqual(base.max.y - .005)
    const grain = new THREE.Box3().setFromObject(s.scene.getObjectByName('birch-grain-0')!)
    expect(grain.min.y).toBeGreaterThanOrEqual(base.max.y - .001)
    expect(grain.max.y).toBeLessThan(basket.position.y + .2)
  })
  it.each([0, 1, 2])('does not start through an opaque foreground surface at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'birch-handle-grip' : 'birch-rim-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'birch-rim-grip' : 'birch-display-mat'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'birch-rim-grip' : 'birch-display-mat'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects a drop hidden behind another object at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'birch-handle-grip' : 'birch-rim-grip', target = at === 0 ? 'birch-rim-grip' : 'birch-display-mat'
    const a = s.point(source), b = destinationPoint(s, source, target)
    const clear = block(s, target); pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b)
     pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and shares its native action path', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel', 'lostpointercapture'])('discards a handle drag on %s', event => {
    const s = mount(0, { isReducedMotion: () => true }), initial = s.scene.getObjectByName('birch-handle')!.position.clone()
    const a = s.point('birch-handle-grip'), b = s.point('birch-rim-grip')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', pendingPoint(s.hit, b)); pointer(s.hit, event, b); pointer(s.hit, 'pointerup', b)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('birch-handle')!.position.equals(initial)).toBe(true)
    drag(s, 'birch-handle-grip', 'birch-rim-grip'); expect(s.progress).toEqual([1])
  })
  it.each([true, false])('rejects mixed pointer input with outside-first=%s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('birch-handle-grip'), b = s.point('birch-rim-grip')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', a)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointerup', b); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'birch-handle-grip', 'birch-rim-grip'); expect(s.progress).toEqual([1])
  })
  it('cancels pending input on host pause and freezes accepted motion while blurred', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), a = s.point('birch-handle-grip'), b = s.point('birch-rim-grip')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', pendingPoint(s.hit, b)); active = false; s.run(); active = true; pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([])
    s.button.click(); s.run(.1); const pose = s.scene.getObjectByName('birch-handle')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('birch-handle')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); s.run(2); expect(s.progress).toEqual([1])
  })
  it.each([320, 390, 1280])('hits the first visible source and destination at %ipx', width => {
    const s = mount(0, { isReducedMotion: () => true }, width)
    for (const names of [['birch-handle-grip', 'birch-rim-grip'], ['birch-rim-grip', 'birch-display-mat'], ['birch-rim-grip']]) {
      s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
      for (const name of names) {
        const object = s.scene.getObjectByName(name)!, p = object.getWorldPosition(new THREE.Vector3()).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
        expect(Math.abs(p.x)).toBeLessThan(.94); expect(Math.abs(p.y)).toBeLessThan(.94)
        expect(ray.intersectObjects(visible, false)[0]?.object, name).toBe(object)
      }
      if (names.length === 2) drag(s, names[0], names[1]); else tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it('disposes all mesh resources and owned window listeners once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>()
    s.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click()
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0)
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})

// Cancellation happens before arrival; a completed placement already owns its result.
const pendingStarts = new WeakMap<HTMLElement, [number, number]>()
function pendingPoint(layer: HTMLElement, point: [number, number]): [number, number] {
 const start = pendingStarts.get(layer) ?? point
 return [start[0]+(point[0]-start[0])*.20,start[1]+(point[1]-start[1])*.20]
}
