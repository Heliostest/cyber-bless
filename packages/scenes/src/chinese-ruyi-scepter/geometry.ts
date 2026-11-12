import * as THREE from 'three'

// Product-original ruyi body: one closed swept solid from a rounded handle end,
// through an S-undulating handle with an oval section, to a raised cloud head
// turned toward the viewer. The lobes, rim and inner step are an original
// outline, not a named ornament or the form of any catalogued object.

const SECTION = 64
const ROLL = THREE.MathUtils.degToRad(-26)
const RISE = THREE.MathUtils.degToRad(36)
const HEAD = 1.3
/** Handle-side and head-side bearing points along the handle, before centring. */
const BEARINGS = [-0.42, 0.62] as const
const smooth = THREE.MathUtils.smoothstep
const mix = (a: number, b: number, t: number) => a + (b - a) * t
const smax = (a: number, b: number, k: number) => {
  if (a <= 0) return b
  if (b <= 0) return a
  const h = Math.max(k - Math.abs(a - b), 0) / k
  return Math.max(a, b) + h * h * k / 4
}

type Ring = { center: THREE.Vector3; tangent: THREE.Vector3; lateral: number; height: number; head: number; q: number; tail: number }

function centerline(x: number) { return .028 * -Math.cos(2 * Math.PI * (x - BEARINGS[0]) / (BEARINGS[1] - BEARINGS[0])) }

/** Lateral half-width of the cloud head at head distance q: two side lobes
 * set off the axis and one forward lobe, with soft notches between them. */
function headWidth(q: number, neck: number) {
  const s = q / HEAD
  const circle = (center: number, offset: number, r: number) => Math.abs(s - center) < r ? (offset + Math.sqrt(r * r - (s - center) ** 2)) * HEAD : 0
  const neckPart = neck * (1 - smooth(s, .09, .16))
  return smax(smax(neckPart, circle(.255, .15, .15), .02 * HEAD), circle(.50, 0, .19), .02 * HEAD)
}

function rings(): Ring[] {
  const out: Ring[] = []
  const tailX = 1.30, cap = .078, neckX = -0.50
  // Handle: from the round tail toward the neck (cosine spacing in the end cap).
  const handle = (x: number) => {
    const a0 = mix(.046, .072, smooth(x, neckX, .10)), b0 = mix(.036, .054, smooth(x, neckX, .10))
    const a = mix(a0, .072, smooth(x, .70, 1.16)), b = mix(b0, .056, smooth(x, .70, 1.16))
    const capT = x > tailX - cap ? (x - (tailX - cap)) / cap : 0, f = Math.sqrt(Math.max(0, 1 - capT * capT))
    return { a: a * f, b: b * f, tail: smooth(x, .95, 1.2) }
  }
  const xs: number[] = []
  for (let i = 1; i < 14; i++) xs.push(tailX - cap + cap * Math.cos(i / 14 * Math.PI / 2))
  for (let x = tailX - cap; x > neckX + 1e-6; x -= .02) xs.push(x)
  for (const x of xs) {
    const h = handle(x), slope = .028 * Math.sin(2 * Math.PI * (x - BEARINGS[0]) / (BEARINGS[1] - BEARINGS[0])) * 2 * Math.PI / (BEARINGS[1] - BEARINGS[0])
    out.push({ center: new THREE.Vector3(x, centerline(x) + h.b, 0), tangent: new THREE.Vector3(-1, -slope, 0).normalize(), lateral: h.a, height: h.b, head: 0, q: -1, tail: h.tail })
  }
  // Neck bend into a raised straight head axis.
  const neck = handle(neckX), slope0 = .028 * Math.sin(2 * Math.PI * (neckX - BEARINGS[0]) / (BEARINGS[1] - BEARINGS[0])) * 2 * Math.PI / (BEARINGS[1] - BEARINGS[0])
  const start = new THREE.Vector3(neckX, centerline(neckX) + neck.b, 0)
  const angle0 = Math.atan2(-slope0, 1), radius = .16, bend = Math.max(0, RISE - angle0) * radius
  const end = .69 * HEAD
  const samples: number[] = []
  for (let q = .012; q < end - .07; q += .007) samples.push(q)
  for (let i = 0; i < 18; i++) samples.push(end - .07 + .07 * Math.sin(i / 18 * Math.PI / 2))
  for (const q of samples) {
    let angle: number, center: THREE.Vector3
    if (q <= bend) {
      angle = angle0 + q / radius
      // Arc turning upward while travelling toward -x: start + R(-(sin a - sin a0), cos a0 - cos a).
      center = new THREE.Vector3(start.x - radius * (Math.sin(angle) - Math.sin(angle0)), start.y + radius * (Math.cos(angle0) - Math.cos(angle)), 0)
    } else {
      angle = RISE
      const bendEnd = new THREE.Vector3(start.x - radius * (Math.sin(RISE) - Math.sin(angle0)), start.y + radius * (Math.cos(angle0) - Math.cos(RISE)), 0)
      center = bendEnd.add(new THREE.Vector3(-Math.cos(RISE), Math.sin(RISE), 0).multiplyScalar(q - bend))
    }
    const w = headWidth(q, neck.a), s = q / HEAD
    const thick = mix(neck.b, .054 * HEAD, smooth(s, 0, .16))
    // Round the tip: thickness never exceeds the remaining half-width there.
    const t = Math.min(thick, w * .85 + .004 * (1 - smooth(s, .6, .69)))
    out.push({ center, tangent: new THREE.Vector3(-Math.cos(angle), Math.sin(angle), 0), lateral: w, height: t * (w > 1e-6 ? 1 : 0), head: smooth(s, .02, .16), q: s, tail: 0 })
  }
  return out
}

