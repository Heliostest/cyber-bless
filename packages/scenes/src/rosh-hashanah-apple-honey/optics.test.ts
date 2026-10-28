import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createAppleHoneyModel } from './model'
import { disposeTree } from '../procedural-kit'

describe('honey optics', () => {
 it('uses physical absorption for volume and a shorter optical path for films', () => {
  const model = createAppleHoneyModel()
  const honey = model.honey.material as THREE.MeshPhysicalMaterial
  const film = model.films[0]!.material as THREE.MeshPhysicalMaterial
  expect(honey).toBeInstanceOf(THREE.MeshPhysicalMaterial)
  expect(honey.transmission).toBeGreaterThan(0)
  expect(honey.opacity).toBe(1)
  expect(film.opacity).toBe(1)
  expect(film.thickness).toBeLessThan(honey.thickness)
  disposeTree(model.root)
 })
})
