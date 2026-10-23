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
  overlay.classList.add('scene-overlay-host'); host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const variants: string[] = [], progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at < 4 ? 0 : at < 6 ? 1 : at === 6 ? 2 : 3, initialVariant: `bojagi-step-${at}`, onVariantChange: v => variants.push(v),
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
  return { instance, scene, camera, host, overlay, hit, button, point, run, variants, progress, saveWish, complete, haptic }
}
function event(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0 }); el.dispatchEvent(e)
}

const sources = ['bojagi-near-corner', 'bojagi-far-corner', 'bojagi-left-corner', 'bojagi-right-corner', 'bojagi-band-left-tip', 'bojagi-band-right-tip']
const progressAfter = [[], [], [], [1], [1], [1, 2], [1, 2, 3]]
function cue(s: ReturnType<typeof mount>) {
  const list: { object: THREE.Object3D; cue: InteractionCue }[] = []
  s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) list.push({ object, cue }) })
  expect(list).toHaveLength(1); return list[0]!
}
function points(s: ReturnType<typeof mount>): { from: [number, number]; to: [number, number] } {
  const item = cue(s), destination = item.cue.destination!
  const world = typeof destination === 'function' ? destination() : destination.getWorldPosition(new THREE.Vector3())
  const q = world.project(s.camera), rect = s.host.querySelector('canvas')!.getBoundingClientRect()
  return { from: s.point(item.object.name, item.cue.anchor), to: [rect.left + (q.x + 1) * rect.width / 2, rect.top + (1 - q.y) * rect.height / 2] }
}
function move(s: ReturnType<typeof mount>, from: [number, number], to: [number, number]) {
  event(s.hit, 'pointerdown', from)
  for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [from[0] + (to[0] - from[0]) * i / 8, from[1] + (to[1] - from[1]) * i / 8])
}
function drop(s: ReturnType<typeof mount>, settle = true) { const { from, to } = points(s); move(s, from, to); event(s.hit, 'pointerup', to); if (settle) s.run() }
function positions(s: ReturnType<typeof mount>, name = 'bojagi-cloth') { return Array.from((s.scene.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position').array) }
function worldPoint(s: ReturnType<typeof mount>, p: [number, number, number]): [number, number] { return s.point('bojagi-subject', p) }

describe('six spatial cloth operations', () => {
  it.each([0, 1, 2, 3])('accepts cloth coverage away from a single destination point at fold %i', stage => {
    const s = mount(stage, { isReducedMotion: () => true }, 1280), { from, to } = points(s)
    const covered = worldPoint(s, [stage === 3 ? -.20 : .20, .85, stage === 1 ? -.16 : .16])
    expect(Math.hypot(covered[0] - to[0], covered[1] - to[1])).toBeGreaterThan(22)
    move(s, from, covered); expect(s.variants).toEqual([]); event(s.hit, 'pointerup', covered)
    expect(s.variants).toEqual([`bojagi-step-${stage + 1}`])
  })
  it('rejects a nearby screen point when the actual cloth corner is outside the parcel coverage', () => {
    const s = mount(0, { isReducedMotion: () => true }, 284), { from, to } = points(s), outside: [number, number] = [to[0], to[1] + 21]
    move(s, from, outside); event(s.hit, 'pointerup', outside)
    expect(s.variants).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
  })
  it('accepts an actual band crossing away from the former point target', () => {
    const s = mount(4, { isReducedMotion: () => true }, 1280), { from } = points(s), crossed = worldPoint(s, [.28, .85, .02])
    move(s, from, crossed); event(s.hit, 'pointerup', crossed)
    expect(s.variants).toEqual(['bojagi-step-5'])
  })
  it('rejects a band laid beside the other strip without overlap', () => {
    const s = mount(4, { isReducedMotion: () => true }), { from } = points(s), beside = worldPoint(s, [.28, .85, .42])
    move(s, from, beside); event(s.hit, 'pointerup', beside)
    expect(s.variants).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
  })
  it('keeps the knot loose when moving inward or pulling only a little', () => {
    const s = mount(5, { isReducedMotion: () => true }), { from, to } = points(s), home = positions(s, 'bojagi-band-left')
    const inward: [number, number] = [from[0] - (to[0] - from[0]) * .5, from[1] - (to[1] - from[1]) * .5]
    move(s, from, inward); expect(positions(s, 'bojagi-band-left')).toEqual(home); event(s.hit, 'pointerup', inward)
    const short: [number, number] = [from[0] + (to[0] - from[0]) * .3, from[1] + (to[1] - from[1]) * .3]
    move(s, from, short); event(s.hit, 'pointerup', short)
    expect(s.variants).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(positions(s, 'bojagi-band-left')).toEqual(home)
  })
  it.each([284, 320, 390, 1280])('does not tighten by taking the right tail across to the opposite lower edge at %ipx', width => {
    const s = mount(5, { isReducedMotion: () => true }, width), { from } = points(s)
    const rect = s.host.querySelector('canvas')!.getBoundingClientRect(), opposite: [number, number] = [rect.left + 5, rect.top + rect.height - 5]
    move(s, from, opposite); event(s.hit, 'pointerup', opposite)
    expect(s.variants).toEqual([]); expect(s.haptic).not.toHaveBeenCalled()
  })
  it('tightens along an outward pull and accepts the tightened knot away from a fixed endpoint', () => {
    const s = mount(5, { isReducedMotion: () => true }, 1280), { from } = points(s)
    const loose = positions(s, 'bojagi-band-left'), outward = worldPoint(s, [1.22, .59, -.03])
    move(s, from, outward); expect(positions(s, 'bojagi-band-left')).not.toEqual(loose)
    event(s.hit, 'pointerup', outward); expect(s.variants).toEqual(['bojagi-step-6']); expect(s.haptic).toHaveBeenCalledWith('heavy')
  })
  it.each([false, true])('requires six distinct drops before a separate manual finish, reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced })
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.overlay.querySelector('form')).toBeNull()
    for (let stage = 0; stage < 6; stage++) {
      expect(cue(s).object.name).toBe(sources[stage]); expect(cue(s).cue.destination).toBeDefined()
      const geometry = positions(s, stage < 4 ? 'bojagi-cloth' : 'bojagi-band-left'); drop(s)
      expect(s.progress).toEqual(progressAfter[stage]); expect(s.variants).toEqual(Array.from({ length: stage + 1 }, (_, n) => `bojagi-step-${n + 1}`))
      expect(positions(s, stage < 4 ? 'bojagi-cloth' : 'bojagi-band-left')).not.toEqual(geometry); expect(s.complete).not.toHaveBeenCalled()
    }
    expect(s.haptic.mock.calls.map(([strength]) => strength)).toEqual(['medium', 'medium', 'medium', 'medium', 'medium', 'heavy'])
    expect(s.button.textContent).toContain('完成'); expect(s.overlay.querySelector('input')).toBeNull()
    s.button.click(); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    s.button.click(); event(s.hit, 'pointerup', [0, 0]); expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([0, 1, 2, 3, 4, 5])('accepts a correctly picked up operation with only down and up samples %i', stage => {
    const s = mount(stage, { isReducedMotion: () => true }), { from, to } = points(s)
    event(s.hit, 'pointerdown', from); event(s.hit, 'pointerup', to)
    expect(s.variants).toEqual([`bojagi-step-${stage + 1}`])
  })
  it.each([0, 1, 2, 3, 4, 5])('only accepts a moved, correctly picked up and released operation %i', stage => {
    const s = mount(stage, { isReducedMotion: () => true }), { from, to } = points(s), wrong: [number, number] = stage === 5 ? [from[0] - (to[0] - from[0]) * .5, from[1] - (to[1] - from[1]) * .5] : [from[0] + 80, from[1] + 70]
    event(s.hit, 'pointerup', to)
    move(s, from, wrong); event(s.hit, 'pointerup', wrong)
    move(s, from, to); event(s.hit, 'pointermove', from); event(s.hit, 'pointerup', from)
    move(s, [18, 92], to); event(s.hit, 'pointerup', to)
    expect(s.variants).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); drop(s); expect(s.variants).toEqual([`bojagi-step-${stage + 1}`])
  })
  it.each([0, 1, 2, 3, 4, 5])('rechecks geometry at release rather than keeping stale readiness at operation %i', stage => {
    const s = mount(stage, { isReducedMotion: () => true }), { from, to } = points(s)
    move(s, from, to); event(s.hit, 'pointerup', from)
    expect(s.variants).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); drop(s); expect(s.variants).toEqual([`bojagi-step-${stage + 1}`])
  })
  it.each([0, 1, 2, 3])('accepts a finger pickup on the active continuous cloth within its visible 44px cue at %i', stage => {
    const s = mount(stage, { isReducedMotion: () => true }), { from, to } = points(s), length = Math.hypot(to[0] - from[0], to[1] - from[1])
    const cloth: [number, number] = [from[0] + (to[0] - from[0]) * 12 / length, from[1] + (to[1] - from[1]) * 12 / length]
    move(s, cloth, to); event(s.hit, 'pointerup', to)
    expect(s.variants).toEqual([`bojagi-step-${stage + 1}`])
  })
  it('brings the finished parcel closer after the open cloth has been gathered', () => {
    const open = mount(0), closed = mount(6)
    const width = (s: typeof open) => {
      const left = s.point('bojagi-parcel', [-.5, 0, 0]), right = s.point('bojagi-parcel', [.5, 0, 0]); return Math.hypot(right[0] - left[0], right[1] - left[1])
    }
    expect(width(closed)).toBeGreaterThan(width(open) * 1.25)
  })
  it.each([0, 1, 2, 3, 4, 5])('moves the actual grip under the pointer before releasing operation %i', stage => {
    const s = mount(stage), { from, to } = points(s), item = cue(s); move(s, from, to)
    expect(s.variants).toEqual([]); const grip = s.point(item.object.name, item.cue.anchor)
    expect(Math.hypot(grip[0] - to[0], grip[1] - to[1])).toBeLessThan(8); s.instance.update(0)
    expect(s.host.querySelector('.scene-cue-guide')?.textContent).toContain('松手')
    event(s.hit, 'pointerup', to); expect(s.button.disabled).toBe(true); s.run(); expect(s.variants).toEqual([`bojagi-step-${stage + 1}`])
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause', 'multitouch'])('restores partial cloth and bands on %s', boundary => {
    for (let stage = 0; stage < 6; stage++) {
      let active = true; const s = mount(stage, { isActive: () => active }), home = positions(s), band = positions(s, 'bojagi-band-left'), { from, to } = points(s)
      move(s, from, [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2])
      if (boundary === 'pause') { active = false; s.instance.update(0) }
      else if (boundary === 'blur') window.dispatchEvent(new Event('blur'))
      else if (boundary === 'multitouch') { event(s.hit, 'pointerdown', [20, 100], 2); event(s.hit, 'pointerup', [20, 100], 2) }
      else event(s.hit, boundary, from)
      event(s.hit, 'pointerup', to); s.run(); expect(s.variants).toEqual([]); expect(positions(s)).toEqual(home); expect(positions(s, 'bojagi-band-left')).toEqual(band)
      if (boundary === 'blur') window.dispatchEvent(new Event('focus'))
      active = true; s.instance.update(0); drop(s); expect(s.variants).toEqual([`bojagi-step-${stage + 1}`]); s.instance.dispose()
    }
  })
  it.each([0, 1, 2, 3, 4, 5, 6, 7])('silently restores operation state %i with integer checkpoint compatibility', stage => {
    const s = mount(stage, { returning: true, isReducedMotion: () => true }), normal = mount(0, { isReducedMotion: () => true }); for (let n = 0; n < stage; n++) normal.button.click()
    expect(positions(s)).toEqual(positions(normal)); expect(positions(s, 'bojagi-band-right')).toEqual(positions(normal, 'bojagi-band-right'))
    expect(s.variants).toEqual([]); expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.overlay.querySelector('form')).toBeNull()
  })
  it.each([[0, 0], [1, 4], [2, 6], [3, 7]])('restores legacy progress %i without requiring a variant', (progress, stage) => {
    const legacy = mount(0, { initialProgress: progress, initialVariant: undefined }), modern = mount(stage)
    expect(positions(legacy)).toEqual(positions(modern)); expect(positions(legacy, 'bojagi-band-left')).toEqual(positions(modern, 'bojagi-band-left'))
  })
  it.each([284, 350, 1280])('keeps all six grips first opaque and destinations inside a %ipx frame', width => {
    for (let stage = 0; stage < 6; stage++) {
      const s = mount(stage, {}, width), item = cue(s), { from, to } = points(s), q = item.object.localToWorld(new THREE.Vector3(...(item.cue.anchor ?? [0, 0, 0]))).project(s.camera), ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(q.x, q.y), s.camera)
      const meshes: THREE.Object3D[] = []; s.scene.traverseVisible(o => { const m = o as THREE.Mesh; if (m.isMesh && (Array.isArray(m.material) ? m.material : [m.material]).some(mat => mat.visible && (!mat.transparent || mat.opacity >= 1))) meshes.push(o) })
      expect(ray.intersectObjects(meshes, false)[0]?.object.name, `operation ${stage}`).toBe(item.object.name)
      for (const p of [from, to]) { expect(p[0]).toBeGreaterThan(17); expect(p[0]).toBeLessThan(17 + width); expect(p[1]).toBeGreaterThan(91); expect(p[1]).toBeLessThan(91 + (width === 1280 ? 600 : width === 284 ? 390 : 408)) }
      s.instance.dispose()
    }
  })
  it.each(['prepareFeedback', 'haptic', 'onProgress', 'onVariantChange'] as const)('blocks synchronous %s from skipping operations', callback => {
    let attack = () => {}; const variants: string[] = [], progress: number[] = []
    const s = mount(0, { isReducedMotion: () => true, [callback]: () => attack(), onProgress: n => { progress.push(n); if (callback === 'onProgress') attack() }, onVariantChange: v => { variants.push(v); if (callback === 'onVariantChange') attack() } }); attack = () => { s.button.click(); s.instance.update(100) }
    for (let stage = 0; stage < 7; stage++) { s.button.click(); expect(variants).toEqual(Array.from({ length: stage + 1 }, (_, n) => `bojagi-step-${n + 1}`)); expect(progress).toEqual(progressAfter[stage]) }; expect(s.complete).toHaveBeenCalledOnce()
  })
  it('plays real feedback tones only while the live sound setting is enabled and closes its audio context once', () => {
    const audio = { contexts: 0, starts: 0, closes: 0 }
    class AudioBoundary {
      state = 'running'; currentTime = 0; destination = {}
      constructor() { audio.contexts++ }
      close() { audio.closes++; return Promise.resolve() }
      createGain() { return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect(next: unknown) { return next } } }
      createOscillator() { return { type: 'sine', frequency: { setValueAtTime() {} }, connect(gain: { connect(next: unknown): unknown }) { return gain }, start() { audio.starts++ }, stop() {} } }
    }
    vi.stubGlobal('AudioContext', AudioBoundary)
    let sound = true; const s = mount(0, { isReducedMotion: () => true, isSoundEnabled: () => sound })
    expect(audio.contexts).toBe(0); s.button.click(); expect(audio.contexts).toBe(1); expect(audio.starts).toBe(2)
    sound = false; s.button.click(); expect(audio.starts).toBe(2)
    sound = true; s.button.click(); expect(audio.starts).toBe(4)
    s.instance.dispose(); s.instance.dispose(); expect(audio.closes).toBe(1)
  })
  it('freezes accepted settlement during pause and resumes exactly once', () => {
    let active = true; const s = mount(0, { isActive: () => active }); drop(s, false); s.instance.update(.025); const home = positions(s); active = false; s.run(); expect(positions(s)).toEqual(home); expect(s.variants).toEqual([]); active = true; s.run(); expect(s.variants).toEqual(['bojagi-step-1']); expect(s.haptic).toHaveBeenCalledOnce()
  })
  it.each([false, true])('preserves the manipulated cloth and band geometry on resize, settling=%s', settling => {
    let resize = () => {}
    vi.stubGlobal('ResizeObserver', class { constructor(callback: () => void) { resize = callback } observe() {} disconnect() {} })
    const s = mount(), { from, to } = points(s); move(s, from, to)
    if (settling) { event(s.hit, 'pointerup', to); s.instance.update(.025) }
    const cloth = positions(s), band = positions(s, 'bojagi-band-near')
    resize(); expect(positions(s)).toEqual(cloth); expect(positions(s, 'bojagi-band-near')).toEqual(band); expect(s.variants).toEqual([])
    if (!settling) event(s.hit, 'pointerup', points(s).to)
    s.run(); expect(s.variants).toEqual(['bojagi-step-1'])
  })
  it('retains patchwork through real toon adapter and disposes the shared texture once', () => {
    const s = mount(0, { isReducedMotion: () => true }), cloth = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, texture = cloth.material.map, adapter = createToonSurfaces('toon-soft')
    for (let stage = 0; stage < 6; stage++) { const frame = adapter.apply(s.scene); expect(cloth.material.map).toBe(texture); expect(frame.outlined.filter(m => /^bojagi-(weft|warp)-/.test(m.name))).toHaveLength(0); frame.restore(); s.button.click() }; adapter.dispose(); const freed = vi.fn(); texture!.addEventListener('dispose', freed); s.instance.dispose(); s.instance.dispose(); expect(freed).toHaveBeenCalledOnce()
  })
  it('keeps the original connected sheet and every ribbon sewn onto its corner through all six operations', () => {
    const s = mount(0, { isReducedMotion: () => true }), cloth = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh
    const geometry = cloth.geometry, uv = geometry.getAttribute('uv'), index = geometry.index!, graph = Array.from({ length: uv.count }, () => new Set<number>())
    for (let n = 0; n < index.count; n += 3) for (let j = 0; j < 3; j++) { const a = index.getX(n + j), b = index.getX(n + (j + 1) % 3); graph[a]!.add(b); graph[b]!.add(a) }
    const seen = new Set([0]), queue = [0]; while (queue.length) for (const n of graph[queue.pop()!]!) if (!seen.has(n)) { seen.add(n); queue.push(n) }
    expect(seen.size).toBe(uv.count)
    const corners = [[1, 1], [0, 0], [0, 1], [1, 0]], bands = ['near', 'far', 'left', 'right'].map(n => s.scene.getObjectByName(`bojagi-band-${n}`) as THREE.Mesh), originals = bands.map(b => b.geometry)
    const check = () => {
      expect(cloth.geometry).toBe(geometry)
      for (let n = 0; n < bands.length; n++) {
        const band = bands[n]!, p = band.geometry.getAttribute('position'), buv = band.geometry.getAttribute('uv'), start = new THREE.Vector3(), end = new THREE.Vector3()
        expect(band.geometry).toBe(originals[n])
        for (let i = 0; i < buv.count; i++) if (buv.getX(i) === 0) start.add(new THREE.Vector3().fromBufferAttribute(p, i))
        start.multiplyScalar(.5)
        for (let i = 0; i < uv.count; i++) if (uv.getX(i) === corners[n]![0] && uv.getY(i) === corners[n]![1]) end.fromBufferAttribute(geometry.getAttribute('position'), i)
        expect(start.distanceTo(end), band.name).toBeLessThan(.012)
      }
    }
    check(); for (let stage = 0; stage < 6; stage++) { const { from, to } = points(s); move(s, from, to); check(); event(s.hit, 'pointerup', to); check() }
  })
  it('keeps cloth triangle interiors outside the parcel along the four folding paths', () => {
    const s = mount(0, { isReducedMotion: () => true }), cloth = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3()
    const check = () => {
      const positions = cloth.geometry.getAttribute('position'), indices = cloth.geometry.index!
      let worst = 0
      for (let n = 0; n < indices.count; n += 3) {
        a.fromBufferAttribute(positions, indices.getX(n)); b.fromBufferAttribute(positions, indices.getX(n + 1)); c.fromBufferAttribute(positions, indices.getX(n + 2))
        for (const weights of [[.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3]]) {
          p.copy(a).multiplyScalar(weights[0]!).addScaledVector(b, weights[1]!).addScaledVector(c, weights[2]!)
          worst = Math.max(worst, Math.min(.485 - Math.abs(p.x), .485 - Math.abs(p.z), p.y - .115, .69 - p.y))
        }
      }
      expect(worst).toBeLessThan(.002)
    }
    check(); for (let stage = 0; stage < 4; stage++) { const { from, to } = points(s); event(s.hit, 'pointerdown', from); for (let n = 1; n <= 4; n++) { event(s.hit, 'pointermove', [from[0] + (to[0] - from[0]) * n / 4, from[1] + (to[1] - from[1]) * n / 4]); check() }; event(s.hit, 'pointerup', to); check() }
  })
  it('rejects stale variants inconsistent with integer legacy checkpoints', () => {
    const wrong = mount(0, { initialProgress: 1, initialVariant: 'bojagi-step-2' }), legacy = mount(4)
    expect(positions(wrong)).toEqual(positions(legacy)); expect(cue(wrong).object.name).toBe('bojagi-band-left-tip')
  })
  it('releases captured input and all GPU resources exactly once', () => {
    const s = mount(), resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>()
    s.scene.traverse(o => { const mesh = o as THREE.Mesh; if (mesh.geometry) resources.add(mesh.geometry); for (const material of Array.isArray(mesh.material) ? mesh.material : mesh.material ? [mesh.material] : []) resources.add(material) })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const { from, to } = points(s), release = vi.fn(); s.hit.releasePointerCapture = release; event(s.hit, 'pointerdown', from)
    const renderer = rendered.renderer as THREE.WebGLRenderer; s.instance.dispose(); s.instance.dispose(); s.button.click(); event(s.hit, 'pointerup', to)
    expect(release).toHaveBeenCalledExactlyOnceWith(1); expect(s.variants).toEqual([]); expect([...freed.values()]).toHaveLength(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull()
  })
})
