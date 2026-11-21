import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { addCraftTable } from '../cozy-furniture'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '节旗轻展',
  unfurl: '拖动布旗右上角的浅金布耳，扣到横杆右端，让布面展开。',
  place: '握住下方缠线的木杆，把旗子安放到右侧木座的圆孔里。',
  rest: '轻触木杆或布面，静看海浪与太阳的纹样。',
  opening: '布耳扣向横杆，折叠的布面缓缓展开……', placing: '木杆稳稳落入木座……',
  done: '愿每一次相聚，都有人细心准备。',
} as const
const HOME = new THREE.Vector3(-.78, .70, -.13), SEATED = new THREE.Vector3(.84, .82, .23)
const LEFT = -.52, TOP = 1.78, FULL_WIDTH = 1.14, FOLDED_WIDTH = .24
const SIM_NU = 13, SIM_NV = 11   // 143 cloth particles
const TASSEL_PARTICLES = 4        // 3 * 4 = 12 tassel particles (155 total)
type Checkpoint = 0 | 1 | 2 | 3
const ease = (t: number) => t * t * (3 - 2 * t)

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

function sampleClothGrid(
  pos: Float32Array,
  nu: number,
  nv: number,
  u: number,
  v: number,
  out: THREE.Vector3,
): THREE.Vector3 {
  const fu = THREE.MathUtils.clamp(u, 0, 1) * (nu - 1)
  const fv = THREE.MathUtils.clamp(v, 0, 1) * (nv - 1)
  const i1 = Math.min(nu - 2, Math.floor(fu))
  const j1 = Math.min(nv - 2, Math.floor(fv))
  const tu = fu - i1
  const tv = fv - j1
  const i0 = Math.max(0, i1 - 1), i2 = i1 + 1, i3 = Math.min(nu - 1, i1 + 2)
  const j0 = Math.max(0, j1 - 1), j2 = j1 + 1, j3 = Math.min(nv - 1, j1 + 2)

  const sampleAxis = (axis: 0 | 1 | 2) => {
    const row = (j: number) => catmullRom(
      pos[(i0 * nv + j) * 3 + axis]!,
      pos[(i1 * nv + j) * 3 + axis]!,
      pos[(i2 * nv + j) * 3 + axis]!,
      pos[(i3 * nv + j) * 3 + axis]!,
      tu,
    )
    return catmullRom(row(j0), row(j1), row(j2), row(j3), tv)
  }

  return out.set(sampleAxis(0), sampleAxis(1), sampleAxis(2))
}

