// @vitest-environment jsdom
// jsdom has no Canvas 2D; exercise the explicit unavailable-texture fallback quietly.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })

// Isolate spatial gestures, geometry and save callbacks from shared ending scheduling.
// The real automatic timer, animation and lifecycle contract are covered across all
// 20 scenes in ../quiet-ending-workshop-scenes.test.ts without this mock.
vi.mock('../quiet-ending', () => ({
  createQuietEnding: () => ({ sync() {}, update() {}, dispose() {}, completing: true, running: false }),
}))

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
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
function tap(s: ReturnType<typeof mount>, name = 'basket-quiet-medallion') {
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

function beforeArrival(s: ReturnType<typeof mount>, goal: [number, number]): [number, number] {
  let selected: { object: THREE.Object3D; cue: InteractionCue } | undefined
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled() && cue.kind === 'drag' && cue.destination) selected = { object, cue } })
  if (!selected) return goal
  const { object, cue } = selected, canvas = s.overlay.parentElement!.querySelector('canvas')!, rect = canvas.getBoundingClientRect()
  const source = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
  const x = rect.left + (source.x + 1) * rect.width / 2, y = rect.top + (1 - source.y) * rect.height / 2
  return [Math.max(rect.left + 2, x - 48), Math.max(rect.top + 2, y - 48)]
}

