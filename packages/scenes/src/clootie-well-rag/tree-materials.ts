import * as THREE from 'three'

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedPixels = new Map<string, PixelBuffers>()

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
  const ux = fx * fx * fx * (fx * (fx * 6 - 15) + 10)
  const uy = fy * fy * fy * (fy * (fy * 6 - 15) + 10)
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

function makeTexture(
  source: Uint8Array,
  size: number,
  colorSpace: THREE.ColorSpace,
  repeat?: readonly [number, number],
  offset?: readonly [number, number],
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  if (repeat) tex.repeat.set(repeat[0], repeat[1])
  if (offset) tex.offset.set(offset[0], offset[1])
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

function bindTextureDisposal(material: THREE.Material, textures: readonly THREE.Texture[]): void {
  let released = false
  const onDispose = () => {
    if (released) return
    released = true
    material.removeEventListener('dispose', onDispose)
    for (const tex of textures) tex.dispose()
  }
  material.addEventListener('dispose', onDispose)
}

function buildOldBarkPixels(variant: 'bark' | 'highlight'): PixelBuffers {
  const key = `clootie-bark-${variant}-v1`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 256
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)
  // Living weathered woodland bark anchored to original 0x937259 / 0xb69771 (restrained contrast, never striped).
  const pal = variant === 'bark'
    ? { light: [164, 132, 104], mid: [147, 114, 89], warm: [155, 122, 94], dark: [108, 82, 62], lichen: [142, 150, 122], seed: 137 }
    : { light: [192, 163, 127], mid: [180, 149, 112], warm: [186, 156, 118], dark: [134, 106, 78], lichen: [164, 166, 136], seed: 251 }

  const tau = Math.PI * 2
  for (let y = 0; y < size; y++) {
    // TubeGeometry maps u along curve length and v around circumference.
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      const meander = Math.sin(u * tau * 1.0 + 0.5) * 0.032 + (periodicNoise(u * 2, v * 4, 2, 4, pal.seed + 13) - 0.5) * 0.055
      const vw = v + meander

      // Restrained finer vertical living-bark fissures running along u without broad mechanical stripes.
      const r1 = Math.sin(vw * tau * 7 + 0.8)
      const r2 = Math.sin(vw * tau * 15 + 1.9)
      const breath = 0.68 + 0.44 * periodicNoise(u * 3, v * 5, 3, 5, pal.seed + 29)
      const flutes = (0.58 * r1 + 0.42 * r2) * breath
      const streaks = (periodicNoise(u * 3, vw * 16, 3, 16, pal.seed + 53) - 0.5) * 0.72
      const warmDrift = periodicNoise(u * 3, v * 2, 3, 2, pal.seed + 71)
      // Very faint weathered woodland lichen flecks on ridges.
      const lichenMask = THREE.MathUtils.smoothstep(periodicNoise(u * 4, v * 4, 4, 4, pal.seed + 97), 0.78, 0.94) * 0.18

      const signal = THREE.MathUtils.clamp(flutes * 0.52 + streaks * 0.48, -1, 1)
      const crest = Math.max(0, signal)
      const fissure = Math.pow(Math.max(0, -signal), 1.25)

      let r = THREE.MathUtils.lerp(pal.mid[0], pal.warm[0], warmDrift * 0.50)
      let g = THREE.MathUtils.lerp(pal.mid[1], pal.warm[1], warmDrift * 0.50)
      let b = THREE.MathUtils.lerp(pal.mid[2], pal.warm[2], warmDrift * 0.50)

      r = THREE.MathUtils.lerp(r, pal.light[0], crest * 0.48)
      g = THREE.MathUtils.lerp(g, pal.light[1], crest * 0.48)
      b = THREE.MathUtils.lerp(b, pal.light[2], crest * 0.46)

      r = THREE.MathUtils.lerp(r, pal.dark[0], fissure * 0.62)
      g = THREE.MathUtils.lerp(g, pal.dark[1], fissure * 0.64)
      b = THREE.MathUtils.lerp(b, pal.dark[2], fissure * 0.66)

      r = THREE.MathUtils.lerp(r, pal.lichen[0], lichenMask)
      g = THREE.MathUtils.lerp(g, pal.lichen[1], lichenMask)
      b = THREE.MathUtils.lerp(b, pal.lichen[2], lichenMask)

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 206)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 178)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 144)
      color[idx + 3] = 255

      const h = THREE.MathUtils.clamp(Math.round(128 + flutes * 42 + streaks * 26), 40, 218)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = h
      bump[idx + 3] = 255

      const rv = THREE.MathUtils.clamp(Math.round(236 - crest * 16 + fissure * 16), 212, 254)
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = rv
      roughness[idx + 3] = 255
    }
  }

  const buffers = { color, bump, roughness, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createOldTreeBarkMaterials(): {
  bark: THREE.MeshStandardMaterial
  barkHighlight: THREE.MeshStandardMaterial
} {
  const make = (variant: 'bark' | 'highlight', repeat: readonly [number, number], bumpScale: number) => {
    const pixels = buildOldBarkPixels(variant)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, repeat)
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, repeat)
    const rough = makeTexture(pixels.roughness, pixels.size, THREE.NoColorSpace, repeat)
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale,
      roughnessMap: rough,
      roughness: 0.96,
      metalness: 0,
      envMapIntensity: 0.30,
      vertexColors: true,
    })
    bindTextureDisposal(mat, [map, bump, rough])
    return mat
  }
  return {
    bark: make('bark', [3.0, 1.35], 0.0082),
    barkHighlight: make('highlight', [1.8, 1.0], 0.0064),
  }
}

