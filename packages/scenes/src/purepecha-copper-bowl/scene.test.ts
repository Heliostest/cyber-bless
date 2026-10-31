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
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
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
const bowlAnchor = new THREE.Vector3(0, .43, .705)
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
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const worldPoint = (name: string) => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    return scene.getObjectByName(name)!.localToWorld(name === 'copper-bowl-shell' ? bowlAnchor.clone() : new THREE.Vector3())
  }
  const point = (name: string): [number, number] => {
    const p = worldPoint(name).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const bounds = (name: string) => new THREE.Box3().setFromObject(scene.getObjectByName(name)!)
  return { instance, scene, camera, overlay, host, hit, button, point, worldPoint, bounds, run, progress, saveWish, complete, haptic }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}

function dropPoint(s: ReturnType<typeof mount>, source: string, target: string): [number,number] {
 const pairs=[["copper-polishing-pad","copper-bowl-shell"],["copper-bowl-shell","copper-display-felt"]];if(!pairs.some(pair=>pair[0]===source&&pair[1]===target))return s.point(target)
 const list: {object:THREE.Object3D;cue:InteractionCue}[]=[];s.scene.traverse(object=>{for(const cue of object.userData.interactionCues??[])if(cue.enabled()&&cue.kind==='drag')list.push({object,cue})})
 const c=list[0];if(!c?.cue.destination)return s.point(target)
 const r=s.host.querySelector('canvas')!.getBoundingClientRect(), project=(p:THREE.Vector3):[number,number]=>{const q=p.project(s.camera);return[r.left+(q.x+1)*r.width/2,r.top+(1-q.y)*r.height/2]}
 const d=c.cue.destination,a=project(c.object.localToWorld(new THREE.Vector3(...(c.cue.anchor??[0,0,0])))),b=project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3())),p=s.point(source)
 return[p[0]+b[0]-a[0],p[1]+b[1]-a[1]]
}
function beforeArrival(a: readonly number[], b: readonly number[]): [number,number] {return[a[0]+(b[0]-a[0])*.2,a[1]+(b[1]-a[1])*.2]}

