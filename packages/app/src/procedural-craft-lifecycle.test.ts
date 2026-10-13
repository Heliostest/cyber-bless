// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle: (_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) => {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, dispose() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) } }
  }
}))
import { proceduralEngine } from './procedural-scene'
const controllers: { dispose(): void }[] = []
afterEach(() => { controllers.splice(0).forEach(c => c.dispose()); document.body.replaceChildren(); vi.restoreAllMocks(); vi.unstubAllGlobals() })
function pointer(el: HTMLElement, type: string, p: number[], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: p[0], clientY: p[1], pointerId, isPrimary: pointerId === 1, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 })
  el.dispatchEvent(e)
}
it('cancels a real Daruma gesture through production adapter pause/resume', async () => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 360 } as DOMRect)
  const host = document.createElement('div'); document.body.append(host)
  const checkpoint = vi.fn(), engine = await proceduralEngine('daruma-eye-painting')
  const ctrl = engine.create(host, { progress: 0, sceneId: 'daruma-eye-painting', checkpoint, isSoundEnabled: () => false }, { active: true, reducedMotion: true, signal: new AbortController().signal, ready() {}, failed(error) { throw error } })
  controllers.push(ctrl)
  const scene = rendered.scene!, camera = rendered.camera!
  const hit = host.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
  const p = scene.getObjectByName('daruma-eye-target-first')!.getWorldPosition(new THREE.Vector3()).project(camera)
  const pt = [(p.x + 1) * 180, (1 - p.y) * 180]
  pointer(hit, 'pointerdown', pt)
  ctrl.setActive(false)
  ctrl.setActive(true)
  pointer(hit, 'pointerup', pt)
  expect(checkpoint.mock.calls.map(([n]) => n)).toEqual([])
})

it.each([
  ['barcelos-clay-rooster', 0, 'rooster-brush-grip', 'rooster-paint-surface'],
  ['finnish-birch-basket', 0, 'birch-handle-grip', 'birch-rim-grip'],
  ['croatian-licitar-heart', 0, 'licitar-icing-grip', 'licitar-heart-body'],
  ['catalan-festival-giant', 0, 'giant-rosette-grip', 'giant-lapel'],
  ['basque-sunflower', 0, 'sunflower-center', 'sunflower-center-seat'],
  ['breton-banner', 0, 'banner-hem-tab', 'banner-crossbar-clip'],
  ['sorbian-painted-egg', 0, 'egg-brush-grip', 'egg-paint-surface'],
  ['lithuanian-straw-garden', 0, 'straw-pendant-grip', 'straw-join-bead'],
  ['dalarna-wooden-horse', 0, 'horse-polishing-cloth', 'horse-painted-saddle'],
  ['aland-votive-ship', 0, 'ship-mast-grip', 'ship-mast-socket'],
  ['blang-tea', 0, 'tea-scoop-grip', 'tea-pot-mouth'],
  ['minangkabau-spinning-top', 0, 'top-pull-bead', 'top-pull-anchor'],
  ['chinese-incense', 1, 'incense-paper-grip', 'incense-socket'],
  ['hongsheng-red-string', 1, 'red-string-clasp-head', 'red-string-clasp-socket'],
  ['italian-ex-voto', 0, 'exvoto-brush-tip', 'exvoto-route-origin'],
  ['czech-pilgrim-journal', 0, 'journal-cover-corner', 'journal-cover-rest'],
  ['omikuji', 1, 'omikuji-draw-stick', 'omikuji-draw-target'],
  ['polish-blessing-basket', 1, 'basket-egg-body', 'basket-egg-nest'],
  ['navruz-sumalak', 1, 'navruz-wooden-spoon-bowl', 'navruz-empty-bowl-basin'],
  ['floating-lantern-loy-krathong', 0, 'krathong-flower-source', 'krathong-flower-seat'],
  ['omamori-cycle', 1, 'omamori-pouch-body-coral', 'omamori-clasp'],
  ['shrine-suzu-bell', 2, 'suzu-bell-body', 'suzu-bell-body'],
  ['st-brigids-cross', 1, 'brigid-cross-hit', 'brigid-hang-target'],
  ['bokjori', 1, 'bokjori-scoop-source', 'bokjori-wall-peg'],
  ['ema-votive-plaque', 2, 'ema-plaque-body', 'ema-hang-target'],
  ['clootie-well-rag', 0, 'clootie-rag-handle', 'clootie-water-target'],
  ['diya-oil-lamp', 2, 'diya-held-target', 'diya-plate-target'],
  ['votive-candle-catholic', 0, 'votive-held-target', 'votive-placement-target'],
] as const)('cancels %s through host pause and accepts a fresh gesture', async (id, progress, source, target) => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 360 } as DOMRect)
  const host = document.createElement('div'); document.body.append(host)
  const checkpoint = vi.fn(), engine = await proceduralEngine(id)
  const ctrl = engine.create(host, { progress, sceneId: id, checkpoint, isSoundEnabled: () => false },
    { active: true, reducedMotion: true, signal: new AbortController().signal, ready() {}, failed(error) { throw error } })
  controllers.push(ctrl)
  const hit = host.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const point = (name: string) => {
    rendered.scene!.updateMatrixWorld(true); rendered.camera!.updateMatrixWorld(true)
    const p = rendered.scene!.getObjectByName(name)!.getWorldPosition(new THREE.Vector3()).project(rendered.camera!)
    return [(p.x+1)*180, (1-p.y)*180]
  }
  pointer(hit,'pointerdown',point(source)); ctrl.setActive(false); ctrl.setActive(true)
  pointer(hit,'pointerup',point(target)); expect(checkpoint).not.toHaveBeenCalled()
  pointer(hit,'pointerdown',point(source)); pointer(hit,'pointermove',point(target)); pointer(hit,'pointerup',point(target))
  expect(checkpoint).toHaveBeenCalledExactlyOnceWith(progress+1)
})
