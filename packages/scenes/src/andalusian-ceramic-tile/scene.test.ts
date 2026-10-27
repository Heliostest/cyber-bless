// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only GPU work is replaced. Three geometry, raycasting, cues and the wish form remain real.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, rendersAfterDispose: 0 }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this; rendered.rendersAfterDispose = 0 }
    setSize() {} setPixelRatio() {} setClearColor() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, render() { if (vi.mocked(renderer.dispose).mock.calls.length) rendered.rendersAfterDispose++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const height = width === 1280 ? 600 : 560, left = 17, top = 91
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('button')!
  expect(hit, 'scene provides its object input surface').not.toBeNull()
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const write = (text: string) => { const input = overlay.querySelector<HTMLInputElement>('input')!; input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, write, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}
function drag(s: ReturnType<typeof mount>, source = 'tile-loose-grip', target = 'tile-empty-seat') {
  const a = s.point(source), b = s.point(target)
  event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('tile-frame-grip'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
function cues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}
function first(s: ReturnType<typeof mount>, p: THREE.Vector3) {
  const ray = new THREE.Raycaster(); const q = p.project(s.camera); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
  const visible: THREE.Object3D[] = []
  s.scene.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return
    const mat = (object as THREE.Mesh).material as THREE.Material
    if (mat.transparent) return
    visible.push(object)
  })
  return { q, object: ray.intersectObjects(visible, false)[0]?.object }
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

describe('Andalusian contemporary ceramic panel', () => {
  it('fits the center tile, places the panel and finishes once without saving a wish', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('tile-center-piece')!.parent?.name).toBe('tile-panel')
    drag(s, 'tile-frame-grip', 'tile-display-seat'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
})

describe('an optional explicit gift wish', () => {
  it('saves a trimmed nonempty submission once, guards reentry and leaves quiet drafts unsaved', () => {
    const s = mount(2)
    expect(s.overlay.querySelector('input'), 'writing is offered at the final checkpoint').not.toBeNull()
    s.write('  '); expect(s.progress).toEqual([])
    const form = s.overlay.querySelector('form')!
    const repeat = () => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    s.saveWish.mockImplementation(repeat)
    s.write('  愿来年相聚  '); repeat()
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿来年相聚'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const quiet = mount(2); quiet.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的心愿'; tap(quiet)
    expect(quiet.progress).toEqual([3]); expect(quiet.saveWish).not.toHaveBeenCalled()
    expect(quiet.overlay.querySelector('input')).toBeNull()
    const returning = mount(2, { returning: true }); expect(returning.overlay.querySelector('input')).toBeNull(); tap(returning)
    expect(returning.progress).toEqual([3]); expect(returning.saveWish).not.toHaveBeenCalled()
  })
  it('accepts forty characters only through explicit submission and rejects forty-one', () => {
    const s = mount(2), input = s.overlay.querySelector<HTMLInputElement>('input')!
    expect(input.maxLength).toBeGreaterThan(40)
    s.write('心'.repeat(41)); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.write('心'.repeat(40)); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('心'.repeat(40))
  })
})

function block(s: ReturnType<typeof mount>, name: string) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(.55, .55), new THREE.MeshBasicMaterial({ color: 0x775533, side: THREE.DoubleSide }))
  s.scene.updateMatrixWorld(true)
  mesh.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()), s.camera.position, .18)
  mesh.quaternion.copy(s.camera.quaternion); s.scene.add(mesh); s.scene.updateMatrixWorld(true)
  return () => { mesh.removeFromParent(); mesh.geometry.dispose(); mesh.material.dispose() }
}

