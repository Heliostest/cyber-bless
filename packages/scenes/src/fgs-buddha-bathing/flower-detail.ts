import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

type FlowerFinishOptions = {
  veinStrength: number
  wrapStrength: number
  rimStrength: number
  scatterTint: readonly [number, number, number]
  knee?: number
  headroom?: number
}

/**
 * Single-pass Komorebi botanical finish for the three small paving-edge flowers
 * in `fgs-buddha-bathing`: soft translucent forward-wrap glow, faint silky veins,
 * grazing rim, and C1 highlight shoulder (knee = 0.74, headroom = 0.24).
 */
function attachFlowerFinish(material: THREE.MeshStandardMaterial, opts: FlowerFinishOptions): THREE.MeshStandardMaterial {
  const knee = (opts.knee ?? 0.74).toFixed(3)
  const headroom = (opts.headroom ?? 0.24).toFixed(3)
  const baseCompile = material.onBeforeCompile
  const baseKey = material.customProgramCacheKey.bind(material)()

  material.onBeforeCompile = function (shader, renderer) {
    baseCompile.call(this, shader, renderer)
    if (shader.fragmentShader.includes('WBR_BATHING_FLOWER')) return
    shader.uniforms.wbrBflVein = { value: opts.veinStrength }
    shader.uniforms.wbrBflWrap = { value: opts.wrapStrength }
    shader.uniforms.wbrBflRim = { value: opts.rimStrength }
    shader.uniforms.wbrBflTint = { value: new THREE.Vector3(...opts.scatterTint) }

    shader.vertexShader = 'varying vec2 wbrBflUv;\n' + shader.vertexShader
    shader.vertexShader = shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      wbrBflUv = uv;
    `)

    const header = `
#define WBR_BATHING_FLOWER
varying vec2 wbrBflUv;
uniform float wbrBflVein;
uniform float wbrBflWrap;
uniform float wbrBflRim;
uniform vec3 wbrBflTint;
float wbrBflWave(float phase) {
  float f = fwidth(phase);
  return sin(phase) * exp(-0.42 * f * f);
}
`
    shader.fragmentShader = header + shader.fragmentShader
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <color_fragment>', `
        #include <color_fragment>
        float bflU = wbrBflUv.x * 2.0 - 1.0;
        float bflV = clamp(wbrBflUv.y, 0.0, 1.0);
        float bflFan = bflU / (0.40 + 0.60 * sqrt(max(bflV, 0.01)));
        float bflPattern = (wbrBflWave(bflFan * 18.849556) * 0.62 + exp(-bflU * bflU * 20.0) * 0.38)
          * sin(bflV * 3.14159265) * wbrBflVein;
        diffuseColor.rgb *= 1.0 + bflPattern * 0.075;
      `)
      .replace('#include <roughnessmap_fragment>', `
        #include <roughnessmap_fragment>
        roughnessFactor = clamp(roughnessFactor - bflPattern * 0.08, 0.36, 0.96);
      `)
      .replace('#include <lights_fragment_end>', `
        #include <lights_fragment_end>
        #if NUM_DIR_LIGHTS > 0
          vec3 bflKeyDir = directionalLights[0].direction;
          vec3 bflKeyCol = directionalLights[0].color;
          float bflNdotL = dot(geometryNormal, bflKeyDir);
          float bflWrap = smoothstep(-0.46, 0.62, bflNdotL) * (1.0 - max(0.0, bflNdotL) * 0.56);
          float bflBack = max(0.0, -bflNdotL) * 0.48;
          float bflRim = pow(1.0 - abs(dot(geometryNormal, geometryViewDir)), 2.4);
          float bflLuma = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
          float bflHead = mix(1.0, 0.62, smoothstep(0.48, 0.90, bflLuma));
          reflectedLight.directDiffuse += (diffuseColor.rgb * wbrBflTint) * bflKeyCol
            * ((bflWrap + bflBack) * wbrBflWrap + bflRim * wbrBflRim) * bflHead * 0.31830988618;
        #endif
        #if defined( RE_IndirectDiffuse )
          float bflAmb = min(1.0, length(irradiance) * 0.35);
          reflectedLight.indirectDiffuse = max(
            reflectedLight.indirectDiffuse,
            diffuseColor.rgb * wbrBflTint * (0.16 * bflAmb)
          );
        #endif
      `)
      .replace('#include <opaque_fragment>', `
        vec3 bflLit = max(outgoingLight - totalEmissiveRadiance, vec3(0.0));
        float bflPeak = max(bflLit.r, max(bflLit.g, bflLit.b));
        if (bflPeak > ${knee}) {
          float bflExcess = bflPeak - ${knee};
          float bflTarget = ${knee} + ${headroom} * (bflExcess / (bflExcess + ${headroom}));
          outgoingLight = bflLit * (bflTarget / bflPeak) + totalEmissiveRadiance;
        }
        #include <opaque_fragment>
      `)
  }

  material.customProgramCacheKey = () => `${baseKey}|wbr-bathing-flower-v1:${knee}:${headroom}`
  material.userData.botanicalFinish = { mode: 'petal', knee: opts.knee ?? 0.74, headroom: opts.headroom ?? 0.24 }
  material.clone = function () {
    const cloned = THREE.MeshStandardMaterial.prototype.clone.call(this) as THREE.MeshStandardMaterial
    return attachFlowerFinish(cloned, opts)
  }
  material.needsUpdate = true
  return material
}

export function createBathingPetalMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0xffffff, vertexColors: true, roughness: 0.78, metalness: 0, envMapIntensity: 0.42 },
    { kind: 'fruit', strength: 0.22, fiber: false },
  )
  return attachFlowerFinish(mat, {
    veinStrength: 0.68,
    wrapStrength: 0.24,
    rimStrength: 0.14,
    scatterTint: [1.10, 0.96, 0.86],
    knee: 0.74,
    headroom: 0.24,
  })
}

export function createBathingStemMaterial(): THREE.MeshStandardMaterial {
  const mat = createRitualMaterial(
    { color: 0x6b8c5c, roughness: 0.76, metalness: 0, envMapIntensity: 0.40 },
    { kind: 'leaf', strength: 0.14, fiber: false },
  )
  return attachFlowerFinish(mat, {
    veinStrength: 0.20,
    wrapStrength: 0.14,
    rimStrength: 0.08,
    scatterTint: [1.05, 1.11, 0.76],
    knee: 0.74,
    headroom: 0.24,
  })
}

/**
 * Watertight FrontSide cupped peach-blush edge-flower petal extending outward
 * along +X from throat (x = 0.010) to tip (x = 0.118), with gentle cup rise
 * along +Y and soft apricot-gold throat fading to translucent peach-cream rim.
 */
export function createBathingPetalGeometry(): THREE.BufferGeometry {
  const segU = 6
  const segV = 8
  const cols = segU + 1
  const rows = segV + 1
  const layerVerts = cols * rows
  const totalVerts = layerVerts * 2

  const cThroat = new THREE.Color(0xe5ae5c)
  const cMid = new THREE.Color(0xe6b4a0)
  const cBody = new THREE.Color(0xebbda9)
  const cTip = new THREE.Color(0xf5d9ca)
  const cUnder = new THREE.Color(0xd79f8d)

  const length = 0.108
  const maxHalfW = 0.050

  const centers: THREE.Vector3[] = Array.from({ length: layerVerts }, () => new THREE.Vector3())
  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV
    let widthFactor: number
    if (v < 0.60) {
      const t = v / 0.60
      widthFactor = 0.24 + 0.76 * Math.sin(t * Math.PI * 0.5)
    } else {
      const t = (v - 0.60) / 0.40
      widthFactor = Math.cos(t * Math.PI * 0.42)
    }
    const halfW = maxHalfW * Math.max(0.20, widthFactor)
    const rise = 0.002 + 0.036 * Math.sin(v * Math.PI * 0.72) + 0.008 * v

    for (let iu = 0; iu <= segU; iu++) {
      const u = (iu / segU) * 2 - 1
      const x = u * halfW
      const tipArc = 0.007 * (u * u) * Math.pow(THREE.MathUtils.smoothstep(v, 0.58, 1.0), 1.5)
      const zPos = 0.010 + v * length - tipArc
      const cup = 0.012 * (u * u) * Math.sin(Math.PI * Math.pow(v, 0.76))
      const tipRelax = -0.003 * Math.pow(Math.max(0, (v - 0.72) / 0.28), 2.0)
      centers[iv * cols + iu]!.set(x, rise + cup + tipRelax, zPos)
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

      const halfT = Math.max(0.0010, 0.0052 * (1 - 0.36 * u * u) * (1 - 0.30 * v * v) * 0.5)
      const topIdx = idx
      const botIdx = layerVerts + idx

      const t = THREE.MathUtils.clamp(v + Math.pow(Math.abs(u), 1.6) * 0.14, 0, 1)
      if (t < 0.26) col.copy(cThroat).lerp(cMid, THREE.MathUtils.smoothstep(t, 0, 0.26))
      else if (t < 0.62) col.copy(cMid).lerp(cBody, THREE.MathUtils.smoothstep(t, 0.26, 0.62))
      else col.copy(cBody).lerp(cTip, THREE.MathUtils.smoothstep(t, 0.62, 1.0))

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

/** Watertight sculpted saffron-gold stamen cushion for the ground flower centers. */
export function createBathingFlowerHeartGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 14, 10)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const cDeep = new THREE.Color(0xc98b24)
  const cCrown = new THREE.Color(0xf0c250)
  const tmp = new THREE.Color()

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const r = Math.hypot(x, z)
    const a = Math.atan2(z, x)
    const flute = 1 + 0.08 * Math.cos(a * 5) * r
    pos.setXYZ(i, x * 0.030 * flute, y * 0.018, z * 0.030 * flute)
    tmp.copy(cDeep).lerp(cCrown, THREE.MathUtils.clamp(0.35 + y * 0.55 + r * 0.15, 0, 1))
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
