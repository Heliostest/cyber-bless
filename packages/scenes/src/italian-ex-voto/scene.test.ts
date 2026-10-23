// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// GPU rendering alone is mocked: real geometry, rays, projected cues and the wish form are exercised.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown }))
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this }
    setClearColor() {} setPixelRatio() {} setSize() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { scene.updateMatrixWorld(); camera.updateMatrixWorld(); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390, height = 560) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  const left = 17, top = 91
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, shared: Shared, gestures: Gestures, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(0.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(); camera.updateMatrixWorld()
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += 0.025) instance.update(0.025) }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  return { instance, scene, camera, host, overlay, hit: hit!, button: button!, point, run, write, progress, saveWish, complete, haptic, width, height, left, top }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(e)
}
function tap(s: ReturnType<typeof mount>, name = 'exvoto-ceramic-plaque') {
  const p = s.point(name); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
}
function drag(s: ReturnType<typeof mount>, name: string, target: string) {
  const a = s.point(name), b = s.point(target)
  pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', b); pointer(s.hit, 'pointerup', b); s.run()
}
function enabled(s: ReturnType<typeof mount>) {
  const result: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) result.push({ object, cue }) })
  return result
}

function trace(s: ReturnType<typeof mount>) {
  const from = s.point('exvoto-brush-tip'), to = s.point('exvoto-window-end')
  pointer(s.hit, 'pointerdown', from)
  for (let i = 1; i <= 8; i++) pointer(s.hit, 'pointermove', [from[0] + (to[0] - from[0]) * i / 8, from[1] + (to[1] - from[1]) * i / 8])
  pointer(s.hit, 'pointerup', to); s.run()
}

