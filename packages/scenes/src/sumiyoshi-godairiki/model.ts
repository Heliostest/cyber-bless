import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

const smooth = (n: number) => { const t=THREE.MathUtils.clamp(n,0,1); return t*t*(3-2*t) }
const stoneStarts = [[-.94,.12,-.60],[-1.02,.12,0],[-.94,.12,.60]] as const
const stoneEnds = [[.57,.17,-.18],[1.13,.17,-.18],[.85,.17,.30]] as const
const POUCH_X = .85
const POUCH_Z_SCALE = .83
const RADIAL_SEGS = 96
const STONE_ANGLES = stoneEnds.map(([x, , z]) => Math.atan2(z / POUCH_Z_SCALE, x - POUCH_X))

// Asymmetric, organically spaced kinchaku drawstring gather pleats:
// [angle (rad), half-width (rad), depth, vertical gravity-splay drift].
// Narrower pinched inward creases separate broad plump cloth lobes so folds carry clearly down the belly.
const GATHER_PLEATS: readonly (readonly [number, number, number, number])[] = [
  [0.24, 0.115, 0.056, 0.07],
  [0.86, 0.145, 0.068, -0.09],
  [1.46, 0.120, 0.062, 0.08],
  [2.04, 0.140, 0.072, -0.07],
  [2.64, 0.115, 0.058, 0.08],
  [3.28, 0.135, 0.064, -0.06],
  [3.92, 0.145, 0.068, 0.08],
  [4.56, 0.120, 0.060, -0.08],
  [5.22, 0.138, 0.066, 0.06],
  [5.84, 0.118, 0.054, -0.06],
] as const

function wrapAngleDiff(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2)
  if (d > Math.PI) d -= Math.PI * 2
  if (d < -Math.PI) d += Math.PI * 2
  return d
}

function threadHash(n: number): number {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453123
  return x - Math.floor(x)
}

let cachedClothPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null
let cachedCordPixels: { color: Uint8Array; bump: Uint8Array; size: number } | null = null

/**
 * Deterministic fine handwoven slubbed cotton-linen cloth texture (512x512, tileable horizontally,
 * mapped vertically to the pouch profile so twin cream casing topstitch lines sit along the
 * drawstring tunnel without any coarse plaid/waffle grid). Pixel arrays are cached once while each
 * model instance owns and disposes its own `THREE.DataTexture`.
 */
function createPouchClothTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 512
  if (!cachedClothPixels) {
    const colorData = new Uint8Array(size * size * 4)
    const bumpData = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    const threads = 128
    const warpTone = new Float32Array(threads)
    const weftTone = new Float32Array(threads)
    for (let t = 0; t < threads; t++) {
      // Organic per-thread yarn variation (natural unbleached slub irregularity, zero repeating grid blocks).
      warpTone[t] = (threadHash(t * 3 + 1) - 0.5) * 6.5 + (threadHash(t * 7 + 19) > 0.86 ? 4.2 : 0)
      weftTone[t] = (threadHash(t * 5 + 41) - 0.5) * 6.5 + (threadHash(t * 11 + 73) > 0.86 ? 4.4 : 0)
    }

    for (let y = 0; y < size; y++) {
      const v = y / (size - 1)
      const weftIdx = Math.floor(y / (size / threads)) % threads
      const weftLocal = ((y / (size / threads)) % 1) * tau
      const weftProfile = Math.sin(weftLocal)
      const weftSlub = weftTone[weftIdx]!

      // Twin horizontal casing topstitch seam bands at v ≈ 0.472 (y ≈ 0.71) and v ≈ 0.542 (y ≈ 0.79)
      // plus a delicate folded lip hem seam near v ≈ 0.612 (y ≈ 0.885).
      const lowerCasingTuck = Math.exp(-(((v - 0.472) / 0.0085) ** 2))
      const upperCasingTuck = Math.exp(-(((v - 0.542) / 0.0085) ** 2))
      const casingTunnelHighlight = Math.exp(-(((v - 0.507) / 0.028) ** 2))
      const lipHemLine = Math.exp(-(((v - 0.612) / 0.0065) ** 2))

      for (let x = 0; x < size; x++) {
        const u = x / size
        const warpIdx = Math.floor(x / (size / threads)) % threads
        const warpLocal = ((x / (size / threads)) % 1) * tau
        const warpProfile = Math.sin(warpLocal)
        const warpSlub = warpTone[warpIdx]!
        // Plain 1/1 handwoven linen-cotton interlacing (over/under alternation per thread).
        const overWarp = ((warpIdx + weftIdx) & 1) === 0
        const yarnHeight = overWarp
          ? warpProfile * 0.68 + weftProfile * 0.18 + warpSlub * 0.14
          : weftProfile * 0.68 + warpProfile * 0.18 + weftSlub * 0.14
        const weave = yarnHeight * 6.2 + (warpSlub + weftSlub) * 0.62

        // Crisp pale-cream running-stitch dashes framing both sides of the drawstring casing channel.
        const dash = THREE.MathUtils.smoothstep(Math.sin(u * tau * 22), 0.24, 0.62)
        const lowerStitch = Math.exp(-(((v - 0.472) / 0.0022) ** 2)) * dash
        const upperStitch = Math.exp(-(((v - 0.542) / 0.0022) ** 2)) * dash
        const lipStitch = Math.exp(-(((v - 0.612) / 0.0020) ** 2)) * THREE.MathUtils.smoothstep(Math.sin(u * tau * 26 + 0.8), 0.24, 0.64)
        const stitchMask = Math.min(1, lowerStitch + upperStitch + lipStitch * 0.65)

        const seamShadow = (lowerCasingTuck + upperCasingTuck) * 14 + lipHemLine * 8 - casingTunnelHighlight * 4.0

        const baseR = THREE.MathUtils.clamp(242 + weave - seamShadow * 0.92, 196, 255)
        const baseG = THREE.MathUtils.clamp(245 + weave * 0.96 - seamShadow * 0.88, 200, 255)
        const baseB = THREE.MathUtils.clamp(243 + weave * 0.90 - seamShadow * 0.78, 202, 255)

        const r = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseR, 255, stitchMask * 0.86)), 194, 255)
        const g = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseG, 252, stitchMask * 0.82)), 198, 255)
        const b = THREE.MathUtils.clamp(Math.round(THREE.MathUtils.lerp(baseB, 228, stitchMask * 0.72)), 196, 255)

        const idx = (y * size + x) * 4
        colorData[idx] = r; colorData[idx + 1] = g; colorData[idx + 2] = b; colorData[idx + 3] = 255

        const h = THREE.MathUtils.clamp(
          Math.round(128 + yarnHeight * 38 + (warpSlub + weftSlub) * 2.2 - (lowerCasingTuck + upperCasingTuck) * 26 + stitchMask * 36),
          32,
          232,
        )
        bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
      }
    }
    cachedClothPixels = { color: colorData, bump: bumpData, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedClothPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = THREE.RepeatWrapping
  map.wrapT = THREE.ClampToEdgeWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedClothPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = THREE.RepeatWrapping
  bump.wrapT = THREE.ClampToEdgeWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/** Deterministic braided drawstring cord texture (albedo + relief, seamless tiling). */
function createDrawstringCordTextures(): { map: THREE.DataTexture; bump: THREE.DataTexture } {
  const size = 128
  if (!cachedCordPixels) {
    const colorData = new Uint8Array(size * size * 4)
    const bumpData = new Uint8Array(size * size * 4)
    const tau = Math.PI * 2
    for (let y = 0; y < size; y++) {
      const v = y / size
      for (let x = 0; x < size; x++) {
        const u = x / size
        const s1 = Math.sin((u * 12 + v * 3) * tau)
        const s2 = Math.sin((u * 12 - v * 3) * tau)
        const braid = Math.max(s1, s2) * 0.72 + (s1 + s2) * 0.14
        const shade = braid * 15
        const idx = (y * size + x) * 4
        colorData[idx] = THREE.MathUtils.clamp(Math.round(246 + shade * 0.85), 204, 255)
        colorData[idx + 1] = THREE.MathUtils.clamp(Math.round(238 + shade * 0.92), 192, 252)
        colorData[idx + 2] = THREE.MathUtils.clamp(Math.round(218 + shade * 1.05), 168, 242)
        colorData[idx + 3] = 255
        const h = THREE.MathUtils.clamp(Math.round(128 + braid * 56), 30, 236)
        bumpData[idx] = h; bumpData[idx + 1] = h; bumpData[idx + 2] = h; bumpData[idx + 3] = 255
      }
    }
    cachedCordPixels = { color: colorData, bump: bumpData, size }
  }
  const map = new THREE.DataTexture(new Uint8Array(cachedCordPixels.color), size, size)
  map.colorSpace = THREE.SRGBColorSpace
  map.wrapS = map.wrapT = THREE.RepeatWrapping
  map.magFilter = THREE.LinearFilter
  map.minFilter = THREE.LinearMipmapLinearFilter
  map.generateMipmaps = true
  map.needsUpdate = true

  const bump = new THREE.DataTexture(new Uint8Array(cachedCordPixels.bump), size, size)
  bump.colorSpace = THREE.NoColorSpace
  bump.wrapS = bump.wrapT = THREE.RepeatWrapping
  bump.magFilter = THREE.LinearFilter
  bump.minFilter = THREE.LinearMipmapLinearFilter
  bump.generateMipmaps = true
  bump.needsUpdate = true
  return { map, bump }
}

/**
 * Pre-allocated closed tube geometry updated in-place via holonomy-corrected parallel-transport
 * frames (eliminating closed-loop twist kinks) with optional seamless helical ply relief.
 */
function createDynamicClosedTube(
  tubularSegments: number,
  radialSegments: number,
  radius: number,
  options: { plyTurns?: number; plyDepth?: number; uvRepeatU?: number } = {},
) {
  const ringVerts = radialSegments + 1
  const vertCount = (tubularSegments + 1) * ringVerts
  const positions = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const indices: number[] = []
  const uvRepeatU = options.uvRepeatU ?? 4
  const plyTurns = options.plyTurns ?? 0
  const plyDepth = options.plyDepth ?? 0
  for (let i = 0; i <= tubularSegments; i++) {
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * ringVerts + j
      uvs[k * 2] = (i / tubularSegments) * uvRepeatU
      uvs[k * 2 + 1] = j / radialSegments
      if (i < tubularSegments && j < radialSegments) {
        const a = i * ringVerts + j
        const b = (i + 1) * ringVerts + j
        const c = (i + 1) * ringVerts + j + 1
        const d = i * ringVerts + j + 1
        indices.push(a, b, d, b, c, d)
      }
    }
  }
  const geometry = new THREE.BufferGeometry()
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)

  const cosT = new Float32Array(ringVerts)
  const sinT = new Float32Array(ringVerts)
  const thetas = new Float32Array(ringVerts)
  for (let j = 0; j <= radialSegments; j++) {
    const a = (j / radialSegments) * Math.PI * 2
    thetas[j] = a
    cosT[j] = Math.cos(a)
    sinT[j] = Math.sin(a)
  }
  const centers: THREE.Vector3[] = Array.from({ length: tubularSegments }, () => new THREE.Vector3())
  const tangents: THREE.Vector3[] = Array.from({ length: tubularSegments }, () => new THREE.Vector3())
  const frameNormals: THREE.Vector3[] = Array.from({ length: tubularSegments + 1 }, () => new THREE.Vector3())
  const frameBinormals: THREE.Vector3[] = Array.from({ length: tubularSegments + 1 }, () => new THREE.Vector3())
  const normal = new THREE.Vector3(), binormal = new THREE.Vector3(), prevTan = new THREE.Vector3(), rotAxis = new THREE.Vector3()
  const rotQuat = new THREE.Quaternion(), refUp = new THREE.Vector3(0, 1, 0), refX = new THREE.Vector3(1, 0, 0)
  const seamN = new THREE.Vector3()

  function updateFromCurve(controlPoints: readonly THREE.Vector3[], radiusFn?: (u: number) => number) {
    const curve = new THREE.CatmullRomCurve3(controlPoints as THREE.Vector3[], true, 'centripetal')
    for (let i = 0; i < tubularSegments; i++) {
      curve.getPointAt(i / tubularSegments, centers[i]!)
    }
    for (let i = 0; i < tubularSegments; i++) {
      const prev = centers[(i - 1 + tubularSegments) % tubularSegments]!
      const next = centers[(i + 1) % tubularSegments]!
      tangents[i]!.subVectors(next, prev).normalize()
    }
    const t0 = tangents[0]!
    const ref = Math.abs(t0.dot(refUp)) < 0.9 ? refUp : refX
    normal.crossVectors(t0, ref).normalize()
    binormal.crossVectors(t0, normal).normalize()
    prevTan.copy(t0)
    frameNormals[0]!.copy(normal)
    frameBinormals[0]!.copy(binormal)

    for (let i = 1; i <= tubularSegments; i++) {
      const idx = i % tubularSegments
      const tan = tangents[idx]!
      rotAxis.crossVectors(prevTan, tan)
      const sinA = rotAxis.length()
      if (sinA > 1e-6) {
        rotAxis.divideScalar(sinA)
        const cosA = THREE.MathUtils.clamp(prevTan.dot(tan), -1, 1)
        rotQuat.setFromAxisAngle(rotAxis, Math.atan2(sinA, cosA))
        normal.applyQuaternion(rotQuat).normalize()
        binormal.crossVectors(tan, normal).normalize()
      }
      prevTan.copy(tan)
      frameNormals[i]!.copy(normal)
      frameBinormals[i]!.copy(binormal)
    }

    // Unwind closed-loop parallel-transport holonomy so i=tubularSegments joins i=0 with zero twist pinch.
    const nStart = frameNormals[0]!, bStart = frameBinormals[0]!, nEnd = frameNormals[tubularSegments]!
    const holonomy = Math.atan2(nEnd.dot(bStart), nEnd.dot(nStart))

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= tubularSegments; i++) {
      const idx = i % tubularSegments
      const u = i / tubularSegments
      const c = centers[idx]!
      const n0 = frameNormals[i]!, b0 = frameBinormals[i]!
      const corr = -holonomy * u
      const cc = Math.cos(corr), sc = Math.sin(corr)
      const nx = n0.x * cc + b0.x * sc, ny = n0.y * cc + b0.y * sc, nz = n0.z * cc + b0.z * sc
      const bx = -n0.x * sc + b0.x * cc, by = -n0.y * sc + b0.y * cc, bz = -n0.z * sc + b0.z * cc
      const baseRad = radiusFn ? radiusFn(u) : radius
      const twist = plyTurns > 0 ? u * plyTurns * Math.PI * 2 : 0
      for (let j = 0; j <= radialSegments; j++) {
        const ca = cosT[j]!, sa = sinT[j]!
        const r = plyDepth > 0 ? baseRad * (1 + plyDepth * Math.cos(2 * (thetas[j]! - twist))) : baseRad
        posAttr.setXYZ(
          i * ringVerts + j,
          c.x + r * (nx * ca + bx * sa),
          c.y + r * (ny * ca + by * sa),
          c.z + r * (nz * ca + bz * sa),
        )
      }
    }
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
    const normAttr = geometry.getAttribute('normal') as THREE.BufferAttribute
    // Weld seam normals across both radial wrap (j=0/radialSegments) and closed loop join (i=0/tubularSegments).
    for (let i = 0; i <= tubularSegments; i++) {
      const a = i * ringVerts, b = a + radialSegments
      seamN.set(normAttr.getX(a) + normAttr.getX(b), normAttr.getY(a) + normAttr.getY(b), normAttr.getZ(a) + normAttr.getZ(b))
      if (seamN.lengthSq() > 1e-10) {
        seamN.normalize()
        normAttr.setXYZ(a, seamN.x, seamN.y, seamN.z)
        normAttr.setXYZ(b, seamN.x, seamN.y, seamN.z)
      }
    }
    const endOffset = tubularSegments * ringVerts
    for (let j = 0; j <= radialSegments; j++) {
      const a = j, b = endOffset + j
      seamN.set(normAttr.getX(a) + normAttr.getX(b), normAttr.getY(a) + normAttr.getY(b), normAttr.getZ(a) + normAttr.getZ(b))
      if (seamN.lengthSq() > 1e-10) {
        seamN.normalize()
        normAttr.setXYZ(a, seamN.x, seamN.y, seamN.z)
        normAttr.setXYZ(b, seamN.x, seamN.y, seamN.z)
      }
    }
    normAttr.needsUpdate = true
    geometry.computeBoundingBox()
    geometry.computeBoundingSphere()
  }

  return { geometry, updateFromCurve }
}

