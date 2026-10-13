// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only the unavailable GPU is replaced; all scene geometry, rays, input and cue projection are real.
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
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, progress, saveWish, complete, haptic, width, height }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}
function drag(s: ReturnType<typeof mount>, from: string, to: string) {
  pointer(s.hit, 'pointerdown', s.point(from)); pointer(s.hit, 'pointermove', s.point(to)); pointer(s.hit, 'pointerup', s.point(to)); s.run()
}
function tap(s: ReturnType<typeof mount>, name = 'incense-tea-saucer') {
  const p = s.point(name); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
}
function cues(s: ReturnType<typeof mount>) {
  const result: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) result.push({ object, cue }) })
  return result
}

describe('炉前一炷: an open household incense tribute', () => {
  it('moves the actual lid by its knob onto the rest, seats the stick in the visible socket, then quietly finishes', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'incense-lid-knob', 'incense-lid-rest'); expect(s.progress).toEqual([1])
    drag(s, 'incense-paper-grip', 'incense-socket'); expect(s.progress).toEqual([1, 2])
    const socket = s.scene.getObjectByName('incense-socket')!.getWorldPosition(new THREE.Vector3())
    const foot = s.scene.getObjectByName('incense-stick-foot')!.getWorldPosition(new THREE.Vector3())
    expect(foot.distanceTo(socket)).toBeLessThan(.03)
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input,textarea')).toBeNull()
  })

  it('provides a native keyboard action for the same three physical steps, without writing wishes', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button.type).toBe('button')
    s.button.click(); s.button.click(); s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('rejects off-object starts, wrong sources, wrong destinations, and a moving quiet tap', () => {
    const s = mount(0, { isReducedMotion: () => true })
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', s.point('incense-lid-rest'))
    drag(s, 'incense-paper-grip', 'incense-lid-rest'); expect(s.progress).toEqual([])
    const original = s.scene.getObjectByName('incense-lid')!.position.clone()
    drag(s, 'incense-lid-knob', 'incense-tea-saucer'); expect(s.progress).toEqual([])
    expect(s.scene.getObjectByName('incense-lid')!.position.equals(original)).toBe(true)
    drag(s, 'incense-lid-knob', 'incense-lid-rest')
    drag(s, 'incense-paper-grip', 'incense-lid-rest'); expect(s.progress).toEqual([1])
    drag(s, 'incense-paper-grip', 'incense-socket')
    const p = s.point('incense-tea-saucer')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 45, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i with matching poses and no progress, feedback or completion', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run(2)
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(s.overlay.querySelector('input,textarea')).toBeNull()
      expect(cues(s).map(c => c.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.button.hidden).toBe(at === 3)
      const lid = s.scene.getObjectByName('incense-lid')!.getWorldPosition(new THREE.Vector3())
      const rest = s.scene.getObjectByName('incense-lid-rest')!.getWorldPosition(new THREE.Vector3())
      expect(Math.hypot(lid.x - rest.x, lid.z - rest.z) < .02).toBe(at >= 1)
      expect(s.scene.getObjectByName('incense-smoke')!.visible).toBe(at >= 2)
    }
  })

  it.each(['pointercancel', 'lostpointercapture'])('restores the moved object after %s and accepts a fresh drag', event => {
    const s = mount(1, { isReducedMotion: () => true }), source = s.point('incense-paper-grip'), target = s.point('incense-socket')
    const original = s.scene.getObjectByName('incense-stick')!.position.clone()
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', target); pointer(s.hit, event, target); pointer(s.hit, 'pointerup', target)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('incense-stick')!.position.equals(original)).toBe(true)
    drag(s, 'incense-paper-grip', 'incense-socket'); expect(s.progress).toEqual([2])
  })

  it.each([true, false])('blocks whole-page mixed fingers (outside first %s) and native actions during capture', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), from = s.point('incense-lid-knob'), to = s.point('incense-lid-rest')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', from, 1)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointerup', to, 1); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'incense-lid-knob', 'incense-lid-rest'); expect(s.progress).toEqual([1])
  })

  it('cancels dragging and cues on host pause and blur, with no phantom release after focus', () => {
    let active = true
    const s = mount(1, { isActive: () => active, isReducedMotion: () => true })
    const source = s.point('incense-paper-grip'), target = s.point('incense-socket')
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', target)
    active = false; s.run(); expect(cues(s)).toEqual([]); expect(s.button.disabled).toBe(true)
    active = true; pointer(s.hit, 'pointerup', target); expect(s.progress).toEqual([])
    s.run(.025); drag(s, 'incense-paper-grip', 'incense-socket'); expect(s.progress).toEqual([2])
    window.dispatchEvent(new Event('blur')); s.run(.025)
    expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull(); s.button.click(); tap(s); expect(s.progress).toEqual([2])
    window.dispatchEvent(new Event('focus')); s.run(.025); tap(s); expect(s.progress).toEqual([2, 3])
  })

  it('freezes a settling lid while inactive and reports only settled checkpoints', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(.1); const pos = s.scene.getObjectByName('incense-lid')!.position.clone()
    active = false; s.run(2); expect(s.scene.getObjectByName('incense-lid')!.position.equals(pos)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(2); expect(s.progress).toEqual([1]); s.run(2); expect(s.progress).toEqual([1])
  })

  it.each([320, 390, 1280])('places visible cues on opaque actual meshes with successful projected interactions at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, {}, width, width === 1280 ? 600 : 560)
      for (const { object, cue } of cues(s)) {
        expect(object).toBeInstanceOf(THREE.Mesh)
        const mat = (object as THREE.Mesh).material as THREE.Material
        expect(mat.visible).toBe(true); expect(mat.opacity).toBe(1); expect(object.visible).toBe(true)
        const p = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(ray.intersectObject(object).length, object.name).toBeGreaterThan(0)
        const node = s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
        expect(Number(node.dataset.x)).toBeCloseTo((p.x + 1) * width / 2)
        expect(Number(node.dataset.y)).toBeCloseTo((1 - p.y) * s.height / 2)
        if (cue.destination instanceof THREE.Object3D) {
          expect(cue.destination).toBeInstanceOf(THREE.Mesh)
          const destination = cue.destination.getWorldPosition(new THREE.Vector3()).project(s.camera)
          ray.setFromCamera(new THREE.Vector2(destination.x, destination.y), s.camera)
          expect(ray.intersectObject(cue.destination).length, cue.destination.name).toBeGreaterThan(0)
          const target = s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
          expect(Number(target.dataset.x)).toBeCloseTo((destination.x + 1) * width / 2)
          expect(Number(target.dataset.y)).toBeCloseTo((1 - destination.y) * s.height / 2)
        }
      }
      for (const name of ['incense-censer', 'incense-lid', 'incense-stick', 'incense-table', 'incense-tea']) {
        const box = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera)
          expect(Math.abs(p.x), `${name} horizontal crop`).toBeLessThan(.98); expect(Math.abs(p.y), `${name} vertical crop`).toBeLessThan(.98)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width, width === 1280 ? 600 : 560)
    drag(s, 'incense-lid-knob', 'incense-lid-rest'); drag(s, 'incense-paper-grip', 'incense-socket'); tap(s)
    expect(s.progress).toEqual([1, 2, 3])
  })

  it('builds a hollow three-foot vessel and an exposed socket, with the lid supported by its ceramic rest', () => {
    const s = mount(1)
    const feet = s.scene.getObjectByName('incense-three-feet')!
    expect(feet.children).toHaveLength(3)
    for (const foot of feet.children) expect(new THREE.Box3().setFromObject(foot).min.y).toBeCloseTo(.55, 2)
    const socket = s.scene.getObjectByName('incense-socket')!
    const p = socket.getWorldPosition(new THREE.Vector3()).project(s.camera)
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
    const hits = ray.intersectObjects([s.scene.getObjectByName('incense-censer')!], true)
    expect(hits[0].object.name).toBe('incense-socket')
    const lid = new THREE.Box3().setFromObject(s.scene.getObjectByName('incense-lid')!)
    const rest = new THREE.Box3().setFromObject(s.scene.getObjectByName('incense-lid-rest')!)
    expect(lid.min.y - rest.max.y).toBeCloseTo(0, 2)
  })

  it('rests the closed lid on the censer rim instead of intersecting the vessel wall', () => {
    const s = mount(0)
    const lid = new THREE.Box3().setFromObject(s.scene.getObjectByName('incense-lid')!)
    const censer = new THREE.Box3().setFromObject(s.scene.getObjectByName('incense-censer')!)
    expect(lid.min.y - censer.max.y).toBeCloseTo(0, 2)
  })

  it('gives the paper grip a physical mobile touch area around its cue without a proxy target', () => {
    const s = mount(1, {}, 320, 560), [x, y] = s.point('incense-paper-grip')
    for (const [dx, dy] of [[-22, 0], [22, 0], [0, -22], [0, 22]]) {
      const ray = new THREE.Raycaster()
      ray.setFromCamera(new THREE.Vector2((x + dx - 17) / 320 * 2 - 1, 1 - (y + dy - 91) / 560 * 2), s.camera)
      expect(ray.intersectObject(s.scene.getObjectByName('incense-paper-grip')!).length, `${dx}, ${dy}`).toBeGreaterThan(0)
    }
  })

  it('disposes all owned geometry, materials, shadows, renderer and listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = []
    const renderer = rendered.renderer as THREE.WebGLRenderer
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(mat)
      if (object instanceof THREE.DirectionalLight) {
        const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8)
        object.shadow.map.addEventListener('dispose', () => { shadows[i]++ })
      }
    })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], p = s.point('incense-lid-knob')
    s.instance.dispose(); s.instance.dispose(); s.button.click(); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); expect(s.progress).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), `owned ${type} listener`).toBe(true)
  })
})
