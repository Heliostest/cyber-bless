// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Keep the actual Three geometry/rays and DOM gestures; jsdom lacks a GPU.
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

import { createMizuhiki } from './scene'

const live: ReturnType<typeof createMizuhiki>[] = []
beforeEach(() => {
  drawn.scene = drawn.camera = null
  // Only text rasterization needs a 2D canvas. The scene state stays real.
  vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue({
    clearRect() {}, fillRect() {}, fillText() {}, measureText(text: string) { return { width: Array.from(text).length * 20 } },
  } as unknown as CanvasRenderingContext2D)
})
afterEach(() => {
  live.forEach((s) => s.dispose())
  live.length = 0
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: 520 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height: 520, right: width, bottom: 520 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createMizuhiki({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: (n) => progress.push(n), saveWish, isSoundEnabled: () => false, ...extra })
  live.push(instance)
  instance.start()
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = vi.fn()
  hit.releasePointerCapture = vi.fn()
  const run = (seconds = 2) => { for (let t = 0; t < seconds; t += 0.05) instance.update(0.05) }
  run(0.05)
  return { canvas, overlay, instance, button, hit, progress, saveWish, complete, run }
}
type Mounted = ReturnType<typeof mount>
type Point = [number, number]

function pointer(s: Mounted, type: string, [x, y]: Point, pointerId = 1) {
  const e = new Event(type, { cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId, buttons: type === 'pointerup' || type === 'pointercancel' ? 0 : 1, button: 0 })
  s.hit.dispatchEvent(e)
}
function project(s: Mounted, object: THREE.Object3D): Point {
  drawn.scene!.updateMatrixWorld(true)
  drawn.camera!.updateMatrixWorld(true)
  const p = object.getWorldPosition(new THREE.Vector3()).project(drawn.camera!)
  return [(p.x + 1) * s.canvas.clientWidth / 2, (1 - p.y) * s.canvas.clientHeight / 2]
}
function route(s: Mounted): Point[] {
  const guides = drawn.scene?.getObjectByName('mizuhiki-path-guide')
  expect(guides, 'the object presents a visible guided cord path').toBeDefined()
  return guides!.children.filter((o) => o.visible && o.name.startsWith('mizuhiki-waypoint-')).map((o) => project(s, o))
}
function follow(s: Mounted, cancel = false) {
  const points = route(s)
  pointer(s, 'pointerdown', points[0])
  points.slice(1).forEach((p) => pointer(s, 'pointermove', p))
  pointer(s, cancel ? 'pointercancel' : 'pointerup', points.at(-1)!)
  s.run()
}
function write(s: Mounted, text: string) {
  const input = s.overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')
  expect(input, 'the completed knot opens a wish form').not.toBeNull()
  input!.value = text
  input!.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
}
function dot(s: Mounted) {
  return s.overlay.querySelectorAll('[data-state="done"]').length
}

describe('mizuhiki craft state', () => {
  it('keeps the cord destination on the next ordered gate and suppresses cues during animation and writing', () => {
    const s = mount()
    const tip = drawn.scene!.getObjectByName('mizuhiki-cord-end-target')!
    const cues = tip?.userData.interactionCues as InteractionCue[] | undefined
    expect(cues).toHaveLength(2)
    const enabled = () => cues!.filter(cue => cue.enabled())
    expect(enabled()).toHaveLength(1)
    const target = enabled()[0].destination as () => THREE.Vector3
    const firstGate = drawn.scene!.getObjectByName('mizuhiki-waypoint-1')!
    expect(target().distanceTo(firstGate.getWorldPosition(new THREE.Vector3()))).toBeCloseTo(0)
    const points = route(s)
    pointer(s, 'pointerdown', points[0])
    pointer(s, 'pointermove', points[1])
    const nextGate = drawn.scene!.getObjectByName('mizuhiki-waypoint-2')!
    expect(target().distanceTo(nextGate.getWorldPosition(new THREE.Vector3()))).toBeCloseTo(0)
    pointer(s, 'pointercancel', points[1])
    s.button.click()
    expect(enabled()).toEqual([])
    s.run()
    expect(enabled()).toHaveLength(1)
    s.button.click(); s.run()
    expect(enabled()).toEqual([])
  })

  it('reports exactly three integer checkpoints through the keyboard button fallback', () => {
    const s = mount()
    for (const n of [1, 2, 3]) {
      s.button.click()
      s.run()
      expect(s.progress).toEqual([1, 2, 3].slice(0, n))
    }
    expect(s.complete).toHaveBeenCalledOnce()
    s.button.click()
    s.run()
    expect(s.progress).toEqual([1, 2, 3])
  })

  it('ignores a quick repeat while the loop is moving', () => {
    const s = mount()
    s.button.click()
    s.button.click()
    s.run()
    expect(s.progress).toEqual([1])
    expect(dot(s)).toBe(1)
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i with visible state and silent host effects', (initial) => {
    const s = mount(initial)
    s.run()
    expect(dot(s)).toBe(initial)
    expect(s.progress).toEqual([])
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(initial === 3)
    const slot = s.overlay.querySelector<HTMLElement>('.scene-wish-slot')
    expect(slot?.hidden).toBe(initial !== 2)
  })

  it('rejects buttons, wish submits and drags while paused, then resumes', () => {
    let active = false
    const s = mount(0, { isActive: () => active })
    s.button.click()
    follow(s)
    expect(s.progress).toEqual([])
    active = true
    s.run(.05)
    s.button.click()
    s.run()
    expect(s.progress).toEqual([1])
    s.button.click()
    s.run()
    active = false
    write(s, '愿友人顺遂')
    s.button.click()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    active = true
    write(s, '愿友人顺遂')
    expect(s.saveWish).toHaveBeenCalledOnce()
    expect(s.complete).toHaveBeenCalledOnce()
  })

  it('finishes both cord actions without animation frames in reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.button.click()
    expect(s.progress).toEqual([1])
    s.button.click()
    expect(s.progress).toEqual([1, 2])
    write(s, '  愿此刻平安  ')
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.saveWish).toHaveBeenCalledWith('愿此刻平安')
    write(s, '愿此刻平安')
    s.button.click()
    expect(s.saveWish).toHaveBeenCalledOnce()
    expect(s.complete).toHaveBeenCalledOnce()
  })
})

