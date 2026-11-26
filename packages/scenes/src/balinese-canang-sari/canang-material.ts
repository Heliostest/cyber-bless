import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'

export type CanangTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type PixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  size: number
}

const cachedCanangPixels = new Map<string, PixelBuffers>()

function canangHash(ix: number, iy: number, seed: number): number {
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
  const a = canangHash(x0, y0, seed)
  const b = canangHash(x1, y0, seed)
  const c = canangHash(x0, y1, seed)
  const d = canangHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
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

// Young coconut leaf (janur) palette softly capped below Komorebi keyIntensity=2.0 clip.
const JANUR = {
  creamRib: [222, 220, 152] as const,
  yellowLeaf: [204, 212, 132] as const,
  budGreen: [178, 198, 108] as const,
  leafMid: [158, 182, 92] as const,
  foldShade: [116, 140, 68] as const,
}

/**
 * Woven young coconut-leaf square tray floor (ceper base): broad interlocking
 * palm-leaf strips with parallel midrib venation and soft warm-green fold creases.
 */
export function createCeperFloorTextures(): CanangTextureSet {
  const size = 256
  const key = 'canang-ceper-floor-v1'
  let cached = cachedCanangPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const bands = 6

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const bu = u * bands
        const bv = v * bands
        const iu = Math.floor(bu)
        const iv = Math.floor(bv)
        const fu = bu - iu
        const fv = bv - iv
        const horizontalOnTop = ((iu + iv) & 1) === 0

        // Distance from strip centerline across width (0 at midrib, 1 at strip edge).
        const across = horizontalOnTop ? Math.abs(fv - 0.5) * 2 : Math.abs(fu - 0.5) * 2
        const along = horizontalOnTop ? fu : fv

        // Soft over/under arch along the crossing strip + gentle seam tuck between adjacent strips.
        const arch = Math.sin(along * Math.PI)
        const stripGap = THREE.MathUtils.smoothstep(across, 0.80, 0.99)
        const tuckShadow = Math.pow(1 - arch, 1.5) * 0.44 + stripGap * 0.52

        // Parallel young-palm leaf veins running along each woven strip + pale central midrib.
        const veinCoord = horizontalOnTop ? fv : fu
        const veins = Math.sin(veinCoord * tau * 5 + (iu + iv) * 0.7) * 0.5 + 0.5
        const midrib = Math.exp(-Math.pow(across / 0.14, 2))
        const leafVar = canangHash(horizontalOnTop ? iv : iu, horizontalOnTop ? 3 : 7, 107)
        const organic = periodicNoise(u * 4, v * 4, 4, 4, 149)

        // Blend between cool bud-green and warm sunlit yellow-green across strips.
        const toneMix = THREE.MathUtils.clamp(
          (horizontalOnTop ? 0.34 : 0.62) + (leafVar - 0.5) * 0.28 + (organic - 0.5) * 0.18,
          0,
          1,
        )
        const baseR = THREE.MathUtils.lerp(JANUR.leafMid[0], JANUR.yellowLeaf[0], toneMix)
        const baseG = THREE.MathUtils.lerp(JANUR.leafMid[1], JANUR.yellowLeaf[1], toneMix)
        const baseB = THREE.MathUtils.lerp(JANUR.leafMid[2], JANUR.yellowLeaf[2], toneMix)

        const crest = THREE.MathUtils.clamp(midrib * 0.52 + veins * 0.18 + arch * 0.16, 0, 0.72)
        const litR = THREE.MathUtils.lerp(baseR, JANUR.creamRib[0], crest * 0.65)
        const litG = THREE.MathUtils.lerp(baseG, JANUR.creamRib[1], crest * 0.65)
        const litB = THREE.MathUtils.lerp(baseB, JANUR.creamRib[2], crest * 0.60)

        const shade = THREE.MathUtils.clamp(tuckShadow, 0, 0.82)
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litR, JANUR.foldShade[0], shade)), 0, 222)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litG, JANUR.foldShade[1], shade)), 0, 224)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litB, JANUR.foldShade[2], shade)), 0, 158)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(126 + (arch - 0.45) * 38 + midrib * 28 + (veins - 0.5) * 14 - stripGap * 44),
          42,
          216,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        // Young coconut leaf has a soft waxy-matte sheen on raised ribs, matte in fold seams.
        const rVal = THREE.MathUtils.clamp(
          Math.round(212 - midrib * 20 - arch * 12 + shade * 32),
          178,
          248,
        )
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedCanangPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

