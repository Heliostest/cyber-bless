// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Only GPU rendering is unavailable in jsdom. Geometry, rays and pointer ownership are real.
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0; toneMappingExposure = 1; outputColorSpace = ''
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    drawn.scene = scene; drawn.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))
import { createShrineSuzuBell } from './scene'

const live: ReturnType<typeof createShrineSuzuBell>[] = []
beforeEach(() => { drawn.scene = drawn.camera = null })
afterEach(() => { live.forEach(s => s.dispose()); live.length = 0; document.body.replaceChildren(); vi.restoreAllMocks() })
type Point = [number, number]
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], complete = vi.fn(), saveWish = vi.fn(), haptic = vi.fn(), prepareFeedback = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createShrineSuzuBell({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, prepareFeedback, isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start()
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  const run = (seconds = 1.2) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
  run(0.05)
  const object = (name: string) => drawn.scene!.getObjectByName(name)!
  const point = (name: string): Point => {
    drawn.scene!.updateMatrixWorld(true); drawn.camera!.updateMatrixWorld(true)
    const p = object(name).getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
    return [(p.x + 1) * width / 2, (1 - p.y) * 260]
  }
  return { canvas, overlay, instance, button, hit, run, object, point, progress, complete, saveWish, haptic, prepareFeedback }
}
type Mounted = ReturnType<typeof mount>
function pointer(target: EventTarget, type: string, [x, y]: Point, pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId, pointerType: 'touch', button: 0, isPrimary: true })
  target.dispatchEvent(e)
}
function pull(s: Mounted, finish = 'pointerup', offset: Point = [0, 70]) {
  const from = s.point('suzu-rope-grip'), to: Point = [from[0] + offset[0], from[1] + offset[1]]
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, finish, to); s.run()
}
function tap(s: Mounted, name: string, finish = 'pointerup') {
  const p = s.point(name); pointer(s.hit, 'pointerdown', p); pointer(s.hit, finish, p); s.run()
}
function cues(_s: Mounted) {
  const all: InteractionCue[] = []
  drawn.scene!.traverse(o => all.push(...(o.userData.interactionCues ?? [])))
  return all.filter(cue => cue.enabled())
}

