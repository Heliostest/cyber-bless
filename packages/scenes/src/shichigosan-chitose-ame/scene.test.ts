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
const nextCheckpoint = (at: number) => 3
const targetName = (at: number) => ['chitose-grip','chitose-grip','chitose-grip'][at]!
const anchor = (at: number): [number, number, number] => [[0,0,.025],[0,0,.025],[0,0,.025]][at] as [number,number,number]
const originalDelta = (at: number): [number,number] => [[0,-60],[60,0],[0,60]][at] as [number,number]
function delta(at:number,s:ReturnType<typeof mount>):[number,number]{
 const cue=cues(s).find(entry=>entry.cue.kind==='drag')?.cue
 if(!cue?.destination)return originalDelta(at)
 const target=typeof cue.destination==='function'?cue.destination():cue.destination.getWorldPosition(new THREE.Vector3())
 const q=target.project(s.camera),rect=s.host.querySelector('canvas')!.getBoundingClientRect(),a=s.point(targetName(at),anchor(at))
 return [rect.left+(q.x+1)*rect.width/2-a[0],rect.top+(1-q.y)*rect.height/2-a[1]]
}
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function step(s: ReturnType<typeof mount>, at: number, run = true) { if(at < 3) drag(s, at, ...delta(at,s), run) }
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


