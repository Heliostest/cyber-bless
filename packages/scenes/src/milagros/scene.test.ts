// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
// Isolate the existing object, geometry and callback contract from the ending clock.
// Real automatic endings are covered by quiet-ending-legacy-scenes and the craft integration suites.
vi.mock('../quiet-ending', () => ({ createQuietEnding: () => ({
  running: false, completing: true, sync() {}, update() {}, dispose() {},
}) }))

import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
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
  it.each(['heart', 'hand', 'home', 'flower'])('lets the hinted tray item choose %s directly', variant => {
    const index = ['heart', 'hand', 'home', 'flower'].indexOf(variant), onVariantChange = vi.fn()
    const s = mount(0, { initialVariant: 'flower', onVariantChange })
    const mesh = s.scene.getObjectByName(`milagros-symbol-${index}`)!
    expect((mesh.userData.interactionCues as InteractionCue[]).filter(cue => cue.enabled())).toHaveLength(1)
    const at = s.point(mesh.name)
    pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(1)
    expect(onVariantChange).toHaveBeenCalledExactlyOnceWith(variant)
  })
  it('quietly completes a returning charm by tapping the hung symbol', () => {
    let active = false
    const s = mount(2, { returning: true, initialVariant: 'flower', isActive: () => active })
    const at = s.point('milagros-symbol-3')
    pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    expect(s.complete).not.toHaveBeenCalled()
    active = true
    const cues = s.scene.getObjectByName('milagros-symbol-3')!.userData.interactionCues as InteractionCue[]
    expect(cues.filter(cue => cue.enabled()).map(cue => cue.kind)).toEqual(['tap'])
    pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
    pointer(s.hit, 'pointerdown', at); pointer(s.hit, 'pointerup', at)
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2, 3])('restores choice hints and the chosen action at checkpoint %i', checkpoint => {
    let active = true
    const s = mount(checkpoint, { initialVariant: 'flower', isActive: () => active })
    const enabled = () => {
      const cues: Array<{ object: THREE.Object3D; cue: InteractionCue }> = []
      s.scene.traverse(object => {
        for (const cue of (object.userData.interactionCues as InteractionCue[] | undefined) ?? []) {
          if (cue.enabled()) cues.push({ object, cue })
        }
      })
      return cues
    }
    expect(enabled().filter(({ cue }) => !cue.compact).map(({ object }) => object.name)).toEqual(checkpoint < 2 ? ['milagros-symbol-3'] : [])
    if (checkpoint === 0) expect(enabled().map(({ object }) => object.name)).toEqual([0,1,2,3].map(i => `milagros-symbol-${i}`))
    if (checkpoint < 2) expect(enabled()[0].cue.kind).toBe(checkpoint === 0 ? 'tap' : 'drag')
    if (checkpoint === 1) expect(enabled()[0].cue.destination).toBe(s.scene.getObjectByName('milagros-pin-target'))
    active = false
    expect(enabled()).toEqual([])
  })

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
  it('finishes the final action without saving an unsubmitted draft', () => {
    const s = mount(2)
    s.overlay.querySelector<HTMLInputElement>('input')!.value = '  谢谢一路陪伴  '
    s.action(); s.action()
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
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
