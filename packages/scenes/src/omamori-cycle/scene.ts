import { createQuietEnding } from '../quiet-ending'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { createCraftMaterial } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { puffPouchGeometry } from '@wbr/scene-runtime/soft-pouch-geometry'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import {
  addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay,
  createWarmStage, disposeTree, observeCanvasResize, portraitBoost, setSafeText, sizeStage,
} from '../procedural-kit'
import { createObjectPointer } from '../object-pointer'
import { placementHit } from '../placement-hit'
import { createTouchTarget } from '../touch-target'

const COPY = {
  title: '御守伴行', choose: '选一只小袋', carry: '别在包上', thank: '留一份感谢', quiet: '静候片刻', returnBag: '送到返还箱',
  select: '轻点一只小袋，让它陪伴接下来的一程。',
  selectReturn: '轻点这一程的小袋，带着感谢送回。',
  clasp: '按住小袋，把绳环拖到旅行包的扣环上。',
  box: '把小袋拖到木制返还箱。',
  placing: '小袋轻轻落定…',
  wish: '轻点小袋静候，把这一程的心意留在此刻。',
  gratitude: '轻点返还箱或小袋，谢谢走过的这一程。',
  done: '让这份心意陪你同行。',
  returned: '谢谢这一程，感谢已轻轻留下。',
} as const
const VARIANTS = ['coral', 'sage', 'indigo'] as const
const HELD = new THREE.Vector3(-0.62, 1.66, 0.56)
// Cord apex rests on the clasp top; body origin stays free for pre-attachment dragging.
const HANG_ANCHOR = new THREE.Vector3(0, 0.64, -0.015)
const HANG_POINT = new THREE.Vector3(0.58, 1.68, 0.25)
const HUNG = HANG_POINT.clone().addScaledVector(HANG_ANCHOR, -0.9)
const RETURNED = new THREE.Vector3(0.58, 1.32, 0.42)
const DISPLAY = [-1.0, -0.43, 0.14] as const

const POUCH_CAP_Z = 0.11
const POUCH_CINCH_Y = 0.245
const POUCH_BOUNDARY: readonly (readonly [number, number, number])[] = (() => {
  const pts: [number, number][] = [
    [-0.22, -0.34], [0.22, -0.34], [0.23, 0.2], [0.15, 0.34], [-0.15, 0.34], [-0.23, 0.2],
  ]
  return pts.map((a, i) => {
    const b = pts[(i + 1) % pts.length]!
    const dx = b[0] - a[0], dy = b[1] - a[1]
    return [-dy, dx, dy * a[0] - dx * a[1]] as const
  })
})()

const _pt = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _prevTan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refZ = new THREE.Vector3(0, 0, 1)
const _refY = new THREE.Vector3(0, 1, 0)
const _seamN = new THREE.Vector3()

/** Exact analytic cap puff matching `puffPouchGeometry` over the hexagonal pouch outline. */
function evalBasePuffHeight(x: number, y: number): number {
  let product = 1
  for (const [a, b, c] of POUCH_BOUNDARY) {
    if (Math.abs(c) < 1e-9) continue
    const factor = (a * x + b * y + c) / c
    if (factor <= 0) return 0
    product *= factor
  }
  const sq = product * product
  return 0.052 * sq / (1 + sq)
}

/** Subtle sewn-cloth neck cinch and radiating micro-pleats under the tied cord (strictly 0 at cap boundary so bevel stays watertight). */
function evalPouchCinchFactor(y: number): number {
  return Math.exp(-(((y - POUCH_CINCH_Y) / 0.044) ** 2))
}

function evalPouchClothSculptZ(x: number, y: number): number {
  const baseH = evalBasePuffHeight(x, y)
  const capInterior = THREE.MathUtils.smoothstep(baseH, 0.0, 0.0075)
  if (capInterior <= 0) return 0
  const cinch = evalPouchCinchFactor(y)
  const cordGroove = -0.0115 * cinch * (0.55 + 0.45 * Math.exp(-((x / 0.14) ** 2)))
  const belowKnot = THREE.MathUtils.smoothstep(POUCH_CINCH_Y - y, 0.0, 0.05)
  const upperDrape = Math.exp(-(((y - 0.12) / 0.165) ** 2)) * belowKnot
  const gatherCrease = 0.0046 * upperDrape * Math.cos(x * 34.0) * Math.exp(-((x / 0.175) ** 2))
  const topLipTuck = -0.0045 * Math.exp(-(((y - 0.315) / 0.022) ** 2))
  return (cordGroove + gatherCrease + topLipTuck) * capInterior
}

/** Half-width of the extruded cap (before bevel) at vertical coordinate y. */
function pouchCapHalfWidth(y: number): number {
  if (y <= 0.2) return THREE.MathUtils.lerp(0.22, 0.23, THREE.MathUtils.clamp((y + 0.34) / 0.54, 0, 1))
  return THREE.MathUtils.lerp(0.23, 0.15, THREE.MathUtils.clamp((y - 0.2) / 0.14, 0, 1))
}

/** Exact front cloth surface Z at sculpted pouch coordinates (x, y), including bevel drop-off near edges. */
function evalPouchFrontZ(x: number, y: number): number {
  const capW = pouchCapHalfWidth(y)
  const edgeOverX = Math.max(0, Math.abs(x) - capW)
  const edgeOverY = Math.max(0, -0.34 - y, y - 0.34)
  const bevelDist = Math.hypot(edgeOverX, edgeOverY)
  if (bevelDist > 1e-5) {
    const t = THREE.MathUtils.clamp(bevelDist / 0.02, 0, 1)
    return 0.085 + 0.025 * Math.sqrt(Math.max(0, 1 - t * t))
  }
  return POUCH_CAP_Z + evalBasePuffHeight(x, y) + evalPouchClothSculptZ(x, y)
}

function evalPouchFrontNormal(x: number, y: number, out = new THREE.Vector3()): THREE.Vector3 {
  const e = 0.0025
  const dzdx = (evalPouchFrontZ(x + e, y) - evalPouchFrontZ(x - e, y)) / (2 * e)
  const dzdy = (evalPouchFrontZ(x, y + e) - evalPouchFrontZ(x, y - e)) / (2 * e)
  return out.set(-dzdx, -dzdy, 1).normalize()
}

/**
 * Deterministic woven Japanese brocade cloth texture (neutral warm-white albedo + height bump,
 * tinted cleanly per variant). Eliminates coarse triplanar waffle dots while adding fine twill
 * thread luster and a subtle tone-on-tone woven geometric diamond brocade sheen.
 */
function createBrocadeTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 256
  const colorData = new Uint8Array(size * size * 4)
  const bumpData = new Uint8Array(size * size * 4)
  const tau = Math.PI * 2
  for (let y = 0; y < size; y++) {
    const v = y / size
    const weftSlub = Math.sin(v * tau * 7 + 0.4) * 0.55 + Math.sin(v * tau * 19 + 1.9) * 0.45
    for (let x = 0; x < size; x++) {
      const u = x / size
      const warpSlub = Math.sin(u * tau * 9 + 1.1) * 0.55 + Math.sin(u * tau * 23 + 0.3) * 0.45
      // Fine silk 2/2 diagonal twill micro-weave (32 crisp thread repeats per tile).
      const twill = Math.sin((u + v) * tau * 32) * 0.55 + Math.sin((u - v) * tau * 32) * 0.25
      const warp = Math.sin(u * tau * 64)
      const weft = Math.sin(v * tau * 64)
      const microWeave = twill * 4.5 + (warp + weft) * 2.4 + (warpSlub + weftSlub) * 1.4

      // Subtle tone-on-tone woven geometric diamond brocade (abstract textile lattice, no script).
      const fx = ((u * 8) % 1 + 1) % 1 - 0.5
      const fy = ((v * 8) % 1 + 1) % 1 - 0.5
      const diamond = Math.abs(fx) + Math.abs(fy)
      const lattice = Math.exp(-(((diamond - 0.34) / 0.064) ** 2))
      const innerDot = Math.exp(-((diamond / 0.115) ** 2))
      const cornerKnot = Math.exp(-((((0.5 - Math.abs(fx)) + (0.5 - Math.abs(fy))) / 0.125) ** 2))
      const damask = (lattice * 0.72 + innerDot * 0.56 + cornerKnot * 0.48)

      // Damask threads reverse twill direction for crisp woven silk sheen contrast.
      const sheen = damask * (9.2 + Math.sin((u - v) * tau * 48) * 2.8)
      const lum = THREE.MathUtils.clamp(Math.round(238 + microWeave + sheen - 3.2), 206, 255)
      const warm = THREE.MathUtils.clamp(Math.round(lum + damask * 3.8), 206, 255)
      const cool = THREE.MathUtils.clamp(Math.round(lum - damask * 2.2), 200, 255)

      const idx = (y * size + x) * 4
      colorData[idx] = warm
      colorData[idx + 1] = lum
      colorData[idx + 2] = cool
      colorData[idx + 3] = 255

      const h = THREE.MathUtils.clamp(Math.round(128 + microWeave * 5.2 + damask * 34), 36, 232)
      bumpData[idx] = h
      bumpData[idx + 1] = h
      bumpData[idx + 2] = h
      bumpData[idx + 3] = 255
    }
  }
  const map = new THREE.DataTexture(colorData, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(bumpData, size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Deterministic braided kumihimo-style cord albedo + relief texture (tileable in UV). */
function createBraidedCordTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  const colorData = new Uint8Array(size * size * 4)
  const bumpData = new Uint8Array(size * size * 4)
  const tau = Math.PI * 2
  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      // Interlaced diagonal braided chevron strands along tube U (axis) and V (circumference).
      const s1 = Math.sin((u * 14 + v * 3) * tau)
      const s2 = Math.sin((u * 14 - v * 3) * tau)
      const braid = Math.max(s1, s2) * 0.72 + (s1 + s2) * 0.14
      const fineFiber = Math.sin((u * 42 + v * 6) * tau) * 0.16
      const shade = braid * 13 + fineFiber * 4
      const r = THREE.MathUtils.clamp(Math.round(244 + shade * 0.85), 204, 255)
      const g = THREE.MathUtils.clamp(Math.round(237 + shade * 0.92), 192, 252)
      const b = THREE.MathUtils.clamp(Math.round(220 + shade * 1.05), 170, 244)
      const idx = (y * size + x) * 4
      colorData[idx] = r; colorData[idx + 1] = g; colorData[idx + 2] = b; colorData[idx + 3] = 255
      const h = THREE.MathUtils.clamp(Math.round(128 + braid * 52 + fineFiber * 16), 32, 236)
      bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
    }
  }
  const map = new THREE.DataTexture(colorData, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(bumpData, size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/**
 * Sculpts a 2-ply twisted/braided profile in-place onto a `THREE.TubeGeometry` using
 * parallel-transport frames (preserving `geometry.parameters.path` for suspension contracts).
 */
function sculptTwistedTube(
  geometry: THREE.TubeGeometry,
  options: { turns?: number; plyDepth?: number; phase?: number; radiusScaleFn?: (u: number) => number; closed?: boolean } = {},
): THREE.TubeGeometry {
  const { tubularSegments, radius, radialSegments, path } = geometry.parameters
  const turns = options.turns ?? 8
  const plyDepth = options.plyDepth ?? 0.12
  const phase = options.phase ?? 0
  const closed = options.closed ?? false
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
  const uvAttr = geometry.getAttribute('uv') as THREE.BufferAttribute
  const ringStride = radialSegments + 1

  const pts: THREE.Vector3[] = []
  const tans: THREE.Vector3[] = []
  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  path.getTangentAt(0, _prevTan).normalize()
  const ref = Math.abs(_prevTan.dot(_refZ)) < 0.92 ? _refZ : _refY
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = closed && i === tubularSegments ? 0 : i / tubularSegments
    const p = path.getPointAt(u, new THREE.Vector3())
    const t = path.getTangentAt(u, new THREE.Vector3()).normalize()
    if (i > 0) {
      const dot = THREE.MathUtils.clamp(_prevTan.dot(t), -1, 1)
      if (dot < 0.999999) {
        if (dot > -0.999999) {
          _quat.setFromUnitVectors(_prevTan, t)
          _norm.applyQuaternion(_quat)
        }
        _norm.addScaledVector(t, -_norm.dot(t))
        if (_norm.lengthSq() > 1e-10) _norm.normalize()
      }
      _binorm.crossVectors(t, _norm).normalize()
      _prevTan.copy(t)
    }
    pts.push(p)
    tans.push(t)
    normals.push(_norm.clone())
    binormals.push(_binorm.clone())
  }

  let holonomy = 0
  if (closed) {
    const nStart = normals[0]!, bStart = binormals[0]!, nEnd = normals[tubularSegments]!
    holonomy = Math.atan2(nEnd.dot(bStart), nEnd.dot(nStart))
  }

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const p = pts[i]!
    const n0 = normals[i]!, b0 = binormals[i]!
    const corr = closed ? -holonomy * u : 0
    const cc = Math.cos(corr), sc = Math.sin(corr)
    const nx0 = n0.x * cc + b0.x * sc, ny0 = n0.y * cc + b0.y * sc, nz0 = n0.z * cc + b0.z * sc
    const bx0 = -n0.x * sc + b0.x * cc, by0 = -n0.y * sc + b0.y * cc, bz0 = -n0.z * sc + b0.z * cc
    const twist = u * turns * Math.PI * 2 + phase
    const rScale = options.radiusScaleFn ? options.radiusScaleFn(u) : 1
    for (let j = 0; j <= radialSegments; j++) {
      const theta = (j / radialSegments) * Math.PI * 2
      const r = radius * rScale * (1 + plyDepth * Math.cos(2 * (theta - twist)))
      const cx = -Math.cos(theta), sy = Math.sin(theta)
      const rx = nx0 * cx + bx0 * sy
      const ry = ny0 * cx + by0 * sy
      const rz = nz0 * cx + bz0 * sy
      posAttr.setXYZ(i * ringStride + j, p.x + rx * r, p.y + ry * r, p.z + rz * r)
      if (uvAttr) uvAttr.setXY(i * ringStride + j, u * Math.max(1, turns * 0.22), j / radialSegments)
    }
  }
  posAttr.needsUpdate = true
  if (uvAttr) uvAttr.needsUpdate = true
  geometry.computeVertexNormals()
  for (let i = 0; i <= tubularSegments; i++) {
    const a = i * ringStride, b = a + radialSegments
    _seamN.set(
      normAttr.getX(a) + normAttr.getX(b),
      normAttr.getY(a) + normAttr.getY(b),
      normAttr.getZ(a) + normAttr.getZ(b),
    )
    if (_seamN.lengthSq() > 1e-10) {
      _seamN.normalize()
      normAttr.setXYZ(a, _seamN.x, _seamN.y, _seamN.z)
      normAttr.setXYZ(b, _seamN.x, _seamN.y, _seamN.z)
    }
  }
  if (closed) {
    const endOffset = tubularSegments * ringStride
    for (let j = 0; j <= radialSegments; j++) {
      const a = j, b = endOffset + j
      _seamN.set(
        normAttr.getX(a) + normAttr.getX(b),
        normAttr.getY(a) + normAttr.getY(b),
        normAttr.getZ(a) + normAttr.getZ(b),
      )
      if (_seamN.lengthSq() > 1e-10) {
        _seamN.normalize()
        normAttr.setXYZ(a, _seamN.x, _seamN.y, _seamN.z)
        normAttr.setXYZ(b, _seamN.x, _seamN.y, _seamN.z)
      }
    }
  }
  normAttr.needsUpdate = true
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

function cord(
  points: readonly (readonly [number, number, number])[],
  radius: number,
  material: THREE.Material,
  options: { tubular?: number; radial?: number; turns?: number; plyDepth?: number; phase?: number; closed?: boolean; radiusScaleFn?: (u: number) => number } = {},
) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p)), options.closed ?? false)
  const geometry = new THREE.TubeGeometry(curve, options.tubular ?? 28, radius, options.radial ?? 8, options.closed ?? false)
  if ((options.plyDepth ?? 0) > 0 || options.radiusScaleFn || options.closed) {
    sculptTwistedTube(geometry, options)
  }
  return new THREE.Mesh(geometry, material)
}

