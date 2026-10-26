// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from '../contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Keep geometry, raycasting, UI and gestures real; jsdom has no WebGL.
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    toneMapping = 0
    toneMappingExposure = 1
    outputColorSpace = ''
    setClearColor() {}
    setPixelRatio() {}
    setSize() {}
    dispose() {}
    forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const built = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    built.scene = scene
    built.camera = camera
    return {
      setStyle() {}, resize() {}, dispose() {},
      render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) },
    }
  },
}))

import { create } from './index'

const instances: SceneInstance[] = []
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390, height = 560) {
  const canvas = document.createElement('canvas')
  const overlay = document.createElement('div')
  Object.defineProperties(canvas, {
    clientWidth: { value: width }, clientHeight: { value: height },
  })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  document.body.append(canvas, overlay)
  const progress: number[] = []
  const saveWish = vi.fn()
  const complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = create({
    canvas, overlay, initialProgress, gestures: Gestures, shared: Shared,
    onProgress: (n) => progress.push(n), saveWish, isSoundEnabled: () => false,
    ...extra,
  })
  instances.push(instance)
  instance.start()
  const run = (seconds = 1) => {
    for (let n = 0; n < seconds; n += 0.05) instance.update(0.05)
  }
  run(0.05)
  const button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  if (hit) hit.setPointerCapture = () => {}
  const scene = built.scene as THREE.Scene
  const camera = built.camera as THREE.Camera
  const obj = (name: string) => scene.getObjectByName(name)!
  const project = (p: THREE.Vector3) => {
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    const v = p.clone().project(camera)
    return [((v.x + 1) / 2) * width, ((1 - v.y) / 2) * height] as const
  }
  const flowerPoint = (name: string) => {
    scene.updateMatrixWorld(true)
    const mesh = obj(name) as THREE.InstancedMesh
    const matrix = new THREE.Matrix4()
    // The first visible jasmine bud, rather than the middle of a hollow ring.
    mesh.getMatrixAt(0, matrix)
    return project(new THREE.Vector3().setFromMatrixPosition(matrix).applyMatrix4(mesh.matrixWorld))
  }
  const target = () => { const entries:{object:THREE.Object3D;cue:InteractionCue}[]=[];scene.traverse(object=>{for(const cue of object.userData.interactionCues??[])if(cue.kind==='drag')entries.push({object,cue})});const c=entries.find(c=>c.cue.enabled())??entries[0]!,d=c.cue.destination!,a=project(c.object.localToWorld(new THREE.Vector3(...(c.cue.anchor??[0,0,0])))),b=project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3())),from=flowerPoint(c.object.name);return[b[0]+from[0]-a[0],b[1]+from[1]-a[1]] as const }
  const tap = () => { button.click(); run() }
  const write = (text: string) => {
    const input = overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = text
    input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }))
  }
  return { instance, overlay, canvas, progress, saveWish, complete, button, hit, run, tap, obj, project, flowerPoint, target, write }
}
type Point = readonly [number, number]
function pointer(el: HTMLElement, type: string, point: Point, id = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { pointerId: id, clientX: point[0], clientY: point[1], isPrimary: id === 1, button: 0, buttons: type === 'pointerup' ? 0 : 1 })
  el.dispatchEvent(e)
}
function swipe(el: HTMLElement, from: Point, to: Point) {
  pointer(el, 'pointerdown', from)
  pointer(el, 'pointermove', to)
  pointer(el, 'pointerup', to)
}
function claims(el: HTMLElement, p: Point) {
  const e = new Event('touchstart', { cancelable: true })
  Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] })
  el.dispatchEvent(e)
  return e.defaultPrevented
}
afterEach(() => {
  for (const instance of instances.splice(0)) instance.dispose()
  document.body.replaceChildren()
  vi.restoreAllMocks()
})

