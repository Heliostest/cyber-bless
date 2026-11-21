import { afterEach, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { disposeTree } from '../procedural-kit'
import { createKoinoboriModel } from './model'

const models: ReturnType<typeof createKoinoboriModel>[] = []
afterEach(() => { models.splice(0).forEach(model => { model.dispose(); disposeTree(model.subject) }) })
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
  it('drives carp clothTube and halyard rope with real Rapier physics while preserving mouth, tail stitch and endpoints', async () => {
    const model = create()
    model.pose(3, 0)
    await model.startPhysics()
    expect(model.rapierReady).toBe(true)
    const body = model.subject.getObjectByName('koinobori-body') as THREE.Mesh
    const rope = model.subject.getObjectByName('koinobori-halyard') as THREE.Mesh
    const bodyPos = body.geometry.getAttribute('position')
    const ropePos = rope.geometry.getAttribute('position')
    const mouth = Array.from(bodyPos.array).slice(0, 49 * 3)
    const beforeBody = Array.from(bodyPos.array)
    for (let i = 0; i < 30; i++) model.stepPhysics(1 / 60, (i + 1) / 60)
    model.subject.updateMatrixWorld(true)
    expect(Array.from(bodyPos.array)).not.toEqual(beforeBody)
    expect(Array.from(bodyPos.array).slice(0, 49 * 3)).toEqual(mouth)
    for (const name of ['koinobori-tail', 'koinobori-tail-back']) {
      const tail = model.subject.getObjectByName(name) as THREE.Mesh
      const vertices = tail.geometry.getAttribute('position')
      for (let j = 0; j <= 24; j++) {
        const root = tail.localToWorld(new THREE.Vector3().fromBufferAttribute(vertices, j))
        const at = 48 * 49 + (name === 'koinobori-tail' ? j : 48 - j)
        const rim = body.localToWorld(new THREE.Vector3().fromBufferAttribute(bodyPos, at))
        expect(root.distanceTo(rim)).toBeLessThan(1e-5)
      }
    }
    expect(Array.from(ropePos.array).every(Number.isFinite)).toBe(true)
  })
  it('produces a readable Rapier wind S-curve at full hoist and a non-buckling droop at entry', async () => {
    const hoisted = create()
    hoisted.pose(3, 0)
    await hoisted.startPhysics()
    const hoistedBody = hoisted.subject.getObjectByName('koinobori-body') as THREE.Mesh
    const hPos = hoistedBody.geometry.getAttribute('position')
    const ringCenterY = (pos: THREE.BufferAttribute | THREE.InterleavedBufferAttribute, row: number) => {
      let sum = 0
      for (let j = 0; j < 48; j++) sum += pos.getY(row * 49 + j)
      return sum / 48
    }
    let minMidY = Infinity, maxMidY = -Infinity, minTailY = Infinity, maxTailY = -Infinity, maxChordDev = 0
    for (let i = 0; i < 120; i++) {
      hoisted.stepPhysics(1 / 60, (i + 1) / 60)
      if (i % 6 === 0) {
        const yHead = ringCenterY(hPos, 10)
        const yMid = ringCenterY(hPos, 28)
        const yTail = ringCenterY(hPos, 48)
        minMidY = Math.min(minMidY, yMid); maxMidY = Math.max(maxMidY, yMid)
        minTailY = Math.min(minTailY, yTail); maxTailY = Math.max(maxTailY, yTail)
        const chordY = yHead + (yTail - yHead) * ((28 - 10) / (48 - 10))
        maxChordDev = Math.max(maxChordDev, Math.abs(yMid - chordY))
      }
    }
    // Readable wind-driven vertical sweep and S-curve curvature (not a stiff straight horizontal pipe).
    expect(maxTailY - minTailY).toBeGreaterThan(0.22)
    expect(maxMidY - minMidY).toBeGreaterThan(0.08)
    expect(maxChordDev).toBeGreaterThan(0.06)

    const entry = create()
    entry.pose(0, 0)
    await entry.startPhysics()
    const entryBody = entry.subject.getObjectByName('koinobori-body') as THREE.Mesh
    const entryFish = entry.subject.getObjectByName('koinobori-fish')!
    const ePos = entryBody.geometry.getAttribute('position')
    for (let i = 0; i < 45; i++) entry.stepPhysics(1 / 60, (i + 1) / 60)
    const entryMidY = ringCenterY(ePos, 24)
    const entryTailY = ringCenterY(ePos, 48)
    // Smooth downward gravity droop at entry without upward compression buckling or ground clipping.
    expect(entryMidY).toBeLessThan(-0.08)
    expect(entryTailY).toBeLessThan(entryMidY - 0.12)
    expect(entryFish.position.y + entryTailY).toBeGreaterThan(0.25)
  })
})
