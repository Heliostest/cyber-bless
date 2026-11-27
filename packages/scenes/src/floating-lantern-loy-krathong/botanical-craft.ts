import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/**
 * Builds a watertight closed thin-shell (`FrontSide`) from a parametric grid `(u, v) ∈ [0,1]^2`.
 * Every undirected edge has exact manifold valence 2 and positive signed volume.
 */
function buildWatertightShell(
  segU: number,
  segV: number,
  sample: (u: number, v: number, outPos: THREE.Vector3) => number,
): THREE.BufferGeometry {
  const cols = segU + 1
  const rows = segV + 1
  const layerCount = cols * rows
  const midPos: THREE.Vector3[] = new Array(layerCount)
  const thickness = new Float32Array(layerCount)

  for (let iv = 0; iv < rows; iv++) {
    const v = iv / segV
    for (let iu = 0; iu < cols; iu++) {
      const u = iu / segU
      const p = new THREE.Vector3()
      const t = sample(u, v, p)
      const idx = iv * cols + iu
      midPos[idx] = p
      thickness[idx] = Math.max(0.0018, t)
    }
  }

  // Estimate smooth outward surface normal (+side) at each grid sample via finite differences.
  const duVec = new THREE.Vector3()
  const dvVec = new THREE.Vector3()
  const normals: THREE.Vector3[] = new Array(layerCount)
  for (let iv = 0; iv < rows; iv++) {
    for (let iu = 0; iu < cols; iu++) {
      const iL = iv * cols + Math.max(0, iu - 1)
      const iR = iv * cols + Math.min(segU, iu + 1)
      const iD = Math.max(0, iv - 1) * cols + iu
      const iU = Math.min(segV, iv + 1) * cols + iu
      duVec.subVectors(midPos[iR]!, midPos[iL]!)
      dvVec.subVectors(midPos[iU]!, midPos[iD]!)
      const n = new THREE.Vector3().crossVectors(duVec, dvVec)
      if (n.lengthSq() < 1e-12) n.set(0, 1, 0)
      else n.normalize()
      normals[iv * cols + iu] = n
    }
  }

  const totalVerts = layerCount * 2
  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices: number[] = []

  for (let iv = 0; iv < rows; iv++) {
    const v = iv / segV
    for (let iu = 0; iu < cols; iu++) {
      const u = iu / segU
      const idx = iv * cols + iu
      const p = midPos[idx]!
      const n = normals[idx]!
      const halfT = thickness[idx]! * 0.5

      const top = idx
      const bot = layerCount + idx
      positions[top * 3] = p.x + n.x * halfT
      positions[top * 3 + 1] = p.y + n.y * halfT
      positions[top * 3 + 2] = p.z + n.z * halfT
      uvs[top * 2] = u
      uvs[top * 2 + 1] = v

      positions[bot * 3] = p.x - n.x * halfT
      positions[bot * 3 + 1] = p.y - n.y * halfT
      positions[bot * 3 + 2] = p.z - n.z * halfT
      uvs[bot * 2] = u
      uvs[bot * 2 + 1] = v
    }
  }

  // Top (+N) and bottom (-N) surface faces.
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = iv * cols + iu
      const b = a + 1
      const c = a + cols
      const d = c + 1
      indices.push(a, b, d, a, d, c)

      const A = layerCount + a
      const B = layerCount + b
      const C = layerCount + c
      const D = layerCount + d
      indices.push(A, D, B, A, C, D)
    }
  }

  // Closed perimeter rim strips (opposite half-edges ensure watertight manifold closure).
  for (let iu = 0; iu < segU; iu++) {
    const a = iu, b = iu + 1, A = layerCount + a, B = layerCount + b
    indices.push(b, a, A, b, A, B)
  }
  for (let iv = 0; iv < segV; iv++) {
    const b = iv * cols + segU, d = (iv + 1) * cols + segU
    const B = layerCount + b, D = layerCount + d
    indices.push(d, b, B, d, B, D)
  }
  for (let iu = 0; iu < segU; iu++) {
    const c = segV * cols + iu, d = c + 1, C = layerCount + c, D = layerCount + d
    indices.push(c, d, D, c, D, C)
  }
  for (let iv = 0; iv < segV; iv++) {
    const a = iv * cols, c = (iv + 1) * cols, A = layerCount + a, C = layerCount + c
    indices.push(a, c, C, a, C, A)
  }

  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geo.setIndex(indices)
  geo.computeVertexNormals()
  return geo
}

