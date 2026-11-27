import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  buildKadomatsuPineNeedlesGeometry,
  createKadomatsuPineMaterial,
} from './pine-botanical'

describe('japanese-kadomatsu stylized arched pine needles', () => {
  it('builds 168 closed watertight 5-sided arched needles with unit normals and root-to-tip vertex color gradient', () => {
    const g = buildKadomatsuPineNeedlesGeometry()
    expect(g.index).toBeNull()
    const p = g.getAttribute('position')
    const n = g.getAttribute('normal')
    const c = g.getAttribute('color')
    expect(p.count).toBe(168 * 30 * 3)
    expect(c).toBeDefined()

    const key = (v: THREE.Vector3) => v.toArray().map((x) => Math.round(x * 1e6)).join(',')
    const edges = new Map<string, number>()
    let volume = 0
    const a = new THREE.Vector3(), b = new THREE.Vector3(), d = new THREE.Vector3(), cr = new THREE.Vector3()
    for (let i = 0; i < p.count; i += 3) {
      a.fromBufferAttribute(p, i)
      b.fromBufferAttribute(p, i + 1)
      d.fromBufferAttribute(p, i + 2)
      expect(b.clone().sub(a).cross(d.clone().sub(a)).lengthSq()).toBeGreaterThan(1e-20)
      volume += a.dot(cr.crossVectors(b, d)) / 6
      for (const [u, v] of [[a, b], [b, d], [d, a]] as const) {
        const k = [key(u), key(v)].sort().join('|')
        edges.set(k, (edges.get(k) ?? 0) + 1)
      }
    }
    expect(volume).toBeGreaterThan(0)
    expect([...edges.values()].every((count) => count === 2)).toBe(true)

    for (let i = 0; i < n.count; i++) {
      expect(Math.hypot(n.getX(i), n.getY(i), n.getZ(i))).toBeCloseTo(1, 5)
    }

    // Verify clear brightness progression from darker sheath/root to brighter sunlit needle tips.
    let minLuma = Infinity, maxLuma = -Infinity
    for (let i = 0; i < c.count; i++) {
      const luma = c.getX(i) * 0.299 + c.getY(i) * 0.587 + c.getZ(i) * 0.114
      if (luma < minLuma) minLuma = luma
      if (luma > maxLuma) maxLuma = luma
    }
    expect(maxLuma - minLuma).toBeGreaterThan(0.35)

    // Bounding envelope stays compact inside the original pine cluster footprint.
    const box = g.boundingBox!
    expect(Math.max(Math.abs(box.min.x), Math.abs(box.max.x))).toBeLessThan(0.52)
    expect(Math.max(Math.abs(box.min.z), Math.abs(box.max.z))).toBeLessThan(0.52)
    expect(box.min.y).toBeGreaterThan(0.36)
    expect(box.max.y).toBeLessThan(0.95)
    g.dispose()
  })

  it('enables wrapped foliage cluster lighting on FrontSide pine material', () => {
    const mat = createKadomatsuPineMaterial()
    expect(mat.side).toBe(THREE.FrontSide)
    expect(mat.vertexColors).toBe(true)
    expect(mat.userData.treeClusterNormals).toBe(true)
    mat.dispose()
  })
})
