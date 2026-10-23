// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Only the GPU boundary is replaced; geometry, projection, rays and DOM input remain real.
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
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    drawn.scene = scene
    drawn.camera = camera
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))

import { createDiyaOilLamp } from './scene'
import { meta } from './index'

const live: ReturnType<typeof createDiyaOilLamp>[] = []
beforeEach(() => { drawn.scene = drawn.camera = null })
afterEach(() => {
  live.forEach((instance) => instance.dispose())
  live.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], complete = vi.fn(), saveWish = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createDiyaOilLamp({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: (n) => progress.push(n), saveWish, haptic, stage: 'night', isSoundEnabled: () => false, ...extra })
  live.push(instance)
  instance.start()
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}
  hit.releasePointerCapture = () => {}
  const run = (seconds = 2) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
  run(0.05)
  return { canvas, overlay, instance, button, hit, progress, complete, saveWish, haptic, run }
}
type Mounted = ReturnType<typeof mount>
type Point = [number, number]
function object(name: string) {
  const found = drawn.scene!.getObjectByName(name)
  expect(found, `${name} must be represented in the actual scene`).toBeDefined()
  return found!
}
function project(s: Mounted, target: THREE.Object3D): Point {
  drawn.scene!.updateMatrixWorld(true)
  drawn.camera!.updateMatrixWorld(true)
  const p = target.getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
  return [(p.x + 1) * s.canvas.clientWidth / 2, (1 - p.y) * s.canvas.clientHeight / 2]
}
function pointer(s: Mounted, type: string, [x, y]: Point, pointerId = 1, target: HTMLElement = s.hit) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId, button: 0, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1 })
  target.dispatchEvent(e)
}
function tapWick(s: Mounted, index: number, end = 'pointerup') {
  const p = project(s, object(`diya-wick-target-${index}`))
  pointer(s, 'pointerdown', p)
  pointer(s, end, p)
  s.run()
}
function route(s: Mounted): Point[] {
  return object('diya-orbit-guide').children.filter((o) => o.name.startsWith('diya-orbit-waypoint-')).map((o) => project(s, o))
}
function circle(s: Mounted, end = 'pointerup') {
  const points = route(s)
  pointer(s, 'pointerdown', project(s, object('diya-held-target')))
  points.forEach((p) => pointer(s, 'pointermove', p))
  pointer(s, end, points.at(-1)!)
  s.run()
}
function putBack(s: Mounted, end = 'pointerup') {
  const start = project(s, object('diya-held-target')), destination = project(s, object('diya-plate-target'))
  pointer(s, 'pointerdown', start)
  pointer(s, 'pointermove', destination)
  pointer(s, end, destination)
  s.run()
}
function doneDots(s: Mounted) { return s.overlay.querySelectorAll('[data-state="done"]').length }