describe('mizuhiki object gestures', () => {
  it('forms the first loop and pulls through the second along their guided paths', () => {
    const s = mount()
    follow(s)
    expect(s.progress).toEqual([1])
    follow(s)
    expect(s.progress).toEqual([1, 2])
    write(s, '愿远方的你安好')
    expect(s.progress).toEqual([1, 2, 3])
  })

  it('rejects off-object starts and random shortcuts, even from the cord end', () => {
    const s = mount()
    const points = route(s)
    const touch = (p: Point) => {
      const e = new Event('touchstart', { cancelable: true })
      Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] })
      s.hit.dispatchEvent(e)
      return e.defaultPrevented
    }
    // This legacy JS guard claims the cord; the App CSS reserves all canvas touches.
    expect(touch([5, 5])).toBe(false)
    expect(touch(points[0])).toBe(true)
    pointer(s, 'pointerdown', [5, 5])
    points.slice(1).forEach((p) => pointer(s, 'pointermove', p))
    pointer(s, 'pointerup', points.at(-1)!)
    pointer(s, 'pointerdown', points[0])
    pointer(s, 'pointermove', points.at(-1)!)
    pointer(s, 'pointerup', points.at(-1)!)
    s.run()
    expect(s.progress).toEqual([])
  })

  it.each([0, 1])('does not complete checkpoint %i from pointercancel at the valid endpoint', (initial) => {
    const s = mount(initial)
    follow(s, true)
    expect(s.progress).toEqual([])
    follow(s)
    expect(s.progress).toEqual([initial + 1])
  })

  it('rejects an interrupted gesture when a second pointer joins', () => {
    const s = mount()
    const points = route(s)
    pointer(s, 'pointerdown', points[0], 1)
    pointer(s, 'pointermove', points[1], 1)
    pointer(s, 'pointerdown', points[1], 2)
    points.slice(2).forEach((p) => pointer(s, 'pointermove', p, 1))
    pointer(s, 'pointerup', points.at(-1)!, 1)
    pointer(s, 'pointerup', points[1], 2)
    s.run()
    expect(s.progress).toEqual([])
    follow(s)
    expect(s.progress).toEqual([1])
  })

  it('also rejects a second finger that touches outside the scene hit layer', () => {
    const s = mount()
    const points = route(s)
    pointer(s, 'pointerdown', points[0], 1)
    const outside = new Event('pointerdown')
    Object.assign(outside, { pointerId: 2, clientX: 0, clientY: 0, button: 0 })
    document.body.dispatchEvent(outside)
    points.slice(1).forEach((p) => pointer(s, 'pointermove', p, 1))
    pointer(s, 'pointerup', points.at(-1)!, 1)
    const outsideUp = new Event('pointerup')
    Object.assign(outsideUp, { pointerId: 2 })
    document.body.dispatchEvent(outsideUp)
    s.run()
    expect(s.progress).toEqual([])
    follow(s)
    expect(s.progress).toEqual([1])
  })

  it('does not allow the later release to finish a drag interrupted by pause', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    const points = route(s)
    pointer(s, 'pointerdown', points[0])
    points.slice(1).forEach((p) => pointer(s, 'pointermove', p))
    active = false
    s.run(0.05)
    active = true
    pointer(s, 'pointerup', points.at(-1)!)
    s.run()
    expect(s.progress).toEqual([])
  })

  it.each([320, 430])('keeps the complete envelope and all cord guide points in a %ipx frame', (width) => {
    const s = mount(1, {}, width)
    const envelope = drawn.scene?.getObjectByName('mizuhiki-envelope')
    expect(envelope).toBeDefined()
    const bounds = new THREE.Box3().setFromObject(envelope!)
    for (const x of [bounds.min.x, bounds.max.x]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, bounds.max.y, z).project(drawn.camera!)
      expect(Math.abs(point.x)).toBeLessThan(0.96)
      expect(Math.abs(point.y)).toBeLessThan(0.96)
    }
    route(s).forEach(([x, y]) => { expect(x).toBeGreaterThan(0); expect(x).toBeLessThan(width); expect(y).toBeGreaterThan(0); expect(y).toBeLessThan(520) })
  })

  it('releases the owned scene resources and detaches all input after dispose', () => {
    const s = mount()
    const geometries = new Set<THREE.BufferGeometry>(), materials = new Set<THREE.Material>(), textures = new Set<THREE.Texture>()
    drawn.scene!.traverse((o) => {
      const mesh = o as THREE.Mesh
      if (mesh.geometry) geometries.add(mesh.geometry)
      if (mesh.material) (Array.isArray(mesh.material) ? mesh.material : [mesh.material]).forEach((m) => {
        materials.add(m)
        const map = (m as THREE.MeshStandardMaterial).map
        if (map) textures.add(map)
      })
    })
    const cleanup = [...geometries, ...materials, ...textures].map((r) => vi.spyOn(r, 'dispose'))
    const button = s.button
    const points = route(s)
    s.instance.dispose()
    cleanup.forEach((spy) => expect(spy).toHaveBeenCalledOnce())
    pointer(s, 'pointerdown', points[0])
    pointer(s, 'pointerup', points.at(-1)!)
    button.click()
    s.instance.update(10)
    expect(s.progress).toEqual([])
    expect(s.overlay.childElementCount).toBe(0)
  })
})

