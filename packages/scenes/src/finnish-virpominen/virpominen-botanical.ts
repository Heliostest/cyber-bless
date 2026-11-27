import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

export type CatkinTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
  sheenColor: THREE.DataTexture
}

type CatkinPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  sheenColor: Uint8Array
  size: number
}

const cachedCatkinPixels = new Map<string, CatkinPixelBuffers>()

function hash2(ix: number, iy: number, seed: number): number {
  let h = (ix * 374761393 + iy * 668265263 + seed * 1442695041) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  return ((h ^ (h >>> 16)) >>> 0) / 4294967295
}

function periodicNoise(x: number, y: number, px: number, py: number, seed: number): number {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const fx = x - xi
  const fy = y - yi
  const ux = fx * fx * (3 - 2 * fx)
  const uy = fy * fy * (3 - 2 * fy)
  const x0 = ((xi % px) + px) % px
  const x1 = (x0 + 1) % px
  const y0 = ((yi % py) + py) % py
  const y1 = (y0 + 1) % py
  const a = hash2(x0, y0, seed)
  const b = hash2(x1, y0, seed)
  const c = hash2(x0, y1, seed)
  const d = hash2(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  wrapU: THREE.Wrapping = THREE.RepeatWrapping,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = wrapU
  tex.wrapT = THREE.ClampToEdgeWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

/**
 * Deterministic pussy-willow catkin (Salix caprea) procedural texture suite
 * (256x256, zero DOM):
 * - Lower `v <= ~0.30`: glossy-chestnut scalloped bud-scale cap (matching the
 *   willow bark palette in `willow-craft.ts`), with `sheenColor = 0`.
 * - Upper `v > ~0.30`: silky cream-silver brushed fuzz with fine upward hair
 *   texture and `sheenColor` enabled for a luminous silvery rim halo. Peak sRGB
 *   is softly capped below Komorebi daylight's clip threshold so buds never blow out.
 */
export function createPussyWillowCatkinTextures(): CatkinTextureSet {
  const size = 256
  const key = 'virpominen-catkin-v1'
  let cached = cachedCatkinPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const sheenColor = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    const scaleDark = [64, 38, 22] as const
    const scaleMid = [104, 66, 38] as const
    const scaleRim = [138, 94, 58] as const

    const fuzzShadow = [172, 168, 155] as const
    const fuzzBody = [204, 200, 188] as const
    const fuzzTip = [226, 225, 220] as const

    for (let iy = 0; iy < size; iy++) {
      const v = iy / (size - 1)
      for (let ix = 0; ix < size; ix++) {
        const u = ix / size
        // Natural two-lobed split bud-scale collar hugging the lower ~30% of the catkin.
        const scaleEdge = 0.29 + 0.048 * Math.cos(u * tau * 2.0 + 0.4) + 0.016 * Math.sin(u * tau * 4.0)
        const fuzzMask = THREE.MathUtils.smoothstep(v, scaleEdge - 0.032, scaleEdge + 0.038)
        const collarShadow = Math.exp(-Math.pow((v - (scaleEdge + 0.035)) / 0.048, 2)) * 0.48

        // Glossy chestnut bud-scale bark streaks.
        const scaleRidge = Math.sin(u * tau * 6 + Math.sin(v * tau) * 0.4) * 0.5 + 0.5
        const scaleLip = THREE.MathUtils.smoothstep(v, scaleEdge - 0.09, scaleEdge - 0.01)
        const scaleNoise = periodicNoise(u * 6, v * 4, 6, 4, 701)
        const sR = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(scaleDark[0], scaleMid[0], 0.42 + scaleRidge * 0.34 + scaleNoise * 0.24),
          scaleRim[0],
          scaleLip * 0.52,
        )
        const sG = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(scaleDark[1], scaleMid[1], 0.42 + scaleRidge * 0.34 + scaleNoise * 0.24),
          scaleRim[1],
          scaleLip * 0.52,
        )
        const sB = THREE.MathUtils.lerp(
          THREE.MathUtils.lerp(scaleDark[2], scaleMid[2], 0.42 + scaleRidge * 0.34 + scaleNoise * 0.24),
          scaleRim[2],
          scaleLip * 0.52,
        )

        // Silky brushed upward-flowing catkins hairs (fine longitudinal hair tufts + soft plush wave).
        const hairTwist = (periodicNoise(u * 6, v * 4, 6, 4, 733) - 0.5) * 0.04
        const fineHair = periodicNoise((u + hairTwist) * 28, v * 6, 28, 6, 757)
        const tuftWave = Math.sin((u + hairTwist) * tau * 14 + v * 3.0) * 0.5 + 0.5
        const plush = fineHair * 0.65 + tuftWave * 0.35
        const crownLift = THREE.MathUtils.smoothstep(v, 0.46, 0.96)

        let fR = THREE.MathUtils.lerp(fuzzShadow[0], fuzzBody[0], 0.38 + plush * 0.62)
        let fG = THREE.MathUtils.lerp(fuzzShadow[1], fuzzBody[1], 0.38 + plush * 0.62)
        let fB = THREE.MathUtils.lerp(fuzzShadow[2], fuzzBody[2], 0.38 + plush * 0.62)
        fR = THREE.MathUtils.lerp(fR, fuzzTip[0], crownLift * (0.42 + plush * 0.36))
        fG = THREE.MathUtils.lerp(fG, fuzzTip[1], crownLift * (0.42 + plush * 0.36))
        fB = THREE.MathUtils.lerp(fB, fuzzTip[2], crownLift * (0.45 + plush * 0.36))

        // Warm tuck shadow right where the fuzzy catkin emerges from the brown scale cup.
        fR = THREE.MathUtils.lerp(fR, scaleMid[0] * 1.12, collarShadow * 0.52)
        fG = THREE.MathUtils.lerp(fG, scaleMid[1] * 1.18, collarShadow * 0.52)
        fB = THREE.MathUtils.lerp(fB, scaleMid[2] * 1.24, collarShadow * 0.48)

        const r = THREE.MathUtils.lerp(sR, fR, fuzzMask)
        const g = THREE.MathUtils.lerp(sG, fG, fuzzMask)
        const b = THREE.MathUtils.lerp(sB, fB, fuzzMask)

        const idx = (iy * size + ix) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 226)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 225)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 220)
        color[idx + 3] = 255

        const scaleH = 120 + scaleRidge * 26 + scaleLip * 24
        const fuzzH = 114 + plush * 62 - collarShadow * 32
        const h = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(scaleH, fuzzH, fuzzMask)), 42, 220)
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Smooth satin bud-scale (~0.56) vs matte velvety catkin fuzz (~0.95).
        const rVal = THREE.MathUtils.clamp(
          Math.round(THREE.MathUtils.lerp(144 + (1 - scaleRidge) * 24, 240 - plush * 16, fuzzMask)),
          132,
          252,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255

        // Silvery velvet fuzz rim sheen strictly on the furry upper catkin (zero on bud scale).
        const sMask = THREE.MathUtils.smoothstep(v, scaleEdge + 0.01, scaleEdge + 0.14) * (0.76 + plush * 0.24)
        sheenColor[idx] = THREE.MathUtils.clamp(Math.round(234 * sMask), 0, 238)
        sheenColor[idx + 1] = THREE.MathUtils.clamp(Math.round(240 * sMask), 0, 244)
        sheenColor[idx + 2] = THREE.MathUtils.clamp(Math.round(244 * sMask), 0, 248)
        sheenColor[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, sheenColor, size }
    cachedCatkinPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, THREE.RepeatWrapping),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, THREE.RepeatWrapping),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, THREE.RepeatWrapping),
    sheenColor: buildDataTexture(cached.sheenColor, size, THREE.SRGBColorSpace, THREE.RepeatWrapping),
  }
}

