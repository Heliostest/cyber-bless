import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createNanakusaModel } from './model'
import { disposeTree } from '../procedural-kit'

describe('porridge optics', () => {
 it('keeps rice opaque and matte while separating the wet porridge surface', () => {
  const model = createNanakusaModel()
  const surface = model.stock.material as THREE.MeshStandardMaterial
  const rice = (model.root.getObjectByName('pot-rice-0') as THREE.Mesh).material as THREE.MeshStandardMaterial
  expect(surface).not.toBe(rice)
  expect(surface.roughness).toBeLessThan(rice.roughness)
  expect(surface.transparent).toBe(false)
  expect(surface.opacity).toBe(1)
  disposeTree(model.root)
 })
})
