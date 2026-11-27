import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { addSasaBambooFoliage } from './foliage'
import {
  createHangingPaperRig,
  createPaperStripSurface,
  poseRestingPaperStrip,
  type PaperStripSurface,
} from '@wbr/scene-runtime/paper-sheet'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addCelLights,
  CEL_STYLE,
  claimObjectTouches,
  createSceneFeedback,
  createStepOverlay,
  createWarmStage,
  disposeTree,
  setSafeText,
} from '../procedural-kit'

type Step = 'pick' | 'hang' | 'wish' | 'done'

const STEP_ORDER: Step[] = ['pick', 'hang', 'wish']

const COPY = {
  title: '短册系竹',
  hintPick: '点按或拖起地上的纸条。',
  hintHang: '握住纸条，挪到竹枝的系结范围，便会轻轻挂好。',
  hintWish: '纸条挂好了。把短愿放在心里，再静看片刻。',
  pickTap: '拾起纸条',
  hangTap: '挂到竹枝上',
  wishTap: '静看片刻',
  done: '纸条已随风轻摆。',
  stepsAria: '步骤',
} as const

// Soft but saturated washi: coral, mint, marigold, lavender, sakura.
const STRIP_COLORS = [0xf0876f, 0x74c3aa, 0xf6cc58, 0xa293de, 0xf5a0bd]

