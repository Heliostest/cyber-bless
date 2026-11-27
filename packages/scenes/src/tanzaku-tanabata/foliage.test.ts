import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { addSasaBambooFoliage } from './foliage'

function signedVolume(geo: THREE.BufferGeometry): number {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const idx = geo.index!
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3(), cross = new THREE.Vector3()
  let vol6 = 0
  for (let i = 0; i < idx.count; i += 3) {
    a.fromBufferAttribute(pos, idx.getX(i))
    b.fromBufferAttribute(pos, idx.getX(i + 1))
    c.fromBufferAttribute(pos, idx.getX(i + 2))
    cross.crossVectors(b, c)
    vol6 += a.dot(cross)
  }
  return vol6 / 6
}

function isSpatiallyWatertight(geo: THREE.BufferGeometry): boolean {
  const pos = geo.getAttribute('position') as THREE.BufferAttribute
  const idx = geo.index!
  const keyOf = (vi: number) =>
    `${Math.round(pos.getX(vi) * 1e5)},${Math.round(pos.getY(vi) * 1e5)},${Math.round(pos.getZ(vi) * 1e5)}`
  const edges = new Map<string, number>()
  for (let i = 0; i < idx.count; i += 3) {
    const ka = keyOf(idx.getX(i))
    const kb = keyOf(idx.getX(i + 1))
    const kc = keyOf(idx.getX(i + 2))
    for (const [u, v] of [[ka, kb], [kb, kc], [kc, ka]] as const) {
      if (u === v) continue
      const forward = u < v
      const edgeKey = forward ? `${u}|${v}` : `${v}|${u}`
      edges.set(edgeKey, (edges.get(edgeKey) ?? 0) + (forward ? 1 : -1))
    }
  }
  return edges.size > 0 && [...edges.values()].every(count => count === 0)
}

describe('tanzaku-tanabata sasa bamboo foliage', () => {
  it('replaces flat discs with watertight FrontSide sasa twigs and parallel-veined arched bamboo leaves', () => {
    const bamboo = new THREE.Group()
    const foliage = addSasaBambooFoliage(bamboo)
    foliage.updateMatrixWorld(true)

    const twigs: THREE.Mesh[] = []
    const leaves: THREE.Mesh[] = []
    foliage.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      if (obj.name.endsWith('-twig')) twigs.push(obj)
      else if (obj.name.includes('-leaf-')) leaves.push(obj)
    })

    expect(twigs.length).toBeGreaterThanOrEqual(10)
    expect(leaves.length).toBeGreaterThanOrEqual(22)

    for (const mesh of [...twigs, ...leaves]) {
      expect(mesh.geometry instanceof THREE.CircleGeometry, mesh.name).toBe(false)
      expect(mesh.geometry instanceof THREE.CylinderGeometry, mesh.name).toBe(false)
      expect(signedVolume(mesh.geometry), `${mesh.name} positive volume`).toBeGreaterThan(0)
      expect(isSpatiallyWatertight(mesh.geometry), `${mesh.name} watertight`).toBe(true)
      expect(mesh.userData.toonSurface?.outline, `${mesh.name} soft outline off`).toBe(false)
      const mat = mesh.material as THREE.MeshStandardMaterial
      expect(mat.side, `${mesh.name} FrontSide`).toBe(THREE.FrontSide)
    }

    const uniqueLeafColors = new Set<number>()
    for (const leaf of leaves) {
      const mat = leaf.material as THREE.MeshStandardMaterial
      expect(mat.userData.botanicalSurface?.kind, leaf.name).toBe('leaf')
      expect(mat.userData.botanicalSurface?.venation, leaf.name).toBe('parallel')
      expect(mat.userData.ritualOptics?.kind, leaf.name).toBe('leaf')
      uniqueLeafColors.add(mat.color.getHex())
    }
    expect(uniqueLeafColors.size).toBeGreaterThanOrEqual(3)
  })

  it('threads through the three preset hanging-cord ties and stays behind the front face of all four tanzaku strips', () => {
    const bamboo = new THREE.Group()
    const foliage = addSasaBambooFoliage(bamboo)
    foliage.updateMatrixWorld(true)

    // Preset tie loops sit on branchlets at (-0.50, 1.98, -0.20), (-0.21, 2.48, -0.19), (0.25, 2.03, 0.04).
    const presetTies = [
      new THREE.Vector3(-0.50, 1.98, -0.20),
      new THREE.Vector3(-0.21, 2.48, -0.19),
      new THREE.Vector3(0.25, 2.03, 0.04),
    ]
    const twigVertices: THREE.Vector3[] = []
    const leafVertices: THREE.Vector3[] = []
    foliage.traverse(obj => {
      if (!(obj instanceof THREE.Mesh)) return
      const pos = obj.geometry.getAttribute('position') as THREE.BufferAttribute
      const target = obj.name.endsWith('-twig') ? twigVertices : leafVertices
      for (let i = 0; i < pos.count; i++) {
        target.push(new THREE.Vector3().fromBufferAttribute(pos, i).applyMatrix4(obj.matrixWorld))
      }
    })
    for (const tie of presetTies) {
      const nearest = Math.min(...twigVertices.map(v => v.distanceTo(tie)))
      expect(nearest, `twig near tie ${tie.toArray().join(',')}`).toBeLessThan(0.018)
    }

    // Ensure no leaf vertex projects in front (+Z) of any of the four paper strip faces.
    const stripFrontZones = [
      { name: 'coral', xMin: -0.27, xMax: -0.13, yMin: 1.86, yMax: 2.31, zFront: 0.0 },
      { name: 'mint', xMin: 0.18, xMax: 0.32, yMin: 1.56, yMax: 2.01, zFront: 0.05 },
      { name: 'marigold', xMin: -0.57, xMax: -0.43, yMin: 1.26, yMax: 1.71, zFront: -0.10 },
      { name: 'loose-hung', xMin: 0.38, xMax: 0.52, yMin: 1.31, yMax: 1.76, zFront: 0.12 },
    ]
    for (const zone of stripFrontZones) {
      const blocking = leafVertices.filter(
        v => v.x >= zone.xMin && v.x <= zone.xMax && v.y >= zone.yMin && v.y <= zone.yMax && v.z >= zone.zFront,
      )
      expect(blocking, `leaves blocking ${zone.name} strip`).toHaveLength(0)
    }
  })
})
