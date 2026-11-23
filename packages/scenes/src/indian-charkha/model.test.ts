import { describe, expect, it } from 'vitest'
import fs from 'node:fs'
import path from 'node:path'
import * as THREE from 'three'
import { createCharkhaModel } from './model'
import { disposeTree } from '../procedural-kit'

function assertFiniteAndOutwardTube(mesh: THREE.Mesh, label: string) {
  const pos = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  const norm = mesh.geometry.getAttribute('normal') as THREE.BufferAttribute
  const uv = mesh.geometry.getAttribute('uv') as THREE.BufferAttribute
  expect(pos.count, label).toBeGreaterThan(100)
  expect(norm.count, label).toBe(pos.count)
  expect(uv.count, label).toBe(pos.count)
  for (let i = 0; i < pos.count; i++) {
    expect(Number.isFinite(pos.getX(i)), `${label} px`).toBe(true)
    expect(Number.isFinite(pos.getY(i)), `${label} py`).toBe(true)
    expect(Number.isFinite(pos.getZ(i)), `${label} pz`).toBe(true)
    const nl = Math.hypot(norm.getX(i), norm.getY(i), norm.getZ(i))
    expect(nl, `${label} norm ${i}`).toBeGreaterThan(0.95)
    expect(nl, `${label} norm ${i}`).toBeLessThan(1.05)
  }
}

