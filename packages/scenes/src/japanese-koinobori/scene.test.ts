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
const targetName = (at: number) => ['koinobori-tail','koinobori-toggle','koinobori-toggle'][at]!
const anchor = (at: number): [number, number, number] => [[.26,.18,.02],[0,0,.065],[0,0,.065]][at] as [number,number,number]
const delta = (at: number): [number, number] => at === 1 ? [0,60] : [60,0]
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


describe('Japanese koinobori unfurling and halyard', () => {
  it.each([false,true])('unfurls the cloth, hoists it and secures the toggle once, reduced=%s', reduced => {
    const s=mount(0,{isReducedMotion:()=>reduced})
    for(let i=0;i<3;i++){step(s,i,false); if(!reduced)expect(s.progress).toHaveLength(i); s.run(); expect(s.progress).toEqual([1,2,3].slice(0,i+1))}
    s.button.click(); s.run(); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('unfurls the actual cloth tail and cancels back to its original length',()=>{
    const s=mount(),tail=s.scene.getObjectByName('koinobori-tail')!,start=tail.position.x,p=s.point(targetName(0),anchor(0))
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0]+30,p[1]])
    expect(tail.position.x).toBeGreaterThan(start+.2);expect(s.progress).toEqual([])
    event(s.hit,'pointercancel',p);expect(tail.position.x).toBeCloseTo(start,8)
    step(s,0);expect(tail.position.x).toBeGreaterThan(start+.5)
  })
  it('raises the fish by the same distance as the free halyard end descends',()=>{
    const s=mount(1),fish=s.scene.getObjectByName('koinobori-fish')!,toggle=s.scene.getObjectByName('koinobori-toggle')!,fishY=fish.position.y,toggleY=toggle.position.y,p=s.point(targetName(1),anchor(1))
    event(s.hit,'pointerdown',p)
    for(let i=0;i<=20;i++){
      event(s.hit,'pointermove',[p[0],p[1]+60*i/20]);expect(fish.position.y-fishY).toBeCloseTo(toggleY-toggle.position.y,6)
    }
    event(s.hit,'pointerup',[p[0],p[1]+60]);s.run();expect(fish.position.y-fishY).toBeCloseTo(1.15)
    expect(s.progress).toEqual([2])
  })
  it('keeps the halyard and mouth bridles attached without new GPU buffers during every step',()=>{
    for(const at of [0,1,2]){
      const s=mount(at),rope=s.scene.getObjectByName('koinobori-halyard') as THREE.Mesh,geometry=rope.geometry,position=geometry.getAttribute('position'),normal=geometry.getAttribute('normal'),p=s.point(targetName(at),anchor(at)),[dx,dy]=delta(at)
      event(s.hit,'pointerdown',p)
      for(let i=0;i<=20;i++){
        event(s.hit,'pointermove',[p[0]+dx*i/20,p[1]+dy*i/20]);s.scene.updateMatrixWorld(true)
        const ring=(i:number)=>{const q=new THREE.Vector3();for(let k=0;k<6;k++)q.add(new THREE.Vector3().fromBufferAttribute(position,i*7+k));return q.divideScalar(6)}
        const fish=s.scene.getObjectByName('koinobori-fish')!,toggle=s.scene.getObjectByName('koinobori-toggle')!
        expect(ring(0).distanceTo(new THREE.Vector3(-.88,fish.position.y,0))).toBeLessThan(1e-5)
        expect(ring(96).distanceTo(toggle.position.clone().add(new THREE.Vector3(0,.10,0)))).toBeLessThan(1e-5)
        expect(rope.geometry).toBe(geometry);expect(geometry.getAttribute('position')).toBe(position);expect(geometry.getAttribute('normal')).toBe(normal)
        expect(Array.from(position.array).every(Number.isFinite)).toBe(true)
        for(let j=0;j<3;j++){
          const bridle=s.scene.getObjectByName('koinobori-bridle-'+j) as THREE.Mesh
          expect(bridle.parent).toBe(fish)
        }
      }
      event(s.hit,'pointercancel',p);s.instance.dispose()
    }
  })
  it('keeps genuine open cloth ends and a grounded pole, then seats the toggle in its cleat',()=>{
    const s=mount(3),body=s.scene.getObjectByName('koinobori-body') as THREE.Mesh,mouth=s.scene.getObjectByName('koinobori-mouth')!,fish=s.scene.getObjectByName('koinobori-fish')!,toggle=s.scene.getObjectByName('koinobori-toggle')!,slot=s.scene.getObjectByName('koinobori-cleat')!
    const mesh=body.geometry,indices=mesh.getIndex()!,counts=new Map<string,number>()
    for(let i=0;i<indices.count;i+=3)for(let e=0;e<3;e++){const a=indices.getX(i+e),b=indices.getX(i+(e+1)%3),k=[Math.min(a,b),Math.max(a,b)].join(':');counts.set(k,(counts.get(k)??0)+1)}
    expect([...counts.values()].filter(n=>n===1).length).toBeGreaterThan(48)
    const ray=new THREE.Raycaster(fish.localToWorld(new THREE.Vector3(-.2,0,0)),new THREE.Vector3(1,0,0),0,.32)
    expect(ray.intersectObject(body)).toHaveLength(0);expect(ray.intersectObject(mouth)).toHaveLength(0)
    expect(new THREE.Box3().setFromObject(s.scene.getObjectByName('koinobori-foot')!,true).min.y).toBeCloseTo(-.04)
    expect(toggle.position.distanceTo(slot.position.clone().add(new THREE.Vector3(0,.14,.12)))).toBeLessThan(1e-6)
  })
  it('joins both tail root half-rings and their printed pattern to the open cloth rim in every pose',()=>{
    for(const at of [0,1,2,3]){
      const s=mount(at),body=s.scene.getObjectByName('koinobori-body') as THREE.Mesh,positions=body.geometry.getAttribute('position')
      for(const name of ['koinobori-tail','koinobori-tail-back']){
        const tail=s.scene.getObjectByName(name) as THREE.Mesh,v=tail.geometry.getAttribute('position')
        for(let i=0;i<v.count;i++)if(Math.abs(v.getX(i))<1e-7){
          const q=tail.localToWorld(new THREE.Vector3().fromBufferAttribute(v,i));let distance=Infinity,nearest=0
          for(let j=48*49;j<positions.count;j++){
            const d=q.distanceTo(body.localToWorld(new THREE.Vector3().fromBufferAttribute(positions,j)))
            if(d<distance){distance=d;nearest=j}
          }
          expect(distance,`checkpoint${at}, ${name}, root${i}`).toBeLessThan(1e-5)
          const a=body.geometry.getAttribute('uv'),b=tail.geometry.getAttribute('uv')
          expect(b.getX(i)).toBeCloseTo(a.getX(nearest),6)
          const wrap=Math.abs(b.getY(i)-a.getY(nearest))
          expect(Math.min(wrap,Math.abs(1-wrap))).toBeLessThan(1e-6)
        }
      }
      s.instance.dispose()
    }
  })
  it('keeps an actual air passage through the paired tail flaps after joining their roots',()=>{
    for(const at of [0,1,2,3]){
      const s=mount(at),front=s.scene.getObjectByName('koinobori-tail') as THREE.Mesh,back=s.scene.getObjectByName('koinobori-tail-back') as THREE.Mesh
      const center=front.localToWorld(new THREE.Vector3().fromBufferAttribute(front.geometry.getAttribute('position'),12)).add(back.localToWorld(new THREE.Vector3().fromBufferAttribute(back.geometry.getAttribute('position'),12))).multiplyScalar(.5)
      for(const y of [-.006,.006])for(const z of [-.006,.006]){
        const ray=new THREE.Raycaster(center.clone().add(new THREE.Vector3(.01,y,z)),new THREE.Vector3(1,0,0),0,.5)
        expect(ray.intersectObjects([front,back]),`checkpoint${at}, y=${y}, z=${z}`).toHaveLength(0)
      }
      s.instance.dispose()
    }
  })
  it('lifts the wooden toggle clear of both cleat posts before dropping into the seat',()=>{
    const s=mount(2),toggle=s.scene.getObjectByName('koinobori-toggle')!,p=s.point(targetName(2),anchor(2))
    event(s.hit,'pointerdown',p)
    for(let n=0;n<=100;n++){
      event(s.hit,'pointermove',[p[0]+60*n/100,p[1]]);s.scene.updateMatrixWorld(true)
      for(const x of [-.10,.10]){
        const post=s.scene.getObjectByName('koinobori-cleat-prong-'+x)!
        for(let i=0;i<=10;i++){
          const y=.46+.14*i/10,localY=y-toggle.position.y
          if(Math.abs(localY)<.10){
            const toggleR=.075-.01*(localY+.10)/.20,postR=.025-.003*i/10
            expect(Math.hypot(toggle.position.x-post.position.x,toggle.position.z-post.position.z)-toggleR-postR,`n=${n/100}, post=${x}, y=${y}`).toBeGreaterThanOrEqual(-1e-6)
          }
        }
      }
    }
  })
  it('paints eyes and pupils against the curved cloth instead of floating above it',()=>{
    for(const at of [0,3]){
      const s=mount(at),body=s.scene.getObjectByName('koinobori-body')!
      for(const side of [-1,1])for(const kind of ['eye','eye-rim','iris','pupil','eye-light']){
        const paint=s.scene.getObjectByName('koinobori-'+kind+'-'+side) as THREE.Mesh,v=paint.geometry.getAttribute('position')
        for(let i=0;i<v.count;i++){
          const point=paint.localToWorld(new THREE.Vector3().fromBufferAttribute(v,i)),ray=new THREE.Raycaster(point.clone().add(new THREE.Vector3(0,0,side*.001)),new THREE.Vector3(0,0,-side))
          const hit=ray.intersectObject(body)[0]
          expect(hit,`checkpoint${at}, ${kind}, side${side}, vertex${i}`).toBeDefined()
          expect(hit!.distance).toBeLessThan(.008)
        }
      }
      s.instance.dispose()
    }
  })
  it('keeps painted triangle interiors outside the curved fabric',()=>{
    for(const at of [0,3]){
      const s=mount(at),body=s.scene.getObjectByName('koinobori-body')!
      for(const side of [-1,1])for(const kind of ['eye','eye-rim','iris','pupil','eye-light']){
        const paint=s.scene.getObjectByName('koinobori-'+kind+'-'+side) as THREE.Mesh,v=paint.geometry.getAttribute('position'),idx=paint.geometry.getIndex()!
        for(let i=0;i<idx.count;i+=3){
          const q=new THREE.Vector3();for(let j=0;j<3;j++)q.add(new THREE.Vector3().fromBufferAttribute(v,idx.getX(i+j)));q.divideScalar(3);paint.localToWorld(q)
          const hit=new THREE.Raycaster(q.clone().add(new THREE.Vector3(0,0,side*.02)),new THREE.Vector3(0,0,-side)).intersectObject(body)[0]!
          expect(hit.distance,`checkpoint${at}, ${kind}, side${side}, triangle${i/3}`).toBeGreaterThan(.02)
        }
      }
      s.instance.dispose()
    }
  })
  it('gives the outer fabric and both tail flaps outward normals',()=>{
    const s=mount(3),body=s.scene.getObjectByName('koinobori-body') as THREE.Mesh,front=s.scene.getObjectByName('koinobori-tail') as THREE.Mesh,back=s.scene.getObjectByName('koinobori-tail-back') as THREE.Mesh
    expect(body.geometry.getAttribute('normal').getZ(24*49+12)).toBeGreaterThan(.5)
    expect(front.geometry.getAttribute('normal').getZ(4*25+12)).toBeGreaterThan(.5)
    expect(back.geometry.getAttribute('normal').getZ(4*25+12)).toBeLessThan(-.5)
  })
  it('connects the pulley groove to its wheel and rope contact radius',()=>{
    const s=mount(),wheel=s.scene.getObjectByName('koinobori-pulley')!
    const ray=new THREE.Raycaster(new THREE.Vector3(-1.05+.159,3,.10),new THREE.Vector3(0,0,-1))
    expect(ray.intersectObject(wheel).length).toBeGreaterThan(0)
  })
  it.each([0,1,2,3])('animates only free cloth with stable buffers and respects reduced motion and pause at %i',at=>{
    let active=true;const s=mount(at,{isActive:()=>active}),body=s.scene.getObjectByName('koinobori-body') as THREE.Mesh,positions=body.geometry.getAttribute('position'),home=Array.from(positions.array),pole=s.scene.getObjectByName('koinobori-pole')!.matrixWorld.clone()
    s.run(.4);expect(Array.from(positions.array)).not.toEqual(home);expect(body.geometry.getAttribute('position')).toBe(positions);expect(s.scene.getObjectByName('koinobori-pole')!.matrixWorld.equals(pole)).toBe(true)
    active=false;const paused=Array.from(positions.array);s.run();expect(Array.from(positions.array)).toEqual(paused)
    const reduced=mount(at,{isReducedMotion:()=>true}),cloth=reduced.scene.getObjectByName('koinobori-body') as THREE.Mesh,rest=Array.from(cloth.geometry.getAttribute('position').array);reduced.run();expect(Array.from(cloth.geometry.getAttribute('position').array)).toEqual(rest)
  })
  it('keeps wind running during a held hoist and before the rope is secured',()=>{
    const s=mount(1),body=s.scene.getObjectByName('koinobori-body') as THREE.Mesh,p=s.point(targetName(1),anchor(1))
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0],p[1]+30])
    const before=Array.from(body.geometry.getAttribute('position').array)
    s.run(.4);expect(Array.from(body.geometry.getAttribute('position').array)).not.toEqual(before);expect(s.progress).toEqual([])
    const current=Array.from(body.geometry.getAttribute('position').array)
    event(s.hit,'pointermove',[p[0],p[1]+30]);expect(Array.from(body.geometry.getAttribute('position').array)).toEqual(current)
    event(s.hit,'pointerup',[p[0],p[1]+60]);s.run();expect(s.progress).toEqual([2])
    const raised=Array.from(body.geometry.getAttribute('position').array)
    s.run(.4);expect(Array.from(body.geometry.getAttribute('position').array)).not.toEqual(raised);expect(s.complete).not.toHaveBeenCalled()
  })
  it.each([284,1280])('keeps the stronger raised breeze in frame throughout several cycles at width %i',width=>{
    const s=mount(2,{},width),vertex=new THREE.Vector3()
    for(let i=0;i<40;i++){
      s.run(.2);s.scene.updateMatrixWorld(true);let extent=0
      s.scene.getObjectByName('koinobori-fish')!.traverse(o=>{
        const mesh=o as THREE.Mesh;if(!mesh.geometry)return
        const positions=mesh.geometry.getAttribute('position')
        for(let j=0;j<positions.count;j++){vertex.fromBufferAttribute(positions,j).applyMatrix4(mesh.matrixWorld).project(s.camera);extent=Math.max(extent,Math.abs(vertex.x),Math.abs(vertex.y))}
      })
      expect(extent).toBeLessThan(.97)
    }
  })
  it('uses identical final subject transforms for ordinary, reduced motion and silently restored checkpoints', () => {
    for (const checkpoint of [1, 2, 3]) {
      const normal = mount(), reduced = mount(0, { isReducedMotion: () => true }), restored = mount(checkpoint)
      for (let at = 0; at < checkpoint; at++) { step(normal, at); step(reduced, at) }
      normal.scene.updateMatrixWorld(true); reduced.scene.updateMatrixWorld(true); restored.scene.updateMatrixWorld(true)
      normal.scene.getObjectByName('koinobori-subject')!.traverse(o => {
        for (const other of [reduced, restored]) { const m = other.scene.getObjectByName(o.name)!.matrixWorld; o.matrixWorld.elements.forEach((v, i) => expect(v, o.name).toBeCloseTo(m.elements[i], 9)) }
      })
      normal.instance.dispose(); reduced.instance.dispose(); restored.instance.dispose()
    }
  })
  it('offers 44px native keyboard actions, physical input and no wish form or entry feedback', () => {
    const s = mount(); expect(s.hit).not.toBeNull(); expect(s.button.type).toBe('button')
    expect(s.button.style.minWidth).toBe('44px'); expect(s.button.style.minHeight).toBe('44px'); expect(s.overlay.querySelector('input,form')).toBeNull()
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); expect(s.progress).toEqual([]); s.run(); expect(s.progress).toEqual([1])
  })
  it('plays a quiet optional acceptance tone only after settlement and closes audio once', () => {
    const frequencies: number[] = [], peaks: number[] = []; let closed = 0, soundEnabled = false
    class AudioBoundary {
      state = 'running'; currentTime = 0; destination = {}
      close() { closed++; return Promise.resolve() }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime(n: number) { if (n > .0001) peaks.push(n) } }, connect(next: unknown) { return next } } }
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime(n: number) { frequencies.push(n) } }, connect(g: { connect(next: unknown): unknown }) { return g }, start() {}, stop() {} } }
    }
    vi.stubGlobal('AudioContext', AudioBoundary)
    const s = mount(0, { isSoundEnabled: () => soundEnabled })
    expect(frequencies).toEqual([]); step(s, 0); expect(frequencies).toEqual([])
    soundEnabled = true; step(s, 1, false); expect(frequencies).toEqual([]); s.run(); expect(frequencies).toEqual([523.25])
    const returning = mount(2, { returning: true, isSoundEnabled: () => true }); returning.run(); expect(frequencies).toEqual([523.25])
    step(s, 2); expect(frequencies).toEqual([523.25, 523.25]); expect(peaks).toEqual([.003, .003])
    s.instance.dispose(); s.instance.dispose(); returning.instance.dispose(); expect(closed).toBe(1)
  })
  it.each([0, 1, 2])('rejects wrong surfaces, release-only, reverse, short, cross-axis and deliberately withdrawn gestures at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at), end: [number, number] = [p[0] + dx, p[1] + dy]
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', end)
    for (const [x, y] of [[dx / 8, dy / 8], [-dx, -dy], [-dy, dx]]) drag(s, at, x, y)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', [p[0] + dx * .4, p[1] + dy * .4]); event(s.hit, 'pointerup', [p[0] + dx * .4, p[1] + dy * .4])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('checks terminal release coordinates for reverse, cross-axis and nonfinite displacement at %i', at => {
    const s = mount(at, { isReducedMotion: () => true })
    for (const kind of ['back', 'cross', 'nan']) {
      const p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at); event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy])
      const end: [number, number] = kind === 'back' ? [p[0] + dx * .25, p[1] + dy * .25] : kind === 'cross' ? [p[0] + dx - dy, p[1] + dy + dx] : [NaN, p[1]]
      event(s.hit, 'pointerup', end); expect(s.progress, kind).toEqual([])
    }
    step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('rejects a nonfinite move even when the final release is valid at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [NaN, p[1]])
    event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy]); event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run()
    expect(s.progress).toEqual([]); expect(s.button.disabled).toBe(false); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([false, true])('accepts a wobbly drag ending fully extended exactly once, reduced=%s', reduced => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, { isReducedMotion: () => reduced }), p = s.point(targetName(at), anchor(at))
      event(s.hit, 'pointerdown', p)
      for (const [along, cross] of [[12, 16], [24, -16], [36, 16], [48, -16], [60, 0]]) event(s.hit, 'pointermove', [p[0]+delta(at)[0]*along/60-delta(at)[1]*cross/60,p[1]+delta(at)[1]*along/60+delta(at)[0]*cross/60])
      event(s.hit, 'pointerup', [p[0] + delta(at)[0], p[1] + delta(at)[1]])
      s.run(); expect(s.progress).toEqual([at + 1]); expect(s.button.disabled).toBe(at === 2)
    }
  })
  it.each([0, 1, 2, 3])('silently restores ordinary and returning checkpoint %i', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 3 ? ['drag'] : []); expect(s.button.hidden).toBe(at === 3)
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled(); s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('frames every subject vertex and exposes the first reachable material cue at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('koinobori-subject')!.traverse(o => {
        const m = o as THREE.Mesh; if (!m.geometry) return
        const pos = m.geometry.getAttribute('position'), bounds = new THREE.Box3(), p = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) bounds.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(s.camera))
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)), m.name).toBeLessThan(.97)
      })
      for (const { object, cue } of cues(s)) {
        const hit = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(hit.object?.name, `first reachable material cue ${object.name}`).toBe(object.name); expect(Math.abs(hit.q.x)).toBeLessThan(.97); expect(Math.abs(hit.q.y)).toBeLessThan(.97)
      }
      if (at < 3) step(s, at); expect(s.progress).toEqual(at < 3 ? [at + 1] : []); s.instance.dispose()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels %s without progress or stale position/rotation', kind => {
    for (const at of [0, 1, 2]) {
      let active = true; const s = mount(at, { isActive: () => active }), pivot = s.scene.getObjectByName(at === 0 ? 'koinobori-tail' : 'koinobori-toggle')!, home = pivot.position.clone(), scale = pivot.scale.clone(), rotation = pivot.quaternion.clone(), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2]); const frames = rendered.render.mock.calls.length
      expect(pivot.position.distanceTo(home) + pivot.scale.distanceTo(scale) + pivot.quaternion.angleTo(rotation)).toBeGreaterThan(.04)
      if (kind === 'pause') { active = false; s.instance.update(.05); s.instance.update(.05); expect(rendered.render.mock.calls.length).toBe(frames) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); expect(s.progress).toEqual([]); expect(pivot.position.distanceTo(home)).toBeLessThan(.00001); expect(pivot.quaternion.angleTo(rotation)).toBeLessThan(.00001); expect(pivot.scale.distanceTo(scale)).toBeLessThan(.00001)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025); step(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('keeps all subject vertices in frame during each unfurl, hoist and securing movement at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      const check = () => {
        s.scene.updateMatrixWorld(true); let extent = 0
        s.scene.getObjectByName('koinobori-subject')!.traverse(o => {
          const m = o as THREE.Mesh; if (!m.geometry) return
          const positions = m.geometry.getAttribute('position'), vertex = new THREE.Vector3()
          for (let i = 0; i < positions.count; i++) { vertex.fromBufferAttribute(positions, i).applyMatrix4(m.matrixWorld).project(s.camera); extent = Math.max(extent, Math.abs(vertex.x), Math.abs(vertex.y)) }
        })
        expect(extent).toBeLessThan(.97)
      }
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2]); check()
      event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy]); check(); event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy])
      for (let i = 0; i < 40; i++) { s.instance.update(.025); check() }
      expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('freezes accepted motion and input while paused at %i', at => {
    let active = true; const s = mount(at, { isActive: () => active }); step(s, at, false); expect(s.button.disabled).toBe(true); expect(s.hit.style.pointerEvents).toBe('none')
    s.button.click(); for (const dt of [NaN, Infinity, -10, 100000]) s.instance.update(dt); expect(s.progress).toEqual([])
    active = false; const pivot = s.scene.getObjectByName(at === 0 ? 'koinobori-tail' : 'koinobori-toggle')!, pose = pivot.position.clone(), rotation = pivot.quaternion.clone(), frames = rendered.render.mock.calls.length
    s.run(2); expect(rendered.render.mock.calls.length).toBe(frames); expect(pivot.position.distanceTo(pose)).toBeLessThan(.00001); expect(pivot.quaternion.angleTo(rotation)).toBeLessThan(.00001); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('rejects a target behind another opaque object at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), blocker = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.lerpVectors(s.scene.getObjectByName(targetName(at))!.localToWorld(new THREE.Vector3(...anchor(at))), s.camera.position, .15)
    blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker); s.scene.updateMatrixWorld(true); step(s, at); expect(s.progress).toEqual([])
    blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose(); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([0, 1, 2])('preserves pointer ownership through prepareFeedback input on and outside the hit layer at %i', at => {
    for (const outside of [false, true]) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(outside ? document.body : s.hit, type, [1, 1]); step(s, at); expect(s.progress, `${outside} ${type}`).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('invalidates prepared pointer and keyboard input on every pause/resume boundary at %i', at => {
    for (const keyboard of [false, true]) {
      let attack = () => {}, active = true; const s = mount(at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback: () => attack() })
      attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
      for (let i = 0; i < 2; i++) { keyboard ? s.button.click() : step(s, at); expect(s.progress).toEqual([]) }
      attack = () => {}; keyboard ? s.button.click() : step(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('blocks synchronous %s step skipping and update reentry', callback => {
    let attack = () => {}; const seen: number[] = [], s = mount(0, { isReducedMotion: () => true, [callback]: () => attack(), onProgress: n => { seen.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); step(s, 0); step(s, 1); s.instance.update(100) }
    s.button.click(); expect(seen).toEqual([1]); s.button.click(); expect(seen).toEqual([1, 2]); s.button.click(); expect(seen).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0,1,2])('rejects multitouch with an otherwise valid primary drag at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at))
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0]+delta(at)[0], p[1]+delta(at)[1]]); event(s.hit, 'pointerup', [p[0]+delta(at)[0], p[1]+delta(at)[1]]); event(s.hit, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); step(s, at); expect(s.progress).toEqual([at+1])
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('stops after %s pauses or disposes the scene', callback => {
    for (const mode of ['pause', 'dispose']) {
      let active = true, destroy = () => {}; const s = mount(0, { isReducedMotion: () => true, isActive: () => active, [callback]: () => { if (mode === 'pause') active = false; else destroy() } })
      destroy = () => s.instance.dispose(); const frames = rendered.render.mock.calls.length; s.button.click(); s.instance.update(.1); s.button.click(); expect(rendered.render.mock.calls.length).toBe(frames)
      if (mode === 'dispose') expect(s.overlay.childElementCount).toBe(0); s.instance.dispose()
    }
  })
  it.each(['onProgress', 'haptic'] as const)('invalidates terminal completion after a synchronous %s pause/resume', callback => {
    let active = true, attack = () => {}; const s = mount(2, { isActive: () => active, [callback]: () => attack() })
    attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
    step(s, 2); expect(s.complete).not.toHaveBeenCalled(); expect(s.button.hidden).toBe(true)
    if (callback === 'onProgress') expect(s.haptic).not.toHaveBeenCalled()
  })
  it.each([NaN, Infinity, -9])('normalizes invalid restoration %s without reporting progress', initial => {
    const s = mount(initial, { isReducedMotion: () => true }); s.instance.start(); s.instance.update(NaN); expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([1])
  })
  it('removes all matching pointer callback guards exactly once', () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener'), removed = vi.spyOn(EventTarget.prototype, 'removeEventListener'), windowAdded = vi.spyOn(window, 'addEventListener'), windowRemoved = vi.spyOn(window, 'removeEventListener'), s = mount()
    const guards = added.mock.calls.filter(([type, , options], i) => added.mock.contexts[i] === s.hit && options === true && ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture'].includes(type))
    expect(guards).toHaveLength(5); s.instance.dispose(); s.instance.dispose()
    for (const [type, listener, options] of guards) {
      expect(removed.mock.calls.filter(([t, l, o], i) => removed.mock.contexts[i] === s.hit && t === type && l === listener && o === options)).toHaveLength(1)
      expect(windowAdded.mock.calls.filter(([t, l, o]) => t === type && l === listener && o === options)).toHaveLength(1)
      expect(windowRemoved.mock.calls.filter(([t, l, o]) => t === type && l === listener && o === options)).toHaveLength(1)
    }
  })
  it('releases capture, geometry, materials, cues and DOM once and rejects retained inputs after disposal', () => {
    const s = mount(2), resources = new Set<THREE.BufferGeometry | THREE.Material | THREE.Texture>(), cued: THREE.Object3D[] = []
    s.scene.traverse(o => { if (o.userData.interactionCues?.length) cued.push(o); const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) { resources.add(mat); const map = (mat as THREE.MeshStandardMaterial).map; if (map) resources.add(map) } })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const p = s.point(targetName(2), anchor(2)), release = vi.fn(); s.hit.releasePointerCapture = release; event(s.hit, 'pointerdown', p)
    const renderer = rendered.renderer as THREE.WebGLRenderer, frames = rendered.render.mock.calls.length; s.instance.dispose(); s.instance.dispose(); s.button.click(); event(s.hit, 'pointerup', p); s.instance.start(); s.instance.update(10)
    expect(release).toHaveBeenCalledExactlyOnceWith(1); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(frames)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); for (const o of cued) expect(o.userData.interactionCues).toEqual([])
  })
})