/**
 * Silvery fuzzy pussy-willow catkin material with glossy-brown bud-scale base
 * and Charlie velvet rim sheen, capped safely for Komorebi daylight.
 */
export function createPussyWillowCatkinMaterial(): THREE.MeshPhysicalMaterial {
  const tex = createPussyWillowCatkinTextures()
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale: 0.0048,
    roughnessMap: tex.roughness,
    roughness: 0.94,
    metalness: 0,
    specularIntensity: 0.34,
    sheen: 1.0,
    sheenRoughness: 0.48,
    sheenColor: new THREE.Color(0xf4f8fc),
    sheenColorMap: tex.sheenColor,
    envMapIntensity: 0.30,
    vertexColors: true,
  })
  const release = () => {
    mat.removeEventListener('dispose', release)
    tex.map.dispose()
    tex.bump.dispose()
    tex.roughness.dispose()
    tex.sheenColor.dispose()
  }
  mat.addEventListener('dispose', release)
  return mat
}

/**
 * Expands a closed indexed geometry into a non-indexed BufferGeometry while
 * preserving its pre-computed smooth vertex normals (and UVs + colors),
 * eliminating degenerate pole triangles cleanly.
 */
function toSmoothNonIndexed(source: THREE.BufferGeometry): THREE.BufferGeometry {
  if (!source.getAttribute('normal')) source.computeVertexNormals()
  const raw = source.index ? source.toNonIndexed() : source
  const pos = raw.getAttribute('position')
  const norm = raw.getAttribute('normal')
  const uv = raw.getAttribute('uv')
  const col = raw.getAttribute('color')

  const outPos: number[] = []
  const outNorm: number[] = []
  const outUv: number[] = []
  const outCol: number[] = []
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const n = new THREE.Vector3()

  for (let i = 0; i < pos.count; i += 3) {
    a.fromBufferAttribute(pos, i)
    b.fromBufferAttribute(pos, i + 1)
    c.fromBufferAttribute(pos, i + 2)
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-20) continue
    for (let k = 0; k < 3; k++) {
      const idx = i + k
      outPos.push(pos.getX(idx), pos.getY(idx), pos.getZ(idx))
      n.fromBufferAttribute(norm, idx)
      if (n.lengthSq() > 1e-12) n.normalize()
      else n.set(0, 1, 0)
      outNorm.push(n.x, n.y, n.z)
      if (uv) outUv.push(uv.getX(idx), uv.getY(idx))
      if (col) outCol.push(col.getX(idx), col.getY(idx), col.getZ(idx))
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(outPos, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(outNorm, 3))
  if (uv) g.setAttribute('uv', new THREE.Float32BufferAttribute(outUv, 2))
  if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(outCol, 3))
  g.computeBoundingBox()
  g.computeBoundingSphere()
  if (raw !== source) raw.dispose()
  source.dispose()
  return g
}

