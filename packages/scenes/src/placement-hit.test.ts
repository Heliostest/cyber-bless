// @vitest-environment jsdom
import * as THREE from 'three'
import { expect, it, vi } from 'vitest'
import { placementHit } from './placement-hit'

it('judges the carried contact anchor rather than a fingertip that arrived first', () => {
  const canvas = document.createElement('canvas')
  canvas.getBoundingClientRect = () => ({ left: 17, top: 89, width: 390, height: 408 }) as DOMRect
  const camera = new THREE.OrthographicCamera(-2, 2, 2, -2, .1, 20)
  camera.position.z = 8; camera.updateMatrixWorld(true)
  const grip = new THREE.Object3D(); grip.position.set(-1, .5, 0)
  const fingerOnly = vi.fn((x: number, y: number) => x === 300 && y === 300)
  expect(placementHit(canvas, camera, grip, 300, 300, fingerOnly)).toBe(false)
  expect(fingerOnly).toHaveBeenCalledExactlyOnceWith(114.5, 242)
  const contactOnly = (x: number, y: number) => Math.abs(x - 114.5) < .1 && Math.abs(y - 242) < .1
  expect(placementHit(canvas, camera, grip, 128, 240, contactOnly)).toBe(true)
  expect(placementHit(canvas, camera, grip, -1, 240, () => true)).toBe(false)
})
