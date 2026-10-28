// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from './contract'
import { create as ruyi } from './chinese-ruyi-scepter'
import { create as kadomatsu } from './japanese-kadomatsu'
import { create as kumade } from './japanese-kumade'
import { create as pucara } from './pucara-rooftop-bulls'
import { create as martisor } from './romanian-martisor'
import { create as chitose } from './shichigosan-chitose-ame'
import { create as nazar } from './turkish-nazar-bead'
import { create as ship } from './aland-votive-ship'
import { create as tile } from './andalusian-ceramic-tile'
import { create as rooster } from './barcelos-clay-rooster'
import { create as bokjori } from './bokjori'
import { create as banner } from './breton-banner'
import { create as incense } from './chinese-incense'
import { create as licitar } from './croatian-licitar-heart'
import { create as diya } from './diya-oil-lamp'
import { create as fan } from './fijian-woven-fan'
import { create as cord } from './hongsheng-red-string'
import { create as exvoto } from './italian-ex-voto'
import { create as house } from './ndebele-painted-house'
import { create as omamori } from './omamori-cycle'
import { create as basket } from './polish-blessing-basket'
import { create as cart } from './sicilian-painted-cart'
import { create as egg } from './sorbian-painted-egg'
import { create as cross } from './st-brigids-cross'
import { create as willow } from './finnish-virpominen'
import { create as pomegranate } from './greek-new-year-pomegranate'
import { create as mallet } from './kagami-biraki-sake'
import { create as ox } from './kitano-nadeushi'
import { create as esfand } from './persian-esfand'
import { create as tamagushi } from './tamagushi-offering'
import { create as coal } from './scottish-first-footing'
import { create as dragonfly } from './vietnamese-bamboo-dragonfly'
import { create as kite } from './weifang-paper-kite'
import { create as spring } from './celtic-folk-spring'
import { create as flowerWater } from './theravada-water'
import { create as lantern } from './lantern'
import { createChineseRuyiScepterModel } from './chinese-ruyi-scepter/model'
import { createKadomatsuModel } from './japanese-kadomatsu/model'
import { createJapaneseKumadeModel } from './japanese-kumade/model'
import { createPucaraModel } from './pucara-rooftop-bulls/model'
import { createMartisorModel } from './romanian-martisor/model'
import { createChitoseAmeModel } from './shichigosan-chitose-ame/model'
import { createTurkishNazarBeadModel } from './turkish-nazar-bead/model'
import { createPomegranateModel } from './greek-new-year-pomegranate/model'
import { createEsfandModel } from './persian-esfand/model'
import { createFirstFootingModel } from './scottish-first-footing/model'
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
const cases = [ ['ruyi', ruyi], ['kadomatsu', kadomatsu], ['kumade', kumade], ['pucara', pucara], ['martisor', martisor], ['chitose', chitose], ['nazar', nazar] ] as const
type PoseFixture = {
  root: THREE.Object3D
  pose(step: number, amount: number): void
  targets: THREE.Object3D[]
  anchors: (readonly number[] | THREE.Vector3)[]
  dispose?(): void
}
type PlacementContract = {
  checkpoints: readonly number[]
  placementSlots: readonly number[]
  model(): PoseFixture
  destinationOffset?: [number, number, number]
}
// Current 2026-10-28 README contracts. A repeated carrying slot is not a
// second operation; Kumade still places three different paper decorations.
// Fruit breaking and cloth wafting remain separate after their carry to 2.
const placementContracts: Record<string, PlacementContract> = {
  ruyi: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createChineseRuyiScepterModel },
  kadomatsu: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createKadomatsuModel },
  kumade: { checkpoints: [1, 2, 3], placementSlots: [0, 1, 2], model: createJapaneseKumadeModel },
  pucara: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createPucaraModel },
  martisor: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createMartisorModel },
  chitose: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createChitoseAmeModel },
  nazar: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createTurkishNazarBeadModel },
  pomegranate: { checkpoints: [2, 2, 3], placementSlots: [1, 1, 2], model: createPomegranateModel },
  esfand: { checkpoints: [2, 2, 3], placementSlots: [1, 1, 2], model: createEsfandModel },
  coal: { checkpoints: [3, 3, 3], placementSlots: [2, 2, 2], model: createFirstFootingModel, destinationOffset: [0, .38, 0] },
}
const creators = new Map<((ctx: SceneContext) => SceneInstance), string>([
  ...cases, ['pomegranate', pomegranate], ['esfand', esfand], ['coal', coal],
].map(([label, create]) => [create, label]) as [((ctx: SceneContext) => SceneInstance), string][])
const checkpointAfter = (label: string, at: number) => placementContracts[label]?.checkpoints[at] ?? at + 1
const progressAfter = (label: string, at: number) => label === 'cross' && at === 0 ? [] : [checkpointAfter(label, at)]
function mount(create: (ctx: SceneContext) => SceneInstance, at: number, width: number, extra: Partial<SceneContext> = {}) {
  const height = 408, left = 17, top = 91, host = document.createElement('div'), canvas = document.createElement('canvas'), overlay = document.createElement('div')
  host.append(canvas, overlay); document.body.append(host)
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  const progress: number[] = [], complete = vi.fn()
  overlay.addEventListener('scene:complete', complete)
  const instance = create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at, isReducedMotion: () => true, isSoundEnabled: () => false, onProgress: n => progress.push(n), ...extra })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera, hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const cueList: { object: THREE.Object3D; cue: InteractionCue }[] = []
  scene.traverse(object => { for (const cue of object.userData.interactionCues ?? []) if (cue.enabled()) cueList.push({ object, cue }) })
  const { object, cue } = cueList[0]!
  const project = (p: THREE.Vector3): [number, number] => { const q = p.clone().project(camera); return [left + (q.x + 1) * width / 2, top + (1 - q.y) * height / 2] }
  const source = () => { scene.updateMatrixWorld(true); return project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0])))) }
  const goal = () => { expect(cue.destination, 'placement exposes its actual next target').toBeDefined(); return project(typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())) }
  const contract = placementContracts[creators.get(create) ?? '']
  if (contract) {
    const fixture = contract.model(), slot = contract.placementSlots[at]!
    const anchor = (i: number) => { const a = fixture.anchors[i]!; return a instanceof THREE.Vector3 ? a.clone() : new THREE.Vector3(...a as [number, number, number]) }
    try {
      fixture.pose(at, 0); fixture.root.updateMatrixWorld(true)
      const original = fixture.targets[slot]!.localToWorld(anchor(slot))
      expect(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))).distanceTo(original), 'legacy checkpoint restores the real source pose').toBeLessThan(1e-7)
      fixture.pose(slot, 1); fixture.root.updateMatrixWorld(true)
      const expected = fixture.targets[slot]!.localToWorld(anchor(slot)).add(new THREE.Vector3(...(contract.destinationOffset ?? [0, 0, 0])))
      const actual = typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())
      expect(actual.distanceTo(expected), 'cue targets the independently posed final support, not the old intermediate marker').toBeLessThan(1e-7)
      const target = project(expected)
      expect(target[0]).toBeGreaterThanOrEqual(left); expect(target[0]).toBeLessThanOrEqual(left + width)
      expect(target[1]).toBeGreaterThanOrEqual(top); expect(target[1]).toBeLessThanOrEqual(top + height)
    } finally { fixture.dispose?.(); disposeTree(fixture.root) }
  }
  return { instance, progress, complete, hit, cue, source, goal, overlay, scene, camera, object, project }
}
function pointer(el: HTMLElement, type: string, [clientX, clientY]: [number, number], pointerId = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX, clientY, pointerId, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(e)
}
function coalRoute(s: ReturnType<typeof mount>, at: number) {
  // Keep the whole lump between the real jambs, then move around the
  // hearth's side wall before entering its front opening.
  const route = at < 2 ? [[.45, .85], [.45, .40], [.45, -.02], [-.75, -.02]] : [[-.75, -.02]]
  for (const [x, z] of route) {
    pointer(s.hit, 'pointermove', s.project(new THREE.Vector3(x!, .73, z! + .16)))
    expect(s.progress, 'crossing a doorway is not an intermediate checkpoint').toEqual([])
  }
}
function arrive(s: ReturnType<typeof mount>, label: string, at: number, sparse = false) {
  if (label === 'coal') coalRoute(s, at)
  pointer(s.hit, sparse ? 'pointerup' : 'pointermove', s.goal())
}

