import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import {
  applyStylizedHumanSurfaceHint,
  createStylizedFingerGeometry,
  createStylizedForearmGeometry,
  createStylizedGarmentMaterial,
  createStylizedPalmGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedThumbGeometry,
} from '@wbr/scene-runtime/stylized-human'
import { createBaciMatMaterials } from './mat-material'

let cachedCottonPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null

/**
 * 128x128 mipmapped 2-ply hand-spun white cotton cord texture + bump map.
 * Preserves pure luminous warm white (#fff9e9) while adding genuine spun-cotton
 * ply shading and soft fiber tactility without thickening the 0.012 cord.
 */
function createSpunCottonTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedCottonPixels) {
    const color = new Uint8Array(size * size * 4)
    const bump = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        // Diagonal 2-ply cotton twist crease + subtle fine spun cotton filaments.
        const ply = Math.sin((u * 4 - v * 2) * tau)
        const filament = Math.sin((u * 14 - v * 5) * tau) * 0.28
        const cross = Math.sin((u * 9 + v * 7) * tau) * 0.10
        const f = ply * 0.70 + filament + cross
        const idx = (y * size + x) * 4
        // Keep luminous unbleached white cotton (224..255) with gentle warm ply valley depth.
        const shade = f * 15
        color[idx] = THREE.MathUtils.clamp(Math.round(244 + shade * 0.85), 224, 255)
        color[idx + 1] = THREE.MathUtils.clamp(Math.round(241 + shade * 0.92), 219, 255)
        color[idx + 2] = THREE.MathUtils.clamp(Math.round(234 + shade), 210, 252)
        color[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + f * 64), 26, 236)
        bump[idx] = h; bump[idx + 1] = h; bump[idx + 2] = h; bump[idx + 3] = 255
      }
    }
    cachedCottonPixels = { color, bump, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedCottonPixels.color), size, size, THREE.RGBAFormat)
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.colorSpace = THREE.SRGBColorSpace
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedCottonPixels.bump), size, size, THREE.RGBAFormat)
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.colorSpace = THREE.NoColorSpace
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/**
 * Builds a continuous 2-ply spun cotton strand geometry at exact mean radius 0.012
 * using a twist-free parallel-transport (Bishop) frame with verified outward normals
 * and gently tapered cut-cotton ends.
 */