/**
 * Closed, supported sewn brocade pouch built on `puffPouchGeometry`:
 * retains its non-floppy support semantics while adding subtle neck cinching beneath
 * the tied cord, gentle radiating upper-cloth folds, clean box-mapped brocade UVs,
 * and cool-warm anime cloth fold shading.
 */
function pouchGeometry() {
  const shape = new THREE.Shape()
  shape.moveTo(-0.22, -0.34); shape.lineTo(0.22, -0.34); shape.lineTo(0.23, 0.2)
  shape.lineTo(0.15, 0.34); shape.lineTo(-0.15, 0.34); shape.lineTo(-0.23, 0.2); shape.closePath()
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 0.17, bevelEnabled: true, bevelSize: 0.02,
    bevelThickness: 0.025, bevelSegments: 3, curveSegments: 12, steps: 1 })
  geometry.translate(0, 0, -0.085)
  const soft = puffPouchGeometry(geometry); geometry.dispose()

  const pos = soft.getAttribute('position') as THREE.BufferAttribute
  const norm = soft.getAttribute('normal') as THREE.BufferAttribute
  const uv = soft.getAttribute('uv') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const triA = new THREE.Vector3(), triB = new THREE.Vector3(), triC = new THREE.Vector3()
  const faceN = new THREE.Vector3()

  // Apply watertight cap-interior cloth groove & radiating silk gather creases in-place (zero bevel cracks).
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const cinch = evalPouchCinchFactor(y)
    const side = Math.sign(z)
    const isCapFace = Math.abs(norm.getZ(i)) > 0.78 && Math.abs(z) > 0.105
    const sculptZ = isCapFace ? side * evalPouchClothSculptZ(x, y) : 0
    pos.setXYZ(i, x, y, z + sculptZ)

    // Update analytical cap normals smoothly on front/back faces; side bevels keep exact watertight extrusion normals.
    if (isCapFace) {
      const e = 0.0025
      const dzdx = (evalBasePuffHeight(x + e, y) + evalPouchClothSculptZ(x + e, y)
        - evalBasePuffHeight(x - e, y) - evalPouchClothSculptZ(x - e, y)) / (2 * e)
      const dzdy = (evalBasePuffHeight(x, y + e) + evalPouchClothSculptZ(x, y + e)
        - evalBasePuffHeight(x, y - e) - evalPouchClothSculptZ(x, y - e)) / (2 * e)
      _norm.set(-dzdx * side, -dzdy * side, side).normalize()
      norm.setXYZ(i, _norm.x, _norm.y, _norm.z)
    }

    // Cool-warm anime cloth shading: cinched cord groove shadow, soft radiating pleats, piped edge seam depth.
    const capW = pouchCapHalfWidth(y)
    const edgeProx = THREE.MathUtils.smoothstep(Math.abs(x) / Math.max(capW, 0.05), 0.78, 1.0)
    const bottomProx = THREE.MathUtils.smoothstep(-y, 0.25, 0.35)
    const seamEdge = Math.max(edgeProx, bottomProx) * 0.072
    const cinchShadow = cinch * (0.125 + 0.045 * Math.exp(-((x / 0.11) ** 2)))
    const belowKnot = THREE.MathUtils.smoothstep(POUCH_CINCH_Y - y, 0.0, 0.05)
    const upperDrape = Math.exp(-(((y - 0.12) / 0.165) ** 2)) * belowKnot
    const pleatShade = upperDrape * Math.cos(x * 34.0) * Math.exp(-((x / 0.175) ** 2)) * 0.055
    const topHem = Math.exp(-(((y - 0.315) / 0.022) ** 2)) * 0.068
    const centerLift = Math.exp(-((x / 0.16) ** 2 + ((y + 0.03) / 0.22) ** 2)) * 0.030

    const lum = THREE.MathUtils.clamp(0.995 - cinchShadow - seamEdge - topHem + pleatShade + centerLift, 0.77, 1.04)
    const coolDip = (cinchShadow + seamEdge) * 0.20
    colors[i * 3] = THREE.MathUtils.clamp(lum - coolDip * 0.55, 0.73, 1.05)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(lum - coolDip * 0.18, 0.75, 1.04)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(lum + coolDip * 0.35, 0.78, 1.04)
  }

  // Assign distortion-free box-projected UVs per triangle so brocade weave wraps cleanly over sides & bevels.
  const uvScale = 2.15
  for (let i = 0; i < pos.count; i += 3) {
    triA.fromBufferAttribute(pos, i)
    triB.fromBufferAttribute(pos, i + 1)
    triC.fromBufferAttribute(pos, i + 2)
    faceN.subVectors(triB, triA).cross(_pt.subVectors(triC, triA))
    const ax = Math.abs(faceN.x), ay = Math.abs(faceN.y), az = Math.abs(faceN.z)
    for (let k = 0; k < 3; k++) {
      const vi = i + k
      const vx = pos.getX(vi), vy = pos.getY(vi), vz = pos.getZ(vi)
      if (az >= ax && az >= ay) uv.setXY(vi, vx * uvScale + 0.5, vy * uvScale + 0.5)
      else if (ax >= ay) uv.setXY(vi, vz * uvScale + 0.5, vy * uvScale + 0.5)
      else uv.setXY(vi, vx * uvScale + 0.5, vz * uvScale + 0.5)
    }
  }

  soft.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  pos.needsUpdate = true
  norm.needsUpdate = true
  uv.needsUpdate = true
  soft.computeBoundingBox()
  soft.computeBoundingSphere()
  soft.userData.iconPouchFullness = true
  return soft
}

