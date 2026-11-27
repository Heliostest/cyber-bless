import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { bakeCreviceAO } from '@wbr/scene-runtime/prop-geometry'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { createSoftPlume } from '@wbr/scene-runtime/soft-plume'
import { sceneTemplate } from '../scene-localization'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { addContactShadow } from '../cozy-furniture'
import { createObjectPointer } from '../object-pointer'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '春锅共煮', steps: '步骤',
  stir: '诺鲁孜的春锅里煮着苏玛拉克。按住木勺，沿锅边依次经过浅色圆点，缓缓搅动后松手。',
  serve: '把木勺拖到空陶碗里，盛出一份麦芽甜食苏玛拉克。',
  share: '把盛好的陶碗拖到共食垫上，为诺鲁孜共食留出邻里的一份。',
  done: '苏玛拉克已盛好放到共食垫上。诺鲁孜的春意，在共煮与邻里分食间传递。',
  stirAction: '沿锅边缓搅', serveAction: '盛入陶碗', shareAction: '放到共食垫',
  moving: '慢慢落稳这一刻…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1 | 2; time: number; from: THREE.Vector3; guided: boolean }
const POT_X = -.45, POT_Z = -.14, ARC_RADIUS = .62, ARC_Y = 1.09
const SURFACE_Y = getEnvironmentSurfaceY('navruz-sumalak')
const BOWL = new THREE.Vector3(.85, SURFACE_Y, .59)
const SHARED = new THREE.Vector3(.79, SURFACE_Y + .0475, -.62)
const PARKED = new THREE.Vector3(-1.07, 1.09, -.14)
const arcPoint = (t: number) => new THREE.Vector3(POT_X + Math.cos(Math.PI * (1 - t)) * ARC_RADIUS, ARC_Y, POT_Z + Math.sin(Math.PI * (1 - t)) * ARC_RADIUS)
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Original cauldron, spoon and glazed bowls; a public seasonal sharing homage. */
export function createNavruzSumalak(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  Object.values(COPY).forEach(shared.assertSafeCopy)
  let started = false, disposed = false, focused = true, completed = false, checkpoint: Checkpoint = 0
  let motion: Motion | null = null, dragging = false, nextBead = 1, elapsed = 0, stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.stirAction }, shared.assertSafeCopy)
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)

  const projectedGuide = (goal: THREE.Vector3, grip: THREE.Vector3, contact: THREE.Vector3) => {
    camera.updateMatrixWorld(true)
    const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera)
    g.x+=a.x-b.x;g.y+=a.y-b.y
    return g.unproject(camera)
  }
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'navruz-sumalak', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xffefdb, ground: 0xb9b298, key: 0xffe7ca, rim: 0xd6e5dc,
    keyPosition: [-3, 5, 3], keyIntensity: 1.2, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0008; lights.key.shadow.normalBias = .025
  const world = new THREE.Group(); world.name = 'navruz-courtyard-hearth'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness })
  const clay = applyCraftSurface(new THREE.MeshStandardMaterial({ color: 0xba8a66, roughness: .96, vertexColors: true }), { kind: 'terracotta', strength: .42 })
  const clayLight = applyCraftSurface(new THREE.MeshStandardMaterial({ color: 0xcfaa83, roughness: .95, vertexColors: true }), { kind: 'terracotta', strength: .38 })
  const soot = mat(0x504740, .96), iron = mat(0x6d7973), ironRim = mat(0x85948b)
  iron.vertexColors = true
  const hearthGlowMat = new THREE.MeshStandardMaterial({ color: 0x6b2f1c, emissive: 0xe85a1c, emissiveIntensity: .88, roughness: .92 })
  /** Subtle deterministic matte mud-brick variation without applying ceramic glaze to raw earthen clay. */
  const applyEarthenTone = (geom: THREE.BufferGeometry, seed = 0) => {
    const pos = geom.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
      const grain = Math.sin(x * 13.7 + z * 11.3 + seed) * 0.032 + Math.cos(y * 19.1 - x * 7.9 + seed * 1.7) * 0.024
      const baseShade = THREE.MathUtils.clamp(0.95 + y * 0.10 + grain, 0.86, 1.05)
      colors[i * 3] = baseShade
      colors[i * 3 + 1] = baseShade * 0.985
      colors[i * 3 + 2] = baseShade * 0.962
    }
    geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return geom
  }
  const caramel = createRitualMaterial({ color: 0xa76231, roughness: .43, clearcoat: .32, clearcoatRoughness: .28 }, { kind: 'wet', strength: .3 }), swirlMat = createRitualMaterial({ color: 0xc48b48, roughness: .49, clearcoat: .26, clearcoatRoughness: .3 }, { kind: 'wet', strength: .25 }), wood = mat(0xc19057), woodLight = mat(0xd6ab70)
  const glaze = mat(0x78a9a7, .28), cream = mat(0xf1dec2, .4), weave = mat(0xd2ab78), terracotta = mat(0xb27355)
  glaze.vertexColors = true
  // Same pigment spans ceramics, textiles and guide beads; keep their surfaces separate.
  const bowlCream=mat(0xf1dec2,.4), matStripe=mat(0xf1dec2,.4)
  for(const cookware of[iron,ironRim])applyCraftSurface(cookware,{kind:'metal',strength:.45})
  for(const timber of[wood,woodLight])applyCraftSurface(timber,{kind:'wood',strength:.35,axis:'y'})
  for(const vessel of[glaze,bowlCream])applyCraftSurface(vessel,{kind:'ceramic',strength:.45})
  for(const textile of[weave,terracotta,matStripe])applyCraftSurface(textile,{kind:'fabric',strength:.25})
  function add(geometry: THREE.BufferGeometry, material: THREE.Material, position: [number, number, number], parent: THREE.Object3D = world, name = '') {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); mesh.name = name
    mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, parent: THREE.Object3D, name = '', closed = false) {
    return add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(20, points.length * 3), radius, 7, closed), material, [0, 0, 0], parent, name)
  }
  // A low earthen mud-brick hearth grounded directly on the courtyard supports the broad round kazan. No ceremonial fire.
  const hearthProfile = [
    new THREE.Vector2(0, -.04),
    new THREE.Vector2(.81, -.04),
    new THREE.Vector2(.82, -.01),
    new THREE.Vector2(.78, .05),
    new THREE.Vector2(.75, .18),
    new THREE.Vector2(.71, .36),
    new THREE.Vector2(.69, .435),
    new THREE.Vector2(.67, .44),
    new THREE.Vector2(0, .44),
  ]
  add(bakeCreviceAO(applyEarthenTone(new THREE.LatheGeometry(hearthProfile, 44), 1.3), { groundY: -.04, groundRange: .16, strength: .30 }), clay, [POT_X, 0, POT_Z], world, 'navruz-clay-hearth')
  for (let i = 0; i < 12; i++) {
    const a = i / 12 * Math.PI * 2
    const brick = add(applyEarthenTone(new RoundedBoxGeometry(.3, .12, .18, 2, .025), i * 2.1), i % 2 ? clayLight : clay, [POT_X + Math.cos(a) * .65, .44, POT_Z + Math.sin(a) * .65])
    brick.rotation.y = -a + Math.PI / 2
  }
  add(new RoundedBoxGeometry(.34, .20, .06, 3, .07), soot, [POT_X, .16, POT_Z + .71], world, 'navruz-hearth-opening')
  // Subtle recessed warm brick glow behind the firewood for slow cooking warmth (no open flames).
  const hearthGlow = add(new RoundedBoxGeometry(.25, .10, .016, 2, .012), hearthGlowMat, [POT_X, .135, POT_Z + .742], world, 'navruz-hearth-warmth')
  hearthGlow.castShadow = false; hearthGlow.receiveShadow = false; hearthGlow.userData.toonSurface = { outline: false }
  for (const x of [-.08, .07]) {
    const log = add(new THREE.CylinderGeometry(.04, .045, .27, 9), wood, [POT_X + x, .085, POT_Z + .70]); log.rotation.x = Math.PI / 2
  }
  const kazan = new THREE.Group(); kazan.name = 'navruz-kazan'; kazan.position.set(POT_X, 0, POT_Z); world.add(kazan)
  const profile = [[0, .39], [.25, .405], [.46, .50], [.60, .69], [.69, .94], [.685, 1.02], [.644, 1.02], [.62, .87], [.5, .7], [.28, .59], [0, .59]].map(([x, y]) => new THREE.Vector2(x, y))
  const cauldronBody = add(new THREE.LatheGeometry(profile, 56), iron, [0, 0, 0], kazan, 'navruz-round-cauldron-body')
  bakeCreviceAO(cauldronBody.geometry, { groundY: .39, groundRange: .16, cavityCenter: [0, 0], cavityRadius: .64, cavityTopY: 1.02, strength: .38 })
  const rim = add(new THREE.TorusGeometry(.671, .035, 9, 64), ironRim, [0, 1.014, 0], kazan, 'navruz-cauldron-rim'); rim.rotation.x = Math.PI / 2
  for (const side of [-1, 1]) {
    tube([new THREE.Vector3(side * .62, .89, -.14), new THREE.Vector3(side * .86, .94, -.15), new THREE.Vector3(side * .9, 1.02, 0), new THREE.Vector3(side * .86, .94, .15), new THREE.Vector3(side * .62, .89, .14)], .04, ironRim, kazan, `navruz-kazan-handle-${side < 0 ? 'left' : 'right'}`)
  }
  add(new THREE.CylinderGeometry(.632, .622, .025, 56), caramel, [0, .975, 0], kazan, 'navruz-cauldron-food')
  const swirls = new THREE.Group(); swirls.name = 'navruz-caramel-swirls'; swirls.position.y = .995; kazan.add(swirls)
  for (let i = 0; i < 3; i++) {
    const points = Array.from({ length: 38 }, (_, j) => {
      const a = j / 37 * Math.PI * 1.42 + i * 2.05, r = .09 + j / 37 * .45
      return new THREE.Vector3(Math.cos(a) * r, .004, Math.sin(a) * r)
    })
    tube(points, .012, swirlMat, swirls, `navruz-food-swirl-${i}`).userData.toonSurface = { outline: false }
  }
  const sharingMat = add(new RoundedBoxGeometry(.86, .043, .9, 3, .06), weave, [.79, SURFACE_Y + .0215, -.62], world, 'navruz-sharing-mat')
  sharingMat.userData.toonSurface = { outline: false }
  for (let i = 0; i < 13; i++) {
    const stripe = add(new THREE.BoxGeometry(.76, .005, .013), i % 3 ? matStripe : terracotta, [.79, SURFACE_Y + .0455, -.98 + i * .06])
    stripe.userData.toonSurface = { outline: false }
  }
  for (const x of [.46, 1.12]) add(new THREE.BoxGeometry(.025, .006, .75), terracotta, [x, SURFACE_Y + .0465, -.62]).userData.toonSurface = { outline: false }
  function makeBowl(name: string, position: THREE.Vector3, scale = 1) {
    const bowl = new THREE.Group(); bowl.name = name; bowl.position.copy(position); bowl.scale.setScalar(scale); world.add(bowl)
    const profile = [[0, 0], [.12, 0], [.15, .04], [.23, .09], [.285, .20], [.278, .224], [.25, .215], [.2, .115], [.1, .065], [0, .065]].map(([x, y]) => new THREE.Vector2(x, y))
    const bowlBody = add(new THREE.LatheGeometry(profile, 40), glaze, [0, 0, 0], bowl)
    bakeCreviceAO(bowlBody.geometry, { groundY: 0, groundRange: .06, cavityCenter: [0, 0], cavityRadius: .255, cavityTopY: .224, strength: .36 })
    const edge = add(new THREE.TorusGeometry(.272, .013, 6, 40), bowlCream, [0, .215, 0], bowl); edge.rotation.x = Math.PI / 2
    const basin = add(new THREE.CylinderGeometry(.18, .11, .015, 32), bowlCream, [0, .09, 0], bowl, `${name}-basin`)
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * Math.PI * 2
      const dot = add(new THREE.SphereGeometry(.018, 7, 5), bowlCream, [Math.cos(a) * .253, .16, Math.sin(a) * .253], bowl)
      dot.scale.y = 1.6; dot.userData.toonSurface = { outline: false }
    }
    return { bowl, basin }
  }
  const { bowl, basin } = makeBowl('navruz-serving-bowl', BOWL); basin.name = 'navruz-empty-bowl-basin'
  const food = add(new THREE.CylinderGeometry(.247, .21, .022, 36), caramel, [0, .18, 0], bowl, 'navruz-serving-food')
  const bowlSwirl = tube(Array.from({ length: 25 }, (_, i) => {
    const a = i / 24 * Math.PI * 2, r = .025 + i / 24 * .15
    return new THREE.Vector3(Math.cos(a) * r, .194, Math.sin(a) * r)
  }), .008, swirlMat, bowl, 'navruz-serving-swirl')
  makeBowl('navruz-neighbor-bowl', new THREE.Vector3(.24, SURFACE_Y, -.93), .64)
  addContactShadow(world, { prefix: 'navruz-hearth', width: 1.78, depth: 1.78, y: SURFACE_Y + .002, center: [POT_X, POT_Z], shape: 'ellipse', opacity: .28 })
  addContactShadow(world, { prefix: 'navruz-sharing-mat', width: .98, depth: 1.02, y: SURFACE_Y + .002, center: [.79, -.62], shape: 'rounded-rect', opacity: .22 })
  addContactShadow(world, { prefix: 'navruz-neighbor-bowl', width: .42, depth: .42, y: SURFACE_Y + .002, center: [.24, -.93], shape: 'ellipse', opacity: .22 })
  const servingBowlShadow = addContactShadow(world, { prefix: 'navruz-serving-bowl', width: .52, depth: .52, y: SURFACE_Y + .002, center: [BOWL.x, BOWL.z], shape: 'ellipse', opacity: .24 })
  const kazanSteam = createSoftPlume({ kind: 'steam', warmColor: 0xffe4be, height: .58, width: .32, opacity: .36, seed: 19 })
  kazanSteam.root.position.set(POT_X, 1.01, POT_Z); world.add(kazanSteam.root)
  const bowlSteam = createSoftPlume({ kind: 'steam', warmColor: 0xffe4be, height: .30, width: .14, opacity: .28, strands: 2, wisps: 6, seed: 53 })
  world.add(bowlSteam.root)
  const syncAtmosphere = () => {
    bowlSteam.root.position.set(bowl.position.x, bowl.position.y + .205, bowl.position.z)
    bowlSteam.setIntensity(food.visible ? 1 : 0)
    const onMat = Math.hypot(bowl.position.x - SHARED.x, bowl.position.z - SHARED.z) < .32
    const baseY = onMat ? SURFACE_Y + .0475 : SURFACE_Y
    const lift = Math.max(0, bowl.position.y - baseY)
    servingBowlShadow.position.set(bowl.position.x, baseY + .002, bowl.position.z)
    ;(servingBowlShadow.material as THREE.MeshBasicMaterial).opacity = .24 * THREE.MathUtils.clamp(1 - lift * 3.5, 0, 1)
  }
  const spoon = new THREE.Group(); spoon.name = 'navruz-wooden-spoon'; world.add(spoon)
  const head = add(new THREE.SphereGeometry(1, 24, 12), wood, [0, 0, 0], spoon, 'navruz-wooden-spoon-bowl'); head.scale.set(.15, .055, .205)
  const hollow = add(new THREE.SphereGeometry(1, 20, 10), woodLight, [0, .04, -.005], spoon); hollow.scale.set(.12, .012, .165)
  const handle = tube([new THREE.Vector3(0, .015, -.13), new THREE.Vector3(-.04, .25, -.2), new THREE.Vector3(-.1, .55, -.27), new THREE.Vector3(-.14, .82, -.31)], .031, wood, spoon, 'navruz-long-wooden-handle')
  tube([new THREE.Vector3(-.012, .13, -.172), new THREE.Vector3(-.071, .43, -.242), new THREE.Vector3(-.13, .75, -.288)], .005, woodLight, spoon).userData.toonSurface = { outline: false }
  const spoonFood = add(new THREE.SphereGeometry(1, 20, 10), caramel, [0, .051, 0], spoon, 'navruz-spoon-food'); spoonFood.scale.set(.12, .018, .163)
  const guides = new THREE.Group(); guides.name = 'navruz-stir-arc'; world.add(guides)
  tube(Array.from({ length: 41 }, (_, i) => arcPoint(i / 40)), .01, cream, guides, 'navruz-curved-stir-path').userData.toonSurface = { outline: false }
  const beads = Array.from({ length: 8 }, (_, i) => {
    const p = arcPoint((i + 1) / 8)
    return add(new THREE.SphereGeometry(.072, 12, 8), cream.clone(), [p.x, p.y, p.z], guides, `navruz-stir-bead-${i + 1}`)
  })
  const canCue = () => active() && !motion
  addInteractionCue(head, { kind: 'drag', label: '沿圆点缓搅', enabled: () => canCue() && checkpoint === 0,
    destination: () => beads[Math.min(nextBead - 1, 7)].getWorldPosition(new THREE.Vector3()), targetLabel: '沿弧线到这里' })
  addInteractionCue(head, { kind: 'drag', label: '拖木勺盛入陶碗', enabled: () => canCue() && checkpoint === 1, destination: basin, targetLabel: '空陶碗' })
  addInteractionCue(food, { kind: 'drag', label: '把陶碗留给邻里', enabled: () => canCue() && checkpoint === 2, destination: () => projectedGuide(sharingMat.getWorldPosition(new THREE.Vector3()),food.getWorldPosition(new THREE.Vector3()),bowl.getWorldPosition(new THREE.Vector3())), targetLabel: '共食垫' })
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(), dragPoint = new THREE.Vector3(), offset = new THREE.Vector3()
  const touch = createTouchTarget(canvas, camera, scene)
  const stirPath = createPathSweep(Array.from({ length: 9 }, (_, i) => { const p = arcPoint(i / 8); return [p.x, p.z] as const }), .09)
  const stirReady = (x: number, y: number) => stirPath.progress === 1 && touch.hit(x, y, beads[7]!, { ignore: spoon })
  const carried = () => checkpoint === 2 ? bowl : spoon
  const automaticReady = (x: number, y: number) => {
    if (checkpoint<1 || checkpoint>2 || !insideCanvas(canvas,x,y)) return false
    const contact=projectTouchPoint(canvas,camera,checkpoint===1?head:bowl)
    return !!contact && !touch.occluded(x,y,checkpoint===1?basin:sharingMat,{ignore:carried()}) && touch.hit(contact.x,contact.y,checkpoint===1?basin:sharingMat,{ignore:carried()})
  }
  function pose() {
    stirPath.reset(); nextBead = 1
    beads.forEach(bead => (bead.material as THREE.MeshStandardMaterial).color.setHex(0xf1dec2))
    spoon.position.copy(checkpoint === 0 ? arcPoint(0) : checkpoint === 1 ? arcPoint(1) : PARKED)
    spoon.rotation.set(0, 0, checkpoint >= 2 ? -.2 : 0)
    spoonFood.visible = checkpoint === 1
    bowl.position.copy(checkpoint === 3 ? SHARED : BOWL)
    food.visible = bowlSwirl.visible = checkpoint >= 2
    guides.visible = checkpoint === 0
    swirls.rotation.y = checkpoint >= 1 ? .3 : 0
    syncAtmosphere()
    world.updateMatrixWorld(true)
  }
  function sync() {
    delete ui.hintEl.dataset.progress
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    setSafeText(ui.actionBtn, [COPY.stirAction, COPY.serveAction, COPY.shareAction, COPY.shareAction][checkpoint], shared.assertSafeCopy)
    setSafeText(ui.hintEl, motion ? COPY.moving : [COPY.stir, COPY.serve, COPY.share, COPY.done][checkpoint], shared.assertSafeCopy)
  }
  function finish() {
    if (!motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; nextBead = 1; pose(); sync()
    ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: [264, 396], duration: .22, gain: .025, cue: checkpoint === 1 ? 'woodTap' : 'ceramic', cueStrength: .60 })
    if (checkpoint === 3 && !completed) { completed = true; overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })) }
  }
  function begin(guided = false) {
    if (!active() || motion || checkpoint === 3) return
    motion = { step: checkpoint, time: 0, from: carried().position.clone(), guided }; dragging = false
    if (!reduced() && checkpoint === 0) feedback.sound('woodTap', { duration: .14, strength: .36 })
    if (reduced()) finish(); else sync()
  }
  function moveOnArc(x: number, y: number) {
    if (!ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) return
    stirPath.sample([dragPoint.x, dragPoint.z]); nextBead = stirPath.next
    spoon.position.copy(dragPoint)
    beads.forEach((bead, i) => (bead.material as THREE.MeshStandardMaterial).color.setHex(i < nextBead - 1 ? 0x79ac82 : 0xf1dec2))
    ui.hintEl.dataset.progress = 'true'
    setSafeText(ui.hintEl, stirReady(x, y) ? '弧线已搅完，松手即可。' : stirPath.progress === 1 ? '弧线已搅完，回到最后一处圆点附近松手。' : sceneTemplate("已沿弧线前进 {p0}%，继续经过下一处浅色圆点。", { p0: Math.round(stirPath.progress * 100) }), shared.assertSafeCopy)
    world.updateMatrixWorld(true)
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart: (x, y) => !motion && checkpoint < 3 && touch.hit(x, y, checkpoint === 2 ? [food] : checkpoint === 0 ? [head, hollow] : [head, hollow, handle]),
    onStart(x, y) {
      dragging = true; stirPath.reset(); nextBead = 1; feedback.prepare()
      if (checkpoint === 0) plane.set(new THREE.Vector3(0, 1, 0), -ARC_Y)
      else {
        plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), carried().position)
        if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) offset.copy(carried().position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      if (!dragging) return
      if (checkpoint === 0) moveOnArc(x, y)
      else if (ray.aim(x, y).ray.intersectPlane(plane, dragPoint)) {
        carried().position.copy(dragPoint).add(offset)
        carried().position.x = THREE.MathUtils.clamp(carried().position.x, -1.4, 1.4)
        carried().position.y = THREE.MathUtils.clamp(carried().position.y, SURFACE_Y, 1.65)
        syncAtmosphere()
        world.updateMatrixWorld(true)
        if(automaticReady(x,y)&&pointer.finish()){dragging=false;begin(true)}
      }
    },
    onRelease(x, y) {
      const valid = Number.isFinite(x) && Number.isFinite(y) && dragging && active() && !motion && (checkpoint === 0
        ? stirReady(x, y)
        : automaticReady(x,y))
      dragging = false
      if (valid) begin(true); else { pose(); sync() }
    },
    onCancel() { dragging = false; if (!motion) { pose(); sync() } },
  })
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const action = () => { if (!active() || pointer.isBusy() || motion || checkpoint === 3) return; feedback.prepare(); begin() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0, 3.55, 5.15 + portraitBoost(aspect, 4.7)); camera.lookAt(0, .65, 0); camera.updateMatrixWorld(true)
  }
  pose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3; pose(); sync(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); style.render(); return }
      const rawDelta = Number.isFinite(dt) ? Math.max(0, dt) : 0
      const stepDelta = THREE.MathUtils.clamp(rawDelta, 0, .05)
      feedback.update()
      if (!reduced()) elapsed += stepDelta
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + rawDelta / (motion.step === 0 && !motion.guided ? 1.15 : .75))
        const t = motion.time, p = smooth(t)
        if (motion.step === 0) {
          if (motion.guided) spoon.position.lerpVectors(motion.from, arcPoint(1), p)
          else spoon.position.copy(arcPoint(p))
          swirls.rotation.y = p * .3
        } else if (motion.step === 1) {
          const serve = BOWL.clone().add(new THREE.Vector3(0, .23, 0))
          if (t < .5) spoon.position.lerpVectors(motion.from, serve, smooth(t * 2))
          else spoon.position.lerpVectors(serve, PARKED, smooth((t - .5) * 2))
          spoon.rotation.z = -.2 * p; food.visible = bowlSwirl.visible = t >= .5; spoonFood.visible = t < .5
        } else { bowl.position.lerpVectors(motion.from, SHARED, p); bowl.position.y += Math.sin(t * Math.PI) * .12 }
        syncAtmosphere(); world.updateMatrixWorld(true); if (t === 1) finish()
      }
      hearthGlowMat.emissiveIntensity = reduced() ? .88 : .88 + .16 * Math.sin(elapsed * 2.1)
      kazanSteam.setIntensity(motion?.step === 0 ? 1.12 : 1)
      kazanSteam.update(stepDelta, camera, { reducedMotion: reduced(), scene })
      bowlSteam.update(stepDelta, camera, { reducedMotion: reduced(), scene })
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); ui.actionBtn.removeEventListener('click', action); feedback.dispose()
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); kazanSteam.dispose(); bowlSteam.dispose(); disposeTree(scene); Object.values(lights).forEach(light => light.dispose())
      renderer.dispose(); renderer.forceContextLoss(); scene.clear(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