describe('Polish seasonal family basket', () => {
  it('offers the three equivalent native-button checkpoints exactly once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button, 'the scene must mount an accessible action button').not.toBeNull()
    expect(s.button.tagName).toBe('BUTTON'); expect(s.button.type).toBe('button')
    s.button.click(); s.button.click(); s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('drags actual bread into the cloth and actual patterned egg into its nest, then taps the basket', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'basket-bread-body', 'basket-bread-rest'); expect(s.progress).toEqual([1])
    drag(s, 'basket-egg-body', 'basket-egg-nest'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('rejects off-object starts, wrong sources, wrong targets and drag-out-and-back basket taps', () => {
    const s = mount(0, { isReducedMotion: () => true })
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', s.point('basket-bread-rest'))
    drag(s, 'basket-egg-body', 'basket-bread-rest'); expect(s.progress).toEqual([])
    const original = s.scene.getObjectByName('basket-bread')!.position.clone()
    pointer(s.hit, 'pointerdown', s.point('basket-bread-body')); pointer(s.hit, 'pointermove', [1, 1]); pointer(s.hit, 'pointerup', [1, 1])
    expect(s.scene.getObjectByName('basket-bread')!.position.equals(original)).toBe(true)
    drag(s, 'basket-bread-body', 'basket-bread-rest'); drag(s, 'basket-egg-body', 'basket-egg-nest')
    const p = s.point('basket-quiet-medallion')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 40, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })

  it('saves only a nonempty explicitly submitted trimmed thanks once; a quiet finish ignores drafts', () => {
    const s = mount(2)
    s.write('  '); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.progress).toEqual([])
    s.write('  谢谢种粮的人  '); s.write('再次提交'); s.button.click()
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢种粮的人'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const quiet = mount(2)
    quiet.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的感谢'; tap(quiet); quiet.instance.dispose()
    expect(quiet.saveWish).not.toHaveBeenCalled(); expect(quiet.progress).toEqual([3])
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i silently and returning never mounts writing', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run(2)
      expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(enabled(s).map(e => e.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.button.hidden).toBe(at === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      if (returning && at === 2) { tap(s); expect(s.progress).toEqual([3]); expect(s.saveWish).not.toHaveBeenCalled() }
    }
  })

  it.each(['pointercancel', 'lostpointercapture'])('restores the food on %s, then accepts a fresh drag', event => {
    const s = mount(0, { isReducedMotion: () => true }), from = s.point('basket-bread-body'), to = s.point('basket-bread-rest')
    const original = s.scene.getObjectByName('basket-bread')!.position.clone()
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', beforeArrival(s, to)); pointer(s.hit, event, to); pointer(s.hit, 'pointerup', to)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('basket-bread')!.position.equals(original)).toBe(true)
    drag(s, 'basket-bread-body', 'basket-bread-rest'); expect(s.progress).toEqual([1])
  })

  it.each([true, false])('blocks mixed fingers across the page, outside first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), from = s.point('basket-bread-body'), to = s.point('basket-bread-rest')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', from, 1)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointerup', to, 1); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'basket-bread-body', 'basket-bread-rest'); expect(s.progress).toEqual([1])
  })

  it('blocks form and button while any pointer is down', () => {
    const s = mount(2)
    pointer(document.body, 'pointerdown', [1, 1]); s.write('谢谢'); s.button.click(); expect(s.progress).toEqual([])
    pointer(document.body, 'pointerup', [1, 1]); s.write('谢谢'); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledOnce()
  })

  it('pauses a dragged object and writer, clears cues on blur, and resumes without phantom input', () => {
    let active = true
    const s = mount(1, { isActive: () => active, isReducedMotion: () => true })
    const p = s.point('basket-egg-body'), to = s.point('basket-egg-nest')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', beforeArrival(s, to))
    active = false; s.run(); expect(enabled(s)).toEqual([]); expect(s.button.disabled).toBe(true)
    active = true; pointer(s.hit, 'pointerup', to); expect(s.progress).toEqual([])
    s.run(0.025); drag(s, 'basket-egg-body', 'basket-egg-nest'); expect(s.progress).toEqual([2])
    window.dispatchEvent(new Event('blur')); s.run(0.025)
    expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull(); expect(s.overlay.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
    s.write('暂停中'); s.button.click(); tap(s); expect(s.progress).toEqual([2]); expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(0.025); s.write('重新回来'); expect(s.progress).toEqual([2, 3])
  })

  it('freezes an in-flight placement while inactive, and restores only settled progress', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(0.1); const p = s.scene.getObjectByName('basket-bread')!.position.clone()
    active = false; s.run(2); expect(s.scene.getObjectByName('basket-bread')!.position.equals(p)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(2); expect(s.progress).toEqual([1]); s.run(2); expect(s.progress).toEqual([1])
  })

  it.each([320, 390, 1280])('keeps projected cue centers and all object frames on real geometry at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, {}, width, width === 1280 ? 600 : 560)
      for (const { object, cue } of enabled(s)) {
        const p = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(Math.abs(p.x)).toBeLessThan(0.95); expect(Math.abs(p.y)).toBeLessThan(0.95)
        expect(ray.intersectObject(object).length, object.name).toBeGreaterThan(0)
        const node = s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
        expect(Number(node.dataset.x)).toBeCloseTo((p.x + 1) * width / 2)
        expect(Number(node.dataset.y)).toBeCloseTo((1 - p.y) * s.height / 2)
        if (cue.destination instanceof THREE.Object3D) {
          const dest = cue.destination.getWorldPosition(new THREE.Vector3()).project(s.camera)
          ray.setFromCamera(new THREE.Vector2(dest.x, dest.y), s.camera)
          expect(ray.intersectObject(cue.destination).length, cue.destination.name).toBeGreaterThan(0)
          const target = s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
          expect(Number(target.dataset.x)).toBeCloseTo((dest.x + 1) * width / 2)
          expect(Number(target.dataset.y)).toBeCloseTo((1 - dest.y) * s.height / 2)
        }
      }
      for (const name of ['basket-bread', 'basket-egg', 'basket-woven', 'basket-table']) {
        const box = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const q = new THREE.Vector3(x, y, z).project(s.camera)
          expect(Math.abs(q.x), `${name} horizontal`).toBeLessThan(0.98); expect(Math.abs(q.y), `${name} vertical`).toBeLessThan(0.98)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width, width === 1280 ? 600 : 560)
    drag(s, 'basket-bread-body', 'basket-bread-rest'); drag(s, 'basket-egg-body', 'basket-egg-nest'); tap(s)
    expect(s.progress).toEqual([1, 2, 3])
  })

  it('has original weave, cloth, handle, bread scores, patterned egg and herbs, all grounded on a table', () => {
    const s = mount()
    for (const name of ['basket-weave', 'basket-cloth', 'basket-handle', 'basket-bread-scores', 'basket-egg-pattern', 'basket-spring-herbs']) expect(s.scene.getObjectByName(name), name).toBeDefined()
    expect(s.scene.getObjectByName('basket-weave')!.children.length).toBeGreaterThan(20)
    expect(s.scene.getObjectByName('basket-bread-scores')!.children.length).toBeGreaterThan(1)
    expect(s.overlay.querySelector('.scene-hint')?.textContent).toBe('为波兰圣周六的复活节食物篮做准备，把圆面包拖到篮内衬布上。')
  })

  it('fully releases geometry, materials, shadow targets, renderer, DOM and owned listeners once', () => {
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
    const registrations = [...added.mock.calls], p = s.point('basket-bread-body')
    s.instance.dispose(); s.instance.dispose(); s.button.click(); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); expect(s.progress).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), `owned ${type} listener`).toBe(true)
  })
})