/** Builds flush perimeter gold corded piping hugging the curved pouch face with zero floating gap. */
function buildFlushPipingPoints(): [number, number, number][] {
  const raw: [number, number][] = [
    [-0.206, 0.194],
    [-0.208, 0.08],
    [-0.207, -0.05],
    [-0.204, -0.18],
    [-0.200, -0.292],
    [-0.184, -0.315],
    [-0.135, -0.319],
    [0, -0.320],
    [0.135, -0.319],
    [0.184, -0.315],
    [0.200, -0.292],
    [0.204, -0.18],
    [0.207, -0.05],
    [0.208, 0.08],
    [0.206, 0.194],
  ]
  return raw.map(([x, y]) => [x, y, evalPouchFrontZ(x, y) + 0.0022] as [number, number, number])
}

/** Builds a continuous snug cord wrap hugging the actual beveled pouch perimeter at y = POUCH_CINCH_Y (zero clipping). */
function buildNeckWrapPoints(): [number, number, number][] {
  const y = POUCH_CINCH_Y
  const capW = pouchCapHalfWidth(y)
  const outerX = capW + 0.026
  const cornerX = capW + 0.017
  const cornerZ = 0.098
  const dip = (x: number) => -0.0085 * Math.exp(-((x / 0.13) ** 2))
  const fz = (x: number) => evalPouchFrontZ(x, y + dip(x)) + 0.0085
  const bz = (x: number) => -(evalPouchFrontZ(x, y) + 0.0085)
  return [
    [0, dip(0), fz(0)],
    [0.09, dip(0.09), fz(0.09)],
    [0.17, dip(0.17), fz(0.17)],
    [cornerX, -0.001, cornerZ],
    [outerX, 0, 0.052],
    [outerX, 0, 0],
    [outerX, 0, -0.052],
    [cornerX, 0, -cornerZ],
    [0.17, 0, bz(0.17)],
    [0.09, 0, bz(0.09)],
    [0, 0, bz(0)],
    [-0.09, 0, bz(-0.09)],
    [-0.17, 0, bz(-0.17)],
    [-cornerX, 0, -cornerZ],
    [-outerX, 0, -0.052],
    [-outerX, 0, 0],
    [-outerX, 0, 0.052],
    [-cornerX, -0.001, cornerZ],
    [-0.17, dip(-0.17), fz(-0.17)],
    [-0.09, dip(-0.09), fz(-0.09)],
  ]
}

/** Orient a flat-backed cushioned stitch mesh flush against the curved pouch front surface. */
function seatOnPouchFront(mesh: THREE.Object3D, x: number, y: number, zOffset: number, spinZ = 0) {
  const z = evalPouchFrontZ(x, y) + zOffset
  mesh.position.set(x, y, z)
  const n = evalPouchFrontNormal(x, y, _norm)
  _quat.setFromUnitVectors(_refZ, n)
  mesh.quaternion.copy(_quat)
  if (spinZ !== 0) mesh.rotateZ(spinZ)
  return mesh
}

