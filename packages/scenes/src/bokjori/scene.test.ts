// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import { createInteractionCues, type InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Keep geometry, projection, raycasts and pointer events real; jsdom has no GPU.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
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

import { createBokjori } from './scene'

const live: ReturnType<typeof createBokjori>[] = []
beforeEach(() => { drawn.scene = drawn.camera = null })
afterEach(() => {
  live.forEach(s => s.dispose()); live.length = 0
  document.body.replaceChildren(); vi.restoreAllMocks()
})
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createBokjori({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start()
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = vi.fn(); hit.releasePointerCapture = vi.fn() }
  const run = (seconds = 1.6) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
  run(0.05)
  return { host, canvas, overlay, instance, hit, button, progress, saveWish, complete, haptic, run }
}
type Mounted = ReturnType<typeof mount>
type Point = [number, number]
function object(name: string) {
  const obj = drawn.scene?.getObjectByName(name)
  expect(obj, `${name} is present in the real scene`).toBeDefined()
  return obj!
}
function project(s: Mounted, obj: THREE.Object3D): Point {
  drawn.scene!.updateMatrixWorld(true); drawn.camera!.updateMatrixWorld(true)
  const p = obj.getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
  return [(p.x + 1) * s.canvas.clientWidth / 2, (1 - p.y) * 260]
}
function pointer(target: EventTarget, type: string, [x, y]: Point, pointerId = 1, extra: Record<string, unknown> = {}) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra })
  target.dispatchEvent(e)
}
function drag(s: Mounted, destination: string, finish = 'pointerup') {
  const from = project(s, object('bokjori-scoop-source')), to = project(s, object(destination))
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, finish, to); s.run()
}
function cues() { return object('bokjori-scoop-source').userData.interactionCues as InteractionCue[] }

