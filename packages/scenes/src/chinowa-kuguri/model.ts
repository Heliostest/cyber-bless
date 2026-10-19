import * as THREE from 'three'

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

function kayaTexture() {
  const width = 256, height = 64, pixels = new Uint8Array(width * height * 4)
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const u = x / width, binding = (u * 6) % 1 < .035, fiber = Math.sin(y * 2.72 + Math.sin(x * .09) * .2) * 8 + Math.sin(x * .73 + y * 5.1) * 2, at = (y * width + x) * 4
    pixels[at] = binding ? 128 : 168 + fiber; pixels[at + 1] = binding ? 114 : 184 + fiber; pixels[at + 2] = binding ? 72 : 83 + fiber; pixels[at + 3] = 255
  }
  const texture = new THREE.DataTexture(pixels, width, height); texture.colorSpace = THREE.SRGBColorSpace; texture.wrapS = texture.wrapT = THREE.RepeatWrapping; texture.needsUpdate = true
  return texture
}

export function createChinowaModel() {
  const root = new THREE.Group(); root.name = 'chinowa-world'
  const subject = new THREE.Group(); subject.name = 'chinowa-subject'; root.add(subject)
  const texture = kayaTexture(), kaya = new THREE.MeshStandardMaterial({ color: 0xffffff, map: texture, roughness: .96 }), wood = new THREE.MeshStandardMaterial({ color: 0xae8053, roughness: .87 }), rope = new THREE.MeshStandardMaterial({ color: 0xd1bd88, roughness: 1 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, x: number, y: number, z: number) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(x, y, z); mesh.castShadow = mesh.receiveShadow = true; subject.add(mesh); return mesh
  }
  const hoop = add('chinowa-hoop', new THREE.TorusGeometry(1.38, .15, 12, 96), kaya, 0, 1.55, 0)
  for (const [i, x] of [-1.49, 1.49].entries()) {
    add('chinowa-foot-' + i, new THREE.BoxGeometry(.5, .12, .8), wood, x, .06, -.32)
    add('chinowa-post-' + i, new THREE.BoxGeometry(.14, 3.04, .18), wood, x, 1.64, -.32)
    const g = new THREE.CylinderGeometry(.03, .03, .11, 12); g.rotateX(Math.PI / 2)
    // Short rope ends enter bundle/post as explicit attachment sockets.
    add('chinowa-tie-' + i, g, rope, Math.sign(x) * 1.4, 1.55, -.19)
  }
  const pose = (_step: number, _amount: number) => root.updateMatrixWorld(true)
  pose(0, 0)
  let disposed = false
  const dispose = () => { if (!disposed) { disposed = true; texture.dispose() } }
  return { root, subject, hoop, targets: [hoop, hoop, hoop], roots: [hoop, hoop, hoop], anchors: [[0, 1.38, .15], [0, 1.38, .15], [0, 1.38, .15]] as [number, number, number][], pose, dispose }
}
