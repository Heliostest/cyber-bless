// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'


// Keep real Three geometry, intersections and cues; replace only GPU work.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, render: vi.fn() }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this }
    setSize() {} setPixelRatio() {} setClearColor() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    const render = vi.fn(() => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }); rendered.render = render
    return { setStyle() {}, resize() {}, render, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390) {
  const height = width === 1280 ? 600 : width === 284 ? 390 : 408, left = 17, top = 91
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('button')!
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1.2) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}
const targetName = (at: number) => 'sansi-tine-'+at
const anchor = (at: number): [number, number, number] => [[0,.02,-.035],[0,.02,-.035],[0,.02,-.035]][at] as [number,number,number]
const delta = (at: number): [number, number] => [0,60]
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function step(s: ReturnType<typeof mount>, at: number, run = true) { if(at < 3) drag(s, at, ...delta(at), run) }
function cues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}
function first(s: ReturnType<typeof mount>, p: THREE.Vector3) {
  const q = p.clone().project(s.camera), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
  const meshes: THREE.Object3D[] = []
  s.scene.traverseVisible(o => {
    const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
    if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(o)
  })
  return { q, object: ray.intersectObjects(meshes, false)[0]?.object }
}


describe('Sansi free performance', () => {
  const keys = (s: ReturnType<typeof mount>) => Array.from(s.overlay.querySelectorAll<HTMLButtonElement>('.scene-sansi-key'))
  const tap = (s: ReturnType<typeof mount>, key: number) => { const p=s.point(targetName(key),anchor(0));event(s.hit,'pointerdown',p);event(s.hit,'pointerup',p) }
  it('projects a separate playable marker for every tine',()=>{
    const s=mount();expect(s.host.querySelectorAll('[data-cue-role="source"]')).toHaveLength(9)
    tap(s,0);s.instance.update(.025);expect(s.host.querySelectorAll('[data-cue-role="source"]')).toHaveLength(9)
  })
  it.each([false,true])('plays every tine repeatedly in any order and completes only on manual finish, reduced=%s',reduced=>{
    const s=mount(0,{isReducedMotion:()=>reduced}),order=[8,0,4,2,7,1,6,5,3,4,4]
    for(const key of order)tap(s,key)
    s.run(2);expect(s.progress).toEqual([2]);expect(s.haptic).toHaveBeenCalledTimes(order.length);expect(s.complete).not.toHaveBeenCalled()
    expect(keys(s)).toHaveLength(9);expect(s.button.textContent).toBe('结束仪式');expect(s.button.disabled).toBe(false)
    s.button.click();s.run();s.button.click();tap(s,4)
    expect(s.progress).toEqual([2,3]);expect(s.complete).toHaveBeenCalledOnce();expect(s.saveWish).not.toHaveBeenCalled();expect(cues(s)).toEqual([])
  })
  it('lets nine native note buttons and number keys play without a settling lock',()=>{
    const s=mount();expect(s.button.disabled).toBe(true)
    keys(s).forEach(button=>button.click());expect(s.haptic).toHaveBeenCalledTimes(9);expect(s.complete).not.toHaveBeenCalled()
    for(const key of ['1','5','9'])keys(s)[0]!.dispatchEvent(new KeyboardEvent('keydown',{key,bubbles:true}))
    expect(s.haptic).toHaveBeenCalledTimes(12);expect(s.progress).toEqual([2])
  })
  it('accepts number shortcuts from the page and keeps a played button usable during feedback',()=>{
    let duringFeedback=()=>{};const s=mount(0,{haptic:()=>duringFeedback()}),button=keys(s)[0]!,heard=vi.fn(),enabledAndFocused:boolean[]=[]
    duringFeedback=()=>{heard();enabledAndFocused.push(!button.disabled&&document.activeElement===button)}
    button.focus();button.click();expect(heard).toHaveBeenCalledOnce();expect(enabledAndFocused).toEqual([true])
    duringFeedback=heard;document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'9',bubbles:true}));expect(heard).toHaveBeenCalledTimes(2)
    const input=document.createElement('input');document.body.append(input);input.focus();input.dispatchEvent(new KeyboardEvent('keydown',{key:'1',bubbles:true}));expect(heard).toHaveBeenCalledTimes(2)
  })
  it('keeps independent tines ringing when the next note is plucked',()=>{
    const s=mount(),a=s.scene.getObjectByName('sansi-tine-4')!,b=s.scene.getObjectByName('sansi-tine-0')!
    tap(s,4);s.instance.update(.05);const ringing=a.position.y;expect(ringing).not.toBe(.49)
    tap(s,0);expect(a.position.y).toBe(ringing);expect(b.position.y).not.toBe(.49);expect(s.haptic).toHaveBeenCalledTimes(2)
  })
  it('bends any free end while keeping its root fixed and cancels silently',()=>{
    const s=mount()
    for(let key=0;key<9;key++){
      const tine=s.scene.getObjectByName(targetName(key)) as THREE.Mesh,p=s.point(targetName(key),anchor(0)),home=tine.position.clone(),v=tine.geometry.getAttribute('position'),rest=Array.from(v.array)
      event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0],p[1]+30]);expect(home.y-tine.position.y).toBeGreaterThan(.04)
      let fixed=0,bent=0;for(let j=0;j<v.count;j++){if(Math.abs(v.getY(j)+tine.position.y-rest[j*3+1]!-home.y)<1e-6)fixed++;else bent++}
      expect(fixed).toBeGreaterThan(0);expect(bent).toBeGreaterThan(0)
      event(s.hit,'pointercancel',p);expect(tine.position.distanceTo(home)).toBeLessThan(1e-7);expect(Array.from(v.array)).toEqual(rest)
    }
    expect(s.haptic).not.toHaveBeenCalled();expect(s.progress).toEqual([])
  })
  it.each([0,1,2,3])('restores progress %i silently and retains manual completion',at=>{
    const s=mount(at);s.run();expect(s.progress).toEqual([]);expect(s.haptic).not.toHaveBeenCalled();expect(s.complete).not.toHaveBeenCalled()
    expect(cues(s)).toHaveLength(at===3?0:9)
    if(at===3){expect(s.button.hidden).toBe(true);keys(s).forEach(b=>b.click());expect(s.haptic).not.toHaveBeenCalled()}
    else {expect(s.button.disabled).toBe(at===0);tap(s,8);s.button.click();expect(s.complete).toHaveBeenCalledOnce()}
  })
  it('plays a different metal tone for every key, with live sound and haptic settings',()=>{
    const frequencies:number[]=[],peaks:number[]=[];let enabled=false,closed=0
    class AudioBoundary {
      state='running';currentTime=0;destination={}
      close(){closed++;return Promise.resolve()}
      createGain(){return {gain:{value:0,setValueAtTime(){},exponentialRampToValueAtTime(n:number){if(n>.0001)peaks.push(n)}},connect(next:unknown){return next}}}
      createOscillator(){return {type:'sine',frequency:{setValueAtTime(n:number){frequencies.push(n)}},connect(g:{connect(next:unknown):unknown}){return g},start(){},stop(){}}}
    }
    vi.stubGlobal('AudioContext',AudioBoundary)
    const s=mount(0,{isSoundEnabled:()=>enabled});tap(s,4);expect(frequencies).toEqual([]);enabled=true
    keys(s).forEach(b=>b.click());expect(frequencies).toHaveLength(27);expect(new Set(frequencies.filter((_,i)=>i%3===0)).size).toBe(9)
    expect(s.haptic).toHaveBeenCalledTimes(10);expect(new Set(s.haptic.mock.calls.map(c=>c[0])).size).toBeGreaterThan(1)
    enabled=false;tap(s,2);expect(frequencies).toHaveLength(27);s.instance.dispose();s.instance.dispose();expect(closed).toBe(1)
  })
  it.each(['pointercancel','lostpointercapture','blur','pause'])('cancels a held note without sound or progress on %s',kind=>{
    let active=true;const s=mount(0,{isActive:()=>active}),p=s.point(targetName(4),anchor(0)),tine=s.scene.getObjectByName(targetName(4))!,home=tine.position.clone()
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0],p[1]+30]);expect(s.button.disabled).toBe(true)
    if(kind==='pause'){active=false;s.instance.update(.05)}else if(kind==='blur')window.dispatchEvent(new Event('blur'));else event(s.hit,kind,p)
    event(s.hit,'pointerup',[p[0],p[1]+60]);expect(s.progress).toEqual([]);expect(s.haptic).not.toHaveBeenCalled();expect(tine.position.distanceTo(home)).toBeLessThan(1e-7)
    if(kind==='blur')window.dispatchEvent(new Event('focus'));active=true;s.instance.update(.025);tap(s,4);expect(s.progress).toEqual([2])
  })
  it.each(['pointercancel','lostpointercapture','multitouch'])('restores all controls after %s without another canvas action',kind=>{
    const s=mount(2),p=s.point(targetName(4),anchor(0))
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0],p[1]+30]);expect(keys(s).every(b=>b.disabled)).toBe(true)
    if(kind==='multitouch'){event(s.hit,'pointerdown',[1,1],2);event(s.hit,'pointerup',p);event(s.hit,'pointerup',[1,1],2)}else event(s.hit,kind,p)
    s.instance.update(.025);expect(keys(s).every(b=>!b.disabled)).toBe(true);expect(s.button.disabled).toBe(false)
    keys(s)[0]!.click();expect(s.haptic).toHaveBeenCalledOnce();s.button.click();expect(s.complete).toHaveBeenCalledOnce()
  })
  it('rejects wrong surfaces, invalid drags and multiple pointers, then remains playable',()=>{
    const s=mount(),p=s.point(targetName(4),anchor(0))
    event(s.hit,'pointerdown',[1,1]);event(s.hit,'pointerup',p)
    for(const bad of [[NaN,0],[50,0],[0,-60]]){event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0]+bad[0]!,p[1]+bad[1]!]);event(s.hit,'pointerup',[p[0]+bad[0]!,p[1]+bad[1]!])}
    event(s.hit,'pointerdown',p);event(s.hit,'pointerdown',[1,1],2);event(s.hit,'pointerup',p);event(s.hit,'pointerup',[1,1],2)
    expect(s.progress).toEqual([]);expect(s.haptic).not.toHaveBeenCalled();tap(s,4);expect(s.progress).toEqual([2])
  })
  it.each([284,350,1280])('keeps all nine real tines reachable and in frame at width %i',width=>{
    const s=mount(0,{},width);expect(cues(s)).toHaveLength(9)
    for(let key=0;key<9;key++){
      const tine=s.scene.getObjectByName(targetName(key))!,p=tine.localToWorld(new THREE.Vector3(...anchor(0))),hit=first(s,p)
      expect(hit.object?.name).toBe(tine.name);tap(s,key)
    }
    for(let frame=0;frame<20;frame++){
      s.instance.update(.05);s.scene.updateMatrixWorld(true);let extent=0
      s.scene.getObjectByName('sansi-subject')!.traverse(o=>{const m=o as THREE.Mesh;if(!m.geometry)return;const p=m.geometry.getAttribute('position'),v=new THREE.Vector3();for(let i=0;i<p.count;i++){v.fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).project(s.camera);extent=Math.max(extent,Math.abs(v.x),Math.abs(v.y))}})
      expect(extent).toBeLessThan(.97)
    }
    expect(s.complete).not.toHaveBeenCalled()
  })
  it('freezes ringing while paused and skips visual motion with reduced motion',()=>{
    let active=true;const s=mount(0,{isActive:()=>active}),tine=s.scene.getObjectByName(targetName(4)) as THREE.Mesh
    tap(s,4);s.instance.update(.05);active=false;const before=Array.from(tine.geometry.getAttribute('position').array);s.run();expect(Array.from(tine.geometry.getAttribute('position').array)).toEqual(before)
    const reduced=mount(0,{isReducedMotion:()=>true}),other=reduced.scene.getObjectByName(targetName(4)) as THREE.Mesh;tap(reduced,4);expect(other.position.y).toBe(.49);expect(reduced.haptic).toHaveBeenCalledOnce()
  })
  it.each(['prepareFeedback','haptic','onProgress'] as const)('blocks reentrant note and finish requests from %s',callback=>{
    let attack=()=>{};const s=mount(0,{[callback]:()=>attack()})
    attack=()=>{keys(s)[0]!.click();s.button.click();s.instance.update(100)};tap(s,4)
    expect(s.complete).not.toHaveBeenCalled();expect(s.progress.length).toBeLessThanOrEqual(1)
    attack=()=>{};s.button.click();expect(s.complete).toHaveBeenCalledOnce()
  })
  it('releases all geometry, materials, cues and retained controls once',()=>{
    const s=mount(),resources=new Set<THREE.BufferGeometry|THREE.Material>(),freed=new Map<unknown,number>()
    s.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)resources.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])resources.add(mat)})
    resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)))
    const buttons=keys(s),renderer=rendered.renderer as THREE.WebGLRenderer;s.instance.dispose();s.instance.dispose();buttons.forEach(b=>b.click());s.button.click();s.instance.update(.05)
    expect(freed.size).toBe(resources.size);expect([...freed.values()].every(n=>n===1)).toBe(true);expect(renderer.dispose).toHaveBeenCalledOnce();expect(s.overlay.childElementCount).toBe(0);expect(s.haptic).not.toHaveBeenCalled()
  })
})
