// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'

type Cue = {
  object: THREE.Object3D
  options: {
    kind: 'tap' | 'drag' | 'rotate'
    label: string
    enabled: () => boolean
    anchor?: [number, number, number]
    destination?: THREE.Object3D | (() => THREE.Vector3)
  }
}

const built = vi.hoisted(() => ({ cues: [] as Cue[], scenes: [] as THREE.Scene[], cameras: [] as THREE.Camera[] }))
vi.mock('@wbr/scene-runtime/interaction-cues', () => ({
  addInteractionCue: (object: THREE.Object3D, options: Cue['options']) => {
    const cue = { object, options }
    built.cues.push(cue)
    return () => built.cues.splice(built.cues.indexOf(cue), 1)
  },
}))
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    built.scenes.push(scene)
    built.cameras.push(camera)
    return {
      setStyle() {},
      resize() {},
      render() {
        scene.updateMatrixWorld()
        camera.updateMatrixWorld()
      },
      dispose() {},
    }
  },
}))

import { loadScene } from '../registry'

const OWN_SCENES = ['tanzaku-tanabata', 'yeondeunghoe', 'furin-wind-chime', 'crane', 'lantern'] as const

async function mount(id: string, initialProgress = 0, extra: Partial<SceneContext> = {}, size: readonly [number, number] = [300, 300]) {
  const mod = await loadScene(id)
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  const [width, height] = size
  Object.defineProperties(canvas, {
    clientWidth: { configurable: true, value: width },
    clientHeight: { configurable: true, value: height },
  })
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, right: width, bottom: height, width, height }) as DOMRect
  const progress: number[] = []
  const haptic = vi.fn()
  const instance = mod.create({
    canvas, overlay, gestures: Gestures, shared: Shared, sceneId: id,
    initialProgress, onProgress: (n) => progress.push(n), haptic,
    isSoundEnabled: () => false, ...extra,
  })
  instance.start()
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  Object.defineProperty(hit, 'clientWidth', { configurable: true, value: width })
  hit.setPointerCapture = () => {}
  const run = (seconds: number) => {
    for (let t = 0; t < seconds; t += 0.05) instance.update(0.05)
  }
  run(0.05)
  return {
    instance, overlay, progress, haptic, run, hit,
    camera: built.cameras.at(-1)!, scene: built.scenes.at(-1)!,
    tap: () => overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click(),
    enabled: () => built.cues.filter((cue) => cue.options.enabled()),
  }
}

function anchorWorld(cue: Cue) {
  return cue.object.localToWorld(new THREE.Vector3(...(cue.options.anchor ?? [0, 0, 0])))
}

function tapCue(s: Awaited<ReturnType<typeof mount>>, cue: Cue) {
  const projected = anchorWorld(cue).project(s.camera)
  const x = (projected.x + 1) * 150
  const y = (1 - projected.y) * 150
  for (const type of ['pointerdown', 'pointerup']) {
    const event = new Event(type)
    Object.assign(event, { clientX: x, clientY: y, pointerId: 1, buttons: type === 'pointerup' ? 0 : 1 })
    s.hit.dispatchEvent(event)
  }
}

function pointerAt(s: Awaited<ReturnType<typeof mount>>, type: string, x: number, y: number, pointerId = 1) {
  const event = new Event(type, { bubbles: true })
  Object.assign(event, { clientX: x, clientY: y, pointerId, buttons: type === 'pointerdown' || type === 'pointermove' ? 1 : 0 })
  s.hit.dispatchEvent(event)
}

function dragCue(s: Awaited<ReturnType<typeof mount>>, cue: Cue) {
  const source = anchorWorld(cue).project(s.camera)
  const destination = cue.options.destination!
  const target = (typeof destination === 'function'
    ? destination()
    : destination.getWorldPosition(new THREE.Vector3())).project(s.camera)
  const x0 = (source.x + 1) * 150
  const y0 = (1 - source.y) * 150
  const x1 = (target.x + 1) * 150
  const y1 = (1 - target.y) * 150
  pointerAt(s, 'pointerdown', x0, y0)
  const move = new Event('pointermove')
  Object.assign(move, { clientX: x1, clientY: y1, pointerId: 1, buttons: 1 })
  s.hit.dispatchEvent(move)
  pointerAt(s, 'pointerup', x1, y1)
}

beforeEach(() => {
  built.cues.length = 0
  built.scenes.length = 0
  built.cameras.length = 0
})
afterEach(() => document.body.replaceChildren())

