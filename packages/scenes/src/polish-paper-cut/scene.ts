import * as THREE from 'three'
import { createQuietEnding } from '../quiet-ending'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createDebugRenderStyle } from '@wbr/scene-runtime/debug-render-style'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { addInteractionCue } from '../scene-localization'
import type { GestureHandle } from '@wbr/gestures'
import type { SceneContext, SceneInstance } from '../contract'
import { createObjectPointer } from '../object-pointer'
import { createTouchTarget } from '../touch-target'
import { addStageLights, CEL_STYLE, createPointerRay, createSceneFeedback, createStepOverlay, createWarmStage, disposeTree, observeCanvasResize, setSafeText, sizeStage } from '../procedural-kit'

const COPY = {
  title: '剪纸开花', cut: '拿住剪刀，沿右侧最后一道纸边向上剪开；松手，让边角料落下。',
  unfold: '拉住折纸右侧的纸边，向左慢慢展开，让两边的花叶相见。',
  quiet: '轻点剪纸静看，或写一句心意后点「写好了」。',
  returning: '轻点剪纸，回看这一朵纸上的花。', done: '留一朵纸花在日常。',
  cutting: '最后一道纸边剪开，边角料轻轻落下…', opening: '折痕展开，两边的花叶慢慢相见…',
} as const
type Checkpoint = 0 | 1 | 2 | 3
type XYZ = [number, number, number]
const MAT_TOP = .040
const PAPER_T = .0058
const SPINE_RIDGE = .021
const HALF_SPAN_Z = SPINE_RIDGE + PAPER_T
const HINGE_Z = MAT_TOP + HALF_SPAN_Z
const TOOL_HOME = new THREE.Vector3(.946, -.41, .045), TOOL_REST = new THREE.Vector3(1.32, -.61, .045)
const SCRAP_HOME = new THREE.Vector3(1.058, .195, MAT_TOP), SCRAP_REST = new THREE.Vector3(1.25, -.45, MAT_TOP)
const ease = (t: number) => t * t * (3 - 2 * t)

type Vec2Tuple = [number, number]
type TriTuple = [number, number, number]

function hash2d(ix: number, iy: number): number {
  const n = Math.sin(ix * 127.1 + iy * 311.7) * 43758.5453123
  return n - Math.floor(n)
}

function valueNoise2d(x: number, y: number): number {
  const ix = Math.floor(x), iy = Math.floor(y)
  const fx = x - ix, fy = y - iy
  const ux = fx * fx * (3 - 2 * fx), uy = fy * fy * (3 - 2 * fy)
  const a = hash2d(ix, iy), b = hash2d(ix + 1, iy)
  const c = hash2d(ix, iy + 1), d = hash2d(ix + 1, iy + 1)
  return (a + (b - a) * ux) + ((c - a) + (a - b - c + d) * ux) * uy
}

/** Deterministic warm matte self-healing cutting mat texture calibrated against Komorebi daylight clipping. */
function createCuttingMatTexture(): THREE.DataTexture {
  const w = 256, h = 192
  const data = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const v = (y + .5) / h
    const dy = (v - .5) * 2
    for (let x = 0; x < w; x++) {
      const u = (x + .5) / w
      const dx = (u - .5) * 2
      const macro = (valueNoise2d(u * 10 + 1.3, v * 8 + 2.7) - .5) * 6.0
      const tooth = (valueNoise2d(u * 68 + 4.1, v * 52 + 7.9) - .5) * 4.8
      const fine = (hash2d(x, y) - .5) * 2.6
      const vignette = -Math.pow(Math.max(Math.abs(dx), Math.abs(dy)), 3.2) * 7.5
      const delta = macro + tooth + fine + vignette
      const i = (y * w + x) * 4
      data[i] = Math.round(THREE.MathUtils.clamp(212 + delta, 188, 224))
      data[i + 1] = Math.round(THREE.MathUtils.clamp(198 + delta * .96, 174, 212))
      data[i + 2] = Math.round(THREE.MathUtils.clamp(170 + delta * .88, 148, 186))
      data[i + 3] = 255
    }
  }
  const tex = new THREE.DataTexture(data, w, h)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/**
 * Deterministic 512x512 fine handmade dyed-rag paper texture (subtle organic pulp mottling,
 * fine laid screen tooth, and delicate short hairline cellulose flecks — no coarse blotches).
 */
function createDyedPaperTexture(): THREE.DataTexture {
  const w = 512, h = 512
  const buf = new Float32Array(w * h)
  const warmFlecks = new Float32Array(w * h)
  for (let y = 0; y < h; y++) {
    const v = (y + .5) / h
    for (let x = 0; x < w; x++) {
      const u = (x + .5) / w
      const pulp = (valueNoise2d(u * 14 + 2.1, v * 14 + 5.3) - .5) * .11
        + (valueNoise2d(u * 38 + 9.4, v * 38 + 1.7) - .5) * .085
        + (valueNoise2d(u * 112 + 3.7, v * 112 + 8.2) - .5) * .065
      const tooth = (hash2d(x, y) - .5) * .045
      // Subtle laid screen lines and gentle cross-chain weave.
      const laid = Math.sin(v * Math.PI * 190 + pulp * 4.5) * .016
      const chain = Math.sin(u * Math.PI * 34) * .007
      buf[y * w + x] = pulp + tooth + laid + chain
    }
  }

  // Scatter crisp, hairline short rag-paper fibers (1-1.3 px wide, 7-17 px long).
  const fiberCount = 460
  for (let f = 0; f < fiberCount; f++) {
    const fx = hash2d(f * 3.17, 11.3) * w
    const fy = hash2d(f * 5.41, 27.9) * h
    const angle = hash2d(f * 7.83, 43.1) * Math.PI * 2
    const len = 6 + hash2d(f * 2.13, 61.7) * 11
    const bend = (hash2d(f * 4.59, 89.2) - .5) * 3.2
    const isLight = hash2d(f * 9.07, 13.5) > .38
    const amp = isLight ? (.045 + hash2d(f * 6.1, 3.7) * .045) : -(.045 + hash2d(f * 6.1, 3.7) * .040)
    const cx = Math.cos(angle), cy = Math.sin(angle)
    const nx = -cy, ny = cx
    const steps = Math.ceil(len * 1.6)
    for (let s = 0; s <= steps; s++) {
      const t = s / steps
      const arch = Math.sin(t * Math.PI) * bend
      const px = fx + (t - .5) * len * cx + arch * nx
      const py = fy + (t - .5) * len * cy + arch * ny
      const ix = ((Math.floor(px) % w) + w) % w
      const iy = ((Math.floor(py) % h) + h) % h
      const env = Math.sin(t * Math.PI)
      const idx = iy * w + ix
      if (isLight) warmFlecks[idx] = Math.min(.14, warmFlecks[idx]! + amp * env)
      else buf[idx] = buf[idx]! + amp * env
    }
  }

  const data = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const shade = 1 + buf[i]!
    const wFleck = warmFlecks[i]!
    // Base neutral-white multiplier with tiny warm-cellulose fiber shift (pigment comes from material color).
    const r = THREE.MathUtils.clamp(shade + wFleck * 1.35, .72, 1.24)
    const g = THREE.MathUtils.clamp(shade + wFleck * 1.12, .72, 1.22)
    const b = THREE.MathUtils.clamp(shade + wFleck * .85, .72, 1.18)
    data[i * 4] = Math.round(THREE.MathUtils.clamp(r * 218, 0, 255))
    data[i * 4 + 1] = Math.round(THREE.MathUtils.clamp(g * 218, 0, 255))
    data[i * 4 + 2] = Math.round(THREE.MathUtils.clamp(b * 218, 0, 255))
    data[i * 4 + 3] = 255
  }
  const tex = new THREE.DataTexture(data, w, h)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/**
 * Evaluates bottom Z height (above MAT_TOP) of the unfolded right paper half.
 * - Strictly `SPINE_RIDGE` along `x = 0` so both halves meet seamlessly at the central fold crease.
 * - Rests flush on the mat (`0`) along the mid-wing band (`x in [0.34, 0.44]`).
 * - Outer scalloped lobes and upper/lower tips lift gently (`~0.011–0.0175`) to cast crisp soft shadows.
 */
