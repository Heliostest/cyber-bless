// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneInstance } from './contract'
import { loadScene } from './registry'

const rendered = vi.hoisted(() => ({ scene: null as THREE.Scene | null, camera: null as THREE.Camera | null }))
// Preserve real geometry, camera projection, raycasts, scene ownership and poses.
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    shadowMap = { enabled: false, type: 0 }
    setClearColor() {} setPixelRatio() {} setSize() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({
  createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    return { setStyle() {}, resize() {}, render() {}, dispose() {} }
  },
}))

// Literal directions reviewed against the existing action copy, independent of the cue/axes implementation.
const SCENES = [
  ['balinese-canang-sari', 'RUL'], ['bonfim-ribbon', 'RLR'], ['bulgarian-survakane', 'URU'],
  ['chinese-rattle-drum', 'RLD'], ['chinese-steelyard', 'RUD'], ['chinese-tangram', 'LUR'],
  ['chinowa-kuguri', 'LRL'], ['czech-wooden-ratchet', 'RLU'], ['english-hearth-bellows', 'UDU'],
  ['estonian-village-swing', 'UDU'], ['fgs-buddha-bathing', 'UUU'], ['finnish-kantele', 'UDU'],
  ['french-coffee-mill', 'LRD'], ['french-petanque', 'UUU'], ['garden-croquet', 'LRR'],
  ['german-jumping-jack', 'DDD'], ['ghanaian-oware', 'URL'], ['greek-new-year-pomegranate', 'URD'],
  ['greek-vasilopita', 'URD'], ['hiiragi-iwashi', 'ULU'], ['irish-bodhran', 'DUR'],
  ['japanese-daruma-otoshi', 'DRU'], ['japanese-shishi-odoshi', 'LDD'], ['japanese-wagasa', 'URD'],
  ['kagami-biraki-sake', 'UDL'], ['kagami-mochi-offering', 'UUU'], ['kameido-usokae', 'ULD'],
  ['lam-tsuen-wishing-tree', 'RRU'], ['mexican-metate', 'DUU'], ['mexican-tortilla-press', 'DDU'],
  ['mochigase-nagashibina', 'URD'], ['mongolian-ovoo', 'LLL'], ['paper-pinwheel', 'RUR'],
  ['persian-esfand', 'URD'], ['polish-oplatek-sharing', 'URU'], ['puerto-rican-guiro', 'DUR'],
  ['romanian-martisor', 'URD'], ['rosh-hashanah-apple-honey', 'RDL'], ['scottish-plunge-churn', 'DUU'],
  ['setsubun-mamemaki', 'RUD'], ['shichigosan-chitose-ame', 'URD'], ['spanish-castanets', 'DDD'],
  ['sternsinger-house-blessing', 'URD'], ['sumiyoshi-godairiki', 'RRR'], ['tamagushi-offering', 'RRU'],
  ['thai-songkran-elders', 'URD'], ['tibetan-khata-greeting', 'URR'], ['tibetan-prayer-flags', 'URU'],
  ['tibetan-water-bowls', 'URD'], ['udo-undama', 'URU'], ['valencian-folding-fan', 'RLL'],
  ['welsh-drop-spindle', 'RDU'], ['zeniarai-coin-washing', 'ULR'],
] as const
const DIRECTIONS: Record<string, [number, number]> = { R: [1, 0], L: [-1, 0], U: [0, -1], D: [0, 1] }
type Point = [number, number]
const instances = new Set<SceneInstance>()
afterEach(() => { instances.forEach(instance => instance.dispose()); instances.clear(); document.body.replaceChildren() })
function pointer(layer: HTMLElement, type: string, [clientX, clientY]: Point, pointerId = 1) {
  const event = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(event, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, isPrimary: pointerId === 1 })
  layer.dispatchEvent(event)
}
async function mount(id: string, width: number, initialProgress = 0, reduced = true) {
  const module = await loadScene(id), height = 408
  const host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height }) as DOMRect
  const progress: number[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress,
    onProgress: n => progress.push(n), isReducedMotion: () => reduced, isSoundEnabled: () => false })
  instances.add(instance); instance.start()
  const scene = rendered.scene!, camera = rendered.camera!, layer = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  const hint = overlay.querySelector<HTMLElement>('.scene-hint')!
  layer.setPointerCapture = () => {}; layer.releasePointerCapture = () => {}
  const source = (direction: Point) => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const entries: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) entries.push({ object, cue }) })
    expect(entries).toHaveLength(1)
    const { object, cue } = entries[0]!
    expect(cue.direction, 'the arrow must match the action direction').toEqual(direction)
    const p = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).project(camera)
    return [(p.x + 1) * width / 2, (1 - p.y) * height / 2] as Point
  }
  const run = () => { for (let frame = 0; frame < 100; frame++) instance.update(.05) }
  const dispose = () => { instance.dispose(); instances.delete(instance); host.remove() }
  return { layer, hint, overlay, progress, complete, source, run, dispose }
}
function point(start: Point, direction: Point, along: number, cross = 0): Point {
  return [start[0] + direction[0] * along - direction[1] * cross, start[1] + direction[1] * along + direction[0] * cross]
}
const PATHS: [number, number][][] = [
  [[-20, 0], [40, 0]], [[-20, 0], [60, 0]], [[-20, 0], [120, 0]],
  [[20, 0], [60, 0]], [[40, 0], [85, 0]], [[60, 0], [120, 0]], [[60, 0], [180, 0]],
  [[60, 0], [50, 0]], [[60, 0], [40, 0]], [[30, 15], [60, 30]],
  [[20, 16], [40, -16], [60, 0]],
]
it.each(SCENES)('%s follows its arrows through all three steps with long drags, corrections and gentle diagonals', async (id, steps) => {
  for (const width of [320, 390]) for (const path of PATHS) {
    const s = await mount(id, width)
    for (let at = 0; at < 3; at++) {
      const direction = DIRECTIONS[steps[at]!]!, a = s.source(direction)
      pointer(s.layer, 'pointerdown', a)
      for (const [along, cross] of path) pointer(s.layer, 'pointermove', point(a, direction, along, cross))
      expect(s.hint.dataset.ready, `step ${at}, ${width}px, ${JSON.stringify(path)}`).toBe('true')
      expect(s.hint.textContent).toContain('松手')
      pointer(s.layer, 'pointerup', point(a, direction, ...path.at(-1)!)); s.run()
      expect(s.progress, `step ${at}, ${width}px, ${JSON.stringify(path)}`).toEqual([1, 2, 3].slice(0, at + 1))
      expect(s.hint.dataset.ready).not.toBe('true')
    }
    expect(s.complete).toHaveBeenCalledOnce(); s.dispose()
  }
}, 30000)
it.each(SCENES)('%s keeps reverse, returned-to-start, canceled and multitouch input incomplete', async (id, steps) => {
  for (let at = 0; at < 3; at++) {
    const s = await mount(id, 390, at), direction = DIRECTIONS[steps[at]!]!
    for (const mode of ['reverse', 'cross', 'return', 'cancel', 'multi', 'release-only', 'nonfinite']) {
      const a = s.source(direction), b = point(a, direction, 60)
      pointer(s.layer, 'pointerdown', a)
      if (mode !== 'release-only') pointer(s.layer, 'pointermove', b)
      if (mode === 'nonfinite') pointer(s.layer, 'pointermove', [NaN, a[1]])
      if (mode === 'cancel') pointer(s.layer, 'pointercancel', b)
      if (mode === 'multi') pointer(s.layer, 'pointerdown', b, 2)
      const end = mode === 'reverse' ? point(a, direction, -60) : mode === 'cross' ? point(a, direction, 0, 60) : mode === 'return' ? a : b
      pointer(s.layer, 'pointerup', end)
      if (mode === 'multi') pointer(s.layer, 'pointerup', b, 2)
      s.run(); expect(s.progress, `${at}: ${mode}`).toEqual([]); expect(s.hint.dataset.ready).not.toBe('true')
    }
    const a = s.source(direction)
    pointer(s.layer, 'pointerdown', a); pointer(s.layer, 'pointermove', point(a, direction, 20))
    pointer(s.layer, 'pointerup', point(a, direction, 120)); s.run()
    expect(s.progress).toEqual([at + 1]); s.dispose()
  }
}, 30000)
