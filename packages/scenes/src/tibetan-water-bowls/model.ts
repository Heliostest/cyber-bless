import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { bakeCreviceAO } from '@wbr/scene-runtime/prop-geometry'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  applyStylizedHumanSurfaceHint,
  createStylizedForearmGeometry,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedLotusPedestalGeometry,
  createStylizedPalmGeometry,
  createStylizedSeatedStatueGeometry,
  createStylizedThumbGeometry,
  subdivideClosedCage,
} from '@wbr/scene-runtime/stylized-human'
import { createLivingPourStream, createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import * as THREE from 'three'
import { addContactShadow, addOfferingTable } from '../cozy-furniture'

const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t)}

/** Builds a serene elongated gilt-bronze earlobe via Loop subdivision. */
function createBuddhaEarGeometry(): THREE.BufferGeometry {
  const cage = new THREE.SphereGeometry(1, 8, 8)
  const pos = cage.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const taper = y < 0 ? 1 - 0.22 * Math.abs(y) : 1 + 0.05 * y
    pos.setXYZ(i, x * 0.028 * taper, y * 0.074, z * 0.030 * taper)
  }
  pos.needsUpdate = true
  const geo = subdivideClosedCage(cage, {
    iterations: 1,
    colorGenerator: (_p, n) => {
      const shade = THREE.MathUtils.clamp(0.96 - Math.max(0, -n.y) * 0.14, 0.78, 1.04)
      return [shade * 1.02, shade * 0.99, shade * 0.92]
    },
  })
  cage.dispose()
  return geo
}

/** Builds a smooth diagonal monastic sanghati robe drape across the seated torso. */
function createSanghatiSashGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.18, 0.67, -0.05),
    new THREE.Vector3(-0.14, 0.64, 0.12),
    new THREE.Vector3(0.01, 0.49, 0.155),
    new THREE.Vector3(0.15, 0.34, 0.14),
    new THREE.Vector3(0.19, 0.32, -0.04),
  ], false, 'centripetal')
  const cage = new THREE.TubeGeometry(curve, 14, 0.032, 8, false)
  // Flatten cross-section slightly along Z for a flowing cloth band feel.
  const pos = cage.getAttribute('position') as THREE.BufferAttribute
  const colors = new Float32Array(pos.count * 3)
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    const fold = 0.005 * Math.sin(x * 22 + y * 14)
    pos.setXYZ(i, x, y, z + fold)
    const shade = THREE.MathUtils.clamp(0.95 + fold * 10, 0.86, 1.03)
    colors[i * 3] = shade * 1.02
    colors[i * 3 + 1] = shade * 0.98
    colors[i * 3 + 2] = shade * 0.90
  }
  cage.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  cage.computeVertexNormals()
  cage.computeBoundingBox()
  cage.computeBoundingSphere()
  return cage
}