function evalFixedBottomZ(x: number, y: number): number {
  const cx = Math.max(0, x)
  const ridge = SPINE_RIDGE * Math.pow(Math.max(0, 1 - cx / .30), 1.55)
  const outerX = THREE.MathUtils.smoothstep(cx, .42, .95)
  const tipDist = Math.hypot(cx - .34, y * .68)
  const tipCurl = THREE.MathUtils.smoothstep(tipDist, .34, .74) * THREE.MathUtils.smoothstep(cx, .24, .44)
  const wave = .0014 * Math.sin(y * 4.2 + .4) * outerX
  const lift = ridge + .0135 * Math.pow(outerX, 1.12) + .0056 * tipCurl + wave
  if (cx < 1e-4) return SPINE_RIDGE
  return THREE.MathUtils.clamp(lift, 0, SPINE_RIDGE - .0015)
}

function dedupeRing(raw: THREE.Vector2[]): THREE.Vector2[] {
  const out: THREE.Vector2[] = []
  for (const p of raw) {
    const prev = out[out.length - 1]
    if (!prev || prev.distanceToSquared(p) > 1e-10) out.push(p.clone())
  }
  while (out.length > 1 && out[0]!.distanceToSquared(out[out.length - 1]!) <= 1e-10) out.pop()
  return out
}

function subdivideRing(ring: THREE.Vector2[], maxLen: number): THREE.Vector2[] {
  const out: THREE.Vector2[] = []
  const n = ring.length
  for (let i = 0; i < n; i++) {
    const a = ring[i]!, b = ring[(i + 1) % n]!
    const segs = Math.max(1, Math.ceil(a.distanceTo(b) / maxLen))
    for (let s = 0; s < segs; s++) {
      const t = s / segs
      out.push(new THREE.Vector2(THREE.MathUtils.lerp(a.x, b.x, t), THREE.MathUtils.lerp(a.y, b.y, t)))
    }
  }
  return out
}

function distToSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax, dy = by - ay
  const lenSq = dx * dx + dy * dy
  if (lenSq < 1e-12) return Math.hypot(px - ax, py - ay)
  const t = THREE.MathUtils.clamp(((px - ax) * dx + (py - ay) * dy) / lenSq, 0, 1)
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy))
}

type CutPaperPlanarMesh = {
  pts: Vec2Tuple[]
  tris: TriTuple[]
  loops: number[][]
  cutDist: number[]
}

/** Triangulates and smoothly refines the exact 2D cutout shape and holes without splitting boundary rings. */
function buildCutPaperPlanarMesh(shape: THREE.Shape): CutPaperPlanarMesh {
  const extracted = shape.extractPoints(20)
  const contourRaw = dedupeRing(extracted.shape)
  if (THREE.ShapeUtils.isClockWise(contourRaw)) contourRaw.reverse()
  const holesRaw = extracted.holes.map(h => {
    const clean = dedupeRing(h)
    if (!THREE.ShapeUtils.isClockWise(clean)) clean.reverse()
    return clean
  })

  const MAX_BOUNDARY = .052
  const contour = subdivideRing(contourRaw, MAX_BOUNDARY)
  const holes = holesRaw.map(h => subdivideRing(h, MAX_BOUNDARY))

  const pts: Vec2Tuple[] = []
  const loops: number[][] = []
  const pushLoop = (ring: THREE.Vector2[]) => {
    const idxs: number[] = []
    for (const p of ring) {
      idxs.push(pts.length)
      pts.push([p.x, p.y])
    }
    loops.push(idxs)
  }
  pushLoop(contour)
  for (const h of holes) pushLoop(h)
  const boundaryCount = pts.length

  const rawTris = THREE.ShapeUtils.triangulateShape(contour, holes)
  let tris: TriTuple[] = rawTris.map(([a, b, c]) => {
    const pa = pts[a]!, pb = pts[b]!, pc = pts[c]!
    const area2 = (pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0])
    return area2 >= 0 ? [a, b, c] : [a, c, b]
  })

  // Conforming interior longest-edge refinement (never splits boundary segments <= 0.052).
  const MAX_EDGE = .082
  for (let pass = 0; pass < 5; pass++) {
    const splitMap = new Map<string, number>()
    const edgeKey = (u: number, v: number) => (u < v ? `${u}:${v}` : `${v}:${u}`)
    const maybeSplit = (u: number, v: number) => {
      const k = edgeKey(u, v)
      const existing = splitMap.get(k)
      if (existing !== undefined) return existing
      const pu = pts[u]!, pv = pts[v]!
      if (Math.hypot(pu[0] - pv[0], pu[1] - pv[1]) <= MAX_EDGE) return -1
      const idx = pts.length
      pts.push([(pu[0] + pv[0]) * .5, (pu[1] + pv[1]) * .5])
      splitMap.set(k, idx)
      return idx
    }
    for (const [a, b, c] of tris) { maybeSplit(a, b); maybeSplit(b, c); maybeSplit(c, a) }
    if (splitMap.size === 0) break

    const next: TriTuple[] = []
    const getMid = (u: number, v: number) => splitMap.get(edgeKey(u, v)) ?? -1
    for (const [a, b, c] of tris) {
      const mab = getMid(a, b), mbc = getMid(b, c), mca = getMid(c, a)
      const count = (mab >= 0 ? 1 : 0) + (mbc >= 0 ? 1 : 0) + (mca >= 0 ? 1 : 0)
      if (count === 0) {
        next.push([a, b, c])
      } else if (count === 3) {
        next.push([a, mab, mca], [mab, b, mbc], [mca, mbc, c], [mab, mbc, mca])
      } else if (count === 1) {
        if (mab >= 0) next.push([a, mab, c], [mab, b, c])
        else if (mbc >= 0) next.push([a, b, mbc], [a, mbc, c])
        else next.push([a, b, mca], [mca, b, c])
      } else {
        // Rotate so the two split edges are (v0, v1) and (v1, v2).
        let v0 = a, v1 = b, v2 = c, m0 = mab, m1 = mbc
        if (mab < 0) { v0 = b; v1 = c; v2 = a; m0 = mbc; m1 = mca }
        else if (mbc < 0) { v0 = c; v1 = a; v2 = b; m0 = mca; m1 = mab }
        next.push([m0, v1, m1])
        const p0 = pts[v0]!, pm0 = pts[m0]!, pm1 = pts[m1]!, p2 = pts[v2]!
        const d0 = Math.hypot(p0[0] - pm1[0], p0[1] - pm1[1])
        const d1 = Math.hypot(pm0[0] - p2[0], pm0[1] - p2[1])
        if (d0 <= d1) next.push([v0, m0, m1], [v0, m1, v2])
        else next.push([v0, m0, v2], [m0, m1, v2])
      }
    }
    tris = next
  }

  // Constrained Laplacian smoothing for interior vertices only (strictly preserves positive triangle areas).
  const neighbors: Set<number>[] = Array.from({ length: pts.length }, () => new Set<number>())
  const incident: number[][] = Array.from({ length: pts.length }, () => [])
  tris.forEach(([a, b, c], ti) => {
    neighbors[a]!.add(b); neighbors[a]!.add(c)
    neighbors[b]!.add(a); neighbors[b]!.add(c)
    neighbors[c]!.add(a); neighbors[c]!.add(b)
    incident[a]!.push(ti); incident[b]!.push(ti); incident[c]!.push(ti)
  })
  for (let iter = 0; iter < 3; iter++) {
    for (let i = boundaryCount; i < pts.length; i++) {
      const nb = neighbors[i]!
      if (nb.size === 0) continue
      let sx = 0, sy = 0
      for (const j of nb) { sx += pts[j]![0]; sy += pts[j]![1] }
      const nx = pts[i]![0] * .5 + (sx / nb.size) * .5
      const ny = pts[i]![1] * .5 + (sy / nb.size) * .5
      const prev = pts[i]!
      pts[i] = [nx, ny]
      let ok = true
      for (const ti of incident[i]!) {
        const [a, b, c] = tris[ti]!
        const pa = pts[a]!, pb = pts[b]!, pc = pts[c]!
        if ((pb[0] - pa[0]) * (pc[1] - pa[1]) - (pb[1] - pa[1]) * (pc[0] - pa[0]) <= 1e-6) { ok = false; break }
      }
      if (!ok) pts[i] = prev
    }
  }

  // Exact distance to the nearest scissors-cut boundary (outer contour + 3 holes, excluding central fold spine x = 0).
  const cutSegs: [number, number, number, number][] = []
  for (let li = 0; li < loops.length; li++) {
    const loop = loops[li]!
    for (let i = 0; i < loop.length; i++) {
      const pa = pts[loop[i]!]!, pb = pts[loop[(i + 1) % loop.length]!]!
      if (li === 0 && pa[0] < 1e-4 && pb[0] < 1e-4) continue
      cutSegs.push([pa[0], pa[1], pb[0], pb[1]])
    }
  }
  const cutDist = pts.map(([px, py]) => {
    let best = Infinity
    for (const [ax, ay, bx, by] of cutSegs) {
      const d = distToSegment(px, py, ax, ay, bx, by)
      if (d < best) best = d
    }
    return best
  })

  return { pts, tris, loops, cutDist }
}

