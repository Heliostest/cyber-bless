import * as THREE from 'three'
import { mergeVertices, toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// Closed, outward, non-indexed solids with smooth (or creased) normals for the
// product-original lock necklace, carrier and case. Every part stays a real
// closed body: no open planes, no double-sided cards.

export type Vec2 = THREE.Vector2
/** A ring of the profile: an inward offset of the outline (`d`) or a scaled copy of
 * the last offset ring toward the centre (`s`), at height `y` above the base. */
export type ProfileRing = { d: number; y: number } | { s: number; y: number }

/** Smooth closed outline through control points, sampled evenly by arc length. */
export function closedOutline(points: [number, number][], samples: number) {
  const curve = new THREE.CatmullRomCurve3(points.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal')
  return curve.getSpacedPoints(samples).slice(0, samples).map(p => new THREE.Vector2(p.x, p.y))
}

/** Signed area; positive for counter-clockwise outlines. */
export function area(outline: Vec2[]) {
  let sum = 0
  for (let i = 0; i < outline.length; i++) { const a = outline[i]!, b = outline[(i + 1) % outline.length]!; sum += a.x * b.y - b.x * a.y }
  return sum / 2
}

/** Inward offset along smoothed vertex normals of a counter-clockwise outline. */
export function insetOutline(outline: Vec2[], d: number) {
  const n = outline.length
  return outline.map((p, i) => {
    const prev = outline[(i - 1 + n) % n]!, next = outline[(i + 1) % n]!
    const t = next.clone().sub(prev).normalize()
    return p.clone().add(new THREE.Vector2(-t.y, t.x).multiplyScalar(d))
  })
}

/** True when every ray from `center` crosses the ring once (angles keep turning one way). */
export function starShaped(ring: Vec2[], center: Vec2) {
  let turn = 0
  for (let i = 0; i < ring.length; i++) {
    const a = ring[i]!.clone().sub(center), b = ring[(i + 1) % ring.length]!.clone().sub(center)
    const step = Math.atan2(a.x * b.y - a.y * b.x, a.dot(b))
    if (step <= 0) return false
    turn += step
  }
  return Math.abs(turn - Math.PI * 2) < 1e-6
}

/** Builds a closed solid from a counter-clockwise outline in the plate plane. The
 * outline's +y maps to world -z, its x to world x, and heights to world +y. */
export function profiledSolid(outline: Vec2[], rings: ProfileRing[], options: { center?: Vec2; lift?: (ring: number, point: number, y: number) => number } = {}) {
  if (area(outline) <= 0) throw Error('outline must be counter-clockwise')
  const center = options.center ?? new THREE.Vector2(0, 0), n = outline.length
  let base = outline
  const loops: { points: Vec2[]; y: number }[] = []
  for (const ring of rings) {
    if ('d' in ring) { base = insetOutline(outline, ring.d); loops.push({ points: base, y: ring.y }) }
    else loops.push({ points: base.map(p => center.clone().add(p.clone().sub(center).multiplyScalar(ring.s))), y: ring.y })
  }
  for (const loop of loops) if (!starShaped(loop.points, center)) throw Error('profile ring folds over itself')
  const top: number[] = [], index: number[] = []
  const at = (k: number, i: number) => k * n + (i % n)
  loops.forEach((loop, k) => loop.points.forEach((p, i) => {
    const y = options.lift ? options.lift(k, i, loop.y) : loop.y
    top.push(p.x, y, -p.y)
  }))
  const last = loops.length - 1, apex = loops.length * n
  const apexY = loops[last]!.y
  top.push(center.x, options.lift ? options.lift(loops.length, 0, apexY) : apexY, -center.y)
  for (let k = 0; k < last; k++) for (let i = 0; i < n; i++) {
    const a = at(k, i), b = at(k, i + 1), c = at(k + 1, i + 1), d = at(k + 1, i)
    index.push(a, b, c, a, c, d)
  }
  for (let i = 0; i < n; i++) index.push(at(last, i), at(last, i + 1), apex)
  const surface = new THREE.BufferGeometry()
  surface.setAttribute('position', new THREE.Float32BufferAttribute(top, 3)); surface.setIndex(index)
  surface.computeVertexNormals()
  const smooth = surface.toNonIndexed(); surface.dispose()
  // Flat base under the first ring, as its own smoothing group.
  const floor: number[] = [], floorY = loops[0]!.y, first = loops[0]!.points
  for (let i = 0; i < n; i++) { const a = first[i]!, b = first[(i + 1) % n]!; floor.push(a.x, floorY, -a.y, center.x, floorY, -center.y, b.x, floorY, -b.y) }
  const positions = [...Array.from(smooth.getAttribute('position').array as Float32Array), ...floor]
  const normals = [...Array.from(smooth.getAttribute('normal').array as Float32Array), ...floor.map((_, j) => j % 3 === 1 ? -1 : 0)]
  smooth.dispose()
  return orient(positions, normals)
}

/** Positions plus normals into an outward, non-indexed geometry with no zero-area triangles. */
function orient(positions: number[], normals: number[]) {
  const a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  const keepP: number[] = [], keepN: number[] = []
  let volume = 0
  for (let i = 0; i < positions.length; i += 9) {
    a.fromArray(positions, i); b.fromArray(positions, i + 3); c.fromArray(positions, i + 6)
    if (b.clone().sub(a).cross(c.clone().sub(a)).lengthSq() < 1e-20) continue
    volume += a.dot(b.clone().cross(c)) / 6
    keepP.push(...positions.slice(i, i + 9)); keepN.push(...normals.slice(i, i + 9))
  }
  if (volume < 0) for (let i = 0; i < keepP.length; i += 9) for (let j = 0; j < 3; j++) {
    for (const list of [keepP, keepN]) { const v = list[i + 3 + j]!; list[i + 3 + j] = list[i + 6 + j]!; list[i + 6 + j] = v }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(keepP, 3))
  g.setAttribute('normal', new THREE.Float32BufferAttribute(keepN, 3))
  g.computeBoundingBox(); g.computeBoundingSphere()
  return g
}

/** Any closed source geometry into a welded, creased-normal, outward, non-indexed solid. */
export function creasedSolid(source: THREE.BufferGeometry, creaseDegrees = 40) {
  const copy = new THREE.BufferGeometry(); copy.setAttribute('position', source.getAttribute('position').clone())
  if (source.index) copy.setIndex(source.index.clone())
  const welded = mergeVertices(copy, 1e-5); copy.dispose()
  const creased = toCreasedNormals(welded, THREE.MathUtils.degToRad(creaseDegrees)); welded.dispose()
  const result = orient(Array.from(creased.getAttribute('position').array as Float32Array), Array.from(creased.getAttribute('normal').array as Float32Array))
  creased.dispose(); source.dispose()
  return result
}

/** A tube keeps its own smooth normals and uv, as an outward non-indexed solid. */
export function tubeSolid(source: THREE.TubeGeometry) {
  const flat = source.toNonIndexed(); source.dispose()
  const p = flat.getAttribute('position'), a = new THREE.Vector3(), b = new THREE.Vector3(), c = new THREE.Vector3()
  let volume = 0
  for (let i = 0; i < p.count; i += 3) { a.fromBufferAttribute(p, i); b.fromBufferAttribute(p, i + 1); c.fromBufferAttribute(p, i + 2); volume += a.dot(b.clone().cross(c)) / 6 }
  if (volume < 0) {
    for (const name of ['position', 'normal', 'uv']) {
      const attr = flat.getAttribute(name); const size = attr.itemSize, data = attr.array as Float32Array
      for (let i = 0; i < attr.count; i += 3) for (let j = 0; j < size; j++) { const v = data[(i + 1) * size + j]!; data[(i + 1) * size + j] = data[(i + 2) * size + j]!; data[(i + 2) * size + j] = v }
    }
  }
  flat.computeBoundingBox(); flat.computeBoundingSphere()
  return flat
}

/** Smooth, welded normals so an inverted hull stays closed around hard edges. */
export function shellGeometry(source: THREE.BufferGeometry) {
  const copy = new THREE.BufferGeometry(); copy.setAttribute('position', source.getAttribute('position').clone())
  const welded = mergeVertices(copy, 1e-5); copy.dispose()
  welded.computeVertexNormals(); welded.computeBoundingBox(); welded.computeBoundingSphere()
  return welded
}

/** A rounded rectangle outline (counter-clockwise), for slabs, the board and the case. */
export function roundedRect(width: number, depth: number, radius: number, perCorner = 8): Vec2[] {
  const w = width / 2 - radius, h = depth / 2 - radius, out: Vec2[] = []
  for (const [cx, cy, start] of [[w, -h, -Math.PI / 2], [w, h, 0], [-w, h, Math.PI / 2], [-w, -h, Math.PI]] as const)
    for (let i = 0; i <= perCorner; i++) { const a = start + i / perCorner * Math.PI / 2; out.push(new THREE.Vector2(cx + Math.cos(a) * radius, cy + Math.sin(a) * radius)) }
  return out
}

/** A slab with softly rounded top edges and a small foot chamfer. */
export function roundedSlab(width: number, depth: number, height: number, round: number, corner = Math.min(width, depth) * .08) {
  const outline = roundedRect(width, depth, corner)
  const r = round, steps = 5, rings: ProfileRing[] = [{ d: .006, y: 0 }, { d: 0, y: .006 }]
  for (let i = 0; i <= steps; i++) { const a = i / steps * Math.PI / 2; rings.push({ d: r * (1 - Math.cos(a)), y: height - r + Math.sin(a) * r }) }
  rings.push({ s: .7, y: height }, { s: .35, y: height })
  return profiledSolid(outline, rings)
}

/** A capsule between two points (radius r), for strokes and short links. */
export function capsuleBetween(a: THREE.Vector3, b: THREE.Vector3, r: number, radial = 10, cap = 3) {
  const length = a.distanceTo(b)
  const g = new THREE.CapsuleGeometry(r, Math.max(length, 1e-4), cap, radial)
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize()))
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2)
  return g
}

/** Concatenates closed parts into one non-indexed solid, keeping each part's own normals. */
export function mergeSolids(parts: THREE.BufferGeometry[]) {
  const positions: number[] = [], normals: number[] = []
  for (const part of parts) {
    const flat = part.index ? part.toNonIndexed() : part
    if (!flat.getAttribute('normal')) flat.computeVertexNormals()
    positions.push(...Array.from(flat.getAttribute('position').array as Float32Array)); normals.push(...Array.from(flat.getAttribute('normal').array as Float32Array))
    if (flat !== part) flat.dispose()
    part.dispose()
  }
  return orient(positions, normals)
}
