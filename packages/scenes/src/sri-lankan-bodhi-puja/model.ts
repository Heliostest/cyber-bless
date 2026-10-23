import * as THREE from 'three'
import { disposeTree } from '../procedural-kit'

/** Generic temple tree and original pitcher/staging, not a particular sacred-tree monument. */
export function createBodhiPujaModel() {
  const root = new THREE.Group()
  root.name = 'bodhi-puja-subject'
  const actor = new THREE.Group()
  actor.name = 'bodhi-water-pitcher'
  root.add(actor)

  const bark = new THREE.MeshStandardMaterial({ color: 0xaaa995, roughness: .95 })
  const barkLight = new THREE.MeshStandardMaterial({ color: 0xbdbba7, roughness: .94 })
  const stone = new THREE.MeshStandardMaterial({ color: 0xc4baa1, roughness: .98 })
  const stoneShade = new THREE.MeshStandardMaterial({ color: 0xa89e87, roughness: .98 })
  const soil = new THREE.MeshStandardMaterial({ color: 0x93724f, roughness: 1 })
  const wetSoil = new THREE.MeshStandardMaterial({ color: 0x58432e, roughness: .92 })
  const clay = new THREE.MeshStandardMaterial({ color: 0xb76e47, roughness: .68 })
  const band = new THREE.MeshStandardMaterial({ color: 0xe1cfaa, roughness: .51 })
  const water = new THREE.MeshStandardMaterial({ color: 0x9bcbd0, roughness: .2, metalness: .03, transparent: true, opacity: .8 })
  const leaves = [0x668743, 0x79994a, 0x8caa58].map(color => new THREE.MeshStandardMaterial({ color, roughness: .77 }))
  const veinMaterial = new THREE.MeshStandardMaterial({ color: 0xa8b77b, roughness: .9 })

  function add(parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  function solid(positions: number[], indices: number[]) {
    // Normalize the winding once; every custom solid has a closed shell.
    let volume = 0
    for (let i = 0; i < indices.length; i += 3) {
      const a = indices[i]! * 3, b = indices[i + 1]! * 3, c = indices[i + 2]! * 3
      volume += positions[a]! * (positions[b + 1]! * positions[c + 2]! - positions[b + 2]! * positions[c + 1]!)
        + positions[a + 1]! * (positions[b + 2]! * positions[c]! - positions[b]! * positions[c + 2]!)
        + positions[a + 2]! * (positions[b]! * positions[c + 1]! - positions[b + 1]! * positions[c]!)
    }
    if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!]
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }
  function tube(points: [number, number, number][], radii: number[], sides = 10) {
    const positions: number[] = [], indices: number[] = []
    const path = points.map(point => new THREE.Vector3(...point))
    for (let ring = 0; ring < path.length; ring++) {
      const tangent = path[Math.min(ring + 1, path.length - 1)]!.clone().sub(path[Math.max(ring - 1, 0)]!).normalize()
      const u = new THREE.Vector3(0, 0, 1).cross(tangent).normalize()
      const v = tangent.clone().cross(u).normalize()
      for (let side = 0; side < sides; side++) {
        const angle = side * Math.PI * 2 / sides
        const point = path[ring]!.clone().addScaledVector(u, Math.cos(angle) * radii[ring]!).addScaledVector(v, Math.sin(angle) * radii[ring]!)
        positions.push(...point.toArray())
      }
    }
    for (let ring = 0; ring < path.length - 1; ring++) for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides, a = ring * sides + side, b = ring * sides + next
      const c = (ring + 1) * sides + side, d = (ring + 1) * sides + next
      indices.push(a, b, c, b, d, c)
    }
    const bottom = positions.length / 3
    positions.push(...points[0]!)
    const top = positions.length / 3
    positions.push(...points[points.length - 1]!)
    const last = (path.length - 1) * sides
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      indices.push(bottom, next, side, top, last + side, last + next)
    }
    return solid(positions, indices)
  }
  function brick(start: number, end: number) {
    const points = [[.79, start], [.95, start], [.95, end], [.79, end]].map(([radius, angle]) => [
      .28 + radius! * Math.cos(angle!), -.25 + radius! * Math.sin(angle!),
    ])
    const positions: number[] = [], indices: number[] = []
    for (const y of [0, .28]) for (const [x, z] of points) positions.push(x!, y, z!)
    indices.push(0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6)
    for (let i = 0; i < 4; i++) {
      const next = (i + 1) % 4
      indices.push(i, i + 4, next, next, i + 4, next + 4)
    }
    return solid(positions, indices)
  }

  // All masonry and both pitcher perches actually meet this paving slab at y=0.
  add(root, 'bodhi-flagstone-slab', new THREE.BoxGeometry(3.3, .14, 2.4), stoneShade, 0, -.07, 0)
  add(root, 'bodhi-initial-perch', new THREE.BoxGeometry(.65, .12, .66), stone, -1.12, .06, .18)
  add(root, 'bodhi-destination-perch', new THREE.BoxGeometry(.65, .12, .64), stone, -.88, .06, .87)
  add(root, 'bodhi-exposed-root-soil', new THREE.CylinderGeometry(.79, .79, .17, 48), soil, .28, .085, -.25)
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    add(root, `bodhi-enclosure-stone-${i}`, brick(angle + .007, angle + Math.PI / 4 - .007), i % 2 ? stone : stoneShade)
  }
  const damp = add(root, 'bodhi-damp-soil', new THREE.CylinderGeometry(.22, .22, .006, 32), wetSoil, .07, .173, .26)
  damp.scale.z = .72

  add(root, 'bodhi-pale-forked-trunk', tube([[.28, .17, -.25], [.22, .83, -.24], [.22, 1.39, -.27], [.05, 1.84, -.28]], [.145, .105, .074, .031]), bark)
  add(root, 'bodhi-trunk-fork-right', tube([[.22, 1.05, -.25], [.40, 1.56, -.22], [.63, 1.98, -.25]], [.074, .056, .026]), barkLight)
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7 + .2
    const radius = .50 + .08 * Math.sin(i * 2)
    add(root, `bodhi-visible-root-${i}`, tube([
      [.28, .35, -.25], [.28 + Math.cos(angle) * .23, .205, -.25 + Math.sin(angle) * .23],
      [.28 + Math.cos(angle) * radius, .184, -.25 + Math.sin(angle) * radius],
    ], [.067, .037, .012]), i % 2 ? bark : barkLight)
  }

  // Cordate bases and conspicuously long, slender drip tips are solid thin leaves.
  const leafShape = new THREE.Shape()
  leafShape.moveTo(0, .115)
  leafShape.bezierCurveTo(-.055, .205, -.145, .165, -.135, .055)
  leafShape.bezierCurveTo(-.13, -.075, -.067, -.17, -.025, -.265)
  leafShape.lineTo(0, -.445)
  leafShape.lineTo(.025, -.265)
  leafShape.bezierCurveTo(.067, -.17, .13, -.075, .135, .055)
  leafShape.bezierCurveTo(.145, .165, .055, .205, 0, .115)
  const leafGeometry = new THREE.ExtrudeGeometry(leafShape, { depth: .009, bevelEnabled: false, curveSegments: 8, steps: 1 })
  const leafBatches = leaves.map((material, i) => {
    const mesh = new THREE.InstancedMesh(leafGeometry, material, 48)
    mesh.name = `bodhi-cordate-drip-tip-leaves-${i}`
    mesh.castShadow = mesh.receiveShadow = true
    root.add(mesh)
    return mesh
  })
  const veinGeometry = new THREE.CylinderGeometry(.0028, .0028, 1, 5)
  const veins = new THREE.InstancedMesh(veinGeometry, veinMaterial, 144)
  veins.name = 'bodhi-leaf-midribs'
  root.add(veins)
  const petioles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.004, .004, 1, 6), barkLight, 144)
  petioles.name = 'bodhi-attached-leaf-petioles'
  petioles.castShadow = petioles.receiveShadow = true
  root.add(petioles)
  const petioleTransform = new THREE.Object3D()
  const leafBase = new THREE.Vector3()
  const petioleDirection = new THREE.Vector3()
  const transform = new THREE.Object3D()
  const up = new THREE.Vector3(0, 1, 0)
  const veinTransform = new THREE.Object3D()
  veinTransform.position.set(0, -.09, .011)
  veinTransform.scale.set(1, .37, 1)
  veinTransform.updateMatrix()
  for (let branch = 0; branch < 12; branch++) {
    const angle = branch * Math.PI * 2 / 12 + .11
    const reach = .77 + .10 * Math.sin(branch * 2.1)
    const x = .28 + Math.cos(angle) * reach
    const y = 2.35 + .25 * Math.sin(branch * 1.7)
    const z = -.25 + Math.sin(angle) * .53
    const fork: [number, number, number] = branch % 2 ? [.38, 1.58, -.24] : [.06, 1.76, -.28]
    add(root, `bodhi-canopy-branch-${branch}`, tube([fork, [.28 + Math.cos(angle) * .47, y - .22, -.25 + Math.sin(angle) * .33], [x, y, z]], [.032, .019, .008], 8), bark)
    for (let leaf = 0; leaf < 12; leaf++) {
      const leafAngle = leaf * 2.39996323 + branch * .45
      const spread = .10 + .18 * Math.sqrt((leaf + .5) / 12)
      const px = x + Math.cos(leafAngle) * spread
      const py = y + .12 + .13 * Math.sin(leafAngle * 1.4)
      const pz = z + Math.sin(leafAngle) * spread * .8
      transform.position.set(px, py, pz)
      transform.rotation.set(-.14 + .28 * Math.sin(leafAngle), .58 * Math.sin(leafAngle + branch), .40 * Math.cos(leafAngle))
      const scale = .69 + .12 * Math.sin(leaf * 1.7 + branch)
      transform.scale.setScalar(scale)
      transform.updateMatrix()
      const index = branch * 12 + leaf
      leafBatches[index % 3]!.setMatrixAt(Math.floor(index / 3), transform.matrix)
      veins.setMatrixAt(index, transform.matrix.clone().multiply(veinTransform.matrix))
      leafBase.set(0, .115, .0045).applyMatrix4(transform.matrix)
      petioleDirection.copy(leafBase).sub(new THREE.Vector3(x, y, z))
      petioleTransform.position.set(x, y, z).add(leafBase).multiplyScalar(.5)
      petioleTransform.quaternion.setFromUnitVectors(up, petioleDirection.clone().normalize())
      petioleTransform.scale.set(1, petioleDirection.length(), 1)
      petioleTransform.updateMatrix()
      petioles.setMatrixAt(index, petioleTransform.matrix)
    }
  }
  for (const mesh of [...leafBatches, veins, petioles]) mesh.instanceMatrix.needsUpdate = true

  // A watertight ceramic shell has an interior floor, inner wall, rounded belly,
  // open neck, and an integral extended pouring lip. No disk seals the opening.
  function pitcherShell() {
    const profile = [[.18, 0], [.245, .06], [.30, .19], [.305, .32], [.265, .47], [.17, .57], [.165, .65], [.132, .65], [.137, .585], [.235, .47], [.273, .31], [.267, .19], [.213, .09], [.15, .055]]
    const positions: number[] = [], indices: number[] = [], sides = 48
    for (let ring = 0; ring < profile.length; ring++) for (let side = 0; side < sides; side++) {
      const angle = side * Math.PI * 2 / sides
      const [radius, y] = profile[ring]!
      const lip = ring >= 5 && ring <= 8 ? .105 * Math.pow(Math.max(0, Math.cos(angle)), 12) * (ring === 5 || ring === 8 ? .35 : 1) : 0
      positions.push((radius! + lip) * Math.cos(angle), y!, (radius! + lip) * Math.sin(angle))
    }
    for (let ring = 0; ring < profile.length - 1; ring++) for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides, a = ring * sides + side, b = ring * sides + next, c = (ring + 1) * sides + side, d = (ring + 1) * sides + next
      indices.push(a, b, c, b, d, c)
    }
    const outerBottom = positions.length / 3
    positions.push(0, 0, 0)
    const innerBottom = positions.length / 3
    positions.push(0, .055, 0)
    const last = (profile.length - 1) * sides
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      indices.push(outerBottom, next, side, innerBottom, last + side, last + next)
    }
    return solid(positions, indices)
  }
  add(actor, 'bodhi-pitcher-closed-wall-and-interior', pitcherShell(), clay)
  const handle = add(actor, 'bodhi-pitcher-closed-handle', new THREE.TorusGeometry(.158, .035, 8, 32), clay, -.292, .343, 0)
  handle.scale.set(1, 1.26, .88)
  const glaze = add(actor, 'bodhi-pitcher-original-glaze-band', new THREE.TorusGeometry(.306, .009, 6, 48), band, 0, .29, 0)
  glaze.rotation.x = Math.PI / 2
  const spout = new THREE.Object3D()
  spout.name = 'bodhi-pitcher-pour-lip-origin'
  spout.position.set(.255, .65, 0)
  actor.add(spout)
  const liquid = add(actor, 'bodhi-pitcher-water-level', new THREE.CylinderGeometry(.118, .118, .008, 32), water)
  liquid.castShadow = false

  const impact = new THREE.Object3D()
  impact.name = 'bodhi-soil-water-impact'
  impact.position.set(.07, .176, .26)
  root.add(impact)
  const stream = new THREE.Group()
  stream.name = 'bodhi-water-stream'
  root.add(stream)
  const streamGeometry = new THREE.CylinderGeometry(1, 1, 1, 8)
  const segments = Array.from({ length: 16 }, (_, i) => {
    const mesh = add(stream, `bodhi-water-stream-segment-${i}`, streamGeometry, water)
    mesh.castShadow = false
    return mesh
  })
  const splashGeometry = new THREE.SphereGeometry(1, 8, 6)
  const splashes = Array.from({ length: 6 }, (_, i) => {
    const angle = i * Math.PI * 2 / 6
    const mesh = add(stream, `bodhi-water-contact-${i}`, splashGeometry, water, .07 + Math.cos(angle) * .035, .182, .26 + Math.sin(angle) * .024)
    mesh.scale.set(.025, .006, .012)
    mesh.castShadow = false
    return mesh
  })
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const phase = (t: number, start: number, end: number) => smooth(THREE.MathUtils.clamp((t - start) / (end - start), 0, 1))
  const from = new THREE.Vector3(), to = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3()
  const waterPoint = (t: number, output: THREE.Vector3) => { output.copy(from).lerp(to, t); output.x += .08 * Math.sin(t * Math.PI); return output }
  function pose(step: number, progress: number) {
    const index = THREE.MathUtils.clamp(Number.isFinite(step) ? Math.floor(step) : 0, 0, 3)
    const t = THREE.MathUtils.clamp(Number.isFinite(progress) ? progress : 0, 0, 1)
    const lift = smooth(index === 0 ? t : 1)
    const carry = smooth(index < 1 ? 0 : index === 1 ? t : 1)
    const pour = index < 2 ? 0 : index === 2 ? t : 1
    const tilt = phase(pour, .04, .23) * (1 - phase(pour, .62, .76))
    const drained = phase(pour, .23, .62)
    const settleCarry = phase(pour, .76, .86)
    const lower = phase(pour, .86, 1)
    actor.position.set(-1.12 + .38 * carry - .14 * settleCarry, .12 + .74 * lift - .74 * lower, .18 + .20 * carry + .49 * settleCarry)
    actor.rotation.set(0, 0, tilt ? -1.10 * tilt : 0)
    liquid.position.set(0, .535 - .295 * drained, 0)
    // The visible meniscus stays horizontal in world space while the pot tips.
    liquid.quaternion.copy(actor.quaternion).invert()
    liquid.userData.remainingFraction = 1 - .68 * drained
    damp.visible = drained > 0
    damp.scale.set(.25 + .75 * drained, 1, (.25 + .75 * drained) * .72)
    const flow = tilt > .88 && pour > .23 && pour < .62
    stream.visible = flow
    root.updateMatrixWorld(true)
    spout.getWorldPosition(from)
    impact.getWorldPosition(to)
    for (let i = 0; i < segments.length; i++) {
      waterPoint(i / segments.length, a)
      waterPoint((i + 1) / segments.length, b)
      direction.copy(b).sub(a)
      const mesh = segments[i]!
      mesh.position.copy(a).add(b).multiplyScalar(.5)
      const length = direction.length()
      mesh.quaternion.setFromUnitVectors(up, direction.normalize())
      mesh.scale.set(.013 - .003 * i / segments.length, length, .013 - .003 * i / segments.length)
    }
    for (const mesh of splashes) mesh.visible = flow
    root.updateMatrixWorld(true)
  }
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose() })
    disposeTree(root)
  }
  pose(0, 0)
  return {
    root, actor, pose, dispose,
    targets: [actor, actor, actor],
    roots: [actor, actor, actor],
    anchors: [[0, .30, .30], [0, .30, .30], [0, .30, .30]] as [number, number, number][],
  }
}
