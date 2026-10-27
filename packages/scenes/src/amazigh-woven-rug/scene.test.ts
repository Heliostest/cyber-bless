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
  const height = width === 1280 ? 600 : width === 284 ? 390 : 408, left = 17, top = 91
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
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
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
 const pairs=[["rug-shuttle-grip","rug-weft-gap"],["rug-top-grip","rug-display-seat"]];if(!pairs.some(pair=>pair[0]===source&&pair[1]===target))return s.point(target)
 const list: {object:THREE.Object3D;cue:InteractionCue}[]=[];s.scene.traverse(object=>{for(const cue of object.userData.interactionCues??[])if(cue.enabled()&&cue.kind==='drag')list.push({object,cue})})
 const c=list[0];if(!c?.cue.destination)return s.point(target)
 const r=s.host.querySelector('canvas')!.getBoundingClientRect(), project=(p:THREE.Vector3):[number,number]=>{const q=p.project(s.camera);return[r.left+(q.x+1)*r.width/2,r.top+(1-q.y)*r.height/2]}
 const d=c.cue.destination,a=project(c.object.localToWorld(new THREE.Vector3(...(c.cue.anchor??[0,0,0])))),b=project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3())),p=s.point(source)
 return[p[0]+b[0]-a[0],p[1]+b[1]-a[1]]
}
function beforeArrival(a: readonly number[], b: readonly number[]): [number,number] {return[a[0]+(b[0]-a[0])*.2,a[1]+(b[1]-a[1])*.2]}

