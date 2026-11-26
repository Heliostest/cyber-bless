import * as THREE from 'three'

export type KayaTextureSet = {
  map: THREE.DataTexture
  bump: THREE.DataTexture
  roughness: THREE.DataTexture
}

type KayaPixelBuffers = {
  color: Uint8Array
  bump: Uint8Array
  roughness: Uint8Array
  width: number
  height: number
}

let cachedKayaPixels: KayaPixelBuffers | null = null

function kayaHash(ix: number, iy: number, seed: number): number {
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
  const a = kayaHash(x0, y0, seed)
  const b = kayaHash(x1, y0, seed)
  const c = kayaHash(x0, y1, seed)
  const d = kayaHash(x1, y1, seed)
  return a + (b - a) * ux + (c + (d - c) * ux - (a + (b - a) * ux)) * uy
}

function buildDataTexture(
  source: Uint8Array,
  width: number,
  height: number,
  colorSpace: THREE.ColorSpace,
): THREE.DataTexture {
  const tex = new THREE.DataTexture(new Uint8Array(source), width, height)
  tex.colorSpace = colorSpace
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping
  tex.magFilter = THREE.LinearFilter
  tex.minFilter = THREE.LinearMipmapLinearFilter
  tex.generateMipmaps = true
  tex.anisotropy = 4
  tex.needsUpdate = true
  return tex
}

// Summer purification kaya-grass (Imperata cylindrica) palette: cool fresh green
// blades interwoven with sunlit yellow-green and warm cured-straw blades, plus
// twisted hemp/straw cord lashings and warm olive-earth crevices.
const KAYA = {
  freshLight: [182, 198, 112] as const,
  freshMid: [144, 170, 88] as const,
  freshCool: [122, 154, 80] as const,
  dryWarm: [188, 174, 110] as const,
  dryGold: [198, 186, 120] as const,
  crevice: [92, 110, 56] as const,
  cinchDark: [68, 78, 44] as const,
  cordLight: [186, 160, 110] as const,
  cordMid: [146, 120, 78] as const,
  cordDark: [96, 76, 46] as const,
}

/**
 * 1024x256 deterministic bundled kaya-grass hoop textures (map + bump + roughness)
 * aligned to TorusGeometry(1.38, 0.15, 12, 96): `u` runs around the 8.67m ring
 * circumference and `v` wraps around the 0.94m grass-bundle cross-section.
 *
 * Features stylized circumferential grass ribbons with subtle helical bundle flow,
 * fresh-green / warm-cured blade interplay, 6 multi-wrap hemp cord bindings centered
 * at `u = k/6` (aligning with the two post ties at u = 0 and u = 0.5), and dark
 * cinch seams where each lashing compresses the kaya bundle.
 */