/**
 * Builds a smooth, watertight, non-indexed FrontSide pussy-willow catkin solid
 * inside the unit `[-1, 1]` envelope: a nestled bud-scale base collar cradling a
 * plump ovoid-teardrop silky catkin crown, with smooth normals preserved before
 * non-indexing.
 */
export function createPussyWillowCatkinGeometry(): THREE.BufferGeometry {
  const radialSegs = 18
  const heightSegs = 12
  const profile: THREE.Vector2[] = []

  for (let iv = 0; iv <= heightSegs; iv++) {
    const v = iv / heightSegs
    const y = -1 + v * 2
    let r: number
    if (iv === 0 || iv === heightSegs) {
      r = 0
    } else {
      // Plump teardrop ovoid: slightly fuller below mid, soft plush rounded apex.
      const baseOval = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.86)), 0.88)
      // Subtle sculpted rim where the split bud-scale collar hugs the emerging fuzz.
      const scaleCup = 0.055 * Math.exp(-Math.pow((v - 0.26) / 0.055, 2))
      const scalePinch = -0.032 * Math.exp(-Math.pow((v - 0.34) / 0.045, 2))
      r = THREE.MathUtils.clamp(baseOval * 0.94 + scaleCup + scalePinch, 0.08, 0.99)
    }
    profile.push(new THREE.Vector2(r, y))
  }

  const lathe = new THREE.LatheGeometry(profile, radialSegs)
  const pos = lathe.getAttribute('position')
  const col = new Float32Array(pos.count * 3)

  for (let i = 0; i < pos.count; i++) {
    const v = THREE.MathUtils.clamp((pos.getY(i) + 1) * 0.5, 0, 1)
    // Gentle warm base deepening and soft pearl-silver crown lift (strictly capped against white blowout).
    const baseShade = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.30)) * 0.14
    const crownTint = THREE.MathUtils.smoothstep(v, 0.55, 1.0) * 0.04
    col[i * 3] = THREE.MathUtils.clamp(0.97 - baseShade + crownTint * 0.7, 0.80, 1.01)
    col[i * 3 + 1] = THREE.MathUtils.clamp(0.97 - baseShade + crownTint * 0.85, 0.80, 1.01)
    col[i * 3 + 2] = THREE.MathUtils.clamp(0.96 - baseShade * 1.05 + crownTint, 0.78, 1.01)
  }
  lathe.setAttribute('color', new THREE.Float32BufferAttribute(col, 3))
  // Keep LatheGeometry's analytical seamless normals (recomputing on indexed seam vertices would crease phi=0/2pi).
  return toSmoothNonIndexed(lathe)
}