describe('bokjori bamboo scoop practice', () => {
  it('collects rice, hangs the scoop and quietly completes once with the auxiliary actions', () => {
    const s = mount()
    expect(s.button).not.toBeNull()
    expect(s.overlay.querySelector('form')).toBeNull()
    for (const expected of [[1], [1, 2], [1, 2, 3]]) {
      s.button.click(); s.button.click(); s.run()
      expect(s.progress).toEqual(expected)
    }
    expect(object('bokjori-collected-rice').visible).toBe(true)
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(true)
    s.button.click(); s.run(3)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('builds a genuinely open woven bowl, split bamboo handle, ties, rice tray and timber peg', () => {
    mount()
    const bowl = object('bokjori-woven-bowl'), weave: THREE.Mesh[] = []
    bowl.traverse(o => { if ((o as THREE.Mesh).isMesh) weave.push(o as THREE.Mesh) })
    expect(weave.length).toBeGreaterThan(20)
    expect(new Set(weave.map(m => m.geometry)).size).toBeGreaterThan(20)
    const bounds = new THREE.Box3().setFromObject(bowl)
    expect(bounds.max.x - bounds.min.x).toBeGreaterThan(0.65)
    expect(bounds.max.z - bounds.min.z).toBeGreaterThan(0.18)
    expect(object('bokjori-bamboo-handle-left')).toBeDefined()
    expect(object('bokjori-bamboo-handle-right')).toBeDefined()
    expect(object('bokjori-hanging-ties')).toBeDefined()
    expect(object('bokjori-grain-target')).toBeInstanceOf(THREE.Mesh)
    expect(object('bokjori-wall-peg')).toBeInstanceOf(THREE.Mesh)
    expect(object('bokjori-timber-wall').children.length).toBeGreaterThan(3)
  })

  it.each([0, 1, 2, 3])('silently restores checkpoint %i and its active object cue', initial => {
    let active = true
    const s = mount(initial, { isActive: () => active })
    s.run()
    expect(s.overlay.querySelectorAll('[data-state="done"]')).toHaveLength(initial)
    expect(object('bokjori-collected-rice').visible).toBe(initial >= 1)
    expect(s.button.hidden).toBe(initial === 3)
    const registered = cues()
    const enabled = () => registered.filter(c => c.enabled())
    expect(enabled().map(c => c.kind)).toEqual(initial < 2 ? ['drag'] : initial === 2 ? ['tap'] : [])
    if (initial < 2) expect(enabled()[0].destination).toBe(object(initial === 0 ? 'bokjori-grain-target' : 'bokjori-wall-peg'))
    if (initial >= 2) {
      const tie = object('bokjori-hanging-loop').getWorldPosition(new THREE.Vector3())
      const peg = object('bokjori-wall-peg').getWorldPosition(new THREE.Vector3())
      expect(tie.distanceTo(peg)).toBeLessThan(0.1)
    }
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    active = false; expect(enabled()).toEqual([])
    s.instance.dispose(); expect(enabled()).toEqual([])
  })

  it.each([320, 390, 1280])('uses displayed real scoop and destination cues in a %ipx frame', width => {
    const s = mount(0, {}, width)
    const view = createInteractionCues(s.canvas, drawn.scene!, drawn.camera!)
    const checkMarkers = () => {
      view.update()
      const nodes = s.host.querySelectorAll<HTMLElement>('.scene-object-cue')
      expect(nodes.length).toBeGreaterThan(0)
      nodes.forEach(node => {
        expect(Number(node.dataset.x)).toBeGreaterThan(10); expect(Number(node.dataset.x)).toBeLessThan(width - 10)
        expect(Number(node.dataset.y)).toBeGreaterThan(35); expect(Number(node.dataset.y)).toBeLessThan(485)
      })
      return nodes
    }
    for (const [idx, target] of ['bokjori-grain-target', 'bokjori-wall-peg', 'bokjori-scoop-source'].entries()) {
      const bounds = new THREE.Box3().setFromObject(object('bokjori-scoop'))
      for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
        const p = new THREE.Vector3(x, y, z).project(drawn.camera!)
        expect(Math.abs(p.x)).toBeLessThan(0.94)
        expect(Math.abs(p.y)).toBeLessThan(0.94)
      }
      const nodes = checkMarkers()
      const from = nodes[0]
      const destination = idx < 2 ? nodes[1] : from
      const point = (node: HTMLElement): Point => [Number(node.dataset.x), Number(node.dataset.y)]
      pointer(s.hit, 'pointerdown', point(from)); pointer(s.hit, 'pointermove', point(destination)); pointer(s.hit, 'pointerup', point(destination)); s.run()
      expect(s.progress, target).toEqual([1, 2, 3].slice(0, idx + 1))
      expect(new THREE.Box3().setFromObject(object('bokjori-scoop')).min.y).toBeGreaterThan(0)
    }
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(0); view.dispose()
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('rejects empty-space starts, a wrong tray drop and a tap released away from the hanging scoop', () => {
    const s = mount()
    const to = project(s, object('bokjori-grain-target'))
    pointer(s.hit, 'pointerdown', [3, 3]); pointer(s.hit, 'pointerup', to); s.run()
    drag(s, 'bokjori-wall-peg'); expect(s.progress).toEqual([])
    drag(s, 'bokjori-grain-target'); drag(s, 'bokjori-wall-peg')
    pointer(s.hit, 'pointerdown', project(s, object('bokjori-scoop-source'))); pointer(s.hit, 'pointerup', [3, 3]); s.run()
    expect(s.progress).toEqual([1, 2])
    drag(s, 'bokjori-scoop-source'); expect(s.progress).toEqual([1, 2, 3])
  })

  it.each([true, false])('rejects a long quiet drag ending on the actual handle (move event: %s) and accepts a fresh tap', move => {
    const s = mount(2), source = project(s, object('bokjori-scoop-source'))
    const point = new THREE.Vector3(-0.033, 0.86, 0.06).applyMatrix4(object('bokjori-scoop').matrixWorld).project(drawn.camera!)
    const handle: Point = [(point.x + 1) * s.canvas.clientWidth / 2, (1 - point.y) * 260]
    expect(Math.hypot(handle[0] - source[0], handle[1] - source[1])).toBeGreaterThan(50)
    const ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(point.x, point.y), drawn.camera!)
    expect(ray.intersectObject(object('bokjori-bamboo-handle-left'), false).length).toBeGreaterThan(0)
    pointer(s.hit, 'pointerdown', source)
    if (move) pointer(s.hit, 'pointermove', handle)
    pointer(s.hit, 'pointerup', handle); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    drag(s, 'bokjori-scoop-source')
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each(['pointercancel', 'lostpointercapture', 'blur'])('cancels %s and requires a fresh scoop gesture', finish => {
    const s = mount()
    const source = project(s, object('bokjori-scoop-source')), to = project(s, object('bokjori-grain-target'))
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', to)
    if (finish === 'blur') window.dispatchEvent(new Event('blur'))
    else pointer(s.hit, finish, to)
    pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([])
    expect(project(s, object('bokjori-scoop-source'))).toEqual(source)
    drag(s, 'bokjori-grain-target'); expect(s.progress).toEqual([1])
  })

  it.each([1, 2])('keeps checkpoint %i when a valid destination gesture is cancelled', initial => {
    const s = mount(initial), target = initial === 1 ? 'bokjori-wall-peg' : 'bokjori-scoop-source'
    drag(s, target, 'pointercancel'); expect(s.progress).toEqual([])
    expect(object('bokjori-collected-rice').visible).toBe(true)
    drag(s, target); expect(s.progress).toEqual([initial + 1])
  })

  it.each(['outside-first', 'outside-second', 'object-second'])('rejects %s multi-touch and auxiliary clicks while busy', order => {
    const s = mount(), source = project(s, object('bokjori-scoop-source')), to = project(s, object('bokjori-grain-target'))
    if (order === 'outside-first') pointer(document.body, 'pointerdown', [3, 3], 2)
    pointer(s.hit, 'pointerdown', source)
    if (order === 'outside-second') pointer(document.body, 'pointerdown', [3, 3], 2)
    if (order === 'object-second') pointer(s.hit, 'pointerdown', source, 2)
    s.button.click(); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to)
    pointer(document.body, 'pointerup', [3, 3], 2); s.run()
    expect(s.progress).toEqual([])
    drag(s, 'bokjori-grain-target'); expect(s.progress).toEqual([1])
  })

  it('keeps a single pointer owner and blocks the auxiliary action until it ends', () => {
    const s = mount(), source = project(s, object('bokjori-scoop-source')), to = project(s, object('bokjori-grain-target'))
    pointer(s.hit, 'pointerdown', source); s.button.click()
    pointer(s.hit, 'pointermove', to, 2); pointer(s.hit, 'pointerup', to, 2); s.run()
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([1])
  })

  it('cancels across pause and ignores an old release after resume', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), source = project(s, object('bokjori-scoop-source')), to = project(s, object('bokjori-grain-target'))
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', to)
    active = false; s.run(); s.button.click(); expect(cues().filter(c => c.enabled())).toEqual([])
    active = true; pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    drag(s, 'bokjori-grain-target'); expect(s.progress).toEqual([1])
  })

  it('freezes an accepted action while paused and settles it once after resume', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(0.2)
    const position = object('bokjori-scoop').position.clone()
    active = false; s.run(4)
    expect(object('bokjori-scoop').position.equals(position)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([1])
  })

  it('brings the open bowl into the grain tray before carrying the collected rice away', () => {
    const s = mount()
    s.button.click(); s.run(0.5)
    const bowl = new THREE.Box3().setFromObject(object('bokjori-woven-bowl'))
    const tray = new THREE.Box3().setFromObject(object('bokjori-grain-target'))
    expect(bowl.min.y).toBeLessThan(tray.max.y + 0.04)
    expect(bowl.max.y).toBeGreaterThan(tray.min.y)
    expect(object('bokjori-collected-rice').visible).toBe(true)
    const rice = new THREE.Box3().setFromObject(object('bokjori-collected-rice')).getCenter(new THREE.Vector3())
    const trayCentre = object('bokjori-grain-target').getWorldPosition(new THREE.Vector3())
    expect(rice.distanceTo(trayCentre)).toBeLessThan(0.16)
    expect(s.progress).toEqual([])
    s.run(); expect(s.progress).toEqual([1])
  })

  it('settles immediately with reduced motion while retaining usable physical gestures', () => {
    const s = mount(0, { isReducedMotion: () => true })
    for (const target of ['bokjori-grain-target', 'bokjori-wall-peg', 'bokjori-scoop-source']) drag(s, target)
    expect(s.progress).toEqual([1, 2, 3])
    const pose = object('bokjori-scoop').matrixWorld.clone(); s.run(5)
    expect(object('bokjori-scoop').matrixWorld.equals(pose)).toBe(true); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('settles each auxiliary action immediately in reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.button.click(); expect(s.progress).toEqual([1])
    s.button.click(); expect(s.progress).toEqual([1, 2])
    s.button.click(); expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('claims touches only on the scoop and rejects secondary mouse or non-primary starts', () => {
    const s = mount(), source = project(s, object('bokjori-scoop-source')), to = project(s, object('bokjori-grain-target'))
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(touch([3, 3])).toBe(false); expect(touch(source)).toBe(true)
    pointer(s.hit, 'pointerdown', source, 1, { button: 2 }); pointer(s.hit, 'pointerup', to); s.run()
    pointer(s.hit, 'pointerdown', source, 1, { isPrimary: false }); pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([])
    drag(s, 'bokjori-grain-target'); expect(s.progress).toEqual([1])
  })

  it('frees all owned geometry, material, light and input resources once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse(o => {
      const m = o as THREE.Mesh
      if (m.geometry) resources.add(m.geometry)
      if ((o as THREE.InstancedMesh).isInstancedMesh) resources.add(o as THREE.InstancedMesh)
      const mats = m.material ? Array.isArray(m.material) ? m.material : [m.material] : []
      mats.forEach(mat => resources.add(mat))
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
      const shadow = (o as THREE.DirectionalLight).shadow
      if (shadow) resources.add(shadow)
    })
    const cleanup = [...resources].map(r => vi.spyOn(r, 'dispose'))
    const source = project(s, object('bokjori-scoop-source')), button = s.button
    s.instance.dispose(); s.instance.dispose()
    cleanup.forEach(spy => expect(spy).toHaveBeenCalledOnce())
    for (const args of added.mock.calls.filter(([type]) => type.startsWith('pointer') || type === 'blur')) {
      expect(removed.mock.calls.some(call => call[0] === args[0] && call[1] === args[1] && call[2] === args[2])).toBe(true)
    }
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointerup', source); button.click(); s.instance.update(5)
    expect(s.progress).toEqual([]); expect(s.overlay.childElementCount).toBe(0); expect(drawn.scene!.children).toHaveLength(0)
  })
})
