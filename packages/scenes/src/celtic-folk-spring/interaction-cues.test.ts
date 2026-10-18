// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext } from '../contract'
import { loadScene } from '../registry'

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

const built = vi.hoisted(() => ({ scene: undefined as unknown, camera: undefined as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    built.scene = scene
    built.camera = camera
    return {
      setStyle() {},
      resize() {},
      render() { scene.updateMatrixWorld(); camera.updateMatrixWorld() },
      dispose() {},
    }
  },
}))

async function mount(id: string, initialProgress = 0, extra: Partial<SceneContext> = {}, viewport: readonly [number, number] = [300, 300]) {
  const [width, height] = viewport
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  Object.defineProperties(canvas, {
    clientWidth: { value: width }, clientHeight: { value: height },
  })
  canvas.getBoundingClientRect = () =>
    ({ left: 0, top: 0, width, height, right: width, bottom: height }) as DOMRect
  document.body.append(canvas, overlay)
  const progress = vi.fn()
  const mod = await loadScene(id)
  const dragChecks = { starts: [] as boolean[], drops: [] as boolean[] }
  const gestures = {
    ...Gestures,
    createDrag(opts: Parameters<typeof Gestures.createDrag>[0]) {
      return Gestures.createDrag({
        ...opts,
        startsOn(x, y) {
          const hit = opts.startsOn?.(x, y) ?? true
          dragChecks.starts.push(hit)
          return hit
        },
        hitTest(x, y) {
          const hit = opts.hitTest(x, y)
          dragChecks.drops.push(hit)
          return hit
        },
      })
    },
  }
  const instance = mod.create({
    canvas, overlay, gestures, shared: Shared, initialProgress,
    onProgress: progress, isSoundEnabled: () => false, ...extra,
  })
  const scene = built.scene as THREE.Scene
  const camera = built.camera as THREE.Camera
  const cues = () => {
    const found: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse((object) => {
      for (const cue of (object.userData.interactionCues ?? []) as InteractionCue[]) {
        found.push({ object, cue })
      }
    })
    return found
  }
  const enabled = () => cues().filter(({ cue }) => cue.enabled())
  instance.start()
  instance.update(0)
  const hitLayer = overlay.querySelector<HTMLElement>('.scene-hit-layer')
  if (hitLayer) {
    hitLayer.setPointerCapture = () => {}
    Object.defineProperty(hitLayer, 'clientWidth', { value: width })
  }
  const tap = () => overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
  const project = (world: THREE.Vector3) => {
    const p = world.clone().project(camera)
    return [(p.x + 1) * width / 2, (1 - p.y) * height / 2] as const
  }
  const sourcePoint = () => {
    const [{ object, cue }] = enabled()
    return project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
  }
  const destinationPoint = () => {
    const [{ cue }] = enabled()
    return project(typeof cue.destination === 'function'
      ? cue.destination()
      : cue.destination!.getWorldPosition(new THREE.Vector3()))
  }
  const pointer = (type: string, [x, y]: readonly [number, number], pointerId = 1) => {
    const e = new Event(type, { bubbles: true, cancelable: true })
    Object.assign(e, { clientX: x, clientY: y, pointerId, buttons: type === 'pointerup' ? 0 : 1 })
    overlay.querySelector('.scene-hit-layer')!.dispatchEvent(e)
  }
  return { instance, scene, overlay, progress, cues, enabled, tap, project, sourcePoint, destinationPoint, pointer, dragChecks }
}

afterEach(() => { document.body.replaceChildren() })

const STEPS = [
  { id: 'celtic-folk-spring', kinds: ['tap', 'drag', null, null] },
  { id: 'shinto-torii', kinds: ['tap', 'drag', null, null] },
  { id: 'theravada-water', kinds: ['rotate', 'drag', 'tap', null] },
  { id: 'tibetan-wheel', kinds: ['rotate', null, 'tap', null] },
  { id: 'slavic-wreath', kinds: ['tap', 'drag', null, null] },
] as const

