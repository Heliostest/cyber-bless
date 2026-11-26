import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createFijianFanMaterials,
  createPandanusTextures,
  writePandanusStripVertexColor,
} from './fan-materials'

describe('fijian-woven-fan stylized pandanus leaf & wood stand materials', () => {
  it('separates warp vs. weft pandanus strip values deterministically and stays below daylight clip peaks', () => {
    const warp = createPandanusTextures('warp')
    const weft = createPandanusTextures('weft')
    const meanLuma = (tex: THREE.DataTexture) => {
      const d = tex.image.data as Uint8Array
      let sum = 0
      for (let i = 0; i < d.length; i += 4) sum += 0.299 * d[i]! + 0.587 * d[i + 1]! + 0.114 * d[i + 2]!
      return sum / (d.length / 4)
    }
    expect(meanLuma(warp.map)).toBeGreaterThan(meanLuma(weft.map) + 12)
    const warpRgb = warp.map.image.data as Uint8Array
    let maxR = 0
    for (let i = 0; i < warpRgb.length; i += 4) maxR = Math.max(maxR, warpRgb[i]!)
    expect(maxR).toBeLessThanOrEqual(240)
    warp.map.dispose(); warp.bump.dispose(); warp.roughness.dispose()
    weft.map.dispose(); weft.bump.dispose(); weft.roughness.dispose()
  })

  it('applies aligned wood grain to the split handle and walnut stand and disposes all pandanus textures once', () => {
    const mats = createFijianFanMaterials()
    expect(mats.handleWood.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' })
    expect(mats.walnutHorizontal.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'x' })
    expect(mats.walnutVertical.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'y' })
    expect(mats.warpStrip.vertexColors).toBe(true)
    expect(mats.weftStrip.vertexColors).toBe(true)
    expect(mats.reedStrip.vertexColors).toBe(true)

    const disposed = new Map<THREE.Texture, number>()
    const allMats = Object.values(mats)
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

  it('adds warm crossing depth to woven pandanus strips', () => {
    const raised: number[] = [], tucked: number[] = []
    writePandanusStripVertexColor(raised, 1, false, 0)
    writePandanusStripVertexColor(tucked, -1, false, 0)
    expect(raised[0]!).toBeGreaterThan(tucked[0]!)
    expect(tucked[0]! - tucked[2]!).toBeGreaterThan(raised[0]! - raised[2]!)
  })
})
