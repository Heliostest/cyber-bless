import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createBasketHerbLeafMaterial,
  createBasketHerbStemMaterial,
  createBoxwoodLeafGeometry,
  createHerbSprigStemGeometry,
} from './herb-detail'

function assertWatertightManifold(geometry: THREE.BufferGeometry, label: string) {
  const pos = geometry.getAttribute('position') as THREE.BufferAttribute
  const idx = geometry.index!
  expect(idx, `${label} indexed`).not.toBeNull()
  expect([...pos.array].every(Number.isFinite), `${label} finite`).toBe(true)

  const edges = new Map<string, number>()
  const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3()
  const e1 = new THREE.Vector3(), e2 = new THREE.Vector3()
  let signedVol6 = 0

  for (let i = 0; i < idx.count; i += 3) {
    const ia = idx.getX(i), ib = idx.getX(i + 1), ic = idx.getX(i + 2)
    va.fromBufferAttribute(pos, ia)
    vb.fromBufferAttribute(pos, ib)
    vc.fromBufferAttribute(pos, ic)
    e1.subVectors(vb, va)
    e2.subVectors(vc, va)
    expect(e1.clone().cross(e2).lengthSq(), `${label} non-degenerate tri ${i / 3}`).toBeGreaterThan(1e-18)
    signedVol6 += va.dot(vb.clone().cross(vc))
    for (const [u, v] of [[ia, ib], [ib, ic], [ic, ia]] as const) {
      const key = u < v ? `${u}:${v}` : `${v}:${u}`
      edges.set(key, (edges.get(key) ?? 0) + (u < v ? 1 : -1))
    }
  }
  expect(signedVol6, `${label} signed volume`).toBeGreaterThan(0)
  expect([...edges.values()].every((v) => v === 0), `${label} watertight edge balance`).toBe(true)
}

describe('polish-blessing-basket spring herb botanical detail', () => {
  it('builds watertight FrontSide midrib-folded boxwood leaves with vertex color gradients', () => {
    for (const tone of ['mature', 'young'] as const) {
      const geo = createBoxwoodLeafGeometry(tone)
      assertWatertightManifold(geo, `boxwood-${tone}`)
      expect(geo.getAttribute('color')).toBeDefined()
      expect(geo.getAttribute('uv')).toBeDefined()
      const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute)
      expect(box.min.y).toBeGreaterThanOrEqual(-0.005)
      expect(box.max.y).toBeLessThan(0.16)
      geo.dispose()
    }
  })

  it('builds closed finite tapered herb stems with positive signed volume', () => {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0.3, 0.23, -0.25),
      new THREE.Vector3(0.25, 0.62, -0.32),
      new THREE.Vector3(0.22, 0.99, -0.34),
    ])
    const stem = createHerbSprigStemGeometry(curve)
    const pos = stem.getAttribute('position') as THREE.BufferAttribute
    const idx = stem.index!
    const va = new THREE.Vector3(), vb = new THREE.Vector3(), vc = new THREE.Vector3()
    let signedVol6 = 0
    for (let i = 0; i < idx.count; i += 3) {
      va.fromBufferAttribute(pos, idx.getX(i))
      vb.fromBufferAttribute(pos, idx.getX(i + 1))
      vc.fromBufferAttribute(pos, idx.getX(i + 2))
      signedVol6 += va.dot(vb.clone().cross(vc))
    }
    expect(signedVol6).toBeGreaterThan(0)
    stem.dispose()
  })

  it('preserves FrontSide, ritual leaf optics, C1 highlight shoulder, and shader clone hook', () => {
    const leafMat = createBasketHerbLeafMaterial()
    const stemMat = createBasketHerbStemMaterial()
    for (const mat of [leafMat, stemMat]) {
      expect(mat.side).toBe(THREE.FrontSide)
      expect(mat.userData.ritualOptics?.kind).toBe('leaf')
      expect(mat.userData.botanicalFinish?.knee).toBeCloseTo(0.74, 4)
      expect(mat.userData.botanicalFinish?.headroom).toBeCloseTo(0.24, 4)
      const cloned = mat.clone()
      expect(cloned.customProgramCacheKey()).toContain('wbr-basket-herb-v1')
      cloned.dispose()
      mat.dispose()
    }
  })
})
