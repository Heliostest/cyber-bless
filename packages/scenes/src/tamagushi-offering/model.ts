import { getEnvironmentSurfaceY } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { addOfferingTable } from '../cozy-furniture'
import { createSakakiLeafGeometry, createSakakiLeafMaterials } from './sakaki-botanical'

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z)
const mix = THREE.MathUtils.lerp
const clamp = (x:number) => THREE.MathUtils.clamp(x,0,1)
const smooth = (x:number) => {const t=clamp(x);return t*t*(3-2*t)}

type ShideStation = {
 left: THREE.Vector3
 right: THREE.Vector3
 normal: THREE.Vector3
 v: number
 creaseShade: number
 panelShade: number
}

/**
 * Builds a closed, watertight, outward-oriented thin paper ribbon solid from
 * consecutive `(left, right, normal)` stations. Adjacent panels share exact
 * miter-line vertex coordinates so welded topological edge checks pass `[-1, 1]`
 * while split per-quad normals keep every 45-degree origami fold crisp.
 */
function buildClosedPaperRibbon(stations: ShideStation[], thickness: number, flipWinding = false): THREE.BufferGeometry {
 const halfT = thickness * 0.5
 const rings = stations.map(st => {
  const n = st.normal.clone().normalize()
  return {
   lt: st.left.clone().addScaledVector(n, halfT),
   rt: st.right.clone().addScaledVector(n, halfT),
   rb: st.right.clone().addScaledVector(n, -halfT),
   lb: st.left.clone().addScaledVector(n, -halfT),
   v: st.v,
   crease: st.creaseShade,
   panel: st.panelShade,
  }
 })

 const positions: number[] = []
 const normals: number[] = []
 const uvs: number[] = []
 const colors: number[] = []
 const e1 = V(), e2 = V(), fn = V()

 const pushTri = (
  a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3,
  uva: [number, number], uvb: [number, number], uvc: [number, number],
  ca: [number, number, number], cb: [number, number, number], cc: [number, number, number],
 ) => {
  const p1 = flipWinding ? c : b
  const p2 = flipWinding ? b : c
  const uv1 = flipWinding ? uvc : uvb
  const uv2 = flipWinding ? uvb : uvc
  const c1 = flipWinding ? cc : cb
  const c2 = flipWinding ? cb : cc
  e1.subVectors(p1, a)
  e2.subVectors(p2, a)
  fn.crossVectors(e1, e2)
  if (fn.lengthSq() > 1e-16) fn.normalize()
  else fn.set(0, 1, 0)
  positions.push(a.x, a.y, a.z, p1.x, p1.y, p1.z, p2.x, p2.y, p2.z)
  normals.push(fn.x, fn.y, fn.z, fn.x, fn.y, fn.z, fn.x, fn.y, fn.z)
  uvs.push(uva[0], uva[1], uv1[0], uv1[1], uv2[0], uv2[1])
  colors.push(ca[0], ca[1], ca[2], c1[0], c1[1], c1[2], c2[0], c2[1], c2[2])
 }

 const pushQuad = (
  a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, d: THREE.Vector3,
  uva: [number, number], uvb: [number, number], uvc: [number, number], uvd: [number, number],
  ca: [number, number, number], cb: [number, number, number], cc: [number, number, number], cd: [number, number, number],
 ) => {
  pushTri(a, b, c, uva, uvb, uvc, ca, cb, cc)
  pushTri(a, c, d, uva, uvc, uvd, ca, cc, cd)
 }

 const tint = (shade: number, warmEdge = false): [number, number, number] => (
  warmEdge
   ? [shade * 0.995, shade * 0.975, shade * 0.925]
   : [shade, shade * 0.988, shade * 0.958]
 )

 for (let i = 0; i < rings.length - 1; i++) {
  const r0 = rings[i]!, r1 = rings[i + 1]!
  const s0 = r0.crease * r0.panel
  const s1 = r1.crease * r1.panel
  const topA = tint(s0), topB = tint(s1)
  const botA = tint(s0 * 0.93), botB = tint(s1 * 0.93)
  const edgeA = tint(0.95, true), edgeB = tint(0.95, true)

  // Top face (outward +normal): lt0 -> lt1 -> rt1 -> rt0
  pushQuad(r0.lt, r1.lt, r1.rt, r0.rt, [0, r0.v], [0, r1.v], [1, r1.v], [1, r0.v], topA, topB, topB, topA)
  // Bottom face (outward -normal): rt -> rb mirrored: lb0 -> rb0 -> rb1 -> lb1
  pushQuad(r0.lb, r0.rb, r1.rb, r1.lb, [0, r0.v], [1, r0.v], [1, r1.v], [0, r1.v], botA, botA, botB, botB)
  // Right cut paper edge
  pushQuad(r0.rt, r1.rt, r1.rb, r0.rb, [1, r0.v], [1, r1.v], [1, r1.v], [1, r0.v], edgeA, edgeB, edgeB, edgeA)
  // Left cut paper edge
  pushQuad(r0.lb, r1.lb, r1.lt, r0.lt, [0, r0.v], [0, r1.v], [0, r1.v], [0, r0.v], edgeA, edgeB, edgeB, edgeA)
 }

 // Start cap (outward -tangent) and end cap (outward +tangent)
 const first = rings[0]!, last = rings[rings.length - 1]!
 const capC = tint(0.95, true)
 pushQuad(first.lt, first.rt, first.rb, first.lb, [0, 0], [1, 0], [1, 0], [0, 0], capC, capC, capC, capC)
 pushQuad(last.lt, last.lb, last.rb, last.rt, [0, 1], [0, 1], [1, 1], [1, 1], capC, capC, capC, capC)

 const g = new THREE.BufferGeometry()
 g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
 g.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3))
 g.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
 g.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
 g.computeBoundingBox()
 g.computeBoundingSphere()
 return g
}