describe.each(STEPS)('$id object cues', ({ id, kinds }) => {
  it.each([0, 1, 2, 3])('restores step %i with only its actionable object cue', async (step) => {
    const s = await mount(id, step)
    expect(s.enabled().map(({ cue }) => cue.kind)).toEqual(kinds[step] ? [kinds[step]] : [])
    expect(s.cues().length).toBeLessThanOrEqual(3)
    expect(s.progress).not.toHaveBeenCalled()
    for (const { cue } of s.cues()) expect(() => Shared.assertSafeCopy(cue.label)).not.toThrow()
    s.instance.dispose()
    expect(s.enabled()).toEqual([])
  })

  it('hides a restored actionable cue during pause and brings it back on resume', async () => {
    let active = false
    const step = kinds.findIndex((kind) => kind !== null)
    const s = await mount(id, step, { isActive: () => active })
    expect(s.enabled()).toEqual([])
    active = true
    expect(s.enabled()).toHaveLength(1)
    active = false
    expect(s.enabled()).toEqual([])
    expect(s.progress).not.toHaveBeenCalled()
    s.instance.dispose()
  })
})

describe('physical action cues', () => {
  it.each([
    ['celtic-folk-spring', 0, 1], ['celtic-folk-spring', 1, 2],
    ['theravada-water', 0, 1], ['theravada-water', 1, 2], ['theravada-water', 2, 3],
  ] as const)('%s keeps a keyboard button action at physical step %i', async (id, step, next) => {
    let active = false
    const s = await mount(id, step, { isActive: () => active })
    const button = s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
    expect(button.hidden).toBe(false)
    expect(button.getAttribute('aria-label')).toBe(button.textContent)
    button.click()
    expect(s.progress).not.toHaveBeenCalled()
    active = true
    button.click()
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(next)
    expect(button.getAttribute('aria-label')).toBe(button.textContent)
    s.instance.dispose()
  })

  it.each(['celtic-folk-spring', 'theravada-water'])('%s raycasts a carried token at varied camera animation times', async (id) => {
    const clock = vi.spyOn(performance, 'now')
    try {
      for (let time = 0; time <= 5000; time += 250) {
        clock.mockReturnValue(time)
        const s = await mount(id, 1)
        const source = s.sourcePoint()
        const destination = s.destinationPoint()
        s.pointer('pointerdown', source)
        s.pointer('pointermove', destination)
        s.pointer('pointerup', destination)
        expect(s.dragChecks.starts, `${id} source at ${time} ms`).toEqual([true])
        expect(s.dragChecks.drops, `${id} water at ${time} ms`).toEqual([true])
        expect(s.progress.mock.calls, `${id} progress at ${time} ms`).toEqual([[2]])
        s.instance.dispose()
      }
    } finally { clock.mockRestore() }
  })

  it.each([
    ['celtic-folk-spring', 0, 1],
    ['theravada-water', 2, 3],
    ['tibetan-wheel', 2, 3],
  ] as const)('%s accepts its object tap and ignores a tap on blank stage', async (id, step, next) => {
    const s = await mount(id, step)
    s.pointer('pointerdown', [2, 2])
    s.pointer('pointerup', [2, 2])
    expect(s.progress).not.toHaveBeenCalled()
    const point = s.sourcePoint()
    s.pointer('pointerdown', point)
    s.pointer('pointerup', point)
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(next)
    s.instance.dispose()
  })

  it.each([
    ['celtic-folk-spring', 0, 1],
    ['theravada-water', 2, 3],
    ['tibetan-wheel', 2, 3],
  ] as const)('%s ignores a foreign release during its object acknowledgement', async (id, step, next) => {
    const s = await mount(id, step)
    const point = s.sourcePoint()
    s.pointer('pointerdown', point, 1)
    s.pointer('pointerup', point, 2)
    expect(s.progress).not.toHaveBeenCalled()
    s.pointer('pointerup', point, 1)
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(next)
    s.instance.dispose()
  })

  it.each([
    ['celtic-folk-spring', 0, 1],
    ['theravada-water', 2, 3],
    ['tibetan-wheel', 2, 3],
  ] as const)('%s cancels a pending object acknowledgement on pause', async (id, step, next) => {
    let active = true
    const s = await mount(id, step, { isActive: () => active })
    const point = s.sourcePoint()
    s.pointer('pointerdown', point, 1)
    active = false
    s.instance.update(0)
    active = true
    s.pointer('pointerup', point, 1)
    expect(s.progress).not.toHaveBeenCalled()
    s.pointer('pointerdown', point, 1)
    s.pointer('pointerup', point, 1)
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(next)
    s.instance.dispose()
  })

  it.each([320, 390])('keeps all water sources and their anchors in view at %i px', async (width) => {
    for (const step of [0, 1, 2]) {
      const s = await mount('theravada-water', step, {}, [width, 408])
      const [x, y] = s.sourcePoint()
      expect(x).toBeGreaterThanOrEqual(24)
      expect(x).toBeLessThanOrEqual(width - 24)
      expect(y).toBeGreaterThanOrEqual(24)
      expect(y).toBeLessThanOrEqual(384)
      if (step < 2) {
        const bounds = new THREE.Box3().setFromObject(s.enabled()[0].object)
        for (const x of [bounds.min.x, bounds.max.x]) {
          for (const y of [bounds.min.y, bounds.max.y]) {
            for (const z of [bounds.min.z, bounds.max.z]) {
              const [px, py] = s.project(new THREE.Vector3(x, y, z))
              expect(px).toBeGreaterThanOrEqual(8)
              expect(px).toBeLessThanOrEqual(width - 8)
              expect(py).toBeGreaterThanOrEqual(8)
              expect(py).toBeLessThanOrEqual(400)
            }
          }
        }
      }
      s.instance.dispose()
    }
  })

  it.each(['celtic-folk-spring', 'theravada-water'])('%s carries only a drag started on its token', async (id) => {
    const s = await mount(id, 1)
    const destination = s.destinationPoint()
    s.pointer('pointerdown', [2, 2])
    s.pointer('pointermove', destination)
    s.pointer('pointerup', destination)
    expect(s.progress).not.toHaveBeenCalled()
    s.pointer('pointerdown', s.sourcePoint())
    s.pointer('pointermove', destination)
    s.pointer('pointerup', destination)
    expect(s.dragChecks.starts).toEqual([false, true])
    expect(s.dragChecks.drops).toEqual([true])
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(2)
    s.instance.dispose()
  })

  it('starts a pour on the pitcher and leaves blank-stage dragging alone', async () => {
    const s = await mount('theravada-water')
    s.pointer('pointerdown', [298, 90])
    s.pointer('pointermove', [298, 30])
    s.instance.update(0.4)
    s.pointer('pointerup', [298, 30])
    expect(s.progress).not.toHaveBeenCalled()
    const [x, y] = s.sourcePoint()
    s.pointer('pointerdown', [x, y])
    s.pointer('pointermove', [x, y - 60])
    expect(s.enabled().map(({ cue }) => cue.kind)).toEqual(['drag'])
    s.instance.update(0.4)
    s.pointer('pointerup', [x, y - 60])
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(1)
    s.instance.dispose()
  })

  it('restores the pitcher cue after a partial tilt is released', async () => {
    const s = await mount('theravada-water')
    const [x, y] = s.sourcePoint()
    s.pointer('pointerdown', [x, y])
    s.pointer('pointermove', [x, y - 30])
    s.pointer('pointerup', [x, y - 30])
    expect(s.enabled().map(({ cue }) => cue.kind)).toEqual(['rotate'])
    expect(s.progress).not.toHaveBeenCalled()
    s.instance.dispose()
  })

  it.each(['celtic-folk-spring', 'theravada-water'])('%s cancels a carried token without placing it', async (id) => {
    const s = await mount(id, 1)
    s.pointer('pointerdown', s.sourcePoint())
    s.pointer('pointermove', s.destinationPoint())
    s.pointer('pointercancel', s.destinationPoint())
    expect(s.progress).not.toHaveBeenCalled()
    expect(s.enabled().map(({ cue }) => cue.kind)).toEqual(['drag'])
    s.instance.dispose()
  })

  it.each(['celtic-folk-spring', 'theravada-water'])('%s rejects a token released outside the water', async (id) => {
    const s = await mount(id, 1)
    s.pointer('pointerdown', s.sourcePoint())
    s.pointer('pointermove', [2, 2])
    s.pointer('pointerup', [2, 2])
    expect(s.dragChecks.starts).toEqual([true])
    expect(s.dragChecks.drops).toEqual([false])
    expect(s.progress).not.toHaveBeenCalled()
    s.instance.dispose()
  })

  it.each(['celtic-folk-spring', 'theravada-water'])('%s leaves blank touch scrolling available and claims its token', async (id) => {
    const s = await mount(id, 1)
    expect(s.overlay.classList.contains('scene-overlay--stage')).toBe(true)
    const claim = ([x, y]: readonly [number, number]) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: x, clientY: y }] })
      s.overlay.querySelector('.scene-hit-layer')!.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(claim([2, 2])).toBe(false)
    expect(claim(s.sourcePoint())).toBe(true)
    s.instance.dispose()
    expect(s.overlay.classList.contains('scene-overlay--stage')).toBe(false)
  })

  it('lets a tap on the moving wheel ask it to settle after its double-tap gate', async () => {
    const s = await mount('tibetan-wheel')
    const point = s.sourcePoint()
    s.pointer('pointerdown', point)
    s.pointer('pointerup', point)
    s.pointer('pointerdown', point)
    s.pointer('pointerup', point)
    s.instance.update(0.9)
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(1)
    s.pointer('pointerdown', point)
    s.pointer('pointerup', point)
    s.instance.update(1.5)
    expect(s.progress.mock.calls).toEqual([[1], [2]])
    s.instance.dispose()
  })

  it.each(['shinto-torii', 'slavic-wreath'])('%s suppresses its cue during its opening animation', async (id) => {
    const s = await mount(id)
    expect(s.enabled()).toHaveLength(1)
    s.tap()
    expect(s.enabled()).toEqual([])
    s.instance.update(3)
    expect(s.enabled().map(({ cue }) => cue.kind)).toEqual(['drag'])
    if (id === 'shinto-torii') {
      s.tap()
      expect(s.enabled()).toEqual([])
    }
    s.instance.dispose()
  })

  it('stops asking to turn the drum once it is moving', async () => {
    const s = await mount('tibetan-wheel')
    s.tap()
    expect(s.enabled()).toEqual([])
    s.instance.update(0.1)
    expect(s.progress).toHaveBeenCalledWith(1)
    s.instance.dispose()
  })

  it.each(['celtic-folk-spring', 'theravada-water', 'slavic-wreath'])('%s points its carry cue at the water', async (id) => {
    const s = await mount(id, 1)
    const [{ object, cue }] = s.enabled()
    expect(cue.kind).toBe('drag')
    expect(cue.targetLabel).toMatch(/泉面|水面/)
    const destination = typeof cue.destination === 'function'
      ? cue.destination()
      : cue.destination!.getWorldPosition(new THREE.Vector3())
    const source = object.getWorldPosition(new THREE.Vector3())
    expect(destination.y).toBeLessThan(source.y)
    expect(destination.distanceTo(source)).toBeGreaterThan(0.5)
    s.instance.dispose()
  })
})

// These camera phases previously projected the bank cue onto a radial triangle seam.
it.each([36059, 92001])('accepts the visible bank cue after pause at camera time %i ms', async time => {
  const clock = vi.spyOn(performance, 'now').mockReturnValue(time)
  let active = true
  const s = await mount('celtic-folk-spring', 0, { isActive: () => active })
  try {
    const point = s.sourcePoint()
    s.pointer('pointerdown', point, 1); active = false; s.instance.update(0); active = true
    s.pointer('pointerup', point, 1); expect(s.progress).not.toHaveBeenCalled()
    s.pointer('pointerdown', point, 1); s.pointer('pointerup', point, 1)
    expect(s.progress).toHaveBeenCalledExactlyOnceWith(1)
  } finally { s.instance.dispose(); clock.mockRestore() }
})
