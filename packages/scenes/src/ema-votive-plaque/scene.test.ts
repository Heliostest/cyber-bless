// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Keep real geometry, raycasts, DOM, gestures and pointer ownership; replace only GPU rendering.
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(); camera.updateMatrixWorld() } }
  },
}))

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
})
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 360 }, clientHeight: { value: 360 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(0.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const point = (name: string): [number, number] => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [(p.x + 1) * 180, (1 - p.y) * 180]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += 0.025) instance.update(0.025) }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = text
    input.form!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  }
  return { instance, scene, camera, hit, button, overlay, progress, saveWish, complete, point, run, write }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 })
  el.dispatchEvent(event)
}
function touch(el: HTMLElement, [clientX, clientY]: [number, number]) {
  const event = new Event('touchstart', { cancelable: true })
  Object.assign(event, { changedTouches: [{ clientX, clientY }] }); el.dispatchEvent(event)
  return event.defaultPrevented
}

describe('ema plaque', () => {
  it.each([0, 1, 2, 3])('restores the current physical cue at checkpoint %i without inviting writing or completed actions', at => {
    let active = true
    const s = mount(at, { isActive: () => active })
    const body = s.scene.getObjectByName('ema-plaque-body')!
    const cues = body.userData.interactionCues as InteractionCue[] | undefined
    expect(cues).toHaveLength(3)
    const enabled = () => cues!.filter(cue => cue.enabled())
    expect(enabled().map(cue => cue.kind)).toEqual(at === 0 ? ['rotate'] : at === 2 ? ['drag'] : [])
    if (at === 2) expect(enabled()[0].destination).toBe(s.scene.getObjectByName('ema-hang-target'))
    active = false
    expect(enabled()).toEqual([])
  })

  it('acknowledges a returning plaque with a real body tap and no new writing', () => {
    let active = false
    const s = mount(1, { returning: true, isActive: () => active, isReducedMotion: () => true })
    const at = s.point('ema-plaque-body')
    pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    expect(s.progress).toEqual([])
    active = true
    const cues = s.scene.getObjectByName('ema-plaque-body')!.userData.interactionCues as InteractionCue[]
    expect(cues.filter(cue => cue.enabled()).map(cue => cue.kind)).toEqual(['tap'])
    pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    expect(s.progress).toEqual([2])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input')).toBeNull()
  })

  it('turns to the writing face, saves a trimmed wish once, and completes only after hanging', () => {
    const s = mount()
    s.button.click(); s.run()
    expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('ema-plaque')!.rotation.y).toBeCloseTo(Math.PI)
    s.write('   '); expect(s.progress).toEqual([1])
    s.write('  愿家人平安  '); s.write('愿家人平安')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿家人平安')
    expect(s.progress).toEqual([1, 2])
    s.button.click(); s.button.click()
    expect(s.complete).not.toHaveBeenCalled()
    s.run(2)
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
    expect(s.scene.getObjectByName('ema-plaque')!.position.y).toBeCloseTo(1.04)
    s.button.click(); s.run(); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('leaves the plaque blank without saving even when the input holds unsent words', () => {
    const s = mount(1, { isReducedMotion: () => true })
    s.overlay.querySelector<HTMLInputElement>('input')!.value = '还没有写好'
    s.button.click(); s.button.click()
    expect(s.progress).toEqual([2, 3])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.scene.getObjectByName('ema-written-lines')!.visible).toBe(false)
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i silently with the correct exposed face and placement', at => {
    const s = mount(at)
    s.run(2)
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(s.scene.getObjectByName('ema-plaque')!.rotation.y).toBeCloseTo(at === 0 ? 0 : Math.PI)
    expect(s.scene.getObjectByName('ema-plaque')!.position.y).toBeCloseTo(at === 3 ? 1.04 : 0.8)
    expect(Array.from(s.overlay.querySelectorAll<HTMLElement>('.scene-step-dot')).filter(dot => dot.dataset.state === 'done')).toHaveLength(at)
    expect(s.button.hidden).toBe(at === 3)
  })

  it('acknowledges a returning visit without opening or saving another wish', () => {
    const s = mount(0, { returning: true, isReducedMotion: () => true })
    s.button.click()
    expect(s.overlay.querySelector('input')).toBeNull()
    s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('has a solid roof-shaped body and real rope holes rather than painted dots', () => {
    const s = mount()
    const body = s.scene.getObjectByName('ema-plaque-body') as THREE.Mesh
    const local = new THREE.Mesh(body.geometry, body.material)
    local.updateMatrixWorld()
    const hits = (x: number, y: number) => new THREE.Raycaster(new THREE.Vector3(x, y, 1), new THREE.Vector3(0, 0, -1)).intersectObject(local).length
    expect(hits(0, 0)).toBeGreaterThan(0)
    expect(hits(-0.6, -0.3)).toBeGreaterThan(0)
    expect(hits(-0.6, 0.46)).toBe(0)
    expect(hits(-0.32, 0.28)).toBe(0)
    expect(hits(0.32, 0.28)).toBe(0)
  })

  it('turns only from a plaque-started horizontal drag and hangs from a real ray hit on the rack', () => {
    const s = mount(0, { isReducedMotion: () => true })
    const plaque = s.point('ema-plaque-body')
    expect(touch(s.hit, [4, 4])).toBe(false); expect(touch(s.hit, plaque)).toBe(true)
    pointer(s.hit, 'pointerdown', [4, 4]); pointer(s.hit, 'pointerup', [plaque[0] + 100, plaque[1]])
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', plaque); pointer(s.hit, 'pointermove', [plaque[0] + 100, plaque[1]])
    pointer(s.hit, 'pointerup', [plaque[0] + 100, plaque[1]])
    expect(s.progress).toEqual([1])
    s.button.click()
    const start = s.point('ema-plaque-body'), target = s.point('ema-hang-target')
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointermove', target); pointer(s.hit, 'pointerup', target)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each(['pointercancel', 'lostpointercapture'])('abandons %s before accepting a fresh drag', cancel => {
    const s = mount(2, { isReducedMotion: () => true })
    const start = s.point('ema-plaque-body'), target = s.point('ema-hang-target')
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointermove', target); pointer(s.hit, cancel, target)
    pointer(s.hit, 'pointerup', target)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', start, 2); pointer(s.hit, 'pointermove', target, 2); pointer(s.hit, 'pointerup', target, 2)
    expect(s.progress).toEqual([3])
  })

  it.each([false, true])('rejects mixed stage/page fingers when the outside finger starts first: %s', outsideFirst => {
    const s = mount(2, { isReducedMotion: () => true })
    const start = s.point('ema-plaque-body'), target = s.point('ema-hang-target')
    if (outsideFirst) pointer(document.body, 'pointerdown', [4, 4], 2)
    pointer(s.hit, 'pointerdown', start, 1)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [4, 4], 2)
    s.button.click(); pointer(s.hit, 'pointerup', target, 1); pointer(document.body, 'pointerup', [4, 4], 2)
    expect(s.progress).toEqual([])
    s.button.click(); expect(s.progress).toEqual([3])
  })

  it('blocks writing and the blank action while another pointer is still down', () => {
    const s = mount(1)
    pointer(document.body, 'pointerdown', [4, 4], 1)
    s.write('记得休息'); s.button.click()
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    pointer(document.body, 'pointerup', [4, 4], 1)
    s.write('记得休息'); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('记得休息')
  })

  it('cancels a paused drag and disables writing until the scene resumes', () => {
    let active = true
    const s = mount(0, { isActive: () => active, isReducedMotion: () => true })
    const start = s.point('ema-plaque-body'), end: [number, number] = [start[0] + 100, start[1]]
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointermove', end)
    active = false; s.run(0.1); active = true; pointer(s.hit, 'pointerup', end)
    expect(s.progress).toEqual([])
    s.button.click(); active = false; s.run(0.1)
    expect(s.overlay.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
    s.write('慢慢来'); s.button.click(); expect(s.progress).toEqual([1])
    active = true; s.run(0.025); s.write('慢慢来'); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('慢慢来')
  })

  it('pauses the hanging animation and resumes it without a second completion', () => {
    let active = true
    const s = mount(2, { isActive: () => active })
    s.button.click(); s.run(0.1)
    const y = s.scene.getObjectByName('ema-plaque')!.position.y
    active = false; s.run(2)
    expect(s.scene.getObjectByName('ema-plaque')!.position.y).toBe(y); expect(s.progress).toEqual([])
    active = true; s.run(2)
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('removes owned listeners and releases every geometry/material on disposal', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>()
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(material)
    })
    const freed = new Set<unknown>()
    resources.forEach(resource => resource.addEventListener('dispose', () => freed.add(resource)))
    const start = s.point('ema-plaque-body'), registrations = [...added.mock.calls]
    s.instance.dispose(); s.instance.dispose(); s.button.click()
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointerup', [start[0] + 100, start[1]]); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.overlay.childElementCount).toBe(0)
    expect(freed.size).toBe(resources.size)
    const capture = (options: boolean | EventListenerOptions | undefined) => typeof options === 'boolean' ? options : options?.capture ?? false
    for (const [type, listener, options] of registrations) {
      expect(removed.mock.calls.some(([removedType, removedListener, removedOptions]) =>
        removedType === type && removedListener === listener && capture(removedOptions) === capture(options)), `owned ${type} listener`).toBe(true)
    }
  })

  it('releases renderer-allocated directional shadow maps exactly once', () => {
    const s = mount()
    const freed: number[] = []
    s.scene.traverse(object => {
      if (!(object instanceof THREE.DirectionalLight)) return
      const map = new THREE.WebGLRenderTarget(8, 8)
      const index = freed.length; freed.push(0)
      map.addEventListener('dispose', () => { freed[index]++ })
      object.shadow.map = map
    })
    s.instance.dispose(); s.instance.dispose()
    expect(freed).toEqual([1, 1])
  })
})
