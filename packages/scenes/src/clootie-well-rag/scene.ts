import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '@wbr/scene-runtime/interaction-cues'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback,
  createStepOverlay, createWarmStage, disposeTree, observeCanvasResize,
  portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '井边放下', stepsAria: '步骤',
  dip: '把这片纯棉布轻轻拖入井水。',
  tie: '布片已浸湿。把它拖到低枝的浅金圈。',
  release: '布片已系在低枝上。轻触布片再松手。',
  done: '布片留在枝头，静看这一刻。',
  dipping: '纯棉布轻轻展开，浸入清水…',
  tying: '把湿布绕过低枝，轻轻系好…',
  settling: '松开手，布片轻轻垂下…',
  dipAction: '浸一下布', tieAction: '系到枝上', releaseAction: '松手静看',
} as const

type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1 | 2; time: number; from: THREE.Vector3 }
const DRY = new THREE.Vector3(0.53, 0.76, 0.66)
const DIPPED = new THREE.Vector3(-0.62, 0.83, 0.06)
const WET = new THREE.Vector3(-0.45, 1.19, 0.28)
const TIED = new THREE.Vector3(0.12, 1.46, 0.15)
const COLS = 16, ROWS = 30
const smooth = (t: number) => { const p = THREE.MathUtils.clamp(t, 0, 1); return p * p * (3 - 2 * p) }

/** Original cotton weave, with alternating warp/weft and a muted edge band. */
function cottonTexture() {
  const size = 128, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const warp = x % 4 < 2, weft = y % 4 < 2
    const thread = warp === weft ? 7 : -9
    const irregularity = ((x * 17 + y * 29) % 11) - 5
    const edge = x < 6 || x > size - 7 || y < 6 || y > size - 7
    const i = (y * size + x) * 4
    data[i] = 238 + thread + irregularity - (edge ? 20 : 0)
    data[i + 1] = 231 + thread + irregularity - (edge ? 14 : 0)
    data[i + 2] = 207 + thread + irregularity - (edge ? 1 : 0)
    data[i + 3] = 255
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.magFilter = THREE.LinearFilter
  texture.minFilter = THREE.LinearMipmapLinearFilter
  texture.generateMipmaps = true
  texture.needsUpdate = true
  return texture
}

function softShadowTexture() {
  const size = 64, data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const r = Math.hypot((x + 0.5 - size / 2) / (size / 2), (y + 0.5 - size / 2) / (size / 2))
    const i = (y * size + x) * 4
    data[i] = data[i + 1] = data[i + 2] = 255
    data[i + 3] = Math.round(Math.max(0, 1 - r) ** 2 * 255)
  }
  const texture = new THREE.DataTexture(data, size, size)
  texture.magFilter = texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  return texture
}

function tube(points: number[][], radius: number, material: THREE.Material, segments = 30) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y, z]) => new THREE.Vector3(x, y, z)), false, 'centripetal')
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, 9, false), material)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

