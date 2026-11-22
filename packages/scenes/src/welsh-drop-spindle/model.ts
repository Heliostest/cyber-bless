import * as THREE from 'three'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'

const _pt = new THREE.Vector3()
const _tan = new THREE.Vector3()
const _prevTan = new THREE.Vector3()
const _norm = new THREE.Vector3()
const _binorm = new THREE.Vector3()
const _quat = new THREE.Quaternion()
const _refZ = new THREE.Vector3(0, 0, 1)
const _refY = new THREE.Vector3(0, 1, 0)

/**
 * Deterministic cross-wound wool yarn texture for the spindle cop core
 * (no DOM/Canvas2D dependency): soft overlapping diagonal yarn grooves in warm unbleached wool tones.
 */
function createYarnCopTexture(): THREE.DataTexture {
  const size = 256
  const data = new Uint8Array(size * size * 4)
  for (let y = 0; y < size; y++) {
    const v = y / size
    for (let x = 0; x < size; x++) {
      const u = x / size
      // Soft opposing diagonal yarn grooves without harsh dot-grid aliasing.
      const a = Math.cos((u * 10 + v * 12) * Math.PI * 2)
      const b = Math.cos((u * 10 - v * 12) * Math.PI * 2)
      const fine = Math.sin((u * 34 + v * 42) * Math.PI * 2) * .22
      const ridge = (Math.max(a, b) * .65 + (a + b) * .175 + fine)
      const shoulder = Math.sin(v * Math.PI)
      const shade = ridge * 10 * (.65 + .35 * shoulder) - (1 - shoulder) * 9
      const i = (y * size + x) * 4
      data[i] = THREE.MathUtils.clamp(Math.round(233 + shade), 182, 248)
      data[i + 1] = THREE.MathUtils.clamp(Math.round(223 + shade * .95), 170, 240)
      data[i + 2] = THREE.MathUtils.clamp(Math.round(205 + shade * .90), 152, 224)
      data[i + 3] = 255
    }
  }
  const map = new THREE.DataTexture(data, size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.magFilter = map.minFilter = THREE.LinearFilter
  map.needsUpdate = true
  return map
}

/**
 * Closed outward-facing watertight deformed sphere (unique poles, no seam duplicates),
 * so every triangle edge is strictly paired with positive volume.
 */
function createClosedWoolLockGeometry(
  rx: number,
  ry: number,
  rz: number,
  seed: number,
  uSegs = 22,
  vSegs = 14,
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  const displace = (nx: number, ny: number, nz: number, theta: number, phi: number): [number, number, number] => {
    // Organic combed fleece locks with soft flowing vertical fiber ridges (strictly bounded at poles).
    const sin2 = Math.sin(phi) * Math.sin(phi)
    const comb =
      (.082 * Math.cos(theta * 8 + phi * 2.5 + seed) +
        .046 * Math.sin(theta * 5 - phi * 3.3 + seed * 1.7)) * sin2
    return [nx * rx * (1 + comb), ny * ry * (1 + .22 * comb), nz * rz * (1 + comb)]
  }
  // North pole (index 0)
  positions.push(0, ry, 0)
  for (let iv = 1; iv < vSegs; iv++) {
    const phi = (iv / vSegs) * Math.PI
    const sp = Math.sin(phi), cp = Math.cos(phi)
    for (let iu = 0; iu < uSegs; iu++) {
      const theta = (iu / uSegs) * Math.PI * 2
      const [x, y, z] = displace(sp * Math.cos(theta), cp, sp * Math.sin(theta), theta, phi)
      positions.push(x, y, z)
    }
  }
  // South pole
  const southIndex = positions.length / 3
  positions.push(0, -ry, 0)

  // Note: theta advances from +X toward +Z (clockwise around +Y), so outward winding is (0, next, curr).
  for (let iu = 0; iu < uSegs; iu++) {
    const curr = 1 + iu
    const next = 1 + ((iu + 1) % uSegs)
    indices.push(0, next, curr)
  }
  for (let iv = 0; iv < vSegs - 2; iv++) {
    const rowA = 1 + iv * uSegs
    const rowB = 1 + (iv + 1) * uSegs
    for (let iu = 0; iu < uSegs; iu++) {
      const n = (iu + 1) % uSegs
      const a = rowA + iu, b = rowA + n, c = rowB + iu, d = rowB + n
      indices.push(a, b, c, b, d, c)
    }
  }
  const lastRow = 1 + (vSegs - 2) * uSegs
  for (let iu = 0; iu < uSegs; iu++) {
    const curr = lastRow + iu
    const next = lastRow + ((iu + 1) % uSegs)
    indices.push(southIndex, curr, next)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Closed watertight fluted wool drafting cone flowing smoothly from the carded roving
 * underside (yTop) down to embrace the twisted yarn (yBot).
 */
function createClosedDraftingConeGeometry(
  yBot: number,
  yTop: number,
  rBot: number,
  rTop: number,
  radialSegs = 18,
  heightSegs = 12,
): THREE.BufferGeometry {
  const positions: number[] = []
  const indices: number[] = []
  // Bottom pole (index 0)
  positions.push(0, yBot, 0)
  for (let iy = 0; iy <= heightSegs; iy++) {
    const u = iy / heightSegs
    const y = THREE.MathUtils.lerp(yBot, yTop, u)
    const baseR = rBot + (rTop - rBot) * Math.pow(u, 1.45)
    for (let ir = 0; ir < radialSegs; ir++) {
      const theta = (ir / radialSegs) * Math.PI * 2
      const flute = 1 + .13 * Math.cos(theta * 7 + u * 5.8) * Math.sin(u * Math.PI)
      const r = baseR * flute
      positions.push(Math.cos(theta) * r, y, Math.sin(theta) * r)
    }
  }
  const topPole = positions.length / 3
  positions.push(0, yTop, 0)

  // Bottom cap (outward normal -Y)
  for (let ir = 0; ir < radialSegs; ir++) {
    const curr = 1 + ir
    const next = 1 + ((ir + 1) % radialSegs)
    indices.push(0, curr, next)
  }
  // Side quads (y increases upward, theta advances +X -> +Z, outward normal is +radial)
  for (let iy = 0; iy < heightSegs; iy++) {
    const rowA = 1 + iy * radialSegs
    const rowB = 1 + (iy + 1) * radialSegs
    for (let ir = 0; ir < radialSegs; ir++) {
      const n = (ir + 1) % radialSegs
      const a = rowA + ir, b = rowA + n, c = rowB + ir, d = rowB + n
      indices.push(a, c, b, b, c, d)
    }
  }
  // Top cap (outward normal +Y)
  const lastRow = 1 + heightSegs * radialSegs
  for (let ir = 0; ir < radialSegs; ir++) {
    const curr = lastRow + ir
    const next = lastRow + ((ir + 1) % radialSegs)
    indices.push(topPole, next, curr)
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/**
 * Builds topology for a closed watertight outward-facing 2-ply twisted yarn tube
 * (single start/end pole vertices, unique radial rings with no seam duplicate).
 */
function allocateClosedTubeGeometry(tubularSegs: number, radialSegs: number, dynamic = false): THREE.BufferGeometry {
  const vertexCount = 2 + (tubularSegs + 1) * radialSegs
  const positions = new Float32Array(vertexCount * 3)
  const indices: number[] = []

  // Start cap (normal along -tangent)
  for (let j = 0; j < radialSegs; j++) {
    const curr = 1 + j
    const next = 1 + ((j + 1) % radialSegs)
    indices.push(0, next, curr)
  }
  // Side rings (normal outward: (b-a) x (c-a) where a=(i,j), b=(i,j+1), c=(i+1,j))
  for (let i = 0; i < tubularSegs; i++) {
    const rowA = 1 + i * radialSegs
    const rowB = 1 + (i + 1) * radialSegs
    for (let j = 0; j < radialSegs; j++) {
      const n = (j + 1) % radialSegs
      const a = rowA + j, b = rowA + n, c = rowB + j, d = rowB + n
      indices.push(a, b, c, b, d, c)
    }
  }
  // End cap (normal along +tangent)
  const endPole = 1 + (tubularSegs + 1) * radialSegs
  const lastRow = 1 + tubularSegs * radialSegs
  for (let j = 0; j < radialSegs; j++) {
    const curr = lastRow + j
    const next = lastRow + ((j + 1) % radialSegs)
    indices.push(endPole, curr, next)
  }

  const geometry = new THREE.BufferGeometry()
  const posAttr = new THREE.BufferAttribute(positions, 3)
  if (dynamic) posAttr.setUsage(THREE.DynamicDrawUsage)
  geometry.setAttribute('position', posAttr)
  geometry.setIndex(indices)
  return geometry
}

/** Writes a 2-ply twisted closed tube along a CatmullRomCurve3 into a pre-allocated geometry. */
function writeClosedPliedTube(
  geometry: THREE.BufferGeometry,
  curve: THREE.CatmullRomCurve3,
  tubularSegs: number,
  radialSegs: number,
  baseRadius: number,
  turns: number,
  plyDepth: number,
  phase = 0,
  taperEnds = true,
): void {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  curve.updateArcLengths()
  curve.getTangentAt(0, _prevTan).normalize()
  const ref = Math.abs(_prevTan.dot(_refZ)) < .92 ? _refZ : _refY
  _norm.crossVectors(ref, _prevTan).normalize()
  _binorm.crossVectors(_prevTan, _norm).normalize()

  // Start pole slightly inset along -tangent so cap triangles are cleanly convex & nondegenerate.
  curve.getPointAt(0, _pt)
  posAttr.setXYZ(0, _pt.x - _prevTan.x * baseRadius * .35, _pt.y - _prevTan.y * baseRadius * .35, _pt.z - _prevTan.z * baseRadius * .35)

  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs
    curve.getPointAt(u, _pt)
    if (i > 0) {
      curve.getTangentAt(u, _tan).normalize()
      const dot = THREE.MathUtils.clamp(_prevTan.dot(_tan), -1, 1)
      if (dot < .999999) {
        if (dot > -.999999) {
          _quat.setFromUnitVectors(_prevTan, _tan)
          _norm.applyQuaternion(_quat)
        }
        _norm.addScaledVector(_tan, -_norm.dot(_tan))
        if (_norm.lengthSq() > 1e-10) _norm.normalize()
      }
      _binorm.crossVectors(_tan, _norm).normalize()
      _prevTan.copy(_tan)
    }
    const twist = u * turns * Math.PI * 2 + phase
    let endTaper = 1
    if (taperEnds) {
      const edge = Math.min(u, 1 - u)
      endTaper = .58 + .42 * THREE.MathUtils.smoothstep(edge, 0, .09)
    }
    for (let j = 0; j < radialSegs; j++) {
      const theta = (j / radialSegs) * Math.PI * 2
      const r = baseRadius * (1 + plyDepth * Math.cos(2 * (theta - twist))) * endTaper
      const nx = _norm.x * Math.cos(theta) + _binorm.x * Math.sin(theta)
      const ny = _norm.y * Math.cos(theta) + _binorm.y * Math.sin(theta)
      const nz = _norm.z * Math.cos(theta) + _binorm.z * Math.sin(theta)
      const idx = 1 + i * radialSegs + j
      posAttr.setXYZ(idx, _pt.x + nx * r, _pt.y + ny * r, _pt.z + nz * r)
    }
  }

  const endPole = 1 + (tubularSegs + 1) * radialSegs
  curve.getPointAt(1, _pt)
  posAttr.setXYZ(endPole, _pt.x + _prevTan.x * baseRadius * .35, _pt.y + _prevTan.y * baseRadius * .35, _pt.z + _prevTan.z * baseRadius * .35)
  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

/**
 * Rewrites the pre-allocated closed 2-ply vertical drafting yarn in-place along [yLow, yHigh]
 * with exact endpoints at yLow / yHigh and max radial extent < 0.0141.
 */
function writeVerticalDraftYarnInPlace(
  geometry: THREE.BufferGeometry,
  tubularSegs: number,
  radialSegs: number,
  yLow: number,
  yHigh: number,
  spinAngle: number,
): void {
  const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
  const span = Math.max(.05, yHigh - yLow)
  const turns = span * 15.5
  const baseRadius = .0116
  const plyDepth = .18

  // Bottom pole right at yLow (inside shaft tip / half-hitch).
  posAttr.setXYZ(0, 0, yLow, 0)
  for (let i = 0; i <= tubularSegs; i++) {
    const u = i / tubularSegs
    const y = THREE.MathUtils.lerp(yLow + .0018, yHigh - .0018, u)
    // Helical twist propagates upward from the spinning spindle tip toward the drafting cone.
    const twist = spinAngle * (1 - .22 * u) + u * turns * Math.PI * 2
    // Subtle fiber-draft swell near top where yarn emerges from the carded drafting cone.
    const topFlare = 1 + .025 * Math.pow(u, 3)
    const endTaper = i === 0 || i === tubularSegs ? .82 : 1
    for (let j = 0; j < radialSegs; j++) {
      const theta = (j / radialSegs) * Math.PI * 2
      const r = Math.min(.01395, baseRadius * topFlare * (1 + plyDepth * Math.cos(2 * (theta - twist))) * endTaper)
      // Right-handed around +Y: normal = (1,0,0), binormal = (0,0,-1) so tangent = +Y!
      const x = Math.cos(theta) * r
      const z = -Math.sin(theta) * r
      posAttr.setXYZ(1 + i * radialSegs + j, x, y, z)
    }
  }
  const endPole = 1 + (tubularSegs + 1) * radialSegs
  posAttr.setXYZ(endPole, 0, yHigh, 0)
  posAttr.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
}

function copOuterRadius(y: number): number {
  const u = THREE.MathUtils.clamp((y - 1.22) / .74, 0, 1)
  return .102 + .078 * Math.sin(Math.PI * Math.pow(u, .90))
}

function shaftRadiusAt(y: number): number {
  const u = THREE.MathUtils.clamp((y - .64) / 2.02, 0, 1)
  return THREE.MathUtils.lerp(.028, .040, u)
}

/** Original assisted spindle; visible feed length and yarn twist vary, rigid tool never scales. */
export function createDropSpindleModel() {
  const subject = new THREE.Group(); subject.name = 'spindle-subject'
  const tool = new THREE.Group(); tool.name = 'spindle-tool'; subject.add(tool)
  const wool = new THREE.Group(); wool.name = 'spindle-wool'; subject.add(wool)

  const woods = ['#c39452', '#d2aa6c', '#b88746'].map(color =>
    applyCraftSurface(new THREE.MeshStandardMaterial({ color, roughness: .84 }), { kind: 'wood', scale: 1.35, strength: .36, axis: 'y' }),
  )
  const dark = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#795735', roughness: .78 }), { kind: 'wood', scale: 1.5, strength: .32, axis: 'y' })
  // Cohesive warm unbleached carded fleece palette (gentle natural shade shifts without disjoint color blocks).
  const rovingLight = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#f1ead9', roughness: .98 }), { kind: 'fabric', scale: 2.3, strength: .36 })
  const rovingWarm = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#ede4d1', roughness: .98 }), { kind: 'fabric', scale: 2.3, strength: .36 })
  const rovingSoft = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#e8dec9', roughness: .98 }), { kind: 'fabric', scale: 2.3, strength: .38 })

  const copMap = createYarnCopTexture()
  const copCoreMat = applyCraftSurface(
    new THREE.MeshStandardMaterial({ color: '#ffffff', map: copMap, roughness: .96 }),
    { kind: 'cord', scale: 2.0, strength: .24 },
  )
  const yarnLight = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#efe6d5', roughness: .95 }), { kind: 'cord', scale: 2.6, strength: .34 })
  const yarnMid = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#e4d9c4', roughness: .96 }), { kind: 'cord', scale: 2.6, strength: .34 })
  const yarnWarm = applyCraftSurface(new THREE.MeshStandardMaterial({ color: '#d8cab1', roughness: .96 }), { kind: 'cord', scale: 2.6, strength: .34 })

  const mesh = (name: string, g: THREE.BufferGeometry, mat: THREE.Material | THREE.Material[], parent: THREE.Object3D = tool) => {
    const o = new THREE.Mesh(g, mat); o.name = name; o.castShadow = o.receiveShadow = true; parent.add(o); return o
  }
  const lathe = (points: number[][]) => new THREE.LatheGeometry(points.map(([r, y]) => new THREE.Vector2(r!, y!)), 64)

  // Rigid low-whorl wooden spindle (preserves exact whorl r=0.60, shaft y∈[0.64,2.66] and drag anchor).
  const shaft = mesh('spindle-shaft', new THREE.CylinderGeometry(.04, .028, 2.02, 32), woods[0]!)
  shaft.position.y = 1.65
  const whorlGeometry = lathe([[.026, 1], [.49, 1], [.6, 1.04], [.6, 1.12], [.49, 1.16], [.026, 1.16], [.026, 1]])
  whorlGeometry.clearGroups()
  for (let i = 0; i < 16; i++) whorlGeometry.addGroup(i * 144, 144, i % 3)
  const whorl = mesh('spindle-whorl', whorlGeometry, woods)
  const marker = mesh('spindle-grain', new THREE.CylinderGeometry(.032, .032, .012, 20), dark)
  marker.position.set(.38, 1.16, -.16)

  // Annular yarn cop core (strictly clears the central shaft axis) + opposing `/` and `\` cross-wound wool wraps.
  const profile: number[][] = [[.024, 1.21], [.068, 1.21]]
  for (let i = 0; i <= 18; i++) {
    const u = i / 18
    const y = 1.22 + .74 * u
    const ripple = Math.sin(u * Math.PI * 10) * .0028 * Math.sin(u * Math.PI)
    profile.push([copOuterRadius(y) + ripple, y])
  }
  profile.push([.068, 1.97], [.024, 1.97], [.024, 1.21])
  const cop = mesh('spindle-yarn-cop', lathe(profile), copCoreMat)

  // 16 opposing diagonal wraps (8 right-hand `/` inner passes + 8 left-hand `\` outer passes)
  // whose ends tuck smoothly inside the cop shoulders with zero blunt stubs.
  const copWrapMats = [yarnLight, yarnMid, yarnWarm] as const
  const wrapCount = 16
  for (let w = 0; w < wrapCount; w++) {
    const outerLayer = w >= 8
    const dir = outerLayer ? -1 : 1
    const idxInLayer = w % 8
    const baseAngle = (idxInLayer / 8) * Math.PI * 2 + (outerLayer ? .22 : 0)
    const pts: THREE.Vector3[] = []
    const steps = 20
    for (let s = 0; s <= steps; s++) {
      const u = s / steps
      const y = THREE.MathUtils.lerp(1.232, 1.956, u)
      const angle = baseAngle + u * Math.PI * 1.28 * dir
      const belly = Math.sin(u * Math.PI)
      // Tuck ends cleanly inside the cop shoulders while seating full thickness across the belly.
      const layerLift = (outerLayer ? .0072 : .0025) * belly
      const endTuck = -.012 * Math.pow(1 - belly, 2.2)
      const r = Math.max(.058, copOuterRadius(y) + layerLift + endTuck)
      pts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r))
    }
    const g = allocateClosedTubeGeometry(28, 7)
    writeClosedPliedTube(g, new THREE.CatmullRomCurve3(pts), 28, 7, .0118, 8.0, .16, w * .75, true)
    const wrap = mesh(`spindle-cop-wrap-${w}`, g, copWrapMats[w % 3]!)
    wrap.userData.toonSurface = { outline: false }
  }

  // Continuous 2-ply wool leader emerging directly out of the upper cop shoulder, hugging the wooden shaft
  // tightly (zero floating air loop) up into a snug spindle-tip half-hitch joining `spindle-feed`.
  const leaderPts: THREE.Vector3[] = []
  const leaderSteps = 38
  for (let i = 0; i <= leaderSteps; i++) {
    const u = i / leaderSteps
    const y = THREE.MathUtils.lerp(1.915, 2.602, u)
    const angle = u * Math.PI * 4.6
    // Seat flush onto the wooden shaft immediately as the yarn leaves the cop shoulder (by y≈1.98).
    const shoulderBlend = Math.exp(-u * 20)
    const r = shaftRadiusAt(y) + .0082 + shoulderBlend * .052
    leaderPts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r))
  }
  // Snug half-hitch loop tightly hugging the upper shaft collar and leading smoothly into the tip center.
  const hitchAngle0 = Math.PI * 4.6
  for (let i = 1; i <= 12; i++) {
    const u = i / 12
    const angle = hitchAngle0 + u * Math.PI * 2.2
    const y = THREE.MathUtils.lerp(2.604, 2.638, u)
    const r = shaftRadiusAt(y) + .0092 * (1 - .12 * u)
    leaderPts.push(new THREE.Vector3(Math.cos(angle) * r, y, Math.sin(angle) * r))
  }
  leaderPts.push(
    new THREE.Vector3(Math.cos(hitchAngle0 + Math.PI * 2.35) * .028, 2.648, Math.sin(hitchAngle0 + Math.PI * 2.35) * .028),
    new THREE.Vector3(0, 2.654, 0),
  )
  const leaderGeo = allocateClosedTubeGeometry(60, 8)
  writeClosedPliedTube(leaderGeo, new THREE.CatmullRomCurve3(leaderPts), 60, 8, .0112, 16, .17, .4, false)
  const leader = mesh('spindle-leader', leaderGeo, yarnLight)
  leader.userData.toonSurface = { outline: false }

  // Pre-allocated closed 2-ply twisted drafting yarn (in-place update, zero per-frame allocations).
  const FEED_TUBULAR = 44
  const FEED_RADIAL = 9
  const threadGeo = allocateClosedTubeGeometry(FEED_TUBULAR, FEED_RADIAL, true)
  const thread = mesh('spindle-feed', threadGeo, yarnMid, subject)
  thread.userData.toonSurface = { outline: false }

  // Sculpted combed carded-wool roving locks + tapered drafting cone (kept strictly inside baseline bounds
  // x∈[-0.285,0.285], y∈[2.94,3.47], z∈[-0.185,0.255] so auto-fit camera stays bit-for-bit identical).
  const lockSpecs: { pos: [number, number, number]; radii: [number, number, number]; rot: [number, number, number]; mat: THREE.Material; seed: number }[] = [
    { pos: [0, 3.19, .005], radii: [.154, .142, .138], rot: [.06, .2, -.05], mat: rovingWarm, seed: .3 },
    { pos: [-.104, 3.185, .005], radii: [.118, .114, .112], rot: [-.05, .45, .20], mat: rovingWarm, seed: 1.4 },
    { pos: [.104, 3.175, .010], radii: [.118, .112, .112], rot: [.04, -.45, -.20], mat: rovingSoft, seed: 2.5 },
    { pos: [0, 3.31, 0], radii: [.126, .160, .126], rot: [0, 0, 0], mat: rovingLight, seed: 3.7 },
    { pos: [0, 3.21, .084], radii: [.120, .114, .110], rot: [.12, -.30, .08], mat: rovingLight, seed: 4.9 },
    { pos: [-.048, 3.265, .064], radii: [.098, .092, .092], rot: [.10, 1.8, -.12], mat: rovingWarm, seed: 6.1 },
    { pos: [.052, 3.255, .058], radii: [.092, .090, .088], rot: [.08, -1.5, .14], mat: rovingLight, seed: 7.3 },
  ]
  const tufts = lockSpecs.map((spec, i) => {
    const o = mesh(
      `spindle-wool-${i}`,
      createClosedWoolLockGeometry(spec.radii[0], spec.radii[1], spec.radii[2], spec.seed),
      spec.mat,
      wool,
    )
    o.position.set(...spec.pos)
    o.rotation.set(...spec.rot)
    return o
  })
  // Tapered fibrous drafting cone blending smoothly out of the carded fleece into the twisted yarn.
  const draftingCone = mesh(
    'spindle-drafting-cone',
    createClosedDraftingConeGeometry(2.942, 3.175, .0152, .098, 18, 12),
    rovingWarm,
    wool,
  )
  draftingCone.userData.toonSurface = { outline: false }

  function pose(step: number, n: number) {
    const t = THREE.MathUtils.clamp(Number.isFinite(n) ? n : 0, 0, 1)
    const spinAngle = step === 0 ? 1.5 * Math.PI * t : 1.5 * Math.PI
    tool.rotation.y = spinAngle
    tool.position.y = step === 1 ? -.35 * t : step === 2 ? -.35 * (1 - t) : 0
    if (tool.position.y === 0) tool.position.y = 0
    const low = 2.65 + tool.position.y
    const high = 3.06
    writeVerticalDraftYarnInPlace(threadGeo, FEED_TUBULAR, FEED_RADIAL, low, high, spinAngle)
    subject.updateMatrixWorld(true)
  }
  pose(0, 0)

  return {
    subject, tool, wool, shaft, whorl, marker, cop, leader, thread, tufts, draftingCone, pose,
    disposeTextures: () => copMap.dispose(),
    targets: [whorl, whorl, whorl],
    roots: [whorl, whorl, whorl],
    anchors: [[.43, 1.163, .15], [.43, 1.163, .15], [.43, 1.163, .15]] as [number, number, number][],
  }
}
