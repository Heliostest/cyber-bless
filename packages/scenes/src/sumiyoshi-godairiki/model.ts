import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'

const smooth = (n: number) => { const t=THREE.MathUtils.clamp(n,0,1); return t*t*(3-2*t) }
const stoneStarts = [[-.94,.12,-.60],[-1.02,.12,0],[-.94,.12,.60]] as const
const stoneEnds = [[.57,.17,-.18],[1.13,.17,-.18],[.85,.17,.30]] as const
const POUCH_X = .85
const POUCH_Z_SCALE = .83
const RADIAL_SEGS = 84
const STONE_ANGLES = stoneEnds.map(([x, , z]) => Math.atan2(z / POUCH_Z_SCALE, x - POUCH_X))

/** Pre-allocated closed tube geometry updated in-place via parallel-transport frames (zero allocations/disposals). */
function createDynamicClosedTube(tubularSegments: number, radialSegments: number, radius: number) {
  const ringVerts = radialSegments + 1
  const vertCount = (tubularSegments + 1) * ringVerts
  const positions = new Float32Array(vertCount * 3)
  const uvs = new Float32Array(vertCount * 2)
  const indices: number[] = []
  for (let i = 0; i <= tubularSegments; i++) {
    for (let j = 0; j <= radialSegments; j++) {
      const k = i * ringVerts + j
      uvs[k * 2] = i / tubularSegments
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
  for (let j = 0; j <= radialSegments; j++) {
    const a = (j / radialSegments) * Math.PI * 2
    cosT[j] = Math.cos(a)
    sinT[j] = Math.sin(a)
  }
  const centers: THREE.Vector3[] = Array.from({ length: tubularSegments }, () => new THREE.Vector3())
  const tangents: THREE.Vector3[] = Array.from({ length: tubularSegments }, () => new THREE.Vector3())
  const normal = new THREE.Vector3(), binormal = new THREE.Vector3(), prevTan = new THREE.Vector3(), rotAxis = new THREE.Vector3()
  const rotQuat = new THREE.Quaternion(), refUp = new THREE.Vector3(0, 1, 0), refX = new THREE.Vector3(1, 0, 0)

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

    const posAttr = geometry.getAttribute('position') as THREE.BufferAttribute
    for (let i = 0; i <= tubularSegments; i++) {
      const idx = i % tubularSegments
      const tan = tangents[idx]!
      if (i > 0) {
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
      }
      const c = centers[idx]!
      const r = radiusFn ? radiusFn(i / tubularSegments) : radius
      for (let j = 0; j <= radialSegments; j++) {
        const ca = cosT[j]!, sa = sinT[j]!
        posAttr.setXYZ(
          i * ringVerts + j,
          c.x + r * (normal.x * ca + binormal.x * sa),
          c.y + r * (normal.y * ca + binormal.y * sa),
          c.z + r * (normal.z * ca + binormal.z * sa),
        )
      }
    }
    posAttr.needsUpdate = true
    geometry.computeVertexNormals()
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
 const cloth=new THREE.MeshStandardMaterial({color:0x64aaa3,roughness:1,vertexColors:true})
 const rimMat=new THREE.MeshStandardMaterial({color:0x8bbdb0,roughness:1})
 const cordMat=new THREE.MeshStandardMaterial({color:0xefd4a0,roughness:1})
 applyCraftSurface(cloth, { kind: 'fabric', strength: .26 })
 applyCraftSurface(rimMat, { kind: 'fabric', strength: .26 })
 applyCraftSurface(cordMat, { kind: 'cord', strength: .3 })
 applyCraftSurface(stoneMat, { kind: 'stone', strength: .4 })

 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=subject)=>{const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.castShadow=true;mesh.receiveShadow=true;parent.add(mesh);return mesh}
 const ground=make('godairiki-gravel-bed',new THREE.CylinderGeometry(1.85,1.9,.07,64),new THREE.MeshStandardMaterial({color:0xd6cdb4,roughness:1}));ground.position.set(-.08,-.035,0);ground.geometry.scale(1,1,.72)

 // Closed hollow kinchaku cloth pouch profile: flat grounded outer underside -> soft bellying cloth wall ->
 // subtle drawstring casing tuck around y=0.74 -> softly flared ruffled cloth lip at y=0.89 -> inner wall ->
 // flat inner floor at y=0.05. Two poles close the base without spanning the open mouth.
 const profile: [number, number, number][] = [
  // [r, y, isOuter (1 = outer, 0 = inner, 0.5 = lip crest)]
  [0, 0, 1],
  [.58, 0, 1],
  [.70, .035, 1],
  [.80, .14, 1],
  [.845, .28, 1],
  [.84, .44, 1],
  [.79, .59, 1],
  [.715, .71, 1],
  [.685, .765, 1], // subtle drawstring channel cinch
  [.725, .835, 1],
  [.745, .892, 0.5], // soft ruffled outer lip crest
  [.715, .902, 0.5], // rounded lip crown
  [.682, .888, 0.5], // inner lip edge
  [.648, .825, 0],
  [.638, .76, 0],
  [.672, .67, 0],
  [.74, .52, 0],
  [.775, .35, 0],
  [.765, .20, 0],
  [.71, .10, 0],
  [.59, .05, 0],
  [0, .05, 0],
 ]
 const bagGeometry=new THREE.LatheGeometry(profile.map(([r,y])=>new THREE.Vector2(r,y)),RADIAL_SEGS)
 // Remove only zero-area pole triangles generated by LatheGeometry; preserve the watertight pole fan.
 const pos=bagGeometry.attributes.position! as THREE.BufferAttribute
 const indices=bagGeometry.index!,triangles:number[]=[],va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3()
 for(let i=0;i<indices.count;i+=3){
  va.fromBufferAttribute(pos,indices.getX(i));vb.fromBufferAttribute(pos,indices.getX(i+1));vc.fromBufferAttribute(pos,indices.getX(i+2))
  if(vb.sub(va).cross(vc.sub(va)).lengthSq()>1e-18)triangles.push(indices.getX(i),indices.getX(i+1),indices.getX(i+2))
 }
 bagGeometry.setIndex(triangles)

 // Cache polar cylindrical coordinates for fast in-place cloth mechanics updates.
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
 }
 const bagColors = new Float32Array(vertCount * 3)
 bagGeometry.setAttribute('color', new THREE.Float32BufferAttribute(bagColors, 3))
 const pouch=make('godairiki-pouch',bagGeometry,cloth);pouch.position.x=POUCH_X

 // Soft cloth lip hem & exterior drawstring casing cord track the deformed pouch contour in-place.
 const rimTube = createDynamicClosedTube(RADIAL_SEGS, 8, 0.022)
 const rim = make('godairiki-soft-rim', rimTube.geometry, rimMat)
 rim.position.set(POUCH_X, 0, 0)

 const casingTube = createDynamicClosedTube(RADIAL_SEGS, 7, 0.013)
 const casingCord = make('godairiki-casing-cord', casingTube.geometry, cordMat)
 casingCord.position.set(POUCH_X, 0, 0)

 // Two supple gravity-draped braided drawstring loops exit the ±X casing channels,
 // hug the soft cloth shoulder, and rest naturally on the gravel bed.
 const leftCordTube = createDynamicClosedTube(68, 8, 0.0165)
 const leftCord = make('godairiki-cord--1', leftCordTube.geometry, cordMat)
 leftCord.position.set(POUCH_X, 0, 0)

 const rightCordTube = createDynamicClosedTube(68, 8, 0.0165)
 const rightCord = make('godairiki-cord-1', rightCordTube.geometry, cordMat)
 rightCord.position.set(POUCH_X, 0, 0)

 const rimPts: THREE.Vector3[] = Array.from({ length: RADIAL_SEGS }, () => new THREE.Vector3())
 const casingPts: THREE.Vector3[] = Array.from({ length: RADIAL_SEGS }, () => new THREE.Vector3())
 const tmpStonePresence: [number, number, number] = [0, 0, 0]

 /** Evaluates organic kinchaku gather pleats, loaded gravity sag, and damped drop cushion at (r, y, angle). */
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
 ): { fold: number; neckMask: number } {
  if (r0 < 1e-5) {
   out.set(0, y0, 0)
   return { fold: 0, neckMask: 0 }
  }
  const cosA = Math.cos(angle), sinA = Math.sin(angle)
  const cos2 = cosA * cosA, cos4 = cos2 * cos2
  const topMask = smooth((y0 - .34) / .56)
  const floorMask = smooth((y0 - .055) / .14)
  const neckMask = Math.exp(-Math.pow((y0 - .755) / .145, 2))
  const bellyMask = Math.sin(THREE.MathUtils.clamp((y0 - .04) / .76, 0, 1) * Math.PI)

  // Organic multi-harmonic kinchaku cloth gathers: plump, rounded anime cloth folds radiating smoothly
  // from the mid-belly through the drawstring channel up to the ruffled mouth (no sharp V-creases).
  const upperMask = smooth(y0 / .46)
  const gatherRaw =
   .030 * Math.sin(angle * 3 + .42) +
   .025 * Math.cos(angle * 5 - .78) +
   .027 * Math.sin(angle * 7 + 1.38) +
   .016 * Math.cos(angle * 9 - .32) +
   .007 * Math.sin(angle * 11 + 2.15)
  const collarBoost = 1 + .18 * smooth((y0 - .54) / .36)
  const gatherGain = (1 + .20 * cos2) * collarBoost * (1 - .18 * load)
  const gatherDelta = gatherRaw * gatherGain * upperMask

  // Drawstring casing cinch pulls softly inward around y=0.75, especially near the ±X cord exits.
  const casingPinch = -(.024 + .034 * cos4) * neckMask * (1 - .14 * load)

  // Empty pouch mouth gathers softer & more slouched inward; three heavy stones broaden belly & open mouth.
  const emptySlouch = -.092 * (1 - load) * topMask * (.78 + .24 * Math.sin(angle * 2 - .5))
  let stoneBelly = 0
  for (let s = 0; s < 3; s++) {
   const w = stones[s]!
   if (w <= 0) continue
   const align = .5 + .5 * Math.cos(angle - STONE_ANGLES[s]!)
   stoneBelly += w * .044 * Math.pow(align, 2.1)
  }
  const loadedBelly = (.034 * load + stoneBelly) * bellyMask * floorMask
  // Subtle outward weight relaxation of the upper collar once stones settle inside.
  const loadedRimOpen = .034 * load * topMask

  // Brief damped fabric cushion push localized near the landing stone during drop (decays to 0 at t=1).
  const impactAlign = .45 + .55 * Math.cos(angle - impactAngle)
  const impactRadial = impact * .038 * impactAlign * (.35 + .65 * bellyMask) * floorMask

  // Keep inner floor flat and unobstructed around the three stones at y=0.05.
  const radialScale = 1 + (gatherDelta + casingPinch + emptySlouch + loadedBelly + loadedRimOpen + impactRadial) * floorMask
  let r = r0 * radialScale
  // Ensure inner wall always clears the three seated stones comfortably.
  if (isOuter < .25 && y0 > .06 && y0 < .48) {
   r = Math.max(r, r0 * (.985 + .035 * load))
  }

  // Organic collar height undulation & gravity weight settle (clamped <= 0.916 so lifted stones clear cleanly).
  const collarWave =
   (.024 * Math.sin(angle * 3 + .42) - .018 * Math.cos(angle * 5 - .78) + .013 * Math.sin(angle * 7 + 1.38)) * topMask
  const cinchRise = .018 * cos4 * topMask
  const frontDip = -.026 * Math.max(0, sinA) * topMask
  const weightDrop = -.050 * load * smooth((y0 - .14) / .76)
  const impactDrop = -impact * .026 * impactAlign * topMask
  let y = y0
  if (y0 > .055) {
   y = Math.max(.056, Math.min(.916, y0 + (collarWave + cinchRise + frontDip + weightDrop + impactDrop) * floorMask))
  }

  // Subtle organic cloth drape lean when empty that settles upright under the weight of three stones.
  const leanX = (.024 * (1 - load) * Math.sin(angle * 2 + .6) - .022 * (1 - load)) * topMask * floorMask
  const leanZ = (.018 * (1 - load) * Math.cos(angle - .4)) * topMask * floorMask

  out.set(cosA * r + leanX, y, sinA * r * POUCH_Z_SCALE + leanZ)
  return { fold: gatherRaw * gatherGain, neckMask }
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
   const { fold, neckMask } = evalPouchPoint(r0, y0, angle, isOuter, load, stones, impact, impactAngle, tmpPt)
   pos.setXYZ(i, tmpPt.x, tmpPt.y, tmpPt.z)
   // Clean anime cloth shading: gentle vertical fold troughs down the belly, soft casing shadow, luminous lip.
   const upper = smooth(y0 / .46)
   const foldShade = .925 + Math.max(-.12, Math.min(.095, fold * 1.18)) * upper
   const casingShadow = isOuter > .7 ? 1 - .072 * neckMask : 1
   const interiorShade = isOuter < .25 ? .87 + .11 * smooth(y0 / .85) : 1
   const lipLift = isOuter > .3 && isOuter < .7 ? 1.03 : 1
   const shade = THREE.MathUtils.clamp(foldShade * casingShadow * interiorShade * lipLift, .73, 1.04)
   colAttr.setXYZ(i, shade, shade, shade)
  }
  pos.needsUpdate = true
  colAttr.needsUpdate = true
  bagGeometry.computeVertexNormals()
  // Weld vertex normals across LatheGeometry's azimuthal seam (segIdx=0 and segIdx=RADIAL_SEGS)
  // so no faint vertical shading crease appears down the front-center of the cloth belly!
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

  // Update soft ruffled lip rim & exterior drawstring casing cord cleanly outside the pouch neck wall.
  for (let i = 0; i < RADIAL_SEGS; i++) {
   const angle = (i / RADIAL_SEGS) * Math.PI * 2
   evalPouchPoint(.715, .902, angle, .5, load, stones, impact, impactAngle, rimPts[i]!)
   evalPouchPoint(.724, .760, angle, 1, load, stones, impact, impactAngle, casingPts[i]!)
  }
  rimTube.updateFromCurve(rimPts)
  casingTube.updateFromCurve(casingPts)

  // Update both gravity-draped braided drawstring loops so they exit the ±X casing channels,
  // clear the cloth belly cleanly, stay strictly within the gravel disc (world x <= 1.76 -> same official camera!),
  // and relax gently outward on the gravel as stones settle into the bag.
  const slack = .042 * load + .020 * impact
  const leftExit = new THREE.Vector3()
  const rightExit = new THREE.Vector3()
  evalPouchPoint(.724, .760, Math.PI, 1, load, stones, impact, impactAngle, leftExit)
  evalPouchPoint(.724, .760, 0, 1, load, stones, impact, impactAngle, rightExit)

  const leftShoulderBack = new THREE.Vector3()
  const leftShoulderFront = new THREE.Vector3()
  evalPouchPoint(.885, .36, Math.PI + .10, 1, load, stones, impact, impactAngle, leftShoulderBack)
  evalPouchPoint(.885, .36, Math.PI - .20, 1, load, stones, impact, impactAngle, leftShoulderFront)

  const rightShoulderBack = new THREE.Vector3()
  const rightShoulderFront = new THREE.Vector3()
  evalPouchPoint(.865, .36, .08, 1, load, stones, impact, impactAngle, rightShoulderBack)
  evalPouchPoint(.865, .36, .34, 1, load, stones, impact, impactAngle, rightShoulderFront)

  // Gentle end-knot thickening near u=0.50 (resting loop apex) for authentic kinchaku cord silhouette.
  const cordRadiusFn = (u: number) => {
   const dist = Math.abs(u - .5)
   return .0165 + .0105 * Math.exp(-Math.pow(dist / .032, 2))
  }

  // Left drawstring rests softly across the clear open gravel between the pouch and pebbles (clearance >= knot radius).
  const leftPts = [
   new THREE.Vector3(leftExit.x - .014, leftExit.y, leftExit.z - .026),
   new THREE.Vector3(leftShoulderBack.x - .048, .47 - .025 * load, leftShoulderBack.z - .03),
   new THREE.Vector3(leftShoulderBack.x - .082, .16, leftShoulderBack.z + .01),
   new THREE.Vector3(-.97 - slack * .9, .025, .06 + slack * .4),
   new THREE.Vector3(-1.04 - slack * 1.1, .029, .26 + slack * .7),
   new THREE.Vector3(-.88 - slack * .6, .029, .43 + slack * .5),
   new THREE.Vector3(-.75 - slack * .2, .025, .34 + slack * .2),
   new THREE.Vector3(leftShoulderFront.x - .058, .20, leftShoulderFront.z + .10),
   new THREE.Vector3(leftShoulderFront.x - .044, .47 - .025 * load, leftShoulderFront.z + .04),
   new THREE.Vector3(leftExit.x - .014, leftExit.y, leftExit.z + .026),
  ]
  leftCordTube.updateFromCurve(leftPts, cordRadiusFn)

  // Right drawstring drapes forward-right along the cloth shoulder and curls comfortably INSIDE the gravel disc.
  const rightPts = [
   new THREE.Vector3(Math.min(.82, rightExit.x + .014), rightExit.y, rightExit.z - .024),
   new THREE.Vector3(Math.min(.83, rightShoulderBack.x + .022), .46 - .025 * load, rightShoulderBack.z + .02),
   new THREE.Vector3(Math.min(.83, rightShoulderBack.x + .026), .16, rightShoulderBack.z + .11),
   new THREE.Vector3(.74 + slack * .18, .025, .28 + slack * .28),
   new THREE.Vector3(.63 + slack * .18, .029, .48 + slack * .42),
   new THREE.Vector3(.46 + slack * .14, .029, .56 + slack * .36),
   new THREE.Vector3(.46, .025, .44 + slack * .18),
   new THREE.Vector3(Math.min(.82, rightShoulderFront.x + .034), .20, rightShoulderFront.z + .12),
   new THREE.Vector3(Math.min(.82, rightShoulderFront.x + .030), .46 - .025 * load, rightShoulderFront.z + .04),
   new THREE.Vector3(Math.min(.82, rightExit.x + .014), rightExit.y, rightExit.z + .024),
  ]
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
   for(let n=0;n<points.length;n++){const v=points[n]!,next=points[Math.min(n+1,points.length-1)]!,prev=points[Math.max(0,n-1)]!,dx=next.x-prev.x,dz=next.z-prev.z,len=Math.hypot(dx,dz)||1;for(const sign of[-1,1]){const x=v.x+sign*(-dz/len)*.009,z=v.z+sign*(dx/len)*.009;p.push(x,.12*Math.sqrt(1-(x/.24)**2-(z/.20)**2)+.003,z)}if(n<points.length-1){const at=n*2;ix.push(at,at+1,at+2,at+1,at+3,at+2)}}
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
