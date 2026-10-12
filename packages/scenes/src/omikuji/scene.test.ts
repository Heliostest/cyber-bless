// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import { createInteractionCues, type InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Only the GPU renderer/pass is substituted; geometry, cues and input are real.
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null,
  dispose: vi.fn(), loss: vi.fn() }))
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0; toneMappingExposure = 1; outputColorSpace = ''
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {}
    dispose = drawn.dispose; forceContextLoss = drawn.loss
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    drawn.scene = scene; drawn.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))
import { createOmikuji } from './scene'

const live: ReturnType<typeof createOmikuji>[] = []
beforeEach(() => { drawn.scene = drawn.camera = null; drawn.dispose.mockClear(); drawn.loss.mockClear() })
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
  const instance = createOmikuji({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start()
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = vi.fn(); hit.releasePointerCapture = vi.fn() }
  const run = (seconds = 1.8) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
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
const sources = ['omikuji-box-body', 'omikuji-draw-stick', 'omikuji-paper-middle']
const targets = ['omikuji-tilt-target', 'omikuji-draw-target', 'omikuji-envelope-pocket']
function drag(s: Mounted, step: number, finish = 'pointerup') {
  const from = project(s, object(sources[step])), to = project(s, object(targets[step]))
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, finish, to); s.run()
}
function enabledCues() {
  const cues: { object: THREE.Object3D; cue: InteractionCue }[] = []
  drawn.scene?.traverse(o => { for (const cue of (o.userData.interactionCues ?? []) as InteractionCue[]) if (cue.enabled()) cues.push({ object: o, cue }) })
  return cues
}

