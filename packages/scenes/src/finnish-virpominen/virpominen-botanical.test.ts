import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createPaperCraftPetalGeometry,
  createPaperFlowerCenterGeometry,
  createPaperFlowerMaterials,
  createPaperTieRibbonGeometry,
  createPussyWillowCatkinGeometry,
  createPussyWillowCatkinMaterial,
  createPussyWillowCatkinTextures,
} from './virpominen-botanical'

describe('finnish-virpominen pussy-willow catkins and paper-craft flower helpers', () => {
  it('builds smooth catkin and paper-craft geometries', () => {
    const catkin = createPussyWillowCatkinGeometry()
    const petal = createPaperCraftPetalGeometry()
    const centre = createPaperFlowerCenterGeometry()
    const tie = createPaperTieRibbonGeometry()

    // Catkin preserves smooth normals across shared edges (not flat face normals).
    const pos = catkin.getAttribute('position')
    const norm = catkin.getAttribute('normal')
    let smoothDiff = 0
    for (let i = 0; i < pos.count; i += 3) {
      const n0 = new THREE.Vector3().fromBufferAttribute(norm, i)
      const n1 = new THREE.Vector3().fromBufferAttribute(norm, i + 1)
      if (n0.angleTo(n1) > 0.02) smoothDiff++
    }
    expect(smoothDiff).toBeGreaterThan(pos.count / 6)

    for (const g of [catkin, petal, centre, tie]) g.dispose()
  })

  it('creates dark brown bud-scale base + silvery fuzz rim sheen within Komorebi highlight headroom and keeps paper flowers as paper', () => {
    const tex = createPussyWillowCatkinTextures()
    const size = tex.map.image.width as number
    const color = tex.map.image.data as Uint8Array
    const sheen = tex.sheenColor.image.data as Uint8Array

    // Lower bud-scale region (v ~ 0.12) is dark warm chestnut brown with zero sheen.
    const rowBase = Math.round(size * 0.12) * size * 4
    let baseR = 0, baseG = 0, baseB = 0, baseSheen = 0
    for (let x = 0; x < size; x++) {
      baseR += color[rowBase + x * 4]!
      baseG += color[rowBase + x * 4 + 1]!
      baseB += color[rowBase + x * 4 + 2]!
      baseSheen += sheen[rowBase + x * 4]!
    }
    baseR /= size; baseG /= size; baseB /= size; baseSheen /= size
    expect(baseR).toBeGreaterThan(baseG + 20)
    expect(baseG).toBeGreaterThan(baseB + 15)
    expect(baseSheen).toBeLessThan(5)

    // Upper fuzz region (v ~ 0.72) is luminous silver-cream capped safely below 225, with strong sheen.
    const rowTop = Math.round(size * 0.72) * size * 4
    let topR = 0, topMax = 0, topSheen = 0
    for (let x = 0; x < size; x++) {
      const r = color[rowTop + x * 4]!
      topR += r
      if (r > topMax) topMax = r
      topSheen += sheen[rowTop + x * 4]!
    }
    topR /= size; topSheen /= size
    expect(topR).toBeGreaterThan(baseR + 85)
    expect(topMax).toBeLessThanOrEqual(226)
    expect(topSheen).toBeGreaterThan(180)
    tex.map.dispose(); tex.bump.dispose(); tex.roughness.dispose(); tex.sheenColor.dispose()

    const catkinMat = createPussyWillowCatkinMaterial()
    expect(catkinMat.sheen).toBeGreaterThan(0.7)
    const disposed = new Map<THREE.Texture, number>()
    const owned = [catkinMat.map!, catkinMat.bumpMap!, catkinMat.roughnessMap!, catkinMat.sheenColorMap!]
    owned.forEach((t) => t.addEventListener('dispose', () => disposed.set(t, (disposed.get(t) ?? 0) + 1)))
    catkinMat.dispose(); catkinMat.dispose()
    expect(disposed.size).toBe(4)
    expect([...disposed.values()].every((count) => count === 1)).toBe(true)

    const paperMats = createPaperFlowerMaterials()
    for (const m of [paperMats.yellow, paperMats.pink, paperMats.centre]) {
      expect(m.userData.ritualOptics?.kind).toBe('paper')
      expect(m.userData.ritualOptics?.paper?.layout).toBe('sheet')
      m.dispose()
    }
  })
})
