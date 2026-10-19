import * as THREE from 'three'
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js'

/** Original plain hand bellows; leather is a thin sheet, air is an illustration. */
export function createBellowsModel() {
  const subject = new THREE.Group(); subject.name = 'bellows-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xaf794d, roughness: .76 })
  const handleWood = new THREE.MeshStandardMaterial({ color: 0xd3a06c, roughness: .79 })
  const hide = new THREE.MeshStandardMaterial({ color: 0x684b3d, roughness: .94, side: THREE.DoubleSide })
  const brass = new THREE.MeshStandardMaterial({ color: 0xb79654, metalness: .55, roughness: .4 })
  const grain = new THREE.MeshStandardMaterial({ color: 0x91664d, roughness: .9 })
  const contour = Array.from({ length: 64 }, (_, i) => {
    const t = i * Math.PI * 2 / 64
    return new THREE.Vector2(Math.min(2.04, 1.1 - 1.05 * Math.cos(t)), .78 * Math.sin(t) * (.45 + .275 * (1 - Math.cos(t))))
  })
  const boardShape = new THREE.Shape(contour)
  const board = new THREE.ExtrudeGeometry(boardShape, { depth: .14, bevelEnabled: false, steps: 1 })
  board.rotateX(Math.PI / 2); board.translate(0, .14, 0)
  const handleShape = new THREE.Shape()
  handleShape.moveTo(-.46, -.13); handleShape.lineTo(.44, -.13)
  handleShape.quadraticCurveTo(.55, -.13, .55, 0); handleShape.quadraticCurveTo(.55, .13, .44, .13)
  handleShape.lineTo(-.46, .13); handleShape.closePath()
  const handleGeometry = new THREE.ExtrudeGeometry(handleShape, { depth: .14, bevelEnabled: false, curveSegments: 5 })
  handleGeometry.rotateX(Math.PI / 2); handleGeometry.translate(0, .14, 0)
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, parent: THREE.Object3D) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const lower = new THREE.Group(); lower.name = 'bellows-lower-leaf'; lower.position.set(-1.25, .02, 0); subject.add(lower)
  const joint = new THREE.Group(); joint.name = 'bellows-upper-joint'; joint.position.set(-1.25, .26, 0); subject.add(joint)
  mesh('bellows-lower-board', board, wood, lower)
  mesh('bellows-upper-board', board, wood, joint)
  mesh('bellows-lower-handle', handleGeometry, handleWood, lower).position.x = 2.5
  const handle = mesh('bellows-upper-handle', handleGeometry, handleWood, joint); handle.position.x = 2.5
  const studGeometry = new THREE.SphereGeometry(.026, 8, 6)
  for (const [leaf, name] of [[lower, 'lower'], [joint, 'upper']] as const) {
    for (let i = 3; i < 64; i += 4) {
      const p = contour[i]!, s = mesh(`bellows-${name}-stud-${i}`, studGeometry, brass, leaf)
      s.position.set(1.1 + (p.x - 1.1) * .91, .146, p.y * .91); s.scale.y = .45
    }
    for (let i = 0; i < 4; i++) {
      const z = (i - 1.5) * .14
      const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(.36, .143, z * .6), new THREE.Vector3(.8, .143, z), new THREE.Vector3(1.35, .143, z + .025), new THREE.Vector3(1.78, .143, z * .65)])
      mesh(`bellows-${name}-grain-${i}`, new THREE.TubeGeometry(curve, 12, .004, 4, false), grain, leaf)
    }
  }
  const leatherGeometry = new THREE.BufferGeometry(), positions = new Float32Array(64 * 11 * 3), indices: number[] = []
  // Leave the nozzle-side arc open; an annular throat below joins it to the tube.
  for (let row = 0; row < 8; row++) for (let i = 6; i < 58; i++) {
    const a = row * 64 + i, b = row * 64 + (i + 1) % 64, c = a + 64, d = b + 64
    indices.push(a, b, c, b, d, c)
  }
  for (let i = 0; i < 64; i++) { const a = 576 + i, b = 576 + (i + 1) % 64, c = a + 64, d = b + 64; indices.push(a, b, c, b, d, c) }
  leatherGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); leatherGeometry.setIndex(indices)
  const leather = mesh('bellows-leather-gusset', leatherGeometry, hide, subject)
  // The neck is flattened to fit between the leaves; both annular ends stay open.
  const profile = [[-.94, .065, .065], [-.94, .102, .102], [.05, .03, .12], [.15, .03, .12], [.15, .021, .098], [.05, .021, .098]], tubePositions: number[] = [], tubeIndices: number[] = []
  for (const [x, ry, rz] of profile) for (let i = 0; i < 64; i++) { const a = i * Math.PI / 32; tubePositions.push(x!, ry! * Math.cos(a), rz! * Math.sin(a)) }
  for (let ring = 0; ring < profile.length; ring++) for (let i = 0; i < 64; i++) {
    const a = ring * 64 + i, b = ring * 64 + (i + 1) % 64, c = ((ring + 1) % profile.length) * 64 + i, d = ((ring + 1) % profile.length) * 64 + (i + 1) % 64
    tubeIndices.push(a, b, c, b, d, c)
  }
  const tube = new THREE.BufferGeometry(); tube.setAttribute('position', new THREE.Float32BufferAttribute(tubePositions, 3)); tube.setIndex(tubeIndices)
  const creasedTube = toCreasedNormals(tube, .7); if (creasedTube !== tube) tube.dispose()
  const nozzle = mesh('bellows-brass-nozzle', creasedTube, brass, subject); nozzle.position.set(-1.25, .23, 0)
  const air = new THREE.Group(); air.name = 'bellows-air-illustration'; air.position.set(-2.19, .23, 0); subject.add(air)
  const airMaterial = new THREE.MeshStandardMaterial({ color: 0xe0eee4, transparent: true, opacity: 0, roughness: .9, depthWrite: false })
  for (let i = 0; i < 3; i++) {
    const z = (i - 1) * .08
    const curve = new THREE.CatmullRomCurve3([new THREE.Vector3(-.02, 0, z), new THREE.Vector3(-.3, .04 + i * .015, z * 1.2), new THREE.Vector3(-.62, .08, z * 1.9), new THREE.Vector3(-.9, .14 + i * .02, z * 2.4)])
    mesh('bellows-air-line-' + i, new THREE.TubeGeometry(curve, 16, .009, 4, false), airMaterial, air).castShadow = false
  }
  const angles = [.08, .38, .07, .16]
  const pose = (step: number, amount: number) => {
    const at = THREE.MathUtils.clamp(Math.floor(Number.isFinite(step) ? step : 0), 0, 3), n = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
    const angle = THREE.MathUtils.lerp(angles[at]!, angles[Math.min(at + 1, 3)]!, n), c = Math.cos(angle), s = Math.sin(angle)
    joint.rotation.z = angle
    const fold = .07 * (1 - .6 * ((angle - .07) / .31))
    for (let row = 0; row < 9; row++) {
      const v = row / 8, swell = fold * Math.sin(2 * Math.PI * v) ** 2
      for (let i = 0; i < 64; i++) {
        const p = contour[i]!, x = THREE.MathUtils.lerp(p.x, p.x * c, v) - 1.25, y = THREE.MathUtils.lerp(.16, .26 + p.x * s, v)
        positions.set([x, y, p.y + swell * p.y / .78], (row * 64 + i) * 3)
      }
    }
    // Parameterise a cloth annulus around the actual 64-sided brass neck.
    // Its outside follows the open grid boundary; its inside never fills the bore.
    const outer: THREE.Vector3[] = [], add = (row: number, i: number) => outer.push(new THREE.Vector3().fromArray(positions, (row * 64 + i) * 3))
    for (let i = 58; i < 70; i++) add(0, i % 64); add(0, 6)
    for (let row = 1; row <= 8; row++) add(row, 6)
    for (let i = 5; i >= -6; i--) add(8, (i + 64) % 64)
    for (let row = 7; row >= 1; row--) add(row, 58)
    for (let i = 0; i < 64; i++) {
      const a = i * Math.PI / 32, dy = .03 * Math.cos(a), dz = .12 * Math.sin(a)
      let nearest = Infinity, boundary = new THREE.Vector3()
      for (let j = 0; j < outer.length; j++) {
        const p = outer[j]!, q = outer[(j + 1) % outer.length]!, ey = q.y - p.y, ez = q.z - p.z, ay = p.y - .23, az = p.z, den = dy * ez - dz * ey
        if (Math.abs(den) < 1e-12) continue
        const t = (ay * ez - az * ey) / den, u = (ay * dz - az * dy) / den
        if (t >= 1 && t < nearest && u >= -1e-8 && u <= 1 + 1e-8) { nearest = t; boundary = p.clone().lerp(q, THREE.MathUtils.clamp(u, 0, 1)) }
      }
      if (!Number.isFinite(nearest)) throw new Error('Bellows throat boundary does not enclose neck')
      positions.set([-1.2, .23 + dy, dz], (576 + i) * 3); positions.set(boundary.toArray(), (640 + i) * 3)
    }
    leatherGeometry.attributes.position!.needsUpdate = true; leatherGeometry.computeVertexNormals(); leatherGeometry.computeBoundingSphere()
    const pulse = at === 1 && n > 0 && n < 1 ? Math.sin(Math.PI * n) : 0
    air.visible = pulse > 0; air.scale.set(.4 + .6 * pulse, 1, 1); airMaterial.opacity = .6 * pulse
    subject.updateMatrixWorld(true)
  }
  pose(0, 0)
  return { subject, lower, joint, handle, leather, nozzle, air, pose, targets: [handle, handle, handle], roots: [joint, joint, joint], anchors: [[0, .16, 0], [0, .16, 0], [0, .16, 0]] as [number, number, number][] }
}
