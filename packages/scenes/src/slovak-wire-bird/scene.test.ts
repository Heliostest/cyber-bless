// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
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

function dropPoint(s: ReturnType<typeof mount>, source: string, target: string): [number,number] {
 const pairs=[["wire-wing-grip","wire-shoulder-joint"],["wire-bird-grip","wire-perch-seat"]];if(!pairs.some(pair=>pair[0]===source&&pair[1]===target))return s.point(target)
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
function tap(s: ReturnType<typeof mount>) { const p = s.point('wire-bird-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.4, .4), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('an original open-wire bird', () => {
  it('offers a visible assembly action without persisting a checkpoint on mount', () => {
    const s = mount(); expect(s.button).not.toBeNull(); expect(s.button.textContent).toBeTruthy(); expect(s.progress).toEqual([])
  })
  it('attaches the wire wing, seats the whole bird and finishes once without creating a wish', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'wire-wing-grip', 'wire-shoulder-joint'); expect(s.progress).toEqual([1])
    drag(s, 'wire-bird-grip', 'wire-perch-seat'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    const figure = s.scene.getObjectByName('wire-bird')!
    const wing = s.scene.getObjectByName('wire-loose-wing')!
    expect(wing.parent?.name).toBe('wire-bird')
    const base = new THREE.Box3().setFromObject(s.scene.getObjectByName('wire-foot-front')!)
    const seat = new THREE.Box3().setFromObject(s.scene.getObjectByName('wire-perch-seat')!)
    expect(Math.abs(base.min.y - seat.max.y)).toBeLessThan(.008)
    expect(figure.position.x).toBeGreaterThan(.5)
  })
  it('rejects the wrong source, wrong drop and a quiet tap that travels away and returns', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'wire-perch-seat', 'wire-bird-grip')
    pointer(s.hit, 'pointerdown', s.point('wire-wing-grip')); pointer(s.hit, 'pointermove', [1, 1]); pointer(s.hit, 'pointerup', [1, 1])
    expect(s.progress).toEqual([])
    s.button.click(); s.button.click(); const p = s.point('wire-bird-grip')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 35, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through an opaque foreground surface at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'wire-wing-grip' : 'wire-bird-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'wire-shoulder-joint' : 'wire-perch-seat'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'wire-shoulder-joint' : 'wire-perch-seat'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects a drop hidden behind another object at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'wire-wing-grip' : 'wire-bird-grip', target = at === 0 ? 'wire-shoulder-joint' : 'wire-perch-seat'
    const a = s.point(source), b = dropPoint(s, source, target)
    pointer(s.hit, 'pointerdown', a); const clear = block(s, target); pointer(s.hit, 'pointermove', b)
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
  it.each(['pointercancel', 'lostpointercapture'])('discards a wire wing drag on %s', event => {
    const s = mount(0, { isReducedMotion: () => true }), initial = s.scene.getObjectByName('wire-loose-wing')!.position.clone()
    const a = s.point('wire-wing-grip'), b = s.point('wire-shoulder-joint')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', beforeArrival(a,b)); pointer(s.hit, event, b); pointer(s.hit, 'pointerup', b)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('wire-loose-wing')!.position.equals(initial)).toBe(true)
    drag(s, 'wire-wing-grip', 'wire-shoulder-joint'); expect(s.progress).toEqual([1])
  })
  it.each([true, false])('rejects mixed pointer input with outside-first=%s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('wire-wing-grip'), b = s.point('wire-shoulder-joint')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', a)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointerup', b); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'wire-wing-grip', 'wire-shoulder-joint'); expect(s.progress).toEqual([1])
  })
  it('cancels pending input on host pause and freezes accepted motion while blurred', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), a = s.point('wire-wing-grip'), b = s.point('wire-shoulder-joint')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', beforeArrival(a,b)); active = false; s.run(); active = true; pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([])
    s.button.click(); s.run(.1); const pose = s.scene.getObjectByName('wire-loose-wing')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('wire-loose-wing')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); s.run(2); expect(s.progress).toEqual([1])
  })
  it.each([320, 390, 1280])('hits the first visible source and destination at %ipx', width => {
    const s = mount(0, { isReducedMotion: () => true }, width)
    for (const names of [['wire-wing-grip', 'wire-shoulder-joint'], ['wire-bird-grip', 'wire-perch-seat'], ['wire-bird-grip']]) {
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
  it('rests the bird and loose wing on actual workshop supports', () => {
    const s = mount()
    const bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    expect(Math.abs(bounds('wire-foot-front').min.y - bounds('wire-home-pad').max.y)).toBeLessThan(.008)
    expect(Math.abs(bounds('wire-loose-wing').min.y - bounds('wire-wing-pad').max.y)).toBeLessThan(.003)
  })
  it.each([[284, 390], [350, 408]])('keeps every bird and wing vertex in the actual %ix%i canvas with unobstructed gesture anchors', (width, height) => {
    const s = mount(0, { isReducedMotion: () => true }, width, height)
    for (const [step, names] of [
      [0, ['wire-wing-grip', 'wire-shoulder-joint']],
      [1, ['wire-bird-grip', 'wire-perch-seat']],
      [2, ['wire-bird-grip']],
    ] as const) {
      const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
      for (const groupName of step === 0 ? ['wire-bird', 'wire-loose-wing'] : ['wire-bird']) {
        const bounds = new THREE.Box2()
        s.scene.getObjectByName(groupName)!.traverseVisible(o => {
          const mesh = o as THREE.Mesh
          if (!mesh.isMesh) return
          const vertices = mesh.geometry.getAttribute('position')
          for (let i = 0; i < vertices.count; i++) {
            const p = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i)).project(s.camera)
            bounds.expandByPoint(new THREE.Vector2(p.x, p.y))
          }
        })
        expect(bounds.min.x, `${groupName} step ${step} left edge`).toBeGreaterThan(-.92)
        expect(bounds.max.x, `${groupName} step ${step} right edge`).toBeLessThan(.92)
        expect(bounds.min.y, `${groupName} step ${step} lower edge`).toBeGreaterThan(-.92)
        expect(bounds.max.y, `${groupName} step ${step} upper edge`).toBeLessThan(.92)
      }
      for (const name of names) {
        const object = s.scene.getObjectByName(name)!, p = object.getWorldPosition(new THREE.Vector3()).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(ray.intersectObjects(visible, false)[0]?.object, name).toBe(object)
      }
      if (step < 2) drag(s, names[0], names[1]!); else tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it('keeps the body and wings open to rays instead of filling their outlines with touch proxies', () => {
    const s = mount(1), bird = s.scene.getObjectByName('wire-bird')!
    const visible: THREE.Object3D[] = []; bird.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
    const hitAt = (x: number, y: number) => new THREE.Raycaster(bird.localToWorld(new THREE.Vector3(x, y, 2)), new THREE.Vector3(0, 0, -1)).intersectObjects(visible, false)[0]
    expect(hitAt(-.25, .97)).toBeUndefined()
    const grip = hitAt(.05, .87)
    expect(grip.object.name).toBe('wire-bird-grip')
    expect(grip.distance).toBeGreaterThan(1.6)
    for (const name of ['wire-body-front', 'wire-body-back', 'wire-wing-loop', 'wire-far-wing-loop']) {
      const object = s.scene.getObjectByName(name) as THREE.Mesh<THREE.TubeGeometry, THREE.Material>
      expect(object.geometry.parameters.closed).toBe(true)
      expect(object.material.transparent).toBe(false)
    }
  })
  it('binds the wing root to the shoulder and carries every wire part with the bird', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'wire-wing-grip', 'wire-shoulder-joint')
    const wing = s.scene.getObjectByName('wire-loose-wing')!, bird = s.scene.getObjectByName('wire-bird')!
    const bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    expect(Math.abs(bounds('wire-wing-grip').min.z - bounds('wire-shoulder-joint').max.z)).toBeLessThan(.001)
    const local = wing.position.clone(), positions = new Map<THREE.Object3D, THREE.Vector3>()
    bird.traverse(o => positions.set(o, o.getWorldPosition(new THREE.Vector3())))
    drag(s, 'wire-bird-grip', 'wire-perch-seat')
    const delta = bird.getWorldPosition(new THREE.Vector3()).sub(positions.get(bird)!)
    expect(wing.parent).toBe(bird); expect(wing.position.equals(local)).toBe(true)
    for (const [object, old] of positions) expect(object.getWorldPosition(new THREE.Vector3()).sub(old).distanceTo(delta), object.name).toBeLessThan(.0001)
  })
  it.each([0, 1, 2, 3])('supports both feet, perch and each wire connection at checkpoint %i', at => {
    const s = mount(at), bird = s.scene.getObjectByName('wire-bird')!
    const bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    for (const name of ['wire-foot-front', 'wire-foot-back']) expect(Math.abs(bounds(name).min.y - bounds(at >= 2 ? 'wire-perch-seat' : 'wire-home-pad').max.y)).toBeLessThan(.001)
    expect(Math.abs(bounds('wire-perch-base').min.y - bounds('wire-table').max.y)).toBeLessThan(.001)
    const posts: THREE.Mesh[] = []; s.scene.traverse(o => { if (o.name === 'wire-perch-post') posts.push(o as THREE.Mesh) })
    for (const post of posts) {
      const b = new THREE.Box3().setFromObject(post)
      expect(Math.abs(b.min.y - bounds('wire-perch-base').max.y)).toBeLessThan(.001)
      expect(Math.abs(b.max.y - bounds('wire-perch-seat').min.y)).toBeLessThan(.001)
    }
    const tubes: { object: THREE.Mesh<THREE.TubeGeometry>; points: THREE.Vector3[]; radius: number }[] = [], solids: THREE.Box3[] = []
    bird.traverse(o => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      if (m.geometry instanceof THREE.TubeGeometry) tubes.push({ object: m as THREE.Mesh<THREE.TubeGeometry>, points: m.geometry.parameters.path.getPoints(144).map(p => m.localToWorld(p)), radius: m.geometry.parameters.radius })
      else solids.push(new THREE.Box3().setFromObject(m))
    })
    // A disconnected tube must not pass merely because its bounding box overlaps the sculpture.
    for (const tube of tubes) {
      const joined = tubes.some(other => other !== tube && tube.points.some(p => other.points.some(q => p.distanceTo(q) < tube.radius + other.radius + .008)))
        || solids.some(box => tube.points.some(p => box.distanceToPoint(p) <= tube.radius))
      expect(joined, tube.object.name + ' must contact another part').toBe(true)
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('returns the whole assembled bird after %s', event => {
    let active = true
    const s = mount(1, { isReducedMotion: () => true, isActive: () => active })
    const bird = s.scene.getObjectByName('wire-bird')!, wing = s.scene.getObjectByName('wire-loose-wing')!
    const origin = bird.position.clone(), wingOrigin = wing.getWorldPosition(new THREE.Vector3())
    const a = s.point('wire-bird-grip'), b = s.point('wire-perch-seat')
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', beforeArrival(a,b))
    expect(bird.position.distanceTo(origin)).toBeGreaterThan(.1)
    if (event === 'blur') window.dispatchEvent(new Event('blur'))
    else if (event === 'pause') { active = false; s.run() }
    else pointer(s.hit, event, b)
    pointer(s.hit, 'pointerup', b)
    expect(bird.position.equals(origin)).toBe(true)
    s.scene.updateMatrixWorld(true)
    expect(wing.getWorldPosition(new THREE.Vector3()).distanceTo(wingOrigin)).toBeLessThan(.0001)
    expect(s.progress).toEqual([])
  })
  it('cannot treat the tail as the wing joint or accept a stationary drag', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'wire-wing-grip', 'wire-tail')
    const p = s.point('wire-wing-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([])
  })
  it('guards completion before a reentrant progress callback and never exposes a writer', () => {
    let action: (() => void) | undefined
    const onProgress = vi.fn(() => action?.()), s = mount(2, { isReducedMotion: () => true, onProgress })
    action = () => s.button.click()
    tap(s); s.button.click()
    expect(onProgress).toHaveBeenCalledOnce(); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.overlay.querySelector('input, textarea, form')).toBeNull(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([
    [1, 'dispose'], [3, 'dispose'], [1, 'pause'], [3, 'pause'],
  ] as const)('stops callback-dependent work when progress %i causes host %s', (checkpoint, effect) => {
    let active = true, framesAtStop = -1
    const reported: number[] = []
    const s = mount(checkpoint === 1 ? 0 : 2, {
      isActive: () => active,
      onProgress(n) {
        reported.push(n); framesAtStop = rendered.frames
        if (effect === 'dispose') s.instance.dispose()
        else active = false
      },
    })
    s.button.click()
    for (let i = 0; i < 40 && reported.length === 0; i++) s.instance.update(.025)
    expect(reported).toEqual([checkpoint])
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(rendered.frames).toBe(framesAtStop)
    s.run(); s.button.click()
    expect(reported).toEqual([checkpoint])
    if (effect === 'dispose') {
      expect(rendered.frames).toBe(framesAtStop); expect(s.overlay.childElementCount).toBe(0)
    } else {
      active = true; s.run()
      expect(s.button.hidden).toBe(checkpoint === 3)
      if (checkpoint === 3) s.button.click()
      expect(reported).toEqual([checkpoint])
    }
    expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled()
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
