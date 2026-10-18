import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { disposeTree } from '../procedural-kit'
import { createKoinoboriModel } from './model'

const models: ReturnType<typeof createKoinoboriModel>[] = []
afterEach(() => { models.splice(0).forEach(model => disposeTree(model.subject)) })
function create() { const model = createKoinoboriModel(); models.push(model); return model }

describe('height-driven koinobori breeze', () => {
  it('increases visible tail travel continuously with hoisting height before securing', () => {
    const model = create(), tail = model.subject.getObjectByName('koinobori-tail') as THREE.Mesh
    const span = (lift: number) => {
      model.pose(1, lift)
      const y: number[] = []
      for (let t = 0; t < 6; t += .15) { model.flutter(t); y.push(tail.geometry.getAttribute('position').getY(8 * 25)) }
      return Math.max(...y) - Math.min(...y)
    }
    const low = span(0), middle = span(.5), high = span(1)
    expect(low).toBeGreaterThan(.025)
    expect(middle).toBeGreaterThan(low * 1.8)
    expect(high).toBeGreaterThan(middle * 1.4)
    expect(high).toBeGreaterThan(.30)
  })
  it('poses at the current wind phase without resetting the cloth during a drag', () => {
    const model = create(), body = model.subject.getObjectByName('koinobori-body') as THREE.Mesh
    model.pose(1, .65, 2.4)
    const before = Array.from(body.geometry.getAttribute('position').array)
    model.flutter(2.4)
    expect(Array.from(body.geometry.getAttribute('position').array)).toEqual(before)
  })
  it('keeps the mouth still and both moving tail roots joined throughout the breeze', () => {
    const model = create(), body = model.subject.getObjectByName('koinobori-body') as THREE.Mesh
    for (const lift of [0, .5, 1]) {
      model.pose(1, lift)
      const positions = body.geometry.getAttribute('position'), mouth = Array.from(positions.array).slice(0, 49 * 3)
      for (const time of [0, .7, 1.8, 3.2]) {
        model.flutter(time); model.subject.updateMatrixWorld(true)
        expect(Array.from(positions.array).slice(0, 49 * 3)).toEqual(mouth)
        for (const name of ['koinobori-tail', 'koinobori-tail-back']) {
          const tail = model.subject.getObjectByName(name) as THREE.Mesh, vertices = tail.geometry.getAttribute('position')
          for (let j = 0; j <= 24; j++) {
            const root = tail.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, j))
            const at = 48 * 49 + (name === 'koinobori-tail' ? j : 48 - j)
            const rim = body.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, at))
            expect(root.distanceTo(rim)).toBeLessThan(1e-5)
          }
        }
      }
    }
  })
})
