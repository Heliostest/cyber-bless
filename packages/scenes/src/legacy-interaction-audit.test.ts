// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from './contract'
import { loadScene } from './registry'

// Keep the scene graph, camera, hit regions and gesture recognizers real.
// jsdom has no GPU; rendering only synchronizes the world matrices.
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
    return {
      setStyle() {}, resize() {}, dispose() {},
      render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) },
    }
  },
}))

const instances = new Set<SceneInstance>()
afterEach(() => {
  for (const instance of instances) instance.dispose()
  instances.clear(); document.body.replaceChildren(); vi.restoreAllMocks()
})
type Point = readonly [number, number]
const IDS = ['celtic-folk-spring', 'shinto-torii', 'theravada-water', 'tibetan-wheel', 'slavic-wreath',
  'tanzaku-tanabata', 'yeondeunghoe', 'furin-wind-chime', 'crane', 'lantern'] as const

async function mount(id: string, initialProgress = 0, reduced = false, width = 390, extra: Partial<SceneContext> = {}) {
  const height = 408
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  const progress: number[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const module = await loadScene(id)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), isReducedMotion: () => reduced, isSoundEnabled: () => false, ...extra })
  instances.add(instance); instance.start(); instance.update(0)
  const scene = rendered.scene!, camera = rendered.camera!
  const layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  Object.defineProperty(layer, 'clientWidth', { value: width })
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const run = (seconds: number) => {
    for (let time = 0; time < seconds; time += 0.05) instance.update(0.05)
  }
  const cues = () => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const found: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => {
      for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) found.push({ object, cue })
    })
    return found
  }
  const project = (point: THREE.Vector3): Point => {
    const screen = point.clone().project(camera)
    return [(screen.x + 1) * width / 2, (1 - screen.y) * height / 2]
  }
  const source = (kind?: string): Point => {
    const target = cues().find(({ cue }) => !kind || kind === cue.kind)
    expect(target, `${id} current ${kind ?? 'action'} cue`).toBeDefined()
    const { object, cue } = target!
    return project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
  }
  const destination = (): Point => {
    const { cue } = cues().find(({ cue }) => cue.destination)!
    return project(typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3()))
  }
  const pointer = (type: string, [x, y]: Point, pointerId = 1, pointerType = 'touch') => {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(event, { clientX: x, clientY: y, pointerId, pointerType, button: 0,
      isPrimary: true, buttons: type === 'pointerup' ? 0 : 1 })
    layer.dispatchEvent(event)
  }
  const tap = (kind?: string) => {
    const point = source(kind); pointer('pointerdown', point); pointer('pointerup', point); run(0.05)
  }
  const drag = (from: Point, to: Point, hold = 0) => {
    pointer('pointerdown', from)
    for (const k of [0.25, 0.5, 0.75, 1]) {
      pointer('pointermove', [from[0] + (to[0] - from[0]) * k, from[1] + (to[1] - from[1]) * k]); run(0.05)
    }
    run(hold); pointer('pointerup', to); run(0.05)
  }
  const wish = () => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = '愿每一天平安'
    input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  const action = (at: number) => {
    if (at === 2) {
      if (['theravada-water', 'tibetan-wheel', 'yeondeunghoe', 'furin-wind-chime', 'lantern'].includes(id)) tap('tap')
      else wish()
      return
    }
    if (at === 1) {
      if (['tibetan-wheel', 'yeondeunghoe', 'furin-wind-chime'].includes(id)) { run(15); return }
      if (id === 'shinto-torii') { const [x, y] = source(); drag([x, y], [x, y + 90]); run(3); return }
      drag(source('drag'), destination()); run(3); return
    }
    if (id === 'crane') { for (let fold = 0; fold < 4; fold++) { tap('tap'); run(3) }; return }
    if (id === 'theravada-water') { const [x, y] = source(); drag([x, y], [x, y - 70], 0.4); return }
    if (id === 'tibetan-wheel') { const [x, y] = source(); drag([x, y], [x - 70, y]); return }
    if (id === 'furin-wind-chime') { const [x, y] = source('drag'); drag([x, y], [x, y - 70]); return }
    if (id === 'tanzaku-tanabata') { const point = source(); pointer('pointerdown', point); pointer('pointerup', point); run(1); return }
    tap('tap'); run(3)
  }
  return { id, instance, overlay, layer, scene, camera, progress, complete, run, cues, source, destination, pointer, drag, tap, action }
}

// These paths fail if the displayed source/destination cannot finish its stage,
// if a release loses ownership, or if reduced/restored poses disagree with hits.
describe.each(IDS)('%s physical scene audit', id => {
  it.each([
    [0, false, 320], [0, true, 390], [1, false, 390], [1, true, 320], [2, false, 320], [2, true, 390],
  ] as const)('completes from checkpoint %i, reduced %s, width %i', async (initial, reduced, width) => {
    const s = await mount(id, initial, reduced, width)
    for (let at = initial; at < 3; at++) {
      // Some opening gestures start the next timed stage within the same frame.
      if (s.progress.at(-1) !== undefined && s.progress.at(-1)! > at) continue
      s.action(at)
      expect(s.progress, `after physical stage ${at}`).toContain(at + 1)
    }
    expect(s.progress).toEqual([1, 2, 3].slice(initial))
    expect(s.complete).toHaveBeenCalledTimes(1)
  })
})

