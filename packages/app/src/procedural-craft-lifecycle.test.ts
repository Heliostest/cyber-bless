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
  ['malawi-sansi', 0, 'sansi-tine-4', 'sansi-tine-4', [0, .02, -.035], [0, .02, -.035], [0, 60]],
  ['japanese-kendama', 0, 'kendama-handle', 'kendama-handle', [0, .5, .1], [0, .5, .1], [0, -60]],
  ['indian-charkha', 0, 'charkha-cotton', 'charkha-cotton', [0, .5, .4], [0, .5, .4], [-60, 0]],
  ['german-nutcracker', 0, 'nutcracker-lever', 'nutcracker-lever', [0, -.66, -1.03], [0, -.66, -1.03], [0, -60]],
  ['mexican-molinillo', 0, 'molinillo-handle', 'molinillo-handle', [0, .15, 0], [0, .15, 0], [0, 60]],
  ['chinese-suanpan', 0, 'abacus-lower-6-2', 'abacus-lower-6-2', [0, .11, 0], [0, .11, 0], [0, -60]],
  ['mongolian-felt-ger', 0, 'ger-lattice-grip', 'ger-lattice-grip', [0, .06, .042], [0, .06, .042], [60, 0]],
  ['peruvian-engraved-gourd', 0, 'gourd-shell', 'gourd-shell', [-.3295899491, 1.05, .7697097123], [-.3295899491, 1.05, .7697097123], [60, 0]],
  ['peruvian-engraved-gourd', 1, 'gourd-shell', 'gourd-shell', [.2190522043, 1.55, .4549356620], [.2190522043, 1.55, .4549356620], [0, 60]],
  ['peruvian-engraved-gourd', 2, 'gourd-shell', 'gourd-shell', [.1156681796, 1.25, .7614644589], [.1156681796, 1.25, .7614644589]],
  ['venetian-glass-bead', 0, 'glass-mandrel-grip', 'glass-mandrel-grip', [0, .035, .055], [0, .035, .055], [0, -60]],
  ['venetian-glass-bead', 1, 'glass-hero-bead', 'glass-hero-bead', [0, .20, .43], [0, .20, .43], [60, 0]],
  ['venetian-glass-bead', 2, 'glass-hero-bead', 'glass-hero-bead', [0, .20, .43], [0, .20, .43]],
  ['korean-bojagi-wrap', 0, 'bojagi-near-corner', 'bojagi-near-corner', [0, .012, 0], [0, .012, 0], [0, -60]],
  ['korean-bojagi-wrap', 1, 'bojagi-band-right-tip', 'bojagi-band-right-tip', [0, .012, 0], [0, .012, 0], [60, 0]],
  ['korean-bojagi-wrap', 2, 'bojagi-cloth', 'bojagi-cloth', [.031098, .452587, .590862], [.031098, .452587, .590862]],
  ['vietnamese-bamboo-dragonfly', 0, 'dragonfly-head', 'dragonfly-head', [0, .035, .13], [0, .035, .13], [0, -60]],
  ['vietnamese-bamboo-dragonfly', 1, 'dragonfly-wing-front-right', 'dragonfly-wing-front-right', [1.18, -.14, .545], [1.18, -.14, .545], [60, 0]],
  ['vietnamese-bamboo-dragonfly', 2, 'dragonfly-head', 'dragonfly-head', [0, .035, .13], [0, .035, .13]],
  ['turkish-ebru-paper', 0, 'ebru-comb-grip', 'ebru-comb-grip', [0, 0, .09], [0, 0, .09], [60, 0]],
  ['turkish-ebru-paper', 1, 'ebru-paper-edge', 'ebru-paper-edge', [0, .021, -.05], [0, .021, -.05], [0, -60]],
  ['turkish-ebru-paper', 2, 'ebru-paper-print', 'ebru-paper-print', [0, 1.6, .28], [0, 1.6, .28]],
  ['indonesian-angklung', 0, 'angklung-frame-grip', 'angklung-frame-grip', [0, 0, .10], [0, 0, .10], [-60, 0]],
  ['indonesian-angklung', 1, 'angklung-frame-grip', 'angklung-frame-grip', [0, 0, .10], [0, 0, .10], [60, 0]],
  ['indonesian-angklung', 2, 'angklung-tube-long-body', 'angklung-tube-long-body', [0, .7, .19], [0, .7, .19]],
  ['chinese-shadow-puppet', 0, 'shadow-main-grip', 'shadow-main-grip', [0, 0, .075], [0, 0, .075], [0, -60]],
  ['chinese-shadow-puppet', 1, 'shadow-wing-grip', 'shadow-wing-grip', [0, 0, .075], [0, 0, .075], [60, 0]],
  ['chinese-shadow-puppet', 2, 'shadow-bird-body', 'shadow-bird-body', [.16, 0, .028], [.16, 0, .028]],
  ['weifang-paper-kite', 0, 'kite-paper-right', 'kite-paper-right', [1.05, .34, .012], [1.05, .34, .012], [-48, -36]],
  ['weifang-paper-kite', 1, 'kite-reel-grip', 'kite-reel-grip', [0, 0, .075], [0, 0, .075], [0, 60]],
  ['weifang-paper-kite', 2, 'kite-body-paper', 'kite-body-paper', [.08, .22, .014], [.08, .22, .014]],
  ['faroese-wool-knit', 0, 'wool-right-needle-grip', 'wool-right-needle-grip', [0, 0, .047], [0, 0, .047], [-48, -36]],
  ['faroese-wool-knit', 1, 'wool-right-needle-grip', 'wool-right-needle-grip', [0, 0, .047], [0, 0, .047], [42, 46]],
  ['faroese-wool-knit', 2, 'wool-stitch-3-3', 'wool-stitch-3-3', [.046, .025, .202], [.046, .025, .202]],
  ['niue-shell-necklace', 0, 'shell-last-body', 'shell-last-body', [.0125, 0, .07848191718467962], [.0125, 0, .07848191718467962], [-60, 0]],
  ['niue-shell-necklace', 1, 'shell-cord-grip', 'shell-cord-grip', [0, 0, .018], [0, 0, .018], [0, -60]],
  ['niue-shell-necklace', 2, 'shell-strand-24-body', 'shell-strand-24-body', [.0125, 0, .07848191718467962], [.0125, 0, .07848191718467962]],
  ['polish-paper-cut', 0, 'paper-scissors-grip', 'paper-scissors-grip', [0, 0, 0], [0, 0, 0], [0, -64]],
  ['polish-paper-cut', 1, 'paper-folded-half', 'paper-folded-half', [.84, .20, .016], [.84, .20, .016], [-72, 0]],
  ['polish-paper-cut', 2, 'paper-fixed-half', 'paper-fixed-half', [.32, .59, .016], [.32, .59, .016]],
  ['uzbek-clay-bowl', 0, 'clay-wheel-rim', 'clay-wheel-rim', [0, -.025, 1.079], [0, -.025, 1.079], [70, 0]],
  ['uzbek-clay-bowl', 1, 'clay-body', 'clay-body', [0, .2675, .5172792206135786], [0, .2675, .5172792206135786], [0, -70]],
  ['uzbek-clay-bowl', 2, 'clay-body', 'clay-body', [0, .5525, .6197334941505714], [0, .5525, .6197334941505714]],
  ['chinese-woodblock-print', 2, 'woodblock-print-face', 'woodblock-print-face'],
  ['czech-bead-star', 0, 'bead-strand-grip', 'bead-star-arm-joint'],
  ['fijian-woven-fan', 0, 'fan-binding-grip', 'fan-neck-joint'],
  ['amazigh-woven-rug', 0, 'rug-shuttle-grip', 'rug-weft-gap'],
  ['slovak-wire-bird', 0, 'wire-wing-grip', 'wire-shoulder-joint'],
  ['hungarian-embroidery-hoop', 0, 'hoop-spool-cap', 'hoop-linen', [.25, .017, .22]],
  ['andalusian-ceramic-tile', 0, 'tile-loose-grip', 'tile-empty-seat'],
  ['sicilian-painted-cart', 0, 'cart-wheel-hub', 'cart-axle-end'],
  ['bai-indigo-cloth', 0, 'indigo-bundle-body', 'indigo-rinse-water'],
  ['purepecha-copper-bowl', 0, 'copper-polishing-pad', 'copper-bowl-shell', [0, .43, .705]],
  ['welsh-love-spoon', 0, 'spoon-cloth-grip', 'spoon-bowl'],
  ['ndebele-painted-house', 0, 'house-color-panel', 'house-facade-slot'],
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
] as const)('cancels %s through host pause and accepts a fresh gesture', async (id, progress, source, target, targetAnchor: readonly number[] = [0, 0, 0], sourceAnchor: readonly number[] = [0, 0, 0], screenDelta?: readonly number[]) => {
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
  const point = (name: string, anchor: readonly number[] = [0, 0, 0]) => {
    rendered.scene!.updateMatrixWorld(true); rendered.camera!.updateMatrixWorld(true)
    const p = rendered.scene!.getObjectByName(name)!.localToWorld(new THREE.Vector3(anchor[0], anchor[1], anchor[2])).project(rendered.camera!)
    return [(p.x+1)*180, (1-p.y)*180]
  }
  const destination = (from: number[]) => screenDelta ? [from[0] + screenDelta[0], from[1] + screenDelta[1]] : point(target, targetAnchor)
  const from = point(source, sourceAnchor), staleEnd = destination(from)
  pointer(hit,'pointerdown',from)
  if (screenDelta) pointer(hit,'pointermove',[from[0] + screenDelta[0] * .35, from[1] + screenDelta[1] * .35])
  ctrl.setActive(false); ctrl.setActive(true)
  pointer(hit,'pointerup',staleEnd); expect(checkpoint).not.toHaveBeenCalled()
  const freshFrom = point(source, sourceAnchor), freshEnd = destination(freshFrom)
  pointer(hit,'pointerdown',freshFrom); pointer(hit,'pointermove',freshEnd); pointer(hit,'pointerup',freshEnd)
  expect(checkpoint).toHaveBeenCalledExactlyOnceWith(progress+1)
})
