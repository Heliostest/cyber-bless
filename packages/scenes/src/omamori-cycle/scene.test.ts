// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only GPU rendering is replaced; object geometry, camera projection and DOM gestures remain real.
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { scene.updateMatrixWorld(); camera.updateMatrixWorld(); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 360, height = 360, left = 0, top = 0) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  const host = document.createElement('div'); host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), variant = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, onVariantChange: variant, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(0.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += 0.025) instance.update(0.025) }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = text; input.form!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  }
  return { instance, scene, camera, hit, button, overlay, host, progress, saveWish, complete, variant, point, run, write, width, height }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}
function tap(s: ReturnType<typeof mount>, name: string) { const p = s.point(name); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p) }
function drag(s: ReturnType<typeof mount>, name: string, target: string) {
  const from = s.point(name), to = s.point(target)
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run()
}
function enabled(s: ReturnType<typeof mount>) {
  const result: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) result.push({ object, cue }) })
  return result
}

describe('omamori companion', () => {
  it('provides the complete auxiliary selection, placement and quiet acknowledgment flow', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.button.click(); s.button.click(); s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('selects a real colored pouch, drags it to the physical clasp, then taps it to finish', () => {
    const s = mount(0, { isReducedMotion: () => true })
    tap(s, 'omamori-pouch-body-sage')
    expect(s.progress).toEqual([1]); expect(s.variant).toHaveBeenCalledExactlyOnceWith('sage')
    drag(s, 'omamori-pouch-body-sage', 'omamori-clasp')
    expect(s.progress).toEqual([1, 2]); expect(s.complete).not.toHaveBeenCalled()
    tap(s, 'omamori-pouch-body-sage'); tap(s, 'omamori-pouch-body-sage')
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('never accepts off-object starts, wrong pouch sources or off-target releases', () => {
    const s = mount(0, { isReducedMotion: () => true })
    pointer(s.hit, 'pointerdown', [3, 3]); pointer(s.hit, 'pointerup', s.point('omamori-pouch-body-coral'))
    expect(s.progress).toEqual([])
    tap(s, 'omamori-pouch-body-coral')
    drag(s, 'omamori-pouch-body-sage', 'omamori-clasp'); expect(s.progress).toEqual([1])
    const from = s.point('omamori-pouch-body-coral')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', [3, 3]); pointer(s.hit, 'pointerup', [3, 3])
    expect(s.progress).toEqual([1])
    drag(s, 'omamori-pouch-body-coral', 'omamori-clasp'); expect(s.progress).toEqual([1, 2])
    pointer(s.hit, 'pointerdown', [3, 3]); pointer(s.hit, 'pointerup', s.point('omamori-pouch-body-coral'))
    expect(s.progress).toEqual([1, 2])
  })

  it('saves only an explicitly submitted nonempty trimmed wish, once', () => {
    const s = mount(2, { isReducedMotion: () => true })
    s.write('  '); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.write('  一路平安  '); s.write('再次提交'); s.button.click()
    expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('一路平安'); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('does not save an unsent draft when finishing on the pouch or leaving the scene', () => {
    const s = mount(2, { isReducedMotion: () => true })
    s.overlay.querySelector<HTMLInputElement>('input')!.value = '尚未提交'
    tap(s, 'omamori-pouch-body-coral'); s.instance.dispose()
    expect(s.saveWish).not.toHaveBeenCalled(); expect(s.progress).toEqual([3])
    const draft = mount(2); draft.overlay.querySelector<HTMLInputElement>('input')!.value = '保留在输入框'
    draft.instance.dispose(); expect(draft.saveWish).not.toHaveBeenCalled(); expect(draft.progress).toEqual([])
  })

  it.each([0, 1, 2, 3])('silently restores checkpoint %i and the selected closed pouch variant', at => {
    const s = mount(at, { initialVariant: 'indigo' }); s.run(2)
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.variant).not.toHaveBeenCalled()
    const cues = enabled(s)
    expect(cues.map(e => e.cue.kind)).toEqual(at === 0 ? ['tap', 'tap', 'tap'] : at === 1 ? ['drag'] : at === 2 ? ['tap'] : [])
    if (at === 0) expect(cues.filter(e => !e.cue.compact).map(e => e.object.name)).toEqual(['omamori-pouch-body-indigo'])
    if (at === 1) { expect(cues[0].object.name).toBe('omamori-pouch-body-indigo'); expect(cues[0].cue.destination).toBe(s.scene.getObjectByName('omamori-clasp')) }
    expect(s.button.hidden).toBe(at === 3)
    expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(at !== 2)
    expect(Array.from(s.overlay.querySelectorAll<HTMLElement>('.scene-step-dot')).filter(dot => dot.dataset.state === 'done')).toHaveLength(at)
    const pouch = s.scene.getObjectByName('omamori-pouch-indigo')!
    expect(pouch.position.x).toBeCloseTo(at >= 2 ? 0.58 : at === 1 ? -0.62 : 0.14)
  })

  it('falls back safely from an unrecognized persisted variant without reporting a new choice', () => {
    const s = mount(1, { initialVariant: '<unknown>' })
    expect(enabled(s)[0].object.name).toBe('omamori-pouch-body-coral'); expect(s.variant).not.toHaveBeenCalled()
  })

  it.each(['omamori-return-box-body', 'omamori-pouch-body-indigo'])('returns the chosen pouch to a real box and acknowledges %s without new writing', finish => {
    const s = mount(0, { returning: true, initialVariant: 'indigo', isReducedMotion: () => true })
    expect(s.overlay.querySelector('input')).toBeNull()
    tap(s, 'omamori-pouch-body-indigo')
    expect(enabled(s)[0].cue.destination).toBe(s.scene.getObjectByName('omamori-return-slot'))
    drag(s, 'omamori-pouch-body-indigo', 'omamori-return-slot')
    expect(s.progress).toEqual([1, 2]); expect(s.complete).not.toHaveBeenCalled()
    tap(s, finish); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('accepts the displayed return target center on a shifted 348 by 410 phone canvas', () => {
    const s = mount(1, { returning: true, isReducedMotion: () => true }, 348, 410, 21, 265)
    const from = s.point('omamori-pouch-body-coral', [0, 0, 0.1]), to = s.point('omamori-return-slot')
    pointer(s.hit, 'pointerdown', from)
    for (let i = 1; i <= 18; i++) pointer(s.hit, 'pointermove', [from[0] + (to[0] - from[0]) * i / 18, from[1] + (to[1] - from[1]) * i / 18])
    pointer(s.hit, 'pointerup', to)
    expect(s.progress).toEqual([2])
  })

  it.each([0, 1, 2, 3])('silently restores a returning checkpoint %i without mounting a wish form', at => {
    const s = mount(at, { returning: true, initialVariant: 'sage' }); s.run(2)
    expect(s.overlay.querySelector('input')).toBeNull(); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(enabled(s).map(e => e.cue.kind)).toEqual(at === 0 ? ['tap', 'tap', 'tap'] : at === 1 ? ['drag'] : at === 2 ? ['tap', 'tap'] : [])
  })

  it.each(['pointercancel', 'lostpointercapture'])('abandons %s and requires a fresh owned drag', cancel => {
    const s = mount(1, { isReducedMotion: () => true })
    const from = s.point('omamori-pouch-body-coral'), to = s.point('omamori-clasp')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, cancel, to); pointer(s.hit, 'pointerup', to)
    expect(s.progress).toEqual([])
    drag(s, 'omamori-pouch-body-coral', 'omamori-clasp'); expect(s.progress).toEqual([2])
  })

  it('rejects an unmatched release and mixed fingers across the stage and page', () => {
    const s = mount(1, { isReducedMotion: () => true })
    const from = s.point('omamori-pouch-body-coral'), to = s.point('omamori-clasp')
    pointer(s.hit, 'pointerdown', from, 1); pointer(s.hit, 'pointerup', to, 2); s.button.click(); expect(s.progress).toEqual([])
    pointer(document.body, 'pointerdown', [3, 3], 2); pointer(s.hit, 'pointerup', to, 1); pointer(document.body, 'pointerup', [3, 3], 2)
    expect(s.progress).toEqual([])
    drag(s, 'omamori-pouch-body-coral', 'omamori-clasp'); expect(s.progress).toEqual([2])
  })

  it.each([false, true])('blocks mixed fingers when the page finger starts first: %s', outsideFirst => {
    const s = mount(1, { isReducedMotion: () => true })
    const from = s.point('omamori-pouch-body-coral'), to = s.point('omamori-clasp')
    if (outsideFirst) pointer(document.body, 'pointerdown', [3, 3], 2)
    pointer(s.hit, 'pointerdown', from, 1)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [3, 3], 2)
    s.button.click(); pointer(s.hit, 'pointerup', to, 1); pointer(document.body, 'pointerup', [3, 3], 2)
    expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([2])
  })

  it('blocks wish submission and button completion while a pointer is down', () => {
    const s = mount(2)
    pointer(document.body, 'pointerdown', [3, 3]); s.write('记得休息'); s.button.click()
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    pointer(document.body, 'pointerup', [3, 3]); s.write('记得休息')
    expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('记得休息')
  })

  it('clears a paused drag before update and suppresses cues and writing until resume', () => {
    let active = true
    const s = mount(1, { isActive: () => active, isReducedMotion: () => true })
    const from = s.point('omamori-pouch-body-coral'), to = s.point('omamori-clasp')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to)
    active = false; s.run(); expect(enabled(s)).toEqual([])
    active = true; pointer(s.hit, 'pointerup', to); expect(s.progress).toEqual([])
    s.button.click(); active = false; s.run(); s.write('慢慢来'); s.button.click()
    expect(s.overlay.querySelector<HTMLInputElement>('input')!.disabled).toBe(true); expect(s.progress).toEqual([2])
    active = true; s.run(0.025); s.write('慢慢来'); expect(s.progress).toEqual([2, 3])
  })

  it('removes rendered object hints on blur and leaves them hidden until focus returns', () => {
    const s = mount(2)
    const sources = () => s.host.querySelectorAll('[data-cue-role="source"]').length
    expect(sources()).toBe(1)
    window.dispatchEvent(new Event('blur')); s.run(0.025)
    expect(sources()).toBe(0)
    s.button.click(); tap(s, 'omamori-pouch-body-coral'); s.write('尚未恢复焦点'); s.run(1)
    expect(sources()).toBe(0); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(0.025)
    expect(sources()).toBe(1)
    tap(s, 'omamori-pouch-body-coral'); expect(s.progress).toEqual([3])
  })

  it('pauses the placement animation and resumes without duplicate progress', () => {
    let active = true
    const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(0.1); expect(enabled(s)).toEqual([])
    const p = s.scene.getObjectByName('omamori-pouch-coral')!.position.clone()
    active = false; s.run(2); expect(s.scene.getObjectByName('omamori-pouch-coral')!.position.equals(p)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(2); expect(s.progress).toEqual([2]); s.button.click(); expect(s.progress).toEqual([2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('uses solid, fully closed brocade pouch bodies with no interior opening', () => {
    const s = mount()
    for (const name of ['coral', 'sage', 'indigo']) {
      const body = s.scene.getObjectByName(`omamori-pouch-body-${name}`) as THREE.Mesh
      const local = new THREE.Mesh(body.geometry, body.material); local.updateMatrixWorld()
      const from = new THREE.Raycaster(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1))
      const top = new THREE.Raycaster(new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0))
      expect(from.intersectObject(local).length).toBeGreaterThan(0); expect(top.intersectObject(local).length).toBeGreaterThan(0)
      expect(s.scene.getObjectByName(`omamori-knot-${name}`)).toBeDefined()
    }
  })

  it.each([320, 390, 1280])('projects every enabled source and destination onto its own real geometry at width %i', width => {
    for (const returning of [false, true]) for (const at of [0, 1, 2]) {
      const s = mount(at, { returning }, width, width === 1280 ? 600 : 560)
      for (const { object, cue } of enabled(s)) {
        const anchor = new THREE.Vector3(...(cue.anchor ?? [0, 0, 0])); object.localToWorld(anchor)
        const ndc = anchor.project(s.camera)
        expect(Math.abs(ndc.x)).toBeLessThan(0.95); expect(Math.abs(ndc.y)).toBeLessThan(0.95)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(ndc.x, ndc.y), s.camera)
        expect(ray.intersectObject(object).length, object.name).toBeGreaterThan(0)
        if (cue.destination instanceof THREE.Object3D) {
          const dest = cue.destination.getWorldPosition(new THREE.Vector3()).project(s.camera)
          expect(Math.abs(dest.x)).toBeLessThan(0.95); expect(Math.abs(dest.y)).toBeLessThan(0.95)
          ray.setFromCamera(new THREE.Vector2(dest.x, dest.y), s.camera)
          expect(ray.intersectObject(cue.destination).length, cue.destination.name).toBeGreaterThan(0)
        }
      }
    }
  })

  it('disposes all geometry, materials, shadows and owned listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), resources = new Set<THREE.BufferGeometry | THREE.Material>()
    const shadows: number[] = []
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(material)
      if (object instanceof THREE.DirectionalLight) {
        const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8)
        object.shadow.map.addEventListener('dispose', () => { shadows[i]++ })
      }
    })
    const freed = new Set<unknown>(); resources.forEach(resource => resource.addEventListener('dispose', () => freed.add(resource)))
    const p = s.point('omamori-pouch-body-coral'), registrations = [...added.mock.calls]
    s.instance.dispose(); s.instance.dispose(); s.button.click(); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
    expect(freed.size).toBe(resources.size); expect(shadows).toEqual([1, 1]); expect(s.overlay.childElementCount).toBe(0); expect(s.progress).toEqual([])
    const capture = (options: boolean | EventListenerOptions | undefined) => typeof options === 'boolean' ? options : options?.capture ?? false
    for (const [type, listener, options] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(options)), `owned ${type} listener`).toBe(true)
  })
})
