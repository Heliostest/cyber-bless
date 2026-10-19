import * as THREE from 'three'

export function createPetanqueModel() {
  const subject = new THREE.Group(); subject.name = 'petanque-subject'
  const groundHeight = .04
  // Flat texture: the visible grains do not introduce unmodelled rolling obstacles.
  const pixels = new Uint8Array(128 * 128 * 4)
  let seed = 88
  for (let i = 0; i < 128 * 128; i++) {
    seed = (1664525 * seed + 1013904223) >>> 0
    const value = 201 + 2 * (seed >>> 28)
    pixels.set([value, value, value, 255], i * 4)
  }
  const earth = new THREE.DataTexture(pixels, 128, 128, THREE.RGBAFormat)
  earth.wrapS = earth.wrapT = THREE.RepeatWrapping; earth.repeat.set(4, 4)
  earth.magFilter = THREE.LinearFilter; earth.needsUpdate = true
  const courtGeometry = new THREE.CircleGeometry(1, 96)
  courtGeometry.rotateX(-Math.PI / 2); courtGeometry.scale(2.05, 1, 2.10)
  const court = new THREE.Mesh(courtGeometry, new THREE.MeshStandardMaterial({ color: '#d8c6a3', roughness: .96, map: earth }))
  court.name = 'petanque-earth'; court.position.y = groundHeight; court.receiveShadow = true; subject.add(court)
  const circle = new THREE.Mesh(new THREE.RingGeometry(.79, .808, 96), new THREE.MeshStandardMaterial({color: '#eee3bf', roughness: 1}))
  circle.geometry.rotateX(-Math.PI / 2); circle.name = 'petanque-chalk-circle'; circle.position.set(0, groundHeight + .001, 1.12); subject.add(circle)
  const starts = [new THREE.Vector2(0, 1.10), new THREE.Vector2(-.70, 1.20), new THREE.Vector2(.70, 1.20)]
  const ends = [new THREE.Vector2(0, -1.05), new THREE.Vector2(-.45, -.65), new THREE.Vector2(.43, -.83)]
  const bodies = [.13, .32, .32].map((radius, i) => {
    const geometry = new THREE.SphereGeometry(radius, 48, 32), p = geometry.getAttribute('position'), colors = new Float32Array(p.count * 3)
    const color = new THREE.Color()
    for (let j = 0; j < p.count; j++) {
      const x = p.getX(j), y = p.getY(j), z = p.getZ(j), latitude = y / radius
      const groove = i === 0 ? 0 : Math.max(...[-.375, 0, .375].map(band => Math.exp(-Math.pow((latitude - band) / .045, 2))))
      const scale = 1 - .009 * groove / radius
      p.setXYZ(j, x * scale, y * scale, z * scale)
      if (i === 0) color.setRGB(1, .88 + .06 * Math.sin(30 * x + 7 * z), .67 + .06 * Math.sin(30 * x + 7 * z))
      else color.setScalar(1 - .25 * groove)
      color.toArray(colors, j * 3)
    }
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3)); geometry.computeVertexNormals()
    const material = new THREE.MeshStandardMaterial({color: i === 0 ? '#d59b48' : '#9daba8', roughness: i === 0 ? .78 : .34, metalness: i === 0 ? 0 : .48, vertexColors: true})
    const mesh = new THREE.Mesh(geometry, material), root = new THREE.Group()
    mesh.name = i === 0 ? 'petanque-jack' : `petanque-boule-${i - 1}`; root.name = mesh.name + '-joint'
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh); subject.add(root)
    return {radius, mesh, root}
  })
  const support = new THREE.Vector3()
  const place = (i: number, n: number) => {
    const b = bodies[i]!, start = starts[i]!, end = ends[i]!, u = n === 1 ? 1 : 1 - (1 - n) ** 2
    const dx = end.x - start.x, dz = end.y - start.y, distance = Math.hypot(dx, dz) * u
    b.root.quaternion.setFromAxisAngle(new THREE.Vector3(dz, 0, -dx).normalize(), distance / b.radius)
    let minY = Infinity
    const vertices = b.mesh.geometry.getAttribute('position')
    for (let j = 0; j < vertices.count; j++) minY = Math.min(minY, support.fromBufferAttribute(vertices, j).applyQuaternion(b.root.quaternion).y)
    const loft = u > 0 && u < .32 ? .38 * Math.sin(Math.PI * u / .32) ** 2 : 0
    b.root.position.set(THREE.MathUtils.lerp(start.x, end.x, u), groundHeight - minY + .001 + loft, THREE.MathUtils.lerp(start.y, end.y, u))
    b.root.updateMatrix()
  }
  const pose = (at: number, n: number) => {
    const step = THREE.MathUtils.clamp(Math.floor(at), 0, 3), amount = THREE.MathUtils.clamp(n, 0, 1)
    bodies.forEach((_, i) => place(i, i < step ? 1 : i === step ? amount : 0))
    subject.updateMatrixWorld(true)
  }
  pose(0, 0)
  return {subject, court, groundHeight, bodies, jack: bodies[0]!.mesh, boules: bodies.slice(1).map(b => b.mesh), pose,
    targets: bodies.map(b => b.mesh), roots: bodies.map(b => b.root), anchors: bodies.map(() => [0, 0, 0] as [number, number, number])}
}
