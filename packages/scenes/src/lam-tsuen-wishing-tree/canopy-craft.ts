import * as THREE from 'three'

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
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

function makeTexture(source: Uint8Array, size: number, colorSpace: THREE.ColorSpace): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), size, size)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.repeat.set(2, 1.5)
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

/**
 * Softly pillowed watertight canopy cluster for the modern replica wishing tree,
 * replacing harsh `IcosahedronGeometry(1, 1)` low-poly facets while remaining
 * clearly a stylized artificial canopy (never a photoreal banyan) and strictly
 * bounded inside unit radius `1.0`.
 */
export function createReplicaCanopyClusterGeometry(): THREE.BufferGeometry {
  const geo = new THREE.SphereGeometry(1, 20, 14)
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
    // Gentle stylized molded-foliage scallop, strictly bounded <= 0.995.
    const r = Math.min(
      0.995,
      0.945
        + 0.036 * Math.sin(theta * 3 + 0.5) * Math.cos(phi * 2) * sinPhi
        + 0.020 * Math.cos(theta * 5 - phi) * sinPhi,
    )
    pos.setXYZ(i, nx * r, ny * r, nz * r)
  }
  pos.needsUpdate = true
  geo.computeVertexNormals()

  const norm = geo.getAttribute('normal') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  const dome = new THREE.Vector3()
  const nVec = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i)
    nVec.fromBufferAttribute(norm, i)
    dome.set(v.x, v.y + 0.32, v.z).normalize()
    nVec.lerp(dome, 0.25).normalize()
    norm.setXYZ(i, nVec.x, nVec.y, nVec.z)

    const h = THREE.MathUtils.clamp((v.y + 1) * 0.5, 0, 1)
    // Calm top-to-bottom shading softens the dark undersides of the 5 replica canopy blobs.
    colors[i * 3] = THREE.MathUtils.lerp(0.86, 1.04, Math.pow(h, 0.85))
    colors[i * 3 + 1] = THREE.MathUtils.lerp(0.92, 1.05, Math.pow(h, 0.82))
    colors[i * 3 + 2] = THREE.MathUtils.lerp(0.85, 0.96, Math.pow(h, 0.92))
  }
  norm.needsUpdate = true
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  return geo
}

function buildReplicaCanopyPixels(variant: 'main' | 'light'): PixelBuffers {
  const key = `lamtsuen-replica-canopy-${variant}-v1`
  const existing = cachedPixels.get(key)
  if (existing) return existing

  const size = 128
  const color = new Uint8Array(size * size * 4)
  const bump = new Uint8Array(size * size * 4)
  // Softened modern conservation replica greens (calmer contrast between alternating blobs).
  const pal = variant === 'main'
    ? { hi: [148, 186, 108], mid: [125, 166, 94], lo: [96, 134, 76], seed: 709 }
    : { hi: [176, 200, 118], mid: [152, 182, 104], lo: [118, 148, 86], seed: 823 }

  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      // Restrained uniform molded-tuft pattern keeps the stylized artificial-canopy identity clear.
      const puff = periodicNoise(u * 6, v * 6, 6, 6, pal.seed + 17)
      const grain = periodicNoise(u * 12, v * 12, 12, 12, pal.seed + 43)
      const t = THREE.MathUtils.clamp(puff * 0.65 + grain * 0.35, 0, 1)
      const hiMix = THREE.MathUtils.smoothstep(t, 0.50, 0.88)
      const loMix = (1 - THREE.MathUtils.smoothstep(t, 0.14, 0.50)) * 0.62

      let r = THREE.MathUtils.lerp(pal.mid[0], pal.hi[0], hiMix)
      let g = THREE.MathUtils.lerp(pal.mid[1], pal.hi[1], hiMix)
      let b = THREE.MathUtils.lerp(pal.mid[2], pal.hi[2], hiMix)
      r = THREE.MathUtils.lerp(r, pal.lo[0], loMix)
      g = THREE.MathUtils.lerp(g, pal.lo[1], loMix)
      b = THREE.MathUtils.lerp(b, pal.lo[2], loMix)

      const idx = (y * size + x) * 4
      color[idx] = THREE.MathUtils.clamp(Math.round(r), 0, 198)
      color[idx + 1] = THREE.MathUtils.clamp(Math.round(g), 0, 212)
      color[idx + 2] = THREE.MathUtils.clamp(Math.round(b), 0, 138)
      color[idx + 3] = 255

      const h = THREE.MathUtils.clamp(Math.round(128 + (puff - 0.5) * 34 + (grain - 0.5) * 16), 82, 178)
      bump[idx] = bump[idx + 1] = bump[idx + 2] = h
      bump[idx + 3] = 255
    }
  }

  const buffers = { color, bump, size }
  cachedPixels.set(key, buffers)
  return buffers
}

export function createReplicaCanopyMaterials(): {
  leaf: THREE.MeshStandardMaterial
  lightLeaf: THREE.MeshStandardMaterial
} {
  const make = (variant: 'main' | 'light') => {
    const pixels = buildReplicaCanopyPixels(variant)
    const map = makeTexture(pixels.color, pixels.size, THREE.SRGBColorSpace)
    const bump = makeTexture(pixels.bump, pixels.size, THREE.NoColorSpace)
    // Satin-matte stylized replica finish (clearly artificial conservation canopy, never photoreal leaves).
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map,
      bumpMap: bump,
      bumpScale: 0.0038,
      roughness: 0.76,
      metalness: 0,
      envMapIntensity: 0.34,
      vertexColors: true,
    })
    mat.userData.treeClusterNormals = true
    mat.userData.komorebiPigment = true
    bindTextureDisposal(mat, [map, bump])
    return mat
  }
  return { leaf: make('main'), lightLeaf: make('light') }
}
