// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext } from '../contract'
import { createInteractionCues, type InteractionCue } from '@wbr/scene-runtime/interaction-cues'

// Only the GPU boundary is replaced. Geometry, raycasts, cues, ownership and the form are real.
vi.mock('three', async importOriginal => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const drawn = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null, renderer: null as THREE.WebGLRenderer | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    Object.assign(drawn, { renderer, scene, camera })
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
  },
}))
import { createHongshengRedString } from './scene'
const live: ReturnType<typeof createHongshengRedString>[] = []
afterEach(() => { live.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
type Point = [number, number]
function mount(initialProgress = 0, extra: Partial<SceneContext> = {}, width = 390, height = 520) {
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 17, top: 91, width, height, right: width + 17, bottom: height + 91 }) as DOMRect
  const progress: number[] = [], saveWish = vi.fn(), complete = vi.fn(), haptic = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = createHongshengRedString({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), saveWish, haptic, isSoundEnabled: () => false, ...extra })
  live.push(instance); instance.start()
  const scene = drawn.scene!, camera = drawn.camera!
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!, button = overlay.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (hit) { hit.setPointerCapture = vi.fn(); hit.releasePointerCapture = vi.fn() }
  const run = (seconds = 1.7) => { for (let t = 0; t < seconds; t += .025) instance.update(.025) }
  const object = (name: string) => { const obj = scene?.getObjectByName(name); expect(obj, `${name} must be visible geometry`).toBeDefined(); return obj! }
  const point = (name: string, anchor: [number, number, number] = [0, 0, 0]): Point => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const p = object(name).localToWorld(new THREE.Vector3(...anchor)).project(camera)
    return [17 + (p.x + 1) * width / 2, 91 + (1 - p.y) * height / 2]
  }
  const write = (line: string) => { const input = overlay.querySelector<HTMLInputElement>('input')!; input.value = line; input.form!.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })) }
  run(.025)
  return { instance, scene, camera, canvas, host, overlay, hit, button, run, object, point, write, progress, saveWish, complete, haptic, width, height }
}
type Mounted = ReturnType<typeof mount>
function pointer(target: EventTarget, type: string, [clientX, clientY]: Point, pointerId = 1, extra: Record<string, unknown> = {}) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1, ...extra }); target.dispatchEvent(e)
}
function wind(s: Mounted, finish = 'pointerup') {
  pointer(s.hit, 'pointerdown', s.point('red-string-tip'))
  for (let i = 1; i <= 12; i++) pointer(s.hit, 'pointermove', s.point(`red-string-guide-${i}`))
  pointer(s.hit, finish, s.point('red-string-guide-12')); s.run()
}
function clasp(s: Mounted, target = 'red-string-clasp-socket', finish = 'pointerup') {
  const from = s.point('red-string-clasp-head'), to = s.point(target)
  pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, finish, to); s.run()
}
function tap(s: Mounted) { const p = s.point('red-string-quiet-strand'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p); s.run() }
function cues(s: Mounted) { const out: InteractionCue[] = []; s.scene.traverse(o => out.push(...(o.userData.interactionCues ?? []))); return out.filter(c => c.enabled()) }
function frontHit(s: Mounted, point: Point) {
  s.scene.updateMatrixWorld(true); s.camera.updateMatrixWorld(true)
  const ray = new THREE.Raycaster(); ray.setFromCamera(new THREE.Vector2((point[0] - 17) / s.width * 2 - 1, 1 - (point[1] - 91) / s.height * 2), s.camera)
  return ray.intersectObjects(s.scene.children, true).find(hit => {
    for (let o: THREE.Object3D | null = hit.object; o; o = o.parent) if (!o.visible) return false
    const material = (hit.object as THREE.Mesh).material as THREE.Material
    return material && material.visible && material.opacity > .1
  })?.object
}

