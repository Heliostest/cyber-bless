// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import { createToonSurfaces } from '../../../scene-runtime/src/toon-surfaces'
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
const gripAnchor: [number, number, number] = [0, 0, .09]
// Local points lie on the opaque paper or wooden grip.
const quietAnchor: [number, number, number] = [0, 1.6, .28]
const targetName = (at: number) => at === 0 ? 'ebru-comb-grip' : at === 1 ? 'ebru-paper-edge' : 'ebru-paper-print'
const anchor = (at: number): [number, number, number] => at === 0 ? gripAnchor : at === 1 ? [0, .021, -.05] : quietAnchor
const delta = (at: number): [number, number] => at === 0 ? [60, 0] : [0, -60]
function drag(s: ReturnType<typeof mount>, at: number, dx: number, dy: number, run = true) {
  const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
  event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); if (run) s.run()
}
function step(s: ReturnType<typeof mount>, at: number, run = true) {
  if (at < 2) drag(s, at, ...delta(at), run)
  else { const p = s.point(targetName(at), anchor(at)); event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', p) }
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
function observeAudioHardware() {
  const observed = { contexts: 0, starts: 0 }
  class AudioBoundary {
    state = 'running'; currentTime = 0; destination = {}
    constructor() { observed.contexts++ }
    close() { return Promise.resolve() }
    createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(next: unknown) { return next } } }
    createOscillator() { return { type: 'sine', frequency: { setValueAtTime() {} }, connect(gain: { connect(next: unknown): unknown }) { return gain }, start() { observed.starts++ }, stop() {} } }
  }
  vi.stubGlobal('AudioContext', AudioBoundary)
  return observed
}

