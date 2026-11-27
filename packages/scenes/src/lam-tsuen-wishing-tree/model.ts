import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { addObjectCradle, addSteppedPedestal } from '../cozy-furniture'
import {
 createMoldedLimbGeometry,
 createReplicaBarkMaterial,
 createReplicaCanopyClusterGeometry,
 createReplicaCanopyMaterials,
 createReplicaLeafRosetteGeometry,
} from './canopy-craft'

const PAPER_W = 0.55
const PAPER_H = 0.85
const PAPER_T = 0.0032
const HALF_T = PAPER_T * 0.5
const SEG_X = 12
const SEG_Y = 18
const GRID_COUNT = (SEG_X + 1) * (SEG_Y + 1)

type BrushStrokeSpec = {
 points: readonly [number, number][]
 widthStart: number
 widthMid: number
 widthEnd: number
}

// The two fixed characters ("平安") are this scene's example wish, not a prescribed formula.
// Fourteen strokes preserve the authored progressive writing count while rendering
// tapered calligraphic brush marks flush on the curving red paper surface.
const BRUSH_STROKES: readonly BrushStrokeSpec[] = [
 // 「平」 (5 strokes)
 { points: [[-.145, .286], [-.02, .294], [.145, .298]], widthStart: .015, widthMid: .012, widthEnd: .016 },
 { points: [[-.175, .170], [0, .178], [.175, .186]], widthStart: .016, widthMid: .013, widthEnd: .018 },
 { points: [[0, .312], [.002, .16], [0, -.022]], widthStart: .017, widthMid: .013, widthEnd: .006 },
 { points: [[-.112, .258], [-.085, .232], [-.058, .206]], widthStart: .010, widthMid: .015, widthEnd: .012 },
 { points: [[.114, .262], [.088, .232], [.056, .202]], widthStart: .015, widthMid: .012, widthEnd: .006 },
 // 「安」 (9 strokes)
 { points: [[-.028, -.092], [.004, -.116], [.028, -.138]], widthStart: .010, widthMid: .016, widthEnd: .012 },
 { points: [[-.152, -.170], [0, -.164], [.154, -.162]], widthStart: .014, widthMid: .012, widthEnd: .017 },
 { points: [[-.144, -.166], [-.154, -.196], [-.162, -.226]], widthStart: .012, widthMid: .014, widthEnd: .008 },
 { points: [[.152, -.164], [.146, -.192], [.126, -.218]], widthStart: .015, widthMid: .012, widthEnd: .006 },
 { points: [[-.158, -.260], [0, -.254], [.158, -.250]], widthStart: .015, widthMid: .012, widthEnd: .017 },
 { points: [[-.022, -.192], [-.064, -.265], [-.098, -.328]], widthStart: .015, widthMid: .012, widthEnd: .010 },
 { points: [[-.098, -.328], [.010, -.350], [.122, -.382]], widthStart: .011, widthMid: .014, widthEnd: .016 },
 { points: [[.084, -.224], [.060, -.276], [.024, -.322]], widthStart: .015, widthMid: .012, widthEnd: .010 },
 { points: [[.024, -.322], [-.044, -.356], [-.128, -.384]], widthStart: .012, widthMid: .010, widthEnd: .005 },
]

/**
 * Evaluates a point and outward front normal on the thin red wishing sheet in
 * paperRoot local space (`x ∈ [-W/2, W/2]`, `y ∈ [-H/2, H/2]`).
 *
 * - `flight = 0` (resting on stone paving): flat resting belly (`z = 0`, so back
 *   face sits at `-HALF_T` -> exact `y = 0.035` on paving) with gentle upward corner
 *   curl and subtle center fold memory.
 * - `flight = 0.5` (tossed in air): smooth aerodynamic billow along the arc.
 * - `flight = 1` (hanging from top-center cord knot): natural stiff-paper S-bow,
 *   slight horizontal center-fold memory crease, gentle diagonal lower-corner curl,
 *   and inextensible vertical foreshortening.
 */
