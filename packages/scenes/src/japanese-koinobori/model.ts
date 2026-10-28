import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { createKoinoboriPrint } from './cloth-print'

type XYZ = [number, number, number]
/** Original single-carp appreciation rig. Cloth and rope motion are illustrative. */
export function createKoinoboriModel() {
  const subject = new THREE.Group(); subject.name = 'koinobori-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: .82 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xb1a175, metalness: .25, roughness: .55 })
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x796d50, roughness: .96 })
  const print = createKoinoboriPrint()
  const cloth = createRitualMaterial({ map: print, roughness: .94, side: THREE.DoubleSide }, { kind: 'cloth', strength: .22, fiber: 'linen' })
  cloth.addEventListener('dispose', () => print.dispose())
  const cream = new THREE.MeshStandardMaterial({ color: 0xf4e1ad, roughness: .92 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x294a50, roughness: .85 })
  const vermilion = new THREE.MeshStandardMaterial({ color: 0xcd6b4d, roughness: .91 })
  const gold = new THREE.MeshStandardMaterial({ color: 0xd6af60, roughness: .92, side: THREE.DoubleSide })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ, parent: THREE.Object3D = subject) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p); mesh.castShadow = mesh.receiveShadow = true; parent.add(mesh); return mesh
  }
  add('koinobori-foot', new THREE.CylinderGeometry(.28, .36, .12, 32), wood, [-1.05, .02, -.2])
  add('koinobori-pole', new THREE.CylinderGeometry(.048, .068, 3.05, 24), wood, [-1.05, 1.585, -.2])
  add('koinobori-finial', new THREE.SphereGeometry(.08, 20, 12), metal, [-1.05, 3.14, -.2])
  const axle = add('koinobori-pulley-axle', new THREE.CylinderGeometry(.03, .03, .26, 16), metal, [-1.05, 3, -.10]); axle.rotation.x = Math.PI / 2
  const wheel = add('koinobori-pulley', new THREE.CylinderGeometry(.160, .160, .04, 32), wood, [-1.05, 3, 0]); wheel.rotation.x = Math.PI / 2
  for (const z of [-.026, .026]) add('koinobori-pulley-rim-' + z, new THREE.TorusGeometry(.167, .009, 6, 40), metal, [-1.05, 3, z])
  add('koinobori-cleat-support', new THREE.BoxGeometry(.08, .18, .40), wood, [-1.05, .42, -.025])
  add('koinobori-cleat', new THREE.BoxGeometry(.30, .08, .30), wood, [-1.05, .42, .13])
  for (const x of [-.10, .10]) add('koinobori-cleat-prong-' + x, new THREE.CylinderGeometry(.022, .025, .14, 12), wood, [-1.05 + x, .53, .25])
  const toggle = add('koinobori-toggle', new THREE.CylinderGeometry(.065, .075, .20, 24), wood, [-1.30, 1.75, .12])
  const fish = new THREE.Group(); fish.name = 'koinobori-fish'; subject.add(fish)
  const mouth = add('koinobori-mouth', new THREE.TorusGeometry(.32, .024, 8, 48), vermilion, [0, 0, 0], fish); mouth.rotation.y = Math.PI / 2
  add('koinobori-bridle-knot', new THREE.SphereGeometry(.03, 12, 8), ropeMat, [-.38, 0, 0], fish)
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3, end = new THREE.Vector3(0, .32 * Math.cos(a), .32 * Math.sin(a))
    const bridle = add('koinobori-bridle-' + i, new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(-.38, 0, 0), end), 1, .009, 6, false), ropeMat, [0, 0, 0], fish)
    bridle.userData.toonSurface = { outline: false }
  }
  const rows = 48, columns = 48, positions = new Float32Array((rows + 1) * (columns + 1) * 3), uvs = new Float32Array((rows + 1) * (columns + 1) * 2), indices: number[] = []
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
    uvs.set([.9 * i / rows, j / columns], (i * (columns + 1) + j) * 2)
    if (i < rows && j < columns) { const a = i * (columns + 1) + j, b = a + columns + 1; indices.push(a, a + 1, b, b, a + 1, b + 1) }
  }
  const bodyGeometry = new THREE.BufferGeometry(); bodyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); bodyGeometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2)); bodyGeometry.setIndex(indices)
  add('koinobori-body', bodyGeometry, cloth, [0, 0, 0], fish)
  const tailGeometry = (front: boolean) => {
    const geometry = new THREE.BufferGeometry(), index: number[] = []
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 25 * 3), 3))
    const uv = new Float32Array(9 * 25 * 2)
    for (let i = 0; i <= 8; i++) for (let j = 0; j <= 24; j++) uv.set([.9 + .1 * i / 8, front ? j / 48 : 1 - j / 48], (i * 25 + j) * 2)
    geometry.setAttribute('uv', new THREE.BufferAttribute(uv, 2))
    for (let i = 0; i < 8; i++) for (let j = 0; j < 24; j++) { const a = i * 25 + j, b = a + 25; index.push(...(front ? [a, a + 1, b, b, a + 1, b + 1] : [a, b, a + 1, b, b + 1, a + 1])) }
    geometry.setIndex(index); return geometry
  }
  const tail = add('koinobori-tail', tailGeometry(true), cloth, [0, 0, 0], fish)
  const rearTail = add('koinobori-tail-back', tailGeometry(false), cloth, [0, 0, 0], fish)
  const tails = [tail, rearTail]
  const paint: { mesh: THREE.Mesh; source: Float32Array; side: number; offset: number }[] = []
  cream.side = dark.side = vermilion.side = THREE.DoubleSide
  for (const side of [-1, 1]) {
    for (const [kind, geometry, material, offset] of [
      ['eye', new THREE.RingGeometry(0, .12, 48, 4), cream, .004],
      ['eye-rim', new THREE.RingGeometry(.096, .113, 48), vermilion, .005],
      ['iris', new THREE.RingGeometry(0, .087, 48, 3), gold, .005],
      ['pupil', new THREE.RingGeometry(0, .058, 48, 3), dark, .006],
      ['eye-light', new THREE.RingGeometry(0, .016, 24, 2).translate(-.018, .021, 0), cream, .00615],
    ] as const) {
      const mesh = add('koinobori-' + kind + '-' + side, geometry, material, [0, 0, 0], fish)
      mesh.userData.toonSurface = { outline: false }
      paint.push({ mesh, source: (mesh.geometry.getAttribute('position').array as Float32Array).slice(), side, offset })
    }
  }
  const ropeGeometry = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), 96, .011, 6, false)
  const rope = add('koinobori-halyard', ropeGeometry, ropeMat, [0, 0, 0]); rope.userData.toonSurface = { outline: false }
  let length = 1.12, sag = .56, spread = .65, wind = .18
  const wave = (u: number, time: number) => {
    // Keep the painted head and mouth fixed; a travelling bend grows toward the free end.
    const w = wind * Math.max(0, (u - .28) / .72) ** 1.6
    return [w * (.18 * Math.sin(time * 2.5 - u * 7) + .035 * Math.sin(time * 4.3 - u * 11.5)),
      w * (.22 * Math.sin(time * 2.1 - u * 6.5) + .035 * Math.sin(time * 3.6 - u * 11))]
  }
  const radius = (u: number) => .32 * (1 - .55 * u) + .05 * Math.sin(u * Math.PI)
  function flutter(time: number) {
    const p = bodyGeometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= rows; i++) {
      const u = i / rows, r = radius(u), [wy, wz] = wave(u, time)
      for (let j = 0; j <= columns; j++) {
        const theta = j / columns * Math.PI * 2
        p.setXYZ(i * (columns + 1) + j, length * u, -sag * u * u + r * Math.cos(theta) + wy!, r * Math.sin(theta) * (1 - (1 - spread) * Math.sin(u * Math.PI / 2)) + wz!)
      }
    }
    p.needsUpdate = true; bodyGeometry.computeVertexNormals(); bodyGeometry.computeBoundingBox(); bodyGeometry.computeBoundingSphere()
    tails.forEach((t, index) => {
      const v = t.geometry.getAttribute('position') as THREE.BufferAttribute, [wy, wz] = wave(1, time)
      // Each root follows one half of the open elliptical rim, with matching angular samples.
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 24; j++) {
        const u = i / 8, theta = j * Math.PI / 24, h = Math.cos(theta)
        const flap = wind * u * u * h * (.08 * Math.sin(time * 4.1 - u * 2) + .035 * Math.sin(time * 2.6 + theta * 2))
        v.setXYZ(i * 25 + j, (.20 + .16 * Math.abs(h)) * u, THREE.MathUtils.lerp(radius(1) * h, .30 * h, u) + wy! + flap * .45, (index === 0 ? 1 : -1) * radius(1) * spread * Math.sin(theta) * (1 - .8 * u) + wz! + flap)
      }
      v.needsUpdate = true; t.geometry.computeVertexNormals(); t.geometry.computeBoundingBox(); t.geometry.computeBoundingSphere()
    })
  }
  function pose(step: number, amount: number, time = 0) {
    const p = THREE.MathUtils.clamp(step + (step === 3 ? 0 : amount), 0, 3), unfurl = Math.min(1, p), lift = THREE.MathUtils.clamp(p - 1, 0, 1), secure = Math.max(0, p - 2)
    length = 1.12 + .78 * unfurl; sag = .56 * (1 - .65 * lift); spread = .65 + .35 * lift
    wind = (.18 + .82 * lift * lift * (3 - 2 * lift)) * (.45 + .55 * unfurl)
    fish.position.set(-.50, 1.05 + 1.15 * lift, 0)
    const seating = THREE.MathUtils.smoothstep(secure, .22, .74)
    toggle.position.set(-1.30 + .25 * seating, 1.75 - 1.15 * lift - .04 * seating + .20 * Math.sin(Math.PI * secure), .12 + .13 * seating)
    for (const t of tails) t.position.set(length, -sag, 0)
    paint.forEach(({ mesh, source, side, offset }) => {
      mesh.position.set(length * .15, -sag * .15 ** 2, 0)
      const v = mesh.geometry.getAttribute('position') as THREE.BufferAttribute
      for (let i = 0; i < v.count; i++) {
        const x = source[i * 3]!, y = source[i * 3 + 1]!, u = (mesh.position.x + x) / length, r = radius(u), h = (mesh.position.y + y + sag * u * u) / r
        const z = r * Math.sqrt(Math.max(0, 1 - h * h)) * (1 - (1 - spread) * Math.sin(u * Math.PI / 2))
        v.setXYZ(i, x, y, side * (z + offset))
      }
      v.needsUpdate = true; mesh.geometry.computeVertexNormals(); mesh.geometry.computeBoundingBox(); mesh.geometry.computeBoundingSphere()
    })
    flutter(time)
    // One line passes over the real pulley. Its two ends move equal and opposite while hoisting.
    const from = new THREE.Vector3(-.88, fish.position.y, 0), top = new THREE.Vector3(-.88, 3, 0), end = toggle.position.clone().add(new THREE.Vector3(0, .10, 0))
    const descend = new THREE.CubicBezierCurve3(new THREE.Vector3(-1.22, 3, 0), new THREE.Vector3(-1.22, 2, .05), new THREE.Vector3(-1.30, end.y + .24, .12 + .20 * secure), end)
    const sample = (t: number) => t < .35 ? from.clone().lerp(top, t / .35) : t < .50 ? new THREE.Vector3(-1.05 + .17 * Math.cos((t - .35) / .15 * Math.PI), 3 + .17 * Math.sin((t - .35) / .15 * Math.PI), 0) : descend.getPoint((t - .50) / .50)
    const v = ropeGeometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= 96; i++) {
      const t = i / 96, c = sample(t), tangent = sample(Math.min(1, t + .0001)).sub(sample(Math.max(0, t - .0001))).normalize(), normal = new THREE.Vector3().crossVectors(tangent, Math.abs(tangent.y) > .9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)).normalize(), binormal = new THREE.Vector3().crossVectors(tangent, normal)
      for (let j = 0; j <= 6; j++) { const a = j * Math.PI / 3, q = c.clone().addScaledVector(normal, .011 * Math.cos(a)).addScaledVector(binormal, .011 * Math.sin(a)); v.setXYZ(i * 7 + j, q.x, q.y, q.z) }
    }
    v.needsUpdate = true; ropeGeometry.computeVertexNormals(); ropeGeometry.computeBoundingBox(); ropeGeometry.computeBoundingSphere()
  }
  pose(0, 0)
  return { subject, pose, flutter, targets: [tail, toggle, toggle], anchors: [[.26, .18, .02], [0, 0, .065], [0, 0, .065]] as XYZ[] }
}
