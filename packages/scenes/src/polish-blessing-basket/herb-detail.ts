import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

type HerbFinishOptions = {
  veinStrength: number
  wrapStrength: number
  rimStrength: number
  knee?: number
  headroom?: number
}

/**
 * Single-pass Komorebi boxwood/spring-herb leaf shader: subtle analytical
 * pinnate veins + bright pale midrib, warm chlorophyll forward-wrap light,
 * gentle waxy cuticle rim, and C1 highlight shoulder (knee = 0.74, headroom = 0.24).
 * Preserves its shader hook across `toon-surfaces.ts` `.clone()`.
 */
function attachHerbLeafFinish(material: THREE.MeshStandardMaterial, opts: HerbFinishOptions): THREE.MeshStandardMaterial {
  const knee = (opts.knee ?? 0.74).toFixed(3)
  const headroom = (opts.headroom ?? 0.24).toFixed(3)
  const baseCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey.bind(material)()

  material.onBeforeCompile = function (shader, renderer) {
    baseCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_BASKET_HERB')) return
    shader.uniforms.wbrHerbVein = { value: opts.veinStrength }
    shader.uniforms.wbrHerbWrap = { value: opts.wrapStrength }
    shader.uniforms.wbrHerbRim = { value: opts.rimStrength }

    shader.vertexShader = 'varying vec2 wbrHerbUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrHerbUv = uv;
    `)

    const header = `
#define WBR_BASKET_HERB
varying vec2 wbrHerbUv;
uniform float wbrHerbVein;
uniform float wbrHerbWrap;
uniform float wbrHerbRim;
float wbrHerbWave(float phase) {
  float f = fwidth(phase);
  return sin(phase) * exp(-0.42 * f * f);
}
`
    shader.fragmentShader = header + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float herbU = wbrHerbUv.x * 2.0 - 1.0;
        float herbV = clamp(wbrHerbUv.y, 0.0, 1.0);
        float herbEnv = sin(herbV * 3.14159265);
        float herbMid = exp(-herbU * herbU * 34.0) * (1.0 - herbV * 0.42);
        float herbLat = wbrHerbWave((herbV * 4.5 - abs(herbU) * 1.35) * 6.2831853)
          * smoothstep(0.08, 0.28, abs(herbU)) * (1.0 - smoothstep(0.70, 0.96, abs(herbU))) * herbEnv;
        float herbPattern = (herbMid * 0.72 + herbLat * 0.36) * wbrHerbVein;
        diffuseColor.rgb *= 1.0 + herbPattern * 0.11;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.12, 1.14, 0.86), clamp(herbMid * wbrHerbVein * 0.48, 0.0, 0.42));
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - herbPattern * 0.12, 0.36, 0.94);
      `)
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          vec3 herbKeyDir = directionalLights[0].direction;
          vec3 herbKeyCol = directionalLights[0].color;
          float herbNdotL = dot(geometryNormal, herbKeyDir);
          float herbWrap = smoothstep(-0.44, 0.60, herbNdotL) * (1.0 - max(0.0, herbNdotL) * 0.56);
          float herbBack = max(0.0, -herbNdotL) * 0.42;
          float herbRim = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 2.5);
          vec3 herbTint = diffuseColor.rgb * vec3(1.06, 1.12, 0.76);
          reflectedLight.directDiffuse += herbTint * herbKeyCol
            * ((herbWrap + herbBack) * wbrHerbWrap + herbRim * wbrHerbRim) * 0.31830988618;
        #endif
        #if defined( RE_IndirectDiffuse )
          float herbAmb = min(1.0, length(irradiance) * 0.35);
          reflectedLight.indirectDiffuse = max(
            reflectedLight.indirectDiffuse,
            diffuseColor.rgb * vec3(1.04, 1.08, 0.78) * (0.14 * herbAmb)
          );
        #endif
      `)
      .replace('#include <opaque_fragment>', `
        vec3 herbLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float herbPeak = max(herbLit.r, max(herbLit.g, herbLit.b));
        if (herbPeak > ${knee}) {
          float herbExcess = herbPeak - ${knee};
          float herbTarget = ${knee} + ${headroom} * (herbExcess / (herbExcess + ${headroom}));
          outgoingLight = herbLit * (herbTarget / herbPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `)
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-basket-herb-v1:${knee}:${headroom}`
  material.userData.botanicalFinish = { mode: 'leaf-pinnate', knee: opts.knee ?? 0.74, headroom: opts.headroom ?? 0.24 }
  material.clone = function () {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    return attachHerbLeafFinish(cloned, opts)
  }
  material.needsUpdate = true
  return material
}

export function createBasketHerbLeafMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.62, metalness: 0, envMapIntensity: 0.44 },
    { kind: 'leaf', strength: 0.18, fiber: false },
  )
  return attachHerbLeafFinish(mat, {
    veinStrength: 0.85,
    wrapStrength: 0.20,
    rimStrength: 0.12,
    knee: 0.74,
    headroom: 0.24,
  })
}

