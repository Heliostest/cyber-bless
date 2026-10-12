// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import * as mod from './index'

// Only the GPU boundary is replaced: geometry, raycasts, UI and gestures are real.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene
    rendered.camera = camera
    return {
      setStyle() {}, resize() {}, dispose() {},
      render() { scene.updateMatrixWorld(); camera.updateMatrixWorld() },
    }
  },
}))

const instances: SceneInstance[] = []
afterEach(() => {
  instances.splice(0).forEach((instance) => instance.dispose())
  document.body.replaceChildren()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
})

async function mount(initialProgress = 0, extra: Partial<SceneContext> & { returning?: boolean } = {}) {
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: 360 }, clientHeight: { value: 360 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 360, height: 360 }) as DOMRect
  const progress: number[] = []
  const saveWish = vi.fn()
  const complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({
    canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: (n) => progress.push(n), saveWish, isSoundEnabled: () => false, ...extra,
  })
  instances.push(instance)
  instance.start()
  const run = (seconds = 1) => {
    for (let t = 0; t < seconds; t += 0.025) instance.update(0.025)
  }
  run(0.025)
  const scene = rendered.scene as THREE.Scene
  const camera = rendered.camera as THREE.Camera
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}
  hit.releasePointerCapture = () => {}
  const point = (name: string): [number, number] => {
    scene.updateMatrixWorld()
    camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(camera)
    return [(p.x + 1) * 180, (1 - p.y) * 180]
  }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = text
    input.form!.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
  }
  const eye = (name: string) => scene.getObjectByName(name)!.visible
  return { instance, scene, camera, progress, saveWish, complete, button, overlay, hit, point, write, eye, run }
}

function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 })
  el.dispatchEvent(e)
}

