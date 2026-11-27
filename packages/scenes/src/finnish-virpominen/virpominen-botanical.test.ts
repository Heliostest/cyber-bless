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

function checkNonIndexedWatertight(g: THREE.BufferGeometry, name: string) {
  expect(g.index, name).toBeNull()
  const p = g.getAttribute('position')
  const n = g.getAttribute('normal')
  const key = (v: THREE.Vector3) => v.toArray().map((x) => Math.round(x * 1e6)).join(',')
  const edges = new Map<string, number>()
  let volume = 0
  let minArea = Infinity
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cr = new THREE.Vector3()
  for (let i = 0; i < p.count; i += 3) {
    a.fromBufferAttribute(p, i)
    b.fromBufferAttribute(p, i + 1)
    c.fromBufferAttribute(p, i + 2)
    minArea = Math.min(minArea, new THREE.Triangle(a, b, c).getArea())
    volume += a.dot(cr.crossVectors(b, c)) / 6
    for (const [u, v] of [[a, b], [b, c], [c, a]] as const) {
      const k = [key(u), key(v)].sort().join('|')
      edges.set(k, (edges.get(k) ?? 0) + 1)
    }
  }
  expect(volume, name).toBeGreaterThan(0)
  expect(minArea, name).toBeGreaterThan(1e-12)
  expect([...edges.values()].every((count) => count === 2), name).toBe(true)
  for (let i = 0; i < n.count; i++) {
    expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i)), name).toBeCloseTo(1, 5)
  }
}

describe('finnish-virpominen pussy-willow catkins and paper-craft flower helpers', () => {
  it('builds watertight non-indexed smooth catkin and paper-craft geometries', () => {
    const catkin = createPussyWillowCatkinGeometry()
    const petal = createPaperCraftPetalGeometry()
    const centre = createPaperFlowerCenterGeometry()
    const tie = createPaperTieRibbonGeometry()

    checkNonIndexedWatertight(catkin, 'catkin')
    checkNonIndexedWatertight(petal, 'paper-petal')
    checkNonIndexedWatertight(centre, 'paper-centre')
    checkNonIndexedWatertight(tie, 'paper-tie')

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