export function createRuyiBodyGeometry() {
  const list = rings(), positions: number[] = [], masks: number[] = [], index: number[] = []
  // Arc length for the travelling light.
  const lengths = [0]
  for (let i = 1; i < list.length; i++) lengths.push(lengths[i - 1]! + list[i]!.center.distanceTo(list[i - 1]!.center))
  const total = lengths[lengths.length - 1]!
  // Parallel-transported section frames: "up" begins as world up.
  let normal = new THREE.Vector3(0, 1, 0)
  const quaternion = new THREE.Quaternion(), lateral = new THREE.Vector3(), up = new THREE.Vector3(), point = new THREE.Vector3()
  let previous = list[0]!.tangent.clone()
  const tailPole = list[0]!.center.clone().addScaledVector(list[0]!.tangent, -Math.max(.002, 1.30 - list[0]!.center.x))
  positions.push(tailPole.x, tailPole.y, tailPole.z); masks.push(0, 0, 1, 0)
  list.forEach((ring, i) => {
    quaternion.setFromUnitVectors(previous, ring.tangent); normal.applyQuaternion(quaternion)
    normal.addScaledVector(ring.tangent, -normal.dot(ring.tangent)).normalize(); previous = ring.tangent.clone()
    const roll = ROLL * smooth(ring.q, .04, .24)
    up.copy(normal).applyAxisAngle(ring.tangent, roll)
    lateral.crossVectors(ring.tangent, up).normalize()
    const n = mix(2, 2.7, ring.head)
    for (let j = 0; j < SECTION; j++) {
      const theta = j / SECTION * Math.PI * 2, c = Math.cos(theta), s = Math.sin(theta)
      const u = Math.sign(c) * Math.abs(c) ** (2 / n), vRaw = Math.sign(s) * Math.abs(s) ** (2 / n)
      // Head top: a raised rim with an original shallow inner step following it.
      const fraction = Math.abs(u)
      const step = s > 0 ? mix(1, mix(.80, 1, smooth(fraction, .66, .73)), ring.head * smooth(ring.q, .10, .2)) : mix(1, .78, ring.head)
      point.copy(ring.center).addScaledVector(lateral, u * ring.lateral).addScaledVector(up, vRaw * ring.height * step)
      positions.push(point.x, point.y, point.z)
      const along = lengths[i]! / total
      const ridge = (1 - ring.head) * (1 - smooth(ring.tail, .6, 1)) * 1
      const lobeEdge = ring.head * smooth(fraction, .55, .85) + smooth(ring.q, .6, .69) * ring.head
      const translucent = Math.min(1, Math.max(lobeEdge, ring.tail))
      const topLobe = smooth(ring.q, .42, .50) * (1 - smooth(ring.q, .64, .69))
      masks.push(along, ridge, translucent, topLobe)
    }
  })
  const last = list[list.length - 1]!
  const headPole = last.center.clone().addScaledVector(last.tangent, Math.max(.002, .69 * HEAD - last.q * HEAD))
  positions.push(headPole.x, headPole.y, headPole.z); masks.push(1, 0, 1, 1)
  const ringStart = (i: number) => 1 + i * SECTION, poleEnd = 1 + list.length * SECTION
  for (let j = 0; j < SECTION; j++) index.push(0, ringStart(0) + (j + 1) % SECTION, ringStart(0) + j)
  for (let i = 0; i < list.length - 1; i++) for (let j = 0; j < SECTION; j++) {
    const a = ringStart(i) + j, b = ringStart(i) + (j + 1) % SECTION, c = ringStart(i + 1) + j, d = ringStart(i + 1) + (j + 1) % SECTION
    index.push(a, b, d, a, d, c)
  }
  const lastRing = ringStart(list.length - 1)
  for (let j = 0; j < SECTION; j++) index.push(poleEnd, lastRing + j, lastRing + (j + 1) % SECTION)
  const indexed = new THREE.BufferGeometry()
  indexed.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  indexed.setAttribute('ruyiMask', new THREE.Float32BufferAttribute(masks, 4))
  indexed.setIndex(index)
  // Outward winding: flip if the signed volume is negative.
  if (signedVolume(indexed) < 0) { const flipped = index.slice(); for (let i = 0; i < flipped.length; i += 3) [flipped[i + 1], flipped[i + 2]] = [flipped[i + 2]!, flipped[i + 1]!]; indexed.setIndex(flipped) }
  // Level both bearing points exactly onto the same plane, then rest it on y = 0.
  const p = indexed.getAttribute('position') as THREE.BufferAttribute
  for (let pass = 0; pass < 3; pass++) {
    const lows = BEARINGS.map(x => lowest(p, x))
    const [a, b] = lows as [[number, number], [number, number]]
    for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - (a[1] + (p.getX(i) - a[0]) * (b[1] - a[1]) / (b[0] - a[0])))
  }
  const supports = BEARINGS.map(x => lowest(p, x))
  const mid = (supports[0]![0] + supports[1]![0]) / 2
  for (let i = 0; i < p.count; i++) p.setX(i, p.getX(i) - mid)
  let min = Infinity
  for (let i = 0; i < p.count; i++) min = Math.min(min, p.getY(i))
  for (let i = 0; i < p.count; i++) p.setY(i, p.getY(i) - min)
  p.needsUpdate = true
  indexed.computeVertexNormals()
  indexed.computeBoundingBox(); indexed.computeBoundingSphere()
  // Cloud-head centre (for the drag anchor) in body coordinates.
  const head = new THREE.Vector3(), v = new THREE.Vector3(); let count = 0
  list.forEach((ring, i) => { if (ring.q > .15 && ring.q < .6) for (let j = 0; j < SECTION; j++) { head.add(v.fromBufferAttribute(p, 1 + i * SECTION + j)); count++ } })
  head.divideScalar(Math.max(1, count))
  return { body: indexed, supports: supports.map(([x]) => x - mid) as [number, number], head: head.toArray() as [number, number, number] }
}

function lowest(p: THREE.BufferAttribute, x: number): [number, number] {
  let best: [number, number] = [x, Infinity]
  for (let i = 0; i < p.count; i++) if (Math.abs(p.getX(i) - x) < .12 && Math.abs(p.getZ(i)) < .01 && p.getY(i) < best[1]) best = [p.getX(i), p.getY(i)]
  return best
}

function signedVolume(g: THREE.BufferGeometry) {
  const p = g.getAttribute('position'), i = g.getIndex()!, a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let v = 0
  for (let k = 0; k < i.count; k += 3) { a.fromBufferAttribute(p, i.getX(k)); b.fromBufferAttribute(p, i.getX(k + 1)); c.fromBufferAttribute(p, i.getX(k + 2)); v += a.dot(b.clone().cross(c)) / 6 }
  return v
}
