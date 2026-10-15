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
const targetName = (_at: number) => 'gourd-shell'
const anchor = (at: number): [number, number, number] => at === 0 ? [-.3295899491, 1.05, .7697097123] : at === 1 ? [.2190522043, 1.55, .4549356620] : [.1156681796, 1.25, .7614644589]
const delta = (at: number): [number, number] => at === 0 ? [60, 0] : [0, 60]
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


describe('hand engraved gourd with surface cutting and polishing', () => {
  it('starts silently with a real gourd, small support and accessible action', () => {
    const s = mount()
    expect(s.scene.getObjectByName('gourd-shell')).toBeDefined()
    expect(s.scene.getObjectByName('gourd-stem')).toBeDefined()
    expect(s.scene.getObjectByName('gourd-padded-ring')).toBeDefined()
    expect(s.button.style.minWidth).toBe('44px'); expect(s.button.style.minHeight).toBe('44px')
    expect(s.progress).toEqual([]); expect(s.haptic).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('embeds the entire stem root in the solid neck instead of balancing an open tube on its tip', () => {
    const s = mount(), shell = s.scene.getObjectByName('gourd-shell') as THREE.Mesh, stem = s.scene.getObjectByName('gourd-stem') as THREE.Mesh
    const positions = stem.geometry.getAttribute('position'), uv = stem.geometry.getAttribute('uv'), material = shell.material as THREE.Material, side = material.side
    material.side = THREE.DoubleSide
    const ray = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0)), point = new THREE.Vector3()
    for (let i = 0; i < positions.count; i++) if (uv.getX(i) === 0) {
      point.fromBufferAttribute(positions, i).applyMatrix4(stem.matrixWorld); ray.ray.origin.set(point.x, 4, point.z)
      const hits = ray.intersectObject(shell)
      expect(hits.length).toBeGreaterThanOrEqual(2)
      expect(hits[0]!.point.y - point.y).toBeGreaterThan(.025)
      expect(point.y - hits[hits.length - 1]!.point.y).toBeGreaterThan(.025)
    }
    material.side = side
  })
  it('rests the gourd on its padded ring around the entire base while both remain above the floor', () => {
    const s = mount(), shell = s.scene.getObjectByName('gourd-shell') as THREE.Mesh, ring = s.scene.getObjectByName('gourd-padded-ring') as THREE.Mesh
    const up = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), down = new THREE.Raycaster(new THREE.Vector3(), new THREE.Vector3(0, -1, 0))
    expect(new THREE.Box3().setFromObject(ring).min.y).toBeCloseTo(0, 3)
    expect(new THREE.Box3().setFromObject(shell).min.y).toBeGreaterThan(.02)
    for (let i = 0; i < 16; i++) {
      const a = i / 16 * Math.PI * 2, x = Math.cos(a) * .43, z = Math.sin(a) * .43
      up.ray.origin.set(x, -.1, z); down.ray.origin.set(x, 1, z)
      const bottom = up.intersectObject(shell)[0]?.point.y, top = down.intersectObject(ring)[0]?.point.y
      expect(bottom).toBeDefined(); expect(top).toBeDefined()
      expect(bottom! - top!, `support gap at ${i}`).toBeLessThan(.015)
      expect(bottom! - top!, `support penetration at ${i}`).toBeGreaterThan(-.06)
    }
  })
  it('draws continuous fine hills with graded edge coverage instead of binary alternating pixels', () => {
    const s = mount(2), texture = ((s.scene.getObjectByName('gourd-shell') as THREE.Mesh).material as THREE.MeshStandardMaterial).map as THREE.DataTexture
    const { width, height, data } = texture.image
    let softPixels = 0
    for (let y = Math.floor(height * .32); y <= Math.ceil(height * .42); y++) for (let x = Math.floor(width * .30); x < width * .70; x++) {
      const red = data[(y * width + x) * 4]!
      if (red > 104 && red < 163) softPixels++
    }
    expect(softPixels).toBeGreaterThan(100)
    for (let i = 0; i <= 80; i++) {
      const t = .05 + .90 * i / 80, x = Math.round((.29 + .42 * t) * width), y = Math.round((.365 + .046 * Math.sin(t * Math.PI * 5.5)) * height)
      let darkest = 255
      for (let dy = -1; dy <= 1; dy++) darkest = Math.min(darkest, data[((y + dy) * width + x) * 4]!)
      expect(darkest, `hill curve gap at ${i}`).toBeLessThan(163)
    }
    expect(width * height * 4).toBeLessThanOrEqual(512 * 256 * 4)
  })
  it('moves the burin and cloth over the shell, reveals surface detail, and commits only after settlement', () => {
    const s = mount(), shell = s.scene.getObjectByName('gourd-shell') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    const start = shell.material, geometry = shell.geometry
    for (const at of [0, 1]) {
      const tool = s.scene.getObjectByName(at ? 'gourd-polishing-cloth' : 'gourd-burin')!, home = tool.position.clone()
      const p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2])
      expect(tool.visible).toBe(true); expect(tool.position.distanceTo(home)).toBeGreaterThan(.1)
      const middle = shell.material; expect(middle).not.toBe(start); expect(middle.map).not.toBe(start.map)
      event(s.hit, 'pointermove', [p[0] + dx, p[1] + dy]); event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy])
      expect(s.progress).toEqual(at ? [1] : []); expect(s.button.disabled).toBe(true)
      s.run(); expect(s.progress).toEqual(at ? [1, 2] : [1]); expect(tool.visible).toBe(false)
      expect(shell.geometry).toBe(geometry)
    }
    const pixels = (shell.material.map as THREE.DataTexture).image.data
    expect(Array.from(pixels)).not.toEqual(Array.from((start.map as THREE.DataTexture).image.data))
  })
  it('keeps stage map identities immutable through the real toon cache and frees every generated texture and material once', () => {
    const s = mount(), shell = s.scene.getObjectByName('gourd-shell') as THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>
    const adapter = createToonSurfaces('toon-soft'), resources = new Set<THREE.Material | THREE.Texture>(), maps = new Map<THREE.Material, THREE.Texture | null>()
    const check = () => {
      const material = shell.material, texture = material.map
      if (maps.has(material)) expect(texture).toBe(maps.get(material)); maps.set(material, texture)
      resources.add(material); resources.add(texture!)
      const frame = adapter.apply(s.scene); expect(shell.material.map).toBe(texture)
      expect(frame.outlined.filter(m => /gourd-support-stitch/.test(m.name))).toHaveLength(0)
      frame.restore(); expect(shell.material).toBe(material)
    }
    check()
    for (const at of [0, 1]) {
      const p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p)
      for (let i = 1; i <= 8; i++) { event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8]); check() }
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); s.run(); check()
    }
    expect(maps.size).toBeGreaterThan(8); adapter.dispose()
    const freed = new Map<unknown, number>(); resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    s.instance.dispose(); s.instance.dispose(); expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
  })
  it.each([0, 1, 2, 3])('silently restores checkpoint %i with the same surface as settled normal and reduced paths', checkpoint => {
    const restored = mount(checkpoint, { returning: true }), normal = mount(), reduced = mount(0, { isReducedMotion: () => true })
    expect(restored.progress).toEqual([]); expect(restored.haptic).not.toHaveBeenCalled(); expect(restored.complete).not.toHaveBeenCalled(); expect(restored.saveWish).not.toHaveBeenCalled()
    expect(restored.overlay.querySelector('form')).toBeNull()
    expect(cues(restored).map(x => x.cue.kind)).toEqual(checkpoint < 2 ? ['drag'] : checkpoint === 2 ? ['tap'] : [])
    for (let at = 0; at < checkpoint; at++) { step(normal, at); step(reduced, at) }
    const pixels = (s: typeof restored) => Array.from((((s.scene.getObjectByName('gourd-shell') as THREE.Mesh).material as THREE.MeshStandardMaterial).map as THREE.DataTexture).image.data)
    expect(pixels(normal)).toEqual(pixels(restored)); expect(pixels(reduced)).toEqual(pixels(restored))
  })
  it.each([284, 350, 1280])('fits the complete subject and exposes each cue on its first opaque hit at width %i', width => {
    for (const at of [0, 1, 2, 3]) {
      const s = mount(at, { isReducedMotion: () => true }, width)
      s.scene.getObjectByName('gourd-subject')!.traverse(o => {
        const m = o as THREE.Mesh; if (!m.geometry) return
        for (let q: THREE.Object3D | null = o; q; q = q.parent) if (!q.visible) return
        const pos = m.geometry.getAttribute('position'), p = new THREE.Vector3()
        for (let n = 0; n < pos.count; n++) { p.fromBufferAttribute(pos, n).applyMatrix4(m.matrixWorld).project(s.camera); expect(Math.max(Math.abs(p.x), Math.abs(p.y)), m.name).toBeLessThan(.97) }
      })
      for (const { object, cue } of cues(s)) expect(first(s, object.localToWorld(new THREE.Vector3(...cue.anchor!))).object).toBe(object)
      if (at < 3) step(s, at); expect(s.progress).toEqual(at < 3 ? [at + 1] : []); s.instance.dispose()
    }
  })
  it.each([0, 1])('keeps the source shell exposed through native touchstart before revealing the tool at step %i', at => {
    const s = mount(at, {}, 320), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
    event(s.hit, 'pointerdown', p)
    const touch = new Event('touchstart', { bubbles: true, cancelable: true })
    Object.assign(touch, { changedTouches: [{ clientX: p[0], clientY: p[1], identifier: 1 }] })
    s.hit.dispatchEvent(touch)
    expect(touch.defaultPrevented).toBe(true)
    for (let i = 1; i <= 8; i++) event(s.hit, 'pointermove', [p[0] + dx * i / 8, p[1] + dy * i / 8])
    event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy])
    expect(s.progress).toEqual([]); s.run(); expect(s.progress).toEqual([at + 1]); expect(s.button.disabled).toBe(false)
  })
  it.each([false, true])('rejects invalid complete drag paths and leaves valid retry enabled, reduced=%s', reduced => {
    for (const at of [0, 1]) for (const bad of ['short', 'reverse', 'cross', 'oversize', 'release-only', 'terminal-reversal', 'terminal-cross', 'path-cross', 'path-travel', 'nan-move', 'infinite-up']) {
      const s = mount(at, { isReducedMotion: () => reduced }), p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      const point = (along: number, cross = 0): [number, number] => [p[0] + dx / 60 * along + (at ? cross : 0), p[1] + dy / 60 * along + (at ? 0 : cross)]
      event(s.hit, 'pointerdown', p); let end = point(60)
      if (bad === 'short') { end = point(20); event(s.hit, 'pointermove', end) }
      else if (bad === 'reverse') { end = point(-60); event(s.hit, 'pointermove', end) }
      else if (bad === 'cross') { end = point(0, 60); event(s.hit, 'pointermove', end) }
      else if (bad === 'oversize') { end = point(120); event(s.hit, 'pointermove', end) }
      else if (bad === 'release-only') { /* a pointerup jump cannot cut */ }
      else if (bad === 'terminal-reversal') { event(s.hit, 'pointermove', point(60)); end = point(44) }
      else if (bad === 'terminal-cross') { event(s.hit, 'pointermove', end); end = point(60, 19) }
      else if (bad === 'path-cross') { event(s.hit, 'pointermove', point(30, 19)); event(s.hit, 'pointermove', end) }
      else if (bad === 'path-travel') { for (const [a, c] of [[12, 16], [24, -16], [36, 16], [48, -16], [60, 0]]) event(s.hit, 'pointermove', point(a, c)) }
      else if (bad === 'nan-move') { event(s.hit, 'pointermove', [NaN, p[1]]); event(s.hit, 'pointermove', end) }
      else { event(s.hit, 'pointermove', end); end = [p[0], Infinity] }
      event(s.hit, 'pointerup', end); s.run(); expect(s.progress, `${bad} at ${at}`).toEqual([]); expect(s.button.disabled).toBe(false)
      step(s, at); expect(s.progress, `retry ${bad} at ${at}`).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each(['pause', 'blur', 'pointercancel', 'lostpointercapture', 'multitouch'])('restores the uncommitted shell and tool on %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }), shell = s.scene.getObjectByName('gourd-shell') as THREE.Mesh, original = shell.material
      const p = s.point(targetName(at), anchor(at)), [dx, dy] = delta(at)
      event(s.hit, 'pointerdown', p); event(s.hit, 'pointermove', [p[0] + dx / 2, p[1] + dy / 2]); expect(shell.material).not.toBe(original)
      if (kind === 'pause') { active = false; s.instance.update(.025) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else if (kind === 'multitouch') event(document.body, 'pointerdown', [1, 1], 2)
      else event(s.hit, kind, p)
      event(s.hit, 'pointerup', [p[0] + dx, p[1] + dy]); event(document.body, 'pointerup', [1, 1], 2); s.run()
      expect(s.progress).toEqual([]); expect(shell.material).toBe(original)
      expect(s.scene.getObjectByName('gourd-burin')!.visible).toBe(false); expect(s.scene.getObjectByName('gourd-polishing-cloth')!.visible).toBe(false)
      if (kind === 'blur') window.dispatchEvent(new Event('focus')); active = true; s.instance.update(.025); step(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([0, 1])('freezes an accepted physical motion during pause and resumes settlement at %i', at => {
    let active = true; const s = mount(at, { isActive: () => active }); s.button.click(); s.instance.update(.025)
    const shell = s.scene.getObjectByName('gourd-shell') as THREE.Mesh, material = shell.material, tool = s.scene.getObjectByName(at ? 'gourd-polishing-cloth' : 'gourd-burin')!, position = tool.position.clone()
    expect(s.progress).toEqual([]); active = false; const frames = rendered.render.mock.calls.length; s.run()
    expect(shell.material).toBe(material); expect(tool.position).toEqual(position); expect(rendered.render.mock.calls.length).toBe(frames)
    active = true; s.run(); expect(s.progress).toEqual([at + 1])
  })
  it('never saves a quiet draft and saves explicit trimmed wishes once', () => {
    const s = mount(2), input = s.overlay.querySelector<HTMLInputElement>('input')!
    input.value = '  愿平安  '; input.dispatchEvent(new Event('input', { bubbles: true })); const form = input.form!
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })); form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('愿平安'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const quiet = mount(2), draft = quiet.overlay.querySelector<HTMLInputElement>('input')!; draft.value = 'unsent'; draft.dispatchEvent(new Event('input', { bubbles: true })); step(quiet, 2)
    expect(quiet.saveWish).not.toHaveBeenCalled(); expect(quiet.progress).toEqual([3])
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
