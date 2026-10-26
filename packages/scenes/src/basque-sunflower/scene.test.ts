// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import * as mod from './index'

// GPU calls alone are replaced: real geometry, raycasters, cues and writer run below.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown }))
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
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const height = width === 1280 ? 408 : 390, left = 17, top = 89
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
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  expect(hit, 'the craft exposes object interaction').not.toBeNull()
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const point = (name: string): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const write = (text: string) => { const input = overlay.querySelector<HTMLInputElement>('input')!; input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, write, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  if (type === 'pointerdown') pendingStarts.set(el, [clientX,clientY] as [number, number])

  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}
function drag(s: ReturnType<typeof mount>, target = 'sunflower-center-seat', source = 'sunflower-center') {
  const a = s.point(source), b = s.point(target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('sunflower-center'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
function cues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}
function first(s: ReturnType<typeof mount>, position: THREE.Vector3) {
  const q = position.project(s.camera), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
  const visible: THREE.Object3D[] = []
  s.scene.traverseVisible(object => { if ((object as THREE.Mesh).isMesh) visible.push(object) })
  return { q, object: ray.intersectObjects(visible, false)[0]?.object }
}
function blocker(s: ReturnType<typeof mount>, name: string) {
  const position = s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3())
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(.6, .6, .08), new THREE.MeshBasicMaterial({ color: 'black' }))
  mesh.name = 'external-opaque-blocker'; mesh.position.copy(position).lerp(s.camera.getWorldPosition(new THREE.Vector3()), .08)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { s.scene.remove(mesh); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('Basque original paper and wood sun-thistle ornament', () => {
  it('assembles the visible flower center, hangs the whole flower, and quietly finishes once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s); expect(s.progress).toEqual([1]); drag(s, 'sunflower-peg-cap'); expect(s.progress).toEqual([1, 2])
    s.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的心愿'
    tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('rejects empty space, the wrong origin, zero travel and the wrong destination', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointerup', s.point('sunflower-center-seat'))
    drag(s, 'sunflower-center-seat', 'sunflower-mount-board')
    const center = s.scene.getObjectByName('sunflower-center-piece')!, home = center.position.clone(), p = s.point('sunflower-center')
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p)
    drag(s, 'sunflower-peg-cap'); expect(s.progress).toEqual([]); expect(center.position.equals(home)).toBe(true)
    drag(s); drag(s, 'sunflower-center-seat'); expect(s.progress).toEqual([1])
  })
  it.each([0, 1])('uses the first whole-scene surface for source and drop at step %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), target = at === 0 ? 'sunflower-center-seat' : 'sunflower-peg-cap'
    const removeSourceBlocker = blocker(s, 'sunflower-center'); drag(s, target); expect(s.progress).toEqual([]); removeSourceBlocker()
    const from = s.point('sunflower-center'), to = s.point(target)
    event(s.hit, 'pointerdown', from)
    const removeTargetBlocker = blocker(s, target)
    event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    removeTargetBlocker(); drag(s, target); expect(s.progress).toEqual([at + 1])
  })
  it('cancels a quiet tap once travel reaches twelve pixels, including the release displacement', () => {
    const s = mount(2), p = s.point('sunflower-center')
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', [p[0] + 12, p[1]])
    expect(s.progress).toEqual([]); tap(s); expect(s.progress).toEqual([3])
  })
  it.each([{ pixels: 0, want: [] }, { pixels: 2, want: [1] }, { pixels: 7.9, want: [1] }])('accepts an actually reached nearby destination after nonzero travel: $pixels', ({ pixels, want }) => {
    const s = mount(0, { isReducedMotion: () => true }), end = s.point('sunflower-center-seat')
    const seat = s.scene.getObjectByName('sunflower-center-seat')!.getWorldPosition(new THREE.Vector3()).project(s.camera)
    seat.x += pixels * 2 / 390
    s.scene.getObjectByName('sunflower-center-piece')!.position.copy(seat.unproject(s.camera)); s.scene.updateMatrixWorld(true)
    event(s.hit, 'pointerdown', [end[0] + pixels, end[1]]); event(s.hit, 'pointerup', end)
    expect(s.progress).toEqual(want)
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i and suppresses the writer on returning visits', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run()
      expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.button.hidden).toBe(at === 3); expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      if (at >= 1) expect(s.scene.getObjectByName('sunflower-center-piece')!.parent).toBe(s.scene.getObjectByName('sunflower-ornament'))
    }
  })
  it('offers native button fallback for all three actions without saving an unfinished draft', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button.tagName).toBe('BUTTON'); expect(s.button.type).toBe('button')
    s.button.click(); s.button.click(); s.overlay.querySelector<HTMLInputElement>('input')!.value = '草稿'; s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('saves a trimmed explicit wish only once even if the save callback reenters the form', () => {
    const s = mount(2); s.write('  '); expect(s.progress).toEqual([])
    s.saveWish.mockImplementation(() => s.write('重复')); s.write('  愿家门常有笑声  '); s.write('重复')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿家门常有笑声'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const returning = mount(2, { returning: true }); tap(returning); expect(returning.progress).toEqual([3]); expect(returning.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('restores the whole held flower on %s', kind => {
    let active = true; const s = mount(1, { isActive: () => active, isReducedMotion: () => true })
    const flower = s.scene.getObjectByName('sunflower-ornament')!, home = flower.position.clone(), end = s.point('sunflower-peg-cap')
    event(s.hit, 'pointerdown', s.point('sunflower-center')); event(s.hit, 'pointermove', pendingPoint(s.hit, end))
    if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else if (kind === 'pause') { active = false; s.run() }
    else event(s.hit, kind, end)
    event(s.hit, 'pointerup', end); expect(s.progress).toEqual([]); expect(flower.position.equals(home)).toBe(true)
    active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s, 'sunflower-peg-cap'); expect(s.progress).toEqual([2])
  })
  it.each([true, false])('rejects mixed pointer ownership, outside finger first: %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), end = s.point('sunflower-center-seat')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('sunflower-center'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted placement during pause, preserves center attachment and blocks inactive writing', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const flower = s.scene.getObjectByName('sunflower-ornament')!, position = flower.position.clone()
    active = false; s.run(2); expect(flower.position.equals(position)).toBe(true); expect(s.progress).toEqual([])
    active = true
    for (let i = 0; i < 30; i++) { s.instance.update(.025); expect(s.scene.getObjectByName('sunflower-center-piece')!.parent).toBe(flower) }
    expect(s.progress).toEqual([2]); active = false; s.run(); s.write('暂停'); s.button.click(); expect(s.progress).toEqual([2])
    active = true; s.run(); window.dispatchEvent(new Event('blur')); s.run(); s.write('失焦'); expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(); s.write('欢迎回家'); expect(s.progress).toEqual([2, 3])
  })
  it('hangs its open loop on the solid peg and rests the backing directly against the door mount', () => {
    const s = mount(2), flower = s.scene.getObjectByName('sunflower-ornament')!
    const backing = new THREE.Box3().setFromObject(s.scene.getObjectByName('sunflower-wood-backing')!)
    const mountBoard = new THREE.Box3().setFromObject(s.scene.getObjectByName('sunflower-mount-board')!)
    expect(Math.abs(backing.min.z - mountBoard.max.z)).toBeLessThan(.002)
    const peg = new THREE.Box3().setFromObject(s.scene.getObjectByName('sunflower-peg-shaft')!)
    const loop = s.scene.getObjectByName('sunflower-hanging-loop')!
    const loopTop = loop.getWorldPosition(new THREE.Vector3()).y + .09 - .014
    expect(Math.abs(loopTop - peg.max.y)).toBeLessThan(.002)
    expect(loop.getWorldPosition(new THREE.Vector3()).z).toBeGreaterThan(peg.min.z)
    expect(loop.getWorldPosition(new THREE.Vector3()).z).toBeLessThan(peg.max.z)
    const petals: THREE.Object3D[] = []; flower.traverse(o => { if (o.name.startsWith('sunflower-pointed-petal-')) petals.push(o) })
    expect(petals.length).toBeGreaterThanOrEqual(24)
    const box = new THREE.Box3().setFromObject(flower), size = box.getSize(new THREE.Vector3())
    expect(size.x).toBeGreaterThan(1); expect(size.y).toBeGreaterThan(1)
  })
  it('rests the loose flower center on its pad before assembly', () => {
    const s = mount(), center = new THREE.Box3().setFromObject(s.scene.getObjectByName('sunflower-center')!)
    const pad = new THREE.Box3().setFromObject(s.scene.getObjectByName('sunflower-center-rest')!)
    expect(Math.abs(center.min.y - pad.max.y)).toBeLessThan(.002)
  })
  it.each([320, 390, 1280])('keeps source and destination visible and completes with physical rays at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width)
      const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName('sunflower-ornament')!)
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const corner = new THREE.Vector3(x, y, z).project(s.camera)
        expect(Math.abs(corner.x)).toBeLessThan(.96); expect(Math.abs(corner.y)).toBeLessThan(.96)
      }
      for (const { object, cue } of cues(s)) {
        const pick = first(s, object.getWorldPosition(new THREE.Vector3()))
        expect(pick.object?.name).toBe(object.name); expect(Math.abs(pick.q.x)).toBeLessThan(.92); expect(Math.abs(pick.q.y)).toBeLessThan(.92)
        if (cue.destination instanceof THREE.Object3D) {
          const target = first(s, cue.destination.getWorldPosition(new THREE.Vector3()))
          expect(target.object?.name).toBe(cue.destination.name); expect(Math.abs(target.q.x)).toBeLessThan(.92); expect(Math.abs(target.q.y)).toBeLessThan(.92)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'sunflower-peg-cap'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('frees geometry, materials, shadows, renderer, cues, DOM and listeners only once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = []
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
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

// Cancellation happens before arrival; a completed placement already owns its result.
const pendingStarts = new WeakMap<HTMLElement, [number, number]>()
function pendingPoint(layer: HTMLElement, point: [number, number]): [number, number] {
 const start = pendingStarts.get(layer) ?? point
 return [start[0]+(point[0]-start[0])*.20,start[1]+(point[1]-start[1])*.20]
}
