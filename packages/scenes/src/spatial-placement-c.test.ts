// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest'

// Isolate the existing object, geometry and callback contract from the ending clock.
// Real automatic endings are covered by quiet-ending-legacy-scenes and the craft integration suites.
vi.mock('./quiet-ending', () => ({ createQuietEnding: () => ({
  running: false, completing: true, sync() {}, update() {}, dispose() {},
}) }))
import * as THREE from 'three'
import * as Gestures from '@wbr/gestures'
import * as Shared from '@wbr/shared'
import type { SceneContext, SceneInstance } from './contract'
import type { InteractionCue } from '@wbr/scene-runtime/interaction-cues'
import * as canang from './balinese-canang-sari/index'
import * as cloth from './brat-bride-cloth/index'
import * as fu from './chinese-fu-paper/index'
import * as hiiragi from './hiiragi-iwashi/index'
import * as hamaya from './japanese-hamaya/index'
import * as uso from './kameido-usokae/index'
import * as lanna from './lanna-sand-pagoda/index'
import * as dolls from './russian-matryoshka/index'
import * as grapes from './spanish-twelve-grapes/index'
import * as stones from './sumiyoshi-godairiki/index'
import * as rug from './amazigh-woven-rug/index'
import * as giant from './catalan-festival-giant/index'
import * as hoop from './hungarian-embroidery-hoop/index'
import * as straw from './lithuanian-straw-garden/index'
import * as top from './minangkabau-spinning-top/index'
import * as copper from './purepecha-copper-bowl/index'
import * as bird from './slovak-wire-bird/index'
import * as spoon from './welsh-love-spoon/index'
import * as tea from './blang-tea/index'
import * as journal from './czech-pilgrim-journal/index'
import * as daruma from './daruma-eye-painting/index'
import * as candle from './votive-candle-catholic/index'
import * as ger from './mongolian-felt-ger/index'
import * as sumalak from './navruz-sumalak/index'
import * as sotdae from './korean-sotdae/index'
import * as steelyard from './chinese-steelyard/index'
import * as songkran from './thai-songkran-elders/index'
import * as washing from './zeniarai-coin-washing/index'
import * as bathing from './fgs-buddha-bathing/index'
import * as crane from './crane/index'
import * as malai from './phuang-malai/index'
import * as coffee from './french-coffee-mill/index'
import * as wagasa from './japanese-wagasa/index'
import * as molinillo from './mexican-molinillo/index'
import * as pinwheel from './paper-pinwheel/index'
import * as setsubun from './setsubun-mamemaki/index'
import * as koinobori from './japanese-koinobori/index'
import * as flags from './tibetan-prayer-flags/index'
import * as necklace from './niue-shell-necklace/index'
import * as glass from './venetian-glass-bead/index'
import { createCoffeeMillModel } from './french-coffee-mill/model'
import { createWagasaModel } from './japanese-wagasa/model'
import { createMolinilloModel } from './mexican-molinillo/model'
import { createPinwheelModel } from './paper-pinwheel/model'
import { createSetsubunModel } from './setsubun-mamemaki/model'
import { createKoinoboriModel } from './japanese-koinobori/model'
import { createKoreanSotdaeModel } from './korean-sotdae/model'
import { createSteelyardModel } from './chinese-steelyard/model'
import { createSongkranModel } from './thai-songkran-elders/model'
import { createCoinWashingModel } from './zeniarai-coin-washing/model'
import { createBuddhaBathingModel } from './fgs-buddha-bathing/model'
import { createCanangModel } from './balinese-canang-sari/model'
import { createBratBrideModel } from './brat-bride-cloth/model'
import { createChineseFuPaperModel } from './chinese-fu-paper/model'
import { createHiiragiModel } from './hiiragi-iwashi/model'
import { createJapaneseHamayaModel } from './japanese-hamaya/model'
import { createUsokaeModel } from './kameido-usokae/model'
import { createLannaSandPagodaModel } from './lanna-sand-pagoda/model'
import { createMatryoshkaModel } from './russian-matryoshka/model'
import { createSpanishTwelveGrapesModel } from './spanish-twelve-grapes/model'
import { createGodairikiModel } from './sumiyoshi-godairiki/model'

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
vi.mock('@wbr/scene-runtime/debug-render-style', () => ({ createDebugRenderStyle(_renderer: unknown, scene: THREE.Scene, camera: THREE.Camera) {
  rendered.scene = scene; rendered.camera = camera
  return { setStyle() {}, resize() {}, render() { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }, dispose() {} }
} }))
const cases = [
  ['balinese-canang-sari', canang.create, createCanangModel], ['brat-bride-cloth', cloth.create, createBratBrideModel],
  ['chinese-fu-paper', fu.create, createChineseFuPaperModel], ['hiiragi-iwashi', hiiragi.create, createHiiragiModel],
  ['japanese-hamaya', hamaya.create, createJapaneseHamayaModel], ['kameido-usokae', uso.create, createUsokaeModel],
  ['lanna-sand-pagoda', lanna.create, createLannaSandPagodaModel], ['russian-matryoshka', dolls.create, createMatryoshkaModel],
  ['spanish-twelve-grapes', grapes.create, createSpanishTwelveGrapesModel], ['sumiyoshi-godairiki', stones.create, createGodairikiModel],
  ['korean-sotdae', sotdae.create, createKoreanSotdaeModel], ['chinese-steelyard', steelyard.create, createSteelyardModel],
  ['thai-songkran-elders', songkran.create, createSongkranModel], ['zeniarai-coin-washing', washing.create, createCoinWashingModel],
  ['fgs-buddha-bathing', bathing.create, createBuddhaBathingModel],
] as const
// Legacy saved checkpoints retain their source poses. The accepted target is
// the end of the current continuous carry, not its removed intermediate stop.
function placementStep(id: string, at: number) {
  if (['brat-bride-cloth', 'chinese-fu-paper', 'japanese-hamaya', 'lanna-sand-pagoda', 'korean-sotdae'].includes(id)) return 2
  if (['balinese-canang-sari', 'chinese-steelyard', 'kameido-usokae'].includes(id)) return at === 0 ? 0 : 2
  if (id === 'thai-songkran-elders') return at < 2 ? 1 : 2
  return at
}
const existing = [
  ['amazigh-woven-rug', rug.create, [['rug-shuttle-grip', [0,0,0]], ['rug-top-grip', [0,0,0]]]],
  ['catalan-festival-giant', giant.create, [['giant-rosette-grip', [0,0,0]], ['giant-base-grip', [0,0,0]]]],
  ['hungarian-embroidery-hoop', hoop.create, [['hoop-spool-cap', [0,0,0]], ['hoop-body', [0,-.735,0]]]],
  ['lithuanian-straw-garden', straw.create, [['straw-pendant-grip', [0,0,0]], ['straw-lift-bead', [0,0,0]]]],
  ['minangkabau-spinning-top', top.create, [['top-pull-bead', [0,0,0]]]],
  ['purepecha-copper-bowl', copper.create, [['copper-polishing-pad', [0,0,0]], ['copper-bowl', [0,0,0]]]],
  ['slovak-wire-bird', bird.create, [['wire-wing-grip', [0,0,0]], ['wire-bird', [0,0,0]]]],
  ['welsh-love-spoon', spoon.create, [['spoon-cloth-grip', [0,0,0]], ['spoon-body', [0,0,0]]]],
  ['blang-tea', tea.create, [['tea-scoop-grip', [0,0,0]]]],
  ['czech-pilgrim-journal', journal.create, [null, ['journal-ribbon-grip', [0,0,0]]]],
  ['daruma-eye-painting', daruma.create, [null, null, ['daruma-doll', [0,0,0]]]],
  ['votive-candle-catholic', candle.create, [['votive-main-candle', [0,0,0]]]],
  ['mongolian-felt-ger', ger.create, [['ger-lattice-grip', [0,.06,.042]], ['ger-roof-crown', [0,.045,.355]], ['ger-felt-roll', [0,.06,.10]]]],
  ['navruz-sumalak', sumalak.create, [null, ['navruz-wooden-spoon-bowl', [0,0,0]], ['navruz-serving-bowl', [0,0,0]]]],
  ['crane', crane.create, [null, ['crane-held-paper', [0,0,0]]]],
  ['phuang-malai', malai.create, [['cluster-0', [0,0,.095]], ['garland', [0,0,0]], ['garland', [0,0,0]]]],
] as const
const instances: SceneInstance[] = []
const constrained = [
  ['french-coffee-mill', coffee.create, createCoffeeMillModel, [2]],
  ['japanese-wagasa', wagasa.create, createWagasaModel, [0,1,2]],
  ['mexican-molinillo', molinillo.create, createMolinilloModel, [0]],
  ['paper-pinwheel', pinwheel.create, createPinwheelModel, [1]],
  ['setsubun-mamemaki', setsubun.create, createSetsubunModel, [0]],
  ['japanese-koinobori', koinobori.create, createKoinoboriModel, [1,2]],
] as const
afterEach(() => { instances.splice(0).forEach(s => s.dispose()); document.body.replaceChildren(); vi.restoreAllMocks() })
function event(el: HTMLElement, type: string, p: readonly number[], id = 1) {
  const e = new Event(type, { bubbles: true, cancelable: true })
  Object.assign(e, { clientX: p[0], clientY: p[1], pointerId: id, pointerType: 'touch', button: 0, buttons: type === 'pointerup' ? 0 : 1 }); el.dispatchEvent(e)
}
function mount(create: (ctx: SceneContext) => SceneInstance, at: number, width = 390) {
  const height = 568, left = 17, top = 91, canvas = document.createElement('canvas'), overlay = document.createElement('div'), host = document.createElement('div')
  Object.defineProperties(canvas, { clientWidth: { value: width }, clientHeight: { value: height } })
  canvas.getBoundingClientRect = () => ({ left, top, width, height }) as DOMRect
  host.append(canvas, overlay); document.body.append(host)
  const progress: number[] = [], completed = vi.fn()
  overlay.addEventListener('scene:complete', completed)
  const instance = create({ canvas, overlay, gestures: Gestures, shared: Shared, initialProgress: at, isSoundEnabled: () => false, isReducedMotion: () => true, onProgress: n => progress.push(n) })
  instances.push(instance); instance.start(); instance.update(.025)
  const scene = rendered.scene as THREE.Scene, camera = rendered.camera as THREE.Camera, hit = overlay.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  function project(p: THREE.Vector3) { const q = p.clone().project(camera); return [left + (q.x + 1) * width / 2, top + (1 - q.y) * height / 2] as [number, number] }
  const cue = () => {
    const found: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => { for (const c of object.userData.interactionCues ?? []) if (c.enabled()) found.push({ object, cue: c }) })
    if (create === wagasa.create && at > 0) {
      expect(found.map(entry => entry.cue.kind).sort()).toEqual(['drag', 'rotate'])
      const closing = found.filter(entry => entry.cue.kind === 'drag')
      expect(closing).toHaveLength(1); return closing[0]!
    }
    expect(found).toHaveLength(1); return found[0]!
  }
  return { scene, hit, progress, completed, project, cue, instance }
}
describe('C group spatial object placement', () => {
  for(const[id,create,steps]of[['tibetan-prayer-flags',flags.create,[0,1,2]],['niue-shell-necklace',necklace.create,[0,1]],['venetian-glass-bead',glass.create,[1]]] as const)for(const at of steps){
    it(`${id} step ${at} moves its complete linked assembly to the physical end domain`,()=>{
      const s=mount(create,at),c=s.cue(),anchor=c.cue.anchor??[0,0,0],from=s.project(c.object.localToWorld(new THREE.Vector3(...anchor))),d=c.cue.destination!
      expect(d).toBeTruthy()
      const goal=s.project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3()))
      event(s.hit,'pointerdown',from);event(s.hit,'pointermove',[from[0]+(goal[0]-from[0])*.15,from[1]+(goal[1]-from[1])*.15]);expect(s.progress).toEqual([])
      const held=s.project(c.object.localToWorld(new THREE.Vector3(...anchor)));expect(Math.hypot(held[0]-from[0],held[1]-from[1])).toBeGreaterThan(.5)
      const checkpoint = id === 'tibetan-prayer-flags' && at > 0 ? 3 : at + 1
      event(s.hit,'pointermove',goal);expect(s.progress).toEqual([checkpoint]);event(s.hit,'pointerup',from);expect(s.progress).toEqual([checkpoint])
    })
  }
  for (const [id, create, factory, steps] of constrained) for (const at of steps) {
    it(`${id} step ${at} follows its physical constraint and accepts the actual limit before release`, () => {
      const s=mount(create,at),c=s.cue(),anchor=c.cue.anchor??[0,0,0]
      const source=s.project(c.object.localToWorld(new THREE.Vector3(...anchor))),model=factory()
      const targetStep = id === 'japanese-wagasa' && at > 0 ? 2 : at
      model.pose(targetStep,1)
      // Wagasa's runner marker follows the visible outer wall after viewing;
      // the independently posed mechanism still supplies its actual limit.
      const targetAnchor = id === 'japanese-wagasa' ? anchor : model.anchors[targetStep]!
      const goal=s.project(model.targets[targetStep]!.localToWorld(new THREE.Vector3(...targetAnchor)))
      event(s.hit,'pointerdown',source)
      event(s.hit,'pointermove',[source[0]+(goal[0]-source[0])*.2,source[1]+(goal[1]-source[1])*.2])
      const held=s.project(c.object.localToWorld(new THREE.Vector3(...anchor)))
      expect(Math.hypot(held[0]-source[0],held[1]-source[1])).toBeGreaterThan(1)
      expect(s.progress).toEqual([])
      event(s.hit,'pointermove',[source[0]-(goal[1]-source[1])*.2,source[1]+(goal[0]-source[0])*.2])
      event(s.hit,'pointermove',goal)
      const checkpoint = id === 'japanese-wagasa' && at === 0 ? 2 : targetStep + 1
      expect(s.progress).toEqual([checkpoint])
      event(s.hit,'pointermove',source);event(s.hit,'pointerup',source)
      expect(s.progress).toEqual([checkpoint])
    })
  }
  it('does not accept a hoop spool moved away from the blank stitch target and cancelled', () => {
    const s=mount(hoop.create,0),c=s.cue(),p=s.project(c.object.localToWorld(new THREE.Vector3(...(c.cue.anchor??[0,0,0]))))
    const d=c.cue.destination!,q=s.project(typeof d==='function'?d():d.getWorldPosition(new THREE.Vector3()))
    event(s.hit,'pointerdown',p);event(s.hit,'pointermove',[p[0]+(p[0]-q[0])*.2,p[1]+(p[1]-q[1])*.2]);event(s.hit,'pointercancel',p)
    expect(s.progress).toEqual([])
  })
  for (const [id, create, contacts] of existing) for (let at = 0; at < contacts.length; at++) {
    const spec = contacts[at]; if (!spec) continue
    it(`${id} step ${at} accepts the held contact at its visible destination before release`, () => {
      const s = mount(create, at), c = s.cue(), anchor = c.cue.anchor ?? [0,0,0]
      const source = s.project(c.object.localToWorld(new THREE.Vector3(...anchor)))
      const contactObject = s.scene.getObjectByName(spec[0])!
      expect(contactObject, spec[0]).toBeTruthy()
      const contact = s.project(contactObject.localToWorld(new THREE.Vector3(...spec[1])))
      const destination = c.cue.destination!
      expect(destination).toBeTruthy()
      const goal = s.project(typeof destination === 'function' ? destination() : destination.getWorldPosition(new THREE.Vector3()))
      const finger = goal
      event(s.hit, 'pointerdown', source)
      event(s.hit, 'pointermove', [source[0] + 8, source[1] + 13])
      event(s.hit, 'pointermove', finger)
      const expected=id==='phuang-malai'&&at!==1?[]:[at+1]
      if(id==='phuang-malai'&&at===0)expect(c.cue.enabled(),JSON.stringify({source,goal,held:s.project(contactObject.localToWorld(new THREE.Vector3(...spec[1])))})).toBe(false)
      if(id==='phuang-malai'&&at===2)expect(document.body.textContent).toContain('花环已放好')
      expect(s.progress).toEqual(expected)
      event(s.hit, 'pointerup', finger)
      expect(s.progress).toEqual(expected)
    })
  }
  for (const [id, create, modelFactory] of cases) {
    it.each(id==='korean-sotdae'?[0,2]:id==='thai-songkran-elders'?[0,1]:[0,1,2])(`${id} step %i follows a curved route and completes on arrival while held`, at => {
      const s = mount(create, at), model = modelFactory(), c = s.cue(), targetStep = placementStep(id, at)
      const anchor = c.cue.anchor ?? [0, 0, 0]
      const source = s.project(c.object.localToWorld(new THREE.Vector3(...anchor)))
      const phase=id==='fgs-buddha-bathing'?.55:id==='zeniarai-coin-washing'&&at===1?.25:id==='zeniarai-coin-washing'&&at===2?.4:1
      model.pose(targetStep, phase)
      const modelAnchor=model.anchors[targetStep]!, tuple=Array.isArray(modelAnchor)?modelAnchor:modelAnchor.toArray()
      const goalWorld = model.targets[targetStep]!.localToWorld(new THREE.Vector3(...tuple))
      if (id === 'russian-matryoshka' && at === 1) goalWorld.y += 1.10
      const goal = s.project(goalWorld)
      // The journey deliberately bends and reverses; acceptance depends on place.
      event(s.hit, 'pointerdown', source)
      event(s.hit, 'pointermove', [source[0] + 9, source[1] + 7])
      expect(s.progress).toEqual([])
      const moved = s.project(c.object.localToWorld(new THREE.Vector3(...anchor)))
      if(!(id==='chinese-steelyard'&&at===0)){
        expect(moved[0] - source[0]).toBeCloseTo(9, 3)
        expect(moved[1] - source[1]).toBeCloseTo(7, 3)
      }
      event(s.hit, 'pointermove', [source[0] - 16, source[1] + 22])
      event(s.hit, 'pointermove', goal)
      expect(s.progress).toEqual([targetStep + 1])
      event(s.hit, 'pointermove', [goal[0] + 40, goal[1] - 40])
      expect(s.progress).toEqual([targetStep + 1])
      event(s.hit, 'pointerup', goal)
      expect(s.progress).toEqual([targetStep + 1])
      if (targetStep === 2) expect(s.completed).toHaveBeenCalledOnce()
    })
    it(`${id} cancellation restores the whole object and does not commit`, () => {
      const s = mount(create, 0), c = s.cue(), anchor = c.cue.anchor ?? [0, 0, 0]
      const source = s.project(c.object.localToWorld(new THREE.Vector3(...anchor)))
      event(s.hit, 'pointerdown', source); event(s.hit, 'pointermove', [source[0] + 11, source[1] + 7]); event(s.hit, 'pointercancel', source)
      const restored = s.project(c.object.localToWorld(new THREE.Vector3(...anchor)))
      expect(restored[0]).toBeCloseTo(source[0], 5); expect(restored[1]).toBeCloseTo(source[1], 5); expect(s.progress).toEqual([])
    })
  }
})