describe('Daruma eye painting', () => {
  it('paints only one eye, keeps a short wish once, and settles before completing', async () => {
    const s = await mount()
    expect(s.eye('daruma-pupil-first')).toBe(false)
    expect(s.eye('daruma-pupil-second')).toBe(false)
    s.button.click()
    expect(s.progress).toEqual([1])
    expect(s.eye('daruma-pupil-first')).toBe(true)
    expect(s.eye('daruma-pupil-second')).toBe(false)
    s.write('   ')
    expect(s.progress).toEqual([1])
    s.write('  坚持读书  ')
    s.write('坚持读书')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('坚持读书')
    expect(s.progress).toEqual([1, 2])
    s.button.click()
    s.button.click()
    s.run(2)
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
    expect(s.eye('daruma-pupil-second')).toBe(false)
    s.button.click()
    s.run()
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('starts a return with one eye and paints the other without saving another wish', async () => {
    const s = await mount(0, { returning: true })
    expect(s.eye('daruma-pupil-first')).toBe(true)
    expect(s.eye('daruma-pupil-second')).toBe(false)
    s.button.click()
    expect(s.eye('daruma-pupil-second')).toBe(true)
    expect(s.overlay.querySelector('.scene-wish-slot input')).toBeNull()
    s.button.click()
    s.button.click()
    s.run(2)
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i without saving, progress or completion callbacks', async (at) => {
    const s = await mount(at)
    s.run(2)
    expect(s.progress).toEqual([])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.eye('daruma-pupil-first')).toBe(at >= 1)
    expect(s.eye('daruma-pupil-second')).toBe(false)
    const dots = [...s.overlay.querySelectorAll<HTMLElement>('.scene-step-dot')]
    expect(dots.filter((dot) => dot.dataset.state === 'done')).toHaveLength(at)
  })

  it('restores both eyes only in the returning branch', async () => {
    const s = await mount(3, { returning: true })
    expect(s.eye('daruma-pupil-first')).toBe(true)
    expect(s.eye('daruma-pupil-second')).toBe(true)
    expect(s.complete).not.toHaveBeenCalled()
  })

  it('ignores paused buttons and writing, then completes with reduced motion', async () => {
    let active = false
    const s = await mount(0, { isActive: () => active, isReducedMotion: () => true })
    s.button.click()
    expect(s.progress).toEqual([])
    active = true
    s.button.click()
    active = false
    s.write('每天进步一点')
    expect(s.saveWish).not.toHaveBeenCalled()
    active = true
    s.write('每天进步一点')
    s.button.click()
    s.run(0.025)
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('accepts a brush dragged to the blank eye but leaves an empty-stage swipe to the page', async () => {
    const s = await mount()
    const eye = s.point('daruma-eye-target-first')
    const touch = (pt: [number, number]) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: pt[0], clientY: pt[1] }] })
      s.hit.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(touch([8, 8])).toBe(false)
    pointer(s.hit, 'pointerdown', [8, 8])
    pointer(s.hit, 'pointerup', eye)
    expect(s.progress).toEqual([])
    const brush = s.point('daruma-brush')
    expect(touch(brush)).toBe(true)
    pointer(s.hit, 'pointerdown', brush)
    pointer(s.hit, 'pointermove', eye)
    pointer(s.hit, 'pointerup', eye)
    expect(s.progress).toEqual([1])
  })

  it('never paints from pointercancel or a gesture with multiple pointers', async () => {
    const s = await mount()
    const eye = s.point('daruma-eye-target-first')
    pointer(s.hit, 'pointerdown', eye)
    pointer(s.hit, 'pointercancel', eye)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', eye, 1)
    pointer(s.hit, 'pointerdown', eye, 2)
    pointer(s.hit, 'pointerup', eye, 2)
    pointer(s.hit, 'pointerup', eye, 1)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', eye, 3)
    pointer(s.hit, 'pointerup', eye, 3)
    expect(s.progress).toEqual([1])
  })

  it('cancels a stroke when a second pointer lands outside the stage', async () => {
    const s = await mount()
    const eye = s.point('daruma-eye-target-first')
    pointer(s.hit, 'pointerdown', eye, 1)
    pointer(document.body, 'pointerdown', [8, 8], 2)
    pointer(document.body, 'pointerup', [8, 8], 2)
    pointer(s.hit, 'pointerup', eye, 1)
    expect(s.progress).toEqual([])
    expect(s.eye('daruma-pupil-first')).toBe(false)
    pointer(s.hit, 'pointerdown', eye, 3)
    pointer(s.hit, 'pointerup', eye, 3)
    expect(s.progress).toEqual([1])
  })

  it('also rejects a second stage pointer when the first finger began outside', async () => {
    const s = await mount()
    const eye = s.point('daruma-eye-target-first')
    pointer(document.body, 'pointerdown', [8, 8], 1)
    pointer(s.hit, 'pointerdown', eye, 2)
    pointer(s.hit, 'pointerup', eye, 2)
    pointer(document.body, 'pointerup', [8, 8], 1)
    expect(s.progress).toEqual([])
  })

  it('abandons a stroke on lost capture and accepts a fresh single-pointer stroke', async () => {
    const s = await mount()
    const eye = s.point('daruma-eye-target-first')
    pointer(s.hit, 'pointerdown', eye, 1)
    pointer(s.hit, 'lostpointercapture', eye, 1)
    pointer(s.hit, 'pointerup', eye, 1)
    expect(s.progress).toEqual([])
    // A release can synchronously emit lostcapture: clear ownership first.
    s.hit.releasePointerCapture = (id) => pointer(s.hit, 'lostpointercapture', eye, id)
    pointer(s.hit, 'pointerdown', eye, 2)
    pointer(s.hit, 'pointerup', eye, 2)
    expect(s.progress).toEqual([1])
  })

  it('cancels an uncaptured release outside the stage and frees the pointer stream', async () => {
    const s = await mount()
    const eye = s.point('daruma-eye-target-first')
    pointer(s.hit, 'pointerdown', eye, 1)
    pointer(document.body, 'pointerup', eye, 1)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', eye, 2)
    pointer(s.hit, 'pointerup', eye, 2)
    expect(s.progress).toEqual([1])
  })

  it('disables the writer while paused and reenables it after resuming', async () => {
    let active = true
    const s = await mount(1, { isActive: () => active })
    const input = s.overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    active = false
    s.run(0.1)
    expect(input.disabled).toBe(true)
    s.write('继续练习')
    expect(s.saveWish).not.toHaveBeenCalled()
    active = true
    s.run(0.025)
    expect(input.disabled).toBe(false)
    s.write('继续练习')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('继续练习')
  })

  it('disables the writer on window blur until focus returns', async () => {
    const s = await mount(1)
    const input = s.overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    window.dispatchEvent(new Event('blur'))
    expect(input.disabled).toBe(true)
    s.write('继续练习')
    s.button.click()
    expect(s.progress).toEqual([])
    expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus'))
    expect(input.disabled).toBe(false)
    s.write('继续练习')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('继续练习')
  })

  it('requires the blank eye on return and leaves the already-painted eye alone', async () => {
    const s = await mount(0, { returning: true })
    const filled = s.point('daruma-eye-target-first')
    pointer(s.hit, 'pointerdown', filled)
    pointer(s.hit, 'pointerup', filled)
    expect(s.progress).toEqual([])
    expect(s.eye('daruma-pupil-second')).toBe(false)
    const blank = s.point('daruma-eye-target-second')
    pointer(s.hit, 'pointerdown', blank)
    pointer(s.hit, 'pointerup', blank)
    expect(s.progress).toEqual([1])
    expect(s.eye('daruma-pupil-second')).toBe(true)
  })

  it('cancels a drag when paused and requires a fresh gesture after resuming', async () => {
    let active = true
    const s = await mount(0, { isActive: () => active })
    const eye = s.point('daruma-eye-target-first')
    pointer(s.hit, 'pointerdown', eye)
    active = false
    s.run(0.1)
    active = true
    pointer(s.hit, 'pointerup', eye)
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', eye)
    pointer(s.hit, 'pointerup', eye)
    expect(s.progress).toEqual([1])
  })

  it('does not settle from a canceled drag and pauses the settling animation', async () => {
    let active = true
    const s = await mount(2, { isActive: () => active })
    const doll = s.point('daruma-eye-target-first')
    const stand = s.point('daruma-stand')
    pointer(s.hit, 'pointerdown', doll)
    pointer(s.hit, 'pointermove', stand)
    pointer(s.hit, 'pointercancel', stand)
    s.run(2)
    expect(s.progress).toEqual([])
    s.button.click()
    s.run(0.1)
    active = false
    s.run(2)
    expect(s.progress).toEqual([])
    expect(s.complete).not.toHaveBeenCalled()
    active = true
    s.run(2)
    expect(s.progress).toEqual([3])
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('settles a doll dragged onto its stand after the wish step', async () => {
    const s = await mount(2)
    const doll = s.point('daruma-eye-target-first')
    const stand = s.point('daruma-stand')
    pointer(s.hit, 'pointerdown', doll)
    pointer(s.hit, 'pointermove', stand)
    pointer(s.hit, 'pointerup', stand)
    s.run(2)
    expect(s.progress).toEqual([3])
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('removes its input listeners and releases owned geometry, materials and textures', async () => {
    const s = await mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>()
    s.scene.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      const materials = Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []
      for (const material of materials) {
        resources.add(material)
        for (const value of Object.values(material)) if (value instanceof THREE.Texture) resources.add(value)
      }
    })
    const disposed = new Set<unknown>()
    resources.forEach((resource) => resource.addEventListener('dispose', () => disposed.add(resource)))
    const eye = s.point('daruma-eye-target-first')
    s.instance.dispose()
    s.button.click()
    pointer(s.hit, 'pointerdown', eye)
    pointer(s.hit, 'pointerup', eye)
    s.run(2)
    expect(s.progress).toEqual([])
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.overlay.childElementCount).toBe(0)
    expect(disposed.size).toBe(resources.size)
  })

  it('unregisters every owned window pointer and focus listener on disposal', async () => {
    // Spies retain native event delivery; the assertion checks closure ownership.
    const added = vi.spyOn(window, 'addEventListener')
    const removed = vi.spyOn(window, 'removeEventListener')
    const s = await mount()
    const types = new Set(['pointerdown', 'pointerup', 'pointercancel', 'blur', 'focus'])
    const registrations = added.mock.calls.filter(([type]) => types.has(type))
    const capture = (options: boolean | EventListenerOptions | undefined) =>
      typeof options === 'boolean' ? options : options?.capture ?? false
    s.instance.dispose()
    for (const [type, listener, options] of registrations) {
      expect(removed.mock.calls.some(([removedType, removedListener, removedOptions]) =>
        removedType === type && removedListener === listener && capture(removedOptions) === capture(options),
      ), `scene-owned ${type} listener must be released`).toBe(true)
    }
  })
})