/** Source-informed cloth practice: dip, tie, release; the cotton stays visible. */
export function createClootieWellRag(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let started = false, disposed = false, completed = false
  let checkpoint: Checkpoint = 0, clock = 0, unfold = 0, tied = 0, dragBend = 0
  let motion: Motion | null = null, dragging = false
  let stopResize = () => {}
  const active = () => started && !disposed && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.dipAction }, assertSafeCopy)
  const { hitLayer, actionBtn, hintEl } = ui
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const lookAt = new THREE.Vector3(0.12, 1.15, 0.05)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'clootie-well-rag', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, {
    sky: 0xfff5e4, ground: 0xb9c9a5, key: 0xffe5c9, rim: 0xd5eddf,
    keyIntensity: 1.2, keyPosition: [-2.8, 4.5, 3.5], rimIntensity: 0.45,
  })
  lights.key.castShadow = true
  lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3.2, bottom: -1, near: 0.1, far: 12 })
  lights.key.shadow.bias = -0.0008
  lights.key.shadow.normalBias = 0.025

  const world = new THREE.Group()
  world.name = 'clootie-well-and-tree'
  scene.add(world)
  const bark = new THREE.MeshStandardMaterial({ color: 0x937259, roughness: 1 })
  const barkHighlight = new THREE.MeshStandardMaterial({ color: 0xb69771, roughness: 1 })
  const mint = new THREE.MeshStandardMaterial({ color: 0x9cbfa3, roughness: 1 })
  const sage = new THREE.MeshStandardMaterial({ color: 0xb5c7a4, roughness: 1 })
  const mossMat = new THREE.MeshStandardMaterial({ color: 0x9aaf7e, roughness: 1 })
  const stoneColors = [0xc8bfaa, 0xd9cdb6, 0xbabba6, 0xc6c4b2].map((color) => new THREE.MeshStandardMaterial({ color, roughness: 1 }))

  // A low, open stone well. Separate beveled wedges preserve the dark opening
  // and the visible water surface instead of closing it with a cylinder cap.
  const well = new THREE.Group()
  well.name = 'clootie-stone-well'
  well.position.set(-0.62, 0, 0.06)
  world.add(well)
  for (let row = 0; row < 2; row++) for (let i = 0; i < 10; i++) {
    const angle = (i + row * 0.5) * Math.PI * 2 / 10
    const half = Math.PI / 10 - 0.018, shape = new THREE.Shape()
    const inner = 0.36, outer = 0.53 + Math.sin(i * 7 + row) * 0.013
    shape.moveTo(Math.cos(angle - half) * inner, Math.sin(angle - half) * inner)
    shape.lineTo(Math.cos(angle - half) * outer, Math.sin(angle - half) * outer)
    shape.absarc(0, 0, outer, angle - half, angle + half, false)
    shape.lineTo(Math.cos(angle + half) * inner, Math.sin(angle + half) * inner)
    shape.absarc(0, 0, inner, angle + half, angle - half, true)
    shape.closePath()
    const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.165, bevelEnabled: true, bevelThickness: 0.021, bevelSize: 0.02, bevelSegments: 3, curveSegments: 8, steps: 1 })
    const stone = new THREE.Mesh(geo, stoneColors[(i + row) % stoneColors.length])
    stone.rotation.x = -Math.PI / 2
    stone.position.y = 0.032 + row * 0.19
    stone.castShadow = stone.receiveShadow = true
    well.add(stone)
  }
  const waterMat = new THREE.MeshStandardMaterial({ color: 0x88beb4, roughness: 0.29, metalness: 0.05, transparent: true, opacity: 0.94 })
  const waterSurface = new THREE.Mesh(new THREE.CircleGeometry(0.354, 48), waterMat)
  waterSurface.name = 'clootie-well-water'
  waterSurface.rotation.x = -Math.PI / 2
  waterSurface.position.y = 0.335
  well.add(waterSurface)
  // A small volume within the well makes a drop at the water's exact centre
  // reliable even when the ray lies on the shared edges of its triangles.
  const water = new THREE.Mesh(new THREE.SphereGeometry(0.32, 16, 10), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
  water.name = 'clootie-water-target'
  water.position.y = 0.335
  well.add(water)
  const wellDark = new THREE.Mesh(new THREE.CylinderGeometry(0.348, 0.348, 0.09, 40), new THREE.MeshStandardMaterial({ color: 0x526e64, roughness: 1 }))
  wellDark.position.y = 0.245
  well.add(wellDark)
  const rippleMat = new THREE.MeshBasicMaterial({ color: 0xdaeee1, transparent: true, opacity: 0.55 })
  const ripples = [0.13, 0.24].map((radius) => {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(radius, 0.0045, 5, 40), rippleMat)
    ring.rotation.x = -Math.PI / 2
    ring.position.set(0, 0.338, 0)
    well.add(ring)
    return ring
  })
  for (let i = 0; i < 5; i++) {
    const pebble = new THREE.Mesh(new THREE.SphereGeometry(1, 12, 8), stoneColors[i % 4])
    pebble.scale.set(0.08 + (i % 2) * 0.025, 0.028, 0.055)
    pebble.position.set(-1.02 + i * 0.21, 0.031, 0.65 + Math.sin(i) * 0.06)
    pebble.castShadow = pebble.receiveShadow = true
    world.add(pebble)
  }

  const tree = new THREE.Group()
  tree.name = 'clootie-old-tree'
  world.add(tree)
  tree.add(tube([[0.81, 0.13, -0.08], [0.73, 0.48, -0.1], [0.88, 0.92, -0.09], [0.77, 1.42, -0.12], [0.89, 1.97, -0.16], [0.67, 2.3, -0.19]], 0.125, bark))
  for (const side of [-1, 1]) {
    tree.add(tube([[0.79, 0.2, -0.09], [0.79 + side * 0.16, 0.095, 0.01], [0.79 + side * 0.34, 0.054, 0.2]], 0.045, bark, 16))
  }
  tree.add(tube([[0.77, 1.31, -0.1], [0.52, 1.4, -0.015], [0.24, 1.465, 0.03], [0.04, 1.455, 0.065]], 0.046, bark))
  tree.add(tube([[0.81, 1.76, -0.13], [1.02, 1.96, -0.1], [1.12, 2.24, -0.09]], 0.045, bark))
  tree.add(tube([[0.86, 1.9, -0.15], [0.53, 2.13, -0.22], [0.26, 2.28, -0.21]], 0.043, bark))
  // Sparse bark ridges and a rounded knot mark the tree's age gently.
  tree.add(tube([[0.83, 0.42, 0.035], [0.89, 0.8, 0.035], [0.85, 1.1, 0.012]], 0.008, barkHighlight))
  const treeKnot = new THREE.Mesh(new THREE.TorusGeometry(0.049, 0.012, 7, 20), barkHighlight)
  treeKnot.position.set(0.83, 0.89, 0.042)
  treeKnot.scale.set(0.75, 1.28, 1)
  tree.add(treeKnot)
  const crownGeo = new THREE.IcosahedronGeometry(1, 2)
  for (const [i, [x, y, z, scale]] of [
    [0.43, 2.3, -0.23, 0.39], [0.82, 2.42, -0.27, 0.42],
    [1.13, 2.27, -0.19, 0.34], [0.91, 2.08, -0.3, 0.29],
  ].entries()) {
    const crown = new THREE.Mesh(crownGeo, i % 2 ? mint : sage)
    crown.position.set(x, y, z)
    crown.scale.set(scale, scale * 0.77, scale * 0.8)
    crown.castShadow = crown.receiveShadow = true
    tree.add(crown)
  }
  for (let i = 0; i < 4; i++) {
    const moss = new THREE.Mesh(new THREE.SphereGeometry(1, 10, 6), mossMat)
    moss.position.set(0.77 + Math.cos(i * 1.7) * 0.23, 0.032, -0.02 + Math.sin(i * 1.7) * 0.17)
    moss.scale.set(0.12, 0.03, 0.085)
    world.add(moss)
  }

  const guideMat = new THREE.MeshBasicMaterial({ color: 0xe5c985, transparent: true, opacity: 0.84 })
  const branchGuide = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.007, 6, 32), guideMat)
  branchGuide.position.copy(TIED)
  branchGuide.name = 'clootie-low-branch-guide'
  world.add(branchGuide)
  const hitMat = new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false })
  const branchTarget = new THREE.Mesh(new THREE.SphereGeometry(0.13, 12, 8), hitMat)
  branchTarget.name = 'clootie-branch-target'
  branchTarget.position.copy(TIED)
  world.add(branchTarget)

  const cottonMap = cottonTexture()
  const cotton = new THREE.MeshStandardMaterial({ color: 0xf6e8c9, map: cottonMap, roughness: 1, side: THREE.DoubleSide })
  const rag = new THREE.Group()
  rag.name = 'clootie-rag'
  rag.position.copy(DRY)
  world.add(rag)
  const clothGeo = new THREE.PlaneGeometry(0.48, 0.74, COLS, ROWS)
  const cloth = new THREE.Mesh(clothGeo, cotton)
  cloth.name = 'clootie-cotton-rag'
  cloth.castShadow = cloth.receiveShadow = true
  // Woven cotton and its folds stay readable without a black outline for
  // every tiny wrinkle in the soft village render style.
  cloth.userData.toonSurface = { outline: false }
  rag.add(cloth)
  const ragHandle = new THREE.Mesh(new THREE.SphereGeometry(0.15, 12, 8), hitMat)
  ragHandle.name = 'clootie-rag-handle'
  rag.add(ragHandle)
  addInteractionCue(ragHandle, {
    kind: 'drag', label: '拖棉布入井水', priority: 2,
    enabled: () => active() && !motion && checkpoint === 0,
    destination: water, targetLabel: '井水',
  })
  addInteractionCue(ragHandle, {
    kind: 'drag', label: '拖湿布到低枝', priority: 2,
    enabled: () => active() && !motion && checkpoint === 1,
    destination: branchTarget, targetLabel: '低枝挂点',
  })
  addInteractionCue(ragHandle, {
    kind: 'tap', label: '轻触布片再松手', priority: 2,
    enabled: () => active() && !motion && checkpoint === 2,
  })
  const knot = new THREE.Group()
  knot.name = 'clootie-cotton-knot'
  const knotGeo = new THREE.TorusGeometry(0.043, 0.015, 7, 24)
  for (const side of [-1, 1]) {
    const loop = new THREE.Mesh(knotGeo, cotton)
    loop.position.set(side * 0.027, -0.025, 0.008)
    loop.rotation.y = side * 0.46
    loop.scale.set(0.72, 0.5, 1)
    knot.add(loop)
  }
  rag.add(knot)

  const shadowMap = softShadowTexture()
  const shadowMat = new THREE.MeshBasicMaterial({ map: shadowMap, color: 0x536349, transparent: true, opacity: 0.27, depthWrite: false })
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(2.55, 1.55), shadowMat)
  shadow.name = 'clootie-contact-shadow'
  shadow.rotation.x = -Math.PI / 2
  shadow.position.set(0.04, 0.005, 0.14)
  world.add(shadow)

  const ray = createPointerRay(canvas, camera)
  const dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), dragOffset = new THREE.Vector3(), dragOrigin = new THREE.Vector3()
  const home = () => checkpoint === 0 ? DRY : checkpoint === 1 ? WET : TIED
  const syncUI = () => {
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = motion !== null || checkpoint === 3
    setSafeText(actionBtn, checkpoint === 0 ? COPY.dipAction : checkpoint === 1 ? COPY.tieAction : COPY.releaseAction, assertSafeCopy)
    setSafeText(hintEl, motion ? [COPY.dipping, COPY.tying, COPY.settling][motion.step] : [COPY.dip, COPY.tie, COPY.release, COPY.done][checkpoint], assertSafeCopy)
    branchGuide.visible = checkpoint === 1 && !motion
  }
  const poseCloth = () => {
    const attr = clothGeo.getAttribute('position') as THREE.BufferAttribute
    const breeze = reduced() || checkpoint === 3 ? 0 : Math.sin(clock * 1.55) * 0.013
    for (let row = 0; row <= ROWS; row++) for (let col = 0; col <= COLS; col++) {
      const u = col / COLS, v = row / ROWS
      const width = THREE.MathUtils.lerp(0.48, 0.45 * (1 - 0.7 * Math.exp(-v * 8)), tied)
      const fold = Math.sin(v * Math.PI * 5) * 0.064 * (1 - unfold)
      const wrinkle = Math.sin(u * Math.PI * 5 + v * 2) * (0.016 + tied * 0.014)
      const x = (u - 0.5) * width + (breeze + dragBend * 0.13) * v * v
      const y = -v * THREE.MathUtils.lerp(0.26, 0.74, unfold) + Math.sin(u * Math.PI * 2) * 0.012 * v
      const z = fold + wrinkle * Math.sin(v * Math.PI * 0.5) + (0.035 * tied + breeze) * v * v
      attr.setXYZ(row * (COLS + 1) + col, x, y, z)
    }
    attr.needsUpdate = true
    clothGeo.computeVertexNormals()
    clothGeo.computeBoundingBox()
    clothGeo.computeBoundingSphere()
    ragHandle.position.set(0, -THREE.MathUtils.lerp(0.13, 0.28, unfold), 0.025)
    knot.visible = tied > 0.6
    knot.scale.setScalar(Math.max(0.01, tied))
    cotton.color.setHex(checkpoint === 0 && !motion ? 0xf6e8c9 : 0xd8dfc8)
    world.updateMatrixWorld(true)
  }
  const restorePose = () => {
    rag.position.copy(home())
    unfold = checkpoint === 0 ? 0 : 1
    tied = checkpoint >= 2 ? 1 : 0
    dragBend = 0
    poseCloth()
  }
  const finish = () => {
    if (!motion) return
    checkpoint = (motion.step + 1) as Checkpoint
    motion = null
    restorePose()
    syncUI()
    ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 1 ? [285, 428] : [342, 513], duration: 0.3, gain: 0.04 })
    if (checkpoint === 3 && !completed) {
      completed = true
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const begin = () => {
    if (!active() || motion || checkpoint === 3) return
    motion = { step: checkpoint, time: 0, from: rag.position.clone() }
    dragging = false
    if (reduced()) finish()
    else syncUI()
  }
  const pointer = createObjectPointer(hitLayer, {
    isActive: active,
    canStart(x, y) { return !motion && checkpoint < 3 && ray.hits(x, y, [ragHandle, cloth]) },
    onStart(x, y) {
      dragging = true
      feedback.prepare()
      dragOrigin.copy(rag.position)
      dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), rag.position)
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) dragOffset.copy(rag.position).sub(dragPoint)
    },
    onMove(x, y) {
      if (!dragging || checkpoint === 2) return
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) {
        rag.position.copy(dragPoint).add(dragOffset)
        rag.position.x = THREE.MathUtils.clamp(rag.position.x, -1.12, 1.15)
        rag.position.y = THREE.MathUtils.clamp(rag.position.y, checkpoint === 0 ? 0.31 : 0.79, 2)
        dragBend = THREE.MathUtils.clamp(rag.position.x - dragOrigin.x, -0.8, 0.8)
        poseCloth()
      }
    },
    onRelease(x, y) {
      const valid = dragging && active() && !motion && (checkpoint === 2 || ray.hits(x, y, [checkpoint === 0 ? water : branchTarget]))
      dragging = false
      if (valid) begin()
      else restorePose()
    },
    onCancel() { dragging = false; if (!motion) restorePose() },
  })
  const onAction = () => {
    if (!active() || motion || pointer.isBusy() || checkpoint === 3) return
    feedback.prepare()
    begin()
  }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    camera.position.set(0.12, 1.86, 5.1 + portraitBoost(aspect, 4))
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }

  poseCloth()
  syncUI()
  return {
    start() {
      if (disposed || started) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3
      restorePose()
      syncUI()
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      actionBtn.addEventListener('click', onAction)
    },
    update(dt) {
      if (disposed || !started) return
      if (!active()) {
        pointer.cancel()
        styleRenderer.render()
        return
      }
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
      clock += delta
      if (motion) {
        const duration = motion.step === 0 ? 1.15 : motion.step === 1 ? 0.95 : 0.65
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / duration)
        const p = smooth(motion.time)
        if (motion.step === 0) {
          if (motion.time < 0.56) rag.position.lerpVectors(motion.from, DIPPED, smooth(motion.time / 0.56))
          else rag.position.lerpVectors(DIPPED, WET, smooth((motion.time - 0.56) / 0.44))
          unfold = smooth(Math.min(1, motion.time / 0.42))
          const ripple = Math.sin(Math.min(1, motion.time / 0.8) * Math.PI)
          ripples.forEach((ring, i) => ring.scale.setScalar(1 + ripple * (0.2 + i * 0.1)))
        } else if (motion.step === 1) {
          rag.position.lerpVectors(motion.from, TIED, p)
          tied = p
        } else {
          dragBend = Math.sin(p * Math.PI) * 0.14 * (1 - p)
        }
        if (motion.time === 1) finish()
      }
      poseCloth()
      guideMat.opacity = reduced() ? 0.84 : 0.73 + Math.sin(clock * 2) * 0.11
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      pointer.dispose()
      stopResize()
      actionBtn.removeEventListener('click', onAction)
      feedback.dispose()
      styleRenderer.dispose()
      disposeTree(scene)
      cottonMap.dispose()
      shadowMap.dispose()
      Object.values(lights).forEach((light) => light.dispose())
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
