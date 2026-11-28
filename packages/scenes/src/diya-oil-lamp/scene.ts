import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { bakeCreviceAO } from '@wbr/scene-runtime/prop-geometry'
import { createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import { addContactShadow } from '../cozy-furniture'
import { sceneTemplate } from '../scene-localization'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget } from '../touch-target'
import {
  addStageLights, CEL_STYLE, createLampHalo, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize,
  portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '灯旋一瞥', steps: '步骤',
  light: '印度教献光礼以灯光表达礼敬。依次点按棉芯，点亮三盏陶灯；也可从一盏轻拖到另一盏。',
  spin: '看看献光灯移动的姿态：拖住前方的小灯，沿浅金圆弧慢慢旋一圈。',
  place: '把小灯轻轻拖回盘上亮起的空位。',
  done: '小灯已归盘。静看献光所用的灯盏与光，记住这份礼敬的来处。',
  lightAction: '点亮一盏', spinAction: '轻旋一圈', placeAction: '放回盘上',
  spinning: '小灯沿圆弧缓缓转过…', placing: '小灯正轻轻落回盘上…',
} as const
const ORBIT_RADIUS = 0.60
const ORBIT_Y = 0.84
const ORBIT_START = Math.PI / 2
const HELD = new THREE.Vector3(0, 0.72, ORBIT_RADIUS)
const HOMES = [new THREE.Vector3(-0.44, 0.059, -0.29), new THREE.Vector3(0.44, 0.059, -0.29), new THREE.Vector3(0, 0.059, 0.36)]
const smooth = (t: number) => t * t * (3 - 2 * t)
type Checkpoint = 0 | 1 | 2 | 3
type Drag = { kind: 'light'; visited: Set<number> } | { kind: 'spin' } | { kind: 'place' }
type Motion = { kind: 'spin' | 'place'; elapsed: number; from: THREE.Vector3 }

/** A spouted plan outline; the open cross-section is constructed separately. */
function outline(a: number, scale = 1) {
  const r = (0.29 + 0.13 * Math.max(0, Math.cos(a)) ** 8) * scale
  return new THREE.Vector3(Math.sin(a) * r * 0.96, 0, Math.cos(a) * r)
}