function evalWishingPaper(
 x: number,
 y: number,
 flight: number,
 outPos: THREE.Vector3,
 outNormal: THREE.Vector3,
) {
 const u = x / PAPER_W + 0.5 // 0..1 left -> right
 const v = 0.5 - y / PAPER_H // 0 (top knot edge) .. 1 (bottom hanging edge)
 const ux = u - 0.5 // -0.5..0.5
 const r2 = ux * ux * 4 + (v - 0.5) * (v - 0.5) * 4

 // Resting on stone: belly touches z = 0 exactly; corners lift gently (+Z local = +Y world).
 const restCorner = Math.pow(Math.max(0, r2 - 0.32), 1.6) * 0.0145
 const restEdgeLift = Math.pow(Math.abs(ux) * 2, 2.4) * 0.0046
 const restCrease = Math.exp(-Math.pow((v - 0.5) * 14, 2)) * 0.0028 * (0.35 + Math.abs(ux))
 const restZ = restCorner + restEdgeLift + restCrease

 // Mid-air flight billow (peaks smoothly at flight = 0.5, zero at endpoints).
 const air = Math.sin(Math.PI * flight)
 const airZ = -air * 0.058 * Math.sin(Math.PI * v) * (0.78 + 0.22 * Math.cos(Math.PI * ux))

 // Hanging stiff-paper silhouette (flight = 1): anchored near top center (v = 0, ux = 0).
 const vCurve = v * v
 const hangBow = 0.048 * Math.sin(Math.PI * v * 0.86) - 0.028 * Math.pow(v, 2.5)
 const hangFold = 0.014 * Math.max(0, v - 0.48) // gentle fold-memory angle below center crease
 const hangPinch = -0.013 * (1 - Math.min(1, v * 2.4)) * (ux * ux * 4) // slight gather at top tie
 const hangCup = -0.016 * Math.sin(Math.PI * v) * (ux * ux * 4)
 const hangTwist = 0.052 * vCurve * ux // natural slight breeze turn toward lower right
 const hangZ = hangBow + hangFold + hangPinch + hangCup + hangTwist

 const f = flight * flight * (3 - 2 * flight)
 const z = THREE.MathUtils.lerp(restZ, hangZ, f) + airZ

 // Keep paper inextensible when hanging by gently foreshortening Y under curve slope.
 const yOut = y + f * (0.015 * vCurve)
 // Subtle horizontal draw-in near top center knot while hanging.
 const xOut = x * (1 - f * 0.026 * Math.exp(-v * 4.5))

 outPos.set(xOut, yOut, z)

 // Analytic-free small central difference for smooth accurate normal.
 const eps = 0.006
 const zR = evalZOnly(u + eps / PAPER_W, v, f, air)
 const zL = evalZOnly(u - eps / PAPER_W, v, f, air)
 const zU = evalZOnly(u, v - eps / PAPER_H, f, air)
 const zD = evalZOnly(u, v + eps / PAPER_H, f, air)
 const dzdx = (zR - zL) / (2 * eps)
 const dzdy = (zU - zD) / (2 * eps)
 outNormal.set(-dzdx, -dzdy, 1).normalize()
}

function evalZOnly(u: number, v: number, f: number, air: number): number {
 const ux = u - 0.5
 const r2 = ux * ux * 4 + (v - 0.5) * (v - 0.5) * 4
 const restZ = Math.pow(Math.max(0, r2 - 0.32), 1.6) * 0.0145
  + Math.pow(Math.abs(ux) * 2, 2.4) * 0.0046
  + Math.exp(-Math.pow((v - 0.5) * 14, 2)) * 0.0028 * (0.35 + Math.abs(ux))
 const airZ = -air * 0.058 * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) * (0.78 + 0.22 * Math.cos(Math.PI * ux))
 const vCurve = v * v
 const hangZ = 0.048 * Math.sin(Math.PI * v * 0.86) - 0.028 * Math.pow(Math.max(0, v), 2.5)
  + 0.014 * Math.max(0, v - 0.48)
  - 0.013 * (1 - Math.min(1, Math.max(0, v) * 2.4)) * (ux * ux * 4)
  - 0.016 * Math.sin(Math.PI * Math.min(1, Math.max(0, v))) * (ux * ux * 4)
  + 0.052 * vCurve * ux
 return THREE.MathUtils.lerp(restZ, hangZ, f) + airZ
}