/** A closed hollow cloth bag and three separate marked pebble solids. Units are scene units. */
export function createGodairikiModel() {
 const root=new THREE.Group();root.name='godairiki-root'
 const subject=new THREE.Group();subject.name='godairiki-subject';root.add(subject)
 const stoneMat=new THREE.MeshStandardMaterial({color:0xe6dfc6,roughness:.92})
 const ink=new THREE.MeshStandardMaterial({color:0x3f4446,roughness:1})
 const clothTex = createPouchClothTextures()
 const cordTex = createDrawstringCordTextures()
 const cloth = createRitualMaterial(
  { color: 0x64aaa3, map: clothTex.map, bumpMap: clothTex.bump, bumpScale: 0.0044, roughness: 0.94, vertexColors: true },
  { kind: 'cloth', strength: 0.12, fiber: false },
 )
 const rimMat = createRitualMaterial(
  { color: 0x7cb7ab, map: clothTex.map, bumpMap: clothTex.bump, bumpScale: 0.0032, roughness: 0.93 },
  { kind: 'cloth', strength: 0.10, fiber: false },
 )
 const cordMat = createRitualMaterial(
  { color: 0xf1d9a8, map: cordTex.map, bumpMap: cordTex.bump, bumpScale: 0.0045, roughness: 0.88 },
  { kind: 'cloth', strength: 0.08, fiber: false },
 )
 // Release scene-owned DataTextures exactly once when materials are disposed via disposeTree.
 let clothMapsFreed = false
 const freeClothMaps = () => {
  if (clothMapsFreed) return
  clothMapsFreed = true
  clothTex.map.dispose()
  clothTex.bump.dispose()
 }
 cloth.addEventListener('dispose', freeClothMaps)
 rimMat.addEventListener('dispose', freeClothMaps)
 let cordMapsFreed = false
 cordMat.addEventListener('dispose', () => {
  if (cordMapsFreed) return
  cordMapsFreed = true
  cordTex.map.dispose()
  cordTex.bump.dispose()
 })
 applyCraftSurface(stoneMat, { kind: 'stone', strength: .4 })

 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=subject)=>{const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 const ground=make('godairiki-gravel-bed',new THREE.CylinderGeometry(1.85,1.9,.07,64),new THREE.MeshStandardMaterial({color:0xd6cdb4,roughness:1}));ground.position.set(-.08,-.035,0);ground.geometry.scale(1,1,.72)

 // Closed hollow kinchaku cloth pouch profile (24 rings): denser across mid-belly and sewn casing channel
 // so asymmetric gathered pleats and gravity-settle folds curve crisply with watertight pole closure.
 const profile: [number, number, number, number][] = [
  // [r, y, isOuter (1 = outer, 0 = inner, 0.5 = lip crest), clothV]
  [0, 0, 1, 0.0],
  [.56, 0, 1, 0.06],
  [.69, .04, 1, 0.11],
  [.78, .12, 1, 0.16],
  [.832, .22, 1, 0.22],
  [.844, .34, 1, 0.28],
  [.832, .46, 1, 0.34],
  [.794, .565, 1, 0.39],
  [.748, .655, 1, 0.44],
  [.708, .712, 1, 0.472], // lower drawstring casing stitch line
  [.682, .752, 1, 0.506], // pinched cloth drawstring tunnel belly
  [.688, .788, 1, 0.538], // upper drawstring casing stitch line
  [.716, .834, 1, 0.576], // softly flared ruffled cloth collar
  [.738, .886, 0.5, 0.614], // outer lip fold crest
  [.714, .898, 0.5, 0.630], // rounded lip crown
  [.684, .884, 0.5, 0.646], // inner lip edge
  [.654, .828, 0, 0.684],
  [.642, .760, 0, 0.722],
  [.674, .670, 0, 0.764],
  [.740, .520, 0, 0.818],
  [.774, .350, 0, 0.872],
  [.762, .195, 0, 0.922],
  [.695, .090, 0, 0.958],
  [.585, .05, 0, 0.982],
  [0, .05, 0, 1.0],
 ]
 const bagGeometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),RADIAL_SEGS)
 // Remove only zero-area pole triangles generated by LatheGeometry; preserve the watertight pole fan.
 const pos=bagGeometry.attributes.position! as THREE.BufferAttribute
 const uvAttr=bagGeometry.attributes.uv! as THREE.BufferAttribute
 const indices=bagGeometry.index!,triangles:number[]=[],va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3()
 for(let i=0;i<indices.count;i+=3){
  va.fromBufferAttribute(pos,indices.getX(i));vb.fromBufferAttribute(pos,indices.getX(i+1));vc.fromBufferAttribute(pos,indices.getX(i+2))
  if(vb.sub(va).cross(vc.sub(va)).lengthSq()>1e-18)triangles.push(indices.getX(i),indices.getX(i+1),indices.getX(i+2))
 }
 bagGeometry.setIndex(triangles)

 // Cache polar cylindrical coordinates and map clean wrap-seamless cloth UVs.
 const vertCount = pos.count
 const baseR = new Float32Array(vertCount)
 const baseY = new Float32Array(vertCount)
 const baseAngle = new Float32Array(vertCount)
 const baseOuter = new Float32Array(vertCount)
 const profileLen = profile.length
 for (let i = 0; i < vertCount; i++) {
  const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
  const segIdx = Math.floor(i / profileLen)
  const profIdx = i % profileLen
  const phi = ((segIdx % RADIAL_SEGS) / RADIAL_SEGS) * Math.PI * 2
  baseR[i] = Math.hypot(x, z)
  baseY[i] = y
  // Match Three.js LatheGeometry winding (x = r*sin(phi), z = r*cos(phi)) while indexing angle=0 at +X, +pi/2 at +Z.
  baseAngle[i] = Math.atan2(Math.cos(phi), Math.sin(phi))
  baseOuter[i] = profile[profIdx]![2]
  uvAttr.setXY(i, (segIdx / RADIAL_SEGS) * 4.0, profile[profIdx]![3])
 }
 uvAttr.needsUpdate = true
 const bagColors = new Float32Array(vertCount * 3)
 bagGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bagColors, 3))
 const pouch=make('godairiki-pouch',bagGeometry,cloth);pouch.position.x=POUCH_X

 // Holonomy-free folded cloth lip hem tracks the ruffled mouth contour 1:1 with the pouch pleats (no Z-fighting).
 const TUBE_RING_SEGS = RADIAL_SEGS
 const rimTube = createDynamicClosedTube(TUBE_RING_SEGS, 8, 0.0205, { uvRepeatU: 4 })
 const rim = make('godairiki-soft-rim', rimTube.geometry, rimMat)
 rim.position.set(POUCH_X, 0, 0)

 // Two neat bound cloth casing-exit eyelets at ±X where the braided drawstring loops emerge
 // cleanly from the sewn fabric drawstring tunnel (zero Z-fighting exterior stripe).
 const slitGeo = new THREE.TorusGeometry(0.036, 0.011, 8, 18)
 const leftSlit = make('godairiki-casing-slit--1', slitGeo, rimMat)
 leftSlit.scale.set(0.62, 1.0, 0.72)
 const rightSlit = make('godairiki-casing-slit-1', slitGeo, rimMat)
 rightSlit.scale.set(0.62, 1.0, 0.72)

 // Two supple gravity-draped 2-ply braided drawstring loops exit the ±X casing channels,
 // hug the folded cloth shoulders, and rest smoothly on the gravel bed.
 const leftCordTube = createDynamicClosedTube(64, 8, 0.016, { plyTurns: 18, plyDepth: 0.11, uvRepeatU: 6 })
 const leftCord = make('godairiki-cord--1', leftCordTube.geometry, cordMat)
 leftCord.position.set(POUCH_X, 0, 0)

 const rightCordTube = createDynamicClosedTube(64, 8, 0.016, { plyTurns: 18, plyDepth: 0.11, uvRepeatU: 6 })
 const rightCord = make('godairiki-cord-1', rightCordTube.geometry, cordMat)
 rightCord.position.set(POUCH_X, 0, 0)

 const rimPts: THREE.Vector3[] = Array.from({ length: TUBE_RING_SEGS }, () => new THREE.Vector3())
 const leftPts: THREE.Vector3[] = Array.from({ length: 10 }, () => new THREE.Vector3())
 const rightPts: THREE.Vector3[] = Array.from({ length: 10 }, () => new THREE.Vector3())
 const leftExit = new THREE.Vector3(), rightExit = new THREE.Vector3()
 const leftShoulderBack = new THREE.Vector3(), leftShoulderFront = new THREE.Vector3()
 const rightShoulderBack = new THREE.Vector3(), rightShoulderFront = new THREE.Vector3()
 const tmpStonePresence: [number, number, number] = [0, 0, 0]

 /**
  * Evaluates asymmetric kinchaku cloth gathers, belly drape creases, lower gravity-settle
  * folds, loaded stone expansion, and damped landing cushion at (r0, y0, angle).
  */
 function evalPouchPoint(
  r0: number,
  y0: number,
  angle: number,
  isOuter: number,
  load: number,
  stones: readonly [number, number, number],
  impact: number,
  impactAngle: number,
  out: THREE.Vector3,
 ): { fold: number; pinch: number; neckMask: number; settleCrease: number } {
  if (r0 < 1e-5) {
   out.set(0, y0, 0)
   return { fold: 0, pinch: 0, neckMask: 0, settleCrease: 0 }
  }
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const cos2 = cosA * cosA, cos4 = cos2 * cos2
  const topMask = smooth((y0 - .34) / .56)
  const floorMask = smooth((y0 - .055) / .135)
  const neckMask = Math.exp(-Math.pow((y0 - .754) / .095, 2))
  const casingTunnel = Math.exp(-Math.pow((y0 - .754) / .042, 2))
  const bellyMask = Math.sin(THREE.MathUtils.clamp((y0 - .04) / .76, 0, 1) * Math.PI)

  // Asymmetric localized kinchaku pleats: distinct narrow inward pinch valleys separating plump
  // cloth lobes, flowing visibly from the ruffled lip through the stitched casing all the way down the belly.
  const bellyCarry = smooth((y0 - .06) / .22)
  const collarSharpen = 1 + .20 * smooth((y0 - .58) / .32)
  // Keep pleat width crisp down the mid-belly (only gentle 16% splay) so belly folds never wash out into plastic.
  const widthSplay = 1 + .16 * (1 - smooth((y0 - .18) / .54))
  let pinchSum = 0
  for (let k = 0; k < GATHER_PLEATS.length; k++) {
   const [pAng, pWidth, pDepth, pDrift] = GATHER_PLEATS[k]!
   const driftedAng = pAng + pDrift * (0.75 - y0)
   const d = wrapAngleDiff(angle, driftedAng)
   const w = pWidth * widthSplay
   const g = Math.exp(-((d / w) ** 2))
   pinchSum += pDepth * g
  }
  // Subtract mean pinch (~0.025) so narrow valleys tuck inward (-0.048) while cloth lobes swell plumply (+0.024).
  const rawPleat = (0.025 - pinchSum) + 0.012 * Math.sin(angle * 3 + 0.45) + 0.008 * Math.cos(angle * 4 - 0.9)
  // Preserve distinct vertical cloth folds even when loaded (gentle 10% softening, never smooth silicone).
  const gatherGain = (1 + .14 * cos2) * collarSharpen * (1 - .10 * load)
  const gatherDelta = rawPleat * gatherGain * bellyCarry

  // Soft diagonal & horizontal compression creases near the lower belly where heavy cloth settles on the gravel.
  const lowerBand = Math.exp(-Math.pow((y0 - .18) / .095, 2))
  const settleCrease =
   -.022 * (0.58 + 0.42 * load) * Math.sin((y0 - .07) * 26.0 + 1.15 * Math.sin(angle * 3 + 0.35)) * lowerBand

  // Drawstring casing pinch tucks cleanly inward along y=0.752, strongest near the ±X cord exits,
  // with a plump sewn fabric tunnel ridge where the drawstring runs inside the casing.
  const casingPinch = (-(.038 + .040 * cos4) * neckMask + .015 * casingTunnel * (isOuter > .7 ? 1 : 0)) * (1 - .10 * load)

  // Empty pouch mouth gathers softer & more slouched inward; three heavy stones broaden belly & open mouth.
  const emptySlouch = -.086 * (1 - load) * topMask * (.78 + .24 * Math.sin(angle * 2 - .5))
  let stoneBelly = 0
  for (let s = 0; s < 3; s++) {
   const w = stones[s]!
   if (w <= 0) continue
   const align = .5 + .5 * Math.cos(angle - STONE_ANGLES[s]!)
   stoneBelly += w * .042 * Math.pow(align, 2.2)
  }
  const loadedBelly = (.034 * load + stoneBelly) * bellyMask * floorMask
  const loadedRimOpen = .032 * load * topMask

  // Brief damped fabric cushion push localized near the landing stone during drop (strictly 0 at t=0,1).
  const impactAlign = .45 + .55 * Math.cos(angle - impactAngle)
  const impactRadial = impact * .038 * impactAlign * (.35 + .65 * bellyMask) * floorMask

  // Preserve exact 0140f204 +X auto-fit framing envelope (0.000 camera drift on 346x332 and 390x844).
  // Matches baseline loaded right-belly stone bulge extent (world.x = 1.8235 -> local +0.9735 at y≈0.42).
  const loadedRightBelly = 0.056 * load * Math.pow(Math.max(0, cosA), 2.5) * bellyMask * floorMask
  const rawRadialScale = 1 + (gatherDelta + settleCrease + casingPinch + emptySlouch + loadedBelly + loadedRightBelly + loadedRimOpen + impactRadial) * floorMask
  let r = r0 * rawRadialScale
  // Ensure inner wall always clears the three seated stones comfortably.
  if (isOuter < .25 && y0 > .06 && y0 < .48) {
   r = Math.max(r, r0 * (.985 + .035 * load))
  }
  const maxRightX = 0.9674
  if (cosA > 0.25 && cosA * r > maxRightX) {
   r = maxRightX / cosA
  }

  // Organic collar height undulation & gravity weight settle (clamped <= 0.916 so lifted stones clear cleanly).
  const collarWave = (rawPleat * 0.42 + 0.014 * Math.sin(angle * 3 + 0.42) - 0.011 * Math.cos(angle * 5 - 0.78)) * topMask
  const cinchRise = .016 * cos4 * topMask
  const frontDip = -.024 * Math.max(0, sinA) * topMask
  const weightDrop = -.048 * load * smooth((y0 - .14) / .76)
  const impactDrop = -impact * .026 * impactAlign * topMask
  let y = y0
  if (y0 > .055) {
   y = Math.max(.056, Math.min(.916, y0 + (collarWave + cinchRise + frontDip + weightDrop + impactDrop) * floorMask))
  }

  // Subtle organic cloth drape lean when empty that settles upright under the weight of three stones.
  const leanX = (.022 * (1 - load) * Math.sin(angle * 2 + .6) - .020 * (1 - load)) * topMask * floorMask
  const leanZ = (.017 * (1 - load) * Math.cos(angle - .4)) * topMask * floorMask

  out.set(cosA * r + leanX, y, sinA * r * POUCH_Z_SCALE + leanZ)
  return { fold: rawPleat * gatherGain, pinch: pinchSum * bellyCarry, neckMask, settleCrease }
 }

 const tmpPt = new THREE.Vector3()
 let lastPoseKey = ''

 function updatePouch(load: number, stones: readonly [number, number, number], impact: number, impactAngle: number) {
  const key = `${load.toFixed(4)}|${stones[0].toFixed(3)},${stones[1].toFixed(3)},${stones[2].toFixed(3)}|${impact.toFixed(4)}|${impactAngle.toFixed(3)}`
  if (key === lastPoseKey) return
  lastPoseKey = key

  const colAttr = bagGeometry.getAttribute('color') as THREE.BufferAttribute
  for (let i = 0; i < vertCount; i++) {
   const r0 = baseR[i]!, y0 = baseY[i]!, angle = baseAngle[i]!, isOuter = baseOuter[i]!
   const { fold, pinch, neckMask, settleCrease } = evalPouchPoint(r0, y0, angle, isOuter, load, stones, impact, impactAngle, tmpPt)
   pos.setXYZ(i, tmpPt.x, tmpPt.y, tmpPt.z)

   // Clean cool-warm anime cloth shading: crisp cool-teal fold valleys down the full belly,
   // warm sunlit cloth lobe crests, sewn casing-tuck shadow, and soft grounded base AO.
   const bellyVis = smooth((y0 - .05) / .20)
   const foldTerm = THREE.MathUtils.clamp(fold * 2.55 - pinch * 1.15, -.25, .12) * bellyVis
   const creaseTerm = settleCrease * 2.8
   const casingShadow = isOuter > .7 ? 1 - .105 * neckMask : 1
   const baseAo = isOuter > .7 ? 1 - .080 * (1 - smooth((y0 - .02) / .14)) : 1
   const interiorShade = isOuter < .25 ? .84 + .14 * smooth(y0 / .85) : 1
   const lipLift = isOuter > .3 && isOuter < .7 ? 1.04 : 1

   const lum = THREE.MathUtils.clamp((0.962 + foldTerm + creaseTerm) * casingShadow * baseAo * interiorShade * lipLift, .64, 1.07)
   // Shift shadowed valleys gently cooler teal-slate and sunlit lobe crests subtly warmer (clean anime cel tone).
   const valleyCool = Math.max(0, -foldTerm) * 0.45
   const crestWarm = Math.max(0, foldTerm) * 0.28
   colAttr.setXYZ(
    i,
    THREE.MathUtils.clamp(lum - valleyCool * 0.48 + crestWarm * 0.32, 0.56, 1.08),
    THREE.MathUtils.clamp(lum - valleyCool * 0.14 + crestWarm * 0.14, 0.61, 1.07),
    THREE.MathUtils.clamp(lum + valleyCool * 0.28 - crestWarm * 0.08, 0.66, 1.06),
   )
  }
  pos.needsUpdate = true
  colAttr.needsUpdate = true
  bagGeometry.computeVertexNormals()
  // Weld vertex normals across LatheGeometry's azimuthal seam (segIdx=0 and segIdx=RADIAL_SEGS).
  const normAttr = bagGeometry.getAttribute('normal') as THREE.BufferAttribute
  const seamOffset = RADIAL_SEGS * profileLen
  for (let p = 0; p < profileLen; p++) {
   const a = p, b = seamOffset + p
   const nx = normAttr.getX(a) + normAttr.getX(b)
   const ny = normAttr.getY(a) + normAttr.getY(b)
   const nz = normAttr.getZ(a) + normAttr.getZ(b)
   const len = Math.hypot(nx, ny, nz) || 1
   normAttr.setXYZ(a, nx / len, ny / len, nz / len)
   normAttr.setXYZ(b, nx / len, ny / len, nz / len)
  }
  normAttr.needsUpdate = true
  bagGeometry.computeBoundingBox()
  bagGeometry.computeBoundingSphere()

  // Update folded cloth lip rim cleanly seated along the ruffled mouth crown (no Z-fighting or edge slivers).
  for (let i = 0; i < TUBE_RING_SEGS; i++) {
   const angle = (i / TUBE_RING_SEGS) * Math.PI * 2
   evalPouchPoint(.714, .898, angle, .5, load, stones, impact, impactAngle, rimPts[i]!)
   rimPts[i]!.y = Math.min(.916, rimPts[i]!.y + .0075)
  }
  rimTube.updateFromCurve(rimPts)

  // Update both gravity-draped 2-ply braided drawstring loops exiting the ±X bound casing slits,
  // hugging the folded cloth shoulders cleanly and resting smoothly inside the gravel disc.
  const slack = .042 * load + .020 * impact
  evalPouchPoint(.700, .752, Math.PI, 1, load, stones, impact, impactAngle, leftExit)
  evalPouchPoint(.700, .752, 0, 1, load, stones, impact, impactAngle, rightExit)
  leftSlit.position.set(POUCH_X + leftExit.x - 0.004, leftExit.y, leftExit.z)
  leftSlit.rotation.set(0, Math.PI / 2, 0)
  rightSlit.position.set(POUCH_X + rightExit.x + 0.004, rightExit.y, rightExit.z)
  rightSlit.rotation.set(0, Math.PI / 2, 0)
  evalPouchPoint(.880, .38, Math.PI + .11, 1, load, stones, impact, impactAngle, leftShoulderBack)
  evalPouchPoint(.880, .38, Math.PI - .21, 1, load, stones, impact, impactAngle, leftShoulderFront)
  evalPouchPoint(.872, .38, .08, 1, load, stones, impact, impactAngle, rightShoulderBack)
  evalPouchPoint(.872, .38, .34, 1, load, stones, impact, impactAngle, rightShoulderFront)

  // Neat end-knot thickening near u=0.50 (resting loop apex) for authentic kinchaku cord silhouette.
  const cordRadiusFn = (u: number) => {
   const dist = Math.abs(u - .5)
   return .016 + .010 * Math.exp(-Math.pow(dist / .030, 2))
  }

  // Left braided drawstring drapes gracefully down the folded shoulder onto clear open gravel (clears y >= 0).
  leftPts[0]!.set(leftExit.x - .012, leftExit.y, leftExit.z - .025)
  leftPts[1]!.set(leftShoulderBack.x - .050, .48 - .025 * load, leftShoulderBack.z - .032)
  leftPts[2]!.set(leftShoulderBack.x - .080, .17, leftShoulderBack.z + .010)
  leftPts[3]!.set(-.95 - slack * .85, .029, .06 + slack * .38)
  leftPts[4]!.set(-1.03 - slack * 1.05, .033, .25 + slack * .65)
  leftPts[5]!.set(-.91 - slack * .62, .033, .41 + slack * .48)
  leftPts[6]!.set(-.77 - slack * .22, .029, .34 + slack * .20)
  leftPts[7]!.set(leftShoulderFront.x - .060, .20, leftShoulderFront.z + .095)
  leftPts[8]!.set(leftShoulderFront.x - .046, .48 - .025 * load, leftShoulderFront.z + .042)
  leftPts[9]!.set(leftExit.x - .012, leftExit.y, leftExit.z + .025)
  leftCordTube.updateFromCurve(leftPts, cordRadiusFn)

  // Right braided drawstring drapes cleanly outside the right shoulder lobe and stays strictly over the gravel disc.
  rightPts[0]!.set(Math.min(.80, rightExit.x + .012), rightExit.y, rightExit.z - .023)
  rightPts[1]!.set(Math.min(.81, rightShoulderBack.x + .022), .47 - .025 * load, rightShoulderBack.z + .022)
  rightPts[2]!.set(Math.min(.81, rightShoulderBack.x + .022), .17, rightShoulderBack.z + .105)
  rightPts[3]!.set(.73 + slack * .18, .029, .28 + slack * .26)
  rightPts[4]!.set(.62 + slack * .18, .033, .47 + slack * .40)
  rightPts[5]!.set(.47 + slack * .14, .033, .54 + slack * .34)
  rightPts[6]!.set(.46, .029, .43 + slack * .18)
  rightPts[7]!.set(Math.min(.80, rightShoulderFront.x + .026), .20, rightShoulderFront.z + .108)
  rightPts[8]!.set(Math.min(.80, rightShoulderFront.x + .024), .47 - .025 * load, rightShoulderFront.z + .038)
  rightPts[9]!.set(Math.min(.80, rightExit.x + .012), rightExit.y, rightExit.z + .023)
  rightCordTube.updateFromCurve(rightPts, cordRadiusFn)
 }

 // Individually spaced ordinary pebbles provide context without a shrine replica or tray.
 for(const [i,x,z,r] of [[0,-1.4,-.45,.11],[1,-1.42,.25,.10],[2,-.48,-.8,.12],[3,-.42,.68,.11],[4,-.36,.02,.09],[5,-1.25,.95,.1],[6,-.67,1.03,.08],[7,-.72,-1.05,.09],[8,-1.46,-.04,.07]]){
  const g=new THREE.SphereGeometry(r,16,10);g.scale(1,.52,.85);const m=make(`godairiki-gravel-${i}`,g,new THREE.MeshStandardMaterial({color:[0xbac0ba,0xc3baa6,0xeee6ce][i!%3],roughness:1}));m.position.set(x!,r!*.52,z!)
 }
 const roots:THREE.Group[]=[],targets:THREE.Mesh[]=[]
 // Characters are original stroke layouts on the upper stone surface, not copied artwork.
 const glyphs:number[][][][]=[
  [[[-.09,-.09],[.09,-.09]],[[.015,-.09],[-.025,.09]],[[-.075,-.015],[.065,-.015],[.05,.09]],[[-.10,.09],[.10,.09]]],
  [[[-.10,-.025],[.10,-.025]],[[.01,-.10],[0,-.015],[-.04,.055],[-.10,.10]],[[0,-.015],[.045,.05],[.10,.10]]],
  [[[-.10,-.03],[.08,-.03],[.07,.08],[.025,.10]],[[0,-.10],[-.015,.02],[-.06,.08],[-.10,.10]]],
 ]
 for(let i=0;i<3;i++){
  const group=new THREE.Group();group.name=`godairiki-stone-root-${i}`;subject.add(group);roots.push(group)
  const geometry=new THREE.SphereGeometry(1,32,20);geometry.scale(.24,.12,.20)
  const stone=make(`godairiki-stone-${i}`,geometry,stoneMat,group);targets.push(stone)
  glyphs[i]!.forEach((stroke,j)=>{
   const points:THREE.Vector3[]=[]
   for(let k=0;k<stroke.length-1;k++)for(let n=k===0?0:1;n<=8;n++){const t=n/8,x=THREE.MathUtils.lerp(stroke[k]![0]!,stroke[k+1]![0]!,t),z=THREE.MathUtils.lerp(stroke[k]![1]!,stroke[k+1]![1]!,t);points.push(new THREE.Vector3(x,.12*Math.sqrt(1-(x/.24)**2-(z/.20)**2)+.002,z))}
   // Ink uses a thin ribbon lying on the pebble surface, with no floating caption.
   const p:number[]=[],ix:number[]=[]
   for(let n=0;n<points.length;n++){const v=points[n]!,next=points[Math.min(n+1,points.length-1)]!,prev=points[Math.max(n-1,0)]!,dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;for(const sign of[-1,1]){const x=v.x+sign*(-dz/len)*.009,z=v.z+sign*(dx/len)*.009;p.push(x,.12*Math.sqrt(1-(x/.24)**2-(z/.20)**2)+.003,z)}if(n<points.length-1){const at=n*2;ix.push(at,at+1,at+2,at+1,at+3,at+2)}}
   const mark=new THREE.BufferGeometry();mark.setAttribute('position',new THREE.Float32BufferAttribute(p,3));mark.setIndex(ix);mark.computeVertexNormals();make(`godairiki-ink-${i}-${j}`,mark,ink,group)
  })
 }
 function pose(step:number,amount:number){
  const n=Number.isFinite(step)?THREE.MathUtils.clamp(Math.floor(step),0,3):0
  const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0
  roots.forEach((o,i)=>{
   const start=new THREE.Vector3(...stoneStarts[i]!),end=new THREE.Vector3(...stoneEnds[i]!)
   if(i<n||(i===n&&t===1))o.position.copy(end)
   else if(i>n)o.position.copy(start)
   else if(t<=.25)o.position.copy(start).lerp(new THREE.Vector3(start.x,1.25,start.z),smooth(t/.25))
   else if(t<=.7)o.position.copy(new THREE.Vector3(start.x,1.25,start.z)).lerp(new THREE.Vector3(end.x,1.25,end.z),smooth((t-.25)/.45))
   else o.position.copy(new THREE.Vector3(end.x,1.25,end.z)).lerp(end,smooth((t-.7)/.3))
  })
  // Progressive weight settling & damped cushion pulse as each pebble lands inside the pouch.
  const seatFraction = n < 3 ? smooth((t - .76) / .24) : 0
  let totalLoad = 0
  for (let i = 0; i < 3; i++) {
   const presence = i < n ? 1 : (i === n ? seatFraction : 0)
   tmpStonePresence[i] = presence
   totalLoad += presence
  }
  const load = totalLoad / 3
  // Damped cloth cushion impulse during landing (t in 0.76..1.0), strictly 0 at t=0 and t=1.
  const impact = n < 3 && t > .76 && t < 1
   ? Math.sin(seatFraction * Math.PI * 1.5) * Math.pow(1 - seatFraction, 1.35)
   : 0
  const impactAngle = n < 3 ? STONE_ANGLES[n]! : 0
  updatePouch(load, tmpStonePresence, impact, impactAngle)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject,roots,targets,pouch,pose,anchors:[[.15,.09,0],[.15,.09,0],[.15,.09,0]] as [number,number,number][]}
}