export function createTanzakuTanabata(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  const { assertSafeCopy } = shared

  for (const t of Object.values(COPY)) assertSafeCopy(t)

  let step: Step = 'pick'
  let disposed = false
  let started = false
  let restoring = true
  let sparkle = 0

  const handles: GestureHandle[] = []
  let dragHandle: GestureHandle | null = null
  let wishHandle: GestureHandle | null = null
  let resizeObserver: ResizeObserver | null = null
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)

  const ui = createStepOverlay(
    overlay,
    { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.pickTap },
    assertSafeCopy,
  )
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const setHint = (text: string) => setSafeText(hintEl, text, assertSafeCopy)

  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && canAct(),
    duration: 3, motion: 'sway', targets: () => [loose], cancelInput: () => { onHitUp() }, complete: () => completeScene(),
  })
  const syncOverlayForStep = () => {
    ui.renderDots(
      step === 'done' ? STEP_ORDER.length : STEP_ORDER.indexOf(step),
      STEP_ORDER.length,
    )
    actionBtn.hidden = step === 'done'
    wishSlot.hidden = step !== 'wish'
    hitLayer.style.pointerEvents = step === 'pick' || step === 'hang' ? 'auto' : 'none'
    if (step === 'pick') {
      setHint(COPY.hintPick)
      setSafeText(actionBtn, COPY.pickTap, assertSafeCopy)
    } else if (step === 'hang') {
      setHint(COPY.hintHang)
      setSafeText(actionBtn, COPY.hangTap, assertSafeCopy)
    } else if (step === 'wish') {
      setHint(COPY.hintWish)
      setSafeText(actionBtn, COPY.wishTap, assertSafeCopy)
    } else setHint(COPY.done)
    ending.sync(step === 'wish')
  }

  // Transparent over the island stage: peach key, lavender rim and fill.
  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 100)
  const cameraHome = new THREE.Vector3(0, 1.9, 4.4)
  camera.position.copy(cameraHome)
  const cameraLookAt = new THREE.Vector3(0, 1.0, 0)
  camera.lookAt(cameraLookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'tanzaku-tanabata', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)

  addCelLights(scene, { sky: 0xfff0dc, ground: 0xd9c2b0, key: 0xffd9ad, rim: 0xd8ccff })
  const fill = new THREE.PointLight(0xc8b4ff, 0.45, 8, 2)
  fill.position.set(-2, 2.2, 1)
  scene.add(fill)

  const world = new THREE.Group()
  scene.add(world)

  // Procedural bamboo: segmented stalks with waxy epidermis sheen, subtle
  // internode color rhythm, crisp node ridges, and a few leaves.
  const bamboo = new THREE.Group()
  bamboo.name = 'tanzaku-bamboo'
  world.add(bamboo)
  const stalkPalette = [0x82b45a, 0x8dbd62, 0x79ab53, 0x94c169]
  const stalkMats = stalkPalette.map((color, idx) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.60 + (idx % 2) * 0.04,
      clearcoat: 0.24,
      clearcoatRoughness: 0.38,
      specularIntensity: 0.45,
      vertexColors: true,
    })
    return applyCraftSurface(mat, { kind: 'bamboo', strength: 0.46, scale: 0.9, axis: 'y' })
  })
  const nodeMat = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0x527d3c,
      roughness: 0.62,
      clearcoat: 0.20,
      clearcoatRoughness: 0.40,
      specularIntensity: 0.45,
    }),
    { kind: 'bamboo', strength: 0.42, scale: 0.9, axis: 'y' },
  )
  const nodeBloomMat = applyCraftSurface(
    new THREE.MeshPhysicalMaterial({
      color: 0xb6cd8d,
      roughness: 0.66,
      clearcoat: 0.18,
      clearcoatRoughness: 0.42,
      specularIntensity: 0.40,
    }),
    { kind: 'bamboo', strength: 0.36, scale: 0.9, axis: 'y' },
  )

  // Keep CylinderGeometry(0.05, 0.056, 0.5) parameters for hanging-support contract.
  const segGeo = new THREE.CylinderGeometry(0.05, 0.056, 0.5, 24, 8)
  {
    const pos = segGeo.getAttribute('position')
    const colors = new Float32Array(pos.count * 3)
    const base = new THREE.Color()
    const shade = new THREE.Color(0xd6e5c5)
    const sun = new THREE.Color(0xf8f9df)
    const bloom = new THREE.Color(0xeef5da)
    for (let i = 0; i < pos.count; i++) {
      const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i)
      const v = THREE.MathUtils.clamp((py + 0.25) / 0.5, 0, 1)
      const angle = Math.atan2(pz, px)
      const striation = 1 + 0.024 * Math.sin(angle * 7) + 0.016 * Math.cos(angle * 13 + 0.9)
      base.setRGB(1, 1, 1)
      if (v < 0.24) base.lerp(shade, (1 - v / 0.24) * 0.24)
      else if (v < 0.80) base.lerp(sun, Math.sin(((v - 0.24) / 0.56) * Math.PI) * 0.06)
      const bloomBand = Math.exp(-(((v - 0.91) / 0.065) ** 2))
      base.lerp(bloom, bloomBand * 0.26)
      if (v > 0.96) base.multiplyScalar(1 - ((v - 0.96) / 0.04) * 0.15)
      else if (v < 0.05) base.multiplyScalar(0.88 + (v / 0.05) * 0.12)
      base.multiplyScalar(striation)
      colors[i * 3] = Math.min(1, base.r)
      colors[i * 3 + 1] = Math.min(1, base.g)
      colors[i * 3 + 2] = Math.min(1, base.b)
    }
    segGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }
  const nodeGeo = new THREE.TorusGeometry(0.0545, 0.0082, 10, 24)
  const nodeBloomGeo = new THREE.TorusGeometry(0.0552, 0.0046, 8, 24)
  const stalkXs = [-0.35, 0.05, 0.4]
  stalkXs.forEach((x, s) => {
    const segments = 5 + (s % 2)
    for (let i = 0; i < segments; i++) {
      const seg = new THREE.Mesh(segGeo, stalkMats[(s * 3 + i) % stalkMats.length]!)
      seg.position.set(x, 0.25 + i * 0.5, -0.2 + s * 0.12)
      seg.rotation.y = s * 1.1 + i * 0.7
      bamboo.add(seg)
      const node = new THREE.Mesh(nodeGeo, nodeMat)
      node.rotation.x = Math.PI / 2
      node.scale.set(1, 1, 0.76)
      node.position.set(x, 0.5 + i * 0.5, -0.2 + s * 0.12)
      bamboo.add(node)
      const bloom = new THREE.Mesh(nodeBloomGeo, nodeBloomMat)
      bloom.rotation.x = Math.PI / 2
      bloom.scale.set(1, 1, 0.68)
      bloom.position.set(x, 0.484 + i * 0.5, -0.2 + s * 0.12)
      bloom.userData.toonSurface = { outline: false }
      bamboo.add(bloom)
    }
  })
  addSasaBambooFoliage(bamboo)

  // Invisible catch zone around the upper bamboo (large, mobile-friendly target).
  const hangZone = new THREE.Mesh(
    new THREE.BoxGeometry(1.6, 1.8, 0.8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  hangZone.position.set(0.02, 1.8, -0.05)
  world.add(hangZone)

  // Paper strips: a few already hanging + one loose at the bamboo's foot.
  // Each strip uses a subdivided PlaneGeometry(0.12, 0.42) with structured
  // sheet washi optics, a synchronized warm paper-core cut edge, top punch
  // hole, and cream koyori hanging cord tied to the bamboo above.
  const STRIP_W = 0.12
  const STRIP_H = 0.42
  const STRIP_SEG_X = 4
  const STRIP_SEG_Y = 14
  const STRIP_THICKNESS = 0.0028
  const HOLE_ROW = 1
  const HOLE_COL = STRIP_SEG_X / 2

  const makeStripMaterial = (color: number, extra: THREE.MeshStandardMaterialParameters = {}) => createRitualMaterial({
    color,
    roughness: 0.94,
    side: THREE.DoubleSide,
    ...extra,
  }, {
    kind: 'paper',
    strength: 0.36,
    fiber: 'paper',
    paper: {
      layout: 'sheet',
      aspect: STRIP_W / STRIP_H,
      grainScale: 3.1,
      grain: 0.64,
      fibers: 0.52,
      edge: 0.34,
      highlightGuard: 0.58,
    },
  })

  const makeEdgeMaterial = (color: number) => new THREE.MeshStandardMaterial({
    color: new THREE.Color(color).lerp(new THREE.Color(0xfbf1de), 0.62),
    roughness: 0.96,
    side: THREE.DoubleSide,
  })

  const cordMat = new THREE.MeshStandardMaterial({ color: 0xe8d7b6, roughness: 0.92 })
  applyCraftSurface(cordMat, { kind: 'cord', strength: 0.28 })
  const holeBoreMat = new THREE.MeshStandardMaterial({ color: 0x3b332d, roughness: 0.95 })
  const holeBoreGeo = new THREE.CircleGeometry(0.0068, 12)
  const holeKnotGeo = new THREE.TorusGeometry(0.0078, 0.0025, 6, 14)

  type StripVisual = {
    mesh: THREE.Mesh
    surface: PaperStripSurface
    holeAnchor: THREE.Group
  }

  const createStripVisual = (name: string, color: number, material: THREE.MeshStandardMaterial): StripVisual => {
    const surface = createPaperStripSurface(STRIP_W, STRIP_H, {
      segX: STRIP_SEG_X,
      segY: STRIP_SEG_Y,
      thickness: STRIP_THICKNESS,
    })
    const mesh = new THREE.Mesh(surface.geometry, material)
    mesh.name = name
    mesh.castShadow = true
    mesh.receiveShadow = true

    const edgeMesh = new THREE.Mesh(surface.edgeGeometry, makeEdgeMaterial(color))
    edgeMesh.name = `${name}-edge`
    edgeMesh.userData.toonSurface = { outline: false }
    mesh.add(edgeMesh)

    const holeAnchor = new THREE.Group()
    holeAnchor.name = `${name}-hole`
    const frontBore = new THREE.Mesh(holeBoreGeo, holeBoreMat)
    frontBore.position.z = STRIP_THICKNESS * 0.56
    frontBore.userData.toonSurface = { outline: false }
    const backBore = new THREE.Mesh(holeBoreGeo, holeBoreMat)
    backBore.position.z = -STRIP_THICKNESS * 0.56
    backBore.rotation.y = Math.PI
    backBore.userData.toonSurface = { outline: false }
    const knot = new THREE.Mesh(holeKnotGeo, cordMat)
    knot.rotation.y = Math.PI / 2
    knot.position.y = 0.006
    knot.userData.toonSurface = { outline: false }
    holeAnchor.add(frontBore, backBore, knot)
    mesh.add(holeAnchor)

    return { mesh, surface, holeAnchor }
  }

  const createHangingCord = (name: string, stripTop: THREE.Vector3, bambooTie: THREE.Vector3, tieRingAxis: 'x' | 'y' | 'z') => {
    const group = new THREE.Group()
    group.name = name
    const hole = stripTop.clone().add(new THREE.Vector3(0, -0.028, 0))
    const mid = stripTop.clone().lerp(bambooTie, 0.55)
    mid.z = THREE.MathUtils.lerp(stripTop.z, bambooTie.z, 0.45) + 0.012
    const curve = new THREE.CatmullRomCurve3([
      hole,
      stripTop.clone().add(new THREE.Vector3(0, 0.004, 0)),
      mid,
      bambooTie,
    ])
    const cordMesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 14, 0.0034, 6, false), cordMat)
    cordMesh.name = `${name}-strand`
    cordMesh.userData.toonSurface = { outline: false }
    group.add(cordMesh)

    const tieLoop = new THREE.Mesh(new THREE.TorusGeometry(tieRingAxis === 'y' ? 0.062 : 0.015, 0.0034, 6, 16), cordMat)
    tieLoop.name = `${name}-tie`
    tieLoop.position.copy(bambooTie)
    if (tieRingAxis === 'y') tieLoop.rotation.x = Math.PI / 2
    else if (tieRingAxis === 'x') tieLoop.rotation.y = Math.PI / 2
    tieLoop.userData.toonSurface = { outline: false }
    group.add(tieLoop)
    return group
  }

  const stripVisuals: StripVisual[] = []
  // Forward-biased curl keeps every strip clear of the bamboo leaves behind it
  // while varied yaw and breeze phase give each strip an individual curved silhouette.
  const presetHangs: { pos: THREE.Vector3; tie: THREE.Vector3; axis: 'x' | 'y' | 'z'; yaw: number; curl: number }[] = [
    { pos: new THREE.Vector3(-0.2, 2.3, 0.0), tie: new THREE.Vector3(-0.21, 2.48, -0.19), axis: 'x', yaw: 0.26, curl: 0.78 },
    { pos: new THREE.Vector3(0.25, 2.0, 0.05), tie: new THREE.Vector3(0.25, 2.03, 0.04), axis: 'x', yaw: -0.28, curl: 0.64 },
    { pos: new THREE.Vector3(-0.5, 1.7, -0.1), tie: new THREE.Vector3(-0.50, 1.98, -0.20), axis: 'x', yaw: 0.28, curl: 0.72 },
  ]
  presetHangs.forEach((entry, i) => {
    const color = STRIP_COLORS[i % STRIP_COLORS.length]!
    const visual = createStripVisual(`tanzaku-preset-strip-${i}`, color, makeStripMaterial(color))
    visual.mesh.position.copy(entry.pos)
    bamboo.add(visual.mesh)
    bamboo.add(createHangingCord(`tanzaku-preset-cord-${i}`, entry.pos, entry.tie, entry.axis))
    stripVisuals.push(visual)
  })

  const looseMat = makeStripMaterial(STRIP_COLORS[4]!, {
    emissive: 0x6a2a3a,
    emissiveIntensity: 0.15,
  })
  const looseVisual = createStripVisual('tanzaku-loose-strip', STRIP_COLORS[4]!, looseMat)
  const loose = looseVisual.mesh
  const looseHome = new THREE.Vector3(1.15, 0.45, 1.0)
  const looseHangPos = new THREE.Vector3(0.45, 1.75, 0.12)
  const looseTiePos = new THREE.Vector3(0.40, 2.00, 0.04)
  const hungPoint = new THREE.Vector3()
  const seatingFrom = new THREE.Vector3()
  let seating = 1
  loose.position.copy(looseHome)
  loose.rotation.z = 0.5
  world.add(loose)

  // Small carried paper-cord loop visible while the loose strip rests on the ground or is dragged.
  const looseCarryLoopCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(-0.015, 0.042, 0.004),
    new THREE.Vector3(0, 0.072, 0.006),
    new THREE.Vector3(0.015, 0.042, 0.004),
    new THREE.Vector3(0, 0, 0),
  ], true)
  const looseCarryLoop = new THREE.Mesh(new THREE.TubeGeometry(looseCarryLoopCurve, 18, 0.0032, 6, true), cordMat)
  looseCarryLoop.name = 'tanzaku-loose-carry-loop'
  looseCarryLoop.userData.toonSurface = { outline: false }
  looseVisual.holeAnchor.add(looseCarryLoop)

  // Tied bamboo cord shown once the loose strip settles onto Stalk 2's node.
  const looseHangCord = createHangingCord('tanzaku-loose-cord', looseHangPos, looseTiePos, 'y')
  looseHangCord.visible = false
  bamboo.add(looseHangCord)

  stripVisuals.push(looseVisual)

  const syncHoleAnchor = (visual: StripVisual) => {
    const pos = visual.surface.geometry.getAttribute('position') as THREE.BufferAttribute
    const norm = visual.surface.geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
    const cols = STRIP_SEG_X + 1
    const idx = HOLE_ROW * cols + HOLE_COL
    visual.holeAnchor.position.set(pos.getX(idx), pos.getY(idx), pos.getZ(idx))
    if (norm) {
      const nx = norm.getX(idx), ny = norm.getY(idx), nz = norm.getZ(idx)
      if (nx * nx + ny * ny + nz * nz > 1e-6) {
        visual.holeAnchor.quaternion.setFromUnitVectors(_anchorUpZ, _anchorNorm.set(nx, ny, nz).normalize())
      }
    }
  }
  const _anchorUpZ = new THREE.Vector3(0, 0, 1)
  const _anchorNorm = new THREE.Vector3()

  // Initial graceful stiff-paper resting arch for the unhung loose strip.
  poseRestingPaperStrip(looseVisual.surface, { yaw: 0.22, bendZ: 0.30, twist: 0.10, camber: 0.0038 })

  const paperRig = createHangingPaperRig({
    strips: [
      ...presetHangs.map((entry, i) => ({
        surface: stripVisuals[i]!.surface,
        phase: i * 1.65 + 0.3,
        baseYaw: entry.yaw,
        curlBias: entry.curl,
        breezeScale: 1,
      })),
      {
        surface: looseVisual.surface,
        phase: 5.1,
        baseYaw: -0.22,
        curlBias: 0.72,
        breezeScale: 1.05,
        isHanging: () => step === 'wish' || step === 'done',
      },
    ],
    isActive: () => started && !disposed && canAct(),
    isReducedMotion: () => ctx.isReducedMotion?.() ?? false,
    settleSteps: 40,
    breezeStrength: 1.0,
  })
  stripVisuals.forEach(syncHoleAnchor)
  // Generous pick target around the loose strip.
  const pickZone = new THREE.Mesh(
    new THREE.SphereGeometry(0.45, 12, 8),
    new THREE.MeshBasicMaterial({ visible: false }),
  )
  pickZone.position.set(looseHome.x, looseHome.y - 0.2, looseHome.z)
  world.add(pickZone)

  const sparkleLight = new THREE.PointLight(0xffd8a0, 0, 3, 2)
  sparkleLight.position.copy(looseHangPos)
  scene.add(sparkleLight)

  const dragTarget = looseHome.clone()
  let grabbed = false
  const raycaster = new THREE.Raycaster()
  const pointerNdc = new THREE.Vector2()
  const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -0.6)
  const hitPoint = new THREE.Vector3()
  const dragOffset = new THREE.Vector3()
  const grabHome = new THREE.Vector3()
  const grabRotation = new THREE.Quaternion()

  const resize = () => {
    const parent = canvas.parentElement
    const w = canvas.clientWidth || parent?.clientWidth || 1
    const h = canvas.clientHeight || parent?.clientHeight || 1
    renderer.setSize(w, h, false)
    styleRenderer.resize(w, h)
    camera.aspect = w / Math.max(h, 1)
    // Narrow portrait screens: back the camera off so the bamboo fits.
    const portraitBoost = camera.aspect < 0.8 ? (0.8 - camera.aspect) * 3 : 0
    cameraHome.z = 4.4 + portraitBoost
    if (camera.aspect < 1) {
      // The loose strip is nearer the camera and farther right than the
      // bamboo. Fit its rotated midpoint with 20px of room and the camera's
      // idle drift, so the real pick cue remains on screen on small phones.
      const safeX = Math.max(0.5, 1 - 40 / Math.max(w, 1))
      const paperX = looseHome.x + 0.21 * Math.sin(0.5) + 0.1
      const fitZ = looseHome.z + paperX / (Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) * camera.aspect * safeX)
      cameraHome.z = Math.max(cameraHome.z, fitZ)
    }
    camera.updateProjectionMatrix()
  }

  const raycastAt = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    pointerNdc.x = ((clientX - rect.left) / Math.max(rect.width, 1)) * 2 - 1
    pointerNdc.y = -((clientY - rect.top) / Math.max(rect.height, 1)) * 2 + 1
    raycaster.setFromCamera(pointerNdc, camera)
  }

  /**
   * The loose strip with a generous margin (pickZone follows it once picked
   * up). Presses and drags that start here are the scene's; elsewhere the
   * page scrolls.
   */
  const onStrip = (clientX: number, clientY: number) => {
    raycastAt(clientX, clientY)
    return raycaster.intersectObjects([pickZone, loose], false).length > 0
  }

  const bambooHitTest = (clientX: number, clientY: number) => {
    const rect = canvas.getBoundingClientRect()
    if (clientX < rect.left || clientX > rect.left + rect.width || clientY < rect.top || clientY > rect.top + rect.height) return false
    const actual = loose.getWorldPosition(new THREE.Vector3()).project(camera)
    const target = bamboo.localToWorld(looseHangPos.clone()).project(camera)
    return Math.hypot((actual.x - target.x) * rect.width / 2, (actual.y - target.y) * rect.height / 2) <= 22
  }

  const moveStripTo = (clientX: number, clientY: number) => {
    raycastAt(clientX, clientY)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) {
      dragTarget.copy(hitPoint).add(dragOffset); world.worldToLocal(dragTarget)
      loose.position.copy(dragTarget)
      pickZone.position.set(loose.position.x, loose.position.y - .2, loose.position.z)
      world.updateMatrixWorld(true)
    }
  }

  const canAct = () => restoring || !ctx.isActive || ctx.isActive()
  const canCue = () => started && !disposed && !restoring && canAct()
  const removeCues = [
    addInteractionCue(loose, {
      kind: 'tap', label: '点按拾起纸条', anchor: [0, -0.21, 0],
      enabled: () => canCue() && step === 'pick',
    }),
    addInteractionCue(loose, {
      kind: 'drag', label: '拖到竹枝', anchor: [0, -0.21, 0],
      destination: () => bamboo.localToWorld(looseHangPos.clone().add(new THREE.Vector3(0, -.21, 0))),
      targetLabel: '竹枝系结处',
      enabled: () => canCue() && step === 'hang',
    }),
  ]

  const completeScene = (fromWriting = false) => {
    if (!restoring && !ending.completing && !fromWriting) return
    if (!canAct() || step === 'done') return
    step = 'done'
    dragHandle?.setEnabled(false)
    wishHandle?.setEnabled(false)
    if (!restoring) { ctx.onProgress?.(3); if (disposed || !(canAct())) return }
    syncOverlayForStep()
    if (!restoring) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const goHang = () => {
    if (!canAct() || step !== 'pick') return
    step = 'hang'
    dragTarget.set(looseHome.x - 0.2, 0.9, 0.6)
    dragHandle?.setEnabled(true)
    if (!restoring) {
      // Light paper lift: haptic tick + a soft high note.
      fx.impact({ freqs: [1046.5, 1568], duration: 0.25, gain: 0.04 })
      ctx.onProgress?.(1)
    }
    syncOverlayForStep()
  }

  const goWish = () => {
    if (!canAct() || step !== 'hang') return
    step = 'wish'
    seatingFrom.copy(loose.position)
    seating = restoring || (ctx.isReducedMotion?.() ?? false) ? 1 : 0
    grabbed = false
    dragHandle?.setEnabled(false)
    dragTarget.copy(looseHangPos)
    looseMat.emissiveIntensity = 0.05
    wishHandle?.setEnabled(true)
    if (!restoring) {
      loose.rotation.z = 0
      sparkle = 1
      paperRig.resetStrip(3, 0.25, 0.18)
      paperRig.impulse(3, 2.8, 2.2)
      const reduced = ctx.isReducedMotion?.() ?? false
      fx.impact({
        freqs: [1318.5, 1975.5, 2637],
        duration: reduced ? 0.35 : 0.9,
        gain: reduced ? 0.05 : 0.09,
      })
      ctx.onProgress?.(2)
    } else {
      loose.position.copy(looseHangPos)
      loose.rotation.z = 0
      looseCarryLoop.visible = false
      looseHangCord.visible = true
      paperRig.resetStrip(3)
    }
    syncOverlayForStep()
  }

  const onActionTap = () => {
    if (disposed || interactionPointerId !== null) return
    fx.prepare()
    if (step === 'pick') goHang()
    else if (step === 'hang') goWish()
    else if (step === 'wish') completeScene()
  }

  // Registered before the drag handle so a press on the strip picks it up and
  // the same pointer keeps dragging (drag's pointerdown sees it enabled).
  let interactionPointerId: number | null = null
  const onHitDown = (e: PointerEvent) => {
    if (!canAct() || interactionPointerId !== null || (step !== 'pick' && step !== 'hang')) return
    fx.prepare()
    if (!onStrip(e.clientX, e.clientY)) return
    interactionPointerId = e.pointerId
    if (step === 'pick') goHang()
    grabbed = true
    grabHome.copy(loose.position)
    grabRotation.copy(loose.quaternion)
    const origin = loose.getWorldPosition(new THREE.Vector3())
    dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), loose.localToWorld(new THREE.Vector3(0, -.21, 0)))
    raycastAt(e.clientX, e.clientY)
    if (raycaster.ray.intersectPlane(dragPlane, hitPoint)) dragOffset.copy(origin).sub(hitPoint)
    moveStripTo(e.clientX, e.clientY)
  }

  const onHitMove = (e: PointerEvent) => {
    if (!canAct() || e.pointerId !== interactionPointerId || step !== 'hang' || !grabbed || e.buttons === 0) return
    moveStripTo(e.clientX, e.clientY)
    if (bambooHitTest(e.clientX, e.clientY)) goWish()
  }

  const onHitUp = (e?: PointerEvent) => {
    if (e && e.pointerId !== interactionPointerId) return
    if (step === 'hang' && grabbed) {
      loose.position.copy(grabHome); loose.quaternion.copy(grabRotation); dragTarget.copy(grabHome)
      pickZone.position.set(loose.position.x, loose.position.y - .2, loose.position.z)
      world.updateMatrixWorld(true)
    }
    interactionPointerId = null
    grabbed = false
  }
  const onInputBlur = () => onHitUp()

  const wireGestures = () => {
    hitLayer.addEventListener('pointerdown', onHitDown)
    stopClaim = claimObjectTouches(hitLayer, onStrip)
    dragHandle = gestures.createDrag({
      startsOn: (x, y) => canAct() && onStrip(x, y),
      hitTest: (x, y) => { moveStripTo(x, y); return bambooHitTest(x, y) },
      onDrop: (hit) => {
        if (step !== 'hang') return
        grabbed = false
        if (hit) goWish()
      },
    })
    dragHandle.mount(hitLayer, {})
    dragHandle.setEnabled(false)
    handles.push(dragHandle)

    hitLayer.addEventListener('pointermove', onHitMove)
    hitLayer.addEventListener('pointerup', onHitUp)
    hitLayer.addEventListener('pointercancel', onHitUp)
    hitLayer.addEventListener('lostpointercapture', onHitUp)
    window.addEventListener('blur', onInputBlur)
    actionBtn.addEventListener('click', onActionTap)

    let submittingWish = false
    wishHandle = gestures.createWishWrite({
      maxLen: 40,
      saves: ctx.saveWish !== undefined,
      onSubmit: (text) => {
        if (submittingWish || disposed || step !== 'wish' || !canAct()) return
        submittingWish = true
        try {
          ctx.saveWish?.(text)
          if (disposed || !canAct()) return
          completeScene(true)
        } finally {
          submittingWish = false
        }
      },
    })
    wishHandle.mount(wishSlot, {})
    wishHandle.setEnabled(false)
    handles.push(wishHandle)
  }

  syncOverlayForStep()

  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      if (typeof ResizeObserver !== 'undefined') {
        resizeObserver = new ResizeObserver(() => {
          if (!disposed) resize()
        })
        resizeObserver.observe(canvas)
      }
      wireGestures()
      if ((ctx.initialProgress ?? 0) >= 1) goHang()
      if ((ctx.initialProgress ?? 0) >= 2) goWish()
      if ((ctx.initialProgress ?? 0) >= 3) completeScene()
      restoring = false
      if (!ctx.isReducedMotion?.()) void paperRig.start()
      syncOverlayForStep()
    },
    update(dt: number) {
      if (disposed || !started) return
      if (!canAct()) {
        onHitUp()
        dragHandle?.setEnabled(false)
        return
      }
      dragHandle?.setEnabled(step === 'hang')
      for (const h of handles) h.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const t = reduced ? 0 : performance.now() * 0.001

      bamboo.rotation.z = Math.sin(t * 0.5) * 0.008
      paperRig.update(dt, t)

      const follow = reduced ? 1 : 1 - Math.exp(-dt * 12)
      if (step === 'hang') {
        const prevX = loose.position.x
        loose.position.lerp(dragTarget, follow)
        loose.rotation.z = THREE.MathUtils.lerp(loose.rotation.z, 0, follow)
        pickZone.position.set(loose.position.x, loose.position.y - 0.2, loose.position.z)
        const dragBend = THREE.MathUtils.clamp((loose.position.x - prevX) * 6, -0.22, 0.22)
        poseRestingPaperStrip(looseVisual.surface, {
          yaw: reduced ? -0.1 : Math.sin(t * 1.4) * 0.12 - 0.1,
          swingZ: -dragBend * 0.55,
          bendZ: 0.18 + Math.abs(dragBend) * 0.65,
          twist: 0.05,
          camber: 0.0028,
        })
        looseCarryLoop.visible = true
        looseHangCord.visible = false
      } else if (step === 'wish' || step === 'done') {
        loose.rotation.z = THREE.MathUtils.lerp(
          loose.rotation.z,
          0,
          reduced ? 1 : 1 - Math.exp(-dt * 8),
        )
      } else {
        looseMat.emissiveIntensity = 0.15 + Math.sin(t * 2.4) * 0.1
        poseRestingPaperStrip(looseVisual.surface, {
          yaw: 0.22,
          bendZ: 0.30 + (reduced ? 0 : Math.sin(t * 1.2) * 0.03),
          twist: 0.10,
          camber: 0.0038,
        })
        looseCarryLoop.visible = true
        looseHangCord.visible = false
      }
      stripVisuals.forEach(syncHoleAnchor)
      const scaleTarget = 1
      loose.scale.setScalar(
        THREE.MathUtils.lerp(loose.scale.x, scaleTarget, 1 - Math.exp(-dt * 12)),
      )

      // Hang burst: a brief warm glow at the strip.
      sparkle = Math.max(0, sparkle - dt * (reduced ? 3 : 0.8))
      sparkleLight.intensity = sparkle * 1.6

      camera.position.set(
        cameraHome.x + Math.sin(t * 0.14) * 0.1,
        cameraHome.y + Math.sin(t * 0.1) * 0.04,
        cameraHome.z,
      )
      camera.lookAt(cameraLookAt)

      ending.update(dt)
      if (disposed || !(canAct())) return
      if (step === 'wish' || step === 'done') {
        // The bamboo carries the fixed paper top; only the free paper can lag.
        bamboo.localToWorld(hungPoint.copy(looseHangPos))
        world.worldToLocal(hungPoint)
        seating = reduced ? 1 : Math.min(1, seating + Math.max(0, dt) / .18)
        loose.position.lerpVectors(seatingFrom, hungPoint, seating * seating * (3 - 2 * seating))
        loose.getWorldPosition(sparkleLight.position)
        const seated = seating >= 0.85
        looseCarryLoop.visible = !seated
        looseHangCord.visible = seated
      }
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true
      paperRig.dispose()
      resizeObserver?.disconnect()
      resizeObserver = null
      stopClaim()
      hitLayer.removeEventListener('pointerdown', onHitDown)
      hitLayer.removeEventListener('pointermove', onHitMove)
      hitLayer.removeEventListener('pointerup', onHitUp)
      hitLayer.removeEventListener('pointercancel', onHitUp)
      hitLayer.removeEventListener('lostpointercapture', onHitUp)
      window.removeEventListener('blur', onInputBlur)
      actionBtn.removeEventListener('click', onActionTap)
      for (const h of handles) h.dispose()
      handles.length = 0
      fx.dispose()
      for (const removeCue of removeCues) removeCue()
      styleRenderer.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      disposeTree(world)
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
