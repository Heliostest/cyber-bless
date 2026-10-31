// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
// Preserve this suite's geometry, pointer and callback contract in isolation.
// The real animation clock and legacy-input lock are covered in quiet-ending-atelier-scenes.test.ts.
vi.mock('../quiet-ending', () => ({ createQuietEnding: () => ({
  running: false, completing: true, sync() {}, update() {}, dispose() {},
}) }))

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
  const point = (name: string, anchor: [number, number, number] = name === 'indigo-cloth-body' ? [-.50, -.35, .085] : [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
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
function drag(s: ReturnType<typeof mount>, source = 'indigo-bundle-body', target = 'indigo-rinse-water') {
  const a = s.point(source), b = s.point(target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('indigo-cloth-body'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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
    if (mat.transparent && mat.opacity < .5) return
    visible.push(object)
  })
  return { q, object: ray.intersectObjects(visible, false)[0]?.object }
}


describe('Bai contemporary indigo cloth', () => {
  it('rinses the tied cloth, drapes the rail and quietly completes once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s); expect(s.progress).toEqual([1])
    drag(s, 'indigo-cloth-body', 'indigo-drying-rail'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
})

describe('an optional explicit cloth wish', () => {
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
  const source = s.scene.getObjectByName(name)!
  const position = name === 'indigo-cloth-body' ? source.localToWorld(new THREE.Vector3(-.50, -.35, .085)) : source.getWorldPosition(new THREE.Vector3())
  mesh.position.lerpVectors(position, s.camera.position, .18)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('visible object input and recoverable progress', () => {
  it.each([0, 1, 2])('does not start through an opaque external object at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'indigo-bundle-body' : 'indigo-cloth-body'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'indigo-rinse-water' : 'indigo-drying-rail'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'indigo-rinse-water' : 'indigo-drying-rail'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects drops behind external opaque geometry at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'indigo-bundle-body' : 'indigo-cloth-body', target = at === 0 ? 'indigo-rinse-water' : 'indigo-drying-rail'
    const a = s.point(source), b = s.point(target)
    const clear = block(s, target); event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b)
     event(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and retains native button access', at => {
    for (const returning of [true, false]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.scene.getObjectByName('indigo-open-cloth')!.visible).toBe(at > 0)
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
      const source = at === 0 ? 'indigo-bundle-body' : 'indigo-cloth-body', target = at === 0 ? 'indigo-rinse-water' : 'indigo-drying-rail'
      const object = s.scene.getObjectByName(at === 0 ? 'indigo-tied-cloth' : 'indigo-open-cloth')!, home = object.position.clone(), end = s.point(target)
      event(s.hit, 'pointerdown', s.point(source)); event(s.hit, 'pointermove', pendingPoint(s.hit, end))
      expect(object.position.equals(home)).toBe(false)
      if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else if (kind === 'pause') { active = false; s.run() }
      else event(s.hit, kind, end)
      event(s.hit, 'pointerup', end); expect(s.progress).toEqual([]); expect(object.position.equals(home)).toBe(true)
      active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s, source, target); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it('ignores movement and release from a different pointer owner', () => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('indigo-bundle-body'), b = s.point('indigo-rinse-water')
    const bundle = s.scene.getObjectByName('indigo-tied-cloth')!, home = bundle.position.clone()
    event(s.hit, 'pointerdown', a, 7); event(s.hit, 'pointermove', b, 8); event(s.hit, 'pointerup', b, 8)
    expect(bundle.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    event(s.hit, 'pointermove', b, 7); event(s.hit, 'pointerup', b, 7); expect(s.progress).toEqual([1])
  })
  it('accepts a quiet gesture below twelve pixels when it returns to the cloth', () => {
    const s = mount(2), a = s.point('indigo-cloth-body')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 11.9, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([3])
  })
  it.each([true, false])('rejects multitouch with outside pointer first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), to = s.point('indigo-rinse-water')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('indigo-bundle-body'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted motion on blur and pause, disables wish submission and resumes cleanly', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const pose = s.scene.getObjectByName('indigo-open-cloth')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('indigo-open-cloth')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); active = false; s.run(2)
    expect(s.scene.getObjectByName('indigo-open-cloth')!.position.equals(pose)).toBe(true)
    active = true; s.run(2); expect(s.progress).toEqual([2])
    active = false; s.run(); s.write('暂停'); s.button.click(); expect(s.progress).toEqual([2]); expect(s.saveWish).not.toHaveBeenCalled()
    active = true; s.run(); s.write('春日'); expect(s.progress).toEqual([2, 3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春日')
  })
  it.each([320, 390, 1280])('keeps each cue on the first visible touch-eligible surface at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width)
      for (const { object, cue } of cues(s)) {
        const pick = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(pick.object?.name).toBe(object.name); expect(Math.abs(pick.q.x)).toBeLessThan(.95); expect(Math.abs(pick.q.y)).toBeLessThan(.95)
        if (cue.destination instanceof THREE.Object3D) {
          const target = first(s, cue.destination.getWorldPosition(new THREE.Vector3()))
          expect(((s.scene.getObjectByName('indigo-rinse-water') as THREE.Mesh).material as THREE.Material).opacity).toBeGreaterThanOrEqual(.5); expect(target.object?.name).toBe(cue.destination.name); expect(Math.abs(target.q.x)).toBeLessThan(.95); expect(Math.abs(target.q.y)).toBeLessThan(.95)
        } else if (cue.destination) {
          const target = first(s, cue.destination())
          expect(target.object?.name).toBe('indigo-cloth-body'); expect(Math.abs(target.q.x)).toBeLessThan(.95); expect(Math.abs(target.q.y)).toBeLessThan(.95)
        }
      }
      for (const name of ['indigo-cloth-body', 'indigo-tied-cloth', 'indigo-drying-rail', 'indigo-rinse-basin']) {
        const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera); expect(Math.abs(p.x), name).toBeLessThan(.99); expect(Math.abs(p.y), name).toBeLessThan(.99)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'indigo-cloth-body', 'indigo-drying-rail'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
})

describe('physical cloth and owned resources', () => {
  it('keeps every rinsed cloth vertex outside the solid basin wall', () => {
    const s = mount(1), cloth = s.scene.getObjectByName('indigo-cloth-body') as THREE.Mesh
    const basin = s.scene.getObjectByName('indigo-rinse-basin') as THREE.Mesh<THREE.LatheGeometry>
    const profile = basin.geometry.parameters.points, vertices = cloth.geometry.getAttribute('position')
    // A lathed wall occupies the interior of its closed radius/height profile.
    // Classify actual cloth vertices independently using the even-odd polygon rule.
    let intruding = 0
    for (let v = 0; v < vertices.count; v++) {
      const p = basin.worldToLocal(cloth.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, v)))
      const radius = Math.hypot(p.x, p.z)
      let inside = false
      for (let i = 0, j = profile.length - 1; i < profile.length; j = i++) {
        const a = profile[i], b = profile[j]
        if ((a.y > p.y) !== (b.y > p.y) && radius < (b.x - a.x) * (p.y - a.y) / (b.y - a.y) + a.x) inside = !inside
      }
      if (inside) intruding++
    }
    expect(vertices.count).toBeGreaterThan(10000)
    expect(intruding, 'cloth vertices must not enter the basin wall').toBe(0)
  })
  it('rests the tied bundle on the stool and keeps both draped poses supported across the fold', () => {
    const tied = mount(), bundle = tied.scene.getObjectByName('indigo-bundle-body')!
    expect(new THREE.Box3().setFromObject(bundle).min.y).toBeCloseTo(new THREE.Box3().setFromObject(tied.scene.getObjectByName('indigo-bundle-stool-top')!).max.y, 4)
    expect(new THREE.Box3().setFromObject(tied.scene.getObjectByName('indigo-rinse-basin')!).min.y).toBeCloseTo(0, 4)
    for (const at of [1, 2, 3]) {
      const s = mount(at), body = s.scene.getObjectByName('indigo-cloth-body') as THREE.Mesh
      const support = s.scene.getObjectByName(at === 1 ? 'indigo-rinse-rest' : 'indigo-drying-rail')!, center = support.getWorldPosition(new THREE.Vector3())
      const positions = body.geometry.getAttribute('position'), foldPoints: THREE.Vector3[] = []
      for (let i = 0; i < positions.count; i++) {
        const p = body.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, i))
        if (p.y > center.y + .025) foldPoints.push(p)
      }
      expect(foldPoints.length).toBeGreaterThan(500)
      const radii = foldPoints.map(p => Math.hypot(p.y - center.y, p.z - center.z))
      expect(Math.min(...radii)).toBeCloseTo(.070, 3)
      expect(Math.max(...radii)).toBeCloseTo(.076, 3)
      expect(Math.min(...foldPoints.map(p => p.x))).toBeGreaterThan(center.x - .79)
      expect(Math.max(...foldPoints.map(p => p.x))).toBeLessThan(center.x + .79)
      expect(new THREE.Box3().setFromObject(body).min.y).toBeGreaterThan(.08)
    }
  })
  it('joins front, back and fold edges into one closed colored cloth surface', () => {
    const s = mount(2), mesh = s.scene.getObjectByName('indigo-cloth-body') as THREE.Mesh, geometry = mesh.geometry
    const position = geometry.getAttribute('position'), color = geometry.getAttribute('color'), index = geometry.getIndex()!
    const adjacency = Array.from({ length: position.count }, () => new Set<number>()), edges = new Map<string, number>()
    for (let i = 0; i < index.count; i += 3) for (const [a, b] of [[index.getX(i), index.getX(i + 1)], [index.getX(i + 1), index.getX(i + 2)], [index.getX(i + 2), index.getX(i)]]) {
      adjacency[a].add(b); adjacency[b].add(a); const key = a < b ? `${a}:${b}` : `${b}:${a}`; edges.set(key, (edges.get(key) ?? 0) + 1)
    }
    const visited = new Set<number>(), stack = [0]
    while (stack.length) { const v = stack.pop()!; if (visited.has(v)) continue; visited.add(v); adjacency[v].forEach(n => { if (!visited.has(n)) stack.push(n) }) }
    expect(visited.size).toBe(position.count); expect([...edges.values()].every(n => n === 2)).toBe(true)
    expect((mesh.material as THREE.MeshStandardMaterial).vertexColors).toBe(true); expect(mesh.children.length).toBe(0)
    const faces = { front: { white: 0, blue: 0 }, back: { white: 0, blue: 0 } }
    for (let i = 0; i < position.count; i++) {
      if (position.getY(i) > -.05) continue
      const face = position.getZ(i) > 0 ? faces.front : faces.back
      if (color.getX(i) > .7) face.white++
      if (color.getX(i) < .1) face.blue++
    }
    for (const face of Object.values(faces)) { expect(face.white).toBeGreaterThan(100); expect(face.blue).toBeGreaterThan(1000) }
    const frontZ = Array.from({ length: position.count }, (_, i) => position.getY(i) < -.60 ? position.getZ(i) : NaN).filter(v => v > 0)
    expect(Math.max(...frontZ) - Math.min(...frontZ)).toBeGreaterThan(.04)
  })
  it('rejects empty starts, wrong drops, too-short motion and a wandering final tap', () => {
    const s = mount(0, { isReducedMotion: () => true }), start = s.point('indigo-bundle-body'), target = s.point('indigo-rinse-water')
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', target); event(s.hit, 'pointerup', target)
    drag(s, 'indigo-drying-rail', 'indigo-rinse-water'); expect(s.progress).toEqual([])
    event(s.hit, 'pointerdown', start); event(s.hit, 'pointerup', start); expect(s.progress).toEqual([])
    drag(s, 'indigo-bundle-body', 'indigo-drying-rail'); expect(s.progress).toEqual([])
    drag(s); drag(s, 'indigo-cloth-body', 'indigo-rinse-water'); expect(s.progress).toEqual([1])
    drag(s, 'indigo-cloth-body', 'indigo-drying-rail'); const p = s.point('indigo-cloth-body')
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + 12, p[1]]); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1])('accepts a cloth placement with only owned down/up samples at checkpoint %i', at => {
    for (const reduced of [false, true]) {
      const s = mount(at, { isReducedMotion: () => reduced })
      const start = s.point(at === 0 ? 'indigo-bundle-body' : 'indigo-cloth-body')
      const target = s.point(at === 0 ? 'indigo-rinse-water' : 'indigo-drying-rail')
      event(s.hit, 'pointerup', target); expect(s.progress).toEqual([])
      event(s.hit, 'pointerdown', start); event(s.hit, 'pointerup', start); expect(s.progress).toEqual([])
      event(s.hit, 'pointerdown', start); event(s.hit, 'pointerup', target)
      if (!reduced) expect(s.progress).toEqual([])
      s.run(); expect(s.progress).toEqual([at + 1]); expect(s.haptic).toHaveBeenCalledOnce()
      s.instance.dispose()
    }
  })
  it('allows the visible knot and carries every attached tie during cancellation', () => {
    const s = mount(), group = s.scene.getObjectByName('indigo-tied-cloth')!, knot = s.scene.getObjectByName('indigo-bundle-knot')!
    const positions = group.children.map(o => o.position.clone()), home = group.position.clone(), p = s.point('indigo-bundle-knot'), target = s.point('indigo-rinse-water')
    expect(first(s, knot.getWorldPosition(new THREE.Vector3())).object?.name).toBe('indigo-bundle-knot')
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', target); expect(group.position.equals(home)).toBe(false)
    event(s.hit, 'pointercancel', target); expect(group.position.equals(home)).toBe(true)
    group.children.forEach((o, i) => expect(o.position.equals(positions[i])).toBe(true)); expect(s.progress).toEqual([])
    const center = s.point('indigo-bundle-body'), knotDrop: [number, number] = [target[0] + p[0] - center[0], target[1] + p[1] - center[1]]
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', knotDrop); s.run(); expect(s.progress).toEqual([1])
    event(s.hit, 'pointerup', knotDrop); expect(s.progress).toEqual([1])
  })
  it('rejects a short movement outside the destination and settles immediately when reduced motion is switched on', () => {
    let reduced = false; const s = mount(0, { isReducedMotion: () => reduced }), a = s.point('indigo-bundle-body'), target = s.point('indigo-rinse-water')
    const short: [number, number] = [a[0] + 7.9, a[1]]
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', short); event(s.hit, 'pointerup', short); s.run()
    expect(s.progress).toEqual([])
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 8, a[1]]); event(s.hit, 'pointerup', target); s.instance.update(.025)
    expect(s.progress).toEqual([]); reduced = true; s.instance.update(.025); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('indigo-open-cloth')!.visible).toBe(true)
  })
  it('rejects forms before the last checkpoint and while the final cloth is being touched', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); s.write('提前'); expect(s.progress).toEqual([1]); s.button.click()
    const p = s.point('indigo-cloth-body'); event(s.hit, 'pointerdown', p); s.write('手势期间'); expect(s.saveWish).not.toHaveBeenCalled()
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

// Cancellation happens before arrival; a completed placement already owns its result.
const pendingStarts = new WeakMap<HTMLElement, [number, number]>()
function pendingPoint(layer: HTMLElement, point: [number, number]): [number, number] {
 const start = pendingStarts.get(layer) ?? point
 return [start[0]+(point[0]-start[0])*.20,start[1]+(point[1]-start[1])*.20]
}
