import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createAngklungMaterials, createRattanTextures, writeResonatorVertexColor } from './angklung-materials'

describe('indonesian-angklung stylized bamboo & rattan materials', () => {
  it('assigns bamboo craft surfaces with axes aligned to rods, horizontal grip, nodes, and resonator tubes', () => {
    const mats = createAngklungMaterials()
    expect(mats.bamboo.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'y' })
    expect(mats.fresh.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'y' })
    expect(mats.gripBamboo.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'x' })
    expect(mats.node.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'x' })
    expect(mats.tubeNode.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'x' })
    expect(mats.socketBamboo.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'x' })
    expect(mats.footBamboo.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'y' })
    expect(mats.inside.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'x' })
    expect(mats.shellMaterial.userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'y' })
    // Preserve source roughness > 0.7 contract while clearcoat provides waxy bamboo sheen.
    expect(mats.shellMaterial.roughness).toBeGreaterThan(0.7)
    expect(mats.shellMaterial.clearcoat).toBeGreaterThan(0.15)
    expect(mats.shellMaterial.vertexColors).toBe(true)
    expect(mats.shellMaterial.side).toBe(THREE.DoubleSide)
    Object.values(mats).forEach(m => m.dispose())
  })

  it('builds deterministic warm rattan cane textures with relief and disposes maps once per material', () => {
    const a = createRattanTextures([5, 1])
    const b = createRattanTextures([5, 1])
    expect(a.map.image.width).toBe(256)
    expect(a.map.colorSpace).toBe(THREE.SRGBColorSpace)
    expect(a.bump.colorSpace).toBe(THREE.NoColorSpace)
    expect(a.roughness.colorSpace).toBe(THREE.NoColorSpace)
    expect(Buffer.from(a.map.image.data)).toEqual(Buffer.from(b.map.image.data))
    const data = a.map.image.data as Uint8Array
    let minR = 255, maxR = 0
    for (let i = 0; i < data.length; i += 4) {
      minR = Math.min(minR, data[i]!)
      maxR = Math.max(maxR, data[i]!)
    }
    expect(maxR - minR).toBeGreaterThan(45)
    expect(maxR).toBeLessThanOrEqual(224)
    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()

    const mats = createAngklungMaterials()
    const disposed: string[] = []
    for (const [label, mat] of [['rattan', mats.rattan], ['rattanRing', mats.rattanRing]] as const) {
      mat.map!.addEventListener('dispose', () => disposed.push(`${label}-map`))
      mat.bumpMap!.addEventListener('dispose', () => disposed.push(`${label}-bump`))
      mat.roughnessMap!.addEventListener('dispose', () => disposed.push(`${label}-rough`))
    }
    Object.values(mats).forEach(m => m.dispose())
    expect(disposed).toEqual(['rattan-map', 'rattan-bump', 'rattan-rough', 'rattanRing-map', 'rattanRing-bump', 'rattanRing-rough'])
  })

  it('distinguishes outer bamboo skin, inner cavity pith, and bright cut edges on resonators', () => {
    const outer: number[] = [], inner: number[] = [], cut: number[] = []
    writeResonatorVertexColor(outer, 0.19, 1.0, 0, 2.3, 'outer')
    writeResonatorVertexColor(inner, 0.15, 0.4, 0, 2.3, 'inner')
    writeResonatorVertexColor(cut, 0.17, 1.6, 0, 2.3, 'cutEdge')
    const luma = (rgb: number[]) => rgb[0]! * 0.299 + rgb[1]! * 0.587 + rgb[2]! * 0.114
    expect(luma(cut)).toBeGreaterThan(luma(outer))
    expect(luma(outer)).toBeGreaterThan(luma(inner))
    expect(outer[0]!).toBeGreaterThan(outer[2]!)
  })
})
