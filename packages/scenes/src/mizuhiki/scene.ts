import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { getLocale, subscribeLocale } from '@wbr/i18n'
import { bindSceneText, sceneCopy, sceneTemplate } from '../scene-localization'
import { wrapCanvasText } from '../canvas-text'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import { addObjectCradle } from '../cozy-furniture'
import { createPathSweep } from '../path-sweep'
import { createTouchTarget } from '../touch-target'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, claimObjectTouches, createPointerRay,
  createSceneFeedback, createStepOverlay, createWarmStage, disposeTree,
  observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'

const COPY = {
  title: '水引结愿',
  steps: '步骤',
  loop: '为赠礼纸封系一份祝愿。拖住绳端光圈，依次经过金色提示点绕环。',
  thread: '拖住绳端，沿另一侧的金色提示点穿过交会处，向左轻拉收结。',
  wish: '想着收礼的人，静静放好这份赠礼心意。',
  done: '水引结饰已系好，纸封上留着送给对方的祝愿。',
  loopAction: '绕出一个环',
  threadAction: '穿环并收紧',
  wishAction: '静放赠礼心意',
  movingLoop: '纸绳沿环轻轻弯起…',
  movingThread: '两侧相接，慢慢收拢…',
} as const

type Checkpoint = 0 | 1 | 2 | 3
type Coord = readonly [number, number, number]

const CORD_RADIUS = 0.0086
const STRAND_SPACING = 0.0205
const BAND_RADIUS = 0.0084
const BAND_Y = 0.115

// Deliberate paths round each lobe, then through the crossing. This is a
// decorative, source-informed knot, with no named-knot claim.
const ROUTES: readonly (readonly Coord[])[] = [
  [[-0.62, 0.31, 0.48], [-0.70, 0.31, 0.15], [-0.57, 0.31, -0.20], [-0.32, 0.31, -0.38], [-0.05, 0.31, -0.27], [0.12, 0.31, 0]],
  [[0.25, 0.31, 0.40], [0.55, 0.31, 0.25], [0.66, 0.31, -0.05], [0.52, 0.31, -0.35], [0.22, 0.31, -0.39], [0.03, 0.31, -0.10], [-0.30, 0.31, 0.19]],
]

// Seated paper-cord centerline forms resting cleanly on the washi envelope (y ≈ 0.115–0.125)
// and lifting strictly where strands cross over the horizontal binding band (y ≈ 0.139) or
// weave cleanly over/under one another in distinct non-colliding vertical layers.
const CORD_FORMS: readonly (readonly Coord[])[] = [
  // Stage 0: Open 5-strand paper ribbon seated on the envelope, gently arching over the horizontal band.
  [
    [0.50, 0.117, 0.43],
    [0.24, 0.122, 0.27],
    [0.04, 0.141, 0.04],
    [-0.12, 0.141, 0.05],
    [-0.34, 0.122, 0.28],
    [-0.62, 0.117, 0.48],
  ],
  // Stage 1: Left bow loop formed, arching over the horizontal band at the left lobe and over Pass 1 at center.
  [
    [0.26, 0.118, 0.40],
    [0.14, 0.124, 0.23],
    [0.01, 0.141, 0.04],
    [-0.34, 0.125, 0.26],
    [-0.64, 0.140, 0.05],
    [-0.60, 0.128, -0.25],
    [-0.32, 0.122, -0.39],
    [-0.06, 0.138, -0.22],
    [0.13, 0.165, 0.01],
  ],
  // Stage 2/3: Completed 3-lobe interwoven mizuhiki knot with verified over-under vertical stacking:
  // Horizontal band = 0.115; Pass 3 (center low) = 0.138; Pass 1 (SW->NE) = 0.161;
  // Pass 2 (SE->NW) = 0.184; Pass 4 (lower lobe -> Tail B) weaves smoothly OVER Pass 3 & Pass 1.
  [
    [-0.31, 0.118, 0.22],   // Tail A (seated on paper)
    [-0.10, 0.148, 0.08],   // Approach center (rising to Layer 2)
    [0.08, 0.161, -0.05],   // Pass 1 center (Layer 2 = 0.161)
    [0.34, 0.130, -0.28],   // Out to upper-right lobe
    [0.57, 0.126, -0.34],   // Right lobe top-right
    [0.67, 0.141, -0.04],   // Right lobe outer bend (clears horizontal band 0.115!)
    [0.54, 0.124, 0.20],    // Right lobe lower return
    [0.24, 0.148, 0.17],    // Approach center (rising to Layer 3)
    [-0.02, 0.184, -0.01],  // Pass 2 center (Layer 3 = 0.184, OVER Pass 1 = 0.161!)
    [-0.29, 0.134, -0.28],  // Out to upper-left lobe
    [-0.56, 0.126, -0.34],  // Left lobe top-left
    [-0.67, 0.141, -0.03],  // Left lobe outer bend (clears horizontal band 0.115!)
    [-0.52, 0.124, 0.22],   // Left lobe lower return
    [-0.22, 0.126, 0.24],   // Sweep inward at Layer 1
    [-0.04, 0.138, 0.12],   // Pass 3 center-low (Layer 1 = 0.138, OVER band, UNDER Pass 1/2!)
    [0.16, 0.124, 0.34],    // Descend into right leg of lower lobe
    [0.22, 0.120, 0.56],    // Lower lobe bottom-right
    [-0.01, 0.119, 0.63],   // Lower lobe bottom crest (generous radius, no kink)
    [-0.20, 0.120, 0.50],   // Lower lobe bottom-left
    [-0.14, 0.136, 0.30],   // Rise out of lower lobe
    [-0.01, 0.164, 0.14],   // Pass 4 front-weave lock (OVER Pass 3 = 0.138!)
    [0.23, 0.150, 0.26],    // Exit OVER lower-lobe right leg (0.124 -> +0.026 clearance!)
    [0.49, 0.118, 0.47],    // Tail B (seated on paper)
  ],
]

function curve(points: readonly Coord[]) {
  return new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), false, 'centripetal')
}

function ease(t: number) {
  const x = THREE.MathUtils.clamp(t, 0, 1)
  return x * x * (3 - 2 * x)
}

/**
 * Evaluates a closed, outward-wound subdivided folded washi panel over a 4-corner
 * XZ trapezoid with normalized [0, 1] UVs and separate perimeter wall normals so
 * `ritual-optics` `layout: 'sheet'` frames each folded paper edge cleanly without
 * flat-polygon Z-fighting or shadow acne.
 */
