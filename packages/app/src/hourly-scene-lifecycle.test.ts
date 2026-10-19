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
  ['zeniarai-coin-washing', 0, 'wash-handle', 'wash-ladle', [.85,.28,0], [0,.115,.188], [0,-60]],
  ['udo-undama', 0, 'undama-ball', 'undama-ball', [-1.05,.63,1], [0,0,0], [0,-60]],
  ['japanese-daruma-otoshi', 0, 'otoshi-mallet-handle', 'otoshi-mallet', [-.96,.68,.6], [0,0,.6], [0,60]],
  ['paper-pinwheel', 0, 'pinwheel-vane-0', 'pinwheel-rotor', [.556,1.9538,.107], [.556,.1038,.107], [60,0]],
  ['chinese-steelyard', 0, 'steelyard-counterweight', 'steelyard-weight', [0.3443452924758425, 1.4326603506990385, .16], [0, -.48, .16], [60, 0]],
  ['garden-croquet', 0, 'croquet-grip', 'croquet-mallet', [-1.86, 1.65, .05], [.02, .1, .05], [-60, 0]],
  ['welsh-drop-spindle', 0, 'spindle-whorl', 'spindle-tool', [.43, 1.163, .15], [.43, 1.163, .15], [60, 0]],
  ['scottish-plunge-churn', 0, 'churn-grip', 'churn-dasher', [.04, 2.67, .06], [.04, .1, .06], [0, 60]],
  ['irish-bodhran', 0, 'bodhran-tip-right', 'bodhran-tipper', [.46, 1.125, .519], [0, .025, .06], [0, 60]],
  ['french-coffee-mill', 2, 'coffee-drawer-knob', 'coffee-drawer', [.02, .41, .815], [.02, 0, .075], [0, 60]],
  ['japanese-wagasa', 1, 'wagasa-grip', 'wagasa-spin', [.04, .475, .06], [.04, .1, .06], [60, 0]],
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
  const destination = (from: number[]) => screenDelta ? [from[0] + screenDelta[0], from[1] + screenDelta[1]] : point(target, targetAnchor)
  const from = point(source, sourceAnchor), staleEnd = destination(from)
  pointer(hit,'pointerdown',from)
  if (screenDelta) pointer(hit,'pointermove',[from[0] + screenDelta[0] * .35, from[1] + screenDelta[1] * .35])
  ctrl.setActive(false); ctrl.setActive(true)
  pointer(hit,'pointerup',staleEnd); expect(checkpoint).not.toHaveBeenCalled(); expect(variant).not.toHaveBeenCalled()
  const freshFrom = point(source, sourceAnchor), freshEnd = destination(freshFrom)
  pointer(hit,'pointerdown',freshFrom); pointer(hit,'pointermove',freshEnd); pointer(hit,'pointerup',freshEnd)
  if (id === 'korean-bojagi-wrap') {
    const step = Number(initialVariant!.slice(-1))
    expect(variant).toHaveBeenCalledExactlyOnceWith(`bojagi-step-${step + 1}`)
    if (step === 3 || step === 5) expect(checkpoint).toHaveBeenCalledExactlyOnceWith(step === 3 ? 1 : 2)
    else expect(checkpoint).not.toHaveBeenCalled()
  } else if (id === 'vietnamese-bamboo-dragonfly' && progress === 2) {
    expect(checkpoint).not.toHaveBeenCalled()
    host.querySelector<HTMLButtonElement>('.scene-bow-tap')!.click()
    expect(checkpoint).toHaveBeenCalledExactlyOnceWith(3)
  } else expect(checkpoint).toHaveBeenCalledExactlyOnceWith(id==='malawi-sansi'?2:progress+1)
})
