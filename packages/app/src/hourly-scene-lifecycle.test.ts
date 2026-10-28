// @vitest-environment jsdom
import { afterEach, expect, it, vi } from 'vitest'
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
it.each([0,1,2])('cancels the real Chinowa walking view through production adapter pause/resume at %i',async at=>{
  vi.stubGlobal('requestAnimationFrame',()=>1);vi.stubGlobal('cancelAnimationFrame',()=>{})
  vi.spyOn(HTMLCanvasElement.prototype,'clientWidth','get').mockReturnValue(360);vi.spyOn(HTMLCanvasElement.prototype,'clientHeight','get').mockReturnValue(408)
  vi.spyOn(HTMLCanvasElement.prototype,'getBoundingClientRect').mockReturnValue({left:0,top:0,width:360,height:408} as DOMRect)
  const host=document.createElement('div');document.body.append(host);const checkpoint=vi.fn(),engine=await proceduralEngine('chinowa-kuguri')
  const ctrl=engine.create(host,{progress:at,sceneId:'chinowa-kuguri',checkpoint,isSoundEnabled:()=>false},{active:true,reducedMotion:true,signal:new AbortController().signal,ready(){},failed(e){throw e}});controllers.push(ctrl)
  const scene=rendered.scene!,camera=rendered.camera!,hit=host.querySelector<HTMLElement>('.scene-hit-layer')!;hit.setPointerCapture=()=>{};hit.releasePointerCapture=()=>{}
  const home=camera.position.clone(),homeQ=camera.quaternion.clone(),ring=scene.getObjectByName('chinowa-hoop')!,worldBefore=ring.matrixWorld.clone(),p=ring.localToWorld(new THREE.Vector3(0,1.38,.15)).project(camera),from=[(p.x+1)*180,(1-p.y)*204],dx=at===1?60:-60
  pointer(hit,'pointerdown',from);pointer(hit,'pointermove',[from[0]!+dx*.5,from[1]!]);expect(camera.position.distanceTo(home)).toBeGreaterThan(.04);expect(ring.matrixWorld.elements).toEqual(worldBefore.elements)
  ctrl.setActive(false);ctrl.setActive(true);pointer(hit,'pointerup',[from[0]!+dx,from[1]!]);expect(checkpoint).not.toHaveBeenCalled();expect(camera.position.distanceTo(home)).toBe(0);expect(camera.quaternion.toArray()).toEqual(homeQ.toArray())
  pointer(hit,'pointerdown',from);pointer(hit,'pointermove',[from[0]!+dx,from[1]!]);pointer(hit,'pointerup',[from[0]!+dx,from[1]!]);expect(checkpoint.mock.calls.map(([n])=>n)).toEqual([at+1]);expect(camera.position.distanceTo(home)).toBe(0)
})