export function createBasketHerbStemMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0x517043, roughness: 0.78, metalness: 0, envMapIntensity: 0.40 },
    { kind: 'leaf', strength: 0.10, fiber: false },
  )
  return attachHerbLeafFinish(mat, {
    veinStrength: 0.25,
    wrapStrength: 0.12,
    rimStrength: 0.06,
    knee: 0.74,
    headroom: 0.24,
  })
}

export type BoxwoodTone = 'mature' | 'young'

/**
 * Watertight FrontSide midrib-folded Easter boxwood (bukszpan) leaf extending
 * from petiole base (y = 0) along +Y to gently arched rounded-ovate tip (y = len),
 * width along X, midrib V-fold and outward arch along +Z.
 */
export function createBoxwoodLeafGeometry(tone: BoxwoodTone): THREE.BufferGeometry {
  const segU = 6
  const segV = 6
  const cols = segU + 1
  const rows = segV + 1
  const layerVerts = cols * rows
  const totalVerts = layerVerts * 2

  const length = tone === 'young' ? 0.128 : 0.146
  const maxHalfW = tone === 'young' ? 0.034 : 0.039
  const cBase = new THREE.Color(tone === 'young' ? 0x5a8546 : 0x456d3c)
  const cMid = new THREE.Color(tone === 'young' ? 0x77a455 : 0x5c8949)
  const cTip = new THREE.Color(tone === 'young' ? 0x97bf68 : 0x79a459)
  const cRib = new THREE.Color(tone === 'young' ? 0xb1d17c : 0x92b869)
  const cUnder = new THREE.Color(tone === 'young' ? 0x517840 : 0x3d5e35)

  const centers: THREE.Vector3[] = Array.from({ length: layerVerts }, () => new THREE.Vector3())
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    // Classic boxwood oval-elliptic blade: short narrow petiole, plump rounded waist, softly blunt tip.
    const waist = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.84)), 0.74)
    const tipSoft = 1 - 0.72 * Math.pow(Math.max(0, (v - 0.82) / 0.18), 2.0)
    const halfW = maxHalfW * Math.max(0.14, (0.16 * (1 - v) + waist * 0.96) * tipSoft)
    const y = v * length
    // Gentle outward longitudinal arch along +Z so leaves catch warm overhead Komorebi light.
    const archZ = 0.017 * Math.sin(v * Math.PI * 0.76) - 0.006 * v * v

    for (let iu = 0; iu <= segU; iu++) {
      const u = (iu / segU) * 2 - 1
      const x = u * halfW
      // Clear ~15-degree midrib V-fold cradling the central vein.
      const vFold = 0.0115 * Math.abs(u) * Math.sin(Math.PI * Math.pow(v, 0.82))
      const z = archZ + vFold
      centers[iv * cols + iu]!.set(x, y, z)
    }
  }

  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const colors = new Float32Array(totalVerts * 3)
  const du = new THREE.Vector3()
  const dv = new THREE.Vector3()
  const n = new THREE.Vector3()
  const col = new THREE.Color()

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    const ivPrev = Math.max(0, iv - 1)
    const ivNext = Math.min(segV, iv + 1)
    for (let iu = 0; iu <= segU; iu++) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const iuPrev = Math.max(0, iu - 1)
      const iuNext = Math.min(segU, iu + 1)
      const idx = iv * cols + iu
      const c = centers[idx]!

      du.subVectors(centers[iv * cols + iuNext]!, centers[iv * cols + iuPrev]!)
      dv.subVectors(centers[ivNext * cols + iu]!, centers[ivPrev * cols + iu]!)
      // (+X du) x (+Y dv) = +Z top outward normal!
      n.crossVectors(du, dv)
      if (n.lengthSq() < 1e-16) n.set(0, 0, 1)
      else n.normalize()

      const thickness = 0.0056 * (1 - 0.34 * u * u) * (1 - 0.30 * v * v)
      const halfT = Math.max(0.0012, thickness * 0.5)
      const topIdx = idx
      const botIdx = layerVerts + idx

      const midribBlend = Math.exp(-u * u * 18) * (1 - v * 0.5) * 0.36
      col.copy(cBase).lerp(cMid, THREE.MathUtils.smoothstep(v, 0.06, 0.56))
      col.lerp(cTip, THREE.MathUtils.smoothstep(v, 0.56, 1.0))
      col.lerp(cRib, midribBlend)

      positions[topIdx * 3] = c.x + n.x * halfT
      positions[topIdx * 3 + 1] = c.y + n.y * halfT
      positions[topIdx * 3 + 2] = c.z + n.z * halfT
      uvs[topIdx * 2] = uUv
      uvs[topIdx * 2 + 1] = v
      colors[topIdx * 3] = col.r
      colors[topIdx * 3 + 1] = col.g
      colors[topIdx * 3 + 2] = col.b

      col.lerp(cUnder, 0.48)
      positions[botIdx * 3] = c.x - n.x * halfT
      positions[botIdx * 3 + 1] = c.y - n.y * halfT
      positions[botIdx * 3 + 2] = c.z - n.z * halfT
      uvs[botIdx * 2] = uUv
      uvs[botIdx * 2 + 1] = v
      colors[botIdx * 3] = col.r
      colors[botIdx * 3 + 1] = col.g
      colors[botIdx * 3 + 2] = col.b
    }
  }

  const indices: number[] = []
  const top = (iu: number, iv: number) => iv * cols + iu
  const bot = (iu: number, iv: number) => layerVerts + iv * cols + iu

  // Top outward normal is (+X) x (+Y) = +Z -> quad (a, b, d), (a, d, c).
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = top(iu, iv), b = top(iu + 1, iv), c = top(iu, iv + 1), d = top(iu + 1, iv + 1)
      indices.push(a, b, d, a, d, c)
      const ba = bot(iu, iv), bb = bot(iu + 1, iv), bc = bot(iu, iv + 1), bd = bot(iu + 1, iv + 1)
      indices.push(ba, bd, bb, ba, bc, bd)
    }
  }

  // Perimeter stitched walls (opposite edge direction to top & bottom boundaries):
  // Base edge (iv = 0): top has a -> b, so rim uses b -> a -> bot(a) -> bot(b) -> outward -Y.
  for (let iu = 0; iu < segU; iu++) {
    indices.push(top(iu + 1, 0), top(iu, 0), bot(iu, 0), top(iu + 1, 0), bot(iu, 0), bot(iu + 1, 0))
    // Tip edge (iv = segV): top has d -> c, so rim uses c -> d -> bot(d) -> bot(c) -> outward +Y.
    indices.push(top(iu, segV), top(iu + 1, segV), bot(iu + 1, segV), top(iu, segV), bot(iu + 1, segV), bot(iu, segV))
  }
  // Left edge (iu = 0): top has c -> a, so rim uses a -> c -> bot(c) -> bot(a) -> outward -X.
  // Right edge (iu = segU): top has b -> d, so rim uses d -> b -> bot(b) -> bot(d) -> outward +X.
  for (let iv = 0; iv < segV; iv++) {
    indices.push(top(0, iv), top(0, iv + 1), bot(0, iv + 1), top(0, iv), bot(0, iv + 1), bot(0, iv))
    indices.push(top(segU, iv + 1), top(segU, iv), bot(segU, iv), top(segU, iv + 1), bot(segU, iv), bot(segU, iv + 1))
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}