function drag(s: ReturnType<typeof mount>, source = 'rug-shuttle-grip', target = 'rug-weft-gap') {
  const a = s.point(source), b = dropPoint(s, source, target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('rug-top-grip'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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


describe('Amazigh contemporary wool appreciation', () => {
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
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.localToWorld(new THREE.Vector3()), s.camera.position, .18)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('visible object input and recoverable progress', () => {
  it('rejects empty space, wrong objects, missing travel, wrong drops and wandering quiet taps', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointerup', s.point('rug-top-grip'))
    drag(s, 'rug-display-seat', 'rug-top-grip'); expect(s.progress).toEqual([])
    const p = s.point('rug-shuttle-grip'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', s.point('rug-top-grip')); expect(s.progress).toEqual([])
    const home = s.scene.getObjectByName('rug-shuttle')!.position.clone()
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [1, 1]); event(s.hit, 'pointerup', [1, 1])
    expect(s.scene.getObjectByName('rug-shuttle')!.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    drag(s); drag(s, 'rug-shuttle-grip', 'rug-display-seat'); expect(s.progress).toEqual([1])
    drag(s, 'rug-top-grip', 'rug-table-leg'); expect(s.progress).toEqual([1])
    drag(s, 'rug-top-grip', 'rug-display-seat'); const a = s.point('rug-top-grip')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 12, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through an opaque external object at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'rug-shuttle-grip' : 'rug-top-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'rug-weft-gap' : 'rug-display-seat'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'rug-weft-gap' : 'rug-display-seat'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects drops behind external opaque geometry at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'rug-shuttle-grip' : 'rug-top-grip', target = at === 0 ? 'rug-weft-gap' : 'rug-display-seat'
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
      expect(s.scene.getObjectByName('rug-finished-row')!.visible).toBe(at > 0)
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
      const source = at === 0 ? 'rug-shuttle-grip' : 'rug-top-grip', target = at === 0 ? 'rug-weft-gap' : 'rug-display-seat'
      const object = s.scene.getObjectByName(at === 0 ? 'rug-shuttle' : 'rug-body')!, home = object.position.clone(), end = s.point(target)
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
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('rug-shuttle-grip'), b = s.point('rug-weft-gap')
    const cone = s.scene.getObjectByName('rug-shuttle')!, home = cone.position.clone()
    event(s.hit, 'pointerdown', a, 7); event(s.hit, 'pointermove', b, 8); event(s.hit, 'pointerup', b, 8)
    expect(cone.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    event(s.hit, 'pointermove', b, 7); event(s.hit, 'pointerup', b, 7); expect(s.progress).toEqual([1])
  })
  it('accepts a quiet gesture below twelve pixels when it returns to the rug', () => {
    const s = mount(2), a = s.point('rug-top-grip')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 11.9, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([3])
  })
  it.each([true, false])('rejects multitouch with outside pointer first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), to = s.point('rug-weft-gap')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('rug-shuttle-grip'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted motion on blur and pause, disables wish submission and resumes cleanly', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const pose = s.scene.getObjectByName('rug-body')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('rug-body')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); active = false; s.run(2)
    expect(s.scene.getObjectByName('rug-body')!.position.equals(pose)).toBe(true)
    active = true; s.run(2); expect(s.progress).toEqual([2])
    active = false; s.run(); s.write('暂停'); s.button.click(); expect(s.progress).toEqual([2]); expect(s.saveWish).not.toHaveBeenCalled()
    active = true; s.run(); s.write('春日'); expect(s.progress).toEqual([2, 3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春日')
  })
  it.each([284, 350, 1280])('keeps each cue on the first visible opaque surface at width %i', width => {
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
      for (const name of ['rug-top-grip', 'rug-shuttle', 'rug-display-stand', 'rug-table-leg']) {
        const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera); expect(Math.abs(p.x), name).toBeLessThan(.99); expect(Math.abs(p.y), name).toBeLessThan(.99)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'rug-top-grip', 'rug-display-seat'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
})

describe('physical craft and owned resources', () => {
  it.each([0, 2])('cancels a pointer paused by prepareFeedback and accepts a fresh pointer at checkpoint %i', at => {
    let active = true, pauseNext = false, pauseHost = () => {}
    const s = mount(at, { isActive: () => active, isReducedMotion: () => true, prepareFeedback() {
      if (pauseNext) { pauseNext = false; active = false; pauseHost() }
    } })
    pauseHost = () => s.instance.update(0)
    const source = s.point(at === 0 ? 'rug-shuttle-grip' : 'rug-top-grip'), target = at === 0 ? s.point('rug-weft-gap') : source
    event(s.hit, 'pointerdown', source, 9); event(s.hit, 'pointercancel', source, 9)
    pauseNext = true; event(s.hit, 'pointerdown', source, 1)
    active = true; s.instance.update(0)
    event(s.hit, 'pointerdown', source, 2); if (at === 0) event(s.hit, 'pointermove', target, 2); event(s.hit, 'pointerup', target, 2)
    expect(s.progress).toEqual([at + 1])
    event(s.hit, 'pointerup', target, 1); expect(s.progress).toEqual([at + 1])
  })
  it('ignores the stale final release after prepareFeedback pauses during a new touch', () => {
    let active = true, pauseNext = false, pauseHost = () => {}
    const s = mount(2, { isActive: () => active, prepareFeedback() {
      if (pauseNext) { pauseNext = false; active = false; pauseHost() }
    } })
    pauseHost = () => s.instance.update(0)
    const source = s.point('rug-top-grip')
    event(s.hit, 'pointerdown', source, 1); event(s.hit, 'pointercancel', source, 1)
    pauseNext = true; event(s.hit, 'pointerdown', source, 2)
    active = true; s.instance.update(0); event(s.hit, 'pointerup', source, 2)
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    event(s.hit, 'pointerdown', source, 3); event(s.hit, 'pointerup', source, 3)
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0, 2])('hides cue DOM without rendering after a prepare callback pauses checkpoint %i', at => {
    let active = true, pauseHost = () => {}
    const s = mount(at, { isActive: () => active, prepareFeedback() { active = false; pauseHost() } })
    pauseHost = () => s.instance.update(0)
    const layer = s.host.querySelector<HTMLElement>('.scene-object-cues')!, frames = rendered.render.mock.calls.length
    expect(layer.hidden).toBe(false)
    event(s.hit, 'pointerdown', s.point(at === 0 ? 'rug-shuttle-grip' : 'rug-top-grip'))
    expect(layer.hidden).toBe(true); expect(rendered.render.mock.calls.length).toBe(frames)
    active = true; s.instance.update(0); expect(layer.hidden).toBe(false); expect(s.button.disabled).toBe(false)
  })
  it.each([
    ['progress', 'button'], ['progress', 'pointer'], ['progress', 'wish'],
    ['haptic', 'button'], ['haptic', 'pointer'], ['haptic', 'wish'],
  ] as const)('rejects normal-motion %s callback reentry through %s until the next user action', (callback, route) => {
    const at = route === 'button' ? 0 : 1, progress: number[] = []
    let reenter = () => {}, attempts = 0
    const s = mount(at, {
      onProgress(n) { progress.push(n); if (callback === 'progress') reenter() },
      haptic() { if (callback === 'haptic') reenter() },
    })
    reenter = () => {
      if (attempts++) return
      if (route === 'button') s.button.dispatchEvent(new Event('click'))
      else if (route === 'pointer') tap(s)
      else s.write('回调里不应保存')
      s.instance.update(.05)
    }
    s.button.click(); s.run(3)
    expect(progress).toEqual([at + 1]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(s.button.disabled).toBe(false)
    s.button.click(); s.run(); expect(progress).toEqual([at + 1, at + 2])
  })
  it.each(['button', 'pointer', 'wish'] as const)('rejects prepareFeedback reentry through %s while accepting the original explicit wish', route => {
    let reenter = () => {}, attempts = 0
    const prepareFeedback = vi.fn(() => reenter()), s = mount(2, { prepareFeedback })
    reenter = () => {
      if (attempts++) return
      if (route === 'button') s.button.dispatchEvent(new Event('click'))
      else if (route === 'pointer') tap(s)
      else s.write('回调文字')
    }
    s.write('用户主动写下的心意')
    expect(prepareFeedback).toHaveBeenCalledOnce()
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('用户主动写下的心意')
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0, 2])('supports the clamped wool and shuttle on solid wood at checkpoint %i', at => {
    const s = mount(at), bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    expect(bounds('rug-top-grip').min.y).toBeCloseTo(bounds(at ? 'rug-display-seat' : 'rug-home-seat').max.y, 4)
    expect(bounds('rug-shuttle-hull').min.y).toBeCloseTo(bounds('rug-table-top').max.y, 4)
    expect(bounds('rug-display-base').min.y).toBeCloseTo(bounds('rug-table-top').max.y, 4)
    const wool = bounds('rug-wool'), grip = bounds('rug-top-grip')
    const rail = bounds(at ? 'rug-display-seat' : 'rug-home-seat')
    expect(rail.max.z).toBeLessThanOrEqual(wool.min.z + .001)
    expect(rail.max.z).toBeGreaterThan(grip.min.z)
    const contact = new THREE.Raycaster(new THREE.Vector3(at ? .75 : -.75, 2.27, .035), new THREE.Vector3(0, 1, 0))
      .intersectObject(s.scene.getObjectByName('rug-top-grip')!)[0]
    expect(contact, 'the flat wood surfaces actually touch, beyond their bounding boxes').toBeDefined()
    expect(contact?.point.y).toBeCloseTo(rail.max.y, 4)
    expect(wool.max.z - wool.min.z).toBeGreaterThan(.06)
    expect(wool.max.y).toBeGreaterThan(grip.min.y); expect(wool.max.y).toBeLessThan(grip.max.y)
    expect(wool.min.y).toBeGreaterThan(bounds('rug-table-top').max.y + .15)
    const fringe: THREE.Object3D[] = []; s.scene.traverse(o => { if (o.name === 'rug-fringe') fringe.push(o) })
    expect(fringe.length).toBeGreaterThanOrEqual(30)
    for (const thread of fringe) {
      const b = new THREE.Box3().setFromObject(thread)
      expect(b.max.y).toBeGreaterThan(wool.min.y); expect(b.min.y).toBeGreaterThan(bounds('rug-table-top').max.y)
    }
  })
  it('has opaque low relief weft, a woven back and bound edges attached to the thick rug', () => {
    const s = mount(1), rug = s.scene.getObjectByName('rug-body')!, wool = new THREE.Box3().setFromObject(s.scene.getObjectByName('rug-wool')!)
    const relief: THREE.Object3D[] = []; rug.traverse(o => { if (o.name === 'rug-colored-weft') relief.push(o) })
    expect(relief.length).toBeGreaterThan(20)
    for (const object of relief) {
      const mesh = object as THREE.Mesh, b = new THREE.Box3().setFromObject(mesh)
      expect((mesh.material as THREE.Material).transparent).toBe(false)
      expect(b.max.z).toBeGreaterThan(wool.max.z); expect(b.max.z - wool.max.z).toBeLessThan(.045)
      expect(b.min.x).toBeGreaterThan(wool.min.x); expect(b.max.x).toBeLessThan(wool.max.x)
    }
    expect(s.scene.getObjectByName('rug-back-weft')!.parent).toBe(rug)
    expect(s.scene.getObjectByName('rug-bound-edge')!.parent).toBe(rug)
  })
  it.each([284, 350, 1280])('keeps every visible object vertex inside the actual canvas at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('rug-workbench')!.traverseVisible(object => {
        const mesh = object as THREE.Mesh; if (!mesh.isMesh || mesh.name === 'rug-contact-shadow') return
        const positions = mesh.geometry.getAttribute('position')
        for (let i = 0; i < positions.count; i++) {
          const p = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(s.camera)
          expect(Math.abs(p.x), mesh.name).toBeLessThan(.99); expect(Math.abs(p.y), mesh.name).toBeLessThan(.99)
          expect(Math.abs(p.z), mesh.name).toBeLessThan(1)
        }
      }); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('stops the current frame and feedback when progress at %i pauses', at => {
    let active = true, stoppedAt = -1
    const progress = vi.fn(() => { active = false; stoppedAt = rendered.render.mock.calls.length })
    const s = mount(at, { isActive: () => active, onProgress: progress })
    s.button.click(); for (let i = 0; i < 40 && !progress.mock.calls.length; i++) s.instance.update(.025)
    expect(progress).toHaveBeenCalledExactlyOnceWith(at + 1); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(stoppedAt)
  })
  it.each([0, 1, 2])('stops the current frame and completion when haptic at %i pauses', at => {
    let active = true, stoppedAt = -1
    const haptic = vi.fn(() => { active = false; stoppedAt = rendered.render.mock.calls.length })
    const s = mount(at, { isActive: () => active, haptic })
    s.button.click(); for (let i = 0; i < 40 && !haptic.mock.calls.length; i++) s.instance.update(.025)
    expect(s.progress).toEqual([at + 1]); expect(haptic).toHaveBeenCalledOnce()
    expect(s.complete).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(stoppedAt)
    active = true; s.run(); expect(haptic).toHaveBeenCalledOnce(); expect(s.complete).not.toHaveBeenCalled()
  })
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
  it('moves and restores the shuttle with its coils and loose thread attached', () => {
    const s = mount(0), shuttle = s.scene.getObjectByName('rug-shuttle')!
    const tail = s.scene.getObjectByName('rug-shuttle-tail')!, coil = s.scene.getObjectByName('rug-shuttle-coil')!
    const tailHome = tail.getWorldPosition(new THREE.Vector3()), coilHome = coil.getWorldPosition(new THREE.Vector3())
    expect(tail.parent).toBe(shuttle); expect(coil.parent).toBe(shuttle)
    event(s.hit, 'pointerdown', s.point('rug-shuttle-grip')); event(s.hit, 'pointermove', beforeArrival(s.point('rug-shuttle-grip'),s.point('rug-weft-gap')))
    expect(tail.getWorldPosition(new THREE.Vector3()).distanceTo(tailHome)).toBeGreaterThan(.05)
    event(s.hit, 'pointercancel', s.point('rug-weft-gap'))
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
  it('keeps the finishing row attached during drag and restores the complete rug on cancellation', () => {
    const s = mount(1), rug = s.scene.getObjectByName('rug-body')!, detail = s.scene.getObjectByName('rug-finished-row')!
    const original = new THREE.Box3().setFromObject(detail), grip = s.scene.getObjectByName('rug-top-grip')!
    expect(detail.parent).toBe(rug); expect(grip.parent).toBe(rug)
    event(s.hit, 'pointerdown', s.point(grip.name)); event(s.hit, 'pointermove', beforeArrival(s.point(grip.name),s.point('rug-display-seat')))
    expect(new THREE.Box3().setFromObject(detail).min.equals(original.min)).toBe(false)
    event(s.hit, 'pointercancel', s.point('rug-display-seat'))
    expect(new THREE.Box3().setFromObject(detail).min.distanceTo(original.min)).toBeLessThan(.00001)
    expect(s.progress).toEqual([])
  })
  it('requires eight pixels of real travel and settles immediately when reduced motion is switched on', () => {
    let reduced = false; const s = mount(0, { isReducedMotion: () => reduced }), a = s.point('rug-shuttle-grip'), target = s.point('rug-weft-gap')
    const short: [number, number] = [a[0] + 7.9, a[1]]
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', short); event(s.hit, 'pointerup', short); s.run()
    expect(s.progress).toEqual([])
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 8, a[1]]); event(s.hit, 'pointerup', target); s.instance.update(.025)
    expect(s.progress).toEqual([]); reduced = true; s.instance.update(.025); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('rug-finished-row')!.visible).toBe(true)
  })
  it('rejects forms before the last checkpoint and while the final rug is being touched', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); s.write('提前'); expect(s.progress).toEqual([1]); s.button.click()
    const p = s.point('rug-top-grip'); event(s.hit, 'pointerdown', p); s.write('手势期间'); expect(s.saveWish).not.toHaveBeenCalled()
    event(s.hit, 'pointercancel', p); s.write('春天安好'); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春天安好'); expect(s.progress).toEqual([1, 2, 3])
  })
  it('frees geometry, materials, cues, shadows, DOM and owned listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = [], cued: THREE.Object3D[] = []
    s.scene.traverse(object => {
      if (object.userData.interactionCues?.length) cued.push(object)
      const mesh = object as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(material)
      if (object instanceof THREE.DirectionalLight) { const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8); object.shadow.map.addEventListener('dispose', () => shadows[i]++) }
    })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click(); s.instance.update(5)
    for (const object of cued) expect(object.userData.interactionCues).toEqual([])
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull()
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
