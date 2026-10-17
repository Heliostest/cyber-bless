import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original single-carp appreciation rig. Cloth and rope motion are illustrative. */
export function createKoinoboriModel() {
  const subject = new THREE.Group(); subject.name = 'koinobori-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc89a63, roughness: .82 })
  const metal = new THREE.MeshStandardMaterial({ color: 0xb1a175, metalness: .25, roughness: .55 })
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x796d50, roughness: .96 })
  const teal = new THREE.MeshStandardMaterial({ color: 0x3f9292, roughness: .94, side: THREE.DoubleSide })
  const cloth = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, side: THREE.DoubleSide })
  const cream = new THREE.MeshStandardMaterial({ color: 0xf4e1ad, roughness: .92 })
  const dark = new THREE.MeshStandardMaterial({ color: 0x294a50, roughness: .85 })
  const vermilion = new THREE.MeshStandardMaterial({ color: 0xcd6b4d, roughness: .91 })
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
  const rows = 48, columns = 48, positions = new Float32Array((rows + 1) * (columns + 1) * 3), colors = new Float32Array(positions.length), indices: number[] = []
  const baseColor = new THREE.Color(0x4d9c9d), paleColor = new THREE.Color(0xf0dcab), shadeColor = new THREE.Color(0x347276), redColor = new THREE.Color(0xcc7253)
  for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
    const u = i / rows, theta = j / columns * Math.PI * 2, stripe = Math.floor(j / columns * 8), x = (u * 7 + (stripe % 2) * .5) % 1, y = (j / columns * 8) % 1
    const edge = Math.sqrt((x - .5) ** 2 * 4 + (y - .22) ** 2 * 1.4)
    const color = u < .06 ? redColor : Math.cos(theta) < -.75 ? paleColor : u > .82 ? shadeColor : u > .24 && edge > .64 && edge < .86 ? paleColor : baseColor
    color.toArray(colors, (i * (columns + 1) + j) * 3)
    if (i < rows && j < columns) { const a = i * (columns + 1) + j, b = a + columns + 1; indices.push(a, a + 1, b, b, a + 1, b + 1) }
  }
  const bodyGeometry = new THREE.BufferGeometry(); bodyGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3)); bodyGeometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); bodyGeometry.setIndex(indices)
  add('koinobori-body', bodyGeometry, cloth, [0, 0, 0], fish)
  const tailGeometry = (front: boolean) => {
    const geometry = new THREE.BufferGeometry(), index: number[] = []
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(9 * 25 * 3), 3))
    for (let i = 0; i < 8; i++) for (let j = 0; j < 24; j++) { const a = i * 25 + j, b = a + 25; index.push(...(front ? [a, a + 1, b, b, a + 1, b + 1] : [a, b, a + 1, b, b + 1, a + 1])) }
    geometry.setIndex(index); return geometry
  }
  const tail = add('koinobori-tail', tailGeometry(true), teal, [0, 0, 0], fish)
  const rearTail = add('koinobori-tail-back', tailGeometry(false), teal, [0, 0, 0], fish)
  const tails = [tail, rearTail]
  const paint: { mesh: THREE.Mesh; source: Float32Array; side: number; offset: number }[] = []
  cream.side = dark.side = THREE.DoubleSide
  for (const side of [-1, 1]) {
    for (const [kind, radius, material, offset] of [['eye', .095, cream, .004], ['pupil', .055, dark, .006]] as const) {
      const mesh = add('koinobori-' + kind + '-' + side, new THREE.CircleGeometry(radius, 32), material, [0, 0, 0], fish)
      paint.push({ mesh, source: (mesh.geometry.getAttribute('position').array as Float32Array).slice(), side, offset })
    }
  }
  const ropeGeometry = new THREE.TubeGeometry(new THREE.LineCurve3(new THREE.Vector3(), new THREE.Vector3(0, 1, 0)), 96, .011, 6, false)
  const rope = add('koinobori-halyard', ropeGeometry, ropeMat, [0, 0, 0]); rope.userData.toonSurface = { outline: false }
  let length = 1.12, sag = .56, spread = .65
  const wave = (u: number, time: number) => { const w = Math.max(0, (u - .25) / .75) ** 2; return [.05 * Math.sin(time * 1.6 - u * 6) * w, .045 * Math.sin(time * 1.4 - u * 7) * w] }
  const radius = (u: number) => .32 * (1 - .55 * u) + .05 * Math.sin(u * Math.PI)
  function flutter(time: number) {
    const p = bodyGeometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= rows; i++) for (let j = 0; j <= columns; j++) {
      const u = i / rows, theta = j / columns * Math.PI * 2, r = radius(u), [wy, wz] = wave(u, time)
      p.setXYZ(i * (columns + 1) + j, length * u, -sag * u * u + r * Math.cos(theta) + wy!, r * Math.sin(theta) * (1 - (1 - spread) * Math.sin(u * Math.PI / 2)) + wz!)
    }
    p.needsUpdate = true; bodyGeometry.computeVertexNormals(); bodyGeometry.computeBoundingBox(); bodyGeometry.computeBoundingSphere()
    tails.forEach((t, index) => {
      const v = t.geometry.getAttribute('position') as THREE.BufferAttribute, [wy, wz] = wave(1, time)
      // Each root follows one half of the open elliptical rim, with matching angular samples.
      for (let i = 0; i <= 8; i++) for (let j = 0; j <= 24; j++) {
        const u = i / 8, theta = j * Math.PI / 24, h = Math.cos(theta)
        v.setXYZ(i * 25 + j, (.20 + .16 * Math.abs(h)) * u, THREE.MathUtils.lerp(radius(1) * h, .30 * h, u) + wy!, (index === 0 ? 1 : -1) * radius(1) * spread * Math.sin(theta) * (1 - .8 * u) + wz!)
      }
      v.needsUpdate = true; t.geometry.computeVertexNormals(); t.geometry.computeBoundingBox(); t.geometry.computeBoundingSphere()
    })
  }
  function pose(step: number, amount: number) {
    const p = THREE.MathUtils.clamp(step + (step === 3 ? 0 : amount), 0, 3), unfurl = Math.min(1, p), lift = THREE.MathUtils.clamp(p - 1, 0, 1), secure = Math.max(0, p - 2)
    length = 1.12 + .78 * unfurl; sag = .56 * (1 - .65 * lift); spread = .65 + .35 * lift
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
    flutter(0)
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
