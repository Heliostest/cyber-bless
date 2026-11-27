import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import {
  createBasketHerbLeafMaterial,
  createBasketHerbStemMaterial,
  createBoxwoodLeafGeometry,
} from './herb-detail'

describe('polish-blessing-basket spring herb botanical detail', () => {
  it('builds midrib-folded boxwood leaves with vertex color gradients', () => {
    for (const tone of ['mature', 'young'] as const) {
      const geo = createBoxwoodLeafGeometry(tone)
      expect(geo.getAttribute('color')).toBeDefined()
      expect(geo.getAttribute('uv')).toBeDefined()
      const box = new THREE.Box3().setFromBufferAttribute(geo.getAttribute('position') as THREE.BufferAttribute)
      expect(box.min.y).toBeGreaterThanOrEqual(-0.005)
      expect(box.max.y).toBeLessThan(0.16)
      geo.dispose()
    }
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