it.each([
  ['mezuzah-doorpost', 0, 'mezuzah-case', 'mezuzah-case', [0,0,.12], [0,0,.12], [0,-60]],
  ['mezuzah-doorpost', 1, 'mezuzah-case', 'mezuzah-case', [0,0,.12], [0,0,.12], [60,0]],
  ['mezuzah-doorpost', 2, 'mezuzah-case', 'mezuzah-case', [0,0,.12], [0,0,.12], [0,60]],
  ['sri-lankan-bodhi-puja', 0, 'bodhi-water-pitcher', 'bodhi-water-pitcher', [0,.30,.30], [0,.30,.30], [0,-60]],
  ['sri-lankan-bodhi-puja', 1, 'bodhi-water-pitcher', 'bodhi-water-pitcher', [0,.30,.30], [0,.30,.30], [60,0]],
  ['sri-lankan-bodhi-puja', 2, 'bodhi-water-pitcher', 'bodhi-water-pitcher', [0,.30,.30], [0,.30,.30], [0,60]],
  ['nanakusa-gayu', 0, 'serving-ladle', 'serving-ladle', [0,.42,.72], [0,0,0], [-60,0]],
  ['uchide-wishing-mallet', 0, 'uchide-mallet', 'uchide-mallet', [0,.425,-.2], [0,0,0], [0,-60]],
  ['kitano-nadeushi', 0, 'visitor-hand', 'visitor-hand', [0,0,0], [0,0,0], [0,-60]],
  ['lao-baci-wrist', 0, 'baci-thread', 'baci-thread', [0,0,0], [0,.394,.16], [0,-60]],
  ['finnish-virpominen', 0, 'decorated-willow', 'decorated-willow', [0,.40,0], [0,0,0], [60,0]],
  ['scottish-first-footing', 0, 'first-foot-coal', 'first-foot-coal', [0,0,0], [0,.23,.16], [0,-60]],
  ['hiiragi-iwashi', 0, 'holly-twig', 'holly-twig', [.20,.65,.02], [0,0,0], [0,-60]],
  ['tamagushi-offering', 0, 'tamagushi-leaf-0', 'tamagushi-branch', [0,0,0], [0,.015,0], [60,0]],
  ['tibetan-water-bowls', 0, 'water-jug', 'water-jug', [0,.28,.18], [0,0,0], [0,-60]],
  ['kagami-biraki-sake', 0, 'wooden-mallet', 'wooden-mallet', [0,.11,.04], [0,0,0], [0,-60]],
  ['tibetan-prayer-flags', 0, 'prayer-flags-blue', 'prayer-flags-blue', [0,0,.004], [0,0,.004], [0,-60]],
  ['yusheng-lohei', 0, 'diner-chopsticks', 'diner-chopsticks', [-.1,1.02,.03], [-.1,1.02,.03], [0,60]],
  ['rosh-hashanah-apple-honey', 0, 'apple-slice', 'apple-slice', [0,-.13,.06], [0,0,0], [60,0]],
  ['kameido-usokae', 0, 'old-wood-uso', 'old-wood-uso', [0,.82,.225], [0,0,0], [0,-60]],
  ['mongolian-ovoo', 0, 'ovoo-offering-0', 'ovoo-offering-0', [0,.05,.02], [0,0,0], [-60,0]],
  ['fgs-buddha-bathing', 0, 'bathing-grip', 'bathing-ladle-root', [0,0,.025], [0,0,0], [0,-60]],
  ['balinese-canang-sari', 0, 'canang-white-flower', 'canang-white-flower', [0,.05,0], [0,0,0], [60,0]],
  ['vietnamese-five-fruit-tray',0,'prepared-fruit-orange','prepared-fruit-orange',[0,.27,.18],[0,.27,.18],[60,0]],
  ['japanese-kumade',0,'kumade-tag-0','kumade-tag-0',[0,0,.035],[0,0,.035],[60,0]],
  ['neapolitan-cornicello',0,'cornicello-horn','cornicello-horn',[-.20,.15,-.30],[-.20,.15,-.30],[60,0]],
  ['spanish-twelve-grapes',0,'grapes-portion-0','grapes-portion-0',[0,.06,0],[0,.06,0],[60,0]],
  ['horseshoe-doorway-luck',0,'horseshoe-0','horseshoe-0',[0,.07,.06],[0,.07,.06],[60,0]],
  ['setsubun-mamemaki', 0, 'beans-door', 'beans-door-root', [.20,-.12,.04], [0,0,0], [60,0]],
  ['sternsinger-house-blessing', 0, 'sternsinger-chalk', 'sternsinger-chalk', [0,0,0], [0,.16,0], [0,-60]],
  ['lam-tsuen-wishing-tree', 0, 'lamtsuen-paper', 'lamtsuen-paper-root', [0,0,.007], [0,0,0], [60,0]],
  ['kagami-mochi-offering', 0, 'kagami-large', 'kagami-root-0', [0,.18,0], [0,0,0], [0,-60]],
  ['sumiyoshi-godairiki', 0, 'godairiki-stone-0', 'godairiki-stone-root-0', [0,0,0], [.15,.09,0], [60,0]],
  ['hindu-coconut-offering', 0, 'coconut-carrier', 'coconut-carrier', [0,0,.43], [0,0,.43], [0,-60]],
  ['hindu-coconut-offering', 1, 'coconut-carrier', 'coconut-carrier', [0,0,.43], [0,0,.43], [60,0]],
  ['hindu-coconut-offering', 2, 'coconut-carrier', 'coconut-carrier', [0,0,.43], [0,0,.43], [0,60]],
  ['polish-oplatek-sharing', 0, 'oplatek-main', 'oplatek-holder', [-.25,.015,0], [-.25,.015,0], [0,-60]],
  ['zeniarai-coin-washing', 0, 'wash-handle', 'wash-ladle', [.85,.28,0], [0,.115,.188], [0,-60]],
  ['japanese-daruma-otoshi', 0, 'otoshi-mallet-handle', 'otoshi-mallet', [-.96,.68,.6], [0,0,.6], [0,60]],
  ['paper-pinwheel', 0, 'pinwheel-vane-0', 'pinwheel-rotor', [.556,1.9538,.107], [.556,.1038,.107], [60,0]],
  ['chinese-steelyard', 0, 'steelyard-counterweight', 'steelyard-weight', [0.3443452924758425, 1.4326603506990385, .16], [0, -.48, .16], [60, 0]],
  ['garden-croquet', 0, 'croquet-grip', 'croquet-mallet', [-1.86, 1.65, .05], [.02, .1, .05], [-60, 0]],
  ['welsh-drop-spindle', 0, 'spindle-whorl', 'spindle-tool', [.43, 1.163, .15], [.43, 1.163, .15], [60, 0]],
  ['scottish-plunge-churn', 0, 'churn-grip', 'churn-dasher', [.04, 2.67, .06], [.04, .1, .06], [0, 60]],
  ['irish-bodhran', 0, 'bodhran-tip-right', 'bodhran-tipper', [.46, 1.125, .519], [0, .025, .06], [0, 60]],
  ['french-coffee-mill', 2, 'coffee-drawer-knob', 'coffee-drawer', [.02, .41, .815], [.02, 0, .075], [0, 60]],
  ['spanish-castanets', 1, 'cast-shell-upper-1', 'cast-pivot-1', [.95, .9, .3], [0, .30, .30], [0, 60]],
  ['japanese-shishi-odoshi', 1, 'sozu-tube', 'sozu-pivot', [.75, 1.3, .16], [.75, 0, .16], [0, 60]],
  ['german-jumping-jack', 0, 'jack-handle', 'jack-arm-pivot-1', [0, .55, -.2], [0, 0, 0], [0, 60]],
  ['finnish-kantele', 0, 'kantele-string-0', 'kantele-string-0', [0, .49, -.52], [-.05, 0, 0], [0, -60]],
  ['estonian-village-swing', 0, 'swing-front-plank', 'swing-platform', [0, 0, 0], [0, .07, 0], [0, -60]],
  ['french-petanque', 0, 'petanque-jack', 'petanque-jack-joint', [0, 0, 0], [0, 0, 0], [0, -60]],
  ['english-hearth-bellows', 0, 'bellows-upper-handle', 'bellows-upper-joint', [2.5, 0, 0], [0, .16, 0], [0, -60]],
  ['mexican-metate', 0, 'mano-grinding-stone', 'mano-joint', [0, 0, 0], [.14, .18, .06], [0, 60]],
  ['czech-wooden-ratchet', 0, 'ratchet-frame-grip', 'ratchet-frame', [0, 0, 0], [.15, .06, .30], [60, 0]],
  ['puerto-rican-guiro', 0, 'guiro-scraper-grip', 'guiro-scraper', [0, 0, 0], [0, .12, .065], [0, 60]],
  ['valencian-folding-fan', 0, 'fan-guard-right', 'fan-rib-joint-16', [0, 0, 0], [0, 2.83, .028], [60, 0]],
  ['mexican-tortilla-press', 0, 'tortilla-lid-knob', 'tortilla-lid-joint', [0, 0, 0], [.08, .02, .04], [0, 60]],
  ['ghanaian-oware', 0, 'oware-hand-seed-0', 'oware-carry', [.05, .04, .03], [0, 0, 0], [0, -60]],
  ['chinese-rattle-drum', 0, 'rattle-drum-grip', 'rattle-drum-grip', [0, 0, .108], [0, 0, .108], [60, 0]],
  ['chinese-tangram', 0, 'tangram-small-1-shell', 'tangram-small-1', [0, .09, 0], [0, .09, 0], [-60, 0]],
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
  const gesture = () => {
    rendered.scene!.updateMatrixWorld(true); rendered.camera!.updateMatrixWorld(true)
    const entries: { object: THREE.Object3D; cue: InteractionCue }[] = []
    rendered.scene!.traverse(object => {
      for (const cue of (object.userData.interactionCues ?? []) as InteractionCue[])
        if (cue.enabled() && cue.destination) entries.push({ object, cue })
    })
    const current = entries.sort((a,b) => (b.cue.priority ?? 0) - (a.cue.priority ?? 0))[0]
    if (current) {
      const { object, cue } = current
      const from = point(object.name, cue.anchor ?? [0,0,0])
      const world = typeof cue.destination === 'function' ? cue.destination() : cue.destination!.getWorldPosition(new THREE.Vector3())
      const p = world.project(rendered.camera!), to = [(p.x+1)*180,(1-p.y)*180]
      return { from, to, spatial: true }
    }
    // Physical paths, rotation, body movement and performance keep their
    // existing directional gesture when no actual destination is displayed.
    const from = point(source, sourceAnchor)
    return { from, to: screenDelta ? [from[0]+screenDelta[0],from[1]+screenDelta[1]] : point(target,targetAnchor), spatial: false }
  }
  const { from, to: staleEnd, spatial } = gesture()
  pointer(hit,'pointerdown',from)
  if (spatial) {
    const dx=staleEnd[0]-from[0],dy=staleEnd[1]-from[1],length=Math.max(1,Math.hypot(dx,dy))
    // Pause an unfinished grab. Reaching a destination is already an accepted
    // operation, so cancelling after arrival would test a different contract.
    pointer(hit,'pointermove',[from[0]-dx/length*25,from[1]-dy/length*25])
  } else if (screenDelta) pointer(hit,'pointermove',[from[0]+screenDelta[0]*.35,from[1]+screenDelta[1]*.35])
  expect(checkpoint).not.toHaveBeenCalled(); expect(variant).not.toHaveBeenCalled()
  ctrl.setActive(false); ctrl.setActive(true)
  pointer(hit,'pointerup',staleEnd); expect(checkpoint).not.toHaveBeenCalled(); expect(variant).not.toHaveBeenCalled()
  const { from: freshFrom, to: freshEnd } = gesture()
  pointer(hit,'pointerdown',freshFrom)
  if (id === 'scottish-first-footing') {
    // The coal must pass through the real door opening before turning toward
    // the hearth. A straight screen drag to the hearth intersects the wall.
    for (const [x, z] of [[.45, .85], [.45, .40], [.45, -.02], [-.75, -.02]]) {
      const contact = new THREE.Vector3(x, .73, z + .16).project(rendered.camera!)
      pointer(hit, 'pointermove', [(contact.x + 1) * 180, (1 - contact.y) * 180])
      expect(checkpoint).not.toHaveBeenCalled()
    }
  }
  pointer(hit,'pointermove',freshEnd); pointer(hit,'pointerup',freshEnd)
  if (id === 'korean-bojagi-wrap') {
    const step = Number(initialVariant!.slice(-1))
    expect(variant).toHaveBeenCalledExactlyOnceWith(`bojagi-step-${step + 1}`)
    if (step === 3 || step === 5) expect(checkpoint).toHaveBeenCalledExactlyOnceWith(step === 3 ? 1 : 2)
    else expect(checkpoint).not.toHaveBeenCalled()
  } else if (id === 'vietnamese-bamboo-dragonfly' && progress === 2) {
    expect(checkpoint).not.toHaveBeenCalled()
    host.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
    expect(checkpoint).toHaveBeenCalledExactlyOnceWith(3)
  } else if (id === 'scottish-first-footing') {
    expect(checkpoint).toHaveBeenCalledExactlyOnceWith(3)
  } else expect(checkpoint).toHaveBeenCalledExactlyOnceWith(id==='malawi-sansi'?2:progress+1)
})

