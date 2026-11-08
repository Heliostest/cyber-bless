// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'


// Keep real Three geometry, intersections and cues; replace only GPU work.
const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, render: vi.fn(), metadata: null as null | {id:string;label:string} }))
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
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera, metadata:{id:string;label:string}) {
    rendered.metadata=metadata
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    const render = vi.fn(() => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }); rendered.render = render
    return { setStyle() {}, resize() {}, render, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 390, completeInspection = true) {
  const height = width === 1280 ? 600 : width === 284 ? 390 : 408, left = 17, top = 91
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  let resizeObserved = () => {}
  vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resizeObserved = callback } observe() {} disconnect() {} })
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
  const run = (seconds = 2.8) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, progress, saveWish, complete, haptic, resize: () => resizeObserved() }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}
const targetName = (at: number) => ['brat-cloth','brat-cloth','brat-cloth'][at]!
const anchor = (at: number): [number, number, number] => [0,.03,0]
function delta(at: number, s: ReturnType<typeof mount>): [number,number] {
  const source=s.point(targetName(at),anchor(at)), object=s.scene.getObjectByName(targetName(at))!, occurrence=[0,1,2].slice(0,at).filter(i=>targetName(i)===targetName(at)).length, cue=(object.userData.interactionCues as InteractionCue[])[occurrence]!, target=cue.destination!
  const goal=(typeof target==='function'?target():target.getWorldPosition(new THREE.Vector3())).project(s.camera),r=s.host.querySelector('canvas')!.getBoundingClientRect()
  return [r.left+(goal.x+1)*r.width/2-source[0],r.top+(1-goal.y)*r.height/2-source[1]]
}
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function step(s: ReturnType<typeof mount>, at: number, run = true) { if(at < 3) drag(s, at, ...placementDelta(s, at), run) }
function placementDelta(s: ReturnType<typeof mount>, at: number): [number,number] {
  let cue = cues(s).find(item => item.cue.destination)?.cue
  if (!cue) s.scene.traverse(object => { cue ??= (object.userData.interactionCues as InteractionCue[] | undefined)?.find(item => item.destination) })
  if (!cue?.destination) return [0, 0]
  const destination = typeof cue.destination === 'function' ? cue.destination() : cue.destination.getWorldPosition(new THREE.Vector3())
  const goal = destination.clone().project(s.camera), rect = s.host.querySelector('canvas')!.getBoundingClientRect(), source = s.point(targetName(at), anchor(at))
  return [rect.left + (goal.x + 1) * rect.width / 2 - source[0], rect.top + (1 - goal.y) * rect.height / 2 - source[1]]
}

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


function sweep(s: ReturnType<typeof mount>, z: number, reverse = false, end = 'pointerup') {
  const a=s.point('brat-cloth',[reverse?.76:-.76,.015,z]),b=s.point('brat-cloth',[reverse?-.76:.76,.015,z])
  event(s.hit,'pointerdown',a)
  for(let i=1;i<=20;i++){event(s.hit,'pointermove',[a[0]+(b[0]-a[0])*i/20,a[1]+(b[1]-a[1])*i/20]);s.instance.update(.016)}
  event(s.hit,end,b)
}
function smooth(s: ReturnType<typeof mount>) { for(const z of[-.24,0,.24])sweep(s,z,z===0);s.run(1) }
function positions(s:ReturnType<typeof mount>) {return Array.from((s.scene.getObjectByName('brat-cloth') as THREE.Mesh).geometry.getAttribute('position').array)}