function drag(s: ReturnType<typeof mount>, source: string, target: string) {
  const a = s.point(source), b = dropPoint(s, source, target)
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('copper-bowl-shell'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.45, .45), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  mesh.position.lerpVectors(s.worldPoint(name), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}
const sourceAt = (at: number) => at === 0 ? 'copper-polishing-pad' : 'copper-bowl-shell'
const targetAt = (at: number) => at === 0 ? 'copper-bowl-shell' : 'copper-display-felt'

describe('an original contemporary copper bowl appreciation exercise', () => {
  it('offers a polishing action without persisting a checkpoint on mount', () => {
    const s = mount(); expect(s.button).not.toBeNull(); expect(s.button.textContent).toBeTruthy(); expect(s.progress).toEqual([])
  })
  it('polishes, places the bowl in its felt cradle and quietly finishes only once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'copper-polishing-pad', 'copper-bowl-shell'); expect(s.progress).toEqual([1])
    drag(s, 'copper-bowl-shell', 'copper-display-felt'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(Math.abs(s.bounds('copper-bowl').min.y - s.bounds('copper-display-felt').max.y)).toBeLessThan(.008)
    expect(s.scene.getObjectByName('copper-bowl')!.position.x).toBeGreaterThan(.5)
    expect(Math.abs(s.bounds('copper-pad-group').min.y - s.bounds('copper-pad-rest').max.y)).toBeLessThan(.008)
  })
  it('rejects the wrong source, wrong drop, unmoved pad and a final tap that travels away and returns', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'copper-display-felt', 'copper-bowl-shell')
    let p = s.point('copper-polishing-pad'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [1, 1]); pointer(s.hit, 'pointerup', [1, 1]); expect(s.progress).toEqual([])
    s.button.click(); s.button.click(); p = s.point('copper-bowl-shell')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 35, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through a visible foreground surface at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), clear = block(s, sourceAt(at))
    if (at < 2) drag(s, sourceAt(at), targetAt(at)); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, sourceAt(at), targetAt(at)); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects a drop hidden behind another object at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), a = s.point(sourceAt(at)), b = s.point(targetAt(at))
    pointer(s.hit, 'pointerdown', a); const clear = block(s, targetAt(at)); pointer(s.hit, 'pointermove', b)
    pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, sourceAt(at), targetAt(at)); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently without constructing a wish form', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('form,input,textarea')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause', 'multitouch'])('resets the complete pad and bowl assemblies after %s', event => {
    let active = true
    const s = mount(0, { isReducedMotion: () => true, isActive: () => active })
    for (const at of [0, 1]) {
      const group = s.scene.getObjectByName(at === 0 ? 'copper-pad-group' : 'copper-bowl')!, pose = group.position.clone(), rotation = group.quaternion.clone()
      const a = s.point(sourceAt(at)), b = s.point(targetAt(at))
      pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', beforeArrival(a,b))
      if (event === 'blur') { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) }
      else if (event === 'pause') { active = false; s.run(); active = true; s.run() }
      else if (event === 'multitouch') { pointer(document.body, 'pointerdown', [1, 1], 2); pointer(document.body, 'pointerup', [1, 1], 2) }
      else pointer(s.hit, event, b)
      pointer(s.hit, 'pointerup', b)
      expect(group.position.equals(pose)).toBe(true); expect(group.quaternion.equals(rotation)).toBe(true)
      expect(s.progress).toEqual(at === 0 ? [] : [1]); s.button.click()
    }
  })
  it('freezes accepted animation while inactive and prevents completion callback reentrancy', () => {
    let active = true, s: ReturnType<typeof mount>
    s = mount(0, { isActive: () => active, onProgress: n => { s.progress.push(n); if (n === 3) { s.button.click(); tap(s) } } })
    s.button.click(); s.run(.1); active = false; const pose = s.scene.getObjectByName('copper-pad-group')!.position.clone(); s.run(2)
    expect(s.scene.getObjectByName('copper-pad-group')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    active = true; s.run(2); s.button.click(); s.run(2); tap(s)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([320, 390, 1280])('keeps actual cue anchors ray-hittable and camera safe at %ipx', width => {
    const s = mount(0, { isReducedMotion: () => true }, width)
    for (const at of [0, 1, 2]) {
      for (const name of at === 2 ? [sourceAt(at)] : [sourceAt(at), targetAt(at)]) {
        const object = s.scene.getObjectByName(name)!, p = s.worldPoint(name).project(s.camera), ray = new THREE.Raycaster()
        ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
        expect(Math.abs(p.x)).toBeLessThan(.94); expect(Math.abs(p.y)).toBeLessThan(.94)
        expect(ray.intersectObjects(visible, false)[0]?.object, name).toBe(object)
      }
      expect(s.host.querySelector('[data-cue-role="source"]')).not.toBeNull()
      if (at < 2) drag(s, sourceAt(at), targetAt(at)); else tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it('forms a thick hollow basin with an open mouth, deep concavity and visible outer front', () => {
    const s = mount(), bowl = s.scene.getObjectByName('copper-bowl')!, shell = s.scene.getObjectByName('copper-bowl-shell')!
    const downward = (x: number) => new THREE.Raycaster(bowl.localToWorld(new THREE.Vector3(x, 2, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(shell, false)[0]
    const center = downward(0), side = downward(.60)
    expect(center).toBeDefined(); expect(side).toBeDefined()
    expect(bowl.worldToLocal(center.point.clone()).y).toBeGreaterThan(.045)
    expect(bowl.worldToLocal(center.point.clone()).y).toBeLessThan(.12)
    expect(bowl.worldToLocal(side.point.clone()).y).toBeGreaterThan(.27)
    const outside = new THREE.Raycaster(bowl.localToWorld(new THREE.Vector3(0, .30, 2)), new THREE.Vector3(0, 0, -1)).intersectObject(shell, false)[0]
    expect(bowl.worldToLocal(outside.point.clone()).z).toBeGreaterThan(.55)
    const under = new THREE.Raycaster(bowl.localToWorld(new THREE.Vector3(0, -1, 0)), new THREE.Vector3(0, 1, 0)).intersectObject(shell, false)[0]
    expect(bowl.worldToLocal(under.point.clone()).y).toBeLessThan(.01)
  })
  it('supports every resting object and joins the rolled lip to the metal shell', () => {
    const s = mount(), tableTop = s.bounds('copper-table').max.y
    expect(Math.abs(s.bounds('copper-work-felt').min.y - tableTop)).toBeLessThan(.004)
    expect(Math.abs(s.bounds('copper-bowl').min.y - s.bounds('copper-work-felt').max.y)).toBeLessThan(.004)
    expect(Math.abs(s.bounds('copper-pad-group').min.y - s.bounds('copper-pad-rest').max.y)).toBeLessThan(.004)
    expect(Math.abs(s.bounds('copper-display-wood').min.y - tableTop)).toBeLessThan(.004)
    expect(Math.abs(s.bounds('copper-display-felt').min.y - s.bounds('copper-display-wood').max.y)).toBeLessThan(.004)
    const rim = s.scene.getObjectByName('copper-rolled-lip')!, shell = s.scene.getObjectByName('copper-bowl-shell')!
    expect(rim.parent).toBe(shell.parent); expect(s.bounds('copper-rolled-lip').intersectsBox(s.bounds('copper-bowl-shell'))).toBe(true)
    expect(shell.userData.toonSurface.metalness).toBeGreaterThan(.4)
    const meshes: THREE.Mesh[] = []; shell.parent!.traverse(o => { if ((o as THREE.Mesh).isMesh) meshes.push(o as THREE.Mesh) })
    expect(meshes.every(m => !Array.isArray(m.material) && !m.material.transparent)).toBe(true)
  })
  it('lays the polishing cloth against the exterior instead of pushing its thickness into the bowl', () => {
    const s = mount(), pad = s.scene.getObjectByName('copper-pad-group')!, cloth = s.scene.getObjectByName('copper-polishing-pad')!, bowl = s.scene.getObjectByName('copper-bowl')!
    s.button.click(); s.run(.425); s.scene.updateMatrixWorld(true)
    const contact = bowl.worldToLocal(pad.getWorldPosition(new THREE.Vector3()))
    const center = bowl.worldToLocal(cloth.getWorldPosition(new THREE.Vector3()))
    expect(center.z).toBeGreaterThan(contact.z + .035)
    expect(center.y).toBeLessThan(contact.y - .015)
    const surface = new THREE.Raycaster(bowl.localToWorld(new THREE.Vector3(contact.x, contact.y, 2)), new THREE.Vector3(0, 0, -1)).intersectObject(s.scene.getObjectByName('copper-bowl-shell')!, false)[0]
    const gap = contact.z - bowl.worldToLocal(surface.point.clone()).z
    expect(gap).toBeGreaterThanOrEqual(-.003); expect(gap).toBeLessThan(.012)
  })
  it('disposes mesh resources and window listeners once and stops subsequent input', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>()
    s.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click()
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.progress).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
