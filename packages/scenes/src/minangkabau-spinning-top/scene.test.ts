// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// GPU rendering alone is mocked: real geometry, rays, projected cues and the wish form are exercised.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown }))
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
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
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { scene.updateMatrixWorld(); camera.updateMatrixWorld(); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390, height = 560) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  const left = 17, top = 91
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, shared: Shared, gestures: Gestures, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(0.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += 0.025) instance.update(0.025) }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  return { instance, scene, camera, host, overlay, hit: hit!, button: button!, point, run, write, progress, saveWish, complete, haptic, width, height, left, top }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(e)
}
function tap(s: ReturnType<typeof mount>, name = 'top-cap') {
  const p = s.point(name); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
}
function drag(s: ReturnType<typeof mount>, name: string, target: string) {
  const a = s.point(name), b = s.point(target)
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function enabled(s: ReturnType<typeof mount>) {
  const result: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) result.push({ object, cue }) })
  return result
}


describe('original tabletop spinning-top toy', () => {
  // Removing nearest-surface validation must fail these tests: the intended
  // mesh still intersects the actual ray, but an opaque mesh is in front of it.
  function occlude(s: ReturnType<typeof mount>, name: string) {
    s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
    const mesh = new THREE.Mesh(new THREE.SphereGeometry(.18, 24, 16), new THREE.MeshStandardMaterial({ color: 0x5e594d }))
    mesh.name = 'test-opaque-occluder'
    mesh.position.copy(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()))
      .lerp(s.camera.getWorldPosition(new THREE.Vector3()), .15)
    s.scene.getObjectByName('homeward-top-workshop')!.add(mesh)
    s.scene.updateMatrixWorld(true)
    return mesh
  }
  it.each([0, 1, 2])('rejects an occluded gesture source at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true })
    const blocker = occlude(s, at === 0 ? 'top-pull-bead' : 'top-cap')
    if (at === 0) drag(s, 'top-pull-bead', 'top-pull-anchor'); else tap(s)
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    blocker.visible = false
    if (at === 0) drag(s, 'top-pull-bead', 'top-pull-anchor'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it('rejects a drop through opaque geometry over the board anchor', () => {
    const s = mount(0, { isReducedMotion: () => true }), target = s.point('top-pull-anchor')
    pointer(s.hit, 'pointerdown', s.point('top-pull-bead'))
    const blocker = occlude(s, 'top-pull-anchor')
    pointer(s.hit, 'pointermove', target); pointer(s.hit, 'pointerup', target)
    expect(s.progress).toEqual([])
    blocker.visible = false; drag(s, 'top-pull-bead', 'top-pull-anchor'); expect(s.progress).toEqual([1])
  })
  it.each([1, 2])('rejects a cap release newly occluded at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point('top-cap')
    pointer(s.hit, 'pointerdown', p)
    const blocker = occlude(s, 'top-cap')
    pointer(s.hit, 'pointerup', p); expect(s.progress).toEqual([])
    blocker.visible = false; tap(s); expect(s.progress).toEqual([at + 1])
  })
  it('pulls the visible bead, settles the cap and quietly finishes once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'top-pull-bead', 'top-pull-anchor'); expect(s.progress).toEqual([1])
    tap(s); s.run(); expect(s.progress).toEqual([1, 2]); tap(s); tap(s)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('moves the cotton cord with the bead and restores invalid drops', () => {
    const s = mount(0, { isReducedMotion: () => true }), bead = s.scene.getObjectByName('top-pull-bead')!, cord = s.scene.getObjectByName('top-loose-cord')!
    const home = bead.position.clone(), bounds = new THREE.Box3().setFromObject(cord)
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', s.point('top-pull-anchor'))
    drag(s, 'top-cap', 'top-pull-anchor'); expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', s.point('top-pull-bead')); pointer(s.hit, 'pointermove', s.point('top-pull-anchor'))
    expect(bead.position.distanceTo(home)).toBeGreaterThan(.3); expect(new THREE.Box3().setFromObject(cord).equals(bounds)).toBe(false)
    pointer(s.hit, 'pointerup', [1, 1]); expect(bead.position.equals(home)).toBe(true)
    expect(new THREE.Box3().setFromObject(cord).equals(bounds)).toBe(true); expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerup', s.point('top-pull-anchor')); expect(s.progress).toEqual([])
    drag(s, 'top-pull-bead', 'top-pull-anchor'); expect(s.progress).toEqual([1])
    const p = s.point('top-cap'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 60, p[1]]); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1]); tap(s); expect(s.progress).toEqual([1, 2])
  })
  it('offers the same accessible path and ignores an unsubmitted draft', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button.type).toBe('button'); s.button.click(); s.button.click()
    s.overlay.querySelector<HTMLInputElement>('input')!.value = '回家草稿'; s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('saves an explicit trimmed submission once even with reentrant submission', () => {
    const s = mount(2); s.write('  '); expect(s.progress).toEqual([])
    s.saveWish.mockImplementation(() => s.write('第二句')); s.write('  愿旅途安稳  '); s.write('重复')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿旅途安稳'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0, 1, 2, 3])('silently restores %i and excludes a returning wish form', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run(2)
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(enabled(s).map(e => e.cue.kind)).toEqual(at === 0 ? ['drag'] : at < 3 ? ['tap'] : [])
      expect(s.button.hidden).toBe(at === 3); expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      if (returning && at === 2) { tap(s); expect(s.progress).toEqual([3]); expect(s.saveWish).not.toHaveBeenCalled() }
    }
  })
  it.each(['pointercancel', 'lostpointercapture'])('restores unfinished pulls after %s', event => {
    const s = mount(0, { isReducedMotion: () => true }), bead = s.scene.getObjectByName('top-pull-bead')!, home = bead.position.clone(), target = s.point('top-pull-anchor')
    pointer(s.hit, 'pointerdown', s.point('top-pull-bead')); pointer(s.hit, 'pointermove', target); pointer(s.hit, event, target); pointer(s.hit, 'pointerup', target)
    expect(bead.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    drag(s, 'top-pull-bead', 'top-pull-anchor'); expect(s.progress).toEqual([1])
  })
  it.each([true, false])('blocks mixed pointer ownership with outside first %s', first => {
    const s = mount(0, { isReducedMotion: () => true }), target = s.point('top-pull-anchor')
    if (first) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', s.point('top-pull-bead'))
    if (!first) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointermove', target); s.button.click(); pointer(s.hit, 'pointerup', target); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'top-pull-bead', 'top-pull-anchor'); expect(s.progress).toEqual([1])
  })
  it('blocks pointer-owned, blurred and inactive wishes and hides inactive cues', () => {
    let active = true; const s = mount(2, { isActive: () => active })
    pointer(document.body, 'pointerdown', [1, 1]); s.write('旅途'); s.button.click(); expect(s.progress).toEqual([])
    pointer(document.body, 'pointerup', [1, 1]); active = false; s.run(); s.write('暂停'); tap(s); expect(s.progress).toEqual([])
    active = true; s.run(); window.dispatchEvent(new Event('blur')); s.run()
    expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull(); expect(s.overlay.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
    s.write('失焦'); s.button.click(); expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(); s.write('回家'); expect(s.progress).toEqual([3])
  })
  it('cancels unfinished input and freezes accepted motion and axle rotation while paused', () => {
    let active = true; const s = mount(0, { isActive: () => active }), target = s.point('top-pull-anchor')
    pointer(s.hit, 'pointerdown', s.point('top-pull-bead')); pointer(s.hit, 'pointermove', target)
    active = false; s.run(); active = true; pointer(s.hit, 'pointerup', target); s.run(); expect(s.progress).toEqual([])
    s.button.click(); s.run(.1); const top = s.scene.getObjectByName('top-rotor')!, bead = s.scene.getObjectByName('top-pull-bead')!, pose = bead.position.clone(), rotation = top.rotation.clone()
    active = false; s.run(2); expect(bead.position.equals(pose)).toBe(true); expect(top.rotation.equals(rotation)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([1]); const angle = top.rotation.y; s.run(.2); expect(top.rotation.y).not.toBe(angle)
    active = false; s.run(); const frozen = top.rotation.clone(); s.run(); expect(top.rotation.equals(frozen)).toBe(true)
    active = true; s.run(); tap(s); s.run(); expect(s.progress).toEqual([1, 2]); const settled = top.rotation.clone(); s.run(); expect(top.rotation.equals(settled)).toBe(true)
  })
  it('uses immediate reduced-motion settling without ongoing spin or wobble', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.button.click(); expect(s.progress).toEqual([1])
    const top = s.scene.getObjectByName('top-rotor')!, pose = top.rotation.clone(); s.run(); expect(top.rotation.equals(pose)).toBe(true)
    s.button.click(); expect(s.progress).toEqual([1, 2]); expect(top.rotation.x).toBe(0); expect(top.rotation.z).toBe(0)
  })
  it.each([320, 390, 1280])('has unoccluded whole-scene cue hits and completable gestures at %ipx', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width, width === 1280 ? 600 : 560)
      for (const { object, cue } of enabled(s)) for (const target of [object, ...(cue.destination instanceof THREE.Object3D ? [cue.destination] : [])]) {
        const p = target.getWorldPosition(new THREE.Vector3()).project(s.camera), ray = new THREE.Raycaster()
        ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        const hits = ray.intersectObjects(s.scene.children, true).filter(h => { let node: THREE.Object3D | null = h.object; while (node) { if (!node.visible) return false; node = node.parent }; return true })
        expect(hits[0]?.object.name, target.name).toBe(target.name)
        expect((target as THREE.Mesh).material).toMatchObject({ transparent: false, opacity: 1 })
        expect(Math.abs(p.x)).toBeLessThan(.95); expect(Math.abs(p.y)).toBeLessThan(.95)
        const role = target === object ? 'source' : 'target', node = s.host.querySelector<HTMLElement>(`[data-cue-role="${role}"]`)!
        expect(Number(node.dataset.x)).toBeCloseTo((p.x + 1) * width / 2); expect(Number(node.dataset.y)).toBeCloseTo((1 - p.y) * s.height / 2)
      }
      for (const name of ['top-board', 'top-rotor', 'top-pull-bead', 'top-pull-anchor']) {
        const box = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera); expect(Math.abs(p.x), name).toBeLessThan(.98); expect(Math.abs(p.y), name).toBeLessThan(.98)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width, width === 1280 ? 600 : 560)
    drag(s, 'top-pull-bead', 'top-pull-anchor'); tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('disposes geometry, materials, shadow maps, DOM, cues and window listeners once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = []
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(mat)
      if (object instanceof THREE.DirectionalLight) { const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8); object.shadow.map.addEventListener('dispose', () => { shadows[i]++ }) }
    })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click(); s.instance.update(5)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); expect(s.progress).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