// Current continuous-carry contracts from the 2026-10-28 scene READMEs:
// pure placement restores any old checkpoint and commits only 3; carrying
// before a distinct action restores 0/1, commits 2, then requires a new gesture.
const continuousPlacements = [
  'brat-bride-cloth', 'korean-sotdae', 'japanese-kadomatsu',
  'pucara-rooftop-bulls', 'chinese-longevity-lock', 'alasita-miniature-house',
  'mochigase-nagashibina', 'shichigosan-chitose-ame', 'lanna-sand-pagoda',
  'chinese-fu-paper', 'turkish-nazar-bead', 'japanese-hamaya',
  'chinese-ruyi-scepter', 'romanian-martisor',
]
const carryingBeforeAction = [
  'thai-songkran-elders', 'persian-esfand', 'greek-vasilopita',
  'tibetan-khata-greeting', 'bulgarian-survakane', 'udo-undama',
]

it.each([
  ...continuousPlacements.flatMap(id => [0, 1, 2].map(progress => ({ id, progress, next: 3 }))),
  ...carryingBeforeAction.flatMap(id => [0, 1].map(progress => ({ id, progress, next: 2 }))),
])('cancels $id continuous carrying restored at $progress and preserves its completion boundary', async ({ id, progress, next }) => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 360 } as DOMRect)
  const host = document.createElement('div'); document.body.append(host)
  const checkpoint = vi.fn(), complete = vi.fn(), engine = await proceduralEngine(id)
  host.addEventListener('scene:complete', complete)
  const ctrl = engine.create(host, { progress, sceneId: id, checkpoint, isSoundEnabled: () => false },
    { active: true, reducedMotion: true, signal: new AbortController().signal, ready() {}, failed(error) { throw error } })
  controllers.push(ctrl)
  const scene = rendered.scene!, camera = rendered.camera!, hit = host.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const project = (world: THREE.Vector3) => {
    const p = world.clone().project(camera)
    return [(p.x + 1) * 180, (1 - p.y) * 180]
  }
  const currentGesture = () => {
    matrices()
    const entries: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => {
      for (const cue of (object.userData.interactionCues ?? []) as InteractionCue[])
        if (cue.enabled() && cue.kind === 'drag') entries.push({ object, cue })
    })
    const current = entries.sort((a, b) => (b.cue.priority ?? 0) - (a.cue.priority ?? 0))[0]
    expect(current, 'the current action must expose its actual draggable object').toBeDefined()
    const { object, cue } = current!
    const anchor = () => { matrices(); return object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))) }
    const from = project(anchor())
    const destination = cue.destination
      ? typeof cue.destination === 'function' ? cue.destination() : cue.destination.getWorldPosition(new THREE.Vector3())
      : undefined
    expect(destination || cue.direction, 'the cue must describe a destination or a physical gesture').toBeDefined()
    const to = destination ? project(destination) : [from[0]! + cue.direction![0] * 60, from[1]! + cue.direction![1] * 60]
    return { from, to, anchor, destination }
  }
  const awayFromTarget = ({ from, to }: { from: number[]; to: number[] }) => {
    const dx = to[0]! - from[0]!, dy = to[1]! - from[1]!, length = Math.max(1, Math.hypot(dx, dy))
    return [from[0]! - dx / length * 25, from[1]! - dy / length * 25]
  }
  const offTargetRelease = ({ from, to }: { from: number[]; to: number[] }) => {
    // These saved poses sit against a sill, ground or branch. Move into the
    // visible open space rather than releasing the cue behind that support.
    if (!(id === 'brat-bride-cloth' && progress === 0) && !(id === 'romanian-martisor' && progress !== 1))
      return awayFromTarget({ from, to })
    const dx = to[0]! - from[0]!, dy = to[1]! - from[1]!, length = Math.hypot(dx, dy)
    if (length > 60) return [from[0]! + dx / length * 25, from[1]! + dy / length * 25]
    return length > 1 ? [from[0]! - dy / length * 30, from[1]! + dx / length * 30] : [from[0]! + 30, from[1]!]
  }

  expect(checkpoint).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled()
  const first = currentGesture(), savedAnchor = first.anchor()
  expect(first.destination, 'carrying must target the real support or recipient').toBeDefined()
  pointer(hit, 'pointerdown', first.from); pointer(hit, 'pointermove', awayFromTarget(first))
  expect(first.anchor().distanceTo(savedAnchor), 'the unfinished grab must actually move the object').toBeGreaterThan(.02)
  expect(checkpoint).not.toHaveBeenCalled()
  ctrl.setActive(false)
  expect(first.anchor().distanceTo(savedAnchor), 'host pause must restore the saved pose').toBeLessThan(1e-8)
  ctrl.setActive(true)
  pointer(hit, 'pointerup', first.to)
  expect(checkpoint).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled()

  // An ordinary off-target release retains the held pose, so the successful
  // retry must re-grab the object's current cue rather than its old screen point.
  const inspect = currentGesture(), heldEnd = offTargetRelease(inspect)
  pointer(hit, 'pointerdown', inspect.from); pointer(hit, 'pointermove', heldEnd); pointer(hit, 'pointerup', heldEnd)
  expect(inspect.anchor().distanceTo(savedAnchor)).toBeGreaterThan(.02)
  expect(checkpoint).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled()
  const fresh = currentGesture()
  pointer(hit, 'pointerdown', fresh.from); pointer(hit, 'pointermove', fresh.to); pointer(hit, 'pointerup', fresh.to)
  expect(checkpoint).toHaveBeenCalledExactlyOnceWith(next)
  const action = host.querySelector<HTMLButtonElement>('.scene-bow-tap')!
  if (next === 2) {
    expect(complete, 'carrying alone must not complete pouring, wafting, coin removal, handover, tapping or throwing').not.toHaveBeenCalled()
    expect(action.hidden).toBe(false)
    const final = currentGesture()
    pointer(hit, 'pointerdown', final.from); pointer(hit, 'pointermove', final.to); pointer(hit, 'pointerup', final.to)
    expect(checkpoint.mock.calls.map(([value]) => value)).toEqual([2, 3])
  }
  expect(complete).toHaveBeenCalledTimes(1)
  expect(action.hidden).toBe(true)
  ctrl.setActive(false); ctrl.setActive(true)
  pointer(hit, 'pointerup', fresh.to)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(next === 2 ? [2, 3] : [3])
  expect(complete).toHaveBeenCalledTimes(1)
})

