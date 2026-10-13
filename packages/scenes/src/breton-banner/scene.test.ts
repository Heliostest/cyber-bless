// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only GPU work is replaced; geometry, materials, raycasting and cues remain real.
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
  expect(hit, 'the cloth banner exposes physical input').not.toBeNull()
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
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}
function drag(s: ReturnType<typeof mount>, source = 'banner-hem-tab', target = 'banner-crossbar-clip') {
  const a = s.point(source), b = s.point(target)
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('banner-staff-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.5, .5), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}
function clothWidth(s: ReturnType<typeof mount>) { return new THREE.Box3().setFromObject(s.scene.getObjectByName('banner-cloth')!).getSize(new THREE.Vector3()).x }
function enabledCues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}

describe('an original contemporary cloth banner', () => {
  it('unfurls the pleated cloth, seats the staff and finishes once without a wish', () => {
    const s = mount(0, { isReducedMotion: () => true }), folded = clothWidth(s)
    drag(s); expect(s.progress).toEqual([1]); expect(clothWidth(s)).toBeGreaterThan(folded * 3)
    drag(s, 'banner-staff-grip', 'banner-stand-socket'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input')).toBeNull()
  })
  it('rejects wrong objects, wrong destinations and insufficient movement', () => {
    const s = mount(0, { isReducedMotion: () => true }), folded = clothWidth(s)
    drag(s, 'banner-staff-grip'); drag(s, 'banner-hem-tab', 'banner-stand-socket')
    const p = s.point('banner-hem-tab'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); expect(clothWidth(s)).toBeCloseTo(folded)
    s.button.click(); s.button.click(); const q = s.point('banner-staff-grip')
    pointer(s.hit, 'pointerdown', q); pointer(s.hit, 'pointermove', [q[0] + 24, q[1]]); pointer(s.hit, 'pointermove', q); pointer(s.hit, 'pointerup', q)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through a foreground mesh at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'banner-hem-tab' : 'banner-staff-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'banner-crossbar-clip' : 'banner-stand-socket'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'banner-crossbar-clip' : 'banner-stand-socket'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects a destination hidden by a non-held mesh at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'banner-hem-tab' : 'banner-staff-grip', target = at === 0 ? 'banner-crossbar-clip' : 'banner-stand-socket'
    const a = s.point(source), b = s.point(target)
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b)
    const clear = block(s, target); pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('silently restores %i and uses the same native action path', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { isReducedMotion: () => true, returning }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(s.overlay.querySelector('input')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
      expect(enabledCues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.button.tagName).toBe('BUTTON'); expect(s.button.type).toBe('button')
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('restores an unfinished unfurl on %s', kind => {
    let active = true; const s = mount(0, { isReducedMotion: () => true, isActive: () => active }), initial = clothWidth(s)
    const a = s.point('banner-hem-tab'), b = s.point('banner-crossbar-clip')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b)
    expect(clothWidth(s)).toBeGreaterThan(initial)
    if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else if (kind === 'pause') { active = false; s.run() }
    else pointer(s.hit, kind, b)
    pointer(s.hit, 'pointerup', b)
    expect(s.progress).toEqual([]); expect(clothWidth(s)).toBeCloseTo(initial)
    active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s); expect(s.progress).toEqual([1])
  })
  it.each([true, false])('rejects mixed pointers with outside-first=%s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('banner-hem-tab'), b = s.point('banner-crossbar-clip')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', a)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted unfolding and placement through host pause or blur', () => {
    let active = true; const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(.15); const width = clothWidth(s)
    active = false; s.run(2); expect(clothWidth(s)).toBe(width); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    active = true; s.run(2); expect(s.progress).toEqual([1]); s.button.click(); s.run(.15)
    const pose = s.scene.getObjectByName('banner-assembly')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('banner-assembly')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([1])
    window.dispatchEvent(new Event('focus')); s.run(2); expect(s.progress).toEqual([1, 2])
  })
  it('deforms real cloth vertices while its fixed hem remains attached to the crossbar', () => {
    const s = mount(), mesh = s.scene.getObjectByName('banner-cloth') as THREE.Mesh
    const before = Array.from(mesh.geometry.getAttribute('position').array)
    s.button.click(); s.run(.3)
    const during = Array.from(mesh.geometry.getAttribute('position').array)
    expect(during).not.toEqual(before); expect(mesh.scale.toArray()).toEqual([1, 1, 1])
    const anchor = s.scene.getObjectByName('banner-fixed-hem')!.getWorldPosition(new THREE.Vector3())
    const fixed = s.scene.getObjectByName('banner-crossbar-left-tie')!.getWorldPosition(new THREE.Vector3())
    expect(anchor.distanceTo(fixed)).toBeLessThan(.03)
    s.run(2); expect(s.progress).toEqual([1])
  })
  it('rests on the workbench, then inserts its foot into the visible stand socket', () => {
    const start = mount(), foot = new THREE.Box3().setFromObject(start.scene.getObjectByName('banner-staff')!)
    const table = new THREE.Box3().setFromObject(start.scene.getObjectByName('banner-workbench')!)
    expect(foot.min.y).toBeCloseTo(table.max.y, 3)
    for (const at of [2, 3]) {
      const s = mount(at), staff = new THREE.Box3().setFromObject(s.scene.getObjectByName('banner-staff')!)
      const floor = new THREE.Box3().setFromObject(s.scene.getObjectByName('banner-stand-socket')!)
      expect(staff.min.y).toBeCloseTo(floor.max.y, 3)
      expect(staff.getCenter(new THREE.Vector3()).x).toBeCloseTo(floor.getCenter(new THREE.Vector3()).x)
      expect(staff.getCenter(new THREE.Vector3()).z).toBeCloseTo(floor.getCenter(new THREE.Vector3()).z)
      const base = new THREE.Box3().setFromObject(s.scene.getObjectByName('banner-stand-base')!)
      expect(base.min.y).toBeCloseTo(table.max.y, 3)
    }
  })
  it.each([0, 1])('keeps the sun paint on the cloth surface at checkpoint %i', at => {
    const s = mount(at), sun = s.scene.getObjectByName('banner-original-sun') as THREE.Mesh
    const fabric = s.scene.getObjectByName('banner-cloth') as THREE.Mesh
    const p = sun.geometry.getAttribute('position'), indices = sun.geometry.index!
    for (let i = 0; i < indices.count; i += 3) for (const weights of [[1 / 3, 1 / 3, 1 / 3], [.12, .18, .7], [.15, .7, .15]]) {
      const center = new THREE.Vector3()
      for (let k = 0; k < 3; k++) center.addScaledVector(new THREE.Vector3().fromBufferAttribute(p, indices.getX(i + k)), weights[k])
      sun.localToWorld(center); center.z += 1
      const ray = new THREE.Raycaster(center, new THREE.Vector3(0, 0, -1))
      expect(ray.intersectObjects([sun, fabric], false)[0]?.object.name).toBe('banner-original-sun')
    }
  })
  it.each([320, 390, 1280])('projects each cue onto the first visible source and target at %ipx', width => {
    const s = mount(0, { isReducedMotion: () => true }, width)
    for (let at = 0; at < 3; at++) {
      s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
      for (const { object, cue } of enabledCues(s)) {
        for (const target of [object, ...(cue.destination instanceof THREE.Object3D ? [cue.destination] : [])]) {
          const p = target.getWorldPosition(new THREE.Vector3()).project(s.camera)
          const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
          const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
          expect(Math.abs(p.x)).toBeLessThan(.94); expect(Math.abs(p.y)).toBeLessThan(.94)
          expect(ray.intersectObjects(visible, false)[0]?.object.name, target.name).toBe(target.name)
        }
      }
      if (at === 0) drag(s); else if (at === 1) drag(s, 'banner-staff-grip', 'banner-stand-socket'); else tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it('disposes meshes, shadows, cues, listeners and renderer exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>(), shadows: number[] = []
    s.scene.traverse(o => {
      const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry)
      for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat)
      if (o instanceof THREE.DirectionalLight) { const i = shadows.length; shadows.push(0); o.shadow.map = new THREE.WebGLRenderTarget(8, 8); o.shadow.map.addEventListener('dispose', () => shadows[i]++) }
    })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click(); s.instance.update(5)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0)
    expect(s.host.querySelector('.scene-object-cues')).toBeNull()
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
