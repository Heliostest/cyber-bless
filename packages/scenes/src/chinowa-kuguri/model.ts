import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createChinowaKayaMaterial } from './kaya-material'

const UP = new THREE.Vector3(0, 1, 0), EYE = 1.664
const smooth = (t: number) => t * t * (3 - 2 * t)

/** Original proportions; this is a virtual walking view, not a survey of the shrine. */
export function chinowaHomeDistance(aspect: number) {
  const a = Number.isFinite(aspect) && aspect > 0 ? aspect : 1
  return Math.max(5.4, 1.82 / (Math.tan(21 * Math.PI / 180) * a * .82), 1.72 / (Math.tan(21 * Math.PI / 180) * .82))
}

function groundPath(t: number, side: number, front: number) {
  const points = [[0, front], [0, 1], [0, -.8], [side * 3.2, -1], [side * 3.2, 2.2], [0, front]]
  const lengths = points.slice(1).map((p, i) => Math.hypot(p[0]! - points[i]![0]!, p[1]! - points[i]![1]!)), total = lengths.reduce((a, b) => a + b, 0)
  let distance = THREE.MathUtils.clamp(t, 0, 1) * total
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i]! || i === lengths.length - 1) {
      const n = smooth(THREE.MathUtils.clamp(distance / lengths[i]!, 0, 1)), a = points[i]!, b = points[i + 1]!
      return new THREE.Vector3(THREE.MathUtils.lerp(a[0]!, b[0]!, n), 0, THREE.MathUtils.lerp(a[1]!, b[1]!, n))
    }
    distance -= lengths[i]!
  }
  return new THREE.Vector3(0, 0, front)
}

function pathLeg(t: number, front: number) {
  const lengths = [front - 1, 1.8, Math.hypot(3.2, .2), 3.2, Math.hypot(3.2, front - 2.2)], total = lengths.reduce((a, b) => a + b, 0)
  let distance = t * total
  for (let i = 0; i < lengths.length; i++) {
    if (distance <= lengths[i]! || i === lengths.length - 1) return { leg: i, progress: THREE.MathUtils.clamp(distance / lengths[i]!, 0, 1) }
    distance -= lengths[i]!
  }
  return { leg: 4, progress: 1 }
}

export function chinowaView(step: number, amount: number, front: number) {
  const home = new THREE.Vector3(0, EYE, front), homeQ = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(home, new THREE.Vector3(0, 1.55, 0), UP))
  const t = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
  if (step >= 3 || t === 0 || t === 1) return { position: home, quaternion: homeQ }
  const side = step === 1 ? 1 : -1, position = groundPath(t, side, front)
  // Lift the virtual feet over the low bundle. The hoop stays fixed in the world.
  const crossingLift = Math.abs(position.x) < .001 && Math.abs(position.z) < .8 ? .42 * (1 + Math.cos(Math.PI * position.z / .8)) / 2 : 0
  position.y = EYE + crossingLift + .018 * Math.sin(7 * Math.PI * t) ** 2
  const focus = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, new THREE.Vector3(0, 1.55, 0), UP)), forward = new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().lookAt(position, position.clone().add(new THREE.Vector3(0, 0, -1)), UP)), { leg, progress } = pathLeg(t, front)
  // Look through the opening while crossing, then turn back toward the fixed hoop.
  // Around its side the visitor can keep watching it, instead of looking away at scenery.
  const quaternion = leg === 1 ? focus.clone().slerp(forward, smooth(Math.min(1, progress * 3))) : leg === 2 ? forward.clone().slerp(focus, smooth(progress)) : focus
  return { position, quaternion }
}

export function createChinowaModel() {
  const root = new THREE.Group(); root.name = 'chinowa-world'
  const subject = new THREE.Group(); subject.name = 'chinowa-subject'; root.add(subject)
  const kayaSuite = createChinowaKayaMaterial(), kaya = kayaSuite.material
  const postWood = new THREE.MeshStandardMaterial({ color: 0xae8053, roughness: .87 })
  const footWood = new THREE.MeshStandardMaterial({ color: 0x9c7249, roughness: .89 })
  const rope = new THREE.MeshStandardMaterial({ color: 0xd1bd88, roughness: 1 })
  applyCraftSurface(postWood, { kind: 'wood', strength: .4, axis: 'y' })
  applyCraftSurface(footWood, { kind: 'wood', strength: .4, axis: 'z' })
  applyCraftSurface(rope, { kind: 'cord', strength: .3 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; subject.add(mesh); return mesh
  }
  const hoop = add('chinowa-hoop', new THREE.TorusGeometry(1.38, .15, 12, 96), kaya, 0, 1.55, 0)
  for (const [i, x] of [-1.49, 1.49].entries()) {
    const side = Math.sign(x)
    add('chinowa-foot-' + i, new RoundedBoxGeometry(.5, .12, .8, 2, .02), footWood, x, .06, -.32)
    add('chinowa-post-' + i, new RoundedBoxGeometry(.14, 3.06, .18, 2, .018), postWood, x, 1.63, -.32)
    // Continuous curved rope lashing wrapping around both the wooden post and the reed ring.
    const wrap = new THREE.CatmullRomCurve3([
      new THREE.Vector3(side * .09, .028, -.105),
      new THREE.Vector3(0, .032, -.228),
      new THREE.Vector3(-side * .088, .024, -.13),
      new THREE.Vector3(-side * .05, .008, .015),
      new THREE.Vector3(-side * .18, -.026, .185),
      new THREE.Vector3(-side * .01, -.034, .348),
      new THREE.Vector3(side * .13, -.024, .21),
      new THREE.Vector3(side * .06, -.004, .02),
      new THREE.Vector3(side * .092, -.022, -.12),
      new THREE.Vector3(0, -.028, -.228),
      new THREE.Vector3(-side * .09, -.024, -.125),
      new THREE.Vector3(-side * .045, -.006, .018),
      new THREE.Vector3(-side * .175, .028, .195),
      new THREE.Vector3(-side * .01, .034, .348),
      new THREE.Vector3(side * .13, .024, .205),
      new THREE.Vector3(side * .055, .010, .015),
    ], true, 'centripetal')
    add('chinowa-tie-' + i, new THREE.TubeGeometry(wrap, 72, .018, 8, true), rope, x, 1.55, -.19)
  }
  const pose = (_step: number, _amount: number) => root.updateMatrixWorld(true)
  pose(0, 0)
  let disposed = false
  const dispose = () => { if (!disposed) { disposed = true; kayaSuite.dispose() } }
  return { root, subject, hoop, targets: [hoop, hoop, hoop], roots: [hoop, hoop, hoop], anchors: [[0, 1.38, .15], [0, 1.38, .15], [0, 1.38, .15]] as [number, number, number][], pose, dispose }
}
