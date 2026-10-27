// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only GPU work is replaced. Three geometry, raycasting, cues and the wish form remain real.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, render: vi.fn() }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this }
    setSize() {} setPixelRatio() {} setClearColor() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    const render = vi.fn(() => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }); rendered.render = render
    return { setStyle() {}, resize() {}, render, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const height = width === 1280 ? 600 : 560, left = 17, top = 91
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('button')!
  expect(hit, 'scene provides its object input surface').not.toBeNull()
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number, number, number] = name === 'hoop-linen' ? [.25, .017, .22] : [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const write = (text: string) => { const input = overlay.querySelector<HTMLInputElement>('input')!; input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, write, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}

function dropPoint(s: ReturnType<typeof mount>, source: string, target: string): [number,number] {
 const pairs=[["hoop-spool-cap","hoop-linen"],["hoop-clamp-bridge","hoop-cradle-seat"]];if(!pairs.some(pair=>pair[0]===source&&pair[1]===target))return s.point(target)
 const list: {object:THREE.Object3D;cue:InteractionCue}[]=[];s.scene.traverse(object=>{for(const cue of object.userData.interactionCues??[])if(cue.enabled()&&cue.kind==='drag')list.push({object,cue})})
 const c=list[0];if(!c?.cue.destination)return s.point(target)
 const r=s.host.querySelector('canvas')!.getBoundingClientRect(), project=(p:THREE.Vector3):[number,number]=>{const q=p.project(s.camera);return[r.left+(q.x+1)*r.width/2,r.top+(1-q.y)*r.height/2]}
 const d=c.cue.destination,a=project(c.object.localToWorld(new THREE.Vector3(...(c.cue.anchor??[0,0,0])))),b=project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3())),p=s.point(source)
 return[p[0]+b[0]-a[0],p[1]+b[1]-a[1]]
}
function beforeArrival(a: readonly number[], b: readonly number[]): [number,number] {return[a[0]+(b[0]-a[0])*.2,a[1]+(b[1]-a[1])*.2]}

function drag(s: ReturnType<typeof mount>, source = 'hoop-spool-cap', target = 'hoop-linen') {
  const a = s.point(source), b = dropPoint(s, source, target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('hoop-clamp-bridge'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
function cues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}
function first(s: ReturnType<typeof mount>, p: THREE.Vector3) {
  const ray = new THREE.Raycaster(); const q = p.project(s.camera); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
  const visible: THREE.Object3D[] = []
  s.scene.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return
    const mat = (object as THREE.Mesh).material as THREE.Material
    if (mat.transparent) return
    visible.push(object)
  })
  return { q, object: ray.intersectObjects(visible, false)[0]?.object }
}


describe('Hungarian contemporary embroidery appreciation', () => {
  it('advances its public three checkpoint lifecycle once and never saves an implicit wish', () => {
    const overlay = document.createElement('div'), canvas = document.createElement('canvas')
    const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn()
    overlay.addEventListener('scene:complete', complete)
    const scene = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared,
      isReducedMotion: () => true, isSoundEnabled: () => false, onProgress: n => progress.push(n), saveWish })
    scene.start()
    const button = overlay.querySelector<HTMLButtonElement>('button')!
    button.click(); expect(progress).toEqual([1])
    button.click(); expect(progress).toEqual([1, 2])
    button.click(); button.click(); expect(progress).toEqual([1, 2, 3])
    expect(complete).toHaveBeenCalledOnce(); expect(saveWish).not.toHaveBeenCalled()
    scene.dispose()
  })
})

