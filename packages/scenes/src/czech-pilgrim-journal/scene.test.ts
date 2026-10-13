// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// GPU rendering alone is mocked: geometry, rays, projected cues and native input are real.
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
  return { instance, scene, camera, host, overlay, hit: hit!, button: button!, point, run, progress, saveWish, complete, haptic, width, height, left, top }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(e)
}
function tap(s: ReturnType<typeof mount>) {
  const p = s.point('journal-page-seal'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
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

describe('a contemporary journal inspired by Moravian pilgrimage', () => {
  it('opens the actual cover, inserts its ribbon, and rests on the page exactly once', () => {
    const s = mount(0, { isReducedMotion: () => true })
    drag(s, 'journal-cover-corner', 'journal-cover-rest'); expect(s.progress).toEqual([1])
    drag(s, 'journal-ribbon-grip', 'journal-ribbon-slot'); expect(s.progress).toEqual([1, 2])
    tap(s); tap(s); s.button.click()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('rejects wrong starts, missed rests and taps that leave and return', () => {
    const s = mount(0, { isReducedMotion: () => true })
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', s.point('journal-cover-rest'))
    drag(s, 'journal-ribbon-grip', 'journal-cover-rest')
    pointer(s.hit, 'pointerdown', s.point('journal-cover-corner')); pointer(s.hit, 'pointermove', [1,1]); pointer(s.hit, 'pointerup', [1,1])
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('journal-hinge')!.rotation.z).toBe(0)
    s.button.click(); s.button.click()
    const p=s.point('journal-page-seal')
    pointer(s.hit,'pointerdown',p); pointer(s.hit,'pointermove',[p[0]+40,p[1]]); pointer(s.hit,'pointermove',p); pointer(s.hit,'pointerup',p)
    expect(s.progress).toEqual([1,2]); tap(s); expect(s.progress).toEqual([1,2,3])
  })
  it.each([0,1,2,3])('silently restores %i and exposes the equivalent native action', at => {
    const s=mount(at,{isReducedMotion:()=>true}); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.scene.getObjectByName('journal-hinge')!.rotation.z).toBe(at ? Math.PI : 0)
    expect(s.button.hidden).toBe(at===3); expect(s.overlay.querySelector('input')).toBeNull()
    for(let i=at;i<3;i++)s.button.click()
    expect(s.progress).toEqual([1,2,3].filter(n=>n>at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel','lostpointercapture'])('abandons the unfinished flip on %s', event => {
    const s=mount(0,{isReducedMotion:()=>true}), from=s.point('journal-cover-corner'), to=s.point('journal-cover-rest')
    pointer(s.hit,'pointerdown',from); pointer(s.hit,'pointermove',to); pointer(s.hit,event,to); pointer(s.hit,'pointerup',to)
    expect(s.progress).toEqual([]); expect(s.scene.getObjectByName('journal-hinge')!.rotation.z).toBe(0)
    drag(s,'journal-cover-corner','journal-cover-rest'); expect(s.progress).toEqual([1])
  })
  it.each([true,false])('blocks mixed fingers with outside-first=%s', outsideFirst=>{
    const s=mount(0,{isReducedMotion:()=>true}), from=s.point('journal-cover-corner'), to=s.point('journal-cover-rest')
    if(outsideFirst)pointer(document.body,'pointerdown',[1,1],2)
    pointer(s.hit,'pointerdown',from)
    if(!outsideFirst)pointer(document.body,'pointerdown',[1,1],2)
    s.button.click(); pointer(s.hit,'pointerup',to); pointer(document.body,'pointerup',[1,1],2)
    expect(s.progress).toEqual([]); drag(s,'journal-cover-corner','journal-cover-rest'); expect(s.progress).toEqual([1])
  })
  it('cancels pending input on pause and blur, and freezes accepted animation',()=>{
    let active=true
    const s=mount(0,{isActive:()=>active}), from=s.point('journal-cover-corner'), to=s.point('journal-cover-rest')
    pointer(s.hit,'pointerdown',from); pointer(s.hit,'pointermove',to)
    active=false;s.run();active=true;pointer(s.hit,'pointerup',to);s.run()
    expect(s.progress).toEqual([])
    s.button.click();s.run(.1);const angle=s.scene.getObjectByName('journal-hinge')!.rotation.z
    window.dispatchEvent(new Event('blur'));s.run(2)
    expect(s.scene.getObjectByName('journal-hinge')!.rotation.z).toBe(angle); expect(s.progress).toEqual([])
    expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull();expect(s.button.disabled).toBe(true)
    window.dispatchEvent(new Event('focus'));s.run(2);expect(s.progress).toEqual([1])
  })
  it.each([320,390,1280])('projects visible geometry and completes actual cue gestures at %ipx',width=>{
    const s=mount(0,{isReducedMotion:()=>true},width,width===1280?600:560)
    for(let at=0;at<3;at++){
      for(const {object,cue} of enabled(s)){
        const p=object.localToWorld(new THREE.Vector3(...(cue.anchor??[0,0,0]))).project(s.camera)
        const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(p.x,p.y),s.camera)
        expect(Math.abs(p.x)).toBeLessThan(.95);expect(Math.abs(p.y)).toBeLessThan(.95)
        const visible:THREE.Object3D[]=[];s.scene.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)visible.push(o)})
        expect(ray.intersectObjects(visible,false)[0]?.object,object.name).toBe(object)
        const node=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
        expect(Number(node.dataset.x)).toBeCloseTo((p.x+1)*width/2)
      }
      if(at===0)drag(s,'journal-cover-corner','journal-cover-rest')
      else if(at===1)drag(s,'journal-ribbon-grip','journal-ribbon-slot')
      else tap(s)
      expect(s.progress.at(-1)).toBe(at+1)
    }
  })
  it('frees every mesh, material, renderer and owned listener exactly once',()=>{
    const added=vi.spyOn(window,'addEventListener'),removed=vi.spyOn(window,'removeEventListener'),s=mount()
    const resources=new Set<THREE.BufferGeometry|THREE.Material>(),freed=new Map<unknown,number>()
    s.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)resources.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])resources.add(mat)})
    resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)))
    const renderer=rendered.renderer as THREE.WebGLRenderer, registrations=[...added.mock.calls]
    s.instance.dispose();s.instance.dispose();s.button.click()
    expect(freed.size).toBe(resources.size);expect([...freed.values()].every(n=>n===1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce();expect(renderer.forceContextLoss).toHaveBeenCalledOnce();expect(s.overlay.childElementCount).toBe(0)
    const capture=(o:boolean|EventListenerOptions|undefined)=>typeof o==='boolean'?o:o?.capture??false
    for(const [type,listener,opts] of registrations)expect(removed.mock.calls.some(([t,l,o])=>t===type&&l===listener&&capture(o)===capture(opts)),type).toBe(true)
  })
})
