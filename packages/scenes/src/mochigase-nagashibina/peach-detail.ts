import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

type PeachFinishOptions = {
  mode: 'petal' | 'leaf'
  veinStrength: number
  wrapStrength: number
  rimStrength: number
  scatterTint: readonly [number, number, number]
  knee?: number
  headroom?: number
}

/**
 * Single-pass Komorebi botanical finish for Mochigase Nagashibina's peach
 * blossoms and young sprig leaves: silky analytical veining, soft translucent
 * wrap light, grazing velvet rim, and C1 highlight shoulder (knee = 0.74,
 * headroom = 0.24) to prevent pale pink petal blowout.
 */
function attachPeachFinish(material: THREE.MeshStandardMaterial, opts: PeachFinishOptions): THREE.MeshStandardMaterial {
  const knee = (opts.knee ?? 0.74).toFixed(3)
  const headroom = (opts.headroom ?? 0.24).toFixed(3)
  const baseCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey.bind(material)()

  const veinSnippet = opts.mode === 'petal'
    ? `
      float pchU = wbrPchUv.x * 2.0 - 1.0;
      float pchV = clamp(wbrPchUv.y, 0.0, 1.0);
      float pchFan = pchU / (0.38 + 0.62 * sqrt(max(pchV, 0.01)));
      float pchPattern = (wbrPchWave(pchFan * 18.849556) * 0.64 + exp(-pchU * pchU * 22.0) * 0.36)
        * sin(pchV * 3.14159265) * wbrPchVein;
      diffuseColor.rgb *= 1.0 + pchPattern * 0.075;
    `
    : `
      float pchU = wbrPchUv.x * 2.0 - 1.0;
      float pchV = clamp(wbrPchUv.y, 0.0, 1.0);
      float pchMid = exp(-pchU * pchU * 32.0) * (1.0 - pchV * 0.45);
      float pchLat = wbrPchWave((pchV * 4.5 - abs(pchU) * 1.4) * 6.2831853)
        * smoothstep(0.08, 0.28, abs(pchU)) * sin(pchV * 3.14159265);
      float pchPattern = (pchMid * 0.70 + pchLat * 0.35) * wbrPchVein;
      diffuseColor.rgb *= 1.0 + pchPattern * 0.10;
    `

  material.onBeforeCompile = function (shader, renderer) {
    baseCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_PEACH_BOTANICAL')) return
    shader.uniforms.wbrPchVein = { value: opts.veinStrength }
    shader.uniforms.wbrPchWrap = { value: opts.wrapStrength }
    shader.uniforms.wbrPchRim = { value: opts.rimStrength }
    shader.uniforms.wbrPchTint = { value: new THREE.Vector3(...opts.scatterTint) }

    shader.vertexShader = 'varying vec2 wbrPchUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrPchUv = uv;
    `)

    const header = `
#define WBR_PEACH_BOTANICAL
varying vec2 wbrPchUv;
uniform float wbrPchVein;
uniform float wbrPchWrap;
uniform float wbrPchRim;
uniform vec3 wbrPchTint;
float wbrPchWave(float phase) {
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
        roughnessFactor = clamp(roughnessFactor - pchPattern * 0.09, 0.36, 0.96);
      `)
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          vec3 pchKeyDir = directionalLights[0].direction;
          vec3 pchKeyCol = directionalLights[0].color;
          float pchNdotL = dot(geometryNormal, pchKeyDir);
          float pchWrap = smoothstep(-0.46, 0.62, pchNdotL) * (1.0 - max(0.0, pchNdotL) * 0.56);
          float pchBack = max(0.0, -pchNdotL) * 0.46;
          float pchRim = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 2.5);
          float pchLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float pchHead = mix(1.0, 0.60, smoothstep(0.48, 0.90, pchLuma));
          reflectedLight.directDiffuse += (diffuseColor.rgb * wbrPchTint) * pchKeyCol
            * ((pchWrap + pchBack) * wbrPchWrap + pchRim * wbrPchRim) * pchHead * 0.31830988618;
        #endif
        #if defined( RE_IndirectDiffuse )
          float pchAmb = min(1.0, length(irradiance) * 0.35);
          reflectedLight.indirectDiffuse = max(
            reflectedLight.indirectDiffuse,
            diffuseColor.rgb * wbrPchTint * (0.16 * pchAmb)
          );
        #endif
      `)
      .replace('#include <opaque_fragment>', `
        vec3 pchLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float pchPeak = max(pchLit.r, max(pchLit.g, pchLit.b));
        if (pchPeak > ${knee}) {
          float pchExcess = pchPeak - ${knee};
          float pchTarget = ${knee} + ${headroom} * (pchExcess / (pchExcess + ${headroom}));
          outgoingLight = pchLit * (pchTarget / pchPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `)
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-peach-bot-v1:${opts.mode}:${knee}:${headroom}`
  material.userData.botanicalFinish = { mode: opts.mode, knee: opts.knee ?? 0.74, headroom: opts.headroom ?? 0.24 }
  material.clone = function () {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    return attachPeachFinish(cloned, opts)
  }
  material.needsUpdate = true
  return material
}

export function createPeachPetalMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.42 },
    { kind: 'fruit', strength: 0.22, fiber: false },
  )
  return attachPeachFinish(mat, {
    mode: 'petal',
    veinStrength: 0.72,
    wrapStrength: 0.24,
    rimStrength: 0.14,
    scatterTint: [1.10, 0.94, 0.90],
    knee: 0.74,
    headroom: 0.24,
  })
}

export function createPeachLeafMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.64, metalness: 0, envMapIntensity: 0.42 },
    { kind: 'leaf', strength: 0.16, fiber: false },
  )
  return attachPeachFinish(mat, {
    mode: 'leaf',
    veinStrength: 0.78,
    wrapStrength: 0.18,
    rimStrength: 0.11,
    scatterTint: [1.06, 1.12, 0.76],
    knee: 0.74,
    headroom: 0.24,
  })
}

/**
 * Watertight FrontSide cupped peach blossom petal extending outward along +Z
 * with a signature Prunus central tip notch and a deep-rose throat fading to
 * soft blush-peach lobes.
 */
export function createNotchedPeachPetalGeometry(): THREE.BufferGeometry {
  const segU = 8
  const segV = 6
  const cols = segU + 1
  const rows = segV + 1
  const layerVerts = cols * rows
  const totalVerts = layerVerts * 2

  const cThroat = new THREE.Color(0xb84664)
  const cMid = new THREE.Color(0xe6889d)
  const cOuter = new THREE.Color(0xf4bec8)
  const cRim = new THREE.Color(0xfae0e4)
  const cUnder = new THREE.Color(0xd27289)

  const length = 0.050
  const maxHalfW = 0.0255

  const centers: THREE.Vector3[] = Array.from({ length: layerVerts }, () => new THREE.Vector3())
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    // Rounded heart-obovate peach petal silhouette: narrow throat, plump upper lobes.
    const belly = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.70)), 0.76)
    const tipRound = 1 - 0.52 * Math.pow(Math.max(0, (v - 0.80) / 0.20), 2.0)
    const halfW = maxHalfW * Math.max(0.18, (0.20 * (1 - v) + belly * 0.96) * tipRound)

    for (let iu = 0; iu <= segU; iu++) {
      const u = (iu / segU) * 2 - 1
      const x = u * halfW
      // Delicate central apical notch cleft at u = 0 near the tip (v -> 1).
      const notch = 0.0085 * Math.exp(-u * u * 16.0) * Math.pow(THREE.MathUtils.smoothstep(v, 0.55, 1.0), 1.6)
      // Twin soft rounded lobes flanking the notch push slightly farther forward.
      const lobePush = 0.0032 * Math.exp(-Math.pow((Math.abs(u) - 0.46) / 0.34, 2)) * Math.pow(v, 1.8)
      const z = 0.006 + v * length - notch + lobePush

      // Cupped chalice profile rising gently upward + concave transverse cradle.
      const rise = 0.001 + 0.022 * Math.sin(v * Math.PI * 0.72) + 0.004 * v
      const cup = 0.0068 * (u * u) * Math.sin(Math.PI * Math.pow(v, 0.76))
      const notchDip = -0.0018 * Math.exp(-u * u * 18.0) * Math.pow(v, 2.0)
      centers[iv * cols + iu]!.set(x, rise + cup + notchDip, z)
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
      n.crossVectors(dv, du)
      if (n.lengthSq() < 1e-16) n.set(0, 1, 0)
      else n.normalize()

      const halfT = Math.max(0.0008, 0.0036 * (1 - 0.35 * u * u) * (1 - 0.28 * v * v) * 0.5)
      const topIdx = idx
      const botIdx = layerVerts + idx

      const t = THREE.MathUtils.clamp(v + Math.pow(Math.abs(u), 1.6) * 0.12, 0, 1)
      if (t < 0.28) col.copy(cThroat).lerp(cMid, THREE.MathUtils.smoothstep(t, 0, 0.28))
      else if (t < 0.68) col.copy(cMid).lerp(cOuter, THREE.MathUtils.smoothstep(t, 0.28, 0.68))
      else col.copy(cOuter).lerp(cRim, THREE.MathUtils.smoothstep(t, 0.68, 1.0))

      positions[topIdx * 3] = c.x + n.x * halfT
      positions[topIdx * 3 + 1] = c.y + n.y * halfT
      positions[topIdx * 3 + 2] = c.z + n.z * halfT
      uvs[topIdx * 2] = uUv
      uvs[topIdx * 2 + 1] = v
      colors[topIdx * 3] = col.r
      colors[topIdx * 3 + 1] = col.g
      colors[topIdx * 3 + 2] = col.b

      col.lerp(cUnder, 0.45)
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

  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = top(iu, iv), b = top(iu + 1, iv), c = top(iu, iv + 1), d = top(iu + 1, iv + 1)
      indices.push(a, c, b, b, c, d)
      const ba = bot(iu, iv), bb = bot(iu + 1, iv), bc = bot(iu, iv + 1), bd = bot(iu + 1, iv + 1)
      indices.push(ba, bb, bc, bb, bd, bc)
    }
  }
  for (let iu = 0; iu < segU; iu++) {
    indices.push(top(iu, 0), top(iu + 1, 0), bot(iu + 1, 0), top(iu, 0), bot(iu + 1, 0), bot(iu, 0))
    indices.push(top(iu + 1, segV), top(iu, segV), bot(iu, segV), top(iu + 1, segV), bot(iu, segV), bot(iu + 1, segV))
  }
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

/** Watertight fluted golden-amber stamen cluster for the peach blossom core. */
export function createPeachHeartGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 14, 10)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const cBase = new THREE.Color(0xc56256)
  const cMid = new THREE.Color(0xe5ae40)
  const cAnther = new THREE.Color(0xf7dc82)
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const a = Math.atan2(z, x)
    const tuft = 1 + 0.14 * Math.cos(a * 7) * r
    pos.setXYZ(i, x * 0.0155 * tuft, y * 0.0105, z * 0.0155 * tuft)
    const t = THREE.MathUtils.clamp((y + 1) * 0.5, 0, 1)
    if (t < 0.42) tmp.copy(cBase).lerp(cMid, t / 0.42)
    else tmp.copy(cMid).lerp(cAnther, (t - 0.42) / 0.58)
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

/** Tiny watertight midrib-folded young lanceolate peach leaf along +Z. */
export function createYoungPeachLeafGeometry(): THREE.BufferGeometry {
  const segU = 4
  const segV = 5
  const cols = segU + 1
  const rows = segV + 1
  const layerVerts = cols * rows
  const totalVerts = layerVerts * 2

  const cBase = new THREE.Color(0x527d43)
  const cMid = new THREE.Color(0x74a254)
  const cTip = new THREE.Color(0x96be69)
  const cUnder = new THREE.Color(0x476f3b)

  const length = 0.056
  const maxHalfW = 0.0145

  const centers: THREE.Vector3[] = Array.from({ length: layerVerts }, () => new THREE.Vector3())
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    const halfW = maxHalfW * Math.max(0.14, Math.pow(Math.sin(Math.PI * Math.pow(v, 0.85)), 0.78))
    const z = v * length
    const arch = 0.0085 * Math.sin(v * Math.PI * 0.82)
    for (let iu = 0; iu <= segU; iu++) {
      const u = (iu / segU) * 2 - 1
      const x = u * halfW
      const fold = 0.0042 * Math.abs(u) * Math.sin(Math.PI * v)
      centers[iv * cols + iu]!.set(x, arch + fold, z)
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
      n.crossVectors(dv, du)
      if (n.lengthSq() < 1e-16) n.set(0, 1, 0)
      else n.normalize()

      const halfT = Math.max(0.0007, 0.0028 * (1 - 0.3 * u * u) * (1 - 0.25 * v * v) * 0.5)
      const topIdx = idx
      const botIdx = layerVerts + idx

      col.copy(cBase).lerp(cMid, THREE.MathUtils.smoothstep(v, 0.05, 0.55))
      col.lerp(cTip, THREE.MathUtils.smoothstep(v, 0.55, 1.0))

      positions[topIdx * 3] = c.x + n.x * halfT
      positions[topIdx * 3 + 1] = c.y + n.y * halfT
      positions[topIdx * 3 + 2] = c.z + n.z * halfT
      uvs[topIdx * 2] = uUv
      uvs[topIdx * 2 + 1] = v
      colors[topIdx * 3] = col.r
      colors[topIdx * 3 + 1] = col.g
      colors[topIdx * 3 + 2] = col.b

      col.lerp(cUnder, 0.45)
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
  for (let iv = 0; iv < segV; iv++) {
    for (let iu = 0; iu < segU; iu++) {
      const a = top(iu, iv), b = top(iu + 1, iv), c = top(iu, iv + 1), d = top(iu + 1, iv + 1)
      indices.push(a, c, b, b, c, d)
      const ba = bot(iu, iv), bb = bot(iu + 1, iv), bc = bot(iu, iv + 1), bd = bot(iu + 1, iv + 1)
      indices.push(ba, bb, bc, bb, bd, bc)
    }
  }
  for (let iu = 0; iu < segU; iu++) {
    indices.push(top(iu, 0), top(iu + 1, 0), bot(iu + 1, 0), top(iu, 0), bot(iu + 1, 0), bot(iu, 0))
    indices.push(top(iu + 1, segV), top(iu, segV), bot(iu, segV), top(iu + 1, segV), bot(iu, segV), bot(iu + 1, segV))
  }
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