describe('red string self-care handwork', () => {
  it('presents the winding and personal-note prompts beside the spool and upright holder', () => {
    const s = mount()
    expect(s.overlay.textContent).toContain('绕线成环'); expect(s.overlay.textContent).toContain('留句心意')
    expect(s.overlay.textContent).toContain('照看自己')
    expect(s.object('red-string-spool').children.length).toBeGreaterThan(2)
    expect(s.object('red-string-upright-holder').children.length).toBeGreaterThan(2)
    expect(frontHit(s, s.point('red-string-tip'))?.name).toBe('red-string-tip')
  })
  it.each([[320, 228], [390, 350], [320, 520], [390, 520], [1280, 408]])('uses actual visible cue targets for the full winding, clasp and quiet tap at %i × %ipx', (width, height) => {
    const s = mount(0, {}, width, height), view = createInteractionCues(s.canvas, s.scene, s.camera)
    const cuePoint = (role: string): Point => {
      view.update(); const el = s.host.querySelector<HTMLElement>(`.scene-object-cue[data-cue-role="${role}"]`)!
      expect(el).not.toBeNull(); const x = Number(el.dataset.x), y = Number(el.dataset.y)
      expect(x).toBeGreaterThan(15); expect(x).toBeLessThan(width - 15); expect(y).toBeGreaterThan(45); expect(y).toBeLessThan(height - 30)
      return [17 + x, 91 + y]
    }
    pointer(s.hit, 'pointerdown', cuePoint('source'))
    for (let i = 0; i < 12; i++) { const p = cuePoint('target'); expect(frontHit(s, p)?.name).toBe(`red-string-guide-${i + 1}`); pointer(s.hit, 'pointermove', p) }
    pointer(s.hit, 'pointerup', cuePoint('target')); s.run(); expect(s.progress).toEqual([1])
    const from = cuePoint('source'), to = cuePoint('target')
    expect(frontHit(s, from)?.name).toBe('red-string-clasp-head'); expect(frontHit(s, to)?.name).toBe('red-string-clasp-socket')
    pointer(s.hit, 'pointerdown', from); pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([1, 2])
    const p = cuePoint('source'); expect(frontHit(s, p)?.name).toBe('red-string-quiet-strand')
    pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointerup', p); s.run(); expect(s.progress).toEqual([1, 2, 3])
    view.update(); expect(s.host.querySelectorAll('.scene-object-cue')).toHaveLength(0); view.dispose()
    expect(s.complete).toHaveBeenCalledOnce(); expect(s.saveWish).not.toHaveBeenCalled()
  })
  it('rejects a shortcut, a large chord, reversed winding and an off-holder endpoint jump', () => {
    const s = mount()
    for (const sequence of [[12], [1, 5, 6, 7, 8, 9, 10, 11, 12], [12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1]]) {
      pointer(s.hit, 'pointerdown', s.point('red-string-tip'))
      sequence.forEach(i => pointer(s.hit, 'pointermove', s.point(`red-string-guide-${i}`)))
      pointer(s.hit, 'pointerup', s.point('red-string-guide-12')); s.run(); expect(s.progress).toEqual([])
    }
    pointer(s.hit, 'pointerdown', s.point('red-string-tip')); pointer(s.hit, 'pointermove', [1, 1])
    pointer(s.hit, 'pointermove', s.point('red-string-guide-12'))
    pointer(s.hit, 'pointerup', s.point('red-string-guide-12')); s.run(); expect(s.progress).toEqual([])
    wind(s); expect(s.progress).toEqual([1])
  })
  it('rejects empty starts, the wrong clasp destination, empty-ring taps and out-and-back taps', () => {
    const s = mount()
    pointer(s.hit, 'pointerdown', [1, 1]); pointer(s.hit, 'pointerup', s.point('red-string-guide-12')); s.run(); expect(s.progress).toEqual([])
    wind(s); clasp(s, 'red-string-spool'); expect(s.progress).toEqual([1]); clasp(s); expect(s.progress).toEqual([1, 2])
    const empty = s.point('red-string-upright-holder'); pointer(s.hit, 'pointerdown', empty); pointer(s.hit, 'pointerup', empty); expect(s.progress).toEqual([1, 2])
    const p = s.point('red-string-quiet-strand'); pointer(s.hit, 'pointerdown', p); pointer(s.hit, 'pointermove', [p[0] + 40, p[1]]); pointer(s.hit, 'pointermove', p); pointer(s.hit, 'pointerup', p)
    expect(s.progress).toEqual([1, 2]); tap(s); expect(s.progress).toEqual([1, 2, 3])
  })
  it.each(['pointercancel', 'lostpointercapture', 'blur', 'pause'])('cancels unfinished winding on %s without retaining partial progress', event => {
    let active = true
    const s = mount(0, { isActive: () => active }), start = s.point('red-string-tip')
    pointer(s.hit, 'pointerdown', start)
    for (let i = 1; i <= 5; i++) pointer(s.hit, 'pointermove', s.point(`red-string-guide-${i}`))
    if (event === 'blur') window.dispatchEvent(new Event('blur'))
    else if (event === 'pause') { active = false; s.run(); active = true }
    else pointer(s.hit, event, s.point('red-string-guide-5'))
    pointer(s.hit, 'pointerup', s.point('red-string-guide-12')); s.run(); expect(s.progress).toEqual([]); expect(s.point('red-string-tip')).toEqual(start)
    if (event === 'blur') window.dispatchEvent(new Event('focus'))
    wind(s); expect(s.progress).toEqual([1])
  })
  it.each(['outside-first', 'outside-second', 'object-second'])('blocks %s multitouch and auxiliary activation during ownership', mode => {
    const s = mount(), start = s.point('red-string-tip')
    if (mode === 'outside-first') pointer(document.body, 'pointerdown', [1, 1], 2)
    pointer(s.hit, 'pointerdown', start)
    if (mode === 'outside-second') pointer(document.body, 'pointerdown', [1, 1], 2)
    if (mode === 'object-second') pointer(s.hit, 'pointerdown', start, 2)
    s.button.click()
    for (let i = 1; i <= 12; i++) pointer(s.hit, 'pointermove', s.point(`red-string-guide-${i}`))
    pointer(s.hit, 'pointerup', s.point('red-string-guide-12')); pointer(document.body, 'pointerup', start, 2); s.run(); expect(s.progress).toEqual([])
    wind(s); expect(s.progress).toEqual([1])
  })
  it('saves only explicit nonempty trimmed submission once and ignores an unsubmitted quiet draft', () => {
    const s = mount(2); s.write('  '); expect(s.progress).toEqual([]); s.write('  记得照看自己  '); s.write('再写一次'); s.button.click()
    expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('记得照看自己'); expect(s.progress).toEqual([3]); expect(s.complete).toHaveBeenCalledOnce()
    const quiet = mount(2); quiet.overlay.querySelector<HTMLInputElement>('input')!.value = '未提交的照看'; tap(quiet)
    expect(quiet.saveWish).not.toHaveBeenCalled(); expect(quiet.progress).toEqual([3])
  })
  it.each([0, 1, 2, 3])('restores checkpoint %i silently and keeps returning visits free of new wishes', initial => {
    for (const returning of [false, true]) {
      const s = mount(initial, { returning }); s.run()
      expect(s.progress).toEqual([]); expect(s.complete).not.toHaveBeenCalled(); expect(s.saveWish).not.toHaveBeenCalled(); expect(s.haptic).not.toHaveBeenCalled()
      expect(cues(s).map(c => c.kind)).toEqual(initial < 2 ? ['drag'] : initial === 2 ? ['tap'] : [])
      expect(s.button.hidden).toBe(initial === 3)
      expect(s.overlay.querySelector<HTMLElement>('.scene-wish-slot')!.hidden).toBe(returning || initial !== 2)
      if (returning) expect(s.overlay.querySelector('input')).toBeNull()
      if (returning && initial === 2) { tap(s); expect(s.progress).toEqual([3]); expect(s.saveWish).not.toHaveBeenCalled() }
    }
  })
  it('uses each native keyboard action once and freezes accepted motion while unfocused', () => {
    const s = mount(); expect(s.button.type).toBe('button'); s.button.focus(); expect(document.activeElement).toBe(s.button)
    s.button.click(); s.button.click(); s.run(.2); const before = s.object('red-string-tip').position.clone()
    window.dispatchEvent(new Event('blur')); s.run(3); expect(s.object('red-string-tip').position.equals(before)).toBe(true); expect(cues(s)).toEqual([])
    window.dispatchEvent(new Event('focus')); s.run(); expect(s.progress).toEqual([1])
    s.button.click(); s.button.click(); s.run(); expect(s.progress).toEqual([1, 2]); s.button.click(); s.button.click(); expect(s.progress).toEqual([1, 2, 3])
    expect(s.saveWish).not.toHaveBeenCalled(); expect(s.complete).toHaveBeenCalledOnce()
  })
  it('supports all physical and keyboard actions with reduced motion', () => {
    const s = mount(0, { isReducedMotion: () => true }); wind(s); clasp(s); tap(s); expect(s.progress).toEqual([1, 2, 3])
    const keys = mount(0, { isReducedMotion: () => true }); keys.button.click(); keys.button.click(); keys.button.click(); expect(keys.progress).toEqual([1, 2, 3])
  })
  it('blocks the wish form and buttons during owned pointers, pause and blur', () => {
    let active = true
    const s = mount(2, { isActive: () => active })
    pointer(document.body, 'pointerdown', [1, 1]); s.write('占用中'); s.button.click(); expect(s.progress).toEqual([]); pointer(document.body, 'pointerup', [1, 1])
    active = false; s.run(); s.write('暂停中'); s.button.click(); expect(s.progress).toEqual([])
    active = true; s.run(); window.dispatchEvent(new Event('blur')); s.write('失焦中'); s.button.click(); expect(s.progress).toEqual([])
    window.dispatchEvent(new Event('focus')); s.write('回来照看自己'); expect(s.progress).toEqual([3]); expect(s.saveWish).toHaveBeenCalledExactlyOnceWith('回来照看自己')
  })
  it('restores a cancelled clasp and does not let another finger release the owned strand', () => {
    const s = mount(1), initial = s.point('red-string-clasp-head'); clasp(s, 'red-string-clasp-socket', 'pointercancel')
    expect(s.progress).toEqual([]); expect(s.point('red-string-clasp-head')).toEqual(initial)
    const to = s.point('red-string-clasp-socket'); pointer(s.hit, 'pointerdown', initial); pointer(s.hit, 'pointermove', to, 2); pointer(s.hit, 'pointerup', to, 2); s.run(); expect(s.progress).toEqual([])
    pointer(s.hit, 'pointermove', to); pointer(s.hit, 'pointerup', to); s.run(); expect(s.progress).toEqual([2])
  })
  it('keeps the visible tail attached to the moving clasp and restores it on cancellation', () => {
    const s = mount(1), start = s.point('red-string-clasp-head')
    const terminal = () => {
      const tail = s.object('red-string-clasp-tail') as THREE.Mesh<THREE.TubeGeometry>
      const vertices = tail.geometry.getAttribute('position'), p = new THREE.Vector3()
      for (let i = vertices.count - 9; i < vertices.count - 1; i++) p.add(new THREE.Vector3().fromBufferAttribute(vertices, i))
      return tail.localToWorld(p.multiplyScalar(1 / 8))
    }
    const old = terminal()
    pointer(s.hit, 'pointerdown', start); pointer(s.hit, 'pointermove', [start[0] - 25, start[1] - 35])
    expect(terminal().distanceTo(s.object('red-string-clasp-head').getWorldPosition(new THREE.Vector3()))).toBeLessThan(.005)
    expect(terminal().distanceTo(old)).toBeGreaterThan(.1)
    pointer(s.hit, 'pointercancel', start); expect(terminal().distanceTo(old)).toBeLessThan(.005); expect(s.progress).toEqual([])
  })
  it('claims only actual geometry touches and rejects secondary or nonprimary starts', () => {
    const s = mount(), start = s.point('red-string-tip')
    const touch = (p: Point) => { const e = new Event('touchstart', { cancelable: true }); Object.assign(e, { changedTouches: [{ clientX: p[0], clientY: p[1] }] }); s.hit.dispatchEvent(e); return e.defaultPrevented }
    expect(touch([1, 1])).toBe(false); expect(touch(start)).toBe(true)
    for (const extra of [{ button: 2 }, { isPrimary: false }]) {
      pointer(s.hit, 'pointerdown', start, 1, extra)
      for (let i = 1; i <= 12; i++) pointer(s.hit, 'pointermove', s.point(`red-string-guide-${i}`))
      pointer(s.hit, 'pointerup', s.point('red-string-guide-12')); s.run(); expect(s.progress).toEqual([])
    }
    wind(s); expect(s.progress).toEqual([1])
  })
  it('disposes mesh resources, lights, renderer and matched input listeners exactly once', () => {
    const added = vi.spyOn(window, 'addEventListener'), removed = vi.spyOn(window, 'removeEventListener')
    const s = mount(), resources = new Set<{ dispose(): void }>()
    s.scene.traverse(o => { const m = o as THREE.Mesh; if (m.geometry) resources.add(m.geometry); if (m.material) (Array.isArray(m.material) ? m.material : [m.material]).forEach(r => resources.add(r)); if ((o as THREE.Light).isLight) resources.add(o as THREE.Light); if ((o as THREE.DirectionalLight).shadow) resources.add((o as THREE.DirectionalLight).shadow) })
    const spies = [...resources].map(r => vi.spyOn(r, 'dispose')), rd = vi.spyOn(drawn.renderer!, 'dispose'), gl = vi.spyOn(drawn.renderer!, 'forceContextLoss')
    s.instance.dispose(); s.instance.dispose(); spies.forEach(spy => expect(spy).toHaveBeenCalledOnce()); expect(rd).toHaveBeenCalledOnce(); expect(gl).toHaveBeenCalledOnce()
    for (const call of added.mock.calls.filter(([t]) => t.startsWith('pointer') || t === 'blur' || t === 'focus')) expect(removed.mock.calls.some(r => r[0] === call[0] && r[1] === call[1] && r[2] === call[2])).toBe(true)
    s.button.click(); s.instance.update(5); expect(s.progress).toEqual([]); expect(s.overlay.childElementCount).toBe(0); expect(s.scene.children).toHaveLength(0)
  })
})