describe('visible object input and recoverable progress', () => {
  it('rejects empty space, wrong objects, missing travel, wrong drops and wandering quiet taps', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointerup', s.point('tile-frame-grip'))
    drag(s, 'tile-display-seat', 'tile-frame-grip'); expect(s.progress).toEqual([])
    const p = s.point('tile-loose-grip'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p); expect(s.progress).toEqual([])
    const home = s.scene.getObjectByName('tile-center-piece')!.position.clone()
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [1, 1]); event(s.hit, 'pointerup', [1, 1])
    expect(s.scene.getObjectByName('tile-center-piece')!.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    drag(s); drag(s, 'tile-table-leg', 'tile-display-seat'); expect(s.progress).toEqual([1])
    drag(s, 'tile-frame-grip', 'tile-table-leg'); expect(s.progress).toEqual([1])
    drag(s, 'tile-frame-grip', 'tile-display-seat'); const a = s.point('tile-frame-grip')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 12, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1, 2])('does not start through an opaque external object at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'tile-loose-grip' : 'tile-frame-grip'
    const clear = block(s, source)
    if (at < 2) drag(s, source, at === 0 ? 'tile-empty-seat' : 'tile-display-seat'); else tap(s)
    expect(s.progress).toEqual([]); clear()
    if (at < 2) drag(s, source, at === 0 ? 'tile-empty-seat' : 'tile-display-seat'); else tap(s)
    expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1])('rejects drops behind external opaque geometry at checkpoint %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), source = at === 0 ? 'tile-loose-grip' : 'tile-frame-grip', target = at === 0 ? 'tile-empty-seat' : 'tile-display-seat'
    const a = s.point(source), b = s.point(target)
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', beforeArrival(s, b))
    const clear = block(s, target); event(s.hit, 'pointerup', b); s.run()
    expect(s.progress).toEqual([]); clear(); drag(s, source, target); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and retains native button access', at => {
    for (const returning of [true, false]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.scene.getObjectByName('tile-center-piece')!.parent?.name).toBe(at > 0 ? 'tile-panel' : 'tile-courtyard-workbench')
      expect(s.button.type).toBe('button'); expect(s.button.hidden).toBe(at === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
      s.instance.dispose()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('returns either unfinished drag to its support on %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active, isReducedMotion: () => true })
      const source = at === 0 ? 'tile-loose-grip' : 'tile-frame-grip', target = at === 0 ? 'tile-empty-seat' : 'tile-display-seat'
      const object = s.scene.getObjectByName(at === 0 ? 'tile-center-piece' : 'tile-panel')!, home = object.position.clone(), end = s.point(target)
      event(s.hit, 'pointerdown', s.point(source)); event(s.hit, 'pointermove', beforeArrival(s, end))
      expect(object.position.equals(home)).toBe(false)
      if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else if (kind === 'pause') { active = false; s.run() }
      else event(s.hit, kind, end)
      event(s.hit, 'pointerup', end); expect(s.progress).toEqual([]); expect(object.position.equals(home)).toBe(true)
      active = true; window.dispatchEvent(new Event('focus')); s.run(); drag(s, source, target); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it('ignores movement and release from a different pointer owner', () => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('tile-loose-grip'), b = s.point('tile-empty-seat')
    const piece = s.scene.getObjectByName('tile-center-piece')!, home = piece.position.clone()
    event(s.hit, 'pointerdown', a, 7); event(s.hit, 'pointermove', b, 8); event(s.hit, 'pointerup', b, 8)
    expect(piece.position.equals(home)).toBe(true); expect(s.progress).toEqual([])
    event(s.hit, 'pointermove', b, 7); event(s.hit, 'pointerup', b, 7); expect(s.progress).toEqual([1])
  })
  it('accepts a quiet gesture below twelve pixels when it returns to the frame', () => {
    const s = mount(2), a = s.point('tile-frame-grip')
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 11.9, a[1]]); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    expect(s.progress).toEqual([3])
  })
  it.each([true, false])('rejects multitouch with outside pointer first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), to = s.point('tile-empty-seat')
    if (outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    event(s.hit, 'pointerdown', s.point('tile-loose-grip'))
    if (!outsideFirst) event(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); event(s.hit, 'pointermove', to); event(s.hit, 'pointerup', to); event(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s); expect(s.progress).toEqual([1])
  })
  it('freezes accepted motion on blur and pause, disables wish submission and resumes cleanly', () => {
    let active = true; const s = mount(1, { isActive: () => active })
    s.button.click(); s.run(.15); const pose = s.scene.getObjectByName('tile-panel')!.position.clone()
    window.dispatchEvent(new Event('blur')); s.run(2)
    expect(s.scene.getObjectByName('tile-panel')!.position.equals(pose)).toBe(true); expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true); expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    window.dispatchEvent(new Event('focus')); active = false; s.run(2)
    expect(s.scene.getObjectByName('tile-panel')!.position.equals(pose)).toBe(true)
    active = true; s.run(2); expect(s.progress).toEqual([2])
    active = false; s.run(); s.write('暂停'); s.button.click(); expect(s.progress).toEqual([2]); expect(s.saveWish).not.toHaveBeenCalled()
    active = true; s.run(); s.write('春日'); expect(s.progress).toEqual([2, 3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春日')
  })
  it.each([320, 390, 1280])('keeps each cue on the first visible opaque surface at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width)
      for (const { object, cue } of cues(s)) {
        const pick = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(pick.object?.name).toBe(object.name); expect(Math.abs(pick.q.x)).toBeLessThan(.95); expect(Math.abs(pick.q.y)).toBeLessThan(.95)
        if (cue.destination instanceof THREE.Object3D) {
          const target = first(s, cue.destination.getWorldPosition(new THREE.Vector3()))
          expect(target.object?.name).toBe(cue.destination.name); expect(Math.abs(target.q.x)).toBeLessThan(.95); expect(Math.abs(target.q.y)).toBeLessThan(.95)
        } else if (cue.destination) {
          const target = first(s, cue.destination())
          expect(target.object?.name).toBe('tile-frame-grip'); expect(Math.abs(target.q.x)).toBeLessThan(.95); expect(Math.abs(target.q.y)).toBeLessThan(.95)
        }
      }
      for (const name of ['tile-frame-grip', 'tile-center-piece', 'tile-display-stand', 'tile-table-leg']) {
        const bounds = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
          const p = new THREE.Vector3(x, y, z).project(s.camera); expect(Math.abs(p.x), name).toBeLessThan(.99); expect(Math.abs(p.y), name).toBeLessThan(.99)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width); drag(s); drag(s, 'tile-frame-grip', 'tile-display-seat'); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
})

