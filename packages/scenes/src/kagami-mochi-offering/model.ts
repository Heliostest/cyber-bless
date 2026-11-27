import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { addOfferingTable } from '../cozy-furniture'

const SHEET_Z_CENTER = 0.15
const SHEET_HX = 1.26
const SHEET_HZ = 1.35
const BORDER_W = 0.056
const FEATHER_W = 0.010
const TOP_SHEET_T = 0.0052
const UNDER_SHEET_T = 0.0046

// Symmetric grid stops placing exact vertices on the dyed red border, ink feather band,
// and central cross-fold crease so the red border and quarter-fold remain razor-clean.
const X_STOPS = [
 -1.26, -1.204, -1.194, -1.12, -1.02, -0.84, -0.62, -0.40, -0.20, -0.045, 0,
 0.045, 0.20, 0.40, 0.62, 0.84, 1.02, 1.12, 1.194, 1.204, 1.26,
] as const
const Z_REL_STOPS = [
 -1.35, -1.294, -1.284, -1.20, -1.08, -0.88, -0.64, -0.40, -0.18, -0.045, 0,
 0.045, 0.18, 0.40, 0.64, 0.88, 1.08, 1.20, 1.284, 1.294, 1.35,
] as const

// Resting food footprints (in world/subject XZ) where the upper sheet sits strictly flat at y = 0.016.
const FOOD_PADS: readonly [number, number, number][] = [
 [-0.50, 0.75, 0.56], // kagami-large start
 [0.70, 0.80, 0.42],  // kagami-small start
 [0.75, -0.85, 0.22], // kagami-orange start
 [-0.25, -0.45, 0.56], // kagami-large end (stacked target)
]

function foodContactMask(x: number, z: number): number {
 let mask = 0
 for (const [fx, fz, r] of FOOD_PADS) {
  const d = Math.hypot(x - fx, z - fz)
  const w = 1 - THREE.MathUtils.smoothstep(d, r, r + 0.26)
  if (w > mask) mask = w
 }
 return mask
}

/**
 * Evaluates the top surface Y of the upper red-bordered offering washi sheet.
 * - Strictly `0.016` across every food footprint so the rice cakes and orange sit flush.
 * - Subtle unfolded quarter-fold memory along `x = 0` and `z = 0.15` plus gentle handmade
 *   washi ripple and gracefully curled outer corners clear of all food footprints.
 */
function evalUpperWashiTopY(x: number, z: number): number {
 const zr = z - SHEET_Z_CENTER
 const nx = Math.abs(x) / SHEET_HX
 const nz = Math.abs(zr) / SHEET_HZ
 const free = 1 - foodContactMask(x, z)

 // Subtle unfolded quarter-fold valley/ridge memory and gentle paper undulation.
 const vCrease = Math.exp(-Math.pow(x / 0.065, 2)) * 0.0056
 const hCrease = Math.exp(-Math.pow(zr / 0.065, 2)) * 0.0056
 const ripple = 0.0026 * Math.sin(x * 2.9 + 0.5) * Math.cos(zr * 2.6 - 0.3)

 // Outer edges settle gently toward the lower folded sheet while the four corners curl softly upward.
 const edgeFactor = Math.max(
  THREE.MathUtils.smoothstep(nx, 0.72, 1.0),
  THREE.MathUtils.smoothstep(nz, 0.72, 1.0),
 )
 const cornerFactor = THREE.MathUtils.smoothstep(nx, 0.60, 1.0) * THREE.MathUtils.smoothstep(nz, 0.60, 1.0)
 const frontCornerBias = zr > 0 ? 1.15 : 0.85
 const edgeSettle = -0.0036 * edgeFactor * (1 - cornerFactor)
 const cornerCurl = 0.020 * Math.pow(cornerFactor, 1.35) * frontCornerBias

 return 0.016 + free * (vCrease + hCrease + ripple + edgeSettle + cornerCurl)
}

/**
 * Evaluates the top surface Y of the lower folded washi sheet resting cleanly on `y = 0`.
 */