/**
 * Watertight folded Thai banana-leaf (Bai Tong) corner matching the original boat
 * silhouette (`x ∈ [-.15, .15]`, `y ∈ [0, .32]`, `z ∈ [-.11, .16]`), with a supple
 * raised central midrib fold ridge, softly bowed flanks, and clean `(u, v)` coordinates
 * (`u = 0.5` along the central fold, `v = 0..1` base to tip).
 */
export function createFoldedBananaLeafGeometry(): THREE.BufferGeometry {
  return buildWatertightShell(4, 3, (u, v, out) => {
    const s = u * 2 - 1 // -1 (left) .. 0 (midrib fold ridge) .. +1 (right)
    const absS = Math.abs(s)

    // Base contour matches the original 4-corner krathong pleat envelope.
    const x0 = s * 0.15
    const y0 = THREE.MathUtils.lerp(0.09, 0.01, absS) + 0.008 * Math.sin(absS * Math.PI)
    const z0 = THREE.MathUtils.lerp(0.16, -0.11, absS) + 0.014 * Math.sin(absS * Math.PI)

    // Keep apex tip non-degenerate (small finite width) while reading crisp and pointed.
    const x1 = s * 0.0055
    const y1 = 0.32
    const z1 = 0.07 - absS * 0.004

    const widthTaper = Math.pow(v, 0.94)
    const x = THREE.MathUtils.lerp(x0, x1, widthTaper)
    const y = THREE.MathUtils.lerp(y0, y1, v)
    const midribRidge = 0.0068 * Math.sin(v * Math.PI) * Math.exp(-s * s * 6.0)
    const flankCup = -0.0045 * Math.sin(absS * Math.PI) * Math.sin(v * Math.PI)
    const z = THREE.MathUtils.lerp(z0, z1, v) + midribRidge + flankCup

    out.set(x, y, z)
    // Folded banana leaf is slightly thicker near the tucked base and crisp near the tip.
    return 0.011 * (1 - 0.62 * v) * (0.68 + 0.32 * (1 - absS))
  })
}

export type KrathongPetalOptions = {
  length: number
  maxWidth: number
  cupDepth: number
  lift: number
  tipCurl: number
  thickness: number
}

/**
 * Watertight cupped lotus/water-lily petal extending along `+Z` (tip) with width along `X`
 * and upward cup/lift along `+Y`, strictly `FrontSide` closed manifold.
 */
export function createKrathongPetalGeometry(opts: KrathongPetalOptions): THREE.BufferGeometry {
  const { length, maxWidth, cupDepth, lift, tipCurl, thickness } = opts
  // Parameterize so (dP/du) x (dP/dv) points +Y (upward inner cup face):
  // u = 0..1 maps x from +halfW to -halfW (-X), v = 0..1 maps z from 0 to +length (+Z),
  // so (-X) x (+Z) = +Y.
  return buildWatertightShell(8, 8, (u, v, out) => {
    const s = 1 - u * 2 // +1 .. -1
    const absS = Math.abs(s)
    // Soft plump spoon-cupped lotus petal: narrow warm throat -> broad rounded belly -> gentle soft point.
    const belly = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.68)), 0.64)
    const widthFactor = Math.max(0.10, 0.28 * (1 - v) * (1 - v) + belly * 0.98)
    const halfW = maxWidth * 0.5 * widthFactor
    const x = s * halfW

    const z = v * length
    const vSin = Math.sin(v * Math.PI)
    // Concave spoon-cupped hollow across width + graceful upward blossom lift + delicate outward tip curl.
    const cupY = cupDepth * Math.pow(absS, 1.75) * (0.38 + 0.62 * vSin)
    const bowlY = lift * Math.pow(v, 1.32)
    const tipPhase = Math.max(0, (v - 0.64) / 0.36)
    const curlY = -tipCurl * tipPhase * tipPhase
    const midGroove = -0.0028 * Math.exp(-s * s * 9) * vSin
    const y = cupY + bowlY + curlY + midGroove

    out.set(x, y, z)
    return thickness * (0.40 + 0.60 * (1 - absS * 0.50) * (1 - v * 0.46))
  })
}