/**
 * Builds a closed folded washi shide with alternating 45-degree diagonal
 * creases, stepped elevations above the leaves, and alternating panel tilts
 * so directional daylight reads every origami step cleanly without blowing out.
 */
function createFoldedShideGeometry(x0: number, side: number): THREE.BufferGeometry {
 const halfW = 0.036
 const thickness = 0.0032
 // Developable alternating mountain/valley origami steps (zero propeller twist!):
 // even segments rise gently along ±Z into the sun while odd cross-segments step
 // cleanly down along ±X across sharp 45-degree diagonal miter creases.
 const rawCorners: { x: number; z: number; y: number }[] = [
  { x: x0,        z: 0.000 * side, y: 0.102 },
  { x: x0,        z: 0.115 * side, y: 0.116 },
  { x: x0 + .158, z: 0.115 * side, y: 0.088 },
  { x: x0 + .158, z: 0.235 * side, y: 0.099 },
  { x: x0,        z: 0.235 * side, y: 0.074 },
  { x: x0,        z: 0.355 * side, y: 0.084 },
  { x: x0 + .158, z: 0.355 * side, y: 0.063 },
  { x: x0 + .158, z: 0.465 * side, y: 0.059 },
 ]

 const pts2 = rawCorners.map(c => new THREE.Vector2(c.x, c.z))
 const miterEdges = pts2.map((p, i) => {
  const prev = pts2[Math.max(0, i - 1)]!
  const next = pts2[Math.min(pts2.length - 1, i + 1)]!
  const a = p.clone().sub(prev)
  const b = next.clone().sub(p)
  if (i === 0) a.copy(b)
  if (i === pts2.length - 1) b.copy(a)
  a.normalize(); b.normalize()
  const na = new THREE.Vector2(-a.y, a.x)
  const nb = new THREE.Vector2(-b.y, b.x)
  const m = na.clone().add(nb).normalize()
  const scale = halfW / Math.max(0.25, m.dot(nb))
  const y = rawCorners[i]!.y
  // Equal left/right elevation on each 45-degree crease keeps every folded panel
  // truly planar/developable with crisp orthogonal shide edges.
  return {
   left: V(p.x + m.x * scale, y, p.y + m.y * scale),
   right: V(p.x - m.x * scale, y, p.y - m.y * scale),
  }
 })

 // Compute cumulative unfolded arc length for continuous grain UVs across folds.
 const segLengths = rawCorners.slice(1).map((c, i) => Math.hypot(c.x - rawCorners[i]!.x, c.z - rawCorners[i]!.z))
 const totalLen = segLengths.reduce((acc, d) => acc + d, 0)

 const stations: ShideStation[] = []
 const subSteps = 3
 let accum = 0
 for (let s = 0; s < rawCorners.length - 1; s++) {
  const e0 = miterEdges[s]!, e1 = miterEdges[s + 1]!
  const len = segLengths[s]!
  const isCrossPanel = s % 2 === 1
  // Subtle facet-tone separation reinforces the alternating mountain/valley rhythm.
  const panelShade = isCrossPanel ? 0.945 : 1.0
  const startStep = s === 0 ? 0 : 1
  for (let k = startStep; k <= subSteps; k++) {
   const t = k / subSteps
   const l = e0.left.clone().lerp(e1.left, t)
   const r = e0.right.clone().lerp(e1.right, t)
   // Subtle single-axis stiff-paper bow along each panel (zero at creases so 45-deg folds stay razor-sharp).
   const arch = Math.sin(Math.PI * t) * (isCrossPanel ? -0.0024 : 0.0036)
   l.y += arch
   r.y += arch
   if (s === rawCorners.length - 2) {
    const tailDrop = -0.0035 * t * t
    l.y += tailDrop
    r.y += tailDrop
   }
   const widthDir = r.clone().sub(l)
   const tangDir = e1.left.clone().add(e1.right).sub(e0.left).sub(e0.right).multiplyScalar(0.5)
   const norm = tangDir.clone().cross(widthDir)
   if (norm.y < 0) norm.negate()
   if (norm.lengthSq() < 1e-10) norm.set(0, 1, 0)
   else norm.normalize()

   // Crisp subtle shadow tucked right along each interior 45-degree diagonal crease.
   const atStartCrease = s > 0 && k === 0
   const atEndCrease = s < rawCorners.length - 2 && k === subSteps
   const nearCrease = (s > 0 && k === 1) || (s < rawCorners.length - 2 && k === subSteps - 1)
   const creaseShade = atStartCrease || atEndCrease ? 0.885 : nearCrease ? 0.97 : 1.0

   stations.push({
    left: l,
    right: r,
    normal: norm,
    v: (accum + len * t) / totalLen,
    creaseShade,
    panelShade,
   })
  }
  accum += len
 }

 // Check winding orientation from the first segment so outward faces always have positive volume.
 const test0 = stations[0]!, test1 = stations[1]!
 const triN = test1.left.clone().sub(test0.left).cross(test1.right.clone().sub(test0.left))
 const flipWinding = triN.dot(test0.normal) < 0
 return buildClosedPaperRibbon(stations, thickness, flipWinding)
}

