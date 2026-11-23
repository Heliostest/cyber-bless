import * as THREE from 'three'

type XYZ = [number, number, number]

interface CachedTexturePixels {
  color: Uint8Array
  bump: Uint8Array
  size: number
}

let cachedFeltPixels: CachedTexturePixels | null = null
let cachedRopePixels: CachedTexturePixels | null = null
let cachedEavePixels: CachedTexturePixels | null = null

function hash2Periodic(ix: number, iy: number, period: number): number {
  const x = ((ix % period) + period) % period
  const y = ((iy % period) + period) % period
  const h = Math.sin(x * 127.1 + y * 311.7 + period * 19.19) * 43758.5453123
  return h - Math.floor(h)
}

function valueNoisePeriodic(u: number, v: number, period: number): number {
  const fx = u * period
  const fy = v * period
  const ix = Math.floor(fx)
  const iy = Math.floor(fy)
  const tx = fx - ix
  const ty = fy - iy
  const sx = tx * tx * (3 - 2 * tx)
  const sy = ty * ty * (3 - 2 * ty)
  const n00 = hash2Periodic(ix, iy, period)
  const n10 = hash2Periodic(ix + 1, iy, period)
  const n01 = hash2Periodic(ix, iy + 1, period)
  const n11 = hash2Periodic(ix + 1, iy + 1, period)
  const nx0 = n00 + (n10 - n00) * sx
  const nx1 = n01 + (n11 - n01) * sx
  return nx0 + (nx1 - nx0) * sy
}

function configureTexture(
  data: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeatX: number,
  repeatY: number,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(data), size, size, THREE.RGBAFormat)
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(repeatX, repeatY)
  tex.colorSpace = colorSpace
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.needsUpdate = true
  return tex
}

/**
 * 256x256 seamless mipmapped felted sheep's-wool texture + bump map.
 * Combines directionless matted wool fiber wisps with subtle hand-quilted
 * structural diamond running-stitches (shirees) holding compressed felt thickness.
 */
function createWoolFeltTextures(repeatX: number, repeatY: number): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 256
  if (!cachedFeltPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        // Multi-scale matted wool felt fiber mottling (isotropic, never mechanical plaid).
        const cloud = valueNoisePeriodic(u, v, 8) - 0.5
        const tuft = valueNoisePeriodic(u + 0.17, v + 0.31, 20) - 0.5
        const fine = valueNoisePeriodic(u + 0.43, v + 0.11, 48) - 0.5
        // Short criss-crossing felted wool fiber wisps at oblique angles.
        const wispA = Math.sin((u * 14 + v * 9 + tuft * 1.4) * tau) * (0.5 + tuft)
        const wispB = Math.sin((u * 11 - v * 15 + cloud * 1.6) * tau) * (0.5 - fine)
        const woolFiber = cloud * 13.5 + tuft * 11.0 + fine * 5.8 + (wispA + wispB) * 3.0

        // Delicate structural quilted felt running-stitches (shirees) holding thick wool felt.
        const dA = Math.abs((((u * 2 + v * 2) % 1) + 1) % 1 - 0.5)
        const dB = Math.abs((((u * 2 - v * 2) % 1) + 1) % 1 - 0.5)
        const dMin = Math.min(dA, dB)
        // Soft wool felt loft between stitch lines.
        const quiltTuft = Math.min(1, dMin / 0.16)
        const loft = Math.sin(quiltTuft * (Math.PI / 2))
        // Subtle recessed stitch groove + dashed woolen running-stitch thread.
        const groove = dMin < 0.028 ? Math.cos((dMin / 0.028) * (Math.PI / 2)) ** 2 : 0
        const along = dA <= dB ? (u * 2 - v * 2) : (u * 2 + v * 2)
        const dash = 0.5 + 0.5 * Math.sin(along * 22 * tau)
        const stitchIndent = groove * (0.48 + 0.52 * dash)

        const lum = 237 + woolFiber + (loft - 0.65) * 6.0 - stitchIndent * 11.5
        const idx = (y * size + x) * 4
        // Keep warm cream-ivory sheep's wool tint clean and luminous.
        color[idx] = THREE.MathUtils.clamp(Math.round(lum + 3.5), 196, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(lum + 1.2), 192, 254)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(lum - 4.0), 184, 248)
        color[idx + 3] = 255

        const height = 132 + woolFiber * 2.4 + (loft - 0.55) * 28 - stitchIndent * 46
        const h = THREE.MathUtils.clamp(Math.round(height), 22, 240)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedFeltPixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedFeltPixels.color, size, THREE.SRGBColorSpace, repeatX, repeatY),
    bump: configureTexture(cachedFeltPixels.bump, size, THREE.NoColorSpace, repeatX, repeatY),
  }
}

/** 128x128 3-ply twisted wool/horsehair rope texture + bump map aligned to rope UVs. */
function createTwistedRopeTextures(repeatX = 1, repeatY = 1): { map: THREE.DataTexture; bump: THREE.DataTexture } {
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
        const subYarn = Math.sin((u * 18 - v * 6) * tau) * 0.28
        const fiber = (valueNoisePeriodic(u, v, 24) - 0.5) * 0.45
        const f = ply * 0.68 + subYarn + fiber
        const shade = f * 24
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(234 + shade * 0.94), 178, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(227 + shade * 0.96), 170, 252)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(215 + shade), 158, 244)
        color[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + f * 68), 22, 238)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedRopePixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedRopePixels.color, size, THREE.SRGBColorSpace, repeatX, repeatY),
    bump: configureTexture(cachedRopePixels.bump, size, THREE.NoColorSpace, repeatX, repeatY),
  }
}

