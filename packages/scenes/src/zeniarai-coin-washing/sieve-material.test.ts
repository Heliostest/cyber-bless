// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createBambooSieveMaterials,
  createSieveFloorTextures,
  createSieveRimTextures,
  createSieveWallTextures,
  warmBambooTint,
} from './sieve-material'

function channelStats(tex: THREE.DataTexture) {
  const data = tex.image.data as Uint8Array
  let sumR = 0, sumG = 0, sumB = 0
  let maxR = 0, maxG = 0, maxB = 0
  const pixels = data.length / 4
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i]!, g = data[i + 1]!, b = data[i + 2]!
    sumR += r; sumG += g; sumB += b
    if (r > maxR) maxR = r
    if (g > maxG) maxG = g
    if (b > maxB) maxB = b
  }
  return {
    meanR: sumR / pixels,
    meanG: sumG / pixels,
    meanB: sumB / pixels,
    maxR,
    maxG,
    maxB,
  }
}

describe('zeniarai-coin-washing stylized bamboo sieve material', () => {
  it('generates deterministic bamboo wall, rim, and floor textures with Komorebi highlight headroom and darker rim hoop', () => {
    const wallA = createSieveWallTextures([6, 1])
    const wallB = createSieveWallTextures([6, 1])
    const rim = createSieveRimTextures([6, 1])
    const floor = createSieveFloorTextures()

    expect(Array.from(wallA.map.image.data as Uint8Array)).toEqual(Array.from(wallB.map.image.data as Uint8Array))
    expect(Array.from(wallA.bump.image.data as Uint8Array)).toEqual(Array.from(wallB.bump.image.data as Uint8Array))
    expect(Array.from(wallA.roughness.image.data as Uint8Array)).toEqual(Array.from(wallB.roughness.image.data as Uint8Array))

    for (const set of [wallA, rim, floor]) {
      expect(set.map.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(set.bump.colorSpace).toBe(THREE.NoColorSpace)
      expect(set.roughness.colorSpace).toBe(THREE.NoColorSpace)
      expect(set.map.wrapS).toBe(THREE.RepeatWrapping)
      expect(set.map.wrapT).toBe(THREE.RepeatWrapping)
      expect(set.map.generateMipmaps).toBe(true)

      const stats = channelStats(set.map)
      // Warm bamboo ordering (R > G > B) and restrained sunlit peak cap for Komorebi daylight.
      expect(stats.meanR).toBeGreaterThan(stats.meanG + 10)
      expect(stats.meanG).toBeGreaterThan(stats.meanB + 35)
      expect(stats.maxR).toBeLessThanOrEqual(234)
      expect(stats.maxG).toBeLessThanOrEqual(214)
      expect(stats.maxB).toBeLessThanOrEqual(162)
    }

    const wallStats = channelStats(wallA.map)
    const rimStats = channelStats(rim.map)
    // Rim hoop should be noticeably darker/more roasted than the rice-bamboo wall weave.
    const wallLuma = (wallStats.meanR + wallStats.meanG + wallStats.meanB) / 3
    const rimLuma = (rimStats.meanR + rimStats.meanG + rimStats.meanB) / 3
    expect(rimLuma).toBeLessThan(wallLuma - 14)

    for (const set of [wallA, wallB, rim, floor]) {
      set.map.dispose(); set.bump.dispose(); set.roughness.dispose()
    }
  })

  it('produces clear crossed bamboo-splint weave relief on walls and hole-aligned splints on the floor', () => {
    const wall = createSieveWallTextures()
    const floor = createSieveFloorTextures()
    const size = wall.bump.image.width as number
    const wallBump = wall.bump.image.data as Uint8Array
    const floorBump = floor.bump.image.data as Uint8Array

    // Wall weave band (v < 0.78) should exhibit clear raised crowns and recessed crevices.
    let minW = 255, maxW = 0
    for (let y = 0; y < Math.floor(size * 0.75); y += 2) {
      for (let x = 0; x < size; x += 2) {
        const h = wallBump[(y * size + x) * 4]!
        if (h < minW) minW = h
        if (h > maxW) maxW = h
      }
    }
    expect(maxW - minW).toBeGreaterThan(100)

    // Floor weave: splint bands (centered at 0.375, 0.875) should sit visibly higher than even-even recess cells (0.125, 0.125).
    const sample = (u: number, v: number) => {
      const ix = Math.floor(u * size) % size
      const iy = Math.floor(v * size) % size
      return floorBump[(iy * size + ix) * 4]!
    }
    const splintBridge = sample(0.375, 0.125)
    const splintCrossing = sample(0.375, 0.375)
    const recessCell = sample(0.125, 0.125)
    expect(splintBridge).toBeGreaterThan(recessCell + 55)
    expect(splintCrossing).toBeGreaterThan(recessCell + 55)

    wall.map.dispose(); wall.bump.dispose(); wall.roughness.dispose()
    floor.map.dispose(); floor.bump.dispose(); floor.roughness.dispose()
  })

  it('creates warm bamboo vertex tints and disposes every owned texture exactly once', () => {
    const [r0, g0, b0] = warmBambooTint(0.0)
    const [r1, g1, b1] = warmBambooTint(0.6)
    expect(r0).toBeGreaterThan(r1)
    expect(r1).toBeGreaterThan(b1) // warm amber shadow bias, never cool grey
    expect(g1).toBeGreaterThan(b1)

    const suite = createBambooSieveMaterials()
    const textures = new Set<THREE.Texture>()
    for (const mat of suite.all) {
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      expect(mat.map).toBeInstanceOf(THREE.DataTexture)
      expect(mat.bumpMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.vertexColors).toBe(true)
      expect(mat.clearcoat).toBeGreaterThan(0.08)
      expect(mat.clearcoat).toBeLessThanOrEqual(0.22)
      expect(mat.roughness).toBeGreaterThanOrEqual(0.62)
      expect(mat.roughness).toBeLessThanOrEqual(0.80)
      textures.add(mat.map!)
      textures.add(mat.bumpMap!)
      textures.add(mat.roughnessMap!)
    }

    const disposed = new Map<THREE.Texture, number>()
    textures.forEach((tex) => tex.addEventListener('dispose', () => disposed.set(tex, (disposed.get(tex) ?? 0) + 1)))
    suite.all.forEach((mat) => { mat.dispose(); mat.dispose() })

    expect(disposed.size).toBe(textures.size)
    expect([...disposed.values()].every((count) => count === 1)).toBe(true)
  })
})
