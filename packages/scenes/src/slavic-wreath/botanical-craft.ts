import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/**
 * Watertight closed thin-shell (`FrontSide`) builder from a parametric grid `(u, v) ∈ [0,1]^2`.
 * Guarantees positive signed volume and exact manifold edge valence = 2.
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
      thickness[idx] = Math.max(0.0014, t)
    }
  }

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
      if (n.lengthSq() < 1e-12) n.set(0, 0, 1)
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

  // Closed perimeter rim strips.
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
 * Builds an indexed grass-stem `TubeGeometry` with subtle longitudinal grassy ribs,
 * strictly preserving sequential `u`-ordered indices so `geometry.setDrawRange` weave
 * animation behaves identically.
 */
export function createGrassyStrandGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments = 180,
  radius = 0.016,
  radialSegments = 8,
): THREE.TubeGeometry {
  const geo = new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, true)
  const pos = geo.getAttribute('position')
  const stride = radialSegments + 1
  const center = new THREE.Vector3()
  const v = new THREE.Vector3()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    center.set(0, 0, 0)
    for (let j = 0; j < radialSegments; j++) {
      const k = i * stride + j
      center.x += pos.getX(k)
      center.y += pos.getY(k)
      center.z += pos.getZ(k)
    }
    center.divideScalar(radialSegments)

    const nodeSwell = 1 + 0.045 * Math.sin(u * Math.PI * 2 * 18)
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * stride + j
      const theta = (j / radialSegments) * Math.PI * 2
      const rib = (1 + 0.072 * Math.cos(theta * 4 + u * Math.PI * 2 * 5)) * nodeSwell
      v.fromBufferAttribute(pos, k).sub(center).multiplyScalar(rib).add(center)
      pos.setXYZ(k, v.x, v.y, v.z)
    }
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Watertight thin midrib-folded wildflower leaf blade lying in the XY plane
 * (long axis along `X ∈ [-0.054, +0.072]`, width along `Y`, midrib V-fold & arch along `+Z`),
 * matching the existing wreath leaf orientation (`FrontSide` only, no double-sided cards).
 */
export function createWreathLeafGeometry(): THREE.BufferGeometry {
  // u maps Y from +halfW to -halfW (-Y), v maps X from base to tip (+X),
  // so (dP/du) x (dP/dv) = (-Y) x (+X) = +Z (upward-facing leaf face).
  return buildWatertightShell(6, 7, (u, v, out) => {
    const s = 1 - u * 2 // +1 .. -1
    const absS = Math.abs(s)
    const length = 0.126
    const maxWidth = 0.056
    const x = -0.054 + v * length
    // Graceful ovate-lanceolate blade: tapered petiole base, full belly at v ≈ 0.42, acuminate tip.
    const contour = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.78)), 0.86)
    const halfW = maxWidth * 0.5 * Math.max(0.05, 0.14 * (1 - v) * (1 - v) + contour * 0.96)
    const y = s * halfW

    const vSin = Math.sin(v * Math.PI)
    const midribV = absS * halfW * 0.30 * (0.28 + 0.72 * vSin)
    const arch = 0.011 * vSin - 0.008 * Math.pow(v, 2.3)
    const z = midribV + arch

    out.set(x, y, z)
    return 0.0046 * (0.38 + 0.62 * (1 - absS * 0.5) * (1 - v * 0.55))
  })
}

/**
 * Watertight cupped slender daisy petal extending along `+X` (local XY plane, cup along `+Z`),
 * matching daisy petal placement (`rotation.set(-PI/2, 0, angle)`).
 */
export function createDaisyPetalGeometry(): THREE.BufferGeometry {
  return buildWatertightShell(4, 6, (u, v, out) => {
    const s = 1 - u * 2 // +1 .. -1
    const absS = Math.abs(s)
    const startX = 0.011
    const length = 0.044
    const maxWidth = 0.0165
    const x = startX + v * length
    // Narrow throat -> full chamomile blade -> softly rounded tip.
    const belly = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.74)), 0.68)
    const halfW = maxWidth * 0.5 * Math.max(0.14, 0.28 * (1 - v) + belly * 0.94)
    const y = s * halfW

    const vSin = Math.sin(v * Math.PI)
    const cupZ = 0.0038 * (absS * absS) * (0.35 + 0.65 * vSin)
    const archZ = 0.0075 * Math.sin(v * Math.PI * 0.85) - 0.0045 * Math.pow(v, 2.4)
    const z = cupZ + archZ

    out.set(x, y, z)
    return 0.0032 * (0.45 + 0.55 * (1 - v * 0.45))
  })
}

