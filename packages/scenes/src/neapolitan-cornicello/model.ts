import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { addObjectCradle } from '../cozy-furniture'

// An original flat-backed relief: a rounded upper section, curved taper and
// single closed tip. The digital solid does not reproduce hollow manufacture.
function hornGeometry() {
 const curve=new THREE.CubicBezierCurve3(new THREE.Vector3(-.10,0,-.48),new THREE.Vector3(-.46,0,-.03),new THREE.Vector3(.30,0,.20),new THREE.Vector3(.16,0,.50))
 const rows=48,sides=16,vertices:number[]=[],indices:number[]=[]
 for(let i=0;i<rows;i++){
  const u=i/rows,p=curve.getPoint(u),t=curve.getTangent(u),normal=new THREE.Vector3(t.z,0,-t.x).normalize(),radius=.14*Math.pow(1-u,.8)
  for(let j=0;j<=sides;j++){const a=Math.PI*j/sides;vertices.push(p.x+normal.x*radius*Math.cos(a),j===0||j===sides?0:2*radius*Math.sin(a),p.z+normal.z*radius*Math.cos(a))}
 }
 for(let i=0;i<rows-1;i++){
  for(let j=0;j<sides;j++){const a=i*(sides+1)+j,b=a+1,c=a+sides+1,d=c+1;indices.push(a,b,d,a,d,c)}
  const a=i*(sides+1),b=a+sides,c=a+sides+1,d=c+sides;indices.push(a,c,d,a,d,b)
 }
 for(let j=1;j<sides;j++)indices.push(0,j+1,j)
 const p=curve.getPoint(1),tip=vertices.length/3,last=(rows-1)*(sides+1);vertices.push(p.x,0,p.z)
 for(let j=0;j<sides;j++)indices.push(last+j,last+j+1,tip)
 indices.push(last,tip,last+sides)
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g
}

const CARD_W = 0.44
const CARD_L = 0.72
const CARD_HALF_W = CARD_W * 0.5 // 0.22
const CARD_HALF_L = CARD_L * 0.5 // 0.36
const LEAF_T = 0.0044
const SPINE_R_IN = 0.0038
const SPINE_R_OUT = SPINE_R_IN + LEAF_T // 0.0082
const SPINE_CX = -CARD_HALF_W + SPINE_R_OUT // -0.2118
const SPINE_CY = SPINE_R_OUT // 0.0082

/**
 * Evaluates the gently sprung top cardstock leaf outer Y over `x ∈ [SPINE_CX, +0.22]`,
 * `z ∈ [-0.36, +0.36]`, including a subtle letterpress-style blind-debossed inner border.
 */
function evalTopLeafOuterY(x: number, z: number): number {
 const u = THREE.MathUtils.clamp((x - SPINE_CX) / (CARD_HALF_W - SPINE_CX), 0, 1)
 const zn = z / CARD_HALF_L // -1..1
 const baseY = SPINE_CY + SPINE_R_OUT // 0.0164 at fold tangent
 // Natural cardstock spring opening toward the right open edge (+x) and front/back corners.
 const wedge = 0.0095 * Math.pow(u, 1.15)
 const arch = 0.0024 * Math.sin(Math.PI * u)
 const cornerSpring = 0.0056 * Math.pow(u, 1.5) * (0.45 + 0.55 * zn * zn) + 0.0022 * u * Math.max(0, zn)
 // Subtle plain recessed frame groove inset from the card perimeter (product stationery detail).
 const dxFrame = Math.abs(Math.abs(x) - 0.168)
 const dzFrame = Math.abs(Math.abs(z) - 0.296)
 const onHoriz = Math.abs(x) <= 0.174 ? Math.exp(-Math.pow(dzFrame / 0.008, 2)) : 0
 const onVert = Math.abs(z) <= 0.302 ? Math.exp(-Math.pow(dxFrame / 0.008, 2)) : 0
 const deboss = -0.00095 * Math.max(onHoriz, onVert)
 return baseY + wedge + arch + cornerSpring + deboss
}