/** Strictly additive vertex shading on old-tree bark tubes (root earth contact & crown canopy shadow). */
export function applyOldTreeBarkShading(geometry: THREE.BufferGeometry): void {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = geometry.getAttribute('normal') as THREE.BufferAttribute | undefined
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const ny = norm ? norm.getY(i) : 0
    // Warm earth-moss deepening near ground roots (y < 0.38) and calm canopy shade near crown (y > 1.88).
    const rootShade = (1 - THREE.MathUtils.smoothstep(y, 0.04, 0.42)) * 0.20
    const crownShade = THREE.MathUtils.smoothstep(y, 1.82, 2.32) * 0.16
    const underBranch = Math.max(0, -ny) * 0.12
    const shade = THREE.MathUtils.clamp(rootShade + crownShade + underBranch, 0, 0.36)
    colors[i * 3] = THREE.MathUtils.clamp(1.01 - shade * 0.85, 0.72, 1.03)
    colors[i * 3 + 1] = THREE.MathUtils.clamp(1.00 - shade * 0.90, 0.70, 1.02)
    colors[i * 3 + 2] = THREE.MathUtils.clamp(0.98 - shade * 1.02, 0.64, 1.00)
  }
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
}

/** Smooth organic leafy crown cluster replacing faceted IcosahedronGeometry(1, 2), bounded inside radius 1. */
export function createCanopyClusterGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 24, 18)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const len = v.length() || 1
    const nx = v.x / len
    const ny = v.y / len
    const nz = v.z / len
    const theta = Math.atan2(nz, nx)
    const phi = Math.acos(THREE.MathUtils.clamp(ny, -1, 1))
    const sinPhi = Math.sin(phi)
    // Soft multi-lobe botanical canopy puffs; strictly <= 1.0 so the canopy envelope never grows.
    const puff = 0.93
      + 0.042 * Math.sin(theta * 3 + 0.4) * Math.cos(phi * 2) * sinPhi
      + 0.026 * Math.cos(theta * 4 - phi * 1.5) * sinPhi
      + 0.016 * Math.sin(phi * 4 + theta * 2) * sinPhi
    const r = Math.min(0.995, puff)
    pos.setXYZ(i, nx * r, ny * r, nz * r)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  // Blend normals softly upward/outward like painterly Komorebi clumps and bake calm top-to-bottom shift.
  const norm = geo.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const dome = new THREE.Vector3()
  const nVec = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    nVec.fromBufferAttribute(norm, i)
    dome.set(v.x, v.y + 0.36, v.z).normalize()
    nVec.lerp(dome, 0.30).normalize()
    norm.setXYZ(i, nVec.x, nVec.y, nVec.z)

    const h = THREE.MathUtils.clamp((v.y + 1) * 0.5, 0, 1)
    const dapple = Math.sin(v.x * 4.5 + v.z * 3.8) * 0.024
    // Warm sunlit cream-sage top -> calm mid -> airy cool blue-sage underside (never harsh cardboard shadow).
    const r = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.84, 1.06, Math.pow(h, 0.85)) + dapple, 0.80, 1.07)
    const g = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.91, 1.06, Math.pow(h, 0.82)) + dapple * 0.9, 0.86, 1.07)
    const b = THREE.MathUtils.clamp(THREE.MathUtils.lerp(0.88, 0.95, Math.pow(h, 0.95)) + dapple * 0.4, 0.82, 0.98)
    colors[i * 3] = r
    colors[i * 3 + 1] = g
    colors[i * 3 + 2] = b
  }
  norm.needsUpdate = true
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

