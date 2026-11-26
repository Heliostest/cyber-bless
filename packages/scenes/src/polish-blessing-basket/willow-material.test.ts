// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyHandleShading,
  applyRimGrooveShading,
  applyTieRingShading,
  applyWarpRecessShading,
  applyWeftRecessShading,
  createBasketWillowMaterials,
  createWillowCaneTextures,
  createWillowMedallionTextures,
  type WillowTone,
} from './willow-material'

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

describe('polish-blessing-basket stylized willow material', () => {
  it('generates deterministic, warm baked-willow cane textures with ordered tonal variation and Komorebi highlight headroom', () => {
    const tones: WillowTone[] = [0, 1, 2]
    const means: number[] = []

    for (const tone of tones) {
      const a = createWillowCaneTextures(tone, [6, 1])
      const b = createWillowCaneTextures(tone, [6, 1])
      expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(a.bump.colorSpace).toBe(THREE.NoColorSpace)
      expect(a.roughness.colorSpace).toBe(THREE.NoColorSpace)
      expect(a.map.wrapS).toBe(THREE.RepeatWrapping)
      expect(a.map.wrapT).toBe(THREE.RepeatWrapping)
      expect(a.map.generateMipmaps).toBe(true)
      expect(a.map.repeat.x).toBe(6)
      expect(a.map.repeat.y).toBe(1)

      // Deterministic pixel buffers across repeated calls.
      expect(Array.from(a.map.image.data as Uint8Array)).toEqual(Array.from(b.map.image.data as Uint8Array))
      expect(Array.from(a.bump.image.data as Uint8Array)).toEqual(Array.from(b.bump.image.data as Uint8Array))
      expect(Array.from(a.roughness.image.data as Uint8Array)).toEqual(Array.from(b.roughness.image.data as Uint8Array))

      const stats = channelStats(a.map)
      // Warm golden-willow ordering (R > G > B) and restrained highlight cap (< 242) for Komorebi daylight.
      expect(stats.meanR).toBeGreaterThan(stats.meanG + 20)
      expect(stats.meanG).toBeGreaterThan(stats.meanB + 35)
      expect(stats.maxR).toBeLessThanOrEqual(238)
      expect(stats.maxG).toBeLessThanOrEqual(212)
      expect(stats.maxB).toBeLessThanOrEqual(166)
      means.push((stats.meanR + stats.meanG + stats.meanB) / 3)

      a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
      b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
    }

    // Tone 0 (toasted) < Tone 1 (golden buff) < Tone 2 (pale cream-willow).
    expect(means[0]!).toBeLessThan(means[1]! - 12)
    expect(means[1]!).toBeLessThan(means[2]! - 8)
  })

  it('produces longitudinal cane fibers aligned with strand UVs (stronger cross-circumference gradient than along-length jitter)', () => {
    const tex = createWillowCaneTextures(1)
    const size = tex.bump.image.width as number
    const bump = tex.bump.image.data as Uint8Array

    let alongDiff = 0
    let acrossDiff = 0
    for (let y = 0; y < size; y++) {
      const yNext = (y + 1) % size
      for (let x = 0; x < size; x++) {
        const xNext = (x + 1) % size
        const h0 = bump[(y * size + x) * 4]!
        const hx = bump[(y * size + xNext) * 4]!
        const hy = bump[(yNext * size + x) * 4]!
        alongDiff += Math.abs(hx - h0)
        acrossDiff += Math.abs(hy - h0)
      }
    }

    // Fibers run along `u` (x) and ridge across `v` (y), so cross-circumference gradient dominates.
    expect(acrossDiff).toBeGreaterThan(alongDiff * 4)
    expect(acrossDiff / (size * size)).toBeGreaterThan(1.2)
    tex.map.dispose(); tex.bump.dispose(); tex.roughness.dispose()
  })

  it('creates a coiled-willow medallion texture with concentric relief around SphereGeometry front pole (+Z)', () => {
    const tex = createWillowMedallionTextures()
    const size = tex.bump.image.width as number
    const bump = tex.bump.image.data as Uint8Array
    // Sample radially outward from front pole (u = 0.25, v = 0.50) along +v.
    const xPole = Math.round(size * 0.25)
    const samples: number[] = []
    for (let y = Math.round(size * 0.55); y < Math.round(size * 0.92); y += 2) {
      samples.push(bump[(y * size + xPole) * 4]!)
    }
    const minH = Math.min(...samples)
    const maxH = Math.max(...samples)
    expect(maxH - minH).toBeGreaterThan(35)
    tex.map.dispose(); tex.bump.dispose(); tex.roughness.dispose()
  })

  it('applies warm weave-recess shading without altering geometry topology, positions or normals', () => {
    const rx = 0.70, rz = 0.44
    const points = Array.from({ length: 80 }, (_, i) => {
      const a = (i / 80) * Math.PI * 2
      const over = Math.cos(a * 32) * 0.007
      return new THREE.Vector3(Math.cos(a) * (rx + over), 0.22, Math.sin(a) * (rz + over))
    })
    const geo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 160, 0.017, 6, true)
    const snapPos = Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array)
    const snapNorm = Array.from((geo.getAttribute('normal') as THREE.BufferAttribute).array)
    const snapUv = Array.from((geo.getAttribute('uv') as THREE.BufferAttribute).array)
    const snapIdx = Array.from(geo.index!.array)

    applyWeftRecessShading(geo, 6, 12, rx, rz)

    expect(Array.from((geo.getAttribute('position') as THREE.BufferAttribute).array)).toEqual(snapPos)
    expect(Array.from((geo.getAttribute('normal') as THREE.BufferAttribute).array)).toEqual(snapNorm)
    expect(Array.from((geo.getAttribute('uv') as THREE.BufferAttribute).array)).toEqual(snapUv)
    expect(Array.from(geo.index!.array)).toEqual(snapIdx)

    const colAttr = geo.getAttribute('color') as THREE.BufferAttribute
    expect(colAttr).toBeDefined()
    expect(colAttr.count).toBe(geo.getAttribute('position').count)

    const pos = geo.getAttribute('position') as THREE.BufferAttribute
    let crestSum = 0, crestN = 0, recessSum = 0, recessN = 0
    for (let i = 0; i < pos.count; i++) {
      const r = colAttr.getX(i), g = colAttr.getY(i), b = colAttr.getZ(i)
      expect(Number.isFinite(r + g + b)).toBe(true)
      expect(r).toBeGreaterThanOrEqual(b) // warm amber shadow bias, never cool grey
      const a = Math.atan2(pos.getZ(i) / rz, pos.getX(i) / rx)
      const over = Math.cos(a * 32)
      const luma = (r + g + b) / 3
      if (over > 0.85) { crestSum += luma; crestN++ }
      if (over < -0.85) { recessSum += luma; recessN++ }
    }
    expect(crestSum / crestN).toBeGreaterThan(recessSum / recessN + 0.08)
    geo.dispose()

    // Smoke-check warp, rim, handle and tie helpers produce finite vertex colors.
    const warpGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.6, 0.025, 0), new THREE.Vector3(0.76, 0.425, 0)]), 20, 0.016, 6)
    applyWarpRecessShading(warpGeo, 3)
    expect(Array.from((warpGeo.getAttribute('color') as THREE.BufferAttribute).array).every(Number.isFinite)).toBe(true)
    warpGeo.dispose()

    const rimGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points, true), 40, 0.027, 6, true)
    applyRimGrooveShading(rimGeo, true)
    expect(Array.from((rimGeo.getAttribute('color') as THREE.BufferAttribute).array).every(Number.isFinite)).toBe(true)
    rimGeo.dispose()

    const handleGeo = new THREE.TubeGeometry(new THREE.CatmullRomCurve3([new THREE.Vector3(0.74, 0.30, -0.15), new THREE.Vector3(0, 1.48, -0.15), new THREE.Vector3(-0.74, 0.30, -0.15)]), 24, 0.028, 6)
    applyHandleShading(handleGeo, true)
    expect(Array.from((handleGeo.getAttribute('color') as THREE.BufferAttribute).array).every(Number.isFinite)).toBe(true)
    handleGeo.dispose()

    const tieGeo = new THREE.TorusGeometry(0.05, 0.008, 6, 16)
    applyTieRingShading(tieGeo, 2)
    expect(Array.from((tieGeo.getAttribute('color') as THREE.BufferAttribute).array).every(Number.isFinite)).toBe(true)
    tieGeo.dispose()
  })

  it('builds consistent waxed-satin willow materials and disposes every owned texture exactly once', () => {
    const suite = createBasketWillowMaterials()
    const materials = [
      ...suite.weft,
      ...suite.warp,
      suite.bottom,
      ...suite.rim,
      ...suite.handle,
      suite.tie,
      suite.medallion,
    ]
    const textures = new Set<THREE.Texture>()
    for (const mat of materials) {
      expect(mat).toBeInstanceOf(THREE.MeshPhysicalMaterial)
      expect(mat.map).toBeInstanceOf(THREE.DataTexture)
      expect(mat.bumpMap).toBeInstanceOf(THREE.DataTexture)
      expect(mat.roughnessMap).toBeInstanceOf(THREE.DataTexture)
      // Soft natural waxy sheen without oily highlight blowout.
      expect(mat.clearcoat).toBeGreaterThan(0.05)
      expect(mat.clearcoat).toBeLessThanOrEqual(0.24)
      expect(mat.clearcoatRoughness).toBeGreaterThanOrEqual(0.36)
      expect(mat.roughness).toBeGreaterThanOrEqual(0.60)
      expect(mat.roughness).toBeLessThanOrEqual(0.80)
      textures.add(mat.map!)
      textures.add(mat.bumpMap!)
      textures.add(mat.roughnessMap!)
    }
    expect(suite.medallion.vertexColors).toBe(false)
    expect(suite.bottom.vertexColors).toBe(false)
    expect(suite.weft[0].vertexColors).toBe(true)

    const disposed = new Map<THREE.Texture, number>()
    textures.forEach((tex) => tex.addEventListener('dispose', () => disposed.set(tex, (disposed.get(tex) ?? 0) + 1)))
    materials.forEach((mat) => { mat.dispose(); mat.dispose() })

    expect(disposed.size).toBe(textures.size)
    expect([...disposed.values()].every((count) => count === 1)).toBe(true)
  })
})