/**
 * Builds a watertight thin cut-paper BufferGeometry for either the fixed right half
 * (`mirrored = false`) or the hinged half (`mirrored = true`, which matches the fixed half
 * seamlessly at x = 0 both when closed and after unfolding by hinge.rotation.y = -Math.PI).
 */
function createCutPaperHalfGeometry(planar: CutPaperPlanarMesh, mirrored: boolean): THREE.BufferGeometry {
  const { pts, tris, loops, cutDist } = planar
  const n = pts.length
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const faceIndices: number[] = []
  const wallIndices: number[] = []

  const zLowArr = new Float32Array(n)
  const zHighArr = new Float32Array(n)
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i]!
    const zb = evalFixedBottomZ(x, y)
    if (!mirrored) {
      zLowArr[i] = zb
      zHighArr[i] = zb + PAPER_T
    } else {
      zLowArr[i] = SPINE_RIDGE - zb
      zHighArr[i] = zLowArr[i]! + PAPER_T
    }
  }

  const uvFor = (x: number, y: number): [number, number] => [
    mirrored ? .5 - x * .44 : .5 + x * .44,
    .5 + (y - .05) * .44,
  ]

  // Subtle hand-dyed paper tonal modulation, delicate cut-rim catchlight, and crisp fold-crease light/shade planes.
  const faceColor = (i: number, isDisplayFace: boolean): [number, number, number] => {
    const [x, y] = pts[i]!
    const dCut = cutDist[i]!
    const cutRim = (1 - THREE.MathUtils.smoothstep(dCut, 0, .028)) * .11
    const spineBurnish = Math.exp(-Math.pow(x / .016, 2)) * .085
    // Under Komorebi sun from lower-left (-6, 12, 6), the unfolded left slope tilts into light
    // while the right slope falls into soft half-tone, making the central fold crease unmistakable.
    const foldSlope = Math.exp(-Math.pow(x / .32, 1.3))
    const foldSideShift = isDisplayFace ? (mirrored ? .068 : -.062) * foldSlope : .022 * foldSlope
    const creaseTrough = -Math.exp(-Math.pow((x - .036) / .034, 2)) * (mirrored ? .018 : .055)
    const ux = mirrored ? -x : x
    const dyeCloud = (valueNoise2d(ux * 2.2 + 3.1, y * 2.2 + 5.7) - .5) * .050
    const base = (isDisplayFace ? 1.0 : .975) + cutRim + spineBurnish + foldSideShift + creaseTrough + dyeCloud
    return [base * (1 + cutRim * .28 + spineBurnish * .22), base * (1 + cutRim * .16 + spineBurnish * .12), base]
  }

  // Cap 0: +Z face (top of fixed, or outer closed face of folded).
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i]!
    const [u, v] = uvFor(x, y)
    const [r, g, b] = faceColor(i, !mirrored)
    positions.push(x, y, zHighArr[i]!)
    uvs.push(u, v)
    colors.push(r, g, b)
  }
  for (const [a, b, c] of tris) faceIndices.push(a, b, c)

  // Cap 1: -Z face (bottom of fixed, or unfolded visible top face of folded).
  const backOffset = n
  for (let i = 0; i < n; i++) {
    const [x, y] = pts[i]!
    const [u, v] = uvFor(x, y)
    const [r, g, b] = faceColor(i, mirrored)
    positions.push(x, y, zLowArr[i]!)
    uvs.push(u, v)
    colors.push(r, g, b)
  }
  for (const [a, b, c] of tris) faceIndices.push(backOffset + a, backOffset + c, backOffset + b)

  // Perimeter + 3 oval hole scissors-cut walls (group 1: paler fibrous cut-paper pulp core).
  for (const loop of loops) {
    const m = loop.length
    let arc = 0
    for (let i = 0; i < m; i++) {
      const idx0 = loop[i]!, idx1 = loop[(i + 1) % m]!
      const p0 = pts[idx0]!, p1 = pts[idx1]!
      const segLen = Math.hypot(p1[0] - p0[0], p1[1] - p0[1])
      const u0 = (arc * .5) % 1, u1 = ((arc + segLen) * .5) % 1
      arc += segLen
      const base = positions.length / 3
      const hi0 = zHighArr[idx0]!, lo0 = zLowArr[idx0]!
      const hi1 = zHighArr[idx1]!, lo1 = zLowArr[idx1]!
      // Outward CCW wall quad for CCW outer contour and CW hole rings.
      positions.push(
        p0[0], p0[1], hi0,
        p0[0], p0[1], lo0,
        p1[0], p1[1], lo1,
        p1[0], p1[1], hi1,
      )
      uvs.push(u0, .92, u0, .08, u1, .08, u1, .92)
      const topTone = mirrored ? .88 : 1.06
      const botTone = mirrored ? 1.06 : .88
      colors.push(
        topTone, topTone, topTone,
        botTone, botTone, botTone,
        botTone, botTone, botTone,
        topTone, topTone, topTone,
      )
      wallIndices.push(base, base + 1, base + 2, base, base + 2, base + 3)
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex([...faceIndices, ...wallIndices])
  geometry.addGroup(0, faceIndices.length, 0)
  geometry.addGroup(faceIndices.length, wallIndices.length, 1)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Appends a closed subdivided thin paper strip into shared attribute buffers (material group 0 faces, group 1 edges). */
function appendCurvedPaperStrip(
  target: { positions: number[]; uvs: number[]; colors: number[]; faceIdx: number[]; wallIdx: number[] },
  opts: {
    xMin: number; xMax: number; yMin: number; yMax: number
    nx: number; ny: number; thickness: number
    evalBottomZ: (u: number, v: number) => number
    uvOffset: [number, number]; shade: number
  },
) {
  const { xMin, xMax, yMin, yMax, nx, ny, thickness, evalBottomZ, uvOffset, shade } = opts
  const cols = nx + 1, rows = ny + 1
  const topPts: XYZ[] = [], botPts: XYZ[] = []
  for (let iy = 0; iy < rows; iy++) {
    const v = iy / ny
    const y = THREE.MathUtils.lerp(yMin, yMax, v)
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / nx
      const x = THREE.MathUtils.lerp(xMin, xMax, u)
      const zb = evalBottomZ(u, v)
      botPts.push([x, y, zb])
      topPts.push([x, y, zb + thickness])
    }
  }
  const addQuad = (arr: number[], a: number, b: number, c: number, d: number) => {
    arr.push(a, b, c, a, c, d)
  }
  const topStart = target.positions.length / 3
  for (let iy = 0; iy < rows; iy++) {
    const v = iy / ny
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / nx
      const k = iy * cols + ix
      const p = topPts[k]!
      const rim = (1 - THREE.MathUtils.smoothstep(Math.min(u, 1 - u, v, 1 - v), 0, .14)) * .065
      const s = shade + rim
      target.positions.push(p[0], p[1], p[2])
      target.uvs.push(uvOffset[0] + u * .14, uvOffset[1] + v * .26)
      target.colors.push(s, s, s)
    }
  }
  const botStart = target.positions.length / 3
  for (let iy = 0; iy < rows; iy++) {
    const v = iy / ny
    for (let ix = 0; ix < cols; ix++) {
      const u = ix / nx
      const k = iy * cols + ix
      const p = botPts[k]!
      const s = shade * .95
      target.positions.push(p[0], p[1], p[2])
      target.uvs.push(uvOffset[0] + u * .14, uvOffset[1] + v * .26)
      target.colors.push(s, s, s)
    }
  }
  for (let iy = 0; iy < ny; iy++) {
    for (let ix = 0; ix < nx; ix++) {
      const a = iy * cols + ix
      addQuad(target.faceIdx, topStart + a, topStart + a + 1, topStart + a + cols + 1, topStart + a + cols)
      addQuad(target.faceIdx, botStart + a, botStart + a + cols, botStart + a + cols + 1, botStart + a + 1)
    }
  }

  // CCW perimeter rim around the strip.
  const perim: number[] = []
  for (let ix = 0; ix <= nx; ix++) perim.push(ix)
  for (let iy = 1; iy <= ny; iy++) perim.push(iy * cols + nx)
  for (let ix = nx - 1; ix >= 0; ix--) perim.push(ny * cols + ix)
  for (let iy = ny - 1; iy >= 0; iy--) perim.push(iy * cols)
  for (let i = 0; i < perim.length - 1; i++) {
    const k0 = perim[i]!, k1 = perim[i + 1]!
    const t0 = topPts[k0]!, b0 = botPts[k0]!, t1 = topPts[k1]!, b1 = botPts[k1]!
    const base = target.positions.length / 3
    target.positions.push(t0[0], t0[1], t0[2], b0[0], b0[1], b0[2], b1[0], b1[1], b1[2], t1[0], t1[1], t1[2])
    const u0 = (i / perim.length) % 1, u1 = ((i + 1) / perim.length) % 1
    target.uvs.push(u0, .92, u0, .08, u1, .08, u1, .92)
    target.colors.push(1.04, 1.04, 1.04, .90, .90, .90, .90, .90, .90, 1.04, 1.04, 1.04)
    addQuad(target.wallIdx, base, base + 1, base + 2, base + 3)
  }
}

