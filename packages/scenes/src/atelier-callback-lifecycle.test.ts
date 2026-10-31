// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
// Isolate the existing object, geometry and callback contract from the ending clock.
// Real automatic endings are covered by quiet-ending-legacy-scenes and the craft integration suites.
vi.mock('./quiet-ending', () => ({ createQuietEnding: () => ({
  running: false, completing: true, sync() {}, update() {}, dispose() {},
}) }))

import * as THREE from 'three'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import type { SceneContext, SceneInstance, SceneModule } from './contract'
import * as indigo from './bai-indigo-cloth'
import * as house from './ndebele-painted-house'
import * as copper from './purepecha-copper-bowl'
import * as spoon from './welsh-love-spoon'

// Replace only the GPU boundary; actual geometry, cues, forms and feedback run.
const frames = vi.hoisted(() => ({ count: 0, afterDispose: 0 }))
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
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    let disposed = false
    return {
      setStyle() {}, resize() {},
      render() {
        frames.count++; if (disposed) frames.afterDispose++
        scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update()
      },
      dispose() { disposed = true; cues.dispose() },
    }
  } }
})

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren(); vi.restoreAllMocks()
  frames.count = 0; frames.afterDispose = 0
})
function mount(module: SceneModule, initialProgress: number, overrides: Partial<SceneContext>) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 350 }, clientHeight: { value: 408 } })
  canvas.getBoundingClientRect = () => ({ left: 20, top: 100, width: 350, height: 408 }) as DOMRect
  const onProgress = vi.fn(), saveWish = vi.fn(), haptic = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = module.create({ canvas, overlay, gestures, shared, initialProgress,
    isSoundEnabled: () => false, onProgress, saveWish, haptic, ...overrides })
  instances.push(instance); instance.start(); instance.update(.025)
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const run = () => { for (let i = 0; i < 40; i++) instance.update(.025) }
  const write = () => {
    const input = overlay.querySelector<HTMLInputElement>('input')!
    input.value = '  愿晴日常伴  '
    input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  return { instance, overlay, button, onProgress, saveWish, haptic, complete, run, write }
}

describe.each([indigo, house, copper, spoon])('$meta.id callback lifetime', module => {
  it.each([
    [0, 'dispose'], [1, 'dispose'], [2, 'dispose'],
    [0, 'pause'], [1, 'pause'], [2, 'pause'],
  ] as const)('stops feedback and the current frame when step %i progress causes %s', (at, effect) => {
    let active = true, stoppedAt = -1
    const progress: number[] = []
    const s = mount(module, at, {
      isActive: () => active,
      onProgress(n) {
        progress.push(n); stoppedAt = frames.count
        if (effect === 'dispose') s.instance.dispose()
        else active = false
      },
    })
    s.button.click()
    for (let i = 0; i < 40 && progress.length === 0; i++) s.instance.update(.025)
    expect(progress).toEqual([at + 1])
    expect(s.haptic).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    expect(frames.count).toBe(stoppedAt)
    s.run(); s.button.click()
    expect(progress).toEqual([at + 1])
    if (effect === 'dispose') {
      expect(frames.count).toBe(stoppedAt)
      expect(s.overlay.childElementCount).toBe(0)
    } else {
      active = true; s.run()
      expect(s.button.hidden).toBe(at === 2)
      expect(progress).toEqual([at + 1])
    }
    expect(frames.afterDispose).toBe(0)
    expect(s.haptic).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
  })

  it.each(['dispose', 'pause'])('does not dispatch completion after haptic causes %s', effect => {
    let active = true
    const haptic = vi.fn(() => { if (effect === 'dispose') s.instance.dispose(); else active = false })
    const s = mount(module, 2, { haptic, isActive: () => active })
    s.button.click()
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(haptic).toHaveBeenCalledOnce()
    expect(s.complete).not.toHaveBeenCalled()
    active = true; s.run(); s.button.click()
    expect(s.onProgress).toHaveBeenCalledOnce()
    expect(haptic).toHaveBeenCalledOnce()
    expect(s.complete).not.toHaveBeenCalled()
    expect(frames.afterDispose).toBe(0)
  })
})

describe.each([indigo, spoon])('$meta.id accepted wish lifetime', module => {
  it('stops progress and feedback when saving disposes the scene', () => {
    const saveWish = vi.fn(() => s.instance.dispose())
    const s = mount(module, 2, { saveWish })
    s.write(); s.run(); s.button.click()
    expect(saveWish).toHaveBeenCalledExactlyOnceWith('愿晴日常伴')
    expect(s.onProgress).not.toHaveBeenCalled()
    expect(s.haptic).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.overlay.childElementCount).toBe(0)
    expect(frames.afterDispose).toBe(0)
  })

  it('commits an accepted wish and checkpoint once across a pause during saving', () => {
    let active = true
    const saveWish = vi.fn(() => { active = false })
    const s = mount(module, 2, { saveWish, isActive: () => active })
    s.write()
    expect(saveWish).toHaveBeenCalledExactlyOnceWith('愿晴日常伴')
    expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.haptic).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    s.run(); active = true; s.run(); s.button.click()
    expect(saveWish).toHaveBeenCalledOnce()
    expect(s.onProgress).toHaveBeenCalledOnce()
    expect(s.button.hidden).toBe(true)
    expect(s.overlay.querySelector('input')).toBeNull()
    expect(s.haptic).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
  })
})
