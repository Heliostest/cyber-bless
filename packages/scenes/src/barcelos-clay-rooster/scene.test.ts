// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only GPU work is replaced. Three geometry, raycasting, cues and the wish form remain real.
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
function drag(s: ReturnType<typeof mount>, source = 'rooster-brush-grip', target = 'rooster-paint-surface') {
  const a = s.point(source), b = s.point(target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('rooster-paint-surface'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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


describe('Barcelos contemporary ceramic workshop', () => {
  it.each([320, 390])('accepts sparse source-to-body touch placement at width %i', width => {
    const s = mount(0, { isReducedMotion: () => true }, width)
    event(s.hit, 'pointerdown', s.point('rooster-brush-grip')); event(s.hit, 'pointerup', s.point('rooster-paint-surface'))
    expect(s.progress).toEqual([1]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('paints the rooster, seats its clay base on the display and finishes once without saving a wish', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('rooster-invented-motif')!.visible).toBe(true)
    drag(s, 'rooster-paint-surface', 'rooster-plinth-top'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
})

describe('an optional explicit workshop wish', () => {
  it('saves a trimmed nonempty submission once, guards reentry and leaves quiet drafts unsaved', () => {
    const s = mount(2)
    expect(s.overlay.querySelector('input'), 'writing is offered at the final checkpoint').not.toBeNull()
    s.write('  '); expect(s.progress).toEqual([])
    s.saveWish.mockImplementation(() => s.write('重复'))
    s.write('  愿来年相聚  '); s.write('重复')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿来年相聚'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const quiet = mount(2); quiet.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的心愿'; tap(quiet)
    expect(quiet.progress).toEqual([3]); expect(quiet.saveWish).not.toHaveBeenCalled()
    expect(quiet.overlay.querySelector<HTMLInputElement>('input')!.value).toBe('')
    const returning = mount(2, { returning: true }); expect(returning.overlay.querySelector('input')).toBeNull(); tap(returning)
    expect(returning.progress).toEqual([3]); expect(returning.saveWish).not.toHaveBeenCalled()
  })
})

function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .18)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('visible object input and recoverable progress', () => {
  it('rejects empty space, wrong objects, missing travel, wrong drops and wandering quiet taps', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointerup', s.point('rooster-paint-surface'))
    drag(s, 'rooster-plinth-top', 'rooster-paint-surface'); expect(s.progress).toEqual([])
    const p = s.point('rooster-brush-grip'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p); expect(s.progress).toEqual([])
    const home = s.scene.getObjectByName('rooster-brush')!.position.clone()
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [1, 1]); event(s.hit, 'pointerup', [1, 1])
    expect(s.scene.getObjectByName('rooster-brush')!.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    drag(s); drag(s, 'rooster-brush-grip', 'rooster-plinth-top'); expect(s.progress).toEqual([1])
    drag(s, 'rooster-paint-surface', 'rooster-dye-dish'); expect(s.progress).toEqual([1])
    drag(s, 'rooster-paint-surface', 'rooster-plinth-top'); const a = s.point('rooster-paint-surface')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 12, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through an opaque external object at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'rooster-brush-grip' : 'rooster-paint-surface'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'rooster-paint-surface' : 'rooster-plinth-top'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'rooster-paint-surface' : 'rooster-plinth-top'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects drops behind external opaque geometry at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'rooster-brush-grip' : 'rooster-paint-surface', target = at === 0 ? 'rooster-paint-surface' : 'rooster-plinth-top'
    const a = s.point(source), b = s.point(target)
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b)
    const clear = block(s, target); event(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and retains native button access', at => {
    for (const returning of [true, false]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.scene.getObjectByName('rooster-invented-motif')!.visible).toBe(at > 0)
      expect(s.button.type).toBe('button'); expect(s.button.hidden).toBe(at === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
      s.instance.dispose()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('returns an unfinished drag to its support on %s', kind => {
    let active = true; const s = mount(1, { isActive: () => active, isReducedMotion: () => true })
    const rooster = s.scene.getObjectByName('barcelos-rooster')!, home = rooster.position.clone(), end = s.point('rooster-plinth-top')
    event(s.hit, 'pointerdown', s.point('rooster-paint-surface')); event(s.hit, 'pointermove', end)
    if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else if (kind === 'pause') { active = false; s.run() }
    else event(s.hit, kind, end)
    event(s.hit, 'pointerup', end); expect(s.progress).toEqual([]); expect(rooster.position.equals(home)).toBe(true)
    active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s, 'rooster-paint-surface', 'rooster-plinth-top'); expect(s.progress).toEqual([2])
  })
  it.each([true, false])('rejects multitouch with outside pointer first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), to = s.point('rooster-paint-surface')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('rooster-brush-grip'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted motion on blur and pause, disables wish submission and resumes cleanly', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const pose = s.scene.getObjectByName('barcelos-rooster')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('barcelos-rooster')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); active = false; s.run(2)
    expect(s.scene.getObjectByName('barcelos-rooster')!.position.equals(pose)).toBe(true)
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
        }
      }
      for (const name of ['barcelos-rooster', 'rooster-brush', 'rooster-display-plinth', 'rooster-dye-dish']) {
        const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera); expect(Math.abs(p.x), JSON.stringify({ name, at, x, y, z, projected: p.toArray() })).toBeLessThan(.99); expect(Math.abs(p.y), name).toBeLessThan(.99)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'rooster-paint-surface', 'rooster-plinth-top'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
})

describe('physical craft and owned resources', () => {
  it('supports its clay base on linen first and the plinth last, with both legs joined to the body', () => {
    for (const checkpoint of [0, 2]) {
      const s = mount(checkpoint), base = new THREE.Box3().setFromObject(s.scene.getObjectByName('rooster-clay-base')!)
      const support = new THREE.Box3().setFromObject(s.scene.getObjectByName(checkpoint ? 'rooster-plinth-top' : 'rooster-linen-rest')!)
      expect(base.min.y).toBeCloseTo(support.max.y, 4)
      const body = s.scene.getObjectByName('rooster-body')!, legs: THREE.Mesh[] = []
      s.scene.traverse(o => { if (o.name === 'rooster-leg') legs.push(o as THREE.Mesh) })
      expect(legs).toHaveLength(2)
      for (const leg of legs) {
        const box = new THREE.Box3().setFromObject(leg), mid = box.getCenter(new THREE.Vector3())
        expect(box.min.y).toBeLessThan(base.max.y)
        const ray = new THREE.Raycaster(new THREE.Vector3(mid.x, box.min.y, mid.z), new THREE.Vector3(0, 1, 0))
        const hit = ray.intersectObject(body, false)[0]
        expect(hit, 'leg reaches the underside of the chest').toBeDefined(); expect(hit.point.y).toBeLessThan(box.max.y)
      }
      const edge = new THREE.Box3().setFromObject(s.scene.getObjectByName('rooster-plinth-edge')!)
      expect(edge.min.y).toBeCloseTo(new THREE.Box3().setFromObject(s.scene.getObjectByName('rooster-table-top')!).max.y, 4)
    }
  })
  it('keeps leaf paint within a thin layer of the curved body and tail paint on the sculpted feathers', () => {
    const s = mount(1), body = s.scene.getObjectByName('rooster-body')!, motif = s.scene.getObjectByName('rooster-invented-motif')!
    const bodyMesh = body as THREE.Mesh, positions = bodyMesh.geometry.getAttribute('position')
    const bodyVertices = Array.from({ length: positions.count }, (_, i) => bodyMesh.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i)))
    let samples = 0
    motif.traverse(o => {
      const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
      const attr = mesh.geometry.getAttribute('position')
      for (let i = 0; i < attr.count; i += 10) {
        const p = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attr, i))
        // Aim toward the geometric centre of the closest body cross-section, including side paint.
        const nearest = Math.min(...bodyVertices.map(v => Math.abs(v.y - p.y)))
        const ring = bodyVertices.filter(v => Math.abs(v.y - p.y) <= nearest + .001)
        const centre = ring.reduce((sum, v) => sum.add(v), new THREE.Vector3()).divideScalar(ring.length); centre.y = p.y
        const outward = p.clone().sub(centre).normalize()
        const ray = new THREE.Raycaster(p.clone().addScaledVector(outward, .05), outward.clone().negate())
        const hit = ray.intersectObject(body, false)[0]
        expect(hit, mesh.name).toBeDefined(); expect(p.distanceTo(hit.point), mesh.name).toBeLessThan(.028); samples++
      }
    })
    expect(samples).toBeGreaterThan(200)
    const feathers = [0, 1, 2].map(i => s.scene.getObjectByName(`rooster-tail-feather-${i}`)!)
    s.scene.traverse(o => {
      if (o.name !== 'rooster-tail-painted-arc') return
      const mesh = o as THREE.Mesh, attr = mesh.geometry.getAttribute('position')
      for (let i = 0; i < attr.count; i += 11) {
        const p = mesh.localToWorld(new THREE.Vector3().fromBufferAttribute(attr, i))
        const hits = new THREE.Raycaster(p.clone().add(new THREE.Vector3(0, 0, .05)), new THREE.Vector3(0, 0, -1)).intersectObjects(feathers, false)
        expect(hits.some(hit => p.distanceTo(hit.point) < .035), 'tail stroke is supported by a feather').toBe(true)
      }
    })
  })
  it('requires eight pixels of real travel and settles immediately when reduced motion is switched on', () => {
    let reduced = false; const s = mount(0, { isReducedMotion: () => reduced }), a = s.point('rooster-brush-grip'), target = s.point('rooster-paint-surface')
    const short: [number, number] = [a[0] + 7.9, a[1]]
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', short); event(s.hit, 'pointerup', short); s.run()
    expect(s.progress).toEqual([])
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 8, a[1]]); event(s.hit, 'pointerup', target); s.instance.update(.025)
    expect(s.progress).toEqual([]); reduced = true; s.instance.update(.025); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('rooster-invented-motif')!.visible).toBe(true)
  })
  it('rejects forms before the last checkpoint and while the final rooster is being touched', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); s.write('提前'); expect(s.progress).toEqual([1]); s.button.click()
    const p = s.point('rooster-paint-surface'); event(s.hit, 'pointerdown', p); s.write('手势期间'); expect(s.saveWish).not.toHaveBeenCalled()
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
