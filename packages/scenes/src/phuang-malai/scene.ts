import { bindSceneAttribute } from '../scene-localization'
import * as THREE from 'three'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createTouchTarget, insideCanvas, projectTouchPoint } from '../touch-target'
import { createDropFeedback } from '../drop-feedback'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay,
  createSceneFeedback, createStepOverlay, createWarmStage, disposeTree,
  observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'
import { createJasmineBudGeometry, createMalaiBudMaterial } from './bud-craft'

let cachedMalaiCordPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null

/** Deterministic 2-ply spun silk-cotton cord texture (128x128, seamless tiling) for the garland cord, bow and tassel bindings. */
function createMalaiCordTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedMalaiCordPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const plyA = Math.sin((u * 8 + v * 2) * tau)
        const plyB = Math.sin((u * 16 + v * 4) * tau) * 0.28
        const twistGrain = Math.sin((u * 24 - v * 3) * tau) * 0.12
        const fiber = plyA * 0.70 + plyB + twistGrain
        const shade = fiber * 15
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(244 + shade * 0.88), 212, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(240 + shade * 0.94), 206, 255)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(230 + shade), 196, 252)
        color[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + fiber * 56), 28, 232)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedMalaiCordPixels = { color, bump, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedMalaiCordPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedMalaiCordPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Builds a closed 2-ply twisted cord ring in the XY plane with strictly outward-facing normals. */
function buildTwistedRingGeometry(
  majorRadius: number,
  tubeRadius: number,
  plyDepth: number,
  tubularSegments: number,
  radialSegments: number,
  turns: number,
): THREE.BufferGeometry {
  const stride = radialSegments + 1
  const positions = new Float32Array((tubularSegments + 1) * stride * 3)
  const uvs = new Float32Array((tubularSegments + 1) * stride * 2)
  const indices: number[] = []
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const phi = u * Math.PI * 2
    const cphi = Math.cos(phi), sphi = Math.sin(phi)
    // Right-handed frame: T = (-sphi, cphi, 0), N = (cphi, sphi, 0), B = T x N = (0, 0, -1).
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const theta = v * Math.PI * 2
      const ply = 1 + plyDepth * Math.cos(theta * 2 - phi * turns)
      const r = tubeRadius * ply
      const ct = Math.cos(theta), st = Math.sin(theta)
      const rr = majorRadius + r * ct
      const k = i * stride + j
      positions[k * 3] = rr * cphi
      positions[k * 3 + 1] = rr * sphi
      positions[k * 3 + 2] = -r * st
      uvs[k * 2] = u * turns * 0.8
      uvs[k * 2 + 1] = v
      if (i < tubularSegments && j < radialSegments) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a smooth 2-ply twisted cord tube along a 3D curve using parallel-transport frames (zero Frenet flips). */
function buildTwistedCordTube(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radialSegments: number,
  radius: number | ((u: number) => number),
  turns: number,
  plyDepth: number,
  capEnds = false,
): THREE.BufferGeometry {
  const stride = radialSegments + 1
  const points = curve.getSpacedPoints(tubularSegments)
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i <= tubularSegments; i++) {
    const prev = points[Math.max(0, i - 1)]!
    const next = points[Math.min(tubularSegments, i + 1)]!
    const t = new THREE.Vector3().subVectors(next, prev)
    if (t.lengthSq() < 1e-12) t.set(0, 1, 0)
    else t.normalize()
    tangents.push(t)
  }
  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  const t0 = tangents[0]!
  const ref = Math.abs(t0.z) < 0.85 ? new THREE.Vector3(0, 0, 1) : new THREE.Vector3(1, 0, 0)
  let prevN = new THREE.Vector3().crossVectors(ref, t0).normalize()
  let prevB = new THREE.Vector3().crossVectors(t0, prevN).normalize()
  normals.push(prevN.clone())
  binormals.push(prevB.clone())
  const rotAxis = new THREE.Vector3()
  const rotQ = new THREE.Quaternion()
  for (let i = 1; i <= tubularSegments; i++) {
    const a = tangents[i - 1]!
    const b = tangents[i]!
    const dot = THREE.MathUtils.clamp(a.dot(b), -1, 1)
    rotAxis.crossVectors(a, b)
    if (rotAxis.lengthSq() > 1e-10) {
      rotAxis.normalize()
      rotQ.setFromAxisAngle(rotAxis, Math.acos(dot))
      prevN = prevN.clone().applyQuaternion(rotQ).normalize()
    }
    prevB = new THREE.Vector3().crossVectors(b, prevN).normalize()
    prevN = new THREE.Vector3().crossVectors(prevB, b).normalize()
    normals.push(prevN)
    binormals.push(prevB)
  }

  const capVerts = capEnds ? 2 : 0
  const bodyVerts = (tubularSegments + 1) * stride
  const positions = new Float32Array((bodyVerts + capVerts) * 3)
  const uvs = new Float32Array((bodyVerts + capVerts) * 2)
  const indices: number[] = []
  const rAt = typeof radius === 'function' ? radius : () => radius

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const p = points[i]!
    const N = normals[i]!
    const B = binormals[i]!
    const baseR = rAt(u)
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const theta = v * Math.PI * 2
      const ply = 1 + plyDepth * Math.cos(theta * 2 - u * Math.PI * 2 * turns)
      const r = baseR * ply
      const ct = Math.cos(theta), st = Math.sin(theta)
      const k = i * stride + j
      positions[k * 3] = p.x + r * (N.x * ct + B.x * st)
      positions[k * 3 + 1] = p.y + r * (N.y * ct + B.y * st)
      positions[k * 3 + 2] = p.z + r * (N.z * ct + B.z * st)
      uvs[k * 2] = u * turns * 0.75
      uvs[k * 2 + 1] = v
      if (i < tubularSegments && j < radialSegments) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        indices.push(a, b, c, b, d, c)
      }
    }
  }

  if (capEnds) {
    const startCenter = bodyVerts
    const endCenter = bodyVerts + 1
    const p0 = points[0]!, p1 = points[tubularSegments]!
    positions[startCenter * 3] = p0.x; positions[startCenter * 3 + 1] = p0.y; positions[startCenter * 3 + 2] = p0.z
    uvs[startCenter * 2] = 0; uvs[startCenter * 2 + 1] = 0.5
    positions[endCenter * 3] = p1.x; positions[endCenter * 3 + 1] = p1.y; positions[endCenter * 3 + 2] = p1.z
    uvs[endCenter * 2] = 1; uvs[endCenter * 2 + 1] = 0.5
    const lastRow = tubularSegments * stride
    for (let j = 0; j < radialSegments; j++) {
      // Start cap faces -T; end cap faces +T.
      indices.push(startCenter, j + 1, j)
      indices.push(endCenter, lastRow + j, lastRow + j + 1)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a merged multi-turn snug cord lashing collar around the local Y axis (outward normals verified). */
function buildCordWrapCollar(
  wrapRadius: number,
  tubeRadius: number,
  turns: number,
  pitch: number,
  axis: 'y' | 'x' = 'y',
  segsPerTurn = 28,
  sides = 8,
): THREE.BufferGeometry {
  const stride = sides + 1
  const turnVerts = (segsPerTurn + 1) * stride
  const positions = new Float32Array(turns * turnVerts * 3)
  const uvs = new Float32Array(turns * turnVerts * 2)
  const indices: number[] = []
  for (let t = 0; t < turns; t++) {
    const base = t * turnVerts
    const offset = (t - (turns - 1) * 0.5) * pitch
    const tilt = (t % 2 === 0 ? 1 : -1) * pitch * 0.16
    for (let i = 0; i <= segsPerTurn; i++) {
      const u = i / segsPerTurn
      const phi = u * Math.PI * 2
      const cphi = Math.cos(phi), sphi = Math.sin(phi)
      for (let j = 0; j <= sides; j++) {
        const v = j / sides
        const theta = v * Math.PI * 2
        const ply = 1 + 0.08 * Math.cos(theta * 2 - phi * 6)
        const r = tubeRadius * ply
        const ct = Math.cos(theta), st = Math.sin(theta)
        const rr = wrapRadius + r * ct
        const axial = offset + Math.sin(phi) * tilt + r * st
        const k = base + i * stride + j
        if (axis === 'y') {
          // Horizontal ring in XZ plane: T=(-sphi,0,cphi), N=(cphi,0,sphi), B=T x N=(0,+1,0).
          positions[k * 3] = rr * cphi
          positions[k * 3 + 1] = axial
          positions[k * 3 + 2] = rr * sphi
        } else {
          // Ring in YZ plane wrapping local X axis: T=(0,-sphi,cphi), N=(0,cphi,sphi), B=T x N=(-1,0,0).
          positions[k * 3] = -axial
          positions[k * 3 + 1] = rr * cphi
          positions[k * 3 + 2] = rr * sphi
        }
        uvs[k * 2] = u * 5.0
        uvs[k * 2 + 1] = v
        if (i < segsPerTurn && j < sides) {
          const a = k, b = k + 1, c = k + stride, d = c + 1
          indices.push(a, b, c, b, d, c)
        }
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a sculpted, pinched woven cord knot cushion (replacing a plain sphere). */
function buildPinchedKnotGeometry(rx: number, ry: number, rz: number): THREE.BufferGeometry {
  const lat = 14, lon = 24, stride = lon + 1
  const positions = new Float32Array((lat + 1) * stride * 3)
  const uvs = new Float32Array((lat + 1) * stride * 2)
  const indices: number[] = []
  for (let i = 0; i <= lat; i++) {
    const v = i / lat
    const phi = v * Math.PI
    const sp = Math.sin(phi), cp = Math.cos(phi)
    for (let j = 0; j <= lon; j++) {
      const u = j / lon
      const theta = u * Math.PI * 2
      const ct = Math.cos(theta), st = Math.sin(theta)
      // Subtle crossed-strand pinch crease + woven ridge so the knot reads as bound cord.
      const waist = 1 - 0.10 * Math.pow(Math.abs(ct), 1.6) * sp
      const ridge = 1 + 0.055 * Math.cos(theta * 2 + phi * 3) * sp
      const k = i * stride + j
      positions[k * 3] = ct * rx * sp * ridge
      positions[k * 3 + 1] = cp * ry * waist
      positions[k * 3 + 2] = st * rz * sp * ridge
      uvs[k * 2] = u * 2.5
      uvs[k * 2 + 1] = v * 1.5
      if (i < lat && j < lon) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // Outward winding: (+theta tangent) x (+phi downward) points radially outward.
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

const COPY = {
  title: '串花寄意', stepsAria: '步骤',
  string: '为想感谢的人串起泰式花环。把亮起的一簇茉莉拖到浅金标记处。',
  stringing: '这一簇茉莉正轻轻落入花环…',
  tie: '花环已串好。拖住花朵，把花环向上轻拖到顶端绳结。',
  tying: '把小绳结轻轻收拢…',
  place: '拖住花朵，把花环捧放到奶油色小台上，想着你敬重的人。',
  placed: '花环已放好。带着心里的感谢，点「留下致谢」静静致意。',
  placing: '花环正轻轻落到小台上…',
  done: '茉莉已串成一环，愿这份敬意与感谢传达给你惦念的人。',
  stringTap: '串上一簇', tieTap: '系好花环', placeTap: '捧放并致谢', thanksTap: '留下致谢',
  thanksLabel: '写一句感谢', thanksPlaceholder: '谢谢你…',
} as const

const HELD = new THREE.Vector3(0, 1.38, 0.05)
const REST = new THREE.Vector3(0, 1.15, 0.08)
const RADIUS = 0.425
const CLUSTERS = 4
const smooth = (t: number) => t * t * (3 - 2 * t)

type Cluster = {
  group: THREE.Group
  flowers: THREE.InstancedMesh
  home: THREE.Vector3
  ring: THREE.Vector3
  trayRotation: number
}
type Drag = { id: number; kind: 'cluster' | 'tie' | 'garland'; x: number; y: number }
type Motion = {
  kind: 'cluster' | 'tie' | 'place'
  elapsed: number
  duration: number
  from: THREE.Vector3
  scale: number
  rotation: number
  thanks?: string
  complete?: boolean
}

export function createPhuangMalai(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared } = ctx
  const { assertSafeCopy } = shared
  Object.values(COPY).forEach(assertSafeCopy)
  let disposed = false
  let started = false
  let focused = true
  let checkpoint = 0
  let assembled = 0
  let tied = 0
  let placed = false
  let completed = false
  let clock = 0
  let drag: Drag | null = null
  let motion: Motion | null = null
  const pointers = new Set<number>()
  let wishHandle: GestureHandle | null = null
  let stopResize = () => {}
  let stopClaim = () => {}
  const fx = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, {
    title: COPY.title, stepsAria: COPY.stepsAria, action: COPY.stringTap,
  }, assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const dropFeedback = createDropFeedback(hintEl, assertSafeCopy)
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 60)
  const cameraHome = new THREE.Vector3(0, 1.8, 3.35)
  const lookAt = new THREE.Vector3(0, 1.06, 0.05)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, {
    id: ctx.sceneId ?? 'phuang-malai', label: COPY.title,
  })
  styleRenderer.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, {
    sky: 0xfff5e3, ground: 0xd7c8ad, key: 0xffe1b9, rim: 0xffe5e4,
    keyIntensity: 1.1, keyPosition: [-2.5, 4.2, 3],
  })
  const world = new THREE.Group()
  scene.add(world)
  const garland = new THREE.Group()
  garland.name = 'garland'
  garland.position.copy(HELD)
  world.add(garland)

  const cordTex = createMalaiCordTextures()
  const cream = createMalaiBudMaterial('jasmine')
  const rose = createMalaiBudMaterial('rose')
  const thread = new THREE.MeshStandardMaterial({
    color: 0xd7c897,
    roughness: 0.92,
    map: cordTex.map,
    bumpMap: cordTex.bump,
    bumpScale: 0.0024,
  })
  const threadWrap = new THREE.MeshStandardMaterial({
    color: 0xc2ad75,
    roughness: 0.90,
    map: cordTex.map,
    bumpMap: cordTex.bump,
    bumpScale: 0.0028,
  })
  const paleGold = new THREE.MeshStandardMaterial({ color: 0xe5c885, roughness: 0.9 })
  const pedestalMat = new THREE.MeshStandardMaterial({ color: 0xf5dfbf, roughness: 0.94 })
  const trayMat = new THREE.MeshStandardMaterial({ color: 0xbd956d, roughness: 1 })
  // A tapered, closed watertight jasmine bud with subtle spiral petal ridges and
  // calyx base. One shared geometry is instanced for the ring, clusters and tassels.
  const budGeo = createJasmineBudGeometry()
  const dummy = new THREE.Object3D()
  const instances: THREE.InstancedMesh[] = []
  const yAxis = new THREE.Vector3(0, 1, 0)
  const whiteColors = [0xfff9ea, 0xf6f0d8, 0xfff4df, 0xfcf6e4, 0xf4efdb, 0xfff7e6, 0xf8f1dc].map((color) => new THREE.Color(color))
  const roseColors = [0xfff8fa, 0xf6e6ec, 0xfff1ef, 0xfbeaf0, 0xf2e3e8].map((color) => new THREE.Color(color))
  const flowers = (count: number, material: THREE.Material, name: string) => {
    const mesh = new THREE.InstancedMesh(budGeo, material, count)
    mesh.name = name
    // Hundreds of buds need a soft shared silhouette, not a contour around
    // every petal. Toon shading still preserves the small rounded forms.
    mesh.userData.toonSurface = { outline: false }
    instances.push(mesh)
    return mesh
  }
  const setBud = (mesh: THREE.InstancedMesh, index: number, position: THREE.Vector3, direction: THREE.Vector3, scale = 1) => {
    dummy.position.copy(position)
    dummy.quaternion.setFromUnitVectors(yAxis, direction.normalize())
    dummy.scale.setScalar(scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(index, dummy.matrix)
    if (mesh.material === cream) mesh.setColorAt(index, whiteColors[(index * 3 + Math.floor(index / 8)) % whiteColors.length])
    else if (mesh.material === rose) mesh.setColorAt(index, roseColors[(index * 2 + 1) % roseColors.length])
  }
  const segmentPoint = (a: number) => new THREE.Vector3(Math.cos(a) * RADIUS, Math.sin(a) * RADIUS, 0)
  const buildSegment = (segment: number, name: string) => {
    const centerAngle = (segment + 0.5) * Math.PI / 3
    const center = segmentPoint(centerAngle)
    const group = new THREE.Group()
    group.position.copy(center)
    const mesh = flowers(72, cream, name)
    for (let column = 0; column < 9; column++) {
      const a = (segment + (column + 0.5) / 9) * Math.PI / 3
      const radial = new THREE.Vector3(Math.cos(a), Math.sin(a), 0)
      for (let row = 0; row < 8; row++) {
        // Stagger adjacent rows so the buds overlap like threaded jasmine.
        const b = (row / 8) * Math.PI * 2 + (column % 2) * 0.16
        const outward = radial.clone().multiplyScalar(Math.cos(b))
        outward.z = Math.sin(b)
        const p = segmentPoint(a).addScaledVector(outward, 0.069).sub(center)
        setBud(mesh, column * 8 + row, p, outward, 0.88 + (column % 3) * 0.04)
      }
    }
    group.add(mesh)
    // Only two narrow rose bands on the ring: a restrained accent, not lei
    // petals or a foliage wreath. They are threaded with their own segment.
    if (segment === 0 || segment === 2) {
      const band = flowers(8, rose, `rose-band-${segment}`)
      for (let i = 0; i < 8; i++) {
        const b = i * Math.PI / 4
        const radial = new THREE.Vector3(Math.cos(centerAngle), Math.sin(centerAngle), 0)
        const direction = radial.multiplyScalar(Math.cos(b))
        direction.z = Math.sin(b)
        setBud(band, i, direction.clone().multiplyScalar(0.079), direction, 0.94)
      }
      group.add(band)
    }
    garland.add(group)
    return { group, flowers: mesh, ring: center }
  }

  // Two already threaded arcs establish the craft; four loose clusters fill
  // the remaining segments one at a time. All use one shared bud geometry.
  const firstRing = buildSegment(0, 'ring-flowers-0')
  buildSegment(2, 'ring-flowers-2')
  const clusters: Cluster[] = [1, 3, 4, 5].map((segment, i) => {
    const cluster = buildSegment(segment, `tray-flowers-${i}`)
    cluster.group.name = `cluster-${i}`
    const home = new THREE.Vector3(-0.36 + i * 0.24, 0.34, 0.68).sub(HELD)
    const trayRotation = Math.PI / 2 - (segment + 0.5) * Math.PI / 3
    cluster.group.position.copy(home)
    cluster.group.scale.setScalar(0.52)
    cluster.group.rotation.z = trayRotation
    return { ...cluster, home, trayRotation }
  })
  // 2-ply twisted silk-cotton garland core cord replacing a plain 6-sided ring.
  const core = new THREE.Mesh(buildTwistedRingGeometry(RADIUS, 0.0090, 0.12, 216, 12, 42), thread)
  core.name = 'garland-core-cord'
  garland.add(core)
  // Snug 3-turn crown binding wrap seated on the core ring beneath the top bow.
  const crownWrap = new THREE.Mesh(buildCordWrapCollar(0.0124, 0.0042, 3, 0.0082, 'x'), threadWrap)
  crownWrap.name = 'garland-crown-wrap'
  crownWrap.position.set(0, RADIUS, 0)
  crownWrap.userData.toonSurface = { outline: false }
  garland.add(crownWrap)

  const nextSegment = new THREE.Group()
  nextSegment.name = 'next-segment'
  const guide = new THREE.Mesh(new THREE.TorusGeometry(0.075, 0.008, 6, 24), paleGold)
  guide.userData.toonSurface = { outline: false }
  nextSegment.add(guide)
  garland.add(nextSegment)

  const ringAnchorY = -Math.sqrt(RADIUS * RADIUS - 0.23 * 0.23)
  const tassels = [-1, 1].map((side) => {
    const label = side < 0 ? 'left' : 'right'
    // 3-turn cord lashing collar seated directly on the wreath core ring where each tassel attaches.
    const ringWrap = new THREE.Mesh(buildCordWrapCollar(0.0130, 0.0044, 3, 0.0082, 'x'), threadWrap)
    ringWrap.name = `tassel-ring-wrap-${label}`
    ringWrap.position.set(side * 0.23, ringAnchorY, 0)
    // Align local X with ring tangent (-sin(a), cos(a), 0) at (side*0.23, ringAnchorY).
    const ringAngle = Math.atan2(ringAnchorY, side * 0.23)
    ringWrap.rotation.z = ringAngle + Math.PI / 2
    ringWrap.userData.toonSurface = { outline: false }
    garland.add(ringWrap)

    const tassel = new THREE.Group()
    tassel.name = `flower-tassel-${label}`
    tassel.position.set(side * 0.23, -0.335, 0.045)

    // Continuous 2-ply twisted suspension cord running from the ring lashing down the tassel's central axis,
    // binding all 7 blossom tiers coherently without floppy flower deformation.
    const cordPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, ringAnchorY - (-0.335), -0.045),
      new THREE.Vector3(0, -0.018, -0.016),
      new THREE.Vector3(0, -0.036, 0),
      new THREE.Vector3(0, -0.26, 0),
      new THREE.Vector3(0, -0.530, 0),
    ])
    const tasselCord = new THREE.Mesh(
      buildTwistedCordTube(
        cordPath,
        44,
        10,
        (u) => (u < 0.14 ? THREE.MathUtils.lerp(0.0080, 0.0122, u / 0.14) : 0.0122),
        16,
        0.10,
        true,
      ),
      thread,
    )
    tasselCord.name = `tassel-cord-${label}`
    tasselCord.userData.toonSurface = { outline: false }

    // Snug top binding collar just above the first tier of jasmine buds.
    const topCollar = new THREE.Mesh(buildCordWrapCollar(0.0152, 0.0046, 2, 0.0082, 'y'), threadWrap)
    topCollar.name = `tassel-collar-${label}`
    topCollar.position.set(0, -0.028, 0)
    topCollar.userData.toonSurface = { outline: false }

    // Subtle mid-waist cord tie cinching the narrowed upper neck of the tassel.
    const waistCollar = new THREE.Mesh(buildCordWrapCollar(0.0172, 0.0042, 2, 0.0078, 'y'), threadWrap)
    waistCollar.name = `tassel-waist-collar-${label}`
    waistCollar.position.set(0, -0.228, 0)
    waistCollar.userData.toonSurface = { outline: false }

    // Compact braided stopper knot tucked cleanly inside the bottom rose rosette (preserves pedestal clearance).
    const endKnot = new THREE.Mesh(buildPinchedKnotGeometry(0.0150, 0.0130, 0.0150), threadWrap)
    endKnot.name = `tassel-end-knot-${label}`
    endKnot.position.set(0, -0.530, 0)
    endKnot.userData.toonSurface = { outline: false }

    const buds = flowers(56, cream, `tassel-buds-${side}`)
    for (let row = 0; row < 7; row++) for (let column = 0; column < 8; column++) {
      const a = (column / 8) * Math.PI * 2 + (row % 2) * 0.25
      const width = row < 2 ? 0.047 : row > 4 ? 0.065 : 0.037
      const direction = new THREE.Vector3(Math.cos(a) * 0.7, -0.6, Math.sin(a) * 0.7)
      const position = new THREE.Vector3(Math.cos(a) * width, -0.05 - row * 0.07, Math.sin(a) * width)
      setBud(buds, row * 8 + column, position, direction, row > 4 ? 0.92 : 0.76)
    }
    const accent = flowers(16, rose, `tassel-rose-${side}`)
    for (let row = 0; row < 2; row++) for (let column = 0; column < 8; column++) {
      const a = column * Math.PI / 4
      const direction = new THREE.Vector3(Math.cos(a), -0.45, Math.sin(a))
      setBud(accent, row * 8 + column, new THREE.Vector3(Math.cos(a) * 0.055, -0.12 - row * 0.39, Math.sin(a) * 0.055), direction, row ? 0.85 : 0.72)
    }
    tassel.add(tasselCord, topCollar, waistCollar, endKnot, buds, accent)
    garland.add(tassel)
    return tassel
  })

  const tie = new THREE.Group()
  tie.name = 'top-tie'
  tie.position.set(0, 0.545, 0.02)
  garland.add(tie)

  // Braided twin-cord gathering stem bridging the bow cleanly down into the wreath crown wrap.
  const tieStem = new THREE.Group()
  tieStem.name = 'top-tie-stem'
  tieStem.position.set(0, 0.026, 0.018)
  tie.add(tieStem)
  for (const side of [-1, 1]) {
    const stemCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.005, -0.004, 0),
      new THREE.Vector3(side * 0.008, -0.070, -0.018),
      new THREE.Vector3(side * 0.006, -0.144, -0.038),
    ])
    const stemMesh = new THREE.Mesh(buildTwistedCordTube(stemCurve, 20, 8, 0.0060, 5, 0.10, true), thread)
    stemMesh.name = `top-tie-stem-${side < 0 ? 'left' : 'right'}`
    stemMesh.userData.toonSurface = { outline: false }
    tieStem.add(stemMesh)
  }

  // Sculpted pinched center knot cushion + crossed binding wraps seated proudly above the upper jasmine buds.
  const knotCenter = new THREE.Group()
  knotCenter.name = 'top-tie-knot-center'
  knotCenter.position.set(0, 0.026, 0.018)
  tie.add(knotCenter)
  const knot = new THREE.Mesh(buildPinchedKnotGeometry(0.0195, 0.0155, 0.0145), thread)
  knot.name = 'top-tie-knot'
  knotCenter.add(knot)
  for (const [idx, tiltZ] of [0.38, -0.38].entries()) {
    const knotWrap = new THREE.Mesh(buildCordWrapCollar(0.0152, 0.0042, 1, 0.0076, 'x', 24, 8), threadWrap)
    knotWrap.name = `top-tie-knot-wrap-${idx}`
    knotWrap.rotation.z = tiltZ
    knotWrap.userData.toonSurface = { outline: false }
    knotCenter.add(knotWrap)
  }

  // Two sculpted 3D teardrop 2-ply bow loops seated cleanly above/forward of the crown buds (unbroken silhouette).
  const loops = [-1, 1].map((side) => {
    const loopPivot = new THREE.Group()
    loopPivot.name = `top-tie-loop-${side < 0 ? 'left' : 'right'}`
    loopPivot.position.set(0, 0.026, 0.018)
    const loopCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * 0.005, 0.002, 0.005),
      new THREE.Vector3(side * 0.025, 0.034, 0.013),
      new THREE.Vector3(side * 0.052, 0.039, 0.012),
      new THREE.Vector3(side * 0.054, 0.014, 0.007),
      new THREE.Vector3(side * 0.030, -0.002, 0.002),
      new THREE.Vector3(side * 0.005, -0.004, -0.002),
    ])
    const loopMesh = new THREE.Mesh(
      buildTwistedCordTube(
        loopCurve,
        44,
        10,
        (u) => 0.0066 + 0.0012 * Math.sin(u * Math.PI),
        7.5,
        0.10,
      ),
      thread,
    )
    loopMesh.name = `top-tie-loop-mesh-${side < 0 ? 'left' : 'right'}`
    loopPivot.add(loopMesh)
    tie.add(loopPivot)
    return loopPivot
  })

  // Twin gracefully S-curved 2-ply cord tails resting neatly over the front crown with whipped end knots.
  const tailPivots = [-1, 1].map((side) => {
    const label = side < 0 ? 'left' : 'right'
    const pivot = new THREE.Group()
    pivot.name = `top-tie-tail-pivot-${label}`
    pivot.position.set(side * 0.007, 0.018, 0.022)
    const tailCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(side * 0.022, -0.024, 0.020),
      new THREE.Vector3(side * 0.044, -0.056, 0.034),
      new THREE.Vector3(side * 0.054, -0.092, 0.038),
    ])
    const tailMesh = new THREE.Mesh(
      buildTwistedCordTube(
        tailCurve,
        24,
        10,
        (u) => THREE.MathUtils.lerp(0.0064, 0.0052, u),
        5.5,
        0.10,
        true,
      ),
      thread,
    )
    tailMesh.name = `top-tie-tail-${label}`
    const tipKnot = new THREE.Mesh(buildPinchedKnotGeometry(0.0076, 0.0088, 0.0076), threadWrap)
    tipKnot.name = `top-tie-tip-${label}`
    tipKnot.position.set(side * 0.054, -0.092, 0.038)
    tipKnot.userData.toonSurface = { outline: false }
    pivot.add(tailMesh, tipKnot)
    tie.add(pivot)
    return pivot
  })

  // A plain display pedestal keeps this adaptation about social gratitude.
  const pedestal = new THREE.Group()
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.59, 0.16, 40), pedestalMat)
  foot.position.y = 0.08
  const top = new THREE.Mesh(new THREE.CylinderGeometry(0.64, 0.63, 0.07, 48), pedestalMat)
  top.name = 'pedestal-top'
  top.position.y = 0.195
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.61, 0.014, 6, 48), paleGold)
  rim.rotation.x = Math.PI / 2
  rim.position.y = 0.233
  pedestal.add(foot, top, rim)
  world.add(pedestal)
  const tray = new THREE.Group()
  const trayBase = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.46, 0.045, 32), trayMat)
  trayBase.scale.set(1.25, 1, 0.4)
  trayBase.position.set(0, 0.27, 0.68)
  tray.add(trayBase)
  world.add(tray)

  const ray = createPointerRay(canvas, camera)
  const touch = createTouchTarget(canvas, camera, scene)
  const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HELD.z)
  const point = new THREE.Vector3(), grabOffset = new THREE.Vector3()
  const ringFlowers = () => {
    const meshes: THREE.Object3D[] = []
    garland.traverse((object) => {
      if (object instanceof THREE.InstancedMesh && object !== clusters[assembled]?.flowers) meshes.push(object)
    })
    return meshes
  }
  const active = () => !disposed && started && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const cueActive = () => active() && !motion && !completed && !placed && pointers.size <= 1
  clusters.forEach((cluster, index) => addInteractionCue(cluster.flowers, {
    kind: 'drag', label: '拖茉莉到花环', anchor: [0, 0, 0.095], priority: 2,
    enabled: () => cueActive() && checkpoint === 0 && assembled === index,
    destination: nextSegment, targetLabel: '花环空段',
  }))
  addInteractionCue(firstRing.flowers, {
    kind: 'drag', label: '向上拖花环系结', anchor: [0, 0, 0.095], priority: 2,
    enabled: () => cueActive() && checkpoint === 1,
    destination: () => drag?.kind==='tie'?tieGoal.clone():tie.getWorldPosition(new THREE.Vector3()), targetLabel: '顶端绳结',
  })
  addInteractionCue(firstRing.flowers, {
    kind: 'drag', label: '拖花环到小台', anchor: [0, 0, 0.095], priority: 2,
    enabled: () => cueActive() && checkpoint === 2,
    destination: () => offsetGuide(REST.clone(),firstRing.flowers.localToWorld(new THREE.Vector3(0,0,.095)),garland.getWorldPosition(new THREE.Vector3())), targetLabel: '奶油色小台',
  })
  const updateMatrices = () => { world.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const tieGoal=new THREE.Vector3()
  let arrivalRadius=22
  const project=(point:THREE.Vector3)=>{const q=point.project(camera),r=canvas.getBoundingClientRect();return new THREE.Vector2(r.left+(q.x+1)*r.width/2,r.top+(1-q.y)*r.height/2)}
  const offsetGuide=(goal:THREE.Vector3,grip:THREE.Vector3,contact:THREE.Vector3)=>{const g=goal.project(camera),a=grip.project(camera),b=contact.project(camera);g.x+=a.x-b.x;g.y+=a.y-b.y;return g.unproject(camera)}
  const onFlowers = (x: number, y: number) => {
    if (!active() || motion || completed || placed) return false
    updateMatrices()
    return touch.hit(x, y, checkpoint === 0 ? [clusters[assembled].flowers] : ringFlowers())
  }
  const nearNextSegment = (x: number, y: number) => {
    updateMatrices()
    return touch.hit(x, y, nextSegment, { ignore: clusters[assembled].group })
  }
  const onPedestal = (x: number, y: number) => {
    updateMatrices()
    return touch.hit(x, y, top, { ignore: garland })
  }
  const nearTie = (x: number, y: number) => {
    updateMatrices()
    return touch.hit(x, y, tie)
  }

  const sync = () => {
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = completed
    actionBtn.disabled = Boolean(motion)
    actionBtn.setAttribute('aria-disabled', String(Boolean(motion)))
    wishSlot.hidden = checkpoint !== 2 || completed
    wishHandle?.setEnabled(checkpoint === 2 && !completed && !motion)
    hitLayer.style.pointerEvents = completed || placed ? 'none' : 'auto'
    tray.visible = checkpoint === 0
    nextSegment.visible = checkpoint === 0
    if (checkpoint === 0) nextSegment.position.copy(clusters[assembled].ring).setZ(0.13)
    const label = checkpoint === 0 ? COPY.stringTap : checkpoint === 1 ? COPY.tieTap : placed ? COPY.thanksTap : COPY.placeTap
    const hint = motion ? motion.kind === 'cluster' ? COPY.stringing : motion.kind === 'tie' ? COPY.tying : COPY.placing
      : completed ? COPY.done : checkpoint === 0 ? COPY.string : checkpoint === 1 ? COPY.tie : placed ? COPY.placed : COPY.place
    setSafeText(actionBtn, label, assertSafeCopy)
    setSafeText(hintEl, hint, assertSafeCopy)
  }
  const setTie = () => {
    const loose = 1 - tied
    loops.forEach((loop) => loop.scale.set(1 + loose * 0.36, 1 + loose * 0.32, 1))
    knotCenter.scale.setScalar(1 + loose * 0.08)
    tieStem.scale.set(1, 0.58 + loose * 0.42, 1)
    tailPivots.forEach((pivot, i) => {
      const side = i === 0 ? -1 : 1
      pivot.rotation.z = side * loose * 0.24
    })
    tie.position.y = 0.545 - tied * 0.045
  }
  const checkpointReached = (next: number) => {
    if (checkpoint >= next) return
    checkpoint = next
    sync()
    ctx.onProgress?.(next)
  }
  const finish = (thanks?: string) => {
    if (!active() || completed || checkpoint !== 2 || !placed) return
    // Guard before invoking host callbacks, including a reentrant save handler.
    completed = true
    checkpoint = 3
    sync()
    if (thanks) ctx.saveWish?.(thanks)
    ctx.onProgress?.(3)
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const finishMotion = () => {
    if (!motion) return
    const ended = motion
    motion = null
    if (ended.kind === 'cluster') {
      const cluster = clusters[assembled]
      cluster.group.position.copy(cluster.ring)
      cluster.group.rotation.z = 0
      cluster.group.scale.setScalar(1)
      assembled++
      if (assembled === CLUSTERS) checkpointReached(1)
    } else if (ended.kind === 'tie') {
      garland.position.copy(HELD)
      tied = 1
      setTie()
      checkpointReached(2)
    } else {
      garland.position.copy(REST)
      garland.rotation.x = -0.04
      placed = true
    }
    sync()
    if (ended.complete) finish(ended.thanks)
  }
  const placeCluster = () => {
    if (!active() || motion || checkpoint !== 0 || assembled >= CLUSTERS) return
    const cluster = clusters[assembled]
    motion = { kind: 'cluster', elapsed: 0, duration: 0.52, from: cluster.group.position.clone(), scale: cluster.group.scale.x, rotation: cluster.group.rotation.z }
    fx.impact({ freqs: [659.25, 987.77], duration: 0.22, gain: 0.025 })
    sync()
    if (reduced()) finishMotion()
  }
  const closeTie = () => {
    if (!active() || motion || checkpoint !== 1) return
    motion = { kind: 'tie', elapsed: 0, duration: 0.6, from: garland.position.clone(), scale: 1, rotation: 0 }
    fx.impact({ freqs: [783.99, 1174.66], duration: 0.3, gain: 0.025 })
    sync()
    if (reduced()) finishMotion()
  }
  const placeGarland = (thanks?: string, complete = false) => {
    if (!active() || motion || checkpoint !== 2 || completed) return
    if (placed) { if (complete) finish(thanks); return }
    motion = { kind: 'place', elapsed: 0, duration: 0.7, from: garland.position.clone(), scale: 1, rotation: garland.rotation.x, thanks, complete }
    fx.impact({ freqs: [523.25, 783.99], duration: 0.42, gain: 0.035 })
    sync()
    if (reduced()) finishMotion()
  }
  const submitThanks = (text: string) => {
    const thanks = text.trim()
    if (!active() || checkpoint !== 2 || motion || completed || !thanks || thanks.length > 40) return
    fx.prepare()
    placeGarland(thanks, true)
  }
  const onAction = () => {
    if (!active() || motion || completed || pointers.size > 0) return
    fx.prepare()
    if (checkpoint === 0) placeCluster()
    else if (checkpoint === 1) closeTie()
    else placeGarland(undefined, true)
  }
  const releaseCapture = (id: number) => {
    try { if (hitLayer.hasPointerCapture?.(id)) hitLayer.releasePointerCapture(id) } catch { /* A canceled pointer already lost capture. */ }
  }
  const cancelDrag = () => {
    const abandoned = drag
    drag = null
    dropFeedback.clear()
    if (!abandoned) return
    if (abandoned.kind === 'cluster' && checkpoint === 0) {
      const cluster = clusters[assembled]
      cluster.group.position.copy(cluster.home)
      cluster.group.rotation.z = cluster.trayRotation
      cluster.group.scale.setScalar(0.52)
    } else garland.position.copy(HELD)
    releaseCapture(abandoned.id)
  }
  const onDown = (event: PointerEvent) => {
    if (pointers.size > 0) { pointers.add(event.pointerId); cancelDrag(); return }
    if (event.isPrimary === false || event.button !== 0 || !onFlowers(event.clientX, event.clientY)) return
    pointers.add(event.pointerId)
    drag = { id: event.pointerId, kind: checkpoint === 0 ? 'cluster' : checkpoint === 1 ? 'tie' : 'garland', x: event.clientX, y: event.clientY }
    const held = checkpoint === 0 ? clusters[assembled].group : garland
    // Move flowers in a camera-facing plane through the visible marker. Drop
    // readiness is measured in screen space, so depth never shrinks its area.
    const origin = checkpoint === 0 ? clusters[assembled].flowers.localToWorld(new THREE.Vector3(0,0,.095)) : firstRing.flowers.localToWorld(new THREE.Vector3(0,0,.095))
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), origin)
    if (ray.aim(event.clientX, event.clientY).ray.intersectPlane(plane, point)) grabOffset.copy(held.getWorldPosition(new THREE.Vector3())).sub(point)
    tieGoal.copy(tie.getWorldPosition(new THREE.Vector3()))
    const from=project(held.getWorldPosition(new THREE.Vector3())),goal=project(checkpoint===0?nextSegment.getWorldPosition(new THREE.Vector3()):checkpoint===1?tieGoal.clone():REST.clone())
    arrivalRadius=Math.min(22,from.distanceTo(goal)*.42)
    fx.prepare()
    event.preventDefault()
    try { hitLayer.setPointerCapture(event.pointerId) } catch { /* Older embedded browsers can still use the button. */ }
  }
  const readyAt = (x: number, y: number) => {
    if(!drag || !insideCanvas(canvas,x,y))return false
    if(drag.kind==='cluster'){
      const contact=projectTouchPoint(canvas,camera,clusters[assembled].flowers,[0,0,.095]),goal=project(nextSegment.getWorldPosition(new THREE.Vector3()))
      return !!contact && Math.hypot(contact.x-goal.x,contact.y-goal.y)<=arrivalRadius && touch.hit(contact.x,contact.y,nextSegment,{ignore:clusters[assembled].group})
    }
    const contact=drag.kind==='tie'?firstRing.flowers.localToWorld(new THREE.Vector3(0,0,.095)):garland.getWorldPosition(new THREE.Vector3()),goal=drag.kind==='tie'?tieGoal.clone():REST.clone()
    return project(contact).distanceTo(project(goal))<=arrivalRadius
  }
  const acceptHeld = () => {
    if(!drag)return
    const ending=drag;drag=null;dropFeedback.clear();releaseCapture(ending.id)
    if(ending.kind==='cluster')placeCluster();else if(ending.kind==='tie')closeTie();else placeGarland()
  }
  const moveTo = (x: number, y: number) => {
    if (!drag) return
    updateMatrices()
    if (!ray.aim(x, y).ray.intersectPlane(plane, point)) return
    point.add(grabOffset)
    if (drag.kind === 'cluster') {
      clusters[assembled].group.position.copy(garland.worldToLocal(point))
    } else {
      garland.position.set(THREE.MathUtils.clamp(point.x, -0.6, 0.6), THREE.MathUtils.clamp(point.y, 0.85, 1.65), point.z)
    }
    updateMatrices(); dropFeedback.setReady(readyAt(x, y))
  }
  const onMove = (event: PointerEvent) => {
    if (!drag) return
    if (drag.id !== event.pointerId || !active() || event.buttons === 0) { cancelDrag(); return }
    moveTo(event.clientX, event.clientY)
    if(readyAt(event.clientX,event.clientY))acceptHeld()
  }
  const onUp = (event: PointerEvent) => {
    const ending = drag
    if (!ending || ending.id !== event.pointerId || pointers.size !== 1 || !active()) {
      cancelDrag(); pointers.delete(event.pointerId); return
    }
    moveTo(event.clientX, event.clientY)
    const hit = readyAt(event.clientX, event.clientY)
    // Clear ownership before release: lostpointercapture must not cancel a
    // successfully released gesture or the animation it starts.
    if (hit) {
      drag = null
      dropFeedback.clear()
      pointers.delete(event.pointerId)
      releaseCapture(event.pointerId)
      if (ending.kind === 'cluster') placeCluster()
      else if (ending.kind === 'tie') closeTie()
      else placeGarland()
    } else { cancelDrag(); pointers.delete(event.pointerId) }
  }
  const onCancel = (event: PointerEvent) => { cancelDrag(); pointers.delete(event.pointerId) }
  const onLostCapture = (event: PointerEvent) => {
    if (drag?.id === event.pointerId) cancelDrag()
    pointers.delete(event.pointerId)
  }
  const onOtherDown = (event: PointerEvent) => {
    if (drag && event.pointerId !== drag.id) {
      pointers.add(event.pointerId)
      cancelDrag()
    }
  }
  const onWindowEnd = (event: PointerEvent) => {
    if (!hitLayer.contains(event.target as Node) && drag?.id === event.pointerId) cancelDrag()
    pointers.delete(event.pointerId)
  }
  const onBlur = () => { focused = false; cancelDrag(); pointers.clear(); sync() }
  const onFocus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.35 + portraitBoost(aspect, 3.1)
    camera.position.copy(cameraHome)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }
  setTie()

  return {
    start() {
      if (disposed || started) return
      started = true
      // Restoration applies state directly; no action handlers or callbacks.
      checkpoint = Math.min(3, Math.max(0, Math.floor(ctx.initialProgress ?? 0)))
      if (checkpoint >= 1) {
        assembled = CLUSTERS
        for (const cluster of clusters) {
          cluster.group.position.copy(cluster.ring)
          cluster.group.scale.setScalar(1)
          cluster.group.rotation.z = 0
        }
      }
      tied = checkpoint >= 2 ? 1 : 0
      if (checkpoint === 3) {
        completed = true
        placed = true
        garland.position.copy(REST)
        garland.rotation.x = -0.04
      }
      setTie()
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      wishHandle = ctx.gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: submitThanks })
      wishHandle.mount(wishSlot, {})
      const input = wishSlot.querySelector('input')
      if (input) {
        bindSceneAttribute(input, 'aria-label', COPY.thanksLabel)
        bindSceneAttribute(input, "placeholder", COPY.thanksPlaceholder)
      }
      stopClaim = claimObjectTouches(hitLayer, onFlowers)
      hitLayer.addEventListener('pointerdown', onDown)
      hitLayer.addEventListener('pointermove', onMove)
      hitLayer.addEventListener('pointerup', onUp)
      hitLayer.addEventListener('pointercancel', onCancel)
      hitLayer.addEventListener('lostpointercapture', onLostCapture)
      window.addEventListener('pointerdown', onOtherDown, true)
      window.addEventListener('pointerup', onWindowEnd)
      window.addEventListener('pointercancel', onWindowEnd)
      window.addEventListener('blur', onBlur)
      window.addEventListener('focus', onFocus)
      actionBtn.addEventListener('click', onAction)
      sync()
    },
    update(dt) {
      if (disposed || !started) return
      if (!active()) { cancelDrag(); pointers.clear(); return }
      const delta = Math.max(0, Math.min(dt, 0.1))
      const less = reduced()
      clock += less ? 0 : delta
      wishHandle?.update(delta)
      if (motion) {
        motion.elapsed += delta
        const t = less ? 1 : Math.min(1, motion.elapsed / motion.duration)
        const ease = smooth(t)
        if (motion.kind === 'cluster') {
          const cluster = clusters[assembled]
          cluster.group.position.lerpVectors(motion.from, cluster.ring, ease)
          cluster.group.position.y += less ? 0 : Math.sin(t * Math.PI) * 0.085
          cluster.group.scale.setScalar(THREE.MathUtils.lerp(motion.scale, 1, ease))
          cluster.group.rotation.z = THREE.MathUtils.lerp(motion.rotation, 0, ease)
        } else if (motion.kind === 'tie') {
          garland.position.lerpVectors(motion.from,HELD,ease)
          tied = ease
          setTie()
        } else {
          garland.position.lerpVectors(motion.from, REST, ease)
          garland.rotation.x = THREE.MathUtils.lerp(motion.rotation, -0.04, ease)
        }
        if (t === 1) finishMotion()
      }
      // Gentle delayed pendulum weight in the two hanging flower tassels after tying,
      // plus subtle inertial lag while tying or placing onto the pedestal. Stops completely
      // with reduced motion and while paused.
      const placeLag = !less && motion?.kind === 'place' ? Math.sin(Math.min(1, motion.elapsed / motion.duration) * Math.PI) * 0.095 : 0
      const tieKick = !less && motion?.kind === 'tie' ? Math.sin(Math.min(1, motion.elapsed / motion.duration) * Math.PI) * 0.045 : 0
      tassels.forEach((tassel, i) => {
        const side = i === 0 ? -1 : 1
        const targetZ = less
          ? 0
          : (checkpoint < 2 ? 0 : Math.sin(clock * 1.3 - i * 0.45) * 0.022) + side * tieKick
        const targetX = less ? 0 : placeLag
        const blend = 1 - Math.exp(-delta * 6)
        tassel.rotation.z = less ? 0 : THREE.MathUtils.lerp(tassel.rotation.z, targetZ, blend)
        tassel.rotation.x = less ? 0 : THREE.MathUtils.lerp(tassel.rotation.x, targetX, blend)
      })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      cancelDrag()
      dropFeedback.dispose()
      pointers.clear()
      motion = null
      stopResize()
      stopClaim()
      hitLayer.removeEventListener('pointerdown', onDown)
      hitLayer.removeEventListener('pointermove', onMove)
      hitLayer.removeEventListener('pointerup', onUp)
      hitLayer.removeEventListener('pointercancel', onCancel)
      hitLayer.removeEventListener('lostpointercapture', onLostCapture)
      window.removeEventListener('pointerdown', onOtherDown, true)
      window.removeEventListener('pointerup', onWindowEnd)
      window.removeEventListener('pointercancel', onWindowEnd)
      window.removeEventListener('blur', onBlur)
      window.removeEventListener('focus', onFocus)
      actionBtn.removeEventListener('click', onAction)
      wishHandle?.dispose()
      wishHandle = null
      fx.dispose()
      styleRenderer.dispose()
      instances.forEach((mesh) => mesh.dispose())
      cordTex.map.dispose()
      cordTex.bump.dispose()
      disposeTree(world)
      lights.key.dispose()
      lights.rim.dispose()
      scene.remove(world, lights.ambient, lights.hemi, lights.key, lights.rim)
      world.clear()
      renderer.dispose()
      renderer.forceContextLoss()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