describe.each(OWN_SCENES)('%s object cues', (id) => {
  it('offers a current object action and hides it when paused or disposed', async () => {
    let active = true
    const s = await mount(id, 0, { isActive: () => active })
    expect(s.enabled().length).toBeGreaterThan(0)
    expect(s.enabled().length).toBeLessThanOrEqual(3)
    expect(s.overlay.querySelector('.scene-hint')?.textContent).not.toContain('下方')
    active = false
    expect(s.enabled()).toHaveLength(0)
    active = true
    expect(s.enabled().length).toBeGreaterThan(0)
    s.instance.dispose()
    expect(s.enabled()).toHaveLength(0)
  })

  it('has no actionable cue for a restored finished session', async () => {
    const s = await mount(id, 3)
    expect(s.enabled()).toHaveLength(0)
    expect(s.progress).toEqual([])
    s.instance.dispose()
  })
})

it.each(['tanzaku-tanabata', 'yeondeunghoe', 'furin-wind-chime', 'lantern'])('%s tap cue lies on its real action source', async (id) => {
  const s = await mount(id)
  const cue = s.enabled().find((item) => item.options.kind === 'tap')!
  expect(cue).toBeDefined()
  tapCue(s, cue)
  expect(s.progress).toEqual([1])
  if (id !== 'tanzaku-tanabata') expect(s.enabled()).toHaveLength(0)
  s.instance.dispose()
})

it('crane folds from its current paper surface and waits for each fold to settle', async () => {
  const s = await mount('crane')
  const anchors: THREE.Vector3[] = []
  for (let form = 0; form < 4; form++) {
    const cue = s.enabled().find((item) => item.options.kind === 'tap')!
    expect(cue.object).toBeInstanceOf(THREE.Mesh)
    const world = anchorWorld(cue)
    anchors.push(world.clone())
    const ray = new THREE.Raycaster(s.camera.getWorldPosition(new THREE.Vector3()), world.clone().sub(s.camera.position).normalize())
    expect(ray.intersectObject(cue.object, false).length).toBeGreaterThan(0)
    tapCue(s, cue)
    expect(s.haptic).toHaveBeenCalledTimes(form + 1)
    expect(s.enabled()).toHaveLength(0)
    s.run(3.1)
  }
  expect(anchors.some((anchor) => anchor.distanceTo(anchors[0]) > 0.03)).toBe(true)
  expect(s.progress).toEqual([1])
  expect(s.enabled()).toHaveLength(1)
  expect(s.enabled()[0].options.kind).toBe('drag')
  s.instance.dispose()
})

it('crane discards a cancelled paper touch before a later release can fold it', async () => {
  const s = await mount('crane')
  const cue = s.enabled()[0]
  const projected = anchorWorld(cue).project(s.camera)
  const x = (projected.x + 1) * 150
  const y = (1 - projected.y) * 150
  pointerAt(s, 'pointerdown', x, y)
  pointerAt(s, 'pointercancel', x, y)
  pointerAt(s, 'pointerup', x, y)
  s.run(3.1)
  expect(s.haptic).not.toHaveBeenCalled()
  expect(s.progress).toEqual([])
  expect(s.enabled()[0].options.kind).toBe('tap')
  tapCue(s, cue)
  expect(s.haptic).toHaveBeenCalledTimes(1)
  s.instance.dispose()
})

it('crane abandons a cancelled upward paper drag without lifting', async () => {
  const s = await mount('crane', 1)
  const cue = s.enabled()[0]
  const source = anchorWorld(cue).project(s.camera)
  const destination = (cue.options.destination as () => THREE.Vector3)().project(s.camera)
  const x0 = (source.x + 1) * 150
  const y0 = (1 - source.y) * 150
  const x1 = (destination.x + 1) * 150
  const y1 = (1 - destination.y) * 150
  pointerAt(s, 'pointerdown', x0, y0)
  const move = new Event('pointermove')
  Object.assign(move, { clientX: x1, clientY: y1, pointerId: 1, buttons: 1 })
  s.hit.dispatchEvent(move)
  pointerAt(s, 'pointercancel', x1, y1)
  pointerAt(s, 'pointerup', x1, y1)
  s.run(1)
  expect(s.progress).toEqual([])
  expect(s.haptic).not.toHaveBeenCalled()
  expect(s.enabled()[0].options.kind).toBe('drag')
  s.instance.dispose()
})

it('tanabata changes the loose paper tap into a drag cue with the bamboo landing point', async () => {
  const s = await mount('tanzaku-tanabata')
  s.tap()
  s.run(0.5)
  expect(s.enabled()).toHaveLength(1)
  const cue = s.enabled()[0]
  expect(cue.options.kind).toBe('drag')
  expect(cue.options.destination).toBeDefined()
  s.tap()
  expect(s.enabled()).toHaveLength(0)
  s.instance.dispose()
})

