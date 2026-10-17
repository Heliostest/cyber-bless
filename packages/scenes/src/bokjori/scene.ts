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
  title: '竹筛迎岁', stepsAria: '步骤',
  scoop: '拖竹筛到米盘，纳一小撮米。韩国岁首民俗的手作回看。',
  hang: '竹筛里留着少许米。拖竹柄到墙上的木挂点。',
  quiet: '竹筛已挂好。轻触竹筛，静看这一刻。',
  done: '米粒留在竹筛里，迎新心意留在家中。',
  scooping: '竹筛轻轻纳起一小撮米…',
  hanging: '把竹筛挂到木挂点，慢慢松手…',
  settling: '竹筛安静地垂下…',
  scoopAction: '纳一小撮米', hangAction: '挂到木挂点', quietAction: '轻触静看',
} as const

type Checkpoint = 0 | 1 | 2 | 3
type Motion = { step: 0 | 1 | 2; time: number; from: THREE.Vector3; rotation: THREE.Euler }
const READY = new THREE.Vector3(-0.5, 0.72, 0.38)
const LOADED = new THREE.Vector3(-0.44, 0.79, 0.34)
const DIP = new THREE.Vector3(0.59, 0.59, 0.5)
const PEG = new THREE.Vector3(0.5, 2.09, -0.245)
const HUNG = new THREE.Vector3(0.5, 0.86, -0.32)
const smooth = (t: number) => { const p = THREE.MathUtils.clamp(t, 0, 1); return p * p * (3 - 2 * p) }

function tube(points: THREE.Vector3[], radius: number, material: THREE.Material, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points, closed, 'centripetal')
  const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, Math.max(12, points.length * 2), radius, 7, closed), material)
  mesh.castShadow = mesh.receiveShadow = true
  return mesh
}

/** A flattened, closed bamboo strip following a curved bowl surface. */
function ribbon(points: THREE.Vector3[], width: number, vertical: boolean, material: THREE.Material) {
  const positions: number[] = [], indices: number[] = []
  const across = vertical ? new THREE.Vector3(width / 2, 0, 0) : new THREE.Vector3(0, width / 2, 0)
  points.forEach(p => {
    for (const side of [-1, 1]) for (const depth of [-1, 1]) {
      const q = p.clone().addScaledVector(across, side)
      positions.push(q.x, q.y, q.z + depth * 0.003)
    }
  })
  for (let i = 0; i < points.length - 1; i++) {
    const a = i * 4, b = a + 4
    for (const [u, v] of [[0, 2], [2, 3], [3, 1], [1, 0]]) indices.push(a + u, b + u, a + v, a + v, b + u, b + v)
  }
  indices.push(0, 1, 2, 2, 1, 3)
  const end = (points.length - 1) * 4
  indices.push(end, end + 2, end + 1, end + 2, end + 3, end + 1)
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices); geometry.computeVertexNormals()
  const mesh = new THREE.Mesh(geometry, material)
  mesh.castShadow = mesh.receiveShadow = true
  mesh.userData.toonSurface = { outline: false }
  return mesh
}