/** 128x128 woven canvas/felt eave border trim texture + bump map with stitched edge piping. */
function createEaveTrimTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedEavePixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      const edgeDist = Math.min(v, 1 - v)
      const borderStitch = Math.abs(edgeDist - 0.14) < 0.032
        ? Math.cos((Math.abs(edgeDist - 0.14) / 0.032) * (Math.PI / 2)) ** 2
        : 0
      const pipeHighlight = edgeDist < 0.09 ? Math.cos((edgeDist / 0.09) * (Math.PI / 2)) : 0
      for (let x = 0; x < size; x++) {
        const u = x / size
        const warp = Math.sin(u * 28 * tau)
        const weft = Math.sin(v * 20 * tau)
        const weave = warp * weft * 0.42 + (warp + weft) * 0.20
        const dash = 0.5 + 0.5 * Math.sin(u * 14 * tau)
        const shade = weave * 11 + pipeHighlight * 14 + borderStitch * (dash * 18 - 8)
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(236 + shade), 192, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(238 + shade), 194, 255)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(240 + shade), 198, 255)
        color[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + weave * 36 + pipeHighlight * 34 + borderStitch * (dash * 40 - 18)), 28, 236)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedEavePixels = { color, bump, size }
  }
  return {
    map: configureTexture(cachedEavePixels.color, size, THREE.SRGBColorSpace, 24, 1),
    bump: configureTexture(cachedEavePixels.bump, size, THREE.NoColorSpace, 24, 1),
  }
}

/**
 * Builds a continuous 3-ply twisted cord geometry along an arbitrary 3D curve using a
 * twist-free parallel-transport (Bishop) frame. Outward winding verified:
 * frame (T, N, B = T x N) gives (+theta) x (+u) strictly radially outward.
 */
function buildTwistedCordGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments: number,
  radialSegments: number,
  radius: number,
  turns: number,
  plyCount = 3,
  plyDepth = 0.145,
  closed = false,
  capEnds = !closed,
): THREE.BufferGeometry {
  const points = curve.getSpacedPoints(tubularSegments)
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i <= tubularSegments; i++) {
    const prev = closed
      ? points[(i - 1 + tubularSegments) % tubularSegments]!
      : points[Math.max(0, i - 1)]!
    const next = closed
      ? points[(i + 1) % tubularSegments]!
      : points[Math.min(tubularSegments, i + 1)]!
    const t = new THREE.Vector3().subVectors(next, prev)
    if (t.lengthSq() < 1e-12) t.set(0, 1, 0)
    else t.normalize()
    tangents.push(t)
  }

  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  const ref = Math.abs(tangents[0]!.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const n0 = new THREE.Vector3().crossVectors(ref, tangents[0]!).normalize()
  const b0 = new THREE.Vector3().crossVectors(tangents[0]!, n0).normalize()
  normals.push(n0)
  binormals.push(b0)

  const rotAxis = new THREE.Vector3()
  const rotQuat = new THREE.Quaternion()
  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1]!
    const currT = tangents[i]!
    const prevN = normals[i - 1]!.clone()
    rotAxis.crossVectors(prevT, currT)
    const sinA = rotAxis.length()
    if (sinA > 1e-6) {
      rotAxis.divideScalar(sinA)
      const cosA = THREE.MathUtils.clamp(prevT.dot(currT), -1, 1)
      rotQuat.setFromAxisAngle(rotAxis, Math.atan2(sinA, cosA))
      prevN.applyQuaternion(rotQuat)
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize()
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize()
    normals.push(prevN)
    binormals.push(currB)
  }

  // Align loop closure twist cleanly when closed.
  if (closed) {
    const endN = normals[tubularSegments]!
    const startN = normals[0]!
    const twistAngle = Math.atan2(endN.dot(binormals[0]!), endN.dot(startN))
    for (let i = 1; i <= tubularSegments; i++) {
      const a = -(twistAngle * i) / tubularSegments
      const ca = Math.cos(a), sa = Math.sin(a)
      const n = normals[i]!.clone()
      const b = binormals[i]!.clone()
      normals[i] = n.clone().multiplyScalar(ca).addScaledVector(b, sa)
      binormals[i] = b.multiplyScalar(ca).addScaledVector(n, -sa)
    }
  }

  const stride = radialSegments + 1
  const ringVerts = (tubularSegments + 1) * stride
  const extraVerts = capEnds ? 2 : 0
  const positions = new Float32Array((ringVerts + extraVerts) * 3)
  const uvs = new Float32Array((ringVerts + extraVerts) * 2)
  const indices: number[] = []
  const tau = Math.PI * 2

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const p = points[i]!
    const N = normals[i]!
    const B = binormals[i]!
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const theta = v * tau
      const ply = 1 + plyDepth * Math.cos(theta * plyCount - u * turns * tau)
      const r = radius * ply
      const ct = Math.cos(theta), st = Math.sin(theta)
      const k = i * stride + j
      positions[k * 3] = p.x + (N.x * ct + B.x * st) * r
      positions[k * 3 + 1] = p.y + (N.y * ct + B.y * st) * r
      positions[k * 3 + 2] = p.z + (N.z * ct + B.z * st) * r
      uvs[k * 2] = u * turns * 0.45
      uvs[k * 2 + 1] = v
      if (i < tubularSegments && j < radialSegments) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // B = T x N -> (+theta) x (+u) = (-sin*N + cos*B) x T = +cos*N + sin*B (radially outward).
        indices.push(a, b, c, b, d, c)
      }
    }
  }

  if (capEnds) {
    const startIdx = ringVerts
    const endIdx = ringVerts + 1
    const p0 = points[0]!
    const p1 = points[tubularSegments]!
    positions[startIdx * 3] = p0.x; positions[startIdx * 3 + 1] = p0.y; positions[startIdx * 3 + 2] = p0.z
    uvs[startIdx * 2] = 0; uvs[startIdx * 2 + 1] = 0.5
    positions[endIdx * 3] = p1.x; positions[endIdx * 3 + 1] = p1.y; positions[endIdx * 3 + 2] = p1.z
    uvs[endIdx * 2] = turns * 0.45; uvs[endIdx * 2 + 1] = 0.5
    const lastRow = tubularSegments * stride
    for (let j = 0; j < radialSegments; j++) {
      indices.push(startIdx, j + 1, j)
      indices.push(endIdx, lastRow + j, lastRow + j + 1)
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Merges multiple geometries into one indexed-free BufferGeometry with outward normals preserved. */
function mergeGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let total = 0
  const expanded = parts.map((g) => {
    if (!g.getAttribute('normal')) g.computeVertexNormals()
    return g.index ? g.toNonIndexed() : g
  })
  for (const g of expanded) total += g.getAttribute('position').count
  const pos = new Float32Array(total * 3)
  const norm = new Float32Array(total * 3)
  const uv = new Float32Array(total * 2)
  let off = 0
  for (let idx = 0; idx < expanded.length; idx++) {
    const g = expanded[idx]!
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const t = g.getAttribute('uv')
    for (let i = 0; i < p.count; i++) {
      pos[(off + i) * 3] = p.getX(i)
      pos[(off + i) * 3 + 1] = p.getY(i)
      pos[(off + i) * 3 + 2] = p.getZ(i)
      if (n) {
        norm[(off + i) * 3] = n.getX(i)
        norm[(off + i) * 3 + 1] = n.getY(i)
        norm[(off + i) * 3 + 2] = n.getZ(i)
      }
      if (t) {
        uv[(off + i) * 2] = t.getX(i)
        uv[(off + i) * 2 + 1] = t.getY(i)
      }
    }
    off += p.count
    if (g !== parts[idx]) g.dispose()
    parts[idx]!.dispose()
  }
  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(norm, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2))
  return merged
}