describe.each(cases)('%s spatial placement', (_label, create) => {
  it.each([0, 1, 2])('follows the held object and accepts destination without releasing, step %i', at => {
    for (const width of [320, 390, 1280]) {
      const s = mount(create, at, width), a = s.source(), b = s.goal()
      expect(s.cue.direction).toBeUndefined()
      pointer(s.hit, 'pointerdown', a); expect(s.progress).toEqual([])
      const detour: [number, number] = [a[0] - 14, a[1] + 18]
      pointer(s.hit, 'pointermove', detour)
      expect(s.source()[0]).toBeCloseTo(detour[0], 5); expect(s.source()[1]).toBeCloseTo(detour[1], 5)
      expect(s.progress).toEqual([])
      pointer(s.hit, 'pointermove', b)
      expect(s.progress).toEqual([checkpointAfter(_label, at)])
      expect(s.complete).toHaveBeenCalledTimes(checkpointAfter(_label, at) === 3 ? 1 : 0)
      pointer(s.hit, 'pointermove', [b[0] + 60, b[1] + 60]); s.overlay.querySelector<HTMLButtonElement>('button')?.click()
      expect(s.progress).toEqual([checkpointAfter(_label, at)])
      pointer(s.hit, 'pointerup', b); expect(s.progress).toEqual([checkpointAfter(_label, at)])
      s.instance.dispose()
    }
  })
  it('restores a cancelled grab and rejects an arbitrary long drag to empty space', () => {
    const s = mount(create, 0, 390), a = s.source()
    pointer(s.hit, 'pointerdown', a); pointer(s.hit, 'pointermove', [a[0] + 10, a[1] + 65]); pointer(s.hit, 'pointercancel', a)
    expect(s.progress).toEqual([]); expect(s.source()[0]).toBeCloseTo(a[0], 5); expect(s.source()[1]).toBeCloseTo(a[1], 5)
  })
  it.each([0,1,2])('keeps the held pose when ordinary settlement starts and resumes once after pause at %i', at => {
    let active=true
    const s=mount(create,at,390,{isReducedMotion:()=>false,isActive:()=>active}),a=s.source(),b=s.goal()
    pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointermove',b)
    const held=s.source();expect(s.progress).toEqual([])
    s.instance.update(0)
    expect(s.source()[0]).toBeCloseTo(held[0],5);expect(s.source()[1]).toBeCloseTo(held[1],5)
    s.instance.update(.025);const paused=s.source();active=false
    for(let i=0;i<20;i++)s.instance.update(.05)
    expect(s.source()[0]).toBeCloseTo(paused[0],5);expect(s.source()[1]).toBeCloseTo(paused[1],5);expect(s.progress).toEqual([])
    active=true;for(let i=0;i<50;i++)s.instance.update(.025)
    expect(s.progress).toEqual([checkpointAfter(_label,at)]);pointer(s.hit,'pointermove',a);pointer(s.hit,'pointerup',a)
    for(let i=0;i<10;i++)s.instance.update(.05)
    expect(s.progress).toEqual([checkpointAfter(_label,at)]);expect(s.complete).toHaveBeenCalledTimes(checkpointAfter(_label,at)===3?1:0)
  })
})
const carriedCases = [
  ['ship',ship,[0,1]],['tile',tile,[0,1]],['rooster',rooster,[0,1]],['bokjori',bokjori,[0,1]],
  ['banner',banner,[0,1]],['incense',incense,[0,1]],['licitar',licitar,[0,1]],['diya',diya,[2]],
  ['fan',fan,[0,1]],['cord',cord,[1]],['exvoto',exvoto,[0]],['house',house,[0,1]],
  ['omamori',omamori,[1]],['basket',basket,[0,1]],['cart',cart,[0,1]],['egg',egg,[0,1]],['cross',cross,[0,1]],
  ['willow',willow,[1,2]],['pomegranate',pomegranate,[0,1]],['mallet',mallet,[0,2]],
  ['ox',ox,[0,2]],['esfand',esfand,[0,1]],['tamagushi',tamagushi,[2]],
  ['coal',coal,[0,1,2]],['dragonfly',dragonfly,[0]],['kite',kite,[0]],
  ['spring',spring,[1]],['flower-water',flowerWater,[1]],['lantern',lantern,[1]],
] as const
describe.each(carriedCases)('%s existing carried object', (_label, create, steps) => {
  it('settles each carried object on arrival without requiring a pointerup', () => {
    for (const at of steps) for (const width of [320,390,1280]) {
      const s = mount(create,at,width), a=s.source(), b=s.goal()
      pointer(s.hit,'pointerdown',a); expect(s.progress).toEqual([])
      arrive(s,_label,at)
      // Four rush bundles make the first cross checkpoint; a single bundle cannot skip it.
      if (_label === 'cross' && at === 0) {
        expect(s.progress).toEqual([])
      } else expect(s.progress,`${_label} ${at} ${width}`).toEqual([checkpointAfter(_label,at)])
      if (placementContracts[_label]) expect(s.complete).toHaveBeenCalledTimes(checkpointAfter(_label,at)===3?1:0)
      pointer(s.hit,'pointerup',b)
      expect(s.progress).toEqual(progressAfter(_label,at))
      s.instance.dispose()
    }
  })
})