/**
 * Watertight cupped, gently ruffled silk-crepe field poppy petal (`FrontSide`), extending
 * outward along `+Z` and cupping upward along `+Y` around the poppy seed pod.
 */
export function createPoppyPetalGeometry(
  length: number,
  maxWidth: number,
  cupDepth: number,
  bowlLift: number,
): THREE.BufferGeometry {
  // u maps X from +halfW to -halfW (-X), v maps Z from 0 to +length (+Z), so (-X) x (+Z) = +Y.
  return buildWatertightShell(8, 7, (u, v, out) => {
    const s = 1 - u * 2 // +1 .. -1
    const absS = Math.abs(s)
    // Broad overlapping fan silhouette typical of Papaver rhoeas.
    const fan = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.62)), 0.62)
    const halfW = maxWidth * 0.5 * Math.max(0.14, 0.16 * (1 - v) + fan * 1.02)
    const x = s * halfW
    const z = v * length

    const vSin = Math.sin(v * Math.PI)
    const cupY = cupDepth * (absS * absS) * (0.35 + 0.65 * vSin)
    const liftY = bowlLift * Math.pow(v, 1.25)
    // Delicate silk-crepe ruffling concentrated along the upper petal margin.
    const ruffle = Math.pow(v, 1.6) * (0.0034 * Math.sin(s * Math.PI * 2.5) + 0.0018 * Math.cos(s * Math.PI * 4.5))
    const y = cupY + liftY + ruffle

    out.set(x, y, z)
    return 0.0034 * (0.42 + 0.58 * (1 - v * 0.5))
  })
}

/**
 * Watertight flared, softly 3-notched trumpet ray floret for meadow cornflowers (`FrontSide`),
 * extending along `+Z` with upward flare along `+Y`.
 */
export function createCornflowerFloretGeometry(length: number, maxWidth: number): THREE.BufferGeometry {
  return buildWatertightShell(6, 6, (u, v, out) => {
    const s = 1 - u * 2
    const absS = Math.abs(s)
    // Slender trumpet tube flaring abruptly into a scalloped 3-toothed outer petal tip.
    const flare = 0.22 + 0.78 * Math.pow(v, 1.35)
    const notch = v > 0.72 ? 1 - 0.18 * Math.pow((v - 0.72) / 0.28, 1.4) * Math.pow(Math.sin(absS * Math.PI * 1.5), 2) : 1
    const halfW = maxWidth * 0.5 * Math.max(0.15, flare * (1 - 0.16 * Math.pow(v, 5)))
    const x = s * halfW
    const z = v * length * notch

    const cupY = 0.0042 * (absS * absS) * (0.25 + 0.75 * v)
    const archY = 0.0075 * Math.pow(v, 1.35) - 0.0025 * Math.pow(v, 3.0)
    const y = cupY + archY

    out.set(x, y, z)
    return 0.0028 * (0.48 + 0.52 * (1 - v * 0.4))
  })
}

/**
 * Sculpted quilted golden button center for chamomile/oxeye daisies (`FrontSide`).
 */
export function createDaisyCenterGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.0195, 16, 10)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const r = Math.hypot(x, z) / 0.0195
    const ang = Math.atan2(z, x)
    const dimple = y > 0 ? 0.0011 * Math.cos(r * 13.0) * Math.cos(ang * 8.0) * (1 - r * 0.4) : 0
    const nextY = (y >= 0 ? Math.pow(y / 0.0195, 0.84) * 0.0125 : y * 0.45) + dimple
    pos.setY(i, nextY)
    uv.setXY(i, THREE.MathUtils.clamp(r, 0, 1), THREE.MathUtils.clamp((nextY + 0.009) / 0.022, 0, 1))
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Fluted central poppy seed capsule (`FrontSide`).
 */
export function createPoppyPodGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(0.0115, 14, 10)
  const pos = geo.getAttribute('position')
  const uv = geo.getAttribute('uv')
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const ang = Math.atan2(z, x)
    const rib = 1 + 0.08 * Math.cos(ang * 8) * Math.cos((y / 0.0115) * 1.2)
    const ny = y >= 0 ? Math.pow(y / 0.0115, 0.72) * 0.0105 : y * 0.85
    pos.setXYZ(i, x * rib, ny, z * rib)
    uv.setXY(i, (ang / (Math.PI * 2) + 1) % 1, THREE.MathUtils.clamp((ny + 0.010) / 0.021, 0, 1))
  }
  geo.computeVertexNormals()
  return geo
}

