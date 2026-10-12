// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import { createInteractionCues, type InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Only the GPU boundary is replaced: meshes, projection, cues and gestures stay real.
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0; toneMappingExposure = 1; outputColorSpace = ''
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null, renderer: null as THREE.WebGLRenderer | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    Object.assign(drawn, { renderer, scene, camera })
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))
import { createNavruzSumalak } from './scene'

const live: ReturnType<typeof createNavruzSumalak>[] = []
beforeEach(() => { drawn.scene = drawn.camera = drawn.renderer = null })
afterEach(() => { live.forEach(s => s.dispose()); live.length = 0; document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createNavruzSumalak({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
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
  expect(obj, `${name} is present`).toBeDefined()
  return obj!
}
function project(s: Mounted, obj: THREE.Object3D): Point {
  drawn.scene!.updateMatrixWorld(true); drawn.camera!.updateMatrixWorld(true)
  const p = obj.getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
  return [(p.x + 1) * s.canvas.clientWidth / 2, (1 - p.y) * 260]
}
function pointer(target: EventTarget, type: string, [x, y]: Point, pointerId = 1, extra: Record<string, unknown> = {}) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX: x, clientY: y, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra })
  target.dispatchEvent(event)
}
function stir(s: Mounted, finish = 'pointerup') {
  pointer(s.hit, 'pointerdown', project(s, object('navruz-wooden-spoon-bowl')))
  for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
  pointer(s.hit, finish, project(s, object('navruz-stir-bead-8'))); s.run()
}
function drag(s: Mounted, source: string, destination: string, finish = 'pointerup') {
  const from = project(s, object(source)), to = project(s, object(destination))
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, finish, to); s.run()
}
function allCues() {
  const cues: InteractionCue[] = []
  drawn.scene!.traverse(o => { cues.push(...(o.userData.interactionCues ?? [])) })
  return cues
}

