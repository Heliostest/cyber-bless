import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original miniature geometry. Assembly is illustrative, not a structural simulation. */
export function createGerModel() {
  const subject = new THREE.Group(); subject.name = 'ger-subject'
  const wood = new THREE.MeshStandardMaterial({ color: 0xc77940, roughness: .79 })
  const lightWood = new THREE.MeshStandardMaterial({ color: 0xe8b976, roughness: .82 })
  const red = new THREE.MeshStandardMaterial({ color: 0xb9573e, roughness: .7 })
  const blue = new THREE.MeshStandardMaterial({ color: 0x397d87, roughness: .83 })
  const ropeMat = new THREE.MeshStandardMaterial({ color: 0x95724e, roughness: 1 })
  const pixels = new Uint8Array(64 * 64 * 4)
  for (let i = 0; i < 64 * 64; i++) {
    const n = 236 + ((i * 37 ^ i * 13 >> 3) & 15)
    pixels.set([n, n, n, 255], i * 4)
  }
  const weave = new THREE.DataTexture(pixels, 64, 64, THREE.RGBAFormat)
  weave.wrapS = weave.wrapT = THREE.RepeatWrapping; weave.repeat.set(8, 3); weave.needsUpdate = true
  const felt = new THREE.MeshStandardMaterial({ color: 0xf2ead4, map: weave, roughness: 1, vertexColors: true })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ = [0, 0, 0], parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.position.set(...p)
    m.castShadow = m.receiveShadow = true; parent.add(m); return m
  }
  const rodGeometry = new THREE.CylinderGeometry(1, 1, 1, 8)
  const beam = (name: string, material: THREE.Material, parent = subject) => add(name, rodGeometry, material, [0, 0, 0], parent)
  const up = new THREE.Vector3(0, 1, 0), a = new THREE.Vector3(), b = new THREE.Vector3(), dir = new THREE.Vector3()
  const between = (mesh: THREE.Mesh, start: XYZ, end: XYZ, radius: number) => {
    a.set(...start); b.set(...end); dir.subVectors(b, a)
    mesh.position.copy(a).add(b).multiplyScalar(.5); mesh.scale.set(radius, dir.length(), radius)
    mesh.quaternion.setFromUnitVectors(up, dir.normalize())
  }
  const floor = add('ger-wood-floor', new THREE.CylinderGeometry(1.31, 1.31, .075, 80), lightWood, [0, .0075, 0])
  floor.userData.toonSurface = { outline: false }
  // A shallow wooden floor contacts the environment at y=-.03.
  for (let i = -5; i <= 5; i++) {
    const x = i * .22, length = Math.sqrt(1.3 ** 2 - x ** 2) * 2
    const seam = add(`ger-floor-seam-${i}`, new THREE.BoxGeometry(.006, .003, length), wood, [x, .046, 0])
    seam.castShadow = false; seam.userData.toonSurface = { outline: false }
  }
  const lattice = new THREE.Group(); lattice.name = 'ger-lattice'; subject.add(lattice)
  const slats: { mesh: THREE.Mesh; start: number; end: number; reverse: boolean }[] = []
  const first = .30, last = Math.PI * 2 - .30
  for (let i = 0; i < 32; i++) for (const reverse of [false, true]) {
    const start = first + (last - first - .40) * i / 31
    slats.push({ mesh: beam(`ger-lattice-${i}-${reverse ? 'b' : 'a'}`, i % 3 ? wood : lightWood, lattice), start, end: start + .40, reverse })
  }
  const latticeGrip = add('ger-lattice-grip', new THREE.CylinderGeometry(.047, .047, .35, 16), red, [.7, .67, .86])
  const door = new THREE.Group(); door.name = 'ger-door-frame'; subject.add(door)
  for (const side of [-1, 1]) add(`ger-door-post-${side}`, new THREE.BoxGeometry(.07, 1.14, .095), red, [side * .35, .61, 1.19], door)
  add('ger-door-lintel', new THREE.BoxGeometry(.77, .095, .095), red, [0, 1.16, 1.19], door)
  add('ger-door-threshold', new THREE.BoxGeometry(.77, .055, .17), wood, [0, .068, 1.19], door)
  add('ger-door-leaf', new THREE.BoxGeometry(.62, 1.02, .035), blue, [0, .60, 1.19], door)
  for (const y of [.36, .84]) {
    add(`ger-door-inset-${y}`, new THREE.BoxGeometry(.43, .31, .018), lightWood, [0, y, 1.219], door)
    add(`ger-door-panel-${y}`, new THREE.BoxGeometry(.35, .23, .02), red, [0, y, 1.23], door)
    const diamond = add(`ger-door-diamond-${y}`, new THREE.BoxGeometry(.09, .09, .015), lightWood, [0, y, 1.248], door); diamond.rotation.z = Math.PI / 4
  }
  add('ger-door-handle', new THREE.TorusGeometry(.035, .008, 8, 20), ropeMat, [.23, .60, 1.25], door)
  const roof = new THREE.Group(); roof.name = 'ger-roof-frame'; subject.add(roof)
  const crown = add('ger-roof-crown', new THREE.TorusGeometry(.36, .052, 12, 64).rotateX(Math.PI / 2), red, [0, 1.22, 0], roof)
  const crownBars = [-.12, .12].map((x, i) => ({ x, mesh: beam(`ger-crown-crossbar-${i}`, lightWood, roof) }))
  const rafters = Array.from({ length: 36 }, (_, i) => ({ angle: (i + .5) / 36 * Math.PI * 2, mesh: beam(`ger-rafter-${i}`, i % 3 === 0 ? lightWood : wood, roof) }))
  const columns = [-1, 1].map(side => ({ side, mesh: beam(`ger-support-column-${side}`, red, roof) }))
  // Thin closed cloth shells: outer/inner surfaces and both hems; no filled roof opening.
  const shell = (name: string, lowerR: number, upperR: number, lowerY: number, upperY: number, start: number, span: number, isRoof: boolean) => {
    const positions: number[] = [], colors: number[] = [], uvs: number[] = [], indices: number[] = [], count = 96
    for (let i = 0; i <= count; i++) {
      const theta = start + span * i / count, ripple = .005 * Math.cos(theta * 36)
      for (const [j, [r, y]] of [[lowerR, lowerY], [upperR, upperY], [upperR - .018, upperY - .014], [lowerR - .018, lowerY]].entries()) {
        positions.push(Math.sin(theta) * (r + ripple), y, Math.cos(theta) * (r + ripple))
        const tone = .94 + .05 * Math.cos(theta * 18) ** 2 - (j > 1 ? .08 : 0)
        colors.push(tone, tone, tone); uvs.push(i / count, j % 3 === 0 ? 0 : 1)
      }
      if (i < count) for (let j = 0; j < 4; j++) {
        const k = i * 4 + j, next = i * 4 + (j + 1) % 4
        indices.push(k, k + 4, next, next, k + 4, next + 4)
      }
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3)); geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2)); geometry.setIndex(indices); geometry.computeVertexNormals()
    const mesh = add(name, geometry, felt); mesh.userData.toonSurface = { outline: isRoof }; return mesh
  }
  const wallCloth = shell('ger-wall-felt', 1.274, 1.274, .052, 1.195, .305, Math.PI * 2 - .61, false)
  const roofCloth = shell('ger-roof-felt', 1.34, .409, 1.19, 1.953, 0, Math.PI * 2, true)
  const feltRoll = add('ger-felt-roll', new THREE.CylinderGeometry(.13, .13, .79, 28).rotateZ(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xe8dcc1, map: weave, roughness: 1 }), [0, 2.13, .08])
  // Spiral ends make the rolled thickness readable without copied ornament.
  for (const side of [-1, 1]) {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 80; i++) { const t = i / 80, angle = t * Math.PI * 5, r = .015 + .102 * t; points.push(new THREE.Vector3(side * .401, Math.sin(angle) * r, Math.cos(angle) * r)) }
    const spiral = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 80, .004, 5, false), ropeMat); spiral.name = `ger-felt-roll-end-${side}`; feltRoll.add(spiral)
  }
  const ropes = new THREE.Group(); ropes.name = 'ger-binding-ropes'; subject.add(ropes)
  for (const y of [.42, .97]) {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 96; i++) { const t = .295 + i / 96 * (Math.PI * 2 - .59); points.push(new THREE.Vector3(Math.sin(t) * 1.29, y, Math.cos(t) * 1.29)) }
    const line = add(`ger-tension-rope-${y}`, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 96, .016, 8, false), ropeMat, [0, 0, 0], ropes)
    line.userData.toonSurface = { outline: false }
  }
  const eave = add('ger-eave-band', new THREE.CylinderGeometry(1.346, 1.347, .07, 96, 1, true), blue, [0, 1.19, 0], ropes)
  eave.material.side = THREE.DoubleSide
  for (const angle of [-.9, .9, Math.PI]) {
    const points: THREE.Vector3[] = []
    for (let i = 0; i <= 24; i++) { const t = i / 24, r = .42 + .92 * t; points.push(new THREE.Vector3(Math.sin(angle) * r, 1.964 - .755 * t, Math.cos(angle) * r)) }
    add(`ger-roof-tie-${angle}`, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), 24, .014, 8, false), ropeMat, [0, 0, 0], ropes)
  }
  const dropZones = new THREE.Group(); dropZones.name = 'ger-drop-zones'; subject.add(dropZones)
  const guideMaterial = new THREE.MeshBasicMaterial({ color: 0xe9ae49, transparent: true, opacity: .24, depthWrite: false, side: THREE.DoubleSide })
  const outlineMaterial = new THREE.MeshBasicMaterial({ color: 0xf7c96c, transparent: true, opacity: .8, depthWrite: false })
  const latticeDrop = add('ger-lattice-drop', new THREE.CylinderGeometry(.095,.095,.40,16), guideMaterial, [.8,.66,.946], dropZones)
  const crownDrop = add('ger-crown-drop', new THREE.TorusGeometry(.36,.016,8,64).rotateX(Math.PI/2), outlineMaterial, [0,1.94,0], dropZones)
  const feltDrop = new THREE.Group(); feltDrop.name = 'ger-felt-drop'; dropZones.add(feltDrop)
  for (const shell of [roofCloth,wallCloth]) {
    const guide = add(`${shell.name}-drop`,shell.geometry.clone(),guideMaterial,[0,0,0],feltDrop)
    guide.castShadow = guide.receiveShadow = false
    guide.userData.toonSurface = { outline: false }
  }
  latticeDrop.userData.toonSurface = crownDrop.userData.toonSurface = { outline: false }
  latticeDrop.castShadow = latticeDrop.receiveShadow = crownDrop.castShadow = crownDrop.receiveShadow = false
  const placements = [
    { object: latticeDrop, anchor: [0,.06,.042] as XYZ },
    { object: crownDrop, anchor: [0,.045,.355] as XYZ },
    { object: feltDrop, anchor: [.65,1.45,.78] as XYZ },
  ]
  let lastExpand = -1
  function pose(expand: number, lift: number, cover: number, checkpoint: number, held?: THREE.Vector3) {
    if (expand !== lastExpand) {
      lastExpand = expand
      const sx = .45 + .55 * expand, sz = .77 + .23 * expand
      for (const { mesh, start, end, reverse } of slats) between(mesh,
        [Math.sin(start) * 1.24 * sx, reverse ? 1.15 : .055, Math.cos(start) * 1.24 * sz],
        [Math.sin(end) * 1.24 * sx, reverse ? .055 : 1.15, Math.cos(end) * 1.24 * sz], .018)
    }
    latticeGrip.position.set(.80 * (.45+.55*expand), .66, .946 * (.77+.23*expand))
    if (checkpoint === 0 && held) latticeGrip.position.copy(held)
    latticeGrip.visible = checkpoint === 0
    roof.visible = checkpoint >= 1
    crown.position.set(0,1.22+.72*lift,0)
    if (checkpoint === 1 && held) crown.position.copy(held)
    const {x:cx,y:height,z:cz} = crown.position
    for (const { angle, mesh } of rafters) between(mesh, [cx+Math.sin(angle)*.36,height,cz+Math.cos(angle)*.36], [Math.sin(angle)*1.235,1.15,Math.cos(angle)*1.235], .022)
    for (const { side, mesh } of columns) between(mesh, [side*.28,.045,.22], [cx+side*.28,height-.02,cz+.22], .033)
    for (const { x, mesh } of crownBars) between(mesh, [cx+x,height,cz-.338], [cx+x,height,cz+.338], .017)
    wallCloth.visible = roofCloth.visible = cover > 0
    wallCloth.geometry.setDrawRange(0, Math.floor(cover * 96) * 24)
    roofCloth.geometry.setDrawRange(0, Math.floor(cover * 96) * 24)
    ropes.visible = cover >= 1
    feltRoll.position.set(0,2.13,.08)
    if (checkpoint === 2 && held) feltRoll.position.copy(held)
    feltRoll.visible = checkpoint === 2 && (!!held || cover < 1)
    feltRoll.scale.set(1, Math.max(.04, 1 - cover), Math.max(.04, 1 - cover))
    placements.forEach(({object},i) => { object.visible = checkpoint === i })
  }
  pose(0, 0, 0, 0)
  // Materials share this one owned map; disposeTree deliberately does not own textures.
  const highlightDrop = (ready: boolean) => {
    guideMaterial.color.set(ready ? 0x54ba8b : 0xe9ae49)
    outlineMaterial.color.set(ready ? 0x68d3a2 : 0xf7c96c)
  }
  return { subject, pose, placements, highlightDrop, disposeTexture: () => weave.dispose(), targets: [latticeGrip, crown, feltRoll], anchors: [[0, .06, .042], [0, .045, .355], [0, .06, .10]] as XYZ[] }
}