/** Original bamboo basket weave: visible gaps, bent strips and an oval rolled rim. */
function makeScoop() {
  const scoop = new THREE.Group(); scoop.name = 'bokjori-scoop'
  const bowl = new THREE.Group(); bowl.name = 'bokjori-woven-bowl'; scoop.add(bowl)
  const bamboo = [0xe0bd7a, 0xe9ce93, 0xcfa866, 0xe4c68a].map(color => new THREE.MeshStandardMaterial({ color, roughness: 0.91, side: THREE.DoubleSide }))
  const accent = new THREE.MeshStandardMaterial({ color: 0x78977d, roughness: 0.94, side: THREE.DoubleSide })
  const red = new THREE.MeshStandardMaterial({ color: 0xb96755, roughness: 1 })
  const cord = new THREE.MeshStandardMaterial({ color: 0xe4d4a5, roughness: 1 })
  for (const vertical of [false, true]) for (let i = -8; i <= 8; i++) {
    const fixed = i / 9, extent = Math.sqrt(1 - fixed * fixed)
    const points: THREE.Vector3[] = []
    for (let j = 0; j <= 36; j++) {
      const along = (j / 18 - 1) * extent
      const u = vertical ? fixed : along, v = vertical ? along : fixed
      const weave = Math.cos(along * 9 * Math.PI + i * Math.PI) * (vertical ? 0.006 : -0.006)
      points.push(new THREE.Vector3(u * 0.43, v * 0.365, -0.18 + 0.25 * (u * u + v * v) + weave))
    }
    const strip = ribbon(points, 0.024, vertical, vertical && i % 4 === 0 ? accent : bamboo[(i + 8) % bamboo.length])
    strip.name = `bokjori-${vertical ? 'warp' : 'weft'}-${i + 8}`; bowl.add(strip)
  }
  for (const radius of [0.98, 1.025]) {
    const points = Array.from({ length: 64 }, (_, i) => {
      const t = i / 64 * Math.PI * 2
      return new THREE.Vector3(Math.cos(t) * 0.43 * radius, Math.sin(t) * 0.365 * radius, 0.073)
    })
    const rim = tube(points, 0.018, bamboo[1], true); rim.name = 'bokjori-rolled-bamboo-rim'; bowl.add(rim)
  }
  for (const side of [-1, 1]) {
    const handle = tube([
      new THREE.Vector3(side * 0.145, 0.25, 0.02), new THREE.Vector3(side * 0.092, 0.52, 0.04),
      new THREE.Vector3(side * 0.033, 0.86, 0.06), new THREE.Vector3(side * 0.03, 1.12, 0.072),
    ], 0.025, bamboo[side < 0 ? 0 : 1])
    handle.name = `bokjori-bamboo-handle-${side < 0 ? 'left' : 'right'}`; scoop.add(handle)
    for (const y of [0.56, 0.91, 1.075]) {
      const wrap = new THREE.Mesh(new THREE.TorusGeometry(y < 0.7 ? 0.045 : 0.032, 0.009, 6, 18), red)
      wrap.rotation.x = Math.PI / 2; wrap.position.set(side * (y < 0.7 ? 0.082 : 0.031), y, 0.055)
      scoop.add(wrap)
    }
  }
  const ties = new THREE.Group(); ties.name = 'bokjori-hanging-ties'; scoop.add(ties)
  const loop = new THREE.Mesh(new THREE.TorusGeometry(0.095, 0.011, 6, 28), cord)
  loop.name = 'bokjori-hanging-loop'; loop.position.set(0, 1.23, 0.075); loop.scale.set(0.62, 1.2, 1); ties.add(loop)
  for (const side of [-1, 1]) {
    ties.add(tube([new THREE.Vector3(side * 0.025, 0.82, 0.07), new THREE.Vector3(side * 0.13, 0.61, 0.09), new THREE.Vector3(side * 0.1, 0.43, 0.085)], 0.012, red))
    const knot = new THREE.Mesh(new THREE.SphereGeometry(0.027, 10, 6), red)
    knot.position.set(side * 0.1, 0.45, 0.085); ties.add(knot)
  }
  const rice = new THREE.Group(); rice.name = 'bokjori-collected-rice'; scoop.add(rice)
  const riceMat = new THREE.MeshStandardMaterial({ color: 0xfff1d5, roughness: 0.9 })
  const grainGeo = new THREE.SphereGeometry(1, 8, 6)
  for (let i = 0; i < 18; i++) {
    const a = i * 2.399, r = Math.sqrt((i + 0.5) / 18) * 0.16
    const grain = new THREE.Mesh(grainGeo, riceMat)
    grain.position.set(Math.cos(a) * r, -0.055 + Math.sin(a) * r * 0.62, -0.15 + r * r * 1.7)
    grain.scale.set(0.012, 0.027, 0.011); grain.rotation.z = a
    grain.castShadow = true; grain.userData.toonSurface = { outline: false }; rice.add(grain)
  }
  return { scoop, rice }
}

