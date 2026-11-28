import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createLivingPourStream, createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import * as THREE from 'three'
import { addSteppedPedestal } from '../cozy-furniture'
import { disposeTree } from '../procedural-kit'
import {
  applyBodhiBarkShading,
  bodhiLeafInstanceColor,
  createBodhiBarkMaterials,
  createBodhiLeafGeometry,
  createBodhiLeafMaterials,
  createBodhiSoilMaterial,
} from './bodhi-materials'

/** Generic temple tree and original pitcher/staging, not a particular sacred-tree monument. */
export function createBodhiPujaModel() {
  const root = new THREE.Group()
  root.name = 'bodhi-puja-subject'
  const actor = new THREE.Group()
  actor.name = 'bodhi-water-pitcher'
  root.add(actor)

  const { bark, barkLight } = createBodhiBarkMaterials()
  const petioleMaterial = new THREE.MeshStandardMaterial({ color: 0xaab484, roughness: .88 })
  const stone = new THREE.MeshStandardMaterial({ color: 0xc4baa1, roughness: .98 })
  const stoneShade = new THREE.MeshStandardMaterial({ color: 0xa89e87, roughness: .98 })
  const soil = createBodhiSoilMaterial()
  const wetSoil = new THREE.MeshPhysicalMaterial({
    color: 0x4f3b27,
    roughness: 0.42,
    metalness: 0,
    clearcoat: 0.36,
    clearcoatRoughness: 0.28,
  })
  const clay = new THREE.MeshStandardMaterial({ color: 0xb76e47, roughness: .68 })
  const band = new THREE.MeshStandardMaterial({ color: 0xe1cfaa, roughness: .51 })
  applyCraftSurface(clay, { kind: 'ceramic', strength: .45 })
  applyCraftSurface(band, { kind: 'ceramic', strength: .45 })
  applyCraftSurface(stone, { kind: 'stone', strength: .4 })
  applyCraftSurface(stoneShade, { kind: 'stone', strength: .4 })

  const leaves = createBodhiLeafMaterials()

  function add(parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  function solid(positions: number[], indices: number[], uvs?: number[]) {
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
    if (uvs) geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    geometry.setIndex(indices)
    geometry.computeVertexNormals()
    return geometry
  }
  function tube(points: [number, number, number][], radii: number[], sides = 10, shadeKind?: 'trunk' | 'root' | 'branch') {
    const positions: number[] = [], uvs: number[] = [], indices: number[] = []
    const path = points.map(point => new THREE.Vector3(...point))
    const lengths: number[] = [0]
    for (let i = 1; i < path.length; i++) lengths.push(lengths[i - 1]! + path[i]!.distanceTo(path[i - 1]!))
    const totalLength = Math.max(lengths[lengths.length - 1]!, 1e-4)
    for (let ring = 0; ring < path.length; ring++) {
      const tangent = path[Math.min(ring + 1, path.length - 1)]!.clone().sub(path[Math.max(ring - 1, 0)]!).normalize()
      const u = new THREE.Vector3(0, 0, 1).cross(tangent).normalize()
      const v = tangent.clone().cross(u).normalize()
      const texV = lengths[ring]! / totalLength
      for (let side = 0; side < sides; side++) {
        const angle = side * Math.PI * 2 / sides
        const point = path[ring]!.clone().addScaledVector(u, Math.cos(angle) * radii[ring]!).addScaledVector(v, Math.sin(angle) * radii[ring]!)
        positions.push(...point.toArray())
        // Symmetric triangle-wave U prevents UV wrap seams without duplicating manifold vertices.
        uvs.push(1 - Math.abs((side / sides) * 2 - 1), texV)
      }
    }
    for (let ring = 0; ring < path.length - 1; ring++) for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides, a = ring * sides + side, b = ring * sides + next
      const c = (ring + 1) * sides + side, d = (ring + 1) * sides + next
      indices.push(a, b, c, b, d, c)
    }
    const bottom = positions.length / 3
    positions.push(...points[0]!)
    uvs.push(0.5, 0)
    const top = positions.length / 3
    positions.push(...points[points.length - 1]!)
    uvs.push(0.5, 1)
    const last = (path.length - 1) * sides
    for (let side = 0; side < sides; side++) {
      const next = (side + 1) % sides
      indices.push(bottom, next, side, top, last + side, last + next)
    }
    const geometry = solid(positions, indices, uvs)
    if (shadeKind) applyBodhiBarkShading(geometry, shadeKind)
    return geometry
  }
  const GROUND_Y = -.132
  function brick(start: number, end: number) {
    // Chamfered closed masonry curb stone extending cleanly down to garden surface (-0.132).
    const layers: readonly [number, number, number, number][] = [
      [GROUND_Y, .802, .938, .012],
      [GROUND_Y + .016, .79, .95, 0],
      [.264, .79, .95, 0],
      [.28, .804, .936, .014],
    ]
    const positions: number[] = [], indices: number[] = []
    for (const [y, rIn, rOut, inset] of layers) {
      const a0 = start + inset, a1 = end - inset
      const ring = [[rIn, a0], [rOut, a0], [rOut, a1], [rIn, a1]] as const
      for (const [radius, angle] of ring) {
        positions.push(.28 + radius * Math.cos(angle), y, -.25 + radius * Math.sin(angle))
      }
    }
    // Bottom & top caps.
    indices.push(0, 1, 2, 0, 2, 3)
    const top = (layers.length - 1) * 4
    indices.push(top, top + 2, top + 1, top, top + 3, top + 2)
    // Side walls between successive beveled rings.
    for (let ring = 0; ring < layers.length - 1; ring++) {
      const a = ring * 4, b = (ring + 1) * 4
      for (let i = 0; i < 4; i++) {
        const next = (i + 1) % 4
        indices.push(a + i, b + i, a + next, a + next, b + i, b + next)
      }
    }
    return solid(positions, indices)
  }

  // Ground both stepped stone pitcher perches and the chamfered tree-well curb directly on garden sand (-0.132).
  const initialPerch = addSteppedPedestal(root, {
    name: 'bodhi-initial-perch',
    topName: 'bodhi-initial-perch-top',
    shape: 'rect',
    kind: 'stone',
    color: 0xc4baa1,
    trimColor: 0xa89e87,
    center: [-1.12, .18],
    groundY: GROUND_Y,
    surfaceY: .12,
    tiers: [
      { width: .65, depth: .66, height: .086, color: 0xa89e87 },
      { width: .59, depth: .60, height: .114, color: 0xbeb399 },
      { width: .62, depth: .63, height: .052, color: 0xc4baa1 },
    ],
  })
  initialPerch.root.name = 'bodhi-initial-perch'

  const destPerch = addSteppedPedestal(root, {
    name: 'bodhi-destination-perch',
    topName: 'bodhi-destination-perch-top',
    shape: 'rect',
    kind: 'stone',
    color: 0xc4baa1,
    trimColor: 0xa89e87,
    center: [-.88, .87],
    groundY: GROUND_Y,
    surfaceY: .12,
    tiers: [
      { width: .65, depth: .64, height: .086, color: 0xa89e87 },
      { width: .59, depth: .58, height: .114, color: 0xbeb399 },
      { width: .62, depth: .61, height: .052, color: 0xc4baa1 },
    ],
  })
  destPerch.root.name = 'bodhi-destination-perch'

  const soilHeight = .17 - GROUND_Y
  add(root, 'bodhi-exposed-root-soil', new THREE.CylinderGeometry(.79, .79, soilHeight, 48), soil, .28, GROUND_Y + soilHeight / 2, -.25)
  for (let i = 0; i < 8; i++) {
    const angle = i * Math.PI / 4
    add(root, `bodhi-enclosure-stone-${i}`, brick(angle + .007, angle + Math.PI / 4 - .007), i % 2 ? stone : stoneShade)
  }
  const damp = add(root, 'bodhi-damp-soil', new THREE.CylinderGeometry(.22, .22, .006, 32), wetSoil, .07, .173, .26)
  damp.scale.z = .72

  add(root, 'bodhi-pale-forked-trunk', tube([[.28, .17, -.25], [.22, .83, -.24], [.22, 1.39, -.27], [.05, 1.84, -.28]], [.145, .105, .074, .031], 10, 'trunk'), bark)
  add(root, 'bodhi-trunk-fork-right', tube([[.22, 1.05, -.25], [.40, 1.56, -.22], [.63, 1.98, -.25]], [.074, .056, .026], 10, 'trunk'), barkLight)
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI * 2 / 7 + .2
    const radius = .50 + .08 * Math.sin(i * 2)
    add(root, `bodhi-visible-root-${i}`, tube([
      [.28, .35, -.25], [.28 + Math.cos(angle) * .23, .205, -.25 + Math.sin(angle) * .23],
      [.28 + Math.cos(angle) * radius, .184, -.25 + Math.sin(angle) * radius],
    ], [.067, .037, .012], 10, 'root'), i % 2 ? bark : barkLight)
  }

  // Gently arched, midrib-folded watertight cordate leaves with slender drip tips and textured veins.
  const leafGeometry = createBodhiLeafGeometry()
  const leafBatches = leaves.map((material, i) => {
    const mesh = new THREE.InstancedMesh(leafGeometry, material, 48)
    mesh.name = `bodhi-cordate-drip-tip-leaves-${i}`
    mesh.castShadow = mesh.receiveShadow = true
    root.add(mesh)
    return mesh
  })
  const petioles = new THREE.InstancedMesh(new THREE.CylinderGeometry(.004, .004, 1, 6), petioleMaterial, 144)
  petioles.name = 'bodhi-attached-leaf-petioles'
  petioles.castShadow = petioles.receiveShadow = true
  root.add(petioles)
  const petioleTransform = new THREE.Object3D()
  const leafBase = new THREE.Vector3()
  const petioleDirection = new THREE.Vector3()
  const transform = new THREE.Object3D()
  const up = new THREE.Vector3(0, 1, 0)
  const leafTint = new THREE.Color()
  for (let branch = 0; branch < 12; branch++) {
    const angle = branch * Math.PI * 2 / 12 + .11
    const reach = .77 + .10 * Math.sin(branch * 2.1)
    const x = .28 + Math.cos(angle) * reach
    const y = 2.35 + .25 * Math.sin(branch * 1.7)
    const z = -.25 + Math.sin(angle) * .53
    const fork: [number, number, number] = branch % 2 ? [.38, 1.58, -.24] : [.06, 1.76, -.28]
    add(root, `bodhi-canopy-branch-${branch}`, tube([fork, [.28 + Math.cos(angle) * .47, y - .22, -.25 + Math.sin(angle) * .33], [x, y, z]], [.032, .019, .008], 8, 'branch'), bark)
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
      const batch = leafBatches[index % 3]!
      const slot = Math.floor(index / 3)
      batch.setMatrixAt(slot, transform.matrix)
      const heightNorm = THREE.MathUtils.clamp((py - 2.15) / 0.72, 0, 1)
      batch.setColorAt(slot, bodhiLeafInstanceColor(branch, leaf, heightNorm, leafTint))
      leafBase.set(0, .115, .0045).applyMatrix4(transform.matrix)
      petioleDirection.copy(leafBase).sub(new THREE.Vector3(x, y, z))
      petioleTransform.position.set(x, y, z).add(leafBase).multiplyScalar(.5)
      petioleTransform.quaternion.setFromUnitVectors(up, petioleDirection.clone().normalize())
      petioleTransform.scale.set(1, petioleDirection.length(), 1)
      petioleTransform.updateMatrix()
      petioles.setMatrixAt(index, petioleTransform.matrix)
    }
  }
  for (const mesh of leafBatches) if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  for (const mesh of [...leafBatches, petioles]) mesh.instanceMatrix.needsUpdate = true

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
  // Living capillary-meniscus water inside the ceramic pitcher (GPU vertex deform keeps
  // checkpoint vertices bit-identical while rendering live slosh, ripples & caustic shimmer).
  const pitcherLiquid = createVesselLiquid({
    preset: 'clear-water',
    radius: .114,
    radialSegments: 10,
    angularSegments: 32,
    deformMode: 'gpu',
    color: 0x8cc9cf,
    edgeColor: 0xdcf7f5,
    deepColor: 0x458e98,
    foamColor: 0xf7fbf8,
    foamStrength: .10,
    opacity: .80,
    roughness: .13,
    meniscusHeight: .004,
    maxAmplitude: .012,
    seed: 1103,
    name: 'bodhi-pitcher-water-level',
    waterRendering: true,
    receiveShadow: true,
    renderOrder: 1,
  })
  const liquid = pitcherLiquid.mesh
  actor.add(liquid)

  const impact = new THREE.Object3D()
  impact.name = 'bodhi-soil-water-impact'
  impact.position.set(.07, .176, .26)
  root.add(impact)
  // Glistening shallow water sheen spreading across the watered root soil with expanding impact ripples.
  const impactPuddle = createVesselLiquid({
    preset: 'clear-water',
    radius: .165,
    radiusZ: .118,
    radialSegments: 12,
    angularSegments: 36,
    deformMode: 'gpu',
    color: 0x76b7be,
    edgeColor: 0xd9f2f0,
    deepColor: 0x48695e,
    foamColor: 0xf3f8f4,
    foamStrength: .14,
    opacity: .56,
    roughness: .11,
    meniscusHeight: .0016,
    maxAmplitude: .006,
    seed: 1129,
    name: 'bodhi-water-impact-puddle',
    waterRendering: true,
    receiveShadow: true,
    renderOrder: 2,
  })
  impactPuddle.mesh.position.set(.07, .1764, .26)
  impactPuddle.mesh.visible = false
  root.add(impactPuddle.mesh)

  const stream = new THREE.Group()
  stream.name = 'bodhi-water-stream'
  root.add(stream)
  const pourStream = createLivingPourStream({
    preset: 'clear-water',
    topRadius: .0155,
    bottomRadius: .0085,
    segments: 20,
    radialSegments: 12,
    arcForward: .34,
    showSplashCrown: true,
    splashRadius: .052,
    pulseAmplitude: .15,
    color: 0x90ccd3,
    opacity: .78,
    roughness: .13,
    seed: 1151,
    name: 'bodhi-water-living-stream',
    waterRendering: true,
  })
  pourStream.splashCrown.name = 'bodhi-water-splash-crown'
  stream.add(pourStream.mesh, pourStream.splashCrown)
  // Preserve exact named arc-sample anchors along the live ballistic stream path for test contracts.
  const segments = Array.from({ length: 16 }, (_, i) => {
    const marker = new THREE.Object3D()
    marker.name = `bodhi-water-stream-segment-${i}`
    stream.add(marker)
    return marker
  })
  const smooth = (t: number) => t * t * (3 - 2 * t)
  const phase = (t: number, start: number, end: number) => smooth(THREE.MathUtils.clamp((t - start) / (end - start), 0, 1))
  const from = new THREE.Vector3(), to = new THREE.Vector3(), a = new THREE.Vector3(), b = new THREE.Vector3(), direction = new THREE.Vector3()
  const ARC_FORWARD = .34
  const waterPoint = (t: number, output: THREE.Vector3) => {
    const hT = 1 - Math.pow(1 - t, 1 + ARC_FORWARD * .72)
    const yT = Math.pow(t, 1 + ARC_FORWARD * .85)
    return output.set(
      from.x + (to.x - from.x) * hT,
      from.y + (to.y - from.y) * yT,
      from.z + (to.z - from.z) * hT,
    )
  }
  let liquidClock = 0
  let rippleTimer = .14
  let rippleIndex = 0
  let lastPourActive = false
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
    wetSoil.roughness = THREE.MathUtils.lerp(.72, .34, drained)
    wetSoil.clearcoat = THREE.MathUtils.lerp(.12, .44, drained)
    impactPuddle.mesh.visible = drained > 0
    const puddleScale = .24 + .76 * drained
    impactPuddle.mesh.scale.set(puddleScale, 1, puddleScale)
    const flow = tilt > .88 && pour > .23 && pour < .62
    stream.visible = flow
    root.updateMatrixWorld(true)
    spout.getWorldPosition(from)
    impact.getWorldPosition(to)
    // Always sync deterministic rest arc geometry so static checkpoints & frame bounds stay exact.
    pourStream.updateArc(from, to, 1, 0, true)
    pourStream.mesh.visible = flow
    pourStream.splashCrown.visible = flow
    for (let i = 0; i < segments.length; i++) {
      waterPoint(i / segments.length, a)
      waterPoint((i + 1) / segments.length, b)
      direction.copy(b).sub(a)
      const marker = segments[i]!
      marker.position.copy(a).add(b).multiplyScalar(.5)
      const length = direction.length()
      marker.quaternion.setFromUnitVectors(up, direction.normalize())
      marker.scale.set(.013 - .003 * i / segments.length, length, .013 - .003 * i / segments.length)
    }
    if (flow && !lastPourActive) {
      pitcherLiquid.addTiltImpulse(2.4, -.5)
      pitcherLiquid.triggerRipple(.03, 0, 1.0)
      impactPuddle.triggerRipple(0, 0, 1.35)
      impactPuddle.addDipDepression(0, 0, .0035, .048)
      rippleTimer = 0
    }
    lastPourActive = flow
    root.updateMatrixWorld(true)
  }
  function updateLiquid(dt: number, reduced: boolean) {
    if (disposed) return
    const stepDt = Number.isFinite(dt) && dt > 0 ? Math.min(dt, .05) : 0
    if (!reduced) liquidClock += stepDt
    pitcherLiquid.update(stepDt, liquidClock, reduced)
    impactPuddle.update(stepDt, liquidClock, reduced)
    if (stream.visible) {
      pourStream.updateArc(from, to, 1, liquidClock, reduced)
      pourStream.mesh.visible = true
      pourStream.splashCrown.visible = !reduced
      if (!reduced && stepDt > 0) {
        rippleTimer += stepDt
        if (rippleTimer >= .14) {
          rippleTimer = 0
          const offsets = [[0, 0], [.026, -.018], [-.024, .016], [.018, .022], [-.020, -.020]] as const
          const [ox, oz] = offsets[rippleIndex % offsets.length]!
          rippleIndex++
          impactPuddle.triggerRipple(ox, oz, 1.1)
          pitcherLiquid.triggerRipple(.028, oz * .4, .45)
        }
      }
    } else {
      pourStream.mesh.visible = false
      pourStream.splashCrown.visible = false
      rippleTimer = .14
    }
  }
  function triggerSlosh(ax: number, az: number, rippleStrength = .75) {
    if (disposed) return
    pitcherLiquid.addTiltImpulse(ax, az)
    if (rippleStrength > 0) pitcherLiquid.triggerRipple(0, 0, rippleStrength)
  }
  function resetLiquid() {
    if (disposed) return
    liquidClock = 0
    rippleTimer = .14
    rippleIndex = 0
    lastPourActive = false
    pitcherLiquid.reset()
    impactPuddle.reset()
    pourStream.updateArc(from, to, 1, 0, true)
    pourStream.mesh.visible = stream.visible
    pourStream.splashCrown.visible = stream.visible
  }
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    pitcherLiquid.dispose()
    impactPuddle.dispose()
    pourStream.dispose()
    root.traverse(object => { if (object instanceof THREE.InstancedMesh) object.dispose() })
    disposeTree(root)
  }
  pose(0, 0)
  return {
    root, actor, pose, updateLiquid, triggerSlosh, resetLiquid, dispose,
    targets: [actor, actor, actor],
    roots: [actor, actor, actor],
    anchors: [[0, .30, .30], [0, .30, .30], [0, .30, .30]] as [number, number, number][],
  }
}