export type PaperFlowerMaterials = {
  yellow: THREE.MeshStandardMaterial
  pink: THREE.MeshStandardMaterial
  centre: THREE.MeshStandardMaterial
}

/**
 * Handmade Finnish Easter crepe/craft paper materials for the two paper flowers
 * and paper ties on the willow branch (using `ritual-optics` `kind: 'paper'`,
 * `layout: 'sheet'` with C1 highlight guard so sunlit yellow/pink/cream paper
 * stays tactile and clearly paper-craft, never living petals and never blown white).
 */
export function createPaperFlowerMaterials(): PaperFlowerMaterials {
  const yellow = createRitualMaterial(
    { color: 0xefca72, roughness: 0.94, vertexColors: true },
    {
      kind: 'paper',
      strength: 0.28,
      fiber: 'paper',
      paper: { layout: 'sheet', aspect: 0.72, grainScale: 4.2, grain: 0.68, fibers: 0.52, edge: 0.34, highlightGuard: 0.74 },
    },
  )
  const pink = createRitualMaterial(
    { color: 0xe68f8c, roughness: 0.94, vertexColors: true },
    {
      kind: 'paper',
      strength: 0.28,
      fiber: 'paper',
      paper: { layout: 'sheet', aspect: 0.72, grainScale: 4.2, grain: 0.68, fibers: 0.52, edge: 0.34, highlightGuard: 0.66 },
    },
  )
  const centre = createRitualMaterial(
    { color: 0xefe5bd, roughness: 0.95, vertexColors: true },
    {
      kind: 'paper',
      strength: 0.30,
      fiber: 'paper',
      paper: { layout: 'sheet', aspect: 1.0, grainScale: 4.8, grain: 0.72, fibers: 0.54, edge: 0.32, highlightGuard: 0.80 },
    },
  )
  return { yellow, pink, centre }
}

/**
 * Builds a closed, watertight, non-indexed FrontSide crinkled paper-craft petal
 * centered around the local origin inside `[-0.046, +0.046] x [-0.029, +0.029]`
 * (base gathered at `-X`, hand-cut scalloped crepe-paper tip at `+X`, cupped
 * gently forward in `+Z` with three tactile longitudinal crepe folds).
 */
