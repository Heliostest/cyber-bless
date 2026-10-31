// @vitest-environment jsdom
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { loadScene } from './registry'
import type { SceneContext, SceneInstance } from './contract'

// Replace GPU work only. These tests use each actual scene, its real form,
// lifecycle callbacks and the real quiet-ending helper.
const rendering = vi.hoisted(() => ({ frames: 0 }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    return { setStyle() {}, resize() {}, dispose() {}, render() {
      rendering.frames++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    } }
  },
}))

const ids = [
  'chinese-shadow-puppet', 'chinese-woodblock-print', 'niue-shell-necklace',
  'peruvian-engraved-gourd', 'polish-paper-cut', 'turkish-ebru-paper',
  'hungarian-embroidery-hoop', 'welsh-love-spoon',
] as const
const instances: SceneInstance[] = []
beforeEach(() => {
  rendering.frames = 0
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(390)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(408)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 390, height: 408 } as DOMRect)
})
afterEach(() => { instances.splice(0).forEach(scene => scene.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })

async function mount(id: typeof ids[number], options: { initial?: number; reduced?: boolean; returning?: boolean } = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  const progress = vi.fn(), complete = vi.fn(), saveWish = vi.fn(), active = { value: true }
  overlay.addEventListener('scene:complete', complete)
  const module = await loadScene(id)
  const context: SceneContext = { canvas, overlay, gestures: Gestures, shared: Shared,
    initialProgress: options.initial ?? 2, isActive: () => active.value,
    isReducedMotion: () => !!options.reduced, isSoundEnabled: () => false,
    returning: options.returning, onProgress: progress, saveWish }
  const instance = module.create(context); instances.push(instance); instance.start()
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  hit.setPointerCapture = vi.fn(); hit.releasePointerCapture = vi.fn()
  const tick = (seconds: number) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const legacyTap = () => {
    for (const type of ['pointerdown', 'pointerup']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      Object.assign(event, { pointerId: 1, isPrimary: true, pointerType: 'touch', button: 0, clientX: 195, clientY: 204 })
      hit.dispatchEvent(event)
    }
    button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }))
    button.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true }))
  }
  return { instance, overlay, hit, button, progress, complete, saveWish, active, tick, legacyTap }
}

describe.each(ids)('%s automatic product ending', id => {
  it.each([false, true])('finishes once after the animation, with no legacy tap shortcut; reduced=%s', async reduced => {
    const s = await mount(id, { reduced })
    expect(s.progress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(true); expect(s.overlay.dataset.quietEnding).toBe('true')
    s.legacyTap(); s.tick(reduced ? .45 : 2.8)
    expect(s.progress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    s.tick(.3)
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(3); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
    s.legacyTap(); s.tick(4)
    expect(s.progress).toHaveBeenCalledOnce(); expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each([0, 1])('preserves the actual craft action at checkpoint %i', async initial => {
    const s = await mount(id, { initial }); s.tick(4)
    expect(s.overlay.dataset.quietEnding).toBeUndefined()
    expect(s.progress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })

  it('pauses its animation with the host and resumes the remaining active time', async () => {
    const s = await mount(id); s.tick(1); s.active.value = false; s.tick(4)
    expect(s.progress).not.toHaveBeenCalled()
    s.active.value = true; s.tick(1.7); expect(s.progress).not.toHaveBeenCalled()
    s.tick(.4); expect(s.progress).toHaveBeenCalledExactlyOnceWith(3)
  })

  it('retains focused, composing and nonempty drafts until explicit submission', async () => {
    const s = await mount(id), input = s.overlay.querySelector<HTMLInputElement>('input')!
    input.focus(); input.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true }))
    s.tick(4); expect(s.progress).not.toHaveBeenCalled()
    input.value = '  心愿留在这里  '
    input.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true })); input.blur()
    s.tick(4); expect(s.progress).not.toHaveBeenCalled(); expect(input.value).toBe('  心愿留在这里  ')
    input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('心愿留在这里')
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(3); expect(s.complete).toHaveBeenCalledOnce()
  })

  it('automatically closes a returning visit without creating a wish', async () => {
    const s = await mount(id, { returning: true }); expect(s.overlay.querySelector('input')).toBeNull()
    s.tick(3.1); expect(s.progress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })

  it('never restarts an already completed save or reports completion again', async () => {
    const s = await mount(id, { initial: 3 }); s.instance.start(); s.tick(4); s.legacyTap()
    expect(s.overlay.dataset.quietEnding).toBeUndefined()
    expect(s.progress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })

  it('releases the ending on disposal and ignores retained events and updates', async () => {
    const s = await mount(id); s.tick(1); s.instance.dispose(); const frames = rendering.frames
    s.instance.dispose(); s.legacyTap(); s.tick(4)
    expect(s.overlay.childElementCount).toBe(0); expect(rendering.frames).toBe(frames)
    expect(s.progress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })
})