export function createOmamoriCycle(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, gestures, shared } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  const returning = ctx.returning === true
  let step = 0, started = false, disposed = false, focused = true, dragging = false, placing = false, saved = false
  let inactiveRendered = false
  let selected = Math.max(0, VARIANTS.findIndex(variant => variant === ctx.initialVariant))
  let startIndex = -1, downX = 0, downY = 0, placeT = 0, clock = 0
  const dragOffset = new THREE.Vector3(), placeFrom = new THREE.Vector3()
  let writer: GestureHandle | null = null, stopResize = () => {}
  const canAct = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback(ctx)
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: COPY.choose }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 40)
  const home = new THREE.Vector3(0.1, 2.2, 5.2), look = new THREE.Vector3(0, 1.02, 0)
  camera.position.copy(home); camera.lookAt(look)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'omamori-cycle', label: COPY.title })
  style.setStyle(CEL_STYLE)
  const lights = addStageLights(scene, ctx.stage, { sky: 0xfff5e2, ground: 0xc7b295, key: 0xffe8c6, rim: 0xd7e7de })
  const world = new THREE.Group(); world.name = 'omamori-world'; scene.add(world)
  const material = (color: number, roughness = 0.9) => new THREE.MeshStandardMaterial({ color, roughness })
  const wood = createCraftMaterial({ color: 0xd4ae7d, roughness: .9 }, { kind: 'wood' })
  const woodEdge = createCraftMaterial({ color: 0xb89164, roughness: 0.85 }, { kind: 'wood', axis: 'x', scale: 0.86, strength: 0.54 })
  const woodLeg = createCraftMaterial({ color: 0xb89164, roughness: 0.85 }, { kind: 'wood', axis: 'y', scale: 0.92, strength: 0.52 })
  const woodTrim = createCraftMaterial({ color: 0xd4ae7d, roughness: 0.88 }, { kind: 'wood', axis: 'y', scale: 1.0, strength: 0.52 })
  const cream = material(0xf5e8c8), gold = material(0xd0b56e, 0.62)
  const brocadeTex = createBrocadeTextures()
  const cordTex = createBraidedCordTextures()
  const rope = createRitualMaterial(
    { color: 0xfbf2de, map: cordTex.map, bumpMap: cordTex.bump, bumpScale: 0.0042, roughness: 0.84 },
    { kind: 'cloth', strength: 0.08, fiber: false },
  )
  const cordTipGold = new THREE.MeshStandardMaterial({ color: 0xd6b868, roughness: 0.54, metalness: 0.24 })
  const pipingGold = new THREE.MeshStandardMaterial({
    color: 0xd7ba6c, map: cordTex.map, bumpMap: cordTex.bump, bumpScale: 0.0028, roughness: 0.50, metalness: 0.22,
  })
  const stitchGold = new THREE.MeshStandardMaterial({ color: 0xd9bc6d, roughness: 0.52, metalness: 0.18 })
  const leaf = material(0x8ea97d, 0.86), flowerCream = material(0xf7ecd0, 0.84)
  const bagMat = material(0xa8bcb1), bagEdge = material(0x718e82)
  const makeBrocade = (color: number) => createRitualMaterial(
    { color, map: brocadeTex.map, bumpMap: brocadeTex.bump, bumpScale: 0.0032, roughness: 0.84, vertexColors: true },
    { kind: 'cloth', strength: 0.10, fiber: false },
  )
  // Coral matches baseline icon-style calibrated pigment (#ee7870); sage and indigo retain exact baseline hues.
  const coral = makeBrocade(0xee7870), sage = makeBrocade(0x9db99d), indigo = makeBrocade(0x9cace0)
  const seam = createRitualMaterial(
    { color: 0xd0b789, map: brocadeTex.map, bumpMap: brocadeTex.bump, bumpScale: 0.0024, roughness: 0.86 },
    { kind: 'cloth', strength: 0.08, fiber: false },
  )
  const add = (geometry: THREE.BufferGeometry, mat: THREE.Material, position: [number, number, number], parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.position.set(...position); parent.add(mesh); return mesh
  }
  const paint = (mesh: THREE.Mesh) => { mesh.userData.toonSurface = { outline: false }; return mesh }

  // A small office table keeps the three closed bags within reach.
  const table = new THREE.Group(); table.name = 'omamori-office-table'; world.add(table)
  add(new RoundedBoxGeometry(2.78, 0.14, 1.26, 3, 0.065), wood, [0, 0.7, -0.06], table)
  add(new RoundedBoxGeometry(2.65, 0.07, 1.15, 3, 0.03), woodEdge, [0, 0.625, -0.06], table).name = 'omamori-table-apron'
  for (const x of [-1.1, 1.1]) for (const z of [-0.43, 0.32]) add(new RoundedBoxGeometry(0.16, 0.63, 0.16, 2, 0.026), woodLeg, [x, 0.32, z], table).name = 'omamori-table-leg'
  const tray = add(new RoundedBoxGeometry(1.83, 0.04, 0.48, 3, 0.022), cream, [-0.45, 0.795, 0.38], table)
  tray.name = 'omamori-display-tray'

  const travelBag = new THREE.Group(); travelBag.name = 'omamori-travel-bag'; travelBag.visible = !returning; world.add(travelBag)
  add(new RoundedBoxGeometry(0.9, 0.87, 0.47, 4, 0.16), bagMat, [0.61, 1.18, -0.08], travelBag)
  add(new RoundedBoxGeometry(0.65, 0.34, 0.045, 3, 0.07), bagEdge, [0.61, 1.1, 0.175], travelBag)
  add(new RoundedBoxGeometry(0.59, 0.27, 0.048, 3, 0.055), bagMat, [0.61, 1.12, 0.2], travelBag)
  travelBag.add(cord([[0.3, 1.48, -0.07], [0.32, 1.88, -0.07], [0.62, 1.96, -0.07], [0.91, 1.87, -0.07], [0.93, 1.48, -0.07]], 0.042, bagEdge))
  const clasp = add(new RoundedBoxGeometry(0.17, 0.16, 0.085, 3, 0.025), gold, [0.58, 1.6, 0.235], travelBag)
  clasp.name = 'omamori-clasp'
  add(new THREE.TorusGeometry(0.072, 0.012, 7, 24), gold, [0.58, 1.68, 0.25], travelBag)
  for (const x of [0.35, 0.87]) add(new THREE.SphereGeometry(0.022, 10, 8), gold, [x, 1.54, 0.205], travelBag)

  const returnBox = new THREE.Group(); returnBox.name = 'omamori-return-box'; returnBox.visible = returning; world.add(returnBox)
  const boxBody = add(new RoundedBoxGeometry(1.0, 0.56, 0.73, 3, 0.055), woodEdge, [0.6, 1.07, -0.03], returnBox)
  boxBody.name = 'omamori-return-box-body'
  add(new RoundedBoxGeometry(1.07, 0.09, 0.79, 3, 0.035), wood, [0.6, 1.39, -0.03], returnBox)
  const returnSlot = add(new RoundedBoxGeometry(0.6, 0.028, 0.28, 3, 0.018), cream, [0.58, 1.448, 0.12], returnBox)
  returnSlot.name = 'omamori-return-slot'
  for (const x of [0.21, 0.99]) add(new RoundedBoxGeometry(0.035, 0.43, 0.025, 2, 0.01), woodTrim, [x, 1.1, 0.345], returnBox).name = 'omamori-return-box-trim'
  // An original little flower on the return box takes the place of ritual lettering.
  for (let i = 0; i < 5; i++) {
    const a = i / 5 * Math.PI * 2
    paint(add(new THREE.CircleGeometry(0.037, 16), cream, [0.6 + Math.cos(a) * 0.035, 1.06 + Math.sin(a) * 0.035, 0.352], returnBox))
  }
  paint(add(new THREE.CircleGeometry(0.025, 16), gold, [0.6, 1.06, 0.354], returnBox))

  const bodyGeo = pouchGeometry()
  const topCuffGeo = new RoundedBoxGeometry(0.285, 0.038, 0.196, 3, 0.016)
  const eyeletGeo = new THREE.TorusGeometry(0.016, 0.0052, 8, 18)
  // Softly domed satin-stitched gold diamond lozenge (flat embroidery, not a pointy pyramid stud).
  const diamondGeo = new THREE.CylinderGeometry(0.013, 0.017, 0.0038, 4)
  diamondGeo.rotateX(Math.PI / 2)
  const leafGeo = new THREE.SphereGeometry(0.033, 14, 10)
  leafGeo.scale(0.55, 1.28, 0.14)
  const petalGeo = new THREE.SphereGeometry(0.034, 14, 10)
  petalGeo.scale(1, 0.8, 0.16)
  const flowerCenterGeo = new THREE.SphereGeometry(0.018, 14, 10)
  flowerCenterGeo.scale(1, 1, 0.36)
  const tailTipGeo = new THREE.CylinderGeometry(0.0122, 0.0128, 0.013, 10)

  const pipingPoints = buildFlushPipingPoints()
  const neckWrapPoints = buildNeckWrapPoints()
  const knotSeatZ = evalPouchFrontZ(0, POUCH_CINCH_Y)

  // Sculpted 3D braided bow loops & tied over-under center collar (continuous cord, no torus+sphere).
  const bowLoopPoints = (sign: -1 | 1): [number, number, number][] => [
    [sign * 0.006, 0.004, knotSeatZ + 0.010],
    [sign * 0.044, 0.036, knotSeatZ + 0.021],
    [sign * 0.092, 0.028, knotSeatZ + 0.018],
    [sign * 0.104, -0.004, knotSeatZ + 0.011],
    [sign * 0.072, -0.030, knotSeatZ + 0.007],
    [sign * 0.030, -0.016, knotSeatZ + 0.008],
    [sign * 0.004, -0.004, knotSeatZ + 0.010],
  ]
  const centerCrossA: [number, number, number][] = [
    [-0.026, 0.015, knotSeatZ + 0.011],
    [-0.008, 0.006, knotSeatZ + 0.023],
    [0.010, -0.006, knotSeatZ + 0.023],
    [0.026, -0.014, knotSeatZ + 0.011],
  ]
  const centerCrossB: [number, number, number][] = [
    [0.026, 0.015, knotSeatZ + 0.011],
    [0.008, 0.006, knotSeatZ + 0.026],
    [-0.010, -0.006, knotSeatZ + 0.026],
    [-0.026, -0.014, knotSeatZ + 0.011],
  ]
  const centerCollar: [number, number, number][] = [
    [-0.004, 0.026, knotSeatZ + 0.006],
    [-0.002, 0.016, knotSeatZ + 0.026],
    [0.0, 0.0, knotSeatZ + 0.033],
    [0.002, -0.016, knotSeatZ + 0.026],
    [0.004, -0.026, knotSeatZ + 0.006],
  ]
  const tailLocalPoint = (wx: number, wy: number, lift = 0.010): [number, number, number] => [
    wx, wy - POUCH_CINCH_Y + 0.008, evalPouchFrontZ(wx, wy) - (knotSeatZ + 0.010) + lift,
  ]
  const leftTailPts: [number, number, number][] = [
    [0, 0, 0.005],
    tailLocalPoint(-0.024, 0.212, 0.013),
    tailLocalPoint(-0.056, 0.165, 0.0115),
    tailLocalPoint(-0.052, 0.118, 0.011),
    tailLocalPoint(-0.034, 0.086, 0.011),
  ]
  const rightTailPts: [number, number, number][] = [
    [0, 0, 0.005],
    tailLocalPoint(0.025, 0.214, 0.013),
    tailLocalPoint(0.060, 0.176, 0.0115),
    tailLocalPoint(0.056, 0.140, 0.011),
    tailLocalPoint(0.042, 0.116, 0.011),
  ]

  const stemRaw: [number, number][] = [
    [-0.075, -0.23], [-0.057, -0.162], [-0.035, -0.09], [0.002, -0.02], [0.038, 0.045],
  ]
  const stemPoints = stemRaw.map(([x, y]) => [x, y, evalPouchFrontZ(x, y) + 0.0022] as [number, number, number])

  const pouches = VARIANTS.map((variant, i) => {
    const suspension = new THREE.Group(); suspension.name = `omamori-suspension-${variant}`; world.add(suspension)
    const root = new THREE.Group(); root.name = `omamori-pouch-${variant}`; suspension.add(root)
    const body = add(bodyGeo, [coral, sage, indigo][i], [0, 0, 0], root); body.name = `omamori-pouch-body-${variant}`

    // Folded, sealed brocade top cuff & neat cord-entry eyelets (no opening or interior contents).
    const cuff = add(topCuffGeo, seam, [0, 0.342, 0], root)
    cuff.name = `omamori-top-cuff-${variant}`
    for (const x of [-0.09, 0.09]) {
      const eyelet = paint(add(eyeletGeo, cordTipGold, [x, 0.359, 0], root))
      eyelet.rotation.x = Math.PI / 2
    }

    // Flush 2-ply twisted gold corded piping hugging the curved pouch perimeter (zero floating gap).
    const piping = paint(cord(pipingPoints, 0.0064, pipingGold, { tubular: 64, radial: 8, turns: 22, plyDepth: 0.11 }))
    piping.name = `omamori-piping-${variant}`
    root.add(piping)

    // Continuous braided cord wrapping the cinched neck and tying into a sculpted 3D double-loop bow.
    const knot = new THREE.Group(); knot.name = `omamori-knot-${variant}`; knot.position.set(0, POUCH_CINCH_Y, 0); root.add(knot)
    const neckWrap = cord(neckWrapPoints, 0.0108, rope, { tubular: 56, radial: 10, turns: 16, plyDepth: 0.12, closed: true })
    neckWrap.name = `omamori-neck-wrap-${variant}`
    knot.add(neckWrap)
    for (const sign of [-1, 1] as const) {
      const loopMesh = cord(bowLoopPoints(sign), 0.0124, rope, {
        tubular: 36, radial: 10, turns: 8, plyDepth: 0.13, phase: sign < 0 ? 0 : 1.1,
        radiusScaleFn: u => 0.86 + 0.18 * Math.sin(u * Math.PI),
      })
      loopMesh.name = `omamori-bow-loop-${sign < 0 ? 'left' : 'right'}-${variant}`
      knot.add(loopMesh)
    }
    knot.add(cord(centerCrossA, 0.0118, rope, { tubular: 16, radial: 8, turns: 3, plyDepth: 0.10 }))
    knot.add(cord(centerCrossB, 0.0118, rope, { tubular: 16, radial: 8, turns: 3, plyDepth: 0.10, phase: 0.9 }))
    const collarMesh = cord(centerCollar, 0.0138, rope, {
      tubular: 18, radial: 10, turns: 3, plyDepth: 0.11,
      radiusScaleFn: u => 0.82 + 0.24 * Math.sin(u * Math.PI),
    })
    collarMesh.name = `omamori-knot-collar-${variant}`
    knot.add(collarMesh)

    // Flush-draping braided cord tails with gold whipped tips & subtle settling sway pivot.
    const tailPivot = new THREE.Group()
    tailPivot.name = `omamori-cord-tails-${variant}`
    tailPivot.position.set(0, -0.008, knotSeatZ + 0.010)
    knot.add(tailPivot)
    for (const [sideName, pts, phase] of [
      ['left', leftTailPts, 0.2],
      ['right', rightTailPts, 1.5],
    ] as const) {
      const tailMesh = cord(pts, 0.0108, rope, {
        tubular: 26, radial: 10, turns: 6, plyDepth: 0.12, phase,
        radiusScaleFn: u => u > 0.85 ? 0.92 + 0.18 * ((u - 0.85) / 0.15) : 1 - 0.08 * u,
      })
      tailMesh.name = `omamori-tail-${sideName}-${variant}`
      tailPivot.add(tailMesh)
      const endP = pts[pts.length - 1]!, prevP = pts[pts.length - 2]!
      const dir = new THREE.Vector3(endP[0] - prevP[0], endP[1] - prevP[1], endP[2] - prevP[2]).normalize()
      const tip = paint(add(tailTipGeo, cordTipGold, [endP[0], endP[1], endP[2]], tailPivot))
      tip.quaternion.setFromUnitVectors(_refY, dir)
    }

    // Braided hanging loop remains a direct TubeGeometry child of `root` with exact apex (0, 0.64, -0.015).
    const hangLoop = cord(
      [[-0.09, 0.325, 0], [-0.1, 0.51, -0.012], [0, 0.64, -0.015], [0.1, 0.51, -0.012], [0.09, 0.325, 0]],
      0.0115,
      rope,
      { tubular: 44, radial: 10, turns: 12, plyDepth: 0.13 },
    )
    hangLoop.name = `omamori-hang-loop-${variant}`
    root.add(hangLoop)

    // Original embroidered border diamonds & floral sprig seated flush on the curved brocade face.
    for (const y of [-0.25, -0.13, -0.01, 0.11]) for (const x of [-0.15, 0.15]) {
      const stitch = paint(new THREE.Mesh(diamondGeo, stitchGold))
      seatOnPouchFront(stitch, x, y, 0.0018)
      root.add(stitch)
    }
    const stemMesh = paint(cord(stemPoints, 0.0056, leaf, { tubular: 24, radial: 7, turns: 5, plyDepth: 0.08 }))
    stemMesh.name = `omamori-stem-${variant}`
    root.add(stemMesh)
    for (const [x, y, angle] of [[-0.07, -0.18, -0.8], [0.015, -0.1, 0.75]]) {
      const petal = paint(new THREE.Mesh(leafGeo, leaf))
      seatOnPouchFront(petal, x, y, 0.0022, angle)
      root.add(petal)
    }
    for (const [cx, cy, scale] of [[0.055, 0.04, 1], [-0.065, -0.065, 0.63]]) {
      for (let p = 0; p < 5; p++) {
        const a = p / 5 * Math.PI * 2 + i * 0.3
        const px = cx + Math.cos(a) * 0.028 * scale
        const py = cy + Math.sin(a) * 0.028 * scale
        const flower = paint(new THREE.Mesh(petalGeo, flowerCream))
        flower.scale.setScalar(scale)
        seatOnPouchFront(flower, px, py, 0.0026, a)
        root.add(flower)
      }
      const center = paint(new THREE.Mesh(flowerCenterGeo, stitchGold))
      center.scale.setScalar(scale)
      seatOnPouchFront(center, cx, cy, 0.0038)
      root.add(center)
    }

    addInteractionCue(body, { kind: 'tap', label: '轻点选一只小袋', priority: 3, compact: i !== selected,
      anchor: [0, 0, 0.1], enabled: () => canAct() && !placing && step === 0 })
    addInteractionCue(body, { kind: 'drag', label: returning ? '拖小袋到返还箱' : '拖小袋到扣环', priority: 3,
      anchor: [0, 0, 0.1], destination: returning ? returnSlot : clasp, targetLabel: returning ? '返还箱' : '旅行包扣环',
      enabled: () => canAct() && !placing && step === 1 && i === selected })
    addInteractionCue(body, { kind: 'tap', label: returning ? '轻点小袋致谢' : '轻点小袋静候', priority: 3,
      anchor: [0, 0, 0.1], compact: returning,
      enabled: () => canAct() && !placing && step === 2 && i === selected })

    return { root, body, suspension, tailPivot }
  })
  addInteractionCue(boxBody, { kind: 'tap', label: '轻点返还箱致谢', priority: 4, anchor: [0, -0.07, 0.37],
    enabled: () => canAct() && !placing && returning && step === 2 })

  const destination = returning ? RETURNED : HUNG
  const matrices = () => { scene.updateMatrixWorld(); camera.updateMatrixWorld() }
  const touch = createTouchTarget(canvas,camera,scene)
  const placementReady = (x:number,y:number) => Math.hypot(x-downX,y-downY)>0
    && !touch.occluded(x,y,returning?returnSlot:clasp,{ignore:pouches[selected].root})
    && placementHit(canvas,camera,pouches[selected].body,x,y,(px,py)=>touch.hit(px,py,returning?returnSlot:clasp,{ignore:pouches[selected].root}),[0,0,.1])
  const physicalLayout = () => {
    pouches.forEach(({ root, suspension, tailPivot }, i) => {
      suspension.position.set(0, 0, 0); suspension.rotation.set(0, 0, 0)
      tailPivot.rotation.set(0, 0, 0)
      const isSelected = i === selected && step > 0
      root.position.set(DISPLAY[i], 1.075, 0.38); root.scale.setScalar(0.72); root.rotation.set(0, 0, i === 1 ? 0.04 : -0.035)
      if (isSelected) {
        root.position.copy(step >= 2 ? destination : HELD); root.scale.setScalar(0.9); root.rotation.set(0, 0, 0)
        if (step >= 2 && !returning) {
          suspension.position.copy(HANG_POINT)
          root.position.copy(HANG_ANCHOR).multiplyScalar(-0.9)
        }
      }
    })
  }
  const ray = createPointerRay(canvas, camera), plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), -HELD.z), point = new THREE.Vector3()
  const resetDrag = () => { dragging = false; startIndex = -1; if (!placing) physicalLayout() }
  const objectAt = (x: number, y: number, candidates: THREE.Object3D[]) => ray.aim(x, y).intersectObjects(candidates, false)[0]?.object
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: canAct,
    canStart(x, y) {
      if (placing || step === 3) return false
      matrices()
      return Boolean(objectAt(x, y, step === 0 ? pouches.map(p => p.body) : returning && step === 2 ? [pouches[selected].body, boxBody] : [pouches[selected].body]))
    },
    onStart(x, y) {
      matrices(); downX = x; downY = y; feedback.prepare()
      startIndex = step === 0 ? pouches.findIndex(p => p.body === objectAt(x, y, pouches.map(p => p.body))) : selected
      dragging = step === 1
      if(dragging)plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()),pouches[selected].body.localToWorld(new THREE.Vector3(0,0,.1)))
      if (dragging && ray.aim(x, y).ray.intersectPlane(plane, point)) dragOffset.copy(pouches[selected].root.position).sub(point)
    },
    onMove(x, y) {
      if (!dragging || step !== 1) return
      if (ray.aim(x, y).ray.intersectPlane(plane, point)) {
        point.add(dragOffset)
        pouches[selected].root.position.copy(point);pouches[selected].root.position.x=THREE.MathUtils.clamp(point.x,-1.35,1.35);pouches[selected].root.position.y=THREE.MathUtils.clamp(point.y,.8,1.9)
        matrices(); if (placementReady(x,y) && pointer.finish()) { dragging = false; startIndex = -1; place(true) }
      }
    },
    onRelease(x, y) {
      if (dragging && step === 1 && ray.aim(x,y).ray.intersectPlane(plane,point)) {
        point.add(dragOffset)
        pouches[selected].root.position.copy(point);pouches[selected].root.position.x=THREE.MathUtils.clamp(point.x,-1.35,1.35);pouches[selected].root.position.y=THREE.MathUtils.clamp(point.y,.8,1.9)
      }
      const index = startIndex; dragging = false; startIndex = -1; matrices()
      if (step === 0 && index >= 0 && Math.hypot(x - downX, y - downY) < 12 && ray.hits(x, y, [pouches[index].body])) choose(index)
      else if (step === 1 && placementReady(x,y)) place()
      else if (step === 2 && Math.hypot(x - downX, y - downY) < 12 && ray.hits(x, y, returning ? [pouches[selected].body, boxBody] : [pouches[selected].body])) finish()
      else resetDrag()
    },
    onCancel: resetDrag,
  })
  const ending = createQuietEnding(ctx, { ui: ui, isActive: () => started && !disposed && canAct(),
    duration: 3, motion: 'sway', targets: () => [returning ? pouches[selected].root : pouches[selected].suspension], cancelInput: () => { pointer.cancel() }, complete: () => finish(),
  })
  const sync = () => {
    ui.renderDots(step, 3); ui.actionBtn.hidden = step === 3
    ui.actionBtn.disabled = placing || !canAct(); ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled))
    wishSlot.hidden = step !== 2 || returning
    writer?.setEnabled(step === 2 && !returning && !placing && canAct())
    ui.hitLayer.style.pointerEvents = step < 3 && !placing ? 'auto' : 'none'
    setSafeText(ui.hintEl, step === 0 ? returning ? COPY.selectReturn : COPY.select : step === 1 ? placing ? COPY.placing : returning ? COPY.box : COPY.clasp : step === 2 ? returning ? COPY.gratitude : COPY.wish : returning ? COPY.returned : COPY.done, safe)
    setSafeText(ui.actionBtn, step === 0 ? COPY.choose : step === 1 ? returning ? COPY.returnBag : COPY.carry : returning ? COPY.thank : COPY.quiet, safe)
    ending.sync(step === 2 && !placing)
  }
  function choose(index: number) {
    if (!canAct() || pointer.isBusy() || step !== 0 || placing) return
    selected = index; step = 1; physicalLayout(); sync()
    ctx.onVariantChange?.(VARIANTS[selected]); ctx.onProgress?.(1)
    feedback.impact({ freqs: [523.25, 659.25], duration: 0.18, gain: 0.019, type: 'triangle' })
  }
  function placed() {
    if (!canAct() || step !== 1 || !placing) return
    step = 2; placing = false; clock = 0; physicalLayout(); sync(); ctx.onProgress?.(2)
    feedback.impact({ freqs: [659.25], duration: 0.17, gain: 0.016 })
  }
  function place(arrived = false) {
    if (!canAct() || (pointer.isBusy() && !arrived) || step !== 1 || placing) return
    placing = true; dragging = false; placeT = 0; placeFrom.copy(pouches[selected].root.position); sync()
    if (reduced()) placed()
  }
  function finish(text = '') {
    if (!text.trim() && !ending.completing) return
    if (!canAct() || pointer.isBusy() || step !== 2 || placing) return
    const line = text.trim()
    // Set the terminal phase before any host callback, including saving a wish.
    step = 3; clock = 0; physicalLayout(); sync()
    if (line && !returning && !saved) { saved = true; ctx.saveWish?.(line); if (disposed || !canAct()) return }
    ctx.onProgress?.(3)
    if (disposed || !canAct()) return
    feedback.impact({ freqs: [392, 587.33], duration: 0.25, gain: 0.018 })
    if (disposed || !canAct()) return
    overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
  }
  const action = () => {
    if (!canAct() || pointer.isBusy() || placing) return
    feedback.prepare()
    if (step === 0) choose(selected); else if (step === 1) place(); else if (step === 2) finish()
  }
  const blur = () => { focused = false; pointer.cancel(); writer?.setEnabled(false); sync() }
  const focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera)
    home.z = 5.2 + portraitBoost(aspect, 2.8); camera.position.copy(home); camera.lookAt(look)
  }
  physicalLayout(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; step = THREE.MathUtils.clamp(Math.floor(ctx.initialProgress ?? 0), 0, 3)
      physicalLayout(); resize(); stopResize = observeCanvasResize(canvas, resize)
      if (!returning) {
        writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined,
          onSubmit: text => { if (!canAct() || pointer.isBusy() || step !== 2 || placing) return; feedback.prepare(); finish(text) } })
        writer.mount(wishSlot, {})
      }
      ui.actionBtn.addEventListener('click', action)
      window.addEventListener('blur', blur); window.addEventListener('focus', focus)
      sync(); matrices()
    },
    update(dt) {
      if (!started || disposed) return
      if (!canAct()) {
        pointer.cancel(); writer?.setEnabled(false)
        // Refresh projected cues once while keeping animation and feedback paused.
        if (!inactiveRendered) { style.render(); inactiveRendered = true }
        return
      }
      inactiveRendered = false
      writer?.setEnabled(step === 2 && !returning && !placing); writer?.update(dt)
      ui.actionBtn.disabled = placing; ui.actionBtn.setAttribute('aria-disabled', String(placing))
      const delta = Math.min(Math.max(dt, 0), 0.05), quiet = reduced()
      if (placing) {
        placeT = quiet ? 1 : Math.min(1, placeT + delta / 0.6)
        const eased = placeT * placeT * (3 - 2 * placeT)
        pouches[selected].root.position.lerpVectors(placeFrom, destination, eased)
        pouches[selected].root.rotation.z = quiet ? 0 : Math.sin(placeT * Math.PI) * 0.035
        // Gentle secondary cord-tail inertia lag during placement arc (zero in reduced mode).
        pouches[selected].tailPivot.rotation.z = quiet ? 0 : -Math.sin(placeT * Math.PI) * 0.068
        if (placeT === 1) placed()
      } else if (step >= 2 && !dragging) {
        if (!quiet) clock += delta
        const sway = quiet || returning ? 0 : Math.sin(clock * 1.8) * Math.exp(-clock * 1.1) * 0.012
        pouches[selected].suspension.rotation.z = sway
        // Subtle phase-lagged cord-tail settle damped to rest (zero in reduced mode).
        pouches[selected].tailPivot.rotation.z = quiet || returning
          ? 0
          : -Math.sin(Math.max(0, clock - 0.08) * 1.8) * Math.exp(-clock * 1.25) * 0.042
      } else {
        pouches[selected].tailPivot.rotation.z = 0
      }
      ending.update(dt)
      if (disposed || !(canAct())) return
      style.render()
    },
    dispose() {
      if (disposed) return
      ending.dispose()
      disposed = true; stopResize(); pointer.dispose(); writer?.dispose(); feedback.dispose()
      ui.actionBtn.removeEventListener('click', action)
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus)
      style.dispose()
      brocadeTex.map.dispose(); brocadeTex.bump.dispose()
      cordTex.map.dispose(); cordTex.bump.dispose()
      disposeTree(world); lights.key.dispose(); lights.rim.dispose()
      scene.clear(); renderer.dispose(); renderer.forceContextLoss()
      overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