export function createPaperCraftPetalGeometry(): THREE.BufferGeometry {
  const segV = 8 // along petal length: x = -0.045 (gathered center) -> +0.045 (outer tip)
  const segU = 6 // across petal width: y = -halfW -> +halfW
  const ringLen = 2 * segU + 2
  const halfLen = 0.045
  const maxHalfW = 0.0285

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const writeColor = (u: number, v: number, pleat: number) => {
    const gather = (1 - THREE.MathUtils.smoothstep(v, 0.0, 0.34)) * 0.11
    const edgeLight = THREE.MathUtils.smoothstep(v, 0.68, 1.0) * 0.04
    const crease = pleat * 0.036
    const shade = THREE.MathUtils.clamp(0.98 - gather + edgeLight + crease, 0.82, 1.03)
    colors.push(shade, shade * 0.992, shade * 0.975)
  }

  const petalHalfWidth = (v: number): number => {
    // Classic fan/teardrop paper-craft cutout: pinched at stem gather, rounded broad outer paper lobe.
    const lobe = Math.pow(Math.sin(Math.PI * Math.pow(v, 0.72)), 0.74)
    return maxHalfW * Math.min(1, lobe * 1.02)
  }

  const evalSurfaceZ = (u: number, v: number): [number, number] => {
    const across = Math.abs(u)
    // Gentle forward craft-paper cup + three crinkled crepe-paper folds radiating from the gather.
    const cup = 0.0085 * v * v - 0.0042 * (1 - across * across) * Math.sin(Math.PI * v)
    const pleat = Math.cos(u * Math.PI * 2.5) * Math.sin(Math.PI * v)
    const crinkle = pleat * 0.0022
    return [cup + crinkle, pleat]
  }

  // Vertex 0: gathered inner base at x = -halfLen
  positions.push(-halfLen, 0, -0.001)
  uvs.push(0.5, 0)
  writeColor(0, 0, 0)

  for (let iv = 1; iv < segV; iv++) {
    const v = iv / segV
    const x = (v * 2 - 1) * halfLen
    const hw = petalHalfWidth(v)
    const halfT = 0.00145 * (0.78 + 0.22 * Math.sin(Math.PI * v))

    // Front (+Z) face: u = -1 -> +1
    for (let iu = 0; iu <= segU; iu++) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const y = u * hw
      // Subtle hand-cut scallop modulation along the outer half of the paper edge.
      const scallopX = v > 0.72 ? Math.cos(u * Math.PI * 2.0) * 0.0020 * ((v - 0.72) / 0.28) : 0
      const [z, pleat] = evalSurfaceZ(u, v)
      positions.push(x + scallopX, y, z + halfT)
      uvs.push(uUv, v)
      writeColor(u, v, pleat)
    }

    // Back (-Z) face: u = +1 -> -1
    for (let iu = segU; iu >= 0; iu--) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const y = u * hw
      const scallopX = v > 0.72 ? Math.cos(u * Math.PI * 2.0) * 0.0020 * ((v - 0.72) / 0.28) : 0
      const [z, pleat] = evalSurfaceZ(u, v)
      positions.push(x + scallopX, y, z - halfT)
      uvs.push(uUv, v)
      writeColor(u, v, pleat - 0.5)
    }
  }

  // Final vertex: outer scalloped tip at x = +halfLen
  const tipIdx = positions.length / 3
  const [tipZ, tipPleat] = evalSurfaceZ(0, 1)
  positions.push(halfLen, 0, tipZ)
  uvs.push(0.5, 1)
  writeColor(0, 1, tipPleat)

  const ringStart = (iv: number) => 1 + (iv - 1) * ringLen

  const r1 = ringStart(1)
  for (let k = 0; k < ringLen; k++) {
    const kn = (k + 1) % ringLen
    indices.push(0, r1 + kn, r1 + k)
  }
  for (let iv = 1; iv < segV - 1; iv++) {
    const a = ringStart(iv)
    const b = ringStart(iv + 1)
    for (let k = 0; k < ringLen; k++) {
      const kn = (k + 1) % ringLen
      indices.push(a + k, a + kn, b + kn)
      indices.push(a + k, b + kn, b + k)
    }
  }
  const rLast = ringStart(segV - 1)
  for (let k = 0; k < ringLen; k++) {
    const kn = (k + 1) % ringLen
    indices.push(tipIdx, rLast + k, rLast + kn)
  }

  // Guarantee outward winding via signed volume check.
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), cr = new THREE.Vector3()
  let vol = 0
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3, ib = indices[i + 1]! * 3, ic = indices[i + 2]! * 3
    va.set(positions[ia]!, positions[ia + 1]!, positions[ia + 2]!)
    vb.set(positions[ib]!, positions[ib + 1]!, positions[ib + 2]!)
    vc.set(positions[ic]!, positions[ic + 1]!, positions[ic + 2]!)
    vol += va.dot(cr.crossVectors(vb, vc)) / 6
  }
  if (vol < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!
      indices[i + 1] = indices[i + 2]!
      indices[i + 2] = tmp
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return toSmoothNonIndexed(g)
}

