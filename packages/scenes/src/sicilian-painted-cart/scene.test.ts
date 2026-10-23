// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
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
function tap(s: ReturnType<typeof mount>) { const p = s.point('cart-rail-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }

function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('a painted cart lifecycle', () => {
  it('offers a visible assembly action without persisting a checkpoint on mount', () => {
    const s = mount(); expect(s.button).not.toBeNull(); expect(s.button.textContent).toBeTruthy(); expect(s.progress).toEqual([])
  })
  it('attaches the wheel, seats the entire cart and finishes once without creating a wish', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'cart-wheel-hub', 'cart-axle-end'); expect(s.progress).toEqual([1])
    drag(s, 'cart-rail-grip', 'cart-display-mat'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    const figure = s.scene.getObjectByName('cart-miniature')!
    const rosette = s.scene.getObjectByName('cart-detached-wheel')!
    expect(rosette.parent?.name).toBe('cart-miniature')
    const base = new THREE.Box3().setFromObject(s.scene.getObjectByName('cart-stand-foot')!)
    const seat = new THREE.Box3().setFromObject(s.scene.getObjectByName('cart-display-mat')!)
    expect(Math.abs(base.min.y - seat.max.y)).toBeLessThan(.008)
    expect(figure.position.x).toBeGreaterThan(.5)
  })
  it('rejects the wrong source, wrong drop and a quiet tap that travels away and returns', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'cart-display-mat', 'cart-rail-grip')
    pointer(s.hit, 'pointerdown', s.point('cart-wheel-hub')); pointer(s.hit, 'pointermove', [1, 1]); pointer(s.hit, 'pointerup', [1, 1])
    expect(s.progress).toEqual([])
    s.button.click(); s.button.click(); const p = s.point('cart-rail-grip')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 35, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through an opaque foreground surface at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'cart-wheel-hub' : 'cart-rail-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'cart-axle-end' : 'cart-display-mat'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'cart-axle-end' : 'cart-display-mat'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects a drop hidden behind another object at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'cart-wheel-hub' : 'cart-rail-grip', target = at === 0 ? 'cart-axle-end' : 'cart-display-mat'
    const a = s.point(source), b = s.point(target)
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b)
    const clear = block(s, target); pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and shares its native action path', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel', 'lostpointercapture'])('discards the detached wheel drag on %s', event => {
    const s = mount(0, { isReducedMotion: () => true }), initial = s.scene.getObjectByName('cart-detached-wheel')!.position.clone()
    const a = s.point('cart-wheel-hub'), b = s.point('cart-axle-end')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, event, b); pointer(s.hit, 'pointerup', b)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('cart-detached-wheel')!.position.equals(initial)).toBe(true)
    drag(s, 'cart-wheel-hub', 'cart-axle-end'); expect(s.progress).toEqual([1])
  })
  it.each([true, false])('rejects mixed pointer input with outside-first=%s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('cart-wheel-hub'), b = s.point('cart-axle-end')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', a)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointerup', b); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'cart-wheel-hub', 'cart-axle-end'); expect(s.progress).toEqual([1])
  })
  it('cancels pending input on host pause and freezes accepted motion while blurred', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), a = s.point('cart-wheel-hub'), b = s.point('cart-axle-end')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); active = false; s.run(); active = true; pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([])
    s.button.click(); s.run(.1); const pose = s.scene.getObjectByName('cart-detached-wheel')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('cart-detached-wheel')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); s.run(2); expect(s.progress).toEqual([1])
  })
  it.each([320, 390, 1280])('hits the first visible source and destination at %ipx', width => {
    const s = mount(0, { isReducedMotion: () => true }, width)
    for (const names of [['cart-wheel-hub', 'cart-axle-end'], ['cart-rail-grip', 'cart-display-mat'], ['cart-rail-grip']]) {
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
  it('rests the cart stand and detached wheel on actual workshop supports', () => {
    const s = mount()
    const bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    expect(Math.abs(bounds('cart-stand-foot').min.y - bounds('cart-table').max.y)).toBeLessThan(.008)
    expect(Math.abs(bounds('cart-detached-wheel').min.y - bounds('cart-wheel-pad').max.y)).toBeLessThan(.008)
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('returns the whole painted cart after %s', event => {
    let active = true
    const s = mount(1, { isReducedMotion: () => true, isActive: () => active })
    const house = s.scene.getObjectByName('cart-miniature')!, panel = s.scene.getObjectByName('cart-detached-wheel')!
    const origin = house.position.clone(), panelOrigin = panel.getWorldPosition(new THREE.Vector3())
    const a = s.point('cart-rail-grip'), b = s.point('cart-display-mat')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b)
    expect(house.position.distanceTo(origin)).toBeGreaterThan(.1)
    if (event === 'blur') window.dispatchEvent(new Event('blur'))
    else if (event === 'pause') { active = false; s.run() }
    else pointer(s.hit, event, b)
    pointer(s.hit, 'pointerup', b)
    expect(house.position.equals(origin)).toBe(true)
    s.scene.updateMatrixWorld(true)
    expect(panel.getWorldPosition(new THREE.Vector3()).distanceTo(panelOrigin)).toBeLessThan(.0001)
    expect(s.progress).toEqual([])
  })
  it('cannot use the cart floor as the axle destination or accept a stationary drag', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'cart-wheel-hub', 'cart-floor')
    const p = s.point('cart-wheel-hub'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([])
  })
  it('connects every painted spoke from the hub into the rim with its band on the wood', () => {
    const s = mount()
    for (const name of ['cart-detached-wheel', 'cart-far-wheel']) {
      const wheel = s.scene.getObjectByName(name)!, hub = s.scene.getObjectByName(name + '-hub-body')!
      const bounds = (o: THREE.Object3D) => new THREE.Box3().setFromObject(o)
      for (let i = 0; i < 12; i++) {
        const spoke = s.scene.getObjectByName(name + '-spoke-' + i) as THREE.Mesh
        const band = s.scene.getObjectByName(name + '-spoke-band-' + i)!
        expect(bounds(spoke).intersectsBox(bounds(hub)), spoke.name).toBe(true)
        expect(bounds(spoke).expandByScalar(.001).intersectsBox(bounds(band)), band.name).toBe(true)
        const vertices = spoke.geometry.attributes.position, radial: number[] = []
        for (let v = 0; v < vertices.count; v++) {
          const p = wheel.worldToLocal(spoke.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, v)))
          radial.push(Math.hypot(p.x, p.y))
        }
        expect(Math.min(...radial)).toBeLessThan(.135)
        expect(Math.max(...radial)).toBeGreaterThan(.403)
        expect(Math.max(...radial)).toBeLessThan(.5)
      }
    }
  })
  it('supports the assembled cart with connected chassis, through axle and two grounded wheels', () => {
    const s = mount(1, { isReducedMotion: () => true })
    const bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    const axle = bounds('cart-through-axle'), floor = bounds('cart-floor'), cradle = bounds('cart-axle-cradle')
    expect(axle.intersectsBox(bounds('cart-far-wheel-hub-body'))).toBe(true)
    expect(axle.intersectsBox(bounds('cart-detached-wheel-hub-body'))).toBe(true)
    expect(axle.intersectsBox(cradle)).toBe(true)
    s.scene.traverse(o => {
      if (o.name === 'cart-chassis-rail') {
        const rail = new THREE.Box3().setFromObject(o)
        expect(rail.intersectsBox(cradle)).toBe(true)
        expect(rail.expandByScalar(.001).intersectsBox(floor)).toBe(true)
      }
      if (o.name === 'cart-stand-upright') {
        const upright = new THREE.Box3().setFromObject(o)
        expect(upright.intersectsBox(cradle)).toBe(true)
        expect(upright.expandByScalar(.001).intersectsBox(bounds('cart-stand-foot'))).toBe(true)
      }
    })
    for (const name of ['cart-detached-wheel-rim', 'cart-far-wheel-rim']) {
      expect(Math.abs(bounds(name).min.y - bounds('cart-table').max.y)).toBeLessThan(.002)
    }
    const wheel = s.scene.getObjectByName('cart-detached-wheel')!, original = wheel.position.clone()
    drag(s, 'cart-rail-grip', 'cart-display-mat')
    expect(wheel.parent?.name).toBe('cart-miniature'); expect(wheel.position.equals(original)).toBe(true)
    for (const name of ['cart-detached-wheel-rim', 'cart-far-wheel-rim', 'cart-stand-foot']) {
      expect(Math.abs(bounds(name).min.y - bounds('cart-display-mat').max.y)).toBeLessThan(.002)
      expect(bounds(name).min.x).toBeGreaterThanOrEqual(bounds('cart-display-mat').min.x)
      expect(bounds(name).max.x).toBeLessThanOrEqual(bounds('cart-display-mat').max.x)
      expect(bounds(name).min.z).toBeGreaterThanOrEqual(bounds('cart-display-mat').min.z)
      expect(bounds(name).max.z).toBeLessThanOrEqual(bounds('cart-display-mat').max.z)
    }
  })
  it('keeps painted fields and carrying rail connected to substantial cargo walls', () => {
    const s = mount(), cart = s.scene.getObjectByName('cart-miniature')!
    const boxes = (name: string) => {
      const result: THREE.Box3[] = []; cart.traverse(o => { if (o.name === name) result.push(new THREE.Box3().setFromObject(o)) }); return result
    }
    for (const wall of boxes('cart-side-wall')) {
      expect(wall.getSize(new THREE.Vector3()).z).toBeGreaterThan(.065)
      expect(wall.expandByScalar(.002).intersectsBox(boxes('cart-floor')[0])).toBe(true)
    }
    for (const [child, parent] of [['cart-panel-border', 'cart-side-wall'], ['cart-teal-panel', 'cart-panel-border'], ['cart-panel-gold-band', 'cart-teal-panel'], ['cart-panel-cream-band', 'cart-teal-panel'], ['cart-grip-post', 'cart-top-rail'], ['cart-rail-grip', 'cart-grip-post'], ['cart-draw-shaft', 'cart-chassis-rail'], ['cart-shaft-crosspiece', 'cart-draw-shaft']]) {
      for (const part of boxes(child)) expect(boxes(parent).some(base => part.clone().expandByScalar(.002).intersectsBox(base)), child).toBe(true)
    }
  })
  it.each([-1, NaN, Infinity, 9])('normalizes invalid restored progress %s without emitting feedback', at => {
    const s = mount(at); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(at === 9)
    expect(s.scene.getObjectByName('cart-detached-wheel')!.parent?.name).toBe(at === 9 ? 'cart-miniature' : 'cart-workbench')
  })
  it('stops work when a progress callback disposes the scene', () => {
    let dispose: (() => void) | undefined
    const s = mount(2, { isReducedMotion: () => true, onProgress: () => dispose?.() })
    dispose = () => s.instance.dispose()
    tap(s); s.instance.update(.025)
    expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.overlay.childElementCount).toBe(0)
  })
  it('guards completion before a reentrant progress callback and never exposes a writer', () => {
    let action: (() => void) | undefined
    const onProgress = vi.fn(() => action?.()), s = mount(2, { isReducedMotion: () => true, onProgress })
    action = () => s.button.click()
    tap(s); s.button.click()
    expect(onProgress).toHaveBeenCalledOnce(); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.overlay.querySelector('input, textarea, form')).toBeNull(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['progress', 'feedback'])('suppresses completion when the terminal %s callback pauses the host, without replay on resume', source => {
    let active = true
    const progress = vi.fn(() => { if (source === 'progress') active = false })
    const haptic = vi.fn(() => { if (source === 'feedback') active = false })
    const s = mount(2, { isActive: () => active, onProgress: progress, haptic })
    const frames = rendered.frames
    tap(s)
    expect(progress).toHaveBeenCalledExactlyOnceWith(3)
    expect(haptic).toHaveBeenCalledTimes(source === 'feedback' ? 1 : 0)
    expect(s.complete).not.toHaveBeenCalled(); expect(rendered.frames).toBe(frames)
    active = true; s.instance.update(.025); tap(s); s.button.click()
    expect(progress).toHaveBeenCalledOnce(); expect(s.complete).not.toHaveBeenCalled(); expect(s.button.hidden).toBe(true)
    expect(haptic).toHaveBeenCalledTimes(source === 'feedback' ? 1 : 0)
  })
  it.each(['pause', 'dispose'])('stops the settling update after a progress callback requests %s', interruption => {
    let active = true, interrupted = false, framesAtCallback = 0, dispose: (() => void) | undefined
    const s = mount(0, { isActive: () => active, onProgress: () => {
      interrupted = true; framesAtCallback = rendered.frames
      if (interruption === 'pause') active = false; else dispose?.()
    } })
    dispose = () => s.instance.dispose()
    s.button.click()
    for (let i = 0; i < 40 && !interrupted; i++) s.instance.update(.025)
    expect(interrupted).toBe(true); expect(rendered.frames).toBe(framesAtCallback)
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })
  it.each([[284, 390], [350, 408]])('frames every cart and wheel vertex inside the actual %ix%i phone canvas at all checkpoints', (width, height) => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width, height), roots = [s.scene.getObjectByName('cart-miniature')!]
      if (at === 0) roots.push(s.scene.getObjectByName('cart-detached-wheel')!)
      for (const root of roots) root.traverseVisible(o => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
        const vertices = mesh.geometry.attributes.position
        let maxX = 0, maxY = 0
        for (let i = 0; i < vertices.count; i++) {
          const p = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i)).project(s.camera)
          maxX = Math.max(maxX, Math.abs(p.x)); maxY = Math.max(maxY, Math.abs(p.y))
        }
        expect(maxX, `${at}:${mesh.name}:x`).toBeLessThan(.95)
        expect(maxY, `${at}:${mesh.name}:y`).toBeLessThan(.95)
      })
    }
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