describe('continuous winding path tolerance',()=>{
  it.each([12,16,24,60].flatMap(count=>[0,.5].map(phase=>[count,phase])))('accepts %i circle samples with phase %s',(count,phase)=>{
    const s=mount(0,{isReducedMotion:()=>true})
    const at=(t:number,r=.64):Point=>{const p=new THREE.Vector3(.3+Math.sin(t*Math.PI*2)*r,1.15-Math.cos(t*Math.PI*2)*r,.31).project(s.camera);return[17+(p.x+1)*s.width/2,91+(1-p.y)*s.height/2]}
    pointer(s.hit,'pointerdown',s.point('red-string-tip'))
    for(let i=phase?0:1;i+phase<count;i++)pointer(s.hit,'pointermove',at((i+phase)/count))
    pointer(s.hit,'pointermove',at(1))
    expect(s.overlay.querySelector('.scene-hint')?.getAttribute('data-progress')).toBe('true')
    pointer(s.hit,'pointerup',at(1));expect(s.progress).toEqual([1])
    expect(s.overlay.querySelector('.scene-hint')?.hasAttribute('data-progress')).toBe(false)
  })
  it('retains winding after a short excursion returns to the groove',()=>{
    const s=mount(0,{isReducedMotion:()=>true});pointer(s.hit,'pointerdown',s.point('red-string-tip'))
    for(let i=1;i<=12;i++){
      if(i===6){const p=new THREE.Vector3(.3,1.99,.31).project(s.camera);pointer(s.hit,'pointermove',[17+(p.x+1)*s.width/2,91+(1-p.y)*s.height/2])}
      pointer(s.hit,'pointermove',s.point(`red-string-guide-${i}`))
    }
    pointer(s.hit,'pointerup',s.point('red-string-guide-12'));expect(s.progress).toEqual([1])
  })
})


it('allows a nearby finger to pick up the visible red cord end',()=>{
 const s=mount(0,{isReducedMotion:()=>true}),a=s.point('red-string-tip')
 pointer(s.hit,'pointerdown',[a[0]+18,a[1]+10])
 for(let i=1;i<=12;i++)pointer(s.hit,'pointermove',s.point(`red-string-guide-${i}`))
 pointer(s.hit,'pointerup',s.point('red-string-guide-12'));expect(s.progress).toEqual([1])
})

it('accepts a nearby release after covering the entire winding path',()=>{
 const s=mount(0,{isReducedMotion:()=>true});pointer(s.hit,'pointerdown',s.point('red-string-tip'))
 for(let i=1;i<=12;i++)pointer(s.hit,'pointermove',s.point(`red-string-guide-${i}`))
 const end=s.point('red-string-guide-12');pointer(s.hit,'pointerup',[end[0]+18,end[1]]);expect(s.progress).toEqual([1])
})
