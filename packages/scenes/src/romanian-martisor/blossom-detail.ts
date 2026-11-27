import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

export type MartisorBotanicalMode = 'petal' | 'leaf' | 'bark'

type MartisorBotanicalOptions = {
  mode: MartisorBotanicalMode
  veinStrength: number
  wrapStrength: number
  rimStrength: number
  scatterTint: readonly [number, number, number]
  knee?: number
  headroom?: number
}

/**
 * Single-pass Komorebi botanical finish for `romanian-martisor`:
 * - `petal`: soft radiating silky veins, warm rose-cream wrap translucency,
 *   velvet rim, and C1 highlight shoulder (knee = 0.74, headroom = 0.24).
 * - `leaf`: pale midrib + oblique spring veins with warm chlorophyll wrap.
 * - `bark`: restrained living fruit-tree bark hint with subtle vertical
 *   furrows and sparse horizontal lenticels (distinct from sawn plank wood).
 * Overrides `.clone()` so `toon-surfaces.ts` preserves the hook in `toon-soft`.
 */
function attachMartisorBotanicalFinish(
  material: THREE.MeshStandardMaterial,
  opts: MartisorBotanicalOptions,
): THREE.MeshStandardMaterial {
  const knee = (opts.knee ?? 0.74).toFixed(3)
  const headroom = (opts.headroom ?? 0.24).toFixed(3)
  const baseCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey.bind(material)()

  const patternSnippet = opts.mode === 'petal'
    ? `
      float mbU = wbrMbUv.x * 2.0 - 1.0;
      float mbV = clamp(wbrMbUv.y, 0.0, 1.0);
      float mbFan = mbU / (0.38 + 0.62 * sqrt(max(mbV, 0.01)));
      float mbPattern = (wbrMbWave(mbFan * 18.849556) * 0.62 + exp(-mbU * mbU * 22.0) * 0.38)
        * sin(mbV * 3.14159265) * wbrMbVein;
      diffuseColor.rgb *= 1.0 + mbPattern * 0.075;
    `
    : opts.mode === 'leaf'
      ? `
        float mbU = wbrMbUv.x * 2.0 - 1.0;
        float mbV = clamp(wbrMbUv.y, 0.0, 1.0);
        float mbEnv = sin(mbV * 3.14159265);
        float mbMid = exp(-mbU * mbU * 34.0) * (1.0 - mbV * 0.45);
        float mbLat = wbrMbWave((mbV * 4.8 - abs(mbU) * 1.4) * 6.2831853)
          * smoothstep(0.07, 0.26, abs(mbU)) * (1.0 - smoothstep(0.72, 0.98, abs(mbU))) * mbEnv;
        float mbPattern = (mbMid * 0.70 + mbLat * 0.38) * wbrMbVein;
        diffuseColor.rgb *= 1.0 + mbPattern * 0.11;
        diffuseColor.rgb = mix(diffuseColor.rgb, diffuseColor.rgb * vec3(1.10, 1.13, 0.86), clamp(mbMid * wbrMbVein * 0.48, 0.0, 0.40));
      `
      : `
        float mbBarkU = wbrMbUv.x * 6.2831853;
        float mbBarkV = wbrMbUv.y;
        float mbFurrow = wbrMbWave(mbBarkU * 6.0 + sin(mbBarkV * 11.0) * 0.55) * 0.52
                       + wbrMbWave(mbBarkU * 11.0 - cos(mbBarkV * 7.0) * 0.42) * 0.32;
        float mbLenticel = smoothstep(0.74, 0.96, wbrMbWave(mbBarkV * 44.0 + sin(mbBarkU * 3.0) * 1.6))
                         * smoothstep(0.25, 0.85, sin(mbBarkU * 4.0 + floor(mbBarkV * 14.0) * 2.3));
        float mbPattern = (mbFurrow * 0.70 - mbLenticel * 0.48) * wbrMbVein;
        diffuseColor.rgb *= 1.0 + mbPattern * 0.13;
      `

  const lightSnippet = opts.mode === 'bark'
    ? `
      #include <lights_fragment_end>
      #if defined( RE_IndirectDiffuse )
        float mbAmb = min(1.0, length(irradiance) * 0.35);
        reflectedLight.indirectDiffuse = max(
          reflectedLight.indirectDiffuse,
          diffuseColor.rgb * vec3(1.04, 0.98, 0.90) * (0.09 * mbAmb)
        );
      #endif
    `
    : `
      #include <lights_fragment_end>
      #if NUM_DIR_LIGHTS > 0
        vec3 mbKeyDir = directionalLights[0].direction;
        vec3 mbKeyCol = directionalLights[0].color;
        float mbNdotL = dot(geometryNormal, mbKeyDir);
        float mbWrap = smoothstep(-0.46, 0.62, mbNdotL) * (1.0 - max(0.0, mbNdotL) * 0.56);
        float mbBack = max(0.0, -mbNdotL) * 0.46;
        float mbRim = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 2.5);
        float mbLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
        float mbHead = mix(1.0, 0.58, smoothstep(0.48, 0.90, mbLuma));
        reflectedLight.directDiffuse += (diffuseColor.rgb * wbrMbTint) * mbKeyCol
          * ((mbWrap + mbBack) * wbrMbWrap + mbRim * wbrMbRim) * mbHead * 0.31830988618;
      #endif
      #if defined( RE_IndirectDiffuse )
        float mbAmb = min(1.0, length(irradiance) * 0.35);
        reflectedLight.indirectDiffuse = max(
          reflectedLight.indirectDiffuse,
          diffuseColor.rgb * wbrMbTint * (0.15 * mbAmb)
        );
      #endif
    `

  material.onBeforeCompile = function (shader, renderer) {
    baseCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_MARTISOR_BOTANICAL')) return
    shader.uniforms.wbrMbVein = { value: opts.veinStrength }
    shader.uniforms.wbrMbWrap = { value: opts.wrapStrength }
    shader.uniforms.wbrMbRim = { value: opts.rimStrength }
    shader.uniforms.wbrMbTint = { value: new THREE.Vector3(...opts.scatterTint) }

    shader.vertexShader = 'varying vec2 wbrMbUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrMbUv = uv;
    `)

    const header = `
#define WBR_MARTISOR_BOTANICAL
varying vec2 wbrMbUv;
uniform float wbrMbVein;
uniform float wbrMbWrap;
uniform float wbrMbRim;
uniform vec3 wbrMbTint;
float wbrMbWave(float phase) {
  float f = fwidth(phase);
  return sin(phase) * exp(-0.42 * f * f);
}
`
    shader.fragmentShader = header + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        ${patternSnippet}
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - mbPattern * 0.09, 0.38, 0.96);
      `)
      .replace('#include <lights_fragment_end>', lightSnippet)
      .replace('#include <opaque_fragment>', `
        vec3 mbLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float mbPeak = max(mbLit.r, max(mbLit.g, mbLit.b));
        if (mbPeak > ${knee}) {
          float mbExcess = mbPeak - ${knee};
          float mbTarget = ${knee} + ${headroom} * (mbExcess / (mbExcess + ${headroom}));
          outgoingLight = mbLit * (mbTarget / mbPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `)
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-martisor-bot-v1:${opts.mode}:${knee}:${headroom}`
  material.userData.botanicalFinish = { mode: opts.mode, knee: opts.knee ?? 0.74, headroom: opts.headroom ?? 0.24 }
  material.clone = function () {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    return attachMartisorBotanicalFinish(cloned, opts)
  }
  material.needsUpdate = true
  return material
}

export function createSpringBlossomMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.80, metalness: 0, envMapIntensity: 0.42 },
    { kind: 'fruit', strength: 0.20, fiber: false },
  )
  return attachMartisorBotanicalFinish(mat, {
    mode: 'petal',
    veinStrength: 0.70,
    wrapStrength: 0.23,
    rimStrength: 0.14,
    scatterTint: [1.09, 0.95, 0.90],
    knee: 0.74,
    headroom: 0.24,
  })
}

export function createSpringLeafMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.64, metalness: 0, envMapIntensity: 0.44 },
    { kind: 'leaf', strength: 0.18, fiber: false },
  )
  return attachMartisorBotanicalFinish(mat, {
    mode: 'leaf',
    veinStrength: 0.84,
    wrapStrength: 0.20,
    rimStrength: 0.12,
    scatterTint: [1.06, 1.12, 0.76],
    knee: 0.74,
    headroom: 0.24,
  })
}

export function createLivingBarkMaterial(): THREE.MeshStandardMaterial {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x7d5d43,
    roughness: 0.90,
    metalness: 0,
    envMapIntensity: 0.36,
  })
  return attachMartisorBotanicalFinish(mat, {
    mode: 'bark',
    veinStrength: 0.62,
    wrapStrength: 0.0,
    rimStrength: 0.0,
    scatterTint: [1.04, 0.98, 0.90],
    knee: 0.74,
    headroom: 0.24,
  })
}

type ShellSamplerXY = {
  segU: number
  segV: number
  /** Point in local petal/leaf space where +X is across width, +Y is base-to-tip, +Z is forward/cup normal. */
  point: (u: number, v: number, out: THREE.Vector3) => void
  thickness: (u: number, v: number) => number
  color: (u: number, v: number, isFront: boolean, out: THREE.Color) => void
}

/**
 * Watertight FrontSide thin-shell solid with front face pointing +Z ((+X du) x (+Y dv) = +Z).
 */
function buildThinShellXY(sampler: ShellSamplerXY): THREE.BufferGeometry {
  const { segU, segV } = sampler
  const cols = segU + 1
  const rows = segV + 1
  const layerVerts = cols * rows
  const totalVerts = layerVerts * 2

  const centers: THREE.Vector3[] = Array.from({ length: layerVerts }, () => new THREE.Vector3())
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    for (let iu = 0; iu <= segU; iu++) {
      const u = (iu / segU) * 2 - 1
      sampler.point(u, v, centers[iv * cols + iu]!)
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
      // (+X du) x (+Y dv) = +Z outward front normal.
      n.crossVectors(du, dv)
      if (n.lengthSq() < 1e-16) n.set(0, 0, 1)
      else n.normalize()

      const halfT = Math.max(0.0009, sampler.thickness(u, v) * 0.5)
      const frontIdx = idx
      const backIdx = layerVerts + idx

      positions[frontIdx * 3] = c.x + n.x * halfT
      positions[frontIdx * 3 + 1] = c.y + n.y * halfT
      positions[frontIdx * 3 + 2] = c.z + n.z * halfT
      uvs[frontIdx * 2] = uUv
      uvs[frontIdx * 2 + 1] = v
      sampler.color(u, v, true, col)
      colors[frontIdx * 3] = col.r
      colors[frontIdx * 3 + 1] = col.g
      colors[frontIdx * 3 + 2] = col.b

      positions[backIdx * 3] = c.x - n.x * halfT
      positions[backIdx * 3 + 1] = c.y - n.y * halfT
      positions[backIdx * 3 + 2] = c.z - n.z * halfT
      uvs[backIdx * 2] = uUv
      uvs[backIdx * 2 + 1] = v
      sampler.color(u, v, false, col)
      colors[backIdx * 3] = col.r
      colors[backIdx * 3 + 1] = col.g
      colors[backIdx * 3 + 2] = col.b
    }
  }

  const indices: number[] = []
  const top = (iu: number, iv: number) => iv * cols + iu
  const bot = (iu: number, iv: number) => layerVerts + iv * cols + iu

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = top(iu, iv), b = top(iu + 1, iv), c = top(iu, iv + 1), d = top(iu + 1, iv + 1)
      indices.push(a, b, d, a, d, c)
      const ba = bot(iu, iv), bb = bot(iu + 1, iv), bc = bot(iu, iv + 1), bd = bot(iu + 1, iv + 1)
      indices.push(ba, bd, bb, ba, bc, bd)
    }
  }
  for (let iu = 0; iu < segU; iu++) {
    indices.push(top(iu + 1, 0), top(iu, 0), bot(iu, 0), top(iu + 1, 0), bot(iu, 0), bot(iu + 1, 0))
    indices.push(top(iu, segV), top(iu + 1, segV), bot(iu + 1, segV), top(iu, segV), bot(iu + 1, segV), bot(iu, segV))
  }
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
 * Watertight FrontSide cupped spring-branch blossom petal facing +Z, extending
 * radially along +Y from throat (y = 0.012) to tip (y = radius), with rich
 * carmine/blush throat fading into delicate pale-pink/cream petal margins.
 * Kept strictly within the original blossom radial envelope to preserve exact
 * auto-fit camera coordinates.
 */
export function createSpringBlossomPetalGeometry(
  large: boolean,
  variant: 'blush' | 'cream',
): THREE.BufferGeometry {
  const s = large ? 0.105 : 0.078
  const rStart = s * 0.12
  // Match original blossom radial/depth envelope so auto-fit camera framing stays identical.
  const length = s * 1.04
  const maxHalfW = s * 0.54

  const cThroat = new THREE.Color(variant === 'blush' ? 0xc24968 : 0xcf5d78)
  const cMid = new THREE.Color(variant === 'blush' ? 0xee9eb0 : 0xf4c2c6)
  const cOuter = new THREE.Color(variant === 'blush' ? 0xf7cfd6 : 0xf8e3dc)
  const cTip = new THREE.Color(variant === 'blush' ? 0xfae5e8 : 0xfbf1e8)
  const cBack = new THREE.Color(variant === 'blush' ? 0xd98698 : 0xe4b5b6)

  return buildThinShellXY({
    segU: 6,
    segV: 8,
    point(u, v, out) {
      // Soft plump rounded apple/apricot spring blossom petal (smooth semicircular tip).
      let widthFactor: number
      if (v < 0.60) {
        const t = v / 0.60
        widthFactor = 0.22 + 0.78 * Math.sin(t * Math.PI * 0.5)
      } else {
        const t = (v - 0.60) / 0.40
        widthFactor = Math.cos(t * Math.PI * 0.42)
      }
      const halfW = maxHalfW * Math.max(0.20, widthFactor)
      const x = u * halfW
      const tipArc = 0.011 * (u * u) * Math.pow(THREE.MathUtils.smoothstep(v, 0.58, 1.0), 1.5)
      const y = rStart + v * length - tipArc
      // Cupped forward toward +Z, flaring gently back at the petal tip.
      const forwardCup = 0.004 + 0.025 * Math.sin(v * Math.PI * 0.78) - 0.009 * Math.pow(v, 2.2)
      const transCup = 0.009 * (u * u) * Math.sin(Math.PI * Math.pow(v, 0.76))
      // Slight gentle pinwheel lift so adjacent petals overlap cleanly without z-fighting.
      const pinwheel = u * 0.0038 * Math.sin(Math.PI * v)
      out.set(x, y, forwardCup + transCup + pinwheel)
    },
    thickness(u, v) {
      return 0.0042 * (1 - 0.34 * u * u) * (1 - 0.30 * v * v)
    },
    color(u, v, isFront, out) {
      const t = THREE.MathUtils.clamp(v + Math.pow(Math.abs(u), 1.6) * 0.14, 0, 1)
      if (t < 0.28) out.copy(cThroat).lerp(cMid, THREE.MathUtils.smoothstep(t, 0, 0.28))
      else if (t < 0.64) out.copy(cMid).lerp(cOuter, THREE.MathUtils.smoothstep(t, 0.28, 0.64))
      else out.copy(cOuter).lerp(cTip, THREE.MathUtils.smoothstep(t, 0.64, 1.0))
      if (!isFront) out.lerp(cBack, 0.50)
    },
  })
}

/** Watertight sculpted golden-amber spring blossom stamen cluster facing +Z. */
export function createSpringPollenGeometry(large: boolean): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 14, 10)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const scaleXY = large ? 0.025 : 0.021
  const scaleZ = large ? 0.015 : 0.013
  const cBase = new THREE.Color(0xc45368)
  const cGold = new THREE.Color(0xe0a136)
  const cTip = new THREE.Color(0xf6d878)
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = Math.hypot(x, y)
    const a = Math.atan2(y, x)
    const tuft = 1 + 0.12 * Math.cos(a * 7) * r
    pos.setXYZ(i, x * scaleXY * tuft, y * scaleXY * tuft, z * scaleZ)
    const t = THREE.MathUtils.clamp((z + 1) * 0.5, 0, 1)
    if (t < 0.38) tmp.copy(cBase).lerp(cGold, t / 0.38)
    else tmp.copy(cGold).lerp(cTip, (t - 0.38) / 0.62)
    colors[i * 3] = tmp.r
    colors[i * 3 + 1] = tmp.g
    colors[i * 3 + 2] = tmp.b
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.computeVertexNormals()
  geo.computeBoundingBox()
  geo.computeBoundingSphere()
  return geo
}

/**
 * Watertight FrontSide midrib-folded young fruit-tree spring leaf centered near
 * local origin (y in [-0.094, +0.094], x in [-0.032, +0.032], z in [-0.010, +0.014])
 * so it matches the original 3 leaves' placement and camera envelope cleanly.
 */
export function createYoungBranchLeafGeometry(): THREE.BufferGeometry {
  const cBase = new THREE.Color(0x588144)
  const cMid = new THREE.Color(0x7aa957)
  const cTip = new THREE.Color(0x9ec46d)
  const cRib = new THREE.Color(0xb6d682)
  const cBack = new THREE.Color(0x4e733e)

  const length = 0.186
  const maxHalfW = 0.033

  return buildThinShellXY({
    segU: 6,
    segV: 6,
    point(u, v, out) {
      // Pointed ovate-lanceolate young spring shoot leaf.
      const silhouette = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.86)), 0.78)
      const halfW = maxHalfW * Math.max(0.13, (0.12 * (1 - v) + silhouette * 0.96))
      const x = u * halfW
      const y = (v - 0.5) * length
      // Crisp ~15-degree midrib V-fold + gentle forward-arching leaf curve.
      const arch = 0.012 * Math.sin(v * Math.PI * 0.85) - 0.004
      const vFold = 0.0088 * Math.abs(u) * Math.sin(Math.PI * v)
      out.set(x, y, arch + vFold)
    },
    thickness(u, v) {
      return 0.0042 * (1 - 0.34 * u * u) * (1 - 0.28 * v * v)
    },
    color(u, v, isFront, out) {
      const midrib = Math.exp(-u * u * 18) * (1 - v * 0.45) * 0.35
      out.copy(cBase).lerp(cMid, THREE.MathUtils.smoothstep(v, 0.05, 0.55))
      out.lerp(cTip, THREE.MathUtils.smoothstep(v, 0.55, 1.0))
      out.lerp(cRib, midrib)
      if (!isFront) out.lerp(cBack, 0.48)
    },
  })
}
