// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.PerspectiveCamera | null }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.PerspectiveCamera) {
    drawn.scene = scene; drawn.camera = camera
    return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) } }
  },
}))
import { createWishingMallet } from './scene'
const live: SceneInstance[] = []
afterEach(() => { live.splice(0).forEach(scene => scene.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(progress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  const height = width === 1280 ? 600 : 420
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  const saved: number[] = [], complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createWishingMallet({ canvas, overlay, gestures, shared, initialProgress: progress, onProgress: n => saved.push(n), haptic, isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start(); instance.update(0)
  const scene = drawn.scene!, camera = drawn.camera!, layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const button = () => overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const run = (seconds: number) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const object = (name: string) => { const object = scene.getObjectByName(name); expect(object, name).toBeDefined(); return object! }
  const project = (point: THREE.Vector3) => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const p = point.clone().project(camera); return [(p.x + 1) * width / 2, (1 - p.y) * height / 2] as const }
  const point = (name: string, anchor: [number, number, number]) => project(object(name).localToWorld(new THREE.Vector3(...anchor)))
  const pointer = (type: string, p: readonly number[], id = 1) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { clientX: p[0], clientY: p[1], pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0 })
    layer.dispatchEvent(event)
  }
  const playPoint = () => point('uchide-mallet', [0,.425,-.2])
  const play = (dx = 45, seconds = .05) => {
    const from = playPoint(), to = [from[0] + dx, from[1]]
    pointer('pointerdown', from); run(seconds); pointer('pointermove', to); pointer('pointerup', to)
  }
  const place = (pick: boolean) => {
    const target = object('uchide-mallet')
    const cue = (target.userData.interactionCues as InteractionCue[]).find(cue => cue.destination && cue.enabled())!
    expect(cue).toBeDefined()
    const start = target.localToWorld(new THREE.Vector3(...cue.anchor!)), from = project(start)
    const destination = typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())
    const goal = project(destination), to = [from[0] + goal[0] - project(start)[0], from[1] + goal[1] - project(start)[1]]
    pointer('pointerdown', from); pointer('pointermove', to); pointer('pointerup', to); run(.5)
    expect(saved).toContain(pick ? 1 : 3)
  }
  return { instance, scene, camera, overlay, saved, complete, haptic, run, button, object, point, project, pointer, playPoint, play, place }
}
describe('continuous mallet handling', () => {
  it('keeps the held mallet readable on a 342 pixel canvas', () => {
    const s = mount(1, {}, 342), bounds = new THREE.Box2(), p = new THREE.Vector3()
    s.object('uchide-mallet').traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.geometry) return
      const vertices = mesh.geometry.getAttribute('position')
      for (let i = 0; i < vertices.count; i++) {
        p.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(s.camera)
        bounds.expandByPoint(new THREE.Vector2((p.x + 1) * 171, (1 - p.y) * 210))
      }
    })
    expect(bounds.getSize(new THREE.Vector2()).x).toBeGreaterThan(342 * .4)
  })
  it('keeps the grasp point fixed while following left and right movement', () => {
    const s = mount(1), actor = s.object('uchide-mallet'), from = s.playPoint()
    const grip = new THREE.Vector3(0,.36,-.2), home = actor.localToWorld(grip.clone())
    s.pointer('pointerdown', from)
    for (const dx of [-100, -40, 40, 100]) {
      s.pointer('pointermove', [from[0] + dx, from[1]])
      expect(actor.localToWorld(grip.clone()).distanceTo(home)).toBeLessThan(1e-8)
    }
    s.pointer('pointercancel', from)
    expect(s.saved).toEqual([])
  })
  it('does not mark the mallet as shaken when a drag has no shaking movement', () => {
    const s = mount(1), from = s.playPoint()
    s.pointer('pointerdown', from); s.pointer('pointermove', [from[0], from[1] - 40]); s.pointer('pointerup', [from[0], from[1] - 40])
    expect(s.saved).toEqual([])
  })
  it('starts button replacement at the current hand-following pose', () => {
    const s = mount(2), actor = s.object('uchide-mallet')
    s.overlay.querySelector<HTMLButtonElement>('.scene-toy-repeat')!.click()
    const pose = actor.matrixWorld.clone()
    s.button().click(); s.instance.update(0)
    expect(actor.matrixWorld.elements).toEqual(pose.elements)
    s.run(.8); expect(s.saved).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([1,2])('accepts a smoothly sampled downward return from held checkpoint %i', checkpoint => {
    const s = mount(checkpoint, { isReducedMotion: () => true }), actor = s.object('uchide-mallet'), from = s.playPoint()
    const cue = (actor.userData.interactionCues as InteractionCue[]).find(cue => cue.destination && cue.enabled())!
    const destination = cue.destination as () => THREE.Vector3, goal = s.project(destination())
    s.pointer('pointerdown', from)
    for (const dy of [2,4,6,7,9]) s.pointer('pointermove', [from[0], from[1] + dy])
    expect(s.saved).toEqual([])
    s.pointer('pointermove', goal); s.pointer('pointerup', goal)
    expect(s.saved).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([false, true])('picks up before playing and allows repeated play until explicit return, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced })
    expect(s.button().textContent).toContain('托起')
    s.button().click(); s.run(.8); expect(s.saved).toEqual([1])
    s.play(); expect(s.saved).toEqual([1, 2])
    for (let i = 0; i < 6; i++) { s.play(i % 2 ? -40 : 40); s.run(.1) }
    s.run(20)
    expect(s.saved).toEqual([1, 2]); expect(s.complete).not.toHaveBeenCalled()
    expect(s.overlay.querySelector<HTMLButtonElement>('.scene-toy-repeat')?.hidden).toBe(false)
    s.button().click(); s.run(.8)
    expect(s.saved).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('moves the actual toy with both drag directions without locking input', () => {
    const s = mount(1), actor = s.object('uchide-mallet'), home = actor.quaternion.clone()
    const from = s.playPoint()
    s.pointer('pointerdown', from); s.run(.05); s.pointer('pointermove', [from[0] + 30, from[1]])
    const right = actor.quaternion.clone()
    expect(right.angleTo(home)).toBeGreaterThan(.05)
    expect(s.saved).toEqual([]); expect(s.button().disabled).toBe(false)
    s.pointer('pointermove', [from[0] - 30, from[1]])
    expect(actor.quaternion.angleTo(right)).toBeGreaterThan(.1)
    s.pointer('pointerup', [from[0] - 30, from[1]])
    expect(s.saved).toEqual([2]); expect(s.button().disabled).toBe(false)
    const repeat = s.overlay.querySelector<HTMLButtonElement>('.scene-toy-repeat')!
    repeat.click(); repeat.click(); s.run(.1)
    expect(s.saved).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
  })
  it.each([284, 390, 1280])('accepts real geometry pickup and return at width %i', width => {
    const s = mount(0, {}, width)
    s.place(true); s.play(); s.place(false)
    expect(s.saved).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each(['pointercancel', 'lostpointercapture', 'second', 'blur', 'pause', 'invalid'])('cancels unfinished playing for %s without progress', kind => {
    let active = true
    const s = mount(1, { isActive: () => active }), actor = s.object('uchide-mallet'), home = actor.quaternion.clone(), from = s.playPoint()
    s.pointer('pointerdown', from); s.pointer('pointermove', [from[0] + 25, from[1]])
    expect(actor.quaternion.angleTo(home)).toBeGreaterThan(.03)
    if (kind === 'pause') { active = false; s.instance.update(.025) }
    else if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else if (kind === 'second') { s.pointer('pointerdown', from, 2); s.pointer('pointerup', from, 2) }
    else if (kind === 'invalid') s.pointer('pointermove', [NaN, from[1]])
    else s.pointer(kind, from)
    s.pointer('pointerup', [from[0] + 45, from[1]]); s.run(.5)
    expect(s.saved).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    expect(actor.quaternion.angleTo(home)).toBeLessThan(.00001)
    active = true; window.dispatchEvent(new Event('focus')); s.instance.update(.025)
    s.play(); expect(s.saved).toEqual([2])
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i and its compatible complete save', checkpoint => {
    const s = mount(checkpoint, { returning: true, isReducedMotion: () => true })
    s.run(10); expect(s.saved).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(s.button().hidden).toBe(checkpoint === 3)
    if (checkpoint === 3) { s.button().click(); s.play(); expect(s.saved).toEqual([]) }
    else if (checkpoint > 0) { s.play(); expect(s.saved).toEqual(checkpoint === 1 ? [2] : []) }
  })
  it('keeps a focused repeat button enabled throughout preparation and contact feedback', () => {
    let button: HTMLButtonElement | undefined
    const states: boolean[] = []
    const s = mount(2, { prepareFeedback: () => { if (button) states.push(button.disabled) }, haptic: () => { if (button) states.push(button.disabled) } })
    button = s.overlay.querySelector<HTMLButtonElement>('.scene-toy-repeat')!
    button.focus(); button.click()
    expect(states).toEqual([false, false]); expect(document.activeElement).toBe(button)
    expect(s.saved).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('keeps keyboard/button alternatives usable and ignores the prior double-click tail', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button().style.minWidth).toBe('44px'); expect(s.button().style.minHeight).toBe('44px')
    s.button().click(); expect(s.saved).toEqual([1])
    s.button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })); expect(s.saved).toEqual([1])
    s.button().click(); expect(s.saved).toEqual([1, 2])
    s.button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 })); expect(s.saved).toEqual([1, 2])
    s.button().click(); expect(s.saved).toEqual([1, 2, 3])
  })
  it.each(['pause', 'dispose'])('does not continue host feedback after reentrant %s', mode => {
    let active = true, instance: SceneInstance | undefined
    const saved: number[] = []
    const s = mount(2, { isReducedMotion: () => true, isActive: () => active, onProgress: n => { saved.push(n); if (mode === 'dispose') instance?.dispose(); else active = false } })
    instance = s.instance; s.button().click()
    expect(saved).toEqual([3]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })
  it.each([284, 390, 1280])('frames the real moving vertices across both drag directions at width %i', width => {
    const s = mount(1, {}, width), actor = s.object('uchide-subject')
    const check = () => {
      s.scene.updateMatrixWorld(true)
      actor.traverse(object => {
        const mesh = object as THREE.Mesh
        if (!mesh.geometry) return
        const positions = mesh.geometry.getAttribute('position'), p = new THREE.Vector3()
        for (let i = 0; i < positions.count; i++) {
          p.fromBufferAttribute(positions, i).applyMatrix4(mesh.matrixWorld).project(s.camera)
          expect(Math.max(Math.abs(p.x), Math.abs(p.y)), mesh.name).toBeLessThan(.97)
        }
      })
    }
    for (let i = 0; i < 4; i++) { s.play(i % 2 ? -65 : 65); check(); s.run(.1); check() }
    s.button().click()
    for (let i = 0; i < 24; i++) { s.instance.update(.025); check() }
    expect(s.saved).toEqual([2, 3])
  })
  it('keeps a paused placement frozen and resumes from the same progress', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), actor = s.object('uchide-subject')
    s.button().click(); s.run(.1); const pose = actor.matrixWorld.clone()
    active = false; s.run(2); expect(actor.matrixWorld.elements).toEqual(pose.elements); expect(s.saved).toEqual([])
    active = true; s.run(.8); expect(s.saved).toEqual([1])
  })
  it('releases every physical geometry and material exactly once', () => {
    const s = mount(), geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>()
    s.object('uchide-subject').traverse(object => { const mesh = object as THREE.Mesh; if (!mesh.geometry) return; geometries.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : [mesh.material]) materials.add(material) })
    const disposed = [...geometries, ...materials].map(resource => { const dispose = vi.fn(); resource.addEventListener('dispose', dispose); return dispose })
    s.instance.dispose(); s.instance.dispose(); disposed.forEach(dispose => expect(dispose).toHaveBeenCalledOnce())
  })
  it('rejects retained input after disposal and disposes only once', () => {
    const s = mount(1), button = s.button(), from = s.playPoint()
    s.instance.dispose(); s.instance.dispose(); button.click(); s.pointer('pointerdown', from); s.pointer('pointerup', [from[0] + 45, from[1]]); s.run(2)
    expect(s.saved).toEqual([]); expect(s.overlay.childElementCount).toBe(0)
  })
})
