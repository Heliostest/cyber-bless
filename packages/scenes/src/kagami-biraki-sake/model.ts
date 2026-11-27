import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { addObjectCradle, addOfferingTable } from '../cozy-furniture'

let cachedKomoPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null
let cachedRopePixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null
let cachedRibbonPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null

/**
 * Crisp 128x128 woven straw komo (菰) mat texture + bump map.
 * Dense vertical reed stalks bound by paired horizontal twined weft stitching rows.
 * All RGB bytes stay strictly > 180 (preserving warm straw brightness and model contract).
 */
function createKomoWeaveTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedKomoPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const reedCount = 16
    const stitchRows = [0.22, 0.56, 0.86]
    for (let y = 0; y < size; y++) {
      const v = y / size
      // Compute proximity to horizontal paired twined weft-stitching bands (amime).
      let weftStrength = 0
      let weftRidge = 0
      for (const row of stitchRows) {
        const dRaw = Math.abs(v - row)
        const d = Math.min(dRaw, 1 - dRaw)
        if (d < 0.042) {
          const k = Math.cos((d / 0.042) * (Math.PI / 2))
          weftStrength = Math.max(weftStrength, k * k)
          weftRidge = Math.max(weftRidge, Math.cos((d / 0.042) * Math.PI * 2))
        }
      }
      for (let x = 0; x < size; x++) {
        const u = x / size
        const reedPos = u * reedCount
        const reedIdx = Math.floor(reedPos)
        const reedFrac = reedPos - reedIdx
        // Rounded reed stalk cross-section with crisp dark crease between adjacent reeds.
        const stalkProfile = Math.sin(reedFrac * Math.PI)
        const reedCrease = Math.pow(stalkProfile, 0.44)
        // Deterministic subtle per-reed tonal variation (sun-dried straw warmth).
        const hash = Math.sin(reedIdx * 12.9898 + 4.1414) * 43758.5453
        const reedTone = (hash - Math.floor(hash) - 0.5) * 14
        const fineVerticalGrain = Math.sin(u * 96 * tau + v * 3 * tau) * 3.0
        // Paired twined weft cord crossing over/under alternating reeds.
        const hop = Math.sin((reedPos + (reedIdx % 2) * 0.5) * Math.PI)
        const weftVal = weftStrength * (-22 + hop * 18)
        const baseLum = 220 + (reedCrease - 0.55) * 32 + reedTone + fineVerticalGrain + weftVal
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(baseLum + 4), 192, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(baseLum + 1), 189, 254)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(baseLum - 4), 186, 248)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(126 + (reedCrease - 0.5) * 82 + weftStrength * (weftRidge * 38 + hop * 32)),
          24,
          236,
        )
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedKomoPixels = { color, bump, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedKomoPixels.color), size, size)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.repeat.set(8, 2)
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedKomoPixels.bump), size, size)
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.repeat.set(8, 2)
  bump.colorSpace = THREE.NoColorSpace
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Crisp 128x128 3-ply twisted straw rope texture + bump map aligned to rope UVs. */
function createStrawRopeTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedRopePixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const ply = Math.sin((u * 6 - v * 3) * tau)
        const sub = Math.sin((u * 18 - v * 6) * tau) * 0.28
        const stalk = Math.sin((u * 30 + v * 4) * tau) * 0.14
        const f = ply * 0.68 + sub + stalk
        const shade = f * 22
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(236 + shade * 0.92), 184, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(230 + shade * 0.96), 178, 254)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(218 + shade), 166, 246)
        color[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + f * 66), 24, 236)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedRopePixels = { color, bump, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedRopePixels.color), size, size)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedRopePixels.bump), size, size)
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.colorSpace = THREE.NoColorSpace
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Crisp 128x128 plain-weave ceremonial cloth ribbon texture + bump map with subtle woven selvedge border. */
function createRibbonClothTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedRibbonPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      // Subtle stitched selvedge bands near ribbon edges.
      const edgeDist = Math.min(v, 1 - v)
      const selvedge = edgeDist > 0.05 && edgeDist < 0.095 ? 1 : 0
      for (let x = 0; x < size; x++) {
        const u = x / size
        const warp = Math.sin(u * 32 * tau)
        const weft = Math.sin(v * 32 * tau)
        const weave = (warp * weft) * 0.45 + (warp + weft) * 0.22
        const stitch = selvedge * Math.sin(u * 16 * tau) * 0.55
        const shade = weave * 11 - selvedge * 5 + stitch * 7
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(244 + shade), 212, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(243 + shade), 210, 255)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(240 + shade), 206, 255)
        color[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + weave * 38 + stitch * 32), 36, 224)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedRibbonPixels = { color, bump, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedRibbonPixels.color), size, size)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedRibbonPixels.bump), size, size)
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.colorSpace = THREE.NoColorSpace
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Merges multiple indexed/non-indexed geometries cleanly into one BufferGeometry, preserving smooth normals. */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0
  const expanded = parts.map((g) => {
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    return g.index ? g.toNonIndexed() : g
  })
  for (const g of expanded) totalVerts += g.getAttribute('position').count
  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  let offset = 0
  for (let pIdx = 0; pIdx < expanded.length; pIdx++) {
    const g = expanded[pIdx]!
    const pos = g.getAttribute('position')
    const norm = g.getAttribute('normal')
    const uv = g.getAttribute('uv')
    for (let i = 0; i < pos.count; i++) {
      positions[(offset + i) * 3] = pos.getX(i)
      positions[(offset + i) * 3 + 1] = pos.getY(i)
      positions[(offset + i) * 3 + 2] = pos.getZ(i)
      if (norm) {
        normals[(offset + i) * 3] = norm.getX(i)
        normals[(offset + i) * 3 + 1] = norm.getY(i)
        normals[(offset + i) * 3 + 2] = norm.getZ(i)
      }
      if (uv) {
        uvs[(offset + i) * 2] = uv.getX(i)
        uvs[(offset + i) * 2 + 1] = uv.getY(i)
      }
    }
    offset += pos.count
    if (g !== parts[pIdx]) g.dispose()
    parts[pIdx]!.dispose()
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  return merged
}

