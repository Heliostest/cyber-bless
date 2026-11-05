// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.PerspectiveCamera | null }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
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
import { createFurinWindChime } from './scene'
const live: SceneInstance[] = []
afterEach(() => { live.splice(0).forEach(scene => scene.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(progress = 0, extra: Partial<SceneContext> = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 420 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 420 }) as DOMRect
  const saved: number[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createFurinWindChime({ canvas, overlay, gestures, shared, initialProgress: progress, onProgress: n => saved.push(n), isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start(); instance.update(0)
  const scene = drawn.scene!, camera = drawn.camera!, layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const button = () => overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const run = (seconds: number) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const object = (name: string) => { const object = scene.getObjectByName(name); expect(object, name).toBeDefined(); return object! }
  const project = (point: THREE.Vector3) => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const p = point.clone().project(camera); return [(p.x + 1) * 195, (1 - p.y) * 210] as const }
  const pointer = (type: string, p: readonly number[], id = 1) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { clientX: p[0], clientY: p[1], pointerId: id, pointerType: 'touch', isPrimary: id === 1, button: 0, buttons: type === 'pointerup' ? 0 : 1 })
    layer.dispatchEvent(event)
  }
  const inspect = () => {
    button().click(); run(.8)
    expect(overlay.getAttribute('data-close-inspection')).toBe('viewing')
    button().click(); run(.7)
  }
  return { instance, scene, camera, overlay, saved, complete, run, button, object, project, pointer, inspect }
}
describe('handle, hang and listen', () => {
  it('stops ring checkpoints when feedback disposes the scene', () => {
    let s: ReturnType<typeof mount>
    s = mount(2, { isReducedMotion: () => true, haptic: () => s.instance.dispose() })
    s.button().click()
    expect(s.saved).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('prepares pickup once even when a host feedback hook dispatches another action', () => {
    let s: ReturnType<typeof mount>, preparations = 0
    s = mount(0, { prepareFeedback: () => {
      if (++preparations === 1) s.button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    } })
    s.button().click(); s.run(.8)
    expect(preparations).toBe(1)
    expect(s.overlay.getAttribute('data-close-inspection')).toBe('viewing')
    expect(s.saved).toEqual([])
  })
  it('allows manual inspection without a timer, then hangs before accepting the original strike', () => {
    const s = mount()
    expect(s.button().textContent).toContain('拿近')
    const home = s.object('furin-pivot').position.clone()
    s.button().click(); s.run(.8)
    const view = s.camera.position.clone()
    s.pointer('pointerdown', [195, 210]); s.pointer('pointermove', [240, 230]); s.pointer('pointerup', [240, 230]); s.run(7)
    expect(s.camera.position.distanceTo(view)).toBeGreaterThan(.05)
    expect(s.overlay.getAttribute('data-close-inspection')).toBe('viewing')
    expect(s.saved).toEqual([])
    s.button().click(); s.run(.7)
    expect(s.saved).toEqual([1]); expect(s.button().textContent).toContain('挂')
    expect(s.object('furin-pivot').position.distanceTo(home)).toBeLessThan(.001)
    s.button().click(); s.run(.7)
    expect(s.saved).toEqual([1, 2])
    expect(s.object('furin-pivot').position.distanceTo(s.object('furin-eave-hook').position)).toBeLessThan(.001)
    s.button().click(); s.run(6)
    expect(s.saved).toEqual([1, 2, 3, 4, 5]); expect(s.complete).toHaveBeenCalledTimes(1)
  })
  it('hangs only after a real drop near the hook and cancels wrong or interrupted drags', () => {
    let active = true
    const s = mount(1, { isActive: () => active })
    const actor = s.object('furin-pivot'), home = actor.position.clone()
    const from = s.project(actor.getWorldPosition(new THREE.Vector3()).add(new THREE.Vector3(0, -.15, 0)))
    s.pointer('pointerdown', from); s.pointer('pointermove', [from[0] + 8, from[1] + 40]); s.pointer('pointerup', [from[0] + 8, from[1] + 40])
    expect(s.saved).toEqual([]); expect(actor.position.distanceTo(home)).toBeLessThan(.001)
    s.pointer('pointerdown', from); active = false; s.instance.update(.025); active = true; s.instance.update(.025)
    s.pointer('pointerup', from); expect(s.saved).toEqual([])
    const top = s.project(home), target = s.project(s.object('furin-eave-hook').position)
    const to = [from[0] + target[0] - top[0], from[1] + target[1] - top[1]]
    s.pointer('pointerdown', from); s.pointer('pointermove', to); s.pointer('pointerup', to); s.run(.7)
    expect(s.saved).toEqual([2])
  })
  it('restores every new checkpoint without replaying preparation or awarding progress', () => {
    for (const n of [1, 2, 3, 4, 5]) {
      const s = mount(n)
      expect(s.saved).toEqual([])
      if (n >= 2) expect(s.object('furin-pivot').position.distanceTo(s.object('furin-eave-hook').position)).toBeLessThan(.001)
      if (n === 5) expect(s.instance.tapPreview?.()).toBe(true)
    }
  })
  it('accepts a hanging drag started on the small suspension loop', () => {
    const s = mount(1), actor = s.object('furin-pivot')
    const from = s.project(s.object('furin-hanging-loop').getWorldPosition(new THREE.Vector3()))
    const top = s.project(actor.position), target = s.project(s.object('furin-eave-hook').position)
    const to = [from[0] + target[0] - top[0], from[1] + target[1] - top[1]]
    s.pointer('pointerdown', from); s.pointer('pointermove', to); s.pointer('pointerup', to); s.run(.7)
    expect(s.saved).toEqual([2])
  })
  it('does not ring from the hanging click in reduced motion or accept a second finger', () => {
    const s = mount(1, { isReducedMotion: () => true })
    const actor = s.object('furin-pivot'), from = s.project(actor.position.clone().add(new THREE.Vector3(0, -.15, 0)))
    s.pointer('pointerdown', from); s.pointer('pointerdown', [from[0] + 20, from[1]], 2)
    s.pointer('pointerup', from, 2); s.pointer('pointerup', from)
    expect(s.saved).toEqual([])
    s.button().click()
    expect(s.saved).toEqual([2]); expect(s.object('furin-hanging-target').visible).toBe(false)
    s.button().dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
    expect(s.saved).toEqual([2])
    s.button().click(); expect(s.saved).toEqual([2, 3, 4])
  })
})