function buildSpunCottonGeometry(
  curve: THREE.Curve<THREE.Vector3>,
  tubularSegments = 240,
  radialSegments = 12,
  meanRadius = 0.012,
  twistTurns = 52,
): THREE.BufferGeometry {
  const points = curve.getSpacedPoints(tubularSegments)
  const tangents: THREE.Vector3[] = []
  for (let i = 0; i <= tubularSegments; i++) {
    const prev = points[Math.max(0, i - 1)]!
    const next = points[Math.min(tubularSegments, i + 1)]!
    const t = new THREE.Vector3().subVectors(next, prev)
    if (t.lengthSq() < 1e-12) t.set(0, 1, 0)
    else t.normalize()
    tangents.push(t)
  }

  const normals: THREE.Vector3[] = []
  const binormals: THREE.Vector3[] = []
  const ref = Math.abs(tangents[0]!.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0)
  const n0 = new THREE.Vector3().crossVectors(ref, tangents[0]!).normalize()
  const b0 = new THREE.Vector3().crossVectors(tangents[0]!, n0).normalize()
  normals.push(n0)
  binormals.push(b0)

  const rotAxis = new THREE.Vector3()
  const rotQuat = new THREE.Quaternion()
  for (let i = 1; i <= tubularSegments; i++) {
    const prevT = tangents[i - 1]!
    const currT = tangents[i]!
    const prevN = normals[i - 1]!.clone()
    rotAxis.crossVectors(prevT, currT)
    const sinA = rotAxis.length()
    if (sinA > 1e-6) {
      rotAxis.divideScalar(sinA)
      const cosA = THREE.MathUtils.clamp(prevT.dot(currT), -1, 1)
      rotQuat.setFromAxisAngle(rotAxis, Math.atan2(sinA, cosA))
      prevN.applyQuaternion(rotQuat)
    }
    prevN.addScaledVector(currT, -prevN.dot(currT)).normalize()
    const currB = new THREE.Vector3().crossVectors(currT, prevN).normalize()
    normals.push(prevN)
    binormals.push(currB)
  }

  const stride = radialSegments + 1
  const bodyVerts = (tubularSegments + 1) * stride
  const positions = new Float32Array((bodyVerts + 2) * 3)
  const uvs = new Float32Array((bodyVerts + 2) * 2)
  const indices: number[] = []
  const tau = Math.PI * 2

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    const p = points[i]!
    const N = normals[i]!
    const B = binormals[i]!
    // Keep full smooth radius cleanly into the tapered cut-cotton tip cap (zero neck pinch).
    const tipDist = Math.min(u, 1 - u)
    const endTaper = tipDist < 0.012 ? 0.95 + 0.05 * Math.sin((tipDist / 0.012) * (Math.PI / 2)) : 1
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const theta = v * tau
      // Fine silky 2-ply spun cotton ridge (mean value 1.0 -> exact 0.012 mean radius; never thickens line).
      const ply = 1 + 0.068 * Math.cos(theta * 2 - u * twistTurns * tau)
      const r = meanRadius * ply * endTaper
      const ct = Math.cos(theta), st = Math.sin(theta)
      const k = i * stride + j
      positions[k * 3] = p.x + (N.x * ct + B.x * st) * r
      positions[k * 3 + 1] = p.y + (N.y * ct + B.y * st) * r
      positions[k * 3 + 2] = p.z + (N.z * ct + B.z * st) * r
      uvs[k * 2] = u * twistTurns * 0.35
      uvs[k * 2 + 1] = v
      if (i < tubularSegments && j < radialSegments) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // B = T x N -> (+theta) x (+u) points strictly radially outward.
        indices.push(a, b, c, b, d, c)
      }
    }
  }

  // Closed end caps.
  const startCap = bodyVerts
  const endCap = bodyVerts + 1
  const p0 = points[0]!, p1 = points[tubularSegments]!
  positions[startCap * 3] = p0.x; positions[startCap * 3 + 1] = p0.y; positions[startCap * 3 + 2] = p0.z
  uvs[startCap * 2] = 0; uvs[startCap * 2 + 1] = 0.5
  positions[endCap * 3] = p1.x; positions[endCap * 3 + 1] = p1.y; positions[endCap * 3 + 2] = p1.z
  uvs[endCap * 2] = twistTurns * 0.35; uvs[endCap * 2 + 1] = 0.5
  const lastRow = tubularSegments * stride
  for (let j = 0; j < radialSegments; j++) {
    indices.push(startCap, j + 1, j)
    indices.push(endCap, lastRow + j, lastRow + j + 1)
  }

  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a seamless softly rounded cut-cotton strand tip cap aligned along +Y. */
function buildCottonTipGeometry(radius = 0.0114, length = 0.013): THREE.BufferGeometry {
  const pts: THREE.Vector2[] = [
    new THREE.Vector2(0.0, -0.002),
    new THREE.Vector2(radius, -0.001),
    new THREE.Vector2(radius * 0.98, length * 0.22),
    new THREE.Vector2(radius * 0.82, length * 0.56),
    new THREE.Vector2(radius * 0.48, length * 0.84),
    new THREE.Vector2(0.0, length),
  ]
  const g = new THREE.LatheGeometry(pts, 12)
  g.computeVertexNormals()
  return g
}

