// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import * as mod from './index'


// Keep real Three geometry, intersections and cues; replace only GPU work.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, render: vi.fn(), metadata: null as null | {id:string;label:string} }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this }
    setSize() {} setPixelRatio() {} setClearColor() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, metadata:{id:string;label:string}) {
    rendered.metadata=metadata
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    const render = vi.fn(() => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }); rendered.render = render
    return { setStyle() {}, resize() {}, render, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const height = width === 1280 ? 600 : width === 284 ? 390 : 408, left = 17, top = 91
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
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1.2) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, progress, saveWish, complete, haptic }
}

describe('Continuous clockwise prayer wheel', () => {
  it('keeps accepting pushes while turning, then automatically finishes after its quiet animation', () => {
    const s = mount(), finish = s.overlay.querySelector<HTMLButtonElement>('.scene-continuous-finish')!
    expect(finish.hidden).toBe(true)
    s.button.click(); expect(s.progress).toEqual([1]); expect(finish.hidden).toBe(false)
    for (let i = 0; i < 5; i++) { s.run(2); s.button.click() }
    expect(s.complete).not.toHaveBeenCalled(); expect(s.progress).not.toContain(3)
    for (let i = 0; i < 480 && !s.progress.includes(2); i++) s.run(.025)
    expect(s.progress).toEqual([1, 2]); expect(s.complete).not.toHaveBeenCalled()
    expect(finish.hidden).toBe(true); expect(s.button.hidden).toBe(true)
    s.run(1.5); s.button.click(); expect(s.progress).toEqual([1, 2])
    s.run(1.6); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    s.run(20); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('settles a turning wheel only after explicit finish and freezes while paused', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), finish = s.overlay.querySelector<HTMLButtonElement>('.scene-continuous-finish')!
    s.button.click(); finish.click(); active = false; s.run(20)
    expect(s.complete).not.toHaveBeenCalled()
    active = true; s.run(4); expect(s.complete).toHaveBeenCalledOnce(); expect(s.progress.at(-1)).toBe(3)
  })
  it('automatically finishes a restored quiet checkpoint and restores a completed checkpoint silently', () => {
    const quiet = mount(2), finish = quiet.overlay.querySelector<HTMLButtonElement>('.scene-continuous-finish')!
    expect(finish.hidden).toBe(true); expect(quiet.progress).toEqual([]); expect(quiet.complete).not.toHaveBeenCalled()
    quiet.button.click(); quiet.run(1.5); expect(quiet.progress).toEqual([])
    quiet.run(1.6); expect(quiet.progress).toEqual([3]); expect(quiet.complete).toHaveBeenCalledOnce()
    const done = mount(3); expect(done.progress).toEqual([]); expect(done.complete).not.toHaveBeenCalled()
    expect(done.overlay.querySelector<HTMLButtonElement>('.scene-continuous-finish')!.hidden).toBe(true)
    done.run(20); expect(done.progress).toEqual([]); expect(done.complete).not.toHaveBeenCalled()
  })
})