describe('physical craft and owned resources', () => {
  it('rests the whole panel on its pads and beds the ceramic tiles without floating', () => {
    for (const at of [0, 1, 2]) {
      const s = mount(at), bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
      expect(bounds('tile-wooden-frame').min.y).toBeCloseTo(bounds(at < 2 ? 'tile-home-pad' : 'tile-display-seat').max.y, 4)
      expect(bounds('tile-stand-base').min.y).toBeCloseTo(bounds('tile-table-top').max.y, 4)
      const piece = s.scene.getObjectByName('tile-center-piece')!
      if (!at) { expect(bounds('tile-piece-clay').min.y).toBeCloseTo(bounds('tile-table-top').max.y, 4); expect(piece.rotation.x).toBe(-Math.PI / 2) }
      else { expect(bounds('tile-piece-clay').min.z).toBeCloseTo(bounds('tile-empty-seat').max.z, 4); expect(piece.rotation.x).toBe(0) }
      expect(s.scene.getObjectByName('tile-fixed-cell')!.parent).toBe(s.scene.getObjectByName('tile-panel'))
      expect(bounds('tile-piece-clay').getSize(new THREE.Vector3())[at ? 'z' : 'y']).toBeGreaterThan(.04)
      s.instance.dispose()
    }
  })
  it('keeps the fitted center tile attached during drag and restores the complete panel on cancellation', () => {
    const s = mount(1), panel = s.scene.getObjectByName('tile-panel')!, detail = s.scene.getObjectByName('tile-center-piece')!
    const original = new THREE.Box3().setFromObject(detail), grip = s.scene.getObjectByName('tile-frame-grip')!
    expect(detail.parent).toBe(panel); expect(grip.parent).toBe(panel)
    event(s.hit, 'pointerdown', s.point(grip.name)); event(s.hit, 'pointermove', beforeArrival(s, s.point('tile-display-seat')))
    expect(new THREE.Box3().setFromObject(detail).min.equals(original.min)).toBe(false)
    event(s.hit, 'pointercancel', s.point('tile-display-seat'))
    expect(new THREE.Box3().setFromObject(detail).min.distanceTo(original.min)).toBeLessThan(.00001)
    expect(s.progress).toEqual([])
  })
  it('requires eight pixels of real travel and settles immediately when reduced motion is switched on', () => {
    let reduced = false; const s = mount(0, { isReducedMotion: () => reduced }), a = s.point('tile-loose-grip'), target = s.point('tile-empty-seat')
    const short: [number, number] = [a[0] + 7.9, a[1]]
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', short); event(s.hit, 'pointerup', short); s.run()
    expect(s.progress).toEqual([])
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', [a[0] + 8, a[1]]); event(s.hit, 'pointerup', target); s.instance.update(.025)
    expect(s.progress).toEqual([]); reduced = true; s.instance.update(.025); expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('tile-center-piece')!.parent?.name).toBe('tile-panel')
  })
  it('rejects forms before the last checkpoint and while the final panel is being touched', () => {
    const s = mount(0, { isReducedMotion: () => true }); s.write('提前'); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); s.write('提前'); expect(s.progress).toEqual([1]); s.button.click()
    const p = s.point('tile-frame-grip'); event(s.hit, 'pointerdown', p); s.write('手势期间'); expect(s.saveWish).not.toHaveBeenCalled()
    event(s.hit, 'pointercancel', p); s.write('春天安好'); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春天安好'); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 1])('stops rendering and feedback when checkpoint %i closes in its progress callback', at => {
    const closed = vi.fn(() => s.instance.dispose()), s = mount(at, { onProgress: closed })
    s.button.click(); s.run(2)
    expect(closed).toHaveBeenCalledExactlyOnceWith(at + 1)
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(s.overlay.childElementCount).toBe(0); expect(rendered.rendersAfterDispose).toBe(0)
  })
  it('does not emit completion or feedback after the final progress callback disposes', () => {
    const s = mount(2, { onProgress: () => s.instance.dispose() }); s.button.click()
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })
  it('does not notify progress or completion if saving closes the scene synchronously', () => {
    const save = vi.fn(() => s.instance.dispose()), s = mount(2, { saveWish: save })
    s.write('晴日相伴'); expect(save).toHaveBeenCalledExactlyOnceWith('晴日相伴')
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })
  it.each(['save', 'progress'])('stops completion when the %s callback deactivates the scene', callback => {
    let active = true
    const s = mount(2, { isActive: () => active,
      saveWish: () => { if (callback === 'save') active = false },
      onProgress: n => { s.progress.push(n); if (callback === 'progress') active = false },
    })
    s.write('安稳'); expect(s.progress).toEqual([3])
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    active = true; s.run(); s.button.click(); expect(s.progress).toEqual([3]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('does not send completion after the feedback callback closes the scene', () => {
    const s = mount(2, { haptic: () => s.instance.dispose() }); s.button.click()
    expect(s.progress).toEqual([3]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('gives each painted petal solid thickness in contact with its glaze', () => {
    const s = mount(1); let petals = 0
    s.scene.traverse(object => {
      if (object.name !== 'tile-painted-petal') return
      petals++; const mesh = object as THREE.Mesh; mesh.geometry.computeBoundingBox()
      expect(mesh.geometry.boundingBox!.getSize(new THREE.Vector3()).z).toBeGreaterThan(.003)
      expect(mesh.position.z + mesh.geometry.boundingBox!.min.z).toBeCloseTo(.0315, 5)
    })
    expect(petals).toBe(36)
  })
  it('frees geometry, materials, cues, shadows, DOM and owned listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = []
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry)
      for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(material)
      if (object instanceof THREE.DirectionalLight) { const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8); object.shadow.map.addEventListener('dispose', () => shadows[i]++) }
    })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click(); s.instance.update(5)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull()
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})
