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

const foldAnchor: [number, number, number] = [.84, .20, .016]
const quietAnchor: [number, number, number] = [.32, .59, .016]
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(at === 0 ? 'paper-scissors-grip' : 'paper-folded-half', at === 0 ? [0, 0, .024] : foldAnchor)
  event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function cut(s: ReturnType<typeof mount>, run = true) { drag(s, 0, 0, -64, run) }
function unfold(s: ReturnType<typeof mount>, run = true) { drag(s, 1, -72, 0, run) }
function tap(s: ReturnType<typeof mount>) { const p = s.point('paper-fixed-half', quietAnchor); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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
  const name = at === 0 ? 'paper-scissors-grip' : at === 1 ? 'paper-folded-half' : 'paper-fixed-half'
  const anchor = at === 0 ? [0, 0, .024] : at === 1 ? foldAnchor : quietAnchor
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('an original folded floral paper cut', () => {
  it('offers a real scene input surface and native accessible action without progressing on entry', () => {
    const s = mount()
    expect(s.hit, 'the paper workshop must expose its actual object gesture surface').not.toBeNull()
    expect(s.button?.type).toBe('button')
    expect(s.progress).toEqual([])
  })
  it.each([false, true])('cuts a physical offcut, unfolds the mirrored paper and finishes only once, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced })
    const flap = s.scene.getObjectByName('paper-fold-hinge')!, scrap = s.scene.getObjectByName('paper-offcut')!, scissors = s.scene.getObjectByName('paper-scissors')!
    const home = scrap.position.clone(), toolHome = scissors.position.clone()
    expect(flap.rotation.y).toBeCloseTo(0)
    cut(s); expect(s.progress).toEqual([1]); expect(scrap.position.distanceTo(home)).toBeGreaterThan(.3); expect(scissors.position.distanceTo(toolHome)).toBeGreaterThan(.2)
    unfold(s); expect(s.progress).toEqual([1, 2]); expect(flap.rotation.y).toBeCloseTo(-Math.PI)
    tap(s); tap(s); s.button.click(); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('makes the tool and paper follow actual pointer motion before acceptance', () => {
    const s = mount(0), tool = s.scene.getObjectByName('paper-scissors')!, home = tool.position.clone(), p = s.point('paper-scissors-grip', [0, 0, .024])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0], p[1] - 30]); expect(tool.position.distanceTo(home)).toBeGreaterThan(.15); expect(s.progress).toEqual([])
    event(s.hit, 'pointercancel', p); expect(tool.position.distanceTo(home)).toBeLessThan(.00001)
    const u = mount(1), h = u.scene.getObjectByName('paper-fold-hinge')!, a = u.point('paper-folded-half', foldAnchor)
    event(u.hit, 'pointerdown', a); event(u.hit, 'pointermove', [a[0] - 30, a[1]]); expect(h.rotation.y).toBeLessThan(-.8); expect(h.rotation.y).toBeGreaterThan(-2); expect(u.progress).toEqual([])
  })
  it.each([0, 1])('rejects wrong surfaces, orphan release, short, reverse, diagonal and returned gestures at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(at === 0 ? 'paper-scissors-grip' : 'paper-folded-half', at === 0 ? [0, 0, .024] : foldAnchor)
    const end: [number, number] = at === 0 ? [p[0], p[1] - 64] : [p[0] - 72, p[1]]
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    const board = s.point('paper-cream-board', [-1, .6, .055]); event(s.hit, 'pointerdown', board); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    event(s.hit, 'pointerup', end)
    for (const [dx, dy] of at === 0 ? [[0, -8], [0, 65], [65, 0], [90, -64]] : [[-8, 0], [70, 0], [0, -70], [-72, 90]]) drag(s, at, dx, dy)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); at === 0 ? cut(s) : unfold(s); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently with a native 44px fallback and no saved draft', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
    expect(s.button.type).toBe('button'); expect(s.button.hidden).toBe(at === 3); expect(s.button.style.minHeight).toBe('44px')
    expect(s.scene.getObjectByName('paper-fold-hinge')!.rotation.y).toBeCloseTo(at >= 2 ? -Math.PI : 0)
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([284, 350, 1280])('keeps every subject vertex and opaque first-hit cue in view at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('paper-workbench')!.traverse(o => {
        // Only the broad background tabletop is deliberately cropped.
        const m = o as THREE.Mesh; if (!m.geometry || m.name === 'paper-wood-table') return
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
      if (at === 0) cut(s); if (at === 1) unfold(s); if (at === 2) tap(s)
      expect(s.progress).toEqual(at < 3 ? [at + 1] : []); s.instance.dispose()
    }
  })
  it('has two matching solid paper shells, real holes, and blade and handle geometry', () => {
    const s = mount(2), right = s.scene.getObjectByName('paper-fixed-half')! as THREE.Mesh, left = s.scene.getObjectByName('paper-folded-half')! as THREE.Mesh
    const a = new THREE.Box3().setFromBufferAttribute(right.geometry.getAttribute('position') as THREE.BufferAttribute)
    expect(a.max.z - a.min.z).toBeGreaterThan(.01)
    expect(new THREE.Box3().setFromObject(left).min.x).toBeLessThan(-.8)
    expect(new THREE.Box3().setFromObject(right).max.x).toBeGreaterThan(.8)
    const direction = new THREE.Vector3(0, 0, -1).transformDirection(right.matrixWorld)
    for (const name of ['paper-fixed-half', 'paper-folded-half']) {
      const m = s.scene.getObjectByName(name)! as THREE.Mesh
      const dir = new THREE.Vector3(0, 0, -1).transformDirection(m.matrixWorld)
      for (const [x, y] of [[.57, .06], [.40, -.59], [.35, .65]]) {
        const ray = new THREE.Raycaster(m.localToWorld(new THREE.Vector3(x, y, .3)), dir)
        expect(ray.intersectObject(m, false), `real hole ${name} at ${x},${y}`).toHaveLength(0)
      }
    }
    const solid = new THREE.Raycaster(right.localToWorld(new THREE.Vector3(.1, 0, .3)), direction)
    expect(solid.intersectObject(right, false).length).toBeGreaterThan(0)
    for (const name of ['paper-scissors-blade-left', 'paper-scissors-blade-right', 'paper-scissors-handle-left', 'paper-scissors-handle-right']) expect((s.scene.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position').count).toBeGreaterThan(24)
  })
  it('supports the flat mat, paper, offcut and scissors without a raised display board', () => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at), mat = s.scene.getObjectByName('paper-cream-board')!, matBounds = new THREE.Box3().setFromObject(mat), table = new THREE.Box3().setFromObject(s.scene.getObjectByName('paper-wood-table')!)
      expect(Math.abs(matBounds.min.y - table.max.y)).toBeLessThan(.001)
      for (const name of ['paper-fixed-half', 'paper-offcut', 'paper-scissors']) {
        const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!), center = bounds.getCenter(new THREE.Vector3())
        const contact = new THREE.Raycaster(new THREE.Vector3(center.x, bounds.min.y + .1, center.z), new THREE.Vector3(0, -1, 0)).intersectObject(mat)[0]
        expect(contact, name).toBeDefined(); expect(Math.abs(contact.point.y - bounds.min.y), name).toBeLessThan(.006)
      }
      const folded = new THREE.Box3().setFromObject(s.scene.getObjectByName('paper-folded-half')!), fixed = new THREE.Box3().setFromObject(s.scene.getObjectByName('paper-fixed-half')!)
      expect(Math.abs(folded.min.y - (at < 2 ? fixed.max.y : matBounds.max.y))).toBeLessThan(.001)
      expect(s.scene.getObjectByName('paper-board-support')).toBeUndefined(); expect(s.scene.getObjectByName('paper-table-leg')).toBeUndefined()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels %s without progress and resets the true craft pose', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }), object = s.scene.getObjectByName(at === 0 ? 'paper-scissors' : 'paper-fold-hinge')!, home = object.position.clone(), angle = object.rotation.y
      const p = s.point(at === 0 ? 'paper-scissors-grip' : 'paper-folded-half', at === 0 ? [0, 0, .024] : foldAnchor)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', at === 0 ? [p[0], p[1] - 30] : [p[0] - 30, p[1]])
      const frames = rendered.render.mock.calls.length
      if (kind === 'pause') { active = false; s.instance.update(.05); s.instance.update(.05); expect(rendered.render.mock.calls.length).toBe(frames) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', at === 0 ? [p[0], p[1] - 64] : [p[0] - 72, p[1]]); s.run()
      expect(s.progress).toEqual([]); expect(object.position.distanceTo(home)).toBeLessThan(.00001); expect(object.rotation.y).toBe(angle)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025)
      expect(s.button.disabled).toBe(false); at === 0 ? cut(s) : unfold(s); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1])('freezes an accepted transition across pause at %i and clamps hostile dt', at => {
    let active = true; const s = mount(at, { isActive: () => active })
    at === 0 ? cut(s, false) : unfold(s, false); expect(s.button.disabled).toBe(true)
    for (const dt of [Number.NaN, Infinity, -10, 100000]) s.instance.update(dt)
    expect(s.progress).toEqual([]); active = false
    const object = s.scene.getObjectByName(at === 0 ? 'paper-offcut' : 'paper-fold-hinge')!, p = object.position.clone(), a = object.rotation.y, frames = rendered.render.mock.calls.length
    s.run(2); expect(rendered.render.mock.calls.length).toBe(frames); expect(object.position.distanceTo(p)).toBeLessThan(.00001); expect(object.rotation.y).toBe(a); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('requires the first visible opaque surface at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), unblock = shield(s, at)
    at === 0 ? cut(s) : at === 1 ? unfold(s) : tap(s); expect(s.progress).toEqual([])
    unblock(); at === 0 ? cut(s) : at === 1 ? unfold(s) : tap(s); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('preserves its owner when prepareFeedback dispatches pointer input at %i', at => {
    for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(s.hit, type, [1, 1])
      at === 0 ? cut(s) : at === 1 ? unfold(s) : tap(s); expect(s.progress, type).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('preserves its real owner through prepareFeedback input outside the hit layer at %i', at => {
    for (const type of ['pointerup', 'pointercancel', 'lostpointercapture', 'pointerdown', 'pointermove']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(document.body, type, [1, 1])
      at === 0 ? cut(s) : at === 1 ? unfold(s) : tap(s)
      expect(s.progress, type).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('cancels the genuine pointer when prepareFeedback briefly pauses and resumes the host at %i', at => {
    let attack = () => {}, active = true
    const s = mount(at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback: () => attack() })
    attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
    at === 0 ? cut(s) : at === 1 ? unfold(s) : tap(s); expect(s.progress).toEqual([])
    attack = () => {}; at === 0 ? cut(s) : at === 1 ? unfold(s) : tap(s); expect(s.progress).toEqual([at + 1])
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
  it('unfolds from a clearly visible point on the folded paper', () => {
    const s = mount(1, { isReducedMotion: () => true }), p = s.point('paper-folded-half', [.1, 0, .016])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] - 72, p[1]]); event(s.hit, 'pointerup', [p[0] - 72, p[1]]); s.run()
    expect(s.progress).toEqual([2])
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('blocks synchronous %s step skipping and update reentry', callback => {
    let attack = () => {}; const seen: number[] = [], s = mount(0, { isReducedMotion: () => true, [callback]: () => attack(), onProgress: n => { seen.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); cut(s); unfold(s); s.instance.update(100) }
    s.button.click(); expect(seen).toEqual([1]); s.button.click(); expect(seen).toEqual([1, 2]); s.button.click(); expect(seen).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('rejects two-finger ownership and taps that moved away and returned', () => {
    const s = mount(0, { isReducedMotion: () => true }), p = s.point('paper-scissors-grip', [0, 0, .024])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0], p[1] - 64]); event(s.hit, 'pointerup', [p[0], p[1] - 64]); event(s.hit, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); cut(s); unfold(s)
    const q = s.point('paper-fixed-half', quietAnchor); event(s.hit, 'pointerdown', q); event(s.hit, 'pointermove', [q[0] + 18, q[1]]); event(s.hit, 'pointerup', q); expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('saves a trimmed explicit wish once and never saves quiet drafts or returning visits', () => {
    const s = mount(2), input = s.overlay.querySelector<HTMLInputElement>('input')!; expect(input.maxLength).toBe(40); s.write('  '); s.write('心'.repeat(41)); expect(s.progress).toEqual([])
    const form = input.form!; s.saveWish.mockImplementation(() => { form.dispatchEvent(new Event('submit', { cancelable: true })); s.button.click(); tap(s) })
    s.write('  日常安好  '); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('日常安好'); expect(s.complete).toHaveBeenCalledOnce()
    const q = mount(2); q.overlay.querySelector<HTMLInputElement>('input')!.value = '草稿'; tap(q); expect(q.saveWish).not.toHaveBeenCalled()
    const r = mount(2, { returning: true }); expect(r.overlay.querySelector('input')).toBeNull(); tap(r); expect(r.saveWish).not.toHaveBeenCalled()
  })
  it('rejects early wish submission and submission while a real pointer owns the paper', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.saveWish).not.toHaveBeenCalled(); s.button.click(); s.write('提前'); expect(s.saveWish).not.toHaveBeenCalled(); s.button.click()
    const p = s.point('paper-fixed-half', quietAnchor); event(s.hit, 'pointerdown', p); s.write('触摸中'); expect(s.saveWish).not.toHaveBeenCalled(); event(s.hit, 'pointercancel', p); s.write('安好'); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('安好')
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
    const p = s.point('paper-fixed-half', quietAnchor), form = s.overlay.querySelector('form')!, input = s.overlay.querySelector('input')!; input.value = '已销毁'
    const renderer = rendered.renderer as THREE.WebGLRenderer, frames = rendered.render.mock.calls.length; s.instance.dispose(); s.instance.dispose(); s.button.click(); form.dispatchEvent(new Event('submit', { cancelable: true })); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p); s.instance.start(); s.instance.update(10)
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(frames); expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); for (const o of cued) expect(o.userData.interactionCues).toEqual([])
  })
})
