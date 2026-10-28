// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'

// Only the GPU boundary is replaced: the folded geometry and its normals,
// scene lifecycle and completion callbacks are real.
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    drawn.scene = scene
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))

import { createCrane } from './scene'

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach(instance => instance.dispose())
  document.body.replaceChildren()
  vi.restoreAllMocks()
  vi.unstubAllGlobals()
})

function mount(initialProgress = 3, extra: Partial<SceneContext> = {}, start = true) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 520 }) as DOMRect
  const onProgress = vi.fn(), saveWish = vi.fn(), onVariantChange = vi.fn(), haptic = vi.fn(), prepareFeedback = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createCrane({ canvas, overlay, gestures, shared, initialProgress, onProgress, saveWish, onVariantChange, haptic, prepareFeedback,
    isSoundEnabled: () => false, ...extra })
  instances.push(instance)
  if (start) { instance.start(); instance.update(0.01) }
  complete.mockClear()
  const mesh = drawn.scene!.getObjectByName('origami-sheet') as THREE.Mesh
  const positions = () => Array.from(mesh.geometry.getAttribute('position').array)
  const run = (seconds = 3) => { for (let i = 0; i < Math.ceil(seconds / 0.02); i++) instance.update(0.02) }
  const callbacks = [onProgress, saveWish, onVariantChange, haptic, prepareFeedback, complete]
  return { instance, overlay, mesh, positions, run, callbacks }
}

describe('completed crane display tap', () => {
  it('flaps actual wings in both directions, settles exactly and leaves completion state untouched', () => {
    const s = mount(), rest = s.positions(), markup = s.overlay.innerHTML
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.2)
    const up = s.positions()
    expect(up).not.toEqual(rest)
    s.run(0.4)
    const down = s.positions()
    expect(down).not.toEqual(up)
    // The two wing tips cross their rest positions during the gentle flap.
    const delta = rest.map((value, i) => (up[i] - value) * (down[i] - value))
    expect(delta.some(value => value < -1e-7)).toBe(true)
    s.run()
    expect(s.positions()).toEqual(rest)
    expect(s.overlay.innerHTML).toBe(markup)
    s.callbacks.forEach(callback => expect(callback).not.toHaveBeenCalled())
  })

  it('bounds rapid retriggers and restores the original mesh after the last tap', () => {
    const s = mount(), rest = s.positions()
    for (let i = 0; i < 80; i++) { expect(s.instance.tapPreview?.()).toBe(true); s.instance.update(0.02) }
    const moved = s.positions()
    expect(Math.max(...rest.map((value, i) => Math.abs(value - moved[i])))).toBeLessThan(0.1)
    s.run()
    expect(s.positions()).toEqual(rest)
    s.callbacks.forEach(callback => expect(callback).not.toHaveBeenCalled())
  })

  it('leaves audio to the preview host even when scene sound is enabled', () => {
    // Any scene sound would lazily request a context; no Web Audio allocation
    // is needed to check this completed-object route remains silent itself.
    const audioContext = vi.fn(function AudioBoundary() { throw new Error('unexpected scene audio') })
    vi.stubGlobal('AudioContext', audioContext)
    const s = mount(3, { isSoundEnabled: () => true })
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run()
    expect(audioContext).not.toHaveBeenCalled()
    s.callbacks.forEach(callback => expect(callback).not.toHaveBeenCalled())
  })

  it.each([0, 1, 2])('rejects taps before completion at checkpoint %i', checkpoint => {
    const s = mount(checkpoint), rest = s.positions()
    expect(s.instance.tapPreview?.()).toBe(false)
    s.run(0.2)
    expect(s.positions()).toEqual(rest)
    s.callbacks.forEach(callback => expect(callback).not.toHaveBeenCalled())
  })

  it('rejects taps before start, while inactive, and after disposal', () => {
    let active = true
    const s = mount(3, { isActive: () => active }, false)
    expect(s.instance.tapPreview?.()).toBe(false)
    s.instance.start(); s.instance.update(0.01)
    active = false
    expect(s.instance.tapPreview?.()).toBe(false)
    active = true
    expect(s.instance.tapPreview?.()).toBe(true)
    s.instance.dispose()
    expect(s.instance.tapPreview?.()).toBe(false)
  })

  it('cancels and restores a running flap when motion is reduced, with no replay on resume', () => {
    let reduced = false
    const s = mount(3, { isReducedMotion: () => reduced }), rest = s.positions()
    s.instance.tapPreview?.(); s.run(0.2)
    expect(s.positions()).not.toEqual(rest)
    reduced = true
    expect(s.instance.tapPreview?.()).toBe(true)
    expect(s.positions()).toEqual(rest)
    s.instance.update(0.02)
    expect(s.positions()).toEqual(rest)
    expect(s.instance.tapPreview?.()).toBe(true)
    s.run(0.2)
    expect(s.positions()).toEqual(rest)
    reduced = false; s.run(0.2)
    expect(s.positions()).toEqual(rest)
    s.callbacks.forEach(callback => expect(callback).not.toHaveBeenCalled())
  })

  it('restores a running flap on pause and waits for a fresh tap after resume', () => {
    let active = true
    const s = mount(3, { isActive: () => active }), rest = s.positions()
    s.instance.tapPreview?.(); s.run(0.2)
    expect(s.positions()).not.toEqual(rest)
    active = false; s.instance.update(0.02)
    expect(s.positions()).toEqual(rest)
    active = true; s.run(0.2)
    expect(s.positions()).toEqual(rest)
    s.callbacks.forEach(callback => expect(callback).not.toHaveBeenCalled())
  })
})