/** Builds a closed thin double-sided sheet geometry with perimeter edges and crease vertex colors. */
function createWishingPaperGeometry(): {
 geometry: THREE.BufferGeometry
 update: (flight: number) => void
} {
 const indices: number[] = []
 const uvs: number[] = []
 const colors: number[] = []
 const edgeSources: number[] = []
 const cols = SEG_X + 1

 // Front face (side = 0) and back face (side = 1) vertices.
 for (let side = 0; side < 2; side++) {
  for (let iy = 0; iy <= SEG_Y; iy++) {
   const v = iy / SEG_Y
   const creaseBand = Math.exp(-Math.pow((v - 0.5) * 18, 2))
   // Subtle warm fold memory across the horizontal midline of a traditional folded wishing slip.
   const foldShade = 1 - creaseBand * 0.075
   // Subtle inner-frame density border near edges.
   for (let ix = 0; ix <= SEG_X; ix++) {
    const u = ix / SEG_X
    uvs.push(u, 1 - v)
    const backFactor = side === 0 ? 1 : 0.94
    const s = foldShade * backFactor
    colors.push(s, s * 0.985, s * 0.965)
   }
  }
 }

 const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d)
 for (let iy = 0; iy < SEG_Y; iy++) {
  for (let ix = 0; ix < SEG_X; ix++) {
   const a = iy * cols + ix
   // Front (+Z) counter-clockwise
   quad(a, a + cols, a + cols + 1, a + 1)
   // Back (-Z) counter-clockwise from behind
   quad(GRID_COUNT + a, GRID_COUNT + a + 1, GRID_COUNT + a + cols + 1, GRID_COUNT + a + cols)
  }
 }

 // Warm pale-vermilion cut-paper perimeter rim catches grazing sunlight cleanly.
 const pushEdge = (a: number, b: number, c: number, d: number) => {
  const base = GRID_COUNT * 2 + edgeSources.length
  for (const src of [a, b, c, d]) {
   edgeSources.push(src)
   uvs.push(uvs[src * 2]!, uvs[src * 2 + 1]!)
   colors.push(1.0, 0.90, 0.82)
  }
  quad(base, base + 1, base + 2, base + 3)
 }
 for (let ix = 0; ix < SEG_X; ix++) {
  pushEdge(ix, ix + 1, GRID_COUNT + ix + 1, GRID_COUNT + ix)
  const b = SEG_Y * cols + ix
  pushEdge(b, GRID_COUNT + b, GRID_COUNT + b + 1, b + 1)
 }
 for (let iy = 0; iy < SEG_Y; iy++) {
  const l = iy * cols
  const r = l + SEG_X
  pushEdge(l, GRID_COUNT + l, GRID_COUNT + l + cols, l + cols)
  pushEdge(r, r + cols, GRID_COUNT + r + cols, GRID_COUNT + r)
 }

 const totalVerts = GRID_COUNT * 2 + edgeSources.length
 const positions = new Float32Array(totalVerts * 3)
 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
 geometry.setIndex(indices)

 const pAttr = geometry.getAttribute('position') as THREE.BufferAttribute
 const tmpP = new THREE.Vector3()
 const tmpN = new THREE.Vector3()

 const update = (flight: number) => {
  for (let iy = 0; iy <= SEG_Y; iy++) {
   const y = (0.5 - iy / SEG_Y) * PAPER_H
   for (let ix = 0; ix <= SEG_X; ix++) {
    const x = (ix / SEG_X - 0.5) * PAPER_W
    evalWishingPaper(x, y, flight, tmpP, tmpN)
    const idx = iy * cols + ix
    pAttr.setXYZ(idx, tmpP.x + tmpN.x * HALF_T, tmpP.y + tmpN.y * HALF_T, tmpP.z + tmpN.z * HALF_T)
    pAttr.setXYZ(GRID_COUNT + idx, tmpP.x - tmpN.x * HALF_T, tmpP.y - tmpN.y * HALF_T, tmpP.z - tmpN.z * HALF_T)
   }
  }
  for (let i = 0; i < edgeSources.length; i++) {
   const src = edgeSources[i]!
   pAttr.setXYZ(GRID_COUNT * 2 + i, pAttr.getX(src), pAttr.getY(src), pAttr.getZ(src))
  }
  pAttr.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
 }

 update(0)
 return { geometry, update }
}

/**
 * Creates a tapered calligraphic brush-stroke ribbon mesh whose vertices conform
 * flush to the curving red wishing paper on every pose update.
 */
function createCalligraphicStroke(spec: BrushStrokeSpec, material: THREE.Material, name: string) {
 const samples = 8
 const curve = new THREE.CatmullRomCurve3(spec.points.map(([x, y]) => new THREE.Vector3(x, y, 0)))
 const uv2: [number, number][] = []
 const centers: [number, number][] = []
 const tangents: [number, number][] = []
 const halfWidths: number[] = []

 for (let i = 0; i <= samples; i++) {
  const t = i / samples
  const pt = curve.getPoint(t)
  const tg = curve.getTangent(t)
  const len = Math.hypot(tg.x, tg.y) || 1
  centers.push([pt.x, pt.y])
  tangents.push([tg.x / len, tg.y / len])
  // Smooth quadratic calligraphic pressure taper from start -> waist -> tip.
  const w = (1 - t) * (1 - t) * spec.widthStart + 2 * (1 - t) * t * spec.widthMid + t * t * spec.widthEnd
  halfWidths.push(w * 0.5)
 }

 // Rounded brush start cap + ribbon segments + tapered tip.
 const positions = new Float32Array((samples + 1) * 2 * 3)
 const uvs = new Float32Array((samples + 1) * 2 * 2)
 const indices: number[] = []
 for (let i = 0; i <= samples; i++) {
  const [cx, cy] = centers[i]!
  const [tx, ty] = tangents[i]!
  const hw = halfWidths[i]!
  const lx = cx - ty * hw, ly = cy + tx * hw
  const rx = cx + ty * hw, ry = cy - tx * hw
  uv2.push([lx, ly], [rx, ry])
  uvs[i * 4] = lx / PAPER_W + 0.5
  uvs[i * 4 + 1] = ly / PAPER_H + 0.5
  uvs[i * 4 + 2] = rx / PAPER_W + 0.5
  uvs[i * 4 + 3] = ry / PAPER_H + 0.5
  if (i < samples) {
   const a = i * 2
   indices.push(a, a + 1, a + 3, a, a + 3, a + 2)
  }
 }

 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.BufferAttribute(uvs, 2))
 geometry.setIndex(indices)

 const mesh = new THREE.Mesh(geometry, material)
 mesh.name = name
 mesh.castShadow = false
 mesh.receiveShadow = true
 mesh.userData.toonSurface = { outline: false }

 const pAttr = geometry.getAttribute('position') as THREE.BufferAttribute
 const tmpP = new THREE.Vector3()
 const tmpN = new THREE.Vector3()
 const surfaceOffset = HALF_T + 0.0007

 const update = (flight: number) => {
  for (let i = 0; i < uv2.length; i++) {
   const [px, py] = uv2[i]!
   evalWishingPaper(px, py, flight, tmpP, tmpN)
   pAttr.setXYZ(i, tmpP.x + tmpN.x * surfaceOffset, tmpP.y + tmpN.y * surfaceOffset, tmpP.z + tmpN.z * surfaceOffset)
  }
  pAttr.needsUpdate = true
  geometry.computeVertexNormals()
  geometry.computeBoundingBox()
  geometry.computeBoundingSphere()
 }

 update(0)
 return { mesh, update }
}

