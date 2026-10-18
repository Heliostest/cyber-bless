// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneInstance } from './contract'
import { loadScene } from './registry'

const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, render() {}, dispose() {} }
  },
}))

const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); document.body.replaceChildren() })
function pointer(layer: HTMLElement, type: string, x: number, y: number, pointerType = 'touch') {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX: x, clientY: y, pointerId: 1, pointerType, button: 0, isPrimary: true })
  layer.dispatchEvent(event)
}

// Exercise real scene hit tests, cue directions, poses and checkpoint callbacks.
// Long drags and a small correction after full extension must be playable.
const DIRECTIONAL_SCENES = [
  ['malawi-sansi', 3], ['japanese-kendama', 3], ['chinese-diabolo', 3],
  ['korean-yutnori', 3], ['russian-matryoshka', 3], ['japanese-koinobori', 3],
  ['indian-charkha', 3], ['german-nutcracker', 3], ['mexican-molinillo', 3],
  ['chinese-suanpan', 3], ['mongolian-felt-ger', 3],
  ['peruvian-engraved-gourd', 2], ['venetian-glass-bead', 2], ['korean-bojagi-wrap', 2],
  ['vietnamese-bamboo-dragonfly', 2], ['indonesian-angklung', 2],
  ['weifang-paper-kite', 2], ['faroese-wool-knit', 2],
  ['turkish-ebru-paper', 2], ['chinese-shadow-puppet', 2], ['niue-shell-necklace', 2],
  ['polish-paper-cut', 2], ['uzbek-clay-bowl', 2],
] as const

it.each(DIRECTIONAL_SCENES)('%s accepts a full directional drag without a hidden maximum distance', async (id, steps) => {
  const module = await loadScene(id)
  for (let at = 0; at < steps; at++) for (const [distance, correction, release, cross = 0] of [[120, 0, 120], [180, 0, 180], [60, 12, 60], [60, 0, 180], [20, 0, 120], [120, 30, 90], [120, 0, 90, 60]]) {
    const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
    host.append(canvas, overlay); document.body.append(host)
    Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 408 } })
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 408 }) as DOMRect
    const progress: number[] = []
    const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at,
      onProgress: n => progress.push(n), isReducedMotion: () => true, isSoundEnabled: () => false })
    instances.push(instance); instance.start()
    const scene = rendered.scene!, camera = rendered.camera!
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const targets: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => {
      for (const cue of object.userData.interactionCues ?? []) if (cue.enabled() && (cue.direction || id === 'uzbek-clay-bowl' && cue.kind === 'rotate')) targets.push({ object, cue })
    })
    expect(targets).toHaveLength(id === 'chinese-diabolo' && at === 2 ? 2 : 1)
    const { object, cue } = (id === 'chinese-diabolo' && at === 2 ? targets.find(t => t.cue.direction?.[1] === 1) : targets[0])!, direction = new THREE.Vector2(...(cue.direction ?? [1, 0])).normalize()
    const point = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(camera)
    const x = (point.x + 1) * 195, y = (1 - point.y) * 204
    const layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
    layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
    pointer(layer, 'pointerdown', x, y)
    for (const amount of [distance / 2, distance, distance - correction, distance])
      pointer(layer, 'pointermove', x + direction.x * amount, y + direction.y * amount)
    if (cross) pointer(layer, 'pointermove', x + direction.x * distance - direction.y * cross, y + direction.y * distance + direction.x * cross)
    pointer(layer, 'pointerup', x + direction.x * release, y + direction.y * release)
    expect(progress, `step ${at}, distance ${distance}, correction ${correction}`).toEqual([at + 1])
    instance.dispose(); host.remove()
  }
})

it.each(DIRECTIONAL_SCENES.flatMap(([id]) => [[id, false], [id, true]] as const))('%s completes every physical step in sequence, reduced=%s', async (id, reduced) => {
  const module = await loadScene(id), width = reduced ? 320 : 390, height = 408
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  const progress: number[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: 0,
    onProgress: n => progress.push(n), isReducedMotion: () => reduced, isSoundEnabled: () => false })
  instances.push(instance); instance.start()
  const layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const type = reduced ? 'mouse' : 'touch'
  for (let step = 0; step < 3; step++) {
    const scene = rendered.scene!, camera = rendered.camera!
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const targets: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => {
      for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) targets.push({ object, cue })
    })
    expect(targets, `step ${step}`).toHaveLength(id === 'chinese-diabolo' && step === 2 ? 2 : 1)
    const { object, cue } = (id === 'chinese-diabolo' && step === 2 ? targets.find(t => t.cue.direction?.[1] === 1) : targets[0])!
    const point = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(camera)
    const x = (point.x + 1) * width / 2, y = (1 - point.y) * height / 2
    pointer(layer, 'pointerdown', x, y, type)
    let endX = x, endY = y
    if (cue.kind !== 'tap') {
      const direction = new THREE.Vector2(...(cue.direction ?? [1, 0])).normalize()
      for (const amount of [30, 60, 120]) pointer(layer, 'pointermove', x + direction.x * amount, y + direction.y * amount, type)
      endX += direction.x * 120; endY += direction.y * 120
    }
    pointer(layer, 'pointerup', endX, endY, type)
    for (let frame = 0; frame < 40; frame++) instance.update(.05)
    expect(progress, `step ${step}`).toEqual([1, 2, 3].slice(0, step + 1))
  }
  expect(complete).toHaveBeenCalledOnce()
  // Repeated releases after completion cannot advance or emit completion twice.
  pointer(layer, 'pointerup', 0, 0, type); instance.update(.05)
  expect(progress).toEqual([1, 2, 3]); expect(complete).toHaveBeenCalledOnce()
})