describe('Outdoor windowsill cloth placement and smoothing',()=>{
  it('starts with direct placement and waits for close-up smoothing before completion',()=>{
    const s=mount(),before=s.camera.position.clone()
    expect(s.button.textContent).not.toContain('看看');expect(s.overlay.getAttribute('data-close-inspection')).toBeNull()
    step(s,0);expect(s.progress).toEqual([]);expect(s.complete).not.toHaveBeenCalled()
    expect(s.button.textContent).toContain('抹平');expect(s.camera.position.distanceTo(before)).toBeGreaterThan(1)
    expect(s.overlay.dataset.clothPhase).toBe('smoothing')
    smooth(s);expect(s.progress).toEqual([3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([false,true])('requires real horizontal cloth coverage before completing, reduced=%s', reduced=>{
    const s=mount(0,{isReducedMotion:()=>reduced});step(s,0)
    const before=positions(s);sweep(s,-.24);expect(positions(s)).not.toEqual(before)
    expect(s.progress).toEqual([]);sweep(s,0,true);sweep(s,.24);s.run(1)
    expect(s.progress).toEqual([3]);expect(s.complete).toHaveBeenCalledOnce();expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click();smooth(s);expect(s.progress).toEqual([3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0,1,2])('restores legacy checkpoint %i and keeps placement and smoothing as separate actions',at=>{
    const s=mount(at,{isReducedMotion:()=>true})
    expect(s.progress).toEqual([]);s.button.click();s.button.click();expect(s.progress).toEqual([])
    s.instance.update(.025);expect(s.overlay.dataset.clothPhase).toBe('smoothing')
    s.button.dispatchEvent(new MouseEvent('click',{detail:2,bubbles:true}));expect(s.progress).toEqual([])
    s.button.click();expect(s.progress).toEqual([3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0,1,2])('supports a coalesced placement release from checkpoint %i',at=>{
    const s=mount(at,{isReducedMotion:()=>true}),p=s.point(targetName(at),anchor(at)),[dx,dy]=placementDelta(s,at)
    event(s.hit,'pointerdown',p);event(s.hit,'pointerup',[p[0]+dx,p[1]+dy]);s.instance.update(.025)
    expect(s.overlay.dataset.clothPhase).toBe('smoothing');expect(s.progress).toEqual([])
    smooth(s);expect(s.progress).toEqual([3])
  })
  it('rejects taps, vertical drags, off-cloth input and repeated rubbing of a small spot',()=>{
    const s=mount(0,{isReducedMotion:()=>true});step(s,0)
    const a=s.point('brat-cloth',[0,.015,-.24]),b=s.point('brat-cloth',[0,.015,.24])
    for(let i=0;i<8;i++){event(s.hit,'pointerdown',a);event(s.hit,'pointerup',a);event(s.hit,'pointerdown',a);event(s.hit,'pointermove',b);event(s.hit,'pointerup',b)}
    for(let i=0;i<10;i++){event(s.hit,'pointerdown',[20,95]);event(s.hit,'pointermove',[150,95]);event(s.hit,'pointerup',[150,95])}
    for(let i=0;i<20;i++){const a=s.point('brat-cloth',[-.04,.015,0]),b=s.point('brat-cloth',[.04,.015,0]);event(s.hit,'pointerdown',a);event(s.hit,'pointermove',b);event(s.hit,'pointerup',b)}
    s.run();expect(s.progress).toEqual([]);smooth(s);expect(s.progress).toEqual([3])
  })
  it.each(['pointercancel','lostpointercapture','blur','pause','resize','Escape','second touch'])('rolls back an unfinished smoothing stroke on %s and can resume',kind=>{
    let active=true;const s=mount(0,{isReducedMotion:()=>true,isActive:()=>active});step(s,0)
    sweep(s,-.24);s.run(.1);const before=positions(s)
    const a=s.point('brat-cloth',[-.76,.015,0]),b=s.point('brat-cloth',[.76,.015,0])
    event(s.hit,'pointerdown',a);event(s.hit,'pointermove',b);s.instance.update(.025)
    expect(positions(s)).not.toEqual(before)
    if(kind==='blur')window.dispatchEvent(new Event('blur'))
    else if(kind==='pause'){active=false;s.instance.update(.025)}
    else if(kind==='resize')s.resize()
    else if(kind==='Escape')document.body.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    else if(kind==='second touch'){event(document.body,'pointerdown',b,2);event(document.body,'pointerup',b,2)}
    else event(s.hit,kind,b)
    expect(positions(s)).toEqual(before);expect(s.progress).toEqual([])
    event(s.hit,'pointerup',b);active=true;window.dispatchEvent(new Event('focus'));s.instance.update(.025)
    smooth(s);expect(s.progress).toEqual([3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each(['blur','pause','resize','pointercancel'])('restores a held or released placement on %s',kind=>{
    let active=true;const s=mount(0,{isActive:()=>active}),cloth=s.scene.getObjectByName('brat-cloth')!,home=cloth.position.clone(),p=s.point('brat-cloth',anchor(0)),[dx,dy]=placementDelta(s,0)
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0]+dx*.2,p[1]+dy*.2]);expect(cloth.position.distanceTo(home)).toBeGreaterThan(.01)
    if(kind==='blur')window.dispatchEvent(new Event('blur'));else if(kind==='pause'){active=false;s.instance.update(.025)}else if(kind==='resize')s.resize();else event(s.hit,kind,p)
    expect(cloth.position.distanceTo(home)).toBeLessThan(1e-7);event(s.hit,'pointerup',p);expect(s.progress).toEqual([])
    active=true;window.dispatchEvent(new Event('focus'));s.instance.update(.025);step(s,0);smooth(s);expect(s.progress).toEqual([3])
  })
  it('freezes accepted placement, camera motion and cloth simulation while paused',()=>{
    let active=true;const s=mount(0,{isActive:()=>active});s.button.click();s.instance.update(.025)
    active=false;s.instance.update(.025);const before=positions(s),camera=s.camera.position.clone(),frames=rendered.render.mock.calls.length
    s.run(3);expect(positions(s)).toEqual(before);expect(s.camera.position.equals(camera)).toBe(true);expect(rendered.render.mock.calls.length).toBe(frames);expect(s.progress).toEqual([])
    active=true;s.run(2);expect(s.overlay.dataset.clothPhase).toBe('smoothing');smooth(s);expect(s.progress).toEqual([3])
  })
  it('restores a completed save with the same flat surface as freshly smoothed cloth',()=>{
    const fresh=mount(0,{isReducedMotion:()=>true});step(fresh,0);smooth(fresh)
    expect(fresh.progress).toEqual([3])
    const restored=mount(3,{isReducedMotion:()=>true})
    expect(positions(restored)).toEqual(positions(fresh));expect(restored.progress).toEqual([])
    expect(restored.button.hidden).toBe(true);expect(restored.complete).not.toHaveBeenCalled()
  })
  it.each([284,350,440,1280])('keeps the full cloth visible and touchable in close-up at width %i',width=>{
    const s=mount(0,{isReducedMotion:()=>true},width);step(s,0)
    const cloth=s.scene.getObjectByName('brat-cloth') as THREE.Mesh,p=cloth.geometry.getAttribute('position'),bounds=new THREE.Box3()
    for(let i=0;i<p.count;i++)bounds.expandByPoint(new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(cloth.matrixWorld).project(s.camera))
    expect(Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.y),Math.abs(bounds.max.y))).toBeLessThan(.9)
    expect(bounds.max.x-bounds.min.x).toBeGreaterThan(width===1280?.3:1)
    smooth(s);expect(s.progress).toEqual([3])
  })
  it.each([0,1,2,3,NaN,Infinity,-1])('silently restores checkpoint %s without entry completion or haptics',at=>{
    const s=mount(at,{isReducedMotion:()=>true});s.run()
    expect(s.progress).toEqual([]);expect(s.complete).not.toHaveBeenCalled();expect(s.haptic).not.toHaveBeenCalled()
    expect(s.button.hidden).toBe(at===3)
    if(at!==3){step(s,Number.isFinite(at)&&at>=0?at:0);smooth(s);expect(s.progress).toEqual([3])}
  })
  it('rejects a foreground blocker and wrong pickups',()=>{
    const s=mount(0,{isReducedMotion:()=>true}),blocker=new THREE.Mesh(new THREE.PlaneGeometry(1,1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide})),cloth=s.scene.getObjectByName('brat-cloth')!
    blocker.position.lerpVectors(cloth.getWorldPosition(new THREE.Vector3()),s.camera.position,.15);blocker.quaternion.copy(s.camera.quaternion);s.scene.add(blocker)
    step(s,0);expect(s.overlay.dataset.clothPhase).toBe('placement');expect(s.progress).toEqual([])
    blocker.removeFromParent();blocker.geometry.dispose();blocker.material.dispose();step(s,0);smooth(s);expect(s.progress).toEqual([3])
  })
  it.each(['prepareFeedback','onProgress','haptic'] as const)('guards synchronous %s reentry and duplicate completion',callback=>{
    let attack=()=>{};const s=mount(0,{isReducedMotion:()=>true,[callback]:()=>attack()})
    attack=()=>{s.button.click();s.instance.update(10);event(s.hit,'pointerdown',[1,1]);event(s.hit,'pointerup',[1,1])}
    s.button.click();s.instance.update(.025);s.button.click()
    expect(s.complete).toHaveBeenCalledOnce();s.button.click();expect(s.complete).toHaveBeenCalledOnce()
    if(callback!=='onProgress')expect(s.progress).toEqual([3])
  })
  it('releases captured input, resources and DOM once after disposal',()=>{
    const s=mount(),resources=new Set<THREE.BufferGeometry|THREE.Material|THREE.Texture>()
    s.scene.traverse(o=>{const m=o as THREE.Mesh;if(m.geometry)resources.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[]){resources.add(mat);const map=(mat as THREE.MeshStandardMaterial).map;if(map)resources.add(map)}})
    const freed=new Map<unknown,number>();resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)))
    const p=s.point('brat-cloth',anchor(0)),release=vi.fn();s.hit.releasePointerCapture=release;event(s.hit,'pointerdown',p)
    s.instance.dispose();s.instance.dispose();s.button.click();s.instance.start();s.instance.update(1)
    expect(release).toHaveBeenCalledExactlyOnceWith(1);expect(s.progress).toEqual([]);expect(freed.size).toBe(resources.size);expect([...freed.values()].every(n=>n===1)).toBe(true);expect(s.overlay.childElementCount).toBe(0)
  })
})
