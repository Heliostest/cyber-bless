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
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
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
const gripAnchor: [number, number, number] = [0, 0, .10]
// Local points lie on the opaque frame grip or bamboo resonator wall.
const quietAnchor: [number, number, number] = [0, .7, .19]
const targetName = (at: number) => at < 2 ? 'angklung-frame-grip' : 'angklung-tube-long-body'
const anchor = (at: number): [number, number, number] => at < 2 ? gripAnchor : quietAnchor
const delta = (at: number): [number, number] => at === 0 ? [-60, 0] : [60, 0]
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function step(s: ReturnType<typeof mount>, at: number, run = true) {
  if (at < 2) drag(s, at, ...delta(at), run)
  else s.overlay.querySelector<HTMLButtonElement>('.scene-angklung-finish')!.click()
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

describe('freely shaking a connected two-tube angklung', () => {
  function clock() { let now = 0; vi.spyOn(performance, 'now').mockImplementation(() => now); return (ms = 160) => { now += ms } }
  function finish(s: ReturnType<typeof mount>) { return s.overlay.querySelector<HTMLButtonElement>('.scene-angklung-finish')! }
  function move(s: ReturnType<typeof mount>, p: [number, number], x: number, y = 0) { event(s.hit, 'pointermove', [p[0] + x, p[1] + y]) }
  it('plays repeatedly during one continuous grab and finishes only with the button', () => {
    const tick = clock(), s = mount(), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p)
    for (const x of [36, -36, 36, -36, 36, -36]) { tick(); move(s, p, x) }
    expect(s.haptic).toHaveBeenCalledTimes(6); expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
    event(s.hit, 'pointerup', [p[0] - 36, p[1]]); s.run(10)
    expect(s.haptic).toHaveBeenCalledTimes(6); expect(s.complete).not.toHaveBeenCalled()
    finish(s).click(); finish(s).click(); expect(s.progress).toEqual([2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['angklung-frame-grip', 'angklung-tube-long-body', 'angklung-tube-short-body'])('accepts diagonal free movement from %s', name => {
    const s = mount(), p = s.point(name, name.includes('grip') ? gripAnchor : quietAnchor)
    event(s.hit, 'pointerdown', p); move(s, p, 36, -28)
    expect(s.scene.getObjectByName('angklung-frame')!.position.length()).toBeGreaterThan(.05)
    expect(s.progress).toEqual([2]); expect(s.haptic).toHaveBeenCalledOnce()
    finish(s).click(); expect(s.complete).not.toHaveBeenCalled()
    event(s.hit, 'pointerup', [p[0] + 36, p[1] - 28]); finish(s).click(); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('stays quiet during a hold, tiny jitter, a tap and passive settling', () => {
    const tick = clock(), s = mount(), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); s.run(2)
    for (let n = 0; n < 30; n++) { tick(); move(s, p, n % 2 ? -1 : 1) }
    event(s.hit, 'pointerup', p); s.run(3)
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('bounds pose and feedback cadence, including held overtravel', () => {
    const tick = clock(), s = mount(), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); tick(); move(s, p, 200); expect(s.haptic).toHaveBeenCalledOnce()
    tick(); move(s, p, 400); expect(s.haptic).toHaveBeenCalledOnce()
    expect(s.scene.getObjectByName('angklung-frame')!.position.x).toBeCloseTo(.28, 8)
    tick(20); move(s, p, -60); expect(s.haptic).toHaveBeenCalledTimes(2)
    tick(20); move(s, p, 60); expect(s.haptic).toHaveBeenCalledTimes(2)
    tick(120); move(s, p, -60); expect(s.haptic).toHaveBeenCalledTimes(3)
  })
  it('uses stronger haptics for a faster stroke', () => {
    const tick = clock(), s = mount(), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); tick(); move(s, p, 36)
    tick(90); move(s, p, 34); tick(20); move(s, p, -36)
    expect(s.haptic.mock.calls.map(call => call[0])).toEqual(['light', 'medium'])
  })
  it('plays its pitch and octave during motion, obeys live audio settings and closes once', () => {
    const frequencies: number[] = [], gains: number[] = []; let closed = 0, enabled = false
    class AudioBoundary {
      state = 'running'; currentTime = 0; destination = {}
      close() { closed++; return Promise.resolve() }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime(n: number) { if (n > .0001) gains.push(n) } }, connect(next: unknown) { return next } } }
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime(n: number) { frequencies.push(n) } }, connect(g: { connect(next: unknown): unknown }) { return g }, start() {}, stop() {} } }
    }
    vi.stubGlobal('AudioContext', AudioBoundary)
    const tick = clock(), s = mount(0, { isSoundEnabled: () => enabled }), p = s.point('angklung-frame-grip', gripAnchor)
    expect(frequencies).toEqual([]); event(s.hit, 'pointerdown', p); tick(); move(s, p, 36); expect(frequencies).toEqual([])
    enabled = true; tick(); move(s, p, -36); expect(frequencies).toEqual([392, 784])
    enabled = false; tick(); move(s, p, 36); expect(frequencies).toEqual([392, 784]); expect(s.haptic).toHaveBeenCalledTimes(3)
    event(s.hit, 'pointerup', [p[0] + 36, p[1]]); s.run(3); expect(frequencies).toEqual([392, 784])
    expect(gains.every(gain => gain <= .006)).toBe(true); s.instance.dispose(); s.instance.dispose(); expect(closed).toBe(1)
  })
  it('offers repeated keyboard shakes and a separate finish action', () => {
    const tick = clock(), s = mount()
    expect(finish(s).disabled).toBe(true); expect(s.button.style.minHeight).toBe('44px'); expect(s.overlay.querySelector('input,form')).toBeNull()
    s.button.click(); tick(); s.button.click(); tick(); s.button.click()
    expect(s.haptic).toHaveBeenCalledTimes(3); expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
    finish(s).click(); expect(s.progress).toEqual([2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('limits repeated keyboard clicks to the same feedback cadence as pointer motion', () => {
    const tick = clock(), s = mount()
    for (let n = 0; n < 30; n++) { tick(20); s.button.click() }
    expect(s.haptic.mock.calls.length).toBeGreaterThan(1); expect(s.haptic.mock.calls.length).toBeLessThanOrEqual(6)
    expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('keeps reduced-motion beats and identical final transforms', () => {
    const tick = clock(), normal = mount(), reduced = mount(0, { isReducedMotion: () => true })
    for (const s of [normal, reduced]) {
      const p = s.point('angklung-frame-grip', gripAnchor); event(s.hit, 'pointerdown', p)
      tick(); move(s, p, 36); tick(); move(s, p, -36); event(s.hit, 'pointerup', [p[0] - 36, p[1]])
      s.run(5); expect(s.haptic).toHaveBeenCalledTimes(2); expect(s.progress).toEqual([2])
    }
    normal.scene.updateMatrixWorld(true); reduced.scene.updateMatrixWorld(true)
    normal.scene.getObjectByName('angklung-subject')!.traverse(o => expect(o.matrixWorld.elements).toEqual(reduced.scene.getObjectByName(o.name)!.matrixWorld.elements))
  })
  it.each([false, true])('rebases a held gesture quietly when reduced motion changes from %s', initial => {
    let reduced = initial; const tick = clock(), s = mount(0, { isReducedMotion: () => reduced }), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); tick(); move(s, p, 36); expect(s.haptic).toHaveBeenCalledOnce()
    reduced = !reduced; tick(); move(s, p, 37); expect(s.haptic).toHaveBeenCalledOnce()
    tick(); move(s, p, 38); expect(s.haptic).toHaveBeenCalledOnce()
    tick(); move(s, p, 73); expect(s.haptic).toHaveBeenCalledTimes(2)
    event(s.hit, 'pointercancel', p); expect(s.scene.getObjectByName('angklung-frame')!.position.toArray()).toEqual([0, 0, 0])
  })
  it('stops released inertia immediately when reduced motion is enabled', () => {
    let reduced = false; const tick = clock(), s = mount(0, { isReducedMotion: () => reduced }), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); tick(); move(s, p, 36); event(s.hit, 'pointerup', [p[0] + 36, p[1]])
    reduced = true; s.instance.update(.025)
    expect(s.scene.getObjectByName('angklung-frame')!.position.toArray()).toEqual([0, 0, 0]); expect(s.haptic).toHaveBeenCalledOnce()
  })
  it('keeps released motion consistent across 30, 60 and 120fps without extra notes', () => {
    const tick = clock(), states: number[][] = []
    for (const fps of [30, 60, 120]) {
      const s = mount(), p = s.point('angklung-frame-grip', gripAnchor); event(s.hit, 'pointerdown', p)
      tick(); move(s, p, 36, 28); event(s.hit, 'pointerup', [p[0] + 36, p[1] + 28])
      for (let n = 0; n < fps; n++) s.instance.update(1 / fps)
      const frame = s.scene.getObjectByName('angklung-frame')!, tube = s.scene.getObjectByName('angklung-tube-long')!
      states.push([frame.position.x, frame.position.y, tube.rotation.x, tube.rotation.z]); expect(s.haptic).toHaveBeenCalledOnce()
    }
    states.forEach(state => state.forEach((value, i) => expect(value).toBeCloseTo(states[0]![i]!, 5)))
  })
  it('keeps rattan endpoints and basal contact joined through free motion without allocating geometry', () => {
    const tick = clock(), s = mount(), original = new Map<THREE.Mesh, THREE.BufferGeometry>()
    for (const size of ['long', 'short']) for (const side of ['front', 'back']) {
      const rope = s.scene.getObjectByName(`angklung-lashing-${size}-${side}`) as THREE.Mesh<THREE.TubeGeometry>; original.set(rope, rope.geometry)
    }
    const check = () => {
      s.scene.updateMatrixWorld(true)
      for (const size of ['long', 'short']) {
        expect(s.scene.getObjectByName(`angklung-foot-${size}`)!.getWorldPosition(new THREE.Vector3()).distanceTo(s.scene.getObjectByName(`angklung-socket-${size}`)!.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8)
        for (const side of ['front', 'back']) {
          const rope = s.scene.getObjectByName(`angklung-lashing-${size}-${side}`) as THREE.Mesh<THREE.TubeGeometry>
          for (const [t, end] of [[0, 'frame'], [1, 'tube']] as const) expect(rope.localToWorld(rope.geometry.parameters.path.getPoint(t)).distanceTo(s.scene.getObjectByName(`angklung-suspension-${size}-${end}-${side}`)!.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8)
          expect(rope.geometry).toBe(original.get(rope))
        }
      }
    }
    const p = s.point('angklung-frame-grip', gripAnchor); event(s.hit, 'pointerdown', p)
    for (const x of [36, -36, 36]) { tick(); move(s, p, x, -28); check() }
    event(s.hit, 'pointerup', [p[0] + 36, p[1] - 28]); for (let n = 0; n < 80; n++) { s.instance.update(.025); check() }
  })
  it.each([0, 1, 2, 3])('restores legacy checkpoint %i silently on ordinary and returning visits', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run()
      expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(s.scene.getObjectByName('angklung-frame')!.position.toArray()).toEqual([0, 0, 0])
      expect(cues(s).map(c => c.cue.kind)).toEqual(at < 3 ? ['drag'] : []); expect(finish(s).hidden).toBe(at === 0 || at === 3)
      if (at > 0 && at < 3) { finish(s).click(); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce() }
      s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('keeps all vertices in frame at both movement extremes at %ipx', width => {
    const tick = clock(), s = mount(0, {}, width), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p)
    for (const [x, y] of [[-140, -140], [140, 140]]) {
      tick(); move(s, p, x, y); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('angklung-subject')!.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.geometry) return
        const pos = mesh.geometry.getAttribute('position'), bounds = new THREE.Box3(), v = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) bounds.expandByPoint(v.fromBufferAttribute(pos, i).applyMatrix4(mesh.matrixWorld).project(s.camera))
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)), o.name).toBeLessThan(.97)
      })
    }
  })
  it.each(['pause', 'blur', 'pointercancel', 'lostpointercapture'])('cancels an unplayed grab on %s and accepts the next gesture', boundary => {
    let active = true; const tick = clock(), s = mount(0, { isActive: () => active }), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); move(s, p, 6)
    if (boundary === 'pause') { active = false; s.instance.update(.025) }
    else if (boundary === 'blur') window.dispatchEvent(new Event('blur'))
    else event(s.hit, boundary, p)
    event(s.hit, 'pointerup', p); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.scene.getObjectByName('angklung-frame')!.position.toArray()).toEqual([0, 0, 0])
    active = true; window.dispatchEvent(new Event('focus')); s.instance.update(0)
    event(s.hit, 'pointerdown', p); tick(); move(s, p, 36); expect(s.progress).toEqual([2])
  })
  it('freezes released sway while paused and resumes without extra notes', () => {
    let active = true; const tick = clock(), s = mount(0, { isActive: () => active }), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', p); tick(); move(s, p, 36); event(s.hit, 'pointerup', [p[0] + 36, p[1]])
    const frame = s.scene.getObjectByName('angklung-frame')!, before = frame.position.toArray(); active = false; s.run(2)
    expect(frame.position.toArray()).toEqual(before); active = true; s.run(.2); expect(frame.position.toArray()).not.toEqual(before)
    expect(s.haptic).toHaveBeenCalledOnce(); expect(s.complete).not.toHaveBeenCalled()
  })
  it('rejects empty space, orphan release input and a target behind an opaque object', () => {
    const s = mount(), p = s.point('angklung-frame-grip', gripAnchor)
    event(s.hit, 'pointerdown', [1, 1]); move(s, p, 36); event(s.hit, 'pointerup', p)
    event(s.hit, 'pointerup', [p[0] + 60, p[1]])
    const blocker = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.lerpVectors(s.scene.getObjectByName('angklung-frame-grip')!.getWorldPosition(new THREE.Vector3()), s.camera.position, .1); blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker)
    event(s.hit, 'pointerdown', p); move(s, p, 36); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose()
  })
  it.each(['nan', 'multitouch'])('rejects %s during a grab', boundary => {
    const s = mount(), p = s.point('angklung-frame-grip', gripAnchor); event(s.hit, 'pointerdown', p)
    if (boundary === 'nan') event(s.hit, 'pointermove', [NaN, p[1]])
    else event(s.hit, 'pointerdown', [1, 1], 2)
    move(s, p, 36); event(s.hit, 'pointerup', p); event(s.hit, 'pointerup', p, 2)
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('blocks synchronous reentry from %s', callback => {
    let attack = () => {}; const seen: number[] = [], s = mount(0, { [callback]: () => attack(), onProgress: n => { seen.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); finish(s).click(); step(s, 0); s.instance.update(100) }
    s.button.click(); expect(seen).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
    finish(s).click(); expect(seen).toEqual([2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('stops stale work after %s pauses or disposes', callback => {
    for (const mode of ['pause', 'dispose']) {
      let active = true, destroy = () => {}; const s = mount(0, { isActive: () => active, [callback]: () => { if (mode === 'pause') active = false; else destroy() } })
      destroy = () => s.instance.dispose(); const before = rendered.render.mock.calls.length
      s.button.click(); s.instance.update(.1); finish(s)?.click(); expect(s.complete).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(before)
      s.instance.dispose()
    }
  })
  it.each([NaN, Infinity, -9])('normalizes invalid restoration %s silently', at => {
    const s = mount(at); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); s.button.click(); expect(s.progress).toEqual([2])
  })
  it('models two different hollow, front-slotted tubes with opaque curved walls and open upper mouths', () => {
    const s = mount()
    for (const [size, height] of [['long', 2.3], ['short', 1.78]] as const) {
      const body = s.scene.getObjectByName(`angklung-tube-${size}-body`) as THREE.Mesh, group = s.scene.getObjectByName(`angklung-tube-${size}`)!
      const ray = (y: number) => new THREE.Raycaster(group.localToWorld(new THREE.Vector3(0, y, 1)), new THREE.Vector3(0, 0, -1)).intersectObject(body)
      expect(ray(.7)[0]?.point.z).toBeGreaterThan(.17)
      expect(ray(height - .1)[0]?.point.z).toBeLessThan(0)
      expect(new THREE.Raycaster(group.localToWorld(new THREE.Vector3(0, height + .1, 0)), new THREE.Vector3(0, -1, 0)).intersectObject(body)).toHaveLength(0)
      expect((body.material as THREE.MeshStandardMaterial).roughness).toBeGreaterThan(.7)
    }
    expect(s.scene.getObjectByName('angklung-table')).toBeUndefined()
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
