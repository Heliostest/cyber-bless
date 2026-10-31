// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'

// Keep host cancellation and real gesture ownership independent of the ending clock.
// The real helper's completion behavior is covered by the quiet-ending integration suites.
vi.mock('../../scenes/src/quiet-ending', () => ({ createQuietEnding: () => ({
  running: false, completing: true, sync() {}, update() {}, dispose() {},
}) }))
import * as THREE from 'three'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
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
  ['chinese-diabolo', 0, 'diabolo-right-grip', 'diabolo-right-stick', [0, .09, .30], [0, .09, 0], [0, -60]],
  ['korean-yutnori', 0, 'yut-stick-0-shell', 'yut-stick-0', [0, .068, 0], [0, .068, 0], [60, 0]],
  ['russian-matryoshka', 0, 'matryoshka-upper-shell', 'matryoshka-upper', [.04, 2.17, .125], [.04, 2.17, .125], [0, -60]],
  ['japanese-koinobori', 0, 'koinobori-tail', 'koinobori-tail', [.26, .18, .02], [.26, .18, .02], [60, 0]],
  ['indian-charkha', 0, 'charkha-cotton', 'charkha-cotton', [0, .5, .4], [0, .5, .4], [-60, 0]],
  ['german-nutcracker', 0, 'nutcracker-lever', 'nutcracker-lever', [0, -.66, -1.03], [0, -.66, -1.03], [0, -60]],
  ['mexican-molinillo', 0, 'molinillo-handle', 'molinillo-handle', [0, .15, 0], [0, .15, 0], [0, 60]],
  ['chinese-suanpan', 0, 'abacus-lower-6-2', 'abacus-lower-6-2', [0, .11, 0], [0, .11, 0], [0, -60]],
  ['mongolian-felt-ger', 0, 'ger-lattice-grip', 'ger-lattice-drop', [0, .06, .042], [0, .06, .042]],
  ['peruvian-engraved-gourd', 0, 'gourd-shell', 'gourd-shell', [-.3295899491, 1.05, .7697097123], [-.3295899491, 1.05, .7697097123], [60, 0]],
  ['peruvian-engraved-gourd', 1, 'gourd-shell', 'gourd-shell', [.2190522043, 1.55, .4549356620], [.2190522043, 1.55, .4549356620], [0, 60]],
  ['peruvian-engraved-gourd', 2, 'gourd-shell', 'gourd-shell', [.1156681796, 1.25, .7614644589], [.1156681796, 1.25, .7614644589]],
  ['venetian-glass-bead', 0, 'glass-mandrel-grip', 'glass-mandrel-grip', [0, .035, .055], [0, .035, .055], [0, -60]],
  ['venetian-glass-bead', 1, 'glass-hero-bead', 'glass-hero-bead', [0, .20, .43], [0, .20, .43], [60, 0]],
  ['venetian-glass-bead', 2, 'glass-hero-bead', 'glass-hero-bead', [0, .20, .43], [0, .20, .43]],
  ['korean-bojagi-wrap', 0, 'bojagi-near-corner', 'bojagi-drop-0', [0, 0, 0], [0, .012, 0], undefined, 'bojagi-step-0'],
  ['korean-bojagi-wrap', 0, 'bojagi-far-corner', 'bojagi-drop-1', [0, 0, 0], [0, .012, 0], undefined, 'bojagi-step-1'],
  ['korean-bojagi-wrap', 0, 'bojagi-left-corner', 'bojagi-drop-2', [0, 0, 0], [0, .012, 0], undefined, 'bojagi-step-2'],
  ['korean-bojagi-wrap', 0, 'bojagi-right-corner', 'bojagi-drop-3', [0, 0, 0], [0, .012, 0], undefined, 'bojagi-step-3'],
  ['korean-bojagi-wrap', 1, 'bojagi-band-left-tip', 'bojagi-drop-4', [0, 0, 0], [0, .012, 0], undefined, 'bojagi-step-4'],
  ['korean-bojagi-wrap', 1, 'bojagi-band-right-tip', 'bojagi-drop-5', [0, 0, 0], [0, .012, 0], undefined, 'bojagi-step-5'],
  ['vietnamese-bamboo-dragonfly', 0, 'dragonfly-head', 'dragonfly-head', [0, .035, .13], [0, .035, .13], [0, -60]],
  ['vietnamese-bamboo-dragonfly', 1, 'dragonfly-wing-front-right', 'dragonfly-wing-front-right', [1.18, -.14, .545], [1.18, -.14, .545], [60, 0]],
  ['vietnamese-bamboo-dragonfly', 2, 'dragonfly-head', 'dragonfly-head', [0, .035, .13], [0, .035, .13]],
  ['turkish-ebru-paper', 0, 'ebru-comb-grip', 'ebru-comb-grip', [0, 0, .09], [0, 0, .09], [60, 0]],
  ['turkish-ebru-paper', 1, 'ebru-paper-blank', 'ebru-paper-blank', [0, .45, .7125], [0, .45, .7125], [0, -60]],
  ['turkish-ebru-paper', 2, 'ebru-paper-print', 'ebru-paper-print', [0, 1.6, .28], [0, 1.6, .28]],
  ['indonesian-angklung', 0, 'angklung-frame-grip', 'angklung-frame-grip', [0, 0, .10], [0, 0, .10], [-60, 0]],
  ['indonesian-angklung', 1, 'angklung-frame-grip', 'angklung-frame-grip', [0, 0, .10], [0, 0, .10], [60, 0]],
  ['indonesian-angklung', 2, 'angklung-tube-long-body', 'angklung-tube-long-body', [0, .7, .19], [0, .7, .19], [60, 0]],
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
] as const)('cancels %s through host pause and accepts a fresh gesture', async (id, progress, source, target, targetAnchor: readonly number[] = [0, 0, 0], sourceAnchor: readonly number[] = [0, 0, 0], screenDelta?: readonly number[], initialVariant?: string) => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 360 } as DOMRect)
  const host = document.createElement('div'); document.body.append(host)
  const checkpoint = vi.fn(), variant = vi.fn(), engine = await proceduralEngine(id)
  const ctrl = engine.create(host, { progress, sceneId: id, checkpoint, initialVariant, onVariantChange: variant, isSoundEnabled: () => false },
    { active: true, reducedMotion: true, signal: new AbortController().signal, ready() {}, failed(error) { throw error } })
  controllers.push(ctrl)
  const hit = host.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const point = (name: string, anchor: readonly number[] = [0, 0, 0]) => {
    rendered.scene!.updateMatrixWorld(true); rendered.camera!.updateMatrixWorld(true)
    const p = rendered.scene!.getObjectByName(name)!.localToWorld(new THREE.Vector3(anchor[0], anchor[1], anchor[2])).project(rendered.camera!)
    return [(p.x+1)*180, (1-p.y)*180]
  }
  const input = () => {
    const cues: { object: THREE.Object3D; cue: InteractionCue }[] = []
    rendered.scene!.traverse(object => {
      for (const cue of object.userData.interactionCues ?? []) {
        if (cue.enabled() && cue.kind === 'drag' && cue.destination) cues.push({ object, cue })
      }
    })
    const current = cues.find(({ object }) => object.name === source) ?? (cues.length === 1 ? cues[0] : undefined)
    if (current) {
      const project = (world: THREE.Vector3) => {
        const p = world.project(rendered.camera!)
        return [(p.x + 1) * 180, (1 - p.y) * 180]
      }
      rendered.scene!.updateMatrixWorld(true); rendered.camera!.updateMatrixWorld(true)
      const destination = current.cue.destination!
      return {
        from: point(current.object.name, current.cue.anchor ?? [0, 0, 0]),
        end: project(typeof destination === 'function' ? destination() : destination.getWorldPosition(new THREE.Vector3())),
        spatial: true,
      }
    }
    const from = point(source, sourceAnchor)
    return { from, end: screenDelta ? [from[0] + screenDelta[0], from[1] + screenDelta[1]] : point(target, targetAnchor), spatial: false }
  }
  const { from, end: staleEnd, spatial } = input()
  pointer(hit,'pointerdown',from)
  // Work-face tools can rest within their contact margin. For those pickups,
  // pause before their first move rather than entering an accepted stroke.
  if (screenDelta) {
    const part = spatial || id === 'indonesian-angklung' ? .1 : .35
    pointer(hit,'pointermove',[from[0] + (staleEnd[0] - from[0]) * part, from[1] + (staleEnd[1] - from[1]) * part])
  }
  expect(checkpoint).not.toHaveBeenCalled(); expect(variant).not.toHaveBeenCalled()
  ctrl.setActive(false); ctrl.setActive(true)
  pointer(hit,'pointerup',staleEnd); expect(checkpoint).not.toHaveBeenCalled(); expect(variant).not.toHaveBeenCalled()
  const { from: freshFrom, end: freshEnd } = input()
  pointer(hit,'pointerdown',freshFrom); pointer(hit,'pointermove',freshEnd); pointer(hit,'pointerup',freshEnd)
  if (id === 'korean-bojagi-wrap') {
    const step = Number(initialVariant!.slice(-1))
    expect(variant).toHaveBeenCalledExactlyOnceWith(`bojagi-step-${step + 1}`)
    if (step === 3 || step === 5) expect(checkpoint).toHaveBeenCalledExactlyOnceWith(step === 3 ? 1 : 2)
    else expect(checkpoint).not.toHaveBeenCalled()
  } else if (id === 'indonesian-angklung') {
    if (progress < 2) expect(checkpoint).toHaveBeenCalledExactlyOnceWith(2)
    else { expect(checkpoint).not.toHaveBeenCalled(); host.querySelector<HTMLButtonElement>('.scene-angklung-finish')!.click(); expect(checkpoint).toHaveBeenCalledExactlyOnceWith(3) }
  } else if (id === 'vietnamese-bamboo-dragonfly' && progress === 2) {
    expect(checkpoint).not.toHaveBeenCalled()
    host.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
    expect(checkpoint).toHaveBeenCalledExactlyOnceWith(3)
  } else expect(checkpoint).toHaveBeenCalledExactlyOnceWith(id==='malawi-sansi'?2:progress+1)
})

