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
function drag(s: ReturnType<typeof mount>, source = 'ship-mast-grip', target = 'ship-mast-socket') {
  const a = s.point(source), b = s.point(target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('ship-deck-handle'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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

function beforeArrival(s: ReturnType<typeof mount>, goal: [number, number]): [number, number] {
  let selected: { object: THREE.Object3D; cue: InteractionCue } | undefined
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled() && cue.kind === 'drag' && cue.destination) selected = { object, cue } })
  if (!selected) return goal
  const { object, cue } = selected, canvas = s.overlay.parentElement!.querySelector('canvas')!, rect = canvas.getBoundingClientRect()
  const source = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
  const x = rect.left + (source.x + 1) * rect.width / 2, y = rect.top + (1 - source.y) * rect.height / 2
  return [Math.max(rect.left + 2, x - 48), Math.max(rect.top + 2, y - 48)]
}

describe('Åland original wooden sailing model', () => {
  it('requires the mast grip, then the deck handle, then one quiet tap', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s); expect(s.progress).toEqual([1])
    drag(s, 'ship-deck-handle', 'ship-cradle-target'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('rejects empty space, the wrong object, missing travel and a wrong destination', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointerup', s.point('ship-mast-socket'))
    drag(s, 'ship-deck-handle'); expect(s.progress).toEqual([])
    const p = s.point('ship-mast-grip'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p); expect(s.progress).toEqual([])
    const mast = s.scene.getObjectByName('ship-mast-assembly')!, home = mast.position.clone()
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [1, 1]); event(s.hit, 'pointerup', [1, 1])
    expect(mast.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    drag(s); drag(s, 'ship-mast-grip', 'ship-cradle-target'); expect(s.progress).toEqual([1])
    drag(s, 'ship-deck-handle', 'ship-mast-socket'); expect(s.progress).toEqual([1])
  })
  it.each([0, 1, 2, 3])('silently restores %i with attached mast and seated hull when appropriate', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run()
      expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.button.hidden).toBe(at === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      if (at >= 1) {
        const mast = s.scene.getObjectByName('ship-mast-assembly')!, socket = s.scene.getObjectByName('ship-mast-socket')!
        expect(mast.getWorldPosition(new THREE.Vector3()).distanceTo(socket.getWorldPosition(new THREE.Vector3()))).toBeLessThan(.1)
      }
    }
  })
  it('routes accessible button activation through the same three checkpoints and ignores wish drafts', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button.tagName).toBe('BUTTON'); expect(s.button.type).toBe('button')
    for (const key of ['Enter', ' ']) { s.button.dispatchEvent(new KeyboardEvent('keydown', { key })); s.button.click() }
    s.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的感谢'; s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('saves only a trimmed explicit form submission once, including reentrant submit attempts', () => {
    const s = mount(2); s.write('  '); expect(s.progress).toEqual([])
    s.saveWish.mockImplementation(() => s.write('再写一遍'))
    s.write('  谢谢一起归来的人  '); s.write('重复')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢一起归来的人'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const returning = mount(2, { returning: true }); tap(returning); expect(returning.progress).toEqual([3]); expect(returning.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('abandons unfinished physical movement on %s', kind => {
    let active = true; const s = mount(1, { isActive: () => active, isReducedMotion: () => true })
    const ship = s.scene.getObjectByName('ship-model')!, home = ship.position.clone(), end = s.point('ship-cradle-target')
    event(s.hit, 'pointerdown', s.point('ship-deck-handle')); event(s.hit, 'pointermove', beforeArrival(s, end))
    if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else if (kind === 'pause') { active = false; s.run() }
    else event(s.hit, kind, end)
    event(s.hit, 'pointerup', end); expect(s.progress).toEqual([]); expect(ship.position.equals(home)).toBe(true)
    active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s, 'ship-deck-handle', 'ship-cradle-target'); expect(s.progress).toEqual([2])
  })
  it.each([true, false])('rejects mixed pointer ownership with outside first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), to = s.point('ship-mast-socket')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('ship-mast-grip'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes an accepted placement during host pause and blocks inactive form submissions', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const position = s.scene.getObjectByName('ship-model')!.position.clone()
    active = false; s.run(2); expect(s.scene.getObjectByName('ship-model')!.position.equals(position)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(2); expect(s.progress).toEqual([2])
    active = false; s.run(); s.write('暂停'); s.button.click(); expect(s.progress).toEqual([2])
    active = true; s.run(); window.dispatchEvent(new Event('blur')); s.run(); s.write('失焦'); expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(); s.write('谢谢'); expect(s.progress).toEqual([2, 3])
  })
  it('seats the curved hull on both padded cradle posts instead of hovering above them', () => {
    const s = mount(2), hull = s.scene.getObjectByName('ship-curved-wooden-hull')!
    const pads: THREE.Object3D[] = []; s.scene.traverse(object => { if (object.name === 'ship-cradle-felt') pads.push(object) })
    expect(pads).toHaveLength(2)
    for (const x of [-.06, .90]) for (const z of [-.35, -.46, -.24]) {
      // Cast up to the hull belly and down to the top of the matching cushion.
      const hullRay = new THREE.Raycaster(new THREE.Vector3(x, .82, z), new THREE.Vector3(0, 1, 0))
      const padRay = new THREE.Raycaster(new THREE.Vector3(x, 1.4, z), new THREE.Vector3(0, -1, 0))
      const hullY = hullRay.intersectObject(hull, false)[0]?.point.y
      const padY = padRay.intersectObjects(pads, false)[0]?.point.y
      expect(hullY).toBeDefined(); expect(padY).toBeDefined(); expect(Math.abs(hullY! - padY!)).toBeLessThan(.025)
    }
  })
  it('keeps the mast base in its deck socket throughout accepted ship placement', () => {
    const s = mount(1); s.button.click()
    for (let i = 0; i < 18; i++) {
      s.instance.update(.025)
      const base = s.scene.getObjectByName('ship-mast-assembly')!.getWorldPosition(new THREE.Vector3())
      const socket = s.scene.getObjectByName('ship-mast-socket')!.getWorldPosition(new THREE.Vector3())
      expect(base.distanceTo(socket)).toBeLessThan(.001)
    }
    s.run(); expect(s.progress).toEqual([2])
  })
  it('offers a recessed socket floor inside a raised collar for the mast pin', () => {
    const s = mount(), socket = s.scene.getObjectByName('ship-mast-socket')!, collar = s.scene.getObjectByName('ship-mast-collar')!
    expect(collar, 'the socket has a visible rim').toBeDefined()
    const floorBox = new THREE.Box3().setFromObject(socket), rimBox = new THREE.Box3().setFromObject(collar)
    expect(rimBox.max.y - floorBox.max.y).toBeGreaterThan(.015)
    expect(rimBox.min.x).toBeLessThan(floorBox.min.x); expect(rimBox.max.x).toBeGreaterThan(floorBox.max.x)
  })
  it.each([320, 390, 1280])('makes every cue and target the first visible opaque ray hit at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width)
      for (const { object, cue } of cues(s)) {
        const pick = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(pick.object?.name).toBe(object.name); expect(Math.abs(pick.q.x)).toBeLessThan(.95); expect(Math.abs(pick.q.y)).toBeLessThan(.95)
        if (cue.destination instanceof THREE.Object3D) {
          const target = first(s, cue.destination.getWorldPosition(new THREE.Vector3()))
          expect(target.object?.name).toBe(cue.destination.name)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'ship-deck-handle', 'ship-cradle-target'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('keeps sail panel seams proud on the cambered cloth, bolt-rope hem seated along edges, rigging clear, and reduced motion static', () => {
    const s = mount(1, { isReducedMotion: () => true })
    const sail = s.scene.getObjectByName('ship-cream-cloth-sail') as THREE.Mesh
    const sailPos = sail.geometry.getAttribute('position') as THREE.BufferAttribute
    const hemGroup = s.scene.getObjectByName('ship-sail-hem')!
    const seamGroup = s.scene.getObjectByName('ship-sail-seam')!
    const forestay = s.scene.getObjectByName('ship-forestay') as THREE.Mesh
    expect(sail).toBeDefined(); expect(hemGroup).toBeDefined(); expect(seamGroup).toBeDefined(); expect(forestay).toBeDefined()
    expect((sail.material as THREE.MeshStandardMaterial).userData.ritualOptics?.kind).toBe('cloth')
    expect((sail.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture)

    // Every horizontal panel seam centerline stays cleanly in front of the local cambered sail surface (zero mid-panel clipping).
    const cols = 24, rows = 18
    const seamMeshes: THREE.Mesh[] = []
    seamGroup.traverse(o => { if ((o as THREE.Mesh).isMesh && o.name.startsWith('ship-sail-seam-')) seamMeshes.push(o as THREE.Mesh) })
    expect(seamMeshes).toHaveLength(2)
    for (const [idx, rIdx] of ([6, 12] as const).entries()) {
      const seamMesh = seamMeshes[idx]!
      const curve = (seamMesh.geometry as THREE.TubeGeometry).parameters.path as THREE.CatmullRomCurve3
      for (let k = 0; k <= 10; k++) {
        const pt = curve.getPointAt(k / 10)
        // Linearly interpolate exact cloth Z at pt.x along the matching sail mesh row.
        let clothZ = sailPos.getZ(rIdx * (cols + 1))
        for (let c = 0; c < cols; c++) {
          const i0 = rIdx * (cols + 1) + c, i1 = i0 + 1
          const x0 = sailPos.getX(i0), x1 = sailPos.getX(i1)
          if (pt.x >= x0 - 1e-5 && pt.x <= x1 + 1e-5) {
            const frac = x1 > x0 ? THREE.MathUtils.clamp((pt.x - x0) / (x1 - x0), 0, 1) : 0
            clothZ = THREE.MathUtils.lerp(sailPos.getZ(i0), sailPos.getZ(i1), frac)
            break
          }
        }
        expect(pt.z - clothZ, `seam ${idx} sample ${k}`).toBeGreaterThan(.002)
        expect(pt.z - clothZ, `seam ${idx} sample ${k}`).toBeLessThan(.012)
      }
    }

    // All 4 bolt-rope edges hug the actual sail boundary segments without Catmull-Rom corner overshoot.
    const edgeVerts: Record<string, THREE.Vector3[]> = {
      'ship-sail-hem-luff': Array.from({ length: rows + 1 }, (_, r) => new THREE.Vector3().fromBufferAttribute(sailPos, r * (cols + 1))),
      'ship-sail-hem-leech': Array.from({ length: rows + 1 }, (_, r) => new THREE.Vector3().fromBufferAttribute(sailPos, r * (cols + 1) + cols)),
      'ship-sail-hem-foot': Array.from({ length: cols + 1 }, (_, c) => new THREE.Vector3().fromBufferAttribute(sailPos, c)),
      'ship-sail-hem-head': Array.from({ length: cols + 1 }, (_, c) => new THREE.Vector3().fromBufferAttribute(sailPos, rows * (cols + 1) + c)),
    }
    const seg = new THREE.Line3(), closest = new THREE.Vector3()
    for (const [edgeName, poly] of Object.entries(edgeVerts)) {
      const edge = hemGroup.getObjectByName(edgeName) as THREE.Mesh<THREE.TubeGeometry>
      expect(edge, edgeName).toBeDefined()
      const curve = edge.geometry.parameters.path as THREE.CatmullRomCurve3
      for (let k = 0; k <= 12; k++) {
        const pt = curve.getPointAt(k / 12)
        let minDist = Infinity
        for (let i = 0; i < poly.length - 1; i++) {
          seg.set(poly[i]!, poly[i + 1]!)
          seg.closestPointToPoint(pt, true, closest)
          minDist = Math.min(minDist, pt.distanceTo(closest))
        }
        expect(minDist, `${edgeName} sample ${k}`).toBeLessThan(.002)
      }
    }

    // Mast hoops and boom lashings physically connect the sail to mast and boom.
    for (let i = 0; i < 6; i++) expect(s.scene.getObjectByName(`ship-mast-hoop-${i}`)).toBeDefined()
    for (let i = 0; i < 5; i++) expect(s.scene.getObjectByName(`ship-boom-lashing-${i}`)).toBeDefined()
    expect(s.scene.getObjectByName('ship-gaff')).toBeDefined()

    // Forestay clears the cambered sail cloth in 3D without passing through it.
    s.scene.updateMatrixWorld(true)
    const stayCurve = (forestay.geometry as THREE.TubeGeometry).parameters.path as THREE.CatmullRomCurve3
    let minStayClearance = Infinity
    for (let k = 0; k <= 24; k++) {
      const sp = stayCurve.getPointAt(k / 24).applyMatrix4(forestay.matrixWorld)
      for (let i = 0; i < sailPos.count; i += 3) {
        const vp = new THREE.Vector3().fromBufferAttribute(sailPos, i).applyMatrix4(sail.matrixWorld)
        minStayClearance = Math.min(minStayClearance, sp.distanceTo(vp))
      }
    }
    expect(minStayClearance).toBeGreaterThan(.02)

    // Reduced motion keeps sail geometry completely static; normal mode breathes subtly while pinning luff/foot/head.
    const reducedBefore = Array.from(sailPos.array)
    s.run(.6)
    expect(Array.from(sailPos.array)).toEqual(reducedBefore)
    s.instance.dispose()

    const live = mount(1, { isReducedMotion: () => false })
    const liveSail = live.scene.getObjectByName('ship-cream-cloth-sail') as THREE.Mesh
    const livePos = liveSail.geometry.getAttribute('position') as THREE.BufferAttribute
    const liveInitial = Array.from(livePos.array)
    live.run(.45)
    const liveAfter = Array.from(livePos.array)
    expect(liveAfter).not.toEqual(liveInitial)
    for (let i = 0; i < liveAfter.length; i++) expect(Number.isFinite(liveAfter[i])).toBe(true)
    // Luff (x=0), foot (y=0), and head (y=rows) remain pinned to mast/boom/gaff.
    for (let y = 0; y <= rows; y++) {
      const vi = y * (cols + 1) * 3
      expect(liveAfter[vi + 2]).toBeCloseTo(liveInitial[vi + 2]!, 6)
    }
    for (let x = 0; x <= cols; x++) {
      const footI = x * 3
      const headI = (rows * (cols + 1) + x) * 3
      expect(liveAfter[footI + 2]).toBeCloseTo(liveInitial[footI + 2]!, 6)
      expect(liveAfter[headI + 2]).toBeCloseTo(liveInitial[headI + 2]!, 6)
    }
  })

  it('frees geometry, materials, cues, shadows, DOM, renderer and listeners exactly once', () => {
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
