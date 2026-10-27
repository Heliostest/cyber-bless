// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as mod from './index'

// Only GPU work is replaced. Three geometry, raycasting, cues and the wish form remain real.
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
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
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
  expect(hit, 'scene provides its object input surface').not.toBeNull()
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = scene.getObjectByName(name)!.localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const write = (text: string) => { const input = overlay.querySelector<HTMLInputElement>('input')!; input.value = text; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
  return { instance, scene, camera, host, overlay, hit, button, point, run, write, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}
function rub(s: ReturnType<typeof mount>) {
  event(s.hit, 'pointerdown', s.point('woodblock-rubbing-grip'))
  for (const x of [-.55, 0, .55, 0, -.55, 0, .55]) event(s.hit, 'pointermove', s.point('woodblock-paper-back', [x, 0, 0]))
  event(s.hit, 'pointerup', s.point('woodblock-paper-back', [.55, 0, 0])); s.run()
}
function peel(s: ReturnType<typeof mount>) {
  const a = s.point('woodblock-paper-corner')
  event(s.hit, 'pointerdown', a)
  for (let y = 8; y <= 64; y += 8) event(s.hit, 'pointermove', [a[0], a[1] - y])
  event(s.hit, 'pointerup', [a[0], a[1] - 64]); s.run()
}
function tap(s: ReturnType<typeof mount>) { const p = s.point('woodblock-print-face'); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
function cues(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  return list
}
function first(s: ReturnType<typeof mount>, p: THREE.Vector3) {
  const ray = new THREE.Raycaster(); const q = p.project(s.camera); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
  const visible: THREE.Object3D[] = []
  s.scene.traverse(object => {
    if (!(object as THREE.Mesh).isMesh) return
    for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (!parent.visible) return
    const mat = (object as THREE.Mesh).material as THREE.Material
    if (mat.transparent) return
    visible.push(object)
  })
  return { q, object: ray.intersectObjects(visible, false)[0]?.object }
}



describe('a rubbing and peeling woodblock print', () => {
  it('asks to return to the paper instead of announcing an invalid off-paper release', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', s.point('woodblock-rubbing-grip'))
    for (const x of [-.55, 0, .55]) event(s.hit, 'pointermove', s.point('woodblock-paper-back', [x, 0, 0]))
    expect(s.overlay.querySelector('.scene-hint')!.textContent).toContain('可以松手')
    event(s.hit, 'pointermove', [1, 1])
    expect(s.overlay.querySelector('.scene-hint')!.textContent).not.toContain('可以松手')
    event(s.hit, 'pointerup', [1, 1]); s.run()
    expect(s.progress).toEqual([])
  })
  it('does not announce a rounded-up incomplete rub as ready to release', () => {
    const s = mount(0, { isReducedMotion: () => true })
    event(s.hit, 'pointerdown', s.point('woodblock-rubbing-grip'))
    for (const x of [-.3744, 0, .3744]) event(s.hit, 'pointermove', s.point('woodblock-paper-back', [x, 0, 0]))
    const hint = s.overlay.querySelector('.scene-hint')!
    expect(hint.textContent).toContain('99%')
    expect(hint.textContent).not.toContain('可以松手')
    event(s.hit, 'pointerup', s.point('woodblock-paper-back', [.3744, 0, 0])); s.run()
    expect(s.progress).toEqual([])
    expect(hint.textContent).toContain('99%')
  })
  it('keeps paper rubbing across separate short strokes and shows the accumulated coverage', () => {
    const s = mount(0, { isReducedMotion: () => true })
    const stroke = (xs: number[]) => {
      event(s.hit, 'pointerdown', s.point('woodblock-rubbing-grip'))
      for (const x of xs) event(s.hit, 'pointermove', s.point('woodblock-paper-back', [x, 0, 0]))
      event(s.hit, 'pointerup', s.point('woodblock-paper-back', [xs.at(-1)!, 0, 0])); s.run()
    }
    stroke([-.55, -.35, -.15])
    expect(s.progress).toEqual([])
    expect(s.overlay.querySelector('.scene-hint')!.textContent).toMatch(/刷印.*\d+%/)
    stroke([.15, .35, .55])
    expect(s.progress).toEqual([1])
    expect(s.scene.getObjectByName('woodblock-print-face')!.visible).toBe(true)
  })
  it('discards a canceled rubbing stroke without removing previously accepted paper coverage', () => {
    const s = mount(0, { isReducedMotion: () => true })
    const start = () => event(s.hit, 'pointerdown', s.point('woodblock-rubbing-grip'))
    const move = (x: number) => event(s.hit, 'pointermove', s.point('woodblock-paper-back', [x, 0, 0]))
    const end = (type: string, x: number) => event(s.hit, type, s.point('woodblock-paper-back', [x, 0, 0]))
    start(); [-.55, -.35, -.15].forEach(move); end('pointerup', -.15)
    const coverage = s.overlay.querySelector('.scene-hint')!.textContent
    start(); [.15, .35, .55].forEach(move); end('pointercancel', .55)
    expect(s.progress).toEqual([])
    expect(s.overlay.querySelector('.scene-hint')!.textContent).toBe(coverage)
    start(); [.15, .35, .55].forEach(move); end('pointerup', .55); s.run()
    expect(s.progress).toEqual([1])
  })
  it.each([false, true])('transfers an original print by real rubbing and paper lift, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced })
    const paper = s.scene.getObjectByName('woodblock-paper')!, face = s.scene.getObjectByName('woodblock-print-face')!
    expect(face.visible).toBe(false)
    rub(s); expect(s.progress).toEqual([1]); expect(face.visible).toBe(true); expect(paper.rotation.x).toBe(0)
    peel(s); expect(s.progress).toEqual([1, 2]); expect(paper.rotation.x).toBeLessThan(-1.5)
    tap(s); tap(s); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('rejects empty space, wrong objects, no actual move, a drop without rubbing and short contact strokes', () => {
    const s = mount(0, { isReducedMotion: () => true }), a = s.point('woodblock-rubbing-grip'), b = s.point('woodblock-paper-back')
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b)
    event(s.hit, 'pointerdown', b); event(s.hit, 'pointermove', a); event(s.hit, 'pointerup', a)
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointerup', b)
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointerup', b)
    event(s.hit, 'pointerdown', a); event(s.hit, 'pointermove', b); event(s.hit, 'pointermove', [b[0]+3, b[1]]); event(s.hit, 'pointerup', b)
    expect(s.progress).toEqual([]); rub(s); expect(s.progress).toEqual([1])
    const c = s.point('woodblock-paper-corner')
    for (const end of [[c[0], c[1]+65], [c[0]+70, c[1]], [c[0], c[1]-8]] as [number,number][]) { event(s.hit, 'pointerdown', c); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end) }
    event(s.hit, 'pointerup', [c[0], c[1]-65])
    expect(s.progress).toEqual([1]); peel(s); expect(s.progress).toEqual([1, 2])
    const p=s.point('woodblock-print-face'); event(s.hit,'pointerdown',p); event(s.hit,'pointermove',[p[0]+16,p[1]]); event(s.hit,'pointerup',p); expect(s.progress).toEqual([1, 2])
  })
  it.each([0, 1, 2, 3])('restores %i silently with native button completion and no saved draft', at => {
    const s = mount(at, { isReducedMotion: () => true }); s.run()
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
    expect(cues(s).map(x=>x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
    expect(s.button.type).toBe('button'); expect(s.button.hidden).toBe(at===3)
    for(let i=at;i<3;i++) s.button.click()
    expect(s.progress).toEqual([1,2,3].filter(n=>n>at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([284, 350, 1280])('keeps real object vertices and opaque cue anchors in view at width %i', width => {
    for (const at of [0,1,2,3]) {
      const s=mount(at,{},width); s.scene.updateMatrixWorld(true)
      s.scene.getObjectByName('woodblock-workbench')!.traverse(o=>{
        const m=o as THREE.Mesh; if(!m.geometry || m.name.includes('shadow')) return
        for(let p:THREE.Object3D|null=o;p;p=p.parent) if(!p.visible)return
        const pos=m.geometry.getAttribute('position')
        const bounds=new THREE.Box3(), projected=new THREE.Vector3()
        // Project every vertex, retaining the same strict X/Y limits while
        // avoiding two costly matcher invocations and an allocation per vertex.
        for(let i=0;i<pos.count;i++) {
          projected.fromBufferAttribute(pos,i).applyMatrix4(m.matrixWorld).project(s.camera)
          bounds.expandByPoint(projected)
        }
        const extent=Math.max(Math.abs(bounds.min.x),Math.abs(bounds.max.x),Math.abs(bounds.min.y),Math.abs(bounds.max.y))
        expect(extent,m.name).toBeLessThan(.97)
      })
      for(const {object,cue} of cues(s)) {
        expect(first(s,object.localToWorld(new THREE.Vector3(...(cue.anchor??[0,0,0])))).object?.name,`visible cue ${object.name}`).toBe(object.name)
        if(cue.destination instanceof THREE.Object3D) expect(first(s,cue.destination.getWorldPosition(new THREE.Vector3())).object?.name).toBe(cue.destination.name)
      }
      if(at===0)rub(s); if(at===1)peel(s); if(at===2)tap(s)
      expect(s.progress).toEqual(at<3?[at+1]:[]);s.instance.dispose()
    }
  })
  it.each(['pointercancel','lostpointercapture','blur','pause'])('restores material after interrupted %s without progress or extra paused rendering', kind=>{
    for(const at of [0,1]) {
      let active=true; const s=mount(at,{isActive:()=>active}), paper=s.scene.getObjectByName('woodblock-paper')!, pad=s.scene.getObjectByName('woodblock-rubbing-pad')!
      const home=pad.position.clone(), angle=paper.rotation.x, a=s.point(at===0?'woodblock-rubbing-grip':'woodblock-paper-corner')
      event(s.hit,'pointerdown',a); event(s.hit,'pointermove',at===0?s.point('woodblock-paper-back'):[a[0],a[1]-35]); const frames=rendered.render.mock.calls.length
      if(kind==='pause'){active=false;s.instance.update(.05);s.instance.update(.05);expect(rendered.render.mock.calls.length).toBe(frames)} else if(kind==='blur')window.dispatchEvent(new Event('blur'));else event(s.hit,kind,a)
      event(s.hit,'pointerup',[a[0],a[1]-65]); s.run(); expect(s.progress).toEqual([]);expect(pad.position.distanceTo(home)).toBeLessThan(.00001);expect(paper.rotation.x).toBe(angle)
      if(kind==='blur')window.dispatchEvent(new Event('focus'));active=true;s.instance.update(.025);at===0?rub(s):peel(s);expect(s.progress).toEqual([at+1]);s.instance.dispose()
    }
  })
  it.each(['prepareFeedback','haptic','onProgress'] as const)('holds the input lock during synchronous %s reentry', callback=>{
    let attack=()=>{};const seen:number[]=[];const s=mount(0,{isReducedMotion:()=>true,[callback]:()=>attack(),onProgress:n=>{seen.push(n);if(callback==='onProgress')attack()}})
    attack=()=>{s.button.click();rub(s);peel(s);s.instance.update(1)};s.button.click();expect(seen).toEqual([1]);s.button.click();expect(seen).toEqual([1,2]);s.button.click();expect(seen).toEqual([1,2,3]);expect(s.complete).toHaveBeenCalledOnce()
  })
  it.each([0,1,2])('preserves the original physical pointer through prepareFeedback input at checkpoint %i',at=>{
    for(const type of ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture']) {
      let attack=()=>{};const s=mount(at,{isReducedMotion:()=>true,prepareFeedback:()=>attack()})
      attack=()=>event(s.hit,type,[1,1])
      at===0?rub(s):at===1?peel(s):tap(s)
      expect(s.progress,type).toEqual([at+1]);s.instance.dispose()
    }
  })
  it('removes each callback pointer guard on disposal',()=>{
    const added=vi.spyOn(EventTarget.prototype,'addEventListener'), removed=vi.spyOn(EventTarget.prototype,'removeEventListener'),s=mount()
    const guards=added.mock.calls.filter(([type,,options],index)=>added.mock.contexts[index]===s.hit && options===true && ['pointerdown','pointermove','pointerup','pointercancel','lostpointercapture'].includes(type))
    expect(guards).toHaveLength(5);s.instance.dispose();s.instance.dispose()
    for(const [type,listener,options] of guards) expect(removed.mock.calls.filter(([t,l,o],index)=>removed.mock.contexts[index]===s.hit&&t===type&&l===listener&&o===options)).toHaveLength(1)
  })
  it.each(['prepareFeedback','haptic','onProgress'] as const)('stops rendering when the host pauses in %s', callback=>{
    let active=true;const s=mount(0,{isReducedMotion:()=>true,isActive:()=>active,[callback]:()=>{active=false}}), frames=rendered.render.mock.calls.length;s.button.click();s.instance.update(.05);s.instance.update(.05);expect(rendered.render.mock.calls.length).toBe(frames)
  })
  it('saves a trimmed explicit wish once and never saves quiet drafts or returning visits',()=>{
    const s=mount(2), input=s.overlay.querySelector<HTMLInputElement>('input')!;expect(input.maxLength).toBeGreaterThan(40);s.write('  ');s.write('心'.repeat(41));expect(s.progress).toEqual([])
    const form=input.form!;s.saveWish.mockImplementation(()=>{form.dispatchEvent(new Event('submit',{cancelable:true}));s.button.click();tap(s)})
    s.write('  春来平安  ');expect(s.progress).toEqual([3]);expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('春来平安');expect(s.complete).toHaveBeenCalledOnce()
    const q=mount(2);q.overlay.querySelector<HTMLInputElement>('input')!.value='草稿';tap(q);expect(q.saveWish).not.toHaveBeenCalled()
    const r=mount(2,{returning:true});expect(r.overlay.querySelector('input')).toBeNull();tap(r);expect(r.saveWish).not.toHaveBeenCalled()
  })
  it('does not submit early or during a material gesture',()=>{
    const s=mount(0,{isReducedMotion:()=>true});s.write('提前');expect(s.saveWish).not.toHaveBeenCalled();s.button.click();s.write('提前');expect(s.saveWish).not.toHaveBeenCalled();s.button.click()
    event(s.hit,'pointerdown',s.point('woodblock-print-face'));s.write('触摸中');expect(s.saveWish).not.toHaveBeenCalled();event(s.hit,'pointercancel',s.point('woodblock-print-face'));s.write('安好');expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('安好')
  })
  it.each([0,1,2])('does not reach through an opaque object at checkpoint %i',at=>{
    const s=mount(at,{isReducedMotion:()=>true}), name=at===0?'woodblock-rubbing-grip':at===1?'woodblock-paper-corner':'woodblock-print-face'
    const shield=new THREE.Mesh(new THREE.PlaneGeometry(.9,.9),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
    shield.position.lerpVectors(s.scene.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()),s.camera.position,.15);shield.quaternion.copy(s.camera.quaternion);s.scene.add(shield);s.scene.updateMatrixWorld(true)
    at===0?rub(s):at===1?peel(s):tap(s);expect(s.progress).toEqual([])
    shield.removeFromParent();shield.geometry.dispose();shield.material.dispose();at===0?rub(s):at===1?peel(s):tap(s);expect(s.progress).toEqual([at+1])
  })
  it('rejects a paper contact or release occluded by an opaque mesh',()=>{
    const s=mount(0,{isReducedMotion:()=>true}), paper=s.scene.getObjectByName('woodblock-paper-back')!
    event(s.hit,'pointerdown',s.point('woodblock-rubbing-grip'))
    for(const x of [-.55,0,.55,0,-.55,0,.55])event(s.hit,'pointermove',s.point(paper.name,[x,0,0]))
    const shield=new THREE.Mesh(new THREE.PlaneGeometry(1.8,1),new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
    shield.position.lerpVectors(paper.getWorldPosition(new THREE.Vector3()),s.camera.position,.15);shield.quaternion.copy(s.camera.quaternion);s.scene.add(shield);s.scene.updateMatrixWorld(true)
    event(s.hit,'pointerup',s.point(paper.name,[.55,0,0]));s.run();expect(s.progress).toEqual([])
    shield.removeFromParent();shield.geometry.dispose();shield.material.dispose();rub(s);expect(s.progress).toEqual([1])
  })
  it.each(['prepareFeedback','haptic','onProgress'] as const)('honors disposal inside %s without a later frame',callback=>{
    let destroy=()=>{};const s=mount(0,{isReducedMotion:()=>true,[callback]:()=>destroy()});destroy=()=>s.instance.dispose()
    const frames=rendered.render.mock.calls.length;s.button.click();s.instance.update(.1);s.button.click();expect(rendered.render.mock.calls.length).toBe(frames);expect(s.overlay.childElementCount).toBe(0)
  })
  it('commits an explicit wish atomically through pause and rejects save callback reentry',()=>{
    let active=true;const seen:number[]=[];const s=mount(2,{isActive:()=>active,onProgress:n=>seen.push(n)})
    s.saveWish.mockImplementation(()=>{active=false;s.button.click();s.instance.update(.1)});s.write('平安');expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('平安');expect(seen).toEqual([3]);expect(s.complete).not.toHaveBeenCalled()
    active=true;s.instance.update(.1);s.button.click();expect(seen).toEqual([3])
  })
  it.each([Number.NaN,Number.POSITIVE_INFINITY,-9])('sanitizes invalid progress %s silently',initial=>{
    const s=mount(initial,{isReducedMotion:()=>true});s.instance.start();s.instance.update(Number.NaN);expect(s.progress).toEqual([]);s.button.click();expect(s.progress).toEqual([1])
  })
  it('frees geometry, material, cues and DOM exactly once and rejects retained inputs after disposal',()=>{
    const s=mount(2), resources=new Set<THREE.BufferGeometry|THREE.Material>(), cued:THREE.Object3D[]=[]
    s.scene.traverse(o=>{if(o.userData.interactionCues?.length)cued.push(o);const m=o as THREE.Mesh;if(m.geometry)resources.add(m.geometry);for(const mat of Array.isArray(m.material)?m.material:m.material?[m.material]:[])resources.add(mat)})
    const freed=new Map<unknown,number>();resources.forEach(r=>r.addEventListener('dispose',()=>freed.set(r,(freed.get(r)??0)+1)))
    const p=s.point('woodblock-print-face'), form=s.overlay.querySelector('form')!, input=s.overlay.querySelector('input')!;input.value='已销毁'
    const renderer=rendered.renderer as THREE.WebGLRenderer, frames=rendered.render.mock.calls.length;s.instance.dispose();s.instance.dispose();s.button.click();form.dispatchEvent(new Event('submit',{cancelable:true}));event(s.hit,'pointerdown',p);event(s.hit,'pointerup',p);s.instance.start();s.instance.update(10)
    expect(s.progress).toEqual([]);expect(s.saveWish).not.toHaveBeenCalled();expect(rendered.render.mock.calls.length).toBe(frames);expect(freed.size).toBe(resources.size);expect([...freed.values()].every(n=>n===1)).toBe(true);expect(renderer.dispose).toHaveBeenCalledOnce();expect(renderer.forceContextLoss).toHaveBeenCalledOnce();expect(s.overlay.childElementCount).toBe(0)
    expect(s.host.querySelector('.scene-object-cues')).toBeNull();for(const o of cued)expect(o.userData.interactionCues).toEqual([])
  })
})