describe('Italian ex voto original ceramic painting', () => {
  it('paints a path from the actual brush, traces window light and quietly taps the ceramic', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'exvoto-brush-tip', 'exvoto-route-origin'); expect(s.progress).toEqual([1])
    trace(s); expect(s.progress).toEqual([1, 2]); tap(s); tap(s)
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('rejects off-object origins, wrong destinations, skipped strokes and off-path tracing', () => {
    const s = mount(0, { isReducedMotion: () => true })
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', s.point('exvoto-route-origin'))
    drag(s, 'exvoto-window-end', 'exvoto-route-origin'); expect(s.progress).toEqual([])
    const original = s.scene.getObjectByName('exvoto-brush')!.position.clone()
    pointer(s.hit, 'pointerdown', s.point('exvoto-brush-tip')); pointer(s.hit, 'pointermove', [1, 1]); pointer(s.hit, 'pointerup', [1, 1])
    expect(s.scene.getObjectByName('exvoto-brush')!.position.equals(original)).toBe(true)
    drag(s, 'exvoto-brush-tip', 'exvoto-route-origin')
    const start = s.point('exvoto-brush-tip'), end = s.point('exvoto-window-end')
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointerup', end); expect(s.progress).toEqual([1])
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointermove', [start[0] + 100, start[1] + 80]); pointer(s.hit, 'pointermove', end); pointer(s.hit, 'pointerup', end)
    expect(s.progress).toEqual([1])
    pointer(s.hit, 'pointerdown', end); pointer(s.hit, 'pointermove', start); pointer(s.hit, 'pointerup', start)
    expect(s.progress).toEqual([1]); trace(s); expect(s.progress).toEqual([1, 2])
    const p = s.point('exvoto-ceramic-plaque')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 50, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('offers equivalent accessible actions once without implicitly saving a draft', () => {
    const s = mount(0, { isReducedMotion: () => true })
    expect(s.button.tagName).toBe('BUTTON'); expect(s.button.type).toBe('button')
    s.button.click(); s.button.click(); s.overlay.querySelector<HTMLInputElement>('input')!.value = '只是一段草稿'
    s.button.click(); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('saves only an explicitly submitted trimmed thanks once and prevents reentrant writes', () => {
    const s = mount(2)
    s.write('  '); expect(s.progress).toEqual([])
    s.saveWish.mockImplementation(() => s.write('第二次'))
    s.write('  谢谢陪我回家的人  '); s.write('重复提交')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢陪我回家的人'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i and never mounts a returning wish form', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning }); s.run(2)
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(enabled(s).map(e => e.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      expect(s.button.hidden).toBe(at === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || at !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      if (returning && at === 2) { tap(s); expect(s.progress).toEqual([3]); expect(s.saveWish).not.toHaveBeenCalled() }
    }
  })
  it.each(['pointercancel', 'lostpointercapture'])('cancels and restores the actual brush after %s', event => {
    const s = mount(1, { isReducedMotion: () => true }), from = s.point('exvoto-brush-tip'), to = s.point('exvoto-window-end')
    const original = s.scene.getObjectByName('exvoto-brush')!.position.clone()
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, event, to); pointer(s.hit, 'pointerup', to)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('exvoto-brush')!.position.equals(original)).toBe(true)
    trace(s); expect(s.progress).toEqual([2])
  })
  it.each([true, false])('blocks mixed pointer input with outside first %s', outsideFirst => {
    const s = mount(0, { isReducedMotion: () => true }), from = s.point('exvoto-brush-tip'), to = s.point('exvoto-route-origin')
    if (outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', from)
    if (!outsideFirst) pointer(document.body, 'pointerdown', [1, 1], 2)
    s.button.click(); pointer(s.hit, 'pointerup', to); pointer(document.body, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); drag(s, 'exvoto-brush-tip', 'exvoto-route-origin'); expect(s.progress).toEqual([1])
  })
  it('blocks submission while a pointer is down and while inactive or unfocused', () => {
    let active = true
    const s = mount(2, { isActive: () => active })
    pointer(document.body, 'pointerdown', [1, 1]); s.write('谢谢'); s.button.click(); expect(s.progress).toEqual([])
    pointer(document.body, 'pointerup', [1, 1]); active = false; s.run(); s.write('暂停'); tap(s); expect(s.progress).toEqual([])
    active = true; s.run(); window.dispatchEvent(new Event('blur')); s.run()
    expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull(); expect(s.overlay.querySelector<HTMLInputElement>('input')!.disabled).toBe(true)
    s.write('失焦'); s.button.click(); expect(s.saveWish).not.toHaveBeenCalled()
    window.dispatchEvent(new Event('focus')); s.run(); s.write('谢谢'); expect(s.progress).toEqual([3])
  })
  it('cancels unfinished input on pause and freezes an in-flight paint action', () => {
    let active = true
    const s = mount(0, { isActive: () => active }), from = s.point('exvoto-brush-tip'), to = s.point('exvoto-route-origin')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to)
    active = false; s.run(); active = true; pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([])
    s.button.click(); s.run(.1); const p = s.scene.getObjectByName('exvoto-brush')!.position.clone()
    active = false; s.run(2); expect(s.scene.getObjectByName('exvoto-brush')!.position.equals(p)).toBe(true); expect(s.progress).toEqual([])
    active = true; s.run(2); expect(s.progress).toEqual([1]); s.run(); expect(s.progress).toEqual([1])
  })
  it('keeps the animated window pigment on the ceramic face as the stroke grows', () => {
    const s = mount(1)
    s.button.click(); s.run(.3)
    const pigment = s.scene.getObjectByName('exvoto-painted-window-light')!
    expect(pigment.visible).toBe(true)
    const box = new THREE.Box3().setFromObject(pigment)
    expect(box.min.z).toBeGreaterThan(.20); expect(box.max.z).toBeLessThan(.31)
    s.run(); expect(s.progress).toEqual([2])
  })
  it.each([320, 390, 1280])('projects cues onto visible geometry and completes real gestures at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, {}, width, width === 1280 ? 600 : 560)
      for (const { object, cue } of enabled(s)) {
        const p = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(Math.abs(p.x)).toBeLessThan(.95); expect(Math.abs(p.y)).toBeLessThan(.95)
        expect(ray.intersectObject(object).length, object.name).toBeGreaterThan(0)
        const node = s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
        expect(Number(node.dataset.x)).toBeCloseTo((p.x + 1) * width / 2)
        expect(Number(node.dataset.y)).toBeCloseTo((1 - p.y) * s.height / 2)
        if (cue.destination instanceof THREE.Object3D) {
          const dest = cue.destination.getWorldPosition(new THREE.Vector3()).project(s.camera)
          ray.setFromCamera(new THREE.Vector2(dest.x, dest.y), s.camera)
          expect(ray.intersectObject(cue.destination).length).toBeGreaterThan(0)
          const target = s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
          expect(Number(target.dataset.x)).toBeCloseTo((dest.x + 1) * width / 2)
          expect(Number(target.dataset.y)).toBeCloseTo((1 - dest.y) * s.height / 2)
        }
      }
      for (const name of ['exvoto-easel', 'exvoto-palette', 'exvoto-brush', 'exvoto-table', 'exvoto-ceramic-plaque']) {
        const box = new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
        for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
          const q = new THREE.Vector3(x, y, z).project(s.camera)
          expect(Math.abs(q.x), name).toBeLessThan(.98); expect(Math.abs(q.y), name).toBeLessThan(.98)
        }
      }
      s.instance.dispose()
    }
    const s = mount(0, { isReducedMotion: () => true }, width, width === 1280 ? 600 : 560)
    drag(s, 'exvoto-brush-tip', 'exvoto-route-origin'); trace(s); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it('disposes geometry, materials, shadow maps, renderer, DOM and all listeners once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), shadows: number[] = []
    s.scene.traverse(object => {
      const mesh = object as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      for (const mat of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(mat)
      if (object instanceof THREE.DirectionalLight) { const i = shadows.length; shadows.push(0); object.shadow.map = new THREE.WebGLRenderTarget(8, 8); object.shadow.map.addEventListener('dispose', () => { shadows[i]++ }) }
    })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = [...added.mock.calls], renderer = rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose(); s.instance.dispose(); s.button.click(); s.instance.update(5)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(shadows).toEqual([1, 1])
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); expect(s.progress).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const [type, listener, opts] of registrations) expect(removed.mock.calls.some(([t, l, o]) => t === type && l === listener && capture(o) === capture(opts)), type).toBe(true)
  })
})

