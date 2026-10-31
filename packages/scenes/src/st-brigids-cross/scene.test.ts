// @vitest-environment jsdom
// jsdom has no Canvas 2D; exercise the explicit unavailable-texture fallback quietly.
beforeEach(() => { vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null) })

// Isolate spatial gestures, geometry and save callbacks from shared ending scheduling.
// The real automatic timer, animation and lifecycle contract are covered across all
// 20 scenes in ../quiet-ending-workshop-scenes.test.ts without this mock.
vi.mock('../quiet-ending', () => ({
  createQuietEnding: () => ({ sync() {}, update() {}, dispose() {}, completing: true, running: false }),
}))

import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import { beforeEach, afterEach, expect, it, vi } from 'vitest'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import * as mod from './index'
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer { setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {} }
  return { ...actual, WebGLRenderer }
})
const built = vi.hoisted(() => ({ scene: undefined as unknown, camera: undefined as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({ createDebugRenderStyle: (_r: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
  built.scene = scene; built.camera = camera
  return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) } }
} }))
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(step = 0, width = 360, height = 360) {
  const canvas = document.createElement('canvas'), overlay = document.createElement('div')
  document.body.append(canvas, overlay)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  let active = true
  const progress = vi.fn(), saveWish = vi.fn(), complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const ctx: SceneContext = { canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: step, onProgress: progress,
    saveWish, isActive: () => active, isReducedMotion: () => true, isSoundEnabled: () => false }
  const instance = mod.create(ctx); instances.push(instance); instance.start(); instance.update(0)
  const scene = built.scene as THREE.Scene, camera = built.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const cues = () => {
    const found: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => { for (const cue of (object.userData.interactionCues ?? []) as InteractionCue[]) if (cue.enabled()) found.push({ object, cue }) })
    return found
  }
  const project = (world: THREE.Vector3): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = world.clone().project(camera); return [(p.x + 1) * width / 2, (1 - p.y) * height / 2]
  }
  const source = () => { const { object, cue } = cues()[0]; return project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0,0,0])))) }
  const target = () => { const { destination } = cues()[0].cue; return project(typeof destination === 'function' ? destination() : destination!.getWorldPosition(new THREE.Vector3())) }
  const fire = (type: string, at: [number,number], id = 1, el: HTMLElement = hit) => {
    const event = new Event(type, { bubbles: true, cancelable: true }); Object.assign(event, { clientX: at[0], clientY: at[1], pointerId: id, button: 0, isPrimary: id === 1 })
    el.dispatchEvent(event)
  }
  const drag = () => { const from=source(), to=target(); fire('pointerdown', from); fire('pointermove', to); fire('pointerup', to); instance.update(0) }
  const button = () => overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
  return { instance, scene, camera, overlay, hit, progress, saveWish, complete, cues, source, target, fire, drag, button, pause: () => { active = false; instance.update(0) }, resume: () => { active = true; instance.update(0) } }
}
it('weaves four actual rush bundles, hangs the cross and ends by tapping it once', () => {
  const s = mount()
  for (let i=0;i<4;i++) { s.drag(); if (i<3) expect(s.progress).not.toHaveBeenCalled() }
  expect(s.progress).toHaveBeenCalledExactlyOnceWith(1)
  expect(s.cues()[0].cue.kind).toBe('drag'); s.drag()
  expect(s.progress.mock.calls).toEqual([[1],[2]])
  s.fire('pointerdown',s.source()); s.fire('pointerup',s.source()); s.instance.update(0)
  expect(s.progress.mock.calls).toEqual([[1],[2],[3]])
  expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.cues()).toEqual([])
  s.button(); expect(s.complete).toHaveBeenCalledOnce()
})
it.each([0,1,2,3])('restores checkpoint %i silently with only the current physical source', step => {
  const s = mount(step)
  expect(s.progress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
  expect(s.cues()).toHaveLength(step<3?1:0)
  if(step<3) expect(s.cues()[0].cue.kind).toBe(step===2?'tap':'drag')
})
it('rejects empty-stage starts and drops outside the current weave point', () => {
  const s=mount(), target=s.target()
  s.fire('pointerdown',[2,2]); s.fire('pointerup',target)
  expect(s.progress).not.toHaveBeenCalled()
  s.fire('pointerdown',s.source()); s.fire('pointermove',[2,2]); s.fire('pointerup',[2,2]); s.instance.update(0)
  for(let i=0;i<3;i++) s.drag()
  expect(s.progress).not.toHaveBeenCalled(); s.drag(); expect(s.progress).toHaveBeenCalledExactlyOnceWith(1)
})
it.each(['pointercancel','lostpointercapture'])('does not advance after %s and allows a fresh gesture', type => {
  const s=mount(1), from=s.source(), to=s.target()
  s.fire('pointerdown',from); s.fire('pointermove',[from[0]+(to[0]-from[0])*.2,from[1]+(to[1]-from[1])*.2]); s.fire(type,to); s.fire('pointerup',to)
  expect(s.progress).not.toHaveBeenCalled(); s.drag(); expect(s.progress).toHaveBeenCalledExactlyOnceWith(2)
})
it('keeps a second finger and paused presses from completing a quiet tap', () => {
  const s=mount(2), at=s.source()
  s.fire('pointerdown',at); s.fire('pointerup',at,2); expect(s.progress).not.toHaveBeenCalled(); s.fire('pointercancel',at)
  s.fire('pointerdown',at); s.pause(); expect(s.cues()).toEqual([]); s.resume(); s.fire('pointerup',at); expect(s.progress).not.toHaveBeenCalled()
  s.fire('pointerdown',at); s.fire('pointerup',at); expect(s.progress).toHaveBeenCalledExactlyOnceWith(3)
})
it('discards a drag when a second finger begins outside the scene', () => {
  const s=mount(1), from=s.source(), to=s.target()
  s.fire('pointerdown',from); s.fire('pointerdown',[2,2],2,document.body); s.fire('pointermove',to); s.fire('pointerup',to); s.fire('pointerup',[2,2],2,document.body)
  expect(s.progress).not.toHaveBeenCalled(); s.drag(); expect(s.progress).toHaveBeenCalledExactlyOnceWith(2)
})
it('keeps every physical phase accessible through the auxiliary button', () => {
  const s=mount(); for(let i=0;i<6;i++) { s.button(); s.instance.update(0) }
  expect(s.progress.mock.calls).toEqual([[1],[2],[3]]); expect(s.complete).toHaveBeenCalledOnce()
})
it.each([284,354])('keeps the actual source and targets visible at %ipx', width => {
  for(const phase of [0,1,2]) {
    const s=mount(phase,width,390), from=s.source()
    expect(from[0]).toBeGreaterThan(20); expect(from[0]).toBeLessThan(width-20)
    expect(from[1]).toBeGreaterThan(20); expect(from[1]).toBeLessThan(370)
    const ray=new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(from[0]/width*2-1,1-from[1]/390*2),s.camera)
    expect(ray.intersectObject(s.cues()[0].object,true).length).toBeGreaterThan(0)
    if(phase<2) { const to=s.target(); expect(to[0]).toBeGreaterThan(20); expect(to[0]).toBeLessThan(width-20); expect(to[1]).toBeGreaterThan(20); expect(to[1]).toBeLessThan(370) }
    s.instance.dispose()
  }
})
it('releases the visible model, overlay and listeners on dispose', () => {
  const s=mount(), at=s.source(), dispose=vi.spyOn((s.scene.getObjectByName('brigid-reed-hit') as THREE.Mesh).geometry,'dispose')
  s.instance.dispose(); s.instance.dispose(); s.fire('pointerdown',at); s.fire('pointerup',at)
  expect(dispose).toHaveBeenCalledOnce(); expect(s.overlay.children).toHaveLength(0); expect(s.progress).not.toHaveBeenCalled(); expect(s.cues()).toEqual([])
})
it('releases each light and a real owned shadow target once', () => {
  const s=mount(), lights:THREE.Light[]=[]
  s.scene.traverse(object=>{if(object instanceof THREE.Light)lights.push(object)})
  const releases=lights.map(light=>vi.spyOn(light,'dispose'))
  const key=lights.find(light=>light instanceof THREE.DirectionalLight) as THREE.DirectionalLight
  const shadow=new THREE.WebGLRenderTarget(2,2), shadowRelease=vi.spyOn(shadow,'dispose');key.shadow.map=shadow
  s.instance.dispose();s.instance.dispose()
  for(const release of releases)expect(release).toHaveBeenCalledOnce()
  expect(shadowRelease).toHaveBeenCalledOnce();expect(s.scene.children).toHaveLength(0)
})
it('rests its hanging loop on the actual peg after placement',()=>{
  const s=mount(2), cross=s.scene.getObjectByName('brigid-cross')!
  const hook=s.scene.getObjectByName('brigid-hang-target')!.getWorldPosition(new THREE.Vector3())
  const loop=cross.localToWorld(new THREE.Vector3(0,.98,0))
  expect(loop.y).toBeCloseTo(hook.y)
})
it.each([1,2])('keeps the complete cross clear of the worktop at phase %i',phase=>{
  const s=mount(phase), cross=s.scene.getObjectByName('brigid-cross')!
  const bounds=new THREE.Box3().setFromObject(cross)
  expect(bounds.min.y).toBeGreaterThan(.35)
})