/** An original miniature craft, not a replica of a parish banner or a religious act. */
export function createBretonBanner(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, inactiveRendered = false, checkpoint: Checkpoint = 0
  let dragging = false, maxTravel = 0, open = 0, lift = 0, flutter = 0, simClock = 0, stopResize = () => {}
  let transition: { step: 0 | 1; time: number; from: THREE.Vector3; open: number; lift: number } | null = null
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => !!ctx.isReducedMotion?.()
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '展开布旗' }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'breton-banner', label: COPY.title }); style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf1eee0, ground: 0x829b8f, key: 0xffe5b5, rim: 0xc5dfdd, keyPosition: [-3, 5, 4], keyIntensity: 1.2, rimIntensity: .45 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(512, 512)
  Object.assign(lights.key.shadow.camera, { left: -2.5, right: 2.5, top: 3.5, bottom: -1, near: .1, far: 12 })
  lights.key.shadow.bias = -.0006; lights.key.shadow.normalBias = .02
  const world = new THREE.Group(); world.name = 'banner-workshop'; scene.add(world)
  const mat = (color: number, roughness = .9) => new THREE.MeshStandardMaterial({ color, roughness, side: THREE.DoubleSide })
  const wood = mat(0xb48b60), endgrain = mat(0x8d6848), clothMat = mat(0x487f85), border = mat(0xe0c681), thread = mat(0xd5dabd), socketMat = mat(0x78674f)
  const add = (geo: THREE.BufferGeometry, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geo, material); mesh.position.set(...xyz); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (w: number, h: number, d: number, material: THREE.Material, xyz: [number, number, number], name = '', parent: THREE.Object3D = world) => add(new RoundedBoxGeometry(w, h, d, 3, Math.min(.03, h / 3, d / 3)), material, xyz, name, parent)
  addCraftTable(world, { name: 'banner-table', topName: 'banner-workbench', width: 3.1, depth: 1.6, surfaceY: .7, thickness: .12, center: [0, 0], support: 'joined', finish: 'honey' })
  const shadow = add(new THREE.PlaneGeometry(3.7, 2.4), new THREE.ShadowMaterial({ opacity: .12 }), [0, .004, 0]); shadow.rotation.x = -Math.PI / 2; shadow.castShadow = false
  add(new THREE.CylinderGeometry(.43, .46, .10, 36), wood, [.84, .75, .23], 'banner-stand-base')
  const socket = add(new THREE.CylinderGeometry(.17, .17, .012, 32), socketMat, [.84, .814, .23], 'banner-stand-socket')
  const collar = add(new THREE.TorusGeometry(.19, .020, 10, 36), endgrain, [.84, .842, .23], 'banner-stand-collar'); collar.rotation.x = Math.PI / 2
  // A small spool and folded offcut read as a workbench, without ceremonial props.
  add(new THREE.CylinderGeometry(.09, .09, .11, 20), thread, [-1.21, .755, .53], 'banner-thread-spool')
  for (const y of [.713, .817]) add(new THREE.CylinderGeometry(.115, .115, .015, 20), wood, [-1.21, y, .53])
  box(.40, .016, .26, clothMat, [-.67, .710, .53], 'banner-offcut')
  const assembly = new THREE.Group(); assembly.name = 'banner-assembly'; world.add(assembly)
  add(new THREE.CylinderGeometry(.043, .043, 1.89, 16), wood, [0, .945, 0], 'banner-staff', assembly)
  const crossbar = add(new THREE.CylinderGeometry(.038, .038, 1.39, 16), wood, [.045, 1.84, .06], 'banner-crossbar', assembly); crossbar.rotation.z = Math.PI / 2
  for (const x of [-.66, .75]) add(new THREE.SphereGeometry(.059, 16, 10), endgrain, [x, 1.84, .06], '', assembly)
  const clip = box(.16, .13, .10, border, [.64, TOP + .035, .11], 'banner-crossbar-clip', assembly)
  const grip = add(new THREE.CylinderGeometry(.078, .078, .30, 24), thread, [0, .43, .018], 'banner-staff-grip', assembly)
  for (let y = .30; y <= .57; y += .045) {
    const ring = add(new THREE.TorusGeometry(.079, .005, 6, 24), border, [0, y, .018], '', assembly); ring.rotation.x = Math.PI / 2
  }
  // Accordion folds carry the paint, seams and tassels with the actual cloth vertices.
  const cloth = new THREE.Group(); cloth.name = 'banner-cloth-assembly'; assembly.add(cloth)
  const patches: { mesh: THREE.Mesh; uv: Float32Array; depth: number }[] = []
  function patch(name: string, uvs: number[], indices: number[], material: THREE.Material, depth = 0) {
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(uvs.length / 2 * 3), 3)); geo.setIndex(indices)
    const mesh = add(geo, material, [0, 0, 0], name, cloth)
    patches.push({ mesh, uv: new Float32Array(uvs), depth }); return mesh
  }
  function strip(name: string, points: [number, number][], half: number, material: THREE.Material, depth = .004) {
    const uv: number[] = [], indices: number[] = []
    points.forEach(([u, v], i) => { uv.push(u, v - half, u, v + half); if (i) { const j = i * 2; indices.push(j - 2, j - 1, j, j - 1, j + 1, j) } })
    return patch(name, uv, indices, material, depth)
  }
  const uv: number[] = [], faces: number[] = [], cols = 40, rows = 20
  for (let y = 0; y <= rows; y++) for (let x = 0; x <= cols; x++) {
    uv.push(x / cols, y / rows)
    if (x < cols && y < rows) { const i = y * (cols + 1) + x; faces.push(i, i + cols + 1, i + 1, i + 1, i + cols + 1, i + cols + 2) }
  }
  const bannerMaterial = createRitualMaterial({ color: 0x487f85, roughness: .9, side: THREE.DoubleSide }, { kind: 'cloth', strength: .22, fiber: 'linen' })
  patch('banner-cloth', uv, faces, bannerMaterial)
  for (const v of [.025, .95]) strip('banner-woven-hem', Array.from({ length: 41 }, (_, i) => [i / 40, v]), .011, border)
  for (const u of [.025, .975]) {
    const edgeUV: number[] = [], edgeFaces: number[] = []
    for (let i = 0; i <= 20; i++) { edgeUV.push(u - .011, i / 20, u + .011, i / 20); if (i) { const j = i * 2; edgeFaces.push(j - 2, j - 1, j, j - 1, j + 1, j) } }
    patch('banner-side-hem', edgeUV, edgeFaces, border, .004)
  }
  const sunUV = [.50, .33], sunFaces: number[] = []
  for (let ring = 1; ring <= 8; ring++) for (let i = 0; i < 32; i++) {
    const a = i / 32 * Math.PI * 2, fraction = ring / 8
    sunUV.push(.50 + Math.cos(a) * .102 * fraction, .33 + Math.sin(a) * .108 * fraction)
    const here = 1 + (ring - 1) * 32 + i, next = 1 + (ring - 1) * 32 + (i + 1) % 32
    if (ring === 1) sunFaces.push(0, here, next)
    else sunFaces.push(here - 32, here, next, here - 32, next, next - 32)
  }
  patch('banner-original-sun', sunUV, sunFaces, border, .008)
  for (const v of [.62, .72]) strip('banner-original-wave', Array.from({ length: 35 }, (_, i) => { const u = .15 + i / 34 * .70; return [u, v + Math.sin((u - .15) / .70 * Math.PI * 2) * .027] }), .013, thread, .006)
  const tab = box(.16, .145, .075, border, [0, 0, 0], 'banner-hem-tab', cloth)
  const fixed = box(.046, .065, .025, thread, [LEFT, TOP, .1], 'banner-fixed-hem', cloth)
  box(.055, .075, .04, thread, [LEFT, TOP, .08], 'banner-crossbar-left-tie', assembly)
  const tassels = [0, .5, 1].map(u => {
    const group = new THREE.Group(); group.name = 'banner-tassel'; cloth.add(group)
    add(new THREE.SphereGeometry(.025, 10, 6), border, [0, -.025, 0], '', group)
    for (const x of [-.021, 0, .021]) add(new THREE.CylinderGeometry(.007, .011, .13, 6), thread, [x, -.10, 0], '', group)
    return { u, group }
  })

  // ---------------------------------------------------------------------------
  // Lazy-loaded Rapier cloth (13x11 = 143 particles, tensionOnly) + 3 tassel pendulums (12 particles)
  // in assembly-local space, with rigid staff/grip/crossbar colliders and D'Alembert carry inertia.
  // ---------------------------------------------------------------------------
  let bannerBody: ReturnType<RapierSoftBodySession['createCloth']> | null = null
  const tasselBodies: ReturnType<RapierSoftBodySession['createRope']>[] = []
  let rapierReady = false
  let physicsStepped = false
  const prevAssemblyPos = new THREE.Vector3().copy(HOME)
  const prevAssemblyVel = new THREE.Vector3()
  const inertialAccel = new THREE.Vector3()
  const simGridCopy = new Float32Array(SIM_NU * SIM_NV * 3)
  const tmpPt = new THREE.Vector3(), tmpDir = new THREE.Vector3()
  const downAxis = new THREE.Vector3(0, -1, 0)
  const tasselQuat = new THREE.Quaternion()

  const authoredSurface = (u: number, v: number, depth = 0) => new THREE.Vector3(
    LEFT + (FOLDED_WIDTH + (FULL_WIDTH - FOLDED_WIDTH) * open) * u,
    TOP - v * (1.04 + .055 * Math.cos(u * Math.PI * 2)) + lift * u,
    .10 + Math.sin(u * Math.PI * 12) * (.065 * (1 - open) + .012 * open) * Math.sin(v * Math.PI / 2) + depth + flutter * v * v,
  )

  function currentWidth() {
    return FOLDED_WIDTH + (FULL_WIDTH - FOLDED_WIDTH) * open
  }

  function resetBannerBodiesToCurrentPose() {
    if (!bannerBody || !bannerBody.isValid()) return
    const w = currentWidth()
    for (let i = 0; i < SIM_NU; i++) {
      const u = i / (SIM_NU - 1)
      const catDip = -0.028 * open * 4 * u * (1 - u)
      for (let j = 0; j < SIM_NV; j++) {
        const v = j / (SIM_NV - 1)
        const k = i * SIM_NV + j
        const foldZ = Math.sin(u * Math.PI * 6) * (0.048 * (1 - open) + 0.012 * open) * Math.sin(v * Math.PI * 0.65)
        bannerBody.setParticlePosition(k, {
          x: LEFT + w * u,
          y: TOP + lift * u + catDip - v * 1.04,
          z: 0.10 + foldZ + 0.03 * v * v,
        })
        bannerBody.setParticleVelocity(k, { x: 0, y: 0, z: 0 })
      }
    }
    for (let t = 0; t < tasselBodies.length; t++) {
      const body = tasselBodies[t]!
      if (!body.isValid()) continue
      const u = tassels[t]!.u
      const top = authoredSurface(u, 1, 0.01)
      for (let j = 0; j < TASSEL_PARTICLES; j++) {
        const f = j / (TASSEL_PARTICLES - 1)
        body.setParticlePosition(j, { x: top.x, y: top.y - f * 0.16, z: top.z })
        body.setParticleVelocity(j, { x: 0, y: 0, z: 0 })
      }
    }
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 6,
    internalPgsIterations: 3,
    sleepSpeedThreshold: 0,
    isActive: active,
    isReducedMotion: reduced,
    onReady(session) {
      if (disposed) return
      // Fixed rigid colliders in assembly-local space: staff, grip, and crossbar prevent cloth penetration.
      session.addFixedCylinder({ x: 0, y: 0.945, z: 0 }, 0.052, 1.92, { friction: 0.55, restitution: 0.02 })
      session.addFixedCylinder({ x: 0, y: 0.43, z: 0.018 }, 0.084, 0.32, { friction: 0.55, restitution: 0.02 })
      const rotZ90 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), Math.PI / 2)
      session.addFixedCylinder({ x: 0.045, y: 1.84, z: 0.06 }, 0.044, 1.42, {
        rotation: { x: rotZ90.x, y: rotZ90.y, z: rotZ90.z, w: rotZ90.w },
        friction: 0.65,
        restitution: 0.02,
      })

      // Pin ONLY the two top crossbar tie attachments: left tie (col=0,row=0) and right clip (col=12,row=0).
      bannerBody = session.createCloth({
        origin: { x: LEFT, y: TOP, z: 0.10 },
        du: { x: FULL_WIDTH / (SIM_NU - 1), y: 0, z: 0 },
        dv: { x: 0, y: -1.04 / (SIM_NV - 1), z: 0 },
        nu: SIM_NU,
        nv: SIM_NV,
        mass: 0.38,
        particleRadius: 0.016,
        gravityScale: 0.95,
        linearDamping: 2.25,
        edgeSoftness: { naturalFrequency: 26, dampingRatio: 0.82 },
        bendSoftness: { naturalFrequency: 3.0, dampingRatio: 0.76 },
        tensionOnly: true,
        pinnedParticles: [0, (SIM_NU - 1) * SIM_NV],
        friction: 0.55,
        restitution: 0.02,
        canSleep: false,
      })

      tasselBodies.length = 0
      for (let t = 0; t < tassels.length; t++) {
        const u = tassels[t]!.u
        const x = LEFT + FULL_WIDTH * u
        const body = session.createRope({
          start: { x, y: TOP - 1.09, z: 0.11 },
          end: { x, y: TOP - 1.25, z: 0.11 },
          numParticles: TASSEL_PARTICLES,
          pinnedParticles: [0],
          mass: 0.04,
          particleRadius: 0.01,
          linearDamping: 2.3,
          edgeSoftness: { naturalFrequency: 28, dampingRatio: 0.84 },
          bendSoftness: { naturalFrequency: 8, dampingRatio: 0.8 },
          noSurfaceCollider: true,
          canSleep: false,
        })
        tasselBodies.push(body)
      }

      rapierReady = true
      prevAssemblyPos.copy(assembly.position)
      prevAssemblyVel.set(0, 0, 0)
      inertialAccel.set(0, 0, 0)
      resetBannerBodiesToCurrentPose()
      host.settle(54, applyBannerForces)
      physicsStepped = true
      writeBannerFromRapier()
    },
  })

  function prepareSimGridForSampling() {
    if (!bannerBody || !bannerBody.isValid()) return false
    const pos = bannerBody.particlePositions()
    simGridCopy.set(pos)
    const w = currentWidth()
    // Preserve monotonic X progression across gathered folds so sun paint raycasts never self-occlude,
    // while keeping full soft Rapier gravity drape, top-edge catenary dip, and wind billow!
    for (let j = 0; j < SIM_NV; j++) {
      const v = j / (SIM_NV - 1)
      const scaleH = 1.04
      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        const k = (i * SIM_NV + j) * 3
        let x = simGridCopy[k]!
        let y = simGridCopy[k + 1]!
        let z = simGridCopy[k + 2]!

        // Keep gathered cloth cleanly monotonic in X while unfurled cloth uses pure Rapier X.
        const gatheredX = LEFT + w * u + (x - (LEFT + w * u)) * 0.25
        x = THREE.MathUtils.lerp(gatheredX, x, THREE.MathUtils.smoothstep(open, 0.25, 0.85))
        if (i > 0) {
          const prevX = simGridCopy[((i - 1) * SIM_NV + j) * 3]!
          const minStep = (w / (SIM_NU - 1)) * (0.28 + 0.14 * (1 - open))
          if (x < prevX + minStep) x = prevX + minStep
        }

        // Preserve original ceremonial banner scalloped bottom contour (0.055 * cos(2πu)) seamlessly.
        const scallopDrop = 0.055 * Math.cos(u * Math.PI * 2) * v
        y -= scallopDrop
        // Keep well clear of the wooden staff cylinder behind the cloth (z >= 0.068).
        z = THREE.MathUtils.clamp(z, 0.068, 0.42)
        // Pin exact endpoints for fixed hem & movable tab.
        if (j === 0 && i === 0) { x = LEFT; y = TOP; z = 0.10 }
        else if (j === 0 && i === SIM_NU - 1) { x = LEFT + w; y = TOP + lift; z = 0.10 }

        simGridCopy[k] = x
        simGridCopy[k + 1] = y
        simGridCopy[k + 2] = z
        void scaleH
      }
    }
    return true
  }

  function applyBannerForces(_session: RapierSoftBodySession, subDt: number) {
    simClock += subDt
    const t = simClock
    const w = currentWidth()

    if (bannerBody && bannerBody.isValid()) {
      bannerBody.resetForces(false)
      // Update the two pinned crossbar tie corners kinematically.
      bannerBody.setParticleKinematicTarget(0, { x: LEFT, y: TOP, z: 0.10 })
      bannerBody.setParticleKinematicTarget((SIM_NU - 1) * SIM_NV, { x: LEFT + w, y: TOP + lift, z: 0.10 })

      const pos = bannerBody.particlePositions()
      const vel = bannerBody.particleVelocities()
      const pMass = Math.max(bannerBody.mass() / (SIM_NU * SIM_NV), 1e-4)
      const gathered = 1 - open

      for (let i = 0; i < SIM_NU; i++) {
        const u = i / (SIM_NU - 1)
        for (let j = 0; j < SIM_NV; j++) {
          if (j === 0 && (i === 0 || i === SIM_NU - 1)) continue
          const v = j / (SIM_NV - 1)
          const k = i * SIM_NV + j
          const px = pos[k * 3]!, py = pos[k * 3 + 1]!, pz = pos[k * 3 + 2]!
          const vx = vel[k * 3]!, vy = vel[k * 3 + 1]!, vz = vel[k * 3 + 2]!

          let fx = inertialAccel.x
          let fy = inertialAccel.y
          let fz = inertialAccel.z

          if (j === 0) {
            // Unpinned interior top-seam particles hang freely between the two crossbar ties!
            // Give just enough soft crossbar proximity so the top hem forms a gentle, natural
            // catenary dip (~3-4cm) when unfurled and slides smoothly along the bar when gathered.
            const targetX = LEFT + w * u
            const targetY = TOP + lift * u
            const targetZ = 0.10 + gathered * 0.035 * Math.sin(u * Math.PI * 5)
            const kTopX = THREE.MathUtils.lerp(52, 8, open)
            const kTopY = THREE.MathUtils.lerp(95, 34, open)
            const kTopZ = 48
            fx += kTopX * (targetX - px) - 6.5 * vx
            fy += 9.81 * 0.58 + kTopY * (targetY - py) - 6.5 * vy
            fz += kTopZ * (targetZ - pz) - 6.5 * vz
          } else {
            const vRamp = THREE.MathUtils.smoothstep(v, 0.05, 0.90)
            // Warm seaside breeze billowing the linen gently forward (+Z) and slightly sideways (+X)
            // with traveling diagonal folds; quiet-ending flutter swells the breeze softly.
            const gustPhase = t * 2.1 - u * 3.2 - v * 3.4
            const gustHarmonic = t * 3.55 - u * 4.8 - v * 5.2
            const breezeScale = 0.52 + 0.48 * open
            const endingBoost = flutter * 65

            const windZ = (2.85 + 2.35 * Math.sin(gustPhase) + 0.95 * Math.sin(gustHarmonic) + endingBoost) * breezeScale * vRamp
            const windX = (0.95 + 1.25 * Math.cos(gustPhase * 0.85 + 0.5)) * breezeScale * vRamp

            // When gathered (open -> 0), guide into soft hanging vertical pleats without waist pinching.
            const pleatZ = gathered * (0.10 + 0.068 * Math.sin(u * Math.PI * 5) * Math.sin(v * Math.PI * 0.72))
            const gatherSpread = w * (1 + 0.16 * v)
            const gatherX = LEFT + gatherSpread * u - (gatherSpread - w) * 0.5
            fx += windX + gathered * 38 * (gatherX - px) - 1.7 * vx
            fy += -1.3 * vy
            fz += windZ + gathered * 26 * (pleatZ - pz) - 1.8 * vz
          }

          bannerBody.addParticleForce(k, { x: pMass * fx, y: pMass * fy, z: pMass * fz }, false)
        }
      }
    }

    // Couple the 3 bottom tassel pendulums to the live Rapier cloth bottom hem.
    if (prepareSimGridForSampling()) {
      for (let ti = 0; ti < tasselBodies.length; ti++) {
        const body = tasselBodies[ti]!
        if (!body.isValid()) continue
        body.resetForces(false)
        const u = tassels[ti]!.u
        sampleClothGrid(simGridCopy, SIM_NU, SIM_NV, u, 1, tmpPt)
        body.setParticleKinematicTarget(0, { x: tmpPt.x, y: tmpPt.y, z: tmpPt.z + 0.01 })
        const m = Math.max(body.mass() / TASSEL_PARTICLES, 1e-4)
        for (let j = 1; j < TASSEL_PARTICLES; j++) {
          const s = j / (TASSEL_PARTICLES - 1)
          const breezeX = (1.1 + 1.4 * Math.sin(t * 2.2 - ti * 1.1)) * s
          const breezeZ = (2.4 + 2.0 * Math.cos(t * 2.0 - ti * 0.9)) * s
          body.addParticleForce(j, {
            x: m * (breezeX + inertialAccel.x),
            y: m * inertialAccel.y,
            z: m * (breezeZ + inertialAccel.z),
          }, false)
        }
      }
    }
  }

  function writeBannerFromRapier() {
    if (!prepareSimGridForSampling()) return
    for (const { mesh, uv: coordinates, depth } of patches) {
      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) {
        sampleClothGrid(simGridCopy, SIM_NU, SIM_NV, coordinates[i * 2]!, coordinates[i * 2 + 1]!, tmpPt)
        // Offset decorative patches strictly along +Z so sun/hem/wave always sit cleanly in front of cloth.
        p.setXYZ(i, tmpPt.x, tmpPt.y, tmpPt.z + depth)
      }
      p.needsUpdate = true
      mesh.geometry.computeVertexNormals()
      mesh.geometry.computeBoundingSphere()
      mesh.geometry.computeBoundingBox()
    }
    sampleClothGrid(simGridCopy, SIM_NU, SIM_NV, 1, 0, tmpPt)
    tab.position.set(tmpPt.x, tmpPt.y, tmpPt.z + 0.05)
    sampleClothGrid(simGridCopy, SIM_NU, SIM_NV, 0, 0, tmpPt)
    fixed.position.set(tmpPt.x, tmpPt.y, tmpPt.z + 0.006)

    for (let ti = 0; ti < tassels.length; ti++) {
      const { u, group } = tassels[ti]!
      sampleClothGrid(simGridCopy, SIM_NU, SIM_NV, u, 1, tmpPt)
      group.position.set(tmpPt.x, tmpPt.y, tmpPt.z + 0.01)
      const body = tasselBodies[ti]
      if (body && body.isValid()) {
        const p0 = body.particlePosition(0)
        const pEnd = body.particlePosition(TASSEL_PARTICLES - 1)
        tmpDir.set(pEnd.x - p0.x, pEnd.y - p0.y, pEnd.z - p0.z)
        if (tmpDir.lengthSq() > 1e-6) {
          tmpDir.normalize()
          tasselQuat.setFromUnitVectors(downAxis, tmpDir)
          group.quaternion.copy(tasselQuat)
        }
      } else {
        group.quaternion.identity()
      }
    }
  }

  const deform = (value: number, rise = 0) => {
    open = THREE.MathUtils.clamp(value, 0, 1); lift = rise
    if (rapierReady && physicsStepped && !reduced() && !dragging) {
      writeBannerFromRapier()
      return
    }
    for (const { mesh, uv: coordinates, depth } of patches) {
      const p = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < p.count; i++) { const vertex = authoredSurface(coordinates[i * 2]!, coordinates[i * 2 + 1]!, depth); p.setXYZ(i, vertex.x, vertex.y, vertex.z) }
      p.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingSphere(); mesh.geometry.computeBoundingBox()
    }
    tab.position.copy(authoredSurface(1, 0, .05)); fixed.position.copy(authoredSurface(0, 0, .006))
    for (const { u, group } of tassels) { group.position.copy(authoredSurface(u, 1, .01)); group.quaternion.identity() }
  }
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const restore = (reseedPhysics = true) => {
    flutter = 0
    assembly.position.copy(checkpoint >= 2 ? SEATED : HOME)
    prevAssemblyPos.copy(assembly.position)
    prevAssemblyVel.set(0, 0, 0)
    inertialAccel.set(0, 0, 0)
    open = checkpoint >= 1 ? 1 : 0
    lift = 0
    if (reseedPhysics && rapierReady && !reduced()) {
      resetBannerBodiesToCurrentPose()
      host.settle(24, applyBannerForces)
      writeBannerFromRapier()
    } else {
      deform(open, 0)
    }
    matrices()
  }
  const enabled = (at: number) => () => active() && !transition && checkpoint === at
  addInteractionCue(tab, { kind: 'drag', label: '展开布旗', priority: 3, enabled: enabled(0), destination: clip, targetLabel: '横杆右端夹头' })
  addInteractionCue(grip, { kind: 'drag', label: '握住木杆', priority: 3, enabled: enabled(1), destination: socket, targetLabel: '木座圆孔' })
  addInteractionCue(grip, { kind: 'tap', label: '轻触静看', priority: 3, enabled: enabled(2) })
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2(), plane = new THREE.Plane(), point = new THREE.Vector3(), offset = new THREE.Vector3()
  const firstVisible = (x: number, y: number, held?: THREE.Object3D) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      if (!(object as THREE.Mesh).isMesh) return
      for (let parent: THREE.Object3D | null = object; parent; parent = parent.parent) if (parent === held) return
      meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]?.object
  }
  const tappable = (hit: THREE.Object3D | undefined) => {
    if (!hit) return false
    if (hit === grip || hit.name === 'banner-staff') return true
    for (let parent: THREE.Object3D | null = hit; parent; parent = parent.parent) if (parent === cloth) return true
    return false
  }
  const reset = () => { dragging = false; maxTravel = 0; if (!transition) restore(false) }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { if (transition || checkpoint === 3) return false; matrices(); const hit = firstVisible(x, y); return checkpoint === 2 ? tappable(hit) : hit === (checkpoint === 0 ? tab : grip) },
    onStart(x, y) {
      down.set(x, y); maxTravel = 0; dragging = checkpoint < 2; feedback.prepare()
      const origin = checkpoint === 0 ? tab.getWorldPosition(new THREE.Vector3()) : assembly.position
      plane.setFromNormalAndCoplanarPoint(checkpoint === 0 ? new THREE.Vector3(0, 0, 1) : camera.getWorldDirection(new THREE.Vector3()), checkpoint === 0 ? origin : grip.getWorldPosition(new THREE.Vector3()))
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) offset.copy(origin).sub(point)
    },
    onMove(x, y) {
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        point.add(offset)
        if (checkpoint === 0) { assembly.worldToLocal(point); deform((point.x - LEFT - FOLDED_WIDTH) / (FULL_WIDTH - FOLDED_WIDTH), THREE.MathUtils.clamp(point.y - TOP, -.28, .28)) }
        else assembly.position.copy(point)
      }
      matrices()
      if (checkpoint < 2 && placementHit(canvas, camera, checkpoint === 0 ? tab : grip, x, y, (px, py) => firstVisible(px, py, checkpoint === 0 ? cloth : assembly) === (checkpoint === 0 ? clip : socket)) && pointer.finish()) { dragging = false; advance(true) }
    },
    onRelease(x, y) {
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) {
        point.add(offset)
        if (checkpoint === 0) { assembly.worldToLocal(point); deform((point.x - LEFT - FOLDED_WIDTH) / (FULL_WIDTH - FOLDED_WIDTH), THREE.MathUtils.clamp(point.y - TOP, -.28, .28)) }
        else assembly.position.copy(point)
      }
      maxTravel = Math.max(maxTravel, Math.hypot(x - down.x, y - down.y)); matrices()
      const valid = checkpoint < 2 ? dragging && placementHit(canvas, camera, checkpoint === 0 ? tab : grip, x, y, (px, py) => firstVisible(px, py, checkpoint === 0 ? cloth : assembly) === (checkpoint === 0 ? clip : socket)) : maxTravel < 12 && tappable(firstVisible(x, y))
      dragging = false; if (valid) advance(); else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: () => active(), duration: 3, motion: 'glow',
    // The top seam has two fixed attachments: bend the free cloth, never rotate its ties.
    onFrame(progress, _elapsed, isReduced) {
      flutter = isReduced ? 0 : Math.sin(progress * Math.PI * 4) * Math.sin(progress * Math.PI) * .055
      deform(open, lift)
    },
    targets: () => [cloth], cancelInput: () => pointer.cancel(), complete: () => advance(),
  })
  const sync = () => {
    ui.renderDots(checkpoint, 3); ui.actionBtn.hidden = checkpoint === 3; ui.actionBtn.disabled = !active() || !!transition || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = checkpoint < 3 && !transition ? 'auto' : 'none'
    setSafeText(ui.actionBtn, checkpoint === 0 ? '展开布旗' : checkpoint === 1 ? '安放木杆' : '轻触静看', safe)
    setSafeText(ui.hintEl, transition ? transition.step === 0 ? COPY.opening : COPY.placing : checkpoint === 0 ? COPY.unfurl : checkpoint === 1 ? COPY.place : checkpoint === 2 ? COPY.rest : COPY.done, safe)
    ending.sync(checkpoint === 2 && !transition)
  }
  function settle() {
    if (!active() || !transition) return
    checkpoint = (transition.step + 1) as Checkpoint; transition = null
    // Preserve live Rapier swinging momentum after unfurling or placing on stand.
    restore(reduced()); sync(); ctx.onProgress?.(checkpoint); feedback.impact({ freqs: [349.23, 523.25], duration: .16, gain: .009 })
  }
  function advance(placed = false) {
    if (checkpoint === 2 && !ending.completing) return
    if (!active() || (pointer.isBusy() && !placed) || transition || checkpoint === 3) return
    if (checkpoint === 2) { checkpoint = 3; restore(false); sync(); ctx.onProgress?.(3); if (!active()) return; feedback.impact({ freqs: [349.23, 523.25], duration: .20, gain: .009 }); if (active()) overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true })); return }
    transition = { step: checkpoint, time: 0, from: assembly.position.clone(), open, lift }; sync(); if (reduced()) settle()
  }
  const action = () => { if (!active() || pointer.isBusy() || transition || checkpoint === 3) return; feedback.prepare(); advance() }
  const blur = () => { focused = false; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => { const aspect = sizeStage(canvas, renderer, style, camera), boost = portraitBoost(aspect, 7); camera.position.set(0, 3.5 + boost * .4, 5.9 + boost); camera.lookAt(0, 1.3, 0); matrices() }
  restore(false); sync()
  return {
    start() {
      if (started || disposed) return; started = true
      const initial = ctx.initialProgress ?? 0; checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(false); resize()
      if (!reduced()) void host.start()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { pointer.cancel(); ui.actionBtn.disabled = true; ui.actionBtn.setAttribute('aria-disabled', 'true'); if (!inactiveRendered) { style.render(); inactiveRendered = true } return }
      if (inactiveRendered) { inactiveRendered = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      if (transition) {
        transition.time = reduced() ? 1 : Math.min(1, transition.time + delta / .8); const t = ease(transition.time)
        if (transition.step === 0) { open = THREE.MathUtils.lerp(transition.open, 1, t); lift = transition.lift * (1 - t); if (!rapierReady || reduced()) deform(open, lift) }
        else { assembly.position.lerpVectors(transition.from, SEATED, t); if (!reduced()) assembly.position.y += Math.sin(t * Math.PI) * .24 }
        if (transition.time === 1) settle()
      }
      if (!active()) return
      ending.update(dt)
      if (!active()) return
      if (!reduced() && !dragging && rapierReady && bannerBody && delta > 0) {
        // Compute D'Alembert inertial acceleration from staff carry motion.
        const vx = (assembly.position.x - prevAssemblyPos.x) / delta
        const vy = (assembly.position.y - prevAssemblyPos.y) / delta
        const vz = (assembly.position.z - prevAssemblyPos.z) / delta
        const ax = THREE.MathUtils.clamp((vx - prevAssemblyVel.x) / delta, -12, 12)
        const ay = THREE.MathUtils.clamp((vy - prevAssemblyVel.y) / delta, -12, 12)
        const az = THREE.MathUtils.clamp((vz - prevAssemblyVel.z) / delta, -12, 12)
        inertialAccel.set(-ax * 0.45, -ay * 0.45, -az * 0.45)
        prevAssemblyPos.copy(assembly.position)
        prevAssemblyVel.set(vx, vy, vz)

        const stepped = host.step(delta, applyBannerForces)
        if (stepped || physicsStepped) {
          physicsStepped = true
          writeBannerFromRapier()
        }
      }
      scene.updateMatrixWorld(true); camera.updateMatrixWorld(true); style.render()
    },
    dispose() {
      if (disposed) return; ending.dispose(); disposed = true
      bannerBody = null; tasselBodies.length = 0; rapierReady = false; physicsStepped = false
      host.dispose()
      pointer.dispose(); stopResize(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action); window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(world); Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