/** A modern replica wishing tree, a paper wish and its plastic orange weight. */
export function createLamTsuenModel() {
 const root=new THREE.Group();root.name='lamtsuen-root'
 const subject=new THREE.Group();subject.name='lamtsuen-subject';root.add(subject)
 const mat=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
 const bark=createReplicaBarkMaterial(),orange=mat(0xf79831,.4),cordMat=mat(0xc54230),green=mat(0x557b49)
 const {deepLeaf,midLeaf,sunLeaf}=createReplicaCanopyMaterials()
 // Traditional crimson-red xuan/wishing paper with fine UV-anchored pulp tooth,
 // restrained fibers (fine dyed xuan paper, not coarse raw-bark flecks), and highlight guard.
 const redPaper=createRitualMaterial({color:0xd4493b,roughness:.94,vertexColors:true}, {
  kind:'paper',strength:.34,fiber:'paper',
  paper:{layout:'sheet',aspect:PAPER_W/PAPER_H,grainScale:7.6,grain:.64,fibers:.16,edge:.32,highlightGuard:.58},
 })
 // Matte gold-ochre calligraphy ink absorbed into the same fine paper tooth.
 const inkMat=createRitualMaterial({
  color:0xf7dfa2,roughness:.96,side:THREE.DoubleSide,
  polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,
 }, {
  kind:'paper',strength:.18,fiber:'paper',
  paper:{layout:'sheet',aspect:PAPER_W/PAPER_H,grainScale:7.6,grain:.42,fibers:.12,edge:.0,highlightGuard:.68},
 })
 const holeMat=new THREE.MeshStandardMaterial({color:0x4a211d,roughness:.95})
 applyCraftSurface(cordMat,{kind:'cord',strength:.3})
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
 // Compact chamfered stone tree-planter curb & wooden prep tray grounded on courtyard stones (-0.0475)
 // replace the legacy 2.4x2.5m paving slab while preserving exact trunk & prop resting height (y = 0.035).
 addSteppedPedestal(subject,{
  name:'lamtsuen-planter-curb',
  topName:'lamtsuen-planter-curb-top',
  shape:'round',
  kind:'stone',
  radius:.42,
  center:[-.76,-.82],
  groundY:-.0475,
  surfaceY:.035,
  color:0xd8c7a1,
  trimColor:0xc5b38c,
  tiers:2,
  moulding:true,
 })
 const prepTray=addObjectCradle(subject,{
  name:'lamtsuen-prep-tray',
  topName:'lamtsuen-prep-tray-top',
  style:'tray',
  kind:'wood',
  finish:'cedar',
  width:1.54,
  depth:1.20,
  center:[-.08,.80],
  groundY:-.0475,
  surfaceY:.035,
  lipHeight:.018,
  lipThickness:.028,
  footed:true,
 })
 const trayNames=new Map<string,number>()
 prepTray.root.traverse(o=>{
  if(!o.name)return
  const n=trayNames.get(o.name)??0
  trayNames.set(o.name,n+1)
  if(n>0)o.name=`${o.name}-${n}`
 })

 // Modern conservation molded-fiberglass replica wishing tree skeleton:
 // gently curved tapering limbs with root-buttress base, cast fork collars,
 // and short crown twigs — preserving exact wish-branch clearance (y=1.55, z=-0.10, r=0.07).
 const limb=(
  name:string,
  points:readonly THREE.Vector3[],
  radiusAt:(t:number,angle:number)=>number,
  opts:{tubularSegments?:number;radialSegments?:number;startCap?:'flat'|'dome';endCap?:'flat'|'dome';startDomeScale?:number;endDomeScale?:number;shadeAt?:(t:number,ny:number)=>readonly [number,number,number]}={},
 )=>mesh(createMoldedLimbGeometry({points,radiusAt,...opts}),bark,subject,name)

 limb(
  'lamtsuen-trunk',
  [v(-.76,.035,-.82),v(-.76,.18,-.825),v(-.79,.58,-.84),v(-.80,1.04,-.85),v(-.76,1.42,-.86),v(-.69,1.69,-.89)],
  (t,a)=>{
   const rootFlare=Math.pow(Math.max(0,1-t/.20),2.0)*(.048+.016*Math.cos(a*5+.4))
   const flute=.0045*Math.cos(a*4+t*2.4)*(1-t*.4)
   const collarSwell=Math.exp(-Math.pow((t-.78)*7.5,2))*.010
   return THREE.MathUtils.lerp(.134,.086,Math.pow(t,.88))+rootFlare+flute+collarSwell
  },
  {
   tubularSegments:15,radialSegments:12,startCap:'flat',endCap:'dome',endDomeScale:.55,
   shadeAt:(t,ny)=>{
    const rootAO=THREE.MathUtils.lerp(.83,1.02,THREE.MathUtils.smoothstep(t,0,.28))
    const crownAO=THREE.MathUtils.lerp(1,.93,THREE.MathUtils.smoothstep(t,.76,1))
    const sky=1+ny*.05
    return [rootAO*crownAO*sky,rootAO*crownAO*sky*.99,rootAO*crownAO*sky*.96] as const
   },
  },
 )

 // Molded fiberglass collar transitioning trunk into the sweeping wish-branch arm.
 limb(
  'lamtsuen-fork-collar-wish',
  [v(-.77,1.18,-.85),v(-.70,1.29,-.74),v(-.61,1.38,-.60)],
  (t,a)=>THREE.MathUtils.lerp(.104,.084,t)+.006*Math.sin(Math.PI*t)+.0025*Math.cos(a*4),
  {tubularSegments:6,radialSegments:10,startCap:'dome',endCap:'dome',startDomeScale:.25,endDomeScale:.35},
 )

 // Smoothly sweeping diagonal arm from trunk crotch into the horizontal wish branch
 // (no 90-degree pipe elbow and no leftward hairpin loop from the camera angle).
 limb(
  'lamtsuen-fork',
  [v(-.75,1.18,-.84),v(-.62,1.36,-.60),v(-.46,1.49,-.34),v(-.28,1.545,-.14),v(-.14,1.55,-.10)],
  (t,a)=>{
   const collar=Math.exp(-t*7.5)*.014
   const flute=.002*Math.cos(a*4+t*2)*(1-t)
   return THREE.MathUtils.lerp(.088,.070,THREE.MathUtils.smoothstep(t,0,.84))+collar+flute
  },
  {tubularSegments:12,radialSegments:10,startCap:'dome',endCap:'dome',startDomeScale:.45,endDomeScale:.35},
 )

 // Primary wish-throwing branch: strictly centered at y=1.55, z=-0.10, r=0.070 through the
 // entire landing/cord zone (x <= 0.64), softly tapering into a rounded molded tip beyond x=0.66.
 const branch=limb(
  'lamtsuen-wish-branch',
  [v(-.20,1.55,-.10),v(.10,1.55,-.10),v(.35,1.55,-.10),v(.64,1.55,-.10),v(.80,1.55,-.10)],
  (t)=>{
   const tipTaper=THREE.MathUtils.smoothstep(t,.78,1)
   return THREE.MathUtils.lerp(.070,.044,tipTaper)
  },
  {tubularSegments:12,radialSegments:12,startCap:'dome',endCap:'dome',startDomeScale:.35,endDomeScale:.75},
 )

 // Molded fiberglass collar at the upper crown split (trunk -> crown stem & left twig).
 limb(
  'lamtsuen-fork-collar-crown',
  [v(-.73,1.54,-.87),v(-.69,1.66,-.89),v(-.63,1.76,-.91)],
  (t,a)=>THREE.MathUtils.lerp(.094,.072,t)+.006*Math.sin(Math.PI*t)+.002*Math.cos(a*4),
  {tubularSegments:6,radialSegments:10,startCap:'dome',endCap:'dome',startDomeScale:.3,endDomeScale:.35},
 )

 // Ascending molded crown stem curving organically into the main upper dome.
 limb(
  'lamtsuen-crown-stem',
  [v(-.71,1.56,-.87),v(-.58,1.78,-.92),v(-.38,1.98,-.96),v(-.16,2.11,-.98)],
  (t,a)=>THREE.MathUtils.lerp(.086,.034,Math.pow(t,.85))+Math.exp(-t*7)*.010+.002*Math.cos(a*3+t*2),
  {tubularSegments:10,radialSegments:10,startCap:'dome',endCap:'dome',startDomeScale:.4,endDomeScale:.6},
 )

 // Molded collar where the arching right crown bough splits off the crown stem.
 limb(
  'lamtsuen-fork-collar-bough',
  [v(-.60,1.77,-.92),v(-.51,1.83,-.93),v(-.40,1.88,-.94)],
  (t)=>THREE.MathUtils.lerp(.072,.054,t)+.005*Math.sin(Math.PI*t),
  {tubularSegments:5,radialSegments:9,startCap:'dome',endCap:'dome',startDomeScale:.35,endDomeScale:.35},
 )

 // Arching tapering right crown bough (replaces straight horizontal curtain-rod pipe).
 limb(
  'lamtsuen-crown-bough',
  [v(-.56,1.80,-.92),v(-.18,1.92,-.95),v(.24,1.95,-.96),v(.64,1.89,-.95)],
  (t)=>THREE.MathUtils.lerp(.060,.026,Math.pow(t,.9))+Math.exp(-t*8)*.008,
  {tubularSegments:11,radialSegments:9,startCap:'dome',endCap:'dome',startDomeScale:.4,endDomeScale:.65},
 )

 // Three short molded crown twigs cradling the staggered left, upper-mid, and far-right clusters.
 const crownTwigs:readonly {name:string;pts:readonly THREE.Vector3[];r0:number;r1:number}[]=[
  {name:'lamtsuen-crown-twig-0',pts:[v(-.68,1.67,-.89),v(-.82,1.84,-.93),v(-.94,1.96,-.95)],r0:.048,r1:.022},
  {name:'lamtsuen-crown-twig-1',pts:[v(-.10,1.93,-.95),v(.02,2.08,-1.00),v(.14,2.18,-1.02)],r0:.038,r1:.019},
  {name:'lamtsuen-crown-twig-2',pts:[v(.34,1.94,-.96),v(.58,2.00,-.93),v(.80,2.00,-.90)],r0:.034,r1:.018},
 ]
 for(const twig of crownTwigs){
  limb(twig.name,twig.pts,(t)=>THREE.MathUtils.lerp(twig.r0,twig.r1,t)+Math.exp(-t*7)*.005,{
   tubularSegments:7,radialSegments:8,startCap:'dome',endCap:'dome',startDomeScale:.4,endDomeScale:.65,
  })
 }

 // Asymmetric two-mass stylized replica banyan crown: fuller domed main canopy over the trunk
 // stepping down into a sweeping right sub-crown, with global-crown normal transfer and
 // 28 molded 5-leaf banyan rosette tufts breaking every smooth contour (outline: false).
 type CanopyClusterSpec={
  pos:readonly [number,number,number]
  scale:readonly [number,number,number]
  rot:readonly [number,number,number]
  tier:'deep'|'mid'|'sun'
  variant:number
 }
 const crownCenter=v(-.14,2.05,-.95)
 const crownRadii=v(1.18,.44,.32)
 const canopyClusters:readonly CanopyClusterSpec[]=[
  // Main left-center banyan dome: deep shaded under-clusters & lush volumetric body
  {pos:[-.90,1.94,-.96],scale:[.26,.20,.23],rot:[.05,.40,-.08],tier:'deep',variant:2},
  {pos:[-.52,1.95,-.98],scale:[.29,.22,.24],rot:[-.04,1.35,.04],tier:'deep',variant:0},
  {pos:[-.10,1.97,-.97],scale:[.28,.20,.24],rot:[.04,2.45,-.05],tier:'deep',variant:1},
  {pos:[.44,1.93,-.96],scale:[.26,.18,.22],rot:[-.05,3.70,.07],tier:'deep',variant:2},
  // Primary mid-crown volumetric puffs (rounder proportions -> cohesive tree mass, no flat pancakes)
  {pos:[-.88,2.11,-.92],scale:[.28,.22,.23],rot:[.08,.95,-.10],tier:'mid',variant:1},
  {pos:[-.54,2.21,-.95],scale:[.31,.25,.25],rot:[-.04,2.05,.04],tier:'mid',variant:0},
  {pos:[-.14,2.20,-.99],scale:[.30,.24,.24],rot:[.06,3.15,-.04],tier:'mid',variant:2},
  {pos:[.24,2.11,-.94],scale:[.28,.21,.23],rot:[-.05,4.30,.06],tier:'mid',variant:0},
  {pos:[.64,2.05,-.98],scale:[.28,.21,.23],rot:[.07,5.25,-.07],tier:'mid',variant:1},
  {pos:[.92,1.97,-.91],scale:[.23,.18,.20],rot:[-.06,.60,.10],tier:'mid',variant:3},
  // Upper sunlit asymmetric dome crest & front fullness (peaking cleanly at y <= 2.47)
  {pos:[-.68,2.28,-.89],scale:[.23,.18,.19],rot:[.10,1.75,-.06],tier:'sun',variant:3},
  {pos:[-.32,2.30,-.93],scale:[.26,.18,.21],rot:[-.05,2.85,.04],tier:'sun',variant:1},
  {pos:[.04,2.25,-.96],scale:[.24,.18,.20],rot:[.06,4.05,-.05],tier:'sun',variant:3},
  {pos:[.60,2.14,-.90],scale:[.22,.16,.18],rot:[-.04,5.15,.08],tier:'sun',variant:0},
 ]
 const leafMats={deep:deepLeaf,mid:midLeaf,sun:sunLeaf}
 canopyClusters.forEach((c,i)=>{
  const worldPos=v(c.pos[0],c.pos[1],c.pos[2])
  const worldScale=v(c.scale[0],c.scale[1],c.scale[2])
  const worldRot=new THREE.Euler(c.rot[0],c.rot[1],c.rot[2])
  const geo=createReplicaCanopyClusterGeometry({
   variant:c.variant,
   crown:{worldPos,worldScale,worldRot,crownCenter,crownRadii},
  })
  const o=mesh(geo,leafMats[c.tier],subject,`lamtsuen-leaf-cluster-${i}`)
  o.position.copy(worldPos)
  o.rotation.copy(worldRot)
  o.scale.copy(worldScale)
  o.receiveShadow=false
  o.userData.toonSurface={outline:false}
 })

 // Molded 5-leaf stylized replica banyan rosette tufts wrapping the visible dome, silhouette
 // crest, sides, and lower fringe so the canopy reads as crisp Komorebi leaf clusters.
 const rosetteSpecs:readonly {pos:readonly [number,number,number];rot:readonly [number,number,number];scale:number;tier:'deep'|'mid'|'sun'}[]=[
  // Upper sunlit main dome & asymmetric rounded crest
  {pos:[-.86,2.21,-.88],rot:[.30,-.65,.18],scale:1.08,tier:'sun'},
  {pos:[-.62,2.35,-.90],rot:[.12,-.25,-.10],scale:1.14,tier:'sun'},
  {pos:[-.40,2.42,-.92],rot:[.06,.08,.05],scale:1.16,tier:'sun'},
  {pos:[-.10,2.34,-.95],rot:[.12,.38,-.08],scale:1.10,tier:'sun'},
  {pos:[.20,2.25,-.92],rot:[.22,.58,.12],scale:1.05,tier:'sun'},
  {pos:[.54,2.25,-.91],rot:[.16,.42,-.10],scale:1.10,tier:'sun'},
  {pos:[.78,2.16,-.89],rot:[.26,.78,.14],scale:1.04,tier:'sun'},
  // Front-facing dome & mid-tier texture breakup (kept strictly behind original z <= -0.64)
  {pos:[-.94,2.08,-.89],rot:[.56,-.88,.20],scale:1.04,tier:'mid'},
  {pos:[-.72,2.15,-.88],rot:[.48,-.36,-.12],scale:1.08,tier:'mid'},
  {pos:[-.44,2.24,-.88],rot:[.44,-.06,.10],scale:1.10,tier:'sun'},
  {pos:[-.16,2.16,-.89],rot:[.50,.18,-.08],scale:1.06,tier:'mid'},
  {pos:[.12,2.10,-.89],rot:[.52,.32,.12],scale:1.05,tier:'mid'},
  {pos:[.42,2.11,-.89],rot:[.50,.46,-.10],scale:1.05,tier:'mid'},
  {pos:[.68,2.05,-.89],rot:[.52,.72,.14],scale:1.03,tier:'mid'},
  {pos:[.92,1.99,-.90],rot:[.48,1.02,-.12],scale:1.02,tier:'mid'},
  // Far-left, far-right, and upper-back silhouette edge tufts
  {pos:[-1.00,2.00,-.95],rot:[.42,-1.35,-.14],scale:1.02,tier:'mid'},
  {pos:[-.78,2.28,-.99],rot:[-.28,-2.45,.12],scale:1.04,tier:'mid'},
  {pos:[-.40,2.35,-1.01],rot:[-.24,3.05,-.10],scale:1.06,tier:'sun'},
  {pos:[.04,2.27,-1.02],rot:[-.26,2.65,.12],scale:1.02,tier:'mid'},
  {pos:[.56,2.15,-1.00],rot:[-.24,2.25,-.10],scale:1.02,tier:'mid'},
  {pos:[1.01,1.95,-.95],rot:[.42,1.35,.16],scale:.98,tier:'mid'},
  // Softly pitched lower scalloped skirt tufts smoothing the canopy-to-bough transition
  {pos:[-.94,1.88,-.90],rot:[.62,-.75,-.16],scale:1.02,tier:'deep'},
  {pos:[-.64,1.92,-.89],rot:[.58,-.25,.12],scale:1.04,tier:'deep'},
  {pos:[-.32,1.96,-.89],rot:[.56,.08,-.10],scale:1.02,tier:'deep'},
  {pos:[.02,1.93,-.89],rot:[.58,.26,.12],scale:1.00,tier:'deep'},
  {pos:[.36,1.90,-.89],rot:[.58,.48,-.12],scale:1.00,tier:'deep'},
  {pos:[.72,1.88,-.89],rot:[.60,.84,.14],scale:.98,tier:'deep'},
  {pos:[.92,1.89,-.92],rot:[.56,1.12,-.14],scale:.94,tier:'deep'},
 ]
 rosetteSpecs.forEach((sp,i)=>{
  const worldPos=v(sp.pos[0],sp.pos[1],sp.pos[2])
  const worldScale=v(sp.scale,sp.scale,sp.scale)
  const worldRot=new THREE.Euler(sp.rot[0],sp.rot[1],sp.rot[2])
  const geo=createReplicaLeafRosetteGeometry({worldPos,worldScale,worldRot,crownCenter,crownRadii})
  const o=mesh(geo,leafMats[sp.tier],subject,`lamtsuen-leaf-tuft-${i}`)
  o.position.copy(worldPos)
  o.rotation.copy(worldRot)
  o.scale.copy(worldScale)
  o.receiveShadow=false
  o.userData.toonSurface={outline:false}
 })
 const paperRoot=new THREE.Group();paperRoot.name='lamtsuen-paper-root';subject.add(paperRoot)
 const paperSheet=createWishingPaperGeometry()
 const paper=mesh(paperSheet.geometry,redPaper,paperRoot,'lamtsuen-paper')
 // Small punch hole near the top-center cord tie.
 const holeGeo=new THREE.CircleGeometry(.012,14)
 const holeFront=new THREE.Mesh(holeGeo,holeMat);holeFront.name='lamtsuen-paper-hole-front';holeFront.userData.toonSurface={outline:false};paperRoot.add(holeFront)
 const holeBack=new THREE.Mesh(holeGeo,holeMat);holeBack.name='lamtsuen-paper-hole-back';holeBack.rotation.y=Math.PI;holeBack.userData.toonSurface={outline:false};paperRoot.add(holeBack)
 const paperKnot=mesh(new THREE.SphereGeometry(.014,16,12),cordMat,paperRoot,'lamtsuen-paper-knot');paperKnot.position.set(0,.418,.009)
 const strokes=BRUSH_STROKES.map((spec,i)=>{
  const stroke=createCalligraphicStroke(spec,inkMat,`lamtsuen-ink-${i}`)
  paperRoot.add(stroke.mesh)
  return stroke
 })
 const orangeRoot=new THREE.Group();orangeRoot.name='lamtsuen-orange-root';subject.add(orangeRoot)
 const fruit=mesh(new THREE.SphereGeometry(.21,32,20),orange,orangeRoot,'lamtsuen-orange')
 const seam=mesh(new THREE.TorusGeometry(.209,.0015,6,48),orange,orangeRoot,'lamtsuen-plastic-seam');seam.rotation.x=Math.PI/2
 const stem=mesh(new THREE.CylinderGeometry(.018,.025,.05,10),green,orangeRoot,'lamtsuen-orange-stem');stem.position.y=.225
 const loop=mesh(new THREE.TorusGeometry(.030,.009,8,24),cordMat,orangeRoot,'lamtsuen-orange-tie');loop.position.y=.27
 const segments=Array.from({length:32},(_,i)=>mesh(new THREE.CylinderGeometry(.009,.009,1,8),cordMat,subject,`lamtsuen-cord-${i}`))
 const saddle=mesh(new THREE.SphereGeometry(.009,16,12),cordMat,subject,'lamtsuen-cord-saddle')
 // Back face of resting paper sits at -HALF_T -> exact y = 0.035 on stone paving.
 const paperStart=v(-.48,.035+HALF_T,.89),orangeStart=v(.40,.245,.48),paperEnd=v(.35,.675,.18),orangeEnd=v(.35,.94,-.40)
 const unitY=v(0,1,0),points=Array.from({length:33},()=>v(0,0,0))
 const holePos=v(0,0,0),holeNorm=v(0,0,1),zAxis=v(0,0,1)
 const finalCord=(u:number)=>{
  const k=u*32,r=.079/Math.cos(Math.PI/24)
  if(k<10)return v(.35,THREE.MathUtils.lerp(1.1,1.55,k/10),THREE.MathUtils.lerp(.194,-.10+r,k/10))
  if(k<=22){const a=(k-10)/12*Math.PI;return v(.35,1.55+r*Math.sin(a),-.10+r*Math.cos(a))}
  return v(.35,THREE.MathUtils.lerp(1.55,1.24,(k-22)/10),THREE.MathUtils.lerp(-.10-r,-.40,(k-22)/10))
 }
 let lastFlight=-1
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0,flight=step>=3?1:step===2?t:0,writing=step>0?1:step===0?t:0,tying=step>1?1:step===1?t:0
  if(flight!==lastFlight){
   lastFlight=flight
   paperSheet.update(flight)
   strokes.forEach(s=>s.update(flight))
   evalWishingPaper(0,.398,flight,holePos,holeNorm)
   holeFront.position.copy(holePos).addScaledVector(holeNorm,HALF_T+.0006)
   holeFront.quaternion.setFromUnitVectors(zAxis,holeNorm)
   holeBack.position.copy(holePos).addScaledVector(holeNorm,-(HALF_T+.0006))
   holeBack.quaternion.setFromUnitVectors(zAxis,holeNorm.clone().negate())
  }
  const arc=flight===0||flight===1?0:1.7*Math.sin(Math.PI*flight)
  paperRoot.position.lerpVectors(paperStart,paperEnd,flight);paperRoot.position.y+=arc
  paperRoot.rotation.set(-Math.PI/2*(1-flight),0,0)
  orangeRoot.position.lerpVectors(orangeStart,orangeEnd,THREE.MathUtils.clamp((flight-.25)/.35,0,1));orangeRoot.position.y=THREE.MathUtils.lerp(orangeStart.y,orangeEnd.y,flight)+arc
  strokes.forEach((s,i)=>{s.mesh.visible=writing>i/strokes.length});loop.visible=tying>0;paperKnot.visible=tying>0
  root.updateMatrixWorld(true)
  const start=paperRoot.localToWorld(v(0,.425,.014)),end=orangeRoot.localToWorld(v(0,.30,0))
  points.forEach((p,i)=>{const u=i/32,finish=finalCord(u);p.lerpVectors(start,end,u);p.lerp(finish,flight);p.y+=arc*flight})
  // Endpoints follow the real attachment points throughout the flight.
  points[0]!.copy(start);points[32]!.copy(end)
  segments.forEach((o,i)=>{const a=points[i]!,b=points[i+1]!,d=b.clone().sub(a);o.visible=tying>(i/32);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(unitY,d.normalize())})
  saddle.visible=tying>.5;saddle.position.copy(points[16]!);saddle.position.y-=(.079/Math.cos(Math.PI/24)-.079)*flight
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject,targets:[paper,fruit,fruit],roots:[paperRoot,orangeRoot,orangeRoot],anchors:[[0,0,.007],[0,.08,.19],[0,.08,.19]] as [number,number,number][],pose,branch,points}
}
