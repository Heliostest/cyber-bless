// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createBaciMatMaterials,
  createBaciMatRimTextures,
  createBaciMatTopTextures,
  createBaciWeftTextures,
} from './mat-material'

describe('lao-baci-wrist woven reed mat material', () => {
  it('generates deterministic quiet warm-reed textures aligned with CylinderGeometry top UVs', () => {
    const a = createBaciMatTopTextures()
    const b = createBaciMatTopTextures()
    expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(a.bump.colorSpace).toBe(THREE.NoColorSpace)
    expect(a.roughness.colorSpace).toBe(THREE.NoColorSpace)
    expect(a.map.generateMipmaps).toBe(true)
    expect(Array.from(a.map.image.data as Uint8Array)).toEqual(Array.from(b.map.image.data as Uint8Array))

    const data = a.map.image.data as Uint8Array
    let sumR = 0, sumG = 0, sumB = 0, maxR = 0
    const pixels = data.length / 4
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]!, g = data[i + 1]!, bCh = data[i + 2]!
      sumR += r; sumG += g; sumB += bCh
      if (r > maxR) maxR = r
    }
    // Warm oat-reed tone (R > G > B) staying quiet beneath the luminous white cotton thread.
    expect(sumR / pixels).toBeGreaterThan(sumG / pixels + 15)
    expect(sumG / pixels).toBeGreaterThan(sumB / pixels + 35)
    expect(maxR).toBeLessThanOrEqual(226)

    // On CylinderGeometry top cap, `u` runs along Z and `v` along X, so horizontal reeds
    // running along X (v) stack across `u`, giving stronger gradient across u than along v.
    const size = a.bump.image.width as number
    const bump = a.bump.image.data as Uint8Array
    let duSum = 0, dvSum = 0
    for (let y = Math.round(size * 0.28); y < Math.round(size * 0.72); y++) {
      for (let x = Math.round(size * 0.28); x < Math.round(size * 0.72); x++) {
        const h0 = bump[(y * size + x) * 4]!
        duSum += Math.abs(bump[(y * size + x + 1) * 4]! - h0)
        dvSum += Math.abs(bump[((y + 1) * size + x) * 4]! - h0)
      }
    }
    expect(duSum).toBeGreaterThan(dvSum * 1.4)

    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()

    const rim = createBaciMatRimTextures()
    const weft = createBaciWeftTextures('warm')
    expect(rim.map.image.width).toBe(256)
    expect(weft.map.image.width).toBe(128)
    rim.map.dispose(); rim.bump.dispose(); rim.roughness.dispose()
    weft.map.dispose(); weft.bump.dispose(); weft.roughness.dispose()
  })

  it('provides 3 cylinder material slots and disposes all owned textures once', () => {
    const suite = createBaciMatMaterials()
    expect(suite.matMaterials).toHaveLength(3)
    const uniqueMats = new Set<THREE.MeshStandardMaterial>([...suite.matMaterials, suite.weftWarm, suite.weftPale])
    const textures = new Set<THREE.Texture>()
    for (const mat of uniqueMats) {
      expect(mat.roughness).toBeGreaterThanOrEqual(0.88)
      textures.add(mat.map!); textures.add(mat.bumpMap!); textures.add(mat.roughnessMap!)
    }
    const counts = new Map<THREE.Texture, number>()
    textures.forEach(t => t.addEventListener('dispose', () => counts.set(t, (counts.get(t) ?? 0) + 1)))
    suite.dispose(); suite.dispose()
    expect(counts.size).toBe(textures.size)
    expect([...counts.values()].every(n => n === 1)).toBe(true)
    uniqueMats.forEach(m => m.dispose())
  })
})
