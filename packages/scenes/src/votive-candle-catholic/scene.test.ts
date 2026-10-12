// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer { setPixelRatio() {} setClearColor() {} setSize() {} dispose() {} forceContextLoss() {} }
  return { ...actual, WebGLRenderer }
})
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_r: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) } }
  },
}))
import { createVotiveCandleCatholic } from './scene'
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren() })
function mount(at = 0, extra: Partial<SceneContext> = {}) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 360 }, clientHeight: { value: 360 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 }) as DOMRect
  let active = true
  const onProgress = vi.fn(), saveWish = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createVotiveCandleCatholic({ canvas, overlay, shared: Shared, gestures: Gestures,
    initialProgress: at, onProgress, saveWish, isActive: () => active, isReducedMotion: () => true,
    isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(.1)
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string): [number, number] => {
    const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [(p.x + 1) * 180, (1 - p.y) * 180]
  }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('input')!
    input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  return { overlay, instance, button, hit, point, write, onProgress, saveWish, complete, pause: () => { active = false } }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], id = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId: id, button: 0, pointerType: 'touch' }); el.dispatchEvent(e)
}
it('places, lights and leaves one written intention exactly once', () => {
  const s = mount(); expect(s.button).not.toBeNull()
  s.button.click(); s.button.click(); s.write('愿朋友平安'); s.write('重复'); s.button.click()
  expect(s.onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2, 3])
  expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿朋友平安'); expect(s.complete).toHaveBeenCalledOnce()
})
it.each([0, 1, 2, 3])('restores %i without effects', n => {
  const s = mount(n); expect(s.button).not.toBeNull(); s.instance.update(1)
  expect(s.onProgress).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  expect(Array.from(s.overlay.querySelectorAll<HTMLElement>('.scene-step-dot')).filter(d => d.dataset.state === 'done')).toHaveLength(n)
})
it('quiet completion and returning never save a default intention', () => {
  const s = mount(2, { returning: true }); expect(s.button).not.toBeNull(); s.button.click()
  expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
})
it('quiet viewing does not save an unfinished input draft', () => {
  const s = mount(2)
  s.overlay.querySelector<HTMLInputElement>('input')!.value = '还没写好的话'
  s.button.click()
  expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
})
it('uses real object rays for placement and lighting and rejects cancellation', () => {
  const s = mount(); expect(s.hit).not.toBeNull()
  pointer(s.hit, 'pointerdown', s.point('votive-held-target'))
  pointer(s.hit, 'pointercancel', s.point('votive-placement-target'))
  expect(s.onProgress).not.toHaveBeenCalled()
  pointer(s.hit, 'pointerdown', s.point('votive-held-target'))
  pointer(s.hit, 'pointermove', s.point('votive-placement-target'))
  pointer(s.hit, 'pointerup', s.point('votive-placement-target'))
  expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(1)
  pointer(s.hit, 'pointerdown', s.point('votive-wick-target'))
  pointer(s.hit, 'pointerup', s.point('votive-wick-target'))
  expect(s.onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2])
})
it('does not accept paused writing, button input or callbacks after disposal', () => {
  const s = mount(2); expect(s.button).not.toBeNull(); s.pause(); s.instance.update(0)
  s.write('不应保存'); s.button.click(); s.instance.dispose(); s.button.click()
  expect(s.onProgress).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
  expect(s.overlay.children).toHaveLength(0)
})
