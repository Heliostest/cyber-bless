// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Keep real Three geometry, intersections and cues; replace only GPU work.
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
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1.2) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}
const gripAnchor: [number, number, number] = [1.05, .34, .012]
// Local points lie on the opaque paper or wooden grip.
const quietAnchor: [number, number, number] = [.08, .22, .014]
const targetName = (at: number) => at === 0 ? 'kite-paper-right' : at === 1 ? 'kite-reel-grip' : 'kite-body-paper'
const anchor = (at: number): [number, number, number] => at === 0 ? gripAnchor : at === 1 ? [0, 0, .075] : quietAnchor
const delta = (at: number): [number, number] => at === 0 ? [-48, -36] : [0, 60]
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function step(s: ReturnType<typeof mount>, at: number, run = true) {
  if (at < 2) drag(s, at, ...delta(at), run)
  else { const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
}
function cues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}
function first(s: ReturnType<typeof mount>, p: THREE.Vector3) {
  const q = p.clone().project(s.camera), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
  const meshes: THREE.Object3D[] = []
  s.scene.traverseVisible(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
  })
  return { q, object: ray.intersectObjects(meshes, false)[0]?.object }
}

describe('an original connected paper swallow kite', () => {
  it('exposes a native 44px action, physical object input and no wish form without entry progress', () => {
    const s = mount()
    expect(s.hit).not.toBeNull(); expect(s.button.type).toBe('button'); expect(s.button.style.minWidth).toBe('44px'); expect(s.button.style.minHeight).toBe('44px')
    expect(s.overlay.querySelector('input,form')).toBeNull(); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([false, true])('draws the wing onto the frame, pulls the reel to raise the kite, and quietly completes once, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced }), wing = s.scene.getObjectByName('kite-prepared-wing')!, kite = s.scene.getObjectByName('kite-airframe')!, reel = s.scene.getObjectByName('kite-reel')!
    const wingStart = wing.position.clone(), kiteY = kite.position.y, reelY = reel.position.y
    step(s, 0); expect(s.progress).toEqual([1]); expect(wing.position.distanceTo(wingStart)).toBeGreaterThan(.3); expect(wing.position.length()).toBeLessThan(.0001)
    step(s, 1); expect(s.progress).toEqual([1, 2]); expect(kite.position.y - kiteY).toBeGreaterThan(.6); expect(reelY - reel.position.y).toBeGreaterThan(.1)
    step(s, 2); step(s, 2); s.button.click(); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([0, 1])('moves the selected physical object during drag and restores cancelled input at %i', at => {
    const s = mount(at), object = s.scene.getObjectByName(at === 0 ? 'kite-prepared-wing' : 'kite-reel')!, home = object.position.clone(), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2]); expect(object.position.distanceTo(home)).toBeGreaterThan(.05); expect(s.progress).toEqual([])
    event(s.hit, 'pointercancel', p); expect(object.position.distanceTo(home)).toBeLessThan(.00001)
  })
  it.each([0, 1])('rejects wrong surfaces, release-only, reverse, short, cross-axis and deliberately withdrawn gestures at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at), end: [number, number] = [p[0] + dx, p[1] + dy]
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', end)
    for (const [x, y] of [[dx / 8, dy / 8], [-dx, -dy], [-dy, dx]]) drag(s, at, x, y)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', [p[0] + dx * .4, p[1] + dy * .4]); event(s.hit, 'pointerup', [p[0] + dx * .4, p[1] + dy * .4])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i on ordinary and returning visits', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : []); expect(s.button.hidden).toBe(at === 3)
      expect(s.scene.getObjectByName('kite-prepared-wing')!.position.length()).toBe(at === 0 ? Math.hypot(.43, -.23, .13) : 0)
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled(); s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('frames every subject vertex and exposes the first opaque cue at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('kite-subject')!.traverse(o => {
        const m = o as THREE.Mesh; if (!m.geometry) return
        for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return
        const pos = m.geometry.getAttribute('position'), bounds = new THREE.Box3(), p = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) bounds.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(s.camera))
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)), m.name).toBeLessThan(.97)
      })
      for (const { object, cue } of cues(s)) {
        const hit = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(hit.object?.name, `first opaque cue ${object.name}`).toBe(object.name); expect(Math.abs(hit.q.x)).toBeLessThan(.97); expect(Math.abs(hit.q.y)).toBeLessThan(.97)
      }
      if (at < 3) step(s, at); expect(s.progress).toEqual(at < 3 ? [at + 1] : []); s.instance.dispose()
    }
  })
  it('keeps all three bridle branches and the flying line attached through drag, animation and idle wind', () => {
    const s = mount(), line = s.scene.getObjectByName('kite-flying-line') as THREE.Mesh<THREE.TubeGeometry>
    const check = () => {
      s.scene.updateMatrixWorld(true)
      const knot = s.scene.getObjectByName('kite-bridle-knot')!.getWorldPosition(new THREE.Vector3()), exit = s.scene.getObjectByName('kite-line-exit')!.getWorldPosition(new THREE.Vector3())
      expect(line.localToWorld(line.geometry.parameters.path.getPoint(0)).distanceTo(exit)).toBeLessThan(.00001)
      expect(line.localToWorld(line.geometry.parameters.path.getPoint(1)).distanceTo(knot)).toBeLessThan(.00001)
      for (const side of ['left', 'right', 'bottom']) {
        const branch = s.scene.getObjectByName(`kite-bridle-${side}`) as THREE.Mesh<THREE.TubeGeometry>, tie = s.scene.getObjectByName(`kite-bridle-tie-${side}`)!
        expect(branch.localToWorld(branch.geometry.parameters.path.getPoint(0)).distanceTo(tie.getWorldPosition(new THREE.Vector3()))).toBeLessThan(.00001)
        expect(branch.localToWorld(branch.geometry.parameters.path.getPoint(1)).distanceTo(knot)).toBeLessThan(.00001)
      }
    }
    check(); step(s, 0, false); for (let i = 0; i < 40; i++) { s.instance.update(.025); check() }
    step(s, 1, false); for (let i = 0; i < 100; i++) { s.instance.update(.025); check() }
    expect(s.progress).toEqual([1, 2])
  })
  it('uses an open forked swallow tail, symmetrical bamboo spars, opaque paper and a wooden wound reel', () => {
    const s = mount(1, { isReducedMotion: () => true }), body = s.scene.getObjectByName('kite-body-paper') as THREE.Mesh
    expect(new THREE.Raycaster(body.localToWorld(new THREE.Vector3(0, -1, .5)), new THREE.Vector3(0, 0, -1)).intersectObject(body)).toHaveLength(0)
    for (const side of ['left', 'right']) {
      const spar = s.scene.getObjectByName(`kite-bamboo-${side}`) as THREE.Mesh<THREE.TubeGeometry>, tip = spar.geometry.parameters.path.getPoint(1)
      expect(tip.x).toBeCloseTo(side === 'left' ? -1.8 : 1.8, 10); expect(tip.y).toBeCloseTo(.64, 10)
      const skin = s.scene.getObjectByName(`kite-paper-${side}`) as THREE.Mesh
      expect((skin.material as THREE.Material).transparent).toBe(false); expect((skin.material as THREE.MeshStandardMaterial).roughness).toBeGreaterThan(.8)
    }
    for (const name of ['kite-reel-grip', 'kite-reel-flange-left', 'kite-reel-flange-right', 'kite-reel-winding']) expect((s.scene.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(24)
    expect(s.scene.getObjectByName('kite-table')).toBeUndefined()
  })
  it('allows only gentle active non-reduced idle wind and preserves the same settled checkpoint geometry', () => {
    let active = true; const s = mount(2, { isActive: () => active }), kite = s.scene.getObjectByName('kite-airframe')!, rotation = kite.rotation.z
    s.run(.5); expect(Math.abs(kite.rotation.z - rotation)).toBeGreaterThan(.001); expect(Math.abs(kite.rotation.z)).toBeLessThan(.04)
    active = false; const paused = kite.matrixWorld.clone(), frames = rendered.render.mock.calls.length; s.run(); expect(kite.matrixWorld.equals(paused)).toBe(true); expect(rendered.render.mock.calls.length).toBe(frames)
    const r = mount(2, { isReducedMotion: () => true }), still = r.scene.getObjectByName('kite-airframe')!.matrixWorld.clone(); r.run(); expect(r.scene.getObjectByName('kite-airframe')!.matrixWorld.equals(still)).toBe(true)
  })
  it('deforms the connected flying line without allocating fresh GPU geometry during sustained wind', () => {
    const s = mount(2), line = s.scene.getObjectByName('kite-flying-line') as THREE.Mesh, geometry = line.geometry, before = geometry.getAttribute('position').array.slice()
    s.run(2)
    expect(line.geometry).toBe(geometry); expect(geometry.getAttribute('position').array).not.toEqual(before)
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels %s without progress or a stale object pose', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }), needle = s.scene.getObjectByName(at === 0 ? 'kite-prepared-wing' : 'kite-reel')!, home = needle.position.clone(), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2]); const frames = rendered.render.mock.calls.length
      if (kind === 'pause') { active = false; s.instance.update(.05); s.instance.update(.05); expect(rendered.render.mock.calls.length).toBe(frames) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); expect(s.progress).toEqual([]); expect(needle.position.distanceTo(home)).toBeLessThan(.00001)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025); step(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1])('disables input and freezes an accepted transition across pause at %i', at => {
    let active = true; const s = mount(at, { isActive: () => active }); step(s, at, false); expect(s.button.disabled).toBe(true); expect(s.hit.style.pointerEvents).toBe('none')
    s.button.click(); for (const dt of [NaN, Infinity, -10, 100000]) s.instance.update(dt); expect(s.progress).toEqual([])
    active = false; const needle = s.scene.getObjectByName(at === 0 ? 'kite-prepared-wing' : 'kite-reel')!, pose = needle.position.clone(), frames = rendered.render.mock.calls.length
    s.run(2); expect(rendered.render.mock.calls.length).toBe(frames); expect(needle.position.distanceTo(pose)).toBeLessThan(.00001); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('rejects a target behind another opaque object at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), blocker = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.lerpVectors(s.scene.getObjectByName(targetName(at))!.localToWorld(new THREE.Vector3(...anchor(at))), s.camera.position, .15)
    blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker); s.scene.updateMatrixWorld(true); step(s, at); expect(s.progress).toEqual([])
    blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose(); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('preserves pointer ownership through prepareFeedback input on and outside the hit layer at %i', at => {
    for (const outside of [false, true]) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(outside ? document.body : s.hit, type, [1, 1]); step(s, at); expect(s.progress, `${outside} ${type}`).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('invalidates prepared pointer and keyboard input on every pause/resume boundary at %i', at => {
    for (const keyboard of [false, true]) {
      let attack = () => {}, active = true; const s = mount(at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback: () => attack() })
      attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
      for (let i = 0; i < 2; i++) { keyboard ? s.button.click() : step(s, at); expect(s.progress).toEqual([]) }
      attack = () => {}; keyboard ? s.button.click() : step(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('blocks synchronous %s step skipping and update reentry', callback => {
    let attack = () => {}; const seen: number[] = [], s = mount(0, { isReducedMotion: () => true, [callback]: () => attack(), onProgress: n => { seen.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); step(s, 0); step(s, 1); s.instance.update(100) }
    s.button.click(); expect(seen).toEqual([1]); s.button.click(); expect(seen).toEqual([1, 2]); s.button.click(); expect(seen).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('rejects multitouch and tap backtracking', () => {
    const s = mount(0, { isReducedMotion: () => true }), p = s.point(targetName(0), anchor(0))
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0] - 48, p[1] - 36]); event(s.hit, 'pointerup', [p[0] - 48, p[1] - 36]); event(s.hit, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); step(s, 0); step(s, 1)
    const q = s.point(targetName(2), anchor(2)); event(s.hit, 'pointerdown', q); event(s.hit, 'pointermove', [q[0] + 18, q[1]]); event(s.hit, 'pointerup', q); expect(s.progress).toEqual([1, 2]); step(s, 2); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('stops after %s pauses or disposes the scene', callback => {
    for (const mode of ['pause', 'dispose']) {
      let active = true, destroy = () => {}; const s = mount(0, { isReducedMotion: () => true, isActive: () => active, [callback]: () => { if (mode === 'pause') active = false; else destroy() } })
      destroy = () => s.instance.dispose(); const frames = rendered.render.mock.calls.length; s.button.click(); s.instance.update(.1); s.button.click(); expect(rendered.render.mock.calls.length).toBe(frames)
      if (mode === 'dispose') expect(s.overlay.childElementCount).toBe(0); s.instance.dispose()
    }
  })
  it.each([NaN, Infinity, -9])('normalizes invalid restoration %s without reporting progress', initial => {
    const s = mount(initial, { isReducedMotion: () => true }); s.instance.start(); s.instance.update(NaN); expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([1])
  })
  it('removes all matching pointer callback guards exactly once', () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener'), removed = vi.spyOn(EventTarget.prototype, 'removeEventListener'), windowAdded = vi.spyOn(window, 'addEventListener'), windowRemoved = vi.spyOn(window, 'removeEventListener'), s = mount()
    const guards = added.mock.calls.filter(([type, , options], i) => added.mock.contexts[i] === s.hit && options === true && ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'].includes(type))
    expect(guards).toHaveLength(5); s.instance.dispose(); s.instance.dispose()
    for (const [type, listener, options] of guards) {
      expect(removed.mock.calls.filter(([t, l, o], i) => removed.mock.contexts[i] === s.hit && t === type && l === listener && o === options)).toHaveLength(1)
      expect(windowAdded.mock.calls.filter(([t, l, o]) => t === type && l === listener && o === options)).toHaveLength(1)
      expect(windowRemoved.mock.calls.filter(([t, l, o]) => t === type && l === listener && o === options)).toHaveLength(1)
    }
  })
  it('releases capture, geometry, materials, cues and DOM once and rejects retained inputs after disposal', () => {
    const s = mount(2), resources = new Set<THREE.BufferGeometry | THREE.Material>(), cued: THREE.Object3D[] = []
    s.scene.traverse(o => { if (o.userData.interactionCues?.length) cued.push(o); const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const p = s.point(targetName(2), anchor(2)), release = vi.fn(); s.hit.releasePointerCapture = release; event(s.hit, 'pointerdown', p)
    const renderer = rendered.renderer as THREE.WebGLRenderer, frames = rendered.render.mock.calls.length; s.instance.dispose(); s.instance.dispose(); s.button.click(); event(s.hit, 'pointerup', p); s.instance.start(); s.instance.update(10)
    expect(release).toHaveBeenCalledExactlyOnceWith(1); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(frames)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); for (const o of cued) expect(o.userData.interactionCues).toEqual([])
  })
})

