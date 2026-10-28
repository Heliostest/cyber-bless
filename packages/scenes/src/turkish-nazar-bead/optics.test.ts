import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createTurkishNazarBeadModel } from './model'
import { disposeTree } from '../procedural-kit'

describe('nazar optics', () => {
 it('limits weak transmission to the blue outer glass and keeps the eye solid', () => {
  const model = createTurkishNazarBeadModel()
  let glass: THREE.MeshPhysicalMaterial[] = []
  model.root.traverse(object => { const m = object as THREE.Mesh; if (Array.isArray(m.material) && m.material.length === 4) glass = m.material as THREE.MeshPhysicalMaterial[] })
  expect(glass).toHaveLength(4)
  expect(glass[0]!.transmission).toBeGreaterThan(0)
  expect(glass[0]!.transmission).toBeLessThanOrEqual(.15)
  for (const eye of glass.slice(1)) { expect(eye.transmission).toBe(0); expect(eye.opacity).toBe(1); expect(eye.transparent).toBe(false) }
  disposeTree(model.root)
 })
})
