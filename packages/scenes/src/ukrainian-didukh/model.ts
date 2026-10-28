import * as THREE from 'three'
import { disposeTree } from '../procedural-kit'

/** An original wheat rendering; the gathering, ribbon motion and room are product staging. */
export function createDidukhModel() {
  const root = new THREE.Group()
  root.name = 'didukh-subject'
  const actor = new THREE.Group()
  actor.name = 'didukh-sheaf'
  root.add(actor)

  const straw = new THREE.MeshStandardMaterial({ color: 0xc99d4c, roughness: .86 })
  const stalkGold = new THREE.MeshStandardMaterial({ color: 0xddb65b, roughness: .84 })
  const grainGold = new THREE.MeshStandardMaterial({ color: 0xe8be64, roughness: .78 })
  const awnGold = new THREE.MeshStandardMaterial({ color: 0xd6a957, roughness: .9 })
  const blue = new THREE.MeshStandardMaterial({ color: 0x4c85a1, roughness: .76 })
  const coral = new THREE.MeshStandardMaterial({ color: 0xc87863, roughness: .8 })
  const wood = new THREE.MeshStandardMaterial({ color: 0xa77746, roughness: .89 })
  const trayWood = new THREE.MeshStandardMaterial({ color: 0xbe925b, roughness: .88 })
  const plaster = new THREE.MeshStandardMaterial({ color: 0xe8d6b6, roughness: .98 })
  const clay = new THREE.MeshStandardMaterial({ color: 0xd3b695, roughness: .98 })
  const baseboardWood = new THREE.MeshStandardMaterial({ color: 0x916d48, roughness: .93 })

  function add(parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const box = (name: string, w: number, h: number, d: number, material: THREE.Material, x: number, y: number, z: number) =>
    add(root, name, new THREE.BoxGeometry(w, h, d), material, x, y, z)

  // Horizontal cut faces give every splayed stalk an actual flat contact at y=0.
  // The side indices face outwards, and both ends are capped (unlike TubeGeometry).
  function closedStalk(points: [number, number, number][], radius: number) {
    const positions: number[] = [], indices: number[] = []
    const sides = 8
    for (const [x, y, z] of points) for (let i = 0; i < sides; i++) {
      const angle = i * Math.PI * 2 / sides
      positions.push(x + Math.cos(angle) * radius, y, z + Math.sin(angle) * radius)
    }
    for (let ring = 0; ring < points.length - 1; ring++) for (let i = 0; i < sides; i++) {
      const a = ring * sides + i, b = (ring + 1) * sides + i
      const c = ring * sides + (i + 1) % sides, d = (ring + 1) * sides + (i + 1) % sides
      indices.push(a, b, c, b, d, c)
    }
    const bottom = positions.length / 3
    positions.push(...points[0]!)
    const top = positions.length / 3
    positions.push(...points[points.length - 1]!)
    const lastRing = (points.length - 1) * sides
    for (let i = 0; i < sides; i++) {
      indices.push(bottom, i, (i + 1) % sides)
      indices.push(top, lastRing + (i + 1) % sides, lastRing + i)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }

  const grainGeometry = new THREE.SphereGeometry(1, 8, 6)
  const awnGeometry = new THREE.CylinderGeometry(.0022, .0032, 1, 5, 1, false)
  const connectorGeometry = new THREE.CylinderGeometry(.003, .003, 1, 5, 1, false)
  const transform = new THREE.Object3D()
  const up = new THREE.Vector3(0, 1, 0)
  function instanceBetween(mesh: THREE.InstancedMesh, index: number, a: THREE.Vector3, b: THREE.Vector3) {
    const direction = b.clone().sub(a)
    transform.position.copy(a).add(b).multiplyScalar(.5)
    transform.quaternion.setFromUnitVectors(up, direction.clone().normalize())
    transform.scale.set(1, direction.length(), 1)
    transform.updateMatrix()
    mesh.setMatrixAt(index, transform.matrix)
  }

  // Intact paired kernels sit beside the central rachis; short glumes join them.
  // Repeated kernels/awns use instances to keep the mobile draw count restrained.
  function wheatEar(index: number) {
    const ear = new THREE.Group()
    ear.name = `didukh-ear-${index}`
    add(ear, `${ear.name}-rachis`, closedStalk([[0, 0, 0], [0, .41, 0]], .008), stalkGold)
    const kernels = new THREE.InstancedMesh(grainGeometry, grainGold, 12)
    kernels.name = `${ear.name}-kernels`
    const awns = new THREE.InstancedMesh(awnGeometry, awnGold, 12)
    awns.name = `${ear.name}-awns`
    const glumes = new THREE.InstancedMesh(connectorGeometry, straw, 12)
    glumes.name = `${ear.name}-glumes`
    for (const mesh of [kernels, awns, glumes]) {
      mesh.castShadow = mesh.receiveShadow = true
      ear.add(mesh)
    }
    for (let row = 0; row < 6; row++) for (const [sideIndex, sign] of [-1, 1].entries()) {
      const i = row * 2 + sideIndex
      const taper = 1 - row * .035
      const y = .065 + row * .052
      const x = sign * .063 * taper
      transform.position.set(x, y, 0)
      transform.rotation.set(0, 0, -sign * .35)
      transform.scale.set(.025 * taper, .055 * taper, .025 * taper)
      transform.updateMatrix()
      kernels.setMatrixAt(i, transform.matrix)
      instanceBetween(glumes, i, new THREE.Vector3(sign * .008, y - .03, 0), new THREE.Vector3(sign * .041 * taper, y - .022, 0))
      instanceBetween(awns, i, new THREE.Vector3(sign * .080 * taper, y + .035, 0), new THREE.Vector3(sign * (.11 + row * .005), y + .19, -.008))
    }
    for (const mesh of [kernels, awns, glumes]) mesh.instanceMatrix.needsUpdate = true
    return ear
  }

  // Nine lower bundles form a real, broad standing base; no pedestal is hidden in it.
  for (let leg = 0; leg < 9; leg++) {
    const angle = leg * Math.PI * 2 / 9 + .16
    for (let strand = 0; strand < 3; strand++) {
      const spread = angle + (strand - 1) * .035
      const radius = .40 + strand * .012
      const footX = Math.cos(spread) * radius, footZ = Math.sin(spread) * radius
      const gatherX = Math.cos(spread) * (.055 + strand * .01), gatherZ = Math.sin(spread) * (.055 + strand * .01)
      add(actor, `didukh-leg-${leg}-stalk-${strand}`, closedStalk([
        [footX, 0, footZ], [footX * .76, .26, footZ * .76], [gatherX, .9, gatherZ],
      ], .009 + strand * .0008), strand === 1 ? stalkGold : straw)
    }
  }
  const upperStalks: { group: THREE.Group; x: number; z: number }[] = []
  for (let i = 0; i < 19; i++) {
    const angle = i * 2.39996323
    const radius = Math.sqrt((i + .5) / 19)
    const x = .43 * Math.cos(angle) * radius
    const z = .28 * Math.sin(angle) * radius
    const y = 1.64 + .24 * (1 - radius) + .035 * Math.sin(angle * 3)
    const gatherX = .065 * Math.cos(angle), gatherZ = .065 * Math.sin(angle)
    const upper = new THREE.Group()
    upper.name = `didukh-stalk-top-${i}`
    upper.position.set(gatherX, .9, gatherZ)
    actor.add(upper)
    const end: [number, number, number] = [x - gatherX, y - .9, z - gatherZ]
    add(upper, `didukh-upper-stem-${i}`, closedStalk([[0, 0, 0], [end[0] * .44, end[1] * .52, end[2] * .44], end], .008), i % 3 === 0 ? straw : stalkGold)
    const ear = wheatEar(i)
    ear.position.set(...end)
    ear.quaternion.setFromUnitVectors(up, new THREE.Vector3(x * .24, 1, z * .18).normalize())
    upper.add(ear)
    upperStalks.push({ group: upper, x: Math.sin(angle) * .045, z: -x * .50 })
  }

  // A thick, closed textile band wraps outside the gathered stalks.
  const bandGeometry = new THREE.LatheGeometry([
    new THREE.Vector2(.112, -.043), new THREE.Vector2(.13, -.043),
    new THREE.Vector2(.13, .043), new THREE.Vector2(.112, .043), new THREE.Vector2(.112, -.043),
  ], 32)
  const band = add(actor, 'didukh-blue-waist-band', bandGeometry, blue, 0, .9, 0)
  const knot = add(actor, 'didukh-coral-knot', grainGeometry, coral, 0, .9, .196)
  knot.scale.set(.055, .042, .027)

  function loopGeometry() {
    const vertices: number[] = [], indices: number[] = []
    const sides = 24
    // Front/back outer and inner rings, without a duplicated ellipse endpoint.
    for (const [radiusX, radiusY, z] of [[.115, .061, .007], [.079, .031, .007], [.115, .061, -.007], [.079, .031, -.007]]) {
      for (let i = 0; i < sides; i++) {
        const angle = i * Math.PI * 2 / sides
        vertices.push(Math.cos(angle) * radiusX!, Math.sin(angle) * radiusY!, z!)
      }
    }
    for (let i = 0; i < sides; i++) {
      const next = (i + 1) % sides
      const a = i, b = next, c = sides + i, d = sides + next
      const e = 2 * sides + i, f = 2 * sides + next, g = 3 * sides + i, h = 3 * sides + next
      indices.push(a, b, c, b, d, c, e, g, f, f, g, h)
      indices.push(a, e, b, e, f, b, c, d, g, d, h, g)
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }
  const loops = [-1, 1].map((sign, i) => {
    const loop = add(actor, `didukh-coral-bow-loop-${i}`, loopGeometry(), coral)
    return { loop, sign }
  })
  const tailShape = new THREE.Shape()
  tailShape.moveTo(-.026, 0)
  tailShape.lineTo(.026, 0)
  tailShape.lineTo(.034, -.26)
  tailShape.lineTo(0, -.235)
  tailShape.lineTo(-.034, -.26)
  tailShape.closePath()
  const tailGeometry = new THREE.ExtrudeGeometry(tailShape, { depth: .012, bevelEnabled: false, steps: 1 })
  const tails = [-1, 1].map((sign, i) => {
    const tail = add(actor, `didukh-coral-ribbon-tail-${i}`, tailGeometry, coral)
    tail.rotation.x = -.22
    return { tail, sign }
  })

  // Domestic lime/clay plaster and honey wood: original room, no sacred text or icons.
  box('didukh-honeywood-floor', 3.1, .12, 2.3, wood, 0, -.06, .05)
  box('didukh-lime-plaster-back', 3.1, 2.8, .12, plaster, 0, 1.4, -.91)
  box('didukh-clay-plaster-side', .12, 2.8, 1.5, clay, -1.49, 1.4, -.19)
  box('didukh-back-baseboard', 3.1, .105, .055, baseboardWood, 0, .0525, -.8225)
  box('didukh-side-baseboard', .055, .105, 1.5, baseboardWood, -1.4025, .0525, -.19)
  box('didukh-work-tray', 1.04, .1, 1.04, trayWood, -.5, .17, .5)
  for (const [i, x] of [-.86, -.14].entries()) box(`didukh-tray-foot-${i}`, .12, .12, .8, wood, x, .06, .5)

  const smooth = (value: number) => value * value * (3 - 2 * value)
  function pose(step: number, progress: number) {
    const index = THREE.MathUtils.clamp(Number.isFinite(step) ? Math.floor(step) : 0, 0, 3)
    const t = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1)
    const gather = smooth(index === 0 ? t : 1)
    const tie = smooth(index === 0 ? 0 : index === 1 ? t : 1)
    const placement = index < 2 ? 0 : index === 2 ? t : 1
    for (const { group, x, z } of upperStalks) group.rotation.set(x * (1 - gather), 0, z * (1 - gather))
    band.scale.set(1.4 - .4 * tie, 1, 1.4 - .4 * tie)
    const front = .196 - .052 * tie
    knot.position.z = front
    for (const { loop, sign } of loops) {
      loop.position.set(sign * (.14 - .035 * tie), .92, front - .003)
      loop.rotation.z = sign * (.72 - .80 * tie)
    }
    for (const { tail, sign } of tails) {
      tail.position.set(sign * (.058 - .017 * tie), .88, front + .015)
      tail.rotation.z = sign * (.40 - .20 * tie)
    }
    // Carry clear of the tray at constant height before lowering onto the floor.
    const carry = smooth(Math.min(placement / .64, 1))
    const lower = smooth(Math.max(0, (placement - .64) / .36))
    actor.position.set(-.5 + 1.05 * carry, .22 * (1 - lower), .5 - .58 * carry)
    root.updateMatrixWorld(true)
  }
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    // InstancedMesh owns instance buffers beyond its shared geometry/material.
    root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose() })
    disposeTree(root)
  }
  pose(0, 0)
  return {
    root, actor, pose, dispose,
    targets: [actor, actor, actor],
    roots: [actor, actor, actor],
    anchors: [[0, .9, .223], [0, .9, .223], [0, .9, .171]] as [number, number, number][],
  }
}