export function createKayaTextures(): KayaTextureSet {
  const width = 1024
  const height = 256
  if (!cachedKayaPixels) {
    const color = new Uint8Array(width * height * 4)
    const bump = new Uint8Array(width * height * 4)
    const roughness = new Uint8Array(width * height * 4)
    const tau = Math.PI * 2
    const bindings = 6
    const ribbonCount = 26

    for (let y = 0; y < height; y++) {
      const v = y / height
      for (let x = 0; x < width; x++) {
        const u = x / width

        // Distance from the nearest of 6 circumferential bindings centered at u = k/6.
        const segPhase = (u * bindings + 0.5) % 1
        const bindDelta = segPhase - 0.5 // [-0.5, 0.5]
        const bindAbs = Math.abs(bindDelta)
        const bindHalfWidth = 0.022 // ~4.4% of each segment width (~6.4cm cord band)

        // Subtle organic helical wrap + natural clump meander along `u`.
        // Integer ribbon shift per full ring keeps `u = 0..1` seamlessly periodic.
        const meander = Math.sin(u * tau * 6 + v * tau * 2) * 0.014
          + (periodicNoise(u * 12, v * 4, 12, 4, 137) - 0.5) * 0.030
        const vFlow = ((v + u * (2 / ribbonCount) + meander) % 1 + 1) % 1

        // Stylized bundled kaya grass stalks around `vFlow` (26 slender hand-gathered bundles
        // with dual inner grass-blade pleats so it reads as bundled stems, never wide tubes).
        const ribPos = vFlow * ribbonCount
        const ribIdx = Math.floor(ribPos)
        const ribFrac = ribPos - ribIdx
        const ribArch = Math.sin(ribFrac * Math.PI)
        const ribGap = Math.pow(1 - ribArch, 1.85)

        // Overlapping staggered stalk lengths along `u`.
        const segLenPos = u * 24 + kayaHash(ribIdx, 7, 199) * 3.0
        const segCell = Math.floor(segLenPos) % 24
        const segFrac = segLenPos - Math.floor(segLenPos)
        const bladeLap = Math.exp(-Math.pow((segFrac - 0.5) / 0.12, 2)) * 0.22

        // Inner parallel leaf-blade veins along each bundled stem.
        const subBladePos = ribFrac * 2.0
        const subBladeIdx = Math.floor(subBladePos)
        const subBlade = Math.sin((subBladePos + kayaHash(ribIdx, 19, 241)) * tau)
        const microStreak = periodicNoise(u * 20, vFlow * 56, 20, 56, 293) - 0.5

        // Interweave cool fresh summer kaya green with delicate warm sun-cured dry blades
        // at individual sub-blade granularity so dry stalks stay painterly and never bandy.
        const ribKind = kayaHash(ribIdx * 2 + subBladeIdx, 31, 353)
        const cellKind = kayaHash(ribIdx * 2 + subBladeIdx, segCell, 409)
        const warmNoise = periodicNoise(u * 14, vFlow * 20, 14, 20, 461)
        const dryMix = THREE.MathUtils.clamp(
          THREE.MathUtils.smoothstep(ribKind * 0.58 + cellKind * 0.42, 0.56, 0.88) * 0.78
            + (warmNoise - 0.5) * 0.22,
          0,
          0.82,
        )
        const coolMix = THREE.MathUtils.clamp(1 - ribKind * 0.80 + (0.5 - warmNoise) * 0.24, 0, 1)

        // Fresh kaya blade base (cool olive-green -> summer meadow-green) blended with warm cured grass.
        const greenR = THREE.MathUtils.lerp(KAYA.freshMid[0], KAYA.freshCool[0], coolMix * 0.52)
        const greenG = THREE.MathUtils.lerp(KAYA.freshMid[1], KAYA.freshCool[1], coolMix * 0.52)
        const greenB = THREE.MathUtils.lerp(KAYA.freshMid[2], KAYA.freshCool[2], coolMix * 0.52)

        const baseR = THREE.MathUtils.lerp(greenR, KAYA.dryWarm[0], dryMix)
        const baseG = THREE.MathUtils.lerp(greenG, KAYA.dryWarm[1], dryMix)
        const baseB = THREE.MathUtils.lerp(greenB, KAYA.dryWarm[2], dryMix)

        const hiR = THREE.MathUtils.lerp(KAYA.freshLight[0], KAYA.dryGold[0], dryMix)
        const hiG = THREE.MathUtils.lerp(KAYA.freshLight[1], KAYA.dryGold[1], dryMix)
        const hiB = THREE.MathUtils.lerp(KAYA.freshLight[2], KAYA.dryGold[2], dryMix)

        const crest = THREE.MathUtils.clamp(
          Math.max(0, ribArch - 0.35) * 0.62 + Math.max(0, subBlade) * 0.24 + Math.max(0, microStreak) * 0.26,
          0,
          0.72,
        )
        const litR = THREE.MathUtils.lerp(baseR, hiR, crest * 0.62)
        const litG = THREE.MathUtils.lerp(baseG, hiG, crest * 0.62)
        const litB = THREE.MathUtils.lerp(baseB, hiB, crest * 0.58)

        const grassShade = THREE.MathUtils.clamp(
          ribGap * 0.54 + Math.max(0, -subBlade) * 0.20 + Math.max(0, -microStreak) * 0.22 + bladeLap,
          0,
          0.78,
        )
        let fR = THREE.MathUtils.lerp(litR, KAYA.crevice[0], grassShade)
        let fG = THREE.MathUtils.lerp(litG, KAYA.crevice[1], grassShade)
        let fB = THREE.MathUtils.lerp(litB, KAYA.crevice[2], grassShade)

        let h = 128 + (ribArch - 0.48) * 58 + subBlade * 16 + microStreak * 26 - bladeLap * 24
        let rVal = 232 - crest * 18 + grassShade * 18

        // Soft cinch/compression shadow immediately flanking each binding cord.
        const outsideBind = Math.max(0, bindAbs - bindHalfWidth)
        const cinchShadow = Math.exp(-Math.pow(outsideBind / 0.015, 2)) * (bindAbs >= bindHalfWidth ? 1 : 0)
        if (cinchShadow > 0.001) {
          fR = THREE.MathUtils.lerp(fR, KAYA.cinchDark[0], cinchShadow * 0.66)
          fG = THREE.MathUtils.lerp(fG, KAYA.cinchDark[1], cinchShadow * 0.66)
          fB = THREE.MathUtils.lerp(fB, KAYA.cinchDark[2], cinchShadow * 0.66)
          h -= cinchShadow * 34
          rVal += cinchShadow * 16
        }

        // Stylized multi-turn twisted hemp/straw cord wrap inside the binding band.
        const cordMask = 1 - THREE.MathUtils.smoothstep(bindAbs, bindHalfWidth - 0.0035, bindHalfWidth + 0.002)
        if (cordMask > 0.001) {
          const cordU = (bindDelta / bindHalfWidth) * 0.5 + 0.5 // 0..1 across band width
          const wraps = 3.0
          const wrapPos = cordU * wraps
          const wrapFrac = wrapPos - Math.floor(wrapPos)
          const wrapArch = Math.sin(wrapFrac * Math.PI)
          const wrapSeam = Math.pow(1 - wrapArch, 1.8)
          // Diagonal 2-ply cord twist texture running around `v`.
          const ply = Math.sin((v * 26 - cordU * 6) * tau) * 0.5 + 0.5
          const cordTone = THREE.MathUtils.clamp(wrapArch * 0.62 + ply * 0.38, 0, 1)
          const cBaseR = THREE.MathUtils.lerp(KAYA.cordMid[0], KAYA.cordLight[0], cordTone)
          const cBaseG = THREE.MathUtils.lerp(KAYA.cordMid[1], KAYA.cordLight[1], cordTone)
          const cBaseB = THREE.MathUtils.lerp(KAYA.cordMid[2], KAYA.cordLight[2], cordTone)
          const cEdge = THREE.MathUtils.clamp(wrapSeam * 0.72 + (1 - ply) * 0.18, 0, 0.85)
          const cR = THREE.MathUtils.lerp(cBaseR, KAYA.cordDark[0], cEdge)
          const cG = THREE.MathUtils.lerp(cBaseG, KAYA.cordDark[1], cEdge)
          const cB = THREE.MathUtils.lerp(cBaseB, KAYA.cordDark[2], cEdge)

          fR = THREE.MathUtils.lerp(fR, cR, cordMask)
          fG = THREE.MathUtils.lerp(fG, cG, cordMask)
          fB = THREE.MathUtils.lerp(fB, cB, cordMask)

          const cordH = 148 + (wrapArch - 0.4) * 54 + (ply - 0.5) * 20
          h = THREE.MathUtils.lerp(h, cordH, cordMask)
          rVal = THREE.MathUtils.lerp(rVal, 238 + wrapSeam * 14, cordMask)
        }

        const idx = (y * width + x) * 4
        // Cap peaks softly below Komorebi daylight clip so the top hoop stays soft & painterly.
        color[idx] = THREE.MathUtils.clamp(Math.round(fR), 0, 212)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(fG), 0, 214)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(fB), 0, 148)
        color[idx + 3] = 255

        const bumpByte = THREE.MathUtils.clamp(Math.round(h), 34, 224)
        bump[idx] = bumpByte
        bump[idx + 1] = bumpByte
        bump[idx + 2] = bumpByte
        bump[idx + 3] = 255

        const roughByte = THREE.MathUtils.clamp(Math.round(rVal), 210, 253)
        roughness[idx] = roughByte
        roughness[idx + 1] = roughByte
        roughness[idx + 2] = roughByte
        roughness[idx + 3] = 255
      }
    }

    cachedKayaPixels = { color, bump, roughness, width, height }
  }

  return {
    map: buildDataTexture(cachedKayaPixels.color, cachedKayaPixels.width, cachedKayaPixels.height, THREE.SRGBColorSpace),
    bump: buildDataTexture(cachedKayaPixels.bump, cachedKayaPixels.width, cachedKayaPixels.height, THREE.NoColorSpace),
    roughness: buildDataTexture(cachedKayaPixels.roughness, cachedKayaPixels.width, cachedKayaPixels.height, THREE.NoColorSpace),
  }
}

export type ChinowaKayaMaterial = {
  material: THREE.MeshStandardMaterial
  textures: KayaTextureSet
  dispose(): void
}

export function createChinowaKayaMaterial(): ChinowaKayaMaterial {
  const textures = createKayaTextures()
  const material = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    map: textures.map,
    bumpMap: textures.bump,
    bumpScale: 0.014,
    roughnessMap: textures.roughness,
    roughness: 0.95,
    metalness: 0,
    envMapIntensity: 0.34,
  })
  let disposed = false
  return {
    material,
    textures,
    dispose() {
      if (disposed) return
      disposed = true
      textures.map.dispose()
      textures.bump.dispose()
      textures.roughness.dispose()
    },
  }
}