/**
 * Folded young coconut-leaf tray side walls: horizontal parallel palm veins along `u`,
 * luminous folded top rim lip, subtle bottom crease, and gentle vertical pleat tucks.
 */
export function createCeperWallTextures(offset?: readonly [number, number]): CanangTextureSet {
  const size = 256
  const key = 'canang-ceper-wall-v1'
  let cached = cachedCanangPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const meander = (periodicNoise(u * 3, v * 2, 3, 2, 211) - 0.5) * 0.035
        const vm = v + meander

        // Parallel young-leaf veins running along the horizontal rim strip (`u`).
        const veins = Math.sin(vm * tau * 8) * 0.58 + Math.sin(vm * tau * 16 + 0.8) * 0.24
        const topLip = THREE.MathUtils.smoothstep(v, 0.78, 0.96)
        const bottomFold = 1 - THREE.MathUtils.smoothstep(v, 0.04, 0.24)
        // Subtle pleated panel rhythm along the wall (5 bays aligned with the 5 rim pins).
        const pleatDist = Math.abs(((u * 5 + 0.5) % 1) - 0.5) * 2
        const pleatCrease = Math.exp(-Math.pow((1 - pleatDist) / 0.09, 2)) * 0.42
        const drift = periodicNoise(u * 4, v * 2, 4, 2, 241)

        const baseR = THREE.MathUtils.lerp(JANUR.leafMid[0], JANUR.budGreen[0], drift)
        const baseG = THREE.MathUtils.lerp(JANUR.leafMid[1], JANUR.budGreen[1], drift)
        const baseB = THREE.MathUtils.lerp(JANUR.leafMid[2], JANUR.budGreen[2], drift)

        const lift = THREE.MathUtils.clamp(topLip * 0.52 + Math.max(0, veins) * 0.26, 0, 0.72)
        const litR = THREE.MathUtils.lerp(baseR, JANUR.creamRib[0], lift * 0.65)
        const litG = THREE.MathUtils.lerp(baseG, JANUR.creamRib[1], lift * 0.65)
        const litB = THREE.MathUtils.lerp(baseB, JANUR.creamRib[2], lift * 0.60)

        const shade = THREE.MathUtils.clamp(
          bottomFold * 0.42 + pleatCrease + Math.max(0, -veins) * 0.22,
          0,
          0.76,
        )
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litR, JANUR.foldShade[0], shade)), 0, 222)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litG, JANUR.foldShade[1], shade)), 0, 224)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litB, JANUR.foldShade[2], shade)), 0, 158)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + veins * 28 + topLip * 26 - bottomFold * 20 - pleatCrease * 38),
          46,
          212,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(210 - topLip * 18 + shade * 28), 182, 246)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedCanangPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace, undefined, offset),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace, undefined, offset),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace, undefined, offset),
  }
}

/**
 * Radiating folded-leaf rosette texture for the round `canang-sampiyan` disk
 * (mapped cleanly around CylinderGeometry's circular top cap centered at (0.5, 0.5)).
 */
