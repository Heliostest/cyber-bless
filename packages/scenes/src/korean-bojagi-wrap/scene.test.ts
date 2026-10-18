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
const gripAnchor: [number, number, number] = [0, .012, 0]
// Local points lie on the sewn corner, band tip, and actual folded cloth wall.
const quietAnchor: [number, number, number] = [.031098, .452587, .590862]
const targetName = (at: number) => at === 0 ? 'bojagi-near-corner' : at === 1 ? 'bojagi-band-right-tip' : 'bojagi-cloth'
const anchor = (at: number): [number, number, number] => at === 0 ? gripAnchor : at === 1 ? [0, .012, 0] : quietAnchor
const delta = (at: number): [number, number] => at === 0 ? [0, -60] : [60, 0]
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

describe('continuous patchwork cloth around a real parcel', () => {
  it('provides a connected cloth and sewn corners with no entry side effects', () => {
    const s = mount()
    expect(s.scene?.getObjectByName('bojagi-cloth')).toBeDefined()
    expect(s.scene?.getObjectByName('bojagi-parcel')).toBeDefined()
    expect(s.button?.style.minWidth).toBe('44px'); expect(s.button?.style.minHeight).toBe('44px')
    expect(s.progress).toEqual([]); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('keeps one connected sheet, attached sewn ribbons, and reused geometry through both physical actions', () => {
    const s = mount(), sheet = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh
    const geometry = sheet.geometry, index = geometry.index!, uv = geometry.getAttribute('uv')
    const neighbors = Array.from({ length: uv.count }, () => new Set<number>())
    for (let i = 0; i < index.count; i += 3) for (let j = 0; j < 3; j++) {
      const a = index.getX(i + j), b = index.getX(i + (j + 1) % 3); neighbors[a].add(b); neighbors[b].add(a)
    }
    const visited = new Set([0]), queue = [0]
    while (queue.length) for (const next of neighbors[queue.pop()!]) if (!visited.has(next)) { visited.add(next); queue.push(next) }
    expect(visited.size).toBe(uv.count)
    const source = Array.from(geometry.getAttribute('position').array)
    const ribbons = ['near', 'far', 'left', 'right'].map(name => s.scene.getObjectByName(`bojagi-band-${name}`) as THREE.Mesh)
    const originals = ribbons.map(ribbon => ribbon.geometry)
    const cornerUV = [[1, 1], [0, 0], [0, 1], [1, 0]]
    const check = () => {
      const positions = geometry.getAttribute('position')
      for (const [n, ribbon] of ribbons.entries()) {
        expect(ribbon.geometry).toBe(originals[n])
        const p = ribbon.geometry.getAttribute('position'), ru = ribbon.geometry.getAttribute('uv')
        const start = new THREE.Vector3(), end = new THREE.Vector3(); let count = 0
        for (let i = 0; i < ru.count; i++) if (ru.getX(i) === 0) { start.add(new THREE.Vector3().fromBufferAttribute(p, i)); count++ }
        start.divideScalar(count)
        for (let i = 0; i < uv.count; i++) if (uv.getX(i) === cornerUV[n][0] && uv.getY(i) === cornerUV[n][1]) end.fromBufferAttribute(positions, i)
        expect(start.distanceTo(end), ribbon.name).toBeLessThan(.012)
      }
    }
    check()
    for (const at of [0, 1]) {
      const p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at); event(s.hit, 'pointerdown', p)
      for (let i = 1; i <= 8; i++) { event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8]); check() }
      expect(s.progress).toEqual(at ? [1] : [])
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); expect(s.progress).toEqual(at ? [1] : [])
      for (let i = 0; i < 40; i++) { s.instance.update(.025); check() }
      expect(s.progress).toEqual(at ? [1, 2] : [1])
    }
    expect(sheet.geometry).toBe(geometry); expect(Array.from(geometry.getAttribute('position').array)).not.toEqual(source)
  })
  it('keeps the cloth and its bands outside the parcel during the complete folding path', () => {
    const s = mount(), names = ['bojagi-cloth', 'bojagi-band-near', 'bojagi-band-far', 'bojagi-band-left', 'bojagi-band-right']
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3()
    const check = () => {
      let worst = 0, culprit = ''
      for (const name of names) {
        const mesh = s.scene.getObjectByName(name) as THREE.Mesh, positions = mesh.geometry.getAttribute('position'), indices = mesh.geometry.index!
        for (let n = 0; n < indices.count; n += 3) {
          a.fromBufferAttribute(positions, indices.getX(n)); b.fromBufferAttribute(positions, indices.getX(n + 1)); c.fromBufferAttribute(positions, indices.getX(n + 2))
          for (const weights of [[1, 0, 0], [0, 1, 0], [0, 0, 1], [.5, .5, 0], [0, .5, .5], [.5, 0, .5], [1 / 3, 1 / 3, 1 / 3]]) {
            p.copy(a).multiplyScalar(weights[0]).addScaledVector(b, weights[1]).addScaledVector(c, weights[2])
            const depth = Math.min(.493 - Math.abs(p.x), .493 - Math.abs(p.z), p.y - .11, .69 - p.y)
            if (depth > worst) { worst = depth; culprit = name }
          }
        }
      }
      expect(worst, culprit).toBeLessThan(.002)
    }
    check()
    for (const at of [0, 1]) {
      const p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at); event(s.hit, 'pointerdown', p)
      for (let i = 1; i <= 10; i++) { event(s.hit, 'pointermove', [p[0] + dx * i / 10, p[1] + dy * i / 10]); check() }
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); check()
    }
  })
  it('lets the tightened fabric tails sag beside the box while their sewn ends stay above the lid', () => {
    const s = mount(2), ribbon = s.scene.getObjectByName('bojagi-band-right') as THREE.Mesh
    const p = ribbon.geometry.getAttribute('position'), uv = ribbon.geometry.getAttribute('uv'), start = new THREE.Vector3(), end = new THREE.Vector3()
    for (let i = 0; i < uv.count; i++) { if (uv.getX(i) === 0) start.add(new THREE.Vector3().fromBufferAttribute(p, i)); if (uv.getX(i) === 1) end.add(new THREE.Vector3().fromBufferAttribute(p, i)) }
    start.multiplyScalar(.5); end.multiplyScalar(.5)
    expect(start.y).toBeGreaterThan(.70); expect(end.y).toBeLessThan(start.y - .15); expect(end.x).toBeGreaterThan(.6)
    const tip = s.scene.getObjectByName('bojagi-band-right-tip')!
    expect(tip.localToWorld(new THREE.Vector3(-.125, 0, 0)).distanceTo(end)).toBeLessThan(.03)
  })
  it('keeps cloth triangle interiors outside the actual rounded lid, including the far shoulder', () => {
    const s = mount(1), cloth = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh, lid = s.scene.getObjectByName('bojagi-parcel-lid') as THREE.Mesh
    const positions = cloth.geometry.getAttribute('position'), indices = cloth.geometry.index!
    const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), p = new THREE.Vector3()
    const down = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), up = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 1, 0))
    let deepest = 0, sample = ''
    for (let n = 0; n < indices.count; n += 3) {
      a.fromBufferAttribute(positions, indices.getX(n)); b.fromBufferAttribute(positions, indices.getX(n + 1)); c.fromBufferAttribute(positions, indices.getX(n + 2))
      for (const weights of [[.2, .8, 0], [.8, .2, 0], [0, .2, .8], [0, .8, .2], [.2, 0, .8], [.8, 0, .2], [1 / 3, 1 / 3, 1 / 3]]) {
        p.copy(a).multiplyScalar(weights[0]).addScaledVector(b, weights[1]).addScaledVector(c, weights[2])
        if (p.y < .64 || p.y > .701 || Math.max(Math.abs(p.x), Math.abs(p.z)) > .51) continue
        down.ray.origin.set(p.x, 1.2, p.z); up.ray.origin.set(p.x, .4, p.z)
        const top = down.intersectObject(lid)[0]?.point.y, bottom = up.intersectObject(lid)[0]?.point.y
        if (top !== undefined && bottom !== undefined && p.y > bottom && p.y < top) {
          const depth = Math.min(top - p.y, p.y - bottom)
          if (depth > deepest) { deepest = depth; sample = `triangle ${n / 3} at ${p.toArray()}` }
        }
      }
    }
    expect(deepest, sample).toBeLessThan(.00001)
  })
  it('renders patchwork and seams through the real soft toon adapter and keeps its texture identity after both actions', () => {
    const s = mount(0, { isReducedMotion: () => true }), cloth = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    const material = cloth.material, texture = material.map, adapter = createToonSurfaces('toon-soft')
    for (const at of [0, 1, 2]) {
      const frame = adapter.apply(s.scene); expect(cloth.material.map).toBe(texture); expect(cloth.material.side).toBe(THREE.DoubleSide)
      expect(frame.outlined.filter(mesh => /^bojagi-(weft|warp)-/.test(mesh.name))).toHaveLength(0)
      frame.restore(); expect(cloth.material).toBe(material); if (at < 2) step(s, at)
    }
    adapter.dispose()
    const freed = vi.fn(); texture!.addEventListener('dispose', freed); s.instance.dispose(); s.instance.dispose(); expect(freed).toHaveBeenCalledOnce()
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i and matches normal and reduced final geometry', checkpoint => {
    const restored = mount(checkpoint, { returning: true }), normal = mount(), reduced = mount(0, { isReducedMotion: () => true })
    expect(restored.progress).toEqual([]); expect(restored.haptic).not.toHaveBeenCalled(); expect(restored.complete).not.toHaveBeenCalled(); expect(restored.saveWish).not.toHaveBeenCalled()
    expect(restored.overlay.querySelector('form')).toBeNull()
    expect(cues(restored).map(x => x.cue.kind)).toEqual(checkpoint < 2 ? ['drag'] : checkpoint === 2 ? ['tap'] : [])
    for (let at = 0; at < checkpoint; at++) { step(normal, at); step(reduced, at) }
    for (const name of ['bojagi-cloth', 'bojagi-band-near', 'bojagi-band-left', 'bojagi-band-right']) {
      const positions = (s: typeof restored) => Array.from((s.scene.getObjectByName(name) as THREE.Mesh).geometry.getAttribute('position').array)
      expect(positions(normal), name).toEqual(positions(restored)); expect(positions(reduced), name).toEqual(positions(restored))
    }
  })
  it.each([0, 1])('rejects backtracking and cross travel supplied only by the terminal coordinates at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
    for (const end of [[p[0] + dx * .7, p[1] + dy * .7], [p[0] + dx + (dy ? 50 : 0), p[1] + dy + (dx ? 50 : 0)]]) {
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy]); event(s.hit, 'pointerup', end as [number, number]); expect(s.progress).toEqual([])
    }
    step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each([false, true])('accepts a fully folded pose after a long native touch drag, reduced=%s', reduced => {
    for (const width of [284, 320, 350]) {
      const s = mount(0, { isReducedMotion: () => reduced }, width), p = s.point(targetName(0), anchor(0))
      drag(s, 0, 0, -120); s.run()
      expect(s.progress, `canvas width ${width}`).toEqual([1]); expect(s.button.disabled).toBe(false)
      event(s.hit, 'pointerup', p); expect(s.progress).toEqual([1]); s.instance.dispose()
    }
  })
  it.each([false, true])('bounds the complete drag path and release coordinates on both axes, reduced=%s', reduced => {
    for (const at of [0, 1]) for (const bad of ['diagonal', 'cross-path', 'nonfinite-move', 'nan-release', 'infinite-release']) {
      const s = mount(at, { isReducedMotion: () => reduced }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      const along = (distance: number, cross = 0): [number, number] => [p[0] + dx / 60 * distance + (at === 0 ? cross : 0), p[1] + dy / 60 * distance + (at === 1 ? cross : 0)]
      event(s.hit, 'pointerdown', p)
      let end: [number, number] = along(60)
      if (bad === 'diagonal') { end = along(80, 80); event(s.hit, 'pointermove', end) }
      else if (bad === 'cross-path') { event(s.hit, 'pointermove', along(60, 19)); event(s.hit, 'pointermove', end) }
      else if (bad === 'nonfinite-move') { event(s.hit, 'pointermove', [NaN, p[1]]); event(s.hit, 'pointermove', end) }
      else { event(s.hit, 'pointermove', end); end = bad === 'nan-release' ? [NaN, p[1]] : [p[0], Infinity] }
      event(s.hit, 'pointerup', end); s.run()
      expect(s.progress, `${bad} at ${at}`).toEqual([]); expect(s.button.disabled).toBe(false)
      step(s, at); expect(s.progress, `valid retry after ${bad} at ${at}`).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1])('freezes an accepted transition during pause and continues to the settled checkpoint at %i', at => {
    let active = true; const s = mount(at, { isActive: () => active }); s.button.click(); s.instance.update(.025)
    const mesh = s.scene.getObjectByName(at ? 'bojagi-band-right' : 'bojagi-cloth') as THREE.Mesh, pose = Array.from(mesh.geometry.getAttribute('position').array)
    expect(s.progress).toEqual([]); expect(s.button.disabled).toBe(true); expect(s.hit.style.pointerEvents).toBe('none')
    active = false; const frames = rendered.render.mock.calls.length; s.run(); expect(s.progress).toEqual([]); expect(Array.from(mesh.geometry.getAttribute('position').array)).toEqual(pose); expect(rendered.render.mock.calls.length).toBe(frames)
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
  })
  it.each([284, 350, 1280])('fits all subject vertices and keeps actual nearest opaque cue surfaces at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width)
      s.scene.getObjectByName('bojagi-subject')!.traverse(o => {
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
  it.each([0, 1])('rejects wrong start, release-only, reverse, short, cross-axis and backtracked input at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at), end: [number, number] = [p[0] + dx, p[1] + dy]
    event(s.hit, 'pointerdown', [1, 1]); event(s.hit, 'pointermove', end); event(s.hit, 'pointerup', end)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerup', end)
    for (const [x, y] of [[dx / 8, dy / 8], [-dx, -dy], [-dy, dx]]) drag(s, at, x, y)
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', end); event(s.hit, 'pointermove', p); event(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); step(s, at); expect(s.progress).toEqual([at + 1])
  })
  it.each(['pause', 'blur', 'pointercancel', 'lostpointercapture'])('restores partially manipulated cloth and bands on %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }), cloth = s.scene.getObjectByName('bojagi-cloth') as THREE.Mesh, corner = s.scene.getObjectByName('bojagi-near-corner')!, home = corner.position.clone(), sheet = Array.from(cloth.geometry.getAttribute('position').array), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2])
      if (kind === 'pause') { active = false; s.instance.update(.025) } else if (kind === 'blur') window.dispatchEvent(new Event('blur')); else event(s.hit, kind, p)
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); expect(s.progress).toEqual([]); expect(corner.position.distanceTo(home)).toBeLessThan(.00001); expect(Array.from(cloth.geometry.getAttribute('position').array)).toEqual(sheet)
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
    event(s.hit, 'pointerdown', p); event(s.hit, 'pointerdown', [1, 1], 2); event(s.hit, 'pointermove', [p[0], p[1] - 60]); event(s.hit, 'pointerup', [p[0], p[1] - 60]); event(s.hit, 'pointerup', [1, 1], 2)
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