describe('an optional explicit gift wish', () => {
  it('saves a trimmed nonempty submission once, guards reentry and leaves quiet drafts unsaved', () => {
    const s = mount(2)
    expect(s.overlay.querySelector('input'), 'writing is offered at the final checkpoint').not.toBeNull()
    s.write('  '); expect(s.progress).toEqual([])
    const form = s.overlay.querySelector('form')!
    const repeat = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    s.saveWish.mockImplementation(repeat)
    s.write('  愿来年相聚  '); repeat()
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿来年相聚'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const quiet = mount(2); quiet.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的心愿'; tap(quiet)
    expect(quiet.progress).toEqual([3]); expect(quiet.saveWish).not.toHaveBeenCalled()
    expect(quiet.overlay.querySelector('input')).toBeNull()
    const returning = mount(2, { returning: true }); expect(returning.overlay.querySelector('input')).toBeNull(); tap(returning)
    expect(returning.progress).toEqual([3]); expect(returning.saveWish).not.toHaveBeenCalled()
  })
  it('accepts forty characters only through explicit submission and rejects forty-one', () => {
    const s = mount(2), input = s.overlay.querySelector<HTMLInputElement>('input')!
    expect(input.maxLength).toBeGreaterThan(40)
    s.write('心'.repeat(41)); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.write('心'.repeat(40)); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('心'.repeat(40))
  })
})