/** Builds a watertight folded paper collar bridging the stem wrap up to the shide root. */
function createFoldedCollarGeometry(x0: number, side: number): THREE.BufferGeometry {
 const thickness = 0.0034
 const steps = 5
 const stations: ShideStation[] = []
 for (let i = 0; i <= steps; i++) {
  const t = i / steps
  const halfW = mix(0.022, 0.036, smooth(t))
  const y = mix(0.028, 0.102, t)
  // Slight gentle S-curve off the stem collar into the first shide fold.
  const z = side * (0.006 * Math.sin(Math.PI * t))
  const left = V(x0 - halfW * side, y, z)
  const right = V(x0 + halfW * side, y, z)
  const normal = V(0, 0.18, side).normalize()
  stations.push({
   left,
   right,
   normal,
   v: t * 0.18,
   creaseShade: i === 0 || i === steps ? 0.91 : 0.985,
   panelShade: 0.97,
  })
 }
 const t0 = stations[0]!, t1 = stations[1]!
 const triN = t1.left.clone().sub(t0.left).cross(t1.right.clone().sub(t0.left))
 const flipWinding = triN.dot(t0.normal) < 0
 return buildClosedPaperRibbon(stations, thickness, flipWinding)
}

/** Builds a watertight flat folded paper band wrapped around the sakaki stem along X. */
function createStemPaperTieGeometry(x0: number): THREE.BufferGeometry {
 const innerR = 0.026
 const outerR = 0.030
 const halfWidth = 0.013
 const profile = [
  new THREE.Vector2(innerR, -halfWidth),
  new THREE.Vector2(outerR, -halfWidth),
  new THREE.Vector2(outerR, halfWidth),
  new THREE.Vector2(innerR, halfWidth),
  new THREE.Vector2(innerR, -halfWidth),
 ]
 const g = new THREE.LatheGeometry(profile, 24)
 g.rotateZ(Math.PI / 2)
 g.translate(x0, 0, 0)
 // Add matching neutral warm-white vertex colors so the tie shares the sheet paper material cleanly.
 const count = g.getAttribute('position').count
 const col = new Float32Array(count * 3)
 for (let i = 0; i < count; i++) {
  col[i * 3] = 0.96
  col[i * 3 + 1] = 0.95
  col[i * 3 + 2] = 0.92
 }
 g.setAttribute('color', new THREE.BufferAttribute(col, 3))
 g.computeVertexNormals()
 g.computeBoundingBox()
 g.computeBoundingSphere()
 return g
}