it.each([284, 354])('tanabata keeps its real paper pick anchor at least 20px inside a %ipx phone stage', async (width) => {
  const s = await mount('tanzaku-tanabata', 0, {}, [width, 390])
  const cue = s.enabled()[0]
  const projected = anchorWorld(cue).project(s.camera)
  const x = (projected.x + 1) * width / 2
  const y = (1 - projected.y) * 390 / 2
  expect(x).toBeGreaterThanOrEqual(20)
  expect(x).toBeLessThanOrEqual(width - 20)
  expect(y).toBeGreaterThanOrEqual(20)
  expect(y).toBeLessThanOrEqual(390 - 20)
  s.instance.dispose()
})

it('tanabata keeps the original desktop camera distance', async () => {
  const s = await mount('tanzaku-tanabata', 0, {}, [600, 390])
  expect(s.camera.position.z).toBe(4.4)
  s.instance.dispose()
})

it('lantern plaque drag points to the lantern bottom as it sways', async () => {
  const s = await mount('lantern', 1)
  const cue = s.enabled()[0]
  expect(cue.options.kind).toBe('drag')
  const destination = cue.options.destination as () => THREE.Vector3
  const lantern = s.scene.getObjectByName('lantern-body')!
  expect(destination()).toEqual(lantern.localToWorld(new THREE.Vector3(0, -0.39, 0)))
  s.tap()
  s.run(0.4)
  expect(destination()).toEqual(lantern.localToWorld(new THREE.Vector3(0, -0.39, 0)))
  expect(s.enabled()).toHaveLength(1)
  expect(s.enabled()[0].options.kind).toBe('tap')
  s.tap()
  expect(s.enabled()).toHaveLength(0)
  s.instance.dispose()
})

it.each(['yeondeunghoe', 'furin-wind-chime', 'lantern'])('%s quiet ending completes only from a fresh object tap', async (id) => {
  const s = await mount(id, 2)
  const cue = s.enabled()[0]
  expect(cue.options.kind).toBe('tap')
  expect(s.hit.style.pointerEvents).toBe('auto')
  pointerAt(s, 'pointerdown', 8, 292)
  pointerAt(s, 'pointerup', 8, 292)
  expect(s.progress).toEqual([])
  const projected = anchorWorld(cue).project(s.camera)
  const x = (projected.x + 1) * 150
  const y = (1 - projected.y) * 150
  // A release alone, or a cancelled touch, does not finish the scene.
  pointerAt(s, 'pointerup', x, y)
  pointerAt(s, 'pointerdown', x, y)
  pointerAt(s, 'pointercancel', x, y)
  pointerAt(s, 'pointerup', x, y)
  expect(s.progress).toEqual([])
  tapCue(s, cue)
  expect(s.progress).toEqual([3])
  expect(s.enabled()).toHaveLength(0)
  s.instance.dispose()
})

it.each(['yeondeunghoe', 'furin-wind-chime', 'lantern', 'crane'])('%s requires the pointer that pressed its current tap source', async (id) => {
  const s = await mount(id, id === 'crane' ? 0 : 2)
  const cue = s.enabled()[0]
  const projected = anchorWorld(cue).project(s.camera)
  const x = (projected.x + 1) * 150
  const y = (1 - projected.y) * 150
  pointerAt(s, 'pointerdown', x, y, 1)
  pointerAt(s, 'pointerup', x, y, 2)
  expect(s.progress).toEqual([])
  expect(s.haptic).not.toHaveBeenCalled()
  pointerAt(s, 'pointerup', x, y, 1)
  if (id === 'crane') expect(s.haptic).toHaveBeenCalledTimes(1)
  else expect(s.progress).toEqual([3])
  s.instance.dispose()
})

it.each(['yeondeunghoe', 'furin-wind-chime', 'lantern', 'crane'])('%s abandons a press when paused, including a release after resuming', async (id) => {
  let active = true
  const s = await mount(id, id === 'crane' ? 0 : 2, { isActive: () => active })
  const cue = s.enabled()[0]
  const projected = anchorWorld(cue).project(s.camera)
  const x = (projected.x + 1) * 150
  const y = (1 - projected.y) * 150
  pointerAt(s, 'pointerdown', x, y)
  active = false
  s.instance.update(0)
  active = true
  pointerAt(s, 'pointerup', x, y)
  expect(s.progress).toEqual([])
  expect(s.haptic).not.toHaveBeenCalled()
  tapCue(s, cue)
  if (id === 'crane') expect(s.haptic).toHaveBeenCalledTimes(1)
  else expect(s.progress).toEqual([3])
  s.instance.dispose()
})