describe('Phuang Malai craft', () => {
  it('cues only the current cluster, then the live ring for tying and placing', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    const enabled = () => {
      const cues: Array<{ object: THREE.Object3D; cue: InteractionCue }> = []
      ;(built.scene as THREE.Scene).traverse(object => {
        for (const cue of (object.userData.interactionCues as InteractionCue[] | undefined) ?? []) {
          if (cue.enabled()) cues.push({ object, cue })
        }
      })
      return cues
    }
    expect(enabled().map(({ object }) => object.name)).toEqual(['tray-flowers-0'])
    expect(enabled()[0].cue.destination).toBe(s.obj('next-segment'))
    active = false
    expect(enabled()).toEqual([])
    active = true
    s.button.click()
    expect(enabled()).toEqual([])
    s.run()
    expect(enabled().map(({ object }) => object.name)).toEqual(['tray-flowers-1'])
    s.tap(); s.tap(); s.tap()
    expect(enabled().map(({ object }) => object.name)).toEqual(['ring-flowers-0'])
    expect(typeof enabled()[0].cue.destination).toBe('function')
    s.tap()
    expect(typeof enabled()[0].cue.destination).toBe('function')
    swipe(s.hit, s.flowerPoint('ring-flowers-0'), s.target())
    s.run()
    expect(enabled()).toEqual([])
    expect(s.progress).toEqual([1, 2])
  })

  it('places several clusters before checkpoint one, ties, then places without saving an untyped wish', () => {
    const s = mount()
    for (let i = 0; i < 3; i++) { s.tap(); expect(s.progress).toEqual([]) }
    s.tap()
    expect(s.progress).toEqual([1])
    s.tap()
    expect(s.progress).toEqual([1, 2])
    s.tap()
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).toHaveBeenCalledTimes(1)
    s.tap(); s.write('又一句')
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).toHaveBeenCalledTimes(1)
  })

  it('finishes the final action without saving an unsubmitted draft', () => {
    const s = mount(2)
    const input = s.overlay.querySelector<HTMLInputElement>('.scene-wish-slot input')!
    input.value = '  谢谢你的照顾  '
    s.tap(); s.tap()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.progress).toEqual([3])
    expect(s.complete).toHaveBeenCalledTimes(1)
  })

  it('does not turn a rapid double click into two placements', () => {
    const s = mount()
    s.button.click(); s.button.click(); s.run()
    s.tap(); s.tap()
    expect(s.progress).toEqual([])
    s.tap()
    expect(s.progress).toEqual([1])
  })

  it('drags the next flower cluster to the guided segment and leaves blank space scrollable', () => {
    const s = mount()
    expect(claims(s.hit, [5, 5])).toBe(false)
    swipe(s.hit, [5, 5], s.target()); s.run()
    expect(s.progress).toEqual([])
    for (let i = 0; i < 4; i++) {
      const from = s.flowerPoint(`tray-flowers-${i}`)
      expect(claims(s.hit, from),`cluster ${i}`).toBe(true)
      swipe(s.hit, from, s.target()); s.run()
    }
    expect(s.progress).toEqual([1])
  })

  it('rejects a drop away from the next segment and returns its cluster to the tray', () => {
    const s = mount()
    const before = s.obj('cluster-0').position.clone()
    swipe(s.hit, s.flowerPoint('tray-flowers-0'), [5, 5]); s.run()
    expect(s.obj('cluster-0').position.distanceTo(before)).toBeLessThan(0.001)
    for (let i = 0; i < 3; i++) s.tap()
    expect(s.progress).toEqual([])
    s.tap()
    expect(s.progress).toEqual([1])
  })

  it.each(['pointercancel', 'multiple pointers', 'foreign pointerup', 'lostpointercapture'])('rejects %s without placing a cluster', (reason) => {
    const s = mount()
    pointer(s.hit, 'pointerdown', s.flowerPoint('tray-flowers-0'))
    pointer(s.hit, 'pointermove', midway(s.flowerPoint('tray-flowers-0'),s.target()))
    if (reason === 'multiple pointers') pointer(s.hit, 'pointerdown', s.target(), 2)
    if (reason === 'foreign pointerup') pointer(s.hit, 'pointerup', s.target(), 2)
    if (reason === 'lostpointercapture') pointer(s.hit, 'lostpointercapture', s.target())
    if (reason === 'pointercancel') pointer(s.hit, 'pointercancel', s.target())
    pointer(s.hit, 'pointerup', s.target())
    if (reason === 'multiple pointers') pointer(s.hit, 'pointerup', s.target(), 2)
    s.run()
    for (let i = 0; i < 3; i++) s.tap()
    expect(s.progress).toEqual([])
    s.tap()
    expect(s.progress).toEqual([1])
  })

  it.each([0, 1, 2, 3])('restores checkpoint %i visibly without callbacks', (initial) => {
    const s = mount(initial)
    s.run(2)
    expect(s.progress).toEqual([])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    const dots = Array.from(s.overlay.querySelectorAll<HTMLElement>('.scene-step-dot'))
    expect(dots.filter((dot) => dot.dataset.state === 'done')).toHaveLength(initial)
    expect(s.obj('flower-tassel-left').visible).toBe(true)
    expect(s.obj('flower-tassel-right').visible).toBe(true)
    if (initial === 3) {
      expect(s.button.hidden).toBe(true)
      expect(s.obj('garland').position.y).toBeLessThan(1.25)
    }
  })

  it('freezes an in-flight placement while paused and rejects clicks and wishes', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    s.button.click(); s.run(0.1)
    active = false
    const position = s.obj('cluster-0').position.clone()
    s.run(2); s.button.click()
    expect(s.obj('cluster-0').position.equals(position)).toBe(true)
    expect(s.progress).toEqual([])
    active = true; s.run()
    for (let i = 0; i < 3; i++) s.tap()
    s.tap()
    active = false; s.write('谢谢陪伴'); s.button.click(); s.run()
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.progress).toEqual([1, 2])
    active = true; s.write('  谢谢陪伴  '); s.run()
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢陪伴')
    expect(s.progress).toEqual([1, 2, 3])
  })

  it('does not accept a drag released after a pause and resume', () => {
    let active = true
    const s = mount(0, { isActive: () => active })
    pointer(s.hit, 'pointerdown', s.flowerPoint('tray-flowers-0'))
    active = false; s.run(0.1)
    active = true; pointer(s.hit, 'pointerup', s.target()); s.run()
    for (let i = 0; i < 3; i++) s.tap()
    expect(s.progress).toEqual([])
  })

  it('completes without waiting for decorative animation under reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true })
    for (let i = 0; i < 4; i++) s.button.click()
    expect(s.progress).toEqual([1])
    s.button.click()
    expect(s.progress).toEqual([1, 2])
    s.write('谢谢你一直支持我')
    expect(s.progress).toEqual([1, 2, 3])
    expect(s.complete).toHaveBeenCalledTimes(1)
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢你一直支持我')
  })

  it('moves the flower ring to the pedestal when dragged, then saves the written thanks once', () => {
    const s = mount(2)
    const destination = s.target()
    swipe(s.hit, s.flowerPoint('ring-flowers-0'), destination); s.run()
    expect(s.progress).toEqual([])
    expect(s.obj('garland').position.y).toBeLessThan(1.25)
    s.write('   ')
    expect(s.saveWish).not.toHaveBeenCalled()
    s.write('  谢谢这一天  '); s.run(); s.write('再写一次')
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('谢谢这一天')
    expect(s.progress).toEqual([3])
    expect(s.complete).toHaveBeenCalledTimes(1)
  })

  it('closes the tie only after a flower drag reaches the top knot', () => {
    const s = mount(1)
    const from = () => s.flowerPoint('ring-flowers-0')
    const knot = s.target()
    swipe(s.hit, from(), [5, 5]); s.run()
    expect(s.progress).toEqual([])
    pointer(s.hit, 'pointerdown', from())
    pointer(s.hit, 'pointermove', midway(from(),knot))
    pointer(s.hit, 'pointercancel', knot); s.run()
    expect(s.progress).toEqual([])
    swipe(s.hit, from(), knot); s.run()
    expect(s.progress).toEqual([2])
    expect(s.overlay.querySelector('.scene-wish-slot')?.hasAttribute('hidden')).toBe(false)
  })

  it('does not place or save a canceled ring drag onto the pedestal', () => {
    const s = mount(2)
    const before = s.obj('garland').position.clone()
    const to = s.target()
    pointer(s.hit, 'pointerdown', s.flowerPoint('ring-flowers-0'))
    pointer(s.hit, 'pointermove', midway(s.flowerPoint('ring-flowers-0'),to))
    pointer(s.hit, 'pointercancel', to); s.run()
    expect(s.obj('garland').position.equals(before)).toBe(true)
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
    expect(s.progress).toEqual([])
  })

  it.each([
    { initial: 1, taps: 2, expected: [2, 3] },
    { initial: 2, taps: 1, expected: [3] },
    { initial: 3, taps: 1, expected: [] },
  ])('continues restored checkpoint $initial without replaying earlier steps', ({ initial, taps, expected }) => {
    const s = mount(initial)
    for (let i = 0; i < taps; i++) s.tap()
    expect(s.progress).toEqual(expected)
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).toHaveBeenCalledTimes(initial === 3 ? 0 : 1)
  })

  it('lets a host without wish storage complete the handwritten gratitude step', () => {
    const s = mount(2, { saveWish: undefined })
    expect(s.overlay.querySelector('.wish-write-meta')?.textContent).toContain('不会保存')
    s.write('谢谢你'); s.run()
    expect(s.progress).toEqual([3])
    expect(s.complete).toHaveBeenCalledTimes(1)
  })

  it.each([320, 390, 430])('keeps the whole ring and both tassels inside the %ipx portrait stage', (width) => {
    const s = mount(2, { isReducedMotion: () => true }, width)
    const box = new THREE.Box3().setFromObject(s.obj('garland'))
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const [px, py] = s.project(new THREE.Vector3(x, y, z))
      expect(px).toBeGreaterThan(width * 0.03)
      expect(px).toBeLessThan(width * 0.97)
      expect(py).toBeGreaterThan(25)
      expect(py).toBeLessThan(535)
    }
  })

  it('disposes geometry/materials once and removes every active input path', () => {
    const s = mount(2)
    const geometries = new Set<THREE.BufferGeometry>()
    const materials = new Set<THREE.Material>()
    ;(built.scene as THREE.Scene).traverse((obj) => {
      const mesh = obj as THREE.Mesh
      if (mesh.geometry) geometries.add(mesh.geometry)
      if (Array.isArray(mesh.material)) mesh.material.forEach((m) => materials.add(m))
      else if (mesh.material) materials.add(mesh.material)
    })
    const instanceBuffers: THREE.InstancedMesh[] = []
    ;(built.scene as THREE.Scene).traverse((obj) => { if (obj instanceof THREE.InstancedMesh) instanceBuffers.push(obj) })
    const releases = [...geometries, ...materials, ...instanceBuffers].map((resource) => vi.spyOn(resource, 'dispose'))
    const form = s.overlay.querySelector('form')!
    const input = form.querySelector('input')!
    s.instance.dispose(); s.instance.dispose()
    for (const release of releases) expect(release).toHaveBeenCalledTimes(1)
    s.button.click(); input.value = '谢谢'; form.dispatchEvent(new Event('submit', { cancelable: true }))
    s.run()
    expect(s.overlay.childElementCount).toBe(0)
    expect(s.progress).toEqual([])
    expect(s.saveWish).not.toHaveBeenCalled()
    expect(s.complete).not.toHaveBeenCalled()
  })
})