const terminalCases = [
  ...cases.map(([label,create]) => [label,create,[0,1,2]] as const),
  ...carriedCases,
]
describe.each(terminalCases)('%s terminal placement coordinates', (label,create,steps) => {
  it('rejects a source-only tap and accepts a sparse release at the actual target', () => {
    for(const at of steps)for(const width of [320,390,1280]) {
      const s=mount(create,at,width),a=s.source(),b=s.goal()
      pointer(s.hit,'pointerdown',a);pointer(s.hit,'pointerup',a)
      expect(s.progress,`${label} source-only ${at} ${width}`).toEqual([])
      pointer(s.hit,'pointerdown',s.source());arrive(s,label,at,true)
      expect(s.progress,`${label} sparse ${at} ${width}`).toEqual(progressAfter(label,at))
      if (placementContracts[label]) expect(s.complete).toHaveBeenCalledTimes(checkpointAfter(label,at)===3?1:0)
      s.instance.dispose()
    }
  })
  it('preserves an off-centre grip while moving the actual object', () => {
    for(const at of steps) {
      const s=mount(create,at,390),a=s.source(),press:[number,number]=[a[0]+(label==='willow'?.1:2),a[1]],dx=['rooster','licitar','house','egg'].includes(label)?-10:10,dy=['rooster','egg'].includes(label)?0:-10,next:[number,number]=[press[0]+dx,press[1]+dy]
      pointer(s.hit,'pointerdown',press)
      let expected:[number,number]=[a[0]+dx,a[1]+dy]
      if (label==='coal') {
        // Coal uses a horizontal carry plane. Perspective changes its screen
        // grip offset; derive the expected world translation with camera rays.
        const anchor=s.object.localToWorld(new THREE.Vector3(...(s.cue.anchor??[0,0,0]))),plane=new THREE.Plane(new THREE.Vector3(0,1,0),-anchor.y),ray=new THREE.Raycaster()
        const intersection=([x,y]:[number,number])=>{ray.setFromCamera(new THREE.Vector2((x-17)/390*2-1,1-(y-91)/408*2),s.camera);return ray.ray.intersectPlane(plane,new THREE.Vector3())!}
        expected=s.project(anchor.add(intersection(next).sub(intersection(press))))
      }
      pointer(s.hit,'pointermove',next)
      expect(s.progress,`${label} off-target ${at}`).toEqual([])
      const held=s.source()
      // The cloth tab also deforms on its fixed fabric plane. Its perspective
      // scale can change slightly while the retained world-space grip moves.
      const precision=label==='banner'?1:4
      expect(held[0],`${label} held x ${at}`).toBeCloseTo(expected[0],precision)
      expect(held[1],`${label} held y ${at}`).toBeCloseTo(expected[1],precision)
      pointer(s.hit,'pointercancel',next)
      const restored=s.source()
      expect(restored[0],`${label} restored x ${at}`).toBeCloseTo(a[0],4)
      expect(restored[1],`${label} restored y ${at}`).toBeCloseTo(a[1],4)
      s.instance.dispose()
    }
  })
})
