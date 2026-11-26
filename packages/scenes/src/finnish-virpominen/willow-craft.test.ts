// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyBasketBaseGroupsAndShading,
  applyBasketRingShading,
  applyBasketUprightShading,
  applyWillowTwigShading,
  createVirpominenBasketFloorTextures,
  createVirpominenBasketFootTextures,
  createVirpominenWillowCaneTextures,
  createVirpominenWillowMaterials,
  createWillowBarkTextures,
  type VirpominenWillowTone,
} from './willow-craft'

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

function bumpGradients(tex: THREE.DataTexture) {
  const w = tex.image.width as number
  const data = tex.image.data as Uint8Array
  let dx = 0, dy = 0
  for (let y = 0; y < w; y++) {
    const yn = (y + 1) % w
    for (let x = 0; x < w; x++) {
      const xn = (x + 1) % w
      const h0 = data[(y * w + x) * 4]!
      dx += Math.abs(data[(y * w + xn) * 4]! - h0)
      dy += Math.abs(data[(yn * w + x) * 4]! - h0)
    }
  }
  return { dx, dy }
}

describe('finnish-virpominen stylized willow basket and twig craft materials', () => {
  it('generates deterministic warm steamed-willow cane tones ordered light-to-toasted with Komorebi highlight headroom', () => {
    const tones: VirpominenWillowTone[] = [0, 1, 2]
    const means: number[] = []

    for (const tone of tones) {
      const a = createVirpominenWillowCaneTextures(tone, 'u', [5, 1])
      const b = createVirpominenWillowCaneTextures(tone, 'u', [5, 1])
      expect(Array.from(a.map.image.data as Uint8Array)).toEqual(Array.from(b.map.image.data as Uint8Array))
      expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(a.bump.colorSpace).toBe(THREE.NoColorSpace)
      expect(a.roughness.colorSpace).toBe(THREE.NoColorSpace)

      const stats = channelStats(a.map)
      expect(stats.meanR).toBeGreaterThan(stats.meanG + 18)
      expect(stats.meanG).toBeGreaterThan(stats.meanB + 32)
      expect(stats.maxR).toBeLessThanOrEqual(236)
      expect(stats.maxG).toBeLessThanOrEqual(208)
      expect(stats.maxB).toBeLessThanOrEqual(154)
      means.push((stats.meanR + stats.meanG + stats.meanB) / 3)

      a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
      b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
    }

    expect(means[0]!).toBeLessThan(means[1]! - 12)
    expect(means[1]!).toBeLessThan(means[2]! - 8)
  })

  it('aligns longitudinal fibers strictly along the requested UV axis for rings (u), uprights (v), and willow bark', () => {
    const ringTex = createVirpominenWillowCaneTextures(1, 'u')
    const uprightTex = createVirpominenWillowCaneTextures(1, 'v')
    const stemBark = createWillowBarkTextures('v')
    const forkBark = createWillowBarkTextures('u')

    const ringGrad = bumpGradients(ringTex.bump)
    const uprightGrad = bumpGradients(uprightTex.bump)
    const stemGrad = bumpGradients(stemBark.bump)
    const forkGrad = bumpGradients(forkBark.bump)

    // Along 'u': cross-circumference gradient (dy) dominates along-length gradient (dx).
    expect(ringGrad.dy).toBeGreaterThan(ringGrad.dx * 3.5)
    expect(forkGrad.dy).toBeGreaterThan(forkGrad.dx * 2.5)
    // Along 'v': cross-circumference gradient (dx) dominates along-length gradient (dy).
    expect(uprightGrad.dx).toBeGreaterThan(uprightGrad.dy * 3.5)
    expect(stemGrad.dx).toBeGreaterThan(stemGrad.dy * 2.5)

    // Bark should be noticeably darker/warmer chestnut than willow basket cane so white buds pop.
    const barkStats = channelStats(stemBark.map)
    const caneStats = channelStats(ringTex.map)
    expect(barkStats.meanR).toBeGreaterThan(barkStats.meanG + 18)
    expect(barkStats.meanG).toBeGreaterThan(barkStats.meanB + 18)
    expect(barkStats.meanR).toBeLessThan(caneStats.meanR - 55)

    for (const set of [ringTex, uprightTex, stemBark, forkBark]) {
      set.map.dispose(); set.bump.dispose(); set.roughness.dispose()
    }
  })

  it('creates concentric coiled floor relief and plaited foot-band relief', () => {
    const floor = createVirpominenBasketFloorTextures()
    const foot = createVirpominenBasketFootTextures()
    const size = floor.bump.image.width as number
    const floorBump = floor.bump.image.data as Uint8Array

    // Radial slice from center (0.5, 0.5) outward should show clear coil crests and creases.
    const samples: number[] = []
    for (let x = Math.round(size * 0.55); x < Math.round(size * 0.94); x += 2) {
      samples.push(floorBump[(Math.round(size * 0.5) * size + x) * 4]!)
    }
    expect(Math.max(...samples) - Math.min(...samples)).toBeGreaterThan(45)

    const footStats = channelStats(foot.map)
    expect(footStats.meanR).toBeGreaterThan(footStats.meanG + 18)
    expect(footStats.maxR).toBeLessThanOrEqual(226)

    floor.map.dispose(); floor.bump.dispose(); floor.roughness.dispose()
    foot.map.dispose(); foot.bump.dispose(); foot.roughness.dispose()
  })

  it('applies additive weave-recess shading and base groups without modifying vertex positions', () => {
    const ringGeo = new THREE.TorusGeometry(0.41, 0.014, 8, 48).toNonIndexed()
    const snapPos = Array.from(ringGeo.getAttribute('position').array)
    applyBasketRingShading(ringGeo, 1)
    expect(Array.from(ringGeo.getAttribute('position').array)).toEqual(snapPos)
    const ringCol = ringGeo.getAttribute('color') as THREE.BufferAttribute
    expect(ringCol.count).toBe(ringGeo.getAttribute('position').count)
    for (let i = 0; i < ringCol.count; i++) {
      expect(ringCol.getX(i)).toBeGreaterThanOrEqual(ringCol.getZ(i))
    }
    ringGeo.dispose()

    const uprightGeo = new THREE.CylinderGeometry(0.012, 0.013, 0.20, 8).toNonIndexed()
    applyBasketUprightShading(uprightGeo, 3)
    expect((uprightGeo.getAttribute('color') as THREE.BufferAttribute).count).toBe(uprightGeo.getAttribute('position').count)
    uprightGeo.dispose()

    const baseGeo = new THREE.CylinderGeometry(1, 1, 0.08, 40).toNonIndexed()
    baseGeo.computeVertexNormals()
    const basePos = Array.from(baseGeo.getAttribute('position').array)
    applyBasketBaseGroupsAndShading(baseGeo)
    expect(Array.from(baseGeo.getAttribute('position').array)).toEqual(basePos)
    expect(baseGeo.groups.length).toBeGreaterThanOrEqual(2)
    expect(new Set(baseGeo.groups.map((g) => g.materialIndex))).toEqual(new Set([0, 1]))
    baseGeo.dispose()

    const stemGeo = new THREE.CylinderGeometry(0.012, 0.018, 1.10, 12).toNonIndexed()
    applyWillowTwigShading(stemGeo, 'stem')
    expect((stemGeo.getAttribute('color') as THREE.BufferAttribute).count).toBe(stemGeo.getAttribute('position').count)
    stemGeo.dispose()
  })

  it('builds the full material suite and disposes every owned texture exactly once', () => {
    const suite = createVirpominenWillowMaterials()
    const materials = [
      ...suite.uprights,
      ...suite.rings,
      suite.baseSide,
      suite.baseFloor,
      suite.barkStem,
      suite.barkFork,
    ]
    const textures = new Set<THREE.Texture>()
    for (const mat of materials) {
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      expect(mat.map).toBeInstanceOf(THREE.DataTexture)
      expect(mat.bumpMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.vertexColors).toBe(true)
      expect(mat.clearcoat).toBeGreaterThan(0.08)
      expect(mat.clearcoat).toBeLessThanOrEqual(0.22)
      textures.add(mat.map!)
      textures.add(mat.bumpMap!)
      textures.add(mat.roughnessMap!)
    }

    const disposed = new Map<THREE.Texture, number>()
    textures.forEach((tex) => tex.addEventListener('dispose', () => disposed.set(tex, (disposed.get(tex) ?? 0) + 1)))
    materials.forEach((mat) => { mat.dispose(); mat.dispose() })

    expect(disposed.size).toBe(textures.size)
    expect([...disposed.values()].every((count) => count === 1)).toBe(true)
  })
})