describe('Navruz shared Sumalak practice', () => {
  it('stirs, serves and shares through the same auxiliary actions without saving wishes', () => {
    const s = mount()
    expect(s.button?.tagName).toBe('BUTTON'); expect(s.overlay.querySelector('form')).toBeNull()
    for (const expected of [[1], [1, 2], [1, 2, 3]]) {
      s.button.click(); s.button.click(); s.run(); expect(s.progress).toEqual(expected)
    }
    expect(s.button.hidden).toBe(true); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); s.run(3); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(object('navruz-serving-food').visible).toBe(true)
    const bowl = new THREE.Box3().setFromObject(object('navruz-serving-bowl'))
    const mat = new THREE.Box3().setFromObject(object('navruz-sharing-mat'))
    expect(bowl.min.y).toBeGreaterThanOrEqual(mat.min.y); expect(bowl.min.y).toBeLessThan(mat.max.y + .035)
  })

  it.each([0, 1, 2, 3])('silently restores checkpoint %i and its actual object cue', initial => {
    let active = true
    const s = mount(initial, { isActive: () => active, returning: true })
    s.run()
    expect(s.overlay.querySelectorAll('[data-state="done"]')).toHaveLength(initial)
    expect(s.button.hidden).toBe(initial === 3)
    expect(object('navruz-serving-food').visible).toBe(initial >= 2)
    expect(allCues().filter(c => c.enabled()).map(c => c.kind)).toEqual(initial === 3 ? [] : ['drag'])
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    active = false; expect(allCues().filter(c => c.enabled())).toEqual([])
  })

  it.each([320, 390, 1280])('follows real changing cue positions through all steps in a %ipx frame', width => {
    const s = mount(0, {}, width), view = createInteractionCues(s.canvas, drawn.scene!, drawn.camera!)
    const point = (role: string): Point => {
      view.update()
      const node = s.host.querySelector<HTMLElement>(`.scene-object-cue[data-cue-role="${role}"]`)!
      expect(node).not.toBeNull()
      const p: Point = [Number(node.dataset.x), Number(node.dataset.y)]
      expect(p[0]).toBeGreaterThan(10); expect(p[0]).toBeLessThan(width - 10)
      expect(p[1]).toBeGreaterThan(35); expect(p[1]).toBeLessThan(485)
      return p
    }
    pointer(s.hit, 'pointerdown', point('source'))
    for (let i = 0; i < 8; i++) pointer(s.hit, 'pointermove', point('target'))
    pointer(s.hit, 'pointerup', point('target')); s.run(); expect(s.progress).toEqual([1])
    for (let step = 2; step <= 3; step++) {
      const from = point('source'), to = point('target')
      pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run()
      expect(s.progress).toEqual([1, 2, 3].slice(0, step))
    }
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(0); view.dispose()
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('requires the visible arc: a straight shortcut, skipped bead, reverse path or departure cannot stir', () => {
    const s = mount()
    for (const sequence of [[8], [1, 3, 4, 5, 6, 7, 8], [8, 7, 6, 5, 4, 3, 2, 1]]) {
      pointer(s.hit, 'pointerdown', project(s, object('navruz-wooden-spoon-bowl')))
      sequence.forEach(i => pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`))))
      pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run(); expect(s.progress).toEqual([])
    }
    pointer(s.hit, 'pointerdown', project(s, object('navruz-wooden-spoon-bowl')))
    pointer(s.hit, 'pointermove', [3, 3])
    for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
    pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run(); expect(s.progress).toEqual([])
    stir(s); expect(s.progress).toEqual([1])
  })

  it('rejects empty-space starts and incorrect serving and sharing destinations', () => {
    const s = mount()
    pointer(s.hit, 'pointerdown', [3, 3]); pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run()
    expect(s.progress).toEqual([]); stir(s)
    drag(s, 'navruz-wooden-spoon-bowl', 'navruz-sharing-mat'); expect(s.progress).toEqual([1])
    drag(s, 'navruz-wooden-spoon-bowl', 'navruz-empty-bowl-basin'); expect(s.progress).toEqual([1, 2])
    drag(s, 'navruz-serving-food', 'navruz-cauldron-food'); expect(s.progress).toEqual([1, 2])
    drag(s, 'navruz-serving-food', 'navruz-sharing-mat'); expect(s.progress).toEqual([1, 2, 3])
  })

  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('clears arc ownership and progress after %s', finish => {
    let active = true
    const s = mount(0, { isActive: () => active }), source = project(s, object('navruz-wooden-spoon-bowl'))
    pointer(s.hit, 'pointerdown', source)
    for (let i = 1; i <= 4; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
    if (finish === 'blur') window.dispatchEvent(new Event('blur'))
    else if (finish === 'pause') { active = false; s.run(); s.button.click(); expect(allCues().filter(c => c.enabled())).toEqual([]); active = true }
    else pointer(s.hit, finish, project(s, object('navruz-stir-bead-4')))
    pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run()
    expect(s.progress).toEqual([]); expect(project(s, object('navruz-wooden-spoon-bowl'))).toEqual(source)
    if (finish === 'blur') window.dispatchEvent(new Event('focus'))
    stir(s); expect(s.progress).toEqual([1])
  })

  it.each(['outside-first', 'outside-second', 'object-second'])('blocks %s multitouch and an auxiliary click while owned', order => {
    const s = mount(), source = project(s, object('navruz-wooden-spoon-bowl'))
    if (order === 'outside-first') pointer(document.body, 'pointerdown', [3, 3], 2)
    pointer(s.hit, 'pointerdown', source)
    if (order === 'outside-second') pointer(document.body, 'pointerdown', [3, 3], 2)
    if (order === 'object-second') pointer(s.hit, 'pointerdown', source, 2)
    s.button.click()
    for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
    pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); pointer(document.body, 'pointerup', source, 2); s.run()
    expect(s.progress).toEqual([]); stir(s); expect(s.progress).toEqual([1])
  })

  it.each([1, 2])('cancels checkpoint %i without leaving carried objects behind', initial => {
    const s = mount(initial), source = initial === 1 ? 'navruz-wooden-spoon-bowl' : 'navruz-serving-food'
    const target = initial === 1 ? 'navruz-empty-bowl-basin' : 'navruz-sharing-mat', before = project(s, object(source))
    drag(s, source, target, 'pointercancel'); expect(s.progress).toEqual([]); expect(project(s, object(source))).toEqual(before)
    drag(s, source, target); expect(s.progress).toEqual([initial + 1])
  })

  it('keeps reduced motion fully usable with physical arc, serve and share gestures', () => {
    const s = mount(0, { isReducedMotion: () => true })
    stir(s); drag(s, 'navruz-wooden-spoon-bowl', 'navruz-empty-bowl-basin'); drag(s, 'navruz-serving-food', 'navruz-sharing-mat')
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    const pose = object('navruz-serving-bowl').matrixWorld.clone(); s.run(3)
    expect(object('navruz-serving-bowl').matrixWorld.equals(pose)).toBe(true)
  })

  it('freezes an accepted animation while paused and completes it once on resume', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(.2); const pose = object('navruz-wooden-spoon').position.clone()
    active = false; s.run(3); expect(object('navruz-wooden-spoon').position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([1])
  })

  it('rests empty and filled bowl feet on the real courtyard support', () => {
    for (const initial of [0, 1, 2]) {
      const s = mount(initial)
      const support = new THREE.Box3().setFromObject(object('navruz-courtyard-plinth'))
      for (const name of ['navruz-serving-bowl', 'navruz-neighbor-bowl']) {
        const bounds = new THREE.Box3().setFromObject(object(name))
        expect(Math.abs(bounds.min.y - support.max.y)).toBeLessThan(.001)
      }
      s.instance.dispose()
    }
  })

  it('claims only the cue-bearing spoon head for the curved stir, not a high handle grab', () => {
    const s = mount(), spoon = object('navruz-wooden-spoon')
    const marker = new THREE.Object3D(); marker.position.copy(spoon.localToWorld(new THREE.Vector3(-.1, .55, -.27)))
    const p = project(s, marker), ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(p[0] / s.canvas.clientWidth * 2 - 1, 1 - p[1] / 260), drawn.camera!)
    expect(ray.intersectObject(object('navruz-long-wooden-handle'), false).length).toBeGreaterThan(0)
    const touch = new Event('touchstart', { cancelable: true })
    Object.assign(touch, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(touch)
    expect(touch.defaultPrevented).toBe(false)
    pointer(s.hit, 'pointerdown', p)
    for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
    pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run(); expect(s.progress).toEqual([])
    stir(s); expect(s.progress).toEqual([1])
  })

  it('hides idle cues on window blur and resumes an accepted motion only after focus', () => {
    const s = mount()
    window.dispatchEvent(new Event('blur')); expect(allCues().filter(c => c.enabled())).toEqual([])
    s.button.click(); s.run(); expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('focus')); expect(allCues().filter(c => c.enabled())).toHaveLength(1)
    s.button.click(); s.run(.2); const position = object('navruz-wooden-spoon').position.clone()
    window.dispatchEvent(new Event('blur')); s.run(3)
    expect(object('navruz-wooden-spoon').position.equals(position)).toBe(true); expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('focus')); s.run(); expect(s.progress).toEqual([1])
  })

  it('offers native auxiliary button activation for all three reduced-motion actions', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button.type).toBe('button'); expect(s.button.getAttribute('aria-label')).toBeTruthy()
    s.button.focus(); expect(document.activeElement).toBe(s.button)
    s.button.click(); expect(s.progress).toEqual([1])
    s.button.click(); expect(s.progress).toEqual([1, 2])
    s.button.click(); expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('does not let another pointer finish an owned arc or auxiliary activation skip it', () => {
    const s = mount(), source = project(s, object('navruz-wooden-spoon-bowl'))
    pointer(s.hit, 'pointerdown', source); s.button.click()
    for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)), 2)
    pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8')), 2); s.run()
    expect(s.progress).toEqual([])
    for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
    pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run()
    expect(s.progress).toEqual([1])
  })

  it('claims only real object touches and rejects nonprimary and secondary-button starts', () => {
    const s = mount(), source = project(s, object('navruz-wooden-spoon-bowl'))
    const touch = (p: Point) => {
      const event = new Event('touchstart', { cancelable: true })
      Object.assign(event, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(event)
      return event.defaultPrevented
    }
    expect(touch([3, 3])).toBe(false); expect(touch(source)).toBe(true)
    for (const extra of [{ button: 2 }, { isPrimary: false }]) {
      pointer(s.hit, 'pointerdown', source, 1, extra)
      for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', project(s, object(`navruz-stir-bead-${i}`)))
      pointer(s.hit, 'pointerup', project(s, object('navruz-stir-bead-8'))); s.run(); expect(s.progress).toEqual([])
    }
    stir(s); expect(s.progress).toEqual([1])
  })

  it('releases geometry, materials, lights, shadows, renderer and every input listener once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse(o => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach(m => resources.add(m))
      if ((o as THREE.Light).isLight) resources.add(o as THREE.Light)
      if ((o as THREE.DirectionalLight).shadow) resources.add((o as THREE.DirectionalLight).shadow)
    })
    const cleanup = [...resources].map(r => vi.spyOn(r, 'dispose'))
    const rendererDispose = vi.spyOn(drawn.renderer!, 'dispose'), contextLoss = vi.spyOn(drawn.renderer!, 'forceContextLoss')
    s.instance.dispose(); s.instance.dispose()
    cleanup.forEach(spy => expect(spy).toHaveBeenCalledOnce()); expect(rendererDispose).toHaveBeenCalledOnce(); expect(contextLoss).toHaveBeenCalledOnce()
    for (const args of added.mock.calls.filter(([type]) => type.startsWith('pointer') || type === 'blur' || type === 'focus')) {
      expect(removed.mock.calls.some(call => call[0] === args[0] && call[1] === args[1] && call[2] === args[2])).toBe(true)
    }
    s.button.click(); s.instance.update(5); expect(s.progress).toEqual([])
    expect(s.overlay.childElementCount).toBe(0); expect(drawn.scene!.children).toHaveLength(0)
  })
})
