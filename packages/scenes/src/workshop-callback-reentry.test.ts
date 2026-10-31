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
import * as bird from './slovak-wire-bird'
import * as hoop from './hungarian-embroidery-hoop'
import * as tile from './andalusian-ceramic-tile'
import * as cart from './sicilian-painted-cart'

// Only GPU drawing is replaced. Real meshes, ray hits, cues, forms and feedback run.
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
    return { setStyle() {}, resize() {},
      render() { frames.count++; if (disposed) frames.afterDispose++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() },
      dispose() { disposed = true; cues.dispose() },
    }
  } }
})

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren(); vi.restoreAllMocks(); frames.count = 0; frames.afterDispose = 0
})
function mount(module: SceneModule, at = 0, overrides: Partial<SceneContext> = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 350 }, clientHeight: { value: 408 } })
  canvas.getBoundingClientRect = () => ({ left: 20, top: 100, width: 350, height: 408 }) as DOMRect
  const onProgress = vi.fn(), saveWish = vi.fn(), haptic = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = module.create({ canvas, overlay, gestures, shared, initialProgress: at,
    isSoundEnabled: () => false, onProgress, saveWish, haptic, ...overrides })
  instances.push(instance); instance.start(); instance.update(.025)
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!, hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const run = () => { for (let i = 0; i < 40; i++) instance.update(.025) }
  const point = (role = 'source'): [number, number] => {
    const cue = host.querySelector<HTMLElement>(`[data-cue-role="${role}"]`)!
    expect(cue, `visible ${role} cue`).not.toBeNull()
    return [20 + Number(cue.dataset.x), 100 + Number(cue.dataset.y)]
  }
  const physical = (final = false, pointerId = 1) => {
    const a = point(), b = final ? a : point('target')
    pointer(hit, 'pointerdown', a, pointerId)
    if (!final) pointer(hit, 'pointermove', b, pointerId)
    pointer(hit, 'pointerup', b, pointerId); run()
  }
  const write = () => {
    const input = overlay.querySelector<HTMLInputElement>('input')!
    input.value = '  愿晴日常伴  '; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  return { instance, host, overlay, button, hit, point, physical, onProgress, saveWish, haptic, complete, run, write }
}
function pointer(hit: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId: number) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); hit.dispatchEvent(event)
}

describe.each([bird, hoop, tile, cart])('$meta.id commits one action across callbacks', module => {
  it.each([[0, 'progress'], [1, 'progress'], [0, 'haptic'], [1, 'haptic']] as const)(
    'does not consume another step when step %i %s callback triggers input and update', (at, callback) => {
      const progress: number[] = []; let reenter = () => {}
      const s = mount(module, at, {
        onProgress(n) { progress.push(n); if (callback === 'progress') reenter() },
        haptic() { if (callback === 'haptic') reenter() },
      })
      reenter = () => { s.button.dispatchEvent(new MouseEvent('click', { bubbles: true })); s.run() }
      s.button.click(); s.run()
      expect(progress).toEqual([at + 1]); expect(s.complete).not.toHaveBeenCalled()
      reenter = () => {}; s.button.click(); s.run()
      expect(progress).toEqual([at + 1, at + 2])
    },
  )
  it('does not recursively accept keyboard input while preparing feedback', () => {
    let reenter = () => {}, once = true
    const s = mount(module, 0, { isReducedMotion: () => true, prepareFeedback() { if (once) { once = false; reenter() } } })
    reenter = () => s.button.dispatchEvent(new MouseEvent('click', { bubbles: true }))
    s.button.click(); expect(s.onProgress.mock.calls.map(([n]) => n)).toEqual([1])
    s.button.click(); expect(s.onProgress.mock.calls.map(([n]) => n)).toEqual([1, 2])
  })
  it.each(['progress', 'haptic'] as const)('ignores a complete physical drag injected by the %s callback', callback => {
    const progress: number[] = []; let reenter = () => {}
    const s = mount(module, 0, {
      onProgress(n) { progress.push(n); if (callback === 'progress') reenter() },
      haptic() { if (callback === 'haptic') reenter() },
    })
    reenter = () => { s.instance.update(0); s.physical() }
    s.button.click(); s.run(); expect(progress).toEqual([1])
    reenter = () => {}; s.physical(); expect(progress).toEqual([1, 2])
  })
  it.each([0, 2])('discards an old pointer if preparation pauses the host at step %i', at => {
    let active = true, pauseNext = false, hostPause = () => {}
    const s = mount(module, at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback() {
      if (pauseNext) { pauseNext = false; active = false; hostPause() }
    } })
    hostPause = () => s.instance.update(0)
    const a = s.point(); pointer(s.hit, 'pointerdown', a, 1); pointer(s.hit, 'pointercancel', a, 1)
    pauseNext = true; pointer(s.hit, 'pointerdown', a, 2)
    const cues = s.host.querySelector<HTMLElement>('.scene-object-cues')!
    expect(cues.hidden || cues.querySelectorAll('[data-cue-role="source"]').length === 0).toBe(true)
    active = true; s.instance.update(0); pointer(s.hit, 'pointerup', a, 2)
    expect(s.onProgress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    s.physical(at === 2, 3); expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(at + 1)
  })
  it('hides cues when progress pauses synchronously and restores them without replay', () => {
    let active = true, hostPause = () => {}
    const s = mount(module, 0, { isReducedMotion: () => true, isActive: () => active, onProgress() { active = false; hostPause() } })
    hostPause = () => s.instance.update(0); s.button.click()
    const cues = s.host.querySelector<HTMLElement>('.scene-object-cues')!
    expect(cues.hidden || cues.querySelectorAll('[data-cue-role="source"]').length === 0).toBe(true)
    const stoppedAt = frames.count; s.run(); expect(frames.count).toBeLessThanOrEqual(stoppedAt + 1)
    active = true; s.instance.update(0)
    expect(cues.hidden).toBe(false); expect(s.point()).toHaveLength(2); expect(s.haptic).not.toHaveBeenCalled()
  })
  it('stops the interrupted frame and feedback when progress disposes the host', () => {
    let stoppedAt = -1
    const s = mount(module, 0, { onProgress() { stoppedAt = frames.count; s.instance.dispose() } })
    s.button.click(); s.run(); expect(frames.count).toBe(stoppedAt)
    expect(frames.afterDispose).toBe(0); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
  })
})

describe.each([hoop, tile])('$meta.id preserves explicit wish acceptance', module => {
  it('ignores an injected wish submission during the preceding progress callback', () => {
    const s = mount(module, 1, { onProgress(n) { if (n === 2) s.write() } })
    s.button.click(); s.run(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    s.write(); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿晴日常伴'); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each(['pause', 'dispose'] as const)('keeps save/checkpoint semantics when saving causes %s', effect => {
    let active = true
    const saveWish = vi.fn(() => { if (effect === 'dispose') s.instance.dispose(); else { active = false; s.instance.update(0) } })
    const s = mount(module, 2, { isActive: () => active, saveWish })
    s.write(); expect(saveWish).toHaveBeenCalledExactlyOnceWith('愿晴日常伴')
    if (effect === 'pause') expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    else expect(s.onProgress).not.toHaveBeenCalled()
    expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    active = true; s.run(); s.button.click(); expect(saveWish).toHaveBeenCalledOnce(); expect(frames.afterDispose).toBe(0)
  })
})