export function createSampiyanDiskTextures(): CanangTextureSet {
  const size = 256
  const key = 'canang-sampiyan-disk-v1'
  let cached = cachedCanangPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const petals = 12

    for (let y = 0; y < size; y++) {
      const v = y / size
      const dv = (v - 0.5) * 2
      for (let x = 0; x < size; x++) {
        const u = x / size
        const du = (u - 0.5) * 2
        const r = Math.hypot(du, dv)
        const theta = Math.atan2(dv, du)
        const sectorPos = ((theta / tau + 1) * petals) % 1
        const sectorIdx = Math.floor(((theta / tau + 1) * petals)) % petals
        const sectorCenter = Math.abs(sectorPos - 0.5) * 2 // 0 at midrib, 1 at fold edge

        // Soft folded fan pleats + radial leaf veins inside each of the 12 sampiyan sectors.
        const foldArch = Math.sin(sectorPos * Math.PI)
        const foldCrease = Math.pow(1 - foldArch, 1.8) * THREE.MathUtils.smoothstep(r, 0.14, 0.34)
        const radialVeins = Math.sin(sectorPos * tau * 4) * 0.5 + 0.5
        const midrib = Math.exp(-Math.pow(sectorCenter / 0.16, 2)) * THREE.MathUtils.smoothstep(r, 0.18, 0.42)
        // Concentric folded inner collar & scalloped bud-green outer rim.
        const innerRing = Math.exp(-Math.pow((r - 0.44) / 0.045, 2)) * 0.34
        const outerRim = THREE.MathUtils.smoothstep(r, 0.78, 0.98) * 0.48
        const alt = (sectorIdx & 1) === 0 ? 0.65 : 0.30
        const drift = periodicNoise(u * 4, v * 4, 4, 4, 313)

        const toneMix = THREE.MathUtils.clamp(alt + (drift - 0.5) * 0.22 - outerRim * 0.35, 0, 1)
        const baseR = THREE.MathUtils.lerp(JANUR.budGreen[0], JANUR.yellowLeaf[0], toneMix)
        const baseG = THREE.MathUtils.lerp(JANUR.budGreen[1], JANUR.yellowLeaf[1], toneMix)
        const baseB = THREE.MathUtils.lerp(JANUR.budGreen[2], JANUR.yellowLeaf[2], toneMix)

        const lift = THREE.MathUtils.clamp(midrib * 0.48 + radialVeins * 0.18, 0, 0.62)
        const litR = THREE.MathUtils.lerp(baseR, JANUR.creamRib[0], lift * 0.60)
        const litG = THREE.MathUtils.lerp(baseG, JANUR.creamRib[1], lift * 0.60)
        const litB = THREE.MathUtils.lerp(baseB, JANUR.creamRib[2], lift * 0.56)

        const shade = THREE.MathUtils.clamp(foldCrease * 0.58 + innerRing + outerRim * 0.36, 0, 0.78)
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litR, JANUR.foldShade[0], shade)), 0, 222)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litG, JANUR.foldShade[1], shade)), 0, 224)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litB, JANUR.foldShade[2], shade)), 0, 158)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(126 + (foldArch - 0.45) * 36 + midrib * 22 + (radialVeins - 0.5) * 14 - innerRing * 28 - outerRim * 18),
          46,
          212,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(214 - midrib * 16 + shade * 26), 184, 248)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedCanangPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

/**
 * Longitudinal young-palm-leaf strip texture for the 12 radiating `canang-sampiyan-weave-*`
 * strips (`BoxGeometry(.073, .009, .44)`: on `+Y` face, `v` runs along the .44 length and `u` across .073).
 */
export function createLeafStripTextures(variant: 'light' | 'bud'): CanangTextureSet {
  const size = 128
  const key = `canang-strip-${variant}-v1`
  let cached = cachedCanangPixels.get(key)
  if (!cached) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const roughness = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const seed = variant === 'light' ? 401 : 467

    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const across = Math.abs(u - 0.5) * 2 // 0 at central midrib, 1 at strip margin
        const midrib = Math.exp(-Math.pow(across / 0.18, 2))
        const margin = THREE.MathUtils.smoothstep(across, 0.66, 0.98)
        const veins = Math.sin(u * tau * 6 + Math.sin(v * tau) * 0.15) * 0.5 + 0.5
        const lengthGrad = 0.5 + 0.5 * Math.sin(v * Math.PI)
        const drift = periodicNoise(u * 3, v * 3, 3, 3, seed)

        const low = variant === 'light' ? JANUR.budGreen : JANUR.leafMid
        const high = variant === 'light' ? JANUR.yellowLeaf : JANUR.budGreen
        const t = THREE.MathUtils.clamp(0.45 + (drift - 0.5) * 0.30 + (lengthGrad - 0.5) * 0.22, 0, 1)
        const baseR = THREE.MathUtils.lerp(low[0], high[0], t)
        const baseG = THREE.MathUtils.lerp(low[1], high[1], t)
        const baseB = THREE.MathUtils.lerp(low[2], high[2], t)

        const lift = THREE.MathUtils.clamp(midrib * 0.66 + veins * 0.18, 0, 0.78)
        const litR = THREE.MathUtils.lerp(baseR, JANUR.creamRib[0], lift * 0.72)
        const litG = THREE.MathUtils.lerp(baseG, JANUR.creamRib[1], lift * 0.72)
        const litB = THREE.MathUtils.lerp(baseB, JANUR.creamRib[2], lift * 0.68)

        const shade = THREE.MathUtils.clamp(margin * 0.52 + (1 - veins) * 0.14, 0, 0.72)
        const idx = (y * size + x) * 4
        color[idx] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litR, JANUR.foldShade[0], shade)), 0, 222)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litG, JANUR.foldShade[1], shade)), 0, 224)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(litB, JANUR.foldShade[2], shade)), 0, 158)
        color[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(126 + midrib * 36 + (veins - 0.5) * 18 - margin * 28),
          52,
          212,
        )
        bump[idx] = h
        bump[idx + 1] = h
        bump[idx + 2] = h
        bump[idx + 3] = 255

        const rVal = THREE.MathUtils.clamp(Math.round(210 - midrib * 18 + shade * 26), 182, 246)
        roughness[idx] = rVal
        roughness[idx + 1] = rVal
        roughness[idx + 2] = rVal
        roughness[idx + 3] = 255
      }
    }

    cached = { color, bump, roughness, size }
    cachedCanangPixels.set(key, cached)
  }

  return {
    map: buildDataTexture(cached.color, size, THREE.SRGBColorSpace),
    bump: buildDataTexture(cached.bump, size, THREE.NoColorSpace),
    roughness: buildDataTexture(cached.roughness, size, THREE.NoColorSpace),
  }
}