/**
 * Merges an array of indexed BufferGeometries sharing `position`, `normal`, and `uv`
 * into one single watertight `BufferGeometry` so raycasting and disposal treat the
 * organic blossom heart as one coherent `krathong-flower-source`.
 */
function mergeIndexedGeometries(parts: THREE.BufferGeometry[]): THREE.BufferGeometry {
  let totalVerts = 0
  let totalIndices = 0
  for (const part of parts) {
    totalVerts += part.getAttribute('position').count
    totalIndices += part.getIndex()!.count
  }

  const positions = new Float32Array(totalVerts * 3)
  const normals = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices = new Uint32Array(totalIndices)

  let vOff = 0
  let iOff = 0
  for (const part of parts) {
    const pos = part.getAttribute('position')
    const nrm = part.getAttribute('normal')
    const uv = part.getAttribute('uv')
    const idx = part.getIndex()!

    positions.set(pos.array as ArrayLike<number>, vOff * 3)
    normals.set(nrm.array as ArrayLike<number>, vOff * 3)
    uvs.set(uv.array as ArrayLike<number>, vOff * 2)
    for (let k = 0; k < idx.count; k++) {
      indices[iOff + k] = idx.getX(k) + vOff
    }
    vOff += pos.count
    iOff += idx.count
    part.dispose()
  }

  const merged = new THREE.BufferGeometry()
  merged.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  merged.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
  merged.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  merged.setIndex(new THREE.BufferAttribute(indices, 1))
  return merged
}

/**
 * Sculpted, organic lotus/marigold blossom heart replacing the oversized smooth sphere:
 * a low quilted amber-gold central receptacle encircled by a scalloped crown of 14
 * golden stamen tips. Spans `r ≈ 0.066` in XZ (preserving off-center drag pick hits at
 * `[-0.06, 0, 0]`) while keeping a low organic profile (`y ∈ [-0.024, +0.027]`).
 */
export function createOrganicFlowerHeartGeometry(): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = []

  // Low quilted scalloped receptacle pad + golden stamen collar (single closed watertight solid).
  const pad = new THREE.SphereGeometry(1, 24, 14)
  const pos = pad.getAttribute('position')
  const uv = pad.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const nx = pos.getX(i)
    const ny = pos.getY(i)
    const nz = pos.getZ(i)
    const ang = Math.atan2(nz, nx)
    const radial = Math.hypot(nx, nz)
    // Lower rim flares gently to r = 0.066 (stamen ring base); top flattens into a quilted dome.
    const collarFlare = Math.exp(-Math.pow((ny + 0.08) / 0.55, 2))
    const scallop = 1 + 0.055 * Math.cos(ang * 14) * collarFlare
    const r = (0.044 + 0.023 * collarFlare) * scallop
    const quilt = ny > 0.15 ? 0.0028 * Math.cos(radial * 16.0) * Math.cos(ang * 7) * (1 - radial * 0.5) : 0
    const y = ny >= 0 ? Math.pow(ny, 0.78) * 0.021 + quilt : ny * 0.024
    pos.setXYZ(i, nx * r, y, nz * r)
    // Store radial distance from center in uv.x (0 = center, 1 = outer stamen margin)
    // and normalized height in uv.y for organic pollen-to-receptacle shading.
    uv.setXY(i, THREE.MathUtils.clamp((radial * r) / 0.067, 0, 1), THREE.MathUtils.clamp((y + 0.024) / 0.05, 0, 1))
  }
  pad.computeVertexNormals()
  parts.push(pad)

  // Ring of 14 plump golden stamen tips rising gently around the central cushion.
  const stamenCount = 14
  for (let i = 0; i < stamenCount; i++) {
    const a = (i / stamenCount) * Math.PI * 2 + 0.12
    const stamen = new THREE.SphereGeometry(1, 8, 6)
    stamen.scale(0.0085, 0.0145, 0.0085)
    stamen.rotateZ(0.32 * Math.sin(a))
    stamen.rotateX(-0.32 * Math.cos(a))
    const r = 0.050 + (i % 2) * 0.005
    stamen.translate(Math.cos(a) * r, 0.011 + (i % 2) * 0.003, Math.sin(a) * r)
    const sUv = stamen.getAttribute('uv')
    for (let k = 0; k < sUv.count; k++) {
      // Mark stamen tips at high uv.x and uv.y so they catch brighter sunlit pollen warmth.
      sUv.setXY(k, 0.88, 0.92)
    }
    stamen.computeVertexNormals()
    parts.push(stamen)
  }

  return mergeIndexedGeometries(parts)
}

