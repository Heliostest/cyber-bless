import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

export type CanangBotanicalMode = 'petal' | 'leaf-parallel' | 'leaf-pinnate'

type BotanicalFinishOptions = {
  mode: CanangBotanicalMode
  veinStrength: number
  wrapStrength: number
  rimStrength: number
  scatterTint: readonly [number, number, number]
  knee?: number
  headroom?: number
}

/**
 * Single-pass Komorebi botanical finish: analytical anti-aliased veins, soft
 * forward-wrap subsurface warmth, subtle grazing velvet/cuticle rim, and a C1
 * highlight shoulder (knee = 0.74, headroom = 0.24) so pale sunlit petals keep
 * warm throat gradients and overlap shading without clipping to flat white.
 * Overrides `.clone()` so `toon-surfaces.ts` preserves the hook in `toon-soft`.
 */
function attachBotanicalFinish(material: THREE.MeshStandardMaterial, opts: BotanicalFinishOptions): THREE.MeshStandardMaterial {
  const knee = (opts.knee ?? 0.74).toFixed(3)
  const headroom = (opts.headroom ?? 0.24).toFixed(3)
  const baseCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey.bind(material)()

  const veinSnippet = opts.mode === 'petal'
    ? `
      float botU = wbrBotUv.x * 2.0 - 1.0;
      float botV = clamp(wbrBotUv.y, 0.0, 1.0);
      float botFan = botU / (0.38 + 0.62 * sqrt(max(botV, 0.01)));
      float botRib = wbrBotWave(botFan * 18.849556) * sin(botV * 3.14159265) * (1.0 - 0.32 * botU * botU);
      float botMid = exp(-botU * botU * 22.0) * sin(botV * 3.14159265);
      float botPattern = (botRib * 0.62 + botMid * 0.38) * wbrBotVeinStrength;
      diffuseColor.rgb *= 1.0 + botPattern * 0.075;
    `
    : opts.mode === 'leaf-parallel'
      ? `
        float botU = wbrBotUv.x * 2.0 - 1.0;
        float botSpine = exp(-botU * botU * 28.0);
        float botRibs = wbrBotWave(botU * 25.132741) * (1.0 - 0.22 * botU * botU);
        float botPattern = (botSpine * 0.58 + botRibs * 0.42) * wbrBotVeinStrength;
        diffuseColor.rgb *= 1.0 + botPattern * 0.10;
      `
      : `
        float botU = wbrBotUv.x * 2.0 - 1.0;
        float botV = clamp(wbrBotUv.y, 0.0, 1.0);
        float botEnv = sin(botV * 3.14159265);
        float botMid = exp(-botU * botU * 34.0) * (1.0 - botV * 0.45);
        float botLat = wbrBotWave((botV * 5.0 - abs(botU) * 1.4) * 6.2831853)
          * smoothstep(0.06, 0.26, abs(botU)) * (1.0 - smoothstep(0.74, 0.98, abs(botU))) * botEnv;
        float botPattern = (botMid * 0.68 + botLat * 0.40) * wbrBotVeinStrength;
        diffuseColor.rgb *= 1.0 + botPattern * 0.11;
      `

  material.onBeforeCompile = function (shader, renderer) {
    baseCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_CANANG_BOTANICAL')) return
    shader.uniforms.wbrBotVeinStrength = { value: opts.veinStrength }
    shader.uniforms.wbrBotWrapStrength = { value: opts.wrapStrength }
    shader.uniforms.wbrBotRimStrength = { value: opts.rimStrength }
    shader.uniforms.wbrBotScatterTint = { value: new THREE.Vector3(...opts.scatterTint) }

    shader.vertexShader = 'varying vec2 wbrBotUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrBotUv = uv;
    `)

    const header = `
#define WBR_CANANG_BOTANICAL
varying vec2 wbrBotUv;
uniform float wbrBotVeinStrength;
uniform float wbrBotWrapStrength;
uniform float wbrBotRimStrength;
uniform vec3 wbrBotScatterTint;
float wbrBotWave(float phase) {
  float f = fwidth(phase);
  return sin(phase) * exp(-0.42 * f * f);
}
`
    shader.fragmentShader = header + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        ${veinSnippet}
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - botPattern * 0.10, 0.34, 0.96);
      `)
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          vec3 botKeyDir = directionalLights[0].direction;
          vec3 botKeyCol = directionalLights[0].color;
          float botNdotL = dot(geometryNormal, botKeyDir);
          float botWrap = smoothstep(-0.46, 0.62, botNdotL) * (1.0 - max(0.0, botNdotL) * 0.58);
          float botBack = max(0.0, -botNdotL) * 0.44;
          float botRim = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 2.5);
          float botLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float botHeadroom = mix(1.0, 0.60, smoothstep(0.48, 0.90, botLuma));
          vec3 botPigment = diffuseColor.rgb * wbrBotScatterTint;
          reflectedLight.directDiffuse += botPigment * botKeyCol
            * ((botWrap + botBack) * wbrBotWrapStrength + botRim * wbrBotRimStrength)
            * botHeadroom * 0.31830988618;
        #endif
        #if defined( RE_IndirectDiffuse )
          float botAmb = min(1.0, length(irradiance) * 0.35);
          reflectedLight.indirectDiffuse = max(
            reflectedLight.indirectDiffuse,
            diffuseColor.rgb * wbrBotScatterTint * (0.15 * botAmb)
          );
        #endif
      `)
      .replace('#include <opaque_fragment>', `
        vec3 botLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float botPeak = max(botLit.r, max(botLit.g, botLit.b));
        if (botPeak > ${knee}) {
          float botExcess = botPeak - ${knee};
          float botTarget = ${knee} + ${headroom} * (botExcess / (botExcess + ${headroom}));
          outgoingLight = botLit * (botTarget / botPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `)
  }

  material.customProgramCacheKey = () =>
    `${baseKey}|wbr-canang-bot-v1:${opts.mode}:${knee}:${headroom}`
  material.userData.botanicalFinish = { ...opts, knee: opts.knee ?? 0.74, headroom: opts.headroom ?? 0.24 }

  material.clone = function () {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    return attachBotanicalFinish(cloned, opts)
  }

  material.needsUpdate = true
  return material
}

export function createCanangPetalMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.80, metalness: 0, envMapIntensity: 0.42 },
    { kind: 'fruit', strength: 0.16, fiber: false },
  )
  return attachBotanicalFinish(mat, {
    mode: 'petal',
    veinStrength: 0.72,
    wrapStrength: 0.22,
    rimStrength: 0.12,
    scatterTint: [1.08, 0.99, 0.88],
    knee: 0.74,
    headroom: 0.24,
  })
}

export function createCanangLeafMaterial(mode: 'leaf-parallel' | 'leaf-pinnate' = 'leaf-parallel'): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: mode === 'leaf-parallel' ? 0.62 : 0.66, metalness: 0, envMapIntensity: 0.44 },
    { kind: 'leaf', strength: 0.18, fiber: false },
  )
  return attachBotanicalFinish(mat, {
    mode,
    veinStrength: 0.85,
    wrapStrength: 0.18,
    rimStrength: 0.11,
    scatterTint: [1.06, 1.12, 0.76],
    knee: 0.74,
    headroom: 0.24,
  })
}

type ThinShellSampler = {
  segU: number
  segV: number
  /** Centerline point S(u in [-1, 1], v in [0, 1]) in local petal/leaf space. */
  point: (u: number, v: number, out: THREE.Vector3) => void
  /** Local shell thickness > 0 at (u, v). */
  thickness: (u: number, v: number) => number
  /** Linear vertex color at (u, v, isTop). */
  color: (u: number, v: number, isTop: boolean, out: THREE.Color) => void
}

/**
 * Builds a strictly watertight, FrontSide, closed manifold thin-shell solid
 * (top grid + bottom grid + stitched 4-side perimeter wall) with strictly
 * positive signed volume and zero collapsed triangles.
 */
function buildWatertightThinShell(sampler: ThinShellSampler): THREE.BufferGeometry {
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
      // (+Z dv) x (+X du) = +Y top outward normal.
      n.crossVectors(dv, du)
      if (n.lengthSq() < 1e-16) n.set(0, 1, 0)
      else n.normalize()

      const halfT = Math.max(0.0009, sampler.thickness(u, v) * 0.5)
      const topIdx = idx
      const botIdx = layerVerts + idx

      positions[topIdx * 3] = c.x + n.x * halfT
      positions[topIdx * 3 + 1] = c.y + n.y * halfT
      positions[topIdx * 3 + 2] = c.z + n.z * halfT
      uvs[topIdx * 2] = uUv
      uvs[topIdx * 2 + 1] = v
      sampler.color(u, v, true, col)
      colors[topIdx * 3] = col.r
      colors[topIdx * 3 + 1] = col.g
      colors[topIdx * 3 + 2] = col.b

      positions[botIdx * 3] = c.x - n.x * halfT
      positions[botIdx * 3 + 1] = c.y - n.y * halfT
      positions[botIdx * 3 + 2] = c.z - n.z * halfT
      uvs[botIdx * 2] = uUv
      uvs[botIdx * 2 + 1] = v
      sampler.color(u, v, false, col)
      colors[botIdx * 3] = col.r
      colors[botIdx * 3 + 1] = col.g
      colors[botIdx * 3 + 2] = col.b
    }
  }

  const indices: number[] = []
  const top = (iu: number, iv: number) => iv * cols + iu
  const bot = (iu: number, iv: number) => layerVerts + iv * cols + iu

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = top(iu, iv), b = top(iu + 1, iv), c = top(iu, iv + 1), d = top(iu + 1, iv + 1)
      indices.push(a, c, b, b, c, d)
      const ba = bot(iu, iv), bb = bot(iu + 1, iv), bc = bot(iu, iv + 1), bd = bot(iu + 1, iv + 1)
      indices.push(ba, bb, bc, bb, bd, bc)
    }
  }

  // Base rim (iv = 0) & tip rim (iv = segV)
  for (let iu = 0; iu < segU; iu++) {
    indices.push(top(iu, 0), top(iu + 1, 0), bot(iu + 1, 0), top(iu, 0), bot(iu + 1, 0), bot(iu, 0))
    indices.push(top(iu + 1, segV), top(iu, segV), bot(iu, segV), top(iu + 1, segV), bot(iu, segV), bot(iu + 1, segV))
  }
  // Left rim (iu = 0) & right rim (iu = segU)
  for (let iv = 0; iv < segV; iv++) {
    indices.push(top(0, iv + 1), top(0, iv), bot(0, iv), top(0, iv + 1), bot(0, iv), bot(0, iv + 1))
    indices.push(top(segU, iv), top(segU, iv + 1), bot(segU, iv + 1), top(segU, iv), bot(segU, iv + 1), bot(segU, iv))
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

export type CanangFlowerPalette = {
  throat: number
  mid: number
  body: number
  tip: number
  under: number
  heartCenter: number
  heartOuter: number
}

/**
 * Distinct cardinal flower palettes (white, red, yellow, blue) with authentic
 * Balinese frangipani / jepun warm-gold throat graduation softly calibrated for
 * Komorebi daylight.
 */
export const CANANG_FLOWER_PALETTES: Record<'white' | 'red' | 'yellow' | 'blue', CanangFlowerPalette> = {
  white: {
    throat: 0xe6a62a,
    mid: 0xf4dc8e,
    body: 0xf5efe0,
    tip: 0xfaf5ea,
    under: 0xe7dec6,
    heartCenter: 0xd98f1e,
    heartOuter: 0xf2be4b,
  },
  red: {
    throat: 0xe3a030,
    mid: 0xde6f74,
    body: 0xd14c64,
    tip: 0xc2405c,
    under: 0xb03a54,
    heartCenter: 0xcf7e1c,
    heartOuter: 0xebb443,
  },
  yellow: {
    throat: 0xd97d1d,
    mid: 0xeba932,
    body: 0xf0c14b,
    tip: 0xf5d46e,
    under: 0xd8a236,
    heartCenter: 0xc66b14,
    heartOuter: 0xe7a733,
  },
  blue: {
    throat: 0xdcb858,
    mid: 0x8da4d0,
    body: 0x6b89c6,
    tip: 0x5c7ab9,
    under: 0x5571ac,
    heartCenter: 0xc98c24,
    heartOuter: 0xe6bb53,
  },
}

/**
 * Builds a single cupped frangipani / jepun petal extending outward along +Z
 * from throat (z = 0.012) to rounded obovate tip (z = 0.172), with gentle
 * pinwheel twist so five arranged petals overlap naturally around the flower throat.
 */
export function createJepunPetalGeometry(palette: CanangFlowerPalette): THREE.BufferGeometry {
  const cThroat = new THREE.Color(palette.throat)
  const cMid = new THREE.Color(palette.mid)
  const cBody = new THREE.Color(palette.body)
  const cTip = new THREE.Color(palette.tip)
  const cUnder = new THREE.Color(palette.under)
  const tmp = new THREE.Color()

  const length = 0.160
  const maxHalfW = 0.066

  return buildWatertightThinShell({
    segU: 6,
    segV: 8,
    point(u, v, out) {
      // Lush rounded obovate Balinese frangipani / jepun petal: narrow throat claw,
      // broad spoon-like belly at v = 0.62, and a genuinely rounded circular tip.
      let widthFactor: number
      if (v < 0.62) {
        const t = v / 0.62
        widthFactor = 0.24 + 0.76 * Math.sin(t * Math.PI * 0.5)
      } else {
        const t = (v - 0.62) / 0.38
        widthFactor = Math.cos(t * Math.PI * 0.42)
      }
      const halfW = maxHalfW * Math.max(0.20, widthFactor)

      // Subtle authentic jepun petal asymmetry (slightly fuller trailing edge).
      const asym = u * halfW + halfW * 0.08 * Math.sin(Math.PI * v) * (1 - u * u * 0.35)
      const tipArc = 0.009 * (u * u) * Math.pow(THREE.MathUtils.smoothstep(v, 0.62, 1.0), 1.5)
      const z = 0.012 + v * length - tipArc

      // Graceful upward cup arch from calyx throat + concave transverse scoop + soft outward tip relax.
      const rise = 0.018 + 0.044 * Math.sin(v * Math.PI * 0.72) + 0.007 * v
      const transverseCup = 0.0155 * (u * u) * Math.sin(Math.PI * Math.pow(v, 0.74))
      const tipSoft = -0.0045 * Math.pow(Math.max(0, (v - 0.68) / 0.32), 2.0)
      // Gentle pinwheel roll so each petal's edge rides cleanly over its neighbor.
      const pinwheel = u * 0.0095 * Math.sin(Math.PI * Math.pow(v, 0.65))
      const y = rise + transverseCup + tipSoft + pinwheel

      out.set(asym, y, z)
    },
    thickness(u, v) {
      const edgeTaper = 1 - 0.36 * u * u
      const tipTaper = 1 - 0.30 * v * v
      return 0.0062 * edgeTaper * tipTaper
    },
    color(u, v, isTop, out) {
      // Rich warm golden frangipani throat radiating gently outward into the petal's cardinal hue.
      const radialBoost = Math.pow(Math.abs(u), 1.7) * 0.14
      const t = THREE.MathUtils.clamp(v + radialBoost, 0, 1)
      if (t < 0.34) {
        out.copy(cThroat).lerp(cMid, THREE.MathUtils.smoothstep(t, 0.0, 0.34))
      } else if (t < 0.68) {
        out.copy(cMid).lerp(cBody, THREE.MathUtils.smoothstep(t, 0.34, 0.68))
      } else {
        out.copy(cBody).lerp(cTip, THREE.MathUtils.smoothstep(t, 0.68, 1.0))
      }
      // Gentle warm rim shading & slightly deeper underside for crisp petal-to-petal readability.
      if (!isTop) {
        tmp.copy(cUnder)
        out.lerp(tmp, 0.52)
      } else {
        const cupCrease = Math.exp(-u * u * 10.0) * (1 - v) * 0.06
        out.multiplyScalar(1 - cupCrease)
      }
    },
  })
}

/**
 * Watertight sculpted golden floral throat / stamen cushion nestled at the
 * center of the five cupped frangipani petals.
 */
export function createJepunHeartGeometry(palette: CanangFlowerPalette): THREE.BufferGeometry {
  const cCenter = new THREE.Color(palette.heartCenter)
  const cOuter = new THREE.Color(palette.heartOuter)
  const geo = new THREE.SphereGeometry(1, 14, 10)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const angle = Math.atan2(z, x)
    const rHoriz = Math.hypot(x, z)
    // Five-lobed soft stamen dimple matching the 5-petal radial symmetry.
    const lobe = 1 + 0.08 * Math.cos(angle * 5) * rHoriz
    const sx = x * 0.030 * lobe
    const sz = z * 0.030 * lobe
    const sy = 0.029 + (y > 0 ? y * 0.015 * (1 - 0.14 * rHoriz * rHoriz) : y * 0.010)
    pos.setXYZ(i, sx, sy, sz)

    const t = THREE.MathUtils.clamp(rHoriz * 0.85 + (y > 0 ? 0.18 : 0), 0, 1)
    tmp.copy(cCenter).lerp(cOuter, t)
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
 * Closed watertight tapered green receptacle / calyx sitting cleanly on y = 0.000
 * so `flowerWhite` rests flush on the y = 0.12 stone paving without floating or sinking.
 */
export function createJepunCalyxGeometry(): THREE.BufferGeometry {
  const geo = new THREE.CylinderGeometry(0.042, 0.031, 0.020, 12, 1, false)
  geo.translate(0, 0.010, 0)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const cBot = new THREE.Color(0x55753d)
  const cTop = new THREE.Color(0x7c9c4e)
  const tmp = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = THREE.MathUtils.clamp(pos.getY(i) / 0.020, 0, 1)
    tmp.copy(cBot).lerp(cTop, t)
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
 * Thin, gently arched watertight shredded pandan leaf strip (`canang-pandan-strip-*`),
 * normalized so its exact lowest vertex lies at local `y = 0.000` (keeping the
 * pandan bundle resting flush on `canang-sampiyan-weave-0`'s top surface).
 */
export function createPandanStripGeometry(variant: number): THREE.BufferGeometry {
  const cBase = new THREE.Color(variant % 2 === 0 ? 0x4b8040 : 0x578c47)
  const cMid = new THREE.Color(variant % 2 === 0 ? 0x679d4e : 0x72a655)
  const cTip = new THREE.Color(0x88b862)
  const cUnder = new THREE.Color(0x3f6f37)

  const length = 0.162 + (variant % 3 - 1) * 0.008
  const halfW = 0.0086
  const archH = 0.0135 + (variant % 2) * 0.0025
  const curveX = ((variant % 3) - 1) * 0.0065

  const geo = buildWatertightThinShell({
    segU: 4,
    segV: 7,
    point(u, v, out) {
      const s = v * 2 - 1 // -1..1 along strip length
      // Gently tapered shredded pandan ends (never zero width -> zero collapsed triangles).
      const endTaper = 1 - 0.56 * Math.pow(Math.abs(s), 2.4)
      const x = u * halfW * endTaper + curveX * (1 - s * s)
      const z = s * (length * 0.5)
      // Graceful arch over center + subtle V-trough fold typical of pandan blades.
      const arch = archH * Math.cos(s * Math.PI * 0.5)
      const vFold = 0.0024 * Math.abs(u) * endTaper
      out.set(x, arch + vFold, z)
    },
    thickness(u, v) {
      const s = v * 2 - 1
      return 0.0036 * (1 - 0.25 * u * u) * (1 - 0.22 * s * s)
    },
    color(u, v, isTop, out) {
      const s = Math.abs(v * 2 - 1)
      const midrib = Math.exp(-u * u * 16) * 0.35
      out.copy(cBase).lerp(cMid, THREE.MathUtils.clamp(0.45 + midrib, 0, 1))
      out.lerp(cTip, Math.pow(s, 1.5) * 0.42)
      if (!isTop) out.lerp(cUnder, 0.45)
    },
  })

  // Normalize exact minimum Y to 0.000 so stacking height on the woven mat is exact.
  geo.computeBoundingBox()
  const minY = geo.boundingBox!.min.y
  if (minY !== 0) {
    geo.translate(0, -minY, 0)
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
  }
  return geo
}

/**
 * Watertight folded / rolled betel-leaf packet (`canang-porosan-leaf`) cradling
 * the betel nut and lime neatly in its upper fold pocket (`y in [0, 0.106]`).
 */
export function createPorosanLeafRollGeometry(): THREE.BufferGeometry {
  const cDark = new THREE.Color(0x3f6c36)
  const cMid = new THREE.Color(0x578944)
  const cVein = new THREE.Color(0x7daa56)
  const cInner = new THREE.Color(0x365b2e)

  const length = 0.215
  const geo = buildWatertightThinShell({
    segU: 10,
    segV: 7,
    point(u, v, out) {
      // u in [-1, 1] wraps around a soft U-folded / slightly spiral-rolled leaf cylinder.
      const s = v * 2 - 1 // -1..1 along packet length
      // Gently tapered folded ends like a real pinned betel-leaf roll.
      const endPinch = 1 - 0.36 * s * s
      // Wrap angle from -0.78*PI to +0.86*PI creates an authentic overlapping rolled cradle
      // with an open top crease where the betel nut and lime rest visibly.
      const theta = THREE.MathUtils.lerp(-Math.PI * 0.76, Math.PI * 0.84, (u + 1) * 0.5)
      // Slight spiral radius offset keeps overlapping margins cleanly separated.
      const spiral = 1 + 0.09 * u
      const rx = 0.058 * endPinch * spiral
      const ry = 0.048 * endPinch * spiral
      const x = Math.sin(theta) * rx
      const y = 0.052 - Math.cos(theta) * ry + 0.004 * (1 - s * s)
      const z = s * (length * 0.5)
      out.set(x, y, z)
    },
    thickness(u, v) {
      const s = v * 2 - 1
      return 0.0072 * (1 - 0.22 * u * u) * (1 - 0.18 * s * s)
    },
    color(u, v, isTop, out) {
      const s = Math.abs(v * 2 - 1)
      const foldCrease = Math.exp(-u * u * 8) * 0.30
      const edgeHighlight = THREE.MathUtils.smoothstep(Math.abs(u), 0.55, 0.96) * 0.35
      out.copy(cMid).lerp(cVein, edgeHighlight + (1 - s) * 0.16)
      out.lerp(cDark, foldCrease + s * 0.22)
      if (!isTop) out.lerp(cInner, 0.45)
    },
  })

  geo.computeBoundingBox()
  const minY = geo.boundingBox!.min.y
  if (minY !== 0) {
    geo.translate(0, -minY, 0)
    geo.computeBoundingBox()
    geo.computeBoundingSphere()
  }
  return geo
}
