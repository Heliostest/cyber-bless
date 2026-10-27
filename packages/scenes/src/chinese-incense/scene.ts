import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import { placementHit } from '../placement-hit'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '炉前一炷', lidAction: '移开炉盖', incenseAction: '安放一炷香', quietAction: '轻点茶托看烟',
  lid: '捏住圆盖钮，拖到右侧盖托，露出炉内的香孔。',
  incense: '握住暖色纸套，把一炷细香拖进炉内的小香孔。',
  quiet: '轻点茶托或炉身，静看轻烟，体会妈祖信俗中敬香祈安的心意。',
  returning: '轻点茶托或炉身，再看炉前轻烟，回想敬香祈安的心意。',
  movingLid: '炉盖轻轻落在陶托上…', movingIncense: '细香安稳落入香孔，纸套留在桌边…',
  done: '细香已安放，留一刻静赏，向敬香祈安的传统致意。',
} as const
const LID_HOME = new THREE.Vector3(.12, 1.44, -.22)
const LID_REST = new THREE.Vector3(1.035, .635, .36)
const STICK_HOME = new THREE.Vector3(-1.00, .61, .22)
const STICK_REST = new THREE.Vector3(.12, 1.385, -.22)
type Checkpoint = 0 | 1 | 2 | 3
type Placement = { step: 0 | 1; time: number; from: THREE.Vector3; paperFrom: THREE.Vector3 }
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Original ceramic still life: a cultural tribute, without an altar, deity or ancestral rite. */
export function createChineseIncense(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0
  let dragging = false, maxTravel = 0, placement: Placement | null = null, inactiveRendered = false, elapsed = 0
  let stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.lidAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'chinese-incense', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff2dd, ground: 0xb1bbac, key: 0xffe4c5, rim: 0xd8e9df,
    keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0007; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'incense-world'; scene.add(world)
  const material = (color: number, roughness = .86) => new THREE.MeshStandardMaterial({ color, roughness })
  const jade = material(0x9db9a8, .66), jadeLight = material(0xc0d2bd, .71), jadeDark = material(0x718d7c)
  const clay = material(0xba9676), cream = material(0xf0e2c3), wood = material(0xbb8e68), woodLight = material(0xd9b68a)
  const paperMat = material(0xc98468), paperSeam = material(0xe6b995), stickMat = material(0x88624c), bamboo = material(0xcbab73)
  const ash = material(0xd4c9b3), dark = material(0x625f50), teaMat = material(0x8f713e, .63)
  const emberMat = new THREE.MeshStandardMaterial({ color: 0xcd7853, emissive: 0x8b381c, emissiveIntensity: .28, roughness: 1 })
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world, name = '') => {
    const mesh = new THREE.Mesh(geo, mat); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const sphere = new THREE.SphereGeometry(1, 28, 18)
  const pebble = (p: [number, number, number], scale: [number, number, number], mat: THREE.Material, parent: THREE.Object3D, name = '') => {
    const mesh = add(sphere, mat, p, parent, name); mesh.scale.set(...scale); return mesh
  }
  const lathe = (points: number[][], mat: THREE.Material, parent: THREE.Object3D, name: string) =>
    add(new THREE.LatheGeometry(points.map(([x, y]) => new THREE.Vector2(x, y)), 64), mat, [0, 0, 0], parent, name)
  const ring = (radius: number, thickness: number, p: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = world) => {
    const mesh = add(new THREE.TorusGeometry(radius, thickness, 8, 56), mat, p, parent); mesh.rotation.x = Math.PI / 2; return mesh
  }
  const tube = (points: THREE.Vector3[], thickness: number, mat: THREE.Material, parent: THREE.Object3D, name = '') => {
    const mesh = add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 40, thickness, 7, false), mat, [0, 0, 0], parent, name)
    mesh.userData.toonSurface = { outline: false }; return mesh
  }

  const table = new THREE.Group(); table.name = 'incense-table'; world.add(table)
  add(new RoundedBoxGeometry(3.25, .14, 1.8, 4, .085), woodLight, [0, .48, 0], table)
  for (const x of [-1.22, 1.22]) for (const z of [-.58, .58]) {
    const foot = add(new RoundedBoxGeometry(.18, .44, .18, 3, .045), wood, [x, .22, z], table)
    foot.rotation.z = x > 0 ? -.025 : .025
  }
  for (const z of [-.64, .64]) add(new RoundedBoxGeometry(2.64, .16, .08, 3, .025), wood, [0, .38, z], table)
  for (const z of [-.45, -.06, .33]) {
    tube([new THREE.Vector3(-1.40, .553, z), new THREE.Vector3(-.6, .553, z + .023), new THREE.Vector3(.25, .553, z - .012), new THREE.Vector3(1.40, .553, z + .008)], .004, wood, table)
  }
  const shadow = add(new THREE.PlaneGeometry(3.9, 2.5), new THREE.ShadowMaterial({ opacity: .12 }), [0, .003, 0])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  const mat = add(new RoundedBoxGeometry(1.51, .025, 1.34, 4, .13), cream, [.12, .565, -.22], world, 'incense-woven-mat')
  mat.userData.toonSurface = { outline: false }
  for (let i = 0; i < 15; i++) {
    const thread = add(new THREE.BoxGeometry(.006, .003, 1.12), clay, [-.51 + i * .09, .580, -.22]); thread.userData.toonSurface = { outline: false }
  }

  const censer = new THREE.Group(); censer.name = 'incense-censer'; censer.position.set(.12, .78, -.22); world.add(censer)
  const feet = new THREE.Group(); feet.name = 'incense-three-feet'; censer.add(feet)
  // Three rounded lobes belong to the vessel itself, grounded at the tabletop.
  for (let i = 0; i < 3; i++) {
    const angle = Math.PI / 2 + i * Math.PI * 2 / 3
    const foot = pebble([Math.cos(angle) * .35, -.09, Math.sin(angle) * .35], [.13, .14, .13], jadeDark, feet, `incense-foot-${i + 1}`)
    foot.rotation.y = -angle
  }
  const body = lathe([[0, .015], [.20, .015], [.36, .045], [.47, .13], [.56, .29], [.574, .40], [.55, .48], [.49, .55],
    [.495, .60], [.52, .62], [.52, .65], [.47, .655], [.448, .62], [.45, .55], [.494, .45], [.51, .36], [.46, .20], [.33, .115], [0, .10]], jade, censer, 'incense-censer-body')
  ring(.505, .025, [0, .635, 0], jadeLight, censer)
  ring(.352, .012, [0, .085, 0], clay, censer)
  // Two restrained scroll ears are ceramic handles, not an inherited pot silhouette.
  for (const side of [-1, 1]) {
    tube([new THREE.Vector3(side * .51, .36, -.01), new THREE.Vector3(side * .67, .38, -.015), new THREE.Vector3(side * .71, .52, -.018), new THREE.Vector3(side * .64, .57, -.02), new THREE.Vector3(side * .56, .50, -.02)], .044, jadeLight, censer, `incense-scroll-ear-${side}`)
  }
  const sand = add(new THREE.CylinderGeometry(.44, .42, .035, 56), ash, [0, .572, 0], censer, 'incense-ash-bed')
  sand.userData.toonSurface = { outline: false }
  for (let i = 0; i < 5; i++) ring(.18 + i * .041, .003, [0, .592, 0], cream, censer).userData.toonSurface = { outline: false }
  // A recessed, broad ceramic socket is visibly dark and physically hittable through its opening.
  const socket = add(new THREE.CylinderGeometry(.165, .165, .018, 40), dark, [0, .605, 0], censer, 'incense-socket')
  ring(.182, .025, [0, .608, 0], jadeLight, censer)

  const lid = new THREE.Group(); lid.name = 'incense-lid'; world.add(lid)
  lathe([[0, .165], [.12, .155], [.29, .125], [.43, .065], [.52, .027], [.53, .006], [.51, 0], [.42, .035], [.28, .083], [.12, .119], [0, .125]], jade, lid, 'incense-lid-dome')
  ring(.512, .014, [0, .016, 0], jadeLight, lid)
  const knob = pebble([0, .30, 0], [.22, .215, .22], jadeLight, lid, 'incense-lid-knob')
  ring(.12, .017, [0, .147, 0], clay, lid)
  for (let i = 0; i < 8; i++) {
    const angle = i / 8 * Math.PI * 2, dot = pebble([Math.cos(angle) * .342, .105, Math.sin(angle) * .342], [.018, .008, .026], jadeDark, lid)
    dot.rotation.y = -angle; dot.userData.toonSurface = { outline: false }
  }
  const rest = add(new THREE.CylinderGeometry(.58, .54, .06, 56), cream, [1.035, .605, .36], world, 'incense-lid-rest')
  ring(.566, .012, [1.035, .63, .36], clay)

  const paper = new THREE.Group(); paper.name = 'incense-paper-holder'; world.add(paper)
  const grip = add(new RoundedBoxGeometry(.59, .61, .09, 4, .035), paperMat, [0, .315, .035], paper, 'incense-paper-grip')
  add(new RoundedBoxGeometry(.034, .58, .012, 2, .006), paperSeam, [-.23, .315, .088], paper)
  add(new RoundedBoxGeometry(.59, .045, .09, 2, .012), paperSeam, [0, .604, .035], paper)
  // A small printed sprig helps the broad, honest paper grip read as a material object.
  tube([new THREE.Vector3(.045, .12, .089), new THREE.Vector3(.026, .23, .089), new THREE.Vector3(.047, .34, .089)], .006, cream, paper)
  for (const [x, y, tilt] of [[.004, .19, -.65], [.055, .255, .65], [.02, .30, -.6]]) {
    const leaf = pebble([x, y, .09], [.012, .034, .007], cream, paper); leaf.rotation.z = tilt; leaf.userData.toonSurface = { outline: false }
  }
  const tray = add(new RoundedBoxGeometry(.70, .045, .56, 4, .10), clay, [-1, .5825, .22], world, 'incense-stick-tray')
  tray.userData.toonSurface = { outline: false }
  const stick = new THREE.Group(); stick.name = 'incense-stick'; world.add(stick)
  add(new THREE.CylinderGeometry(.018, .018, .25, 12), bamboo, [0, .125, 0], stick, 'incense-stick-base')
  const foot = new THREE.Object3D(); foot.name = 'incense-stick-foot'; stick.add(foot)
  add(new THREE.CylinderGeometry(.022, .022, .80, 14), stickMat, [0, .65, 0], stick, 'incense-fine-stick')
  const ember = pebble([0, 1.055, 0], [.023, .026, .023], emberMat, stick, 'incense-ember')
  const smoke = new THREE.Group(); smoke.name = 'incense-smoke'; smoke.position.set(.12, 2.465, -.22); world.add(smoke)
  const smokeMat = new THREE.MeshStandardMaterial({ color: 0xd6d9c9, transparent: true, opacity: .30, depthWrite: false, roughness: 1 })
  for (let i = 0; i < 2; i++) {
    tube(Array.from({ length: 16 }, (_, j) => {
      const t = j / 15
      return new THREE.Vector3(Math.sin(t * Math.PI * 2.3 + i * .7) * (.015 + t * .052), t * .46, Math.sin(t * 3 + i) * .024)
    }), i ? .009 : .016, smokeMat, smoke, `incense-smoke-thread-${i}`)
  }

  const tea = new THREE.Group(); tea.name = 'incense-tea'; tea.position.set(-.04, .55, .64); world.add(tea)
  const saucer = add(new THREE.CylinderGeometry(.29, .26, .038, 48), jadeLight, [0, .022, 0], tea, 'incense-tea-saucer')
  ring(.276, .012, [0, .043, 0], cream, tea)
  const cup = new THREE.Group(); cup.name = 'incense-teacup'; cup.position.set(0, .04, -.075); tea.add(cup)
  lathe([[0, 0], [.11, 0], [.14, .03], [.184, .13], [.191, .20], [.177, .21], [.167, .18], [.14, .065], [.09, .035], [0, .035]], cream, cup, 'incense-teacup-body')
  ring(.181, .009, [0, .202, 0], clay, cup)
  add(new THREE.CylinderGeometry(.164, .151, .012, 40), teaMat, [0, .174, 0], cup, 'incense-tea-surface')

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  function pose() {
    lid.position.copy(checkpoint >= 1 ? LID_REST : LID_HOME)
    stick.position.copy(checkpoint >= 2 ? STICK_REST : STICK_HOME)
    paper.position.copy(STICK_HOME); paper.rotation.set(0, 0, checkpoint >= 2 ? -.15 : 0)
    ember.visible = smoke.visible = checkpoint >= 2
    matrices()
  }
  const source = () => checkpoint === 0 ? knob : checkpoint === 1 ? grip : saucer
  const carried = () => checkpoint === 0 ? lid : stick
  const cueAt = (n: Checkpoint) => () => active() && !placement && checkpoint === n
  addInteractionCue(knob, { kind: 'drag', label: '拖圆钮移开炉盖', priority: 3, enabled: cueAt(0), destination: rest, targetLabel: '右侧盖托' })
  addInteractionCue(grip, { kind: 'drag', label: '握纸套安放细香', priority: 3, enabled: cueAt(1), destination: socket, targetLabel: '炉内香孔' })
  // The saucer's forward lip remains exposed below its teacup.
  addInteractionCue(saucer, { kind: 'tap', label: '轻点茶托看烟', anchor: [0, .019, .20], priority: 3, enabled: cueAt(2) })
  const quietObjects: THREE.Object3D[] = [saucer, body]
  cup.traverse(object => { if ((object as THREE.Mesh).isMesh) quietObjects.push(object) })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), dragPoint = new THREE.Vector3(), offset = new THREE.Vector3(), down = new THREE.Vector2()
  const touch = createTouchTarget(canvas, camera, scene), dropFeedback = createDropFeedback(ui.hintEl, safe)
  const placementReady = (x: number, y: number) => checkpoint < 2
    && !touch.occluded(x, y, checkpoint === 0 ? rest : socket, { ignore: checkpoint === 0 ? lid : [stick, paper] })
    && placementHit(canvas, camera, source(), x, y, (px, py) => touch.hit(px, py, checkpoint === 0 ? rest : socket, { ignore: checkpoint === 0 ? lid : [stick, paper] }))
  const resetDrag = () => { dropFeedback.clear(); dragging = false; maxTravel = 0; if (!placement) pose() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { matrices(); return !placement && checkpoint < 3 && touch.hit(x, y, checkpoint === 2 ? quietObjects : [source()]) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare()
      if (dragging) {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), source().getWorldPosition(new THREE.Vector3()))
        if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) offset.copy(carried().position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || checkpoint >= 2) return
      if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1.25, 1.25)
        carried().position.y = THREE.MathUtils.clamp(carried().position.y, .61, 1.65)
        if (checkpoint === 1) paper.position.copy(stick.position)
        matrices(); dropFeedback.setReady(placementReady(x, y))
      }
      if (checkpoint < 2 && placementReady(x,y) && pointer.finish()) { dragging = false; dropFeedback.clear(); beginPlacement(true) }
    },
    onRelease(x, y) {
      if (dragging && checkpoint < 2 && ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1.25, 1.25)
        carried().position.y = THREE.MathUtils.clamp(carried().position.y, .61, 1.65)
        if (checkpoint === 1) paper.position.copy(stick.position)
      }
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementReady(x, y)
        : checkpoint === 2 && maxTravel < 12 && touch.hit(x, y, quietObjects)
      dropFeedback.clear(); dragging = false
      if (valid) { if (checkpoint < 2) beginPlacement(); else finish() } else resetDrag()
    },
    onCancel: resetDrag,
  })
  function sync() {
    dropFeedback.clear()
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!placement || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    ui.hitLayer.style.pointerEvents = checkpoint < 3 && !placement ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.lidAction : checkpoint === 1 ? COPY.incenseAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, placement ? placement.step === 0 ? COPY.movingLid : COPY.movingIncense
      : checkpoint === 0 ? COPY.lid : checkpoint === 1 ? COPY.incense : checkpoint === 2 ? ctx.returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function placed() {
    if (!active() || !placement) return
    checkpoint = (placement.step + 1) as Checkpoint; placement = null; pose(); sync(); ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 1 ? [330, 495] : [392, 587.33], duration: .20, gain: .014, type: 'triangle' })
  }
  function beginPlacement(arrived = false) {
    if (!active() || (pointer.isBusy() && !arrived) || placement || checkpoint >= 2) return
    placement = { step: checkpoint as 0 | 1, time: 0, from: carried().position.clone(), paperFrom: paper.position.clone() }
    dragging = false; sync(); if (reduced()) placed()
  }
  function finish() {
    if (!active() || pointer.isBusy() || placement || checkpoint !== 2) return
    checkpoint = 3; pose(); sync(); ctx.onProgress?.(3)
    feedback.impact({ freqs: [330, 495], duration: .28, gain: .012 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => { if (!active() || pointer.isBusy() || placement || checkpoint === 3) return; feedback.prepare(); if (checkpoint < 2) beginPlacement(); else finish() }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 9)
    camera.position.set(0, 3.40 + boost * .34, 6.15 + boost); camera.lookAt(0, 1.18, 0); matrices()
  }
  pose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      pose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (placement) {
        placement.time = reduced() ? 1 : Math.min(1, placement.time + delta / .75)
        const t = placement.time, ease = smooth(t)
        const object = placement.step === 0 ? lid : stick, destination = placement.step === 0 ? LID_REST : STICK_REST
        object.position.lerpVectors(placement.from, destination, ease)
        if (!reduced()) object.position.y += Math.sin(t * Math.PI) * (placement.step === 0 ? .22 : .14)
        if (placement.step === 1) { paper.position.lerpVectors(placement.paperFrom, STICK_HOME, ease); paper.rotation.z = -.15 * ease }
        if (t === 1) placed()
      }
      if (!reduced() && checkpoint >= 2) { elapsed += delta; smoke.rotation.y = Math.sin(elapsed * .36) * .24 }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; dropFeedback.dispose(); pointer.dispose(); stopResize(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