function buildCanopyPixels(variant: 'mint' | 'sage'): PixelBuffers {
  const key = `clootie-canopy-${variant}-v1`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 256
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  const roughness = new Uint8Array(size * size * 4)
  // Calm Komorebi storybook greens anchored to original mint (0x9cbfa3) and sage (0xb5c7a4).
  const pal = variant === 'mint'
    ? { sun: [176, 204, 166], mid: [148, 184, 148], shade: [108, 144, 118], seed: 307 }
    : { sun: [194, 210, 162], mid: [172, 192, 148], shade: [126, 150, 112], seed: 431 }

  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      // Soft painterly gouache leaf-tuft clusters (calm stylized brushwork, zero noisy photorealism).
      const macro = periodicNoise(u * 4, v * 4, 4, 4, pal.seed + 11)
      const tufts = periodicNoise(u * 8, v * 8, 8, 8, pal.seed + 37)
      const softBrush = periodicNoise(u * 14, v * 14, 14, 14, pal.seed + 67)
      const patch = THREE.MathUtils.clamp(macro * 0.48 + tufts * 0.36 + softBrush * 0.16, 0, 1)

      const sunMix = THREE.MathUtils.smoothstep(patch, 0.48, 0.86)
      const shadeMix = (1 - THREE.MathUtils.smoothstep(patch, 0.16, 0.54)) * 0.72

      let r = THREE.MathUtils.lerp(pal.mid[0], pal.sun[0], sunMix)
      let g = THREE.MathUtils.lerp(pal.mid[1], pal.sun[1], sunMix)
      let b = THREE.MathUtils.lerp(pal.mid[2], pal.sun[2], sunMix)

      r = THREE.MathUtils.lerp(r, pal.shade[0], shadeMix)
      g = THREE.MathUtils.lerp(g, pal.shade[1], shadeMix)
      b = THREE.MathUtils.lerp(b, pal.shade[2], shadeMix)

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 212)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 218)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 178)
      color[idx + 3] = 255

      const h = THREE.MathUtils.clamp(Math.round(128 + (tufts - 0.5) * 44 + (softBrush - 0.5) * 20), 68, 196)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = h
      bump[idx + 3] = 255

      const rv = THREE.MathUtils.clamp(Math.round(234 - sunMix * 16 + shadeMix * 14), 212, 252)
      roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = rv
      roughness[idx + 3] = 255
    }
  }

  const buffers = { color, bump, roughness, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createCanopyMaterials(): {
  mint: THREE.MeshStandardMaterial
  sage: THREE.MeshStandardMaterial
} {
  const make = (variant: 'mint' | 'sage') => {
    const pixels = buildCanopyPixels(variant)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace, [2, 1.5])
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace, [2, 1.5])
    const rough = makeTexture(pixels.roughness, pixels.size, THREE.NoColorSpace, [2, 1.5])
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale: 0.0052,
      roughnessMap: rough,
      roughness: 0.92,
      metalness: 0,
      envMapIntensity: 0.30,
      vertexColors: true,
    })
    // Trigger shared tree-foliage wrapped diffuse in toon-soft for soft Komorebi canopy light.
    mat.userData.treeClusterNormals = true
    mat.userData.komorebiPigment = true
    bindTextureDisposal(mat, [map, bump, rough])
    return mat
  }
  return { mint: make('mint'), sage: make('sage') }
}