it.each([0, 1, 2])('preserves real wagasa opening, optional viewing and folding through adapter pause at %i', async progress => {
  vi.stubGlobal('requestAnimationFrame', () => 1); vi.stubGlobal('cancelAnimationFrame', () => {})
  vi.spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get').mockReturnValue(360)
  vi.spyOn(HTMLCanvasElement.prototype, 'getBoundingClientRect').mockReturnValue({ left: 0, top: 0, width: 360, height: 360 } as DOMRect)
  const host = document.createElement('div'); document.body.append(host)
  const checkpoint = vi.fn(), complete = vi.fn(), engine = await proceduralEngine('japanese-wagasa')
  host.addEventListener('scene:complete', complete)
  const ctrl = engine.create(host, { progress, sceneId: 'japanese-wagasa', checkpoint, isSoundEnabled: () => false },
    { active: true, reducedMotion: true, signal: new AbortController().signal, ready() {}, failed(error) { throw error } })
  controllers.push(ctrl)
  const scene = rendered.scene!, camera = rendered.camera!, hit = host.querySelector<HTMLElement>('.scene-hit-layer')!
  hit.setPointerCapture = () => {}; hit.releasePointerCapture = () => {}
  const project = (world: THREE.Vector3) => { const p = world.clone().project(camera); return [(p.x + 1) * 180, (1 - p.y) * 180] }
  const cueFor = (kind: InteractionCue['kind']) => {
    scene.updateMatrixWorld(true); camera.updateMatrixWorld(true)
    const entries: { object: THREE.Object3D; cue: InteractionCue }[] = []
    scene.traverse(object => {
      for (const cue of (object.userData.interactionCues ?? []) as InteractionCue[])
        if (cue.enabled() && cue.kind === kind) entries.push({ object, cue })
    })
    expect(entries).toHaveLength(1)
    const { object, cue } = entries[0]!
    const from = project(object.localToWorld(new THREE.Vector3(...(cue.anchor ?? [0, 0, 0]))))
    const destination = cue.destination
    const to = destination ? project(typeof destination === 'function' ? destination() : destination.getWorldPosition(new THREE.Vector3())) : undefined
    return { object, from, to }
  }
  const runner = scene.getObjectByName('wagasa-runner')!, spin = scene.getObjectByName('wagasa-spin')!
  const accepted = progress === 0 ? [2] : []
  expect(checkpoint).not.toHaveBeenCalled(); expect(complete).not.toHaveBeenCalled()
  if (progress === 0) {
    const opening = cueFor('drag')
    pointer(hit, 'pointerdown', opening.from); pointer(hit, 'pointermove', opening.to!); pointer(hit, 'pointerup', opening.to!)
    expect(checkpoint.mock.calls.map(([value]) => value)).toEqual([2])
    expect(complete, 'opening must leave folding as a separate mechanism action').not.toHaveBeenCalled()
  }

  const view = cueFor('rotate'), savedTurn = spin.quaternion.clone(), openedHeight = runner.position.y
  const viewEnd = [view.from[0]! - 45, view.from[1]!]
  pointer(hit, 'pointerdown', view.from); pointer(hit, 'pointermove', viewEnd)
  expect(spin.quaternion.angleTo(savedTurn), 'the real grip must turn the open umbrella').toBeGreaterThan(.4)
  expect(runner.position.y, 'viewing must not move the opening linkage').toBe(openedHeight)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(accepted)
  ctrl.setActive(false); ctrl.setActive(true); pointer(hit, 'pointerup', viewEnd)
  expect(spin.quaternion.angleTo(savedTurn)).toBeLessThan(1e-8)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(accepted)
  expect(complete).not.toHaveBeenCalled()

  const closing = cueFor('drag'), savedRunner = runner.position.clone()
  pointer(hit, 'pointerdown', closing.from)
  pointer(hit, 'pointermove', closing.from.map((value, axis) => value + (closing.to![axis]! - value) * .12))
  expect(runner.position.distanceTo(savedRunner)).toBeGreaterThan(.005)
  ctrl.setActive(false); ctrl.setActive(true); pointer(hit, 'pointerup', closing.to!)
  expect(runner.position.distanceTo(savedRunner)).toBeLessThan(1e-8)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual(accepted)
  const fresh = cueFor('drag')
  pointer(hit, 'pointerdown', fresh.from); pointer(hit, 'pointermove', fresh.to!); pointer(hit, 'pointerup', fresh.to!)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual([...accepted, 3])
  expect(complete).toHaveBeenCalledTimes(1)
  expect(host.querySelector<HTMLButtonElement>('.scene-bow-tap')!.hidden).toBe(true)
  ctrl.setActive(false); ctrl.setActive(true); pointer(hit, 'pointerup', fresh.to!)
  expect(checkpoint.mock.calls.map(([value]) => value)).toEqual([...accepted, 3])
  expect(complete).toHaveBeenCalledTimes(1)
})