/**
 * Watertight closed calyx/involucre cup (`FrontSide`) supporting daisies and cornflowers.
 */
export function createCalyxCupGeometry(topR: number, botR: number, height: number): THREE.BufferGeometry {
  const geo = new THREE.LatheGeometry([
    new THREE.Vector2(0, 0),
    new THREE.Vector2(botR, height * 0.14),
    new THREE.Vector2(topR * 0.88, height * 0.55),
    new THREE.Vector2(topR, height * 0.92),
    new THREE.Vector2(topR * 0.72, height),
    new THREE.Vector2(0, height * 0.92),
  ], 12)
  geo.computeVertexNormals()
  return geo
}

type WreathShaderKind =
  | 'stem'
  | 'reed'
  | 'leaf'
  | 'daisy-petal'
  | 'daisy-center'
  | 'poppy-petal'
  | 'poppy-pod'
  | 'cornflower-petal'
  | 'calyx'

type WreathPalette = {
  baseHex: number
  lowHex: number
  midHex: number
  highHex: number
  scatterTint: readonly [number, number, number]
  bounceTint: readonly [number, number, number]
  wrapAmount: number
  wrapStrength: number
  backStrength: number
  roughness: number
  ritualKind: 'leaf' | 'fruit'
  ritualStrength: number
}

const WREATH_PALETTES: Record<WreathShaderKind, WreathPalette> = {
  stem: {
    baseHex: 0x6f9f4a,
    lowHex: 0x4b7433,
    midHex: 0x709f4a,
    highHex: 0x9ec465,
    scatterTint: [1.06, 1.15, 0.68],
    bounceTint: [0.98, 1.05, 0.80],
    wrapAmount: 0.40,
    wrapStrength: 0.34,
    backStrength: 0.16,
    roughness: 0.70,
    ritualKind: 'leaf',
    ritualStrength: 0.14,
  },
  reed: {
    baseHex: 0x7ea156,
    lowHex: 0x486936,
    midHex: 0x769b4e,
    highHex: 0xa4bf66,
    scatterTint: [1.06, 1.14, 0.68],
    bounceTint: [0.98, 1.04, 0.82],
    wrapAmount: 0.38,
    wrapStrength: 0.32,
    backStrength: 0.16,
    roughness: 0.74,
    ritualKind: 'leaf',
    ritualStrength: 0.14,
  },
  leaf: {
    baseHex: 0x75ad50,
    lowHex: 0x4b7b37,
    midHex: 0x74ac50,
    highHex: 0xb1cf71,
    scatterTint: [1.14, 1.24, 0.56],
    bounceTint: [0.98, 1.07, 0.78],
    wrapAmount: 0.44,
    wrapStrength: 0.40,
    backStrength: 0.28,
    roughness: 0.58,
    ritualKind: 'leaf',
    ritualStrength: 0.20,
  },
  'daisy-petal': {
    baseHex: 0xfaf4e6,
    lowHex: 0xf0dc96,
    midHex: 0xfbf5e8,
    highHex: 0xfffbf2,
    scatterTint: [1.08, 1.00, 0.85],
    bounceTint: [1.06, 1.00, 0.88],
    wrapAmount: 0.56,
    wrapStrength: 0.52,
    backStrength: 0.24,
    roughness: 0.82,
    ritualKind: 'fruit',
    ritualStrength: 0.15,
  },
  'daisy-center': {
    baseHex: 0xf0be4a,
    lowHex: 0xc98225,
    midHex: 0xf0bd48,
    highHex: 0xfbde74,
    scatterTint: [1.12, 0.96, 0.72],
    bounceTint: [1.08, 0.96, 0.78],
    wrapAmount: 0.46,
    wrapStrength: 0.40,
    backStrength: 0.12,
    roughness: 0.78,
    ritualKind: 'fruit',
    ritualStrength: 0.12,
  },
  'poppy-petal': {
    baseHex: 0xd94836,
    lowHex: 0x3b181d,
    midHex: 0xd94633,
    highHex: 0xf27153,
    scatterTint: [1.22, 0.76, 0.62],
    bounceTint: [1.12, 0.82, 0.74],
    wrapAmount: 0.52,
    wrapStrength: 0.46,
    backStrength: 0.34,
    roughness: 0.76,
    ritualKind: 'fruit',
    ritualStrength: 0.20,
  },
  'poppy-pod': {
    baseHex: 0x6f8449,
    lowHex: 0x4b5f35,
    midHex: 0x73884c,
    highHex: 0x2d2022,
    scatterTint: [1.04, 1.08, 0.82],
    bounceTint: [1.00, 1.02, 0.88],
    wrapAmount: 0.36,
    wrapStrength: 0.30,
    backStrength: 0.10,
    roughness: 0.80,
    ritualKind: 'leaf',
    ritualStrength: 0.10,
  },
  'cornflower-petal': {
    baseHex: 0x6386df,
    lowHex: 0x3b4aa6,
    midHex: 0x6286df,
    highHex: 0xa1bdf6,
    scatterTint: [0.92, 0.98, 1.18],
    bounceTint: [0.94, 0.98, 1.12],
    wrapAmount: 0.52,
    wrapStrength: 0.48,
    backStrength: 0.26,
    roughness: 0.80,
    ritualKind: 'fruit',
    ritualStrength: 0.16,
  },
  calyx: {
    baseHex: 0x5c8444,
    lowHex: 0x416430,
    midHex: 0x5f8845,
    highHex: 0x87ad5d,
    scatterTint: [1.06, 1.14, 0.72],
    bounceTint: [0.98, 1.04, 0.82],
    wrapAmount: 0.38,
    wrapStrength: 0.32,
    backStrength: 0.14,
    roughness: 0.72,
    ritualKind: 'leaf',
    ritualStrength: 0.12,
  },
}

