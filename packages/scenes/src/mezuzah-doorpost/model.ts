import * as THREE from 'three'
import { disposeTree } from '../procedural-kit'

/** Original closed case and residential doorway; the scroll is already prepared inside. */
export function createMezuzahModel() {
  const root = new THREE.Group()
  root.name = 'mezuzah-subject'
  const actor = new THREE.Group()
  actor.name = 'mezuzah-case'
  root.add(actor)

  const teal = new THREE.MeshStandardMaterial({ color: 0x398d8f, roughness: .32, metalness: .16 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xc8a56b, roughness: .4, metalness: .62 })
  const wood = new THREE.MeshStandardMaterial({ color: 0x795840, roughness: .82 })
  const panelWood = new THREE.MeshStandardMaterial({ color: 0x9b7550, roughness: .78 })
  const insetWood = new THREE.MeshStandardMaterial({ color: 0x8d6747, roughness: .84 })
  const adhesive = new THREE.MeshStandardMaterial({ color: 0xccc4ae, roughness: .93 })

  const add = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x = 0, y = 0, z = 0) => {
    const mesh = new THREE.Mesh(geometry, material)
    mesh.name = name
    mesh.position.set(x, y, z)
    mesh.castShadow = mesh.receiveShadow = true
    parent.add(mesh)
    return mesh
  }
  const box = (parent: THREE.Object3D, name: string, width: number, height: number, depth: number, material: THREE.Material, x = 0, y = 0, z = 0) =>
    add(parent, name, new THREE.BoxGeometry(width, height, depth), material, x, y, z)
  const roundedPrism = (width: number, height: number, depth: number, radius: number) => {
    const x = width / 2, y = height / 2
    const shape = new THREE.Shape()
    shape.moveTo(-x + radius, -y)
    shape.lineTo(x - radius, -y)
    shape.quadraticCurveTo(x, -y, x, -y + radius)
    shape.lineTo(x, y - radius)
    shape.quadraticCurveTo(x, y, x - radius, y)
    shape.lineTo(-x + radius, y)
    shape.quadraticCurveTo(-x, y, -x, y - radius)
    shape.lineTo(-x, -y + radius)
    shape.quadraticCurveTo(-x, -y, -x + radius, -y)
    shape.closePath()
    const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 8, steps: 1 })
    geometry.translate(0, 0, -depth / 2)
    return geometry
  }

  // The exterior is closed. No invented scroll lettering or simulated sacred text.
  add(actor, 'mezuzah-case-body', roundedPrism(.22, .72, .18, .034), teal)
  for (const [i, sign] of [-1, 1].entries()) {
    add(actor, `mezuzah-brass-endcap-${i}`, roundedPrism(.224, .066, .184, .015), brass, 0, sign * .337, 0)
    add(actor, `mezuzah-brass-cap-step-${i}`, roundedPrism(.228, .014, .188, .006), brass, 0, sign * .354, 0)
    box(actor, `mezuzah-brass-edge-${i}`, .008, .59, .008, brass, sign * .104, 0, .09)
  }
  // A small continuous geometric shin (three upright strokes on a joined baseline).
  const shin = new THREE.Shape()
  shin.moveTo(-.055, .06)
  for (const [x, y] of [[-.035, .06], [-.027, -.023], [-.011, -.032], [-.011, .06], [.009, .06], [.009, -.033], [.025, -.032], [.034, -.024], [.039, .06], [.059, .06], [.05, -.035], [.034, -.054], [-.018, -.054], [-.043, -.035]]) shin.lineTo(x!, y!)
  shin.closePath()
  const shinGeometry = new THREE.ExtrudeGeometry(shin, { depth: .006, bevelEnabled: false, steps: 1 })
  add(actor, 'mezuzah-shin', shinGeometry, brass, -.002, .19, .09)
  // Permanent, already prepared mounting tape; its rear face is the contact surface.
  box(actor, 'mezuzah-adhesive-backing', .17, .59, .02, adhesive, 0, 0, -.10)

  // Seen from outside: the opening is to the left of the entrance's right post.
  box(root, 'mezuzah-left-jamb', .52, 2.92, .56, wood, -1.15, 1.46, -.06)
  box(root, 'mezuzah-right-jamb', .52, 2.92, .56, wood, 1.15, 1.46, -.06)
  box(root, 'mezuzah-lintel', 2.82, .18, .56, wood, 0, 3.01, -.06)
  const door = new THREE.Group()
  door.name = 'mezuzah-door-hinge'
  door.position.set(-.86, 0, -.065)
  door.rotation.y = .30
  root.add(door)
  box(door, 'mezuzah-door-panel', 1.68, 2.86, .10, panelWood, .84, 1.43, 0)
  box(door, 'mezuzah-door-upper-inset', 1.32, 1.27, .012, insetWood, .84, 2.08, .052)
  box(door, 'mezuzah-door-lower-inset', 1.32, .99, .012, insetWood, .84, .68, .052)
  box(door, 'mezuzah-door-handle', .11, .035, .065, brass, 1.47, 1.35, .09)

  // Low preparation seats meet the actual flat side of the horizontal case at y=.17.
  for (const [i, x] of [-.93, -.57].entries()) {
    box(root, `mezuzah-rest-foot-${i}`, .17, .04, .28, wood, x, .02, .85)
    box(root, `mezuzah-rest-stem-${i}`, .075, .10, .13, wood, x, .09, .85)
    box(root, `mezuzah-rest-seat-${i}`, .10, .03, .24, panelWood, x, .155, .85)
  }

  const checkpoints = [
    { x: -.75, y: .28, z: .85, angle: -Math.PI / 2, yaw: 0 },
    { x: -.75, y: 1.03, z: .85, angle: -Math.PI / 2, yaw: 0 },
    { x: .53, y: 2.52, z: -.03, angle: Math.PI / 12, yaw: -Math.PI / 2 },
    { x: .78, y: 2.48, z: -.03, angle: Math.PI / 12, yaw: -Math.PI / 2 },
  ] as const
  function pose(step: number, progress: number) {
    const index = THREE.MathUtils.clamp(Math.floor(step), 0, 3)
    const t = THREE.MathUtils.clamp(progress, 0, 1)
    const a = checkpoints[index]!, b = checkpoints[Math.min(index + 1, 3)]!
    // Branch endpoints keep stored-step restoration bit-for-bit equivalent.
    const state = t === 0 ? a : t === 1 ? b : {
      x: THREE.MathUtils.lerp(a.x, b.x, t),
      y: THREE.MathUtils.lerp(a.y, b.y, t),
      z: THREE.MathUtils.lerp(a.z, b.z, t),
      angle: THREE.MathUtils.lerp(a.angle, b.angle, t * t * (3 - 2 * t)),
      yaw: THREE.MathUtils.lerp(a.yaw, b.yaw, t * t * (3 - 2 * t)),
    }
    actor.position.set(state.x, state.y, state.z)
    actor.rotation.set(0, state.yaw, state.angle, 'YXZ')
    root.updateMatrixWorld(true)
  }
  let disposed = false
  function dispose() {
    if (disposed) return
    disposed = true
    disposeTree(root)
  }
  pose(0, 0)
  return {
    root, actor, pose, dispose,
    targets: [actor, actor, actor],
    roots: [actor, actor, actor],
    anchors: [[0, 0, .12], [0, 0, .12], [0, 0, .12]] as [number, number, number][],
  }
}