/** Builds a gentle downcast meditative eyelid, brow, or calm smile curve snapped snugly onto the head surface. */
function createContemplativeArcGeometry(
  points: THREE.Vector3[],
  radius: number,
  headMesh: THREE.Mesh,
  headOffset: THREE.Vector3,
): THREE.BufferGeometry {
  const ray = new THREE.Raycaster()
  const snapped = points.map((pt) => {
    const local = pt.clone().sub(headOffset)
    ray.set(new THREE.Vector3(local.x, local.y, local.z + 0.35), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObject(headMesh, false)[0]
    if (!hit) return pt.clone()
    return new THREE.Vector3(pt.x, pt.y, headOffset.z + hit.point.z + radius * 0.25)
  })
  const curve = new THREE.CatmullRomCurve3(snapped, false, 'centripetal')
  const geo = new THREE.TubeGeometry(curve, 10, radius, 8, false)
  geo.computeVertexNormals()
  return geo
}

export function createWaterBowlsModel(){
 const root=new THREE.Group();root.name='water-bowls-subject';root.position.y=-.012
 const material=(color:number,metalness=0,roughness=.7,vertexColors=false)=>new THREE.MeshStandardMaterial({color,metalness,roughness,vertexColors})
 const gold=material(0xd4ac58,.25,.52),copper=material(0xc88454,.62,.32,true),jugmat=material(0xe2cda0,.48,.34,true)
 // Warm storybook gilt-bronze materials with vertex-color AO for the Loop-subdivided seated statue.
 const giltSkin=material(0xe0b55c,.28,.44,true)
 const giltRobe=material(0xc9963e,.22,.56,true)
 const giltSash=material(0xb98232,.20,.60,true)
 const statueHair=material(0x3b4c4e,.12,.68,true)
 const statueFeature=material(0x364446,.08,.74,false)
 applyCraftSurface(copper, { kind: 'metal', scale: 2.8, strength: .54 })
 applyCraftSurface(jugmat, { kind: 'metal', scale: 2.2, strength: .44 })

 const watermat=createRitualMaterial({color:0x75bec8,transparent:true,opacity:.8,roughness:.19,metalness:0,depthWrite:false},{kind:'water',strength:.3})
 const finish=(source:THREE.BufferGeometry)=>{
  const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),faces:number[]=[]
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(p,i+n));if(new THREE.Triangle(v[0]!,v[1]!,v[2]!).getArea()>1e-12)v.forEach(q=>faces.push(q.x,q.y,q.z))}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return g
 }
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root,x=0,y=0,z=0)=>{const o=new THREE.Mesh(finish(g),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const lathe=(profile:number[][])=>new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x!,y!)),48)
 // root.position.y is already -0.012 (garden sand surface), so local groundY=0 lands legs flush at world -0.012.
 const altarBuild=addOfferingTable(root,{
  name:'altar-table',topName:'altar-top',width:3.7,depth:1.7,surfaceY:1.0,thickness:.11,center:[0,0],groundY:0,
  finish:'walnut',color:0x945d3e,frameColor:0x74472e,planks:3,breadboardEnds:true,legThickness:.13,legInset:.15,apron:true,stretchers:true,bevel:.016,
 })
 const seenAltarNames=new Map<string,number>()
 altarBuild.root.traverse(o=>{const n=seenAltarNames.get(o.name)??0;seenAltarNames.set(o.name,n+1);if(n>0)o.name=`${o.name}-${n}`})
 const altar=altarBuild.top
 const plinthProfile=[[0,0],[.575,0],[.585,.012],[.585,.026],[.558,.038],[.515,.052],[.505,.064],[.528,.082],[.550,.098],[.542,.112],[.520,.12],[0,.12]]
 const plinth=mesh('buddha-plinth',lathe(plinthProfile),gold,root,0,1,-.43)
 plinth.scale.z=.65

 // Stylized warm gilt-bronze seated meditative statue via Loop subdivision.
 const buddha=new THREE.Group();buddha.name='seated-buddha';buddha.position.set(0,1.12,-.43);root.add(buddha)
 const addStatue=(name:string,g:THREE.BufferGeometry,m:THREE.Material,role:'statue'|'hair'='statue')=>{
  const o=new THREE.Mesh(g,m)
  o.name=name
  o.castShadow=true
  o.receiveShadow=true
  applyStylizedHumanSurfaceHint(o,role)
  buddha.add(o)
  return o
 }

 const lotusSeat=addStatue('buddha-lotus-seat',createStylizedLotusPedestalGeometry({
  radius:.46,
  height:.11,
  petalCount:12,
  iterations:1,
 }),giltRobe)
 lotusSeat.scale.set(1,1,.66)

 const bodyMesh=addStatue('buddha-body',createStylizedSeatedStatueGeometry({
  lapWidth:.86,
  lapDepth:.49,
  height:.70,
  shoulderWidth:.48,
  foldDepth:.014,
  radialSegments:14,
  iterations:1,
 }),giltRobe)
 bodyMesh.position.set(0,.095,0)

 addStatue('buddha-sash',createSanghatiSashGeometry(),giltSash)

 const upperArmGeo=createStylizedLimbGeometry({
  length:.35,
  topRadius:.074,
  bottomRadius:.056,
  depthRatio:1.02,
  bend:.16,
  foldDepth:.005,
  radialSegments:8,
  iterations:1,
 })
 const forearmGeo=createStylizedForearmGeometry({
  length:.23,
  wristRadiusX:.040,
  wristRadiusY:.034,
  elbowRadiusX:.054,
  elbowRadiusY:.046,
  fullness:.06,
  radialSegments:8,
  iterations:1,
 })
 const posZ=new THREE.Vector3(0,0,1)
 for(const s of[-1,1] as const){
  const arm=addStatue('buddha-arm-'+s,s===-1?upperArmGeo:upperArmGeo.clone(),giltRobe)
  arm.position.set(s*.22,.66,-.01)
  arm.rotation.set(-.18,0,s*.16)

  const elbowPt=new THREE.Vector3(s*.24,.32,.07)
  const wristPt=new THREE.Vector3(s*.085,.255,.165)
  const fore=addStatue('buddha-forearm-'+s,s===-1?forearmGeo:forearmGeo.clone(),giltSkin)
  fore.position.copy(wristPt)
  fore.quaternion.setFromUnitVectors(posZ,elbowPt.clone().sub(wristPt).normalize())
 }

 // Meditative dhyana mudra hands resting serenely in the crossed lap.
 const lowerPalm=addStatue('buddha-hand-lower',createStylizedPalmGeometry({
  width:.15,
  thickness:.030,
  length:.135,
  handedness:'left',
  palmUp:true,
  arch:.004,
  iterations:1,
 }),giltSkin)
 lowerPalm.position.set(0,.245,.18)
 lowerPalm.rotation.y=Math.PI*.52

 const upperPalm=addStatue('buddha-hand-upper',createStylizedPalmGeometry({
  width:.135,
  thickness:.028,
  length:.125,
  handedness:'right',
  palmUp:true,
  arch:.004,
  iterations:1,
 }),giltSkin)
 upperPalm.position.set(0,.268,.182)
 upperPalm.rotation.y=-Math.PI*.52

 const thumbGeo=createStylizedThumbGeometry({length:.072,radiusX:.015,radiusY:.014,curl:.28,curlUp:true,opposition:.008,iterations:1})
 for(const s of[-1,1] as const){
  const thumb=addStatue('buddha-thumb-'+s,s===-1?thumbGeo:thumbGeo.clone(),giltSkin)
  thumb.position.set(s*.052,.284,.168)
  thumb.rotation.set(.18,s*1.25,0)
 }

 const neckMesh=addStatue('buddha-neck',createStylizedLimbGeometry({
  length:.12,
  topRadius:.068,
  bottomRadius:.080,
  depthRatio:1.0,
  bend:0,
  foldDepth:.001,
  radialSegments:8,
  iterations:1,
 }),giltSkin)
 neckMesh.position.set(0,.87,-.015)

 const headMesh=addStatue('buddha-head',createStylizedHeadGeometry({
  width:.275,
  height:.345,
  depth:.255,
  cheekFullness:.15,
  noseProminence:.52,
  chinTaper:.18,
  radialSegments:12,
  iterations:1,
 }),giltSkin)
 headMesh.position.set(0,.96,-.015)

 const hairMesh=addStatue('buddha-hair',createStylizedHairGeometry({
  style:'topknot',
  headWidth:.275,
  headHeight:.345,
  headDepth:.255,
  volume:.021,
  radialSegments:12,
  iterations:1,
 }),statueHair,'hair')
 hairMesh.position.set(0,.96,-.015)

 const finialCage=new THREE.SphereGeometry(1,8,8)
 finialCage.scale(.052,.038,.052)
 const finialGeo=subdivideClosedCage(finialCage,{
  iterations:1,
  colorGenerator:(_p,n)=>{
   const lift=THREE.MathUtils.smoothstep(n.y,0,1)*.10
   const s=THREE.MathUtils.clamp(.94+lift,.82,1.06)
   return [s*1.02,s*.99,s*.92]
  },
 })
 finialCage.dispose()
 const finialMesh=addStatue('buddha-ushnisha',finialGeo,giltSkin)
 finialMesh.position.set(0,1.198,-.020)

 const earGeo=createBuddhaEarGeometry()
 const headPos=new THREE.Vector3(0,.96,-.015)
 for(const s of[-1,1] as const){
  const ear=addStatue('buddha-ear-'+s,s===-1?earGeo:earGeo.clone(),giltSkin)
  ear.position.set(s*.142,.938,-.018)
  const eye=addStatue('buddha-eye-'+s,createContemplativeArcGeometry([
   new THREE.Vector3(s*.026,.972,.109),
   new THREE.Vector3(s*.050,.963,.116),
   new THREE.Vector3(s*.074,.970,.104),
  ],.0046,headMesh,headPos),statueFeature,'hair')
  eye.castShadow=false
  const brow=addStatue('buddha-brow-'+s,createContemplativeArcGeometry([
   new THREE.Vector3(s*.020,.998,.112),
   new THREE.Vector3(s*.052,1.006,.114),
   new THREE.Vector3(s*.080,.996,.100),
  ],.0042,headMesh,headPos),statueFeature,'hair')
  brow.castShadow=false
 }
 const mouth=addStatue('buddha-mouth',createContemplativeArcGeometry([
  new THREE.Vector3(-.024,.894,.106),
  new THREE.Vector3(0,.888,.112),
  new THREE.Vector3(.024,.894,.106),
 ],.0042,headMesh,headPos),statueFeature,'hair')
 mouth.castShadow=false

 // Seven brass offering bowls + GPU-deformed vessel-liquid surfaces with capillary meniscus,
 // mirror-like warm glint, and live pouring ripples.
 const bowls:THREE.Mesh[]=[],waters:THREE.Mesh[]=[]
 const bowlLiquids:ReturnType<typeof createVesselLiquid>[]=[]
 const meniscusTops:number[]=[]
 const bowlProfile=[[0,0],[.065,0],[.08,.025],[.095,.04],[.19,.17],[.19,.185],[.176,.185],[.176,.17],[.082,.045],[0,.045]]
 addContactShadow(root,{name:'buddha-plinth-contact-ao',width:1.22,depth:.80,y:1.0018,center:[0,-.43],shape:'ellipse',opacity:.24})
 for(let i=0;i<7;i++){
  const bowl=mesh('offering-bowl-'+i,lathe(bowlProfile),copper,root,(i-3)*.394,1,.2)
  bakeCreviceAO(bowl.geometry,{groundY:0,groundRange:.045,cavityCenter:[0,0],cavityRadius:.178,cavityTopY:.185,strength:.48,tint:0x4b3328})
  bowls.push(bowl)
  addContactShadow(root,{name:'offering-bowl-contact-ao-'+i,width:.28,depth:.28,y:1.0018,center:[(i-3)*.394,.2],shape:'ellipse',opacity:.28})

  const liq=createVesselLiquid({
   preset:'clear-water',
   radius:.168,
   radialSegments:12,
   angularSegments:36,
   deformMode:'gpu',
   color:0x78c7d2,
   edgeColor:0xdcf7f5,
   deepColor:0x3b8696,
   foamColor:0xfff8eb,
   foamStrength:.06,
   opacity:.74,
   roughness:.10,
   meniscusHeight:.0045,
   maxAmplitude:.012,
   seed:1337+i*71,
   name:'offering-water-'+i,
  })
  liq.geometry.computeBoundingBox()
  meniscusTops.push(liq.geometry.boundingBox!.max.y)
  liq.mesh.position.set((i-3)*.394,1.06,.2)
  root.add(liq.mesh)
  bowlLiquids.push(liq)
  waters.push(liq.mesh)
 }

 const jug=new THREE.Group();jug.name='water-jug';root.add(jug)
 const body=mesh('jug-body',lathe([[0,0],[.13,0],[.2,.06],[.22,.28],[.19,.47],[.15,.5],[.13,.5],[.17,.46],[.195,.28],[.17,.07],[0,.035]]),jugmat,jug)
 bakeCreviceAO(body.geometry,{groundY:0,groundRange:.08,cavityCenter:[0,0],cavityRadius:.18,cavityTopY:.50,strength:.38,tint:0x594230})
 const handle=mesh('jug-handle',new THREE.TorusGeometry(.17,.035,12,32),jugmat,jug,-.23,.28,0);handle.scale.set(.7,1,1)
 bakeCreviceAO(handle.geometry,{strength:.24,tint:0x594230})
 // A closed pouring lip joins the hollow body; its end is the actual stream origin.
 const lipShape=new THREE.Shape();lipShape.moveTo(-.075,-.16);lipShape.lineTo(.075,-.16);lipShape.lineTo(.035,-.27);lipShape.lineTo(-.035,-.27);lipShape.closePath()
 const lip=mesh('jug-pouring-lip',new THREE.ExtrudeGeometry(lipShape,{depth:.022,bevelEnabled:false}),jugmat,jug,0,.49,0);lip.rotation.x=Math.PI/2
 bakeCreviceAO(lip.geometry,{strength:.22,tint:0x594230})
 const jugWater=mesh('jug-water',new THREE.CylinderGeometry(.1,.1,.1,48),watermat,jug);jugWater.castShadow=false
 // Clip the modeled inner volume by a horizontal world plane; a tilted disk would cross the wall.
 const insideRadius=(y:number)=>y<.07?.17*(y-.035)/.035:y<.28?.17+.025*(y-.07)/.21:y<.46?.195-.025*(y-.28)/.18:.17-.04*(y-.46)/.04
 const jugLiquid=(level:number,angle:number)=>{
  const c=Math.cos(angle),s=Math.sin(angle),rings:THREE.Vector3[][]=[],top:THREE.Vector3[]=[]
  for(let i=0;i<48;i++){const phi=i/48*Math.PI*2;let lo=.035,hi=.5;for(let j=0;j<24;j++){const y=(lo+hi)/2,r=insideRadius(y)-.002;if(y*c-r*Math.sin(phi)*s>level)hi=y;else lo=y}const y=(lo+hi)/2,r=insideRadius(y)-.002;top.push(new THREE.Vector3(r*Math.cos(phi),y,r*Math.sin(phi)))}
  for(let k=1;k<=12;k++)rings.push(top.map((p,i)=>{const y=.035+(p.y-.035)*k/12,r=Math.max(0,insideRadius(y)-.002),phi=i/48*Math.PI*2;return new THREE.Vector3(r*Math.cos(phi),y,r*Math.sin(phi))}))
  const vertices:number[]=[],bottom=new THREE.Vector3(0,.035,0),centre=new THREE.Vector3(0,level/c,0),tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray())
  for(let i=0;i<48;i++){const j=(i+1)%48;tri(bottom,rings[0]![i]!,rings[0]![j]!);for(let k=1;k<12;k++){tri(rings[k-1]![i]!,rings[k]![i]!,rings[k]![j]!);tri(rings[k-1]![i]!,rings[k]![j]!,rings[k-1]![j]!)}tri(centre,top[j]!,top[i]!)}
  const g=jugWater.geometry,old=g.getAttribute('position');if(old.count!==vertices.length/3){g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.deleteAttribute('normal')}else{(old.array as Float32Array).set(vertices);old.needsUpdate=true}g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere()
 }

 // Tapered core retains exact matrixWorld endpoint contract; livingStream adds curved surface-tension arc & splash crown.
 const stream=mesh('water-stream',new THREE.CylinderGeometry(.0052,.0038,1,12),watermat);stream.castShadow=false
 const livingStream=createLivingPourStream({
  preset:'clear-water',
  topRadius:.0092,
  bottomRadius:.0055,
  segments:14,
  radialSegments:10,
  arcForward:.14,
  showSplashCrown:true,
  splashRadius:.030,
  color:0x84d0da,
  opacity:.72,
  roughness:.12,
  name:'water-living-stream',
 })
 livingStream.mesh.userData.effect=true
 livingStream.splashCrown.userData.effect=true
 root.add(livingStream.root)
 const resetLivingStream=()=>{
  livingStream.reset()
  livingStream.splashCrown.position.set(0,0,0)
  const pos=livingStream.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  pos.array.fill(0)
  pos.needsUpdate=true
 }
 resetLivingStream()

 const channelSections=[[-.128,.4995,.506],[-.13,.5,.506],[-.15,.5,.506],[-.172,.49,.496],[-.285,.49,.496]].map(([z,b,t])=>[new THREE.Vector3(-.006,b!,z!),new THREE.Vector3(.006,b!,z!),new THREE.Vector3(.006,t!,z!),new THREE.Vector3(-.006,t!,z!)])
 const channelFaces:number[]=[],channelTri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>channelFaces.push(...a.toArray(),...b.toArray(),...c.toArray())
 const front=channelSections[0]!,back=channelSections[channelSections.length-1]!
 channelTri(front[0]!,front[1]!,front[2]!);channelTri(front[0]!,front[2]!,front[3]!);channelTri(back[0]!,back[2]!,back[1]!);channelTri(back[0]!,back[3]!,back[2]!)
 for(let i=0;i<channelSections.length-1;i++)for(let k=0;k<4;k++){const j=(k+1)%4,a=channelSections[i]!,b=channelSections[i+1]!;channelTri(a[k]!,b[k]!,b[j]!);channelTri(a[k]!,b[j]!,a[j]!)}
 const channelGeometry=new THREE.BufferGeometry();channelGeometry.setAttribute('position',new THREE.Float32BufferAttribute(channelFaces,3))
 const lipWater=mesh('lip-water',channelGeometry,watermat,jug);lipWater.castShadow=false
 const tip=new THREE.Vector3(0,.493,-.285),flowStart=new THREE.Vector3(),flowEnd=new THREE.Vector3(),axis=new THREE.Vector3(0,1,0)
 const lastLocalStart=new THREE.Vector3(),lastLocalEnd=new THREE.Vector3()
 const rest=new THREE.Vector3(-1.5,1,.64),left=new THREE.Vector3(-1.182,1.6,.72),right=new THREE.Vector3(1.182,1.6,.72)
 const jugShadow=addContactShadow(root,{name:'water-jug-contact-ao',width:.44,depth:.44,y:1.0018,center:[rest.x,rest.z],shape:'ellipse',opacity:.28})
 let currentActiveBowl=-1,liquidClock=0,bowlRippleTimer=.11

 const setWater=(i:number,f:number)=>{
  const h=.065+.095*f,r=.082+(h-.045)/.125*.094
  const liq=bowlLiquids[i]!
  // Scale the vessel-liquid meniscus disc snugly inside the tapered brass interior while
  // keeping water.position.y + boundingBox.max.y === 1 + h exactly.
  liq.setFillLevel(f,Math.max(.06,r-.0015))
  liq.mesh.position.y=1+h-meniscusTops[i]!
 }

 const pose=(step:number,n:number)=>{
  const t=THREE.MathUtils.clamp(n,0,1);for(const o of[stream,lipWater]){o.visible=false;o.position.set(0,0,0);o.scale.set(1,1,1);o.quaternion.identity()}
  resetLivingStream()
  jug.rotation.set(0,0,0);jug.position.copy(rest)
  let progress=step>=2?1:0,activeBowl=-1,pour=0,tilt=0
  if(step===0){const u=smooth(t/.65);jug.position.copy(rest).lerp(new THREE.Vector3(-1.5,1.6,.72),u);if(t>.65)jug.position.lerpVectors(new THREE.Vector3(-1.5,1.6,.72),left,smooth((t-.65)/.35))}
  else if(step===1){
   const f=t*7,i=Math.min(6,Math.floor(f)),q=t===1?1:f-i;jug.position.set((i-3)*.394,1.6,.72)
   tilt=q<.12?smooth(q/.12):q<=.7?1:1-smooth((q-.7)/.12)
   pour=THREE.MathUtils.clamp((q-.12)/.58,0,1);progress=(i+pour)/7;activeBowl=i
   jug.rotation.x=-(.7+.35*progress)*tilt
   const tipZ=tip.y*Math.sin(jug.rotation.x)+tip.z*Math.cos(jug.rotation.x)
   jug.position.z=THREE.MathUtils.lerp(.72,.2-tipZ,tilt)
   if(q>.82&&i<6)jug.position.x+=.394*smooth((q-.82)/.18)
   stream.visible=q>.12&&q<.7
  }else if(step===2){jug.position.copy(right);if(t<.7)jug.position.lerpVectors(right,new THREE.Vector3(-1.5,1.6,.64),smooth(t/.7));else jug.position.lerpVectors(new THREE.Vector3(-1.5,1.6,.64),rest,smooth((t-.7)/.3))}
  currentActiveBowl=stream.visible?activeBowl:-1
  const jugLift=Math.max(0,jug.position.y-rest.y),jugDrift=Math.hypot(jug.position.x-rest.x,jug.position.z-rest.z)
  ;(jugShadow.material as THREE.MeshBasicMaterial).opacity=.28*THREE.MathUtils.clamp(1-jugLift*2.2-jugDrift*1.4,0,1)
  for(let i=0;i<7;i++)setWater(i,THREE.MathUtils.clamp(progress*7-i,0,1))
  const exitLevel=.5*Math.cos(jug.rotation.x)+.128*Math.sin(jug.rotation.x)
  jugLiquid(Math.min(THREE.MathUtils.lerp(.32-.15*progress,exitLevel,tilt),exitLevel-1e-8),jug.rotation.x)
  root.updateMatrixWorld(true)
  if(stream.visible){
   flowStart.copy(tip).applyMatrix4(jug.matrixWorld);flowEnd.set((activeBowl-3)*.394,1.065+.095*pour,.2).add(root.position)
   const delta=flowStart.clone().sub(flowEnd);stream.position.copy(flowStart).add(flowEnd).multiplyScalar(.5).sub(root.position);stream.scale.y=delta.length();stream.quaternion.setFromUnitVectors(axis,delta.normalize())
   lastLocalStart.copy(flowStart).sub(root.position)
   lastLocalEnd.copy(flowEnd).sub(root.position)
   livingStream.updateArc(lastLocalStart,lastLocalEnd,1,0,true)
   livingStream.splashCrown.visible=false
   lipWater.visible=true
  }
  root.updateMatrixWorld(true)
 }

 const updateLiquid=(dt:number,reduced:boolean)=>{
  const stepDt=Number.isFinite(dt)&&dt>0?Math.min(dt,.05):0
  if(!reduced)liquidClock+=stepDt
  for(let i=0;i<bowlLiquids.length;i++){
   bowlLiquids[i]!.update(stepDt,liquidClock,reduced)
  }
  if(stream.visible&&currentActiveBowl>=0){
   livingStream.updateArc(lastLocalStart,lastLocalEnd,1,liquidClock,reduced)
   if(reduced){
    livingStream.splashCrown.visible=false
   }else if(stepDt>0){
    bowlRippleTimer+=stepDt
    if(bowlRippleTimer>=.11){
     bowlRippleTimer=0
     const activeLiq=bowlLiquids[currentActiveBowl]!
     activeLiq.triggerRipple(0,0,1.2)
     activeLiq.addTiltImpulse(.55*Math.cos(liquidClock*5.2),.55*Math.sin(liquidClock*4.7))
    }
   }
  }else{
   livingStream.mesh.visible=false
   livingStream.splashCrown.visible=false
   bowlRippleTimer=.11
  }
 }

 const dispose=()=>{
  for(const liq of bowlLiquids)liq.dispose()
  livingStream.dispose()
 }

 pose(0,0)
 return{
  root,
  altar,
  buddha,
  bowls,
  waters,
  bowlLiquids,
  livingStream,
  jug,
  body,
  handle,
  lip,
  stream,
  lipWater,
  tip,
  targets:[jug,jug,jug],
  roots:[jug,jug,jug],
  anchors:[[0,.28,.18],[0,.28,.18],[0,.28,.18]] as [number,number,number][],
  pose,
  updateLiquid,
  dispose,
 }
}
