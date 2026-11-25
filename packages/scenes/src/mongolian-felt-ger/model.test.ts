import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { createGerModel } from './model'

function assertFiniteAndOutwardNormals(mesh: THREE.Mesh, center?: THREE.Vector3) {
  const pos = mesh.geometry.getAttribute('position')
  const norm = mesh.geometry.getAttribute('normal')
  expect(pos.count, `${mesh.name} vertex count`).toBeGreaterThan(24)
  expect(norm, `${mesh.name} normals`).toBeTruthy()
  let outwardDotSum = 0
  const p = new THREE.Vector3()
  const n = new THREE.Vector3()
  for (let i = 0; i < pos.count; i++) {
    p.fromBufferAttribute(pos, i)
    n.fromBufferAttribute(norm, i)
    expect(Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.z), `${mesh.name} pos`).toBe(true)
    expect(Number.isFinite(n.x) && Number.isFinite(n.y) && Number.isFinite(n.z), `${mesh.name} norm`).toBe(true)
    expect(n.length(), `${mesh.name} unit normal`).toBeGreaterThan(0.5)
    if (center) outwardDotSum += p.clone().sub(center).dot(n)
  }
  if (center) expect(outwardDotSum, `${mesh.name} outward normal orientation`).toBeGreaterThan(0)
}