function finalizeStripGeometry(buf: { positions: number[]; uvs: number[]; colors: number[]; faceIdx: number[]; wallIdx: number[] }): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(buf.positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(buf.uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(buf.colors, 3))
  geometry.setIndex([...buf.faceIdx, ...buf.wallIdx])
  geometry.addGroup(0, buf.faceIdx.length, 0)
  geometry.addGroup(buf.faceIdx.length, buf.wallIdx.length, 1)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/** Thin double-layer folded paper connecting bridge sheared away as the scissors advance. */
function createDoubleLayerSeamGeometry(): THREE.BufferGeometry {
  const buf = { positions: [] as number[], uvs: [] as number[], colors: [] as number[], faceIdx: [] as number[], wallIdx: [] as number[] }
  const lowerZ = evalFixedBottomZ(.95, .185)
  // Stay cleanly inside the narrow uncut gap [0.9505, 0.9585] and recessed 0.0004 in Z to avoid coplanar dashes at p0.
  appendCurvedPaperStrip(buf, {
    xMin: -.0055, xMax: .0055, yMin: -.265, yMax: .265, nx: 2, ny: 8, thickness: PAPER_T - .0006,
    evalBottomZ: (_u, v) => evalFixedBottomZ(.95, THREE.MathUtils.lerp(-.08, .45, v)) - lowerZ + .0002,
    uvOffset: [.82, .38], shade: .99,
  })
  appendCurvedPaperStrip(buf, {
    xMin: -.0055, xMax: .0055, yMin: -.265, yMax: .265, nx: 2, ny: 8, thickness: PAPER_T - .0006,
    evalBottomZ: (_u, v) => HALF_SPAN_Z + (SPINE_RIDGE - evalFixedBottomZ(.95, THREE.MathUtils.lerp(-.08, .45, v))) - lowerZ + .0002,
    uvOffset: [.78, .38], shade: 1.00,
  })
  return finalizeStripGeometry(buf)
}

/** Thin double-layer slightly curled paper offcut resting flush on the mat (local min Z = 0). */
function createDoubleLayerOffcutGeometry(): THREE.BufferGeometry {
  const buf = { positions: [] as number[], uvs: [] as number[], colors: [] as number[], faceIdx: [] as number[], wallIdx: [] as number[] }
  const evalLower = (u: number, v: number) => {
    const leftLift = evalFixedBottomZ(.95, THREE.MathUtils.lerp(-.07, .46, v)) * Math.pow(Math.max(0, 1 - u / .48), 1.6)
    const rightCurl = .0038 * Math.pow(THREE.MathUtils.smoothstep(u, .62, 1), 1.4) * (.55 + .45 * Math.abs(v * 2 - 1))
    return leftLift + rightCurl
  }
  appendCurvedPaperStrip(buf, {
    xMin: -.10, xMax: .10, yMin: -.265, yMax: .265, nx: 6, ny: 12, thickness: PAPER_T,
    evalBottomZ: evalLower, uvOffset: [.76, .34], shade: .97,
  })
  appendCurvedPaperStrip(buf, {
    xMin: -.10, xMax: .10, yMin: -.265, yMax: .265, nx: 6, ny: 12, thickness: PAPER_T,
    evalBottomZ: (u, v) => {
      const y = THREE.MathUtils.lerp(-.07, .46, v)
      const leftTarget = HALF_SPAN_Z + (SPINE_RIDGE - evalFixedBottomZ(.95, y))
      const settled = evalLower(u, v) + PAPER_T + .0014 + .0042 * Math.pow(u, 1.5) * THREE.MathUtils.smoothstep(v, .45, 1)
      return THREE.MathUtils.lerp(leftTarget, settled, THREE.MathUtils.smoothstep(u, 0, .58))
    },
    uvOffset: [.72, .34], shade: 1.0,
  })
  return finalizeStripGeometry(buf)
}

/**
 * Rasterizes a height-aware feathered contact/lift shadow texture onto the cutting mat,
 * aligned with the Komorebi directional sun (-6, 12, 6) whose shadows offset by (+0.5*h, +0.5*h) in board space.
 */
function createPaperShadowTexture(
  planar: CutPaperPlanarMesh,
  mirrored: boolean,
  bounds: { xMin: number; xMax: number; yMin: number; yMax: number },
): THREE.DataTexture {
  const w = 192, h = 256
  const cast = new Float32Array(w * h)
  const ao = new Float32Array(w * h)
  const sx = w / (bounds.xMax - bounds.xMin)
  const sy = h / (bounds.yMax - bounds.yMin)

  const rasterTri = (
    dst: Float32Array,
    x0: number, y0: number, v0: number,
    x1: number, y1: number, v1: number,
    x2: number, y2: number, v2: number,
  ) => {
    const px0 = (x0 - bounds.xMin) * sx, py0 = (y0 - bounds.yMin) * sy
    const px1 = (x1 - bounds.xMin) * sx, py1 = (y1 - bounds.yMin) * sy
    const px2 = (x2 - bounds.xMin) * sx, py2 = (y2 - bounds.yMin) * sy
    const minX = Math.max(0, Math.floor(Math.min(px0, px1, px2)))
    const maxX = Math.min(w - 1, Math.ceil(Math.max(px0, px1, px2)))
    const minY = Math.max(0, Math.floor(Math.min(py0, py1, py2)))
    const maxY = Math.min(h - 1, Math.ceil(Math.max(py0, py1, py2)))
    const denom = (py1 - py2) * (px0 - px2) + (px2 - px1) * (py0 - py2)
    if (Math.abs(denom) < 1e-6) return
    const inv = 1 / denom
    for (let py = minY; py <= maxY; py++) {
      const cy = py + .5
      for (let px = minX; px <= maxX; px++) {
        const cx = px + .5
        const l0 = ((py1 - py2) * (cx - px2) + (px2 - px1) * (cy - py2)) * inv
        const l1 = ((py2 - py0) * (cx - px2) + (px0 - px2) * (cy - py2)) * inv
        const l2 = 1 - l0 - l1
        if (l0 >= -1e-4 && l1 >= -1e-4 && l2 >= -1e-4) {
          const val = l0 * v0 + l1 * v1 + l2 * v2
          const idx = py * w + px
          if (val > dst[idx]!) dst[idx] = val
        }
      }
    }
  }

  for (const [a, b, c] of planar.tris) {
    const pa = planar.pts[a]!, pb = planar.pts[b]!, pc = planar.pts[c]!
    const ha = evalFixedBottomZ(pa[0], pa[1]) + PAPER_T * .9
    const hb = evalFixedBottomZ(pb[0], pb[1]) + PAPER_T * .9
    const hc = evalFixedBottomZ(pc[0], pc[1]) + PAPER_T * .9
    const ax = mirrored ? -pa[0] : pa[0], bx = mirrored ? -pb[0] : pb[0], cx = mirrored ? -pc[0] : pc[0]
    // Directional lift shadow offset toward upper-right (+X, +Y_board), matching Komorebi sun (-6, 12, 6).
    const k = 1.65
    rasterTri(cast, ax + ha * k, pa[1] + ha * k, .65 + ha * 18, bx + hb * k, pb[1] + hb * k, .65 + hb * 18, cx + hc * k, pc[1] + hc * k, .65 + hc * 18)
    rasterTri(ao, ax + .004, pa[1] + .004, 1, bx + .004, pb[1] + .004, 1, cx + .004, pc[1] + .004, 1)
  }

  const blur = (src: Float32Array, radius: number) => {
    const tmp = new Float32Array(w * h)
    const dst = new Float32Array(w * h)
    const span = radius * 2 + 1
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        for (let d = -radius; d <= radius; d++) sum += src[y * w + THREE.MathUtils.clamp(x + d, 0, w - 1)]!
        tmp[y * w + x] = sum / span
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let sum = 0
        for (let d = -radius; d <= radius; d++) sum += tmp[THREE.MathUtils.clamp(y + d, 0, h - 1) * w + x]!
        dst[y * w + x] = sum / span
      }
    }
    return dst
  }

  const castSoft = blur(blur(cast, 3), 2)
  const aoSoft = blur(ao, 2)
  const rgba = new Uint8Array(w * h * 4)
  for (let i = 0; i < w * h; i++) {
    const alpha = THREE.MathUtils.clamp(castSoft[i]! * .38 + aoSoft[i]! * .24, 0, .52)
    rgba[i * 4] = 56
    rgba[i * 4 + 1] = 48
    rgba[i * 4 + 2] = 36
    rgba[i * 4 + 3] = Math.round(alpha * 255)
  }
  const tex = new THREE.DataTexture(rgba, w, h)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

