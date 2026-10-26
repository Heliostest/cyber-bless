// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import { createToonSurfaces } from '../../../scene-runtime/src/toon-surfaces'
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
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 350, height = 408) {
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
  if (type === 'pointerdown') pendingStarts.set(el, [clientX,clientY] as [number, number])

  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}
function assemble(s: ReturnType<typeof mount>) {
  const a = s.point('bead-strand-grip'), b = s.point('bead-star-arm-joint')
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function rotate(s: ReturnType<typeof mount>, dx = 75, dy = 0) {
  const p = s.point('bead-star-center'), q: [number, number] = [p[0] + dx, p[1] + dy]
  pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', q); pointer(s.hit, 'pointerup', q); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('bead-star-center'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.42, .42), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .15)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('an original Czech hollow bead star', () => {
  it('exposes a native accessible action without advancing on entry', () => {
    const s = mount(); expect(s.button).not.toBeNull(); expect(s.progress).toEqual([])
  })
  it('connects the loose wire strand, turns the whole star and quietly finishes once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    assemble(s); expect(s.progress).toEqual([1])
    const body = s.scene.getObjectByName('bead-star-body')!, strand = s.scene.getObjectByName('bead-loose-strand')!
    expect(strand.parent).toBe(body)
    const initial = body.rotation.y, before = strand.getWorldPosition(new THREE.Vector3())
    rotate(s); expect(s.progress).toEqual([1, 2]); expect(body.rotation.y - initial).toBeGreaterThan(.45)
    expect(strand.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeGreaterThan(.15)
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([false, true])('accepts the fully turned star after a corrected vertical detour, reduced=%s', reduced => {
    const s = mount(1, { isReducedMotion: () => reduced }), star = s.scene.getObjectByName('bead-star-body')!, a = s.point('bead-star-center')
    pointer(s.hit, 'pointerdown', a)
    for (const [dx, dy] of [[60, 0], [120, 60], [90, 0]]) pointer(s.hit, 'pointermove', [a[0] + dx, a[1] + dy])
    expect(star.rotation.y).toBeCloseTo(.9); expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerup', [a[0] + 90, a[1]]); s.run()
    expect(s.progress).toEqual([2]); expect(star.rotation.y).toBeCloseTo(.65)
    tap(s); expect(s.progress).toEqual([2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([false, true])('rejects wrong endpoints and cancellation after reaching the full turn, reduced=%s', reduced => {
    for (const [dx, dy, end] of [[90, 60, 'pointerup'], [44, 0, 'pointerup'], [-90, 0, 'pointerup'], [90, 0, 'pointercancel']] as const) {
      const s = mount(1, { isReducedMotion: () => reduced }), star = s.scene.getObjectByName('bead-star-body')!, a = s.point('bead-star-center')
      pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', [a[0] + 120, a[1]])
      expect(star.rotation.y).toBeGreaterThan(.65)
      pointer(s.hit, 'pointermove', [a[0] + dx, a[1] + dy]); pointer(s.hit, end, [a[0] + dx, a[1] + dy]); s.run()
      expect(s.progress).toEqual([]); expect(star.rotation.y).toBe(0)
      rotate(s); expect(s.progress).toEqual([2]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and supports the same keyboard actions', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input, textarea, form')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
    expect(s.scene.getObjectByName('bead-loose-strand')!.parent?.name).toBe(at ? 'bead-star-body' : 'bead-workbench')
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([[284, 390], [350, 408], [1280, 600]])('frames every bead and wire vertex and real cue at %ix%i', (width, height) => {
    const s = mount(0, { isReducedMotion: () => true }, width, height)
    for (const step of [0, 1, 2, 3]) {
      s.run(.025); s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
      const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { if ((o as THREE.Mesh).isMesh) visible.push(o) })
      s.scene.getObjectByName('bead-workbench')!.traverseVisible(o => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
        const vertices = mesh.geometry.getAttribute('position'), bounds = new THREE.Box3(), projected = new THREE.Vector3()
        for (let i = 0; i < vertices.count; i++) bounds.expandByPoint(projected.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(s.camera))
        const extent = Math.max(Math.abs(bounds.min.x) / .94, Math.abs(bounds.max.x) / .94,
          Math.abs(bounds.min.y) / .94, Math.abs(bounds.max.y) / .94, Math.abs(bounds.min.z), Math.abs(bounds.max.z))
        expect(extent, `${mesh.name} at ${step}: NDC ${bounds.min.toArray()} / ${bounds.max.toArray()}`).toBeLessThan(1)
      })
      const names = step === 0 ? ['bead-strand-grip', 'bead-star-arm-joint'] : step < 3 ? ['bead-star-center'] : []
      for (const [i, name] of names.entries()) {
        const object = s.scene.getObjectByName(name)!, p = object.getWorldPosition(new THREE.Vector3()).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(ray.intersectObjects(visible, false)[0]?.object, name).toBe(object)
        const cue = s.host.querySelector<HTMLElement>(`[data-cue-role="${i ? 'target' : 'source'}"]`)!
        expect(cue).not.toBeNull(); expect(Number(cue.dataset.x)).toBeCloseTo((p.x + 1) * width / 2, 3); expect(Number(cue.dataset.y)).toBeCloseTo((1 - p.y) * height / 2, 3)
      }
      if (step === 0) assemble(s); else if (step === 1) rotate(s); else if (step === 2) tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it('uses opaque hollow shells with axial openings and threaded wire, leaving the star open', () => {
    const s = mount(1), beads: THREE.Mesh[] = [], wires: THREE.Mesh[] = []
    s.scene.getObjectByName('bead-star-body')!.traverse(o => { const m = o as THREE.Mesh; if (m.isMesh && m.userData.beadShell) beads.push(m); if (m.isMesh && m.userData.threadWire) wires.push(m) })
    expect(beads.length).toBeGreaterThan(50); expect(wires.length).toBeGreaterThan(12)
    for (const bead of beads) {
      const material = bead.material as THREE.MeshPhysicalMaterial
      expect(material.transparent).toBe(false); expect(material.opacity).toBe(1); expect(material.roughness).toBeLessThan(.35)
      // Hole ray on the bead's local axis must pass through the actual shell.
      const start = bead.localToWorld(new THREE.Vector3(0, .3, 0)), axis = new THREE.Vector3(0, -1, 0).transformDirection(bead.matrixWorld)
      expect(new THREE.Raycaster(start, axis).intersectObject(bead, false)).toHaveLength(0)
      const side = bead.localToWorld(new THREE.Vector3(.02, 0, .3)), inward = new THREE.Vector3(0, 0, -1).transformDirection(bead.matrixWorld)
      expect(new THREE.Raycaster(side, inward).intersectObject(bead, false).length).toBeGreaterThan(0)
    }
    const body = s.scene.getObjectByName('bead-star-body')!, gap = body.localToWorld(new THREE.Vector3(.53, .53, .8))
    expect(new THREE.Raycaster(gap, new THREE.Vector3(0, 0, -1)).intersectObjects(beads, false)).toHaveLength(0)
    const wire = s.scene.getObjectByName('bead-strand-wire') as THREE.Mesh<THREE.CylinderGeometry>
    expect(wire.geometry.parameters.radiusTop).toBeLessThan(.01)
  })
  it('retains reflective bead materials through the actual production toon adaptation', () => {
    const s = mount(), surfaces = createToonSurfaces('toon-soft'), pass = surfaces.apply(s.scene)
    try {
      s.scene.getObjectByName('bead-star-body')!.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.userData.beadShell) return
        const material = mesh.material as THREE.MeshStandardMaterial
        expect(material.roughness).toBeLessThan(.35); expect(material.metalness).toBeGreaterThan(.4)
      })
    } finally { pass.restore(); surfaces.dispose() }
  })
  it('joins the strand endpoints to existing wire and keeps the ornament hanging from its support', () => {
    const s = mount(1)
    const strand = s.scene.getObjectByName('bead-loose-strand')!
    const root = s.scene.getObjectByName('bead-star-arm-joint')!.getWorldPosition(new THREE.Vector3())
    const tip = s.scene.getObjectByName('bead-star-arm-tip')!.getWorldPosition(new THREE.Vector3())
    const wire = s.scene.getObjectByName('bead-strand-wire') as THREE.Mesh<THREE.CylinderGeometry>
    const length = wire.geometry.parameters.height
    const a = wire.localToWorld(new THREE.Vector3(0, -length / 2, 0)), b = wire.localToWorld(new THREE.Vector3(0, length / 2, 0))
    expect(Math.min(a.distanceTo(root) + b.distanceTo(tip), b.distanceTo(root) + a.distanceTo(tip))).toBeLessThan(.001)
    expect(strand.parent?.name).toBe('bead-star-body')
    const base = new THREE.Box3().setFromObject(s.scene.getObjectByName('bead-wood-base')!), post = new THREE.Box3().setFromObject(s.scene.getObjectByName('bead-wood-post')!)
    expect(Math.abs(base.max.y - post.min.y)).toBeLessThan(.001)
  })
  it('rests the loose glass bead surfaces on the small wood support', () => {
    const s = mount(), bead = new THREE.Box3().setFromObject(s.scene.getObjectByName('bead-strand-grip')!), pad = new THREE.Box3().setFromObject(s.scene.getObjectByName('bead-strand-rest')!)
    expect(Math.abs(bead.min.y - pad.max.y)).toBeLessThan(.001)
  })
  it.each([0, 1, 2])('rejects source rays obscured by another opaque object at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), clear = block(s, at ? 'bead-star-center' : 'bead-strand-grip')
    if (at === 0) assemble(s); else if (at === 1) rotate(s); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at === 0) assemble(s); else if (at === 1) rotate(s); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it('rejects an obscured destination and restores the full loose strand', () => {
    const s = mount(0, { isReducedMotion: () => true }), strand = s.scene.getObjectByName('bead-loose-strand')!, home = strand.position.clone()
    const a = s.point('bead-strand-grip'), b = s.point('bead-star-arm-joint')
    const clear = block(s, 'bead-star-arm-joint'); pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b);  pointer(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); expect(strand.position.equals(home)).toBe(true); clear(); assemble(s); expect(s.progress).toEqual([1])
  })
  it('rejects wrong drops, no movement, reversed/vertical turns and travel that comes back', () => {
    const s = mount(0, { isReducedMotion: () => true })
    let p = s.point('bead-strand-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [20, 20]); pointer(s.hit, 'pointerup', [20, 20]); expect(s.progress).toEqual([])
    s.button.click()
    for (const [x, y] of [[0, 0], [12, 0], [-75, 0], [0, 75], [50, 70]]) { rotate(s, x, y); expect(s.progress).toEqual([1]) }
    p = s.point('bead-star-center'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 80, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1]); rotate(s); p = s.point('bead-star-center')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 30, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause', 'multitouch'])('restores whole strand/star poses after %s', event => {
    for (const at of [0, 1]) {
      let active = true
      const s = mount(at, { isReducedMotion: () => true, isActive: () => active }), group = s.scene.getObjectByName(at ? 'bead-star-body' : 'bead-loose-strand')!, pose = group.matrixWorld.clone()
      const p = s.point(at ? 'bead-star-center' : 'bead-strand-grip'), q: [number, number] = at ? [p[0] + 80, p[1]] : s.point('bead-star-arm-joint')
      pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', pendingPoint(s.hit, q))
      if (event === 'blur') window.dispatchEvent(new Event('blur'))
      else if (event === 'pause') { active = false; s.run() }
      else if (event === 'multitouch') pointer(document.body, 'pointerdown', [1, 1], 2)
      else pointer(s.hit, event, q)
      pointer(s.hit, 'pointerup', q); pointer(document.body, 'pointerup', [1, 1], 2)
      expect(s.progress).toEqual([]); expect(group.matrixWorld.elements).toEqual(pose.elements); window.dispatchEvent(new Event('focus'))
    }
  })
  it.each(['blur', 'pause'])('freezes accepted motion without rendering while %s is active', effect => {
    let active = true
    const s = mount(0, { isActive: () => active }); s.button.click(); s.run(.15)
    const group = s.scene.getObjectByName('bead-loose-strand')!, pose = group.position.clone(), frames = rendered.frames
    if (effect === 'blur') window.dispatchEvent(new Event('blur')); else active = false
    s.run(2); expect(group.position.equals(pose)).toBe(true); expect(s.progress).toEqual([]); expect(rendered.frames).toBe(frames)
    expect(s.button.disabled).toBe(true); expect((s.host.querySelector('.scene-object-cues') as HTMLElement).hidden).toBe(true)
    active = true; window.dispatchEvent(new Event('focus')); s.run(2); expect(s.progress).toEqual([1])
  })
  it('shows material-turning motion while held and gently returns a cancelled turn without acceptance', () => {
    const s = mount(1), star = s.scene.getObjectByName('bead-star-body')!, p = s.point('bead-star-center'), q: [number, number] = [p[0] + 75, p[1]]
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', q)
    expect(star.rotation.y).toBeCloseTo(.75); expect(s.progress).toEqual([])
    pointer(s.hit, 'pointercancel', q); expect(star.rotation.y).toBeCloseTo(.75)
    s.run(.075); expect(star.rotation.y).toBeGreaterThan(0); expect(star.rotation.y).toBeLessThan(.75)
    s.run(.3); expect(star.rotation.y).toBe(0); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
  })
  it.each([false, true])('locks synchronous prepare/progress/haptic input reentry with reduced motion %s', reduced => {
    for (const callback of ['prepare', 'progress', 'haptic']) for (const input of ['pointer', 'button']) {
      let replay = () => {}
      const progress: number[] = []
      const s = mount(0, { isReducedMotion: () => reduced, prepareFeedback() { if (callback === 'prepare') replay() }, onProgress(n) { progress.push(n); if (callback === 'progress') replay() }, haptic() { if (callback === 'haptic') replay() } })
      replay = () => { s.button.dispatchEvent(new Event('click')); rotate(s); s.instance.update(1) }
      if (input === 'pointer') assemble(s); else { s.button.click(); s.run() }
      expect(progress, `${callback}/${input}`).toEqual([1]); expect(s.complete).not.toHaveBeenCalled()
      s.button.click(); s.run(); expect(progress).toEqual([1, 2]); s.button.click(); expect(progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    }
  })
  it.each([false, true])('stops all callbacks and rendering after synchronous pause/dispose, reduced motion %s', reduced => {
    for (const effect of ['pause', 'dispose']) for (const callback of ['prepare', 'progress', 'haptic']) for (const at of [0, 1, 2]) {
      let active = true, interrupt = () => {}, frames = -1
      const progress: number[] = [], haptic = vi.fn()
      const s = mount(at, { isReducedMotion: () => reduced, isActive: () => active,
        prepareFeedback() { if (callback === 'prepare') interrupt() },
        onProgress(n) { progress.push(n); if (callback === 'progress') interrupt() },
        haptic() { haptic(); if (callback === 'haptic') interrupt() } })
      interrupt = () => { frames = rendered.frames; if (effect === 'dispose') s.instance.dispose(); else active = false }
      s.button.click(); s.run(2)
      expect(progress).toEqual(callback === 'prepare' ? [] : [at + 1]); expect(rendered.frames).toBe(frames)
      expect(haptic).toHaveBeenCalledTimes(callback === 'haptic' ? 1 : 0); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    }
  })
  it.each([false, true])('restores the held object if pointer preparation pauses or disposes, reduced motion %s', reduced => {
    for (const effect of ['pause', 'dispose']) {
      let active = true, interrupt = () => {}
      const s = mount(0, { isReducedMotion: () => reduced, isActive: () => active, prepareFeedback() { interrupt() } })
      const strand = s.scene.getObjectByName('bead-loose-strand')!, origin = strand.position.clone(), frames = rendered.frames
      interrupt = () => { if (effect === 'dispose') s.instance.dispose(); else active = false }
      assemble(s); expect(strand.position.equals(origin)).toBe(true); expect(s.progress).toEqual([]); expect(rendered.frames).toBe(frames)
      expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    }
  })
  it('disposes every owned resource, cue and listener once even during a held pointer', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>()
    s.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    const cueObjects: THREE.Object3D[] = []; s.scene.traverse(o => { if (o.userData.interactionCues?.length) cueObjects.push(o) })
    const p = s.point('bead-strand-grip'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] - 10, p[1] - 20])
    const frames = rendered.frames; s.instance.dispose(); s.instance.dispose(); s.button.click(); s.run()
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(rendered.frames).toBe(frames)
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull()
    for (const o of cueObjects) expect(o.userData.interactionCues).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, options] of registrations) expect(removed.mock.calls.some(([t, l, opt]) => t === type && l === listener && capture(opt) === capture(options))).toBe(true)
  })
})

// Cancellation happens before arrival; a completed placement already owns its result.
const pendingStarts = new WeakMap<HTMLElement, [number, number]>()
function pendingPoint(layer: HTMLElement, point: [number, number]): [number, number] {
 const start = pendingStarts.get(layer) ?? point
 return [start[0]+(point[0]-start[0])*.20,start[1]+(point[1]-start[1])*.20]
}