it.each(['celtic-folk-spring', 'theravada-water'])(
  '%s keeps the owner token drag alive when another pointer releases', async id => {
    const s = await mount(id, 1)
    const from = s.source(), to = s.destination()
    s.pointer('pointerdown', from, 1)
    s.pointer('pointermove', to, 1); s.run(0.2)
    s.pointer('pointerup', to, 2)
    expect(s.progress).toEqual([])
    s.pointer('pointerup', to, 1)
    expect(s.progress).toEqual([2])
  },
)

it.each(['celtic-folk-spring', 'theravada-water', 'shinto-torii', 'slavic-wreath', 'tanzaku-tanabata', 'crane', 'lantern'])(
  '%s discards a drag through pause and accepts a fresh drag after resume', async id => {
    let active = true
    const s = await mount(id, 1, true, 390, { isActive: () => active })
    const from = s.source('drag')
    const to: Point = id === 'shinto-torii' ? [from[0], from[1] + 90] : s.destination()
    s.pointer('pointerdown', from); s.pointer('pointermove', to); s.run(0.2)
    active = false; s.instance.update(0); active = true; s.instance.update(0)
    s.pointer('pointerup', to); s.run(0.2)
    expect(s.progress).toEqual([])
    const fresh = s.source('drag')
    s.drag(fresh, id === 'shinto-torii' ? [fresh[0], fresh[1] + 90] : s.destination())
    s.run(3)
    expect(s.progress).toEqual([2])
  },
)

it('theravada-water completes a full physical pour without an invisible extra hold', async () => {
  const s = await mount('theravada-water')
  const [x, y] = s.source('rotate')
  s.pointer('pointerdown', [x, y]); s.pointer('pointermove', [x, y - 60]); s.pointer('pointerup', [x, y - 60])
  expect(s.progress).toEqual([1])
  expect(s.cues().map(({ cue }) => cue.kind)).toEqual(['drag'])
})

it('theravada-water returns an unfinished pour to its starting pose on release', async () => {
  const s = await mount('theravada-water')
  const pitcher = s.cues()[0]!.object
  const restAngle = pitcher.rotation.z, hint = s.overlay.querySelector('.scene-hint')!.textContent
  const [x, y] = s.source('rotate')
  s.pointer('pointerdown', [x, y]); s.pointer('pointermove', [x, y - 30])
  expect(pitcher.rotation.z).not.toBe(restAngle)
  s.pointer('pointerup', [x, y - 30])
  expect(s.progress).toEqual([])
  expect(pitcher.rotation.z).toBe(restAngle)
  expect(s.overlay.querySelector('.scene-hint')!.textContent).toBe(hint)
})

it.each(['celtic-folk-spring', 'theravada-water', 'shinto-torii', 'slavic-wreath', 'tanzaku-tanabata', 'crane', 'lantern'])(
  '%s retries a cancelled carry without accepting the cancelled release', async id => {
    const s = await mount(id, 1, false)
    const from = s.source('drag')
    const to: Point = id === 'shinto-torii' ? [from[0], from[1] + 90] : s.destination()
    s.pointer('pointerdown', from); s.pointer('pointermove', to); s.run(0.15)
    s.pointer('pointercancel', to); s.pointer('pointerup', to); s.run(0.2)
    expect(s.progress).toEqual([])
    const fresh = s.source('drag')
    s.drag(fresh, id === 'shinto-torii' ? [fresh[0], fresh[1] + 90] : s.destination()); s.run(3)
    expect(s.progress).toEqual([2])
  },
)

it.each(['theravada-water', 'tibetan-wheel', 'furin-wind-chime', 'yeondeunghoe'])(
  '%s retries a cancelled physical tilt or turn using a mouse', async id => {
    const s = await mount(id, 0, false)
    const from = s.source(id === 'furin-wind-chime' ? 'drag' : undefined)
    const partial: Point = id === 'tibetan-wheel' ? [from[0] - 4, from[1]] : [from[0], from[1] - 10]
    s.pointer('pointerdown', from, 1, 'mouse'); s.pointer('pointermove', partial, 1, 'mouse')
    s.pointer('pointercancel', partial, 1, 'mouse')
    s.pointer('pointerup', id === 'tibetan-wheel' ? [from[0] - 70, from[1]] : [from[0], from[1] - 70], 1, 'mouse')
    expect(s.progress).toEqual([])
    const fresh = s.source(id === 'furin-wind-chime' ? 'drag' : undefined)
    const to: Point = id === 'tibetan-wheel' ? [fresh[0] - 70, fresh[1]] : [fresh[0], fresh[1] - 70]
    s.pointer('pointerdown', fresh, 1, 'mouse'); s.pointer('pointermove', to, 1, 'mouse')
    if (id === 'theravada-water') s.run(0.4)
    s.pointer('pointerup', to, 1, 'mouse')
    expect(s.progress).toEqual([1])
  },
)

