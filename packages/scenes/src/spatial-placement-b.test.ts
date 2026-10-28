// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneInstance } from './contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import { createAlasitaModel } from './alasita-miniature-house/model'
import { createSurvakaneModel } from './bulgarian-survakane/model'
import { createLongevityLockModel } from './chinese-longevity-lock/model'
import { createNagashibinaModel } from './mochigase-nagashibina/model'
import { createVasilopitaModel } from './greek-vasilopita/model'
import { createKhataModel } from './tibetan-khata-greeting/model'
import { disposeTree } from './procedural-kit'

const rendered = vi.hoisted(() => ({ scene: null as unknown, camera: null as unknown }))
vi.mock('three', async original => {
  const actual = await original<typeof import('three')>()
  class WebGLRenderer {
    domElement: HTMLCanvasElement; shadowMap = { enabled: false, type: 0 }
    constructor({ canvas }: { canvas: HTMLCanvasElement }) { this.domElement = canvas }
    setSize() {} setPixelRatio() {} setClearColor() {} dispose() {} forceContextLoss() {}
  }
  return { ...actual, WebGLRenderer }
})
vi.mock('@wbr/scene-runtime/debug-render-style', async () => {
  const { createInteractionCues } = await import('@wbr/scene-runtime/interaction-cues')
  return { createDebugRenderStyle(renderer: THREE.WebGLRenderer, scene: THREE.Scene, camera: THREE.Camera) {
    rendered.scene = scene; rendered.camera = camera
    const cues = createInteractionCues(renderer.domElement, scene, camera)
    return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); cues.update() }, dispose() { cues.dispose() } }
  } }
})
const instances: SceneInstance[] = []
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })

export const spatialCasesB: [string, number[]][] = [
  ['alasita-miniature-house', [0, 2]], ['bulgarian-survakane', [0, 1]],
  ['chinese-longevity-lock', [0, 1, 2]], ['chinese-tangram', [0, 1, 2]],
  ['horseshoe-doorway-luck', [0, 1, 2]], ['kagami-mochi-offering', [0, 1, 2]],
  ['mochigase-nagashibina', [0, 1, 2]], ['neapolitan-cornicello', [0, 1, 2]],
  ['rosh-hashanah-apple-honey', [0, 1, 2]], ['sternsinger-house-blessing', [0, 2]],
  ['uchide-wishing-mallet', [0, 2]], ['vietnamese-five-fruit-tray', [0, 1, 2]],
  ['bai-indigo-cloth', [0, 1]], ['basque-sunflower', [0, 1]],
  ['czech-bead-star', [0]], ['dalarna-wooden-horse', [0, 1]],
  ['finnish-birch-basket', [0, 1]], ['clootie-well-rag', [0, 1]],
  ['floating-lantern-loy-krathong', [0, 2]], ['omikuji', [0, 1, 2]],
  ['ema-votive-plaque', [2]],
  ['slavic-wreath', [1]], ['tanzaku-tanabata', [1]], ['milagros', [1]],
  ['german-nutcracker', [1]], ['japanese-daruma-otoshi', [0, 2]],
  ['japanese-shishi-odoshi', [0]], ['lao-baci-wrist', [0]], ['nanakusa-gayu', [0, 1]],
  ['greek-vasilopita', [0, 1, 2]], ['tibetan-khata-greeting', [0, 1]], ['polish-oplatek-sharing', [0, 2]],
]
// The saved source checkpoint and the end of a continuous carry are different.
// Assembly, tapping the back, taking the coin and the final handover stay distinct.
function nextCheckpoint(id: string, step: number) {
  if (['alasita-miniature-house', 'chinese-longevity-lock', 'mochigase-nagashibina'].includes(id)) return 3
  if (['bulgarian-survakane', 'greek-vasilopita', 'tibetan-khata-greeting'].includes(id) && step < 2) return 2
  if (id === 'czech-bead-star' && step === 0) return 2
  return step + 1
}
function carryDestination(id: string, step: number) {
  const factory = {
    'alasita-miniature-house': createAlasitaModel,
    'bulgarian-survakane': createSurvakaneModel,
    'chinese-longevity-lock': createLongevityLockModel,
    'mochigase-nagashibina': createNagashibinaModel,
    'greek-vasilopita': createVasilopitaModel,
    'tibetan-khata-greeting': createKhataModel,
  }[id]
  if (!factory) return null
  const model = factory(), slot = nextCheckpoint(id, step) - 1
  // The tray is accepted when it touches water, before its downstream drift.
  model.pose(slot, id === 'mochigase-nagashibina' ? .6 : 1)
  const anchor = model.anchors[slot]!, point = model.targets[slot]!.localToWorld(Array.isArray(anchor) ? new THREE.Vector3(...anchor) : anchor.clone())
  if (id === 'greek-vasilopita' && slot === 1) {
    // Acceptance seats the slice; the server is drawn out only afterwards.
    const cake = model as ReturnType<typeof createVasilopitaModel>
    point.sub(cake.server.getWorldPosition(new THREE.Vector3())).add(cake.served)
  }
  if ('dispose' in model) model.dispose()
  disposeTree(model.root)
  return point
}
function pointer(el: HTMLElement, type: string, x: number, y: number) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: x, clientY: y, pointerId: 1, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 })
  el.dispatchEvent(e)
}
async function mount(id: string, step: number, width: number, reduced = false) {
  const height = width === 1280 ? 600 : 568, canvas = document.createElement('canvas'), overlay = document.createElement('div'), host = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width, height, right: width, bottom: height }) as DOMRect
  const progress: number[] = [], module = await import(`./${id}/index.ts`)
  const instance = module.create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: step, onProgress: (n: number) => progress.push(n), isSoundEnabled: () => false, isReducedMotion: () => reduced }) as SceneInstance
  instances.push(instance); instance.start(); instance.update(.025)
  if (id === 'milagros') for (let n = 0; n < 50; n++) instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera
  const hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  let source: { object: THREE.Object3D; cue: InteractionCue } | undefined
  scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled() && cue.kind === 'drag') source = { object, cue } })
  expect(source, `${id} step ${step} source`).toBeDefined()
  const project = (v: THREE.Vector3) => { const p = v.clone().project(camera); return [(.5 + p.x / 2) * width, (.5 - p.y / 2) * height] as const }
  const run = () => { for (let n = 0; n < 130; n++) instance.update(.025) }
  return { instance, scene, camera, source: source!, project, run, progress, hit }
}

