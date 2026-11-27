import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createSakakiLeafGeometry,
  createSakakiLeafMaterials,
  createSakakiLeafTextures,
  type SakakiLeafTone,
} from './sakaki-botanical'

describe('tamagushi-offering stylized sakaki leaf geometry and materials', () => {
  it('builds a midrib-folded leaf inside its [w, l] envelope', () => {
    const w = 0.15, l = 0.23
    const g = createSakakiLeafGeometry(w, l, { twist: 0.004, arch: 0.012, fold: 0.011 })
    const box = g.boundingBox!
    expect(box.min.x).toBeGreaterThanOrEqual(-w - 1e-6)
    expect(box.max.x).toBeLessThanOrEqual(w + 1e-6)
    expect(box.min.z).toBeCloseTo(-l, 6)
    expect(box.max.z).toBeCloseTo(l, 6)
    // Folded arched leaf has genuine 3D contour rather than a flat slab.
    expect(box.max.y - box.min.y).toBeGreaterThan(0.012)
    expect(box.max.y - box.min.y).toBeLessThan(0.035)
    g.dispose()
  })

  it('produces deterministic pinnate leaf textures within Komorebi highlight headroom and disposes once', () => {
    for (const tone of [0, 1, 2] as SakakiLeafTone[]) {
      const a = createSakakiLeafTextures(tone)
      const b = createSakakiLeafTextures(tone)
      const data = a.map.image.data as Uint8Array
      expect(Array.from(data)).toEqual(Array.from(b.map.image.data as Uint8Array))
      let maxR = 0, maxG = 0, maxB = 0
      for (let i = 0; i < data.length; i += 4) {
        if (data[i]! > maxR) maxR = data[i]!
        if (data[i + 1]! > maxG) maxG = data[i + 1]!
        if (data[i + 2]! > maxB) maxB = data[i + 2]!
      }
      expect(maxG).toBeGreaterThan(maxR)
      expect(maxG).toBeLessThanOrEqual(214)
      expect(maxB).toBeLessThanOrEqual(148)
      a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
      b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
    }

    const mats = createSakakiLeafMaterials()
    const disposed = new Map<THREE.Texture, number>()
    const textures = new Set<THREE.Texture>()
    for (const mat of mats) {
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      expect(mat.side).toBe(THREE.FrontSide)
      expect(mat.clearcoat).toBeGreaterThan(0.15)
      for (const t of [mat.map!, mat.bumpMap!, mat.roughnessMap!]) {
        textures.add(t)
        t.addEventListener('dispose', () => disposed.set(t, (disposed.get(t) ?? 0) + 1))
      }
    }
    mats.forEach((m) => { m.dispose(); m.dispose() })
    expect(disposed.size).toBe(textures.size)
    expect([...disposed.values()].every((n) => n === 1)).toBe(true)
  })
})
