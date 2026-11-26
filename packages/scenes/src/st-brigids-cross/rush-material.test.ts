// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyArmRushShading,
  applyCenterInterlockShading,
  applyLooseRushShading,
  createBrigidRushMaterials,
  createRushStalkTextures,
  type RushTone,
} from './rush-material'

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
  return { meanR: sumR / pixels, meanG: sumG / pixels, meanB: sumB / pixels, maxR, maxG, maxB }
}

describe('st-brigids-cross stylized rush material', () => {
  it('generates deterministic green rush textures with Komorebi daylight headroom and distinct tones', () => {
    const tones: RushTone[] = [0, 1, 2]
    const means: number[] = []
    for (const tone of tones) {
      const a = createRushStalkTextures(tone, [2.4, 1])
      const b = createRushStalkTextures(tone, [2.4, 1])
      expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(a.bump.colorSpace).toBe(THREE.NoColorSpace)
      expect(a.roughness.colorSpace).toBe(THREE.NoColorSpace)
      expect(a.map.generateMipmaps).toBe(true)
      expect(Array.from(a.map.image.data as Uint8Array)).toEqual(Array.from(b.map.image.data as Uint8Array))
      expect(Array.from(a.bump.image.data as Uint8Array)).toEqual(Array.from(b.bump.image.data as Uint8Array))

      const stats = channelStats(a.map)
      // Fresh green rushes (G >= R > B), never yellow hay or clipped neon.
      expect(stats.meanG).toBeGreaterThan(stats.meanR + 4)
      expect(stats.meanR).toBeGreaterThan(stats.meanB + 35)
      expect(stats.maxR).toBeLessThanOrEqual(214)
      expect(stats.maxG).toBeLessThanOrEqual(218)
      expect(stats.maxB).toBeLessThanOrEqual(158)
      means.push((stats.meanR + stats.meanG + stats.meanB) / 3)
      a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
      b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
    }
    expect(means[0]!).toBeLessThan(means[2]!)
    expect(means[2]!).toBeLessThan(means[1]!)
  })

  it('aligns longitudinal stem fibers along TubeGeometry U so cross-circumference relief dominates', () => {
    const tex = createRushStalkTextures(2)
    const size = tex.bump.image.width as number
    const bump = tex.bump.image.data as Uint8Array
    let along = 0, across = 0
    for (let y = 0; y < size; y++) {
      const yNext = (y + 1) % size
      for (let x = 0; x < size; x++) {
        const xNext = (x + 1) % size
        const h0 = bump[(y * size + x) * 4]!
        along += Math.abs(bump[(y * size + xNext) * 4]! - h0)
        across += Math.abs(bump[(yNext * size + x) * 4]! - h0)
      }
    }
    expect(across).toBeGreaterThan(along * 3.5)
    tex.map.dispose(); tex.bump.dispose(); tex.roughness.dispose()
  })

  it('adds strictly additive vertex shading without modifying geometry positions, normals or indices', () => {
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.13, 0, .01), new THREE.Vector3(.48, 0, .015), new THREE.Vector3(.86, 0, .01)])
    const geo = new THREE.TubeGeometry(curve, 15, .014, 6, false)
    const snapPos = Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array)
    const snapIdx = Array.from(geo.index!.array)
    applyArmRushShading(geo, 1)
    expect(Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array)).toEqual(snapPos)
    expect(Array.from(geo.index!.array)).toEqual(snapIdx)
    const col = geo.getAttribute('color') as THREE.BufferAttribute
    expect(col).toBeDefined()
    expect(Array.from(col.array).every(Number.isFinite)).toBe(true)

    applyCenterInterlockShading(geo, 2)
    expect(Array.from((geo.getAttribute('color') as THREE.BufferAttribute).array).every(Number.isFinite)).toBe(true)
    applyLooseRushShading(geo, 3)
    expect(Array.from((geo.getAttribute('color') as THREE.BufferAttribute).array).every(Number.isFinite)).toBe(true)
    geo.dispose()
  })

  it('disposes every owned rush texture exactly once', () => {
    const suite = createBrigidRushMaterials()
    const textures = new Set<THREE.Texture>()
    for (const mat of suite.rushes) {
      expect(mat.map).toBeInstanceOf(THREE.DataTexture)
      expect(mat.bumpMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.roughness).toBeGreaterThanOrEqual(0.86)
      textures.add(mat.map!); textures.add(mat.bumpMap!); textures.add(mat.roughnessMap!)
    }
    const counts = new Map<THREE.Texture, number>()
    textures.forEach(t => t.addEventListener('dispose', () => counts.set(t, (counts.get(t) ?? 0) + 1)))
    suite.dispose(); suite.dispose()
    expect(counts.size).toBe(textures.size)
    expect([...counts.values()].every(n => n === 1)).toBe(true)
    suite.rushes.forEach(m => m.dispose())
  })
})
