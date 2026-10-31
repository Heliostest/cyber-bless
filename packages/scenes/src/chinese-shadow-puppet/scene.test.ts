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
// Keep these geometry/input tests on their original completion contract.
// Real automatic timing is exercised in quiet-ending-eight-crafts.test.ts.
vi.mock('../quiet-ending', () => ({ createQuietEnding: () => ({ running: false, completing: true, sync() {}, update() {}, dispose() {} }) }))

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
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const write = (text: string) => { const input = overlay.querySelector<HTMLInputElement>('input')!; input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, write, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}

const gripAnchor: [number, number, number] = [0, 0, .075]
const quietAnchor: [number, number, number] = [.16, 0, .028]
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(at === 0 ? 'shadow-main-grip' : 'shadow-wing-grip', at === 0 ? [0, 0, .075] : gripAnchor)
  event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function lift(s: ReturnType<typeof mount>, run = true) { drag(s, 0, 0, -60, run) }
function turn(s: ReturnType<typeof mount>, run = true) { drag(s, 1, 60, 0, run) }
function tap(s: ReturnType<typeof mount>) { const p = s.point('shadow-bird-body', quietAnchor); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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
function shield(s: ReturnType<typeof mount>, at: number) {
  const name = at === 0 ? 'shadow-main-grip' : at === 1 ? 'shadow-wing-grip' : 'shadow-bird-body'
  const anchor = at === 0 ? [0, 0, .075] : at === 1 ? gripAnchor : quietAnchor
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('an original articulated shadow bird in its theatre', () => {
  it('exposes an object input surface and real native action without progressing on entry', () => {
    const s = mount(); expect(s.hit).not.toBeNull(); expect(s.button?.type).toBe('button'); expect(s.progress).toEqual([])
  })
  it.each([false, true])('lifts the bird, articulates its wing and finishes with actual touch, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced }), bird = s.scene.getObjectByName('shadow-bird')!, wing = s.scene.getObjectByName('shadow-wing')!
    const before = bird.position.clone(), angle = wing.rotation.z
    lift(s); expect(s.progress).toEqual([1]); expect(bird.position.y - before.y).toBeGreaterThan(.4)
    turn(s); expect(s.progress).toEqual([1, 2]); expect(Math.abs(wing.rotation.z - angle)).toBeGreaterThan(.7)
    tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('keeps both rigid rods connected to their actual joints through intermediate motion', () => {
    for (const at of [0, 1]) {
      const s = mount(at), p = s.point(at === 0 ? 'shadow-main-grip' : 'shadow-wing-grip', gripAnchor)
      event(s.hit, 'pointerdown', p)
      for (const amount of [0, 15, 30, 45, 60]) {
        event(s.hit, 'pointermove', at === 0 ? [p[0], p[1] - amount] : [p[0] + amount, p[1]])
        s.scene.updateMatrixWorld(true)
        for (const prefix of ['main', 'wing']) {
          const rod = s.scene.getObjectByName(`shadow-${prefix}-rod`)!, grip = s.scene.getObjectByName(`shadow-${prefix}-grip`)!, joint = s.scene.getObjectByName(`shadow-${prefix}-joint`)!
          expect(rod.localToWorld(new THREE.Vector3(0, .5, 0)).distanceTo(joint.getWorldPosition(new THREE.Vector3()))).toBeLessThan(.0001)
          expect(rod.localToWorld(new THREE.Vector3(0, -.5, 0)).distanceTo(grip.localToWorld(new THREE.Vector3(0, .12, 0)))).toBeLessThan(.0001)
        }
      }
    }
  })
  it('projects the pierced moving puppet from the visible lamp onto the cloth with matching holes', () => {
    for (const at of [0, 1, 2]) {
      const s = mount(at), lamp = s.scene.getObjectByName('shadow-light-source')!.getWorldPosition(new THREE.Vector3())
      const body = s.scene.getObjectByName('shadow-bird-body')! as THREE.Mesh, wing = s.scene.getObjectByName('shadow-wing-feather')! as THREE.Mesh
      const shadow = s.scene.getObjectByName('shadow-projection')! as THREE.Mesh
      const sources: THREE.Object3D[] = []; s.scene.getObjectByName('shadow-puppet-rig')!.traverse(o => { if ((o as THREE.Mesh).isMesh) sources.push(o) })
      let lightSamples = 0, darkSamples = 0
      for (const mesh of [body, wing]) for (let x = -.55; x <= .55; x += .073) for (let y = -.22; y <= .32; y += .067) {
        const sample = mesh.localToWorld(new THREE.Vector3(x, y, .015)), direction = sample.clone().sub(lamp).normalize()
        const ray = new THREE.Raycaster(lamp, direction, 0, lamp.distanceTo(sample) + .1)
        const point = lamp.clone().addScaledVector(direction, (-.16 - lamp.z) / direction.z)
        if (Math.abs(point.x) > 1.5 || point.y < .73 || point.y > 2.85) continue
        const blocked = ray.intersectObjects(sources, false).length > 0
        const projected = new THREE.Raycaster(point.clone().add(new THREE.Vector3(0, 0, .05)), new THREE.Vector3(0, 0, -1), 0, .1).intersectObject(shadow).length > 0
        expect(projected, `checkpoint=${at} sample=${x},${y}`).toBe(blocked)
        if (blocked) darkSamples++; else lightSamples++
      }
      expect(lightSamples).toBeGreaterThan(12); expect(darkSamples).toBeGreaterThan(12)
    }
  })
  it('keeps the entire projected bird contour inside the cloth throughout both motions', () => {
    for (const at of [0, 1]) {
      const s = mount(at), p = s.point(at === 0 ? 'shadow-main-grip' : 'shadow-wing-grip', gripAnchor)
      event(s.hit, 'pointerdown', p)
      for (const amount of [0, 15, 30, 45, 60]) {
        event(s.hit, 'pointermove', at === 0 ? [p[0], p[1] - amount] : [p[0] + amount, p[1]])
        s.scene.updateMatrixWorld(true)
        const origin = s.scene.getObjectByName('shadow-light-source')!.getWorldPosition(new THREE.Vector3()), bounds = new THREE.Box3()
        s.scene.getObjectByName('shadow-bird')!.traverse(o => {
          const m = o as THREE.Mesh; if (!m.geometry) return
          const vertices = m.geometry.getAttribute('position')
          for (let i = 0; i < vertices.count; i++) {
            const direction = m.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, i)).sub(origin)
            bounds.expandByPoint(origin.clone().addScaledVector(direction, (-.16 - origin.z) / direction.z))
          }
        })
        expect(bounds.min.x).toBeGreaterThan(-1.53); expect(bounds.max.x).toBeLessThan(1.53)
        expect(bounds.min.y).toBeGreaterThan(.73); expect(bounds.max.y).toBeLessThan(3.05)
      }
    }
  })
  it.each([0, 1])('rejects wrong surfaces, missing movement, short, reverse, diagonal and returned gestures at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(at === 0 ? 'shadow-main-grip' : 'shadow-wing-grip', at === 0 ? [0, 0, .075] : gripAnchor)
    const end: [number, number] = at === 0 ? [p[0], p[1] - 60] : [p[0] + 60, p[1]]
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    const board = s.point('shadow-cloth', [1.3, .7, 0]); event(s.hit, 'pointerdown', board); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    event(s.hit, 'pointerup', end)
    for (const [dx, dy] of at === 0 ? [[0, -8], [0, 60], [-60, 0], [90, -60]] : [[8, 0], [-60, 0], [0, 60], [60, 90]]) drag(s, at, dx, dy)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); at === 0 ? lift(s) : turn(s); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects reverse starts and partial backtracks while allowing small finger jitter at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(at === 0 ? 'shadow-main-grip' : 'shadow-wing-grip', gripAnchor)
    const position = (along: number): [number, number] => at === 0 ? [p[0], p[1] - along] : [p[0] + along, p[1]]
    for (const history of [[75, 42], [-40, 60]]) {
      event(s.hit, 'pointerdown', p); for (const value of history) event(s.hit, 'pointermove', position(value)); event(s.hit, 'pointerup', position(history[1]!))
      expect(s.progress).toEqual([])
    }
    event(s.hit, 'pointerdown', p); for (const value of [8, 5, 25, 23, 60]) event(s.hit, 'pointermove', position(value)); event(s.hit, 'pointerup', position(60))
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3].flatMap(at => [false, true].map(reduced => ({ at, reduced }))))('restores checkpoint $at silently with a native 44px fallback, reduced=$reduced', ({ at, reduced }) => {
    const s = mount(at, { isReducedMotion: () => reduced }); s.run()
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
    expect(s.button.type).toBe('button'); expect(s.button.hidden).toBe(at === 3); expect(s.button.style.minHeight).toBe('44px')
    for (let i = at; i < 3; i++) { s.button.click(); s.run() }
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([284, 350, 1280])('keeps every subject vertex and opaque first-hit cue in view at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('shadow-theatre')!.traverse(o => {
        const m = o as THREE.Mesh; if (!m.geometry) return
        for (let p: THREE.Object3D | null = o; p; p = p.parent) if (!p.visible) return
        const pos = m.geometry.getAttribute('position'), bounds = new THREE.Box3(), p = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) bounds.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(s.camera))
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)), m.name).toBeLessThan(.97)
      })
      for (const { object, cue } of cues(s)) {
        const hit = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(hit.object?.name, `first opaque cue ${object.name}`).toBe(object.name)
        expect(Math.abs(hit.q.x)).toBeLessThan(.97); expect(Math.abs(hit.q.y)).toBeLessThan(.97)
      }
      if (at === 0) lift(s); if (at === 1) turn(s); if (at === 2) tap(s)
      expect(s.progress).toEqual(at < 3 ? [at + 1] : []); s.instance.dispose()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels %s without progress and resets the true craft pose', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }), object = s.scene.getObjectByName(at === 0 ? 'shadow-bird' : 'shadow-wing-grip')!, home = object.position.clone(), angle = object.rotation.y
      const p = s.point(at === 0 ? 'shadow-main-grip' : 'shadow-wing-grip', at === 0 ? [0, 0, .075] : gripAnchor)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', at === 0 ? [p[0], p[1] - 30] : [p[0] + 30, p[1]])
      const frames = rendered.render.mock.calls.length
      if (kind === 'pause') { active = false; s.instance.update(.05); s.instance.update(.05); expect(rendered.render.mock.calls.length).toBe(frames) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', at === 0 ? [p[0], p[1] - 60] : [p[0] + 60, p[1]]); s.run()
      expect(s.progress).toEqual([]); expect(object.position.distanceTo(home)).toBeLessThan(.00001); expect(object.rotation.y).toBe(angle)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025)
      expect(s.button.disabled).toBe(false); at === 0 ? lift(s) : turn(s); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1])('freezes an accepted transition across pause at %i and clamps hostile dt', at => {
    let active = true; const s = mount(at, { isActive: () => active })
    at === 0 ? lift(s, false) : turn(s, false); expect(s.button.disabled).toBe(true)
    for (const dt of [Number.NaN, Infinity, -10, 100000]) s.instance.update(dt)
    expect(s.progress).toEqual([]); active = false
    const object = s.scene.getObjectByName(at === 0 ? 'shadow-bird' : 'shadow-wing-grip')!, p = object.position.clone(), a = object.rotation.y, frames = rendered.render.mock.calls.length
    s.run(2); expect(rendered.render.mock.calls.length).toBe(frames); expect(object.position.distanceTo(p)).toBeLessThan(.00001); expect(object.rotation.y).toBe(a); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('requires the first visible opaque surface at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), unblock = shield(s, at)
    at === 0 ? lift(s) : at === 1 ? turn(s) : tap(s); expect(s.progress).toEqual([])
    unblock(); at === 0 ? lift(s) : at === 1 ? turn(s) : tap(s); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('preserves its owner when prepareFeedback dispatches pointer input at %i', at => {
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(s.hit, type, [1, 1])
      at === 0 ? lift(s) : at === 1 ? turn(s) : tap(s); expect(s.progress, type).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('preserves its real owner through prepareFeedback input outside the hit layer at %i', at => {
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerdown', 'pointermove']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(document.body, type, [1, 1])
      at === 0 ? lift(s) : at === 1 ? turn(s) : tap(s)
      expect(s.progress, type).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('cancels the genuine pointer when prepareFeedback briefly pauses and resumes the host at %i', at => {
    let attack = () => {}, active = true
    const s = mount(at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback: () => attack() })
    attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
    at === 0 ? lift(s) : at === 1 ? turn(s) : tap(s); expect(s.progress).toEqual([])
    attack = () => {}; at === 0 ? lift(s) : at === 1 ? turn(s) : tap(s); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('cancels the keyboard action when feedback briefly pauses the host at %i', at => {
    let active = true, attack = () => {}
    const s = mount(at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback: () => attack() })
    attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
    // Retry before an active animation frame: suspended is still true, but
    // every fresh inactive boundary must invalidate this prepared action.
    for (let i = 0; i < 2; i++) { s.button.click(); expect(s.progress).toEqual([]) }
    attack = () => {}; s.button.click(); s.run(); expect(s.progress).toEqual([at + 1])
  })
  it('retains an unsubmitted draft when feedback briefly pauses the host', () => {
    let active = true, attack = () => {}
    const s = mount(2, { isActive: () => active, prepareFeedback: () => attack() })
    attack = () => { active = false; s.instance.update(0); active = true }
    for (let i = 0; i < 2; i++) { s.write('保留草稿'); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled() }
    attack = () => {}; s.write('保留草稿'); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('保留草稿')
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('blocks synchronous %s step skipping and update reentry', callback => {
    let attack = () => {}; const seen: number[] = [], s = mount(0, { isReducedMotion: () => true, [callback]: () => attack(), onProgress: n => { seen.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); lift(s); turn(s); s.instance.update(100) }
    s.button.click(); expect(seen).toEqual([1]); s.button.click(); expect(seen).toEqual([1, 2]); s.button.click(); expect(seen).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('rejects two-finger ownership and taps that moved away and returned', () => {
    const s = mount(0, { isReducedMotion: () => true }), p = s.point('shadow-main-grip', [0, 0, .075])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0], p[1] - 60]); event(s.hit, 'pointerup', [p[0], p[1] - 60]); event(s.hit, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); lift(s); turn(s)
    const q = s.point('shadow-bird-body', quietAnchor); event(s.hit, 'pointerdown', q); event(s.hit, 'pointermove', [q[0] + 18, q[1]]); event(s.hit, 'pointerup', q); expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('saves a trimmed explicit wish once and never saves quiet drafts or returning visits', () => {
    const s = mount(2), input = s.overlay.querySelector<HTMLInputElement>('input')!; expect(input.maxLength).toBeGreaterThan(40); s.write('  '); s.write('心'.repeat(41)); expect(s.progress).toEqual([])
    const form = input.form!; s.saveWish.mockImplementation(() => { form.dispatchEvent(new Event('submit', { cancelable: true })); s.button.click(); tap(s) })
    s.write('  日常安好  '); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('日常安好'); expect(s.complete).toHaveBeenCalledOnce()
    const q = mount(2); q.overlay.querySelector<HTMLInputElement>('input')!.value = '草稿'; tap(q); expect(q.saveWish).not.toHaveBeenCalled()
    const r = mount(2, { returning: true }); expect(r.overlay.querySelector('input')).toBeNull(); tap(r); expect(r.saveWish).not.toHaveBeenCalled()
  })
  it('rejects early wish submission and submission while a real pointer owns the puppet', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.saveWish).not.toHaveBeenCalled(); s.button.click(); s.write('提前'); expect(s.saveWish).not.toHaveBeenCalled(); s.button.click()
    const p = s.point('shadow-bird-body', quietAnchor); event(s.hit, 'pointerdown', p); s.write('触摸中'); expect(s.saveWish).not.toHaveBeenCalled(); event(s.hit, 'pointercancel', p); s.write('安好'); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('安好')
  })
  it('commits wish progress atomically if saving pauses the host', () => {
    let active = true; const seen: number[] = [], s = mount(2, { isActive: () => active, onProgress: n => seen.push(n) })
    s.saveWish.mockImplementation(() => { active = false; s.button.click(); s.instance.update(.1) }); s.write('平安')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('平安'); expect(seen).toEqual([3]); expect(s.complete).not.toHaveBeenCalled(); active = true; s.instance.update(.1); s.button.click(); expect(seen).toEqual([3])
  })
  it('stops after an explicit save callback disposes the scene', () => {
    const s = mount(2); s.saveWish.mockImplementation(() => s.instance.dispose()); const frames = rendered.render.mock.calls.length
    s.write('安好'); s.instance.update(.05); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('安好'); expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(frames); expect(s.overlay.childElementCount).toBe(0)
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('stops rendering if %s pauses or disposes the scene', callback => {
    for (const mode of ['pause', 'dispose']) {
      let active = true, destroy = () => {}; const s = mount(0, { isReducedMotion: () => true, isActive: () => active, [callback]: () => { if (mode === 'pause') active = false; else destroy() } })
      destroy = () => s.instance.dispose(); const frames = rendered.render.mock.calls.length; s.button.click(); s.instance.update(.1); s.button.click(); expect(rendered.render.mock.calls.length).toBe(frames)
      if (mode === 'dispose') expect(s.overlay.childElementCount).toBe(0); s.instance.dispose()
    }
  })
  it.each([NaN, Infinity, -9])('normalizes invalid restore %s without reporting progress', initial => {
    const s = mount(initial, { isReducedMotion: () => true }); s.instance.start(); s.instance.update(NaN); expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([1])
  })
  it('removes all pointer callback guards exactly once', () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener'), removed = vi.spyOn(EventTarget.prototype, 'removeEventListener')
    const windowAdded = vi.spyOn(window, 'addEventListener'), windowRemoved = vi.spyOn(window, 'removeEventListener'), s = mount()
    const guards = added.mock.calls.filter(([type, , options], i) => added.mock.contexts[i] === s.hit && options === true && ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'].includes(type))
    expect(guards).toHaveLength(5); s.instance.dispose(); s.instance.dispose()
    for (const [type, listener, options] of guards) {
      expect(removed.mock.calls.filter(([t, l, o], i) => removed.mock.contexts[i] === s.hit && t === type && l === listener && o === options)).toHaveLength(1)
      expect(windowAdded.mock.calls.filter(([t, l, o]) => t === type && l === listener && o === options)).toHaveLength(1)
      expect(windowRemoved.mock.calls.filter(([t, l, o]) => t === type && l === listener && o === options)).toHaveLength(1)
    }
  })
  it('frees geometry, material, cues and DOM once and rejects retained inputs after disposal', () => {
    const s = mount(2), resources = new Set<THREE.BufferGeometry | THREE.Material>(), cued: THREE.Object3D[] = []
    s.scene.traverse(o => { if (o.userData.interactionCues?.length) cued.push(o); const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const p = s.point('shadow-bird-body', quietAnchor), form = s.overlay.querySelector('form')!, input = s.overlay.querySelector('input')!; input.value = '已销毁'
    const renderer = rendered.renderer as THREE.WebGLRenderer, frames = rendered.render.mock.calls.length; s.instance.dispose(); s.instance.dispose(); s.button.click(); form.dispatchEvent(new Event('submit', { cancelable: true })); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p); s.instance.start(); s.instance.update(10)
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(frames); expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); for (const o of cued) expect(o.userData.interactionCues).toEqual([])
  })
})
