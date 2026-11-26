// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createBojagiMatBaseTextures,
  createBojagiMatMaterials,
  createBojagiStrandTextures,
} from './mat-material'

describe('korean-bojagi-wrap woven reed mat material', () => {
  it('generates deterministic quiet sedge-mat textures without high-frequency fabric aliasing', () => {
    const a = createBojagiMatBaseTextures()
    const b = createBojagiMatBaseTextures()
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
    // Warm toasted-honey reed mat quieter than the patchwork bojagi cloth.
    expect(sumR / pixels).toBeGreaterThan(sumG / pixels + 25)
    expect(sumG / pixels).toBeGreaterThan(sumB / pixels + 40)
    expect(maxR).toBeLessThanOrEqual(214)

    // Continuous horizontal sedge stalks stack across v, so across-v bump gradient exceeds along-u.
    const size = a.bump.image.width as number
    const bump = a.bump.image.data as Uint8Array
    let duSum = 0, dvSum = 0
    for (let y = Math.round(size * 0.15); y < Math.round(size * 0.85); y++) {
      for (let x = Math.round(size * 0.15); x < Math.round(size * 0.85); x++) {
        const h0 = bump[(y * size + x) * 4]!
        duSum += Math.abs(bump[(y * size + x + 1) * 4]! - h0)
        dvSum += Math.abs(bump[((y + 1) * size + x) * 4]! - h0)
      }
    }
    expect(dvSum).toBeGreaterThan(duSum * 1.4)

    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()

    const weft = createBojagiStrandTextures('weft')
    const warp = createBojagiStrandTextures('warp')
    expect(weft.map.repeat.x).toBe(2)
    expect(warp.map.repeat.y).toBe(2)
    weft.map.dispose(); weft.bump.dispose(); weft.roughness.dispose()
    warp.map.dispose(); warp.bump.dispose(); warp.roughness.dispose()
  })

  it('omits the mistaken fabric craft surface on mat materials and disposes owned textures once', () => {
    const suite = createBojagiMatMaterials()
    const mats = [suite.base, suite.weft, suite.warp]
    const textures = new Set<THREE.Texture>()
    for (const mat of mats) {
      expect(mat.userData.craftSurface).toBeUndefined()
      expect(mat.roughness).toBeGreaterThanOrEqual(0.90)
      textures.add(mat.map!); textures.add(mat.bumpMap!); textures.add(mat.roughnessMap!)
    }
    const counts = new Map<THREE.Texture, number>()
    textures.forEach(t => t.addEventListener('dispose', () => counts.set(t, (counts.get(t) ?? 0) + 1)))
    suite.dispose(); suite.dispose()
    expect(counts.size).toBe(textures.size)
    expect([...counts.values()].every(n => n === 1)).toBe(true)
    mats.forEach(m => m.dispose())
  })
})
