import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { addObjectCradle } from '../cozy-furniture'
import {
  createLivingBarkMaterial,
  createSpringBlossomMaterial,
  createSpringBlossomPetalGeometry,
  createSpringLeafMaterial,
  createSpringPollenGeometry,
  createYoungBranchLeafGeometry,
} from './blossom-detail'
import { buildMartisorTreeBranches } from './branch-craft'

let cachedYarnPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null

/**
 * Deterministic neutral spun-yarn texture (128x128, seamless tiling) tinted cleanly per strand
 * material (crimson red or warm cream). Replaces smooth plastic tubes and triplanar dot noise
 * with soft twisted-fiber diagonal relief aligned along each strand's UV axis.
 */
function createMartisorYarnTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedYarnPixels) {
    const colorData = new Uint8Array(size * size * 4)
    const bumpData = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        // Diagonal 2-sub-ply spun cotton-wool fiber twist along U (strand length) and V (circumference).
        const plyA = Math.sin((u * 8 + v * 2) * tau)
        const plyB = Math.sin((u * 16 + v * 4) * tau) * 0.32
        const fineGrain = Math.sin((u * 28 - v * 3) * tau) * 0.14
        const fiber = plyA * 0.68 + plyB + fineGrain
        const shade = fiber * 16.5
        const idx = (y * size + x) * 4
        colorData[idx] = THREE.MathUtils.clamp(Math.round(244 + shade * 0.90), 198, 255)
        colorData[idx + 1] = THREE.MathUtils.clamp(Math.round(240 + shade * 0.95), 192, 254)
        colorData[idx + 2] = THREE.MathUtils.clamp(Math.round(234 + shade * 1.00), 184, 250)
        colorData[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + fiber * 54), 28, 234)
        bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
      }
    }
    cachedYarnPixels = { color: colorData, bump: bumpData, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedYarnPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedYarnPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Builds a single merged BufferGeometry for a curved, 3D-bundled radial tassel fringe skirt. */
function buildTasselFringeGeometry(seed: number, lengthBase: number): THREE.BufferGeometry {
  const strandCount = 20
  const segsAlong = 9
  const radialSides = 6
  const ringStride = radialSides + 1
  const strandVerts = (segsAlong + 1) * ringStride
  const totalVerts = strandCount * strandVerts

  const positions = new Float32Array(totalVerts * 3)
  const uvs = new Float32Array(totalVerts * 2)
  const indices: number[] = []

  const cosR = new Float32Array(ringStride)
  const sinR = new Float32Array(ringStride)
  for (let j = 0; j <= radialSides; j++) {
    const a = (j / radialSides) * Math.PI * 2
    cosR[j] = Math.cos(a)
    sinR[j] = Math.sin(a)
  }

  const centers: THREE.Vector3[] = Array.from({ length: segsAlong + 1 }, () => new THREE.Vector3())
  const tan = new THREE.Vector3()
  const norm = new THREE.Vector3()
  const binorm = new THREE.Vector3()
  const refZ = new THREE.Vector3(0, 0, 1)
  const refX = new THREE.Vector3(1, 0, 0)

  for (let s = 0; s < strandCount; s++) {
    const baseVert = s * strandVerts
    const hashA = Math.sin((s + 1) * 19.7 + seed * 43.1) * 0.5 + 0.5
    const hashB = Math.cos((s + 1) * 31.3 + seed * 17.9) * 0.5 + 0.5
    const theta = (s / strandCount) * Math.PI * 2 + (hashA - 0.5) * 0.14
    const ct = Math.cos(theta), st = Math.sin(theta)
    const strandLen = lengthBase * (0.91 + 0.09 * hashB)
    const topRx = 0.023, topRz = 0.0135
    const midRx = 0.036 + 0.004 * hashA
    const midRz = 0.0155 + 0.0012 * hashA
    const tipRx = 0.022 + 0.005 * hashB
    const tipRz = 0.0135 + 0.0015 * hashB
    const swayPhase = hashA * Math.PI * 2
    const curlAmp = 0.0026

    for (let i = 0; i <= segsAlong; i++) {
      const t = i / segsAlong
      // Starts neatly tucked inside the wrapped neck collar (y = -0.040), swells softly, then tapers naturally.
      const bell = Math.sin(Math.min(1, t * 1.35) * Math.PI)
      const rx = THREE.MathUtils.lerp(topRx, tipRx, Math.pow(t, 0.85)) + (midRx - (topRx + tipRx) * 0.5) * bell * 0.65
      const rz = THREE.MathUtils.lerp(topRz, tipRz, Math.pow(t, 0.85)) + (midRz - (topRz + tipRz) * 0.5) * bell * 0.55
      const waveX = Math.sin(t * Math.PI * 1.4 + swayPhase) * curlAmp * t
      const cx = ct * rx + waveX
      const cy = -0.040 - t * strandLen
      const cz = THREE.MathUtils.clamp(st * rz, -0.0170, 0.0170)
      centers[i]!.set(cx, cy, cz)
    }

    for (let i = 0; i <= segsAlong; i++) {
      const t = i / segsAlong
      const prev = centers[Math.max(0, i - 1)]!
      const next = centers[Math.min(segsAlong, i + 1)]!
      tan.subVectors(next, prev)
      if (tan.lengthSq() < 1e-12) tan.set(0, -1, 0)
      else tan.normalize()
      const ref = Math.abs(tan.dot(refZ)) < 0.85 ? refZ : refX
      norm.crossVectors(tan, ref).normalize()
      binorm.crossVectors(tan, norm).normalize()

      const c = centers[i]!
      // Gently thicker yarn strand through mid-body, tapering softly to a clean spun-yarn tip.
      const r = 0.0044 * (t < 0.78 ? 1.0 - t * 0.12 : THREE.MathUtils.lerp(0.90, 0.34, (t - 0.78) / 0.22))
      const row = baseVert + i * ringStride
      for (let j = 0; j <= radialSides; j++) {
        const ca = cosR[j]!, sa = sinR[j]!
        const k = row + j
        positions[k * 3] = c.x + r * (norm.x * ca + binorm.x * sa)
        positions[k * 3 + 1] = c.y + r * (norm.y * ca + binorm.y * sa)
        // Strict z-envelope clamp guarantees exact ground contact at pose(0,0) and zero camera drift.
        positions[k * 3 + 2] = THREE.MathUtils.clamp(c.z + r * (norm.z * ca + binorm.z * sa), -0.0212, 0.0212)
        uvs[k * 2] = t * 4.5 + seed * 0.37
        uvs[k * 2 + 1] = j / radialSides
      }
      if (i < segsAlong) {
        for (let j = 0; j < radialSides; j++) {
          const a = row + j
          const b = a + 1
          const cc = a + ringStride
          const d = cc + 1
          indices.push(a, b, cc, b, d, cc)
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  return geometry
}

/** Builds a sculpted, fiber-grooved rounded yarn tassel crown fitting strictly within z in [-0.0212, 0.0212]. */
function buildTasselCrownGeometry(): THREE.BufferGeometry {
  const latSegs = 16
  const lonSegs = 28
  const stride = lonSegs + 1
  const positions = new Float32Array((latSegs + 1) * stride * 3)
  const uvs = new Float32Array((latSegs + 1) * stride * 2)
  const indices: number[] = []
  for (let i = 0; i <= latSegs; i++) {
    const v = i / latSegs // 0=top of folded yarn crown, 1=cinched neck base
    const phi = v * Math.PI
    const sp = Math.sin(phi)
    const cp = Math.cos(phi)
    // Graceful bundled yarn bell-cap: softly rounded top tapering smoothly into the wrapped neck collar.
    const topTaper = 1 - 0.14 * Math.pow(Math.max(0, 1 - v * 2.4), 1.6)
    const neckPinch = 1 - 0.22 * Math.pow(THREE.MathUtils.smoothstep(v, 0.56, 1.0), 1.2)
    const rx = 0.035 * sp * topTaper * neckPinch
    const rz = 0.0195 * sp * topTaper * neckPinch
    const y = 0.041 * cp
    for (let j = 0; j <= lonSegs; j++) {
      const u = j / lonSegs
      const theta = u * Math.PI * 2
      // Subtle longitudinal yarn-bundle fluting over the rounded crown.
      const flute = 1 + 0.042 * Math.cos(theta * 14) * sp
      const k = i * stride + j
      positions[k * 3] = Math.cos(theta) * rx * flute
      positions[k * 3 + 1] = y
      positions[k * 3 + 2] = THREE.MathUtils.clamp(Math.sin(theta) * rz * flute, -0.0212, 0.0212)
      uvs[k * 2] = u * 2.4
      uvs[k * 2 + 1] = v * 1.4
      if (i < latSegs && j < lonSegs) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // Outward winding: (+theta tangent) x (+v downward) points radially outward.
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a fluted inner yarn core so no hollow gaps show through the 3D tassel fringe from any orbit angle. */
function buildTasselCoreGeometry(length: number): THREE.BufferGeometry {
  const segsY = 10
  const segsR = 18
  const stride = segsR + 1
  const positions = new Float32Array((segsY + 1) * stride * 3)
  const uvs = new Float32Array((segsY + 1) * stride * 2)
  const indices: number[] = []
  for (let i = 0; i <= segsY; i++) {
    const t = i / segsY
    const swell = Math.sin(Math.min(1, t * 1.25) * Math.PI)
    const rx = THREE.MathUtils.lerp(0.021, 0.015, t) + 0.008 * swell
    const rz = THREE.MathUtils.lerp(0.012, 0.0085, t) + 0.003 * swell
    const y = -0.036 - t * length
    for (let j = 0; j <= segsR; j++) {
      const u = j / segsR
      const theta = u * Math.PI * 2
      const flute = 1 + 0.05 * Math.cos(theta * 12)
      const k = i * stride + j
      positions[k * 3] = Math.cos(theta) * rx * flute
      positions[k * 3 + 1] = y
      positions[k * 3 + 2] = THREE.MathUtils.clamp(Math.sin(theta) * rz * flute, -0.0155, 0.0155)
      uvs[k * 2] = t * 3.5
      uvs[k * 2 + 1] = u * 2.0
      if (i < segsY && j < segsR) {
        const a = k, b = k + 1, c = k + stride, d = c + 1
        // Outward winding: (+theta tangent) x (+t downward) points radially outward.
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a 2-ply twisted yarn tube along a smooth curve, clamped cleanly within z in [-0.0212, 0.0212]. */
function buildTwistedCordTube(
  curve: THREE.CatmullRomCurve3,
  tubularSegments: number,
  radialSegments: number,
  radius: number,
  turns: number,
  plyDepth: number,
): THREE.BufferGeometry {
  const ringStride = radialSegments + 1
  const positions = new Float32Array((tubularSegments + 1) * ringStride * 3)
  const uvs = new Float32Array((tubularSegments + 1) * ringStride * 2)
  const indices: number[] = []
  const frames = curve.computeFrenetFrames(tubularSegments, false)
  const p = new THREE.Vector3()

  for (let i = 0; i <= tubularSegments; i++) {
    const u = i / tubularSegments
    curve.getPointAt(u, p)
    const N = frames.normals[i]!
    const B = frames.binormals[i]!
    for (let j = 0; j <= radialSegments; j++) {
      const v = j / radialSegments
      const theta = v * Math.PI * 2
      const ply = 1 + plyDepth * Math.cos(theta * 2 - u * Math.PI * 2 * turns)
      const r = radius * ply
      const ca = Math.cos(theta), sa = Math.sin(theta)
      const k = i * ringStride + j
      positions[k * 3] = p.x + r * (N.x * ca + B.x * sa)
      positions[k * 3 + 1] = p.y + r * (N.y * ca + B.y * sa)
      positions[k * 3 + 2] = THREE.MathUtils.clamp(p.z + r * (N.z * ca + B.z * sa), -0.0212, 0.0212)
      uvs[k * 2] = u * turns * 0.75
      uvs[k * 2 + 1] = v
      if (i < tubularSegments && j < radialSegments) {
        const a = k, b = k + 1, c = k + ringStride, d = c + 1
        // Outward winding: (+theta = B) x (+u = T) = +N outward.
        indices.push(a, b, c, b, d, c)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** Builds a snug oval wrapped yarn collar ring (for the gathering knot or tassel neck binding). */
function buildOvalWrapRing(
  rx: number,
  rz: number,
  tubeRadius: number,
  tiltZ: number,
  segs = 32,
  sides = 8,
): THREE.BufferGeometry {
  const ringStride = sides + 1
  const positions = new Float32Array((segs + 1) * ringStride * 3)
  const uvs = new Float32Array((segs + 1) * ringStride * 2)
  const indices: number[] = []
  for (let i = 0; i <= segs; i++) {
    const u = i / segs
    const a = u * Math.PI * 2
    const ca = Math.cos(a), sa = Math.sin(a)
    const cx = rx * ca
    const cz = rz * sa
    const cy = Math.sin(a) * tiltZ
    // Outward normal in XZ plane
    const nx = ca / Math.max(rx, 1e-4)
    const nz = sa / Math.max(rz, 1e-4)
    const inv = 1 / Math.hypot(nx, nz)
    const ux = nx * inv, uz = nz * inv
    for (let j = 0; j <= sides; j++) {
      const v = j / sides
      const b = v * Math.PI * 2
      const cb = Math.cos(b), sb = Math.sin(b)
      const k = i * ringStride + j
      positions[k * 3] = cx + ux * tubeRadius * cb
      positions[k * 3 + 1] = cy + tubeRadius * sb
      positions[k * 3 + 2] = THREE.MathUtils.clamp(cz + uz * tubeRadius * cb, -0.0212, 0.0212)
      uvs[k * 2] = u * 4.0
      uvs[k * 2 + 1] = v
      if (i < segs && j < sides) {
        const idxA = k, idxB = k + 1, idxC = k + ringStride, idxD = idxC + 1
        // Outward winding: (+b cross-section tangent) x (+a ring tangent) points outward.
        indices.push(idxA, idxB, idxC, idxB, idxD, idxC)
      }
    }
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  g.setIndex(indices)
  g.computeVertexNormals()
  return g
}

/** A worn cord with an open loop, placed over the free end of a blossoming branch. */
export function createMartisorModel() {
  const root = new THREE.Group(); root.name = 'martisor-root'
  const subject = new THREE.Group(); subject.name = 'martisor-subject'; root.add(subject)
  const cord = new THREE.Group(); cord.name = 'martisor-cord'; subject.add(cord)
  const yarnTex = createMartisorYarnTextures()
  const material = (color: number, roughness = .85) => new THREE.MeshStandardMaterial({ color, roughness })
  const yarnMat = (color: number, roughness = .88) => new THREE.MeshStandardMaterial({
    color,
    roughness,
    map: yarnTex.map,
    bumpMap: yarnTex.bump,
    bumpScale: 0.0022,
  })
  const red = yarnMat(0xc43c54), white = yarnMat(0xffedce)
  // Subtle deeper-crimson & warm-cream collar shades preserve the red/white palette while defining the wrapped bindings.
  const redCollar = yarnMat(0xa52d43, 0.90), whiteCollar = yarnMat(0xecd6b2, 0.90)
  const bark = createLivingBarkMaterial(), cut = material(0xc9a77b)
  // Exposed cut end keeps sawn wood grain; living branch bark uses a quiet fruit-tree bark hint.
  applyCraftSurface(cut,{kind:'wood',strength:.35,axis:'z'})
  const blossomMat = createSpringBlossomMaterial()
  const leafMat = createSpringLeafMaterial()
  let serial = 0
  const mesh = (geometry: THREE.BufferGeometry, mat: THREE.Material, parent: THREE.Object3D, name?: string) => {
    const m = new THREE.Mesh(geometry, mat); m.name = name ?? `martisor-detail-${serial++}`; m.castShadow = true; m.receiveShadow = true; parent.add(m); return m
  }
  const rod = (a: number[], b: number[], radius: number, mat = bark, parent = subject, name?: string) => {
    const start = new THREE.Vector3(...a as [number,number,number]), end = new THREE.Vector3(...b as [number,number,number]), d = end.clone().sub(start)
    const m = mesh(new THREE.CylinderGeometry(radius,radius,d.length(),12),mat,parent,name); m.position.copy(start).add(end).multiplyScalar(.5); m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize()); return m
  }
  // The contact branch is an actual capped cylinder: free tip z=.40, radius .055.
  buildMartisorTreeBranches(subject, bark, blossomMat, mesh)
  rod([.55,1.5,-.65],[.55,1.5,.40],.055,bark,subject,'martisor-support-branch')
  const tip=mesh(new THREE.CircleGeometry(.055,12),cut,subject,'martisor-branch-tip'); tip.position.set(.55,1.5,.4001)
  const largeBlushPetal = createSpringBlossomPetalGeometry(true, 'blush')
  const largeCreamPetal = createSpringBlossomPetalGeometry(true, 'cream')
  const smallBlushPetal = createSpringBlossomPetalGeometry(false, 'blush')
  const smallCreamPetal = createSpringBlossomPetalGeometry(false, 'cream')
  const largePollenGeo = createSpringPollenGeometry(true)
  const smallPollenGeo = createSpringPollenGeometry(false)
  const youngLeafGeo = createYoungBranchLeafGeometry()
  const bloom=(x:number,y:number,z:number,large=false,index=0)=>{
    const group=new THREE.Group(); group.name=`martisor-blossom-${index}`; group.position.set(x,y,z); subject.add(group)
    // Keep rightmost blossom (index 4) aligned with original +X petal axis for exact auto-fit camera parity.
    const spin=index===4?-Math.PI/2:index*.48+.12
    const blushGeo=large?largeBlushPetal:smallBlushPetal
    const creamGeo=large?largeCreamPetal:smallCreamPetal
    for(let i=0;i<5;i++){
      const a=i*Math.PI*2/5+spin
      const p=mesh(i%2?blushGeo:creamGeo,blossomMat,group)
      p.rotation.z=a
    }
    const heart=mesh(large?largePollenGeo:smallPollenGeo,blossomMat,group)
    heart.position.set(0,0,.024)
  }
  ;[[-.38,2.05,-.72],[-.55,2.27,-.65],[.08,1.73,-.68],[1.12,2.18,-.7],[1.42,2.02,-.75],[.79,1.80,-.69]].forEach(([x,y,z],i)=>bloom(x!,y!,z!,i%2===0,i))
  for(const [i,[x,y,z,angle]] of ([[-.43,2.15,-.665,.6],[1.25,2.03,-.73,-.7],[.95,2.05,-.67,.6]] as const).entries()){
    const m=mesh(youngLeafGeo,leafMat,subject,`martisor-leaf-${i}`)
    m.position.set(x,y,z); m.rotation.set(.14,angle>0?.18:-.18,angle)
  }
  // Compact tapered earth root-collar grounded directly at courtyard surface (-0.0575..-0.075)
  // replaces the redundant 2.84m green disc while keeping the trunk root flare anchored.
  const rootMoundProfile = [
    new THREE.Vector2(0, -.075),
    new THREE.Vector2(.31, -.075),
    new THREE.Vector2(.29, -.056),
    new THREE.Vector2(.24, -.030),
    new THREE.Vector2(.18, -.013),
    new THREE.Vector2(0, -.010),
  ]
  const ground = mesh(new THREE.LatheGeometry(rootMoundProfile, 36), material(0x76654d, .95), root, 'martisor-ground')
  ground.position.set(.55, 0, -.65)
  // Compact chamfered wooden prep rest seated at -0.0575 holds the initial mărțișor cord cleanly at y = 0.
  const prepRest = addObjectCradle(root, {
    name: 'martisor-prep-rest',
    topName: 'martisor-prep-rest-top',
    style: 'pad',
    kind: 'wood',
    finish: 'birch',
    width: .62,
    depth: 1.08,
    center: [-.65, .43],
    groundY: -.0575,
    surfaceY: 0,
    footed: true,
  })
  const restNames = new Map<string, number>()
  prepRest.root.traverse(o => {
    if (!o.name) return
    const n = restNames.get(o.name) ?? 0
    restNames.set(o.name, n + 1)
    if (n > 0) o.name = `${o.name}-${n}`
  })

  // Two tightly plied radial/z yarn tubes twist snugly around the open loop (helixR=0.0094, tubeR=0.0120,
  // R0=0.2294 -> zero hollow gap between strands, exact measurable inner support radius 0.2080,
  // and local_z in [-0.0214, +0.0214] so pose(0,0) rests cleanly on the ground).
  const strand=(phase:number,mat:THREE.Material,name:string)=>{
    const p:number[]=[],uvs:number[]=[],indices:number[]=[],segments=360,sides=12
    const helixR=0.0094, tubeR=0.0120, baseR=0.208+helixR+tubeR
    for(let i=0;i<=segments;i++){
      const u=i/segments, a=u*Math.PI*2
      const r=baseR+helixR*Math.cos(20*a+phase), z=helixR*Math.sin(20*a+phase)
      const ca=Math.cos(a), sa=Math.sin(a)
      for(let j=0;j<=sides;j++){
        const v=j/sides, b=v*Math.PI*2, rr=r+tubeR*Math.cos(b)
        p.push(rr*ca, rr*sa, z+tubeR*Math.sin(b))
        uvs.push(u*44, v)
      }
    }
    for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+sides+1;indices.push(a,b,a+1,b,b+1,a+1)}
    const g=new THREE.BufferGeometry()
    g.setAttribute('position',new THREE.Float32BufferAttribute(p,3))
    g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
    g.setIndex(indices);g.computeVertexNormals()
    return mesh(g,mat,cord,name)
  }
  strand(0,red,'martisor-red-strand'); strand(Math.PI,white,'martisor-white-strand')

  // Articulated wrapped gathering knot where both loop strands meet and separate cleanly into the two tassel cords.
  const knotCore = mesh(buildTasselCrownGeometry(), red, cord, 'martisor-gathering-knot')
  knotCore.position.set(0, -.245, 0)
  knotCore.scale.set(0.86, 0.84, 0.96)

  // Three plush alternating wrapped yarn turns binding the gathering knot neatly (zero detached wings).
  const knotWrapSpecs: readonly [number, number, number, THREE.Material, string][] = [
    [-.235, .031, .0024, white, 'martisor-knot-binding'],
    [-.245, .032, -.0024, redCollar, 'martisor-knot-wrap-1'],
    [-.255, .029, .0020, white, 'martisor-knot-wrap-2'],
  ]
  for (const [wy, wrx, tilt, wmat, wname] of knotWrapSpecs) {
    const wrapRing = mesh(buildOvalWrapRing(wrx, .0156, .0058, tilt, 32, 8), wmat, cord, wname)
    wrapRing.position.set(0, wy, 0)
    wrapRing.userData.toonSurface = { outline: false }
  }

  // Two 3D bundled yarn tassels mounted on knot-underside pivots so subtle hanging lag moves each cord+tassel coherently.
  const buildTassel = (
    mat: THREE.Material,
    collarMat: THREE.Material,
    x: number,
    y: number,
    name: string,
    seed: number,
    fringeLen: number,
  ) => {
    const anchorX = Math.sign(x) * 0.015
    const anchorY = -0.262
    const pivot = new THREE.Group()
    pivot.name = `${name}-pivot`
    pivot.position.set(anchorX, anchorY, 0)
    cord.add(pivot)

    const dx = x - anchorX
    const dy = y - anchorY
    // Curved 2-ply twisted suspension cord flowing smoothly from the wrapped gathering knot into the tassel crown.
    const cordPath = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0.006, 0),
      new THREE.Vector3(dx * 0.50, dy * 0.45, 0),
      new THREE.Vector3(dx, dy + 0.036, 0),
    ])
    mesh(buildTwistedCordTube(cordPath, 24, 10, 0.0102, 5.5, 0.14), mat, pivot, `${name}-cord`)

    // Sculpted fiber-grooved rounded yarn crown (keeps exact raycastable head name & local origin [0,0,0]).
    const head = mesh(buildTasselCrownGeometry(), mat, pivot, name)
    head.position.set(dx, dy, 0)

    // Multi-turn wrapped neck collar cinching the bundled yarn below the crown.
    for (let r = 0; r < 3; r++) {
      const collar = mesh(
        buildOvalWrapRing(0.0272 - r * 0.0007, 0.0152, 0.0049, (r % 2 ? 1 : -1) * 0.0016, 28, 8),
        collarMat,
        pivot,
        `${name}-collar-${r}`,
      )
      collar.position.set(dx, dy - 0.033 - r * 0.0074, 0)
      collar.userData.toonSurface = { outline: false }
    }

    // Fluted inner yarn core + 20 layered 3D curved tapered yarn strands forming a full 3D bundled tassel skirt.
    const core = mesh(buildTasselCoreGeometry(fringeLen * 0.92), mat, pivot, `${name}-core`)
    core.position.set(dx, dy - 0.002, 0)
    core.userData.toonSurface = { outline: false }

    const fringe = mesh(buildTasselFringeGeometry(seed, fringeLen), mat, pivot, `${name}-fringe`)
    fringe.position.set(dx, dy - 0.002, 0)
    fringe.userData.toonSurface = { outline: false }

    return { head, pivot }
  }

  const redTassel = buildTassel(red, redCollar, -.085, -.39, 'martisor-red-head', 1, 0.214)
  const whiteTassel = buildTassel(white, whiteCollar, .085, -.46, 'martisor-white-head', 2, 0.214)

  const setTasselSway = (redAngle: number, whiteAngle: number) => {
    redTassel.pivot.rotation.z = Number.isFinite(redAngle) && redAngle !== 0 ? redAngle : 0
    whiteTassel.pivot.rotation.z = Number.isFinite(whiteAngle) && whiteAngle !== 0 ? whiteAngle : 0
  }

  const pose=(step:number,n:number)=>{
    const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
    cord.rotation.set(0,0,0)
    setTasselSway(0, 0)
    if(step<=0){
      const lift=Math.min(1,t/.3),turn=THREE.MathUtils.clamp((t-.3)/.3,0,1),reach=THREE.MathUtils.clamp((t-.6)/.4,0,1)
      cord.position.set(THREE.MathUtils.lerp(-.65,.55,reach),THREE.MathUtils.lerp(.022,1.5,lift),THREE.MathUtils.lerp(.2,.7,reach));cord.rotation.x=-Math.PI/2*(1-turn)
    } else if(step===1) cord.position.set(.55,1.5,THREE.MathUtils.lerp(.7,-.05,t))
    else cord.position.set(.55,THREE.MathUtils.lerp(1.5,1.347,step>=3?1:t),-.05)
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  let disposed = false
  const dispose = () => {
    if (disposed) return
    disposed = true
    yarnTex.map.dispose()
    yarnTex.bump.dispose()
  }
  return {
    root,
    subject,
    cord,
    targets:[redTassel.head,redTassel.head,redTassel.head],
    roots:[cord,cord,cord],
    anchors:[[0,0,0],[0,0,0],[0,0,0]] as [number,number,number][],
    pose,
    setTasselSway,
    dispose,
  }
}