describe('Shichi Go San child longevity gift', () => {
  it('uses Chitose Ame gift identity for the visible title, accessible steps and default style registration',()=>{
    const s=mount()
    expect(s.overlay.querySelector('.scene-title')?.textContent).toBe('千岁赠糖')
    expect(s.overlay.querySelector('[aria-label="千岁赠糖步骤"]')).not.toBeNull()
    expect(rendered.metadata).toEqual({id:'shichigosan-chitose-ame',label:'千岁赠糖'})
  })
  it.each([false,true])('lifts the candy bag, brings it to the child and settles the handle into waiting hands, reduced=%s', reduced => {
    const s=mount(0,{isReducedMotion:()=>reduced})
    step(s,0,false); if(!reduced)expect(s.progress).toEqual([]); s.run(); expect(s.progress).toEqual([3])
    s.button.click(); s.run(); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('uses identical final subject transforms for ordinary, reduced motion and silently restored checkpoints', () => {
    for (const checkpoint of [3]) {
      const normal = mount(), reduced = mount(0, { isReducedMotion: () => true }), restored = mount(checkpoint)
      step(normal, 0); step(reduced, 0)
      normal.scene.updateMatrixWorld(true); reduced.scene.updateMatrixWorld(true); restored.scene.updateMatrixWorld(true)
      normal.scene.getObjectByName('chitose-subject')!.traverse(o => {
        for (const other of [reduced, restored]) {
          const counterpart=other.scene.getObjectByName(o.name)!,m=counterpart.matrixWorld
          o.matrixWorld.elements.forEach((v, i) => expect(v, o.name).toBeCloseTo(m.elements[i], 9))
          const geometry=(o as THREE.Mesh).geometry,restoredGeometry=(counterpart as THREE.Mesh).geometry
          if(geometry?.attributes.position)expect(Array.from(geometry.attributes.position.array),o.name).toEqual(Array.from(restoredGeometry.attributes.position!.array))
        }
      })
      normal.instance.dispose(); reduced.instance.dispose(); restored.instance.dispose()
    }
  })
  it('offers 44px native keyboard actions, physical input and no wish form or entry feedback', () => {
    const s = mount(); expect(s.hit).not.toBeNull(); expect(s.button.type).toBe('button')
    expect(s.button.style.minWidth).toBe('44px'); expect(s.button.style.minHeight).toBe('44px'); expect(s.overlay.querySelector('input,form')).toBeNull()
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    s.button.click(); expect(s.progress).toEqual([]); s.run(); expect(s.progress).toEqual([3])
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
    expect(frequencies).toEqual([]); s.run(); expect(frequencies).toEqual([])
    soundEnabled = true; step(s, 0, false); expect(frequencies).toEqual([]); s.run(); expect(frequencies).toEqual([440])
    const returning = mount(2, { returning: true, isSoundEnabled: () => true }); returning.run(); expect(frequencies).toEqual([440])
    step(s, 2); expect(frequencies).toEqual([440]); expect(peaks).toEqual([.003])
    s.instance.dispose(); s.instance.dispose(); returning.instance.dispose(); expect(closed).toBe(1)
  })
  it.each([0,1,2])('rejects wrong surfaces, orphan release and grabs released outside the target at %i',at=>{
    const s=mount(at,{isReducedMotion:()=>true}),p=s.point(targetName(at),anchor(at)),[dx,dy]=delta(at,s),end:[number,number]=[p[0]+dx,p[1]+dy];event(s.hit,'pointerdown',[1,1]);event(s.hit,'pointermove',end);event(s.hit,'pointerup',end);event(s.hit,'pointerup',end);event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0]+dx*.25,p[1]+dy*.25]);event(s.hit,'pointerup',[p[0]+dx*.25,p[1]+dy*.25]);expect(s.progress).toEqual([]);step(s,at);expect(s.progress).toEqual([nextCheckpoint(at)])
  })
  it.each([0,1,2])('rejects invalid release destinations before arrival at %i',at=>{
    for(const kind of['back','cross','nan']){const s=mount(at,{isReducedMotion:()=>true}),p=s.point(targetName(at),anchor(at)),[dx,dy]=delta(at,s);event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0]+dx*.25,p[1]+dy*.25]);const end:[number,number]=kind==='back'?p:kind==='cross'?[p[0]+dx-dy,p[1]+dy+dx]:[NaN,p[1]];event(s.hit,'pointerup',end);expect(s.progress,kind).toEqual([]);s.instance.dispose()}
  })
  it.each([0, 1, 2])('accepts a continued same-direction release and an eighteen pixel correction at %i', at => {
    for (const factor of [3, .7]) {
      const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at,s)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy])
      event(s.hit, 'pointerup', [p[0] + dx * factor, p[1] + dy * factor])
      expect(s.progress).toEqual([nextCheckpoint(at)]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('rejects a nonfinite move even when the final release is valid at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at,s)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [NaN, p[1]])
    event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy]); event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run()
    expect(s.progress).toEqual([]); expect(s.button.disabled).toBe(false); step(s, at); expect(s.progress).toEqual([nextCheckpoint(at)])
  })
  it.each([false, true])('accepts a gentle zigzag path and remains ready after settlement, reduced=%s', reduced => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, { isReducedMotion: () => reduced }), p = s.point(targetName(at), anchor(at)), [dx,dy]=delta(at,s)
      event(s.hit, 'pointerdown', p)
      for (const [along, cross] of [[12, 16], [24, -16], [36, 16], [48, -16], [60, 0]]) event(s.hit, 'pointermove', [p[0]+dx*along/60-dy*cross/60,p[1]+dy*along/60+dx*cross/60])
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy])
      s.run(); expect(s.progress).toEqual([nextCheckpoint(at)]); expect(s.button.disabled).toBe(true)
    }
  })
  it.each([0, 1, 2, 3])('silently restores ordinary and returning checkpoint %i', at => {
    for (const returning of [false, true]) {
      const s = mount(at, { returning, isReducedMotion: () => true }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 3 ? ['drag'] : []); expect(s.button.hidden).toBe(at === 3)
      for (let i = at; i < 3; i++) s.button.click()
      expect(s.progress).toEqual([3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled(); s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('frames every subject vertex and exposes the first reachable material cue at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('chitose-subject')!.traverse(o => {
        const m = o as THREE.Mesh; if (!m.geometry) return
        const pos = m.geometry.getAttribute('position'), bounds = new THREE.Box3(), p = new THREE.Vector3()
        for (let i = 0; i < pos.count; i++) bounds.expandByPoint(p.fromBufferAttribute(pos, i).applyMatrix4(m.matrixWorld).project(s.camera))
        expect(Math.max(Math.abs(bounds.min.x), Math.abs(bounds.max.x), Math.abs(bounds.min.y), Math.abs(bounds.max.y)), m.name).toBeLessThan(.97)
      })
      for (const { object, cue } of cues(s)) {
        if(cue.destination)expect(cue.direction).toBeUndefined();else expect(cue.direction).toEqual([[0,-1],[1,0],[0,1]][at])
        const hit = first(s, object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
        expect(hit.object?.name, `first reachable material cue ${object.name}`).toBe(object.name); expect(Math.abs(hit.q.x)).toBeLessThan(.97); expect(Math.abs(hit.q.y)).toBeLessThan(.97)
      }
      if (at < 3) step(s, at); expect(s.progress).toEqual(at < 3 ? [nextCheckpoint(at)] : []); s.instance.dispose()
    }
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels %s without progress or stale position/rotation', kind => {
    for (const at of [0, 1, 2]) {
      let active = true; const s = mount(at, { isActive: () => active }), pivot = s.scene.getObjectByName(['chitose-bag-root','chitose-bag-root','chitose-bag-root'][at]!)!, home = pivot.position.clone(), scale = pivot.scale.clone(), rotation = pivot.quaternion.clone(), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at,s)
      const visibility=()=>{const names:string[]=[];s.scene.getObjectByName('chitose-subject')!.traverseVisible(o=>names.push(o.name));return names}
      const visibleBefore=visibility()
      // Every action moves the actual candy bag.
      const fraction=.5
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx * fraction, p[1] + dy * fraction]); const frames = rendered.render.mock.calls.length
      expect(pivot.position.distanceTo(home)+pivot.quaternion.angleTo(rotation)).toBeGreaterThan(.005)
      if (kind === 'pause') { active = false; s.instance.update(.05); s.instance.update(.05); expect(rendered.render.mock.calls.length).toBe(frames) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); expect(s.progress).toEqual([]); expect(pivot.position.distanceTo(home)).toBeLessThan(.00001); expect(pivot.quaternion.angleTo(rotation)).toBeLessThan(.00001); expect(pivot.scale.distanceTo(scale)).toBeLessThan(.00001)
      expect(visibility()).toEqual(visibleBefore)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025); step(s, at); expect(s.progress).toEqual([nextCheckpoint(at)]); s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('keeps all subject vertices in frame during all three blessing paths at width %i', width => {
    for (const at of [0, 1, 2]) {
      const s = mount(at, {}, width), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at,s)
      const check = () => {
        s.scene.updateMatrixWorld(true); let extent = 0
        s.scene.getObjectByName('chitose-subject')!.traverse(o => {
          const m = o as THREE.Mesh; if (!m.geometry) return
          const positions = m.geometry.getAttribute('position'), vertex = new THREE.Vector3()
          for (let i = 0; i < positions.count; i++) { vertex.fromBufferAttribute(positions, i).applyMatrix4(m.matrixWorld).project(s.camera); extent = Math.max(extent, Math.abs(vertex.x), Math.abs(vertex.y)) }
        })
        expect(extent).toBeLessThan(.97)
      }
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2]); check()
      event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy]); check(); event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy])
      for (let i = 0; i < 40; i++) { s.instance.update(.025); check() }
      expect(s.progress).toEqual([nextCheckpoint(at)]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('freezes accepted motion and input while paused at %i', at => {
    let active = true; const s = mount(at, { isActive: () => active }); step(s, at, false); expect(s.button.disabled).toBe(true); expect(s.hit.style.pointerEvents).toBe('none')
    s.button.click(); for (const dt of [NaN, Infinity, -10, 100000]) s.instance.update(dt); expect(s.progress).toEqual([])
    active = false; const pivot = s.scene.getObjectByName(['chitose-bag-root','chitose-bag-root','chitose-bag-root'][at]!)!, pose = pivot.position.clone(), rotation = pivot.quaternion.clone(), frames = rendered.render.mock.calls.length
    s.run(2); expect(rendered.render.mock.calls.length).toBe(frames); expect(pivot.position.distanceTo(pose)).toBeLessThan(.00001); expect(pivot.quaternion.angleTo(rotation)).toBeLessThan(.00001); expect(s.progress).toEqual([])
    active = true; s.run(); expect(s.progress).toEqual([nextCheckpoint(at)])
  })
  it.each([0, 1, 2])('rejects a target behind another opaque object at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), blocker = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.lerpVectors(s.scene.getObjectByName(targetName(at))!.localToWorld(new THREE.Vector3(...anchor(at))), s.camera.position, .15)
    blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker); s.scene.updateMatrixWorld(true); step(s, at); expect(s.progress).toEqual([])
    blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose(); step(s, at); expect(s.progress).toEqual([nextCheckpoint(at)])
  })
  it.each([0, 1, 2])('preserves pointer ownership through prepareFeedback input on and outside the hit layer at %i', at => {
    for (const outside of [false, true]) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => true, prepareFeedback: () => attack() })
      attack = () => event(outside ? document.body : s.hit, type, [1, 1]); step(s, at); expect(s.progress, `${outside} ${type}`).toEqual([nextCheckpoint(at)]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2])('invalidates prepared pointer and keyboard input on every pause/resume boundary at %i', at => {
    for (const keyboard of [false, true]) {
      let attack = () => {}, active = true; const s = mount(at, { isReducedMotion: () => true, isActive: () => active, prepareFeedback: () => attack() })
      attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
      for (let i = 0; i < 2; i++) { keyboard ? s.button.click() : step(s, at); expect(s.progress).toEqual([]) }
      attack = () => {}; keyboard ? s.button.click() : step(s, at); expect(s.progress).toEqual([nextCheckpoint(at)]); s.instance.dispose()
    }
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('blocks synchronous %s step skipping and update reentry', callback => {
    let attack = () => {}; const seen: number[] = [], s = mount(0, { isReducedMotion: () => true, [callback]: () => attack(), onProgress: n => { seen.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); step(s, 0); step(s, 1); s.instance.update(100) }
    s.button.click(); expect(seen).toEqual([3]); s.button.click(); expect(seen).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0,1,2])('rejects multitouch with an otherwise valid primary drag at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at))
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0]+delta(at,s)[0], p[1]+delta(at,s)[1]]); event(s.hit, 'pointerup', [p[0]+delta(at,s)[0], p[1]+delta(at,s)[1]]); event(s.hit, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); step(s, at); expect(s.progress).toEqual([nextCheckpoint(at)])
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
    const s = mount(initial, { isReducedMotion: () => true }); s.instance.start(); s.instance.update(NaN); expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([3])
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


describe('continuous carrying regression', () => {
  it.each([0,1,2])('carries directly from legacy checkpoint %i to the final physical destination', at => {
    const s=mount(at,{isReducedMotion:()=>true}), settled=mount(3,{isReducedMotion:()=>true});
    const source=s.point(targetName(at),anchor(at)), destination=settled.point(targetName(at),anchor(at));
    event(s.hit,'pointerdown',source); event(s.hit,'pointermove',destination); event(s.hit,'pointerup',destination); s.run();
    expect(s.progress).toEqual([3]);
    expect(s.complete).toHaveBeenCalledOnce();
  });
});


describe('free object inspection without forced route checkpoints',()=>{
  it('rotates in place, keeps the view after inspection and commits only on later translation',()=>{
    const s=mount(0,{isReducedMotion:()=>true}), object=s.scene.getObjectByName('chitose-bag-root')!, before=object.quaternion.clone(), start=s.point(targetName(0),anchor(0));
    const mouse=(type:string,p:[number,number],shiftKey=true)=>{const e=new Event(type,{bubbles:true,cancelable:true});Object.assign(e,{clientX:p[0],clientY:p[1],pointerId:41,pointerType:'mouse',button:0,shiftKey});s.hit.dispatchEvent(e)};
    mouse('pointerdown',start);mouse('pointermove',[start[0]+35,start[1]]);mouse('pointerup',[start[0]+35,start[1]]);
    const rotated=object.quaternion.clone();expect(rotated.angleTo(before)).toBeGreaterThan(.1);s.run();expect(object.quaternion.angleTo(rotated)).toBeLessThan(1e-7);expect(s.progress).toEqual([]);expect(s.complete).not.toHaveBeenCalled();
    step(s,0);expect(s.progress).toEqual([nextCheckpoint(0)]);
  });
  it.each(['blur','pause','resize'])('restores a parked, ownerless object after %s',kind=>{
    let active=true, resized=()=>{};
    class ResizeBoundary{constructor(callback:()=>void){resized=callback}observe(){}disconnect(){}}vi.stubGlobal('ResizeObserver',ResizeBoundary);
    const s=mount(0,{isActive:()=>active}),object=s.scene.getObjectByName('chitose-bag-root')!,home=object.position.clone(),rotation=object.quaternion.clone(),p=s.point(targetName(0),anchor(0));
    const [dx,dy]=delta(0,s), length=Math.max(1,Math.hypot(dx,dy)), parked:[number,number]=[p[0]-dy/length*35,p[1]+dx/length*35];
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',parked);event(s.hit,'pointerup',parked);s.run();
    expect(object.position.distanceTo(home)).toBeGreaterThan(.01);expect(s.progress).toEqual([]);
    if(kind==='blur')window.dispatchEvent(new Event('blur'));else if(kind==='pause'){active=false;s.instance.update(.025)}else resized();
    expect(object.position.distanceTo(home)).toBeLessThan(1e-7);expect(object.quaternion.angleTo(rotation)).toBeLessThan(1e-7);expect(s.progress).toEqual([]);
  });
});
