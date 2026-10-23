import * as THREE from 'three'

/** Original painted miniature and market supports; no copied collection object or ceremonial pattern. */
export function createAlasitaModel() {
  const root = new THREE.Group(); root.name = 'alasita-subject'
  const material = (color: number, roughness = .82, metalness = 0) => new THREE.MeshStandardMaterial({ color, roughness, metalness })
  const wall = material(0x74b1a9), roof = material(0xb96043), tile = material(0xd47c54), trim = material(0xf2e5c4)
  const glass = material(0x355774, .38), door = material(0x286c73), foundation = material(0xddd2b7), brass = material(0xc9a65c, .45, .3)
  const wood = material(0x9f7956), edge = material(0x72533e), felt = material(0xd7ba72), alternate = material(0xe4c78a)
  const clean = (source: THREE.BufferGeometry) => {
    const raw = source.index ? source.toNonIndexed() : source, p = raw.getAttribute('position'), values: number[] = []
    for (let i = 0; i < p.count; i += 3) {
      const a = new THREE.Vector3().fromBufferAttribute(p, i), b = new THREE.Vector3().fromBufferAttribute(p, i + 1), c = new THREE.Vector3().fromBufferAttribute(p, i + 2)
      if (new THREE.Triangle(a, b, c).getArea() > 1e-12) values.push(...a.toArray(), ...b.toArray(), ...c.toArray())
    }
    const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(values, 3)); geometry.computeVertexNormals()
    if (raw !== source) raw.dispose(); source.dispose(); return geometry
  }
  const mesh = (name: string, geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D = root) => {
    const object = new THREE.Mesh(clean(geometry), mat); object.name = name; object.castShadow = object.receiveShadow = true; parent.add(object); return object
  }
  const box = (name: string, position: [number, number, number], size: [number, number, number], mat: THREE.Material, parent: THREE.Object3D = root) => {
    const object = mesh(name, new THREE.BoxGeometry(...size), mat, parent); object.position.set(...position); return object
  }
  const makeHouse = (prefix: string, paint: THREE.Material) => {
    const house = new THREE.Group(); house.name = prefix; root.add(house)
    const base = box(prefix + '-foundation', [0, .035, .04], [1.42, .07, 1.12], foundation, house)
    box(prefix + '-body', [0, .43, 0], [1.20, .72, .90], paint, house)
    box(prefix + '-lower-band', [0, .115, 0], [1.22, .075, .92], trim, house)
    const shape = new THREE.Shape(); shape.moveTo(-.68, .77); shape.lineTo(.68, .77); shape.lineTo(0, 1.17); shape.closePath()
    const roofMesh = mesh(prefix + '-roof', new THREE.ExtrudeGeometry(shape, { depth: 1.08, bevelEnabled: false, steps: 1 }), roof, house); roofMesh.position.z = -.54
    for (let i = -6; i <= 6; i++) {
      const x = i * .10, y = .77 + .40 * (1 - Math.abs(x) / .68)
      const ridge = mesh(prefix + '-tile-ridge-' + i, new THREE.CylinderGeometry(.017, .017, 1.10, 8), tile, house)
      ridge.rotation.x = Math.PI / 2; ridge.position.set(x, y + .007, 0)
    }
    box(prefix + '-front-eave', [0, .778, .548], [1.40, .055, .055], trim, house)
    box(prefix + '-back-eave', [0, .778, -.548], [1.40, .055, .055], trim, house)
    box(prefix + '-door-frame', [.28, .315, .468], [.30, .49, .052], trim, house)
    box(prefix + '-door', [.28, .305, .501], [.235, .455, .028], door, house)
    const knob = mesh(prefix + '-door-knob', new THREE.SphereGeometry(.021, 12, 8), brass, house); knob.position.set(.35, .31, .533)
    box(prefix + '-doorstep', [.28, .105, .625], [.38, .07, .23], foundation, house)
    const window = (name: string, position: [number, number, number], angle: number) => {
      const group = new THREE.Group(); group.name = name; group.position.set(...position); group.rotation.y = angle; house.add(group)
      box(name + '-frame', [0, 0, .015], [.31, .31, .046], trim, group)
      box(name + '-glass', [0, 0, .040], [.245, .245, .020], glass, group)
      box(name + '-mullion', [0, 0, .054], [.018, .245, .016], trim, group)
      box(name + '-transom', [0, 0, .054], [.245, .018, .016], trim, group)
      box(name + '-sill', [0, -.17, .038], [.36, .045, .095], trim, group)
    }
    window(prefix + '-front-window', [-.28, .49, .45], 0)
    window(prefix + '-left-window', [-.60, .48, 0], -Math.PI / 2)
    window(prefix + '-right-window', [.60, .48, 0], Math.PI / 2)
    window(prefix + '-back-window', [0, .48, -.45], Math.PI)
    const attic = mesh(prefix + '-attic-inset', new THREE.CylinderGeometry(.062, .062, .026, 16), glass, house); attic.rotation.x = Math.PI / 2; attic.position.set(0, .925, .548)
    return { house, base }
  }
  const benchTop = box('stall-counter', [0, .46, -.90], [3.20, .08, 1.50], wood)
  for (const x of [-1.44, 1.44]) for (const z of [-1.50, -.30]) box(`stall-leg-${x}-${z}`, [x, .21, z], [.13, .42, .13], edge)
  box('stall-front-edge', [0, .45, -.14], [3.24, .12, .055], edge)
  const pad = box('front-felt-pad', [.15, .06, .90], [2.20, .12, 2.10], felt)
  box('pad-front-binding', [.15, .067, 1.93], [2.20, .125, .04], trim)
  const { house, base } = makeHouse('wish-house', wall)
  const a = makeHouse('display-house-a', alternate).house; a.scale.setScalar(.24); a.position.set(1.05, .50, -1.12)
  const b = makeHouse('display-house-b', wall).house; b.scale.setScalar(.18); b.position.set(.95, .50, -.50)
  const start = new THREE.Vector3(-.38, .50, -.98), lifted = new THREE.Vector3(-.38, .92, .30), end = new THREE.Vector3(.15, .12, .90)
  const interpolate = (from: THREE.Vector3, to: THREE.Vector3, n: number) => from.clone().lerp(to, THREE.MathUtils.clamp(n, 0, 1))
  const pose = (step: number, amount: number) => {
    const t = THREE.MathUtils.clamp(amount, 0, 1); house.rotation.set(0, 0, 0); house.position.copy(start)
    if (step === 0) {
      const high = start.clone().setY(lifted.y)
      house.position.copy(t < .45 ? interpolate(start, high, t / .45) : interpolate(high, lifted, (t - .45) / .55))
    } else if (step === 1) { house.position.copy(lifted); house.rotation.y = t * Math.PI / 3 }
    else {
      house.rotation.y = Math.PI / 3
      const over = end.clone().setY(lifted.y)
      house.position.copy(step >= 3 ? end : t < .60 ? interpolate(lifted, over, t / .60) : interpolate(over, end, (t - .60) / .40))
    }
    root.updateMatrixWorld(true)
  }
  pose(0, 0)
  return { root, house, base, pad, benchTop, start, lifted, end, pose, targets: [house, house, house], roots: [house, house, house], anchors: [[.28, .35, .52], [.28, .35, .52], [.28, .35, .52]] as [number, number, number][], dispose() {} }
}