export type BananaLeafVariant = 'fold-0' | 'fold-1' | 'fold-2' | 'base' | 'liner' | 'binding'

type BananaPalette = {
  baseHex: number
  deepHex: number
  ridgeHex: number
  tipHex: number
  roughness: number
  mode: 'fold' | 'base' | 'liner' | 'binding'
  seed: number
}

const BANANA_PALETTES: Record<BananaLeafVariant, BananaPalette> = {
  'fold-0': {
    baseHex: 0x62945e,
    deepHex: 0x457146,
    ridgeHex: 0xaac474,
    tipHex: 0x8bb46a,
    roughness: 0.52,
    mode: 'fold',
    seed: 1.1,
  },
  'fold-1': {
    baseHex: 0x76a468,
    deepHex: 0x52804e,
    ridgeHex: 0xbcd07f,
    tipHex: 0x9ac175,
    roughness: 0.51,
    mode: 'fold',
    seed: 2.7,
  },
  'fold-2': {
    baseHex: 0x84ae6e,
    deepHex: 0x5d8954,
    ridgeHex: 0xc5d687,
    tipHex: 0xa6c97d,
    roughness: 0.53,
    mode: 'fold',
    seed: 4.3,
  },
  base: {
    baseHex: 0x5d8b59,
    deepHex: 0x416842,
    ridgeHex: 0x91b369,
    tipHex: 0x749f62,
    roughness: 0.56,
    mode: 'base',
    seed: 5.9,
  },
  liner: {
    baseHex: 0x8cb373,
    deepHex: 0x699259,
    ridgeHex: 0xc2d588,
    tipHex: 0xa7c77e,
    roughness: 0.55,
    mode: 'liner',
    seed: 7.4,
  },
  binding: {
    baseHex: 0x97bb79,
    deepHex: 0x70995d,
    ridgeHex: 0xcada8f,
    tipHex: 0xafd084,
    roughness: 0.52,
    mode: 'binding',
    seed: 8.8,
  },
}

const LEAF_VARYINGS = /* glsl */ `
varying vec3 kLeafPos;
varying vec2 kLeafUv;
`

const LEAF_HEADER = /* glsl */ `
uniform vec3 kLeafDeepColor;
uniform vec3 kLeafRidgeColor;
uniform vec3 kLeafTipColor;
uniform float kLeafMode;
uniform float kLeafSeed;

float kHash(vec2 p) {
  p = fract(p * vec2(123.34, 456.21));
  p += dot(p, p + 45.32);
  return fract(p.x * p.y);
}
float kNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(kHash(i), kHash(i + vec2(1.0, 0.0)), f.x),
             mix(kHash(i + vec2(0.0, 1.0)), kHash(i + vec2(1.0, 1.0)), f.x), f.y);
}
float kAaWave(float phase) {
  float fw = fwidth(phase);
  return sin(phase) * exp(-0.45 * fw * fw);
}
vec3 kReliefNormal(vec3 baseN, vec3 viewPos, float h, float vis) {
  vec3 dx = dFdx(viewPos), dy = dFdy(viewPos);
  vec2 hg = vec2(dFdx(h), dFdy(h));
  vec3 ax = cross(dy, baseN), ay = cross(baseN, dx);
  float det = dot(dx, ax);
  if (abs(det) < 1e-10) return baseN;
  vec3 grad = sign(det) * (hg.x * ax + hg.y * ay);
  return normalize(abs(det) * baseN - grad * vis);
}
`