/**
 * Builds a single strictly watertight 2-manifold folded cardstock gift card (`0.44 × 0.72`)
 * with two thin leaves (`0.0044`), a rounded left fold spine, a visible shadowed right/front
 * opening wedge, and exact `min.y === 0` resting support.
 */
function createFoldedCardGeometry(): {
 geometry: THREE.BufferGeometry
 centerTopY: number
 centerSlopeZ: number
} {
 // Stations along the C-shaped ribbon from bottom-right open edge -> left spine -> top-right open edge.
 const leafXs = [
  0.22, 0.174, 0.168, 0.160, 0.10, 0.0, -0.10, -0.160, -0.168, -0.174, SPINE_CX,
 ] as const
 const spineSteps = 4 // intermediate arc angles between -pi/2 and +pi/2 through pi
 const zSteps = [
  -0.36, -0.304, -0.296, -0.286, -0.18, -0.06, 0.0, 0.06, 0.18, 0.286, 0.296, 0.304, 0.36,
 ] as const

 type StationKind = 'bottom' | 'spine' | 'top'
 type RibbonSpec = {
  kind: StationKind
  ox: number; oy: number
  ix: number; iy: number
  topX?: number
 }
 const ribbon: RibbonSpec[] = []
 // 1. Bottom leaf: right open edge (+0.22) -> left spine tangent (SPINE_CX).
 for (const x of leafXs) {
  ribbon.push({ kind: 'bottom', ox: x, oy: 0, ix: x, iy: LEAF_T })
 }
 // 2. Left fold spine: semicircular bend from bottom (-pi/2) through left (pi) to top (+pi/2).
 for (let s = 1; s < spineSteps; s++) {
  const a = -Math.PI * 0.5 - (Math.PI * s) / spineSteps // -pi/2 -> -3pi/2
  const ca = Math.cos(a), sa = Math.sin(a)
  ribbon.push({
   kind: 'spine',
   ox: SPINE_CX + SPINE_R_OUT * ca,
   oy: SPINE_CY + SPINE_R_OUT * sa,
   ix: SPINE_CX + SPINE_R_IN * ca,
   iy: SPINE_CY + SPINE_R_IN * sa,
  })
 }
 // 3. Top leaf: left spine tangent (SPINE_CX) -> right open edge (+0.22).
 for (let k = leafXs.length - 1; k >= 0; k--) {
  const x = leafXs[k]!
  ribbon.push({ kind: 'top', ox: x, oy: SPINE_CY + SPINE_R_OUT, ix: x, iy: SPINE_CY + SPINE_R_IN, topX: x })
 }

 const S = ribbon.length - 1 // number of segments along ribbon
 const M = (S + 1) * 2 // closed profile vertex count: 0..S outer, S+1..2S+1 inner reversed
 const NZ = zSteps.length

 // Precompute exact 3D points `[iz][loopIdx]` so every shared edge uses identical coordinates.
 const rings: [number, number, number][][] = []
 const kinds: ('outer-bot' | 'outer-spine' | 'outer-top' | 'inner-top' | 'inner-spine' | 'inner-bot')[] = []
 for (let i = 0; i <= S; i++) {
  const k = ribbon[i]!.kind
  kinds.push(k === 'bottom' ? 'outer-bot' : k === 'spine' ? 'outer-spine' : 'outer-top')
 }
 for (let i = S; i >= 0; i--) {
  const k = ribbon[i]!.kind
  kinds.push(k === 'bottom' ? 'inner-bot' : k === 'spine' ? 'inner-spine' : 'inner-top')
 }

 for (let iz = 0; iz < NZ; iz++) {
  const z = zSteps[iz]!
  const ring: [number, number, number][] = []
  // Outer path 0..S
  for (let i = 0; i <= S; i++) {
   const r = ribbon[i]!
   if (r.kind === 'top') {
    ring.push([r.ox, evalTopLeafOuterY(r.topX!, z), z])
   } else {
    ring.push([r.ox, r.oy, z])
   }
  }
  // Inner path S..0 (indices S+1..2S+1)
  for (let i = S; i >= 0; i--) {
   const r = ribbon[i]!
   if (r.kind === 'top') {
    ring.push([r.ix, evalTopLeafOuterY(r.topX!, z) - LEAF_T, z])
   } else {
    ring.push([r.ix, r.iy, z])
   }
  }
  rings.push(ring)
 }

 const positions: number[] = []
 const uvs: number[] = []
 const colors: number[] = []
 const indices: number[] = []

 const pushVert = (p: [number, number, number], u: number, v: number, cr: number, cg: number, cb: number) => {
  const id = positions.length / 3
  positions.push(p[0], p[1], p[2])
  uvs.push(u, v)
  colors.push(cr, cg, cb)
  return id
 }

 const topColor = (x: number, z: number): [number, number, number] => {
  const dxFrame = Math.abs(Math.abs(x) - 0.168)
  const dzFrame = Math.abs(Math.abs(z) - 0.296)
  const onHoriz = Math.abs(x) <= 0.174 ? Math.exp(-Math.pow(dzFrame / 0.008, 2)) : 0
  const onVert = Math.abs(z) <= 0.302 ? Math.exp(-Math.pow(dxFrame / 0.008, 2)) : 0
  const deboss = Math.max(onHoriz, onVert)
  const spineShade = Math.exp(-Math.pow((x - SPINE_CX) / 0.022, 2)) * 0.06
  const s = 1 - deboss * 0.095 - spineShade
  return [s, s * 0.992, s * 0.976]
 }

 const uvFor = (p: [number, number, number]): [number, number] => [
  THREE.MathUtils.clamp((p[0] + CARD_HALF_W) / CARD_W, 0, 1),
  THREE.MathUtils.clamp((p[2] + CARD_HALF_L) / CARD_L, 0, 1),
 ]

 // Emit crisp per-quad extruded side & face strips (outward CCW normal when traversing ring CCW in XY).
 // Wait: verify ring winding in XY!
 // Outer bottom moves +x -> -x (bottom), spine goes -pi/2 -> -3pi/2 (around left), outer top goes -x -> +x (top).
 // In XY viewed from +Z, bottom goes LEFT, top goes RIGHT -> that is CLOCKWISE!
 // So from j to j+1 along ring, tangent is CW, and +z is out of screen:
 // (p(z0, j+1) - p(z0, j)) × (p(z1, j) - p(z0, j)) points OUTWARD!
 // Therefore outward CCW quad for strip [iz -> iz+1] and [j -> jNext] is (a0, b0, b1, a1) where:
 // a0=(iz, j), b0=(iz, jNext), b1=(iz+1, jNext), a1=(iz+1, j)!
 const addQuad = (
  p0: [number, number, number],
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number],
  c0: [number, number, number],
  c1: [number, number, number],
  c2: [number, number, number],
  c3: [number, number, number],
 ) => {
  const [u0, v0] = uvFor(p0)
  const [u1, v1] = uvFor(p1)
  const [u2, v2] = uvFor(p2)
  const [u3, v3] = uvFor(p3)
  const i0 = pushVert(p0, u0, v0, c0[0], c0[1], c0[2])
  const i1 = pushVert(p1, u1, v1, c1[0], c1[1], c1[2])
  const i2 = pushVert(p2, u2, v2, c2[0], c2[1], c2[2])
  const i3 = pushVert(p3, u3, v3, c3[0], c3[1], c3[2])
  indices.push(i0, i1, i2, i0, i2, i3)
 }

 const colorForEdge = (j: number, p: [number, number, number]): [number, number, number] => {
  if (j === S || j === M - 1) return [0.95, 0.92, 0.86] // right open cut-paper edge
  const k = kinds[j]!
  if (k === 'outer-top') return topColor(p[0], p[2])
  if (k === 'outer-spine') return [0.94, 0.91, 0.86]
  if (k === 'outer-bot') return [0.88, 0.85, 0.80]
  // Interior cavity faces of the folded card: warm deep shadow so the open wedge slit reads crisply.
  const openU = THREE.MathUtils.clamp((p[0] - SPINE_CX) / (CARD_HALF_W - SPINE_CX), 0, 1)
  const cavity = THREE.MathUtils.lerp(0.50, 0.72, openU)
  return [cavity, cavity * 0.96, cavity * 0.89]
 }

 for (let iz = 0; iz < NZ - 1; iz++) {
  const r0 = rings[iz]!
  const r1 = rings[iz + 1]!
  for (let j = 0; j < M; j++) {
   const jNext = (j + 1) % M
   const p0 = r0[j]!
   const p1 = r0[jNext]!
   const p2 = r1[jNext]!
   const p3 = r1[j]!
   // Outward CCW winding: (p3 - p0) x (p1 - p0) = (+Z) x (ring tangent) points outward everywhere.
   addQuad(
    p0, p3, p2, p1,
    colorForEdge(j, p0),
    colorForEdge(j, p3),
    colorForEdge(j, p2),
    colorForEdge(j, p1),
   )
  }
 }

 // Front (+Z, iz = NZ - 1) and back (-Z, iz = 0) end caps: S clean quads connecting outer[i..i+1] & inner[i..i+1].
 const capTone: [number, number, number] = [0.94, 0.91, 0.85]
 const frontRing = rings[NZ - 1]!
 const backRing = rings[0]!
 for (let i = 0; i < S; i++) {
  const o0 = i, o1 = i + 1
  const i0 = M - 1 - i, i1 = M - 1 - (i + 1)
  // Front cap faces +Z (CCW in XY: o0 -> i0 -> i1 -> o1).
  addQuad(frontRing[o0]!, frontRing[i0]!, frontRing[i1]!, frontRing[o1]!, capTone, capTone, capTone, capTone)
  // Back cap faces -Z (CCW from -Z: o0 -> o1 -> i1 -> i0).
  addQuad(backRing[o0]!, backRing[o1]!, backRing[i1]!, backRing[i0]!, capTone, capTone, capTone, capTone)
 }

 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
 geometry.setIndex(indices)
 geometry.computeVertexNormals()
 geometry.computeBoundingBox()
 geometry.computeBoundingSphere()

 const centerTopY = evalTopLeafOuterY(0, 0)
 const eps = 0.01
 const slope = (evalTopLeafOuterY(eps, 0) - evalTopLeafOuterY(-eps, 0)) / (2 * eps)
 return { geometry, centerTopY, centerSlopeZ: Math.atan(slope) }
}