/** Seasonal Korean household folklore adapted as three quiet object gestures. */
export function createBokjori(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let started = false, disposed = false, completed = false, checkpoint: Checkpoint = 0
  let motion: Motion | null = null, dragging = false, stopResize = () => {}
  const active = () => started && !disposed && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.scoopAction }, assertSafeCopy)
  const { hitLayer, actionBtn, hintEl } = ui
  const { renderer, scene } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'bokjori', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff2de, ground: 0xbcbea1, key: 0xffe5c8, rim: 0xd4e9d5,
    keyPosition: [-2.8, 4.5, 3.2], keyIntensity: 1.2, rimIntensity: 0.45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2, right: 2, top: 3, bottom: -1, near: 0.1, far: 12 })
  lights.key.shadow.bias = -0.0008; lights.key.shadow.normalBias = 0.025
  const world = new THREE.Group(); world.name = 'bokjori-veranda-work'; scene.add(world)
  const wood = new THREE.MeshStandardMaterial({ color: 0xb5966d, roughness: 1 })
  const paleWood = new THREE.MeshStandardMaterial({ color: 0xc8ad85, roughness: 1 })
  const wall = new THREE.Group(); wall.name = 'bokjori-timber-wall'; world.add(wall)
  for (let i = 0; i < 7; i++) {
    const slat = new THREE.Mesh(new THREE.BoxGeometry(0.305, 2.48, 0.095), i % 2 ? paleWood : wood)
    slat.position.set((i - 3) * 0.312, 1.27, -0.54); slat.receiveShadow = true; wall.add(slat)
  }
  for (const y of [0.22, 2.47]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(2.27, 0.13, 0.13), wood)
    rail.position.set(0, y, -0.48); rail.castShadow = rail.receiveShadow = true; wall.add(rail)
  }
  const peg = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.055, 0.23, 16), wood)
  peg.name = 'bokjori-wall-peg'; peg.rotation.x = Math.PI / 2; peg.position.copy(PEG)
  peg.castShadow = true; world.add(peg)
  const pegCap = new THREE.Mesh(new THREE.SphereGeometry(0.066, 14, 8), paleWood)
  pegCap.scale.set(1, 1, 0.45); pegCap.position.copy(PEG).add(new THREE.Vector3(0, 0, 0.12)); world.add(pegCap)
  const shelf = new THREE.Mesh(new THREE.BoxGeometry(1.07, 0.1, 0.84), paleWood)
  shelf.position.set(0.59, 0.25, 0.43); shelf.castShadow = shelf.receiveShadow = true; world.add(shelf)
  for (const x of [0.18, 1]) {
    const leg = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.12), wood)
    leg.position.set(x, 0.1, 0.46); world.add(leg)
  }
  const tray = new THREE.Group(); tray.name = 'bokjori-rice-tray'; tray.position.set(0.59, 0.36, 0.48); world.add(tray)
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xceb38e, roughness: 1 })
  const trayBase = new THREE.Mesh(new THREE.CylinderGeometry(0.41, 0.38, 0.085, 40), trayMat)
  trayBase.scale.z = 0.78; trayBase.castShadow = trayBase.receiveShadow = true; tray.add(trayBase)
  const trayRim = new THREE.Mesh(new THREE.TorusGeometry(0.405, 0.028, 7, 48), trayMat)
  trayRim.rotation.x = -Math.PI / 2; trayRim.scale.y = 0.78; trayRim.position.y = 0.05; tray.add(trayRim)
  const grainMat = new THREE.MeshStandardMaterial({ color: 0xf3e5c8, roughness: 1 })
  const grainTarget = new THREE.Mesh(new THREE.CylinderGeometry(0.369, 0.369, 0.018, 40), grainMat)
  grainTarget.name = 'bokjori-grain-target'; grainTarget.scale.z = 0.78; grainTarget.position.y = 0.053; tray.add(grainTarget)
  const grains = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 7, 5), grainMat, 100)
  grains.name = 'bokjori-tray-rice'; grains.userData.toonSurface = { outline: false }
  const grainPose = new THREE.Object3D()
  for (let i = 0; i < 100; i++) {
    const a = i * 2.399, r = Math.sqrt((i + 0.5) / 100) * 0.35
    grainPose.position.set(Math.cos(a) * r, 0.068, Math.sin(a) * r * 0.76)
    grainPose.scale.set(0.012, 0.009, 0.025); grainPose.rotation.y = a; grainPose.updateMatrix(); grains.setMatrixAt(i, grainPose.matrix)
  }
  tray.add(grains)
  const { scoop, rice } = makeScoop(); world.add(scoop)
  const source = new THREE.Mesh(new THREE.SphereGeometry(0.19, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }))
  source.name = 'bokjori-scoop-source'; scoop.add(source)
  addInteractionCue(source, { kind: 'drag', label: '拖竹筛纳米', priority: 2, enabled: () => active() && !motion && checkpoint === 0, destination: grainTarget, targetLabel: '米盘' })
  addInteractionCue(source, { kind: 'drag', label: '拖竹柄到木挂点', priority: 2, enabled: () => active() && !motion && checkpoint === 1, destination: peg, targetLabel: '木挂点' })
  addInteractionCue(source, { kind: 'tap', label: '轻触竹筛静看', priority: 2, enabled: () => active() && !motion && checkpoint === 2 })
  const pickables: THREE.Object3D[] = []
  scoop.traverse(o => { if ((o as THREE.Mesh).isMesh) pickables.push(o) })
  const ray = createPointerRay(canvas, camera)
  const dragPlane = new THREE.Plane(), dragPoint = new THREE.Vector3(), dragOffset = new THREE.Vector3()
  const pointerStart = new THREE.Vector2()
  const home = () => checkpoint === 0 ? READY : checkpoint === 1 ? LOADED : HUNG
  const syncUI = () => {
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3; actionBtn.disabled = !!motion || checkpoint === 3
    setSafeText(actionBtn, [COPY.scoopAction, COPY.hangAction, COPY.quietAction, COPY.quietAction][checkpoint], assertSafeCopy)
    setSafeText(hintEl, motion ? [COPY.scooping, COPY.hanging, COPY.settling][motion.step] : [COPY.scoop, COPY.hang, COPY.quiet, COPY.done][checkpoint], assertSafeCopy)
  }
  const restorePose = () => {
    scoop.position.copy(home()); scoop.rotation.set(checkpoint < 2 ? -0.18 : 0, 0, checkpoint < 2 ? -0.1 : 0)
    rice.visible = checkpoint >= 1
    source.position.set(0, checkpoint === 1 ? 0.9 : -0.02, checkpoint === 1 ? 0.07 : -0.09)
    source.scale.setScalar(checkpoint === 1 ? 0.55 : 1)
    world.updateMatrixWorld(true)
  }
  const finish = () => {
    if (!motion) return
    checkpoint = (motion.step + 1) as Checkpoint; motion = null; restorePose(); syncUI()
    ctx.onProgress?.(checkpoint)
    feedback.impact({ freqs: checkpoint === 1 ? [320, 480] : [350, 525], duration: 0.28, gain: 0.025 })
    if (checkpoint === 3 && !completed) {
      completed = true; overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const begin = () => {
    if (!active() || motion || checkpoint === 3) return
    motion = { step: checkpoint, time: 0, from: scoop.position.clone(), rotation: scoop.rotation.clone() }; dragging = false
    if (reduced()) finish(); else syncUI()
  }
  const pointer = createObjectPointer(hitLayer, {
    isActive: active,
    canStart(x, y) { return !motion && checkpoint < 3 && ray.hits(x, y, pickables) },
    onStart(x, y) {
      dragging = true; pointerStart.set(x, y); feedback.prepare()
      dragPlane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), scoop.position)
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) dragOffset.copy(scoop.position).sub(dragPoint)
    },
    onMove(x, y) {
      if (!dragging || checkpoint === 2) return
      if (ray.aim(x, y).ray.intersectPlane(dragPlane, dragPoint)) {
        scoop.position.copy(dragPoint).add(dragOffset)
        scoop.position.x = THREE.MathUtils.clamp(scoop.position.x, -1.1, 1.1)
        scoop.position.y = THREE.MathUtils.clamp(scoop.position.y, 0.52, 1.22)
        world.updateMatrixWorld(true)
      }
    },
    onRelease(x, y) {
      const quietTap = checkpoint !== 2 || Math.hypot(x - pointerStart.x, y - pointerStart.y) < 12
      const valid = dragging && active() && !motion && quietTap && ray.hits(x, y, checkpoint === 0 ? [grainTarget] : checkpoint === 1 ? [peg, pegCap] : pickables)
      dragging = false
      if (valid) begin(); else restorePose()
    },
    onCancel() { dragging = false; if (!motion) restorePose() },
  })
  const onAction = () => {
    if (!active() || motion || pointer.isBusy() || checkpoint === 3) return
    feedback.prepare(); begin()
  }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    camera.position.set(0, 2.15, 5.35 + portraitBoost(aspect, 4.8)); camera.lookAt(0, 1.25, 0)
    camera.updateMatrixWorld(true)
  }
  restorePose(); syncUI()
  return {
    start() {
      if (disposed || started) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3; restorePose(); syncUI(); resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      actionBtn.addEventListener('click', onAction)
    },
    update(dt) {
      if (disposed || !started) return
      if (!active()) { pointer.cancel(); styleRenderer.render(); return }
      const delta = Number.isFinite(dt) ? Math.max(0, dt) : 0
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / (motion.step === 0 ? 1.05 : motion.step === 1 ? 0.9 : 0.55))
        const t = motion.time, p = smooth(t)
        if (motion.step === 0) {
          if (t < 0.5) scoop.position.lerpVectors(motion.from, DIP, smooth(t * 2))
          else scoop.position.lerpVectors(DIP, LOADED, smooth((t - 0.5) * 2))
          const tilt = Math.sin(t * Math.PI)
          scoop.rotation.x = THREE.MathUtils.lerp(motion.rotation.x, -1.35, tilt)
          scoop.rotation.z = THREE.MathUtils.lerp(motion.rotation.z, Math.PI / 2, tilt)
          rice.visible = t >= 0.46
        } else if (motion.step === 1) {
          scoop.position.lerpVectors(motion.from, HUNG, p)
          scoop.rotation.x = motion.rotation.x * (1 - p); scoop.rotation.z = motion.rotation.z * (1 - p)
        } else scoop.rotation.z = Math.sin(t * Math.PI * 2) * 0.035 * (1 - p)
        world.updateMatrixWorld(true)
        if (t === 1) finish()
      }
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); actionBtn.removeEventListener('click', onAction)
      feedback.dispose(); styleRenderer.dispose(); disposeTree(scene); grains.dispose()
      Object.values(lights).forEach(light => light.dispose())
      renderer.dispose(); renderer.forceContextLoss(); scene.clear(); overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
