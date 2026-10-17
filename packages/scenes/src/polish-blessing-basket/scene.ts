import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '一篮春食', breadAction: '放入圆面包', eggAction: '安放彩蛋', quietAction: '轻点静看',
  bread: '拖圆面包到篮内衬布。波兰圣周六家庭准备的岁时回看，不模拟圣职祝福。',
  egg: '把原创花点彩蛋拖进篮里的小蛋窝，和春枝放在一起。',
  quiet: '轻点食物篮静看，或写一句感谢；只有点「写好了」才会保存。',
  returning: '轻点食物篮，感谢日用食粮与准备这一餐的人。',
  placingBread: '圆面包轻轻落在衬布上…', placingEgg: '彩蛋在小窝里安稳落定…',
  done: '让这一篮春食留住对日常的感谢。',
} as const
const BREAD_HOME = new THREE.Vector3(-0.91, 1.035, 0.45)
const BREAD_REST = new THREE.Vector3(0.12, 1.395, 0.05)
const EGG_HOME = new THREE.Vector3(-1.01, 1.035, -0.43)
const EGG_REST = new THREE.Vector3(0.85, 1.45, 0.13)
type Checkpoint = 0 | 1 | 2 | 3
type Placement = { step: 0 | 1; time: number; from: THREE.Vector3 }
const smooth = (t: number) => t * t * (3 - 2 * t)

function tube(points: THREE.Vector3[], radius: number, mat: THREE.Material, closed = false) {
  const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, closed), Math.max(20, points.length * 2), radius, 6, closed)
  const mesh = new THREE.Mesh(geometry, mat)
  mesh.castShadow = mesh.receiveShadow = true; mesh.userData.toonSurface = { outline: false }
  return mesh
}