/**
 * Watertight tapered cylindrical sprig stem following a CatmullRomCurve3 with
 * closed start and end caps (strictly FrontSide, positive signed volume).
 */
export function createHerbSprigStemGeometry(
  curve: THREE.CatmullRomCurve3,
  baseRadius = 0.0085,
  tipRadius = 0.0042,
): THREE.BufferGeometry {
  const segs = 16
  const sides = 7
  const ringStride = sides + 1
  const bodyVerts = (segs + 1) * ringStride
  const totalVerts = bodyVerts + 2

  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices: number[] = []
  const frames = curve.computeFrenetFrames(segs, false)
  const p = new THREE.Vector3()

  for (let i = 0; i <= segs; i++) {
    const t = i / segs
    curve.getPointAt(t, p)
    const r = THREE.MathUtils.lerp(baseRadius, tipRadius, Math.pow(t, 0.85))
    const N = frames.normals[i]!
    const B = frames.binormals[i]!
    for (let j = 0; j <= sides; j++) {
      const a = (j / sides) * Math.PI * 2
      const ca = Math.cos(a), sa = Math.sin(a)
      const k = i * ringStride + j
      positions[k * 3] = p.x + r * (N.x * ca + B.x * sa)
      positions[k * 3 + 1] = p.y + r * (N.y * ca + B.y * sa)
      positions[k * 3 + 2] = p.z + r * (N.z * ca + B.z * sa)
      uvs[k * 2] = j / sides
      uvs[k * 2 + 1] = t
      if (i < segs && j < sides) {
        const aIdx = k, bIdx = k + 1, cIdx = k + ringStride, dIdx = cIdx + 1
        indices.push(aIdx, bIdx, cIdx, bIdx, dIdx, cIdx)
      }
    }
  }

  const startCap = bodyVerts
  const endCap = bodyVerts + 1
  const p0 = curve.getPointAt(0)
  const p1 = curve.getPointAt(1)
  positions[startCap * 3] = p0.x
  positions[startCap * 3 + 1] = p0.y
  positions[startCap * 3 + 2] = p0.z
  uvs[startCap * 2] = 0.5
  uvs[startCap * 2 + 1] = 0
  positions[endCap * 3] = p1.x
  positions[endCap * 3 + 1] = p1.y
  positions[endCap * 3 + 2] = p1.z
  uvs[endCap * 2] = 0.5
  uvs[endCap * 2 + 1] = 1

  const endRing = segs * ringStride
  for (let j = 0; j < sides; j++) {
    indices.push(startCap, j + 1, j)
    indices.push(endCap, endRing + j, endRing + j + 1)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
  return geometry
}