function evalLowerWashiTopY(x: number, z: number): number {
 const zr = z - SHEET_Z_CENTER
 const nx = Math.abs(x) / (SHEET_HX - 0.014)
 const nz = Math.abs(zr) / (SHEET_HZ - 0.014)
 const corner = THREE.MathUtils.smoothstep(nx, 0.70, 1.0) * THREE.MathUtils.smoothstep(nz, 0.70, 1.0)
 return UNDER_SHEET_T + 0.0055 * Math.pow(corner, 1.6)
}

const PAPER_BASE_LIN = new THREE.Color(0xf7eedb)
const RED_DYE_LIN = new THREE.Color(0xc84c48)
const RED_MULT: [number, number, number] = [
 RED_DYE_LIN.r / PAPER_BASE_LIN.r,
 RED_DYE_LIN.g / PAPER_BASE_LIN.g,
 RED_DYE_LIN.b / PAPER_BASE_LIN.b,
]

function createWashiSheetGeometry(opts: {
 scaleX: number
 scaleZ: number
 thickness: number
 evalTopY: (x: number, z: number) => number
 redBorder: boolean
 baseShade: number
}): THREE.BufferGeometry {
 const cols = X_STOPS.length
 const rows = Z_REL_STOPS.length
 const gridCount = cols * rows
 const positions: number[] = []
 const uvs: number[] = []
 const colors: number[] = []
 const indices: number[] = []

 const topPts: [number, number, number][] = []
 const botPts: [number, number, number][] = []
 const hx = SHEET_HX * opts.scaleX
 const hz = SHEET_HZ * opts.scaleZ

 for (let iz = 0; iz < rows; iz++) {
  const zr = Z_REL_STOPS[iz]! * opts.scaleZ
  const z = SHEET_Z_CENTER + zr
  for (let ix = 0; ix < cols; ix++) {
   const x = X_STOPS[ix]! * opts.scaleX
   const yTop = opts.evalTopY(x, z)
   const yBot = Math.max(0, yTop - opts.thickness)
   topPts.push([x, yTop, z])
   botPts.push([x, yBot, z])
  }
 }

 const colorAt = (x: number, zr: number, sideMul: number): [number, number, number] => {
  const dxEdge = hx - Math.abs(x)
  const dzEdge = hz - Math.abs(zr)
  const dEdge = Math.min(dxEdge, dzEdge)
  const dye = opts.redBorder
   ? 1 - THREE.MathUtils.smoothstep(dEdge, BORDER_W * opts.scaleX, (BORDER_W + FEATHER_W) * opts.scaleX)
   : 0
  // Delicate cross-fold crease shading and subtle 4-quadrant paper light shift.
  const vCrease = Math.exp(-Math.pow(x / 0.048, 2))
  const hCrease = Math.exp(-Math.pow(zr / 0.048, 2))
  const quadShift = (x < 0 ? 0.016 : -0.016) + (zr < 0 ? 0.016 : -0.016)
  const shade = (opts.baseShade + quadShift - (vCrease + hCrease) * 0.068) * sideMul
  const r = THREE.MathUtils.lerp(1, RED_MULT[0], dye) * shade
  const g = THREE.MathUtils.lerp(1, RED_MULT[1], dye) * shade * 0.992
  const b = THREE.MathUtils.lerp(1, RED_MULT[2], dye) * shade * 0.978
  return [r, g, b]
 }

 // Top (+Y) and bottom (-Y) faces.
 for (let side = 0; side < 2; side++) {
  const pts = side === 0 ? topPts : botPts
  const sideMul = side === 0 ? 1.0 : 0.88
  for (let iz = 0; iz < rows; iz++) {
   const zr = Z_REL_STOPS[iz]! * opts.scaleZ
   const v = (zr + hz) / (2 * hz)
   for (let ix = 0; ix < cols; ix++) {
    const x = X_STOPS[ix]! * opts.scaleX
    const u = (x + hx) / (2 * hx)
    const p = pts[iz * cols + ix]!
    positions.push(p[0], p[1], p[2])
    uvs.push(u, v)
    const [cr, cg, cb] = colorAt(x, zr, sideMul)
    colors.push(cr, cg, cb)
   }
  }
 }

 const quad = (a: number, b: number, c: number, d: number) => indices.push(a, b, c, a, c, d)
 for (let iz = 0; iz < rows - 1; iz++) {
  for (let ix = 0; ix < cols - 1; ix++) {
   const a = iz * cols + ix
   // As ix increases (+X) and iz increases (+Z), (+Z) x (+X) = +Y: CCW top quad is (a, a+cols, a+cols+1, a+1).
   quad(a, a + cols, a + cols + 1, a + 1)
   quad(gridCount + a, gridCount + a + 1, gridCount + a + cols + 1, gridCount + a + cols)
  }
 }

 // Closed cut-paper perimeter rim around all four edges.
 const perimeter: number[] = []
 for (let ix = 0; ix < cols; ix++) perimeter.push(ix) // back edge (-Z): left -> right
 for (let iz = 1; iz < rows; iz++) perimeter.push(iz * cols + (cols - 1)) // right edge (+X): back -> front
 for (let ix = cols - 2; ix >= 0; ix--) perimeter.push((rows - 1) * cols + ix) // front edge (+Z): right -> left
 for (let iz = rows - 2; iz >= 0; iz--) perimeter.push(iz * cols) // left edge (-X): front -> back

 const edgeStart = gridCount * 2
 for (const k of perimeter) {
  const t = topPts[k]!
  const b = botPts[k]!
  positions.push(t[0], t[1], t[2], b[0], b[1], b[2])
  const u = (t[0] + hx) / (2 * hx)
  const v = (t[2] - SHEET_Z_CENTER + hz) / (2 * hz)
  uvs.push(u, v, u, v)
  const [cr, cg, cb] = opts.redBorder
   ? [RED_MULT[0] * 1.06, RED_MULT[1] * 1.12, RED_MULT[2] * 1.12]
   : [opts.baseShade * 0.96, opts.baseShade * 0.94, opts.baseShade * 0.90]
  colors.push(cr, cg, cb, cr * 0.88, cg * 0.88, cb * 0.88)
 }
 for (let i = 0; i < perimeter.length - 1; i++) {
  const t0 = edgeStart + i * 2
  const b0 = t0 + 1
  const t1 = t0 + 2
  const b1 = t0 + 3
  quad(t0, t1, b1, b0)
 }

 const geometry = new THREE.BufferGeometry()
 geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
 geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
 geometry.setIndex(indices)
 geometry.computeVertexNormals()
 geometry.computeBoundingBox()
 geometry.computeBoundingSphere()
 return geometry
}