/** Softly tufted watertight moss cushion strictly bounded inside `[-1, 1]` so ground clearance stays >= 0. */
export function createMossClusterGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 16, 10)
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const v = new THREE.Vector3()

  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    const len = v.length() || 1
    const nx = v.x / len
    const ny = v.y / len
    const nz = v.z / len
    const theta = Math.atan2(nz, nx)
    const tuft = ny > -0.1
      ? 0.92 + 0.055 * Math.sin(theta * 3 + 0.6) * (1 - ny * ny) + 0.025 * Math.cos(theta * 5) * Math.max(0, ny)
      : 0.95
    const r = Math.min(0.995, tuft)
    pos.setXYZ(i, nx * r, Math.max(-0.995, ny * r), nz * r)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i)
    const h = THREE.MathUtils.clamp((y + 1) * 0.5, 0, 1)
    colors[i * 3] = THREE.MathUtils.lerp(0.74, 1.05, Math.pow(h, 0.8))
    colors[i * 3 + 1] = THREE.MathUtils.lerp(0.80, 1.06, Math.pow(h, 0.78))
    colors[i * 3 + 2] = THREE.MathUtils.lerp(0.68, 0.90, Math.pow(h, 0.95))
  }
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

/** Velvety stylized moss pile material with soft matte wrap lighting. */
export function createMossMaterial(): THREE.MeshStandardMaterial {
  const key = 'clootie-moss-pile-v1'
  let cached = cachedPixels.get(key)
  if (!cached) {
    const size = 128
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const sun = [176, 196, 130] as const
    const mid = [148, 172, 116] as const
    const deep = [100, 124, 80] as const

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const clump = periodicNoise(u * 6, v * 6, 6, 6, 601)
        const pile = periodicNoise(u * 18, v * 18, 18, 18, 631)
        const mixVal = THREE.MathUtils.clamp(clump * 0.58 + pile * 0.42, 0, 1)
        const hi = THREE.MathUtils.smoothstep(mixVal, 0.50, 0.88)
        const lo = (1 - THREE.MathUtils.smoothstep(mixVal, 0.15, 0.52)) * 0.76

        let r = THREE.MathUtils.lerp(mid[0], sun[0], hi)
        let g = THREE.MathUtils.lerp(mid[1], sun[1], hi)
        let b = THREE.MathUtils.lerp(mid[2], sun[2], hi)
        r = THREE.MathUtils.lerp(r, deep[0], lo)
        g = THREE.MathUtils.lerp(g, deep[1], lo)
        b = THREE.MathUtils.lerp(b, deep[2], lo)

        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 198)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 208)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 148)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(Math.round(128 + (pile - 0.5) * 56 + (clump - 0.5) * 28), 58, 204)
        bump[idx] = bump[idx + 1] = bump[idx + 2] = h
        bump[idx + 3] = 255
        roughness[idx] = roughness[idx + 1] = roughness[idx + 2] = 244
        roughness[idx + 3] = 255
      }
    }
    cached = { color, bump, roughness, size }
    cachedPixels.set(key, cached)
  }

  const map = makeTexture(cached.color, cached.size, THREE.SRGBColorSpace, [2, 2])
  const bump = makeTexture(cached.bump, cached.size, THREE.NoColorSpace, [2, 2])
  const mat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map,
    bumpMap: bump,
    bumpScale: 0.0055,
    roughness: 0.96,
    metalness: 0,
    envMapIntensity: 0.28,
    vertexColors: true,
  })
  mat.userData.treeClusterNormals = true
  mat.userData.komorebiPigment = true
  bindTextureDisposal(mat, [map, bump])
  return mat
}
