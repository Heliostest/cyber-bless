// @vitest-environment jsdom
// jsdom has no Canvas 2D; exercise the explicit unavailable-texture fallback quietly.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })

// Isolate spatial gestures, geometry and save callbacks from shared ending scheduling.
// The real automatic timer, animation and lifecycle contract are covered across all
// 20 scenes in ../quiet-ending-workshop-scenes.test.ts without this mock.
vi.mock('../quiet-ending', () => ({
  createQuietEnding: () => ({ sync() {}, update() {}, dispose() {}, completing: true, running: false }),
}))

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// GPU work alone is replaced; meshes, projection, cue DOM and raycasts are real.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
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
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390, height = 560) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  const left = 17, top = 91
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], complete = vi.fn(), saveWish = vi.fn(), haptic = vi.fn(), prepareFeedback = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, shared: Shared, gestures: Gestures, initialProgress, onProgress: n => progress.push(n),
    saveWish, haptic, prepareFeedback, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  expect(scene, 'the scene must render its own original tea objects').toBeInstanceOf(THREE.Scene)
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number,number,number] = [0,0,0]): [number,number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left+(p.x+1)*width/2, top+(1-p.y)*height/2]
  }
  const run = (seconds=1) => { for(let t=0;t<seconds;t+=.025)instance.update(.025) }
  const first = ([x,y]: [number,number]) => {
    const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((x-left)/width*2-1,1-(y-top)/height*2),camera)
    const visible: THREE.Object3D[] = []; scene.traverseVisible(o=>{if((o as THREE.Mesh).isMesh)visible.push(o)})
    return ray.intersectObjects(visible,false)[0]?.object
  }
  return { host, overlay, hit, button, instance, scene, camera, progress, complete, saveWish, haptic, prepareFeedback, point, run, first, width, height, left, top }
}
function pointer(el: HTMLElement,type: string,[clientX,clientY]: [number,number],pointerId=1) {
  const e = new Event(type,{bubbles:true,cancelable:true})
  Object.assign(e,{clientX,clientY,pointerId,pointerType:'touch',button:0,buttons:type==='pointerup'?0:1});el.dispatchEvent(e)
}

function dropPoint(s: ReturnType<typeof mount>, source: string, target: string): [number,number] {
 const pairs=[["tea-scoop-grip","tea-pot-mouth"],["tea-pot-handle-grip","tea-cup-interior"]];if(!pairs.some(pair=>pair[0]===source&&pair[1]===target))return s.point(target)
 const list: {object:THREE.Object3D;cue:InteractionCue}[]=[];s.scene.traverse(object=>{for(const cue of object.userData.interactionCues??[])if(cue.enabled()&&cue.kind==='drag')list.push({object,cue})})
 const c=list[0];if(!c?.cue.destination)return s.point(target)
 const r=s.host.querySelector('canvas')!.getBoundingClientRect(), project=(p:THREE.Vector3):[number,number]=>{const q=p.project(s.camera);return[r.left+(q.x+1)*r.width/2,r.top+(1-q.y)*r.height/2]}
 const d=c.cue.destination,a=project(c.object.localToWorld(new THREE.Vector3(...(c.cue.anchor??[0,0,0])))),b=project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3())),p=s.point(source)
 return[p[0]+b[0]-a[0],p[1]+b[1]-a[1]]
}
function beforeArrival(a: readonly number[], b: readonly number[]): [number,number] {return[a[0]+(b[0]-a[0])*.2,a[1]+(b[1]-a[1])*.2]}

function drag(s: ReturnType<typeof mount>,name: string,target: string) {
  const a=s.point(name),b=dropPoint(s, name, target);pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',b);pointer(s.hit,'pointerup',b);s.run(2)
}
function tap(s: ReturnType<typeof mount>) { const p=s.point('tea-cup-touch');pointer(s.hit,'pointerdown',p);pointer(s.hit,'pointerup',p) }