function createFoldedWashiPanel(opts: {
  xTopLeft: number
  xTopRight: number
  xBotLeft: number
  xBotRight: number
  zTop: number
  zBot: number
  cols: number
  rows: number
  cornerRadius?: number
  evalSurface: (x: number, z: number, u: number, v: number) => { yTop: number; yBot: number; shade: number }
}): THREE.BufferGeometry {
  const { xTopLeft, xTopRight, xBotLeft, xBotRight, zTop, zBot, cols, rows, evalSurface } = opts
  const cornerR = opts.cornerRadius ?? 0
  const stride = cols + 1
  const gridVerts = (cols + 1) * (rows + 1)

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const topPts: [number, number, number][] = new Array(gridVerts)
  const botPts: [number, number, number][] = new Array(gridVerts)
  const shades: number[] = new Array(gridVerts)

  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    const zRaw = THREE.MathUtils.lerp(zTop, zBot, v)
    const xL = THREE.MathUtils.lerp(xTopLeft, xBotLeft, v)
    const xR = THREE.MathUtils.lerp(xTopRight, xBotRight, v)
    const zEdge = Math.min(v, 1 - v) * Math.abs(zBot - zTop)
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      let x = THREE.MathUtils.lerp(xL, xR, u)
      let z = zRaw
      if (cornerR > 0) {
        const wSpan = Math.abs(xR - xL)
        const xEdge = Math.min(u, 1 - u) * wSpan
        if (xEdge < cornerR && zEdge < cornerR) {
          const dx = cornerR - xEdge
          const dz = cornerR - zEdge
          const d = Math.hypot(dx, dz)
          if (d > cornerR) {
            const pull = d - cornerR
            x += (u < 0.5 ? 1 : -1) * (dx / d) * pull
            z += (v < 0.5 ? 1 : -1) * (dz / d) * pull
          }
        }
      }
      const { yTop, yBot, shade } = evalSurface(x, z, u, v)
      const idx = iv * stride + iu
      topPts[idx] = [x, yTop, z]
      botPts[idx] = [x, yBot, z]
      shades[idx] = shade
    }
  }

  // Top face vertices (indices 0 .. gridVerts - 1).
  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      const p = topPts[idx]!
      const s = shades[idx]!
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(s, s, s)
    }
  }
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = iv * stride + iu
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, d, b, b, d, c)
    }
  }

  // Bottom face vertices (indices gridVerts .. 2 * gridVerts - 1).
  const botBase = gridVerts
  for (let iv = 0; iv <= rows; iv++) {
    const v = iv / rows
    for (let iu = 0; iu <= cols; iu++) {
      const u = iu / cols
      const idx = iv * stride + iu
      const p = botPts[idx]!
      const s = shades[idx]! * 0.92
      positions.push(p[0], p[1], p[2])
      uvs.push(u, v)
      colors.push(s, s, s)
    }
  }
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const a = botBase + iv * stride + iu
      const b = a + 1
      const c = a + stride + 1
      const d = a + stride
      indices.push(a, b, d, b, c, d)
    }
  }

  // Closed CCW perimeter walls (separate vertices for crisp paper-thickness edge normals).
  const ring: number[] = []
  for (let iv = 0; iv < rows; iv++) ring.push(iv * stride) // Left edge (+Z)
  for (let iu = 0; iu < cols; iu++) ring.push(rows * stride + iu) // Bottom edge (+X)
  for (let iv = rows; iv > 0; iv--) ring.push(iv * stride + cols) // Right edge (-Z)
  for (let iu = cols; iu > 0; iu--) ring.push(iu) // Top edge (-X)

  for (let k = 0; k < ring.length; k++) {
    const i0 = ring[k]!
    const i1 = ring[(k + 1) % ring.length]!
    const t0 = topPts[i0]!, b0 = botPts[i0]!, b1 = botPts[i1]!, t1 = topPts[i1]!
    const s0 = shades[i0]! * 0.96, s1 = shades[i1]! * 0.96
    const base = positions.length / 3
    positions.push(
      t0[0], t0[1], t0[2],
      b0[0], b0[1], b0[2],
      b1[0], b1[1], b1[2],
      t1[0], t1[1], t1[2],
    )
    uvs.push(0.02, 0.5, 0.02, 0.5, 0.04, 0.5, 0.04, 0.5)
    colors.push(s0, s0, s0, s0 * 0.90, s0 * 0.90, s0 * 0.90, s1 * 0.90, s1 * 0.90, s1 * 0.90, s1, s1, s1)
    indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Closed thin folded-paper polygon slab for decorative folded corner accents.
 * Automatically orients the contour CCW viewed from +Y for clean outward normals.
 */
function createFoldedAccentSlab(
  rawPoints: readonly (readonly [number, number])[],
  yBot: number,
  yTop: number,
  ridgeLift = 0,
): THREE.BufferGeometry {
  // Compute signed area in XZ: positive means CW viewed from +Y (since +Z points down on screen).
  let area2 = 0
  for (let i = 0; i < rawPoints.length; i++) {
    const [x0, z0] = rawPoints[i]!
    const [x1, z1] = rawPoints[(i + 1) % rawPoints.length]!
    area2 += x0 * z1 - x1 * z0
  }
  const pts = area2 < 0 ? [...rawPoints] : [...rawPoints].reverse()
  const n = pts.length
  let cx = 0, cz = 0
  let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity
  for (const [x, z] of pts) {
    cx += x; cz += z
    if (x < minX) minX = x; if (x > maxX) maxX = x
    if (z < minZ) minZ = z; if (z > maxZ) maxZ = z
  }
  cx /= n; cz /= n
  const spanX = Math.max(1e-4, maxX - minX)
  const spanZ = Math.max(1e-4, maxZ - minZ)

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  // Top fan with optional subtle origami fold ridge at centroid.
  const topCenter = 0
  positions.push(cx, yTop + ridgeLift, cz)
  uvs.push((cx - minX) / spanX, (cz - minZ) / spanZ)
  colors.push(1.02, 1.02, 1.02)
  for (const [x, z] of pts) {
    positions.push(x, yTop, z)
    uvs.push((x - minX) / spanX, (z - minZ) / spanZ)
    colors.push(0.95, 0.95, 0.95)
  }
  for (let i = 0; i < n; i++) {
    indices.push(topCenter, 1 + i, 1 + ((i + 1) % n))
  }

  // Bottom fan.
  const botCenter = positions.length / 3
  positions.push(cx, yBot, cz)
  uvs.push(0.5, 0.5)
  colors.push(0.88, 0.88, 0.88)
  for (const [x, z] of pts) {
    positions.push(x, yBot, z)
    uvs.push((x - minX) / spanX, (z - minZ) / spanZ)
    colors.push(0.86, 0.86, 0.86)
  }
  for (let i = 0; i < n; i++) {
    indices.push(botCenter, botCenter + 1 + ((i + 1) % n), botCenter + 1 + i)
  }

  // Outward perimeter walls.
  for (let i = 0; i < n; i++) {
    const [x0, z0] = pts[i]!
    const [x1, z1] = pts[(i + 1) % n]!
    const base = positions.length / 3
    positions.push(x0, yTop, z0, x0, yBot, z0, x1, yBot, z1, x1, yTop, z1)
    uvs.push(0.05, 0.5, 0.05, 0.5, 0.1, 0.5, 0.1, 0.5)
    colors.push(0.92, 0.92, 0.92, 0.84, 0.84, 0.84, 0.84, 0.84, 0.84, 0.92, 0.92, 0.92)
    indices.push(base, base + 1, base + 3, base + 1, base + 2, base + 3)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Allocates a closed-end (flush-capped) paper-cord tube BufferGeometry whose vertex
 * positions and normals can be rewritten in-place with zero allocations.
 */
function createCappedCordGeometry(tubeSegments: number, radialSegments: number, dynamic: boolean): THREE.BufferGeometry {
  const ringStride = radialSegments + 1
  const bodyVerts = (tubeSegments + 1) * ringStride
  // Add start cap (1 center + radialSegments rim) and end cap (1 center + radialSegments rim).
  const capVerts = (1 + radialSegments) * 2
  const totalVerts = bodyVerts + capVerts
  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const bodyIndices = tubeSegments * radialSegments * 6
  const capIndices = radialSegments * 6
  const indices = new Uint32Array(bodyIndices + capIndices)

  for (let i = 0; i <= tubeSegments; i++) {
    const u = i / tubeSegments
    for (let j = 0; j <= radialSegments; j++) {
      const idx = i * ringStride + j
      uvs[idx * 2] = u
      uvs[idx * 2 + 1] = j / radialSegments
    }
  }

  let cursor = 0
  for (let i = 0; i < tubeSegments; i++) {
    for (let j = 0; j < radialSegments; j++) {
      const a = i * ringStride + j
      const b = (i + 1) * ringStride + j
      const c = (i + 1) * ringStride + j + 1
      const d = i * ringStride + j + 1
      // Outward winding: (b - a) x (d - a) = (+T) x (+up) = +lat (outward radial normal).
      indices[cursor++] = a
      indices[cursor++] = b
      indices[cursor++] = d
      indices[cursor++] = b
      indices[cursor++] = c
      indices[cursor++] = d
    }
  }

  // Start cap (faces -tangent)
  const startCenter = bodyVerts
  const startRim = startCenter + 1
  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments
    indices[cursor++] = startCenter
    indices[cursor++] = startRim + j
    indices[cursor++] = startRim + next
  }

  // End cap (faces +tangent)
  const endCenter = startRim + radialSegments
  const endRim = endCenter + 1
  for (let j = 0; j < radialSegments; j++) {
    const next = (j + 1) % radialSegments
    indices[cursor++] = endCenter
    indices[cursor++] = endRim + next
    indices[cursor++] = endRim + j
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  const normAttr = new THREE.BufferAttribute(normals, 3)
  if (dynamic) {
    posAttr.setUsage(THREE.DynamicDrawUsage)
    normAttr.setUsage(THREE.DynamicDrawUsage)
  }
  geometry.setAttribute('position', posAttr)
  geometry.setAttribute('normal', normAttr)
  geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
  geometry.setIndex(new THREE.BufferAttribute(indices, 1))
  return geometry
}

const _tan = new THREE.Vector3()
const _lat = new THREE.Vector3()
const _up = new THREE.Vector3()
const _cPt = new THREE.Vector3()

/**
 * Rewrites a capped mizuhiki paper-cord strand in-place along `centres`, applying:
 * - Parallel ribbon-band offset (with slight pinch tightening inside the central knot)
 * - Subtle spiral silk/washi-wrap cord micro-relief
 * - Flush solid paper end-caps at both cut tips (no hollow pipe ends!)
 */
function writeMizuhikiStrandInPlace(
  geometry: THREE.BufferGeometry,
  centres: readonly THREE.Vector3[],
  tubeSegments: number,
  radialSegments: number,
  radius: number,
  lateralOffset: number,
  options: { turns?: number; plyDepth?: number; phase?: number; pinchCenter?: boolean; fixedLateralZ?: boolean } = {},
) {
  const positions = geometry.getAttribute('position') as THREE.BufferAttribute
  const normals = geometry.getAttribute('normal') as THREE.BufferAttribute
  const ringStride = radialSegments + 1
  const turns = options.turns ?? 38
  const plyDepth = options.plyDepth ?? 0.042
  const phase = options.phase ?? 0
  const pinchCenter = options.pinchCenter ?? false
  const fixedLateralZ = options.fixedLateralZ ?? false

  for (let i = 0; i <= tubeSegments; i++) {
    const u = i / tubeSegments
    const prev = centres[Math.max(0, i - 1)]!
    const next = centres[Math.min(tubeSegments, i + 1)]!
    _tan.subVectors(next, prev)
    if (_tan.lengthSq() < 1e-12) _tan.set(1, 0, 0)
    else _tan.normalize()

    if (fixedLateralZ) {
      // Exact continuous XY-plane ribbon frame: lateral = +Z, outward normal = +Z x T.
      // Never flips sign around the vertical side walls of the beveled envelope.
      _lat.set(0, 0, 1)
      _up.crossVectors(_lat, _tan).normalize()
      _lat.crossVectors(_tan, _up).normalize()
    } else {
      // Planar-stabilized horizontal ribbon frame: keeps all 5 strands lying neatly flat
      // side-by-side on the envelope while tilting cleanly across vertical over-under ramps.
      const horizLen = Math.hypot(_tan.x, _tan.z)
      if (horizLen > 1e-4) {
        _lat.set(-_tan.z / horizLen, 0, _tan.x / horizLen)
      } else {
        _lat.set(0, 0, 1)
      }
      _up.crossVectors(_lat, _tan).normalize()
      if (_up.y < 0) _up.negate()
      // Re-orthogonalize lateral vector against 3D tangent so the cross-section stays circular.
      _lat.crossVectors(_tan, _up).normalize()
    }

    const c = centres[i]!
    // Subtle bundle compression right in the tight central gathering zone prevents inner-bend crowding.
    let effOffset = lateralOffset
    if (pinchCenter) {
      const distCenter = Math.hypot(c.x, c.z - 0.02)
      const pinch = 1 - 0.14 * Math.exp(-distCenter * distCenter * 22)
      effOffset *= pinch
    }

    _cPt.set(
      c.x + _lat.x * effOffset,
      c.y + _lat.y * effOffset,
      c.z + _lat.z * effOffset,
    )

    const twist = u * turns * Math.PI * 2 + phase
    for (let j = 0; j <= radialSegments; j++) {
      const a = (j / radialSegments) * Math.PI * 2
      const cos = Math.cos(a)
      const sin = Math.sin(a)
      const r = radius * (1 + plyDepth * Math.cos(2 * (a - twist)))
      const nx = _lat.x * cos + _up.x * sin
      const ny = _lat.y * cos + _up.y * sin
      const nz = _lat.z * cos + _up.z * sin
      const n = i * ringStride + j
      positions.setXYZ(n, _cPt.x + nx * r, _cPt.y + ny * r, _cPt.z + nz * r)
      normals.setXYZ(n, nx, ny, nz)
    }

    if (i === 0) {
      const startCenter = (tubeSegments + 1) * ringStride
      const startRim = startCenter + 1
      positions.setXYZ(startCenter, _cPt.x, _cPt.y, _cPt.z)
      normals.setXYZ(startCenter, -_tan.x, -_tan.y, -_tan.z)
      for (let j = 0; j < radialSegments; j++) {
        const src = j
        positions.setXYZ(startRim + j, positions.getX(src), positions.getY(src), positions.getZ(src))
        normals.setXYZ(startRim + j, -_tan.x, -_tan.y, -_tan.z)
      }
    } else if (i === tubeSegments) {
      const endCenter = (tubeSegments + 1) * ringStride + 1 + radialSegments
      const endRim = endCenter + 1
      positions.setXYZ(endCenter, _cPt.x, _cPt.y, _cPt.z)
      normals.setXYZ(endCenter, _tan.x, _tan.y, _tan.z)
      const baseRing = tubeSegments * ringStride
      for (let j = 0; j < radialSegments; j++) {
        const src = baseRing + j
        positions.setXYZ(endRim + j, positions.getX(src), positions.getY(src), positions.getZ(src))
        normals.setXYZ(endRim + j, _tan.x, _tan.y, _tan.z)
      }
    }
  }

  positions.needsUpdate = true
  normals.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

export function createMizuhiki(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx
  Object.values(COPY).forEach(shared.assertSafeCopy)
  let started = false, disposed = false, focused = true, suspended = false
  let checkpoint: Checkpoint = 0
  let pose = 0, motionFrom = 0, motionTarget = 0, motionT = 1
  let settle = 0, sparkle = 0
  // Brief stiff-paper elastic settle oscillation upon locking a loop (zero in reduced motion).
  let springTimer = 1, springAmp = 0
  let stopResize = () => {}, stopClaim = () => {}
  let wishHandle: GestureHandle | null = null
  const feedback = createSceneFeedback(ctx)
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const moving = () => motionT < 1

  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: COPY.steps, action: COPY.loopAction }, shared.assertSafeCopy)
  const { hitLayer, hintEl, actionBtn } = ui
  const wishSlot = document.createElement('div')
  wishSlot.className = 'scene-wish-slot'
  overlay.append(wishSlot)

  const { renderer, scene } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(35, 1, 0.1, 50)
  const cameraHome = new THREE.Vector3(0, 3.5, 3.8)
  const lookAt = new THREE.Vector3(0, 0.12, 0)
  camera.position.copy(cameraHome)
  camera.lookAt(lookAt)
  const styleRenderer = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'mizuhiki', label: COPY.title })
  styleRenderer.setStyle(CEL_STYLE)
  addStageLights(scene, ctx.stage, { sky: 0xfff3df, ground: 0xcdbb9b, key: 0xffe1b2, rim: 0xe1d7f1, keyIntensity: 1.45, keyPosition: [-2, 4, 3] })

  const world = new THREE.Group()
  world.name = 'mizuhiki-craft'
  scene.add(world)
  // Low wooden presentation base grounding the folded washi packet (yBot = 0.032) onto the veranda deck (-0.035).
  addObjectCradle(world, {
    name: 'mizuhiki-stand',
    width: 1.82,
    depth: 2.38,
    groundY: getEnvironmentSurfaceY('mizuhiki'),
    surfaceY: 0.032,
    style: 'pad',
    kind: 'wood',
    finish: 'birch',
    footed: true,
  })
  const envelope = new THREE.Group()
  envelope.name = 'mizuhiki-envelope'
  world.add(envelope)

  // Shared handmade washi materials via ritual-optics (`layout: 'sheet'`) with
  // Komorebi highlight guard so pale folded washi shows crisp paper tooth and
  // layered folds without clipping to flat #FFFFFF.
  const backWashiMat = createRitualMaterial({
    color: 0xefe1c4,
    roughness: 0.97,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.26,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 0.72, grainScale: 2.35, grain: 1.0, fibers: 0.14, edge: 0.42, highlightGuard: 0.92 },
  })
  const midLeafMat = createRitualMaterial({
    color: 0xe2cfa9,
    roughness: 0.98,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.22,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 0.72, grainScale: 2.5, grain: 0.96, fibers: 0.12, edge: 0.44, highlightGuard: 0.92 },
  })
  const slipWashiMat = createRitualMaterial({
    color: 0xfcf6e8,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.24,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 0.46, grainScale: 2.3, grain: 0.94, fibers: 0.12, edge: 0.44, highlightGuard: 0.94 },
  })
  const leftWingMat = createRitualMaterial({
    color: 0xf4e7cc,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.28,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 0.56, grainScale: 2.35, grain: 1.0, fibers: 0.14, edge: 0.46, highlightGuard: 0.92 },
  })
  const rightWingMat = createRitualMaterial({
    color: 0xf7ecd5,
    roughness: 0.96,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.28,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 0.56, grainScale: 2.35, grain: 1.0, fibers: 0.14, edge: 0.48, highlightGuard: 0.92 },
  })
  const redAccentMat = createRitualMaterial({
    color: 0xc24844,
    roughness: 0.92,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.26,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 0.60, grainScale: 3.0, grain: 0.92, fibers: 0.12, edge: 0.44, highlightGuard: 0.65 },
  })
  const goldAccentMat = new THREE.MeshStandardMaterial({ color: 0xd4a84a, roughness: 0.42, metalness: 0.30, vertexColors: true })
  const collarAccentMat = createRitualMaterial({
    color: 0xf6ebd0,
    roughness: 0.95,
    vertexColors: true,
  }, {
    kind: 'paper',
    strength: 0.22,
    fiber: 'paper',
    paper: { layout: 'sheet', aspect: 1.0, grainScale: 2.8, grain: 0.90, fibers: 0.10, edge: 0.36, highlightGuard: 0.92 },
  })
  const red = new THREE.MeshStandardMaterial({ color: 0xb74743, roughness: 0.82 })

  // Diagonal front-fold seam lines echoing layered shugibukuro wrapping (right wing over left wing).
  const rightSeamX = (z: number) => THREE.MathUtils.lerp(0.18, -0.165, (z + 1.056) / 2.112)
  const leftSeamX = (z: number) => THREE.MathUtils.lerp(-0.18, 0.21, (z + 1.056) / 2.112)
  const bandWaistDip = (z: number) => -0.0017 * Math.exp(-Math.pow(z / 0.12, 2))
  const paperPillow = (x: number, z: number) =>
    0.0012 * Math.sin(x * 2.8 + 0.4) * Math.cos(z * 2.1 - 0.2)
    + 0.00038 * Math.sin(z * 22.0 + Math.sin(x * 7.5) * 0.6)
    + bandWaistDip(z)

  // 1. Back folded washi packet (crisp paper-folded corners, y = 0.032..0.070).
  const backMesh = new THREE.Mesh(
    createFoldedWashiPanel({
      xTopLeft: -0.748, xTopRight: 0.748, xBotLeft: -0.748, xBotRight: 0.748,
      zTop: -1.054, zBot: 1.054, cols: 16, rows: 20, cornerRadius: 0.011,
      evalSurface: (_x, _z, u, v) => {
        const edgeDark = 1 - 0.05 * Math.max(Math.pow(Math.abs(u * 2 - 1), 4), Math.pow(Math.abs(v * 2 - 1), 4))
        return { yTop: 0.070, yBot: 0.032, shade: edgeDark }
      },
    }),
    backWashiMat,
  )
  backMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(backMesh)

  // 2. Recessed middle folded paper leaf so front & side views show stacked paper plies (y = 0.070..0.083).
  const midLeafMesh = new THREE.Mesh(
    createFoldedWashiPanel({
      xTopLeft: -0.741, xTopRight: 0.741, xBotLeft: -0.741, xBotRight: 0.741,
      zTop: -1.047, zBot: 1.047, cols: 12, rows: 16, cornerRadius: 0.010,
      evalSurface: () => ({ yTop: 0.083, yBot: 0.070, shade: 0.96 }),
    }),
    midLeafMat,
  )
  midLeafMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(midLeafMesh)

  // 3. Recessed inner ivory centerpiece slip visible through the upper V-throat (no ceremonial inscription).
  const innerSlipMesh = new THREE.Mesh(
    createFoldedWashiPanel({
      xTopLeft: -0.24, xTopRight: 0.24, xBotLeft: -0.24, xBotRight: 0.24,
      zTop: -1.052, zBot: 0.02, cols: 12, rows: 14, cornerRadius: 0.004,
      evalSurface: (x, z, _u, v) => {
        const dLeft = x - leftSeamX(z)
        const dRight = rightSeamX(z) - x
        const underShadowL = 1 - 0.21 * (1 - THREE.MathUtils.smoothstep(dLeft, -0.015, 0.068))
        const underShadowR = 1 - 0.21 * (1 - THREE.MathUtils.smoothstep(dRight, -0.015, 0.068))
        const topRoll = -0.0014 * Math.pow(1 - v, 4)
        return { yTop: 0.0942 + topRoll, yBot: 0.083, shade: Math.min(underShadowL, underShadowR) }
      },
    }),
    slipWashiMat,
  )
  innerSlipMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(innerSlipMesh)

  // 4. Left front folded washi wing: wraps smoothly from the left spine and tucks beneath the right wing.
  const leftWingMesh = new THREE.Mesh(
    createFoldedWashiPanel({
      xTopLeft: -0.752, xTopRight: -0.18, xBotLeft: -0.752, xBotRight: 0.21,
      zTop: -1.056, zBot: 1.056, cols: 20, rows: 26, cornerRadius: 0.010,
      evalSurface: (x, z, u, v) => {
        const seamDist = rightSeamX(z) - x
        // Tuck cleanly underneath rightWing as the left wing crosses behind the diagonal overlap edge.
        const tuck = 1 - THREE.MathUtils.smoothstep(seamDist, -0.015, 0.13)
        const spineRoll = Math.pow(Math.max(0, 1 - u / 0.12), 2)
        const endRoll = Math.pow(Math.max(0, 1 - Math.min(v, 1 - v) / 0.05), 2)
        const yTop = 0.1032 + paperPillow(x, z) - tuck * 0.0068 - spineRoll * 0.0038 - endRoll * 0.0016
        const yBot = Math.min(yTop - 0.0062, 0.0945 - tuck * 0.0060 - spineRoll * 0.012)
        const overlapAO = 1 - 0.23 * (1 - THREE.MathUtils.smoothstep(seamDist, -0.004, 0.062))
        const bandAO = 1 - 0.055 * Math.exp(-Math.pow(z / 0.065, 2))
        const spineShade = 1 - 0.07 * spineRoll
        return { yTop, yBot, shade: overlapAO * bandAO * spineShade }
      },
    }),
    leftWingMat,
  )
  leftWingMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(leftWingMesh)

  // 5. Right front folded washi wing: overlaps cleanly over the left wing along the diagonal fold seam.
  const rightWingMesh = new THREE.Mesh(
    createFoldedWashiPanel({
      xTopLeft: 0.18, xTopRight: 0.752, xBotLeft: -0.165, xBotRight: 0.752,
      zTop: -1.056, zBot: 1.056, cols: 20, rows: 26, cornerRadius: 0.010,
      evalSurface: (x, z, u, v) => {
        const spineRoll = Math.pow(Math.max(0, (u - 0.88) / 0.12), 2)
        const endRoll = Math.pow(Math.max(0, 1 - Math.min(v, 1 - v) / 0.05), 2)
        // Subtle crisp paper lift right along the overlapping left edge for authentic folded-sheet relief.
        const seamLift = 0.0008 * Math.exp(-Math.pow(u / 0.06, 2)) * THREE.MathUtils.smoothstep(z, -0.85, 0.85)
        const yTop = 0.1052 + paperPillow(x, z) + seamLift - spineRoll * 0.0038 - endRoll * 0.0016
        const yBot = Math.min(yTop - 0.0064, 0.0972 - spineRoll * 0.014)
        const bandAO = 1 - 0.055 * Math.exp(-Math.pow(z / 0.065, 2))
        const spineShade = 1 - 0.07 * spineRoll
        const seamEdgeRim = 1 + 0.024 * Math.exp(-Math.pow(u / 0.022, 2)) - 0.032 * Math.exp(-Math.pow((u - 0.038) / 0.03, 2))
        return { yTop, yBot, shade: bandAO * spineShade * seamEdgeRim }
      },
    }),
    rightWingMat,
  )
  rightWingMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(rightWingMesh)

  // 6. Layered folded red & gold paper corner accent echoing the envelope's decorative folding
  // without reproducing an etiquette-specific inscription.
  const redAccentMesh = new THREE.Mesh(
    createFoldedAccentSlab([[0.53, -0.94], [0.66, -0.87], [0.60, -0.70], [0.50, -0.57], [0.46, -0.74]], 0.1058, 0.1112, 0.0018),
    redAccentMat,
  )
  redAccentMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(redAccentMesh)
  const goldAccentMesh = new THREE.Mesh(
    createFoldedAccentSlab([[0.545, -0.935], [0.648, -0.872], [0.585, -0.755], [0.488, -0.768]], 0.1112, 0.1146, 0.0010),
    goldAccentMat,
  )
  goldAccentMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(goldAccentMesh)
  const collarAccentMesh = new THREE.Mesh(
    createFoldedAccentSlab([[0.478, -0.780], [0.610, -0.750], [0.602, -0.725], [0.471, -0.755]], 0.1118, 0.1158, 0.0006),
    collarAccentMat,
  )
  collarAccentMesh.userData.toonSurface = { shading: 'smooth' }
  envelope.add(collarAccentMesh)

  const wishCanvas = document.createElement('canvas')
  wishCanvas.width = 768
  wishCanvas.height = 256
  const wishInk = wishCanvas.getContext('2d')
  const wishMap = new THREE.CanvasTexture(wishCanvas)
  wishMap.colorSpace = THREE.SRGBColorSpace
  const wishMark = new THREE.Mesh(
    new THREE.PlaneGeometry(1.08, 0.32),
    new THREE.MeshBasicMaterial({ map: wishMap, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1 }),
  )
  wishMark.name = 'mizuhiki-written-wish'
  wishMark.rotation.x = -Math.PI / 2
  wishMark.position.set(0, 0.1078, 0.81)
  envelope.add(wishMark)
  const reading = document.createElement('details'); reading.className = 'scene-written-wish-reading scene-wish-slot'
  reading.style.gridArea = 'wish'; reading.style.gridColumn = '1 / -1'
  reading.style.maxBlockSize = '160px'; reading.style.overflowY = 'auto'
  const readingLabel = document.createElement('summary'), readingText = document.createElement('p')
  bindSceneText(readingLabel, '查看纸面文字'); reading.append(readingLabel, readingText); overlay.append(reading)
  let writtenText = '赠礼心意', productDefault = true
  const redrawWish = () => {
    if (!wishInk) return
    const text = productDefault ? sceneCopy(writtenText) : writtenText
    wishInk.clearRect(0, 0, 768, 256)
    wishInk.fillStyle = '#684c30'
    wishInk.textAlign = 'center'
    wishInk.textBaseline = 'middle'
    const locale = getLocale()
    const family = locale === 'ja' ? '"Hiragino Mincho ProN", "Yu Mincho", serif'
      : locale === 'ko' ? '"Apple SD Gothic Neo", "Malgun Gothic", sans-serif'
      : locale === 'zh-Hant' ? '"Songti TC", "Noto Serif TC", serif'
      : locale === 'zh-Hans' ? '"Songti SC", "Noto Serif SC", serif' : 'Georgia, serif'
    let size = 40, lines: string[] = []
    do {
      wishInk.font = `${size}px ${family}`
      lines = wrapCanvasText(text, 680, value => wishInk.measureText(value).width, locale)
      if (lines.length * size * 1.3 <= 212 || size <= 14) break
      size -= 2
    } while (size >= 14)
    lines.forEach((line, i) => wishInk.fillText(line, 384, 128 + (i - (lines.length - 1) / 2) * size * 1.3))
    // The complete original remains readable in DOM even when the paper's physical space is small.
    readingText.textContent = text; reading.hidden = productDefault
    wishMap.needsUpdate = true
  }
  const paintWish = (text: string, isProductDefault = false) => {
    writtenText = text; productDefault = isProductDefault
    // Personal writing stays on the user's envelope but leaves no mark in shared photos.
    wishMark.userData.privateShare = !isProductDefault
    redrawWish()
  }
  paintWish('赠礼心意', true)
  const stopWishLocale = subscribeLocale(redrawWish)
  void document.fonts?.ready.then(() => { if (!disposed) redrawWish() })

  const knot = new THREE.Group()
  knot.name = 'mizuhiki-interwoven-cords'
  world.add(knot)
  const colors = [0xb74442, 0xd6ad52, 0xfff2d8, 0xb74442, 0xe6c572]
  const cordMaterials = colors.map((color, i) => new THREE.MeshStandardMaterial({
    color,
    roughness: i === 1 || i === 4 ? 0.48 : 0.78,
    metalness: i === 1 || i === 4 ? 0.30 : 0,
    emissive: 0xe7b264,
    emissiveIntensity: 0,
  }))
  cordMaterials.forEach((material, i) => applyCraftSurface(material, { kind: 'cord', scale: 2.0, strength: i === 1 || i === 4 ? 0.30 : 0.34 }))

  // Five tightly parallel washi paper-cord bands seated cleanly on the envelope
  // and wrapped smoothly around both left and right beveled edges.
  const bandSegments = 64, bandRadial = 8
  const bandCenterPath = curve([
    [-0.742, 0.034, 0],
    [-0.768, 0.056, 0],
    [-0.766, 0.098, 0],
    [-0.735, BAND_Y, 0],
    [-0.36, BAND_Y + 0.002, 0],
    [0, BAND_Y + 0.003, 0],
    [0.36, BAND_Y + 0.002, 0],
    [0.735, BAND_Y, 0],
    [0.766, 0.098, 0],
    [0.768, 0.056, 0],
    [0.742, 0.034, 0],
  ])
  const bandCentres = bandCenterPath.getSpacedPoints(bandSegments)
  colors.forEach((_color, i) => {
    const bandGeo = createCappedCordGeometry(bandSegments, bandRadial, false)
    writeMizuhikiStrandInPlace(bandGeo, bandCentres, bandSegments, bandRadial, BAND_RADIUS, (i - 2) * STRAND_SPACING, {
      turns: 26,
      plyDepth: 0.04,
      phase: i * 0.7,
      pinchCenter: false,
      fixedLateralZ: true,
    })
    const band = new THREE.Mesh(bandGeo, cordMaterials[i])
    band.name = `mizuhiki-binding-band-${i}`
    knot.add(band)
  })

  // Reuse fixed closed-end tube allocations as the stiff paper cords follow arc-length
  // parameterized curves; zero rope simulation or per-frame GPU allocation.
  const tubeSegments = 220, radialSegments = 10
  const forms = CORD_FORMS.map(curve)
  const sampled = forms.map((path) => path.getSpacedPoints(tubeSegments))
  const cordMeshes = cordMaterials.map((material, strand) => {
    const geometry = createCappedCordGeometry(tubeSegments, radialSegments, true)
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = `mizuhiki-loop-strand-${strand}`
    knot.add(mesh)
    return mesh
  })
  const centres = Array.from({ length: tubeSegments + 1 }, () => new THREE.Vector3())
  let lastPose = Number.NaN
  let lastSpringOffset = Number.NaN
  const poseCords = (springOffset = 0) => {
    if (pose === lastPose && springOffset === lastSpringOffset) return
    lastPose = pose
    lastSpringOffset = springOffset
    const from = Math.min(1, Math.floor(pose)), to = Math.min(2, from + 1), k = ease(pose - from)
    // Gentle vertical lift arc during active transition so the stiff ribbon clears lower passes smoothly.
    const transitLift = Math.sin(Math.PI * k) * 0.024
    for (let i = 0; i <= tubeSegments; i++) {
      const u = i / tubeSegments
      const p = centres[i]!
      p.lerpVectors(sampled[from]![i]!, sampled[to]![i]!, k)
      if (transitLift > 1e-5) {
        const edgeMask = Math.sin(Math.PI * u)
        p.y += transitLift * edgeMask
      }
      if (springOffset !== 0) {
        // Stiff-paper spring flexure localized to the arched bow lobes, keeping the central weave seated.
        const distCenter = Math.hypot(p.x, p.z - 0.02)
        const lobeWeight = THREE.MathUtils.smoothstep(distCenter, 0.16, 0.52)
        p.y = Math.max(0.114, p.y + springOffset * lobeWeight)
      }
    }
    cordMeshes.forEach((mesh, strand) => {
      const offset = (strand - 2) * STRAND_SPACING
      writeMizuhikiStrandInPlace(
        mesh.geometry,
        centres,
        tubeSegments,
        radialSegments,
        CORD_RADIUS,
        offset,
        {
          turns: 44,
          plyDepth: 0.044,
          phase: strand * 0.65,
          pinchCenter: true,
        },
      )
    })
  }

  const guide = new THREE.Group()
  guide.name = 'mizuhiki-path-guide'
  world.add(guide)
  const waypointGeometry = new THREE.SphereGeometry(0.026, 10, 6)
  const waypoints = Array.from({ length: 7 }, (_v, i) => {
    const marker = new THREE.Mesh(waypointGeometry, new THREE.MeshBasicMaterial({ color: 0xb58a3b, transparent: true, opacity: 0.58, depthWrite: false }))
    marker.name = `mizuhiki-waypoint-${i}`
    guide.add(marker)
    return marker
  })
  const guideLineGeometry = new THREE.BufferGeometry().setFromPoints(Array.from({ length: 61 }, () => new THREE.Vector3()))
  const guideLine = new THREE.Line(guideLineGeometry, new THREE.LineDashedMaterial({ color: 0xc59e55, transparent: true, opacity: 0.38, dashSize: 0.055, gapSize: 0.065, depthWrite: false }))
  guide.add(guideLine)
  const tip = new THREE.Group()
  tip.name = 'mizuhiki-cord-end'
  world.add(tip)
  const tipRing = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.008, 6, 32), new THREE.MeshBasicMaterial({ color: 0xe1b75d, transparent: true, opacity: 0.75, depthWrite: false }))
  tipRing.rotation.x = -Math.PI / 2
  tip.add(tipRing)
  tip.add(new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 8), red))
  const tipTarget = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 8), new THREE.MeshBasicMaterial({ visible: false }))
  tipTarget.name = 'mizuhiki-cord-end-target'
  tip.add(tipTarget)
  const routeCurves = ROUTES.map(curve)
  const routeSweeps = ROUTES.map(points => createPathSweep(points.map(p => [p[0], p[2]] as const), .17))

  const pointer = createPointerRay(canvas, camera)
  const touch = createTouchTarget(canvas, camera, scene)
  const guidePlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -0.31)
  const pointerPoint = new THREE.Vector3()
  const pressed = new Set<number>()
  let blockedMulti = false
  let drag: { id: number; step: number; next: number; t: number } | null = null
  let claimedPointer: number | null = null
  // Each destination is the next ordered gate, so the cue cannot suggest an
  // invalid shortcut from the cord end straight to the route's finish.
  for (const [index, label] of ['拖绳端绕环', '拖绳端穿环'].entries()) {
    addInteractionCue(tipTarget, {
      kind: 'drag', label, priority: 2,
      enabled: () => canAct() && checkpoint === index && !moving() && !blockedMulti,
      destination: () => waypoints[Math.min(drag?.next ?? 1, ROUTES[index].length - 1)].getWorldPosition(new THREE.Vector3()),
      targetLabel: '沿金点前进',
    })
  }
  const releaseCapture = () => {
    if (claimedPointer !== null) {
      try { hitLayer.releasePointerCapture?.(claimedPointer) } catch { /* Already released by the browser. */ }
      claimedPointer = null
    }
  }
  const showTip = (t = 0) => {
    if (checkpoint < 2) tip.position.copy(routeCurves[checkpoint].getPoint(t))
    tip.updateMatrixWorld(true)
  }
  const resetDrag = () => {
    delete hintEl.dataset.progress
    drag = null
    routeSweeps.forEach(path => path.reset())
    releaseCapture()
    if (!moving()) pose = Math.min(checkpoint, 2)
    showTip()
    if (!disposed && !moving()) setSafeText(hintEl, [COPY.loop, COPY.thread, COPY.wish, COPY.done][checkpoint]!, shared.assertSafeCopy)
  }
  const updateGuide = () => {
    guide.visible = tip.visible = checkpoint < 2 && !moving()
    if (checkpoint >= 2) return
    const points = ROUTES[checkpoint]
    waypoints.forEach((marker, i) => {
      marker.visible = i < points.length
      if (i < points.length) marker.position.set(...points[i])
    })
    const positions = guideLineGeometry.getAttribute('position') as THREE.BufferAttribute
    routeCurves[checkpoint].getPoints(60).forEach((p, i) => positions.setXYZ(i, p.x, p.y, p.z))
    positions.needsUpdate = true
    guideLineGeometry.computeBoundingSphere()
    guideLine.computeLineDistances()
    showTip()
    world.updateMatrixWorld(true)
  }
  const syncUI = () => {
    delete hintEl.dataset.progress
    ui.renderDots(checkpoint, 3)
    actionBtn.hidden = checkpoint === 3
    actionBtn.disabled = !canAct() || moving()
    actionBtn.setAttribute('aria-disabled', String(actionBtn.disabled))
    wishSlot.hidden = checkpoint !== 2
    hitLayer.style.pointerEvents = canAct() && checkpoint < 2 ? 'auto' : 'none'
    wishHandle?.setEnabled(canAct() && checkpoint === 2)
    const hints = [COPY.loop, COPY.thread, COPY.wish, COPY.done]
    const actions = [COPY.loopAction, COPY.threadAction, COPY.wishAction]
    setSafeText(hintEl, moving() ? checkpoint === 0 ? COPY.movingLoop : COPY.movingThread : hints[checkpoint], shared.assertSafeCopy)
    if (checkpoint < 3) setSafeText(actionBtn, actions[checkpoint], shared.assertSafeCopy)
    updateGuide()
  }

  const finishCord = () => {
    if (disposed || checkpoint >= 2 || motionT < 1) return
    checkpoint = motionTarget as Checkpoint
    pose = checkpoint
    sparkle = 0.65
    if (ctx.isReducedMotion?.()) {
      springTimer = 1
      springAmp = 0
    } else {
      springTimer = 0
      springAmp = 0.011
    }
    syncUI()
    poseCords(0)
    ctx.onProgress?.(checkpoint)
  }
  const workCord = () => {
    if (!canAct() || checkpoint >= 2 || moving() || blockedMulti) return
    motionFrom = pose
    motionTarget = checkpoint + 1
    motionT = (ctx.isReducedMotion?.() ?? false) ? 1 : 0
    springTimer = 1
    springAmp = 0
    resetDrag()
    feedback.impact({ freqs: checkpoint === 0 ? [784, 1176] : [659.25, 987.77], duration: 0.3, gain: 0.035, type: 'triangle' })
    if (motionT === 1) finishCord()
    else syncUI()
  }
  const complete = (text?: string) => {
    if (!canAct() || checkpoint !== 2) return
    // Lock before calling the host, including saveWish, to prevent re-entry.
    checkpoint = 3
    resetDrag()
    paintWish(text || '赠你祝愿', !text)
    syncUI()
    feedback.impact({ freqs: [523.25, 784, 1046.5], duration: 0.5, gain: 0.05 })
    if (text) ctx.saveWish?.(text)
    ctx.onProgress?.(3)
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }

  const onObject = (x: number, y: number) => {
    if (!canAct() || checkpoint >= 2 || moving() || blockedMulti) return false
    scene.updateMatrixWorld(true)
    camera.updateMatrixWorld(true)
    return touch.hit(x, y, tip)
  }
  // Track the whole pointer stream: a second finger on the page or action
  // button must cancel a cord drag just as a second finger on the canvas does.
  const onWindowDown = (e: PointerEvent) => {
    if (disposed || !started) return
    pressed.add(e.pointerId)
    if (pressed.size > 1) { blockedMulti = true; resetDrag() }
  }
  const onWindowEnd = (e: PointerEvent) => {
    pressed.delete(e.pointerId)
    if (blockedMulti && pressed.size === 0) blockedMulti = false
  }
  const onWindowCancel = (e: PointerEvent) => {
    onWindowEnd(e)
    if (drag?.id === e.pointerId) resetDrag()
  }
  const onDown = (e: PointerEvent) => {
    if (disposed || !started) return
    pressed.add(e.pointerId)
    if (pressed.size > 1) { blockedMulti = true; resetDrag(); return }
    if (e.button !== undefined && e.button !== 0) return
    if (!onObject(e.clientX, e.clientY)) return
    routeSweeps[checkpoint]!.reset()
    drag = { id: e.pointerId, step: checkpoint, next: 1, t: 0 }
    claimedPointer = e.pointerId
    try { hitLayer.setPointerCapture?.(e.pointerId) } catch { /* Optional on synthetic/unsupported pointers. */ }
    feedback.prepare()
  }
  const moveAlongGuide = (e: PointerEvent) => {
    if (!drag || e.pointerId !== drag.id || blockedMulti) return
    if (!canAct() || checkpoint !== drag.step || e.buttons === 0) { resetDrag(); return }
    sampleGuide(e.clientX, e.clientY)
  }
  const sampleGuide = (x: number, y: number) => {
    if (!drag || !pointer.aim(x, y).ray.intersectPlane(guidePlane, pointerPoint)) return
    const path = routeSweeps[checkpoint]!
    path.sample([pointerPoint.x, pointerPoint.z]); drag.next = path.next; drag.t = path.progress
    pose = checkpoint + drag.t * 0.76
    hintEl.dataset.progress = 'true'
    setSafeText(hintEl, path.complete([pointerPoint.x, pointerPoint.z], .19) ? '这一段已绕好，松手即可。' : sceneTemplate('已沿金点前进 {p0}%，继续到下一处提示。', { p0: Math.round(path.progress * 100) }), shared.assertSafeCopy)
    showTip(drag.t)
    poseCords(0)
  }
  const onUp = (e: PointerEvent) => {
    const current = drag
    pressed.delete(e.pointerId)
    if (blockedMulti) {
      resetDrag()
      if (pressed.size === 0) blockedMulti = false
      return
    }
    if (!current || e.pointerId !== current.id) return
    // A browser may deliver the final gate only in pointerup. Previous gates
    // must already have been followed, so release alone cannot skip the path.
    if (current.next > 1 && canAct() && checkpoint === current.step) sampleGuide(e.clientX, e.clientY)
    const point = pointer.aim(e.clientX, e.clientY).ray.intersectPlane(guidePlane, pointerPoint)
    const valid = canAct() && point !== null && routeSweeps[current.step]!.complete([pointerPoint.x, pointerPoint.z], .19)
    drag = null
    releaseCapture()
    if (valid) workCord()
    else resetDrag()
  }
  const onCancel = (e: PointerEvent) => {
    pressed.delete(e.pointerId)
    resetDrag()
    if (pressed.size === 0) blockedMulti = false
  }
  const onLostCapture = (e: PointerEvent) => {
    if (drag?.id === e.pointerId) resetDrag()
  }
  const onAction = () => {
    if (!canAct() || moving() || blockedMulti || drag) return
    feedback.prepare()
    if (checkpoint < 2) workCord()
    else complete()
  }
  const blur = () => { focused = false; resetDrag(); pressed.clear(); blockedMulti = false; poseCords(0); syncUI() }
  const focus = () => { focused = true; if (!disposed) syncUI() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, styleRenderer, camera)
    cameraHome.z = 3.8 + portraitBoost(aspect, 4)
    camera.position.copy(cameraHome)
    camera.lookAt(lookAt)
    camera.updateMatrixWorld(true)
  }

  syncUI()
  poseCords(0)
  return {
    start() {
      if (disposed || started) return
      started = true
      resize()
      stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      stopClaim = claimObjectTouches(hitLayer, onObject)
      window.addEventListener('pointerdown', onWindowDown, true)
      window.addEventListener('pointerup', onWindowEnd, true)
      window.addEventListener('pointercancel', onWindowCancel, true)
      hitLayer.addEventListener('pointerdown', onDown)
      hitLayer.addEventListener('pointermove', moveAlongGuide)
      hitLayer.addEventListener('pointerup', onUp)
      hitLayer.addEventListener('pointercancel', onCancel)
      hitLayer.addEventListener('lostpointercapture', onLostCapture)
      actionBtn.addEventListener('click', onAction)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      wishHandle = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: (text) => {
        if (!canAct() || checkpoint !== 2) return
        feedback.prepare()
        complete(text)
      } })
      wishHandle.mount(wishSlot, {})
      // Reconstruct checkpoints directly: no transitions, feedback, save or
      // completion events are emitted during restoration.
      const initial = ctx.initialProgress ?? 0
      checkpoint = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      pose = Math.min(checkpoint, 2)
      motionTarget = pose
      settle = checkpoint === 3 ? 1 : 0
      springTimer = 1
      springAmp = 0
      if (checkpoint === 3) paintWish('赠你祝愿', true)
      poseCords(0)
      syncUI()
    },
    update(dt) {
      if (disposed || !started) return
      if (!canAct()) {
        suspended = true
        resetDrag()
        poseCords(0)
        syncUI()
        styleRenderer.render()
        return
      }
      if (suspended) { suspended = false; syncUI() }
      wishHandle?.update(dt)
      const reduced = ctx.isReducedMotion?.() ?? false
      const safeDt = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, 0.05) : 0
      if (moving()) {
        motionT = reduced ? 1 : Math.min(1, motionT + safeDt / (checkpoint === 0 ? 0.9 : 1.15))
        pose = THREE.MathUtils.lerp(motionFrom, motionTarget, ease(motionT))
        if (motionT === 1) finishCord()
      }
      let springOffset = 0
      if (reduced) {
        springTimer = 1
        springAmp = 0
      } else if (springTimer < 0.42 && springAmp > 0) {
        springTimer = Math.min(0.42, springTimer + safeDt)
        const env = Math.exp(-10.5 * springTimer)
        springOffset = springTimer >= 0.42 ? 0 : springAmp * env * Math.cos(24 * springTimer)
      }
      poseCords(springOffset)
      settle = checkpoint === 3 ? reduced ? 1 : Math.min(1, settle + safeDt / 0.75) : 0
      world.rotation.y = -0.065 * ease(settle)
      sparkle = Math.max(0, sparkle - safeDt)
      cordMaterials.forEach((mat) => { mat.emissiveIntensity = reduced ? 0 : sparkle * 0.16 })
      // A stable desk camera keeps both loops and every fold edge readable.
      tipRing.scale.setScalar(reduced ? 1 : 1 + Math.sin(performance.now() * 0.003) * 0.045)
      waypoints.forEach((marker, i) => { (marker.material as THREE.MeshBasicMaterial).opacity = drag && i < drag.next ? 0.22 : 0.58 })
      styleRenderer.render()
    },
    dispose() {
      if (disposed) return
      disposed = true
      stopWishLocale()
      resetDrag()
      pressed.clear()
      stopResize()
      stopClaim()
      window.removeEventListener('pointerdown', onWindowDown, true)
      window.removeEventListener('pointerup', onWindowEnd, true)
      window.removeEventListener('pointercancel', onWindowCancel, true)
      hitLayer.removeEventListener('pointerdown', onDown)
      hitLayer.removeEventListener('pointermove', moveAlongGuide)
      hitLayer.removeEventListener('pointerup', onUp)
      hitLayer.removeEventListener('pointercancel', onCancel)
      hitLayer.removeEventListener('lostpointercapture', onLostCapture)
      actionBtn.removeEventListener('click', onAction)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      wishHandle?.dispose()
      wishHandle = null
      feedback.dispose()
      styleRenderer.dispose()
      disposeTree(scene)
      wishMap.dispose()
      renderer.dispose()
      renderer.forceContextLoss()
      scene.clear()
      overlay.replaceChildren()
      overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