/**
 * Builds a closed, watertight, non-indexed FrontSide gathered crepe-paper center
 * button (with delicate 8-fold radial paper pleats around the front Z axis) for
 * the Finnish paper-craft flowers.
 */
export function createPaperFlowerCenterGeometry(): THREE.BufferGeometry {
  const segA = 16
  const segR = 8
  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  // Build as a closed polar mesh aligned with +Z/-Z poles so every radial fold is seamless and strictly manifold.
  const radius = 0.025
  const halfDepth = 0.0115

  // Vertex 0: back pole (-Z)
  positions.push(0, 0, -halfDepth)
  uvs.push(0.5, 0.5)
  colors.push(0.86, 0.85, 0.82)

  for (let ir = 1; ir < segR; ir++) {
    const theta = Math.PI - (ir / segR) * Math.PI // pi (back pole) -> 0 (front pole)
    const sinT = Math.sin(theta)
    const cosT = Math.cos(theta)
    for (let ia = 0; ia < segA; ia++) {
      const a = (ia / segA) * Math.PI * 2
      const ruffle = 1 + 0.065 * Math.cos(a * 8) * sinT
      const rHere = radius * sinT * ruffle
      // Gentle gathered crepe-paper dimple at the front center (cosT > 0), smooth C1 across cosT = 0.
      const frontWeight = Math.max(0, cosT)
      const dimple = -0.18 * frontWeight * frontWeight * Math.exp(-sinT * sinT * 4.5)
      const x = Math.cos(a) * rHere
      const y = Math.sin(a) * rHere
      const z = (cosT + dimple) * halfDepth
      positions.push(x, y, z)
      uvs.push(0.5 + (x / (radius * 2.2)), 0.5 + (y / (radius * 2.2)))
      const shade = THREE.MathUtils.clamp(0.95 + 0.04 * Math.cos(a * 8) * sinT - (cosT < 0 ? 0.07 : 0), 0.84, 1.01)
      colors.push(shade, shade * 0.99, shade * 0.96)
    }
  }

  // Final vertex: front pole (+Z center dimple)
  const frontPole = positions.length / 3
  positions.push(0, 0, (1 - 0.18) * halfDepth)
  uvs.push(0.5, 0.5)
  colors.push(0.92, 0.91, 0.88)

  const ringStart = (ir: number) => 1 + (ir - 1) * segA

  // Back cap fan (outward -Z)
  const rFirst = ringStart(1)
  for (let ia = 0; ia < segA; ia++) {
    const ian = (ia + 1) % segA
    indices.push(0, rFirst + ian, rFirst + ia)
  }

  // Latitude bands from back to front (outward radial)
  for (let ir = 1; ir < segR - 1; ir++) {
    const a = ringStart(ir)
    const b = ringStart(ir + 1)
    for (let ia = 0; ia < segA; ia++) {
      const ian = (ia + 1) % segA
      indices.push(a + ia, a + ian, b + ian)
      indices.push(a + ia, b + ian, b + ia)
    }
  }

  // Front cap fan (outward +Z)
  const rLast = ringStart(segR - 1)
  for (let ia = 0; ia < segA; ia++) {
    const ian = (ia + 1) % segA
    indices.push(frontPole, rLast + ia, rLast + ian)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return toSmoothNonIndexed(g)
}

/**
 * Builds a closed, watertight, non-indexed FrontSide thin paper ribbon streamer
 * (`width = 0.025`, `length = 0.13`, `thickness = 0.0034`) with a gentle natural
 * paper bow and subtle hand-cut crease shading.
 */
export function createPaperTieRibbonGeometry(): THREE.BufferGeometry {
  const segV = 6
  const segU = 2
  const halfW = 0.0125
  const halfH = 0.065
  const halfT = 0.0017

  const positions: number[] = []
  const uvs: number[] = []
  const colors: number[] = []
  const indices: number[] = []

  const ringLen = 2 * segU + 2
  const ringPts: number[][] = []

  for (let iv = 0; iv <= segV; iv++) {
    const v = iv / segV // 0 bottom tail -> 1 top knot
    const y = (v * 2 - 1) * halfH
    // Gentle S-curve paper wave staying strictly within ±0.0045 in Z.
    const zWave = Math.sin(v * Math.PI * 1.45) * 0.0038
    const widthScale = THREE.MathUtils.lerp(1.06, 0.84, v)
    const ring: number[] = []

    // Front (+Z) u = -1 -> +1
    for (let iu = 0; iu <= segU; iu++) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      // Subtle swallowtail V-notch at the bottom paper edge (v = 0, u = 0).
      const tailNotch = iv === 0 && iu === 1 ? 0.009 : 0
      ring.push(positions.length / 3)
      positions.push(u * halfW * widthScale, y + tailNotch, zWave + halfT)
      uvs.push(uUv, v)
      const s = THREE.MathUtils.clamp(0.95 + (1 - v) * 0.03 - Math.abs(u) * 0.02, 0.88, 1.0)
      colors.push(s, s * 0.99, s * 0.97)
    }
    // Back (-Z) u = +1 -> -1
    for (let iu = segU; iu >= 0; iu--) {
      const uUv = iu / segU
      const u = uUv * 2 - 1
      const tailNotch = iv === 0 && iu === 1 ? 0.009 : 0
      ring.push(positions.length / 3)
      positions.push(u * halfW * widthScale, y + tailNotch, zWave - halfT)
      uvs.push(uUv, v)
      const s = THREE.MathUtils.clamp(0.90 + (1 - v) * 0.03, 0.84, 0.96)
      colors.push(s, s * 0.99, s * 0.97)
    }
    ringPts.push(ring)
  }

  for (let iv = 0; iv < segV; iv++) {
    const a = ringPts[iv]!
    const b = ringPts[iv + 1]!
    for (let k = 0; k < ringLen; k++) {
      const kn = (k + 1) % ringLen
      indices.push(a[k]!, a[kn]!, b[kn]!)
      indices.push(a[k]!, b[kn]!, b[k]!)
    }
  }

  // Close bottom and top end caps cleanly across the thin 3-column ribbon strip.
  const bot = ringPts[0]!
  const top = ringPts[segV]!
  // Bottom cap pairs: (front[0], front[1], back[1], back[2]) and (front[1], front[2], back[0], back[1])
  // Note ring indices: front = [0, 1, 2], back = [3 (u=+1), 4 (u=0), 5 (u=-1)]
  indices.push(bot[0]!, bot[5]!, bot[4]!, bot[0]!, bot[4]!, bot[1]!)
  indices.push(bot[1]!, bot[4]!, bot[3]!, bot[1]!, bot[3]!, bot[2]!)
  indices.push(top[0]!, top[1]!, top[4]!, top[0]!, top[4]!, top[5]!)
  indices.push(top[1]!, top[2]!, top[3]!, top[1]!, top[3]!, top[4]!)

  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3(), cr = new THREE.Vector3()
  let vol = 0
  for (let i = 0; i < indices.length; i += 3) {
    const ia = indices[i]! * 3, ib = indices[i + 1]! * 3, ic = indices[i + 2]! * 3
    va.set(positions[ia]!, positions[ia + 1]!, positions[ia + 2]!)
    vb.set(positions[ib]!, positions[ib + 1]!, positions[ib + 2]!)
    vc.set(positions[ic]!, positions[ic + 1]!, positions[ic + 2]!)
    vol += va.dot(cr.crossVectors(vb, vc)) / 6
  }
  if (vol < 0) {
    for (let i = 0; i < indices.length; i += 3) {
      const tmp = indices[i + 1]!
      indices[i + 1] = indices[i + 2]!
      indices[i + 2] = tmp
    }
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  g.setIndex(indices)
  g.computeVertexNormals()
  return toSmoothNonIndexed(g)
}
