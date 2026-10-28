import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { createCoinWashingModel } from './model'
import { disposeTree } from '../procedural-kit'

describe('washing water optics', () => {
 it('lights close water and droplets while preserving the opaque coin and cloth', () => {
  const model = createCoinWashingModel()
  const water = model.stream.material as THREE.MeshStandardMaterial
  expect(water).toBeInstanceOf(THREE.MeshStandardMaterial)
  expect(water.metalness).toBe(0)
  expect(water.opacity).toBeGreaterThanOrEqual(.55)
  expect(water.roughness).toBeLessThan(.3)
  expect((model.coin.material as THREE.Material).transparent).toBe(false)
  expect((model.cloth.material as THREE.Material).transparent).toBe(false)
  disposeTree(model.root)
 })
})