/** An original domestic still life; no priest, blessing action or sacramental imitation. */
export function createPolishBlessingBasket(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, checkpoint: Checkpoint = 0
  let placement: Placement | null = null, dragging = false, maxTravel = 0, inactiveRendered = false
  let writer: GestureHandle | null = null, stopResize = () => {}
  const returning = ctx.returning === true
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.breadAction }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'polish-blessing-basket', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff3de, ground: 0xbfb59b, key: 0xffe6c6, rim: 0xd8e9d7,
    keyPosition: [-3, 5, 3], keyIntensity: 1.25, rimIntensity: 0.45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.1, far: 12 })
  lights.key.shadow.bias = -0.0007; lights.key.shadow.normalBias = 0.025
  const world = new THREE.Group(); world.name = 'polish-basket-world'; scene.add(world)
  const material = (color: number, side: THREE.Side = THREE.FrontSide) => new THREE.MeshStandardMaterial({ color, roughness: 0.93, side })
  const oak = material(0xc7a57e), oakEdge = material(0xa98761), boardMat = material(0xe3c59b)
  const wicker = [0xc79561, 0xd8b27c, 0xe2c293].map(color => material(color))
  const cream = material(0xf4edd7, THREE.DoubleSide), stitch = material(0xc48174)
  const crust = material(0xc79558), breadCut = material(0xf2d49b), sage = material(0x849f72), darkLeaf = material(0x627f59)
  const eggRose = material(0xc98173), eggCream = material(0xfaedce), eggBlue = material(0x91aeb7)
  const add = (geo: THREE.BufferGeometry, mat: THREE.Material, p: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const sphere = new THREE.SphereGeometry(1, 24, 16)
  const pebble = (p: [number, number, number], scale: [number, number, number], mat: THREE.Material, parent: THREE.Object3D) => {
    const mesh = add(sphere, mat, p, parent); mesh.scale.set(...scale); return mesh
  }
  const table = new THREE.Group(); table.name = 'basket-table'; world.add(table)
  for (let i = 0; i < 5; i++) add(new RoundedBoxGeometry(3.05, 0.13, 0.31, 3, 0.035), i % 2 ? oak : boardMat, [0, 0.695, (i - 2) * 0.302], table)
  for (const x of [-1.16, 1.16]) for (const z of [-0.5, 0.5]) {
    add(new RoundedBoxGeometry(0.15, 0.63, 0.15, 2, 0.025), oakEdge, [x, 0.315, z], table)
  }
  for (const z of [-0.52, 0.52]) add(new RoundedBoxGeometry(2.5, 0.19, 0.10, 2, 0.018), oakEdge, [0, 0.57, z], table)
  const shadow = add(new THREE.PlaneGeometry(3.8, 2.25), new THREE.ShadowMaterial({ opacity: 0.13 }), [0, 0.005, 0])
  shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false

  const board = add(new RoundedBoxGeometry(0.94, 0.045, 0.74, 4, 0.09), oak, [-0.91, 0.79, 0.43]); board.name = 'basket-bread-board'
  add(new RoundedBoxGeometry(0.24, 0.035, 0.20, 3, 0.05), oak, [-1.41, 0.79, 0.43])
  const saucer = add(new THREE.CylinderGeometry(0.255, 0.24, 0.035, 32), cream, [-1.01, 0.795, -0.43]); saucer.name = 'basket-egg-saucer'

  const basket = new THREE.Group(); basket.name = 'basket-woven'; basket.position.set(0.45, 0.79, -0.02); world.add(basket)
  const weave = new THREE.Group(); weave.name = 'basket-weave'; basket.add(weave)
  // Alternating willow strands follow an oval, slightly flared basket wall.
  for (let row = 0; row < 12; row++) {
    const h = row / 11, rx = 0.58 + h * 0.18, rz = 0.33 + h * 0.17
    const points = Array.from({ length: 80 }, (_, i) => {
      const a = i / 80 * Math.PI * 2, over = Math.cos(a * 32 + row * Math.PI) * 0.007
      return new THREE.Vector3(Math.cos(a) * (rx + over), 0.035 + h * 0.38, Math.sin(a) * (rz + over))
    })
    weave.add(tube(points, 0.017, wicker[row % 3], true))
  }
  for (let col = 0; col < 32; col++) {
    const a = col / 32 * Math.PI * 2
    const points = Array.from({ length: 17 }, (_, i) => {
      const h = i / 16, over = Math.cos(h * 11 * Math.PI + col * Math.PI) * 0.009
      return new THREE.Vector3(Math.cos(a) * (0.58 + h * 0.18 + over), 0.025 + h * 0.40, Math.sin(a) * (0.33 + h * 0.17 + over))
    })
    weave.add(tube(points, 0.016, wicker[(col + 1) % 3]))
  }
  const bottom = add(new THREE.CylinderGeometry(0.58, 0.56, 0.045, 48), wicker[0], [0, 0.025, 0], basket); bottom.scale.z = 0.58
  for (const y of [0.405, 0.433]) {
    const points = Array.from({ length: 80 }, (_, i) => { const a = i / 80 * Math.PI * 2; return new THREE.Vector3(Math.cos(a) * 0.77, y, Math.sin(a) * 0.51) })
    basket.add(tube(points, 0.027, wicker[1], true))
  }
  const handle = new THREE.Group(); handle.name = 'basket-handle'; basket.add(handle)
  for (const offset of [-0.023, 0.023]) {
    const points = Array.from({ length: 41 }, (_, i) => {
      const a = i / 40 * Math.PI
      return new THREE.Vector3(Math.cos(a) * (0.74 + offset), 0.30 + Math.sin(a) * 1.18, -0.15 + offset)
    })
    handle.add(tube(points, 0.028, wicker[offset < 0 ? 0 : 2]))
  }
  for (const sign of [-1, 1]) for (let i = 0; i < 5; i++) {
    const tie = add(new THREE.TorusGeometry(0.05, 0.008, 6, 16), wicker[0], [sign * 0.72, 0.35 + i * 0.022, -0.15], handle)
    tie.rotation.x = Math.PI / 2
  }

  const cloth = new THREE.Group(); cloth.name = 'basket-cloth'; basket.add(cloth)
  const clothPositions: number[] = [], clothIndices: number[] = []
  for (let row = 0; row <= 12; row++) for (let col = 0; col <= 64; col++) {
    const r = row / 12, a = col / 64 * Math.PI * 2
    clothPositions.push(Math.cos(a) * 0.728 * r, 0.285 + 0.15 * r ** 3 + Math.sin(a * 9) * 0.013 * r, Math.sin(a) * 0.473 * r)
    if (row < 12 && col < 64) { const i = row * 65 + col; clothIndices.push(i, i + 65, i + 1, i + 1, i + 65, i + 66) }
  }
  const clothGeo = new THREE.BufferGeometry(); clothGeo.setAttribute('position', new THREE.Float32BufferAttribute(clothPositions, 3))
  clothGeo.setIndex(clothIndices); clothGeo.computeVertexNormals(); add(clothGeo, cream, [0, 0, 0], cloth)
  const flapGeo = new THREE.PlaneGeometry(0.56, 0.40, 16, 12), flapVertices = flapGeo.attributes.position
  for (let i = 0; i < flapVertices.count; i++) {
    const x = flapVertices.getX(i), y = flapVertices.getY(i)
    flapVertices.setXYZ(i, x, y, Math.cos(x * 31) * 0.013 + 0.025 * Math.sin((y + 0.2) * Math.PI / 0.4))
  }
  flapGeo.computeVertexNormals()
  const flap = add(flapGeo, cream, [-0.27, 0.275, 0.47], cloth); flap.rotation.x = -0.15
  for (const x of [-0.49, -0.44]) {
    cloth.add(tube([new THREE.Vector3(x, 0.09, 0.495), new THREE.Vector3(x, 0.25, 0.516), new THREE.Vector3(x, 0.44, 0.455)], 0.007, stitch))
  }
  const breadRest = pebble([0.12, 1.165, 0.05], [0.33, 0.035, 0.30], cream, world); breadRest.name = 'basket-bread-rest'
  const nest = pebble([0.85, 1.195, 0.13], [0.23, 0.038, 0.21], cream, world); nest.name = 'basket-egg-nest'
  for (let i = 0; i < 3; i++) {
    const ring = add(new THREE.TorusGeometry(0.18 + i * 0.012, 0.014, 7, 40), cream, [0.85, 1.20 + i * 0.012, 0.13])
    ring.rotation.x = -Math.PI / 2; ring.scale.y = 0.9
  }
  const medallion = pebble([0.23, 0.23, 0.481], [0.115, 0.103, 0.027], wicker[2], basket); medallion.name = 'basket-quiet-medallion'
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2
    const petal = pebble([0.23 + Math.cos(a) * 0.033, 0.23 + Math.sin(a) * 0.033, 0.51], [0.023, 0.016, 0.006], cream, basket)
    petal.rotation.z = a
  }
  pebble([0.23, 0.23, 0.518], [0.016, 0.016, 0.005], stitch, basket)

  const bread = new THREE.Group(); bread.name = 'basket-bread'; world.add(bread)
  const breadBody = pebble([0, 0, 0], [0.37, 0.22, 0.33], crust, bread); breadBody.name = 'basket-bread-body'
  const scores = new THREE.Group(); scores.name = 'basket-bread-scores'; bread.add(scores)
  for (const row of [-1, 0, 1]) {
    const points = Array.from({ length: 23 }, (_, i) => {
      const x = (i / 22 - 0.5) * 0.49, z = row * 0.13 + x * 0.20
      return new THREE.Vector3(x, Math.sqrt(Math.max(0, 1 - (x / 0.37) ** 2 - (z / 0.33) ** 2)) * 0.22 + 0.004, z)
    })
    scores.add(tube(points, 0.017, breadCut))
  }
  for (let i = 0; i < 14; i++) {
    const a = i * 2.399, r = 0.1 + (i % 4) * 0.038, x = Math.cos(a) * r, z = Math.sin(a) * r
    const y = Math.sqrt(1 - (x / 0.37) ** 2 - (z / 0.33) ** 2) * 0.22 + 0.003
    const fleck = pebble([x, y, z], [0.008, 0.003, 0.013], breadCut, bread); fleck.userData.toonSurface = { outline: false }
  }
  const eggGeo = new THREE.SphereGeometry(1, 28, 20), eggVertices = eggGeo.attributes.position
  for (let i = 0; i < eggVertices.count; i++) {
    const y = eggVertices.getY(i), taper = 1 - y * 0.16
    eggVertices.setXYZ(i, eggVertices.getX(i) * taper, y, eggVertices.getZ(i) * taper)
  }
  eggGeo.computeVertexNormals()
  const makeEgg = (mat: THREE.Material, name: string) => {
    const root = new THREE.Group(); root.name = name
    const body = add(eggGeo, mat, [0, 0, 0], root); body.scale.set(0.17, 0.245, 0.17)
    const pattern = new THREE.Group(); pattern.name = `${name}-pattern`; root.add(pattern)
    for (const latitude of [-0.55, 0.48]) {
      const radius = Math.sqrt(1 - latitude ** 2) * 0.17 * (1 - latitude * 0.16)
      pattern.add(tube(Array.from({ length: 48 }, (_, i) => {
        const a = i / 48 * Math.PI * 2
        return new THREE.Vector3(Math.cos(a) * radius, latitude * 0.245 + Math.sin(a * 8) * 0.006, Math.sin(a) * radius)
      }), 0.008, eggCream, true))
    }
    // Five-petal, hand-spaced flowers are original marks, not a copied pisanki pattern.
    for (let flower = 0; flower < 4; flower++) {
      const theta = flower / 4 * Math.PI * 2
      for (let p = 0; p < 6; p++) {
        const a = p / 6 * Math.PI * 2, y = Math.sin(a) * 0.036, t = theta + Math.cos(a) * 0.20
        const radius = Math.sqrt(1 - (y / 0.245) ** 2) * 0.17 * (1 - y / 0.245 * 0.16) + 0.003
        const dot = pebble([Math.sin(t) * radius, y, Math.cos(t) * radius], [0.012, 0.012, 0.012], eggCream, pattern)
        dot.userData.toonSurface = { outline: false }
      }
      const dot = pebble([Math.sin(theta) * 0.175, 0, Math.cos(theta) * 0.175], [0.01, 0.01, 0.01], sage, pattern)
      dot.userData.toonSurface = { outline: false }
    }
    return { root, body }
  }
  const { root: egg, body: eggBody } = makeEgg(eggRose, 'basket-egg'); eggBody.name = 'basket-egg-body'; world.add(egg)
  const companion = makeEgg(eggBlue, 'basket-blue-egg').root
  companion.position.set(0.54, 1.385, -0.29); companion.rotation.z = -0.21; companion.scale.setScalar(0.8); world.add(companion)
  const herbs = new THREE.Group(); herbs.name = 'basket-spring-herbs'; basket.add(herbs)
  for (let sprig = 0; sprig < 3; sprig++) {
    const x = 0.3 + sprig * 0.09, lean = sprig * 0.10 - 0.08
    herbs.add(tube([new THREE.Vector3(x, 0.23, -0.25), new THREE.Vector3(x + lean * 0.6, 0.62, -0.32), new THREE.Vector3(x + lean, 0.99 - sprig * 0.07, -0.34)], 0.008, darkLeaf))
    for (let i = 0; i < 6; i++) {
      const y = 0.44 + i * 0.076, side = i % 2 ? -1 : 1
      const leaf = pebble([x + lean * (y - 0.2) + side * 0.045, y, -0.30], [0.034, 0.081, 0.013], i % 2 ? sage : darkLeaf, herbs)
      leaf.rotation.z = side * -0.77; leaf.rotation.y = side * 0.4; leaf.userData.toonSurface = { outline: false }
    }
  }

  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restorePose = () => {
    bread.position.copy(checkpoint >= 1 ? BREAD_REST : BREAD_HOME); bread.rotation.set(0, checkpoint >= 1 ? -0.10 : 0.10, 0)
    egg.position.copy(checkpoint >= 2 ? EGG_REST : EGG_HOME); egg.rotation.set(0, 0, checkpoint >= 2 ? -0.07 : 0.04)
    matrices()
  }
  const source = () => checkpoint === 0 ? breadBody : checkpoint === 1 ? eggBody : medallion
  const movingFood = () => checkpoint === 0 ? bread : egg
  const finishPickables: THREE.Object3D[] = [breadBody, eggBody]
  basket.traverse(object => { if ((object as THREE.Mesh).isMesh) finishPickables.push(object) })
  const cueActive = (at: number) => () => active() && !placement && checkpoint === at
  addInteractionCue(breadBody, { kind: 'drag', label: '拖面包入篮', priority: 3, enabled: cueActive(0), destination: breadRest, targetLabel: '篮内衬布' })
  addInteractionCue(eggBody, { kind: 'drag', label: '拖彩蛋入窝', priority: 3, enabled: cueActive(1), destination: nest, targetLabel: '彩蛋蛋窝' })
  addInteractionCue(medallion, { kind: 'tap', label: '轻点食物篮静看', priority: 3, enabled: cueActive(2) })
  const ray = createPointerRay(canvas, camera), dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), dragOffset = new THREE.Vector3()
  const down = new THREE.Vector2()
  const resetDrag = () => { dragging = false; maxTravel = 0; if (!placement) restorePose() }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) {
      if (placement || checkpoint === 3) return false
      matrices(); return ray.hits(x, y, checkpoint === 2 ? finishPickables : [source()])
    },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare()
      if (dragging) {
        dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), movingFood().position)
        if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) dragOffset.copy(movingFood().position).sub(dragPoint)
      }
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (!dragging || checkpoint >= 2) return
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) {
        movingFood().position.copy(dragPoint).add(dragOffset)
        movingFood().position.x = THREE.MathUtils.clamp(movingFood().position.x, -1.22, 1.18)
        movingFood().position.y = THREE.MathUtils.clamp(movingFood().position.y, 0.86, 1.95)
        matrices()
      }
    },
    onRelease(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && ray.hits(x, y, [checkpoint === 0 ? breadRest : nest])
        : checkpoint === 2 && maxTravel < 12 && ray.hits(x, y, finishPickables)
      dragging = false
      if (valid) { if (checkpoint < 2) beginPlacement(); else finish() } else resetDrag()
    },
    onCancel: resetDrag,
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!placement || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    wishSlot.hidden = returning || checkpoint !== 2
    writer?.setEnabled(active() && !returning && checkpoint === 2 && !placement)
    ui.hitLayer.style.pointerEvents = checkpoint < 3 && !placement ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? COPY.breadAction : checkpoint === 1 ? COPY.eggAction : COPY.quietAction, safe)
    setSafeText(ui.hintEl, placement ? placement.step === 0 ? COPY.placingBread : COPY.placingEgg
      : checkpoint === 0 ? COPY.bread : checkpoint === 1 ? COPY.egg : checkpoint === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
  }
  function placed() {
    if (!active() || !placement) return
    checkpoint = (placement.step + 1) as Checkpoint; placement = null; restorePose(); sync()
    ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 1 ? [392, 493.88] : [440, 659.25], duration: 0.2, gain: 0.017, type: 'triangle' })
  }
  function beginPlacement() {
    if (!active() || pointer.isBusy() || placement || checkpoint >= 2) return
    placement = { step: checkpoint as 0 | 1, time: 0, from: movingFood().position.clone() }; dragging = false; sync()
    if (reduced()) placed()
  }
  function finish(text = '') {
    if (!active() || pointer.isBusy() || placement || checkpoint !== 2) return
    const line = text.trim()
    // Terminal state precedes host callbacks, so a reentrant submission cannot save twice.
    checkpoint = 3; restorePose(); sync()
    if (line && !returning) ctx.saveWish?.(line)
    ctx.onProgress?.(3); feedback.impact({ freqs: [392, 587.33], duration: 0.26, gain: 0.017 })
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const onAction = () => {
    if (!active() || pointer.isBusy() || placement || checkpoint === 3) return
    feedback.prepare(); if (checkpoint < 2) beginPlacement(); else finish()
  }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 10)
    camera.position.set(0, 3.25 + boost * 0.34, 5.6 + boost); camera.lookAt(0, 1.10, 0); matrices()
  }
  restorePose(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restorePose(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!active() || pointer.isBusy() || placement || checkpoint !== 2 || !text.trim()) return; feedback.prepare(); finish(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', onAction); window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) {
        pointer.cancel(); writer?.setEnabled(false); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true')
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      writer?.setEnabled(checkpoint === 2 && !returning && !placement); writer?.update(dt)
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.05) : 0
      if (placement) {
        placement.time = reduced() ? 1 : Math.min(1, placement.time + delta / 0.65)
        const t = placement.time, food = placement.step === 0 ? bread : egg, destination = placement.step === 0 ? BREAD_REST : EGG_REST
        food.position.lerpVectors(placement.from, destination, smooth(t))
        if (!reduced()) food.position.y += Math.sin(t * Math.PI) * 0.13
        if (t === 1) placed()
      }
      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', onAction); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
