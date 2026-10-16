import * as THREE from 'three'

type XYZ = [number, number, number]
/** Original compact seven-rod suanpan. Only decimal bead values are historical claims. */
export function createSuanpanModel() {
  const subject = new THREE.Group(); subject.name = 'abacus-subject'
  const frame = new THREE.MeshStandardMaterial({ color: 0x80513b, roughness: .72 })
  const grain = new THREE.MeshStandardMaterial({ color: 0xa76c47, roughness: .82 })
  const bamboo = new THREE.MeshStandardMaterial({ color: 0xd5af6b, roughness: .76 })
  const beadWood = new THREE.MeshStandardMaterial({ color: 0xb77339, roughness: .64 })
  const unitWood = new THREE.MeshStandardMaterial({ color: 0xdca75a, roughness: .66 })
  const brass = new THREE.MeshStandardMaterial({ color: 0xbfa15f, roughness: .37, metalness: .65 })
  const add = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material, p: XYZ) => {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = name; mesh.position.set(...p)
    mesh.castShadow = mesh.receiveShadow = true; subject.add(mesh); return mesh
  }
  const box = (name: string, size: XYZ, material: THREE.Material, p: XYZ) => add(name, new THREE.BoxGeometry(...size), material, p)
  // Open frame lies directly on the paving; its lower face is y=-.03.
  for (const side of [-1, 1]) box(`abacus-frame-${side < 0 ? 'left' : 'right'}`, [.18, .20, 2.42], frame, [side * 1.35, .07, .1])
  for (const [name, z] of [['top', -1.06], ['bottom', 1.26]] as const) box(`abacus-frame-${name}`, [2.88, .20, .16], frame, [0, .07, z])
  box('abacus-counting-beam', [2.55, .17, .12], frame, [0, .085, -.24])
  // Quiet longitudinal grain and small original corner fittings, no copied ornament.
  for (const z of [-1.06, 1.26]) for (const offset of [-.045, .035]) box(`abacus-rail-grain-${z}-${offset}`, [2.34, .002, .003], grain, [0, .171, z + offset])
  for (const x of [-1.35, 1.35]) for (const z of [-1.06, 1.26]) {
    box(`abacus-brass-cross-${x}-${z}`, [.30, .012, .075], brass, [x - Math.sign(x) * .06, .179, z])
    box(`abacus-brass-side-${x}-${z}`, [.075, .012, .27], brass, [x, .179, z - Math.sign(z - .1) * .065])
    const pin = add(`abacus-corner-pin-${x}-${z}`, new THREE.CylinderGeometry(.019, .019, .008, 12), brass, [x, .191, z]); pin.userData.toonSurface = { outline: false }
  }
  const profile = [[.028, -.074], [.079, -.070], [.118, -.037], [.128, 0], [.118, .037], [.079, .070], [.028, .074], [.028, -.074]].map(([r, z]) => new THREE.Vector2(r, z))
  const beadGeometry = new THREE.LatheGeometry(profile, 32).rotateX(Math.PI / 2)
  const rodGeometry = new THREE.CylinderGeometry(.017, .017, 2.18, 12).rotateX(Math.PI / 2)
  const lower: THREE.Mesh[][] = [], upper: THREE.Mesh[][] = []
  for (let col = 0; col < 7; col++) {
    const x = (col - 3) * .36, material = col === 6 ? unitWood : beadWood
    const rod = add(`abacus-bamboo-rod-${col}`, rodGeometry, bamboo, [x, .115, .10]); rod.userData.toonSurface = { outline: false }
    upper[col] = Array.from({ length: 2 }, (_, row) => add(`abacus-upper-${col}-${row}`, beadGeometry, material, [x, .115, -.86 + row * .16]))
    lower[col] = Array.from({ length: 5 }, (_, row) => add(`abacus-lower-${col}-${row}`, beadGeometry, material, [x, .115, .41 + row * .16]))
  }
  // A small brass dot marks the units rod in this authored teaching model.
  add('abacus-unit-dot', new THREE.CylinderGeometry(.024, .024, .004, 20), brass, [1.08, .173, -.24])
  function pose(three: number, five: number, ten: number) {
    for (let row = 0; row < 3; row++) lower[6]![row]!.position.z = .41 + row * .16 - .51 * three
    upper[6]![1]!.position.z = -.70 + .32 * five
    lower[5]![0]!.position.z = .41 - .51 * ten
  }
  pose(0, 0, 0)
  return { subject, pose, targets: [lower[6]![2]!, upper[6]![1]!, lower[5]![0]!], anchors: [[0, .11, 0], [0, .11, 0], [0, .11, 0]] as XYZ[] }
}
