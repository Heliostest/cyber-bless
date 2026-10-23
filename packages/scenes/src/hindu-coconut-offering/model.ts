import * as THREE from 'three'
import { disposeTree } from '../procedural-kit'

const RX = .46, RY = .5, RZ = .43
const INNER = .78
const STONE_TOP = .34
const CONTACT_AT = .42
const REST_Y = .1 + RY * Math.cos(Math.PI / 8)
const LIFT_Y = REST_Y + .6
const CONTACT_Y = STONE_TOP + RY
const AROUND = 64, HALF_ROWS = 24

type ProfileRow = { x: number; y: number; z: number; material?: number }

/** Revolve an elliptical profile around x, sharing every seam and pole vertex. */
function profileSurface(profile: ProfileRow[], closeProfile = false) {
  const positions: number[] = [], indices: number[] = [], rows: number[][] = []
  for (const point of profile) {
    const row: number[] = [], count = point.y === 0 && point.z === 0 ? 1 : AROUND
    for (let i = 0; i < count; i++) {
      row.push(positions.length / 3)
      const angle = i * Math.PI * 2 / AROUND
      positions.push(point.x, point.y * Math.cos(angle), point.z * Math.sin(angle))
    }
    rows.push(row)
  }
  const geometry = new THREE.BufferGeometry()
  for (let i = 0; i < rows.length - (closeProfile ? 0 : 1); i++) {
    const a = rows[i]!, b = rows[(i + 1) % rows.length]!, start = indices.length
    for (let j = 0; j < AROUND; j++) {
      const next = (j + 1) % AROUND
      if (a.length === 1) indices.push(a[0]!, b[next]!, b[j]!)
      else if (b.length === 1) indices.push(a[j]!, a[next]!, b[0]!)
      else indices.push(a[j]!, a[next]!, b[j]!, a[next]!, b[next]!, b[j]!)
    }
    const material = profile[i]!.material ?? 0, previous = geometry.groups[geometry.groups.length - 1]
    if (previous && previous.materialIndex === material) previous.count += indices.length - start
    else geometry.addGroup(start, indices.length - start, material)
  }
  // Both mirrored half profiles must have outward exterior and inward cavity faces.
  let volume = 0
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  for (let i = 0; i < indices.length; i += 3) {
    a.fromArray(positions, indices[i]! * 3)
    b.fromArray(positions, indices[i + 1]! * 3)
    c.fromArray(positions, indices[i + 2]! * 3)
    volume += a.dot(b.cross(c)) / 6
  }
  if (volume < 0) for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2]!, indices[i + 1]!]
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

function coconutSurface(sign?: number) {
  const rows: ProfileRow[] = []
  if (sign === undefined) {
    for (let i = 0; i <= HALF_ROWS * 2; i++) {
      const theta = i * Math.PI / (HALF_ROWS * 2), pole = i === 0 || i === HALF_ROWS * 2
      rows.push({ x: i === HALF_ROWS ? 0 : RX * Math.cos(theta), y: pole ? 0 : RY * Math.sin(theta), z: pole ? 0 : RZ * Math.sin(theta) })
    }
  } else {
    for (let i = 0; i <= HALF_ROWS; i++) {
      const theta = i * Math.PI / (HALF_ROWS * 2)
      rows.push({ x: i === HALF_ROWS ? 0 : sign * RX * Math.cos(theta), y: i === 0 ? 0 : RY * Math.sin(theta), z: i === 0 ? 0 : RZ * Math.sin(theta), material: 0 })
    }
    // A narrow brown shell edge surrounds the much thicker ivory flesh edge.
    rows.push({ x: 0, y: RY * .94, z: RZ * .94, material: 1 })
    for (let i = HALF_ROWS; i >= 0; i--) {
      const theta = i * Math.PI / (HALF_ROWS * 2)
      rows.push({ x: i === HALF_ROWS ? 0 : sign * RX * INNER * Math.cos(theta), y: i === 0 ? 0 : RY * INNER * Math.sin(theta), z: i === 0 ? 0 : RZ * INNER * Math.sin(theta), material: 1 })
    }
  }
  return profileSurface(rows)
}