describe('a contemporary tea break inspired by Blang tea ecology',()=>{
  it('adds leaves, pours from the visible handle, and rests at the cup once',()=>{
    const s=mount(0,{isReducedMotion:()=>true})
    drag(s,'tea-scoop-grip','tea-pot-mouth');expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('tea-leaves-in-pot')!.visible).toBe(true)
    drag(s,'tea-pot-handle-grip','tea-cup-interior');expect(s.progress).toEqual([1,2])
    expect(s.scene.getObjectByName('tea-liquid')!.visible).toBe(true)
    tap(s);tap(s);s.button.click()
    expect(s.progress).toEqual([1,2,3]);expect(s.complete).toHaveBeenCalledOnce();expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([320,390,1280])('hits the first opaque mesh at source and target cue positions at %ipx',width=>{
    const s=mount(0,{isReducedMotion:()=>true},width,width===1280?600:560)
    for(let at=0;at<3;at++){
      const entries: {object:THREE.Object3D;cue:InteractionCue}[]=[]
      s.scene.traverse(object=>{for(const cue of object.userData.interactionCues??[])if(cue.enabled())entries.push({object,cue})})
      expect(entries).toHaveLength(1)
      const {object,cue}=entries[0],source=s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
      const a: [number,number]=[Number(source.dataset.x)+s.left,Number(source.dataset.y)+s.top]
      const projected=s.point(object.name,cue.anchor)
      expect(a[0]).toBeCloseTo(projected[0]);expect(a[1]).toBeCloseTo(projected[1])
      for(const [x,y] of [a]){expect(x).toBeGreaterThan(s.left+12);expect(x).toBeLessThan(s.left+width-12);expect(y).toBeGreaterThan(s.top+12);expect(y).toBeLessThan(s.top+s.height-12)}
      expect(s.first(a)?.name).toBe(object.name)
      const mat=(object as THREE.Mesh).material as THREE.Material;expect(mat.opacity).toBe(1);expect(mat.transparent).toBe(false)
      if(at<2){
        const dest=cue.destination as THREE.Object3D,target=s.host.querySelector<HTMLElement>('[data-cue-role="target"]')!
        const b: [number,number]=[Number(target.dataset.x)+s.left,Number(target.dataset.y)+s.top]
        expect(cue.destination).toBeTruthy()
        pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',b);pointer(s.hit,'pointerup',b)
      }else {pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointerup',a)}
      s.run(2);expect(s.progress.at(-1)).toBe(at+1)
    }
  })
  it('rejects empty starts, missed drops, stationary drags, and wandering taps',()=>{
    const s=mount(0,{isReducedMotion:()=>true})
    pointer(s.hit,'pointerdown',[1,1]);pointer(s.hit,'pointerup',s.point('tea-pot-mouth'))
    drag(s,'tea-pot-handle-grip','tea-pot-mouth')
    const start=s.point('tea-scoop-grip');pointer(s.hit,'pointerdown',start);pointer(s.hit,'pointerup',start)
    pointer(s.hit,'pointerdown',start);pointer(s.hit,'pointermove',[1,1]);pointer(s.hit,'pointerup',[1,1]);s.run()
    expect(s.progress).toEqual([])
    s.button.click();drag(s,'tea-pot-handle-grip','tea-pot-mouth');expect(s.progress).toEqual([1])
    s.button.click();const p=s.point('tea-cup-touch')
    pointer(s.hit,'pointerdown',p);pointer(s.hit,'pointermove',[p[0]+40,p[1]]);pointer(s.hit,'pointermove',p);pointer(s.hit,'pointerup',p)
    expect(s.progress).toEqual([1,2]);tap(s);expect(s.progress).toEqual([1,2,3])
  })
  it.each([0,1,2,3])('restores checkpoint %i silently without audio, progress or wishes',at=>{
    const Audio=vi.fn(()=>{throw new Error('Web Audio unavailable in this test')});vi.stubGlobal('AudioContext',Audio)
    const s=mount(at,{isReducedMotion:()=>true,isSoundEnabled:()=>true,returning:true});s.run()
    expect(s.progress).toEqual([]);expect(s.complete).not.toHaveBeenCalled();expect(s.haptic).not.toHaveBeenCalled();expect(s.prepareFeedback).not.toHaveBeenCalled();expect(Audio).not.toHaveBeenCalled()
    expect(s.scene.getObjectByName('tea-liquid')!.visible).toBe(at>=2);expect(s.scene.getObjectByName('tea-stream')!.visible).toBe(false)
    expect(s.overlay.querySelector('input,textarea,form')).toBeNull();expect(s.button.hidden).toBe(at===3)
    for(let i=at;i<3;i++)s.button.click()
    expect(s.progress).toEqual([1,2,3].filter(n=>n>at));expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each(['pointercancel','lostpointercapture','blur','pause'])('abandons unfinished leaf and handle gestures on %s',event=>{
    for(const at of [0,1]){
      let active=true;const s=mount(at,{isReducedMotion:()=>true,isActive:()=>active})
      const name=at?'tea-pot-handle-grip':'tea-scoop-grip',target=at?'tea-cup-interior':'tea-pot-mouth',a=s.point(name),b=dropPoint(s, name, target)
      pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',beforeArrival(a,b))
      if(event==='blur'){window.dispatchEvent(new Event('blur'));s.run();window.dispatchEvent(new Event('focus'))}
      else if(event==='pause'){active=false;s.run();active=true;s.run()}
      else pointer(s.hit,event,b)
      pointer(s.hit,'pointerup',b);s.run();expect(s.progress).toEqual([])
      drag(s,name,target);expect(s.progress).toEqual([at+1])
    }
  })
  it.each([true,false])('rejects mixed fingers with outside-first=%s and blocks the native action while held',outsideFirst=>{
    const s=mount(0,{isReducedMotion:()=>true}),a=s.point('tea-scoop-grip'),b=s.point('tea-pot-mouth')
    if(outsideFirst)pointer(document.body,'pointerdown',[1,1],2)
    pointer(s.hit,'pointerdown',a);s.button.click()
    if(!outsideFirst)pointer(document.body,'pointerdown',[1,1],2)
    pointer(s.hit,'pointerup',b);pointer(document.body,'pointerup',[1,1],2)
    expect(s.progress).toEqual([]);drag(s,'tea-scoop-grip','tea-pot-mouth');expect(s.progress).toEqual([1])
  })
  it.each(['pause','blur'])('freezes an accepted pour including liquid and stream during %s',event=>{
    let active=true;const s=mount(1,{isActive:()=>active})
    s.button.click();s.run(.3)
    const pot=s.scene.getObjectByName('tea-pot-pivot')!,stream=s.scene.getObjectByName('tea-stream')!,liquid=s.scene.getObjectByName('tea-liquid')!
    expect(Math.abs(pot.rotation.z)).toBeGreaterThan(.1);expect(stream.visible).toBe(true)
    const angle=pot.rotation.z,pos=pot.position.clone(),scale=liquid.scale.clone()
    if(event==='pause')active=false;else window.dispatchEvent(new Event('blur'))
    s.run(3);expect(pot.rotation.z).toBe(angle);expect(pot.position.equals(pos)).toBe(true);expect(liquid.scale.equals(scale)).toBe(true);expect(s.progress).toEqual([])
    expect(s.button.disabled).toBe(true);expect(s.host.querySelector('[data-cue-role="source"]')).toBeNull()
    if(event==='pause')active=true;else window.dispatchEvent(new Event('focus'))
    s.run(3);expect(s.progress).toEqual([2]);expect(stream.visible).toBe(false);expect(pot.rotation.z).toBe(0)
  })
  it('native keyboard action shares the same animated settlement and completes once',()=>{
    const s=mount();s.button.click();expect(s.progress).toEqual([]);s.run(2);expect(s.progress).toEqual([1])
    s.button.click();expect(s.progress).toEqual([1]);s.run(2);expect(s.progress).toEqual([1,2])
    s.button.click();s.button.click();expect(s.progress).toEqual([1,2,3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  it('pours downward from the moving spout into the cup and rests the scoop on its support',()=>{
    const s=mount(1);s.button.click();s.run(.45);s.scene.updateMatrixWorld(true)
    const stream=s.scene.getObjectByName('tea-stream')!,pot=s.scene.getObjectByName('tea-pot-pivot')!
    const start=stream.localToWorld(new THREE.Vector3(0,.5,0)),end=stream.localToWorld(new THREE.Vector3(0,-.5,0))
    expect(start.y).toBeGreaterThan(end.y+.08)
    expect(start.distanceTo(pot.localToWorld(new THREE.Vector3(1.24,.37,0)))).toBeLessThan(.002)
    expect(Math.abs(start.x-end.x)).toBeLessThan(.1);expect(Math.abs(start.z-end.z)).toBeLessThan(.1)
    expect(end.distanceTo(new THREE.Vector3(.99,1.081,.20))).toBeLessThan(.002)
    s.run(2)
    const gripBox=new THREE.Box3().setFromObject(s.scene.getObjectByName('tea-scoop-grip')!),restBox=new THREE.Box3().setFromObject(s.scene.getObjectByName('tea-scoop-rest')!)
    expect(Math.abs(gripBox.min.y-restBox.max.y)).toBeLessThan(.015)
  })
  it('releases all geometry, materials, owned DOM, resize and event listeners exactly once',()=>{
    const added=vi.spyOn(window,'addEventListener'),removed=vi.spyOn(window,'removeEventListener')
    const disconnect=vi.fn();vi.stubGlobal('ResizeObserver',class {observe(){} disconnect=disconnect})
    const s=mount(),resources=new Set<THREE.BufferGeometry|THREE.Material>(),freed=new Map<unknown,number>()
    s.scene.traverse(o=>{const m=o as THREE.Mesh;if (m.geometry) resources.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])resources.add(mat)})
    resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)))
    const registrations=[...added.mock.calls],renderer=rendered.renderer as THREE.WebGLRenderer
    s.instance.dispose();s.instance.dispose();s.button.click();pointer(s.hit,'pointerdown',[100,100])
    expect(freed.size).toBe(resources.size);expect([...freed.values()].every(n=>n===1)).toBe(true);expect(disconnect).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0);expect(s.host.querySelector('.scene-object-cues')).toBeNull();expect(s.progress).toEqual([])
    expect(renderer.dispose).toHaveBeenCalledOnce();expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    const capture=(o:boolean|EventListenerOptions|undefined)=>typeof o==='boolean'?o:o?.capture??false
    for(const [type,listener,opts] of registrations)expect(removed.mock.calls.some(([t,l,o])=>t===type&&l===listener&&capture(o)===capture(opts)),type).toBe(true)
  })
  it('closes gesture-created audio and removes listeners from the owned DOM surfaces',()=>{
    const close=vi.fn(async()=>{}),gain={setValueAtTime(){},exponentialRampToValueAtTime(){},value:0}
    vi.stubGlobal('AudioContext',class {
      state='running';currentTime=0;destination={};close=close
      createGain(){return {gain,connect(){return this}}}
      createOscillator(){return {type:'sine',frequency:{setValueAtTime(){}},connect(){return this},start(){},stop(){}}}
    })
    const added=vi.spyOn(EventTarget.prototype,'addEventListener'),removed=vi.spyOn(EventTarget.prototype,'removeEventListener')
    const s=mount(0,{isReducedMotion:()=>true,isSoundEnabled:()=>true});s.button.click()
    expect(close).not.toHaveBeenCalled()
    const registrations=added.mock.calls.map((args,i)=>({target:added.mock.contexts[i],args})).filter(({target})=>[s.host,s.hit,s.button].includes(target as HTMLElement))
    s.instance.dispose();s.instance.dispose()
    expect(close).toHaveBeenCalledOnce()
    const capture=(o:boolean|EventListenerOptions|undefined)=>typeof o==='boolean'?o:o?.capture??false
    for(const {target,args:[type,listener,opts]} of registrations){
      expect(removed.mock.calls.some(([t,l,o],i)=>removed.mock.contexts[i]===target&&t===type&&l===listener&&capture(o)===capture(opts)),type).toBe(true)
    }
  })
})
