// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createChinowaKayaMaterial, createKayaTextures } from './kaya-material'

describe('chinowa-kuguri bundled kaya-grass material', () => {
  it('generates deterministic 1024x256 kaya bundle textures with circumferential fiber relief and 6 centered cord bindings', () => {
    const a = createKayaTextures()
    const b = createKayaTextures()
    expect(a.map.image.width).toBe(1024)
    expect(a.map.image.height).toBe(256)
    expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(a.bump.colorSpace).toBe(THREE.NoColorSpace)
    expect(a.roughness.colorSpace).toBe(THREE.NoColorSpace)
    expect(a.map.generateMipmaps).toBe(true)
    expect(Array.from(a.map.image.data as Uint8Array)).toEqual(Array.from(b.map.image.data as Uint8Array))

    const color = a.map.image.data as Uint8Array
    const bump = a.bump.image.data as Uint8Array
    const width = 1024, height = 256
    let maxR = 0, maxG = 0, maxB = 0
    for (let i = 0; i < color.length; i += 4) {
      if (color[i]! > maxR) maxR = color[i]!
      if (color[i + 1]! > maxG) maxG = color[i + 1]!
      if (color[i + 2]! > maxB) maxB = color[i + 2]!
    }
    expect(maxR).toBeLessThanOrEqual(212)
    expect(maxG).toBeLessThanOrEqual(214)
    expect(maxB).toBeLessThanOrEqual(148)

    // In the open grass body (away from bindings), circumferential grass stems run along U
    // so cross-tube V bump gradient dominates along-ring U gradient.
    let du = 0, dv = 0
    for (let y = 0; y < height; y++) {
      const yNext = (y + 1) % height
      for (let x = 40; x < 130; x++) {
        const h0 = bump[(y * width + x) * 4]!
        du += Math.abs(bump[(y * width + x + 1) * 4]! - h0)
        dv += Math.abs(bump[(yNext * width + x) * 4]! - h0)
      }
    }
    expect(dv).toBeGreaterThan(du * 2.5)

    // Verify all 6 binding centers (u = k/6) have warm brown hemp cord tone (R > G)
    // while mid-segments (u = (k+0.5)/6) have green kaya grass tone (G > R), and
    // cinch flanks immediately outside each binding dip darker than the open grass.
    for (let k = 0; k < 6; k++) {
      const xBind = Math.round((k / 6) * width) % width
      const xCinch = Math.round(((k / 6) + 0.0045) * width) % width
      const xGrass = Math.round(((k + 0.5) / 6) * width) % width
      let bindR = 0, bindG = 0, grassR = 0, grassG = 0, cinchLuma = 0, grassLuma = 0
      for (let y = 0; y < height; y++) {
        const ib = (y * width + xBind) * 4
        const ic = (y * width + xCinch) * 4
        const ig = (y * width + xGrass) * 4
        bindR += color[ib]!; bindG += color[ib + 1]!
        grassR += color[ig]!; grassG += color[ig + 1]!
        cinchLuma += color[ic]! + color[ic + 1]! + color[ic + 2]!
        grassLuma += color[ig]! + color[ig + 1]! + color[ig + 2]!
      }
      expect(bindR).toBeGreaterThan(bindG)
      expect(grassG).toBeGreaterThan(grassR)
      expect(cinchLuma).toBeLessThan(grassLuma * 0.90)
    }

    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
  })

  it('builds a matte bumped material and disposes all three textures once', () => {
    const suite = createChinowaKayaMaterial()
    expect(suite.material.map).toBe(suite.textures.map)
    expect(suite.material.bumpMap).toBe(suite.textures.bump)
    expect(suite.material.roughnessMap).toBe(suite.textures.roughness)
    expect(suite.material.bumpScale).toBeGreaterThan(0.008)
    expect(suite.material.roughness).toBeGreaterThanOrEqual(0.92)

    const counts = new Map<THREE.Texture, number>()
    for (const tex of [suite.textures.map, suite.textures.bump, suite.textures.roughness]) {
      tex.addEventListener('dispose', () => counts.set(tex, (counts.get(tex) ?? 0) + 1))
    }
    suite.dispose(); suite.dispose()
    expect(counts.size).toBe(3)
    expect([...counts.values()].every(n => n === 1)).toBe(true)
    suite.material.dispose()
  })
})