/** Builds a taut single horizontal 3-ply twisted straw rope ring in the XZ plane (outward normals verified). */
function buildTwistedHorizontalCoil(
  majorRadius: number,
  yOffset: number,
  tubeRadius: number,
  plyDepth: number,
  turns: number,
  tubularSegments: number,
  radialSegments: number,
  phaseOffset = 0,
): THREE.BufferGeometry {
  const stride = radialSegments + 1
  const positions = new Float32Array((tubularSegments + 1) * stride * 3)
  const uvs = new Float32Array((tubularSegments + 1) * stride * 2)
  const indices: number[] = []
  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const phi = u * Math.PI * 2
    const cphi = Math.cos(phi), sphi = Math.sin(phi)
    // Right-handed frame in XZ: T=(-sphi,0,cphi), N=(cphi,0,sphi), B=T x N=(0,+1,0).
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const theta = v * Math.PI * 2
      const ply = 1 + plyDepth * Math.cos(theta * 3 - phi * turns + phaseOffset)
      const r = tubeRadius * ply
      const ct = Math.cos(theta), st = Math.sin(theta)
      const rr = majorRadius + r * ct
      const k = i * stride + j
      positions[k * 3] = rr * cphi
      positions[k * 3 + 1] = yOffset + r * st
      positions[k * 3 + 2] = rr * sphi
      uvs[k * 2] = u * turns * 0.45
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

/** Builds a taut twin-coil 3-ply twisted straw rope hoop with a flush structural crossover lashing tie. */
function buildTwistedHoopBand(
  barrelRadiusAtY: (y: number) => number,
  yCenter: number,
  lashingAngle: number,
): THREE.BufferGeometry {
  const coilSep = 0.0148
  const tubeR = 0.0145
  const rLow = barrelRadiusAtY(yCenter - coilSep) + 0.035 - 0.0038 + tubeR * 0.92
  const rHigh = barrelRadiusAtY(yCenter + coilSep) + 0.035 - 0.0038 + tubeR * 0.92
  const coilA = buildTwistedHorizontalCoil(rLow, -coilSep, tubeR, 0.14, 34, 128, 10, 0)
  const coilB = buildTwistedHorizontalCoil(rHigh, coilSep, tubeR, 0.14, 34, 128, 10, Math.PI / 3)

  // Compact flush binding wrap tying the twin horizontal coils together at lashingAngle.
  const parts: THREE.BufferGeometry[] = [coilA, coilB]
  const rMid = (rLow + rHigh) * 0.5
  for (const [idx, dPhi] of [-0.036, 0.036].entries()) {
    const phi = lashingAngle + dPhi
    const cx = Math.cos(phi), cz = Math.sin(phi)
    const tx = -cz, tz = cx
    const pts: THREE.Vector3[] = []
    const steps = 20
    for (let s = 0; s <= steps; s++) {
      const a = (s / steps) * Math.PI * 2
      const localRad = 0.0175 * Math.cos(a)
      const localY = 0.0315 * Math.sin(a)
      const tilt = (idx === 0 ? 1 : -1) * 0.008 * Math.sin(a)
      const rad = rMid + localRad
      pts.push(new THREE.Vector3(rad * cx + tx * tilt, localY, rad * cz + tz * tilt))
    }
    const curve = new THREE.CatmullRomCurve3(pts, true)
    parts.push(new THREE.TubeGeometry(curve, 20, 0.0072, 6, true))
  }
  return mergeGeometries(parts)
}

/** Builds a snug flat-woven cloth wrap band hugging the mallet handle (radius 0.035) with zero air gap. */
function buildHandleClothBandGeometry(innerR: number, outerR: number, halfWidth: number, segs = 36): THREE.BufferGeometry {
  // Closed CCW cross-section loop in (z, r): outer (+z) -> front edge (in) -> inner (-z) -> back edge (out).
  const profile: [number, number][] = [
    [-halfWidth, outerR - 0.0014],
    [-halfWidth * 0.55, outerR],
    [0, outerR + 0.0008],
    [halfWidth * 0.55, outerR],
    [halfWidth, outerR - 0.0014],
    [halfWidth, innerR],
    [-halfWidth, innerR],
    [-halfWidth, outerR - 0.0014],
  ]
  const pCount = profile.length
  const stride = segs + 1
  const positions = new Float32Array(pCount * stride * 3)
  const uvs = new Float32Array(pCount * stride * 2)
  const indices: number[] = []
  for (let s = 0; s < pCount; s++) {
    const [z, r] = profile[s]!
    const vCoord = s <= 4 ? s / 4 : 0.5
    for (let i = 0; i <= segs; i++) {
      const u = i / segs
      const theta = u * Math.PI * 2
      const k = s * stride + i
      positions[k * 3] = Math.cos(theta) * r
      positions[k * 3 + 1] = Math.sin(theta) * r
      positions[k * 3 + 2] = z
      uvs[k * 2] = u * 3.0
      uvs[k * 2 + 1] = vCoord
      if (s < pCount - 1 && i < segs) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // Outward winding: (+theta) x (+s) points radially outward on outer face & +Z on front edge.
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

/** Builds a structured, crisply folded flat-cloth overhand knot seated flush atop the handle wrap. */
function buildFoldedClothKnotGeometry(hx: number, hy: number, hz: number): THREE.BufferGeometry {
  const lat = 14, lon = 28, stride = lon + 1
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
      // Superellipse squaring gives a crisp folded rectangular cloth pillow rather than a sphere.
      const sx = Math.sign(ct) * Math.pow(Math.abs(ct), 0.72)
      const sz = Math.sign(st) * Math.pow(Math.abs(st), 0.72)
      const sy = Math.sign(cp) * Math.pow(Math.abs(cp), 0.78)
      // Subtle diagonal fold crease across the top of the tied cloth knot.
      const diag = sx * 0.68 + sz * 0.73
      const foldCrease = cp > 0 ? 1 - 0.14 * Math.exp(-diag * diag * 10) * sp : 1
      const k = i * stride + j
      positions[k * 3] = sx * hx * sp
      positions[k * 3 + 1] = sy * hy * foldCrease
      positions[k * 3 + 2] = sz * hz * sp
      uvs[k * 2] = u * 2.2
      uvs[k * 2 + 1] = v * 1.4
      if (i < lat && j < lon) {
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

/** Builds a gracefully shaped, cambered woven cloth ribbon tail with clean angled hemmed tip. */
function buildRibbonTailGeometry(side: -1 | 1, length = 0.185): THREE.BufferGeometry {
  const segsU = 20
  const ringPts = 10
  const stride = ringPts + 1
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(side * 0.022, 0.0025, length * 0.28),
    new THREE.Vector3(side * 0.044, -0.0055, length * 0.64),
    new THREE.Vector3(side * 0.062, -0.0175, length),
  ])
  const points = curve.getSpacedPoints(segsU)
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i <= segsU; i++) {
    const prev = points[Math.max(0, i - 1)]!
    const next = points[Math.min(segsU, i + 1)]!
    tangents.push(new THREE.Vector3().subVectors(next, prev).normalize())
  }
  const bodyVerts = (segsU + 1) * stride
  const positions = new Float32Array((bodyVerts + 2) * 3)
  const uvs = new Float32Array((bodyVerts + 2) * 2)
  const indices: number[] = []
  const upRef = new THREE.Vector3(0, 1, 0)
  const widthAxis = new THREE.Vector3()
  const thickAxis = new THREE.Vector3()

  for (let i = 0; i <= segsU; i++) {
    const u = i / segsU
    const p = points[i]!
    const T = tangents[i]!
    // Right-handed frame: W = upRef x T (points sideways), H = T x W (points upward).
    widthAxis.crossVectors(upRef, T).normalize()
    thickAxis.crossVectors(T, widthAxis).normalize()
    // Gentle natural tilt along the cloth strip so its broad woven face reads cleanly in official and closeup frames.
    const twist = side * (0.08 * Math.sin(u * Math.PI * 0.9) - 0.08 * u)
    const ct = Math.cos(twist), st = Math.sin(twist)
    const W = widthAxis.clone().multiplyScalar(ct).addScaledVector(thickAxis, st)
    const H = thickAxis.clone().multiplyScalar(ct).addScaledVector(widthAxis, -st)
    // Pinched neatly at knot exit, widening cleanly to ceremonial ribbon width.
    const halfW = THREE.MathUtils.lerp(0.011, 0.0176, Math.pow(u, 0.45))
    const halfH = 0.0024
    const camber = 0.0024 * (0.35 + 0.65 * Math.sin(u * Math.PI))
    // Subtle Japanese diagonal-cut ribbon tip bevel over final 16% of length.
    const tipSkew = u > 0.84 ? ((u - 0.84) / 0.16) * 0.014 : 0

    for (let j = 0; j <= ringPts; j++) {
      const v = j / ringPts
      const angle = v * Math.PI * 2
      const cw = Math.cos(angle), sh = Math.sin(angle)
      const wCoord = Math.sign(cw) * Math.pow(Math.abs(cw), 0.55) * halfW
      const arch = camber * (1 - (wCoord / Math.max(halfW, 1e-4)) ** 2)
      const hCoord = sh * halfH + arch
      const zSkew = (wCoord / Math.max(halfW, 1e-4)) * side * tipSkew
      const k = i * stride + j
      positions[k * 3] = p.x + W.x * wCoord + H.x * hCoord + T.x * zSkew
      positions[k * 3 + 1] = p.y + W.y * wCoord + H.y * hCoord + T.y * zSkew
      positions[k * 3 + 2] = p.z + W.z * wCoord + H.z * hCoord + T.z * zSkew
      uvs[k * 2] = u * 2.6
      uvs[k * 2 + 1] = 0.5 + 0.5 * cw
      if (i < segsU && j < ringPts) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // H = T x W -> (+angle) x (+u) points strictly outward.
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const startCap = bodyVerts
  const endCap = bodyVerts + 1
  const p0 = points[0]!, p1 = points[segsU]!
  positions[startCap * 3] = p0.x; positions[startCap * 3 + 1] = p0.y; positions[startCap * 3 + 2] = p0.z
  uvs[startCap * 2] = 0; uvs[startCap * 2 + 1] = 0.5
  positions[endCap * 3] = p1.x; positions[endCap * 3 + 1] = p1.y; positions[endCap * 3 + 2] = p1.z
  uvs[endCap * 2] = 2.6; uvs[endCap * 2 + 1] = 0.5
  const lastRow = segsU * stride
  for (let j = 0; j < ringPts; j++) {
    indices.push(startCap, j + 1, j)
    indices.push(endCap, lastRow + j, lastRow + j + 1)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

// A finite kagami-biraki fragment. Lid partition, sliding, wooden cask stand, and mallet tray are product staging.
export function createKagamiBirakiModel(){
 const surfaceY=getEnvironmentSurfaceY('kagami-biraki-sake')
 const caskStandH=.14
 const traySurfaceY=.064
 const handleGrooveY=traySurfaceY+.040
 const root=new THREE.Group();root.name='kagami-biraki-root';root.position.y=surfaceY
 const subject=new THREE.Group();subject.name='kagami-biraki-subject';root.add(subject)
 const deduplicateNames=(group:THREE.Object3D)=>{
  const seen=new Map<string,number>()
  group.traverse(o=>{const n=seen.get(o.name)??0;seen.set(o.name,n+1);if(n>0)o.name=`${o.name}-${n}`})
 }
 // Compact chamfered square cedar cask stand grounded on the garden surface (product display staging).
 const caskStandBuild=addOfferingTable(subject,{
  name:'cask-stand',topName:'cask-stand-top',width:1.46,depth:1.46,surfaceY:caskStandH,thickness:.042,
  center:[.35,0],groundY:0,finish:'cedar',color:'#b88552',frameColor:'#8d5f39',
  planks:3,breadboardEnds:true,legThickness:.095,legInset:.075,apron:true,stretchers:false,bevel:.012,
 })
 deduplicateNames(caskStandBuild.root)
 // Chamfered footed wooden mallet tray with concave handle cradle beside the cask (product display staging).
 const malletTrayBuild=addObjectCradle(subject,{
  name:'mallet-tray',topName:'mallet-tray-top',width:.72,depth:1.24,center:[-1.1,.46],
  groundY:0,surfaceY:traySurfaceY,style:'tray',lip:true,lipHeight:.022,lipThickness:.032,
  kind:'wood',finish:'cedar',color:'#c89b67',accentColor:'#9b6e44',footed:true,bevel:.009,
 })
 deduplicateNames(malletTrayBuild.root)
 const handleCradleBuild=addObjectCradle(subject,{
  name:'mallet-handle-cradle',topName:'mallet-handle-cradle-top',width:.24,depth:.16,center:[-1.1,.76],
  groundY:traySurfaceY,surfaceY:handleGrooveY,style:'groove',groove:true,grooveAxis:'z',
  kind:'wood',finish:'cedar',color:'#a97b4d',grooveDepth:.018,grooveWidth:.090,bevel:.006,
 })
 deduplicateNames(handleCradleBuild.root)
 const mat=(color:string,roughness=.75)=>new THREE.MeshStandardMaterial({color,roughness,metalness:0})
 const komoTex=createKomoWeaveTextures()
 const ropeTex=createStrawRopeTextures()
 const ribbonTex=createRibbonClothTextures()
 const cedar=mat('#b68a55'),lidWood=mat('#e2bf86'),malletWood=mat('#c3955c')
 const rope=new THREE.MeshStandardMaterial({color:'#b4965c',roughness:.92,metalness:0,map:ropeTex.map,bumpMap:ropeTex.bump,bumpScale:.0044})
 const red=new THREE.MeshStandardMaterial({color:'#bb4841',roughness:.80,metalness:0,map:ribbonTex.map,bumpMap:ribbonTex.bump,bumpScale:.0022})
 const white=new THREE.MeshStandardMaterial({color:'#f8ebd2',roughness:.86,metalness:0,map:ribbonTex.map,bumpMap:ribbonTex.bump,bumpScale:.0022})
 applyCraftSurface(cedar,{kind:'wood',strength:.4,axis:'y'})
 applyCraftSurface(lidWood,{kind:'wood',strength:.4})
 applyCraftSurface(malletWood,{kind:'wood',strength:.4})
 const straw=new THREE.MeshStandardMaterial({color:'#d5ba7e',roughness:.95,metalness:0,map:komoTex.map,bumpMap:komoTex.bump,bumpScale:.0038})
 const finish=(source:THREE.BufferGeometry,preserveSmooth=false)=>{
  if(preserveSmooth && !source.getAttribute('normal'))source.computeVertexNormals()
  const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),uv=raw.getAttribute('uv'),nrm=preserveSmooth?raw.getAttribute('normal'):undefined,faces:number[]=[],tex:number[]=[],norms:number[]=[]
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(p,i+n));if(new THREE.Triangle(v[0]!,v[1]!,v[2]!).getArea()>1e-12){v.forEach(q=>faces.push(q.x,q.y,q.z));if(uv)for(let n=0;n<3;n++)tex.push(uv.getX(i+n),uv.getY(i+n));if(nrm)for(let n=0;n<3;n++)norms.push(nrm.getX(i+n),nrm.getY(i+n),nrm.getZ(i+n))}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));if(uv)g.setAttribute('uv',new THREE.Float32BufferAttribute(tex,2));if(nrm)g.setAttribute('normal',new THREE.Float32BufferAttribute(norms,3));else g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return g
 }
 const mesh=(name:string,geometry:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D,smooth=false)=>{const o=new THREE.Mesh(finish(geometry,smooth),material);o.name=name;o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const lathe=(points:number[][],segments=64)=>new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0]!,p[1]!)),segments)
 const cask=new THREE.Group();cask.name='prepared-sake-cask';cask.position.set(.35,caskStandH,0);subject.add(cask)
 const barrel=mesh('cedar-barrel',lathe([[0,0],[.55,0],[.62,.06],[.65,.5],[.62,1.08],[.53,1.08],[.55,.5],[.50,.12],[0,.12]]),cedar,cask)
 const radius=(y:number)=>y<=.5?.62+.03*(y-.06)/.44:.65-.03*(y-.5)/.58
 // Smooth C1-continuous barrel curve matching the cask bulge without a mid-height shading crease at y=0.50.
 const smoothBarrelR=(y:number)=>{
  const u=THREE.MathUtils.clamp((y-.08)/(.99-.08),0,1)
  return .621+.029*Math.sin(u*Math.PI)
 }
 // Smooth multi-ring woven komo straw wrap with taut hoop indentations under y=0.20 and y=0.91 and subtle vertical reed fluting.
 const komoOuter=(y:number)=>{
  const base=smoothBarrelR(y)+.035
  const dLow=(y-.20)/.036,dHigh=(y-.91)/.036
  const cinch=.0048*(Math.exp(-dLow*dLow)+Math.exp(-dHigh*dHigh))
  const edgeTuck=y<.098?(1-(y-.08)/.018)*.0055:y>.972?((y-.972)/.018)*.0055:0
  return base-cinch-edgeTuck
 }
 const komoProfile:number[][]=[[radius(.08),.08],[radius(.08)+.028,.08]]
 const rings=32
 for(let i=0;i<=rings;i++){const y=.082+(.988-.082)*(i/rings);komoProfile.push([komoOuter(y),y])}
 komoProfile.push([radius(.99)+.028,.99],[radius(.99),.99],[.65,.5],[radius(.08),.08])
 const wrapGeo=lathe(komoProfile,96)
 const wPos=wrapGeo.getAttribute('position') as THREE.BufferAttribute
 for(let i=0;i<wPos.count;i++){
  const x=wPos.getX(i),y=wPos.getY(i),z=wPos.getZ(i),r=Math.hypot(x,z)
  if(r>smoothBarrelR(y)+.018 && y>.086 && y<.984){
   const theta=Math.atan2(z,x),flute=1+.0018*Math.cos(theta*96)
   wPos.setX(i,x*flute);wPos.setZ(i,z*flute)
  }
 }
 wrapGeo.computeVertexNormals()
 const wrap=mesh('woven-komo-wrap',wrapGeo,straw,cask,true)
 // Slender taut straw-edge trim cords finishing the top and bottom komo mat borders.
 for(const [label,yTrim]of[['bottom',.093],['top',.977]] as const){
  const trim=mesh('komo-edge-trim-'+label,buildTwistedHorizontalCoil(komoOuter(yTrim)+.0045,0,.0078,.12,40,96,8),rope,cask,true)
  trim.position.y=yTrim
  trim.userData.toonSurface={outline:false}
 }
 // Taut twin-coil 3-ply twisted straw rope hoops seated firmly in the komo indentations.
 for(const [idx,y]of[.20,.91].entries()){
  const hoop=mesh('rope-hoop-'+y,buildTwistedHoopBand(smoothBarrelR,y,.34+idx*.22),rope,cask,true)
  hoop.position.y=y
 }
 const liquidRadius=.55-(.03*(.83-.5)/.58)
 const liquidMaterial=createRitualMaterial({color:'#ead59b',roughness:.18,transparent:true,opacity:.78,metalness:0,depthWrite:false},{kind:'water',strength:.25})
 liquidMaterial.userData.waterRendering=false // Sake keeps its authored liquid appearance.
 const liquid=mesh('sake-volume',lathe([[0,.12],[.50,.12],[.55,.5],[liquidRadius,.83],[0,.83]]),liquidMaterial,cask);liquid.castShadow=false
 // Both prepared halves stay flat on the rim; this opening geometry is an original simplification.
 const lids=[-1,1].map(side=>{const points=Array.from({length:49},(_,i)=>{const angle=-Math.PI/2+Math.PI*i/48;return new THREE.Vector2(side*.61*Math.cos(angle),.61*Math.sin(angle))});if(side===-1)points.reverse();const s=new THREE.Shape(points);s.closePath();const o=mesh('prepared-lid-'+(side===-1?'left':'right'),new THREE.ExtrudeGeometry(s,{depth:.045,bevelEnabled:false,curveSegments:24}),lidWood,cask);o.rotation.x=-Math.PI/2;o.position.y=1.08;return o})
 const mallet=new THREE.Group();mallet.name='wooden-mallet';subject.add(mallet)
 const head=mesh('mallet-head',new THREE.BoxGeometry(.50,.22,.26),malletWood,mallet)
 const handle=mesh('mallet-handle',new THREE.CylinderGeometry(.035,.035,.82,16),cedar,mallet);handle.rotation.x=Math.PI/2;handle.position.set(0,-.035,.48)
 // Flush-wrapped red and white cloth binding bands hugging the 0.035 handle tightly with zero gap.
 for(const [i,material]of[red,white].entries()){
  const band=mesh('ribbon-band-'+i,buildHandleClothBandGeometry(.0346,.0404,.0105,36),material,mallet,true)
  band.position.set(0,-.035,.214+i*.022)
 }
 // Structured folded flat-cloth overhand knot with interlocking flat white crossover strap seated flush atop the bands.
 const knot=mesh('ribbon-knot',buildFoldedClothKnotGeometry(.023,.0092,.018),red,mallet,true);knot.position.set(-.002,.0072,.222)
 const knotAccent=mesh('ribbon-knot-accent',buildFoldedClothKnotGeometry(.018,.0072,.0155),white,mallet,true);knotAccent.position.set(.006,.0092,.232);knotAccent.rotation.set(.10,-.42,-.12)
 knotAccent.userData.toonSurface={outline:false}
 // Shaped, cambered woven cloth ribbon tails with deterministic inertial trail that returns strictly to 0 at every checkpoint.
 const tailPivots=([red,white] as const).map((material,i)=>{
  const side=(i===0?-1:1) as -1|1
  const pivot=new THREE.Group();pivot.name='ribbon-tail-pivot-'+i
  pivot.position.set(side*.010,.0085+i*.0015,.234+i*.004)
  mallet.add(pivot)
  const tail=mesh('ribbon-tail-'+i,buildRibbonTailGeometry(side,.185),material,pivot,true)
  tail.userData.toonSurface={outline:false}
  return pivot
 })
 const lerp=THREE.MathUtils.lerp
 const lidMalletY=1.235+caskStandH
 const liftY=1.8+caskStandH
 const reboundY=1.65+caskStandH
 const restMalletY=traySurfaceY+.11
 const pose=(step:number,amount:number)=>{
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
  let opening=step>1?1:step===1?THREE.MathUtils.clamp((t-.4)/.6,0,1):0
  lids.forEach((o,i)=>o.position.x=(i===0?-1:1)*lerp(.002,.15,opening))
  let trailPitch=0,trailYaw=0
  if(step===0){
   if(t<.5){mallet.position.set(.35,lerp(lidMalletY,liftY,t/.5),0);trailPitch=.15*Math.sin(Math.PI*(t/.5))}
   else{mallet.position.set(.35,liftY,lerp(0,.45,(t-.5)/.5));trailPitch=-.08*Math.sin(Math.PI*((t-.5)/.5))}
  }
  else if(step===1){
   mallet.position.set(.35,t<.4?lerp(liftY,lidMalletY,t/.4):lerp(lidMalletY,reboundY,(t-.4)/.6),.45)
   trailPitch=t<.4?-.22*Math.sin(Math.PI*(t/.4)):.13*Math.sin(Math.PI*((t-.4)/.6))
  }
  else if(step===2){
   if(t<.25)mallet.position.set(.35,lerp(reboundY,liftY,t/.25),.45)
   else if(t<.75){const u=(t-.25)/.5;mallet.position.set(lerp(.35,-1.1,u),liftY,lerp(.45,.10,u))}
   else mallet.position.set(-1.1,lerp(liftY,restMalletY,(t-.75)/.25),.10)
   const s=Math.sin(Math.PI*t);trailPitch=.09*s;trailYaw=-.12*s
  }
  else mallet.position.set(-1.1,restMalletY,.10)
  // Enforce exact 0 rotation at checkpoint boundaries (t===0, t===1, step>=3) for checkpoint & reduced parity.
  if(t<=0||t>=1||step>=3){trailPitch=0;trailYaw=0}
  tailPivots[0]!.rotation.set(trailPitch,trailYaw*.85,-trailYaw*.32)
  tailPivots[1]!.rotation.set(trailPitch*.92,trailYaw,-trailYaw*.24)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 let disposed=false
 return {
  root,subject,cask,caskStand:caskStandBuild.root,malletTray:malletTrayBuild.root,handleCradle:handleCradleBuild.root,barrel,wrap,liquid,lids,mallet,head,handle,
  targets:[mallet,mallet,mallet],roots:[mallet,mallet,mallet],anchors:[[0,.11,.04],[0,.11,.04],[0,.11,.04]] as [number,number,number][],
  pose,
  dispose:()=>{
   if(!disposed){
    disposed=true
    komoTex.map.dispose();komoTex.bump.dispose()
    ropeTex.map.dispose();ropeTex.bump.dispose()
    ribbonTex.map.dispose();ribbonTex.bump.dispose()
   }
  },
 }
}
