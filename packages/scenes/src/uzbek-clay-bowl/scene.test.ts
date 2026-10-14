// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Shared from '@wbr/shared'
import * as Gestures from '@wbr/gestures'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import * as mod from './index'

const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown, renderer: null as unknown, frames: 0 }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement
    shadowMap = { enabled: false, type: 0 }
    dispose = vi.fn(); forceContextLoss = vi.fn()
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas; rendered.renderer = this }
    setClearColor() {} setPixelRatio() {} setSize() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle: (renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera; rendered.frames = 0
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, dispose() { cues.dispose() }, render() { rendered.frames++; scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function mount(at = 0, extra: Partial<SceneContext> = {}, width = 350, height = 408) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  const left = 17, top = 89
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = mod.create({ canvas, overlay, shared: Shared, gestures: Gestures, initialProgress: at, isSoundEnabled: () => false,
    onProgress: n => progress.push(n), saveWish, haptic, ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {} }
  const point = (name: string, anchor?: [number, number, number]): [number, number] => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const object = scene.getObjectByName(name)!
    const cue = object.userData.interactionCues?.find((c: InteractionCue) => c.enabled())
    const p = object.localToWorld(new THREE.Vector3(...(anchor ?? cue?.anchor ?? [0, 0, 0]))).project(camera)
    return [left + (p.x + 1) * width / 2, top + (1 - p.y) * height / 2]
  }
  const run = (seconds = 1) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  return { instance, scene, camera, overlay, host, hit, button, point, run, progress, saveWish, complete, haptic }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(event)
}

function drag(s: ReturnType<typeof mount>, at: number, dx = at === 0 ? 70 : 0, dy = at === 1 ? -70 : 0, settle = true) {
  const p = s.point(at === 0 ? 'clay-wheel-rim' : 'clay-body'), q: [number, number] = [p[0] + dx, p[1] + dy]
  pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', q); pointer(s.hit, 'pointerup', q)
  if (settle) s.run()
}
function tap(s: ReturnType<typeof mount>) {
  const p = s.point('clay-body'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p)
}
function geometry(s: ReturnType<typeof mount>) { return (s.scene.getObjectByName('clay-body') as THREE.Mesh).geometry }
function positions(s: ReturnType<typeof mount>) { return Array.from(geometry(s).getAttribute('position').array) }

describe('a damp unfired clay bowl', () => {
  it('provides an accessible action and no input or progress on entry', () => {
    const s = mount(); expect(s.button).not.toBeNull(); expect(s.progress).toEqual([])
    expect(s.button.type).toBe('button'); expect(s.button.style.minWidth).toBe('44px'); expect(s.button.style.minHeight).toBe('44px')
    expect(s.overlay.querySelector('input, textarea, form')).toBeNull()
    expect(mod.meta).toMatchObject({ id: 'uzbek-clay-bowl', title: '陶轮慢成', grade: 'C', sensitivity: '低', gestures: ['drag', 'spin'] })
  })
  it.each([false, true])('turns the real marked wheel, reshapes hollow clay, quietly finishes once; reduced=%s', reduced => {
    const s = mount(0, { isReducedMotion: () => reduced }), wheel = s.scene.getObjectByName('clay-wheel')!, clay = s.scene.getObjectByName('clay-body') as THREE.Mesh
    const before = positions(s), material = clay.material, color = (material as THREE.MeshStandardMaterial).color.getHex()
    const mark = s.scene.getObjectByName('clay-wheel-mark')!, markPosition = mark.getWorldPosition(new THREE.Vector3())
    drag(s, 0); expect(s.progress).toEqual([1]); expect(wheel.rotation.y).toBeGreaterThan(.5)
    expect(mark.getWorldPosition(new THREE.Vector3()).distanceTo(markPosition)).toBeGreaterThan(.35)
    drag(s, 1); expect(s.progress).toEqual([1, 2]); expect(positions(s)).not.toEqual(before)
    expect(clay.scale.toArray()).toEqual([1, 1, 1]); expect(clay.material).toBe(material)
    geometry(s).computeBoundingBox(); expect(geometry(s).boundingBox!.max.y).toBeGreaterThan(1)
    tap(s); tap(s); s.button.click(); expect(s.progress).toEqual([1, 2, 3]); expect(s.complete).toHaveBeenCalledOnce()
    expect(s.saveWish).not.toHaveBeenCalled(); expect((material as THREE.MeshStandardMaterial).color.getHex()).toBe(color)
  })
  it.each([0, 1, 2, 3])('restores %i silently, with returning visits and native button completion', at => {
    const s = mount(at, { isReducedMotion: () => true, returning: true }); s.run()
    expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
    expect(s.overlay.querySelector('input, textarea, form')).toBeNull(); expect(s.button.hidden).toBe(at === 3)
    geometry(s).computeBoundingBox(); expect(geometry(s).boundingBox!.max.y).toBeCloseTo(at >= 2 ? 1.15 : .58, 2)
    for (let i = at; i < 3; i++) s.button.click()
    expect(s.progress).toEqual([1, 2, 3].filter(n => n > at)); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it.each([[284, 390], [350, 408], [1280, 600]])('frames all visible vertices and first opaque cue hits at %ix%i', (width, height) => {
    const s = mount(0, { isReducedMotion: () => true }, width, height)
    for (const step of [0, 1, 2, 3]) {
      s.run(.025); s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
      const visible: THREE.Object3D[] = []; s.scene.traverseVisible(o => { const m = o as THREE.Mesh; if (m.isMesh && !(m.material as THREE.Material).transparent) visible.push(o) })
      s.scene.getObjectByName('clay-workbench')!.traverseVisible(o => {
        const mesh = o as THREE.Mesh; if (!mesh.isMesh) return
        const vertices = mesh.geometry.getAttribute('position'), bounds = new THREE.Box3(), projected = new THREE.Vector3()
        // Every vertex remains covered; aggregate bounds avoid per-vertex matcher overhead.
        for (let i = 0; i < vertices.count; i++) bounds.expandByPoint(projected.fromBufferAttribute(vertices, i).applyMatrix4(mesh.matrixWorld).project(s.camera))
        const extent = Math.max(Math.abs(bounds.min.x) / .94, Math.abs(bounds.max.x) / .94, Math.abs(bounds.min.y) / .94, Math.abs(bounds.max.y) / .94, Math.abs(bounds.min.z), Math.abs(bounds.max.z))
        expect(extent, `${mesh.name} at ${step}: ${bounds.min.toArray()} / ${bounds.max.toArray()}`).toBeLessThan(1)
      })
      const enabled: { object: THREE.Object3D; cue: InteractionCue }[] = []
      s.scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) enabled.push({ object, cue }) })
      expect(enabled.map(e => e.cue.kind)).toEqual(step === 0 ? ['rotate'] : step === 1 ? ['drag'] : step === 2 ? ['tap'] : [])
      for (const { object, cue } of enabled) {
        const p = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(s.camera)
        const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2(p.x, p.y), s.camera)
        expect(ray.intersectObjects(visible, false)[0]?.object, object.name).toBe(object)
        const element = s.host.querySelector<HTMLElement>('[data-cue-role="source"]')!
        expect(Number(element.dataset.x)).toBeCloseTo((p.x + 1) * width / 2, 3); expect(Number(element.dataset.y)).toBeCloseTo((1 - p.y) * height / 2, 3)
      }
      if (step < 2) drag(s, step); else if (step === 2) tap(s)
    }
    expect(s.progress).toEqual([1, 2, 3])
  })
  it.each([0, 2])('has connected outer walls, open rim, inner walls, thick floor and grooves at checkpoint %i', at => {
    const s = mount(at), clay = s.scene.getObjectByName('clay-body') as THREE.Mesh
    const ray = (origin: THREE.Vector3, direction: THREE.Vector3) => new THREE.Raycaster(clay.localToWorld(origin), direction).intersectObject(clay, false)
    const center = ray(new THREE.Vector3(0, 2, 0), new THREE.Vector3(0, -1, 0))
    expect(center.length).toBeGreaterThan(0); expect(center[0]!.point.y - clay.position.y).toBeCloseTo(.13, 2)
    const inner = ray(new THREE.Vector3(0, at ? .6 : .3, 0), new THREE.Vector3(0, 0, 1))
    const outer = ray(new THREE.Vector3(0, at ? .6 : .3, 2), new THREE.Vector3(0, 0, -1))
    expect(inner.length).toBeGreaterThan(0); expect(outer.length).toBeGreaterThan(0)
    expect(outer[0]!.point.z - inner[0]!.point.z).toBeGreaterThan(.06)
    expect(outer[0]!.point.z - inner[0]!.point.z).toBeLessThan(.16)
    const underside = ray(new THREE.Vector3(0, -.2, 0), new THREE.Vector3(0, 1, 0))
    expect(underside[0]!.point.y - clay.position.y).toBeCloseTo(0, 3)
    const material = clay.material as THREE.MeshStandardMaterial
    expect(material.transparent).toBe(false); expect(material.metalness).toBe(0); expect(material.roughness).toBeGreaterThan(.45)
    // Closely spaced turning ridges must affect actual radial vertices rather than a painted flat surface.
    const p = clay.geometry.getAttribute('position'), samples: number[] = []
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i)) < .0001 && p.getZ(i) > .38 && p.getY(i) > .15 && p.getY(i) < (at ? 1.05 : .5)) samples.push(p.getZ(i))
    expect(new Set(samples.map(v => v.toFixed(4))).size).toBeGreaterThan(20)
  })
  it('joins the clay, wooden wheel, spindle and base without floating gaps', () => {
    const s = mount(), bounds = (name: string) => new THREE.Box3().setFromObject(s.scene.getObjectByName(name)!)
    expect(bounds('clay-body').min.y).toBeCloseTo(bounds('clay-wheel-rim').max.y, 3)
    expect(bounds('clay-wheel-rim').min.y).toBeCloseTo(bounds('clay-spindle').max.y, 3)
    expect(bounds('clay-spindle').min.y).toBeCloseTo(bounds('clay-wood-base').max.y, 3)
  })
  it.each([0, 1])('rejects wrong starts, absent/short/reversed/cross-axis movement and ending back at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), name = at ? 'clay-body' : 'clay-wheel-rim'
    const p = s.point(name), q: [number, number] = at ? [p[0], p[1] - 70] : [p[0] + 70, p[1]]
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointermove', q); pointer(s.hit, 'pointerup', q)
    // Aim at an exposed surface: the support's origin is hidden behind the wheel.
    const wrong = at ? s.point('clay-wheel-rim', [-Math.sin(.9) * 1.079, -.025, Math.cos(.9) * 1.079]) : s.point('clay-body', [0, .2675, .517279])
    pointer(s.hit, 'pointerdown', wrong); pointer(s.hit, 'pointermove', q); pointer(s.hit, 'pointerup', q)
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', q)
    for (const [dx, dy] of at ? [[0, 0], [0, -12], [0, 70], [70, 0], [70, -50]] : [[0, 0], [12, 0], [-70, 0], [0, 70], [50, 70]]) drag(s, at, dx, dy)
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', q); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([]); drag(s, at); expect(s.progress).toEqual([at + 1])
  })
  it('rejects drag-return quiet taps and a quiet release on empty space', () => {
    const s = mount(2), p = s.point('clay-body')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 25, p[1]]); pointer(s.hit, 'pointerup', p)
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', [1, 1]); expect(s.progress).toEqual([]); tap(s); expect(s.progress).toEqual([3])
  })
  it('starts a wheel turn only on its rim and a pull only on the exterior clay wall', () => {
    const wheelScene = mount(0, { isReducedMotion: () => true })
    const a = wheelScene.point('clay-wheel-rim', [.75, .08, 0]), b: [number, number] = [a[0] + 70, a[1]]
    pointer(wheelScene.hit, 'pointerdown', a); pointer(wheelScene.hit, 'pointermove', b); pointer(wheelScene.hit, 'pointerup', b)
    expect(wheelScene.progress).toEqual([])
    const clayScene = mount(1, { isReducedMotion: () => true })
    const c = clayScene.point('clay-body', [0, .45, -.46]), d: [number, number] = [c[0], c[1] - 70]
    pointer(clayScene.hit, 'pointerdown', c); pointer(clayScene.hit, 'pointermove', d); pointer(clayScene.hit, 'pointerup', d)
    expect(clayScene.progress).toEqual([])
    drag(wheelScene, 0); drag(clayScene, 1)
    expect(wheelScene.progress).toEqual([1]); expect(clayScene.progress).toEqual([2])
  })
  it.each([0, 1, 2])('rejects a source hidden behind another opaque mesh at %i', at => {
    const s = mount(at, { isReducedMotion: () => true }), name = at ? 'clay-body' : 'clay-wheel-rim', object = s.scene.getObjectByName(name)!
    const cue = object.userData.interactionCues.find((c: InteractionCue) => c.enabled())
    const shield = new THREE.Mesh(new THREE.PlaneGeometry(.6, .6), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }))
    shield.position.lerpVectors(object.localToWorld(new THREE.Vector3(...cue.anchor)), s.camera.position, .15); shield.quaternion.copy(s.camera.quaternion); s.scene.add(shield)
    if (at < 2) drag(s, at); else tap(s); expect(s.progress).toEqual([])
    shield.removeFromParent(); shield.geometry.dispose(); shield.material.dispose()
    if (at < 2) drag(s, at); else tap(s); expect(s.progress).toEqual([at + 1])
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause', 'multitouch'])('restores the actual wheel and clay profile after %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active, isReducedMotion: () => true }), wheel = s.scene.getObjectByName('clay-wheel')!
      const home = positions(s), angle = wheel.rotation.y, p = s.point(at ? 'clay-body' : 'clay-wheel-rim'), q: [number, number] = at ? [p[0], p[1] - 60] : [p[0] + 60, p[1]]
      pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', q)
      expect(at ? positions(s) : wheel.rotation.y).not.toEqual(at ? home : angle)
      const frames = rendered.frames
      if (kind === 'pause') { active = false; s.run(); expect(rendered.frames).toBe(frames) }
      else if (kind === 'blur') window.dispatchEvent(new Event('blur'))
      else if (kind === 'multitouch') pointer(document.body, 'pointerdown', [1, 1], 2)
      else pointer(s.hit, kind, p)
      pointer(s.hit, 'pointerup', q); pointer(document.body, 'pointerup', [1, 1], 2)
      expect(s.progress).toEqual([]); expect(positions(s)).toEqual(home); expect(wheel.rotation.y).toBe(angle)
      active = true; window.dispatchEvent(new Event('focus')); s.instance.update(.025); drag(s, at); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each(['blur', 'pause'])('freezes accepted material motion without rendering during %s', kind => {
    for (const at of [0, 1]) {
      let active = true; const s = mount(at, { isActive: () => active }); drag(s, at, at ? 0 : 48, at ? -48 : 0, false); s.run(.1)
      const home = positions(s), wheel = s.scene.getObjectByName('clay-wheel')!, angle = wheel.rotation.y, frames = rendered.frames
      if (kind === 'blur') window.dispatchEvent(new Event('blur')); else active = false
      s.run(2); expect(positions(s)).toEqual(home); expect(wheel.rotation.y).toBe(angle); expect(s.progress).toEqual([]); expect(rendered.frames).toBe(frames)
      expect(s.button.disabled).toBe(true); expect((s.host.querySelector('.scene-object-cues') as HTMLElement).hidden).toBe(true)
      active = true; window.dispatchEvent(new Event('focus')); s.run(1); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([false, true])('preserves the real pointer owner through prepareFeedback input reentry; reduced=%s', reduced => {
    for (const at of [0, 1, 2]) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => reduced, prepareFeedback: () => attack() })
      attack = () => { pointer(s.hit, type, [1, 1]); s.button.click(); s.instance.update(1) }
      if (at < 2) drag(s, at); else tap(s)
      expect(s.progress, `${at}/${type}`).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([false, true])('locks synchronous progress/haptic input reentry; reduced=%s', reduced => {
    for (const callback of ['progress', 'haptic']) for (const at of [0, 1, 2]) {
      let attack = () => {}; const seen: number[] = []
      const s = mount(at, { isReducedMotion: () => reduced, onProgress(n) { seen.push(n); if (callback === 'progress') attack() }, haptic() { if (callback === 'haptic') attack() } })
      attack = () => { s.button.click(); pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', [1, 1]); s.instance.update(1) }
      if (at < 2) drag(s, at); else tap(s)
      expect(seen).toEqual([at + 1]); expect(s.saveWish).not.toHaveBeenCalled(); s.instance.dispose()
    }
  })
  it.each([false, true])('preserves original ownership through page-level prepareFeedback pointer events; reduced=%s', reduced => {
    for (const at of [0, 1, 2]) for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']) {
      let attack = () => {}; const s = mount(at, { isReducedMotion: () => reduced, prepareFeedback: () => attack() })
      attack = () => pointer(document.body, type, [1, 1])
      if (at < 2) drag(s, at); else tap(s)
      expect(s.progress, `${at}/${type}`).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([false, true])('abandons prepared actions after callback pause/resume or blur/focus; reduced=%s', reduced => {
    for (const effect of ['pause', 'blur']) for (const input of ['pointer', 'button']) for (const at of [0, 1, 2]) {
      let active = true, attack = () => {}; const s = mount(at, { isReducedMotion: () => reduced, isActive: () => active, prepareFeedback: () => attack() })
      attack = () => {
        if (effect === 'pause') { active = false; s.instance.update(0); active = true }
        else { window.dispatchEvent(new Event('blur')); window.dispatchEvent(new Event('focus')) }
      }
      if (input === 'button') { s.button.click(); s.run() } else if (at < 2) drag(s, at); else tap(s)
      expect(s.progress, `${effect}/${input}/${at}`).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      attack = () => {}; s.instance.update(.025); if (at < 2) drag(s, at); else tap(s)
      expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([false, true])('cancels every prepared button pause before an active frame, reduced=%s', reduced => {
    for (const at of [0, 1, 2]) {
      let active = true, attack = () => {}
      const s = mount(at, { isReducedMotion: () => reduced, isActive: () => active, prepareFeedback: () => attack() })
      attack = () => { active = false; s.instance.update(0); active = true }
      for (let i = 0; i < 3; i++) {
        s.button.click(); expect(s.progress, `checkpoint ${at}, attempt ${i}`).toEqual([])
        expect(s.button.disabled).toBe(false)
      }
      s.run(); expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      attack = () => {}; s.button.click(); s.run(); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([false, true])('stops callbacks and frames after a synchronous host pause/dispose; reduced=%s', reduced => {
    for (const effect of ['pause', 'dispose']) for (const callback of ['prepare', 'progress', 'haptic']) for (const at of [0, 1, 2]) {
      let active = true, interrupt = () => {}, frames = -1; const seen: number[] = [], haptic = vi.fn()
      const s = mount(at, { isReducedMotion: () => reduced, isActive: () => active,
        prepareFeedback() { if (callback === 'prepare') interrupt() }, onProgress(n) { seen.push(n); if (callback === 'progress') interrupt() },
        haptic() { haptic(); if (callback === 'haptic') interrupt() } })
      interrupt = () => { frames = rendered.frames; if (effect === 'dispose') s.instance.dispose(); else active = false }
      s.button.click(); s.run(1); expect(seen).toEqual(callback === 'prepare' ? [] : [at + 1]); expect(rendered.frames).toBe(frames)
      expect(haptic).toHaveBeenCalledTimes(callback === 'haptic' ? 1 : 0); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled(); s.instance.dispose()
    }
  })
  it('sanitizes animation time and does not skip a material checkpoint on a huge frame', () => {
    for (const at of [0, 1]) {
      const s = mount(at); s.button.click(); const before = positions(s), wheel = s.scene.getObjectByName('clay-wheel')!, angle = wheel.rotation.y
      for (const dt of [Number.NaN, Infinity, -10]) s.instance.update(dt)
      expect(positions(s)).toEqual(before); expect(wheel.rotation.y).toBe(angle); expect(s.progress).toEqual([])
      s.instance.update(1000); expect(s.progress).toEqual([]); s.run(); expect(s.progress).toEqual([at + 1]); s.instance.dispose()
    }
  })
  it.each([NaN, Infinity, -9])('sanitizes invalid checkpoint %s and remains silent on repeated start', initial => {
    const s = mount(initial, { isReducedMotion: () => true }); s.instance.start(); expect(s.progress).toEqual([]); s.button.click(); expect(s.progress).toEqual([1])
  })
  it('frees every owned geometry, material, cue, pointer guard and window listener exactly once', () => {
    const added = vi.spyOn(EventTarget.prototype, 'addEventListener'), removed = vi.spyOn(EventTarget.prototype, 'removeEventListener'), s = mount()
    const resources = new Set<THREE.BufferGeometry | THREE.Material>(), freed = new Map<unknown, number>(), cued: THREE.Object3D[] = []
    s.scene.traverse(o => { if (o.userData.interactionCues?.length) cued.push(o); const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); for (const mat of Array.isArray(m.material) ? m.material : m.material ? [m.material] : []) resources.add(mat) })
    resources.forEach(r => r.addEventListener('dispose', () => freed.set(r, (freed.get(r) ?? 0) + 1)))
    const registrations = added.mock.calls.map((call, i) => ({ call, target: added.mock.instances[i] as unknown })).filter(r => r.target === window || r.target === s.hit)
    expect(registrations.filter(r => r.target === s.hit && r.call[2] === true)).toHaveLength(5)
    const renderer = rendered.renderer as THREE.WebGLRenderer, p = s.point('clay-wheel-rim'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 20, p[1]])
    const frames = rendered.frames; s.instance.dispose(); s.instance.dispose(); s.button.click(); pointer(s.hit, 'pointerup', [p[0] + 70, p[1]]); s.instance.start(); s.run()
    expect(freed.size).toBe(resources.size); expect([...freed.values()].every(n => n === 1)).toBe(true)
    expect(renderer.dispose).toHaveBeenCalledOnce(); expect(renderer.forceContextLoss).toHaveBeenCalledOnce(); expect(rendered.frames).toBe(frames)
    expect(s.overlay.childElementCount).toBe(0); expect(s.host.querySelector('.scene-object-cues')).toBeNull(); for (const o of cued) expect(o.userData.interactionCues).toEqual([])
    const capture = (o: boolean | EventListenerOptions | undefined) => typeof o === 'boolean' ? o : o?.capture ?? false
    for (const { call: [type, listener, options], target } of registrations) expect(removed.mock.calls.filter(([t, l, opt], i) => removed.mock.instances[i] === target && t === type && l === listener && capture(opt) === capture(options))).toHaveLength(1)
  })
})