function attachBananaLeafShader(material: THREE.MeshStandardMaterial, variant: BananaLeafVariant): void {
  const p = BANANA_PALETTES[variant]
  const modeVal = p.mode === 'fold' ? 0 : p.mode === 'base' ? 1 : p.mode === 'liner' ? 2 : 3
  const previousCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()

  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_KRATHONG_BANANA_V1')) return

    shader.uniforms.kLeafDeepColor = { value: new THREE.Color(p.deepHex) }
    shader.uniforms.kLeafRidgeColor = { value: new THREE.Color(p.ridgeHex) }
    shader.uniforms.kLeafTipColor = { value: new THREE.Color(p.tipHex) }
    shader.uniforms.kLeafMode = { value: modeVal }
    shader.uniforms.kLeafSeed = { value: p.seed }

    shader.vertexShader = LEAF_VARYINGS + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      kLeafPos = transformed;
      kLeafUv = uv;
      `,
    )

    shader.fragmentShader =
      '#define WBR_KRATHONG_BANANA_V1\n' + LEAF_VARYINGS + LEAF_HEADER + shader.fragmentShader

    // Warm yellow-green translucency concentrated on the folded midrib ridge & pointed tip,
    // plus soft Komorebi wrap so shaded inner folds stay lush fresh green instead of muddy grey.
    const physicalLights = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float kFoldCenter = kLeafMode < 0.5 ? exp(-pow((kLeafUv.x - 0.5) / 0.24, 2.0)) : 0.25;
        float kTipThin = kLeafMode < 0.5 ? smoothstep(0.35, 1.0, kLeafUv.y) : 0.15;
        float kTransZone = clamp(0.28 + kFoldCenter * 0.55 + kTipThin * 0.35, 0.0, 1.0);
        float kRawNL = dot(geometryNormal, directLight.direction);
        float kWrap = clamp((kRawNL + 0.42) / 1.42, 0.0, 1.0);
        float kWrapExtra = max(0.0, kWrap - dotNL);
        float kBack = max(0.0, -kRawNL);
        vec3 kThrough = normalize(directLight.direction + geometryNormal * 0.20);
        float kForward = pow(max(0.0, dot(geometryViewDir, -kThrough)), 2.8);
        float kSubsurf = (kWrapExtra * 0.36 + kBack * (0.55 + 0.45 * kForward) * 0.32) * kTransZone;
        vec3 kWarmGreen = vec3(1.16, 1.24, 0.56);
        reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor)
          + kSubsurf * directLight.color * BRDF_Lambert(material.diffuseColor * kWarmGreen);
        `,
      )
      .replace(
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float kIrrL = dot(irradiance, vec3(0.299, 0.587, 0.114));
        vec3 kWarmBounce = mix(irradiance, vec3(kIrrL) * vec3(0.98, 1.06, 0.80), 0.34) * 1.06;
        reflectedLight.indirectDiffuse += kWarmBounce * BRDF_Lambert(material.diffuseColor);
        `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', physicalLights)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        float kVeinShade = 0.0;
        float kRidgeGlow = 0.0;
        if (kLeafMode < 0.5) {
          // Folded Bai Tong leaf corner: clear oblique parallel lateral veins radiating from the central fold ridge.
          float kAcross = abs(kLeafUv.x - 0.5) * 2.0; // 0 at midrib fold, 1 at tucked margin
          float kV = kLeafUv.y;
          float kMidrib = exp(-pow(kAcross / 0.16, 2.0));
          float kVeinCoord = kV * 36.0 - kAcross * 22.0 + kLeafSeed * 1.7;
          float kPrimaryVein = kAaWave(kVeinCoord);
          float kFineVein = kAaWave(kVeinCoord * 2.15 + 1.1) * 0.34;
          kVeinShade = kPrimaryVein * 0.68 + kFineVein;
          float kMottle = (kNoise(vec2(kLeafUv.x * 5.0 + kLeafSeed, kV * 6.0)) - 0.5) * 0.14;
          float kBaseShade = (1.0 - smoothstep(0.0, 0.36, kV)) * 0.44 + smoothstep(0.68, 1.0, kAcross) * 0.32;
          kRidgeGlow = kMidrib * (0.48 + 0.52 * sin(kV * 3.14159));

          vec3 kCol = mix(diffuseColor.rgb, kLeafTipColor, smoothstep(0.45, 1.0, kV) * 0.55);
          kCol = mix(kCol, kLeafDeepColor, clamp(kBaseShade, 0.0, 0.72));
          kCol = mix(kCol, kLeafRidgeColor, clamp(kRidgeGlow * 0.56, 0.0, 0.62));
          kCol *= 1.0 + kVeinShade * 0.115 + kMottle;
          diffuseColor.rgb = kCol;
        } else if (kLeafMode < 1.5) {
          // Wrapped banana-leaf cylinder base: crisp parallel leaf fibers + subtle vertical seam shade.
          float kAng = atan(kLeafPos.z, kLeafPos.x);
          float kVeins = kAaWave(kLeafPos.y * 135.0 + sin(kAng * 4.0) * 0.6) * 0.60
                       + kAaWave(kAng * 32.0) * 0.24;
          kVeinShade = kVeins;
          float kBottom = 1.0 - smoothstep(-0.052, 0.03, kLeafPos.y);
          vec3 kCol = mix(diffuseColor.rgb, kLeafDeepColor, kBottom * 0.42);
          kCol *= 1.0 + kVeins * 0.075;
          diffuseColor.rgb = kCol;
        } else if (kLeafMode < 2.5) {
          // Flat banana-leaf inner liner pad: parallel veins sweeping across the circular deck.
          float kVeins = kAaWave(kLeafPos.x * 96.0 + kLeafPos.z * 16.0) * 0.64
                       + kAaWave(kLeafPos.x * 204.0 + kLeafPos.z * 34.0) * 0.24;
          float kMid = exp(-pow(kLeafPos.z / 0.038, 2.0));
          float kEdge = smoothstep(0.20, 0.31, length(kLeafPos.xz));
          kVeinShade = kVeins;
          kRidgeGlow = kMid;
          vec3 kCol = mix(diffuseColor.rgb, kLeafRidgeColor, kMid * 0.38);
          kCol = mix(kCol, kLeafDeepColor, kEdge * 0.36);
          kCol *= 1.0 + kVeins * 0.085;
          diffuseColor.rgb = kCol;
        } else {
          // Front leaf binding strip.
          float kVeins = kAaWave(kLeafPos.y * 130.0 + kLeafPos.x * 18.0);
          kVeinShade = kVeins;
          diffuseColor.rgb = mix(diffuseColor.rgb, kLeafRidgeColor, 0.24) * (1.0 + kVeins * 0.065);
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        // Fresh Bai Tong satin wax: slightly sleeker along veins & folded midrib crest.
        roughnessFactor = clamp(roughnessFactor - kVeinShade * 0.075 - kRidgeGlow * 0.065, 0.36, 0.78);
        `,
      )
      .replace(
        '#include <normal_fragment_maps>',
        /* glsl */ `
        #include <normal_fragment_maps>
        float kRawPhase = kLeafMode < 0.5
          ? (kLeafUv.y * 36.0 - abs(kLeafUv.x - 0.5) * 44.0 + kLeafSeed * 1.7)
          : kLeafMode < 1.5
            ? (kLeafPos.y * 135.0)
            : (kLeafPos.x * 96.0 + kLeafPos.z * 16.0);
        float kFw = fwidth(kRawPhase);
        float kVis = exp(-0.50 * kFw * kFw);
        float kHeight = (sin(kRawPhase) * 0.74 + sin(kRawPhase * 2.15 + 1.1) * 0.24) * 0.00075;
        normal = kReliefNormal(normal, -vViewPosition, kHeight, kVis);
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        vec3 kLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float kPeak = max(kLit.r, max(kLit.g, kLit.b));
        if (kPeak > 0.74) {
          float kExcess = kPeak - 0.74;
          float kTarget = 0.74 + 0.24 * (kExcess / (kExcess + 0.24));
          outgoingLight = kLit * (kTarget / kPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
        `,
      )
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-krathong-banana-v1:${variant}`
  material.clone = function (this: THREE.MeshStandardMaterial) {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    attachBananaLeafShader(cloned, variant)
    return cloned
  }
  material.needsUpdate = true
}

/**
 * Textureless, single-pass satin-waxy fresh banana-leaf (Bai Tong) material with
 * parallel venation, midrib fold translucency, and C1 highlight shoulder.
 */
export function createBananaLeafMaterial(variant: BananaLeafVariant): THREE.MeshStandardMaterial {
  const p = BANANA_PALETTES[variant]
  const mat = createRitualMaterial(
    {
      color: p.baseHex,
      roughness: p.roughness,
      metalness: 0,
      envMapIntensity: 0.45,
      side: THREE.FrontSide,
    },
    { kind: 'leaf', strength: 0.20 },
  )
  attachBananaLeafShader(mat, variant)
  return mat
}

export type KrathongFlowerVariant = 'outer' | 'inner' | 'heart'

type FlowerPalette = {
  baseHex: number
  throatHex: number
  bodyHex: number
  tipHex: number
  scatterTint: readonly [number, number, number]
  roughness: number
}

const FLOWER_PALETTES: Record<KrathongFlowerVariant, FlowerPalette> = {
  outer: {
    baseHex: 0xf7ebd2,
    throatHex: 0xe3a845,
    bodyHex: 0xf8edd7,
    tipHex: 0xfff8ea,
    scatterTint: [1.09, 0.99, 0.82],
    roughness: 0.82,
  },
  inner: {
    baseHex: 0xf4d692,
    throatHex: 0xd28430,
    bodyHex: 0xf4d48c,
    tipHex: 0xfcf0d0,
    scatterTint: [1.11, 0.96, 0.78],
    roughness: 0.80,
  },
  heart: {
    baseHex: 0xd99238,
    throatHex: 0xa65b1e,
    bodyHex: 0xdc9338,
    tipHex: 0xf8ce6a,
    scatterTint: [1.12, 0.95, 0.72],
    roughness: 0.78,
  },
}

const PETAL_VARYINGS = /* glsl */ `
varying vec2 kPetalUv;
varying vec3 kPetalPos;
`

const PETAL_HEADER = /* glsl */ `
uniform vec3 kPetalThroat;
uniform vec3 kPetalBody;
uniform vec3 kPetalTip;
uniform vec3 kPetalScatter;
uniform float kPetalIsHeart;
float kPetalWave(float phase) {
  float fw = fwidth(phase);
  return sin(phase) * exp(-0.45 * fw * fw);
}
`

function attachKrathongFlowerShader(material: THREE.MeshStandardMaterial, variant: KrathongFlowerVariant): void {
  const pal = FLOWER_PALETTES[variant]
  const previousCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()

  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_KRATHONG_FLOWER_V1')) return

    shader.uniforms.kPetalThroat = { value: new THREE.Color(pal.throatHex) }
    shader.uniforms.kPetalBody = { value: new THREE.Color(pal.bodyHex) }
    shader.uniforms.kPetalTip = { value: new THREE.Color(pal.tipHex) }
    shader.uniforms.kPetalScatter = { value: new THREE.Vector3(...pal.scatterTint) }
    shader.uniforms.kPetalIsHeart = { value: variant === 'heart' ? 1.0 : 0.0 }

    shader.vertexShader = PETAL_VARYINGS + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      kPetalUv = uv;
      kPetalPos = transformed;
      `,
    )

    shader.fragmentShader =
      '#define WBR_KRATHONG_FLOWER_V1\n' + PETAL_VARYINGS + PETAL_HEADER + shader.fragmentShader

    const physicalLights = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float kpRawNL = dot(geometryNormal, directLight.direction);
        float kpWrap = clamp((kpRawNL + 0.56) / 1.56, 0.0, 1.0);
        float kpWrapExtra = max(0.0, kpWrap - dotNL);
        float kpBack = max(0.0, -kpRawNL);
        vec3 kpThrough = normalize(directLight.direction + geometryNormal * 0.22);
        float kpForward = pow(max(0.0, dot(geometryViewDir, -kpThrough)), 2.5);
        float kpTrans = kpBack * (0.60 + 0.40 * kpForward) * (kPetalIsHeart > 0.5 ? 0.14 : 0.26);
        reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor)
          + (kpWrapExtra * 0.52 + kpTrans) * directLight.color * BRDF_Lambert(material.diffuseColor * kPetalScatter);
        `,
      )
      .replace(
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float kpIrrL = dot(irradiance, vec3(0.299, 0.587, 0.114));
        vec3 kpWarmIrr = mix(irradiance, vec3(kpIrrL) * vec3(1.06, 0.99, 0.85), 0.46) * 1.12;
        reflectedLight.indirectDiffuse += kpWarmIrr * BRDF_Lambert(material.diffuseColor);
        `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', physicalLights)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        if (kPetalIsHeart > 0.5) {
          // Organic quilted stamen pad: deep honey-ochre center -> bright golden-pollen stamen crown.
          float hRad = kPetalUv.x;
          float hUp = kPetalUv.y;
          float hDimple = kPetalWave(kPetalPos.x * 220.0) * kPetalWave(kPetalPos.z * 220.0) * 0.08;
          vec3 hCol = mix(kPetalThroat, kPetalBody, smoothstep(0.18, 0.72, hUp));
          hCol = mix(hCol, kPetalTip, smoothstep(0.55, 0.95, hRad) * smoothstep(0.45, 0.92, hUp));
          diffuseColor.rgb = hCol * (1.0 + hDimple);
        } else {
          // Cupped ivory petal with warm golden throat, fine radiating veins, and subtle margin separation.
          float pU = kPetalUv.x * 2.0 - 1.0;
          float pV = kPetalUv.y;
          float throat = 1.0 - smoothstep(0.08, 0.48, pV);
          float tip = smoothstep(0.66, 1.0, pV);
          float veinFan = pU / (0.45 + 0.55 * pow(max(pV, 0.02), 0.7));
          float veins = kPetalWave(veinFan * 18.85) * 0.044 * sin(pV * 3.14159);
          float midShade = -exp(-pU * pU * 10.0) * 0.036 * sin(pV * 3.14159);
          float marginWarm = pow(abs(pU), 2.4) * 0.055 * (1.0 - tip * 0.5);
          vec3 pCol = mix(kPetalBody, kPetalTip, tip);
          pCol = mix(pCol, kPetalThroat, throat * 0.88);
          diffuseColor.rgb = pCol * (1.0 + veins + midShade - marginWarm);
        }
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        vec3 kpLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float kpPeak = max(kpLit.r, max(kpLit.g, kpLit.b));
        if (kpPeak > 0.74) {
          float kpExcess = kpPeak - 0.74;
          float kpTarget = 0.74 + 0.24 * (kpExcess / (kpExcess + 0.24));
          outgoingLight = kpLit * (kpTarget / kpPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
        `,
      )
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-krathong-flower-v1:${variant}`
  material.clone = function (this: THREE.MeshStandardMaterial) {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    attachKrathongFlowerShader(cloned, variant)
    return cloned
  }
  material.needsUpdate = true
}

/**
 * Textureless, single-pass procedural botanical material for the krathong lotus blossom
 * (warm golden throat -> ivory petals, organic stamen heart, warm wrap scatter, C1 shoulder).
 */
export function createKrathongFlowerMaterial(variant: KrathongFlowerVariant): THREE.MeshStandardMaterial {
  const pal = FLOWER_PALETTES[variant]
  const mat = createRitualMaterial(
    {
      color: pal.baseHex,
      roughness: pal.roughness,
      metalness: 0,
      side: THREE.FrontSide,
    },
    { kind: 'fruit', strength: 0.16 },
  )
  attachKrathongFlowerShader(mat, variant)
  return mat
}