describe('shrine suzu object actions', () => {
  it('creates an accessible auxiliary action for pulling the actual rope', () => {
    const s = mount()
    expect(s.button).not.toBeNull()
    expect(s.button.getAttribute('aria-label')).toBe('向下轻拉铃绳')
  })

  it.each([320, 390, 1280])('pulls, settles and greets through physical geometry at %ipx', width => {
    const s = mount(0, {}, width)
    for (const [name, kind] of [['suzu-rope-grip', 'drag'], ['suzu-rope-grip', 'tap'], ['suzu-bell-body', 'tap']] as const) {
      expect(cues(s).map(c => c.kind)).toEqual([kind])
      const box = new THREE.Box3().setFromObject(s.object(name))
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(drawn.camera!)
        expect(Math.abs(p.x)).toBeLessThan(0.98); expect(Math.abs(p.y)).toBeLessThan(0.98)
      }
      if (kind === 'drag') {
        const destination = cues(s)[0].destination as THREE.Object3D
        expect(destination).toBe(s.object('suzu-pull-target'))
        const targetBox = new THREE.Box3().setFromObject(destination)
        for (const x of [targetBox.min.x, targetBox.max.x]) for (const y of [targetBox.min.y, targetBox.max.y]) for (const z of [targetBox.min.z, targetBox.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(drawn.camera!)
          expect(Math.abs(p.x)).toBeLessThan(0.98); expect(Math.abs(p.y)).toBeLessThan(0.98)
        }
        const to = s.point(destination.name), from = s.point(name)
        expect(to[1] - from[1]).toBeGreaterThan(45)
        expect(to[0]).toBeGreaterThan(0); expect(to[0]).toBeLessThan(width)
        expect(to[1]).toBeLessThan(520)
        pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run()
      } else tap(s, name)
    }
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(cues(s)).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('uses the same three actions from the auxiliary button and rings only once', () => {
    const s = mount()
    for (const label of ['向下轻拉铃绳', '轻收铃绳', '轻点铃身问安']) {
      expect(s.button.textContent).toBe(label)
      s.button.click(); s.button.click(); s.run()
    }
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.haptic).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('form')).toBeNull(); expect(s.button.hidden).toBe(true)
    s.button.click(); s.run(3)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('holds the rope gently after one ring and returns its geometry to rest on the next tap', () => {
    const s = mount(), rope = s.object('suzu-braided-rope')
    expect(rope.scale.y).toBe(1)
    pull(s)
    expect(rope.scale.y).toBeGreaterThan(1)
    expect(s.haptic).toHaveBeenCalledOnce()
    tap(s, 'suzu-rope-grip')
    expect(rope.scale.y).toBe(1)
    expect(s.object('suzu-hanging-object').rotation.z).toBe(0)
    expect(s.haptic).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i silently with only its current object cue', initial => {
    let active = true
    const s = mount(initial, { isActive: () => active })
    s.run(3)
    expect(s.overlay.querySelectorAll('[data-state="done"]')).toHaveLength(initial)
    expect(cues(s).map(c => c.kind)).toEqual(initial === 0 ? ['drag'] : initial < 3 ? ['tap'] : [])
    expect(s.button.hidden).toBe(initial === 3)
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.prepareFeedback).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    active = false; s.run(0.05)
    expect(cues(s)).toEqual([]); s.button.click(); expect(s.progress).toEqual([])
  })

  it('keeps the reduced-motion scene static and usable across all actions', () => {
    const s = mount(0, { isReducedMotion: () => true })
    pull(s); expect(s.progress).toEqual([1])
    tap(s, 'suzu-rope-grip'); expect(s.progress).toEqual([1, 2])
    tap(s, 'suzu-bell-body'); expect(s.progress).toEqual([1, 2, 3])
    const pose = s.object('suzu-hanging-object').matrix.clone()
    s.run(5); expect(s.object('suzu-hanging-object').matrix.equals(pose)).toBe(true)
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('lets empty canvas scroll and rejects off-rope starts, upward, sideways and short pulls', () => {
    const s = mount()
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(e); return e.defaultPrevented
    }
    expect(touch([3, 3])).toBe(false); expect(touch(s.point('suzu-rope-grip'))).toBe(true)
    pointer(s.hit, 'pointerdown', [3, 3]); pointer(s.hit, 'pointerup', s.point('suzu-pull-target'))
    pull(s, 'pointerup', [0, -80]); pull(s, 'pointerup', [90, 50]); pull(s, 'pointerup', [0, 44])
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    pull(s); expect(s.progress).toEqual([1])
  })

  it.each([1, 2])('requires the actual source and a small tap at checkpoint %i', initial => {
    const s = mount(initial), correct = initial === 1 ? 'suzu-rope-grip' : 'suzu-bell-body'
    tap(s, initial === 1 ? 'suzu-bell-body' : 'suzu-rope-grip')
    const p = s.point(correct)
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', [3, 3]); s.run()
    expect(s.progress).toEqual([])
    tap(s, correct); expect(s.progress).toEqual([initial + 1])
  })

  it.each(['pointercancel', 'lostpointercapture'])('rejects %s and recovers with a fresh pull', finish => {
    const s = mount()
    pull(s, finish); pointer(s.hit, 'pointerup', s.point('suzu-pull-target')); s.run()
    expect(s.progress).toEqual([]); pull(s); expect(s.progress).toEqual([1])
  })

  it.each([1, 2])('cancels a checkpoint %i tap and accepts only a fresh tap', initial => {
    const s = mount(initial), name = initial === 1 ? 'suzu-rope-grip' : 'suzu-bell-body'
    tap(s, name, 'pointercancel'); pointer(s.hit, 'pointerup', s.point(name)); s.run()
    expect(s.progress).toEqual([])
    tap(s, name); expect(s.progress).toEqual([initial + 1])
  })

  it('ignores wrong pointer IDs without letting them move or finish the rope', () => {
    const s = mount(), from = s.point('suzu-rope-grip'), to: Point = [from[0], from[1] + 70]
    pointer(s.hit, 'pointerdown', from, 1); pointer(s.hit, 'pointermove', to, 2); pointer(s.hit, 'pointerup', to, 2)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointercancel', from, 1); pull(s); expect(s.progress).toEqual([1])
  })

  it.each(['outside-first', 'outside-second', 'object-second'])('rejects %s multiple pointers and busy auxiliary actions', order => {
    const s = mount(), from = s.point('suzu-rope-grip'), to: Point = [from[0], from[1] + 70]
    if (order === 'outside-first') pointer(document.body, 'pointerdown', [3, 3], 2)
    pointer(s.hit, 'pointerdown', from, 1)
    if (order === 'outside-second') pointer(document.body, 'pointerdown', [3, 3], 2)
    if (order === 'object-second') pointer(s.hit, 'pointerdown', from, 2)
    s.button.click(); pointer(s.hit, 'pointermove', to, 1); pointer(s.hit, 'pointerup', to, 1)
    pointer(document.body, 'pointerup', [3, 3], 2); s.run()
    expect(s.progress).toEqual([]); pull(s); expect(s.progress).toEqual([1])
  })

  it('blocks the auxiliary button during an owned single pointer', () => {
    const s = mount(), from = s.point('suzu-rope-grip')
    pointer(s.hit, 'pointerdown', from); s.button.click(); pointer(s.hit, 'pointercancel', from); s.run()
    expect(s.progress).toEqual([]); s.button.click(); s.run(); expect(s.progress).toEqual([1])
  })

  it.each(['pause', 'blur'])('drops an old release across %s and permits a fresh gesture', reason => {
    let active = true
    const s = mount(0, { isActive: () => active }), from = s.point('suzu-rope-grip'), to: Point = [from[0], from[1] + 70]
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to)
    if (reason === 'pause') { active = false; s.run(0.05) } else window.dispatchEvent(new Event('blur'))
    expect(cues(s)).toEqual([])
    active = true; window.dispatchEvent(new Event('focus')); pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([]); pull(s); expect(s.progress).toEqual([1])
  })

  it('hides animation cues and freezes accepted motion while paused', () => {
    let active = true
    const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(0.1); expect(cues(s)).toEqual([])
    const pose = s.object('suzu-hanging-object').matrix.clone()
    active = false; s.run(2)
    expect(s.object('suzu-hanging-object').matrix.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([2])
  })

  it.each([0, 1, 2])('suppresses sources and auxiliary clicks while checkpoint %i motion settles', initial => {
    const s = mount(initial)
    s.button.click()
    expect(cues(s)).toEqual([])
    const pending = [...s.progress]
    const source = s.point(initial === 2 ? 'suzu-bell-body' : 'suzu-rope-grip')
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointerup', source)
    s.button.click()
    expect(s.progress).toEqual(pending)
    s.run()
    expect(s.progress).toEqual(initial === 0 ? [1] : [initial + 1])
    expect(pending).toEqual(initial === 0 ? [1] : [])
  })

  it('disposes all owned geometry, materials, lights and listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), from = s.point('suzu-rope-grip'), resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      for (const mat of mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []) resources.add(mat)
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
      if ((o as THREE.DirectionalLight).shadow) resources.add((o as THREE.DirectionalLight).shadow)
    })
    const freed = [...resources].map(r => vi.spyOn(r, 'dispose')), registrations = [...added.mock.calls]
    s.instance.dispose(); s.instance.dispose(); freed.forEach(spy => expect(spy).toHaveBeenCalledOnce())
    for (const [type, fn, options] of registrations) expect(removed.mock.calls.some(call => call[0] === type && call[1] === fn && call[2] === options)).toBe(true)
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointerup', [from[0], from[1] + 70]); s.button.click(); s.run()
    expect(s.progress).toEqual([]); expect(s.overlay.childElementCount).toBe(0)
  })
})
