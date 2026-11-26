import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

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
 const bark=mat(0x987456,.72),leaf=mat(0x79a45c),lightLeaf=mat(0xa3bd67),stone=mat(0xd8c7a1),orange=mat(0xf79831,.4),cordMat=mat(0xc54230),green=mat(0x557b49)
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
 applyCraftSurface(stone,{kind:'stone',strength:.4})
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 const link=(a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=mesh(new THREE.CylinderGeometry(r,r,a.distanceTo(b),12),m,p,name);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o}
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
 const paving=mesh(new THREE.BoxGeometry(2.4,.1,2.5),stone,subject,'lamtsuen-paving');paving.position.set(0,-.015,.20)
 link(v(-.78,.035,-.85),v(-.78,1.55,-.85),.14,bark,subject,'lamtsuen-trunk')
 link(v(-.78,1.50,-.85),v(-.78,1.55,-.10),.09,bark,subject,'lamtsuen-fork')
 const branch=link(v(-.78,1.55,-.10),v(.82,1.55,-.10),.07,bark,subject,'lamtsuen-wish-branch')
 link(v(-.78,1.45,-.85),v(-.52,2.12,-.95),.075,bark,subject,'lamtsuen-crown-stem')
 link(v(-.55,1.99,-.95),v(.65,2.02,-.95),.045,bark,subject,'lamtsuen-crown-bough')
 for(const [i,p] of [[-.83,2.12,-.95],[-.40,2.23,-1.0],[.08,2.19,-.95],[.52,2.15,-.95],[.83,2.03,-.95]].entries()){
  const o=mesh(new THREE.IcosahedronGeometry(1,1),i%2?lightLeaf:leaf,subject,`lamtsuen-leaf-cluster-${i}`);o.scale.set(.39,.24,.30);o.position.set(...p as [number,number,number])
 }
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