export function createNeapolitanCornicelloModel(){
 const root=new THREE.Group();root.name='neapolitan-cornicello-root'
 const subject=new THREE.Group();subject.name='neapolitan-cornicello-subject';root.add(subject)
 const cream=new THREE.MeshStandardMaterial({color:0xe7cba1,roughness:.67}),green=new THREE.MeshStandardMaterial({color:0x55725b,roughness:.95}),red=new THREE.MeshStandardMaterial({color:0xb52f24,roughness:.32}),gold=new THREE.MeshStandardMaterial({color:0xc49145,metalness:.55,roughness:.34})
 const paper=createRitualMaterial({
  color:0xf6e9ce,
  roughness:.96,
  vertexColors:true,
 },{
  kind:'paper',
  strength:.24,
  fiber:'paper',
  paper:{
   layout:'sheet',
   aspect:CARD_W/CARD_L,
   grainScale:4.6,
   grain:.88,
   fibers:.05,
   edge:.46,
   highlightGuard:1.05,
  },
 })
 const add=(parent:THREE.Object3D,name:string,size:[number,number,number],position:[number,number,number],material:THREE.Material,bevel=.014)=>{const b=Math.min(bevel,size[0]/3,size[1]/3,size[2]/3);const m=new THREE.Mesh(new RoundedBoxGeometry(size[0],size[1],size[2],2,b),material);m.name=name;m.position.set(...position);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 // Compact chamfered wooden presentation stands grounded on the courtyard replace the old giant stone slab.
 addObjectCradle(subject,{name:'cornicello-box-stand',topName:'cornicello-box-stand-top',style:'pad',footed:true,kind:'wood',color:0x946744,accentColor:0x714c31,width:1.66,depth:2.58,center:[0,.125],groundY:-.12,surfaceY:0,bevel:.016,axis:'z'})
 addObjectCradle(subject,{name:'cornicello-horn-stand',topName:'cornicello-horn-pad',style:'pad',footed:true,kind:'wood',color:0x946744,accentColor:0x714c31,width:1.06,depth:1.30,center:[-1.4,-.30],groundY:-.12,surfaceY:.10,bevel:.016,axis:'z'})
 addObjectCradle(subject,{name:'cornicello-card-stand',topName:'cornicello-card-pad',style:'pad',footed:true,kind:'wood',color:0x946744,accentColor:0x714c31,width:1.06,depth:1.30,center:[1.4,-.30],groundY:-.12,surfaceY:.10,bevel:.016,axis:'z'})
 const giftBox=new THREE.Group();giftBox.name='cornicello-gift-box';subject.add(giftBox)
 add(giftBox,'cornicello-box-base',[1.6,.10,1.6],[0,.05,0],cream,.016)
 add(giftBox,'cornicello-box-left',[.08,.40,1.6],[-.76,.30,0],cream,.014)
 add(giftBox,'cornicello-box-right',[.08,.40,1.6],[.76,.30,0],cream,.014)
 add(giftBox,'cornicello-box-front',[1.44,.40,.08],[0,.30,.76],cream,.014)
 add(giftBox,'cornicello-box-back',[1.44,.40,.08],[0,.30,-.76],cream,.014)
 add(giftBox,'cornicello-box-lining',[1.44,.04,1.44],[0,.12,0],green,.008)
 const horn=new THREE.Group();horn.name='cornicello-horn';giftBox.add(horn)
 const body=new THREE.Mesh(hornGeometry(),red);body.name='cornicello-horn-surface';body.castShadow=body.receiveShadow=true;horn.add(body)
 const card=new THREE.Group();card.name='cornicello-card';giftBox.add(card)
 const folded=createFoldedCardGeometry()
 const cardPaper=new THREE.Mesh(folded.geometry,paper);cardPaper.name='cornicello-card-paper';cardPaper.castShadow=cardPaper.receiveShadow=true;card.add(cardPaper)
 // A small raised heart is a product gift mark, without a traditional claim.
 const heart=new THREE.Shape();heart.moveTo(0,-.08);heart.bezierCurveTo(-.18,.02,-.08,.16,0,.07);heart.bezierCurveTo(.08,.16,.18,.02,0,-.08)
 const heartGeometry=new THREE.ExtrudeGeometry(heart,{depth:.004,bevelEnabled:false,curveSegments:12});heartGeometry.rotateX(-Math.PI/2)
 const mark=new THREE.Mesh(heartGeometry,gold);mark.name='cornicello-card-heart';mark.position.y=folded.centerTopY-.0003;mark.rotation.z=folded.centerSlopeZ;mark.castShadow=true;card.add(mark)
 const initial=[new THREE.Vector3(-1.4,.10,0),new THREE.Vector3(1.4,.10,0)],goal=[new THREE.Vector3(-.28,.14,0),new THREE.Vector3(.40,.14,0)]
 const roots=[horn,card,giftBox],anchors:[number,number,number][]=[[-.20,.15,-.30],[0,.025,0],[0,.26,.80]]
 const pose=(step:number,n:number)=>{
  n=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1)
  giftBox.position.set(0,0,step>=3?.55:step===2?-.30+.85*n:-.30)
  for(let i=0;i<2;i++){
   const object=roots[i]!,start=initial[i]!,end=goal[i]!
   if(step>i||(step===i&&n===1))object.position.copy(end)
   else if(step<i||n===0)object.position.copy(start)
   else if(n<.25)object.position.copy(start).lerp(new THREE.Vector3(start.x,1.05,start.z),n*4)
   else if(n<.75)object.position.set(THREE.MathUtils.lerp(start.x,end.x,(n-.25)*2),1.05,0)
   else object.position.set(end.x,THREE.MathUtils.lerp(1.05,end.y,(n-.75)*4),end.z)
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0);return{root,subject,horn,card,giftBox,roots,targets:roots,anchors,pose}
}
