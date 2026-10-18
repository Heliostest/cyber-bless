import * as THREE from 'three'

/** Original bamboo/wood double-wheel toy; cord and handsticks use assisted paths. */
export function createDiaboloModel() {
  const subject = new THREE.Group(); subject.name = 'diabolo-subject'
  const material = (color: number, roughness = .72) => new THREE.MeshStandardMaterial({ color, roughness })
  const bamboo = material(0xd9ad67), cap = material(0xf1d49d), teal = material(0x3c928a), inner = material(0x775235), coral = material(0xcb7454), cordMat = material(0xecd394, 1)
  const add = (parent: THREE.Object3D, name: string, geometry: THREE.BufferGeometry, mat: THREE.Material) => {
    const mesh = new THREE.Mesh(geometry, mat); mesh.name = name; mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  const cylinderZ = (parent: THREE.Object3D, name: string, radius: number, depth: number, mat: THREE.Material, z = 0) => {
    const mesh = add(parent, name, new THREE.CylinderGeometry(radius, radius, depth, 40), mat); mesh.rotation.x = Math.PI / 2; mesh.position.z = z; return mesh
  }
  const rotor = new THREE.Group(); rotor.name = 'diabolo-rotor'; subject.add(rotor)
  cylinderZ(rotor, 'diabolo-axle', .075, 1.12, inner)
  for (const [i, z] of [-.48, .48].entries()) {
    const wheel = new THREE.Group(); wheel.name = `diabolo-wheel-${i}`; wheel.position.z = z; rotor.add(wheel)
    for (const sign of [-1, 1]) {
      cylinderZ(wheel, `diabolo-cap-${i}-${sign}`, .52, .025, cap, sign * .1125)
      const rim = add(wheel, `diabolo-rim-${i}-${sign}`, new THREE.TorusGeometry(.505, .013, 6, 48), teal); rim.position.z = sign * .126
      cylinderZ(wheel, `diabolo-hub-${i}-${sign}`, .135, .015, bamboo, sign * .133)
      for (let n = 0; n < 3; n++) {
        const marker = cylinderZ(wheel, `diabolo-mark-${i}-${sign}-${n}`, .044, .004, n === 0 ? coral : teal, sign * .127)
        marker.position.x = Math.cos(n * Math.PI * 2 / 3) * .34; marker.position.y = Math.sin(n * Math.PI * 2 / 3) * .34
      }
    }
    // Closed annular wall sectors leave actual apertures into the hollow drum.
    const slots = [[0, .15], [Math.PI / 2, .065], [Math.PI + .25, .065], [Math.PI * 1.5, .065]]
    for (let n = 0; n < slots.length; n++) {
      const start = slots[n]![0]! + slots[n]![1]!, next = slots[(n + 1) % slots.length]!, end = next[0]! - next[1]! + (n === slots.length - 1 ? Math.PI * 2 : 0)
      const shape = new THREE.Shape(); shape.moveTo(.52 * Math.cos(start), .52 * Math.sin(start)); shape.absarc(0, 0, .52, start, end, false)
      shape.lineTo(.468 * Math.cos(end), .468 * Math.sin(end)); shape.absarc(0, 0, .468, end, start, true); shape.closePath()
      const wall = new THREE.ExtrudeGeometry(shape, { depth: .20, bevelEnabled: false, curveSegments: 12 }); wall.translate(0, 0, -.10)
      add(wheel, `diabolo-wall-${i}-${n}`, wall, bamboo)
    }
  }
  const sticks = ['left', 'right'].map(side => {
    const stick = new THREE.Group(); stick.name = `diabolo-${side}-stick`; subject.add(stick)
    cylinderZ(stick, `diabolo-${side}-shaft`, .046, 1.04, bamboo)
    const grip = cylinderZ(stick, `diabolo-${side}-grip`, .10, .32, teal, .30)
    for (const z of [.17, .24, .31, .38, .45]) cylinderZ(stick, `diabolo-${side}-binding-${z}`, .102, .009, coral, z)
    cylinderZ(stick, `diabolo-${side}-tip`, .058, .04, inner, -.50)
    return { stick, grip }
  })
  const cordGeometry = new THREE.CylinderGeometry(.012, .012, 1, 6)
  const segments = Array.from({ length: 32 }, (_, i) => add(subject, `diabolo-cord-${i}`, cordGeometry, cordMat))
  const points = Array.from({ length: 33 }, () => new THREE.Vector3()), axis = new THREE.Vector3(0, 1, 0), difference = new THREE.Vector3()
  const pose = (at: number, n: number, repeat = false) => {
    n = THREE.MathUtils.clamp(n, 0, 1)
    const pull = at === 0 ? n : 1, toss = repeat ? 1 : at === 1 ? n : at > 1 ? 1 : 0, lower = at === 2 ? n : at > 2 ? 1 : 0
    const flight = at === 1 ? Math.sin(Math.PI * n) : 0
    const span = 1.25 + .35 * flight
    const leftY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.55, 1.68, toss), 1.30, lower)
    const rightY = THREE.MathUtils.lerp(THREE.MathUtils.lerp(1.55 + .35 * pull, 1.68, toss), 1.30, lower)
    sticks[0]!.stick.position.set(-span, leftY, 0); sticks[1]!.stick.position.set(span, rightY, 0)
    const baseline = THREE.MathUtils.lerp(THREE.MathUtils.lerp(.8 + .16 * pull, .85, toss), .65, lower)
    rotor.position.set(0, baseline + 1.25 * flight, -.5); rotor.rotation.z = Math.PI * (2.6 * pull + 4 * toss + (repeat ? 4 * n : 0) + 1.1 * lower)
    const ropeY = baseline + .20 * flight, radius = .091
    // Tangent segments meet a short lower arc around the axle. In flight that arc remains below the toy, ready to catch it.
    const leftAngle = Math.atan2(leftY - ropeY, -span) + Math.acos(radius / Math.hypot(span, leftY - ropeY))
    const rightAngle = Math.atan2(rightY - ropeY, span) - Math.acos(radius / Math.hypot(span, rightY - ropeY)) + Math.PI * 2
    const contact = (angle: number) => new THREE.Vector3(radius * Math.cos(angle), ropeY + radius * Math.sin(angle), -.5)
    const leftContact = contact(leftAngle), rightContact = contact(rightAngle)
    const leftTip = new THREE.Vector3(-span, leftY, -.5), rightTip = new THREE.Vector3(span, rightY, -.5)
    for (let i = 0; i <= 32; i++) {
      if (i <= 8) points[i]!.lerpVectors(leftTip, leftContact, i / 8)
      else if (i < 24) points[i]!.copy(contact(THREE.MathUtils.lerp(leftAngle, rightAngle, (i - 8) / 16)))
      else points[i]!.lerpVectors(rightContact, rightTip, (i - 24) / 8)
    }
    segments.forEach((segment, i) => {
      segment.position.copy(points[i]!).add(points[i + 1]!).multiplyScalar(.5)
      difference.subVectors(points[i + 1]!, points[i]!); segment.scale.y = difference.length(); segment.quaternion.setFromUnitVectors(axis, difference.normalize())
    })
    subject.updateMatrixWorld(true)
  }
  pose(0, 0)
  return { subject, pose, targets: [sticks[1]!.grip, sticks[0]!.grip, sticks[1]!.grip], roots: [sticks[1]!.stick, sticks[0]!.stick, sticks[1]!.stick], anchors: [[0, .09, 0], [0, .09, 0], [0, .09, 0]] as [number, number, number][] }
}
