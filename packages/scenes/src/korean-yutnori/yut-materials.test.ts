import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  applyYutStickVertexColors,
  createYutCraftMaterials,
  createYutMatTextures,
} from './yut-materials'

describe('korean-yutnori carved wood sticks & calm reed mat materials', () => {
  it('assigns longitudinal Z-axis wood grain to all four yut sticks and calm reed textures to the mat', () => {
    const mats = createYutCraftMaterials()
    expect(mats.stickWoods).toHaveLength(4)
    for (const stickMat of mats.stickWoods) {
      expect(stickMat.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'z' })
      expect(stickMat.vertexColors).toBe(true)
    }
    expect(mats.mark.userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'x' })
    expect(mats.reed.map).toBeInstanceOf(THREE.DataTexture)
    expect(mats.weave.map).toBeInstanceOf(THREE.DataTexture)
    // Mat stays calmer (higher roughness) than the hand-rubbed satin wooden yut sticks.
    expect(mats.reed.roughness).toBeGreaterThan(mats.stickWoods[0].roughness + 0.15)

    const disposed = new Map<THREE.Texture, number>()
    for (const mat of [mats.reed, mats.weave]) {
      for (const tex of [mat.map, mat.bumpMap, mat.roughnessMap]) {
        if (!tex) continue
        disposed.set(tex, 0)
        tex.addEventListener('dispose', () => disposed.set(tex, (disposed.get(tex) ?? 0) + 1))
      }
    }
    ;[mats.reed, mats.weave, ...mats.stickWoods, mats.mark].forEach(m => m.dispose())
    expect(disposed.size).toBe(6)
    expect([...disposed.values()].every(n => n === 1)).toBe(true)
  })

  it('produces calm, deterministic, clip-safe rice-straw weave textures for the mat', () => {
    const a = createYutMatTextures('mat', [3, 4])
    const b = createYutMatTextures('mat', [3, 4])
    expect(Buffer.from(a.map.image.data)).toEqual(Buffer.from(b.map.image.data))
    const rgb = a.map.image.data as Uint8Array
    let minLuma = 255, maxLuma = 0, maxR = 0
    for (let i = 0; i < rgb.length; i += 4) {
      const luma = 0.299 * rgb[i]! + 0.587 * rgb[i + 1]! + 0.114 * rgb[i + 2]!
      minLuma = Math.min(minLuma, luma)
      maxLuma = Math.max(maxLuma, luma)
      maxR = Math.max(maxR, rgb[i]!)
    }
    expect(maxLuma - minLuma).toBeGreaterThan(22)
    expect(maxLuma - minLuma).toBeLessThan(85)
    expect(maxR).toBeLessThanOrEqual(224)
    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()
  })

  it('preserves clear brightness separation between flat-sawn faces, curved backs, and cut ends', () => {
    const shape = new THREE.Shape()
    shape.moveTo(-0.12, 0)
    shape.absarc(0, 0, 0.12, Math.PI, 0, true)
    shape.closePath()
    const geom = new THREE.ExtrudeGeometry(shape, { depth: 0.94, steps: 1, curveSegments: 18, bevelEnabled: false })
    geom.translate(0, -0.06, -0.47)
    applyYutStickVertexColors(geom, 0)

    const normals = geom.getAttribute('normal') as THREE.BufferAttribute
    const colors = geom.getAttribute('color') as THREE.BufferAttribute
    const avg = (pred: (ny: number, nz: number) => boolean) => {
      let sum = 0, count = 0
      for (let i = 0; i < normals.count; i++) {
        if (!pred(normals.getY(i), normals.getZ(i))) continue
        sum += colors.getX(i) * 0.299 + colors.getY(i) * 0.587 + colors.getZ(i) * 0.114
        count++
      }
      return sum / Math.max(count, 1)
    }
    const flatLuma = avg((ny, nz) => Math.abs(nz) <= 0.9 && ny < -0.85)
    const roundLuma = avg((ny, nz) => Math.abs(nz) <= 0.9 && ny >= -0.85)
    const endLuma = avg((_, nz) => Math.abs(nz) > 0.9)
    expect(flatLuma).toBeGreaterThan(roundLuma)
    expect(roundLuma).toBeGreaterThan(endLuma)
    geom.dispose()
  })
})