const SW_VARYINGS = /* glsl */ `
varying vec3 swPos;
varying vec2 swUv;
`

const SW_HEADER = /* glsl */ `
uniform vec3 swLowColor;
uniform vec3 swMidColor;
uniform vec3 swHighColor;
uniform vec3 swScatterTint;
uniform vec3 swBounceTint;
uniform float swWrapAmt;
uniform float swWrapStr;
uniform float swBackStr;
uniform float swMode;

float swAaWave(float phase) {
  float fw = fwidth(phase);
  return sin(phase) * exp(-0.45 * fw * fw);
}
`

const MODE_INDEX: Record<WreathShaderKind, number> = {
  stem: 0,
  reed: 1,
  leaf: 2,
  'daisy-petal': 3,
  'daisy-center': 4,
  'poppy-petal': 5,
  'poppy-pod': 6,
  'cornflower-petal': 7,
  calyx: 8,
}

function attachWreathBotanicalShader(
  material: THREE.MeshStandardMaterial,
  kind: WreathShaderKind,
  colorOverride?: number,
): void {
  const pal = WREATH_PALETTES[kind]
  const baseCol = new THREE.Color(colorOverride ?? pal.baseHex)
  const midCol = colorOverride !== undefined ? baseCol.clone() : new THREE.Color(pal.midHex)
  const lowCol = colorOverride !== undefined ? baseCol.clone().multiplyScalar(0.68) : new THREE.Color(pal.lowHex)
  const highCol = colorOverride !== undefined ? baseCol.clone().lerp(new THREE.Color(pal.highHex), 0.65) : new THREE.Color(pal.highHex)

  const previousCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey()

  material.onBeforeCompile = function (shader, renderer) {
    previousCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_SLAVIC_BOTANICAL_V1')) return

    shader.uniforms.swLowColor = { value: lowCol }
    shader.uniforms.swMidColor = { value: midCol }
    shader.uniforms.swHighColor = { value: highCol }
    shader.uniforms.swScatterTint = { value: new THREE.Vector3(...pal.scatterTint) }
    shader.uniforms.swBounceTint = { value: new THREE.Vector3(...pal.bounceTint) }
    shader.uniforms.swWrapAmt = { value: pal.wrapAmount }
    shader.uniforms.swWrapStr = { value: pal.wrapStrength }
    shader.uniforms.swBackStr = { value: pal.backStrength }
    shader.uniforms.swMode = { value: MODE_INDEX[kind] }

    shader.vertexShader = SW_VARYINGS + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace(
      '#include <begin_vertex>',
      /* glsl */ `
      #include <begin_vertex>
      swPos = transformed;
      swUv = uv;
      `,
    )

    shader.fragmentShader =
      '#define WBR_SLAVIC_BOTANICAL_V1\n' + SW_VARYINGS + SW_HEADER + shader.fragmentShader

    const physicalLights = THREE.ShaderChunk.lights_physical_pars_fragment
      .replace(
        'reflectedLight.directDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float swRawNL = dot(geometryNormal, directLight.direction);
        float swWrap = clamp((swRawNL + swWrapAmt) / (1.0 + swWrapAmt), 0.0, 1.0);
        float swWrapExtra = max(0.0, swWrap - dotNL);
        float swBack = max(0.0, -swRawNL);
        vec3 swThrough = normalize(directLight.direction + geometryNormal * 0.22);
        float swForward = pow(max(0.0, dot(geometryViewDir, -swThrough)), 2.5);
        float swTrans = swBack * (0.58 + 0.42 * swForward) * swBackStr;
        reflectedLight.directDiffuse += irradiance * BRDF_Lambert(material.diffuseColor)
          + (swWrapExtra * swWrapStr + swTrans) * directLight.color * BRDF_Lambert(material.diffuseColor * swScatterTint);
        `,
      )
      .replace(
        'reflectedLight.indirectDiffuse += irradiance * BRDF_Lambert( material.diffuseColor );',
        /* glsl */ `
        float swIrrL = dot(irradiance, vec3(0.299, 0.587, 0.114));
        vec3 swWarmIrr = mix(irradiance, vec3(swIrrL) * swBounceTint, 0.44) * 1.10;
        reflectedLight.indirectDiffuse += swWarmIrr * BRDF_Lambert(material.diffuseColor);
        `,
      )

    shader.fragmentShader = shader.fragmentShader
      .replace('#include <lights_physical_pars_fragment>', physicalLights)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `
        #include <color_fragment>
        float swRoughMod = 0.0;
        if (swMode < 0.5) {
          // Braided grass stem: soft longitudinal grassy fibers + gentle internode warmth.
          float fibers = swAaWave(swUv.y * 37.699 + swUv.x * 18.85) * 0.72
                       + swAaWave(swUv.y * 75.398 - swUv.x * 12.56) * 0.28;
          float sheath = smoothstep(0.58, 0.94, sin(swUv.x * 100.53));
          vec3 col = mix(swMidColor, swHighColor, clamp(fibers * 0.36 + 0.24 + sheath * 0.28, 0.0, 0.78));
          col = mix(col, swLowColor, clamp(-fibers * 0.36 + 0.14, 0.0, 0.58));
          diffuseColor.rgb = col;
          swRoughMod = -fibers * 0.06;
        } else if (swMode < 1.5) {
          // Riverbank reed: darker wet olive base rising to sunlit meadow green tip.
          float h = clamp((swPos.y + 0.35) / 0.70, 0.0, 1.0);
          float stria = swAaWave(atan(swPos.z, swPos.x) * 14.0) * 0.05;
          vec3 col = mix(swLowColor, swMidColor, smoothstep(0.0, 0.52, h));
          col = mix(col, swHighColor, smoothstep(0.50, 1.0, h));
          diffuseColor.rgb = col * (1.0 + stria);
        } else if (swMode < 2.5) {
          // Midrib-folded leaf blade: bright central midrib + oblique pinnate veins + fresh tip.
          float across = abs(swUv.x - 0.5) * 2.0;
          float v = swUv.y;
          float midrib = exp(-pow(across / 0.13, 2.0)) * (1.0 - smoothstep(0.82, 1.0, v));
          float latVein = swAaWave(v * 34.0 - across * 24.0) * 0.065 * sin(v * 3.14159);
          vec3 col = mix(swLowColor, swMidColor, smoothstep(0.0, 0.38, v));
          col = mix(col, swHighColor, smoothstep(0.55, 1.0, v) * 0.45 + midrib * 0.52);
          diffuseColor.rgb = col * (1.0 + latVein);
          swRoughMod = -midrib * 0.07;
        } else if (swMode < 3.5) {
          // Daisy petal: soft pale-butter throat -> clean milk-white -> pearl tip.
          float pU = swUv.x * 2.0 - 1.0;
          float pV = swUv.y;
          float throat = 1.0 - smoothstep(0.04, 0.34, pV);
          float tip = smoothstep(0.68, 1.0, pV);
          float crease = swAaWave(pU * 9.42) * 0.025 * sin(pV * 3.14159);
          vec3 col = mix(swMidColor, swHighColor, tip);
          col = mix(col, swLowColor, throat * 0.72);
          diffuseColor.rgb = col * (1.0 + crease);
        } else if (swMode < 4.5) {
          // Quilted golden daisy center button.
          float rad = swUv.x;
          float h = swUv.y;
          float floret = swAaWave(swPos.x * 420.0) * swAaWave(swPos.z * 420.0) * 0.07;
          vec3 col = mix(swLowColor, swMidColor, smoothstep(0.15, 0.68, h));
          col = mix(col, swHighColor, smoothstep(0.45, 0.92, rad) * 0.65);
          diffuseColor.rgb = col * (1.0 + floret);
        } else if (swMode < 5.5) {
          // Field poppy petal: velvety dark plum-charcoal basal blotch -> scarlet -> coral-red ruffled rim.
          float pU = swUv.x * 2.0 - 1.0;
          float pV = swUv.y;
          float blotch = (1.0 - smoothstep(0.12, 0.30, pV)) * (1.0 - smoothstep(0.55, 0.98, abs(pU)));
          float rim = smoothstep(0.64, 1.0, pV);
          float crepe = swAaWave(pU * 22.0 + pV * 3.0) * 0.045 * sin(pV * 3.14159);
          vec3 col = mix(swMidColor, swHighColor, rim * 0.78);
          col = mix(col, swLowColor, blotch * 0.92);
          diffuseColor.rgb = col * (1.0 + crepe);
          swRoughMod = blotch * 0.12 - rim * 0.06;
        } else if (swMode < 6.5) {
          // Poppy seed capsule: sage-olive fluted pod with dark velvety stigma crown on top.
          float cap = smoothstep(0.76, 0.94, swUv.y);
          float flute = swAaWave(swUv.x * 50.265) * 0.06;
          vec3 col = mix(swLowColor, swMidColor, smoothstep(0.0, 0.65, swUv.y));
          col = mix(col, swHighColor, cap * 0.88);
          diffuseColor.rgb = col * (1.0 + flute);
        } else if (swMode < 7.5) {
          // Cornflower floret: twilight violet-indigo throat -> periwinkle blue -> bright sky tip.
          float pU = swUv.x * 2.0 - 1.0;
          float pV = swUv.y;
          float rib = swAaWave(pU * 12.56) * 0.04 * pV;
          vec3 col = mix(swLowColor, swMidColor, smoothstep(0.08, 0.52, pV));
          col = mix(col, swHighColor, smoothstep(0.58, 1.0, pV) * 0.78);
          diffuseColor.rgb = col * (1.0 + rib);
        } else {
          // Calyx / involucre scaly green cup.
          float scales = swAaWave(swPos.y * 240.0 + atan(swPos.z, swPos.x) * 6.0) * 0.06;
          vec3 col = mix(swLowColor, swHighColor, smoothstep(0.0, 0.9, swUv.y) * 0.65);
          diffuseColor.rgb = col * (1.0 + scales);
        }
        `,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        /* glsl */ `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor + swRoughMod, 0.44, 0.95);
        `,
      )
      .replace(
        '#include <opaque_fragment>',
        /* glsl */ `
        // C1 highlight shoulder protects white daisy petals and sunlit blooms from clipping.
        vec3 swLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float swPeak = max(swLit.r, max(swLit.g, swLit.b));
        if (swPeak > 0.74) {
          float swExcess = swPeak - 0.74;
          float swTarget = 0.74 + 0.24 * (swExcess / (swExcess + 0.24));
          outgoingLight = swLit * (swTarget / swPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
        `,
      )
  }

  material.customProgramCacheKey = () =>
    `${baseKey}|wbr-slavic-botanical-v1:${kind}:${colorOverride ?? 'default'}`
  material.clone = function (this: THREE.MeshStandardMaterial) {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    attachWreathBotanicalShader(cloned, kind, colorOverride)
    return cloned
  }
  material.needsUpdate = true
}

export function createWreathBotanicalMaterial(
  kind: WreathShaderKind,
  colorOverride?: number,
): THREE.MeshStandardMaterial {
  const pal = WREATH_PALETTES[kind]
  const mat = createRitualMaterial(
    {
      color: colorOverride ?? pal.baseHex,
      roughness: pal.roughness,
      metalness: 0,
      side: THREE.FrontSide,
    },
    { kind: pal.ritualKind, strength: pal.ritualStrength },
  )
  attachWreathBotanicalShader(mat, kind, colorOverride)
  return mat
}