describe('indian-charkha fiber, yarn, cop, and drive-belt craft', () => {
  it('eliminates the open DNA air gap and sawtooth collapse between drawn-yarn plies across all steps', () => {
    const model = createCharkhaModel()
    const y0 = model.subject.getObjectByName('charkha-drawn-yarn-0') as THREE.Mesh
    const y1 = model.subject.getObjectByName('charkha-drawn-yarn-1') as THREE.Mesh
    const cone = model.subject.getObjectByName('charkha-drafting-cone') as THREE.Mesh
    const tipWrap = model.subject.getObjectByName('charkha-tip-wrap') as THREE.Mesh
    expect(y0 && y1 && cone && tipWrap).toBeTruthy()

    const RING_STRIDE = 11 // 10 radial segments + seam duplicate
    const SEGS = 220

    for (const [step, amount] of [[0, 0], [0, 0.5], [1, 0], [1, 0.5], [2, 0], [2, 0.5], [3, 0]] as const) {
      model.pose(step, amount)
      assertFiniteAndOutwardTube(y0, `yarn0 s=${step} a=${amount}`)
      assertFiniteAndOutwardTube(y1, `yarn1 s=${step} a=${amount}`)
      assertFiniteAndOutwardTube(cone, `cone s=${step} a=${amount}`)
      assertFiniteAndOutwardTube(tipWrap, `tipWrap s=${step} a=${amount}`)

      const p0 = y0.geometry.getAttribute('position') as THREE.BufferAttribute
      const p1 = y1.geometry.getAttribute('position') as THREE.BufferAttribute
      const c0 = new THREE.Vector3()
      const c1 = new THREE.Vector3()
      let maxPlySep = 0
      let maxStepJump = 0
      const prevC0 = new THREE.Vector3()

      for (let i = 0; i <= SEGS; i++) {
        c0.set(0, 0, 0)
        c1.set(0, 0, 0)
        for (let j = 0; j < 10; j++) {
          const idx = i * RING_STRIDE + j
          c0.x += p0.getX(idx); c0.y += p0.getY(idx); c0.z += p0.getZ(idx)
          c1.x += p1.getX(idx); c1.y += p1.getY(idx); c1.z += p1.getZ(idx)
        }
        c0.divideScalar(10)
        c1.divideScalar(10)
        // Two plies must hug tightly (center separation < 2 * strand radius ~= 0.0152..0.0209) with zero daylight gap.
        const sep = c0.distanceTo(c1)
        maxPlySep = Math.max(maxPlySep, sep)
        if (i > 0) maxStepJump = Math.max(maxStepJump, c0.distanceTo(prevC0))
        prevC0.copy(c0)
      }
      expect(maxPlySep, `ply sep s=${step} a=${amount}`).toBeLessThan(0.0165)
      expect(maxPlySep, `ply non-degenerate s=${step} a=${amount}`).toBeGreaterThan(0.008)
      // High tubular sampling prevents 4-seg/turn sawtooth collapse even at full twist.
      expect(maxStepJump, `smooth step s=${step} a=${amount}`).toBeLessThan(0.025)
    }
    disposeTree(model.subject)
  })

  it('keeps drafting cone seated at cotton sliver and tip-wrap retracting cleanly during winding', () => {
    const model = createCharkhaModel()
    const cotton = model.subject.getObjectByName('charkha-cotton') as THREE.Mesh
    const cone = model.subject.getObjectByName('charkha-drafting-cone') as THREE.Mesh
    const tipWrap = model.subject.getObjectByName('charkha-tip-wrap') as THREE.Mesh

    // At p1 (drafted), tipWrap extends to spindle tip (~1.046) and drafting cone meets cotton sliver.
    model.pose(1, 0)
    model.subject.updateMatrixWorld(true)
    const tipDraftBox = new THREE.Box3().setFromObject(tipWrap)
    expect(tipDraftBox.max.z).toBeGreaterThan(1.02)
    const coneBox = new THREE.Box3().setFromObject(cone)
    const cottonBox = new THREE.Box3().setFromObject(cotton)
    expect(coneBox.intersectsBox(cottonBox)).toBe(true)

    // At p3 (wound complete), tipWrap retracts cleanly down to cop nose (~0.81).
    model.pose(3, 0)
    model.subject.updateMatrixWorld(true)
    const tipWoundBox = new THREE.Box3().setFromObject(tipWrap)
    expect(tipWoundBox.max.z).toBeLessThan(0.83)
    disposeTree(model.subject)
  })

  it('preserves baseline cotton envelope, exact auto-fit camera parity, drive-belt outer radius <= 0.014, and strict cop-winding clearance', () => {
    const model = createCharkhaModel()
    const cotton = model.subject.getObjectByName('charkha-cotton') as THREE.Mesh
    cotton.geometry.computeBoundingBox()
    const bb = cotton.geometry.boundingBox!
    expect(bb.min.x).toBeCloseTo(-1.038529, 4)
    expect(bb.min.y).toBeCloseTo(-1, 5)
    expect(bb.max.x).toBeLessThanOrEqual(1.04)
    expect(bb.max.y).toBeLessThanOrEqual(1.01)

    // Verify exact auto-fit camera distance parity with frozen f06e937f at official 346x332 and portrait 390x844.
    for (const [aspect, expectedCam] of [
      [346 / 332, [1.011, 3.53, 6.292]],
      [390 / 844, [2.527, 6.751, 13.491]],
    ] as const) {
      const camera = new THREE.PerspectiveCamera(40, aspect, 0.1, 40)
      const target = new THREE.Vector3(-0.25, 0.85, 0.30)
      const direction = new THREE.Vector3(0.8, 1.7, 3.8).normalize()
      camera.position.copy(target).add(direction)
      camera.lookAt(target)
      camera.updateMatrixWorld(true)
      const inverse = camera.quaternion.clone().invert()
      const tangent = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2))
      const p = new THREE.Vector3()
      let distance = 3.4
      for (const [step, n] of [[0, 0], [0, 1], [1, 0], [1, .25], [1, .5], [1, .75], [1, 1], [2, 0], [2, .5], [2, 1], [3, 0]] as const) {
        model.pose(step, n)
        model.subject.updateMatrixWorld(true)
        model.subject.traverse((o) => {
          const m = o as THREE.Mesh
          if (!m.geometry) return
          const v = m.geometry.getAttribute('position') as THREE.BufferAttribute
          for (let i = 0; i < v.count; i++) {
            p.fromBufferAttribute(v, i).applyMatrix4(m.matrixWorld).sub(target).applyQuaternion(inverse)
            distance = Math.max(distance, p.z + Math.abs(p.x) / (tangent * aspect * 0.86), p.z + Math.abs(p.y) / (tangent * 0.86))
          }
        })
      }
      camera.position.copy(target).addScaledVector(direction, distance)
      const actual = camera.position.toArray().map((n) => Number(n.toFixed(3)))
      expect(actual).toEqual([...expectedCam])
    }

    // Drive belt stays strictly within <= 0.014 of centerline (no camera envelope drift, no artificial thickening).
    const belt = model.subject.getObjectByName('charkha-drive-belt') as THREE.Mesh
    assertFiniteAndOutwardTube(belt, 'charkha-drive-belt')
    belt.geometry.computeBoundingBox()
    expect(belt.geometry.boundingBox!.max.y).toBeLessThanOrEqual(1.12 + 0.76 + 0.0141)
    expect(Math.abs(belt.geometry.boundingBox!.max.z)).toBeLessThanOrEqual(0.0141)

    // Every winding vertex clears actual opaque cop at all checkpoints without geometry reallocation.
    const cop = model.subject.getObjectByName('charkha-cop') as THREE.Mesh
    const winding = model.subject.getObjectByName('charkha-winding') as THREE.Mesh
    const initialWindingGeo = winding.geometry
    for (const [step, amount] of [[0, 0], [1, 0], [2, 0.4], [2, 0.8], [3, 0]] as const) {
      model.pose(step, amount)
      expect(winding.geometry).toBe(initialWindingGeo)
      const surface = cop.geometry.getAttribute('position') as THREE.BufferAttribute
      const strand = winding.geometry.getAttribute('position') as THREE.BufferAttribute
      const rings = new Map<number, number>()
      for (let i = 0; i < surface.count; i++) {
        const z = Number(surface.getZ(i).toFixed(5))
        const rad = Math.hypot(surface.getX(i), surface.getY(i)) * cop.scale.x
        rings.set(z, Math.max(rings.get(z) ?? 0, rad))
      }
      const profile = [...rings].sort((a, b) => a[0] - b[0])
      for (let i = 0; i < strand.count; i++) {
        const z = strand.getZ(i)
        const hi = profile.findIndex(([h]) => h >= z)
        expect(hi).toBeGreaterThan(0)
        const [z0, r0] = profile[hi - 1]!
        const [z1, r1] = profile[hi]!
        const copR = r0 + (r1 - r0) * (z - z0) / (z1 - z0)
        expect(Math.hypot(strand.getX(i), strand.getY(i)) - copR).toBeGreaterThan(0)
      }
    }
    disposeTree(model.subject)
  })

  it('disposes every owned texture (map and bumpMap) once via disposeTree and uses zero Rapier/WASM', () => {
    const model = createCharkhaModel()
    const textures = new Set<THREE.Texture>()
    model.subject.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      for (const mat of Array.isArray(m.material) ? m.material : [m.material]) {
        const std = mat as THREE.MeshStandardMaterial
        if (std.map) textures.add(std.map)
        if (std.bumpMap) textures.add(std.bumpMap)
      }
    })
    expect(textures.size).toBeGreaterThanOrEqual(10)
    const disposedCounts = new Map<THREE.Texture, number>()
    textures.forEach((tex) => tex.addEventListener('dispose', () => disposedCounts.set(tex, (disposedCounts.get(tex) ?? 0) + 1)))
    disposeTree(model.subject)
    expect(disposedCounts.size).toBe(textures.size)
    expect([...disposedCounts.values()].every((n) => n === 1)).toBe(true)

    const dir = path.dirname(new URL(import.meta.url).pathname)
    for (const file of ['model.ts', 'scene.ts']) {
      const src = fs.readFileSync(path.join(dir, file), 'utf8')
      expect(src).not.toMatch(/rapier|@dimforge|\.wasm/i)
    }
  })
})