function horizontalSurface(profile: [number, number][], close = false) {
  return profileSurface(profile.map(([radius, y]) => ({ x: y, y: radius, z: radius })), close).rotateZ(Math.PI / 2)
}

/**
 * Original procedural hard-shell coconut and plain stone support.
 * The assisted lift, transfer and opening are product choreography.
 */
export function createCoconutOfferingModel() {
  const root = new THREE.Group(); root.name = 'coconut-subject'
  const actor = new THREE.Group(); actor.name = 'coconut-carrier'; root.add(actor)
  const whole = new THREE.Group(); whole.name = 'coconut-whole'; actor.add(whole)
  const brown = new THREE.MeshStandardMaterial({ color: '#775039', roughness: .92 })
  const fiber = new THREE.MeshStandardMaterial({ color: '#9a714a', roughness: 1 })
  const flesh = new THREE.MeshStandardMaterial({ color: '#f0e9d2', roughness: .65 })
  const eye = new THREE.MeshStandardMaterial({ color: '#3d2a21', roughness: 1 })
  const stone = new THREE.MeshStandardMaterial({ color: '#71858b', roughness: .97 })
  const ringMaterial = new THREE.MeshStandardMaterial({ color: '#817d70', roughness: 1 })
  const waterMaterial = new THREE.MeshStandardMaterial({ color: '#8ebac1', roughness: .19, transparent: true, opacity: .46, depthWrite: false })
  const add = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[]) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh)
    return mesh
  }
  add(whole, 'coconut-shell', coconutSurface(), brown)
  const halves = ([-1, 1] as const).map(sign => {
    const group = new THREE.Group(); group.name = `coconut-half-${sign < 0 ? 'left' : 'right'}`; actor.add(group)
    add(group, `coconut-half-shell-${sign < 0 ? 'left' : 'right'}`, coconutSurface(sign), [brown, flesh])
    return group
  })

  // Curved raised fibers stay on their own side of the eventual fracture plane.
  for (let i = 0; i < 48; i++) {
    const phi = (i + .5) * Math.PI * 2 / 48, points: THREE.Vector3[] = []
    for (let j = 0; j <= 20; j++) {
      const theta = .20 + (Math.PI - .40) * j / 20
      const angle = phi + .018 * Math.sin(theta * 5 + i * .7)
      points.push(new THREE.Vector3(RX * 1.002 * Math.sin(theta) * Math.cos(angle), RY * 1.002 * Math.cos(theta), RZ * 1.002 * Math.sin(theta) * Math.sin(angle)))
    }
    const geometry = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .0019, 4, false)
    const side = Math.cos(phi) < 0 ? 0 : 1
    add(whole, `coconut-fiber-${i}`, geometry, fiber).castShadow = false
    add(halves[side]!, `coconut-fiber-${i}-${side === 0 ? 'left' : 'right'}`, geometry, fiber).castShadow = false
  }
  // Three seed pores cluster near one end; shallow inset lenses avoid a painted face.
  const pores = [new THREE.Vector3(.15, .86, .48), new THREE.Vector3(.45, .83, .33), new THREE.Vector3(.30, .94, .12)]
  pores.forEach((direction, i) => {
    direction.normalize()
    const point = direction.clone().multiply(new THREE.Vector3(RX, RY, RZ))
    const normal = new THREE.Vector3(point.x / (RX * RX), point.y / (RY * RY), point.z / (RZ * RZ)).normalize()
    const center = point.clone().addScaledVector(normal, -.003)
    const geometry = new THREE.SphereGeometry(1, 20, 12).scale(.036, .029, .012)
      .applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), normal)).translate(center.x, center.y, center.z)
    add(whole, `coconut-eye-${i}`, geometry, eye)
    add(halves[1]!, `coconut-eye-${i}-right`, geometry, eye)
  })

  const ringInner = RX * Math.sin(Math.PI / 8)
  const preparationRing = add(root, 'coconut-preparation-ring', horizontalSurface([[ringInner, .025], [.34, .025], [.34, .1], [ringInner, .1]], true), ringMaterial)
  preparationRing.position.set(-1, 0, .4)
  const basin = add(root, 'coconut-catch-basin', horizontalSurface([[0, .012], [.73, .012], [.91, .065], [.95, .105], [.94, .14], [.89, .16], [.83, .16], [.73, .095], [0, .095]]), stone)
  basin.position.set(.65, 0, .4); basin.scale.set(1.26, 1, .81)
  const strikingStone = add(root, 'coconut-striking-stone', horizontalSurface([[0, .14], [.74, .14], [.81, .17], [.8, .30], [.77, STONE_TOP], [0, STONE_TOP]]), stone)
  strikingStone.position.set(.65, 0, .4); strikingStone.scale.set(1.30, 1, .83)
  const water = add(root, 'coconut-water-spill', new THREE.CylinderGeometry(.43, .43, .005, 64), waterMaterial)
  water.position.set(.65, .342, .4); water.castShadow = false

  const identity = new THREE.Quaternion()
  const finalRotations = [
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(1, 0, 0), new THREE.Vector3(.12, .82, .56).normalize()),
    new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(-1, 0, 0), new THREE.Vector3(-.12, .82, .56).normalize()),
  ]
  // Cache authored coordinates once; the lowest transformed point remains on the
  // flat stone throughout opening, including the fine fibers and seed pores.
  const supportCoordinates = halves.map(half => {
    const coordinates: number[] = []
    half.traverse(object => {
      const mesh = object as THREE.Mesh
      if (!mesh.isMesh) return
      const positions = mesh.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) coordinates.push(positions.getX(i), positions.getY(i), positions.getZ(i))
    })
    return new Float32Array(coordinates)
  })
  const rotation = new THREE.Matrix4()
  const ease = (t: number) => t * t * (3 - 2 * t)
  function pose(at: number, n: number) {
    const step = Number.isFinite(at) ? Math.max(0, Math.floor(at)) : 0
    const t = THREE.MathUtils.clamp(Number.isFinite(n) ? n : 0, 0, 1)
    const contacted = step > 2 || step === 2 && t >= CONTACT_AT
    const opening = step > 2 ? 1 : step === 2 ? ease(THREE.MathUtils.clamp((t - CONTACT_AT) / (1 - CONTACT_AT), 0, 1)) : 0
    const x = step === 0 ? -1 : step === 1 ? THREE.MathUtils.lerp(-1, .65, ease(t)) : .65
    const y = step === 0 ? THREE.MathUtils.lerp(REST_Y, LIFT_Y, ease(t)) : step === 1 ? LIFT_Y : step === 2 ? THREE.MathUtils.lerp(LIFT_Y, CONTACT_Y, ease(Math.min(t / CONTACT_AT, 1))) : CONTACT_Y
    actor.position.set(x, y, .4)
    whole.visible = !contacted
    halves.forEach((half, i) => {
      half.visible = contacted
      half.quaternion.slerpQuaternions(identity, finalRotations[i]!, opening)
      rotation.makeRotationFromQuaternion(half.quaternion)
      const e = rotation.elements, coordinates = supportCoordinates[i]!
      let bottom = Infinity, innerEdge = i === 0 ? -Infinity : Infinity
      for (let j = 0; j < coordinates.length; j += 3) {
        const x = coordinates[j]!, y = coordinates[j + 1]!, z = coordinates[j + 2]!
        bottom = Math.min(bottom, e[1]! * x + e[5]! * y + e[9]! * z)
        const horizontal = e[0]! * x + e[4]! * y + e[8]! * z
        innerEdge = i === 0 ? Math.max(innerEdge, horizontal) : Math.min(innerEdge, horizontal)
      }
      // Separate the actual rotated silhouettes, rather than using a fixed
      // center offset that lets the two thick rims pass through each other.
      const outward = i === 0 ? -1 : 1
      half.position.set(-innerEdge + outward * .03 * opening, -RY - bottom, 0)
    })
    water.visible = opening > 0
    water.scale.set(.15 + .85 * opening, 1, (.15 + .85 * opening) * .67)
    root.updateMatrixWorld(true)
  }
  pose(0, 0)
  let disposed = false
  return {
    root, actor, pose,
    targets: [actor, actor, actor],
    roots: [actor, actor, actor],
    anchors: [[0, 0, .43], [0, 0, .43], [0, 0, .43]] as [number, number, number][],
    dispose() { if (!disposed) { disposed = true; disposeTree(root) } },
  }
}