/** Smooth angular wrap distance in [-PI, PI]. */
function wrapAngleDelta(a: number, b: number): number {
  let d = a - b
  while (d > Math.PI) d -= Math.PI * 2
  while (d < -Math.PI) d += Math.PI * 2
  return d
}

/**
 * Builds a thickened, beveled woven fabric eave trim band hugging the roof-to-wall junction.
 * Keeps outer radius strictly <= 1.347 and height strictly within y = 1.19 +/- 0.035.
 */
function buildEaveTrimGeometry(segments = 96): THREE.BufferGeometry {
  // Closed CCW profile in (r, y) for outward normals under (+theta) x (+s):
  // Outer face moves upward (+y), top rim inward (-r), inner face downward (-y), bottom rim outward (+r).
  // Preserves exact original outer cylinder envelope (r=1.347 at -0.035, r=1.346 at +0.035) for zero camera drift.
  const profile: [number, number, number][] = [
    [1.347, -0.035, 0.00],
    [1.346, -0.024, 0.16],
    [1.344, -0.010, 0.36],
    [1.345, 0.000, 0.50],
    [1.344, 0.012, 0.68],
    [1.346, 0.024, 0.84],
    [1.346, 0.035, 1.00],
    [1.318, 0.031, 0.92],
    [1.318, -0.031, 0.08],
    [1.347, -0.035, 0.00],
  ]
  const pCount = profile.length
  const stride = pCount
  const positions = new Float32Array((segments + 1) * stride * 3)
  const uvs = new Float32Array((segments + 1) * stride * 2)
  const indices: number[] = []
  for (let i = 0; i <= segments; i++) {
    const u = i / segments
    const theta = u * Math.PI * 2
    const st = Math.sin(theta), ct = Math.cos(theta)
    for (let j = 0; j < pCount; j++) {
      const [r, y, vCoord] = profile[j]!
      const k = i * stride + j
      positions[k * 3] = st * r
      positions[k * 3 + 1] = y
      positions[k * 3 + 2] = ct * r
      uvs[k * 2] = u
      uvs[k * 2 + 1] = vCoord
      if (i < segments && j < pCount - 1) {
        const a = k, b = k + stride, c = k + 1, d = b + 1
        // (+theta) x (+j) = (+X) x (+Y) = +Z (radially outward on outer face).
        indices.push(a, b, c, c, b, d)
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

/**
 * Builds the rolled wool-felt bundle at step 2 with an explicit overlapping outer sheet-edge step
 * and twin subtle tie-strap cinch indentations at x = +/- 0.21 (staying strictly inside r <= 0.1295, |x| <= 0.395).
 */
function buildFeltRollGeometry(): THREE.BufferGeometry {
  const axialSegs = 40
  const radialSegs = 56
  const halfLen = 0.395
  const stride = radialSegs + 1
  const bodyVerts = (axialSegs + 1) * stride
  // Add 2 end-cap rings + 2 center vertices so the flat recessed spiral faces seal cleanly.
  const positions = new Float32Array((bodyVerts + 2 * stride + 2) * 3)
  const uvs = new Float32Array((bodyVerts + 2 * stride + 2) * 2)
  const indices: number[] = []
  const tau = Math.PI * 2

  const rollRadius = (x: number, angle: number): number => {
    // Smooth overlapping outer felt sheet lip along the front-upper edge (angle ~ 0.55 rad).
    const aNorm = ((angle - 0.55) % tau + tau) % tau
    const lapRamp = aNorm < 0.42
      ? 0.5 - 0.5 * Math.cos((aNorm / 0.42) * Math.PI)
      : 1 - (aNorm - 0.42) / (tau - 0.42)
    const lapStep = (lapRamp - 0.45) * 0.0052
    // Gentle strap-cinch grooves at x = +/- 0.21 where the twin wool tie straps hug the bundle.
    const cinchL = Math.exp(-(((x + 0.21) / 0.034) ** 2))
    const cinchR = Math.exp(-(((x - 0.21) / 0.034) ** 2))
    // Slight barrel fullness between straps, soft chamfered roll ends.
    const edgeTaper = 1 - 0.04 * Math.pow(Math.abs(x) / halfLen, 8)
    return (0.1268 + lapStep - 0.0058 * (cinchL + cinchR)) * edgeTaper
  }

  for (let i = 0; i <= axialSegs; i++) {
    const u = i / axialSegs
    const x = -halfLen + u * halfLen * 2
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs
      const angle = v * tau
      const r = rollRadius(x, angle)
      const k = i * stride + j
      positions[k * 3] = x
      positions[k * 3 + 1] = Math.sin(angle) * r
      positions[k * 3 + 2] = Math.cos(angle) * r
      uvs[k * 2] = u * 1.4
      uvs[k * 2 + 1] = v
      if (i < axialSegs && j < radialSegs) {
        const a = k, b = k + stride, c = k + 1, d = b + 1
        // At angle=0 (0,0,r): (+x) x (+angle) = (+X) x (+Y) = +Z (radially outward).
        indices.push(a, b, c, c, b, d)
      }
    }
  }

  // Left (-X) and Right (+X) end caps.
  for (const [sideIdx, side] of ([-1, 1] as const).entries()) {
    const ringBase = bodyVerts + sideIdx * stride
    const centerIdx = bodyVerts + 2 * stride + sideIdx
    const x = side * halfLen
    positions[centerIdx * 3] = x
    positions[centerIdx * 3 + 1] = 0
    positions[centerIdx * 3 + 2] = 0
    uvs[centerIdx * 2] = 0.5
    uvs[centerIdx * 2 + 1] = 0.5
    for (let j = 0; j <= radialSegs; j++) {
      const v = j / radialSegs
      const angle = v * tau
      const r = rollRadius(x, angle)
      const k = ringBase + j
      positions[k * 3] = x
      positions[k * 3 + 1] = Math.sin(angle) * r
      positions[k * 3 + 2] = Math.cos(angle) * r
      uvs[k * 2] = 0.5 + 0.45 * Math.cos(angle)
      uvs[k * 2 + 1] = 0.5 + 0.45 * Math.sin(angle)
      if (j < radialSegs) {
        if (side > 0) indices.push(centerIdx, k + 1, k)
        else indices.push(centerIdx, k, k + 1)
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

/** Original miniature geometry. Assembly is illustrative, not a structural simulation. */
export function createGerModel() {
  const subject = new THREE.Group(); subject.name = 'ger-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc77940, roughness: .79 })
  const lightWood = new THREE.MeshStandardMaterial({ color: 0xe8b976, roughness: .82 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb9573e, roughness: .7 })
  const blue = new THREE.MeshStandardMaterial({ color: 0x397d87, roughness: .83 })

  const ownedTextures: THREE.DataTexture[] = []
  const feltTex = createWoolFeltTextures(12, 3)
  const rollFeltTex = createWoolFeltTextures(3, 2)
  const ropeTex = createTwistedRopeTextures(1, 1)
  const eaveTex = createEaveTrimTextures()
  ownedTextures.push(
    feltTex.map, feltTex.bump,
    rollFeltTex.map, rollFeltTex.bump,
    ropeTex.map, ropeTex.bump,
    eaveTex.map, eaveTex.bump,
  )

  const felt = new THREE.MeshStandardMaterial({
    color: 0xf4ecda,
    map: feltTex.map,
    bumpMap: feltTex.bump,
    bumpScale: 0.0068,
    roughness: 0.98,
    vertexColors: true,
  })
  const rollFelt = new THREE.MeshStandardMaterial({
    color: 0xede2ca,
    map: rollFeltTex.map,
    bumpMap: rollFeltTex.bump,
    bumpScale: 0.0062,
    roughness: 0.98,
  })
  const ropeMat = new THREE.MeshStandardMaterial({
    color: 0x97734f,
    map: ropeTex.map,
    bumpMap: ropeTex.bump,
    bumpScale: 0.006,
    roughness: 0.96,
  })
  const eaveMat = new THREE.MeshStandardMaterial({
    color: 0x397d87,
    map: eaveTex.map,
    bumpMap: eaveTex.bump,
    bumpScale: 0.005,
    roughness: 0.86,
  })
  const spiralShadowMat = new THREE.MeshStandardMaterial({ color: 0x8f7a62, roughness: 0.98 })

  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ = [0, 0, 0], parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p)
    m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const rodGeometry = new THREE.CylinderGeometry(1, 1, 1, 8)
  const beam = (name: string, material: THREE.Material, parent = subject) => add(name, rodGeometry, material, [0, 0, 0], parent)
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3()
  const between = (mesh: THREE.Mesh, start: XYZ, end: XYZ, radius: number) => {
    a.set(...start); b.set(...end); dir.subVectors(b, a)
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.scale.set(radius, dir.length(), radius)
    mesh.quaternion.setFromUnitVectors(up, dir.normalize())
  }
  const floor = add('ger-wood-floor', new THREE.CylinderGeometry(1.31, 1.31, .075, 80), lightWood, [0, .0075, 0])
  floor.userData.toonSurface = { outline: false }
  // A shallow wooden floor contacts the environment at y=-.03.
  for (let i = -5; i <= 5; i++) {
    const x = i * .22, length = Math.sqrt(1.3 ** 2 - x ** 2) * 2
    const seam = add(`ger-floor-seam-${i}`, new THREE.BoxGeometry(.006, .003, length), wood, [x, .046, 0])
    seam.castShadow = false; seam.userData.toonSurface = { outline: false }
  }
  const lattice = new THREE.Group(); lattice.name = 'ger-lattice'; subject.add(lattice)
  const slats: { mesh: THREE.Mesh; start: number; end: number; reverse: boolean }[] = []
  const first = .30, last = Math.PI * 2 - .30
  for (let i = 0; i < 32; i++) for (const reverse of [false, true]) {
    const start = first + (last - first - .40) * i / 31
    slats.push({ mesh: beam(`ger-lattice-${i}-${reverse ? 'b' : 'a'}`, i % 3 ? wood : lightWood, lattice), start, end: start + .40, reverse })
  }
  const latticeGrip = add('ger-lattice-grip', new THREE.CylinderGeometry(.047, .047, .35, 16), red, [.7, .67, .86])
  const door = new THREE.Group(); door.name = 'ger-door-frame'; subject.add(door)
  for (const side of [-1, 1]) add(`ger-door-post-${side}`, new THREE.BoxGeometry(.07, 1.14, .095), red, [side * .35, .61, 1.19], door)
  add('ger-door-lintel', new THREE.BoxGeometry(.77, .095, .095), red, [0, 1.16, 1.19], door)
  add('ger-door-threshold', new THREE.BoxGeometry(.77, .055, .17), wood, [0, .068, 1.19], door)
  add('ger-door-leaf', new THREE.BoxGeometry(.62, 1.02, .035), blue, [0, .60, 1.19], door)
  for (const y of [.36, .84]) {
    add(`ger-door-inset-${y}`, new THREE.BoxGeometry(.43, .31, .018), lightWood, [0, y, 1.219], door)
    add(`ger-door-panel-${y}`, new THREE.BoxGeometry(.35, .23, .02), red, [0, y, 1.23], door)
    const diamond = add(`ger-door-diamond-${y}`, new THREE.BoxGeometry(.09, .09, .015), lightWood, [0, y, 1.248], door); diamond.rotation.z = Math.PI / 4
  }
  add('ger-door-handle', new THREE.TorusGeometry(.035, .008, 8, 20), ropeMat, [.23, .60, 1.25], door)
  const roof = new THREE.Group(); roof.name = 'ger-roof-frame'; subject.add(roof)
  const crown = add('ger-roof-crown', new THREE.TorusGeometry(.36, .052, 12, 64).rotateX(Math.PI / 2), red, [0, 1.22, 0], roof)
  const crownBars = [-.12, .12].map((x, i) => ({ x, mesh: beam(`ger-crown-crossbar-${i}`, lightWood, roof) }))
  const rafters = Array.from({ length: 36 }, (_, i) => ({ angle: (i + .5) / 36 * Math.PI * 2, mesh: beam(`ger-rafter-${i}`, i % 3 === 0 ? lightWood : wood, roof) }))
  const columns = [-1, 1].map(side => ({ side, mesh: beam(`ger-support-column-${side}`, red, roof) }))

  // Multi-row closed structural wool-felt shells: tautly supported by underlying rafters/khana,
  // with subtle overlapping felt panel lap seams, girth-rope cinching, and stitched hem borders.
  // All outer vertices stay strictly within the original spatial envelope (zero camera drift).
  const SHELL_COLS = 128
  const SHELL_VROWS = 16
  const RING_VERTS = (SHELL_VROWS + 1) * 2
  const INDICES_PER_COL = RING_VERTS * 6

  const wallSeams = [0.76, 2.12, 3.58, 4.98]
  const roofSeams = [0.36, 2.46, 4.54]
  const roofTieAngles = [-0.9, 0.9, Math.PI]

  const buildFeltShell = (
    name: string,
    lowerR: number,
    upperR: number,
    lowerY: number,
    upperY: number,
    start: number,
    span: number,
    isRoof: boolean,
  ) => {
    const positions: number[] = []
    const colors: number[] = []
    const uvs: number[] = []
    const indices: number[] = []

    const feltDisplacement = (theta: number, v: number, y: number): { dr: number; shade: number } => {
      if (isRoof) {
        // Subtle taut support relief over the 36 uni rafters (zero concave sagging).
        const endFade = Math.sin(v * Math.PI) * 0.72 + 0.28
        const rafterRelief = 0.0020 * Math.cos(theta * 36) * endFade
        // Layered deever roof felt panel overlaps with beveled wool-thickness lap step and warm seam crease.
        let panelStep = 0
        let seamCrease = 0
        for (const seam of roofSeams) {
          const d = wrapAngleDelta(theta, seam)
          if (d >= 0 && d < 0.085) {
            panelStep += 0.0056 * Math.sin((d / 0.085) * (Math.PI / 2))
          } else if (d >= 0.085 && d < 1.15) {
            panelStep += 0.0056 * (1 - (d - 0.085) / 1.065)
          }
          const stitchDash = 0.72 + 0.28 * Math.sin(v * 26 * Math.PI * 2)
          seamCrease = Math.max(seamCrease, Math.exp(-(((d - 0.012) / 0.036) ** 2)) * stitchDash)
        }
        // Subtle layered upper felt crown-collar border hugging below the toono rim.
        const collarStep = v > 0.87 ? 0.0042 * THREE.MathUtils.smoothstep(v, 0.87, 0.92) : 0
        const collarCrease = Math.exp(-(((v - 0.87) / 0.024) ** 2)) * 0.62
        // Gentle tension channel directly under the 3 radial roof tie cords.
        let cordPress = 0
        for (const aTie of roofTieAngles) {
          const d = wrapAngleDelta(theta, aTie)
          cordPress = Math.max(cordPress, Math.exp(-((d / 0.048) ** 2)))
        }
        const dr = rafterRelief + panelStep + collarStep - 0.0032 * cordPress
        // Sunlit warm cream roof with soft natural crease depth at panel overlaps, crown collar, eave tuck, and ties.
        const shade = 0.986
          + 0.014 * Math.cos(theta * 36) * endFade
          - 0.095 * seamCrease
          - 0.056 * collarCrease
          - 0.044 * cordPress
          - 0.034 * (1 - Math.min(1, v / 0.14))
        return { dr, shade }
      } else {
        // Wall felt (tuurga): tautly supported over khana lattice, cinched gently under twin girth ropes.
        const khanaRelief = 0.0016 * Math.cos(theta * 32)
        // Two smooth horizontal girth-band tension grooves at y = 0.42 and y = 0.97.
        const cinchLow = Math.exp(-(((y - 0.42) / 0.064) ** 2))
        const cinchHigh = Math.exp(-(((y - 0.97) / 0.064) ** 2))
        const cinch = Math.max(cinchLow, cinchHigh)
        // Four stepped overlapping vertical wall felt panels with stitched lap creases.
        let panelStep = 0
        let seamCrease = 0
        for (const seam of wallSeams) {
          const d = wrapAngleDelta(theta, seam)
          if (d >= 0 && d < 0.075) {
            panelStep += 0.0056 * Math.sin((d / 0.075) * (Math.PI / 2))
          } else if (d >= 0.075 && d < 0.65) {
            panelStep += 0.0056 * (1 - (d - 0.075) / 0.575)
          }
          const stitchDash = 0.72 + 0.28 * Math.sin(v * 24 * Math.PI * 2)
          seamCrease = Math.max(seamCrease, Math.exp(-(((d - 0.012) / 0.035) ** 2)) * stitchDash)
        }
        // Subtle folded lower felt skirt hem resting cleanly on the wooden floor.
        const lowerHem = v < 0.08 ? 0.0028 * (1 - v / 0.08) : 0
        const hemCrease = Math.exp(-(((v - 0.085) / 0.025) ** 2)) * 0.45
        // Soft shadow directly under the overhanging blue eave skirt.
        const eaveShadow = THREE.MathUtils.smoothstep(v, 0.86, 1.0)
        const dr = khanaRelief + panelStep + lowerHem - 0.0044 * cinch
        const shade = 0.968
          + 0.012 * Math.cos(theta * 32)
          - 0.098 * seamCrease
          - 0.062 * cinch
          - 0.044 * hemCrease
          - 0.060 * eaveShadow
        return { dr, shade }
      }
    }

    const uScale = isRoof ? 1.0 : 1.05
    for (let i = 0; i <= SHELL_COLS; i++) {
      const u = i / SHELL_COLS
      const theta = start + span * u
      const st = Math.sin(theta), ct = Math.cos(theta)

      // Outer surface: bottom (v = 0) -> top (v = 1)
      for (let rIdx = 0; rIdx <= SHELL_VROWS; rIdx++) {
        const v = rIdx / SHELL_VROWS
        const y = THREE.MathUtils.lerp(lowerY, upperY, v)
        const baseR = THREE.MathUtils.lerp(lowerR, upperR, v)
        const { dr, shade } = feltDisplacement(theta, v, y)
        // Guard exact spatial envelope: never inflate roof outer radius past 1.345 or inner opening below 0.388.
        const maxR = isRoof ? THREE.MathUtils.lerp(1.345, 0.414, v) : 1.279
        const r = Math.min(maxR, Math.max(isRoof ? 0.394 : 1.258, baseR + dr))
        positions.push(st * r, y, ct * r)
        // Warm slight ivory tint in shadows (R > G > B slightly so creases stay cozy cream, not cold grey).
        const sR = THREE.MathUtils.clamp(shade, 0.78, 1.02)
        const sG = THREE.MathUtils.clamp(shade - (1 - shade) * 0.08, 0.76, 1.02)
        const sB = THREE.MathUtils.clamp(shade - (1 - shade) * 0.18, 0.73, 1.01)
        colors.push(sR, sG, sB)
        uvs.push(u * uScale, v)
      }

      // Inner surface: top (v = 1) -> bottom (v = 0) forming a closed finite-thickness felt shell.
      for (let rIdx = SHELL_VROWS; rIdx >= 0; rIdx--) {
        const v = rIdx / SHELL_VROWS
        const y = THREE.MathUtils.lerp(lowerY, upperY - 0.014, v)
        const baseR = THREE.MathUtils.lerp(lowerR - 0.018, upperR - 0.018, v)
        const r = Math.max(isRoof ? 0.388 : 1.244, baseR)
        positions.push(st * r, y, ct * r)
        colors.push(0.84, 0.82, 0.79)
        uvs.push(u * uScale, v)
      }

      if (i < SHELL_COLS) {
        const base = i * RING_VERTS
        for (let j = 0; j < RING_VERTS; j++) {
          const k = base + j
          const next = base + ((j + 1) % RING_VERTS)
          // Outward winding: (+theta) x (+j) points radially outward on outer face, upward on top rim, inward on inner cavity.
          indices.push(k, k + RING_VERTS, next, next, k + RING_VERTS, next + RING_VERTS)
        }
      }
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    const mesh = add(name, geometry, felt)
    mesh.userData.toonSurface = { outline: isRoof }
    return mesh
  }

  const wallCloth = buildFeltShell('ger-wall-felt', 1.271, 1.271, .052, 1.195, .305, Math.PI * 2 - .61, false)
  const roofCloth = buildFeltShell('ger-roof-felt', 1.337, .409, 1.19, 1.953, 0, Math.PI * 2, true)

  // Step-2 layered wool-felt roll perched atop the toono crown, with recessed spiral ends and twin wool tie straps.
  const feltRoll = add('ger-felt-roll', buildFeltRollGeometry(), rollFelt, [0, 2.13, .08])
  for (const side of [-1, 1]) {
    const spiralPts: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) {
      const t = i / 96, angle = t * Math.PI * 6.2, r = .014 + .104 * t
      spiralPts.push(new THREE.Vector3(side * .3975, Math.sin(angle) * r, Math.cos(angle) * r))
    }
    const spiral = new THREE.Mesh(
      new THREE.TubeGeometry(new THREE.CatmullRomCurve3(spiralPts), 96, .0042, 6, false),
      spiralShadowMat,
    )
    spiral.name = `ger-felt-roll-end-${side}`
    spiral.castShadow = spiral.receiveShadow = true
    spiral.userData.toonSurface = { outline: false }
    feltRoll.add(spiral)

    // Twin 3-ply twisted wool tie straps seated snugly in the x = +/- 0.21 roll grooves (clear of center [0, 0.06, 0.10] cue).
    const strapX = side * 0.21
    const strapPts: THREE.Vector3[] = []
    for (let i = 0; i < 40; i++) {
      const a = (i / 40) * Math.PI * 2
      strapPts.push(new THREE.Vector3(strapX, Math.sin(a) * 0.1205, Math.cos(a) * 0.1205))
    }
    const strapRing = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(strapPts, true), 48, 8, 0.0072, 12, 3, 0.15, true, false)
    // Compact seated tie knot on the upper-front face of each strap (max r <= 0.128 < 0.130).
    const knotPts = [
      new THREE.Vector3(strapX - 0.011, 0.056, 0.100),
      new THREE.Vector3(strapX - 0.004, 0.064, 0.100),
      new THREE.Vector3(strapX + 0.007, 0.061, 0.102),
      new THREE.Vector3(strapX + 0.014, 0.052, 0.104),
    ]
    const knotArc = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(knotPts), 16, 6, 0.0062, 4, 2, 0.14, false, true)
    const strapMesh = add(`ger-felt-roll-strap-${side}`, mergeGeometries([strapRing, knotArc]), ropeMat, [0, 0, 0], feltRoll)
    strapMesh.userData.toonSurface = { outline: false }
  }

  // Structural binding ropes (büslüür girth bands + oosor roof cords + woven eave trim + toono collar cord).
  const ropes = new THREE.Group(); ropes.name = 'ger-binding-ropes'; subject.add(ropes)

  for (const y of [.42, .97]) {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 112; i++) {
      const t = .298 + (i / 112) * (Math.PI * 2 - .596)
      points.push(new THREE.Vector3(Math.sin(t) * 1.286, y, Math.cos(t) * 1.286))
    }
    const beltCurve = new THREE.CatmullRomCurve3(points)
    const beltGeom = buildTwistedCordGeometry(beltCurve, 144, 10, 0.0152, 38, 3, 0.15, false, true)
    const line = add(`ger-tension-rope-${y}`, beltGeom, ropeMat, [0, 0, 0], ropes)
    line.userData.toonSurface = { outline: false }

    // Compact knotted door-post fastening hitches seated neatly against the left and right door posts.
    for (const side of [-1, 1] as const) {
      const postX = side * 0.378
      const postZ = 1.224
      const loopPts: THREE.Vector3[] = []
      for (let s = 0; s <= 18; s++) {
        const a = (s / 18) * Math.PI * 2
        loopPts.push(new THREE.Vector3(
          postX + side * 0.008 * Math.cos(a),
          y + 0.022 * Math.sin(a),
          postZ + 0.016 * Math.cos(a),
        ))
      }
      const hitchLoop = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(loopPts, true), 24, 8, 0.0098, 6, 3, 0.14, true, false)
      const tailPts = [
        new THREE.Vector3(postX + side * 0.008, y - 0.010, postZ + 0.012),
        new THREE.Vector3(postX + side * 0.014, y - 0.036, postZ + 0.008),
        new THREE.Vector3(postX + side * 0.012, y - 0.062, postZ + 0.002),
      ]
      const tailEnd = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(tailPts), 12, 6, 0.0082, 4, 2, 0.14, false, true)
      const hitch = add(`ger-belt-tie-${side > 0 ? 'right' : 'left'}-${y}`, mergeGeometries([hitchLoop, tailEnd]), ropeMat, [0, 0, 0], ropes)
      hitch.userData.toonSurface = { outline: false }
    }
  }

  // Thickened beveled woven blue eave trim band sealing the roof-to-wall felt overlap.
  const eave = add('ger-eave-band', buildEaveTrimGeometry(96), eaveMat, [0, 1.19, 0], ropes)
  eave.userData.toonSurface = { outline: false }

  // Braided wool collar cord cinching the top roof-felt border cleanly below the red toono rim.
  const crownRimPts: THREE.Vector3[] = []
  for (let i = 0; i < 64; i++) {
    const theta = (i / 64) * Math.PI * 2
    crownRimPts.push(new THREE.Vector3(Math.sin(theta) * 0.415, 1.946, Math.cos(theta) * 0.415))
  }
  const crownRimCord = add(
    'ger-crown-rim-cord',
    buildTwistedCordGeometry(new THREE.CatmullRomCurve3(crownRimPts, true), 96, 8, 0.0095, 24, 3, 0.15, true, false),
    ropeMat,
    [0, 0, 0],
    ropes,
  )
  crownRimCord.userData.toonSurface = { outline: false }

  // Three radial 3-ply twisted roof cords with crown lashing collars and eave hitch loops.
  for (const [tieIdx, angle] of roofTieAngles.entries()) {
    const sa = Math.sin(angle), ca = Math.cos(angle)
    const tx = ca, tz = -sa
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 32; i++) {
      const t = i / 32
      const r = 0.412 + 0.928 * t
      const y = 1.958 - 0.748 * t
      points.push(new THREE.Vector3(sa * r, y, ca * r))
    }
    const cordGeom = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(points), 48, 8, 0.0132, 18, 3, 0.15, false, true)

    // Crown lashing wrap hugging over the red toono rim where the roof tie anchors.
    const crownLoopPts: THREE.Vector3[] = []
    for (let s = 0; s <= 18; s++) {
      const a = (s / 18) * Math.PI * 2
      const lr = 0.36 + 0.054 * Math.cos(a)
      const ly = 1.938 + 0.028 * Math.sin(a)
      const lt = 0.009 * Math.sin(a)
      crownLoopPts.push(new THREE.Vector3(sa * lr + tx * lt, ly, ca * lr + tz * lt))
    }
    const crownLash = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(crownLoopPts, true), 24, 6, 0.0086, 6, 3, 0.14, true, false)

    // Eave tie-down hitch seated cleanly onto the blue eave trim band (max r <= 1.351).
    const eaveLoopPts = [
      new THREE.Vector3(sa * 1.338 - tx * 0.022, 1.216, ca * 1.338 - tz * 0.022),
      new THREE.Vector3(sa * 1.343, 1.198, ca * 1.343),
      new THREE.Vector3(sa * 1.338 + tx * 0.022, 1.216, ca * 1.338 + tz * 0.022),
      new THREE.Vector3(sa * 1.342, 1.178, ca * 1.342),
    ]
    const eaveHitch = buildTwistedCordGeometry(new THREE.CatmullRomCurve3(eaveLoopPts, true), 20, 6, 0.0076, 6, 2, 0.14, true, false)

    const roofTie = add(`ger-roof-tie-${angle}`, mergeGeometries([cordGeom, crownLash, eaveHitch]), ropeMat, [0, 0, 0], ropes)
    roofTie.userData.toonSurface = { outline: false }
    void tieIdx
  }

  const dropZones = new THREE.Group(); dropZones.name = 'ger-drop-zones'; subject.add(dropZones)
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0xe9ae49, transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide })
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xf7c96c, transparent: true, opacity: .8, depthWrite: false })
  const latticeDrop = add('ger-lattice-drop', new THREE.CylinderGeometry(.095, .095, .40, 16), guideMaterial, [.8, .66, .946], dropZones)
  const crownDrop = add('ger-crown-drop', new THREE.TorusGeometry(.36, .016, 8, 64).rotateX(Math.PI / 2), outlineMaterial, [0, 1.94, 0], dropZones)
  const feltDrop = new THREE.Group(); feltDrop.name = 'ger-felt-drop'; dropZones.add(feltDrop)
  for (const shellMesh of [roofCloth, wallCloth]) {
    const guide = add(`${shellMesh.name}-drop`, shellMesh.geometry.clone(), guideMaterial, [0, 0, 0], feltDrop)
    guide.castShadow = guide.receiveShadow = false
    guide.userData.toonSurface = { outline: false }
  }
  latticeDrop.userData.toonSurface = crownDrop.userData.toonSurface = { outline: false }
  latticeDrop.castShadow = latticeDrop.receiveShadow = crownDrop.castShadow = crownDrop.receiveShadow = false
  const placements = [
    { object: latticeDrop, anchor: [0, .06, .042] as XYZ },
    { object: crownDrop, anchor: [0, .045, .355] as XYZ },
    { object: feltDrop, anchor: [.65, 1.45, .78] as XYZ },
  ]
  let lastExpand = -1
  function pose(expand: number, lift: number, cover: number, checkpoint: number, held?: THREE.Vector3) {
    if (expand !== lastExpand) {
      lastExpand = expand
      const sx = .45 + .55 * expand, sz = .77 + .23 * expand
      for (const { mesh, start, end, reverse } of slats) between(mesh,
        [Math.sin(start) * 1.24 * sx, reverse ? 1.15 : .055, Math.cos(start) * 1.24 * sz],
        [Math.sin(end) * 1.24 * sx, reverse ? .055 : 1.15, Math.cos(end) * 1.24 * sz], .018)
    }
    latticeGrip.position.set(.80 * (.45 + .55 * expand), .66, .946 * (.77 + .23 * expand))
    if (checkpoint === 0 && held) latticeGrip.position.copy(held)
    latticeGrip.visible = checkpoint === 0
    roof.visible = checkpoint >= 1
    crown.position.set(0, 1.22 + .72 * lift, 0)
    if (checkpoint === 1 && held) crown.position.copy(held)
    const { x: cx, y: height, z: cz } = crown.position
    for (const { angle, mesh } of rafters) between(mesh, [cx + Math.sin(angle) * .36, height, cz + Math.cos(angle) * .36], [Math.sin(angle) * 1.235, 1.15, Math.cos(angle) * 1.235], .022)
    for (const { side, mesh } of columns) between(mesh, [side * .28, .045, .22], [cx + side * .28, height - .02, cz + .22], .033)
    for (const { x, mesh } of crownBars) between(mesh, [cx + x, height, cz - .338], [cx + x, height, cz + .338], .017)
    wallCloth.visible = roofCloth.visible = cover > 0
    const drawCount = Math.floor(cover * SHELL_COLS) * INDICES_PER_COL
    wallCloth.geometry.setDrawRange(0, drawCount)
    roofCloth.geometry.setDrawRange(0, drawCount)
    ropes.visible = cover >= 1
    feltRoll.position.set(0, 2.13, .08)
    if (checkpoint === 2 && held) feltRoll.position.copy(held)
    feltRoll.visible = checkpoint === 2 && (!!held || cover < 1)
    feltRoll.scale.set(1, Math.max(.04, 1 - cover), Math.max(.04, 1 - cover))
    placements.forEach(({ object }, i) => { object.visible = checkpoint === i })
  }
  pose(0, 0, 0, 0)
  // Materials share owned procedural maps; disposeTree deliberately does not own textures.
  const highlightDrop = (ready: boolean) => {
    guideMaterial.color.set(ready ? 0x54ba8b : 0xe9ae49)
    outlineMaterial.color.set(ready ? 0x68d3a2 : 0xf7c96c)
  }
  let texturesDisposed = false
  const disposeTexture = () => {
    if (texturesDisposed) return
    texturesDisposed = true
    for (const tex of ownedTextures) tex.dispose()
  }
  return { subject, pose, placements, highlightDrop, disposeTexture, targets: [latticeGrip, crown, feltRoll], anchors: [[0, .06, .042], [0, .045, .355], [0, .06, .10]] as XYZ[] }
}