export type CanangTrayMaterials = {
  ceperFloor: THREE.MeshStandardMaterial
  ceperWall: THREE.MeshStandardMaterial
  sampiyanDisk: THREE.MeshStandardMaterial
  sampiyanStripLight: THREE.MeshStandardMaterial
  sampiyanStripBud: THREE.MeshStandardMaterial
  leafSeam: THREE.MeshStandardMaterial
  rimStitch: THREE.MeshStandardMaterial
  incenseStick: THREE.MeshStandardMaterial
  dispose(): void
}

function makeLeafMaterial(tex: CanangTextureSet, roughness: number, bumpScale: number): THREE.MeshStandardMaterial {
  return new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: tex.map,
    bumpMap: tex.bump,
    bumpScale,
    roughnessMap: tex.roughness,
    roughness,
    metalness: 0,
    envMapIntensity: 0.36,
  })
}

/**
 * Builds the young coconut-leaf tray suite plus finely grained bamboo rim pins
 * and incense sticks (keeping flowers, petals, food, betel nut, coins and stone separate).
 */
export function createCanangTrayMaterials(): CanangTrayMaterials {
  const floorTex = createCeperFloorTextures()
  const wallTex = createCeperWallTextures()
  const diskTex = createSampiyanDiskTextures()
  const stripLightTex = createLeafStripTextures('light')
  const stripBudTex = createLeafStripTextures('bud')

  const ownedTextures: THREE.DataTexture[] = [
    floorTex.map, floorTex.bump, floorTex.roughness,
    wallTex.map, wallTex.bump, wallTex.roughness,
    diskTex.map, diskTex.bump, diskTex.roughness,
    stripLightTex.map, stripLightTex.bump, stripLightTex.roughness,
    stripBudTex.map, stripBudTex.bump, stripBudTex.roughness,
  ]

  const ceperFloor = makeLeafMaterial(floorTex, 0.84, 0.0052)
  const ceperWall = makeLeafMaterial(wallTex, 0.84, 0.0048)
  const sampiyanDisk = makeLeafMaterial(diskTex, 0.85, 0.0046)
  const sampiyanStripLight = makeLeafMaterial(stripLightTex, 0.84, 0.0038)
  const sampiyanStripBud = makeLeafMaterial(stripBudTex, 0.85, 0.0038)
  const leafSeam = sampiyanStripLight

  // Bamboo rim stitches (semat) pinned vertically along the tray lip.
  const rimStitch = new THREE.MeshStandardMaterial({ color: 0x9b7755, roughness: 0.78 })
  applyCraftSurface(rimStitch, { kind: 'bamboo', axis: 'y', scale: 2.0, strength: 0.36 })

  // Unlit incense sticks running along Z on the tray's right side.
  const incenseStick = new THREE.MeshStandardMaterial({ color: 0x947057, roughness: 0.86 })
  applyCraftSurface(incenseStick, { kind: 'wood', axis: 'z', scale: 1.8, strength: 0.38 })

  let disposed = false
  return {
    ceperFloor,
    ceperWall,
    sampiyanDisk,
    sampiyanStripLight,
    sampiyanStripBud,
    leafSeam,
    rimStitch,
    incenseStick,
    dispose() {
      if (disposed) return
      disposed = true
      for (const tex of ownedTextures) tex.dispose()
    },
  }
}
