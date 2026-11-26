import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { createCraftMaterial } from '@wbr/scene-runtime/craft-surfaces'
import {
  createRapierSoftBodyHost,
  type RapierSoftBodySession,
} from '@wbr/scene-runtime/rapier-soft-body'
import { addInteractionCue } from '../scene-localization'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'
import { createWoodGrainTexture, projectWoodUVs, type WoodGrainOptions } from './wood-grain'

const COPY = {
  title: '庭前一铃', steps: '步骤', pull: '向下轻拉铃绳', settle: '轻收铃绳', greet: '轻点铃身问安',
  ready: '按住粗铃绳，向下轻拉，再松手，听一声铃响。',
  ringing: '一声暖铃，余音慢慢落下…',
  held: '轻点铃绳，让它缓缓回到安静的位置。',
  settling: '铃绳缓缓回到原处…',
  quiet: '铃已安静。轻点金色铃身，留一句无声的问安。',
  greeting: '停一停，把问安留在这一刻…',
  done: '一声铃响，一份问安。',
  pullCue: '向下轻拉铃绳', target: '往下轻拉', settleCue: '轻点铃绳收好', greetCue: '轻点铃身问安',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type Motion = { kind: 'ring' | 'settle' | 'greet'; time: number; from: number; sway: number }
const smooth = (t: number) => {
  const c = THREE.MathUtils.clamp(t, 0, 1)
  return c * c * (3 - 2 * c)
}
/** The bell, braid and tassel hang a little larger so the bell reads and the rope is easy to hold on a phone. */
const HANGING_SCALE = 1.12
/** Warm base glow keeps the toon-lit metal golden on small screens; a ring adds a brief swell. */
const BELL_GLOW = 0.2

// Thick 3-strand braided shrine cotton rope geometry & Rapier particle layout (hanging-local coordinates).
const BRAID_TOP_Y = -0.265
const BRAID_LEN = 0.79
const BRAID_END_Y = BRAID_TOP_Y - BRAID_LEN // -1.055 (seats cleanly into neck collar at -1.065)
const NECK_OFFSET_Y = -0.01 // neck collar center relative to braid end
const GRIP_LOCAL_Y = -0.15 // wooden grip center relative to braid end (-1.205 at rest)
const COLLAR_LOCAL_Y = -0.32 // bottom cream collar relative to braid end (-1.375 at rest)
const BRAID_SEGS = 100
const BRAID_RADIAL = 8
const BRAID_TUBE_R = 0.047
const BRAID_HELIX_R = 0.058
const BRAID_TURNS = 5
const TASSEL_COUNT = 28
const TASSEL_SEGS = 12
const TASSEL_RADIAL = 7
const SIM_BRAID_COUNT = 11 // particles 0..10 along braid (0 pinned at bell bottom, 10 at neck/grip top)
const SIM_GRIP_MID = 11    // wooden grip center
const SIM_COLLAR = 12      // bottom collar / tassel root
const SIM_TASSEL_END = 15  // particles 13, 14, 15 = heavy hanging tassel spine
const SIM_TOTAL = 16

function catmullRom(p0: number, p1: number, p2: number, p3: number, t: number): number {
  const t2 = t * t, t3 = t2 * t
  return 0.5 * (
    (2 * p1) +
    (-p0 + p2) * t +
    (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
    (-p0 + 3 * p1 - 3 * p2 + p3) * t3
  )
}

/** Pre-allocated open tube mesh updated in-place via rotation-minimizing parallel-transport frames. */
function createDynamicOpenTube(
  segments: number,
  radial: number,
  material: THREE.Material,
  closedEnds = false,
) {
  const ringVerts = radial + 1
  const bodyVerts = (segments + 1) * ringVerts
  const vertCount = closedEnds ? bodyVerts + 2 : bodyVerts
  const positions = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    for (let j = 0; j <= radial; j++) {
      const k = i * ringVerts + j
      uvs[k * 2] = i / segments
      uvs[k * 2 + 1] = j / radial
      if (i < segments && j < radial) {
        const a = i * ringVerts + j
        const b = a + 1
        const c = (i + 1) * ringVerts + j
        const d = c + 1
        // Outward winding for right-handed (tan, norm, binorm) frame: (b - a) x (c - a) points +radial.
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const startCap = bodyVerts
  const endCap = bodyVerts + 1
  if (closedEnds) {
    const endBase = segments * ringVerts
    for (let j = 0; j < radial; j++) {
      indices.push(startCap, j + 1, j)
      indices.push(endCap, endBase + j, endBase + j + 1)
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  const cosT = new Float32Array(ringVerts)
  const sinT = new Float32Array(ringVerts)
  for (let j = 0; j <= radial; j++) {
    const a = (j / radial) * Math.PI * 2
    cosT[j] = Math.cos(a)
    sinT[j] = Math.sin(a)
  }

  const tan = new THREE.Vector3()
  const prevTan = new THREE.Vector3()
  const norm = new THREE.Vector3()
  const binorm = new THREE.Vector3()
  const rotAxis = new THREE.Vector3()
  const rotQuat = new THREE.Quaternion()
  const refX = new THREE.Vector3(1, 0, 0)
  const refZ = new THREE.Vector3(0, 0, 1)

  function update(pts: readonly THREE.Vector3[], radiusFn: (u: number) => number) {
    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    const nPts = pts.length
    for (let i = 0; i < nPts; i++) {
      const prev = pts[Math.max(0, i - 1)]!
      const next = pts[Math.min(nPts - 1, i + 1)]!
      tan.subVectors(next, prev)
      if (tan.lengthSq() < 1e-12) tan.set(0, -1, 0)
      else tan.normalize()

      if (i === 0) {
        const ref = Math.abs(tan.dot(refX)) < 0.85 ? refX : refZ
        norm.crossVectors(tan, ref).normalize()
        binorm.crossVectors(tan, norm).normalize()
        prevTan.copy(tan)
      } else {
        rotAxis.crossVectors(prevTan, tan)
        const sinA = rotAxis.length()
        if (sinA > 1e-6) {
          rotAxis.divideScalar(sinA)
          const cosA = THREE.MathUtils.clamp(prevTan.dot(tan), -1, 1)
          rotQuat.setFromAxisAngle(rotAxis, Math.atan2(sinA, cosA))
          norm.applyQuaternion(rotQuat)
        }
        norm.addScaledVector(tan, -norm.dot(tan)).normalize()
        binorm.crossVectors(tan, norm).normalize()
        prevTan.copy(tan)
      }

      const c = pts[i]!
      const r = radiusFn(i / (nPts - 1))
      const row = i * ringVerts
      for (let j = 0; j <= radial; j++) {
        const ca = cosT[j]!, sa = sinT[j]!
        posAttr.setXYZ(
          row + j,
          c.x + r * (norm.x * ca + binorm.x * sa),
          c.y + r * (norm.y * ca + binorm.y * sa),
          c.z + r * (norm.z * ca + binorm.z * sa),
        )
      }
    }
    if (closedEnds) {
      const p0 = pts[0]!, pEnd = pts[nPts - 1]!
      posAttr.setXYZ(startCap, p0.x, p0.y, p0.z)
      posAttr.setXYZ(endCap, pEnd.x, pEnd.y, pEnd.z)
    }
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    // Weld seam normals across j=0 and j=radial so each cotton braid/tassel strand shades seamlessly.
    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
    for (let i = 0; i < nPts; i++) {
      const a = i * ringVerts
      const b = a + radial
      const nx = normAttr.getX(a) + normAttr.getX(b)
      const ny = normAttr.getY(a) + normAttr.getY(b)
      const nz = normAttr.getZ(a) + normAttr.getZ(b)
      const len = Math.hypot(nx, ny, nz) || 1
      normAttr.setXYZ(a, nx / len, ny / len, nz / len)
      normAttr.setXYZ(b, nx / len, ny / len, nz / len)
    }
    normAttr.needsUpdate = true
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }

  const mesh = new THREE.Mesh(geometry, material)
  return { mesh, update }
}

/** A shrine's round suzu and thick bell rope; one ring, a gentle return, then a quiet greeting. */
export function createShrineSuzuBell(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, completed = false
  let checkpoint: Checkpoint = 0, motion: Motion | null = null
  let wasActive = false, wasReduced = false
  let downX = 0, downY = 0, pullAmount = 0, pullSide = 0
  let stopResize = () => {}
  const active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.pull }, safe)
  const { scene, renderer } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const look = new THREE.Vector3(0, 1.48, 0)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'shrine-suzu-bell', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, {
    sky: 0xfff4e5, ground: 0xc4b698, key: 0xffe9ca, rim: 0xd5e7cf,
    keyIntensity: 1.1, keyPosition: [-2.7, 4.4, 3.5], rimIntensity: 0.4,
  })
  const world = new THREE.Group(); world.name = 'suzu-timber-and-bell'; scene.add(world)
  const mat = (color: number, roughness = 0.91) => new THREE.MeshStandardMaterial({ color, roughness })
  const woodTextures: THREE.DataTexture[] = []
  const woodMat = (
    color: number,
    roughness: number,
    axis: 'x' | 'y' | 'z',
    scale: number,
    strength: number,
    grainOpts: WoodGrainOptions,
    offsetU = 0,
    offsetV = 0,
  ) => {
    const map = createWoodGrainTexture(grainOpts, offsetU, offsetV)
    woodTextures.push(map)
    return createCraftMaterial({ color, roughness, map }, { kind: 'wood', axis, strength, scale })
  }
  const wood = woodMat(0xc49460, 0.75, 'x', 0.62, 0.2, {
    seed: 17, rings: 5.8, drift: 0.09, arch: 0.072, contrast: 0.175, wash: 0.05,
    knots: [
      { u: 0.29, v: 0.52, rx: 0.052, ry: 0.032, pull: 0.78, depth: 0.88 },
      { u: 0.74, v: 0.45, rx: 0.048, ry: 0.03, pull: 0.74, depth: 0.84 },
    ],
  })
  const postWoodLeft = woodMat(0xc1905c, 0.75, 'y', 0.66, 0.2, {
    seed: 29, rings: 5.6, drift: 0.092, arch: 0.068, contrast: 0.175, wash: 0.05,
    knots: [{ u: 0.38, v: 0.52, rx: 0.054, ry: 0.034, pull: 0.78, depth: 0.88 }],
  })
  const postWoodRight = woodMat(0xb48453, 0.78, 'y', 0.8, 0.22, {
    seed: 41, rings: 6.5, drift: 0.086, arch: 0.064, contrast: 0.17, wash: 0.048,
    knots: [{ u: 0.66, v: 0.46, rx: 0.052, ry: 0.032, pull: 0.76, depth: 0.85 }],
  })
  const gripWood = woodMat(0xc59562, 0.66, 'y', 0.84, 0.18, {
    seed: 53, rings: 5.2, drift: 0.085, arch: 0.062, contrast: 0.155, wash: 0.044,
    knots: [{ u: 0.37, v: 0.61, rx: 0.072, ry: 0.042, pull: 0.74, depth: 0.8 }],
  })
  const eaveWood = woodMat(0x9a7149, 0.81, 'x', 0.78, 0.22, {
    seed: 67, rings: 6.4, drift: 0.082, arch: 0.056, contrast: 0.165, wash: 0.044,
    knots: [{ u: 0.63, v: 0.5, rx: 0.05, ry: 0.03, pull: 0.72, depth: 0.8 }],
  })
  const baseWoodLeft = woodMat(0xa27950, 0.8, 'x', 0.7, 0.2, {
    seed: 73, rings: 6.0, drift: 0.084, arch: 0.055, contrast: 0.165, wash: 0.044,
    knots: [{ u: 0.36, v: 0.48, rx: 0.066, ry: 0.038, pull: 0.74, depth: 0.82 }],
  })
  const baseWoodRight = woodMat(0x946d47, 0.82, 'x', 0.84, 0.22, {
    seed: 83, rings: 6.8, drift: 0.078, arch: 0.05, contrast: 0.16, wash: 0.042,
  }, 0.26, 0.38)
  const capitalWoodLeft = woodMat(0xa87e54, 0.79, 'x', 0.74, 0.2, {
    seed: 97, rings: 5.8, drift: 0.08, arch: 0.054, contrast: 0.16, wash: 0.044,
  }, 0.12, 0.24)
  const capitalWoodRight = woodMat(0x9a724b, 0.81, 'x', 0.86, 0.22, {
    seed: 109, rings: 6.6, drift: 0.076, arch: 0.05, contrast: 0.16, wash: 0.042,
    knots: [{ u: 0.58, v: 0.52, rx: 0.068, ry: 0.04, pull: 0.72, depth: 0.78 }],
  }, 0.34, 0.52)
  const woodGrain = mat(0xb88a5a, 0.86)
  const cream = createCraftMaterial({ color: 0xe8deba }, { kind: 'cord' })
  const rust = createCraftMaterial({ color: 0xb16f53 }, { kind: 'cord' }), green = createCraftMaterial({ color: 0x819a76 }, { kind: 'cord' })
  const gold = createCraftMaterial({ color: 0xe6bc5c, roughness: .34, metalness: .55, emissive: 0x6a4410, emissiveIntensity: BELL_GLOW }, { kind: 'metal' })
  const goldLight = createCraftMaterial({ color: 0xf2d590, roughness: .32, metalness: .45, emissive: 0x6a4410, emissiveIntensity: BELL_GLOW }, { kind: 'metal' })
  const darkGold = createCraftMaterial({ color: 0x75583d, roughness: .68 }, { kind: 'metal', strength: .4 })
  const add = (geometry: THREE.BufferGeometry, material: THREE.Material, xyz: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...xyz); parent.add(mesh); return mesh
  }
  const detail = (mesh: THREE.Mesh) => { mesh.userData.toonSurface = { outline: false }; return mesh }
  const timber = new THREE.Group(); timber.name = 'suzu-original-timber-lintel'; world.add(timber)
  for (const x of [-1.02, 1.02]) {
    const isLeft = x < 0
    const postGeo = projectWoodUVs(new RoundedBoxGeometry(0.18, 2.6, 0.25, 3, 0.035), 'y', isLeft ? 0.38 : 0.42, isLeft ? 1.6 : 1.75, 0.5, 0.5)
    add(postGeo, isLeft ? postWoodLeft : postWoodRight, [x, 1.3, -0.21], timber).name = 'suzu-column-post'
    const baseGeo = projectWoodUVs(new RoundedBoxGeometry(0.31, 0.13, 0.4, 3, 0.04), 'x', isLeft ? 1.55 : 1.7, isLeft ? 1.8 : 2.0, isLeft ? 0.5 : 0.24, 0.5)
    add(baseGeo, isLeft ? baseWoodLeft : baseWoodRight, [x, 0.065, -0.2], timber).name = 'suzu-column-base'
    const capGeo = projectWoodUVs(new RoundedBoxGeometry(0.23, 0.19, 0.31, 3, 0.035), 'x', isLeft ? 1.7 : 1.85, isLeft ? 1.8 : 1.95, isLeft ? 0.46 : 0.62, 0.5)
    add(capGeo, isLeft ? capitalWoodLeft : capitalWoodRight, [x, 2.49, -0.2], timber).name = 'suzu-column-capital'
  }
  add(projectWoodUVs(new RoundedBoxGeometry(2.48, 0.23, 0.36, 4, 0.048), 'x', 0.4, 1.45, 0.5, 0.5), wood, [0, 2.66, -0.16], timber).name = 'suzu-lintel'
  add(projectWoodUVs(new RoundedBoxGeometry(2.57, 0.08, 0.43, 3, 0.027), 'x', 0.44, 1.7, 0.22, 0.48), eaveWood, [0, 2.815, -0.16], timber).name = 'suzu-eave-cap'
  // Original shallow grain and inset end pins keep the lintel plain, without shrine text or seals.
  for (const y of [2.6, 2.7]) detail(add(new RoundedBoxGeometry(1.96, 0.0045, 0.007, 2, 0.0015), woodGrain, [0, y, 0.022], timber))
  for (const x of [-1.02, 1.02]) detail(add(new THREE.SphereGeometry(0.037, 12, 8), x < 0 ? capitalWoodLeft : capitalWoodRight, [x, 2.66, 0.03], timber))

  const suspension = add(new THREE.TorusGeometry(0.102, 0.024, 9, 32), darkGold, [0, 2.52, 0.07])
  suspension.scale.set(0.75, 1, 1)
  const pivot = new THREE.Group(); pivot.name = 'suzu-suspension-pivot'; pivot.position.set(0, 2.48, 0.11); world.add(pivot)
  const hanging = new THREE.Group(); hanging.name = 'suzu-hanging-object'; hanging.position.set(0, -.31 * HANGING_SCALE, 0)
  hanging.scale.setScalar(HANGING_SCALE); pivot.add(hanging)
  const bell = new THREE.Group(); bell.name = 'suzu-round-split-bell'; hanging.add(bell)
  const eye = add(new THREE.TorusGeometry(0.078, 0.027, 9, 32), goldLight, [0, 0.31, 0], bell)
  eye.scale.set(0.85, 1, 1)
  const body = add(new THREE.SphereGeometry(0.31, 40, 24, 0, Math.PI * 2, 0, Math.PI * 0.73), gold, [0, 0, 0], bell)
  body.name = 'suzu-bell-body'
  // The two separated lower lobes reveal a dark interior and a real opening at the bell's bottom.
  const interior = add(new THREE.SphereGeometry(0.273, 24, 16), darkGold, [0, 0, 0], bell)
  interior.name = 'suzu-dark-interior'
  const lowerLobes: THREE.Mesh[] = []
  for (const phi of [0.045, Math.PI + 0.045]) {
    const lobe = add(new THREE.SphereGeometry(0.31, 24, 12, phi, Math.PI - 0.09, Math.PI * 0.725, Math.PI * 0.275), gold, [0, 0, 0], bell)
    lobe.name = 'suzu-split-lower-lobe'; lowerLobes.push(lobe)
  }
  const band = detail(add(new THREE.TorusGeometry(0.304, 0.014, 8, 48), goldLight, [0, -0.035, 0], bell))
  band.rotation.x = Math.PI / 2
  // A narrow mouth and its rounded ends are visible from the user's view, as on a round suzu.
  const mouth = detail(add(new RoundedBoxGeometry(0.36, 0.025, 0.025, 3, 0.01), darkGold, [0, -0.135, 0.275], bell))
  mouth.name = 'suzu-sound-slot'
  for (const x of [-0.17, 0.17]) {
    const hole = detail(add(new THREE.SphereGeometry(0.035, 14, 10), darkGold, [x, -0.13, 0.254], bell))
    hole.scale.set(1, 1, 0.26)
  }

  const rope = new THREE.Group(); rope.name = 'suzu-braided-rope'; hanging.add(rope)
  const ropeMeshes: THREE.Mesh[] = []

  // Three separate helices make a thick cream/rust/sage cotton braid, updated in-place along the flexing spine.
  const braidStrands = [cream, rust, green].map((material, i) => {
    const writer = createDynamicOpenTube(BRAID_SEGS, BRAID_RADIAL, material, false)
    writer.mesh.name = `suzu-braid-strand-${i}`
    detail(writer.mesh)
    rope.add(writer.mesh)
    ropeMeshes.push(writer.mesh)
    return writer
  })

  // Rigid wooden grip & top/bottom bound cream collars ride smoothly on the lower rope end without stretching wood.
  const gripAssembly = new THREE.Group(); gripAssembly.name = 'suzu-grip-assembly'
  gripAssembly.position.set(0, BRAID_END_Y, 0); rope.add(gripAssembly)
  const neck = add(new THREE.TorusGeometry(0.092, 0.032, 10, 32), cream, [0, NECK_OFFSET_Y, 0], gripAssembly)
  neck.rotation.x = Math.PI / 2; ropeMeshes.push(neck)
  const grip = add(projectWoodUVs(new RoundedBoxGeometry(0.23, 0.28, 0.2, 4, 0.037), 'y', 2.4, 2.2, 0.5, 0.5), gripWood, [0, GRIP_LOCAL_Y, 0.01], gripAssembly)
  grip.name = 'suzu-rope-grip'; ropeMeshes.push(grip)
  const collar = add(new THREE.TorusGeometry(0.099, 0.032, 9, 32), cream, [0, COLLAR_LOCAL_Y, 0], gripAssembly)
  collar.rotation.x = Math.PI / 2; ropeMeshes.push(collar)

  // Heavy 28-strand gravity-draped cotton tassel attached under the bottom collar, dynamically trailing in-place.
  const tassel = new THREE.Group(); tassel.name = 'suzu-heavy-tassel'; rope.add(tassel)
  const tasselStrands = Array.from({ length: TASSEL_COUNT }, (_, i) => {
    const angle = (i / TASSEL_COUNT) * Math.PI * 2
    const inner = i % 3 === 0
    const r = inner ? 0.056 : 0.088
    const len = 0.285 + (i % 4) * 0.008 + (inner ? 0.012 : 0)
    const material = i % 9 === 0 ? green : i % 11 === 0 ? rust : cream
    const writer = createDynamicOpenTube(TASSEL_SEGS, TASSEL_RADIAL, material, true)
    writer.mesh.name = `suzu-tassel-strand-${i}`
    detail(writer.mesh)
    tassel.add(writer.mesh)
    ropeMeshes.push(writer.mesh)
    return {
      index: i,
      cosA: Math.cos(angle),
      sinA: Math.sin(angle),
      inner,
      r,
      len,
      phase: i * 0.87,
      writer,
    }
  })

  // Scratch buffers for zero-allocation rope & tassel mesh write-back.
  const restSpine: THREE.Vector3[] = Array.from({ length: SIM_TOTAL }, (_, i) => {
    if (i < SIM_BRAID_COUNT) return new THREE.Vector3(0, BRAID_TOP_Y - (i / (SIM_BRAID_COUNT - 1)) * BRAID_LEN, 0)
    if (i === SIM_GRIP_MID) return new THREE.Vector3(0, BRAID_END_Y + GRIP_LOCAL_Y, 0)
    if (i === SIM_COLLAR) return new THREE.Vector3(0, BRAID_END_Y + COLLAR_LOCAL_Y, 0)
    const frac = (i - SIM_COLLAR) / (SIM_TASSEL_END - SIM_COLLAR)
    return new THREE.Vector3(0, BRAID_END_Y + COLLAR_LOCAL_Y - frac * 0.30, 0)
  })
  const activeSpine: THREE.Vector3[] = restSpine.map((p) => p.clone())
  const braidCenterPts: THREE.Vector3[] = Array.from({ length: BRAID_SEGS + 1 }, () => new THREE.Vector3())
  const braidNorms: THREE.Vector3[] = Array.from({ length: BRAID_SEGS + 1 }, () => new THREE.Vector3())
  const braidBinorms: THREE.Vector3[] = Array.from({ length: BRAID_SEGS + 1 }, () => new THREE.Vector3())
  const strandPts: THREE.Vector3[] = Array.from({ length: BRAID_SEGS + 1 }, () => new THREE.Vector3())
  const tasselPts: THREE.Vector3[] = Array.from({ length: TASSEL_SEGS + 1 }, () => new THREE.Vector3())
  const tmpTan = new THREE.Vector3()
  const tmpPrevTan = new THREE.Vector3()
  const tmpAxis = new THREE.Vector3()
  const tmpQuat = new THREE.Quaternion()
  const tmpCollarPos = new THREE.Vector3()
  const tmpGripDown = new THREE.Vector3()
  const tmpTasselOffset = new THREE.Vector3()
  const tmpTasselMidOffset = new THREE.Vector3()
  const downRef = new THREE.Vector3(0, -1, 0)
  const braidRadiusFn = (u: number) => BRAID_TUBE_R * (1 + 0.045 * Math.sin(u * Math.PI))
  const tasselRadiusFn = (u: number) => THREE.MathUtils.lerp(0.012, 0.0082, Math.pow(u, 1.5))

  /** Writes the flexing 3-strand cotton braid, tangential wooden grip, and gravity-draped 28-strand tassel in-place. */
  function writeRopeMeshes(spine: readonly THREE.Vector3[], tension = 0, dynamicFan = 0) {
    // 1. Sample 101 smooth braid centerline points from particles 0..10 (pinned strictly at BRAID_TOP_Y).
    for (let s = 0; s <= BRAID_SEGS; s++) {
      const f = (s / BRAID_SEGS) * (SIM_BRAID_COUNT - 1)
      const i1 = Math.min(SIM_BRAID_COUNT - 2, Math.floor(f))
      const t = f - i1
      const i0 = Math.max(0, i1 - 1)
      const i2 = i1 + 1
      const i3 = Math.min(SIM_BRAID_COUNT - 1, i1 + 2)
      const p0 = spine[i0]!, p1 = spine[i1]!, p2 = spine[i2]!, p3 = spine[i3]!
      if (s === 0) {
        braidCenterPts[0]!.set(0, BRAID_TOP_Y, 0)
      } else {
        braidCenterPts[s]!.set(
          catmullRom(p0.x, p1.x, p2.x, p3.x, t),
          catmullRom(p0.y, p1.y, p2.y, p3.y, t),
          catmullRom(p0.z, p1.z, p2.z, p3.z, t),
        )
      }
    }

    // 2. Parallel-transport frame along the braid so the 3 helices never collapse or twist spuriously.
    for (let s = 0; s <= BRAID_SEGS; s++) {
      const prev = braidCenterPts[Math.max(0, s - 1)]!
      const next = braidCenterPts[Math.min(BRAID_SEGS, s + 1)]!
      tmpTan.subVectors(next, prev)
      if (tmpTan.lengthSq() < 1e-12) tmpTan.set(0, -1, 0)
      else tmpTan.normalize()
      if (s === 0) {
        braidNorms[0]!.set(1, 0, 0).addScaledVector(tmpTan, -tmpTan.x).normalize()
        braidBinorms[0]!.crossVectors(tmpTan, braidNorms[0]!).normalize()
        tmpPrevTan.copy(tmpTan)
      } else {
        braidNorms[s]!.copy(braidNorms[s - 1]!)
        tmpAxis.crossVectors(tmpPrevTan, tmpTan)
        const sinA = tmpAxis.length()
        if (sinA > 1e-6) {
          tmpAxis.divideScalar(sinA)
          const cosA = THREE.MathUtils.clamp(tmpPrevTan.dot(tmpTan), -1, 1)
          tmpQuat.setFromAxisAngle(tmpAxis, Math.atan2(sinA, cosA))
          braidNorms[s]!.applyQuaternion(tmpQuat)
        }
        braidNorms[s]!.addScaledVector(tmpTan, -braidNorms[s]!.dot(tmpTan)).normalize()
        braidBinorms[s]!.crossVectors(tmpTan, braidNorms[s]!).normalize()
        tmpPrevTan.copy(tmpTan)
      }
    }

    // 3. Wrap all three cotton helices cleanly around the curved centerline with subtle waist fullness.
    for (let i = 0; i < 3; i++) {
      const phase = (i * Math.PI * 2) / 3
      for (let s = 0; s <= BRAID_SEGS; s++) {
        const u = s / BRAID_SEGS
        const angle = u * Math.PI * 2 * BRAID_TURNS + phase
        // Authentic thick shrine cotton rope profile: plump mid-braid, snug seating at bell & neck collar.
        const barrel = 1 + 0.085 * Math.sin(u * Math.PI) - 0.045 * Math.pow(u, 3)
        const hr = BRAID_HELIX_R * barrel * (1 - 0.04 * tension)
        const ca = Math.cos(angle), sa = Math.sin(angle)
        const c = braidCenterPts[s]!, n = braidNorms[s]!, b = braidBinorms[s]!
        strandPts[s]!.set(
          c.x + hr * (n.x * ca + b.x * sa),
          c.y + hr * (n.y * ca + b.y * sa),
          c.z + hr * (n.z * ca + b.z * sa),
        )
      }
      braidStrands[i]!.update(strandPts, braidRadiusFn)
    }

    // 4. Seat the rigid wooden grip & bound cream collars cleanly at the braid bottom along the local tangent.
    const braidBottom = braidCenterPts[BRAID_SEGS]!
    gripAssembly.position.copy(braidBottom)
    const gripEnd = spine[SIM_COLLAR]!
    tmpGripDown.subVectors(gripEnd, braidBottom)
    if (tmpGripDown.lengthSq() < 1e-8) tmpGripDown.set(0, -1, 0)
    else tmpGripDown.normalize()
    // Clamp tilt cleanly so the wooden grip follows the heavy rope naturally without extreme pitch/roll.
    tmpGripDown.x = THREE.MathUtils.clamp(tmpGripDown.x, -0.34, 0.34)
    tmpGripDown.z = THREE.MathUtils.clamp(tmpGripDown.z, -0.22, 0.22)
    tmpGripDown.y = -Math.sqrt(Math.max(0.25, 1 - tmpGripDown.x * tmpGripDown.x - tmpGripDown.z * tmpGripDown.z))
    gripAssembly.quaternion.setFromUnitVectors(downRef, tmpGripDown)

    // 5. Update all 28 heavy cotton tassel strands from the actual bottom collar position & Rapier tassel lag.
    tmpCollarPos.copy(braidBottom).addScaledVector(tmpGripDown, -COLLAR_LOCAL_Y)
    const tMid = spine[SIM_COLLAR + 1]!
    const tTip = spine[SIM_TASSEL_END]!
    // Compute tassel tail lag relative to straight-down continuation of the collar.
    tmpTasselMidOffset.set(
      THREE.MathUtils.clamp(tMid.x - tmpCollarPos.x, -0.22, 0.22),
      0,
      THREE.MathUtils.clamp(tMid.z - tmpCollarPos.z, -0.16, 0.16),
    )
    tmpTasselOffset.set(
      THREE.MathUtils.clamp(tTip.x - tmpCollarPos.x, -0.32, 0.32),
      0,
      THREE.MathUtils.clamp(tTip.z - tmpCollarPos.z, -0.22, 0.22),
    )
    const whipMag = Math.hypot(tmpTasselOffset.x, tmpTasselOffset.z)
    const fanBoost = THREE.MathUtils.clamp(dynamicFan + whipMag * 1.45, 0, 0.55)
    // Gentle inward sleekness when tautly pulled straight down.
    const pullSleek = 1 - 0.12 * tension

    // Orthonormal ring basis perpendicular to grip axis so tassel exits squarely from the collar ring.
    const collarX = new THREE.Vector3(1, 0, 0).applyQuaternion(gripAssembly.quaternion)
    const collarZ = new THREE.Vector3(0, 0, 1).applyQuaternion(gripAssembly.quaternion)

    for (const st of tasselStrands) {
      const rx = collarX.x * st.cosA + collarZ.x * st.sinA
      const ry = collarX.y * st.cosA + collarZ.y * st.sinA
      const rz = collarX.z * st.cosA + collarZ.z * st.sinA

      for (let s = 0; s <= TASSEL_SEGS; s++) {
        const u = s / TASSEL_SEGS
        // Bell-shaped shrine cotton tassel profile: snug inside collar -> soft curved shoulder ->
        // natural vertical gravity hang that subtly gathers softly toward the lower tips (no stiff splayed broom!).
        const shoulder = Math.sin(Math.min(1, u * 1.38) * Math.PI * 0.5)
        const gravityGather = 1 - 0.14 * Math.pow(Math.max(0, u - 0.38) / 0.62, 1.35)
        const organicBreath = 1 + 0.045 * Math.sin(u * Math.PI * 1.4 + st.phase)
        const radialScale = THREE.MathUtils.lerp(0.62, 1.44 * gravityGather * pullSleek * (1 + fanBoost * u * 0.72), shoulder) * organicBreath
        const rad = st.r * radialScale

        // Smooth blend from collar axis at root into vertical gravity + dynamic whip curve along the tail.
        const axisWeight = (1 - u) * 0.55
        const baseX = tmpCollarPos.x + (tmpGripDown.x * axisWeight) * st.len * u
        const baseY = tmpCollarPos.y + THREE.MathUtils.lerp(tmpGripDown.y, -1, smooth(u * 1.2)) * st.len * u
        const baseZ = tmpCollarPos.z + (tmpGripDown.z * axisWeight) * st.len * u

        // Secondary trailing curve from Rapier tassel particles (quadratic sweep along strand length).
        const lagFactor = u * u
        const midFactor = 2 * u * (1 - u)
        const strandLagX = tmpTasselMidOffset.x * midFactor * 0.8 + tmpTasselOffset.x * lagFactor
        const strandLagZ = tmpTasselMidOffset.z * midFactor * 0.8 + tmpTasselOffset.z * lagFactor
        // Slight radial splay lift during strong horizontal whip so strands visibly separate in motion.
        const whipLift = whipMag * 0.18 * lagFactor * (st.inner ? 0.6 : 1.0)
        // Subtle natural cotton tip curl at rest (organic strand character, zero artificial wiggle).
        const restCurve = 0.004 * Math.sin(st.phase) * lagFactor

        tasselPts[s]!.set(
          baseX + rx * rad + strandLagX + restCurve,
          baseY + ry * rad + whipLift,
          baseZ + rz * rad + strandLagZ,
        )
      }
      st.writer.update(tasselPts, tasselRadiusFn)
    }
  }

  /** Evaluates calm analytical spine for zero-WASM resting, reduced motion, and drag fallback. */
  function evalCalmSpine(amount: number, side: number, out: THREE.Vector3[]) {
    const stretch = amount * 0.115 * BRAID_LEN
    const bow = side * 0.85
    for (let i = 0; i < SIM_TOTAL; i++) {
      if (i < SIM_BRAID_COUNT) {
        const u = i / (SIM_BRAID_COUNT - 1)
        const x = bow * Math.sin(u * Math.PI * 0.78) * Math.pow(u, 1.15)
        const y = BRAID_TOP_Y - u * (BRAID_LEN + stretch)
        out[i]!.set(x, y, 0)
      } else if (i === SIM_GRIP_MID) {
        const top = out[SIM_BRAID_COUNT - 1]!
        out[i]!.set(top.x + bow * 0.08, top.y + GRIP_LOCAL_Y, 0)
      } else if (i === SIM_COLLAR) {
        const top = out[SIM_BRAID_COUNT - 1]!
        out[i]!.set(top.x + bow * 0.14, top.y + COLLAR_LOCAL_Y, 0)
      } else {
        const collarP = out[SIM_COLLAR]!
        const frac = (i - SIM_COLLAR) / (SIM_TASSEL_END - SIM_COLLAR)
        out[i]!.set(collarP.x + bow * 0.06 * frac, collarP.y - frac * 0.30, 0)
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Lazy-loaded Rapier soft-body braided shrine rope (16 particles in hanging-local
  // space). Particle 0 stays strictly pinned at the bell underside (0, -0.265, 0).
  // Constructor NEVER loads WASM; reducedMotion NEVER loads WASM.
  // ---------------------------------------------------------------------------
  let ropeBody: ReturnType<RapierSoftBodySession['createCustomRope']> | null = null
  let rapierReady = false
  let prevPivotZ = 0, prevPivotX = 0
  let prevPivotVelZ = 0, prevPivotVelX = 0
  let pivotAccelZ = 0, pivotAccelX = 0
  let ringPhaseTime = 0
  let settleDampClock = 0

  function resetRopeParticlesToCalm(amount: number, side: number) {
    evalCalmSpine(amount, side, activeSpine)
    if (ropeBody && ropeBody.isValid()) {
      for (let i = 0; i < SIM_TOTAL; i++) {
        const p = activeSpine[i]!
        ropeBody.setParticlePosition(i, { x: p.x, y: p.y, z: p.z })
        ropeBody.setParticleVelocity(i, { x: 0, y: 0, z: 0 })
      }
    }
    prevPivotZ = pivot.rotation.z
    prevPivotX = pivot.rotation.x
    prevPivotVelZ = 0
    prevPivotVelX = 0
    pivotAccelZ = 0
    pivotAccelX = 0
  }

  function calmRope() {
    const heldAmount = checkpoint === 1 && !reduced() ? 0.32 : 0
    settleDampClock = 0
    resetRopeParticlesToCalm(heldAmount, 0)
    writeRopeMeshes(activeSpine, heldAmount, 0)
  }

  const host = createRapierSoftBodyHost({
    gravity: { x: 0, y: -9.81, z: 0 },
    fixedDt: 1 / 60,
    maxSubsteps: 4,
    solverIterations: 10,
    internalPgsIterations: 2,
    sleepSpeedThreshold: 0.008,
    sleepTimeRequired: 0.45,
    isActive: active,
    isReducedMotion: reduced,
    onReady(session) {
      if (disposed) return
      const initialAmount = checkpoint === 1 && !reduced() ? 0.32 : 0
      evalCalmSpine(initialAmount, 0, activeSpine)
      ropeBody = session.createCustomRope({
        points: activeSpine.map((p) => ({ x: p.x, y: p.y, z: p.z })),
        closed: false,
        bending: true,
        wireCollision: false,
        particleMass: 0.085,
        particleRadius: 0.04,
        linearDamping: 1.9,
        gravityScale: 1.0,
        edgeSoftness: { naturalFrequency: 26, dampingRatio: 0.78 },
        bendSoftness: { naturalFrequency: 9.2, dampingRatio: 0.56 },
        pinnedParticles: [0],
        canSleep: true,
        noSurfaceCollider: true,
      })
      rapierReady = true
      resetRopeParticlesToCalm(initialAmount, 0)
      writeRopeMeshes(activeSpine, initialAmount, 0)
    },
  })

  function applyRopeForces(_session: RapierSoftBodySession, _subDt: number) {
    if (!ropeBody || !ropeBody.isValid()) return
    const pos = ropeBody.particlePositions()
    const vel = ropeBody.particleVelocities()
    const pMass = Math.max(ropeBody.mass() / SIM_TOTAL, 1e-4)

    ropeBody.resetForces(false)
    ropeBody.setParticleKinematicTarget(0, { x: 0, y: BRAID_TOP_Y, z: 0 })

    // Compute desired gentle vertical target stretch from current pullAmount (e.g. live drag or held p=1).
    const stretch = pullAmount * 0.115 * BRAID_LEN
    const gripTargetY = BRAID_END_Y + GRIP_LOCAL_Y - stretch
    const gripTargetX = pullSide * 1.15
    const draggingNow = pointer.isBusy() && checkpoint === 0
    const ringingNow = motion?.kind === 'ring'
    const settlingNow = motion?.kind === 'settle'

    for (let i = 1; i < SIM_TOTAL; i++) {
      const px = pos[i * 3]!, py = pos[i * 3 + 1]!, pz = pos[i * 3 + 2]!
      const vx = vel[i * 3]!, vy = vel[i * 3 + 1]!, vz = vel[i * 3 + 2]!

      // Depth from bell attachment (0..1.4) for rotational D'Alembert inertia (-alpha x r).
      const depth = Math.max(0.05, BRAID_TOP_Y - py)
      const isGrip = i === SIM_BRAID_COUNT - 1 || i === SIM_GRIP_MID || i === SIM_COLLAR
      const isTassel = i > SIM_COLLAR

      // Rotational inertial coupling from the swinging bell pivot + tilted local gravity.
      let ax = Math.sin(pivot.rotation.z) * 9.81 + THREE.MathUtils.clamp(pivotAccelZ * depth * 0.42, -16, 16)
      let ay = 0
      let az = -Math.sin(pivot.rotation.x) * 9.81 - THREE.MathUtils.clamp(pivotAccelX * depth * 0.25, -10, 10)

      // Gentle vertical rest-length elastic guide & mild lateral centering so the thick cotton braid
      // never collapses or stretches endlessly while preserving free traveling transverse waves.
      const restY = restSpine[i]!.y - stretch * Math.min(1, i / (SIM_BRAID_COUNT - 1))
      const kY = isGrip ? 95 : 55
      ay += (restY - py) * kY - vy * 3.2

      // Mild internal cotton braid damping & soft restoring stiffness (softer on tassel so tassel trails!).
      const kCenter = isTassel ? 5.5 : 13.5
      const kDampXZ = isTassel ? 2.1 : 3.2
      ax += -px * kCenter - vx * kDampXZ
      az += -pz * (kCenter * 1.35) - vz * (kDampXZ * 1.2)

      // Rigidify the wooden grip block segment (particles 10-11-12 stay straight wood!).
      if (i === SIM_GRIP_MID) {
        const pTopX = pos[(SIM_BRAID_COUNT - 1) * 3]!, pTopZ = pos[(SIM_BRAID_COUNT - 1) * 3 + 2]!
        const pBotX = pos[SIM_COLLAR * 3]!, pBotZ = pos[SIM_COLLAR * 3 + 2]!
        ax += ((pTopX + pBotX) * 0.5 - px) * 180
        az += ((pTopZ + pBotZ) * 0.5 - pz) * 180
      }

      // Live pointer drag: pull the wooden grip smoothly downward & laterally under the user's hand.
      if (draggingNow && i === SIM_GRIP_MID) {
        ax += (gripTargetX - px) * 260 - vx * 16
        ay += (gripTargetY - py) * 260 - vy * 16
        az += (0.045 * pullAmount - pz) * 140 - vz * 10
      }

      // Ring motion: authentic initial downward tug + release whip wave traveling down the braided rope!
      if (ringingNow) {
        const t = ringPhaseTime
        if (t < 0.22) {
          // Crisp initial downward & lateral draw before release snap so the braid visibly bows under pull.
          const draw = Math.sin((t / 0.22) * Math.PI * 0.5)
          const u = i / (SIM_TOTAL - 1)
          if (i === SIM_GRIP_MID || i === SIM_COLLAR) {
            ax += (0.21 * draw - px) * 260
            ay += (BRAID_END_Y + GRIP_LOCAL_Y - 0.125 * draw - py) * 260
            az += (0.06 * draw - pz) * 150
          } else if (i < SIM_BRAID_COUNT) {
            ax += (0.14 * draw * Math.sin(u * Math.PI * 0.75) - px) * 85
          }
        } else {
          // Release whip wave: traveling transverse S-curve propagating from bell down through braid & heavy tassel!
          const u = i / (SIM_TOTAL - 1)
          const dtRel = t - 0.22
          const decay = Math.exp(-dtRel * 2.1)
          const wave = Math.sin(dtRel * 17.5 - u * 4.9)
          const depthWave = Math.cos(dtRel * 12.5 - u * 3.8)
          ax += wave * decay * (isTassel ? 28.0 : 21.0) * Math.pow(u, 0.7)
          az += depthWave * decay * (isTassel ? 10.5 : 6.2) * Math.pow(u, 0.8)
        }
      } else if (settlingNow) {
        // Gentle calming lift & pendulum relaxation back to plumb rest.
        const u = i / (SIM_TOTAL - 1)
        const sWave = Math.sin((motion?.time ?? 0) * Math.PI * 2.4 - u * 2.0) * (1 - (motion?.time ?? 0))
        ax += sWave * 7.2 * u
      }

      ropeBody.addParticleForce(i, { x: ax * pMass, y: ay * pMass, z: az * pMass }, false)
    }
  }

  function syncFromRapier() {
    if (!ropeBody || !ropeBody.isValid()) return
    const pos = ropeBody.particlePositions()
    const vel = ropeBody.particleVelocities()
    activeSpine[0]!.set(0, BRAID_TOP_Y, 0)
    let maxHorizSpeed = 0
    for (let i = 1; i < SIM_TOTAL; i++) {
      const x = THREE.MathUtils.clamp(pos[i * 3]!, -0.34, 0.34)
      const y = THREE.MathUtils.clamp(pos[i * 3 + 1]!, restSpine[i]!.y - 0.16, restSpine[i]!.y + 0.08)
      const z = THREE.MathUtils.clamp(pos[i * 3 + 2]!, -0.24, 0.24)
      activeSpine[i]!.set(x, y, z)
      const hs = Math.hypot(vel[i * 3]!, vel[i * 3 + 2]!)
      if (hs > maxHorizSpeed) maxHorizSpeed = hs
    }
    const fan = THREE.MathUtils.clamp(maxHorizSpeed * 0.28, 0, 0.42)
    writeRopeMeshes(activeSpine, pullAmount, fan)
  }

  // Write initial calm weighted rope & gravity-draped tassel geometry immediately.
  evalCalmSpine(0, 0, activeSpine)
  writeRopeMeshes(activeSpine, 0, 0)

  const target = add(new THREE.SphereGeometry(0.065, 12, 8), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }), [0, 0.24, 0.14])
  target.name = 'suzu-pull-target'
  addInteractionCue(grip, {
    kind: 'drag', label: COPY.pullCue, priority: 2, destination: target, targetLabel: COPY.target,
    enabled: () => active() && !motion && checkpoint === 0,
  })
  addInteractionCue(grip, {
    kind: 'tap', label: COPY.settleCue, priority: 2,
    enabled: () => active() && !motion && checkpoint === 1,
  })
  addInteractionCue(body, {
    kind: 'tap', label: COPY.greetCue, priority: 2,
    enabled: () => active() && !motion && checkpoint === 2,
  })

  const touchTarget = createTouchTarget(canvas, camera, scene)
  const ray = createPointerRay(canvas, camera)
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const sources = () => checkpoint < 2 ? ropeMeshes : [body, ...lowerLobes]
  const pose = (amount: number, sway = 0, rattle = 0, side = 0) => {
    pullAmount = amount
    pullSide = side
    pivot.rotation.z = amount * 0.038 + sway
    pivot.rotation.x = rattle
    if (!rapierReady || reduced()) {
      evalCalmSpine(amount, side, activeSpine)
      writeRopeMeshes(activeSpine, amount, 0)
    }
    matrices()
  }
  const glow = (amount: number) => { gold.emissiveIntensity = goldLight.emissiveIntensity = BELL_GLOW + amount * 0.55 }
  const restorePose = () => {
    glow(0)
    const targetAmount = checkpoint === 1 && !reduced() ? 0.32 : 0
    pose(targetAmount, 0, 0, 0)
    if (reduced() || checkpoint === 0 || checkpoint === 3) {
      resetRopeParticlesToCalm(targetAmount, 0)
      writeRopeMeshes(activeSpine, targetAmount, 0)
    }
  }
  const sync = () => {
    ui.renderDots(checkpoint, 3)
    ui.actionBtn.hidden = checkpoint === 3
    ui.actionBtn.disabled = !active() || !!motion || checkpoint === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    setSafeText(ui.actionBtn, [COPY.pull, COPY.settle, COPY.greet, COPY.greet][checkpoint], safe)
    setSafeText(ui.hintEl, motion ? motion.kind === 'ring' ? COPY.ringing : motion.kind === 'settle' ? COPY.settling : COPY.greeting : [COPY.ready, COPY.held, COPY.quiet, COPY.done][checkpoint], safe)
  }
  const advance = (next: Checkpoint) => {
    checkpoint = next
    sync()
    ctx.onProgress?.(next)
    if (next === 3 && !completed) {
      completed = true
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    }
  }
  const finishMotion = () => {
    const kind = motion?.kind
    motion = null
    if (kind === 'settle') advance(2)
    else if (kind === 'greet') advance(3)
    glow(0)
    const heldAmount = checkpoint === 1 && !reduced() ? 0.32 : 0
    pose(heldAmount, 0, 0, 0)
    if (reduced()) {
      calmRope()
    } else if (kind === 'ring' || kind === 'settle') {
      // Allow brief organic residual rope damping after bell motion completes, then settle cleanly.
      settleDampClock = 0.55
      host.wakeUp()
    }
    sync()
  }
  const perform = () => {
    if (!active() || pointer.isBusy() || motion || checkpoint === 3) return
    if (checkpoint === 0) {
      ringPhaseTime = 0
      motion = { kind: 'ring', time: 0, from: Math.max(pullAmount, 0.8), sway: pivot.rotation.z - pullAmount * 0.038 }
      advance(1)
      // Only the first pull rings. Settling and greeting stay quiet; repeats never score.
      feedback.impact({ freqs: [587.33, 1174.66, 1762], duration: 0.7, gain: 0.035 })
    } else motion = { kind: checkpoint === 1 ? 'settle' : 'greet', time: 0, from: pullAmount, sway: 0 }
    if (reduced()) finishMotion()
    else {
      host.wakeUp()
      sync()
    }
  }
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: active,
    canStart(x, y) { matrices(); return !motion && checkpoint < 3 && touchTarget.hit(x, y, sources()) },
    onStart(x, y) { downX = x; downY = y; feedback.prepare(); if (!reduced()) host.wakeUp() },
    onMove(x, y) {
      if (checkpoint === 0 && !reduced()) {
        const amt = THREE.MathUtils.clamp((y - downY) / 90, 0, 1)
        const side = THREE.MathUtils.clamp((x - downX) / 520, -0.07, 0.07)
        pose(amt, side, 0, side)
        host.wakeUp()
      }
    },
    onRelease(x, y) {
      const dx = x - downX, dy = y - downY
      matrices()
      const valid = checkpoint === 0 ? dy >= 45 && dy > Math.abs(dx) * 1.1 : Math.hypot(dx, dy) < 12 && touchTarget.hit(x, y, sources())
      if (valid) perform()
      else {
        restorePose()
        if (!reduced()) {
          settleDampClock = 0.45
          host.wakeUp()
        }
      }
    },
    onCancel() { if (!motion) restorePose() },
  })
  const action = () => {
    if (!active() || pointer.isBusy() || motion || checkpoint === 3) return
    feedback.prepare(); perform()
  }
  const blur = () => { focused = false; pointer.cancel(); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    camera.position.set(0.08, 1.88, 4.85 + portraitBoost(aspect, 3.5))
    camera.lookAt(look); matrices()
  }
  sync()
  return {
    start() {
      if (started || disposed) return
      started = true
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      completed = checkpoint === 3
      wasReduced = reduced()
      restorePose(); resize(); sync()
      if (!wasReduced) void host.start()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      ui.actionBtn.addEventListener('click', action)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
    },
    update(dt) {
      if (!started || disposed) return
      const isActive = active()
      if (wasActive !== isActive) { wasActive = isActive; sync() }
      if (!isActive) { pointer.cancel(); style.render(); return }
      const reducedNow = reduced()
      if (reducedNow !== wasReduced) {
        wasReduced = reducedNow
        if (reducedNow) {
          if (motion) finishMotion()
          else {
            pose(0, 0, 0, 0)
            calmRope()
          }
        } else {
          void host.start()
        }
      }
      const delta = Number.isFinite(dt) ? Math.min(0.05, Math.max(0, dt)) : 0
      if (motion) {
        const duration = motion.kind === 'settle' ? 0.65 : motion.kind === 'ring' ? 0.75 : 0.35
        motion.time = reducedNow ? 1 : Math.min(1, motion.time + delta / duration)
        const t = motion.time, p = smooth(t)
        if (motion.kind === 'ring') {
          ringPhaseTime = t
          const fade = (1 - t) ** 1.6
          pose(
            THREE.MathUtils.lerp(motion.from, 0.32, p),
            motion.sway * (1 - p) + Math.sin(t * Math.PI * 5) * fade * 0.11,
            Math.sin(t * Math.PI * 16) * fade * fade * 0.06,
            0,
          )
          glow(Math.sin(Math.min(1, t * 2.4) * Math.PI) * (1 - t))
        } else if (motion.kind === 'settle') {
          pose(motion.from * (1 - p), 0, 0, 0)
        } else {
          // A greeting tap answers on the bell itself with a soft warm swell, without another ring.
          glow(Math.sin(t * Math.PI) * 0.6)
        }
        if (t === 1) finishMotion()
      } else if (reducedNow && !pointer.isBusy()) {
        if (pullAmount !== 0 || pivot.rotation.z !== 0 || pivot.rotation.x !== 0) {
          pose(0, 0, 0, 0)
          calmRope()
        }
      }

      // Compute bell pivot angular acceleration for real inertial coupling into the Rapier rope.
      if (!reducedNow && rapierReady && delta > 0) {
        const velZ = (pivot.rotation.z - prevPivotZ) / delta
        const velX = (pivot.rotation.x - prevPivotX) / delta
        pivotAccelZ = (velZ - prevPivotVelZ) / delta
        pivotAccelX = (velX - prevPivotVelX) / delta
        prevPivotZ = pivot.rotation.z
        prevPivotX = pivot.rotation.x
        prevPivotVelZ = velZ
        prevPivotVelX = velX

        const needsSim = Boolean(motion && motion.kind !== 'greet') || pointer.isBusy() || settleDampClock > 0
        if (needsSim) {
          if (!motion && !pointer.isBusy() && settleDampClock > 0) {
            settleDampClock = Math.max(0, settleDampClock - delta)
          }
          host.wakeUp()
          host.step(delta, applyRopeForces, () => syncFromRapier())
          if (!motion && !pointer.isBusy() && settleDampClock === 0) {
            // Settle neatly to calm held/rest equilibrium once residual swing finishes.
            const restAmt = checkpoint === 1 ? 0.32 : 0
            resetRopeParticlesToCalm(restAmt, 0)
            writeRopeMeshes(activeSpine, restAmt, 0)
          }
        }
      }

      style.render()
    },
    dispose() {
      if (disposed) return
      disposed = true; pointer.dispose(); stopResize(); feedback.dispose()
      host.dispose()
      ropeBody = null
      rapierReady = false
      ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose(); disposeTree(scene)
      woodTextures.forEach(tex => tex.dispose()); woodTextures.length = 0
      Object.values(lights).forEach(light => light.dispose())
      scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