describe('flower placement in screen space',()=>{
  it('accepts a sixteen pixel correction beside the visible marker at every cluster',()=>{
    const s=mount(0,{isReducedMotion:()=>true});
    for(let n=0;n<4;n++){
      const a=s.flowerPoint(`tray-flowers-${n}`),b=s.target(),near:Point=[b[0]+16,b[1]];
      pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',near);
      expect(s.obj('cluster-'+n).scale.x).toBe(1);
      pointer(s.hit,'pointerup',near);s.run();
    }
    expect(s.progress).toEqual([1]);
  });
});

it.each([390,1280])('keeps each physical cluster drop playable at %ipx by 408px',width=>{
  const s=mount(0,{isReducedMotion:()=>true},width,408);
  for(let n=0;n<4;n++){
    const a=s.flowerPoint(`tray-flowers-${n}`),b=s.target();
    pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',b);

    expect(s.obj('cluster-'+n).scale.x).toBe(1);
    pointer(s.hit,'pointerup',b);s.run();
  }
  expect(s.progress).toEqual([1]);
});

it.each(['pointercancel', 'blur', 'pause'])('clears flower readiness after %s and keeps the current cluster', reason => {let active=true;const s=mount(0,{isActive:()=>active,isReducedMotion:()=>true}),from=s.flowerPoint('tray-flowers-0'),to=midway(from,s.target());pointer(s.hit,'pointerdown',from);pointer(s.hit,'pointermove',to);if(reason==='blur')window.dispatchEvent(new Event('blur'));else if(reason==='pause'){active=false;s.run(.05)}else pointer(s.hit,'pointercancel',to);pointer(s.hit,'pointerup',to);s.run();expect(s.progress).toEqual([]);expect(s.obj('cluster-0').scale.x).toBe(.52)})

function midway(a:readonly number[],b:readonly number[]):[number,number]{return[a[0]+(b[0]-a[0])*.2,a[1]+(b[1]-a[1])*.2]}