it.each(['crane', 'lantern'])('%s ignores a foreign drag move and release, then accepts its owning pointer', async (id) => {
  const s = await mount(id, 1)
  const cue = s.enabled()[0]
  const source = anchorWorld(cue).project(s.camera)
  const target = (cue.options.destination as () => THREE.Vector3)().project(s.camera)
  const x0 = (source.x + 1) * 150
  const y0 = (1 - source.y) * 150
  const x1 = (target.x + 1) * 150
  const y1 = (1 - target.y) * 150
  const body = cue.object.parent!
  const before = body.getWorldPosition(new THREE.Vector3())
  pointerAt(s, 'pointerdown', x0, y0, 1)
  pointerAt(s, 'pointermove', x1, y1, 2)
  pointerAt(s, 'pointerup', x1, y1, 2)
  s.run(0.25)
  expect(s.progress).toEqual([])
  expect(body.getWorldPosition(new THREE.Vector3()).distanceTo(before)).toBeLessThan(0.001)
  pointerAt(s, 'pointermove', x1, y1, 1)
  pointerAt(s, 'pointerup', x1, y1, 1)
  expect(s.progress).toEqual([2])
  s.instance.dispose()
})

it.each(['crane', 'lantern'])('%s abandons its generic drag recognizer across pause and resume', async (id) => {
  let active = true
  const s = await mount(id, 1, { isActive: () => active })
  const cue = s.enabled()[0]
  const source = anchorWorld(cue).project(s.camera)
  const target = (cue.options.destination as () => THREE.Vector3)().project(s.camera)
  const x0 = (source.x + 1) * 150
  const y0 = (1 - source.y) * 150
  const x1 = (target.x + 1) * 150
  const y1 = (1 - target.y) * 150
  pointerAt(s, 'pointerdown', x0, y0)
  pointerAt(s, 'pointermove', x1, y1)
  active = false
  s.instance.update(0)
  active = true
  s.instance.update(0)
  pointerAt(s, 'pointerup', x1, y1)
  expect(s.progress).toEqual([])
  dragCue(s, cue)
  expect(s.progress).toEqual([2])
  s.instance.dispose()
})

it.each(['yeondeunghoe', 'furin-wind-chime', 'crane', 'lantern'])('%s cancels its generic gesture when a second finger touches the page', async (id) => {
  const s = await mount(id, id === 'crane' || id === 'lantern' ? 1 : 0)
  const cue = s.enabled().find((item) => item.options.kind === 'drag') ?? s.enabled()[0]
  const source = anchorWorld(cue)
  const target = (typeof cue.options.destination === 'function'
    ? cue.options.destination()
    : source.clone().add(new THREE.Vector3(0, 0.8, 0))).project(s.camera)
  source.project(s.camera)
  const x0 = (source.x + 1) * 150
  const y0 = (1 - source.y) * 150
  const x1 = (target.x + 1) * 150
  const y1 = (1 - target.y) * 150
  pointerAt(s, 'pointerdown', x0, y0)
  const second = new Event('pointerdown', { bubbles: true })
  Object.assign(second, { pointerId: 2, clientX: 0, clientY: 0, buttons: 1 })
  document.body.dispatchEvent(second)
  s.instance.update(0.05)
  pointerAt(s, 'pointermove', x1, y1)
  pointerAt(s, 'pointerup', x1, y1)
  const release = new Event('pointerup', { bubbles: true })
  Object.assign(release, { pointerId: 2, clientX: 0, clientY: 0, buttons: 0 })
  document.body.dispatchEvent(release)
  expect(s.progress).toEqual([])
  if (cue.options.kind === 'drag') dragCue(s, cue)
  else tapCue(s, cue)
  expect(s.progress).toEqual([id === 'crane' || id === 'lantern' ? 2 : 1])
  s.instance.dispose()
})

it.each([
  ['tanzaku-tanabata', 1, 2],
  ['crane', 1, 2],
  ['furin-wind-chime', 0, 1],
  ['lantern', 1, 2],
] as const)('%s drag cue starts on its real source and lands on its valid target', async (id, at, reports) => {
  const s = await mount(id, at)
  const cue = s.enabled().find((item) => item.options.kind === 'drag')!
  expect(cue).toBeDefined()
  dragCue(s, cue)
  expect(s.progress).toEqual([reports])
  s.instance.dispose()
})