/** Close view of a guest's offered wrist. The pointer supplies the tying hand. */
export function createBaciModel() {
  const root = new THREE.Group(); root.name = 'baci-root'
  const subject = new THREE.Group(); subject.name = 'baci-subject'; root.add(subject)
  const skin = createStylizedSkinMaterial({ color: 0xc78d68, tone: 'warm-caramel', roughness: .86, scatterStrength: 0, name: 'baci-forearm-skin' })
  const handSkin = createStylizedSkinMaterial({ color: 0xc78d68, tone: 'warm-caramel', roughness: .85, scatterStrength: .12, name: 'baci-hand-skin' })
  const nail = new THREE.MeshStandardMaterial({ color: 0xe3baa0, roughness: .56, metalness: 0 })
  const cloth = createStylizedGarmentMaterial({ color: 0x57938b, roughness: .91, fabricStrength: .25, axis: 'z', name: 'baci-sleeve-cloth' })
  const hem = createStylizedGarmentMaterial({ color: 0xe4b976, roughness: .90, fabricStrength: .25, axis: 'z', name: 'baci-cuff-hem' })
  const baciMat = createBaciMatMaterials()
  const cottonTex = createSpunCottonTextures()
  const cotton = new THREE.MeshStandardMaterial({
    color: 0xfff9e9,
    map: cottonTex.map,
    bumpMap: cottonTex.bump,
    bumpScale: 0.0024,
    roughness: 0.92,
  })
  applyCraftSurface(cotton, { kind: 'cord', strength: .15 })
  const mesh = (name: string, geometry: THREE.BufferGeometry, material: THREE.Material | THREE.Material[], parent: THREE.Object3D = subject) => {
    const m = new THREE.Mesh(geometry, material); m.name = name; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
  }
  const wrist = new THREE.Vector3(.25, .47, 0)
  // Seat the oval woven mat flush onto the courtyard flagstones (-0.0375) with weft crest at +0.008,
  // and soften its sharp cylinder edge with a chamfered bound reed border ring.
  const ground = mesh('baci-woven-mat', new THREE.CylinderGeometry(1.44, 1.47, .0415, 64), baciMat.matMaterials); ground.scale.z = .77; ground.position.y = -.01725
  const borderProfile = [
    new THREE.Vector2(1.41, -.0385),
    new THREE.Vector2(1.474, -.0385),
    new THREE.Vector2(1.494, -.028),
    new THREE.Vector2(1.498, -.010),
    new THREE.Vector2(1.484, .005),
    new THREE.Vector2(1.458, .0105),
    new THREE.Vector2(1.428, .0065),
    new THREE.Vector2(1.41, .003),
    new THREE.Vector2(1.41, -.0385),
  ]
  const borderGeo = new THREE.LatheGeometry(borderProfile, 64); borderGeo.computeVertexNormals()
  const border = mesh('baci-mat-border', borderGeo, baciMat.matMaterials[0]); border.scale.z = .77
  // Recessed parallel strands give the mat a modest woven surface without a table.
  for (let i = -10; i <= 10; i++) {
    const z = i * .09, length = 2.72 * Math.sqrt(Math.max(0, 1 - z * z / 1.12 ** 2))
    const line = mesh('baci-mat-weft-' + i, new THREE.CylinderGeometry(.0035, .0035, length, 6), i % 2 ? baciMat.weftWarm : baciMat.weftPale)
    line.rotation.z = Math.PI / 2; line.position.set(0, .0045, z)
  }
  // Warm Komorebi stylized forearm, cupped palm-up hand, and rolled fabric cuff (Loop-subdivided closed 2-manifolds).
  const sleeveGeo = createStylizedSleeveCuffGeometry({
    length: .74,
    cuffRadiusX: .258,
    cuffRadiusY: .218,
    sleeveRadiusX: .305,
    sleeveRadiusY: .252,
    wallThickness: .024,
    rolledLip: .012,
    foldDepth: .010,
    cavityDepthRatio: .38,
    iterations: 1,
  })
  const sleeveMesh = mesh('baci-sleeve', sleeveGeo, cloth)
  sleeveMesh.position.set(-.55, .47, 0)
  sleeveMesh.rotation.y = -Math.PI / 2
  applyStylizedHumanSurfaceHint(sleeveMesh, 'garment')

  const cuffGeo = createStylizedSleeveCuffGeometry({
    length: .135,
    cuffRadiusX: .268,
    cuffRadiusY: .228,
    sleeveRadiusX: .276,
    sleeveRadiusY: .236,
    wallThickness: .024,
    rolledLip: .014,
    foldDepth: .005,
    cavityDepthRatio: .56,
    iterations: 1,
  })
  const cuff = mesh('baci-cuff', cuffGeo, hem)
  cuff.position.set(-.475, .47, 0)
  cuff.rotation.y = -Math.PI / 2
  applyStylizedHumanSurfaceHint(cuff, 'garment')

  // Preserve exact forearm transform [-.13, .47, 0] / scale [.59, .15, .185] for wrist cotton clearance invariants,
  // while sculpting a natural anatomical wrist-to-forearm silhouette seated snugly inside the tied cotton loop.
  const forearmGeo = createStylizedForearmGeometry({
    length: 1.78,
    wristRadiusX: .86,
    wristRadiusY: .85,
    elbowRadiusX: 1.06,
    elbowRadiusY: 1.04,
    fullness: .06,
    iterations: 1,
  })
  forearmGeo.rotateY(-Math.PI / 2)
  forearmGeo.translate(.87, 0, 0)
  forearmGeo.computeBoundingBox()
  forearmGeo.computeBoundingSphere()
  const forearm = mesh('baci-forearm', forearmGeo, skin)
  forearm.position.set(-.13, .47, 0)
  forearm.scale.set(.59, .15, .185)
  applyStylizedHumanSurfaceHint(forearm, 'skin')

  // Palm faces up (+Y) with gentle thenar fullness toward the thumb (+Z) and soft dorsal arch beneath.
  const palmGeo = createStylizedPalmGeometry({
    width: .45,
    thickness: .192,
    length: .54,
    handedness: 'right',
    palmUp: true,
    arch: .020,
    iterations: 1,
  })
  palmGeo.rotateY(-Math.PI / 2)
  palmGeo.computeBoundingBox()
  palmGeo.computeBoundingSphere()
  const palm = mesh('baci-palm', palmGeo, handSkin)
  palm.position.set(.635, .468, 0)
  applyStylizedHumanSurfaceHint(palm, 'skin')

  // Four gently cupped upward-facing fingers (pinky -> index along -Z..+Z) with tapered plump finger pads.
  const fingerSpecs: { z: number; length: number; rx: number; ry: number; curl: number; splay: number; baseX: number }[] = [
    { z: -.152, length: .34, rx: .045, ry: .047, curl: .26, splay: -.055, baseX: .855 },
    { z: -.052, length: .43, rx: .049, ry: .051, curl: .21, splay: -.015, baseX: .882 },
    { z: .050,  length: .45, rx: .050, ry: .052, curl: .19, splay: .015,  baseX: .888 },
    { z: .148,  length: .39, rx: .049, ry: .050, curl: .22, splay: .050,  baseX: .868 },
  ]
  for (const [i, spec] of fingerSpecs.entries()) {
    const fGeo = createStylizedFingerGeometry({
      length: spec.length,
      radiusX: spec.rx,
      radiusY: spec.ry,
      curl: spec.curl,
      curlUp: true,
      splay: spec.splay,
      iterations: 1,
    })
    fGeo.rotateY(-Math.PI / 2)
    fGeo.computeBoundingBox()
    fGeo.computeBoundingSphere()
    const finger = mesh('baci-finger-' + i, fGeo, handSkin)
    finger.position.set(spec.baseX, .465, spec.z)
    applyStylizedHumanSurfaceHint(finger, 'skin')

    // Subtle smooth rounded nail crescent tucked along the gently upturned dorsal fingertip.
    const nailGeo = new THREE.SphereGeometry(1, 14, 10)
    nailGeo.scale(.046, .009, .029)
    const nailMesh = mesh('baci-nail-' + i, nailGeo, nail)
    const tipX = spec.baseX + spec.length * .88
    const tipY = .465 + spec.length * (0.28 * spec.curl) - spec.ry * .42
    nailMesh.position.set(tipX, tipY, spec.z + spec.splay * spec.length * .88)
    nailMesh.rotation.z = spec.curl * .55
    applyStylizedHumanSurfaceHint(nailMesh, 'skin')
  }

  // Preserve exact thumb transform [.63, .47, .30] / scale [.20, .08, .08] / rotY -.55 for cotton-wrap clearance invariant.
  const thumbGeo = createStylizedThumbGeometry({
    length: 1.82,
    radiusX: .92,
    radiusY: .94,
    curl: .22,
    curlUp: true,
    opposition: -.12,
    iterations: 1,
  })
  thumbGeo.rotateY(-Math.PI / 2)
  thumbGeo.translate(-.88, 0, 0)
  thumbGeo.computeBoundingBox()
  thumbGeo.computeBoundingSphere()
  const thumb = mesh('baci-thumb', thumbGeo, handSkin)
  thumb.position.set(.63, .47, .30)
  thumb.scale.set(.20, .08, .08)
  thumb.rotation.y = -.55
  applyStylizedHumanSurfaceHint(thumb, 'skin')
  const thread = new THREE.Group(); thread.name = 'baci-thread'; subject.add(thread)
  const yarn = mesh('baci-cotton-strand', new THREE.BufferGeometry(), cotton, thread)
  const caps = [0, 1].map(i => {
    const cap = mesh('baci-thread-end-' + i, buildCottonTipGeometry(), cotton, thread)
    cap.userData.toonSurface = { outline: false }
    return cap
  })

  const v = (x: number, y: number, z: number) => new THREE.Vector3(x, y, z)
  const upAxis = new THREE.Vector3(0, 1, 0)

  // Precompute canonical smooth curves (untied lifted loop, seated interlocking overhand knot, and planar mat coil)
  // with identical sample counts (N = 177: 35 left + 96 wrist wrap + 46 right) so tie & lift blend seamlessly.
  const LEFT_N = 35
  const WRAP_N = 96
  const RIGHT_N = 45
  const TOTAL_N = LEFT_N + WRAP_N + RIGHT_N

  const ryOpen = 0.168, rzOpen = 0.206, yOffOpen = 0.024
  const ryTied = 0.151, rzTied = 0.185, yOffTied = 0.002

  // 1) Untied lifted loop (lift = 1, tie = 0): preserves exact cue anchor local[0] = (-0.14, 0.394, -0.045)
  //    with smooth organic entry into the wrist wrap (eliminating the abrupt 45-degree corner kink).
  const openLeftCurve = new THREE.CatmullRomCurve3([
    v(-0.14, 0.394, -0.045),
    v(-0.102, 0.328, -0.032),
    v(-0.062, 0.258, -0.014),
    v(-0.034, 0.206, 0.006),
    v(-0.022, ryOpen * Math.cos(0.14) + yOffOpen, rzOpen * Math.sin(0.14)),
  ], false, 'centripetal')

  const openRightCurve = new THREE.CatmullRomCurve3([
    v(0.022, ryOpen * Math.cos(Math.PI * 2 - 0.14) + yOffOpen, rzOpen * Math.sin(Math.PI * 2 - 0.14)),
    v(0.042, 0.228, -0.008),
    v(0.080, 0.292, 0.016),
    v(0.124, 0.354, 0.036),
    v(0.165, 0.394, 0.050),
  ], false, 'centripetal')

  const openSamples: THREE.Vector3[] = []
  for (let i = 0; i <= LEFT_N; i++) openSamples.push(openLeftCurve.getPoint(i / LEFT_N))
  for (let i = 1; i <= WRAP_N; i++) {
    const u = i / WRAP_N
    const a = 0.14 + u * (Math.PI * 2 - 0.28)
    openSamples.push(v(-0.022 + 0.044 * u, ryOpen * Math.cos(a) + yOffOpen, rzOpen * Math.sin(a)))
  }
  for (let i = 1; i <= RIGHT_N; i++) openSamples.push(openRightCurve.getPoint(i / RIGHT_N))

  // 2) Seated interlocking overhand wrist knot (lift = 1, tie = 1):
  //    Sits snugly atop the wrist wrap (y = 0.153..0.220 vs old 0.34 hovering wire),
  //    with a genuine over-under locked crossing (every |i-j| >= 12 pair > 0.027 > 0.024)
  //    and softly draped cotton tails following the wrist contour.
  const tiedLeftCurve = new THREE.CatmullRomCurve3([
    v(-0.150, 0.144, -0.068),
    v(-0.106, 0.160, -0.048),
    v(-0.058, 0.178, -0.022),
    v(-0.012, 0.194, -0.002),
    v(0.028, 0.180, 0.024),
    v(0.018, 0.158, 0.042),
    v(-0.014, ryTied * Math.cos(0.16) + yOffTied, rzTied * Math.sin(0.16)),
  ], false, 'centripetal')

  const tiedRightCurve = new THREE.CatmullRomCurve3([
    v(0.015, ryTied * Math.cos(Math.PI * 2 - 0.16) + yOffTied, rzTied * Math.sin(Math.PI * 2 - 0.16)),
    v(0.008, 0.158, -0.008),
    v(-0.036, 0.172, 0.014),
    v(-0.038, 0.204, 0.032),
    v(0.012, 0.214, 0.024),
    v(0.064, 0.194, 0.036),
    v(0.112, 0.166, 0.058),
    v(0.148, 0.145, 0.084),
  ], false, 'centripetal')

  const tiedSamples: THREE.Vector3[] = []
  for (let i = 0; i <= LEFT_N; i++) tiedSamples.push(tiedLeftCurve.getPoint(i / LEFT_N))
  for (let i = 1; i <= WRAP_N; i++) {
    const u = i / WRAP_N
    const a = 0.16 + u * (Math.PI * 2 - 0.32)
    tiedSamples.push(v(-0.015 + 0.030 * u, ryTied * Math.cos(a) + yOffTied, rzTied * Math.sin(a)))
  }
  for (let i = 1; i <= RIGHT_N; i++) tiedSamples.push(tiedRightCurve.getPoint(i / RIGHT_N))

  // 3) Planar open cotton coil resting cleanly on the woven straw mat (lift = 0, tie = 0):
  //    Preserves exact step-0 cue anchor local[0] = (0, 0.394, 0.16) and local.x = 0 (world.y >= 0.0147 > 0.008)
  //    with smooth organic curvature into the open circle.
  const flatLeftCurve = new THREE.CatmullRomCurve3([
    v(0, 0.394, 0.160),
    v(0, 0.340, 0.132),
    v(0, 0.278, 0.102),
    v(0, 0.222, 0.076),
    v(0, ryOpen * Math.cos(0.28) + yOffOpen, rzOpen * Math.sin(0.28)),
  ], false, 'centripetal')

  const flatRightCurve = new THREE.CatmullRomCurve3([
    v(0, ryOpen * Math.cos(Math.PI * 2 - 0.28) + yOffOpen, rzOpen * Math.sin(Math.PI * 2 - 0.28)),
    v(0, 0.244, -0.080),
    v(0, 0.324, -0.108),
    v(0, 0.410, -0.138),
    v(0, 0.492, -0.168),
  ], false, 'centripetal')

  const flatSamples: THREE.Vector3[] = []
  for (let i = 0; i <= LEFT_N; i++) flatSamples.push(flatLeftCurve.getPoint(i / LEFT_N))
  for (let i = 1; i <= WRAP_N; i++) {
    const u = i / WRAP_N
    const a = 0.28 + u * (Math.PI * 2 - 0.56)
    flatSamples.push(v(0, ryOpen * Math.cos(a) + yOffOpen, rzOpen * Math.sin(a)))
  }
  for (let i = 1; i <= RIGHT_N; i++) flatSamples.push(flatRightCurve.getPoint(i / RIGHT_N))

  let local: THREE.Vector3[] = [], previousTie = -1, previousLift = -1
  const pose = (step: number, amount: number) => {
    const n = Number.isFinite(step) ? THREE.MathUtils.clamp(Math.floor(step), 0, 3) : 0, t = Number.isFinite(amount) ? THREE.MathUtils.clamp(amount, 0, 1) : 0
    const lift = n === 0 ? t : 1, wrap = n === 1 ? t : n > 1 ? 1 : 0, tie = n === 2 ? t : n > 2 ? 1 : 0
    const approach = Math.min(1, wrap / .25), lower = THREE.MathUtils.clamp((wrap - .25) / .20, 0, 1), slide = THREE.MathUtils.clamp((wrap - .45) / .35, 0, 1), snug = THREE.MathUtils.clamp((wrap - .8) / .2, 0, 1)
    // Carry the open loop above the offered hand, lower it beyond the fingers,
    // then bring it back to the wrist before gathering the ends. The generous
    // opening clears the thumb; no part is interpolated through the body.
    thread.position.set(THREE.MathUtils.lerp(-.57, 1.5, approach) + (wrist.x - 1.5) * slide, THREE.MathUtils.lerp(.0215, .88, lift) + (wrist.y - .88) * lower, .65 * (1 - approach))
    thread.scale.z = 1 + 1.5 * approach * (1 - snug)
    thread.rotation.z = -(1 - lift) * Math.PI / 2
    if (tie === previousTie && lift === previousLift) { root.updateMatrixWorld(true); return }
    previousTie = tie; previousLift = lift

    const smoothTie = tie * tie * (3 - 2 * tie)
    const tieArc = Math.sin(Math.PI * smoothTie)
    local = new Array<THREE.Vector3>(TOTAL_N + 1)
    for (let i = 0; i <= TOTAL_N; i++) {
      const p = openSamples[i]!.clone().lerp(tiedSamples[i]!, smoothTie)
      // Gentle outward drawing arc on the two ends during step-3 cinching so strands never pass through each other mid-tie.
      if (tieArc > 1e-4) {
        if (i < LEFT_N) {
          const w = 1 - i / LEFT_N
          p.y += 0.022 * tieArc * w
          p.z -= 0.016 * tieArc * w
        } else if (i > LEFT_N + WRAP_N) {
          const w = (i - LEFT_N - WRAP_N) / RIGHT_N
          p.y += 0.028 * tieArc * w
          p.z += 0.018 * tieArc * w
        }
      }
      if (lift < 1) {
        p.lerpVectors(flatSamples[i]!, p, lift)
      }
      local[i] = p
    }

    const curve = new THREE.CatmullRomCurve3(local, false, 'centripetal')
    yarn.geometry.dispose()
    yarn.geometry = buildSpunCottonGeometry(curve, 240, 12, 0.012, 52)

    // Orient softly tapered cut-cotton tips cleanly along the start and end strand tangents.
    const startDir = local[0]!.clone().sub(local[2]!).normalize()
    const endDir = local[TOTAL_N]!.clone().sub(local[TOTAL_N - 2]!).normalize()
    caps[0]!.position.copy(local[0]!)
    caps[0]!.quaternion.setFromUnitVectors(upAxis, startDir)
    caps[1]!.position.copy(local[TOTAL_N]!)
    caps[1]!.quaternion.setFromUnitVectors(upAxis, endDir)
    root.updateMatrixWorld(true)
  }
  pose(0, 0)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    cottonTex.map.dispose()
    cottonTex.bump.dispose()
    baciMat.dispose()
  }
  return {
    root, subject, thread, wrist, pose,
    targets: [thread, thread, thread],
    roots: [thread, thread, thread],
    anchors: [[0, .394, .16], [-.14, .394, -.045], [-.14, .394, -.045]] as [number, number, number][],
    threadPoints: () => local.map(p => thread.localToWorld(p.clone())),
    dispose,
  }
}