describe('B group real object destination placement', () => {
  for (const [id, steps] of spatialCasesB) for (const step of steps) {
    it.each([320, 390, 1280])(`${id} step ${step} follows a curved route and accepts while held at %i`, async width => {
      const s = await mount(id, step, width), { object, cue } = s.source
      expect(cue.direction, 'a placement shows its actual destination').toBeUndefined()
      expect(cue.destination).toBeDefined()
      const anchor = new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))
      const start = s.project(object.localToWorld(anchor.clone()))
      const destination = typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())
      const independentlyModeled = carryDestination(id, step)
      if (independentlyModeled) expect(destination.distanceTo(independentlyModeled), 'the cue uses the current physical carry endpoint').toBeLessThan(1e-8)
      if (id === 'czech-bead-star') expect(destination.distanceTo(s.scene.getObjectByName('bead-star-arm-joint')!.getWorldPosition(new THREE.Vector3()))).toBeLessThan(1e-8)
      const target = s.project(destination)
      pointer(s.hit, 'pointerdown', ...start)
      // A drawn stick remains in its real cylinder opening; its X axis stays constrained.
      const bend = [start[0] + (target[0] - start[0]) * .35 + (id === 'omikuji' && step === 1 ? 0 : 18), start[1] + (target[1] - start[1]) * .35 - 15] as const
      pointer(s.hit, 'pointermove', ...bend)
      expect(s.progress).toEqual([])
      const actual = s.project(object.localToWorld(anchor.clone()))
      expect(Math.hypot(actual[0] - bend[0], actual[1] - bend[1]), 'the selected surface stays under the finger').toBeLessThan(1)
      pointer(s.hit, 'pointermove', ...target)
      const heldAtArrival = s.project(object.localToWorld(anchor.clone()))
      s.instance.update(.025)
      const firstSettlingFrame = s.project(object.localToWorld(anchor.clone()))
      expect(Math.hypot(firstSettlingFrame[0] - heldAtArrival[0], firstSettlingFrame[1] - heldAtArrival[1]), 'settling starts at the held pose instead of replaying from home').toBeLessThan(9)
      s.run()
      expect(s.progress, 'arrival commits without pointerup').toEqual([nextCheckpoint(id, step)])
      pointer(s.hit, 'pointermove', start[0], start[1]); pointer(s.hit, 'pointerup', ...start); s.run()
      expect(s.progress, 'the tail of the same touch cannot affect the next step').toEqual([nextCheckpoint(id, step)])
    })
    it(`${id} step ${step} restores an unfinished grab and samples sparse release at the real destination`, async () => {
      const s = await mount(id, step, 390), { object, cue } = s.source
      const anchor = new THREE.Vector3(...(cue.anchor ?? [0, 0, 0])), original = object.localToWorld(anchor.clone())
      const start = s.project(original), destination = typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())
      const target = s.project(destination), length = Math.max(1, Math.hypot(target[0] - start[0], target[1] - start[1]))
      pointer(s.hit, 'pointerdown', ...start)
      pointer(s.hit, 'pointermove', start[0] - (target[0] - start[0]) / length * 35, start[1] - (target[1] - start[1]) / length * 35)
      s.run(); expect(s.progress).toEqual([])
      pointer(s.hit, 'pointercancel', ...start)
      expect(object.localToWorld(anchor.clone()).distanceTo(original), 'cancel restores the actual selected surface').toBeLessThan(.001)
      pointer(s.hit, 'pointerdown', ...start); pointer(s.hit, 'pointerup', ...target); s.run()
      expect(s.progress).toEqual([nextCheckpoint(id, step)])
    })
  }
  it.each([
    ['greek-vasilopita', 0, 'vasilopita-server-root', 'vasilopita-family-slice'],
    ['greek-vasilopita', 1, 'vasilopita-server-root', 'vasilopita-family-slice'],
    ['polish-oplatek-sharing', 0, 'oplatek-holder', 'oplatek-piece-carrier'],
    ['polish-oplatek-sharing', 2, 'oplatek-piece-carrier', 'oplatek-recipient'],
    ['tibetan-khata-greeting', 0, 'khata-scarf', 'khata-giver-hand-0'],
    ['tibetan-khata-greeting', 1, 'khata-scarf', 'khata-giver-hand-0'],
  ] as const)('%s step %i keeps its food or supporting hand attached while carried', async (id, step, first, second) => {
    const s = await mount(id, step, 390), a = s.scene.getObjectByName(first)!, b = s.scene.getObjectByName(second)!
    const before = b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3()))
    const p = s.project(s.source.object.localToWorld(new THREE.Vector3(...(s.source.cue.anchor ?? [0, 0, 0]))))
    pointer(s.hit, 'pointerdown', ...p); pointer(s.hit, 'pointermove', p[0] - 24, p[1] - 19)
    const after = b.getWorldPosition(new THREE.Vector3()).sub(a.getWorldPosition(new THREE.Vector3()))
    expect(after.distanceTo(before), `relative support ${before.toArray()} -> ${after.toArray()}`).toBeLessThan(.001)
  })
  for (const [id, carrierName] of [
    ['bai-indigo-cloth', 'indigo-tied-cloth'], ['basque-sunflower', 'sunflower-center-piece'],
    ['czech-bead-star', 'bead-loose-strand'], ['dalarna-wooden-horse', 'horse-polishing-cloth'],
    ['finnish-birch-basket', 'birch-handle'], ['omikuji', 'omikuji-box'],
  ]) it.each(['held', 'sparse'])(`${id} accepts a real two pixel arrival with %s samples`, async mode => {
    const s = await mount(id, 0, 390), { object, cue } = s.source, carrier = s.scene.getObjectByName(carrierName)!
    const anchor = new THREE.Vector3(...(cue.anchor ?? [0,0,0])), contact = object.localToWorld(anchor.clone())
    const destination = typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())
    const projected = destination.clone().project(s.camera), depth = contact.clone().project(s.camera).z
    const near = new THREE.Vector3(projected.x - 4 / 390, projected.y, depth).unproject(s.camera)
    const shifted = carrier.getWorldPosition(new THREE.Vector3()).add(near.sub(contact))
    carrier.position.copy(carrier.parent ? carrier.parent.worldToLocal(shifted) : shifted); s.scene.updateMatrixWorld(true)
    const staged = carrier.position.clone()
    const from = s.project(object.localToWorld(anchor.clone())), to = s.project(destination)
    expect(Math.hypot(from[0]-to[0],from[1]-to[1])).toBeCloseTo(2, 4)
    pointer(s.hit,'pointerdown',...from); pointer(s.hit,'pointerup',...from); s.run(); expect(s.progress).toEqual([])
    // No unfinished gesture was accepted; restore the staged nearby pose after
    // the quiet release returned the production object to its checkpoint.
    carrier.position.copy(staged); s.scene.updateMatrixWorld(true)
    const start = s.project(object.localToWorld(anchor.clone()))
    pointer(s.hit,'pointerdown',...start)
    if(mode === 'held') pointer(s.hit,'pointermove',...to)
    else pointer(s.hit,'pointerup',...to)
    s.run(); expect(s.progress).toEqual([nextCheckpoint(id, 0)]); if(mode === 'held') pointer(s.hit,'pointerup',...to)
  })
  it.each([
    ['ema-votive-plaque', 2, [-.4,0,0], [.14,0,0]],
    ['clootie-well-rag', 1, [-.13,0,0], [.11,0,0]],
    ['dalarna-wooden-horse', 0, [-.15,0,0], [.21,0,.015]],
    ['floating-lantern-loy-krathong', 0, [-.06,0,0], [.11,0,0]],
    ['omikuji', 0, [-.24,0,.1], [.28,0,0]],
    ['milagros', 1, [-.18,.13,0], [.21,0,0]],
  ] as [string,number,[number,number,number],[number,number,number]][])('%s rejects a fingertip at the target when the off-centre object anchor misses it', async (id,step,pick,targetEdge) => {
    const s = await mount(id,step,390), { object, cue } = s.source
    const destination = cue.destination as THREE.Object3D
    const from = s.project(object.localToWorld(new THREE.Vector3(...pick))), to = s.project(destination.localToWorld(new THREE.Vector3(...targetEdge)))
    const home = object.getWorldPosition(new THREE.Vector3())
    pointer(s.hit,'pointerdown',...from); pointer(s.hit,'pointermove',...to)
    expect(object.getWorldPosition(new THREE.Vector3()).distanceTo(home), 'the off-centre pickup actually moved the object').toBeGreaterThan(.01)
    const contact = object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0,0,0]))).project(s.camera), ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(contact.x,contact.y),s.camera)
    expect(ray.intersectObject(destination,true), 'the physical anchor is still outside the target').toHaveLength(0)
    expect(s.progress).toEqual([]); pointer(s.hit,'pointerup',...to); s.run(); expect(s.progress).toEqual([])
  })
  it.each([
    ['dalarna-wooden-horse','dalarna-horse','horse-plinth-inset'],
    ['finnish-birch-basket','birch-basket','birch-display-mat'],
  ])('%s keeps its grip above the support while its actual bottom arrives', async (id,carrierName,supportName) => {
    const s = await mount(id,1,390), {object,cue} = s.source, carrier = s.scene.getObjectByName(carrierName)!, support = s.scene.getObjectByName(supportName)!
    const from = s.project(object.getWorldPosition(new THREE.Vector3())), to = s.project((cue.destination as () => THREE.Vector3)())
    pointer(s.hit,'pointerdown',...from); pointer(s.hit,'pointermove',...to)
    const bottom = carrier.getWorldPosition(new THREE.Vector3()).project(s.camera), ray = new THREE.Raycaster()
    ray.setFromCamera(new THREE.Vector2(bottom.x,bottom.y),s.camera)
    expect(ray.intersectObject(support,true), 'the foot or basket bottom reaches the support before settling').not.toHaveLength(0)
    const grip = s.project(object.getWorldPosition(new THREE.Vector3())), seat = s.project(support.getWorldPosition(new THREE.Vector3()))
    expect(grip[1], 'the handhold stays visibly above the support').toBeLessThan(seat[1]-12)
    const held = carrier.position.clone(); s.run(); expect(s.progress).toEqual([2])
    expect(carrier.position.distanceTo(held), 'settling does not lift a grip that was pushed down onto the seat').toBeLessThan(.35)
    const base = new THREE.Box3().setFromObject(carrier), stand = new THREE.Box3().setFromObject(support)
    expect(base.min.y).toBeCloseTo(stand.max.y,2); pointer(s.hit,'pointerup',...to)
  })
})