function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...(name === 'hoop-linen' ? [.25, .017, .22] : [0, 0, 0]) as [number, number, number])), s.camera.position, .18)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('visible object input and recoverable progress', () => {
  it('rejects empty space, wrong objects, missing travel, wrong drops and wandering quiet taps', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointerup', s.point('hoop-clamp-bridge'))
    drag(s, 'hoop-cradle-seat', 'hoop-clamp-bridge'); expect(s.progress).toEqual([])
    const p = s.point('hoop-spool-cap'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', s.point('hoop-clamp-bridge')); expect(s.progress).toEqual([])
    const home = s.scene.getObjectByName('hoop-thread-spool')!.position.clone()
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [1, 1]); event(s.hit, 'pointerup', [1, 1])
    expect(s.scene.getObjectByName('hoop-thread-spool')!.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    drag(s); drag(s, 'hoop-spool-cap', 'hoop-cradle-seat'); expect(s.progress).toEqual([1])
    drag(s, 'hoop-clamp-bridge', 'hoop-table-leg'); expect(s.progress).toEqual([1])
    drag(s, 'hoop-clamp-bridge', 'hoop-cradle-seat'); const a = s.point('hoop-clamp-bridge')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 12, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through an opaque external object at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'hoop-spool-cap' : 'hoop-clamp-bridge'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'hoop-linen' : 'hoop-cradle-seat'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'hoop-linen' : 'hoop-cradle-seat'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects drops behind external opaque geometry at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'hoop-spool-cap' : 'hoop-clamp-bridge', target = at === 0 ? 'hoop-linen' : 'hoop-cradle-seat'
    const a = s.point(source), b = dropPoint(s, source, target)
    event(s.hit, 'pointerdown', a); const clear = block(s, target); event(s.hit, 'pointermove', b)
    event(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and retains native button access', at => {
    for (const returning of [true, false]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.scene.getObjectByName('hoop-completed-flourish')!.visible).toBe(at > 0)
      expect(s.button.type).toBe('button'); expect(s.button.hidden).toBe(at === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
      s.instance.dispose()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('returns either unfinished drag to its support on %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active, isReducedMotion: () => true })
      const source = at === 0 ? 'hoop-spool-cap' : 'hoop-clamp-bridge', target = at === 0 ? 'hoop-linen' : 'hoop-cradle-seat'
      const object = s.scene.getObjectByName(at === 0 ? 'hoop-thread-spool' : 'hoop-body')!, home = object.position.clone(), end = s.point(target)
      event(s.hit, 'pointerdown', s.point(source)); event(s.hit, 'pointermove', beforeArrival(s.point(source),end))
      expect(object.position.equals(home)).toBe(false)
      if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else if (kind === 'pause') { active = false; s.run() }
      else event(s.hit, kind, end)
      event(s.hit, 'pointerup', end); expect(s.progress).toEqual([]); expect(object.position.equals(home)).toBe(true)
      active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s, source, target); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it('ignores movement and release from a different pointer owner', () => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('hoop-spool-cap'), b = s.point('hoop-linen')
    const cone = s.scene.getObjectByName('hoop-thread-spool')!, home = cone.position.clone()
    event(s.hit, 'pointerdown', a, 7); event(s.hit, 'pointermove', b, 8); event(s.hit, 'pointerup', b, 8)
    expect(cone.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    event(s.hit, 'pointermove', b, 7); event(s.hit, 'pointerup', b, 7); expect(s.progress).toEqual([1])
  })
  it('accepts a quiet gesture below twelve pixels when it returns to the hoop', () => {
    const s = mount(2), a = s.point('hoop-clamp-bridge')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 11.9, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([3])
  })
  it.each([true, false])('rejects multitouch with outside pointer first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), to = s.point('hoop-linen')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('hoop-spool-cap'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted motion on blur and pause, disables wish submission and resumes cleanly', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const pose = s.scene.getObjectByName('hoop-body')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('hoop-body')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); active = false; s.run(2)
    expect(s.scene.getObjectByName('hoop-body')!.position.equals(pose)).toBe(true)
    active = true; s.run(2); expect(s.progress).toEqual([2])
    active = false; s.run(); s.write('暂停'); s.button.click(); expect(s.progress).toEqual([2]); expect(s.saveWish).not.toHaveBeenCalled()
    active = true; s.run(); s.write('春日'); expect(s.progress).toEqual([2, 3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春日')
  })
  it.each([320, 390, 1280])('keeps each cue on the first visible opaque surface at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width)
      for (const { object, cue } of cues(s)) {
        const pick = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(pick.object?.name).toBe(object.name); expect(Math.abs(pick.q.x)).toBeLessThan(.95); expect(Math.abs(pick.q.y)).toBeLessThan(.95)
        if (cue.destination instanceof THREE.Object3D) {
          const target = first(s, cue.destination.getWorldPosition(new THREE.Vector3()))
          expect(target.object?.name).toBe(cue.destination.name); expect(Math.abs(target.q.x)).toBeLessThan(.95); expect(Math.abs(target.q.y)).toBeLessThan(.95)
        } else if (cue.destination) {
          const target = first(s, cue.destination())
          expect(Math.abs(target.q.x)).toBeLessThan(.95); expect(Math.abs(target.q.y)).toBeLessThan(.95)
        }
      }
      for (const name of ['hoop-clamp-bridge', 'hoop-thread-spool', 'hoop-display-cradle', 'hoop-table-leg']) {
        const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera); expect(Math.abs(p.x), name).toBeLessThan(.99); expect(Math.abs(p.y), name).toBeLessThan(.99)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'hoop-clamp-bridge', 'hoop-cradle-seat'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
})

describe('physical craft and owned resources', () => {
  it.each([1, 3])('stops feedback and rendering if the progress %i callback disposes the scene', step => {
    let close = () => {}, renderedAtClose = -1
    const onProgress = vi.fn(() => close()), s = mount(step === 1 ? 0 : 2, { onProgress })
    const render = rendered.render
    close = () => { s.instance.dispose(); renderedAtClose = render.mock.calls.length }
    if (step === 1) { s.button.click(); s.run() } else tap(s)
    s.instance.update(.025); s.button.click()
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(step)
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(render.mock.calls.length).toBe(renderedAtClose); expect(s.overlay.childElementCount).toBe(0)
  })
  it('does not render the settled frame when its progress callback disposes the scene', () => {
    let close = () => {}, renderedAtClose = -1
    const s = mount(0, { onProgress: () => close() }), render = rendered.render
    close = () => { s.instance.dispose(); renderedAtClose = render.mock.calls.length }
    s.button.click(); s.run()
    expect(render.mock.calls.length).toBe(renderedAtClose)
  })
  it('stops after a saving callback disposes the scene and cannot save twice', () => {
    let close = () => {}
    const saveWish = vi.fn(() => close()), onProgress = vi.fn(), s = mount(2, { saveWish, onProgress })
    const form = s.overlay.querySelector('form')!, render = rendered.render, before = render.mock.calls.length
    close = () => s.instance.dispose()
    s.write('  愿你安好  '); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); s.button.click(); s.instance.update(.025)
    expect(saveWish).toHaveBeenCalledExactlyOnceWith('愿你安好'); expect(onProgress).not.toHaveBeenCalled()
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(render.mock.calls.length).toBe(before); expect(s.overlay.childElementCount).toBe(0)
  })
  it('stops completion if the final feedback callback disposes the scene', () => {
    let close = () => {}
    const haptic = vi.fn(() => close()), s = mount(2, { haptic })
    close = () => s.instance.dispose()
    tap(s); s.instance.update(.025)
    expect(haptic).toHaveBeenCalledOnce(); expect(s.complete).not.toHaveBeenCalled(); expect(s.overlay.childElementCount).toBe(0)
  })
  it.each(['save', 'progress'])('commits accepted progress once while the final %s callback pauses feedback', stage => {
    let active = true
    const saveWish = vi.fn(() => { if (stage === 'save') active = false })
    const onProgress = vi.fn(() => { if (stage === 'progress') active = false })
    const s = mount(2, { isActive: () => active, saveWish, onProgress })
    s.write('春日相聚')
    expect(saveWish).toHaveBeenCalledExactlyOnceWith('春日相聚')
    expect(onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    active = true; s.instance.update(.025); s.button.click()
    expect(saveWish).toHaveBeenCalledOnce(); expect(onProgress).toHaveBeenCalledExactlyOnceWith(3); expect(s.complete).not.toHaveBeenCalled()
  })
  it('moves and restores the spool with its coils and loose thread attached', () => {
    const s = mount(0), spool = s.scene.getObjectByName('hoop-thread-spool')!
    const tail = s.scene.getObjectByName('hoop-spool-tail')!, coil = s.scene.getObjectByName('hoop-thread-coil')!
    const tailHome = tail.getWorldPosition(new THREE.Vector3()), coilHome = coil.getWorldPosition(new THREE.Vector3())
    expect(tail.parent).toBe(spool); expect(coil.parent).toBe(spool)
    event(s.hit, 'pointerdown', s.point('hoop-spool-cap')); event(s.hit, 'pointermove', beforeArrival(s.point('hoop-spool-cap'),s.point('hoop-linen')))
    expect(tail.getWorldPosition(new THREE.Vector3()).distanceTo(tailHome)).toBeGreaterThan(.05)
    event(s.hit, 'pointercancel', s.point('hoop-linen'))
    expect(tail.getWorldPosition(new THREE.Vector3()).distanceTo(tailHome)).toBeLessThan(.00001)
    expect(coil.getWorldPosition(new THREE.Vector3()).distanceTo(coilHome)).toBeLessThan(.00001)
    expect(s.progress).toEqual([])
  })
  it('guards completion before progress callbacks can reenter the scene', () => {
    let reenter = () => {}
    const progress: number[] = [], s = mount(2, { onProgress: n => { progress.push(n); reenter() } })
    reenter = () => { s.button.click(); tap(s) }
    s.write('花开时相见')
    expect(progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('花开时相见')
    expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([Number.NaN, Number.POSITIVE_INFINITY, -4])('sanitizes invalid restored progress %s without side effects', value => {
    const s = mount(value, { isReducedMotion: () => true }); s.instance.start(); s.instance.update(Number.NaN)
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    drag(s); expect(s.progress).toEqual([1])
  })
  it('supports the hoop and spool with solid contact at both resting checkpoints', () => {
    for (const at of [0, 2]) {
      const s = mount(at), bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
      const support = at === 0 ? 'hoop-home-pad' : 'hoop-cradle-seat'
      expect(bounds('hoop-wooden-ring').min.y).toBeCloseTo(bounds(support).max.y, 4)
      expect(bounds('hoop-spool-bottom').min.y).toBeCloseTo(bounds('hoop-table-top').max.y, 4)
      expect(bounds('hoop-cradle-base').min.y).toBeCloseTo(bounds('hoop-table-top').max.y, 4)
      expect(bounds('hoop-home-pad').min.y).toBeCloseTo(bounds('hoop-table-top').max.y, 4)
      const back = bounds(at === 0 ? 'hoop-home-back-rest' : 'hoop-cradle-back-rest')
      expect(back.max.z).toBeCloseTo(bounds('hoop-wooden-ring').min.z, 4)
      expect(back.min.y).toBeLessThan(bounds('hoop-wooden-ring').min.y + .001)
      const cloth = bounds('hoop-linen'), rim = bounds('hoop-wooden-ring')
      expect(cloth.max.z - cloth.min.z).toBeGreaterThan(.03)
      expect(cloth.min.x).toBeGreaterThan(rim.min.x); expect(cloth.max.x).toBeLessThan(rim.max.x)
      s.instance.dispose()
    }
  })
  it('builds raised floral stitches that enter the cloth and remain within its rim', () => {
    const s = mount(1), hoop = s.scene.getObjectByName('hoop-body')!, cloth = new THREE.Box3().setFromObject(s.scene.getObjectByName('hoop-linen')!)
    let petals = 0
    hoop.traverse(object => {
      if (object.name !== 'hoop-petal-stitch') return
      petals++
      const mesh = object as THREE.Mesh<THREE.TubeGeometry>, path = mesh.geometry.parameters.path
      expect(path.getPoint(0).z).toBeCloseTo(.017, 5); expect(path.getPoint(1).z).toBeCloseTo(.017, 5)
      const bounds = new THREE.Box3().setFromObject(mesh)
      expect(bounds.max.z - cloth.max.z).toBeGreaterThan(.025)
      expect(bounds.min.z).toBeLessThan(cloth.max.z)
      expect(bounds.min.x).toBeGreaterThan(cloth.min.x); expect(bounds.max.x).toBeLessThan(cloth.max.x)
      expect(bounds.min.y).toBeGreaterThan(cloth.min.y); expect(bounds.max.y).toBeLessThan(cloth.max.y)
      expect((mesh.material as THREE.Material).transparent).toBe(false)
    })
    expect(petals).toBeGreaterThan(70)
    expect(s.scene.getObjectByName('hoop-completed-flourish')!.parent).toBe(hoop)
  })
  it('keeps floral details attached during drag and restores the complete hoop on cancellation', () => {
    const s = mount(1), spoon = s.scene.getObjectByName('hoop-body')!, detail = s.scene.getObjectByName('hoop-completed-flourish')!
    const original = new THREE.Box3().setFromObject(detail), grip = s.scene.getObjectByName('hoop-clamp-bridge')!
    expect(detail.parent).toBe(spoon); expect(grip.parent).toBe(spoon)
    event(s.hit, 'pointerdown', s.point(grip.name)); event(s.hit, 'pointermove', s.point('hoop-cradle-seat'))
    expect(new THREE.Box3().setFromObject(detail).min.equals(original.min)).toBe(false)
    event(s.hit, 'pointercancel', s.point('hoop-cradle-seat'))
    expect(new THREE.Box3().setFromObject(detail).min.distanceTo(original.min)).toBeLessThan(.00001)
    expect(s.progress).toEqual([])
  })
  it('requires eight pixels of real travel and settles immediately when reduced motion is switched on', () => {
    let reduced = false; const s = mount(0, { isReducedMotion: () => reduced }), a = s.point('hoop-spool-cap'), target = s.point('hoop-linen')
    const short: [number, number] = [a[0] + 7.9, a[1]]
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', short); event(s.hit, 'pointerup', short); s.run()
    expect(s.progress).toEqual([])
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 8, a[1]]); event(s.hit, 'pointerup', target); s.instance.update(.025)
    expect(s.progress).toEqual([]); reduced = true; s.instance.update(.025); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('hoop-completed-flourish')!.visible).toBe(true)
  })
  it('rejects forms before the last checkpoint and while the final hoop is being touched', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); s.write('提前'); expect(s.progress).toEqual([1]); s.button.click()
    const p = s.point('hoop-clamp-bridge'); event(s.hit, 'pointerdown', p); s.write('手势期间'); expect(s.saveWish).not.toHaveBeenCalled()
    event(s.hit, 'pointercancel', p); s.write('春天安好'); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春天安好'); expect(s.progress).toEqual([1, 2, 3])
  })
  it('frees geometry, materials, cues, shadows, DOM and owned listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = []
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(material)
      if (object instanceof THREE.DirectionalLight) { const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8); object.shadow.map.addEventListener('dispose', () => shadows[i]++) }
    })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click(); s.instance.update(5)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull()
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
