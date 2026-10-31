// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from './contract'
import { loadScene } from './registry'
const frames = vi.hoisted(() => ({ count: 0, late: 0 }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement; shadowMap = { enabled: false, type: 0 }
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    let disposed = false
    return { setStyle() {}, resize() {}, render() { frames.count++; if (disposed) frames.late++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() { disposed = true } }
  },
}))
const ids = ['tanzaku-tanabata','crane','lantern','yeondeunghoe','celtic-folk-spring','shinto-torii','furin-wind-chime','omamori-cycle','votive-candle-catholic','milagros','clootie-well-rag','tibetan-wheel'] as const
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(value => value.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); frames.count = frames.late = 0 })
async function mount(id: string, progress = 2, overrides: Partial<SceneContext> = {}) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  overlay.className = 'scene-overlay-host'; host.append(canvas,overlay); document.body.append(host)
  Object.defineProperties(canvas,{clientWidth:{value:390},clientHeight:{value:560}})
  canvas.getBoundingClientRect=()=>({left:0,top:0,width:390,height:560}) as DOMRect
  const complete=vi.fn(), onProgress=vi.fn(), saveWish=vi.fn(); overlay.addEventListener('scene:complete',complete)
  const module=await loadScene(id), instance=module.create({canvas,overlay,gestures:Gestures,shared:Shared,sceneId:id,initialProgress:progress,isSoundEnabled:()=>false,onProgress,saveWish,...overrides})
  instances.push(instance); instance.start(); instance.update(0)
  const run=(seconds:number)=>{for(let i=0;i<Math.round(seconds*40);i++)instance.update(.025)}
  return {instance,overlay,complete,onProgress,saveWish,run}
}
describe.each(ids)('%s authored automatic ending', id => {
  it('completes its restored quiet phase without a final tap and does not complete twice',async()=>{
    const s=await mount(id); s.run(2.4); expect(s.complete).not.toHaveBeenCalled()
    s.run(1.6); expect(s.complete).toHaveBeenCalledOnce(); expect(s.onProgress).toHaveBeenCalledExactlyOnceWith(3)
    expect(s.saveWish).not.toHaveBeenCalled(); s.run(5); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('freezes during host pause and resumes the remaining animation',async()=>{
    let active=true; const s=await mount(id,2,{isActive:()=>active}); s.run(1); active=false; s.run(5)
    expect(s.complete).not.toHaveBeenCalled(); active=true; s.run(1); expect(s.complete).not.toHaveBeenCalled()
    s.run(2); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('supports a brief reduced-motion ending without creating a returning wish',async()=>{
    const s=await mount(id,2,{isReducedMotion:()=>true,returning:true}); s.run(.4); expect(s.complete).not.toHaveBeenCalled()
    s.run(.4); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('keeps an already completed save silent, including during start',async()=>{
    const s=await mount(id,3); s.run(5)
    expect(s.complete).not.toHaveBeenCalled(); expect(s.onProgress).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('cancels the ending on disposal',async()=>{
    const s=await mount(id); s.run(.5); s.instance.dispose(); s.run(6)
    expect(s.complete).not.toHaveBeenCalled(); expect(s.onProgress).not.toHaveBeenCalled(); expect(frames.late).toBe(0)
  })
  it('does not render or emit completion after a host callback disposes it',async()=>{
    let dispose=()=>{}; const s=await mount(id,2,{onProgress(n){if(n===3)dispose()}}); dispose=()=>s.instance.dispose(); s.run(4)
    expect(s.complete).not.toHaveBeenCalled(); expect(frames.late).toBe(0)
  })
})
it('preserves a native short-slip draft until an explicit submission',async()=>{
  const s=await mount('tanzaku-tanabata'), input=s.overlay.querySelector<HTMLInputElement>('input')!
  input.value='愿家人平安'; input.dispatchEvent(new Event('input',{bubbles:true})); s.run(5)
  expect(s.complete).not.toHaveBeenCalled(); expect(input.value).toBe('愿家人平安')
  input.form!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))
  expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿家人平安'); expect(s.complete).toHaveBeenCalledOnce()
})

// Keep the real writer and quiet-ending helper: host callbacks may synchronously
// unmount the scene or dispatch another submit before the first callback returns.
describe.each(['tanzaku-tanabata','crane','celtic-folk-spring','shinto-torii','lantern'])('%s native writer lifecycle', id => {
  it('stops after a save callback synchronously disposes the scene',async()=>{
    let dispose=()=>{}
    const saveWish=vi.fn(()=>dispose())
    const s=await mount(id,id==='lantern'?1:2,{saveWish})
    dispose=()=>s.instance.dispose()
    const input=s.overlay.querySelector<HTMLInputElement>('input')!
    input.value='愿家人平安'
    const rendered=frames.count
    input.form!.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))
    s.run(5)
    expect(saveWish).toHaveBeenCalledExactlyOnceWith('愿家人平安')
    expect(s.onProgress).not.toHaveBeenCalled(); expect(s.complete).not.toHaveBeenCalled()
    expect(frames.count).toBe(rendered); expect(frames.late).toBe(0)
    expect(s.overlay.childElementCount).toBe(0)
  })

  it('saves and completes once if the host reenters the native submit handler',async()=>{
    let repeat=()=>{}, repeated=false
    const saveWish=vi.fn(()=>{if(!repeated){repeated=true;repeat()}})
    const s=await mount(id,id==='lantern'?1:2,{saveWish})
    const input=s.overlay.querySelector<HTMLInputElement>('input')!
    input.value='愿家人平安'
    const form=input.form!
    repeat=()=>{form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}))}
    repeat(); s.run(4)
    expect(saveWish).toHaveBeenCalledExactlyOnceWith('愿家人平安')
    expect(s.onProgress.mock.calls.map(([step])=>step)).toEqual(id==='lantern'?[2,3]:[3])
    expect(s.complete).toHaveBeenCalledOnce(); expect(frames.late).toBe(0)
  })
})