/** Prepared round rice cakes and a daidai orange, placed on layered handmade red-bordered offering paper. */
export function createKagamiModel() {
 const root=new THREE.Group();root.name='kagami-root'
 const subject=new THREE.Group();subject.name='kagami-subject';root.add(subject)
 const mat=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
 const rice=mat(0xfff2d6,.96),orange=mat(0xf29a32,.64),green=mat(0x56794b)
 const paper=createRitualMaterial({
  color:0xf7eedb,
  roughness:.96,
  vertexColors:true,
 },{
  kind:'paper',
  strength:.24,
  fiber:'paper',
  paper:{
   layout:'sheet',
   aspect:SHEET_HX/SHEET_HZ,
   grainScale:3.4,
   grain:1.0,
   fibers:.08,
   edge:.42,
   highlightGuard:1.06,
  },
 })
 const underPaper=createRitualMaterial({
  color:0xece0c8,
  roughness:.97,
  vertexColors:true,
 },{
  kind:'paper',
  strength:.18,
  fiber:'paper',
  paper:{
   layout:'sheet',
   aspect:SHEET_HX/SHEET_HZ,
   grainScale:4.6,
   grain:.80,
   fibers:.03,
   edge:.30,
   highlightGuard:1.15,
  },
 })
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 // Compact chamfered footed low wooden product stand grounded at the courtyard surface (-0.1025)
 // with its top surface at y = 0 directly beneath the untouched dual-layer offering washi sheets.
 const standBuild=addOfferingTable(subject,{
  name:'kagami-low-wood-base',topName:'kagami-low-wood-base',width:2.58,depth:2.76,surfaceY:0,thickness:.026,
  center:[0,SHEET_Z_CENTER],groundY:getEnvironmentSurfaceY('kagami-mochi-offering'),
  finish:'honey',color:0xb88c5e,frameColor:0x8e6540,
  planks:3,breadboardEnds:true,legThickness:.125,legInset:.015,apron:false,stretchers:false,bevel:.010,
 })
 const seenStandNames=new Map<string,number>()
 standBuild.root.traverse(o=>{const n=seenStandNames.get(o.name)??0;seenStandNames.set(o.name,n+1);if(n>0)o.name=`${o.name}-${n}`})
 // Lower folded washi layer resting cleanly on the wooden base beneath the red-bordered upper sheet.
 mesh(createWashiSheetGeometry({
  scaleX:.988,scaleZ:.988,thickness:UNDER_SHEET_T,evalTopY:evalLowerWashiTopY,redBorder:false,baseShade:.94,
 }),underPaper,subject,'kagami-paper-edge')
 // Upper thin handmade washi sheet with dyed four-sided red border, soft cross-fold memory, and gently lifted corners.
 mesh(createWashiSheetGeometry({
  scaleX:1,scaleZ:1,thickness:TOP_SHEET_T,evalTopY:evalUpperWashiTopY,redBorder:true,baseShade:1,
 }),paper,subject,'kagami-paper')
 // Closed lathed profiles have flat contact patches at their top and bottom.
 const round=(r:number,h:number,material:THREE.Material,parent:THREE.Object3D,name:string)=>{
  const points=[[0,0],[r*.63,0],[r*.82,h*.035],[r*.95,h*.16],[r,h*.40],[r*.98,h*.62],[r*.90,h*.82],[r*.75,h*.96],[r*.63,h],[0,h]].map(([x,y])=>new THREE.Vector2(x!,y!))
  return mesh(new THREE.LatheGeometry(points,64),material,parent,name)
 }
 const roots=[0,1,2].map(i=>{const o=new THREE.Group();o.name=`kagami-root-${i}`;subject.add(o);return o})
 const large=round(.66,.29,rice,roots[0]!,'kagami-large'),small=round(.48,.24,rice,roots[1]!,'kagami-small')
 const fruit=round(.20,.34,orange,roots[2]!,'kagami-orange')
 const stem=mesh(new THREE.CylinderGeometry(.014,.021,.075,10),green,roots[2]!,'kagami-orange-stem');stem.position.y=.36
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,o=mesh(new THREE.SphereGeometry(1,12,8),green,roots[2]!,`kagami-calyx-${i}`);o.scale.set(.033,.008,.018);o.position.set(Math.cos(a)*.023,.336,Math.sin(a)*.023);o.rotation.y=-a}
 const leaf=mesh(new THREE.SphereGeometry(1,16,8),green,roots[2]!,'kagami-leaf');leaf.scale.set(.10,.014,.038);leaf.position.set(.082,.382,0);leaf.rotation.z=.13
 const starts=[new THREE.Vector3(-.50,.016,.75),new THREE.Vector3(.70,.016,.80),new THREE.Vector3(.75,.016,-.85)]
 const ends=[new THREE.Vector3(-.25,.016,-.45),new THREE.Vector3(-.25,.306,-.45),new THREE.Vector3(-.25,.546,-.45)]
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  roots.forEach((o,i)=>{
   o.position.copy(i<step?ends[i]!:starts[i]!);o.rotation.set(0,0,0)
   if(i===step&&step<3){
    const lift=THREE.MathUtils.clamp(t/.3,0,1),travel=THREE.MathUtils.clamp((t-.3)/.4,0,1),lower=THREE.MathUtils.clamp((t-.7)/.3,0,1),high=.9
    o.position.lerpVectors(starts[i]!,ends[i]!,travel)
    o.position.y=t<.3?THREE.MathUtils.lerp(starts[i]!.y,high,lift):THREE.MathUtils.lerp(high,ends[i]!.y,lower)
   }
  });root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject,targets:[large,small,fruit],roots,anchors:[[0,.18,0],[0,.15,0],[0,.17,0]] as [number,number,number][],pose}
}