describe('continuous cord path tolerance',()=>{
  it.each([12,16,24,60].flatMap(count=>[0,.5].map(phase=>[count,phase])))('accepts %i curve samples with phase %s',(count,phase)=>{
    const s=mount(0,{isReducedMotion:()=>true})
    for(let stage=0;stage<2;stage++){
      const guide=drawn.scene!.getObjectByName('mizuhiki-path-guide')!
      const marks=guide.children.filter(o=>o.visible&&o.name.startsWith('mizuhiki-waypoint-'))
      const curve=new THREE.CatmullRomCurve3(marks.map(o=>o.getWorldPosition(new THREE.Vector3())),false,'centripetal')
      const screen=(t:number):Point=>{const p=curve.getPoint(t).project(drawn.camera!);return[(p.x+1)*195,(1-p.y)*260]}
      pointer(s,'pointerdown',screen(0))
      for(let i=phase?0:1;i+phase<count;i++)pointer(s,'pointermove',screen((i+phase)/count))
      pointer(s,'pointermove',screen(1))
      expect(s.overlay.querySelector('.scene-hint')?.getAttribute('data-progress')).toBe('true')
      pointer(s,'pointerup',screen(1));expect(s.progress).toEqual(stage===0?[1]:[1,2])
      expect(s.overlay.querySelector('.scene-hint')?.hasAttribute('data-progress')).toBe(false)
    }
  })
  it('sweeps a gate between samples instead of requiring an event inside it',()=>{
    const s=mount(0,{isReducedMotion:()=>true}),guide=drawn.scene!.getObjectByName('mizuhiki-path-guide')!
    const marks=guide.children.filter(o=>o.visible&&o.name.startsWith('mizuhiki-waypoint-'))
    const p0=marks[0].getWorldPosition(new THREE.Vector3()),p1=marks[1].getWorldPosition(new THREE.Vector3()),p2=marks[2].getWorldPosition(new THREE.Vector3())
    const screen=(p:THREE.Vector3):Point=>{const q=p.clone().project(drawn.camera!);return[(q.x+1)*195,(1-q.y)*260]}
    const r=route(s);pointer(s,'pointerdown',r[0])
    pointer(s,'pointermove',screen(p1.clone().add(p0.clone().sub(p1).normalize().multiplyScalar(.18))))
    pointer(s,'pointermove',screen(p1.clone().add(p2.clone().sub(p1).normalize().multiplyScalar(.18))))
    r.slice(2).forEach(p=>pointer(s,'pointermove',p));pointer(s,'pointerup',r.at(-1)!);expect(s.progress).toEqual([1])
  })
})


  it('cancels a completed cord path on blur and requires fresh focused input',()=>{
    const s=mount(0,{isReducedMotion:()=>true}),r=route(s)
    pointer(s,'pointerdown',r[0]);r.slice(1).forEach(p=>pointer(s,'pointermove',p))
    window.dispatchEvent(new Event('blur'));window.dispatchEvent(new Event('focus'))
    pointer(s,'pointerup',r.at(-1)!);expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('blur'));follow(s);expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('focus'));follow(s);expect(s.progress).toEqual([1])
  })


it('does not start the cord through a nearer opaque surface',()=>{
 const s=mount(0,{isReducedMotion:()=>true}),a=drawn.scene!.getObjectByName('mizuhiki-cord-end-target')!.getWorldPosition(new THREE.Vector3())
 const block=new THREE.Mesh(new THREE.PlaneGeometry(.8,.8),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
 block.position.lerpVectors(a,drawn.camera!.position,.12);block.quaternion.copy(drawn.camera!.quaternion);drawn.scene!.add(block)
 follow(s);expect(s.progress).toEqual([])
 block.removeFromParent();block.geometry.dispose();block.material.dispose();follow(s);expect(s.progress).toEqual([1])
})