it('tibetan-wheel accepts a fresh drum tap after focus loss', async () => {
  const s = await mount('tibetan-wheel')
  const point = s.source()
  s.pointer('pointerdown', point, 1)
  window.dispatchEvent(new Event('blur'))
  s.pointer('pointerdown', point, 2); s.pointer('pointerup', point, 2)
  expect(s.progress).toEqual([1])
})

it.each(['theravada-water', 'tibetan-wheel', 'furin-wind-chime', 'yeondeunghoe'])(
  '%s accepts a tilt or turn finished between the final move and release', async id => {
    const s = await mount(id, 0, false)
    const from = s.source(id === 'furin-wind-chime' ? 'drag' : undefined)
    const partial: Point = id === 'tibetan-wheel' ? [from[0] - 4, from[1]] : [from[0], from[1] - 10]
    const to: Point = id === 'tibetan-wheel' ? [from[0] - 70, from[1]] : [from[0], from[1] - 70]
    s.pointer('pointerdown', from); s.pointer('pointermove', partial); s.pointer('pointerup', to)
    expect(s.progress).toEqual([1])
  },
)

it.each(['shinto-torii', 'slavic-wreath'])(
  '%s ignores the old opening tap after pause and accepts a new object tap', async id => {
    let active = true
    const s = await mount(id, 0, true, 390, { isActive: () => active })
    const point = s.source()
    s.pointer('pointerdown', point)
    active = false; s.instance.update(0); active = true; s.instance.update(0)
    s.pointer('pointerup', point)
    expect(s.progress).toEqual([])
    s.tap()
    expect(s.progress).toEqual([1])
  },
)

it.each(['celtic-folk-spring', 'theravada-water', 'shinto-torii', 'slavic-wreath', 'tanzaku-tanabata', 'crane', 'lantern']
  .flatMap(id => ['blur', 'lostpointercapture'].map(interruption => [id, interruption])))(
  '%s recovers its carry after %s with a fresh pointer', async (id, interruption) => {
    const s = await mount(id, 1, true)
    const from = s.source('drag')
    s.pointer('pointerdown', from)
    if (interruption === 'blur') window.dispatchEvent(new Event('blur'))
    else s.pointer('lostpointercapture', from)
    const fresh = s.source('drag')
    const to: Point = id === 'shinto-torii' ? [fresh[0], fresh[1] + 90] : s.destination()
    s.pointer('pointerdown', fresh, 2); s.pointer('pointermove', to, 2); s.run(0.1)
    s.pointer('pointerup', to, 2); s.run(3)
    expect(s.progress).toEqual([2])
  },
)

it.each(['celtic-folk-spring', 'theravada-water', 'shinto-torii', 'slavic-wreath', 'tanzaku-tanabata', 'crane', 'lantern'])(
  '%s accepts the release destination after the last intermediate drag frame', async id => {
    const s = await mount(id, 1, false)
    const from = s.source('drag')
    const to: Point = id === 'shinto-torii' ? [from[0], from[1] + 90] : s.destination()
    s.pointer('pointerdown', from)
    s.pointer('pointermove', [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2]); s.run(0.1)
    s.pointer('pointerup', to); s.run(3)
    expect(s.progress).toEqual([2])
  },
)

it.each(IDS)('%s restores a completed ritual without replaying checkpoints', async id => {
  const s = await mount(id, 3, true)
  s.run(2)
  expect(s.progress).toEqual([])
  expect(s.cues()).toEqual([])
  expect(s.complete).toHaveBeenCalledTimes(1)
})

it.each(['theravada-water', 'tibetan-wheel', 'furin-wind-chime', 'yeondeunghoe']
  .flatMap(id => ['blur', 'lostpointercapture'].map(interruption => [id, interruption])))(
  '%s resumes its tilt or turn after %s without the original release', async (id, interruption) => {
    const s = await mount(id, 0, true)
    const from = s.source(id === 'furin-wind-chime' ? 'drag' : undefined)
    s.pointer('pointerdown', from)
    if (interruption === 'blur') window.dispatchEvent(new Event('blur'))
    else s.pointer('lostpointercapture', from)
    const fresh = s.source(id === 'furin-wind-chime' ? 'drag' : undefined)
    const to: Point = id === 'tibetan-wheel' ? [fresh[0] - 70, fresh[1]] : [fresh[0], fresh[1] - 70]
    s.pointer('pointerdown', fresh, 2); s.pointer('pointermove', to, 2); s.run(0.4)
    s.pointer('pointerup', to, 2)
    expect(s.progress[0]).toBe(1)
    // The wheel's acknowledgement must use the fresh pointer too.
    if (id === 'tibetan-wheel') {
      s.run(15)
      const point = s.source('tap')
      s.pointer('pointerdown', point, 2); s.pointer('pointerup', point, 2)
      expect(s.progress).toEqual([1, 2, 3])
    }
  },
)
