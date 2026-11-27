import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createHollyLeafMaterial,
  createHollyLeafTextures,
  createSpinyHollyLeafGeometry,
} from './holly-botanical'

function inspectNonIndexedSolid(g: THREE.BufferGeometry) {
  expect(g.index).toBeNull()
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
  for (let i = 0; i < n.count; i++) {
    expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5)
  }
  return { volume, minArea, edges }
}

describe('hiiragi-iwashi stylized spiny holly leaf geometry and material', () => {
  it('builds thin watertight spiny holly leaves with alternating spine lift inside threshold clearance', () => {
    for (const mirror of [1, -1] as const) {
      const g = createSpinyHollyLeafGeometry(mirror)
      const { volume, minArea, edges } = inspectNonIndexedSolid(g)
      expect(volume).toBeGreaterThan(0)
      expect(minArea).toBeGreaterThan(1e-10)
      expect([...edges.values()].every((count) => count === 2)).toBe(true)

      const box = g.boundingBox!
      expect(box.min.x).toBeCloseTo(0.035, 4)
      expect(box.max.x).toBeCloseTo(0.380, 4)
      // Total Z excursion stays comfortably under threshold rest clearance (~0.028).
      expect(Math.abs(box.min.z)).toBeLessThan(0.015)
      expect(Math.abs(box.max.z)).toBeLessThan(0.015)
      // Alternating spine tips create genuine 3D sculptural relief (> 12 mm total Z span).
      expect(box.max.z - box.min.z).toBeGreaterThan(0.014)
      g.dispose()
    }
  })

  it('creates deterministic glossy dark evergreen holly textures and disposes once', () => {
    const a = createHollyLeafTextures()
    const b = createHollyLeafTextures()
    const data = a.map.image.data as Uint8Array
    expect(Array.from(data)).toEqual(Array.from(b.map.image.data as Uint8Array))
    let sumR = 0, sumG = 0, sumB = 0, maxG = 0
    for (let i = 0; i < data.length; i += 4) {
      sumR += data[i]!
      sumG += data[i + 1]!
      sumB += data[i + 2]!
      if (data[i + 1]! > maxG) maxG = data[i + 1]!
    }
    expect(sumG).toBeGreaterThan(sumR * 1.35)
    expect(sumG).toBeGreaterThan(sumB * 1.45)
    expect(maxG).toBeLessThanOrEqual(200)
    a.map.dispose(); a.bump.dispose(); a.roughness.dispose()
    b.map.dispose(); b.bump.dispose(); b.roughness.dispose()

    const mat = createHollyLeafMaterial()
    expect(mat.side).toBe(THREE.FrontSide)
    expect(mat.clearcoat).toBeGreaterThan(0.3)
    const disposed = new Map<THREE.Texture, number>()
    const textures = [mat.map!, mat.bumpMap!, mat.roughnessMap!]
    textures.forEach((t) => t.addEventListener('dispose', () => disposed.set(t, (disposed.get(t) ?? 0) + 1)))
    mat.dispose(); mat.dispose()
    expect(disposed.size).toBe(3)
    expect([...disposed.values()].every((n) => n === 1)).toBe(true)
  })
})