/** Solid clay base and walls, descending inside to an open, shallow oil well. */
function dishGeometry() {
  const rings = [[0.05, 0.014], [0.44, 0.018], [0.73, 0.07], [1, 0.195], [0.92, 0.195], [0.74, 0.105], [0.26, 0.043], [0.05, 0.042]]
  const segments = 64, positions: number[] = [], indices: number[] = []
  rings.forEach(([scale, y]) => {
    for (let i = 0; i <= segments; i++) {
      const p = outline(i / segments * Math.PI * 2, scale)
      positions.push(p.x, y, p.z)
    }
  })
  for (let ring = 0; ring < rings.length - 1; ring++) for (let i = 0; i < segments; i++) {
    const a = ring * (segments + 1) + i, b = a + segments + 1
    indices.push(a, a + 1, b, a + 1, b + 1, b)
  }
  // Both tiny central holes are capped; no plane crosses the open upper rim.
  for (const [ring, y, reverse] of [[0, 0.014, 1], [rings.length - 1, 0.042, 0]]) {
    const center = positions.length / 3
    positions.push(0, y, 0)
    for (let i = 0; i < segments; i++) {
      const a = ring * (segments + 1) + i
      indices.push(...(reverse ? [center, a + 1, a] : [center, a, a + 1]))
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function createDiyaOil(index: number) {
  const radialSegments = 12
  const angularSegments = 48
  const liquid = createVesselLiquid({
    preset: 'lamp-oil',
    radius: 0.212,
    radiusZ: 0.220,
    radialSegments,
    angularSegments,
    deformMode: 'gpu',
    color: 0xbd7d24,
    edgeColor: 0xf7d67e,
    deepColor: 0x6f3f0c,
    foamColor: 0xfcf1c2,
    foamStrength: 0.10,
    opacity: 0.88,
    roughness: 0.09,
    meniscusHeight: 0.011,
    maxAmplitude: 0.016,
    seed: 10007 + index * 31,
    name: `diya-oil-${index}`,
  })
  // Conformally map the polar meniscus grid onto the spouted diya inner basin outline.
  const pos = liquid.geometry.getAttribute('position') as THREE.BufferAttribute
  let vi = 1
  for (let j = 1; j <= radialSegments; j++) {
    const u = j / radialSegments
    const rho = 1 - Math.pow(1 - u, 1.22)
    for (let k = 0; k < angularSegments; k++) {
      const x = pos.getX(vi)
      const z = pos.getZ(vi)
      const rimPt = outline(Math.atan2(x, z), 0.755)
      pos.setX(vi, rimPt.x * rho)
      pos.setZ(vi, rimPt.z * rho)
      vi++
    }
  }
  pos.needsUpdate = true
  liquid.geometry.computeVertexNormals()
  liquid.geometry.computeBoundingSphere()
  liquid.material.emissive.setHex(0xd97318)
  liquid.material.emissiveIntensity = 0
  return liquid
}

export function createDiyaOilLamp(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let started = false, disposed = false, focused = true, suspended = false, checkpoint: Checkpoint = 0
  let drag: Drag | null = null, motion: Motion | null = null
  let clock = 0, stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.lightAction }, assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(43, 1, 0.1, 60)
  const lookAt = new THREE.Vector3(0, 0.36, 0)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'diya-oil-lamp', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, {
    sky: 0xffefde, ground: 0x76584b, key: 0xffe1be, rim: 0xe6beab,
    keyIntensity: 0.95, keyPosition: [-2.5, 4, 3], ambientIntensity: 0.24,
  })
  const world = new THREE.Group()
  world.name = 'diya-world'
  scene.add(world)
  const clay = new THREE.MeshStandardMaterial({ color: 0xb55f3d, roughness: 0.91, side: THREE.DoubleSide, vertexColors: true })
  const rimClay = new THREE.MeshStandardMaterial({ color: 0xcc7850, roughness: 0.91 })
  const cotton = new THREE.MeshStandardMaterial({ color: 0xf1dec0, roughness: 1 })
  const burnt = new THREE.MeshStandardMaterial({ color: 0x443128, roughness: 1 })
  const plateMat = new THREE.MeshStandardMaterial({ color: 0xa48565, roughness: 0.62, metalness: 0.34 })
  applyCraftSurface(plateMat, { kind: 'metal', scale: 1.35, strength: 0.26 })
  const petalMat = new THREE.MeshStandardMaterial({ color: 0xbe9b70, roughness: 0.86, metalness: 0.12, side: THREE.DoubleSide })
  applyCraftSurface(clay, { kind: 'terracotta', scale: 1.4, strength: 0.48 })
  applyCraftSurface(rimClay, { kind: 'terracotta', scale: 1.6, strength: 0.48 })
  applyCraftSurface(cotton, { kind: 'cord', strength: .28 })
  const hidden = new THREE.MeshBasicMaterial({ visible: false })
  const plate = new THREE.Group()
  plate.name = 'diya-plate'
  world.add(plate)
  const floorY = getEnvironmentSurfaceY('diya-oil-lamp')
  // Turned metal thali tray with stepped foot ring, flat inner lamp well at y = 0.073, and beveled rolled rim.
  const thaliProfile = [
    new THREE.Vector2(0, floorY),
    new THREE.Vector2(0.895, floorY),
    new THREE.Vector2(0.925, floorY + 0.012),
    new THREE.Vector2(0.962, 0.022),
    new THREE.Vector2(1.012, 0.052),
    new THREE.Vector2(1.044, 0.080),
    new THREE.Vector2(1.050, 0.098),
    new THREE.Vector2(1.036, 0.108),
    new THREE.Vector2(1.015, 0.102),
    new THREE.Vector2(0.990, 0.082),
    new THREE.Vector2(0.965, 0.073),
    new THREE.Vector2(0, 0.073),
  ]
  const plateBody = new THREE.Mesh(new THREE.LatheGeometry(thaliProfile, 72), plateMat)
  plateBody.name = 'diya-plate-body'
  plate.add(plateBody)
  // Soft contact AO beneath the brass thali tray and each resting diya lamp.
  const plateShadow = addContactShadow(plate, {
    name: 'diya-plate-contact-ao',
    width: 2.16,
    depth: 2.16,
    y: floorY + 0.0018,
    shape: 'ellipse',
    opacity: 0.28,
  })
  // Clone the shared contact AO texture so scene disposal frees its own GPU handle cleanly.
  const contactShadowMap = (plateShadow.material as THREE.MeshBasicMaterial).map!.clone()
  contactShadowMap.needsUpdate = true
  ;(plateShadow.material as THREE.MeshBasicMaterial).map = contactShadowMap
  const lampShadows = HOMES.map((home, i) => {
    const shadow = addContactShadow(plate, {
      name: `diya-lamp-contact-ao-${i}`,
      width: 0.66,
      depth: 0.74,
      y: 0.073 + 0.0016,
      center: [home.x, home.z + 0.04],
      shape: 'ellipse',
      opacity: 0.22,
    })
    ;(shadow.material as THREE.MeshBasicMaterial).map = contactShadowMap
    return shadow
  })
  // A product-original ring of small petals, with no named sacred motif.
  const petalShape = new THREE.Shape()
  petalShape.moveTo(0, 0.075)
  petalShape.bezierCurveTo(-0.038, 0.025, -0.038, -0.04, 0, -0.075)
  petalShape.bezierCurveTo(0.038, -0.04, 0.038, 0.025, 0, 0.075)
  const petalGeometry = new THREE.ShapeGeometry(petalShape)
  for (let i = 0; i < 14; i++) {
    const a = i / 14 * Math.PI * 2
    const petal = new THREE.Mesh(petalGeometry, petalMat)
    petal.position.set(Math.sin(a) * 0.88, 0.075, Math.cos(a) * 0.88)
    petal.rotation.set(-Math.PI / 2, 0, -a)
    plate.add(petal)
  }

  const bowlGeometry = bakeCreviceAO(dishGeometry(), {
    groundY: 0.014,
    groundRange: 0.048,
    cavityCenter: [0, 0.02],
    cavityRadius: 0.27,
    cavityTopY: 0.195,
    strength: 0.44,
    tint: 0x4b2d20,
  })
  const rimCurve = new THREE.CatmullRomCurve3(Array.from({ length: 64 }, (_, i) => {
    const p = outline(i / 64 * Math.PI * 2)
    p.y = 0.195
    return p
  }), true)
  const rimGeometry = new THREE.TubeGeometry(rimCurve, 96, 0.018, 8, true)
  const wickCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.04, 0.115, 0.04), new THREE.Vector3(-0.07, 0.12, 0.18),
    new THREE.Vector3(-0.025, 0.155, 0.30), new THREE.Vector3(0, 0.212, 0.40),
  ])
  const wickGeometry = new THREE.TubeGeometry(wickCurve, 28, 0.019, 8, false)
  const flameGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.027, 0.015), new THREE.Vector2(0.043, 0.055),
    new THREE.Vector2(0.033, 0.12), new THREE.Vector2(0.013, 0.185), new THREE.Vector2(0, 0.23),
  ], 20)
  // HDR flame pigments calibrated for Night Mipmap Bloom (threshold ~0.78) + AgX golden-peach rolloff.
  const flameOuterMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(1.45, 0.72, 0.24),
    toneMapped: false,
    transparent: true,
    opacity: 0.92,
    depthWrite: false,
  })
  const flameCoreMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(2.1, 1.75, 1.05),
    toneMapped: false,
  })
  const lamps = HOMES.map((home, i) => {
    const group = new THREE.Group()
    group.name = `diya-lamp-${i}`
    group.position.copy(home)
    world.add(group)
    const dish = new THREE.Mesh(bowlGeometry, clay)
    dish.name = `diya-dish-${i}`
    group.add(dish)
    const rim = new THREE.Mesh(rimGeometry, rimClay)
    rim.name = `diya-rim-${i}`
    group.add(rim)
    const oilLiquid = createDiyaOil(i)
    const oil = oilLiquid.mesh
    oil.position.y = 0.11
    group.add(oil)
    if (i === 2) oilLiquid.trackContainer(group)
    const wick = new THREE.Mesh(wickGeometry, cotton)
    wick.name = `diya-wick-${i}`
    group.add(wick)
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.023, 10, 6), burnt)
    tip.position.set(0, 0.212, 0.40)
    group.add(tip)
    const target = new THREE.Mesh(new THREE.SphereGeometry(0.11, 12, 8), hidden)
    target.name = `diya-wick-target-${i}`
    target.position.copy(tip.position)
    group.add(target)
    const flame = new THREE.Mesh(flameGeometry, flameOuterMat)
    flame.position.copy(tip.position)
    flame.name = `diya-flame-${i}`
    flame.visible = false
    flame.userData.toonSurface = { outline: false }
    group.add(flame)
    const core = new THREE.Mesh(flameGeometry, flameCoreMat)
    core.scale.set(0.55, 0.74, 0.55)
    core.position.y = 0.013
    core.userData.toonSurface = { outline: false }
    flame.add(core)
    const glow = new THREE.PointLight(0xffb354, 0, 2.0, 1.8)
    glow.position.set(0, 0.28, 0.40)
    glow.name = `diya-light-${i}`
    group.add(glow)
    const halo = createLampHalo(0xffa846, 0.46)
    halo.sprite.name = `diya-halo-${i}`
    halo.sprite.position.set(0, 0.32, 0.40)
    group.add(halo.sprite)
    return { group, target, wick, tip, flame, glow, halo, oilLiquid, lit: false, glowT: 0 }
  })
  const heldLamp = lamps[2]
  const prevHeldPos = heldLamp.group.position.clone()
  const flameLag = new THREE.Vector2()
  const localMotionVel = new THREE.Vector3()
  const invHeldQuat = new THREE.Quaternion()
  const heldTarget = new THREE.Mesh(new THREE.SphereGeometry(0.30, 16, 10), hidden)
  heldTarget.name = 'diya-held-target'
  heldTarget.position.set(0, 0.12, 0)
  heldLamp.group.add(heldTarget)
  const plateTarget = new THREE.Mesh(new THREE.SphereGeometry(0.31, 16, 10), hidden)
  plateTarget.name = 'diya-plate-target'
  plateTarget.position.copy(HOMES[2]).add(new THREE.Vector3(0, 0.12, 0))
  world.add(plateTarget)
  lamps.forEach(lamp => addInteractionCue(lamp.target, {
    kind: 'tap', label: '轻点棉芯点灯', priority: 2,
    enabled: () => active() && !motion && checkpoint === 0 && !lamp.lit,
  }))
  addInteractionCue(heldTarget, {
    kind: 'rotate', label: '沿圆弧旋一圈', priority: 2,
    enabled: () => active() && !motion && checkpoint === 1,
  })
  addInteractionCue(heldTarget, {
    kind: 'drag', label: '拖小灯回盘上', priority: 2,
    enabled: () => active() && !motion && checkpoint === 2,
    destination: plateTarget, targetLabel: '盘上空位',
  })
  const orbitGuide = new THREE.Group()
  orbitGuide.name = 'diya-orbit-guide'
  world.add(orbitGuide)
  const guideMat = new THREE.MeshBasicMaterial({ color: 0xe7bd73, transparent: true, opacity: 0.48, depthWrite: false })
  const waypointGeometry = new THREE.SphereGeometry(0.017, 8, 6)
  const orbitPoints = Array.from({ length: 17 }, (_, i) => {
    const a = ORBIT_START + i / 16 * Math.PI * 2
    const point = new THREE.Vector3(Math.cos(a) * ORBIT_RADIUS, ORBIT_Y, Math.sin(a) * ORBIT_RADIUS)
    const waypoint = new THREE.Mesh(waypointGeometry, guideMat.clone())
    waypoint.name = `diya-orbit-waypoint-${i}`
    waypoint.position.copy(point)
    orbitGuide.add(waypoint)
    return point
  })
  const orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(new THREE.CatmullRomCurve3(orbitPoints).getPoints(96)),
    new THREE.LineDashedMaterial({ color: 0xe7bd73, transparent: true, opacity: 0.40, dashSize: 0.05, gapSize: 0.048, depthWrite: false }))
  orbitLine.computeLineDistances()
  orbitGuide.add(orbitLine)
  const returnGuide = new THREE.Mesh(new THREE.TorusGeometry(0.32, 0.013, 8, 48), guideMat)
  returnGuide.name = 'diya-return-guide'
  returnGuide.position.copy(HOMES[2]).add(new THREE.Vector3(0, 0.022, 0))
  returnGuide.rotation.x = -Math.PI / 2
  world.add(returnGuide)

  const orbitSweeps = [1, -1].map(direction => createPathSweep(Array.from({ length: 17 }, (_, i) => { const a = ORBIT_START + direction * i / 16 * Math.PI * 2; return [Math.cos(a) * ORBIT_RADIUS, Math.sin(a) * ORBIT_RADIUS] as const }), .12))
  const ray = createPointerRay(canvas, camera)
  const touch = createTouchTarget(canvas, camera, scene)
  const orbitPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ORBIT_Y)
  const placePlane = new THREE.Plane(), point = new THREE.Vector3(), placeOffset = new THREE.Vector3(), placeDown = new THREE.Vector2()
  const updateMatrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const wickAt = (x: number, y: number) => {
    updateMatrices()
    return lamps.findIndex((lamp) => touch.hit(x, y, [lamp.wick, lamp.tip]))
  }
  const syncUI = () => {
    delete hintEl.dataset.progress
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = !active() || motion !== null
    actionBtn.setAttribute('aria-disabled', String(actionBtn.disabled))
    const hints = [COPY.light, COPY.spin, COPY.place, COPY.done]
    setSafeText(hintEl, motion ? motion.kind === 'spin' ? COPY.spinning : COPY.placing : hints[checkpoint], assertSafeCopy)
    if (checkpoint < 3) setSafeText(actionBtn, [COPY.lightAction, COPY.spinAction, COPY.placeAction][checkpoint], assertSafeCopy)
    orbitGuide.visible = checkpoint === 1 && motion === null
    returnGuide.visible = checkpoint === 2 && motion === null
    hitLayer.style.pointerEvents = active() && checkpoint < 3 ? 'auto' : 'none'
    updateMatrices()
  }
  const restorePose = (resetFluid = true) => {
    orbitSweeps.forEach(path => path.reset())
    orbitGuide.children.forEach(object => { if ((object as THREE.Mesh).isMesh) ((object as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(0xe7bd73) })
    if (!motion) heldLamp.group.position.copy(checkpoint === 1 || checkpoint === 2 ? HELD : HOMES[2])
    heldLamp.group.rotation.y = 0
    prevHeldPos.copy(heldLamp.group.position)
    flameLag.set(0, 0)
    if (resetFluid) lamps.forEach(lamp => lamp.oilLiquid.reset())
    updateMatrices()
  }
  const advance = (next: Checkpoint) => {
    if (!active() || checkpoint >= next) return
    checkpoint = next
    motion = null
    drag = null
    restorePose(false)
    if (!(ctx.isReducedMotion?.() ?? false) && next === 3) {
      heldLamp.oilLiquid.triggerRipple(0, 0, 0.72)
      heldLamp.oilLiquid.addTiltImpulse(0.45, -0.35)
    }
    syncUI()
    ctx.onProgress?.(next)
    if (next === 3) {
      feedback.sound('metal', { duration: 0.26, strength: 0.36 })
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const light = (indices: Iterable<number>) => {
    if (!active() || checkpoint !== 0) return
    let changed = false
    const reducedNow = ctx.isReducedMotion?.() ?? false
    for (const i of indices) if (i >= 0 && !lamps[i].lit) {
      const lamp = lamps[i]
      lamp.lit = lamp.flame.visible = true
      if (reducedNow) lamp.glowT = 1
      else lamp.oilLiquid.triggerRipple(0, 0.14, 0.58)
      changed = true
    }
    if (!changed) return
    feedback.impact({ freqs: [659.25, 987.77], duration: 0.22, gain: 0.024, cue: 'air', cueStrength: 0.55 })
    if (lamps.every((lamp) => lamp.lit)) advance(1)
  }
  const beginMotion = (kind: Motion['kind']) => {
    if (!active() || motion || checkpoint !== (kind === 'spin' ? 1 : 2)) return
    motion = { kind, elapsed: 0, from: heldLamp.group.position.clone() }
    feedback.impact({
      freqs: kind === 'spin' ? [523.25, 784] : [440, 659.25],
      duration: 0.35,
      gain: 0.028,
      cue: kind === 'spin' ? 'air' : 'ceramic',
      cueStrength: kind === 'spin' ? 0.38 : 0.55,
    })
    if (ctx.isReducedMotion?.()) advance(kind === 'spin' ? 2 : 3)
    else syncUI()
  }
  const cancelDrag = () => { drag = null; restorePose(); syncUI() }
  const pointer = createObjectPointer(hitLayer, {
    isActive: active,
    canStart(x, y) {
      if (!active() || motion || checkpoint === 3) return false
      updateMatrices()
      return checkpoint === 0 ? wickAt(x, y) >= 0 : touch.hit(x, y, heldLamp.group)
    },
    onStart(x, y) {
      feedback.prepare()
      if (checkpoint === 0) drag = { kind: 'light', visited: new Set([wickAt(x, y)]) }
      else if (checkpoint === 1) { orbitSweeps.forEach(path => path.reset()); drag = { kind: 'spin' } }
      else {
        drag = { kind: 'place' }
        placeDown.set(x,y)
        const normal = camera.getWorldDirection(new THREE.Vector3())
        placePlane.setFromNormalAndCoplanarPoint(normal, heldTarget.getWorldPosition(new THREE.Vector3()))
        if(ray.aim(x,y).ray.intersectPlane(placePlane,point))placeOffset.copy(heldLamp.group.position).sub(point)
      }
    },
    onMove(x, y) {
      if (!drag) return
      if (drag.kind === 'light') {
        const i = wickAt(x, y)
        if (i >= 0) drag.visited.add(i)
      } else if (drag.kind === 'spin') {
        if (!ray.aim(x, y).ray.intersectPlane(orbitPlane, point)) return
        const angle = Math.atan2(point.z, point.x)
        orbitSweeps.forEach(path => path.sample([point.x, point.z]))
        const direction = orbitSweeps[0]!.progress >= orbitSweeps[1]!.progress ? 0 : 1, path = orbitSweeps[direction]!
        orbitGuide.children.forEach((object, i) => {
          if (!(object as THREE.Mesh).isMesh) return
          const gate = direction === 0 ? i : 16 - i
          ;((object as THREE.Mesh).material as THREE.MeshBasicMaterial).color.setHex(gate < path.next ? 0x79ac82 : 0xe7bd73)
        })
        hintEl.dataset.progress = 'true'
        setSafeText(hintEl, path.complete() ? '圆弧已走完，松手即可。' : sceneTemplate("已沿圆弧行进 {p0}%，沿浅金圆弧继续。", { p0: Math.round(path.progress * 100) }), assertSafeCopy)
        heldLamp.group.position.set(Math.cos(angle) * ORBIT_RADIUS, HELD.y, Math.sin(angle) * ORBIT_RADIUS)
        heldLamp.group.rotation.y = ORBIT_START - angle
        updateMatrices()
      } else if (ray.aim(x, y).ray.intersectPlane(placePlane, point)) {
        heldLamp.group.position.copy(point).add(placeOffset)
        heldLamp.group.position.y = Math.max(0.059, heldLamp.group.position.y)
        updateMatrices()
        if ((x!==placeDown.x||y!==placeDown.y) && placementHit(canvas,camera,heldTarget,x,y,(px,py)=>ray.hits(px,py,[plateTarget])) && pointer.finish()) { drag=null; beginMotion('place') }
      }
    },
    onRelease(x, y) {
      const current = drag
      drag = null
      if (!current || !active()) { restorePose(); return }
      if (current.kind === 'light') {
        if (wickAt(x, y) >= 0) light(current.visited)
        restorePose()
      } else if (current.kind === 'spin') {
        const end = ray.aim(x, y).ray.intersectPlane(orbitPlane, point)
        const closed = end && orbitSweeps.some(path => path.complete([point.x, point.z]))
        if (closed) advance(2)
        else restorePose()
      } else {
        if(ray.aim(x,y).ray.intersectPlane(placePlane,point)) {
          heldLamp.group.position.copy(point).add(placeOffset)
          heldLamp.group.position.y=Math.max(.059,heldLamp.group.position.y)
        }
        updateMatrices()
        if ((x!==placeDown.x||y!==placeDown.y) && placementHit(canvas,camera,heldTarget,x,y,(px,py)=>ray.hits(px,py,[plateTarget]))) beginMotion('place')
        else restorePose()
      }
      syncUI()
    },
    onCancel: cancelDrag,
  })
  const onAction = () => {
    if (!active() || pointer.isBusy() || motion || checkpoint === 3) return
    feedback.prepare()
    if (checkpoint === 0) light([lamps.findIndex((lamp) => !lamp.lit)])
    else beginMotion(checkpoint === 1 ? 'spin' : 'place')
  }
  const blur = () => { focused = false; pointer.cancel(); syncUI() }
  const focus = () => { focused = true; if (!disposed) syncUI() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    camera.position.set(0, 2.8, 3.55 + portraitBoost(aspect, 2.5))
    camera.lookAt(lookAt)
    updateMatrices()
  }
  syncUI()
  return {
    start() {
      if (started || disposed) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      actionBtn.addEventListener('click', onAction)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      lamps.forEach((lamp) => {
        lamp.lit = lamp.flame.visible = checkpoint > 0
        lamp.glowT = checkpoint > 0 ? 1 : 0
      })
      restorePose()
      syncUI()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { suspended = true; pointer.cancel(); syncUI(); styleRenderer.render(); return }
      if (suspended) { suspended = false; syncUI() }
      feedback.update()
      const reduced = ctx.isReducedMotion?.() ?? false
      const elapsed = Number.isFinite(dt) ? Math.max(0, dt) : 0
      clock += elapsed
      if (motion) {
        motion.elapsed += elapsed
        const t = reduced ? 1 : Math.min(1, motion.elapsed / (motion.kind === 'spin' ? 1.5 : 0.7))
        const k = smooth(t)
        if (motion.kind === 'spin') {
          const angle = ORBIT_START + Math.PI * 2 * k
          heldLamp.group.position.set(Math.cos(angle) * ORBIT_RADIUS, HELD.y, Math.sin(angle) * ORBIT_RADIUS)
          heldLamp.group.rotation.y = -Math.PI * 2 * k
        } else heldLamp.group.position.lerpVectors(motion.from, HOMES[2], k)
        if (t === 1) advance(motion.kind === 'spin' ? 2 : 3)
      }
      // Compute smooth flame aerodynamic tilt lag for the carried/orbiting lamp.
      if (reduced || elapsed <= 1e-5) {
        flameLag.set(0, 0)
      } else {
        localMotionVel.copy(heldLamp.group.position).sub(prevHeldPos).divideScalar(Math.max(elapsed, 0.016))
        invHeldQuat.copy(heldLamp.group.quaternion).invert()
        localMotionVel.applyQuaternion(invHeldQuat)
        const targetLagZ = THREE.MathUtils.clamp(localMotionVel.x * 0.13, -0.34, 0.34)
        const targetLagX = THREE.MathUtils.clamp(-localMotionVel.z * 0.13, -0.34, 0.34)
        const lagBlend = 1 - Math.exp(-elapsed * 9.0)
        flameLag.x = THREE.MathUtils.lerp(flameLag.x, targetLagX, lagBlend)
        flameLag.y = THREE.MathUtils.lerp(flameLag.y, targetLagZ, lagBlend)
      }
      prevHeldPos.copy(heldLamp.group.position)
      // Fade the front lamp's resting tray contact AO as it lifts into orbit.
      const heldLift = THREE.MathUtils.clamp((heldLamp.group.position.y - HOMES[2].y) / 0.32, 0, 1)
      ;(lampShadows[2]!.material as THREE.MeshBasicMaterial).opacity = 0.22 * (1 - heldLift)
      const nightStage = ctx.stage === 'night'
      lamps.forEach((lamp, i) => {
        lamp.glowT = reduced ? Number(lamp.lit) : Math.min(Number(lamp.lit), lamp.glowT + elapsed / 0.45)
        const breath = reduced
          ? 0
          : Math.sin(clock * 2.8 + i * 1.9) * 0.045 + Math.sin(clock * 6.3 + i * 2.7) * 0.022
        const shimmer = 1 + breath
        const invWidth = reduced ? 1 : 1 / Math.sqrt(shimmer)
        lamp.flame.scale.set(invWidth, shimmer, invWidth)
        if (reduced) {
          lamp.flame.rotation.set(0, 0, 0)
        } else {
          const swayZ = Math.sin(clock * 3.1 + i * 2.1) * 0.032 + Math.sin(clock * 6.7 + i * 1.3) * 0.016
          const swayX = Math.cos(clock * 2.5 + i * 1.7) * 0.022
          lamp.flame.rotation.set(
            swayX + (i === 2 ? flameLag.x : 0),
            0,
            swayZ + (i === 2 ? flameLag.y : 0),
          )
        }
        lamp.glow.intensity = (nightStage ? 0.50 : 0.34) * lamp.glowT * (1 + breath * 0.85)
        lamp.halo.material.opacity = (nightStage ? 0.24 : 0.11) * lamp.glowT * (1 + breath * 0.35)
        lamp.oilLiquid.material.emissiveIntensity = (nightStage ? 0.36 : 0.20) * lamp.glowT * (1 + breath * 1.65)
        lamp.oilLiquid.update(Math.min(elapsed, 0.05), clock, reduced)
      })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      pointer.dispose()
      motion = null
      stopResize()
      actionBtn.removeEventListener('click', onAction)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      feedback.dispose()
      styleRenderer.dispose()
      lamps.forEach((lamp) => lamp.oilLiquid.dispose())
      scene.traverse((o) => { if (o instanceof THREE.Light) o.dispose() })
      disposeTree(scene)
      // Tree disposal includes the shared sprite plane and its materials;
      // textures are separate allocations, so release halo maps and our cloned contact AO map here.
      lamps.forEach((lamp) => lamp.halo.material.map?.dispose())
      contactShadowMap.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