it.each([0, 1, 2])('preserves Czech bead assembly and optional viewing through host pause at %i', async progress => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 360 } as DOMRect)
  const host = document.createElement('div'); document.body.append(host)
  const checkpoint = vi.fn(), complete = vi.fn(), engine = await proceduralEngine('czech-bead-star')
  host.addEventListener('scene:complete', complete)
  const ctrl = engine.create(host, { progress, sceneId: 'czech-bead-star', checkpoint, isSoundEnabled: () => false },
    { active: true, reducedMotion: true, signal: new AbortController().signal, ready() {}, failed(error) { throw error } })
  controllers.push(ctrl)
  const scene = rendered.scene!, camera = rendered.camera!, hit = host.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const project = (world: THREE.Vector3) => {
    const p = world.clone().project(camera)
    return [(p.x + 1) * 180, (1 - p.y) * 180]
  }
  const currentCue = (kind: InteractionCue['kind']) => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const entries: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => {
      for (const cue of (object.userData.interactionCues ?? []) as InteractionCue[])
        if (cue.enabled() && cue.kind === kind) entries.push({ object, cue })
    })
    expect(entries, 'the current physical action must expose its cue').toHaveLength(1)
    const { object, cue } = entries[0]!
    return { object, cue, from: project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0])))) }
  }
  expect(checkpoint).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled()
  if (progress === 0) {
    const loose = scene.getObjectByName('bead-loose-strand')!, saved = loose.position.clone()
    const first = currentCue('drag'), destination = first.cue.destination!
    expect(destination).toBeDefined()
    const end = project(typeof destination === 'function' ? destination() : destination.getWorldPosition(new THREE.Vector3()))
    pointer(hit, 'pointerdown', first.from)
    pointer(hit, 'pointermove', first.from.map((value, axis) => value + (end[axis]! - value) * .2))
    expect(loose.position.distanceTo(saved), 'pause must cancel an actual unfinished assembly').toBeGreaterThan(.02)
    expect(checkpoint).not.toHaveBeenCalled()
    ctrl.setActive(false); ctrl.setActive(true)
    expect(loose.position.distanceTo(saved)).toBeLessThan(1e-8)
    pointer(hit, 'pointerup', end)
    expect(checkpoint).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled()
    const fresh = currentCue('drag')
    pointer(hit, 'pointerdown', fresh.from); pointer(hit, 'pointermove', end); pointer(hit, 'pointerup', end)
    expect(checkpoint).toHaveBeenCalledExactlyOnceWith(2)
    expect(loose.parent?.name).toBe('bead-star-body')
    expect(complete, 'joining the strand must leave quiet viewing as a separate action').not.toHaveBeenCalled()
  }

  // The old checkpoint 1 and current checkpoint 2 both restore optional
  // viewing. Turning is real motion, but never an extra progress requirement.
  const star = scene.getObjectByName('bead-star-body')!, savedTurn = star.quaternion.clone(), view = currentCue('rotate')
  const staleEnd = [view.from[0]! + 60, view.from[1]!]
  pointer(hit, 'pointerdown', view.from); pointer(hit, 'pointermove', staleEnd)
  expect(star.quaternion.angleTo(savedTurn)).toBeGreaterThan(.5)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(progress === 0 ? [2] : [])
  ctrl.setActive(false); ctrl.setActive(true)
  expect(star.quaternion.angleTo(savedTurn)).toBeLessThan(1e-8)
  pointer(hit, 'pointerup', staleEnd)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(progress === 0 ? [2] : [])
  expect(complete).not.toHaveBeenCalled()

  // A fresh tap completes directly after restoration; no fixed turn or full
  // revolution may be required, and the abandoned viewing release cannot tap.
  const quiet = currentCue('rotate')
  pointer(hit, 'pointerdown', quiet.from); pointer(hit, 'pointerup', quiet.from)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(progress === 0 ? [2, 3] : [3])
  expect(complete).toHaveBeenCalledTimes(1)
  expect(host.querySelector<HTMLButtonElement>('.scene-bow-tap')!.hidden).toBe(true)
  ctrl.setActive(false); ctrl.setActive(true); pointer(hit, 'pointerup', quiet.from)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(progress === 0 ? [2, 3] : [3])
  expect(complete).toHaveBeenCalledTimes(1)
})
