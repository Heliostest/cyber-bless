// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
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
function finish(s: ReturnType<typeof mount>) { return s.overlay.querySelector<HTMLButtonElement>('.scene-continuous-finish')! }


const sidePoint = (s: ReturnType<typeof mount>, side: number) => s.point('cast-shell-upper-' + side, [0,.30,.30])
const pivot = (s: ReturnType<typeof mount>, side: number) => s.scene.getObjectByName('cast-pivot-' + side)!
function tapSide(s: ReturnType<typeof mount>, side: number) {
  const p = sidePoint(s, side); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p)
}
const rightButton = (s: ReturnType<typeof mount>) => s.overlay.querySelector<HTMLButtonElement>('.scene-castanets-right')

describe('Responsive castanet handling', () => {
  it('shows distinct left and right action labels on the native free-play buttons', () => {
    const s = mount(2), right = rightButton(s)!
    expect(s.button.textContent).toBe('左壳轻合'); expect(right.textContent).toBe('右壳回应')
    expect(s.button.querySelector('.scene-helper-label')).toBeNull(); expect(right.querySelector('.scene-helper-label')).toBeNull()
    s.button.click(); right.click()
    expect(s.button.textContent).toBe('左壳轻合'); expect(right.textContent).toBe('右壳回应')
  })
  it('keeps a focused side button enabled through each contact callback', () => {
    let readFocus = () => {}; const s = mount(2, { haptic: () => readFocus() }), right = rightButton(s)!
    let remainedFocused = false
    right.focus(); readFocus = () => { remainedFocused = document.activeElement === right && !right.disabled }
    right.click(); expect(remainedFocused).toBe(true); expect(document.activeElement).toBe(right)
    right.click(); expect(remainedFocused).toBe(true)
  })
  it('plays a synthesized wood contact exactly at a chosen rim contact, respecting mute and disposal', () => {
    const contacts: number[][] = [], buffers: Float32Array[] = []; let closed = 0, muted = false, s: ReturnType<typeof mount>
    class AudioBoundary {
      state = 'running'; currentTime = 0; destination = {}; sampleRate = 8000
      close() { closed++; return Promise.resolve() }
      createBuffer(_channels: number, length: number) { const samples = new Float32Array(length); buffers.push(samples); return { getChannelData() { return samples } } }
      createGain() { return { gain: { setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {}, disconnect() {} } }
      createBufferSource() { return { buffer: null, connect() {}, disconnect() {}, start() { contacts.push([pivot(s,0).rotation.x,pivot(s,1).rotation.x]) }, stop() {} } }
    }
    vi.stubGlobal('AudioContext', AudioBoundary)
    s = mount(2, { isSoundEnabled: () => !muted })
    const p = sidePoint(s,1); event(s.hit,'pointerdown',p); event(s.hit,'pointermove',[p[0],p[1]+30])
    expect(contacts).toEqual([])
    event(s.hit,'pointerup',[p[0],p[1]+60]); expect(contacts).toHaveLength(1); expect(contacts[0]![0]).toBe(-.55); expect(contacts[0]![1]).toBeCloseTo(0)
    expect(buffers[0]?.some(sample => Math.abs(sample) > .001)).toBe(true)
    s.instance.update(.025); tapSide(s,0); expect(contacts).toHaveLength(2); expect(contacts[1]![0]).toBeCloseTo(0)
    muted = true; tapSide(s,1); expect(contacts).toHaveLength(2)
    s.instance.dispose(); s.instance.dispose(); expect(closed).toBe(1)
  })
  it('closes only the chosen pair at release and accepts fast alternating beats during spring reopening', () => {
    const s = mount(2)
    tapSide(s, 1)
    expect(pivot(s, 1).rotation.x).toBeCloseTo(0, 8)
    expect(pivot(s, 0).rotation.x).toBe(-.55)
    expect(s.haptic).toHaveBeenCalledTimes(1)
    expect(s.button.disabled).toBe(false); expect(s.hit.style.pointerEvents).toBe('auto')
    s.instance.update(.025)
    expect(pivot(s, 1).rotation.x).toBeLessThan(0)
    expect(pivot(s, 1).rotation.x).toBeGreaterThan(-.55)
    tapSide(s, 0)
    expect(pivot(s, 0).rotation.x).toBeCloseTo(0, 8)
    const right = pivot(s, 1).rotation.x
    tapSide(s, 0) // Retrigger without waiting for either pair to finish animating.
    expect(pivot(s, 1).rotation.x).toBe(right)
    for (let i = 0; i < 12; i++) { s.instance.update(.025); tapSide(s, i % 2) }
    expect(s.haptic).toHaveBeenCalledTimes(15)
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled()
    s.run(.5); expect(pivot(s, 0).rotation.x).toBe(-.55); expect(pivot(s, 1).rotation.x).toBe(-.55)
  })
  it('lets a held squeeze preview one shell and contacts only after a valid release', () => {
    const s = mount(2), p = sidePoint(s, 1)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0], p[1] + 35])
    expect(pivot(s, 1).rotation.x).toBeGreaterThan(-.4)
    expect(pivot(s, 1).rotation.x).toBeLessThan(0)
    expect(pivot(s, 0).rotation.x).toBe(-.55)
    s.run(.4); expect(s.haptic).not.toHaveBeenCalled()
    event(s.hit, 'pointerup', [p[0], p[1] + 60])
    expect(pivot(s, 1).rotation.x).toBeCloseTo(0, 8); expect(s.haptic).toHaveBeenCalledTimes(1)
  })
  it.each([false, true])('keeps checkpoints and explicit finish while allowing independent side buttons, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced })
    expect(finish(s).hidden).toBe(true)
    s.button.click(); expect(s.progress).toEqual([1])
    s.button.click(); expect(s.progress).toEqual([1, 2])
    const right = rightButton(s); expect(right).not.toBeNull(); expect(right?.hidden).toBe(false)
    for (const button of [s.button, right!]) {
      expect(button.type).toBe('button'); expect(button.style.minWidth).toBe('44px'); expect(button.style.minHeight).toBe('44px')
    }
    for (let i=0;i<20;i++) { right!.click(); s.button.click() }
    expect(s.progress).toEqual([1, 2]); expect(s.complete).not.toHaveBeenCalled()
    finish(s).click(); finish(s).click(); s.run()
    expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledTimes(1)
    expect(s.saveWish).not.toHaveBeenCalled(); expect(s.button.hidden).toBe(true); expect(right?.hidden).toBe(true)
    if (reduced) { expect(pivot(s, 0).rotation.x).toBe(-.55); expect(pivot(s, 1).rotation.x).toBe(-.55) }
  })
  it('prevents a double-click tail from skipping the second guided action', () => {
    const s = mount(0, { isReducedMotion: () => true })
    s.button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    s.button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
    expect(s.progress).toEqual([1]); s.button.click(); expect(s.progress).toEqual([1, 2])
  })
  it('consumes the guided right-button click sequence before accepting native free-play repeats', () => {
    const s = mount(1)
    s.button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 1 }))
    s.button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail: 2 }))
    expect(s.progress).toEqual([2]); expect(s.haptic).toHaveBeenCalledTimes(1)
    expect(pivot(s,0).rotation.x).toBe(-.55); expect(pivot(s,1).rotation.x).toBeCloseTo(0)
    // A new native sequence belongs to the stable left free-play button.
    for (const detail of [1,2,3]) s.button.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
    expect(s.haptic).toHaveBeenCalledTimes(4)
    // The stable right button also retains rapid native repeats.
    for (const detail of [1,2,3]) rightButton(s)!.dispatchEvent(new MouseEvent('click', { bubbles: true, detail }))
    expect(s.haptic).toHaveBeenCalledTimes(7); expect(s.progress).toEqual([2]); expect(s.complete).not.toHaveBeenCalled()
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels a squeeze on %s without sound, progress or a stale held pose', kind => {
    let active = true; const s = mount(0, { isActive: () => active }), p = sidePoint(s, 0)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0], p[1]+30])
    expect(pivot(s, 0).rotation.x).toBeGreaterThan(-.55)
    if (kind === 'pause') { active = false; s.instance.update(.025) }
    else if (kind === 'blur') window.dispatchEvent(new Event('blur'))
    else event(s.hit, kind, p)
    event(s.hit, 'pointerup', [p[0], p[1]+60])
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(pivot(s, 0).rotation.x).toBe(-.55)
    active = true; if (kind === 'blur') window.dispatchEvent(new Event('focus'))
    s.instance.update(0); tapSide(s, 0); expect(s.progress).toEqual([1])
  })
  it('cancels a second pointer anywhere on the page, then permits a fresh alternating rhythm', () => {
    const s = mount(2), p = sidePoint(s, 0), r = sidePoint(s, 1)
    event(s.hit, 'pointerdown', p); event(document.body, 'pointerdown', r, 2)
    event(s.hit, 'pointerup', p); event(document.body, 'pointerup', r, 2)
    expect(s.haptic).not.toHaveBeenCalled(); expect(pivot(s, 0).rotation.x).toBe(-.55)
    tapSide(s, 1); tapSide(s, 0); expect(s.haptic).toHaveBeenCalledTimes(2)
  })
  it.each(['reverse', 'cross', 'withdrawn', 'nan'])('rejects %s squeezes, including terminal coordinates', kind => {
    const s = mount(0), p = sidePoint(s, 0)
    event(s.hit, 'pointerdown', p)
    if (kind === 'nan') event(s.hit, 'pointermove', [NaN,p[1]])
    else event(s.hit, 'pointermove', [p[0],p[1]+60])
    const end: [number,number] = kind === 'reverse' ? [p[0],p[1]-60] : kind === 'cross' ? [p[0]+60,p[1]+60] : kind === 'withdrawn' ? p : [p[0],p[1]+60]
    event(s.hit, 'pointerup', end); s.run()
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    tapSide(s, 0); expect(s.progress).toEqual([1])
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i with the same open geometry and no replay', at => {
    const s = mount(at, { returning: true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(pivot(s, 0).rotation.x).toBe(-.55); expect(pivot(s, 1).rotation.x).toBe(-.55)
    if (at === 3) { tapSide(s, 0); s.button.click(); finish(s).click(); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled() }
  })
  it('retains independent touch targets on the lower shell and a padded upper-shell silhouette', () => {
    const s = mount(2)
    const p = s.point('cast-shell-lower-1', [.35,-.20,.40])
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p)
    expect(s.haptic).toHaveBeenCalledTimes(1); expect(pivot(s, 0).rotation.x).toBe(-.55)
    const upper = sidePoint(s, 0)
    event(s.hit, 'pointerdown', [upper[0]-12,upper[1]]); event(s.hit, 'pointerup', [upper[0]-12,upper[1]])
    expect(s.haptic).toHaveBeenCalledTimes(2)
  })
  it('rejects a side hidden by an opaque object', () => {
    const s = mount(2), blocker = new THREE.Mesh(new THREE.PlaneGeometry(1,1), new THREE.MeshBasicMaterial({side:THREE.DoubleSide}))
    blocker.position.lerpVectors(s.scene.getObjectByName('cast-shell-upper-1')!.localToWorld(new THREE.Vector3(0,.30,.30)),s.camera.position,.15)
    blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker); tapSide(s, 1)
    expect(s.haptic).not.toHaveBeenCalled(); blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose()
    tapSide(s, 1); expect(s.haptic).toHaveBeenCalledTimes(1)
  })
  it.each([284, 390, 1280])('keeps both independent poses rigid, threaded and inside the camera at width %i', width => {
    const s = mount(2, {}, width), shells = ['cast-shell-upper-0','cast-shell-upper-1'].map(n => s.scene.getObjectByName(n) as THREE.Mesh)
    const vertices = shells.map(m => Array.from(m.geometry.getAttribute('position').array))
    for (let i=0;i<10;i++) {
      tapSide(s, i%2); s.instance.update(.025)
      s.scene.getObjectByName('cast-subject')!.traverse(o => {
        const mesh = o as THREE.Mesh; if (!mesh.geometry) return
        const a = mesh.geometry.getAttribute('position'), p = new THREE.Vector3()
        for (let j=0;j<a.count;j++) {
          p.fromBufferAttribute(a,j).applyMatrix4(mesh.matrixWorld).project(s.camera)
          expect(Math.max(Math.abs(p.x),Math.abs(p.y)),mesh.name).toBeLessThan(.97)
        }
      })
      shells.forEach((m,k) => expect(Array.from(m.geometry.getAttribute('position').array)).toEqual(vertices[k]))
    }
  })
  it.each(['prepareFeedback', 'onProgress', 'haptic'] as const)('blocks reentry from %s and stops feedback after a pause/resume callback', callback => {
    let active = true, attack = () => {}; const saved: number[] = []
    const s = mount(0, { isReducedMotion: () => true, isActive: () => active, [callback]: () => attack(), onProgress: n => { saved.push(n); if (callback === 'onProgress') attack() } })
    attack = () => { s.button.click(); tapSide(s, 0); s.instance.update(100) }
    s.button.click(); expect(saved).toEqual([1]); s.button.click(); expect(saved).toEqual([1, 2])
    const terminal = vi.fn(); s.overlay.addEventListener('scene:complete',terminal)
    // Completion must be invalidated even if a host immediately resumes.
    attack = () => { active = false; s.instance.update(0); active = true; s.instance.update(0) }
    finish(s).click(); expect(terminal).not.toHaveBeenCalled()
  })
  it('stops after disposal during contact and releases retained handlers exactly once', () => {
    let destroy = () => {}; const s = mount(0, { haptic: () => destroy() }), release = vi.fn()
    s.hit.releasePointerCapture = release; destroy = () => s.instance.dispose()
    const p = sidePoint(s,0)
    tapSide(s, 0); s.instance.dispose(); s.button.click(); event(s.hit,'pointerup',p)
    expect(s.overlay.childElementCount).toBe(0); expect(s.progress).toEqual([1]); expect(s.complete).not.toHaveBeenCalled(); expect(release).toHaveBeenCalledExactlyOnceWith(1)
  })
})