describe('continuous window stroke tolerance',()=>{
  it.each([1,2,12,16,24,60])('accepts a correct stroke delivered in %i move samples',count=>{
    const s=mount(1,{isReducedMotion:()=>true}),from=s.point('exvoto-brush-tip'),to=s.point('exvoto-window-end')
    pointer(s.hit,'pointerdown',from)
    for(let i=1;i<=count;i++)pointer(s.hit,'pointermove',[from[0]+(to[0]-from[0])*i/count,from[1]+(to[1]-from[1])*i/count])
    expect(s.overlay.querySelector('.scene-hint')?.getAttribute('data-progress')).toBe('true')
    pointer(s.hit,'pointerup',to);expect(s.progress).toEqual([2])
    expect(s.overlay.querySelector('.scene-hint')?.hasAttribute('data-progress')).toBe(false)
  })
  it('allows a brief off-line correction before finishing the same stroke',()=>{
    const s=mount(1,{isReducedMotion:()=>true}),from=s.point('exvoto-brush-tip'),to=s.point('exvoto-window-end')
    const mid:[number,number]=[from[0]+(to[0]-from[0])*.35,from[1]+(to[1]-from[1])*.35]
    pointer(s.hit,'pointerdown',from);pointer(s.hit,'pointermove',mid);pointer(s.hit,'pointermove',[mid[0]+16,mid[1]+12])
    pointer(s.hit,'pointermove',mid);pointer(s.hit,'pointermove',to);pointer(s.hit,'pointerup',to);expect(s.progress).toEqual([2])
  })
})


it('allows a nearby finger to pick up the visible brush tip and draw the window line',()=>{
 const s=mount(1,{isReducedMotion:()=>true}),a=s.point('exvoto-brush-tip'),b=s.point('exvoto-window-end')
 pointer(s.hit,'pointerdown',[a[0]+18,a[1]+10]);pointer(s.hit,'pointermove',b);pointer(s.hit,'pointerup',b);expect(s.progress).toEqual([2])
})
it('keeps a fully drawn window line visible while the accepted brush settles',()=>{
 const s=mount(1),a=s.point('exvoto-brush-tip'),b=s.point('exvoto-window-end'),pigment=s.scene.getObjectByName('exvoto-painted-window-light')!
 pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',b)
 const size=new THREE.Box3().setFromObject(pigment).getSize(new THREE.Vector3())
 pointer(s.hit,'pointerup',b);s.instance.update(.025)
 expect(new THREE.Box3().setFromObject(pigment).getSize(new THREE.Vector3()).distanceTo(size)).toBeLessThan(.001)
 s.run();expect(s.progress).toEqual([2])
})

it('accepts a nearby release after covering the window stroke',()=>{
 const s=mount(1,{isReducedMotion:()=>true}),a=s.point('exvoto-brush-tip'),b=s.point('exvoto-window-end')
 pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',b);pointer(s.hit,'pointerup',[b[0]+18,b[1]]);expect(s.progress).toEqual([2])
})
