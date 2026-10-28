// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as shared from '@wbr/shared'
import * as gestures from '@wbr/gestures'
import { createTurkishNazarBead } from './scene'
import type { SceneInstance } from '../contract'

const draw = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  return { ...actual, WebGLRenderer: class {
    domElement: HTMLCanvasElement; shadowMap = { enabled: false, type: 0 }
    constructor({canvas}: {canvas: HTMLCanvasElement}) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  } }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({ createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
  draw.scene = scene; draw.camera = camera
  return { setStyle() {}, resize() {}, render() {}, dispose() {} }
} }))
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); document.body.replaceChildren() })
function mount(initialProgress = 0) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 408 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 408 }) as DOMRect
  const progress: number[] = [], complete = vi.fn(); overlay.addEventListener('scene:complete', complete)
  const instance = createTurkishNazarBead({ canvas, overlay, shared, gestures, initialProgress, isSoundEnabled: () => false,
    onProgress: value => progress.push(value) }); instances.push(instance); instance.start(); instance.update(.025)
  const scene = draw.scene as THREE.Scene, camera = draw.camera as THREE.Camera
  const charm = scene.getObjectByName('nazar-charm')!, layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const project = (point: THREE.Vector3): [number, number] => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const p = point.clone().project(camera); return [(p.x+1)*195,(1-p.y)*204] }
  const source = () => project(charm.localToWorld(new THREE.Vector3(0,-.04,.11)))
  const goal = () => project(charm.parent!.localToWorld(new THREE.Vector3(.37,.98,.53)))
  const event = (type: string, xy: [number,number], id=1, extra={}) => {
    const e = new Event(type,{ bubbles:true,cancelable:true }); Object.assign(e,{clientX:xy[0],clientY:xy[1],pointerId:id,pointerType:'touch',button:0,...extra}); layer.dispatchEvent(e)
  }
  const run = () => { for(let i=0;i<80;i++) instance.update(.025) }
  return { instance, overlay, layer, charm, progress, complete, source, goal, event, run }
}
describe('one continuous nazar pickup and hang', () => {
  it.each([0,1,2])('goes directly from old checkpoint %i to the final support without intermediate stops', at => {
    const s=mount(at), from=s.source(), to=s.goal(); s.event('pointerdown',from)
    s.event('pointermove',[from[0]+20,from[1]-30]); s.event('pointermove',to); s.event('pointerup',to); s.run()
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.charm.position.toArray()).toEqual([.37,1.02,.42])
  })
  it('keeps an off-target released object available for re-grabbing, without saving', () => {
    const s=mount(), from=s.source(); s.event('pointerdown',from)
    s.event('pointermove',[from[0],from[1]-45]); const lifted=s.charm.position.clone()
    s.event('pointerup',[from[0],from[1]-45]); s.run()
    expect(s.charm.position.distanceTo(lifted)).toBeLessThan(1e-8); expect(s.progress).toEqual([])
    const next=s.source(), goal=s.goal(); s.event('pointerdown',next); s.event('pointermove',goal); s.event('pointerup',goal); s.run()
    expect(s.progress).toEqual([3])
  })
  it('allows inspection in both directions without counting a rotation as progress', () => {
    const s=mount(), from=s.source(); s.event('pointerdown',from)
    s.event('pointerdown',[from[0]+25,from[1]],2)
    for(let i=1;i<=8;i++) s.event('pointermove',[from[0]+25+i*24,from[1]],2)
    expect(s.charm.quaternion.angleTo(new THREE.Quaternion())).toBeGreaterThan(.1)
    expect(s.progress).toEqual([]); s.event('pointercancel',[from[0]+200,from[1]],2)
    expect(s.charm.position.toArray()).toEqual([-.95,.46,.42]); expect(s.charm.quaternion.angleTo(new THREE.Quaternion())).toBeLessThan(1e-8)
  })
  it('offers one auxiliary placement instead of requiring three button activations', () => {
    const s=mount(); s.overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click(); s.run()
    expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
  })
})
