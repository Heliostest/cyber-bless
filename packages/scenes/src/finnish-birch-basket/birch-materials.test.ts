import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyBirchHandleArchUvs,
  createBirchBarkTextures,
  createBirchBasketMaterials,
  writeBirchStripVertexColor,
} from './birch-materials'

describe('finnish-birch-basket stylized birch-bark & carved birch wood materials', () => {
  it('generates deterministic honey-warm birch-bark textures with lenticel contrast and safe daylight peaks', () => {
    const a = createBirchBarkTextures(0)
    const b = createBirchBarkTextures(0)
    expect(a.map.image.width).toBe(256)
    expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(Buffer.from(a.map.image.data)).toEqual(Buffer.from(b.map.image.data))

    const rgb = a.map.image.data as Uint8Array
    let minLuma = 255, maxLuma = 0, maxR = 0, warmPixels = 0
    for (let i = 0; i < rgb.length; i += 4) {
      const r = rgb[i]!, g = rgb[i + 1]!, bl = rgb[i + 2]!
      const luma = 0.299 * r + 0.587 * g + 0.114 * bl
      minLuma = Math.min(minLuma, luma)
      maxLuma = Math.max(maxLuma, luma)
      maxR = Math.max(maxR, r)
      if (r > g && g > bl) warmPixels++
    }
    expect(maxLuma - minLuma).toBeGreaterThan(55)
    expect(maxR).toBeLessThanOrEqual(238)
    expect(warmPixels).toBe(256 * 256)
    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
  })

  it('gives the wooden grain scoop light birch wood grain along X and disposes all bark textures once', () => {
    const mats = createBirchBasketMaterials()
    expect(mats.scoopWood.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'x' })
    expect(mats.barkStrip).toHaveLength(4)
    expect(mats.barkStrip.every(m => m.vertexColors && m.side === THREE.DoubleSide)).toBe(true)

    const disposed = new Map<THREE.Texture, number>()
    const allMats = [...mats.barkStrip, ...mats.barkSolid, mats.rimBark, mats.footBark, mats.scoopWood]
    for (const mat of allMats) {
      for (const tex of [mat.map, mat.bumpMap, mat.roughnessMap]) {
        if (!tex) continue
        disposed.set(tex, 0)
        tex.addEventListener('dispose', () => disposed.set(tex, (disposed.get(tex) ?? 0) + 1))
      }
    }
    allMats.forEach(m => m.dispose())
    expect(disposed.size).toBe(27)
    expect([...disposed.values()].every(n => n === 1)).toBe(true)
  })

  it('shades tucked weave crossings warmly and remaps handle arch UVs without altering vertex positions', () => {
    const crown: number[] = [], tucked: number[] = []
    writeBirchStripVertexColor(crown, 1, 0.5, false, 0)
    writeBirchStripVertexColor(tucked, -1, 0.5, false, 0)
    expect(crown[0]!).toBeGreaterThan(tucked[0]!)
    // Warm amber shadow drops blue proportionally faster than red.
    expect(tucked[0]! - tucked[2]!).toBeGreaterThan(crown[0]! - crown[2]!)

    const geom = new THREE.BoxGeometry(0.4, 0.1, 0.03)
    const before = Array.from((geom.getAttribute('position') as THREE.BufferAttribute).array)
    applyBirchHandleArchUvs(geom, 0.549)
    expect(Array.from((geom.getAttribute('position') as THREE.BufferAttribute).array)).toEqual(before)
    const uv = geom.getAttribute('uv') as THREE.BufferAttribute
    expect(uv.count).toBe(geom.getAttribute('position').count)
    geom.dispose()
  })
})