describe('diya scene state', () => {
  it('removes lit wick cues and follows the held lamp through rotate, return and completion', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    const enabled = () => {
      const cues: Array<{ object: THREE.Object3D; cue: InteractionCue }> = []
      drawn.scene!.traverse(object => {
        for (const cue of (object.userData.interactionCues as InteractionCue[] | undefined) ?? []) {
          if (cue.enabled()) cues.push({ object, cue })
        }
      })
      return cues
    }
    expect(enabled().map(({ object }) => object.name)).toEqual(['diya-wick-target-0', 'diya-wick-target-1', 'diya-wick-target-2'])
    s.button.click()
    expect(enabled().map(({ object }) => object.name)).toEqual(['diya-wick-target-1', 'diya-wick-target-2'])
    s.button.click(); s.button.click()
    expect(enabled().map(({ cue }) => cue.kind)).toEqual(['rotate'])
    active = false
    expect(enabled()).toEqual([])
    active = true
    s.button.click()
    expect(enabled()).toEqual([])
    s.run()
    expect(enabled().map(({ cue }) => cue.kind)).toEqual(['drag'])
    expect(enabled()[0].cue.destination).toBe(object('diya-plate-target'))
    s.button.click()
    expect(enabled()).toEqual([])
    s.run()
    expect(enabled()).toEqual([])
  })

  it('offers the diya tradition as a separate drag and spin scene', () => {
    expect(meta).toMatchObject({ id: 'diya-oil-lamp', title: '灯旋一瞥', traditionSlug: 'diya-oil-lamp', grade: 'C', sensitivity: '中', gestures: ['drag', 'spin'] })
  })
  it('lights three separate lamps before advancing, then circles and puts back exactly once', () => {
    const s = mount()
    s.button.click(); s.run()
    s.button.click(); s.run()
    expect(s.progress).toEqual([])
    s.button.click(); s.run()
    expect(s.progress).toEqual([1])
    s.button.click(); s.run()
    expect(s.progress).toEqual([1, 2])
    expect(s.complete).not.toHaveBeenCalled()
    s.button.click(); s.run()
    s.button.click(); s.run()
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('.scene-wish-slot')).toBeNull()
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently with the corresponding visible lights and control', (checkpoint) => {
    const s = mount(checkpoint)
    s.run()
    expect(doneDots(s)).toBe(checkpoint)
    expect(s.progress).toEqual([])
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.haptic).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(checkpoint === 3)
    for (let i = 0; i < 3; i++) expect(object(`diya-flame-${i}`).visible).toBe(checkpoint > 0)
    expect(object('diya-orbit-guide').visible).toBe(checkpoint === 1)
    expect(object('diya-return-guide').visible).toBe(checkpoint === 2)
  })
  it('requires every intentional action in reduced motion without waiting for frames', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.run(20)
    expect(s.progress).toEqual([])
    s.button.click(); s.button.click()
    expect(s.progress).toEqual([])
    s.button.click()
    expect(s.progress).toEqual([1])
    s.button.click()
    expect(s.progress).toEqual([1, 2])
    s.button.click()
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
  })
  it('ignores a repeated action during the deliberate circle animation', () => {
    const s = mount(1)
    s.button.click(); s.button.click()
    s.run()
    expect(s.progress).toEqual([2])
    expect(s.complete).not.toHaveBeenCalled()
  })
})

