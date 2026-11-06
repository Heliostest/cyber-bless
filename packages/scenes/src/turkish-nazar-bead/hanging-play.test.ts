// @vitest-environment jsdom
import * as THREE from 'three'
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as shared from '@wbr/shared'
import * as gestures from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createTurkishNazarBead } from './scene'
import { createRomanianMartisor } from '../romanian-martisor/scene'

// Geometry, raycasts and pointer ownership stay real; only GPU rendering is replaced.
const draw = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  return { ...actual, WebGLRenderer: class {
    domElement: HTMLCanvasElement; shadowMap = { enabled: false, type: 0 }
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  } }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({ createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
  draw.scene = scene; draw.camera = camera
  return { setStyle() {}, resize() {}, render() {}, dispose() {} }
} }))
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(instance => instance.dispose()); document.body.replaceChildren(); vi.unstubAllGlobals() })
const cases = [
  { name: 'nazar', create: createTurkishNazarBead, actor: 'nazar-charm', target: 'nazar-glass-eye', anchor: [0,-.04,.11], contact: [0,.7955,0], support: [.37,1.8155,.42] },
  { name: 'martisor', create: createRomanianMartisor, actor: 'martisor-cord', target: 'martisor-red-head', anchor: [0,0,0], contact: [0,.208,0], support: [.55,1.555,-.05] },
] as const
function mount(kind: typeof cases[number], initialProgress = 0, extra: Partial<SceneContext> = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: 390 }, clientHeight: { value: 408 } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 390, height: 408 }) as DOMRect
  const progress: number[] = [], complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = kind.create({ canvas, overlay, shared, gestures, initialProgress, isSoundEnabled: () => false,
    onProgress: value => progress.push(value), haptic, ...extra }); instances.push(instance); instance.start(); instance.update(.025)
  const scene = draw.scene as THREE.Scene, camera = draw.camera as THREE.Camera
  const actor = scene.getObjectByName(kind.actor)!, layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const project = (point: THREE.Vector3): [number,number] => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); const p=point.clone().project(camera); return [(p.x+1)*195,(1-p.y)*204] }
  const source = () => project(scene.getObjectByName(kind.target)!.localToWorld(new THREE.Vector3(...kind.anchor)))
  const goal = () => {
    let destination: THREE.Vector3 | undefined
    scene.traverse(o => { for (const cue of o.userData.interactionCues ?? []) if (cue.kind === 'drag' && cue.enabled()) destination = cue.destination() })
    return project(destination!)
  }
  const event = (type: string, xy: [number,number], id=1, target: HTMLElement=layer, extra={}) => {
    const e=new Event(type,{bubbles:true,cancelable:true}); Object.assign(e,{clientX:xy[0],clientY:xy[1],pointerId:id,pointerType:'touch',button:0,...extra}); target.dispatchEvent(e)
  }
  const run = (seconds=.7) => { for(let t=0;t<seconds;t+=.025) instance.update(.025) }
  const inspect = () => { button.click(); run(); button.click(); run() }
  const hang = () => { inspect(); const from=source(), to=goal(); event('pointerdown',from); event('pointermove',to); event('pointerup',to); run() }
  const support = () => { scene.updateMatrixWorld(true); return actor.localToWorld(new THREE.Vector3(...kind.contact)) }
  const flick = () => { const p=source(); event('pointerdown',p); event('pointerup',p) }
  return { instance, overlay, actor, camera, layer, button, source, goal, event, run, inspect, hang, progress, complete, haptic, support, flick }
}
describe.each(cases)('$name hanging play', kind => {
  it('describes touch controls on the hanging and completed action', () => {
    const s=mount(kind,2)
    expect(s.button.title).not.toMatch(/方向键|Enter|Esc/)
    expect(s.button.title).toContain('单指')
    s.button.click()
    expect(s.button.title).not.toMatch(/方向键|Enter|Esc/)
  })
  it('hangs at checkpoint 2 without completing, then accepts a separate explicit finish once', () => {
    const s=mount(kind); s.hang()
    expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled(); expect(s.button.disabled).toBe(false)
    s.button.click(); s.button.click(); s.run()
    expect(s.progress).toEqual([2,3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.button.hidden).toBe(true)
  })
  it('keeps repeated flicks and turns supported by the actual peg or branch', () => {
    const s=mount(kind); s.hang(); const home=s.actor.quaternion.clone(), support=new THREE.Vector3(...kind.support)
    s.flick(); s.run(.08); expect(s.actor.quaternion.angleTo(home)).toBeGreaterThan(.005)
    expect(s.support().distanceTo(support)).toBeLessThan(1e-7)
    const moving=s.actor.quaternion.clone(); s.flick(); s.run(.08)
    expect(s.actor.quaternion.angleTo(moving)).toBeGreaterThan(.002)
    const p=s.source(); s.event('pointerdown',p); s.event('pointermove',[p[0]+26,p[1]+3]); s.event('pointerup',[p[0]+26,p[1]+3])
    expect(s.support().distanceTo(support)).toBeLessThan(1e-7)
    expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
  })
  it('offers repeatable flick and keyboard adjustment alternatives with reduced motion', () => {
    const s=mount(kind,2,{isReducedMotion:()=>true}), home=s.actor.quaternion.clone()
    const flick=s.overlay.querySelector<HTMLButtonElement>('.scene-hanging-flick')!
    expect(flick).not.toBeNull(); expect(flick.style.minHeight).toBe('44px')
    flick.click(); flick.click(); s.run(1)
    expect(s.haptic).toHaveBeenCalledTimes(2); expect(s.actor.quaternion.angleTo(home)).toBeLessThan(1e-7)
    s.button.dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowRight',bubbles:true,cancelable:true}))
    expect(s.actor.quaternion.angleTo(home)).toBeGreaterThan(.05)
    expect(s.support().distanceTo(new THREE.Vector3(...kind.support))).toBeLessThan(1e-7)
    expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([3])
  })
  it('accepts rapid auxiliary flicks while keeping finish unavailable to a held finger', () => {
    const s=mount(kind,2), flick=s.overlay.querySelector<HTMLButtonElement>('.scene-hanging-flick')!
    flick.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:1}))
    flick.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:2}))
    expect(s.haptic).toHaveBeenCalledTimes(2)
    const p=s.source(); s.event('pointerdown',p); s.button.click(); flick.click()
    expect(s.progress).toEqual([]); expect(s.haptic).toHaveBeenCalledTimes(2)
    s.event('pointercancel',p); s.button.click(); expect(s.progress).toEqual([3])
  })
  it('keeps the accepted placement gesture tail from operating the finish action', () => {
    const s=mount(kind,0,{isReducedMotion:()=>true}); s.inspect()
    const p=s.source(), goal=s.goal(); s.event('pointerdown',p); s.event('pointermove',goal); s.run()
    s.button.click(); s.event('pointermove',p)
    expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
    s.event('pointerup',p); s.button.click(); expect(s.progress).toEqual([2,3])
  })
  it('restores hung and completed saves silently without replaying inspection or awards', () => {
    for(const initial of [2,3]) {
      const s=mount(kind,initial); s.run(10)
      expect(s.support().distanceTo(new THREE.Vector3(...kind.support))).toBeLessThan(1e-7)
      expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
      expect(s.button.hidden).toBe(initial===3)
      if(initial===3) { s.flick(); s.button.click(); s.run(); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled() }
    }
  })
  it.each(['pointercancel','second-pointer','blur','pause','resize'])('cancels post-hang adjustment on %s without moving its support', kindOfCancel => {
    let active=true, resize=()=>{}
    vi.stubGlobal('ResizeObserver',class { constructor(callback:()=>void){resize=callback} observe(){} disconnect(){} })
    const s=mount(kind,2,{isActive:()=>active}), home=s.actor.quaternion.clone(), p=s.source()
    s.event('pointerdown',p); s.event('pointermove',[p[0]+20,p[1]+4]); expect(s.actor.quaternion.angleTo(home)).toBeGreaterThan(.02)
    if(kindOfCancel==='blur') window.dispatchEvent(new Event('blur'))
    else if(kindOfCancel==='pause') { active=false; s.instance.update(.025) }
    else if(kindOfCancel==='resize') resize()
    else if(kindOfCancel==='second-pointer') s.event('pointerdown',[1,1],2,document.body)
    else s.event('pointercancel',p)
    s.event('pointerup',p); s.event('pointerup',[1,1],2,document.body); s.run()
    expect(s.actor.quaternion.angleTo(home)).toBeLessThan(1e-7)
    expect(s.support().distanceTo(new THREE.Vector3(...kind.support))).toBeLessThan(1e-7)
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    if(kindOfCancel==='blur') window.dispatchEvent(new Event('focus'))
  })
  it('does not let the placement button double-click finish its new hanging state', () => {
    const s=mount(kind,0,{isReducedMotion:()=>true}); s.inspect(); s.button.click()
    s.button.dispatchEvent(new MouseEvent('click',{bubbles:true,detail:2})); s.run()
    expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
    s.button.click(); expect(s.progress).toEqual([2,3])
  })
  it('stops feedback/completion after a finishing callback pauses or disposes', () => {
    for(const dispose of [false,true]) {
      let active=true, stop=()=>{}
      const s=mount(kind,2,{isActive:()=>active,onProgress:()=>{if(dispose)stop();else active=false}}); stop=()=>s.instance.dispose()
      s.button.click(); s.run(); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    }
  })
})
