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
  it('keeps the bell eye fixed at its suspension through pulling, ringing and settling', () => {
    const s = mount(), bell = s.object('suzu-round-split-bell'), pin = new THREE.Vector3(0, 2.48, .11)
    const bodyHome = bell.getWorldPosition(new THREE.Vector3()); let movement = 0
    for (let step = 0; step < 3; step++) {
      s.button.click()
      for (let frame = 0; frame < 60; frame++) {
        s.instance.update(.025); drawn.scene!.updateMatrixWorld(true)
        expect(bell.localToWorld(new THREE.Vector3(0, .31, 0)).distanceTo(pin)).toBeLessThan(1e-8)
        movement = Math.max(movement, bell.getWorldPosition(new THREE.Vector3()).distanceTo(bodyHome))
      }
    }
    expect(movement).toBeGreaterThan(.01); expect(s.progress).toEqual([1, 2, 3])
  })

  it('keeps the stretched rope attached to the bottom of the bell', () => {
    const s = mount(), rope = s.object('suzu-braided-rope'), bell = s.object('suzu-round-split-bell')
    s.button.click()
    for (let frame = 0; frame < 60; frame++) {
      s.instance.update(.025); drawn.scene!.updateMatrixWorld(true)
      const top = new THREE.Vector3(0, -.265, 0)
      expect(rope.localToWorld(top.clone()).distanceTo(bell.localToWorld(top.clone()))).toBeLessThan(1e-8)
    }
  })

  it('answers a pull with a visible swing, pellet rattle and warm swell on the bell, then rests exactly', () => {
    const s = mount(), pivot = s.object('suzu-suspension-pivot')
    const body = s.object('suzu-bell-body') as THREE.Mesh, metal = body.material as THREE.MeshStandardMaterial
    const base = metal.emissiveIntensity
    const from = s.point('suzu-rope-grip')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', [from[0], from[1] + 70]); pointer(s.hit, 'pointerup', [from[0], from[1] + 70])
    let swing = 0, rattle = 0, swell = 0
    for (let frame = 0; frame < 40; frame++) {
      s.instance.update(0.025)
      swing = Math.max(swing, Math.abs(pivot.rotation.z - 0.32 * 0.038)); rattle = Math.max(rattle, Math.abs(pivot.rotation.x))
      swell = Math.max(swell, metal.emissiveIntensity - base)
    }
    expect(swing).toBeGreaterThan(0.05); expect(rattle).toBeGreaterThan(0.015); expect(swell).toBeGreaterThan(0.15)
    expect(s.progress).toEqual([1]); expect(s.haptic).toHaveBeenCalledOnce()
    s.run(1.5)
    expect(pivot.rotation.x).toBe(0); expect(metal.emissiveIntensity).toBe(base)
    tap(s, 'suzu-rope-grip'); s.run(1.5)
    expect(pivot.rotation.z).toBe(0)
    // A greeting tap answers on the bell with a swell, not a second ring.
    const at = s.point('suzu-bell-body'); pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    for (let frame = 0; frame < 3; frame++) s.instance.update(0.05)
    expect(metal.emissiveIntensity).toBeGreaterThan(base + 0.2)
    s.run(1); expect(metal.emissiveIntensity).toBe(base); expect(s.haptic).toHaveBeenCalledOnce()
  })

  it('keeps the bell still and unlit by motion with reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true }), pivot = s.object('suzu-suspension-pivot')
    const metal = (s.object('suzu-bell-body') as THREE.Mesh).material as THREE.MeshStandardMaterial, base = metal.emissiveIntensity
    pull(s)
    expect(s.progress).toEqual([1]); expect(pivot.rotation.x).toBe(0); expect(pivot.rotation.z).toBe(0)
    expect(metal.emissiveIntensity).toBe(base)
  })

  it('lets the bell follow a sideways drift while pulling and restores it after a short pull', () => {
    const s = mount(), pivot = s.object('suzu-suspension-pivot'), from = s.point('suzu-rope-grip')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', [from[0] + 40, from[1] + 20])
    expect(pivot.rotation.z).toBeGreaterThan(0.05)
    pointer(s.hit, 'pointerup', [from[0] + 40, from[1] + 20]); s.run()
    expect(s.progress).toEqual([]); expect(pivot.rotation.z).toBe(0)
  })

  it('hangs a larger bell and a thicker rope that read on a phone stage', () => {
    const s = mount(), size = (name: string) => {
      const box = new THREE.Box3().setFromObject(s.object(name)), xs: number[] = [], ys: number[] = []
      for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(drawn.camera!); xs.push((p.x + 1) * 195); ys.push((1 - p.y) * 260)
      }
      return [Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)]
    }
    expect(s.object('suzu-hanging-object').scale.x).toBeGreaterThan(1.1)
    expect(size('suzu-bell-body')[0]).toBeGreaterThan(80)
    expect(size('suzu-rope-grip')[0]).toBeGreaterThan(30)
  })

  it('aligns vertical wood grain on the rope grip and posts, and differentiates timber across left/right posts, bases, lintel and grip', () => {
    const s = mount()
    const surface = (name: string) => ((s.object(name) as THREE.Mesh).material as THREE.Material).userData.craftSurface
    expect(surface('suzu-rope-grip')).toMatchObject({ kind: 'wood', axis: 'y' })
    expect(surface('suzu-column-post')).toMatchObject({ kind: 'wood', axis: 'y' })
    expect(surface('suzu-lintel')).toMatchObject({ kind: 'wood', axis: 'x' })
    expect(surface('suzu-column-base')).toMatchObject({ kind: 'wood', axis: 'x' })
    expect(surface('suzu-column-capital')).toMatchObject({ kind: 'wood', axis: 'x' })
    expect(surface('suzu-eave-cap')).toMatchObject({ kind: 'wood', axis: 'x' })
    const posts: THREE.Mesh[] = [], bases: THREE.Mesh[] = [], capitals: THREE.Mesh[] = []
    drawn.scene!.traverse(o => {
      if (o.name === 'suzu-column-post') posts.push(o as THREE.Mesh)
      if (o.name === 'suzu-column-base') bases.push(o as THREE.Mesh)
      if (o.name === 'suzu-column-capital') capitals.push(o as THREE.Mesh)
    })
    expect(posts).toHaveLength(2); expect(posts[0]!.material).not.toBe(posts[1]!.material)
    expect(bases).toHaveLength(2); expect(bases[0]!.material).not.toBe(bases[1]!.material)
    expect(capitals).toHaveLength(2); expect(capitals[0]!.material).not.toBe(capitals[1]!.material)
    expect(((s.object('suzu-lintel') as THREE.Mesh).material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture)
    expect(((s.object('suzu-rope-grip') as THREE.Mesh).material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture)
  })

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
      expect(s.button.getAttribute('aria-label')).toBe(label)
      s.button.click(); s.button.click(); s.run()
    }
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.haptic).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('form')).toBeNull(); expect(s.button.hidden).toBe(true)
    s.button.click(); s.run(3)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('holds the rope gently after one ring and returns its geometry to rest on the next tap', () => {
    const s = mount(), grip = s.object('suzu-rope-grip')
    const restGripY = grip.getWorldPosition(new THREE.Vector3()).y
    expect(grip.scale.toArray()).toEqual([1, 1, 1])
    pull(s)
    const heldGripY = grip.getWorldPosition(new THREE.Vector3()).y
    expect(heldGripY).toBeLessThan(restGripY - 0.025)
    expect(grip.scale.toArray()).toEqual([1, 1, 1])
    expect(s.haptic).toHaveBeenCalledOnce()
    tap(s, 'suzu-rope-grip')
    expect(grip.getWorldPosition(new THREE.Vector3()).y).toBeCloseTo(restGripY, 5)
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

  it('rejects off-rope starts, upward, sideways and short pulls', () => {
    const s = mount()
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(e); return e.defaultPrevented
    }
    // Canvas scrolling is controlled by the host CSS, separately from this hit test.
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
      for (const mat of mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []) {
        resources.add(mat)
        const map = o.userData?.effect ? null : (mat as THREE.MeshStandardMaterial).map
        if (map) resources.add(map)
      }
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
      if ((o as THREE.DirectionalLight).shadow) resources.add((o as THREE.DirectionalLight).shadow)
    })
    const freed = [...resources].map(r => vi.spyOn(r, 'dispose')), registrations = [...added.mock.calls]
    s.instance.dispose(); s.instance.dispose(); freed.forEach(spy => expect(spy).toHaveBeenCalledOnce())
    for (const [type, fn, options] of registrations) expect(removed.mock.calls.some(call => call[0] === type && call[1] === fn && call[2] === options)).toBe(true)
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointerup', [from[0], from[1] + 70]); s.button.click(); s.run()
    expect(s.progress).toEqual([]); expect(s.overlay.childElementCount).toBe(0)
  })

  it('never loads Rapier WASM on construction or in pure reduced motion, and stays bit-for-bit still', async () => {
    const { isRapierLoaded, _resetRapierLoaderForTest } = await import('@wbr/scene-runtime/rapier-soft-body')
    _resetRapierLoaderForTest()
    const canvas = document.createElement('canvas'), overlay = document.createElement('div')
    document.body.append(canvas, overlay)
    Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 520 } })
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 520, right: 390, bottom: 520 }) as DOMRect
    const unstarted = createShrineSuzuBell({ canvas, overlay, gestures: Gestures, shared: Shared, isSoundEnabled: () => false })
    expect(isRapierLoaded()).toBe(false)
    unstarted.dispose()

    const quiet = mount(0, { isReducedMotion: () => true })
    const strand = quiet.object('suzu-braid-strand-0') as THREE.Mesh
    const tassel0 = quiet.object('suzu-tassel-strand-0') as THREE.Mesh
    const s0 = Array.from(strand.geometry.getAttribute('position').array)
    const t0 = Array.from(tassel0.geometry.getAttribute('position').array)
    quiet.run(1.0)
    expect(isRapierLoaded()).toBe(false)
    expect(Array.from(strand.geometry.getAttribute('position').array)).toEqual(s0)
    expect(Array.from(tassel0.geometry.getAttribute('position').array)).toEqual(t0)
    expect(s0.every(Number.isFinite)).toBe(true)
    expect(t0.every(Number.isFinite)).toBe(true)
  })

  it('flexes the 3-strand cotton braid and tassel with lazy Rapier physics during ring while preserving bell attachment, pause and reduced stillness', async () => {
    const { loadRapier } = await import('@wbr/scene-runtime/rapier-soft-body')
    await loadRapier()
    let isActive = true
    let isReduced = false
    const s = mount(0, { isActive: () => isActive, isReducedMotion: () => isReduced })
    const strand0 = s.object('suzu-braid-strand-0') as THREE.Mesh
    const tassel0 = s.object('suzu-tassel-strand-0') as THREE.Mesh
    const bell = s.object('suzu-round-split-bell')
    const rope = s.object('suzu-braided-rope')
    const strandBuf = strand0.geometry.getAttribute('position').array
    const tasselBuf = tassel0.geometry.getAttribute('position').array
    const restStrand = Array.from(strandBuf)
    const restTassel = Array.from(tasselBuf)

    await new Promise((resolve) => setTimeout(resolve, 30))
    // Trigger pull & ring motion; verify braid and tassel flex dynamically without collapsing or detaching.
    s.button.click()
    let maxBraidFlexX = 0
    for (let i = 0; i < 24; i++) {
      s.instance.update(1 / 60)
      drawn.scene!.updateMatrixWorld(true)
      expect(rope.localToWorld(new THREE.Vector3(0, -0.265, 0)).distanceTo(bell.localToWorld(new THREE.Vector3(0, -0.265, 0)))).toBeLessThan(1e-8)
      const pos = strand0.geometry.getAttribute('position')
      for (let k = 0; k < pos.count; k++) maxBraidFlexX = Math.max(maxBraidFlexX, Math.abs(pos.getX(k)))
    }
    expect(strand0.geometry.getAttribute('position').array).toBe(strandBuf)
    expect(tassel0.geometry.getAttribute('position').array).toBe(tasselBuf)
    expect(Array.from(strandBuf)).not.toEqual(restStrand)
    expect(Array.from(tasselBuf)).not.toEqual(restTassel)
    expect(Array.from(strandBuf).every(Number.isFinite)).toBe(true)
    expect(Array.from(tasselBuf).every(Number.isFinite)).toBe(true)
    // Flexed braided strands stay plump (never collapsed to zero radius) and visibly swing laterally.
    expect(maxBraidFlexX).toBeGreaterThan(0.11)
    // Outward winding check: braided cotton strands face strictly outward (positive signed volume along tubes).
    const sPos = strand0.geometry.getAttribute('position')
    const sNorm = strand0.geometry.getAttribute('normal')
    const sIdx = strand0.geometry.index!
    let outwardFaces = 0
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), fn = new THREE.Vector3(), vn = new THREE.Vector3()
    for (let i = 0; i < sIdx.count; i += 3) {
      const ia = sIdx.getX(i), ib = sIdx.getX(i + 1), ic = sIdx.getX(i + 2)
      va.fromBufferAttribute(sPos, ia); vb.fromBufferAttribute(sPos, ib); vc.fromBufferAttribute(sPos, ic)
      fn.copy(vb).sub(va).cross(vc.clone().sub(va))
      expect(fn.length()).toBeGreaterThan(1e-10)
      vn.fromBufferAttribute(sNorm, ia)
      if (fn.dot(vn) > 0) outwardFaces++
    }
    expect(outwardFaces).toBe(sIdx.count / 3)

    // Pause freezes simulation mid-ring.
    isActive = false
    const pausedStrand = Array.from(strandBuf)
    for (let i = 0; i < 12; i++) s.instance.update(1 / 60)
    expect(Array.from(strandBuf)).toEqual(pausedStrand)

    // Runtime reduced toggle snaps to calm rest and stays strictly still.
    isActive = true
    isReduced = true
    s.instance.update(1 / 60)
    const redStrand = Array.from(strandBuf)
    const redTassel = Array.from(tasselBuf)
    for (let i = 0; i < 12; i++) s.instance.update(1 / 60)
    expect(Array.from(strandBuf)).toEqual(redStrand)
    expect(Array.from(tasselBuf)).toEqual(redTassel)
  })

  it('grounds both post bases and bridges the bell suspension ring solidly into the crossbeam', () => {
    const s = mount()
    const bases: THREE.Box3[] = []
    drawn.scene!.traverse(o => { if (o.name === 'suzu-column-base') bases.push(new THREE.Box3().setFromObject(o)) })
    expect(bases).toHaveLength(2)
    for (const base of bases) expect(base.min.y).toBeLessThanOrEqual(-0.0225)
    const lintel = new THREE.Box3().setFromObject(s.object('suzu-lintel'))
    const arm = new THREE.Box3().setFromObject(s.object('suzu-bracket-arm'))
    const ring = new THREE.Box3().setFromObject(s.object('suzu-suspension-ring'))
    expect(arm.min.z).toBeLessThan(lintel.max.z)
    expect(arm.max.z).toBeGreaterThan(ring.min.z)
    const metal = (s.object('suzu-bell-body') as THREE.Mesh).material as THREE.MeshStandardMaterial
    expect(metal.emissiveIntensity).toBeCloseTo(0.08, 4)
    expect(s.object('suzu-column-base-contact-ao-left').userData.effect).toBe(true)
    expect(s.object('suzu-column-base-contact-ao-right').userData.effect).toBe(true)
  })

  it('breathes the 28-strand tassel gently with environmentWind when active and stays still under reduced motion', async () => {
    const { loadRapier } = await import('@wbr/scene-runtime/rapier-soft-body')
    const { createEnvironmentWind } = await import('@wbr/scene-runtime/environment-wind')
    await loadRapier()
    const wind = createEnvironmentWind({ strength: 0.75 })
    let isReduced = false
    const s = mount(0, { isReducedMotion: () => isReduced })
    drawn.scene!.userData.environmentWind = wind
    await new Promise((resolve) => setTimeout(resolve, 30))
    const tassel0 = s.object('suzu-tassel-strand-0') as THREE.Mesh
    const restTassel = Array.from(tassel0.geometry.getAttribute('position').array)
    for (let i = 0; i < 30; i++) {
      wind.update((i + 1) / 60, 1 / 60, false)
      s.instance.update(1 / 60)
    }
    expect(Array.from(tassel0.geometry.getAttribute('position').array)).not.toEqual(restTassel)
    isReduced = true
    wind.update(0, 0, true)
    s.instance.update(1 / 60)
    const calmTassel = Array.from(tassel0.geometry.getAttribute('position').array)
    for (let i = 0; i < 12; i++) s.instance.update(1 / 60)
    expect(Array.from(tassel0.geometry.getAttribute('position').array)).toEqual(calmTassel)
  })
})