describe('forgiving visible cart controls',()=>{
  it('grabs a wheel spoke and previews the nearby axle drop',()=>{
    const s=mount(0,{isReducedMotion:()=>true}),a=s.point('cart-detached-wheel-spoke-0'),b=s.point('cart-axle-end');
    const near:[number,number]=[b[0]+14,b[1]];
    pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',near);
    expect(s.overlay.textContent).toContain('可以松手');
    pointer(s.hit,'pointerup',near);s.run();expect(s.progress).toEqual([1]);
  });
  it('can grab within eighteen pixels of the narrow rail without accepting distant space',()=>{
    const s=mount(1,{isReducedMotion:()=>true}),a=s.point('cart-rail-grip'),b=s.point('cart-display-mat');
    pointer(s.hit,'pointerdown',[a[0],a[1]-18]);pointer(s.hit,'pointermove',b);pointer(s.hit,'pointerup',b);s.run();expect(s.progress).toEqual([2]);
  });
});

it.each(['pointercancel', 'blur', 'pause'])('clears the ready drop after %s without completing it', reason => {
  let active = true
  const s = mount(0, { isActive: () => active, isReducedMotion: () => true })
  const from = s.point('cart-wheel-hub'), target = s.point('cart-axle-end')
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', target)
  expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBe('true')
  pointer(s.hit, 'pointermove', [1, 1])
  expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBeUndefined()
  pointer(s.hit, 'pointermove', target)
  expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBe('true')
  if (reason === 'blur') window.dispatchEvent(new Event('blur'))
  else if (reason === 'pause') { active = false; s.run(.05) }
  else pointer(s.hit, 'pointercancel', target)
  expect(s.overlay.querySelector<HTMLElement>('.scene-hint')!.dataset.dropReady).toBeUndefined()
  pointer(s.hit, 'pointerup', target); s.run()
  expect(s.progress).toEqual([])
})
