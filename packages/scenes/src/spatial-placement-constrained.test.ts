// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, expect, it, vi } from 'vitest'
import * as gestures from '@wbr/gestures'
import * as shared from '@wbr/shared'
import { loadScene } from './registry'
import type { SceneContext, SceneInstance } from './contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'

const frame = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer { shadowMap = { enabled: false, type: 0 }; setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {} }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({ createDebugRenderStyle(_r: unknown, scene: THREE.Scene, camera: THREE.Camera) {
  frame.scene = scene; frame.camera = camera
  return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) } }
} }))
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
type Point = [number, number]
async function mount(id: string, at = 0, width = 390, extra: Partial<SceneContext> = {}) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div'), height = 408
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 17, top: 89, width, height }) as DOMRect
  const progress: number[] = [], variants: string[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const module = await loadScene(id), instance = module.create({ canvas, overlay, gestures, shared,
    initialProgress: at, isReducedMotion: () => true, isSoundEnabled: () => false,
    onProgress: n => progress.push(n), onVariantChange: value => variants.push(value), ...extra })
  instances.push(instance); instance.start(); instance.update(0)
  const scene = frame.scene as THREE.Scene, camera = frame.camera as THREE.Camera
  const layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  layer.setPointerCapture = vi.fn(); layer.releasePointerCapture = vi.fn()
  const project = (world: THREE.Vector3): Point => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const p = world.project(camera); return [17 + (p.x + 1) * width / 2, 89 + (1 - p.y) * height / 2] }
  const cue = () => {
    let found: { object: THREE.Object3D; cue: InteractionCue } | undefined
    scene.traverse(object => { for (const item of object.userData.interactionCues ?? []) if (item.enabled()) found = { object, cue: item } })
    expect(found).toBeDefined(); return found!
  }
  const points = () => {
    const entry = cue(), d = entry.cue.destination
    expect(d, 'the actual object advertises its spatial target').toBeDefined()
    return { from: project(entry.object.localToWorld(new THREE.Vector3(...(entry.cue.anchor ?? [0, 0, 0])))),
      to: project(typeof d === 'function' ? d() : d!.getWorldPosition(new THREE.Vector3())) }
  }
  const run = () => { for (let i = 0; i < 60; i++) instance.update(.05) }
  const input = (type: string, [clientX, clientY]: Point, pointerId = 1, target: HTMLElement = layer) => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0,
      buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, isPrimary: pointerId === 1 }); target.dispatchEvent(event)
  }
  return { scene, overlay, progress, variants, complete, cue, points, input, run, instance }
}
it.each([320, 390, 1280])('suanpan beads follow their physical rods to the beam at %ipx', async width => {
  const s = await mount('chinese-suanpan', 0, width)
  for (let at = 0; at < 3; at++) {
    const { object } = s.cue(), { from, to } = s.points(), home = object.position.clone()
    s.input('pointerdown', from)
    const dx = to[0] - from[0], dy = to[1] - from[1], length = Math.hypot(dx, dy)
    s.input('pointermove', [from[0] - dy / length * 30, from[1] + dx / length * 30])
    expect(object.position.x).toBe(home.x); expect(object.position.y).toBe(home.y)
    expect(s.progress).toHaveLength(at)
    s.input('pointermove', [from[0] + dx * .3, from[1] + dy * .3])
    expect(Math.abs(object.position.z - home.z)).toBeGreaterThan(.03)
    s.input('pointercancel', from); expect(object.position.distanceTo(home)).toBeLessThan(1e-8)
    s.input('pointerdown', from); s.input('pointermove', to); s.run()
    expect(s.progress).toEqual([1, 2, 3].slice(0, at + 1))
    expect(object.position.x).toBe(home.x); expect(object.position.y).toBe(home.y)
    s.input('pointerup', to)
  }
  expect(s.complete).toHaveBeenCalledOnce()
})
it('suanpan keeps an arrived physical touch locked across host pause and resume', async () => {
  let active = true
  const s = await mount('chinese-suanpan', 0, 390, { isActive: () => active })
  const first = s.points()
  s.input('pointerdown', first.from); s.input('pointermove', first.to); s.run()
  expect(s.progress).toEqual([1])

  active = false; s.instance.update(0)
  active = true; s.instance.update(0)
  const second = s.points(), button = s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  expect(button).not.toBeNull()
  // A second finger may tap the DOM button while the first finger remains down.
  s.input('pointerdown', second.from, 2, button)
  s.input('pointerup', second.from, 2, button); button.click(); s.run()
  expect(s.progress).toEqual([1])
  // Neither a new pointer nor the arrived pointer's tail can grab the next bead.
  s.input('pointerdown', second.from, 2); s.input('pointermove', second.to, 2)
  s.input('pointerup', second.to, 2)
  s.input('pointermove', second.from); s.input('pointermove', second.to); s.run()
  expect(s.progress).toEqual([1])

  s.input('pointerup', first.to)
  s.input('pointerdown', second.from); s.input('pointermove', second.to); s.run()
  expect(s.progress).toEqual([1, 2])
  s.input('pointermove', first.to); s.input('pointerup', second.to); s.run()
  expect(s.progress).toEqual([1, 2])
})
it.each(['pointerup', 'pointercancel'])('suanpan releases a paused arrival lock on the original %s', async ending => {
  let active = true
  const s = await mount('chinese-suanpan', 0, 390, { isActive: () => active })
  const first = s.points()
  s.input('pointerdown', first.from); s.input('pointermove', first.to); s.run()
  active = false; s.instance.update(0)
  // A real terminal event during the pause must clear the physical tail lock.
  s.input(ending, first.to)
  active = true; s.instance.update(0); s.run()
  expect(s.progress).toEqual([1])
  const second = s.points()
  s.input('pointerdown', second.from); s.input('pointermove', second.to); s.run()
  expect(s.progress).toEqual([1, 2])
  s.input('pointerup', second.to); s.run()
  expect(s.progress).toEqual([1, 2])
})
it.each([true, false])('water bowls accept each current jug target separately and keep seven fills ordered, reduced=%s', async reduced => {
  const s = await mount('tibetan-water-bowls', 0, 390, { isReducedMotion: () => reduced })
  const heights = () => Array.from({ length: 7 }, (_, i) => new THREE.Box3().setFromObject(s.scene.getObjectByName(`offering-water-${i}`)!).max.y)
  for (let at = 0; at < 9; at++) {
    const before = heights(), { from, to } = s.points()
    s.input('pointerdown', from); s.input('pointermove', to); s.run()
    expect(s.progress).toEqual(Array.from({ length: at + 1 }, (_, i) => i + 1))
    const after = heights()
    for (let bowl = 0; bowl < 7; bowl++) {
      if (at >= 1 && at <= 7 && bowl === at - 1) expect(after[bowl]! - before[bowl]!).toBeGreaterThan(.08)
      else expect(after[bowl]).toBeCloseTo(before[bowl]!, 6)
    }
    s.input('pointermove', from); s.run(); expect(s.progress).toHaveLength(at + 1)
    s.input('pointerup', to)
  }
  expect(s.complete).toHaveBeenCalledOnce()
})
it.each([[0, 5], [7, 3], [15, 4]] as const)('yut token goes to the current roll target, mask=%i', async (mask, steps) => {
  const s = await mount('korean-yutnori', 2, 390, { initialVariant: `yut1-0-${mask}-1-move` })
  const { from, to } = s.points(), token = s.scene.getObjectByName('yut-token')!, y = token.position.y
  s.input('pointerdown', from); s.input('pointermove', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2])
  expect(token.position.y).toBeCloseTo(y, 6)
  s.input('pointermove', to); s.run()
  expect(s.variants.at(-1)).toBe(`yut1-${steps}-${mask}-1-again`)
  const finish = s.overlay.querySelector<HTMLButtonElement>('.scene-yut-finish')!
  finish.click(); expect(s.complete).not.toHaveBeenCalled()
  s.input('pointerup', to); finish.click(); s.run()
  expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
})