describe('diya object gestures', () => {
  it('lights distinct wick objects, completes an actual circle, and returns to the plate', () => {
    const s = mount()
    tapWick(s, 0); tapWick(s, 0)
    expect(s.progress).toEqual([])
    tapWick(s, 1); tapWick(s, 2)
    expect(s.progress).toEqual([1])
    circle(s)
    expect(s.progress).toEqual([1, 2])
    putBack(s)
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledOnce()
  })
  it('can light another wick with a short object-to-object drag', () => {
    const s = mount()
    const a = project(s, object('diya-wick-target-0')), b = project(s, object('diya-wick-target-1'))
    pointer(s, 'pointerdown', a); pointer(s, 'pointermove', b); pointer(s, 'pointerup', b)
    s.run()
    expect(object('diya-flame-0').visible).toBe(true)
    expect(object('diya-flame-1').visible).toBe(true)
    expect(object('diya-flame-2').visible).toBe(false)
    expect(s.progress).toEqual([])
  })
  it('claims only touches beginning on a wick and rejects an outside-first circle', () => {
    const s = mount()
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] })
      s.hit.dispatchEvent(e)
      return e.defaultPrevented
    }
    expect(touch([5, 5])).toBe(false)
    expect(touch(project(s, object('diya-wick-target-0')))).toBe(true)
    pointer(s, 'pointerdown', [5, 5])
    const wick = project(s, object('diya-wick-target-0'))
    pointer(s, 'pointermove', wick); pointer(s, 'pointerup', wick)
    expect(object('diya-flame-0').visible).toBe(false)
  })
  it('rejects a random swipe, endpoint jump, and repeated short back-and-forth motion', () => {
    const s = mount(1)
    const points = route(s), start = project(s, object('diya-held-target'))
    pointer(s, 'pointerdown', start); pointer(s, 'pointermove', [5, 5]); pointer(s, 'pointerup', [5, 5])
    pointer(s, 'pointerdown', start); pointer(s, 'pointermove', points.at(-1)!); pointer(s, 'pointerup', points.at(-1)!)
    pointer(s, 'pointerdown', start)
    for (let i = 0; i < 12; i++) { pointer(s, 'pointermove', points[1]); pointer(s, 'pointermove', points[0]) }
    pointer(s, 'pointerup', points[0]); s.run()
    expect(s.progress).toEqual([])
    circle(s)
    expect(s.progress).toEqual([2])
  })
  it.each([0, 1, 2])('does not advance checkpoint %i when a gesture is canceled or loses capture', (checkpoint) => {
    const s = mount(checkpoint)
    if (checkpoint === 0) tapWick(s, 0, 'pointercancel')
    if (checkpoint === 1) circle(s, 'pointercancel')
    if (checkpoint === 2) putBack(s, 'pointercancel')
    expect(s.progress).toEqual([])
    if (checkpoint === 0) expect(object('diya-flame-0').visible).toBe(false)
    const start = project(s, object(checkpoint === 0 ? 'diya-wick-target-0' : 'diya-held-target'))
    pointer(s, 'pointerdown', start); pointer(s, 'lostpointercapture', start); pointer(s, 'pointerup', start)
    s.run()
    expect(s.progress).toEqual([])
  })
  it.each(['first', 'second'])('rejects an outside %s pointer and a button while a lamp is held', (order) => {
    const s = mount(1), points = route(s), start = project(s, object('diya-held-target'))
    if (order === 'first') pointer(s, 'pointerdown', [5, 5], 2, document.body)
    pointer(s, 'pointerdown', start, 1)
    s.button.click()
    if (order === 'second') pointer(s, 'pointerdown', [5, 5], 2, document.body)
    points.forEach((p) => pointer(s, 'pointermove', p, 1))
    pointer(s, 'pointerup', points.at(-1)!, 1); pointer(s, 'pointerup', [5, 5], 2, document.body)
    s.run()
    expect(s.progress).toEqual([])
    circle(s)
    expect(s.progress).toEqual([2])
  })
  it('rejects a held gesture interrupted by pause and allows a fresh gesture after resume', () => {
    let active = true
    const s = mount(1, { isActive: () => active }), points = route(s)
    pointer(s, 'pointerdown', project(s, object('diya-held-target')))
    points.forEach((p) => pointer(s, 'pointermove', p))
    active = false; s.run(0.1); s.button.click()
    active = true; pointer(s, 'pointerup', points.at(-1)!)
    s.run()
    expect(s.progress).toEqual([])
    circle(s)
    expect(s.progress).toEqual([2])
  })
})

describe('diya shape and lifecycle', () => {
  it.each([320, 390, 1280])('keeps the three open lamp dishes above the courtyard floor and every circular waypoint in a %ipx frame', (width) => {
    const s = mount(1, {}, width)
    for (let i = 0; i < 3; i++) {
      const dish = object(`diya-dish-${i}`) as THREE.Mesh
      const bounds = new THREE.Box3().setFromObject(dish)
      expect(bounds.min.y).toBeGreaterThanOrEqual(0)
      expect(dish.geometry).not.toBeInstanceOf(THREE.SphereGeometry)
      const center = dish.getWorldPosition(new THREE.Vector3())
      const down = new THREE.Raycaster(new THREE.Vector3(center.x, 3, center.z), new THREE.Vector3(0, -1, 0))
      const well = down.intersectObject(dish)[0]
      expect(well, 'the dish has an actual recessed inner floor').toBeDefined()
      expect(well.point.y).toBeLessThan(bounds.max.y - 0.12)
      expect(object(`diya-oil-${i}`).visible).toBe(true)
      expect(object(`diya-wick-${i}`).visible).toBe(true)
      expect(object(`diya-rim-${i}`).visible).toBe(true)
    }
    route(s).forEach(([x, y]) => { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(width); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(520) })
  })
  it('releases every geometry, material, halo texture and light and detaches input', () => {
    const s = mount(), resources = new Set<{ dispose(): void }>()
    drawn.scene!.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) resources.add(mesh.geometry)
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((material) => {
        resources.add(material)
        const map = (material as THREE.MeshStandardMaterial).map
        if (map) resources.add(map)
      })
      if (o instanceof THREE.Light && 'dispose' in o) resources.add(o as THREE.Light & { dispose(): void })
      if (o instanceof THREE.DirectionalLight || o instanceof THREE.PointLight) {
        // Render-target objects stay real; only their GPU allocation is absent.
        o.shadow.map = new THREE.WebGLRenderTarget(4, 4)
        o.shadow.mapPass = new THREE.WebGLRenderTarget(4, 4)
        resources.add(o.shadow.map)
        resources.add(o.shadow.mapPass)
      }
    })
    const cleanup = [...resources].map((r) => ({ resource: r, spy: vi.spyOn(r, 'dispose') }))
    const p = project(s, object('diya-wick-target-0')), button = s.button
    s.instance.dispose(); s.instance.dispose()
    cleanup.forEach(({ resource, spy }) => expect(spy, resource.constructor.name).toHaveBeenCalledOnce())
    pointer(s, 'pointerdown', p); pointer(s, 'pointerup', p); button.click(); s.instance.update(10)
    expect(s.progress).toEqual([])
    expect(s.overlay.childElementCount).toBe(0)
    expect(drawn.scene!.children).toHaveLength(0)
  })
})