function createOffcutShadowTexture(): THREE.DataTexture {
  const w = 64, h = 128
  const rgba = new Uint8Array(w * h * 4)
  for (let y = 0; y < h; y++) {
    const ny = Math.abs((y + .5) / h * 2 - 1)
    for (let x = 0; x < w; x++) {
      const nx = Math.abs((x + .5) / w * 2 - 1)
      const mask = (1 - THREE.MathUtils.smoothstep(nx, .62, .96)) * (1 - THREE.MathUtils.smoothstep(ny, .74, .96))
      const i = (y * w + x) * 4
      rgba[i] = 56; rgba[i + 1] = 48; rgba[i + 2] = 36
      rgba[i + 3] = Math.round(mask * .42 * 255)
    }
  }
  const tex = new THREE.DataTexture(rgba, w, h)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.minFilter = tex.magFilter = THREE.LinearFilter
  tex.generateMipmaps = false
  tex.needsUpdate = true
  return tex
}

/** A small original floral cutout, folded at its own stem; no artisan pattern is reproduced. */
export function createPolishPaperCut(ctx: SceneContext): SceneInstance {
  const { canvas, overlay, shared, gestures } = ctx, safe = shared.assertSafeCopy
  Object.values(COPY).forEach(safe)
  let started = false, disposed = false, focused = true, suspended = false, notifying = false, at: Checkpoint = 0
  let stopResize = () => {}, writer: GestureHandle | null = null
  let lifecycleRevision = 0
  let motion: { step: 0 | 1; time: number; cut: number; fold: number } | null = null
  let dragging = false, maxTravel = 0, maxCross = 0, moved = 0, cutAmount = 0, foldAmount = 0
  const returning = ctx.returning === true, active = () => started && !disposed && focused && (ctx.isActive?.() ?? true)
  const inputActive = () => active() && !notifying, reduced = () => ctx.isReducedMotion?.() ?? false
  const feedback = createSceneFeedback({ ...ctx, isSoundEnabled: () => active() && (ctx.isSoundEnabled?.() ?? true) })
  const ui = createStepOverlay(overlay, { title: COPY.title, stepsAria: '步骤', action: '向上剪开最后一道纸边' }, safe)
  ui.actionBtn.style.minWidth = '44px'; ui.actionBtn.style.minHeight = '44px'
  const wishSlot = document.createElement('div'); wishSlot.className = 'scene-wish-slot'; overlay.append(wishSlot)
  const { scene, renderer } = createWarmStage(canvas)
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap
  const camera = new THREE.PerspectiveCamera(40, 1, .1, 40)
  const style = createDebugRenderStyle(renderer, scene, camera, { id: ctx.sceneId ?? 'polish-paper-cut', label: COPY.title }); style.setStyle(CEL_STYLE)
  const cueLayer = canvas.parentElement?.querySelector<HTMLElement>('.scene-object-cues')
  const lights = addStageLights(scene, ctx.stage, { sky: 0xf0f0e6, ground: 0xb2ad95, key: 0xfff2dc, rim: 0xd7e7df, keyPosition: [-3, 5, 4], keyIntensity: 1.7, rimIntensity: .5 })
  lights.key.castShadow = true; lights.key.shadow.mapSize.set(1024, 1024); lights.key.shadow.bias = -.0003; lights.key.shadow.normalBias = .006
  Object.assign(lights.key.shadow.camera, { left: -3, right: 3, top: 4, bottom: -2, near: .1, far: 12 })
  const world = new THREE.Group(); world.name = 'paper-workbench'; scene.add(world)
  const ownedTextures: THREE.Texture[] = []
  const trackTexture = <T extends THREE.Texture>(tex: T): T => { ownedTextures.push(tex); return tex }
  const mat = (color: number, roughness = .88, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const wood = mat(0xbb9973)
  const boardTex = trackTexture(createCuttingMatTexture())
  const boardMat = new THREE.MeshStandardMaterial({ color: 0xffffff, map: boardTex, roughness: .96, metalness: 0 })
  const paperTex = trackTexture(createDyedPaperTexture())
  const paperMat = createRitualMaterial(
    { color: 0x356e6a, map: paperTex, roughness: .92, metalness: 0, vertexColors: true },
    { kind: 'paper', strength: .20, paper: { layout: 'sheet', grainScale: 6.4, aspect: 1.0, grain: .62, fibers: .04, edge: 0, highlightGuard: .28 } },
  )
  const paperEdge = createRitualMaterial(
    { color: 0x76a29b, roughness: .95, metalness: 0, vertexColors: true },
    { kind: 'paper', strength: .16, paper: { layout: 'sheet', grainScale: 6.8, aspect: 1.0, grain: .52, fibers: .04, edge: 0, highlightGuard: .32 } },
  )
  const paperCreaseMat = createRitualMaterial(
    { color: 0x4b7f79, map: paperTex, roughness: .95, metalness: 0 },
    { kind: 'paper', strength: .18, paper: { layout: 'sheet', grainScale: 6.4, aspect: 1.0, grain: .55, fibers: .04, edge: 0, highlightGuard: .30 } },
  )
  const silver = mat(0xaab6b4, .36, .62), handles = mat(0x53686b, .5, .32)
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], p: XYZ, parent: THREE.Object3D = world) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, p: XYZ, material: THREE.Material, parent: THREE.Object3D = world) => add(name, new RoundedBoxGeometry(...size, 3, Math.min(.028, ...size.map(n => n / 3))), material, p, parent)
  box('paper-wood-table', [9, .18, 7], [0, .625, 0], wood)
  const board = new THREE.Group(); board.name = 'paper-cutting-mat-group'; board.position.set(0, .715, 0); board.rotation.x = -Math.PI / 2; world.add(board)
  box('paper-cream-board', [3.44, 2.50, .040], [0, 0, .020], boardMat, board)
  // A faint printed grid makes the thin, flat support read as a cutting mat.
  const gridMat = new THREE.MeshStandardMaterial({ color: 0x998e75, roughness: 1, transparent: true, opacity: .34 })
  for (let x = -1.5; x <= 1.51; x += .25) add('paper-mat-grid', new THREE.PlaneGeometry(.004, 2.25), gridMat, [x, 0, .0403], board).castShadow = false
  for (let y = -1; y <= 1.01; y += .25) add('paper-mat-grid', new THREE.PlaneGeometry(3.20, .004), gridMat, [0, y, .0403], board).castShadow = false

  // The asymmetric half is cut from a single shape. Mirroring around the stem
  // produces bilateral leaves; each aperture is a real hole through both faces.
  const outline = new THREE.Shape()
  outline.moveTo(0, -.96); outline.lineTo(.15, -.96); outline.quadraticCurveTo(.17, -.80, .12, -.71)
  outline.bezierCurveTo(.39, -.80, .59, -.83, .69, -.62); outline.quadraticCurveTo(.60, -.39, .31, -.43)
  outline.lineTo(.16, -.25); outline.quadraticCurveTo(.37, -.19, .47, -.34)
  outline.bezierCurveTo(.69, -.43, .91, -.33, .95, -.08); outline.lineTo(.95, .45)
  outline.quadraticCurveTo(.74, .58, .49, .32); outline.lineTo(.23, .19); outline.lineTo(.16, .39)
  outline.bezierCurveTo(.38, .42, .64, .46, .71, .64); outline.quadraticCurveTo(.69, .84, .51, .85)
  outline.quadraticCurveTo(.34, .86, .23, .69); outline.quadraticCurveTo(.19, .99, 0, 1.06); outline.closePath()
  for (const [x, y, rx, ry] of [[.57, .06, .17, .105], [.40, -.59, .13, .065], [.35, .67, .105, .044]]) {
    const hole = new THREE.Path(); hole.absellipse(x, y, rx, ry, 0, Math.PI * 2, true, -.20); outline.holes.push(hole)
  }
  const planar = buildCutPaperPlanarMesh(outline)
  const fixedGeometry = createCutPaperHalfGeometry(planar, false)
  const foldedGeometry = createCutPaperHalfGeometry(planar, true)
  const fixed = add('paper-fixed-half', fixedGeometry, [paperMat, paperEdge], [0, 0, MAT_TOP], board)
  const hinge = new THREE.Group(); hinge.name = 'paper-fold-hinge'; hinge.position.z = HINGE_Z; board.add(hinge)
  const folded = add('paper-folded-half', foldedGeometry, [paperMat, paperEdge], [0, 0, 0], hinge)
  // Soft directional contact & lift shadows under the thin cut paper and fallen offcut.
  const rightShadowBounds = { xMin: -.06, xMax: 1.08, yMin: -1.04, yMax: 1.16 }
  const leftShadowBounds = { xMin: -1.04, xMax: .10, yMin: -1.04, yMax: 1.16 }
  const rightShadowTex = trackTexture(createPaperShadowTexture(planar, false, rightShadowBounds))
  const leftShadowTex = trackTexture(createPaperShadowTexture(planar, true, leftShadowBounds))
  const offcutShadowTex = trackTexture(createOffcutShadowTexture())
  const makeShadowPlane = (name: string, tex: THREE.DataTexture, w: number, h: number, p: XYZ, opacity = 1) => {
    const m = new THREE.MeshBasicMaterial({ map: tex, transparent: true, opacity, depthWrite: false })
    const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), m)
    mesh.name = name; mesh.position.set(...p); mesh.castShadow = false; mesh.receiveShadow = false
    board.add(mesh); return { mesh, material: m }
  }
  const rightShadow = makeShadowPlane(
    'paper-fixed-shadow', rightShadowTex,
    rightShadowBounds.xMax - rightShadowBounds.xMin, rightShadowBounds.yMax - rightShadowBounds.yMin,
    [(rightShadowBounds.xMin + rightShadowBounds.xMax) * .5, (rightShadowBounds.yMin + rightShadowBounds.yMax) * .5, MAT_TOP + .00045], 1,
  )
  const leftShadow = makeShadowPlane(
    'paper-folded-shadow', leftShadowTex,
    leftShadowBounds.xMax - leftShadowBounds.xMin, leftShadowBounds.yMax - leftShadowBounds.yMin,
    [(leftShadowBounds.xMin + leftShadowBounds.xMax) * .5, (leftShadowBounds.yMin + leftShadowBounds.yMax) * .5, MAT_TOP + .00050], 0,
  )
  const offcutShadow = makeShadowPlane('paper-offcut-shadow', offcutShadowTex, .26, .60, [SCRAP_HOME.x + .012, SCRAP_HOME.y + .012, MAT_TOP + .00042], 1)

  // A narrow double-layer attached margin is the final uncut edge, not a separate hit plane.
  const seamBaseZ = MAT_TOP + evalFixedBottomZ(.95, .185)
  const seam = add('paper-final-cut-edge', createDoubleLayerSeamGeometry(), [paperMat, paperEdge], [.955, .185, seamBaseZ], board)
  const scrap = add('paper-offcut', createDoubleLayerOffcutGeometry(), [paperMat, paperEdge], [0, 0, 0], board)
  const crease = add('paper-stem-crease', new THREE.BoxGeometry(.0038, 1.98, .0007), paperCreaseMat, [0, .05, HINGE_Z + .00025], board)
  crease.castShadow = false
  for (const mesh of [fixed, folded, seam, scrap, crease]) mesh.userData.toonSurface = { outline: false }
  void rightShadow

  const scissors = new THREE.Group(); scissors.name = 'paper-scissors'; board.add(scissors)
  const leftBlade = new THREE.Group(), rightBlade = new THREE.Group(); scissors.add(leftBlade, rightBlade)
  const bladeShape = new THREE.Shape(); bladeShape.moveTo(-.035, -.12); bladeShape.lineTo(.028, -.07); bladeShape.lineTo(.019, .46); bladeShape.quadraticCurveTo(-.026, .39, -.041, .03); bladeShape.closePath()
  const bladeGeometry = new THREE.ExtrudeGeometry(bladeShape, { depth: .024, bevelEnabled: true, bevelSize: .003, bevelThickness: .002, bevelSegments: 1, curveSegments: 8 })
  for (const [side, parent] of [[-1, leftBlade], [1, rightBlade]] as const) {
    const blade = add(side === -1 ? 'paper-scissors-blade-left' : 'paper-scissors-blade-right', bladeGeometry, silver, [0, 0, side === -1 ? 0 : .028], parent)
    blade.scale.x = side
    const handle = add(side === -1 ? 'paper-scissors-handle-left' : 'paper-scissors-handle-right', new THREE.TorusGeometry(.107, .025, 10, 36), handles, [side * .088, -.335, .02], parent)
    handle.scale.y = 1.35
    box(side === 1 ? 'paper-scissors-grip' : 'paper-scissors-handle-neck', [.08, .18, .048], [side * .055, -.16, .028], handles, parent)
  }
  const rivet = add('paper-scissors-rivet', new THREE.CylinderGeometry(.044, .044, .027, 24), silver, [0, 0, .067], scissors); rivet.rotation.x = Math.PI / 2
  const grip = scissors.getObjectByName('paper-scissors-grip')!
  for (const o of [leftBlade, rightBlade]) o.traverse(m => { if ((m as THREE.Mesh).isMesh) m.userData.toonSurface = { outline: false, roughness: .36, metalness: .5 } })
  const matrices = () => { scene.updateMatrixWorld(true); camera.updateMatrixWorld(true) }
  const setCut = (amount: number) => {
    cutAmount = amount; scissors.position.copy(TOOL_HOME); scissors.position.y += amount * .51
    scissors.rotation.set(0, 0, 0)
    const aperture = .16 + Math.sin(amount * Math.PI * 8) * .10
    leftBlade.rotation.z = -aperture; rightBlade.rotation.z = aperture
    // The tool visibly separates only the traversed part of the final strip.
    seam.scale.y = Math.max(.015, 1 - amount); seam.position.y = .185 + .265 * amount
  }
  const syncOffcutShadow = () => {
    offcutShadow.mesh.position.set(scrap.position.x + .020, scrap.position.y + .020, MAT_TOP + .00042)
    offcutShadow.mesh.rotation.z = scrap.rotation.z
  }
  const setFold = (amount: number) => {
    foldAmount = amount; hinge.rotation.y = -Math.PI * amount
    leftShadow.material.opacity = THREE.MathUtils.smoothstep(amount, .42, 1)
    crease.visible = amount > .95
  }
  const restore = () => {
    setCut(at > 0 ? 1 : 0); setFold(at >= 2 ? 1 : 0); seam.visible = at === 0
    scrap.position.copy(at > 0 ? SCRAP_REST : SCRAP_HOME); scrap.rotation.z = at > 0 ? -.55 : 0
    syncOffcutShadow()
    if (at > 0) { scissors.position.copy(TOOL_REST); scissors.rotation.z = -.19; leftBlade.rotation.z = -.065; rightBlade.rotation.z = .065 }
    matrices()
  }
  const enabled = (step: number) => () => inputActive() && !motion && at === step
  const removeCues = [
    addInteractionCue(grip, { kind: 'drag', direction: [0, -1], label: '拿剪刀，向上剪开', anchor: [0, 0, .024], priority: 3, enabled: enabled(0) }),
    addInteractionCue(folded, { kind: 'drag', direction: [-1, 0], label: '拉住纸边，向左展开', anchor: [.84, .20, .016], priority: 3, enabled: enabled(1) }),
    addInteractionCue(fixed, { kind: 'tap', label: '轻点剪纸静看', anchor: [.32, .59, .016], priority: 3, enabled: enabled(2) }),
  ]
  const ray = createPointerRay(canvas, camera), down = new THREE.Vector2()
  const belongsTo = (object: THREE.Object3D | undefined, target: THREE.Object3D) => { for (let p = object; p; p = p.parent ?? undefined) if (p === target) return true; return false }
  const nearestHit = (x: number, y: number) => {
    const meshes: THREE.Object3D[] = []
    scene.traverseVisible(object => {
      const mesh = object as THREE.Mesh; if (!mesh.isMesh) return
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material]
      if (materials.some(m => m.visible && (!m.transparent || m.opacity >= 1))) meshes.push(object)
    })
    return ray.aim(x, y).intersectObjects(meshes, false)[0]
  }
  const touch = createTouchTarget(canvas, camera, scene)
  const visibleHit = (x: number, y: number, target: THREE.Object3D) => touch.hit(x, y, target)
  const reset = () => { dragging = false; maxTravel = maxCross = moved = 0; if (!motion && !disposed) restore() }
  // Guard before the pointer controller: its inactive move path would otherwise
  // cancel the original owner during synchronous prepareFeedback reentry.
  const guardedEvents = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'lostpointercapture']
  const guardCallbackInput = (event: Event) => { if (notifying) event.stopImmediatePropagation() }
  guardedEvents.forEach(type => { window.addEventListener(type, guardCallbackInput, true); ui.hitLayer.addEventListener(type, guardCallbackInput, true) })
  const pointer = createObjectPointer(ui.hitLayer, {
    isActive: inputActive,
    canStart(x, y) {
      if (motion || at === 3) return false; matrices()
      if (at !== 1) return at === 0 ? visibleHit(x, y, scissors) : visibleHit(x, y, fixed) || visibleHit(x, y, folded)
      return visibleHit(x, y, folded)
    },
    onStart(x, y) {
      if (!prepareInput()) { pointer.cancel(); return }
      down.set(x, y); dragging = at < 2; maxTravel = maxCross = moved = 0
    },
    onMove(x, y) {
      const dx = x - down.x, dy = y - down.y
      maxTravel = Math.max(maxTravel, Math.hypot(dx, dy)); maxCross = Math.max(maxCross, Math.abs(at === 0 ? dx : dy))
      moved = at === 0 ? -dy : -dx
      if (dragging && at === 0) setCut(THREE.MathUtils.clamp(moved / 64, 0, 1))
      else if (dragging && at === 1) setFold(THREE.MathUtils.clamp(moved / 72, 0, 1))
      matrices()
    },
    onRelease(x, y) {
      matrices(); const dx = x - down.x, dy = y - down.y
      const valid = at === 0 ? dragging && moved >= 42 && -dy >= 42 && (moved >= 64 && -dy >= 64 || maxCross <= Math.max(20, -dy * .55)) && Math.abs(dx) <= Math.max(20, -dy * .55)
        : at === 1 ? dragging && moved >= 48 && -dx >= 48 && (moved >= 72 && -dx >= 72 || maxCross <= Math.max(20, -dx * .45)) && Math.abs(dy) <= Math.max(20, -dx * .45)
          : maxTravel < 12 && Math.hypot(dx, dy) < 12 && (visibleHit(x, y, fixed) || visibleHit(x, y, folded))
      dragging = false; if (valid) { if (at < 2) begin(); else finish() } else reset()
    }, onCancel: reset,
  })
  const ending = createQuietEnding(ctx, { ui, isActive: inputActive, duration: 3, motion: 'glow', targets: () => [fixed, folded], cancelInput: () => pointer.cancel(), complete: () => finish() })
  const sync = () => {
    if (cueLayer) cueLayer.hidden = !active()
    ui.renderDots(at, 3); ui.actionBtn.hidden = at === 3; ui.actionBtn.disabled = !inputActive() || !!motion || at === 3
    ui.actionBtn.setAttribute('aria-disabled', String(ui.actionBtn.disabled)); ui.hitLayer.style.pointerEvents = inputActive() && !motion && at < 3 ? 'auto' : 'none'
    wishSlot.hidden = returning || at !== 2; writer?.setEnabled(inputActive() && !returning && at === 2 && !motion)
    setSafeText(ui.actionBtn, at === 0 ? '向上剪开最后一道纸边' : at === 1 ? '向左展开折纸' : '轻点剪纸静看', safe)
    setSafeText(ui.hintEl, motion ? motion.step === 0 ? COPY.cutting : COPY.opening : at === 0 ? COPY.cut : at === 1 ? COPY.unfold : at === 2 ? returning ? COPY.returning : COPY.quiet : COPY.done, safe)
    ending.sync(at === 2 && !motion)
  }
  function withHostCallbacks(work: () => void) { notifying = true; sync(); try { work() } finally { notifying = false; if (!disposed) sync() } }
  function prepareInput() {
    const revision = lifecycleRevision
    withHostCallbacks(() => feedback.prepare())
    return inputActive() && revision === lifecycleRevision
  }
  function settle() {
    if (!inputActive() || !motion) return
    at = (motion.step + 1) as Checkpoint; motion = null; restore()
    withHostCallbacks(() => { ctx.onProgress?.(at); if (active()) feedback.impact({ freqs: [392, 523.25], duration: .13, gain: .008, type: 'triangle' }) })
  }
  function begin() {
    if (!inputActive() || pointer.isBusy() || motion || at >= 2) return
    motion = { step: at as 0 | 1, time: 0, cut: cutAmount, fold: foldAmount }; sync(); if (reduced()) settle()
  }
  function finish(text = '') {
    if (!inputActive() || pointer.isBusy() || motion || at !== 2) return
    if (!text.trim() && !ending.completing) return
    withHostCallbacks(() => {
      at = 3; restore(); writer?.dispose(); writer = null; wishSlot.replaceChildren(); sync()
      if (text.trim() && !returning) ctx.saveWish?.(text.trim())
      if (disposed) return
      ctx.onProgress?.(3); if (!active()) return
      feedback.impact({ freqs: [392, 587.33], duration: .20, gain: .009 }); if (!active()) return
      overlay.dispatchEvent(new CustomEvent('scene:complete', { bubbles: true }))
    })
  }
  const action = () => { if (!inputActive() || pointer.isBusy() || motion || at === 3 || !prepareInput()) return; if (at < 2) begin(); else finish() }
  const blur = () => { focused = false; lifecycleRevision++; pointer.cancel(); sync() }, focus = () => { focused = true; if (!disposed) sync() }
  const resize = () => {
    const aspect = sizeStage(canvas, renderer, style, camera), distance = Math.max(4.45, 5.4 / aspect)
    camera.position.set(0, .78 + distance * .93, distance * .37); camera.lookAt(0, .78, 0); matrices()
  }
  restore(); sync()
  return {
    start() {
      if (started || disposed) return
      started = true; const initial = ctx.initialProgress ?? 0; at = (Number.isFinite(initial) ? THREE.MathUtils.clamp(Math.floor(initial), 0, 3) : 0) as Checkpoint
      restore(); resize(); stopResize = observeCanvasResize(canvas, () => { if (!disposed) resize() })
      if (!returning && at < 3) { writer = gestures.createWishWrite({ maxLen: 40, saves: ctx.saveWish !== undefined, onSubmit: text => { if (!inputActive() || pointer.isBusy() || motion || at !== 2 || !text.trim() || !prepareInput()) return; finish(text) } }); writer.mount(wishSlot, {}) }
      ui.actionBtn.addEventListener('click', action); window.addEventListener('blur', blur); window.addEventListener('focus', focus); sync()
    },
    update(dt) {
      if (!started || disposed) return
      if (!active()) { lifecycleRevision++; pointer.cancel(); writer?.setEnabled(false); if (!suspended) { suspended = true; sync() }; return }
      if (notifying) return
      if (suspended) { suspended = false; sync() }
      const delta = Number.isFinite(dt) ? THREE.MathUtils.clamp(dt, 0, .05) : 0
      writer?.setEnabled(at === 2 && !returning && !motion); writer?.update(delta)
      if (motion) {
        motion.time = reduced() ? 1 : Math.min(1, motion.time + delta / .72); const t = ease(motion.time)
        if (motion.step === 0) {
          setCut(THREE.MathUtils.lerp(motion.cut, 1, Math.min(t * 2.6, 1)))
          const release = ease(THREE.MathUtils.clamp((t - .36) / .64, 0, 1))
          seam.visible = release === 0; scrap.position.lerpVectors(SCRAP_HOME, SCRAP_REST, release); scrap.rotation.z = -.55 * release; syncOffcutShadow()
          scissors.position.lerp(TOOL_REST, release); scissors.rotation.z = -.19 * release
        } else setFold(THREE.MathUtils.lerp(motion.fold, 1, t))
        if (motion.time === 1) settle()
      }
      ending.update(dt)
      if (!disposed && active()) { matrices(); style.render() }
    },
    dispose() {
      if (disposed) return
      ending.dispose(); disposed = true; pointer.dispose(); stopResize(); writer?.dispose(); writer = null; feedback.dispose(); removeCues.forEach(remove => remove()); ui.actionBtn.removeEventListener('click', action)
      guardedEvents.forEach(type => { window.removeEventListener(type, guardCallbackInput, true); ui.hitLayer.removeEventListener(type, guardCallbackInput, true) })
      window.removeEventListener('blur', blur); window.removeEventListener('focus', focus); style.dispose(); disposeTree(world); ownedTextures.forEach(tex => tex.dispose()); ownedTextures.length = 0; Object.values(lights).forEach(light => light.dispose()); scene.clear(); renderer.dispose(); renderer.forceContextLoss(); overlay.replaceChildren(); overlay.classList.remove('scene-overlay', 'scene-overlay--stage')
    },
  }
}