describe('omikuji original reflection practice', () => {
  it('provides three native auxiliary actions and never offers a writing form or saves a wish', () => {
    const s = mount()
    expect(s.button).not.toBeNull()
    expect(s.button.tagName).toBe('BUTTON'); expect(s.button.type).toBe('button')
    expect(s.overlay.querySelector('form, textarea, input')).toBeNull()
    for (const expected of [[1], [1, 2], [1, 2, 3]]) {
      s.button.click(); s.button.click(); s.run(); expect(s.progress).toEqual(expected)
    }
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(true); expect(enabledCues()).toEqual([])
    s.button.click(); s.run(5); expect(s.progress).toEqual([1, 2, 3])
  })

  it.each([320, 390, 1280])('finishes all three gestures from the displayed cues at %ipx', width => {
    const s = mount(0, {}, width)
    const view = createInteractionCues(s.canvas, drawn.scene!, drawn.camera!)
    for (let step = 0; step < 3; step++) {
      view.update()
      const nodes = Array.from(s.host.querySelectorAll<HTMLElement>('.scene-object-cue'))
      expect(nodes).toHaveLength(2)
      const point = (node: HTMLElement): Point => [Number(node.dataset.x), Number(node.dataset.y)]
      nodes.forEach(node => {
        expect(point(node)[0]).toBeGreaterThan(20); expect(point(node)[0]).toBeLessThan(width - 20)
        expect(point(node)[1]).toBeGreaterThan(55); expect(point(node)[1]).toBeLessThan(460)
      })
      // The visible source center actually intersects a visible opaque mesh.
      const source = object(sources[step]) as THREE.Mesh
      const mat = source.material as THREE.Material
      expect(mat.visible).toBe(true); expect(mat.opacity).toBe(1)
      const ray = new THREE.Raycaster(), p = point(nodes[0])
      ray.setFromCamera(new THREE.Vector2(p[0] / width * 2 - 1, 1 - p[1] / 260), drawn.camera!)
      expect(ray.intersectObject(source).length).toBeGreaterThan(0)
      pointer(s.hit, 'pointerdown', point(nodes[0])); pointer(s.hit, 'pointermove', point(nodes[1])); pointer(s.hit, 'pointerup', point(nodes[1])); s.run()
      expect(s.progress).toEqual([1, 2, 3].slice(0, step + 1))
      if (step === 1) expect(s.overlay.textContent).toContain('把今天能照顾的一件小事，慢慢做好。')
    }
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(0); view.dispose()
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('rests a beveled hexagonal box on its wood stand and tucks the real paper behind the envelope front', () => {
    const s = mount()
    const body = object('omikuji-box-body') as THREE.Mesh
    expect(body.geometry).toBeInstanceOf(THREE.ExtrudeGeometry)
    const box = new THREE.Box3().setFromObject(object('omikuji-box'))
    const stand = new THREE.Box3().setFromObject(object('omikuji-stand-top'))
    expect(box.min.y - stand.max.y).toBeLessThan(0.025)
    expect(box.min.y - stand.max.y).toBeGreaterThan(-0.025)
    expect(object('omikuji-wood-grain').children.length).toBeGreaterThan(12)
    expect(object('omikuji-paper').children.length).toBeGreaterThanOrEqual(3)
    for (let step = 0; step < 3; step++) drag(s, step)
    const paper = new THREE.Box3().setFromObject(object('omikuji-paper'))
    const pocket = new THREE.Box3().setFromObject(object('omikuji-envelope-pocket'))
    expect(paper.max.z).toBeLessThan(pocket.max.z)
    expect(paper.min.y).toBeGreaterThan(pocket.min.y - 0.03)
    expect(Math.abs(paper.getCenter(new THREE.Vector3()).x - pocket.getCenter(new THREE.Vector3()).x)).toBeLessThan(0.05)
    // The long sheet folds into the pocket without vertically squashing its paper.
    expect(object('omikuji-paper').scale.y).toBe(1)
    expect(paper.max.y - paper.min.y).toBeLessThan(0.38)
  })

  it.each([0, 1, 2, 3])('silently restores progress %i and exposes only its current object', initial => {
    let active = true
    const s = mount(initial, { isActive: () => active, returning: true })
    s.run()
    expect(s.overlay.querySelectorAll('[data-state="done"]')).toHaveLength(initial)
    expect(object('omikuji-draw-stick').visible).toBe(initial === 1)
    expect(object('omikuji-paper').visible).toBe(initial >= 2)
    expect(enabledCues()).toHaveLength(initial === 3 ? 0 : 1)
    if (initial < 3) {
      expect(enabledCues()[0].object).toBe(object(sources[initial]))
      expect(enabledCues()[0].cue.destination).toBe(object(targets[initial]))
    }
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    active = false; expect(enabledCues()).toEqual([])
    s.instance.dispose(); expect(enabledCues()).toEqual([])
  })

  it.each([0, 1, 2])('rejects empty-space starts, taps and wrong drops at checkpoint %i', step => {
    const s = mount(step), source = project(s, object(sources[step])), target = project(s, object(targets[step]))
    pointer(s.hit, 'pointerdown', [3, 3]); pointer(s.hit, 'pointerup', target); s.run()
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointerup', source); s.run()
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', [3, 3]); pointer(s.hit, 'pointerup', [3, 3]); s.run()
    expect(s.progress).toEqual([]); expect(project(s, object(sources[step]))).toEqual(source)
    drag(s, step); expect(s.progress).toEqual([step + 1])
  })

  it.each(['omikuji-paper-top', 'omikuji-paper-bottom'])('lets the reader hold the real %s section to tuck the sheet', name => {
    const s = mount(2), from = project(s, object(name)), to = project(s, object(targets[2]))
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each(['pointercancel', 'lostpointercapture', 'blur'])('cancels %s and restores the held object', finish => {
    const s = mount(), source = project(s, object(sources[0])), to = project(s, object(targets[0]))
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', to)
    if (finish === 'blur') window.dispatchEvent(new Event('blur')); else pointer(s.hit, finish, to)
    pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([]); expect(project(s, object(sources[0]))).toEqual(source)
    if (finish === 'blur') window.dispatchEvent(new Event('focus'))
    drag(s, 0); expect(s.progress).toEqual([1])
  })

  it.each([1, 2])('does not consume a cancelled drag at checkpoint %i', step => {
    const s = mount(step); drag(s, step, 'pointercancel')
    expect(s.progress).toEqual([]); drag(s, step); expect(s.progress).toEqual([step + 1])
  })

  it.each(['outside-first', 'outside-second', 'object-second'])('cancels %s multitouch and blocks auxiliary input', order => {
    const s = mount(), source = project(s, object(sources[0])), to = project(s, object(targets[0]))
    if (order === 'outside-first') pointer(document.body, 'pointerdown', [3, 3], 2)
    pointer(s.hit, 'pointerdown', source)
    if (order === 'outside-second') pointer(document.body, 'pointerdown', [3, 3], 2)
    if (order === 'object-second') pointer(s.hit, 'pointerdown', source, 2)
    s.button.click(); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to)
    pointer(document.body, 'pointerup', [3, 3], 2); s.run()
    expect(s.progress).toEqual([]); drag(s, 0); expect(s.progress).toEqual([1])
  })

  it('ignores non-owner moves and blocks auxiliary input while an object is held', () => {
    const s = mount(), source = project(s, object(sources[0])), to = project(s, object(targets[0]))
    pointer(s.hit, 'pointerdown', source); s.button.click()
    pointer(s.hit, 'pointermove', to, 2); pointer(s.hit, 'pointerup', to, 2); s.run()
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([1])
  })

  it('hides cues, clears the held pointer on pause and requires a fresh gesture', () => {
    let active = true
    const s = mount(1, { isActive: () => active }), source = project(s, object(sources[1])), to = project(s, object(targets[1]))
    pointer(s.hit, 'pointerdown', source); pointer(s.hit, 'pointermove', to)
    active = false; s.run(); s.button.click(); expect(enabledCues()).toEqual([])
    active = true; pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    drag(s, 1); expect(s.progress).toEqual([2])
  })

  it('freezes an accepted shake while paused and completes it once on resume', () => {
    let active = true
    const s = mount(0, { isActive: () => active }); s.button.click(); s.run(0.3)
    const pose = object('omikuji-box').matrixWorld.clone()
    active = false; s.run(4)
    expect(object('omikuji-box').matrixWorld.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([1])
  })

  it('hides real cue markers immediately on blur and rejects old releases after focus', () => {
    const s = mount(1), from = project(s, object(sources[1])), to = project(s, object(targets[1]))
    const view = createInteractionCues(s.canvas, drawn.scene!, drawn.camera!)
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(2)
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to)
    window.dispatchEvent(new Event('blur'))
    expect(enabledCues()).toEqual([]); expect(s.button.disabled).toBe(true)
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(0)
    s.button.click(); s.run(4); expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('focus'))
    expect(enabledCues()).toHaveLength(1); expect(s.button.disabled).toBe(false)
    pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    drag(s, 1); expect(s.progress).toEqual([2]); view.dispose()
  })

  it.each([0, 1, 2])('freezes the accepted real gesture at checkpoint %i on blur and settles once after focus', step => {
    const s = mount(step), from = project(s, object(sources[step])), to = project(s, object(targets[step]))
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to)
    s.run(0.55)
    const poses = new Map<THREE.Object3D, THREE.Matrix4>()
    drawn.scene!.traverse(o => poses.set(o, o.matrixWorld.clone()))
    window.dispatchEvent(new Event('blur')); s.run(4)
    poses.forEach((pose, o) => expect(o.matrixWorld.equals(pose)).toBe(true))
    expect(enabledCues()).toEqual([]); expect(s.progress).toEqual([])
    expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(4)
    expect(s.progress).toEqual([step + 1]); expect(s.haptic).toHaveBeenCalledOnce()
    expect(s.complete).toHaveBeenCalledTimes(step === 2 ? 1 : 0)
    window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')); s.run(4)
    expect(s.progress).toEqual([step + 1]); expect(s.haptic).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('retains real gestures and static completed poses in reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true, returning: true })
    for (let step = 0; step < 3; step++) drag(s, step)
    const pose = object('omikuji-paper').matrixWorld.clone(); s.run(5)
    expect(s.progress).toEqual([1, 2, 3]); expect(object('omikuji-paper').matrixWorld.equals(pose)).toBe(true)
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('settles the same auxiliary actions immediately with reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.button.click(); expect(s.progress).toEqual([1])
    s.button.click(); expect(s.progress).toEqual([1, 2])
    s.button.click(); expect(s.progress).toEqual([1, 2, 3])
  })

  it('claims only actual object touches and rejects secondary mouse buttons', () => {
    const s = mount(), source = project(s, object(sources[0])), to = project(s, object(targets[0]))
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(touch([3, 3])).toBe(false); expect(touch(source)).toBe(true)
    pointer(s.hit, 'pointerdown', source, 1, { button: 2 }); pointer(s.hit, 'pointerup', to); s.run()
    pointer(s.hit, 'pointerdown', source, 1, { isPrimary: false }); pointer(s.hit, 'pointerup', to); s.run()
    expect(s.progress).toEqual([]); drag(s, 0); expect(s.progress).toEqual([1])
  })

  it('disposes every owned geometry, material, light, shadow map, context and listener once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      const mats = mesh.material ? Array.isArray(mesh.material) ? mesh.material : [mesh.material] : []
      mats.forEach(mat => resources.add(mat))
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
      const shadow = (o as THREE.DirectionalLight).shadow
      if (shadow) resources.add(shadow)
    })
    const cleanup = [...resources].map(r => vi.spyOn(r, 'dispose')), button = s.button
    s.instance.dispose(); s.instance.dispose()
    cleanup.forEach(spy => expect(spy).toHaveBeenCalledOnce())
    expect(drawn.dispose).toHaveBeenCalledOnce(); expect(drawn.loss).toHaveBeenCalledOnce()
    for (const args of added.mock.calls.filter(([type]) => type.startsWith('pointer') || type === 'blur' || type === 'focus')) {
      expect(removed.mock.calls.some(call => call[0] === args[0] && call[1] === args[1] && call[2] === args[2])).toBe(true)
    }
    button.click(); s.instance.update(5)
    expect(s.progress).toEqual([]); expect(s.overlay.childElementCount).toBe(0); expect(drawn.scene!.children).toHaveLength(0)
  })
})