describe('continuous lamp orbit tolerance',()=>{
  it.each([12,16,24,60].flatMap(count=>[0,.5].map(phase=>[count,phase])))('accepts %i orbit samples with phase %s',(count,phase)=>{
    const s=mount(1,{isReducedMotion:()=>true})
    const at=(t:number,r=.60):Point=>{const a=Math.PI/2+t*Math.PI*2,p=new THREE.Vector3(Math.cos(a)*r,.84,Math.sin(a)*r).project(drawn.camera!);return[(p.x+1)*195,(1-p.y)*260]}
    pointer(s,'pointerdown',project(s,object('diya-held-target')))
    for(let i=phase?0:1;i+phase<count;i++)pointer(s,'pointermove',at((i+phase)/count))
    pointer(s,'pointermove',at(1))
    expect(s.overlay.querySelector('.scene-hint')?.getAttribute('data-progress')).toBe('true')
    pointer(s,'pointerup',at(1));expect(s.progress).toEqual([2])
    expect(s.overlay.querySelector('.scene-hint')?.hasAttribute('data-progress')).toBe(false)
  })
  it('continues a circle after a short outward correction and small reversal',()=>{
    const s=mount(1,{isReducedMotion:()=>true})
    const at=(t:number,r=.60):Point=>{const a=Math.PI/2+t*Math.PI*2,p=new THREE.Vector3(Math.cos(a)*r,.84,Math.sin(a)*r).project(drawn.camera!);return[(p.x+1)*195,(1-p.y)*260]}
    pointer(s,'pointerdown',project(s,object('diya-held-target')))
    for(let i=1;i<=16;i++){
      if(i===8){pointer(s,'pointermove',at(7/16,.81));pointer(s,'pointermove',at(6.7/16))}
      pointer(s,'pointermove',at(i/16))
    }
    pointer(s,'pointerup',at(1));expect(s.progress).toEqual([2])
  })
})


  it('cancels a completed orbit on blur and requires fresh focused input',()=>{
    const s=mount(1,{isReducedMotion:()=>true}),r=route(s)
    pointer(s,'pointerdown',project(s,object('diya-held-target')));r.forEach(p=>pointer(s,'pointermove',p))
    window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))
    pointer(s,'pointerup',r.at(-1)!);expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('blur'));circle(s);expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('focus'));circle(s);expect(s.progress).toEqual([2])
  })


it('does not start the lamp orbit through a nearer opaque surface',()=>{
 const s=mount(1,{isReducedMotion:()=>true}),a=object('diya-held-target').getWorldPosition(new THREE.Vector3())
 const block=new THREE.Mesh(new THREE.PlaneGeometry(1.2,1.2),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
 block.position.lerpVectors(a,drawn.camera!.position,.3);block.quaternion.copy(drawn.camera!.quaternion);drawn.scene!.add(block)
 circle(s);expect(s.progress).toEqual([])
 block.removeFromParent();block.geometry.dispose();block.material.dispose();circle(s);expect(s.progress).toEqual([2])
})
