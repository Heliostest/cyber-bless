// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    setPixelRatio() {} setClearColor() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera
    return {
    setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(); camera.updateMatrixWorld() },
    }
  },
}))
import { createMilagros } from './scene'
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren() })
function mount(progress = 0, extra: Partial<SceneContext> = {}) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 360 }, clientHeight: { value: 360 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 }) as DOMRect
  const onProgress = vi.fn(), saveWish = vi.fn()
  let active = true
  const instance = createMilagros({ canvas, overlay, gestures: Gestures, shared: Shared,
    initialProgress: progress, onProgress, saveWish, isReducedMotion: () => true,
    isActive: () => active, isSoundEnabled: () => false, ...extra })
  instances.push(instance)
  const complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  instance.start(); instance.update(0.1)
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const action = () => button.click()
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const point = (name: string): [number, number] => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [(p.x + 1) * 180, (1 - p.y) * 180]
  }
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}
  return { canvas, overlay, instance, action, onProgress, saveWish, complete, point, hit, scene, pause: () => { active = false } }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 })
  el.dispatchEvent(event)
}
describe('milagros craft', () => {
  it('selects and hangs a charm, then saves its phrase and completes once', () => {
    const s = mount()
    s.action(); s.instance.update(1); s.action(); s.instance.update(1)
    const input = s.overlay.querySelector<HTMLInputElement>('input')!
    input.value = '谢谢一路陪伴'
    s.overlay.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    s.action()
    expect(s.onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2, 3])
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢一路陪伴')
    expect(s.complete).toHaveBeenCalledOnce()
    s.instance.dispose()
  })
  it.each([1, 2, 3])('restores %i silently', progress => {
    const s = mount(progress)
    expect(s.onProgress).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    if (progress === 3) expect(s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.hidden).toBe(true)
    s.instance.dispose()
  })
  it('does not let paused or disposed controls advance the scene', () => {
    const s = mount(); s.pause(); s.action()
    expect(s.onProgress).not.toHaveBeenCalled()
    s.instance.dispose(); s.instance.dispose(); s.action()
    expect(s.onProgress).not.toHaveBeenCalled()
    expect(s.overlay.children).toHaveLength(0)
  })
  it('restores the chosen object without emitting a new choice', () => {
    const onVariantChange = vi.fn()
    const s = mount(2, { initialVariant: 'flower', onVariantChange })
    expect(s.scene.getObjectByName('milagros-charm-3')!.position.y).toBe(1.22)
    expect(s.scene.getObjectByName('milagros-charm-0')!.position.y).toBe(0.41)
    expect(onVariantChange).not.toHaveBeenCalled()
  })
  it('rejects cancellation and a second pointer outside the scene before accepting a valid hang', () => {
    const s = mount(1)
    const start = s.point('milagros-symbol-0'), pin = s.point('milagros-pin-target')
    pointer(s.hit, 'pointerdown', start)
    pointer(s.hit, 'pointercancel', pin)
    expect(s.onProgress).not.toHaveBeenCalled()
    pointer(s.hit, 'pointerdown', start, 1)
    pointer(document.body, 'pointerdown', [2, 2], 2)
    pointer(document.body, 'pointerup', [2, 2], 2)
    pointer(s.hit, 'pointerup', pin, 1)
    expect(s.onProgress).not.toHaveBeenCalled()
    pointer(s.hit, 'pointerdown', start, 3)
    pointer(s.hit, 'pointermove', pin, 3)
    pointer(s.hit, 'pointerup', pin, 3)
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(2)
  })
  it('does not let a second finger on the action button hang the held charm', () => {
    const s = mount(1)
    const button = s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
    pointer(s.hit, 'pointerdown', s.point('milagros-symbol-0'), 1)
    pointer(button, 'pointerdown', [2, 2], 2)
    pointer(button, 'pointerup', [2, 2], 2)
    button.click()
    expect(s.onProgress).not.toHaveBeenCalled()
    pointer(s.hit, 'pointerup', s.point('milagros-pin-target'), 1)
    button.click()
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(2)
  })
})