describe('Mongolian felt ger craft geometry and materials', () => {
  it('builds finite outward-oriented wool felt shells, woven eave trim, 3-ply twisted ropes, and layered felt roll', () => {
    const model = createGerModel()
    model.pose(1, 1, 1, 3)
    model.subject.updateMatrixWorld(true)

    const roof = model.subject.getObjectByName('ger-roof-felt') as THREE.Mesh
    const wall = model.subject.getObjectByName('ger-wall-felt') as THREE.Mesh
    const eave = model.subject.getObjectByName('ger-eave-band') as THREE.Mesh
    const crownCord = model.subject.getObjectByName('ger-crown-rim-cord') as THREE.Mesh
    const roll = model.subject.getObjectByName('ger-felt-roll') as THREE.Mesh

    assertFiniteAndOutwardNormals(roof)
    assertFiniteAndOutwardNormals(wall)
    assertFiniteAndOutwardNormals(eave)
    assertFiniteAndOutwardNormals(crownCord)
    assertFiniteAndOutwardNormals(roll, new THREE.Vector3(0, 0, 0))

    for (const y of [0.42, 0.97]) {
      const rope = model.subject.getObjectByName(`ger-tension-rope-${y}`) as THREE.Mesh
      assertFiniteAndOutwardNormals(rope)
      for (const side of ['left', 'right']) {
        const tie = model.subject.getObjectByName(`ger-belt-tie-${side}-${y}`) as THREE.Mesh
        assertFiniteAndOutwardNormals(tie)
      }
    }
    for (const angle of [-0.9, 0.9, Math.PI]) {
      const tie = model.subject.getObjectByName(`ger-roof-tie-${angle}`) as THREE.Mesh
      assertFiniteAndOutwardNormals(tie)
    }

    // Verify outer felt shell normals face radially outward across the roof and wall slopes.
    for (const [mesh, sampleCount] of [[roof, 16], [wall, 16]] as const) {
      const pos = mesh.geometry.getAttribute('position')
      const norm = mesh.geometry.getAttribute('normal')
      let radialPositive = 0
      let outerSamples = 0
      const ringVerts = (sampleCount + 1) * 2
      for (let i = 0; i <= 128; i += 8) {
        for (let r = 2; r <= sampleCount - 2; r += 3) {
          const idx = i * ringVerts + r
          const rx = pos.getX(idx)
          const rz = pos.getZ(idx)
          const dot = rx * norm.getX(idx) + rz * norm.getZ(idx)
          if (dot > 0) radialPositive++
          outerSamples++
        }
      }
      expect(radialPositive, `${mesh.name} outer radial normals`).toBe(outerSamples)
    }

    model.disposeTexture()
  })

  it('preserves open roof crown (>0.38), non-sagging structural felt seams, girth cinching, and baseline camera bounds', () => {
    const model = createGerModel()
    model.pose(1, 1, 1, 3)
    model.subject.updateMatrixWorld(true)

    const roof = model.subject.getObjectByName('ger-roof-felt') as THREE.Mesh
    const wall = model.subject.getObjectByName('ger-wall-felt') as THREE.Mesh
    const eave = model.subject.getObjectByName('ger-eave-band') as THREE.Mesh
    const roll = model.subject.getObjectByName('ger-felt-roll') as THREE.Mesh

    // Roof crown opening stays strictly > 0.38 and outer eave never inflates past 1.347.
    const rPos = roof.geometry.getAttribute('position')
    let minRoofR = Infinity
    let maxRoofR = 0
    for (let i = 0; i < rPos.count; i++) {
      const r = Math.hypot(rPos.getX(i), rPos.getZ(i))
      if (r < minRoofR) minRoofR = r
      if (r > maxRoofR) maxRoofR = r
    }
    expect(minRoofR).toBeGreaterThan(0.38)
    expect(maxRoofR).toBeLessThanOrEqual(1.346)

    const ePos = eave.geometry.getAttribute('position')
    let maxEaveR = 0
    for (let i = 0; i < ePos.count; i++) maxEaveR = Math.max(maxEaveR, Math.hypot(ePos.getX(i), ePos.getZ(i)))
    expect(maxEaveR).toBeLessThanOrEqual(1.3475)
    expect(maxEaveR).toBeGreaterThanOrEqual(1.3465)

    // Wall felt shows physical girth-band cinching at y=0.42/0.97 vs mid-panel y=0.69.
    const wPos = wall.geometry.getAttribute('position')
    const radiiAtY = (targetY: number) => {
      const vals: number[] = []
      const ringVerts = 34
      for (let i = 0; i <= 128; i++) {
        for (let r = 0; r <= 16; r++) {
          const idx = i * ringVerts + r
          if (Math.abs(wPos.getY(idx) - targetY) < 0.045) vals.push(Math.hypot(wPos.getX(idx), wPos.getZ(idx)))
        }
      }
      return vals.reduce((a, b) => a + b, 0) / vals.length
    }
    expect(radiiAtY(0.69) - radiiAtY(0.42)).toBeGreaterThan(0.002)
    expect(radiiAtY(0.69) - radiiAtY(0.97)).toBeGreaterThan(0.002)

    // Felt roll stays strictly inside baseline radius <= 0.1305 and |x| <= 0.405 so auto-fit camera never inflates.
    const rollBox = new THREE.Box3().setFromObject(roll)
    expect(rollBox.max.y).toBeLessThanOrEqual(2.262)
    expect(Math.max(Math.abs(rollBox.min.x), Math.abs(rollBox.max.x))).toBeLessThanOrEqual(0.406)

    model.disposeTexture()
  })

  it('advances felt drawRange smoothly through step 3 and gates binding ropes on cover >= 1', () => {
    const model = createGerModel()
    const roof = model.subject.getObjectByName('ger-roof-felt') as THREE.Mesh
    const wall = model.subject.getObjectByName('ger-wall-felt') as THREE.Mesh
    const ropes = model.subject.getObjectByName('ger-binding-ropes')!

    model.pose(1, 1, 0, 2)
    expect(roof.visible).toBe(false)
    expect(wall.visible).toBe(false)
    expect(ropes.visible).toBe(false)

    model.pose(1, 1, 0.5, 2)
    expect(roof.visible).toBe(true)
    expect(roof.geometry.drawRange.count).toBeGreaterThan(0)
    expect(roof.geometry.drawRange.count).toBeLessThan(roof.geometry.index!.count)
    expect(ropes.visible).toBe(false)

    model.pose(1, 1, 1, 3)
    expect(roof.geometry.drawRange.count).toBe(roof.geometry.index!.count)
    expect(wall.geometry.drawRange.count).toBe(wall.geometry.index!.count)
    expect(ropes.visible).toBe(true)

    model.disposeTexture()
  })

  it('disposes every owned procedural map and bumpMap exactly once and stays zero-WASM', () => {
    const model = createGerModel()
    const textures = new Set<THREE.Texture>()
    model.subject.traverse((o) => {
      const m = o as THREE.Mesh
      if (!m.isMesh) return
      const mats = Array.isArray(m.material) ? m.material : [m.material]
      for (const mat of mats) {
        const std = mat as THREE.MeshStandardMaterial
        if (std.map) textures.add(std.map)
        if (std.bumpMap) textures.add(std.bumpMap)
      }
    })
    expect(textures.size).toBeGreaterThanOrEqual(8)
    const counts = new Map<THREE.Texture, number>()
    textures.forEach((t) => t.addEventListener('dispose', () => counts.set(t, (counts.get(t) ?? 0) + 1)))
    model.disposeTexture()
    model.disposeTexture()
    expect(counts.size).toBe(textures.size)
    expect([...counts.values()].every((n) => n === 1)).toBe(true)

    const dir = path.dirname(fileURLToPath(import.meta.url))
    for (const file of ['model.ts', 'scene.ts']) {
      const source = fs.readFileSync(path.join(dir, file), 'utf8')
      expect(source).not.toMatch(/rapier|@dimforge|\.wasm/i)
    }
  })
})