describe('original floating pigment transferred to actual paper', () => {
  it.each([284, 390, 1280])('can lift from the visible paper face across its width and depth at %ipx', width => {
    for (const [x, z] of [[-1.25, .70], [1.25, .70], [-1.25, -.70], [1.25, -.70], [0, .65], [0, 0]]) {
      const s = mount(1, {}, width), sheet = s.scene.getObjectByName('ebru-paper-blank') as THREE.Mesh
      const location = new THREE.Vector3(x, .45, z), p = s.point(sheet.name, location.toArray() as [number, number, number])
      expect(first(s, sheet.localToWorld(location)).object).toBe(sheet)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + 8, p[1] - 30])
      const positions = sheet.geometry.getAttribute('position')
      expect(Math.max(...Array.from({ length: positions.count }, (_, i) => positions.getY(i)))).toBeGreaterThan(.9)
      expect(s.progress).toEqual([])
      event(s.hit, 'pointermove', [p[0] + 12, p[1] - 60]); event(s.hit, 'pointerup', [p[0] + 12, p[1] - 60]); s.run()
      expect(s.progress).toEqual([2]); expect(s.haptic).toHaveBeenCalledOnce(); expect(s.complete).not.toHaveBeenCalled()
      s.instance.dispose()
    }
  })
  it('does not start peeling from the rim or through an object covering the paper', () => {
    const s = mount(1, { isReducedMotion: () => true }), point = s.point('ebru-paper-blank', [0, .45, .70])
    const rim = s.point('ebru-rim-end-1')
    event(s.hit, 'pointerdown', rim); event(s.hit, 'pointermove', [rim[0], rim[1] - 60]); event(s.hit, 'pointerup', [rim[0], rim[1] - 60])
    const blocker = new THREE.Mesh(new THREE.PlaneGeometry(.85, .85), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    blocker.position.lerpVectors(new THREE.Vector3(0, .45, .70), s.camera.position, .15); blocker.quaternion.copy(s.camera.quaternion); s.scene.add(blocker)
    event(s.hit, 'pointerdown', point); event(s.hit, 'pointermove', [point[0], point[1] - 60]); event(s.hit, 'pointerup', [point[0], point[1] - 60])
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
    blocker.removeFromParent(); blocker.geometry.dispose(); blocker.material.dispose()
    event(s.hit, 'pointerdown', point); event(s.hit, 'pointermove', [point[0], point[1] - 60]); event(s.hit, 'pointerup', [point[0], point[1] - 60])
    expect(s.progress).toEqual([2])
  })
  it('starts with real floating pigment and blank paper without reporting progress', () => {
    const s = mount()
    expect(s.scene?.getObjectByName('ebru-floating-pattern')).toBeDefined()
    expect(s.scene?.getObjectByName('ebru-paper-print')).toBeDefined()
    expect(s.button?.style.minWidth).toBe('44px'); expect(s.button?.style.minHeight).toBe('44px')
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('deforms pigment with the comb, clears the comb, contacts paper before enabling its identical print', () => {
    const s = mount(), water = s.scene.getObjectByName('ebru-floating-pattern') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, print = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    const data = () => Array.from((water.material.map!.image as { data: Uint8Array }).data)
    const initial = data(), p = s.point(targetName(0), anchor(0)), comb = s.scene.getObjectByName('ebru-comb')!, home = comb.position.clone()
    expect(print.material.map).toBeNull()
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + 60, p[1]])
    expect(comb.position.x - home.x).toBeGreaterThan(1); expect(data()).not.toEqual(initial); expect(print.material.map).toBeNull()
    event(s.hit, 'pointerup', [p[0] + 60, p[1]]); expect(s.progress).toEqual([])
    for (let i = 0; i < 38; i++) {
      s.instance.update(.025)
      if (print.material.map) {
        const position = print.geometry.getAttribute('position')
        for (let n = 0; n < position.count; n++) expect(position.getY(n)).toBeCloseTo(.45, 5)
        expect(comb.position.y).toBeGreaterThan(.65)
      }
    }
    expect(s.progress).toEqual([1]); expect(print.material.map).toBe(water.material.map)
    const waterUV = water.geometry.getAttribute('uv'), paperUV = print.geometry.getAttribute('uv')
    expect(Array.from(paperUV.array)).toEqual(Array.from(waterUV.array))
    const transferred = data(); step(s, 1); expect(data()).toEqual(transferred); expect(print.material.map).toBe(water.material.map)
    expect(s.scene.getObjectByName('ebru-paper-edge')!.position.y).toBeGreaterThan(2)
    step(s, 2); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('renders transferred pigment through the actual cached soft-toon adapter without coplanar water', () => {
    const s = mount(0, { isReducedMotion: () => true }), adapter = createToonSurfaces('toon-soft')
    const print = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, water = s.scene.getObjectByName('ebru-floating-pattern') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    adapter.apply(s.scene).restore()
    step(s, 0); step(s, 1)
    const frame = adapter.apply(s.scene)
    expect(print.material.map === water.material.map).toBe(true)
    frame.restore(); adapter.dispose()
    const contact = mount(1), bath = contact.scene.getObjectByName('ebru-floating-pattern')!
    expect(bath.visible).toBe(false)
  })
  it('peels from the front while the far part of the actual sheet remains in contact', () => {
    const s = mount(1), p = s.point(targetName(1), anchor(1)), sheet = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh
    const cue = cues(s)[0]!.cue, original = [...cue.anchor!]
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0], p[1] - 30])
    const position = sheet.geometry.getAttribute('position'), uv = sheet.geometry.getAttribute('uv')
    expect(cue.anchor![1]).toBeGreaterThan(.9)
    expect(cue.anchor).not.toEqual(original)
    for (let i = 0; i < position.count; i++) {
      if (uv.getY(i) === 1) expect(position.getY(i)).toBeCloseTo(.45, 5)
      if (uv.getY(i) === 0) expect(position.getY(i)).toBeGreaterThan(.9)
      if (uv.getX(i) === .5 && uv.getY(i) === .125) {
        expect(new THREE.Vector3(...cue.anchor!).distanceTo(new THREE.Vector3().fromBufferAttribute(position, i))).toBeLessThan(1e-7)
      }
    }
    expect(s.progress).toEqual([])
  })
  it.each([0, 1])('freezes accepted motion while inactive and ends at the identical reduced-motion pose at %i', at => {
    let active = true; const s = mount(at, { isActive: () => active }); step(s, at, false)
    expect(s.button.disabled).toBe(true); expect(s.hit.style.pointerEvents).toBe('none'); s.instance.update(.05)
    const sheet = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh, position = Array.from(sheet.geometry.getAttribute('position').array)
    active = false; const frames = rendered.render.mock.calls.length; s.run(); expect(s.progress).toEqual([]); expect(Array.from(sheet.geometry.getAttribute('position').array)).toEqual(position); expect(rendered.render.mock.calls.length).toBe(frames)
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
    const reduced = mount(at, { isReducedMotion: () => true }); step(reduced, at)
    expect(Array.from((reduced.scene.getObjectByName('ebru-paper-print') as THREE.Mesh).geometry.getAttribute('position').array)).toEqual(Array.from(sheet.geometry.getAttribute('position').array))
  })
  it('disposes both underside materials and their shared pigment texture exactly once after contact', () => {
    const s = mount(0, { isReducedMotion: () => true }), print = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, before = print.material, firstDispose = vi.fn()
    before.addEventListener('dispose', firstDispose); step(s, 0)
    const afterDispose = vi.fn(), textureDispose = vi.fn(); print.material.addEventListener('dispose', afterDispose); print.material.map!.addEventListener('dispose', textureDispose)
    s.instance.dispose(); s.instance.dispose()
    expect(firstDispose).toHaveBeenCalledOnce(); expect(afterDispose).toHaveBeenCalledOnce(); expect(textureDispose).toHaveBeenCalledOnce()
  })
  it.each([false, true])('restores each checkpoint silently with matching reduced-motion final poses, reduced=%s', reduced => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => reduced, returning: true })
      expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled(); expect(s.overlay.querySelector('input,form')).toBeNull()
      const print = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
      expect(!!print.material.map).toBe(at > 0)
      expect(cues(s).map(x => x.cue.kind)).toEqual(at < 2 ? ['drag'] : at === 2 ? ['tap'] : [])
      for (let n = at; n < 3; n++) { s.button.click(); s.run() }
      expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); s.instance.dispose()
    }
  })
  it.each([284, 350, 1280])('fits all subject vertices and keeps actual nearest opaque cue surfaces at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width)
      s.scene.getObjectByName('ebru-subject')!.traverse(o => {
        const m = o as THREE.Mesh; if (!m.geometry) return
        for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible) return
        const pos = m.geometry.getAttribute('position'), p = new THREE.Vector3()
        for (let n = 0; n < pos.count; n++) {
          p.fromBufferAttribute(pos, n).applyMatrix4(m.matrixWorld).project(s.camera)
          expect(Math.max(Math.abs(p.x), Math.abs(p.y)), m.name).toBeLessThan(.97)
        }
      })
      for (const { object, cue } of cues(s)) expect(first(s, object.localToWorld(new THREE.Vector3(...cue.anchor!))).object?.name).toBe(object.name)
      if (at < 3) step(s, at); expect(s.progress).toEqual(at < 3 ? [at + 1] : []); s.instance.dispose()
    }
  })
  it.each([0, 1])('rejects wrong start, orphan release, reverse, short, cross-axis and backtracked input at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at), end: [number, number] = [p[0] + dx, p[1] + dy]
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    event(s.hit, 'pointerup', end)
    for (const [x, y] of [[dx / 8, dy / 8], [-dx, -dy], [-dy, dx]]) drag(s, at, x, y)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each(['pause', 'blur', 'pointercancel', 'lostpointercapture'])('restores partially manipulated paper and pigment on %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }), print = s.scene.getObjectByName('ebru-paper-print') as THREE.Mesh, comb = s.scene.getObjectByName('ebru-comb')!, home = comb.position.clone(), sheet = Array.from(print.geometry.getAttribute('position').array), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2])
      if (kind === 'pause') { active = false; s.instance.update(.025) } else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); expect(s.progress).toEqual([]); expect(comb.position.distanceTo(home)).toBeLessThan(.00001); expect(Array.from(print.geometry.getAttribute('position').array)).toEqual(sheet)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025); step(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it('saves only an explicit trimmed wish exactly once and never a quiet draft', () => {
    const s = mount(2, { isReducedMotion: () => true }), input = s.overlay.querySelector<HTMLInputElement>('input')!
    input.value = '  愿心安宁  '; input.dispatchEvent(new Event('input', { bubbles: true })); s.overlay.querySelector('form')!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿心安宁'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    s.button.click(); expect(s.saveWish).toHaveBeenCalledOnce()
    const quiet = mount(2); const draft = quiet.overlay.querySelector<HTMLInputElement>('input')!; draft.value = 'unsent'; draft.dispatchEvent(new Event('input', { bubbles: true })); step(quiet, 2); expect(quiet.saveWish).not.toHaveBeenCalled()
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
  it.each(['prepareFeedback', 'onProgress', 'haptic'] as const)('suppresses stale audio and completion after %s briefly crosses a lifecycle boundary', callback => {
    for (const boundary of ['pause', 'blur']) for (const at of [0, 1, 2]) {
      const audio = observeAudioHardware(), progress: number[] = []; let active = true, crossBoundary = () => {}, haptics = 0
      const s = mount(at, {
        isReducedMotion: () => true, isActive: () => active, isSoundEnabled: () => true,
        prepareFeedback: () => { if (callback === 'prepareFeedback') crossBoundary() },
        onProgress: n => { progress.push(n); if (callback === 'onProgress') crossBoundary() },
        haptic: () => { haptics++; if (callback === 'haptic') crossBoundary() },
      })
      crossBoundary = () => {
        if (boundary === 'pause') { active = false; s.instance.update(0); active = true; s.instance.update(0) }
        else { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) }
      }
      s.button.click()
      expect(progress, `${callback} ${boundary} at ${at}`).toEqual(callback === 'prepareFeedback' ? [] : [at + 1])
      expect(haptics, `${callback} ${boundary} at ${at}`).toBe(callback === 'haptic' ? 1 : 0)
      expect(audio.starts, `${callback} ${boundary} at ${at}`).toBe(0)
      if (callback === 'prepareFeedback') expect(audio.contexts, `${boundary} at ${at}`).toBe(0)
      expect(s.complete).not.toHaveBeenCalled()
      crossBoundary = () => {}; s.instance.update(.025)
      if (callback === 'prepareFeedback' || at < 2) { s.button.click(); expect(audio.starts).toBe(2) }
      else { s.button.click(); expect(progress).toEqual([3]); expect(s.complete).not.toHaveBeenCalled() }
      s.instance.dispose()
    }
  })
  it.each(['pause', 'blur'])('keeps an explicit wish committed once but suppresses stale feedback after save crosses %s', boundary => {
    const audio = observeAudioHardware(); let active = true
    const s = mount(2, { isReducedMotion: () => true, isActive: () => active, isSoundEnabled: () => true })
    s.saveWish.mockImplementation(() => {
      if (boundary === 'pause') { active = false; s.instance.update(0); active = true; s.instance.update(0) }
      else { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) }
    })
    const input = s.overlay.querySelector<HTMLInputElement>('input')!, form = input.form!
    input.value = '  日常安好  '; input.dispatchEvent(new Event('input', { bubbles: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('日常安好'); expect(s.progress).toEqual([3])
    expect(s.haptic).not.toHaveBeenCalled(); expect(audio.starts).toBe(0); expect(s.complete).not.toHaveBeenCalled()
    s.instance.update(.025); s.button.click(); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(s.saveWish).toHaveBeenCalledOnce(); expect(s.progress).toEqual([3]); expect(s.overlay.querySelector('form')).toBeNull(); expect(s.complete).not.toHaveBeenCalled()
  })
  it('rejects multitouch and tap backtracking', () => {
    const s = mount(0, { isReducedMotion: () => true }), p = s.point(targetName(0), anchor(0))
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0] + 60, p[1]]); event(s.hit, 'pointerup', [p[0] + 60, p[1]]); event(s.hit, 'pointerup', [1, 1], 2)
    expect(s.progress).toEqual([]); step(s, 0); step(s, 1)
    const q = s.point(targetName(2), anchor(2)); event(s.hit, 'pointerdown', q); event(s.hit, 'pointermove', [q[0] + 18, q[1]]); event(s.hit, 'pointerup', q); expect(s.progress).toEqual([1, 2]); step(s, 2); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress'] as const)('stops after %s pauses or disposes the scene', callback => {
    for (const mode of ['pause', 'dispose']) {
      let active = true, destroy = () => {}; const s = mount(0, { isReducedMotion: () => true, isActive: () => active, [callback]: () => { if (mode === 'pause') active = false; else destroy() } })
      destroy = () => s.instance.dispose(); const frames = rendered.render.mock.calls.length; s.button.click(); s.instance.update(.1); s.button.click(); expect(rendered.render.mock.calls.length).toBe(frames)
      if (mode === 'dispose') expect(s.overlay.childElementCount).toBe(0); s.instance.dispose()
    }
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
    const s = mount(2), resources = new Set<THREE.BufferGeometry | THREE.Material>(), cued: THREE.Object3D[] = []
    s.scene.traverse(o => { if (o.userData.interactionCues?.length) cued.push(o); const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const p = s.point(targetName(2), anchor(2)), release = vi.fn(); s.hit.releasePointerCapture = release; event(s.hit, 'pointerdown', p)
    const renderer = rendered.renderer as THREE.WebGLRenderer, frames = rendered.render.mock.calls.length; s.instance.dispose(); s.instance.dispose(); s.button.click(); event(s.hit, 'pointerup', p); s.instance.start(); s.instance.update(10)
    expect(release).toHaveBeenCalledExactlyOnceWith(1); expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled(); expect(rendered.render.mock.calls.length).toBe(frames)
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true); expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce()
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); for (const o of cued) expect(o.userData.interactionCues).toEqual([])
  })
})

it.each([0, 1])('accepts a deliberate release when the browser coalesces all move events, phase=%i', at => {
  const s = mount(at, { isReducedMotion: () => true }); const p = s.point(targetName(at), anchor(at)); const [dx, dy] = delta(at);
  event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]);
  expect(s.progress).toEqual([at + 1]);
});