/** Original branch, shide and first-person hands. Positive Z is the worshipper side. */
export function createTamagushiModel(){
 const root=new THREE.Group();root.name='tamagushi-subject'
 const table=new THREE.Group();table.name='tamagushi-table';root.add(table)
 const branch=new THREE.Group();branch.name='tamagushi-branch';root.add(branch)
 const matte=(color:number,roughness=.92)=>new THREE.MeshStandardMaterial({color,roughness})
 const wood=matte(0xd2ad72),bark=matte(0x6d6242),skin=matte(0xd9a47d),sleeve=matte(0xe9e6da)
 // Warm natural hosho-like washi white with UV-anchored fibers and strong
 // highlight guard so overhead daylight shows folded facets instead of #FFFFFF clipping.
 const paper=createRitualMaterial({color:0xfaf3e4,roughness:.95,vertexColors:true}, {
  kind: 'paper', strength: .32, fiber: 'paper',
  paper: { layout: 'sheet', aspect: .072 / .92, grainScale: 5.2, grain: .72, fibers: .60, edge: .36, highlightGuard: .82 },
 })
 applyCraftSurface(wood, { kind: 'wood', strength: .4 })
 applyCraftSurface(bark, { kind: 'wood', strength: .28, scale: 1.4, axis: 'y' })
 applyCraftSurface(sleeve, { kind: 'fabric', strength: .26 })

 const green=createSakakiLeafMaterials()
 const mesh=(parent:THREE.Group,name:string,geometry:THREE.BufferGeometry,material:THREE.Material)=>{const o=new THREE.Mesh(geometry,material);o.name='tamagushi-'+name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(parent:THREE.Group,name:string,size:number[],p:number[],material:THREE.Material)=>{const o=mesh(parent,name,new THREE.BoxGeometry(...size as [number,number,number]),material);o.position.set(...p as [number,number,number]);return o}
 const cylinder=(parent:THREE.Group,name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material)=>{
  const d=b.clone().sub(a),o=mesh(parent,name,new THREE.CylinderGeometry(r,r,d.length(),16),material);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o
 }
 const stand=addOfferingTable(table,{
  name:'tamagushi-stand',topName:'tamagushi-table-top-group',width:2.10,depth:1.80,surfaceY:1.01,thickness:.10,
  center:[0,-.45],groundY:getEnvironmentSurfaceY('tamagushi-offering'),finish:'birch',color:0xd2ad72,frameColor:0xb69059,
  planks:1,breadboardEnds:false,legThickness:.12,legInset:.16,apron:true,stretchers:true,bevel:.016,
 })
 const seenStandNames=new Map<string,number>()
 stand.root.traverse(o=>{
  if(o.name==='tamagushi-stand-top-board'){o.name='tamagushi-table-top';return}
  const n=seenStandNames.get(o.name)??0;seenStandNames.set(o.name,n+1)
  if(n>0)o.name=`${o.name}-${n}`
 })
 // Two small chamfered grooved product supports leave space to withdraw the hands after the branch settles.
 const createBranchCradleGeometry=()=>{
  const b=.004
  const shape=new THREE.Shape()
  shape.moveTo(-.116,b)
  shape.lineTo(.116,b)
  shape.lineTo(.116,.024)
  shape.lineTo(.086,.132)
  shape.lineTo(.036,.146)
  shape.lineTo(.018,.146)
  shape.quadraticCurveTo(0,.1435,-.018,.146)
  shape.lineTo(-.036,.146)
  shape.lineTo(-.086,.132)
  shape.lineTo(-.116,.024)
  shape.closePath()
  const g=new THREE.ExtrudeGeometry(shape,{depth:.052,steps:1,curveSegments:8,bevelEnabled:true,bevelSegments:2,bevelSize:b,bevelThickness:b})
  g.translate(0,0,-.026);g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere()
  return g
 }
 const rails=[-.95,.42].map((z,i)=>{
  const o=mesh(table,'support-'+i,createBranchCradleGeometry(),wood);o.position.set(0,1.01,z);return o
 })
 const stem=cylinder(branch,'stem',V(-.80),V(.80),.025,bark)
 // [x, y, z, w, l, rotY (local +Z points outward to pointed leaf apex), twist]
 const leafSpecs:[number,number,number,number,number,number,number][]=[
  [-.22,.042,.30,.15,.23,-.40,.004],
  [-.40,.035,-.25,.12,.20,.45+Math.PI,-.004],
  [-.62,.035,.17,.11,.18,-.80,.003],
  [-.06,.040,-.29,.12,.20,.15+Math.PI,-.003],
  [-1.02,.032,-.025,.10,.20,-Math.PI/2,.002],
 ]
 const leaves=leafSpecs.map(([x,y,z,w,l,rotY,twist],i)=>{
  const g=createSakakiLeafGeometry(w,l,{twist,arch:.012,fold:.011})
  const o=mesh(branch,'leaf-'+i,g,green[i%3]!);o.position.set(x,y,z);o.rotation.y=rotY
  const start=V(i===4?-.74:Math.max(-.70,Math.min(.08,x+.16)),.012,0)
  // Tuck petiole cleanly into the tapered leaf base (-Z in leaf-local coordinates) without piercing the blade.
  const end=V(x-Math.sin(rotY)*l*.88,y-.004,z-Math.cos(rotY)*l*.88)
  cylinder(branch,'twig-'+i,start,end,.0085,bark);return o
 })
 const papers=[1,-1].map((side,i)=>{
  const x=i===0?-.55:-.70;
  const p=mesh(branch,'shide-'+i,createFoldedShideGeometry(x,side),paper);
  mesh(branch,'paper-tie-'+i,createStemPaperTieGeometry(x),paper);
  mesh(branch,'paper-fold-'+i,createFoldedCollarGeometry(x,side),paper);
  return p
 })
 const hands=[-1,1].map((side,i)=>{
  const group=new THREE.Group();group.name='tamagushi-hand-'+i;root.add(group)
  const palm=mesh(group,'palm-'+i,new RoundedBoxGeometry(.28,.07,.22,2,.012),skin)
  for(let f=0;f<4;f++){
   const g=new THREE.CapsuleGeometry(.020,.10,4,8);g.rotateX(Math.PI/2);const o=mesh(group,`finger-${i}-${f}`,g,skin);o.position.set(-.075+f*.05,-.009,-.145)
  }
  const thumb=mesh(group,'thumb-'+i,new THREE.CapsuleGeometry(.027,.09,4,8),skin);thumb.rotation.z=side*.75;thumb.position.set(-side*.115,-.042,-.005)
  const direction=V(side*.60,0,1).normalize(),wrist=V(side*.025,0,.085)
  const armJoint=new THREE.Group();armJoint.name='tamagushi-wrist-'+i;armJoint.position.copy(wrist);group.add(armJoint)
  const arm=cylinder(armJoint,'forearm-'+i,V(),direction.clone().multiplyScalar(.80),.055,skin)
  const cuff=cylinder(armJoint,'sleeve-'+i,direction.clone().multiplyScalar(.65),direction.clone().multiplyScalar(3.2),.080,sleeve)
  arm.userData.intentionalCrop=cuff.userData.intentionalCrop=true
  return{group,palm,side,armJoint,wrist}
 })
 let angle=0,leftGrip=-.24,rightGrip=.68
 const branchPoint=(x:number)=>V(x,0,0).applyAxisAngle(V(0,1,0),-angle).add(branch.position)
 function pose(checkpoint:number,amount:number,_effects=true){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0);return}
  const t=clamp(Number.isFinite(amount)?amount:0);let rightAway=0,rightDrop=0,withdraw=0
  branch.position.set(0,1.45,0)
  if(checkpoint===0){angle=Math.PI/2*smooth(t/.70);leftGrip=mix(-.24,.35,smooth((t-.70)/.30));rightGrip=.68}
  else if(checkpoint===1){const transfer=smooth(t/.30);leftGrip=.35;rightGrip=mix(.68,-.24,transfer);rightAway=.32*Math.sin(Math.PI*transfer);rightDrop=.18*Math.sin(Math.PI*transfer);angle=Math.PI/2+Math.PI*smooth((t-.30)/.70)}
  else{angle=Math.PI*1.5;leftGrip=.35;rightGrip=-.24;branch.position.z=-.35*(checkpoint===3?1:smooth(t/.45));branch.position.y=mix(1.45,1.185,checkpoint===3?1:smooth((t-.45)/.35));withdraw=checkpoint===3?1:smooth((t-.80)/.20)}
  branch.rotation.y=-angle
  const lowerArm=checkpoint===1?Math.sin(Math.PI*clamp((t-.30)/.70)):0
  hands.forEach(({group,side,armJoint,wrist},i)=>{group.position.copy(branchPoint(i===0?leftGrip:rightGrip)).add(V(side*(.12+.38*withdraw)+(i===1?rightAway:0),-.060-(i===1?rightDrop:0),.04));group.rotation.set(0,0,0);armJoint.position.copy(wrist).y-=.04*lowerArm;armJoint.quaternion.setFromAxisAngle(V(1,0,-side*.60).normalize(),.30*lowerArm)})
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,table,branch,stem,leaves,papers,hands,rails,pose,tick:(_dt:number)=>{},branchPoint,targets:[leaves[0]!,leaves[0]!,leaves[0]!],roots:[branch,branch,branch],anchors:[V(0,.015,0),V(0,.015,0),V(0,.015,0)]}
}
