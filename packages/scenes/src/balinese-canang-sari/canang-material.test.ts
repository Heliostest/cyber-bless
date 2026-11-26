// @vitest-environment jsdom
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createCanangTrayMaterials,
  createCeperFloorTextures,
  createCeperWallTextures,
  createLeafStripTextures,
  createSampiyanDiskTextures,
} from './canang-material'
import { createCanangModel } from './model'
import { disposeTree } from '../procedural-kit'

function maxChannels(tex: THREE.DataTexture) {
  const data = tex.image.data as Uint8Array
  let maxR = 0, maxG = 0, maxB = 0
  for (let i = 0; i < data.length; i += 4) {
    if (data[i]! > maxR) maxR = data[i]!
    if (data[i + 1]! > maxG) maxG = data[i + 1]!
    if (data[i + 2]! > maxB) maxB = data[i + 2]!
  }
  return { maxR, maxG, maxB }
}

describe('balinese-canang-sari young coconut-leaf and pin materials', () => {
  it('generates deterministic young-leaf textures capped softly below Komorebi daylight clip', () => {
    const sets = [
      createCeperFloorTextures(),
      createCeperWallTextures(),
      createSampiyanDiskTextures(),
      createLeafStripTextures('light'),
      createLeafStripTextures('bud'),
    ]
    for (const tex of sets) {
      expect(tex.map.colorSpace).toBe(THREE.SRGBColorSpace)
      expect(tex.bump.colorSpace).toBe(THREE.NoColorSpace)
      expect(tex.roughness.colorSpace).toBe(THREE.NoColorSpace)
      expect(tex.map.generateMipmaps).toBe(true)
      const peak = maxChannels(tex.map)
      expect(peak.maxR).toBeLessThanOrEqual(222)
      expect(peak.maxG).toBeLessThanOrEqual(224)
      expect(peak.maxB).toBeLessThanOrEqual(158)
      tex.map.dispose(); tex.bump.dispose(); tex.roughness.dispose()
    }

    // Verify sampiyan disk has clear radial sector fold relief around mid-radius.
    const disk = createSampiyanDiskTextures()
    const size = disk.bump.image.width as number
    const bump = disk.bump.image.data as Uint8Array
    const ring: number[] = []
    for (let i = 0; i < 72; i++) {
      const a = (i / 72) * Math.PI * 2
      const x = Math.round((0.5 + Math.cos(a) * 0.34) * (size - 1))
      const y = Math.round((0.5 + Math.sin(a) * 0.34) * (size - 1))
      ring.push(bump[(y * size + x) * 4]!)
    }
    expect(Math.max(...ring) - Math.min(...ring)).toBeGreaterThan(28)
    disk.map.dispose(); disk.bump.dispose(); disk.roughness.dispose()
  })

  it('gives bamboo pins and incense sticks fine craft grain while keeping betel nut and flowers untouched', () => {
    const m = createCanangModel()
    const pin = m.root.getObjectByName('canang-rim-stitch-0-0.628') as THREE.Mesh
    const incense = m.root.getObjectByName('canang-incense-0.51') as THREE.Mesh
    const betel = m.root.getObjectByName('canang-betel-nut') as THREE.Mesh
    const whitePetal = m.root.getObjectByName('canang-white-flower-petal-0') as THREE.Mesh
    const ceperFloor = m.root.getObjectByName('canang-ceper-floor') as THREE.Mesh

    expect((pin.material as THREE.Material).userData.craftSurface).toMatchObject({ kind: 'bamboo', axis: 'y' })
    expect((incense.material as THREE.Material).userData.craftSurface).toMatchObject({ kind: 'wood', axis: 'z' })
    expect((betel.material as THREE.Material).userData.craftSurface).toBeUndefined()
    expect((whitePetal.material as THREE.MeshStandardMaterial).map).toBeNull()
    expect((ceperFloor.material as THREE.MeshStandardMaterial).map).toBeInstanceOf(THREE.DataTexture)
    m.dispose()
    disposeTree(m.root)
  })

  it('disposes every owned tray texture exactly once', () => {
    const suite = createCanangTrayMaterials()
    const mats = [suite.ceperFloor, suite.ceperWall, suite.sampiyanDisk, suite.sampiyanStripLight, suite.sampiyanStripBud]
    const textures = new Set<THREE.Texture>()
    for (const mat of mats) {
      textures.add(mat.map!); textures.add(mat.bumpMap!); textures.add(mat.roughnessMap!)
    }
    const counts = new Map<THREE.Texture, number>()
    textures.forEach(t => t.addEventListener('dispose', () => counts.set(t, (counts.get(t) ?? 0) + 1)))
    suite.dispose(); suite.dispose()
    expect(counts.size).toBe(textures.size)
    expect([...counts.values()].every(n => n === 1)).toBe(true)
    ;[...mats, suite.rimStitch, suite.incenseStick].forEach(m => m.dispose())
  })
})
