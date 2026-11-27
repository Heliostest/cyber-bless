import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  buildKadomatsuPineNeedlesGeometry,
  createKadomatsuPineMaterial,
} from './pine-botanical'

describe('japanese-kadomatsu stylized arched pine needles', () => {
  it('builds 168 arched needles with a root-to-tip vertex color gradient', () => {
    const g = buildKadomatsuPineNeedlesGeometry()
    const p = g.getAttribute('position')
    const c = g.getAttribute('color')
    expect(p.count).toBe(168 * 30 * 3)
    expect(c).toBeDefined()

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
