import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  applyStylizedHumanSurfaceHint,
  createStylizedFingerGeometry,
  createStylizedForearmGeometry,
  createStylizedGarmentMaterial,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedPalmGeometry,
  createStylizedShoeGeometry,
  createStylizedSkinMaterial,
  createStylizedSleeveCuffGeometry,
  createStylizedThumbGeometry,
  createStylizedTorsoGeometry,
  subdivideClosedCage,
} from '@wbr/scene-runtime/stylized-human'
import {
  createLivingPourStream,
  createVesselLiquid,
  type LivingPourStreamHandle,
} from '@wbr/scene-runtime/vessel-liquid'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t)}
const vessel=(profile:number[][])=>{const g=new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x!,y!)),48).toNonIndexed();g.computeVertexNormals();return g}

/** Builds a softly sculpted rounded ear via Loop subdivision. */
function createElderEarGeometry(): THREE.BufferGeometry {
  const cage = new THREE.SphereGeometry(1, 8, 8)
  const pos = cage.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i)
    pos.setXYZ(i, x * 0.032, y * 0.056, z * 0.028)
  }
  pos.needsUpdate = true
  const geo = subdivideClosedCage(cage, {
    iterations: 1,
    colorGenerator: (_p, n) => {
      const shade = THREE.MathUtils.clamp(0.96 - Math.max(0, -n.y) * 0.12, 0.80, 1.02)
      return [shade * 1.02, shade * 0.97, shade * 0.93]
    },
  })
  cage.dispose()
  return geo
}

/** Builds a gentle curved facial feature arc snapped snugly onto the sculpted head surface. */
function createFacialArcGeometry(
  points: THREE.Vector3[],
  radius: number,
  headMesh: THREE.Mesh,
  headOffset: THREE.Vector3,
): THREE.BufferGeometry {
  const ray = new THREE.Raycaster()
  const snapped = points.map((pt) => {
    const local = pt.clone().sub(headOffset)
    ray.set(new THREE.Vector3(local.x, local.y, local.z + 0.40), new THREE.Vector3(0, 0, -1))
    const hit = ray.intersectObject(headMesh, false)[0]
    if (!hit) return pt.clone()
    return new THREE.Vector3(pt.x, pt.y, headOffset.z + hit.point.z + radius * 0.25)
  })
  const curve = new THREE.CatmullRomCurve3(snapped, false, 'centripetal')
  const geo = new THREE.TubeGeometry(curve, 10, radius, 8, false)
  geo.computeVertexNormals()
  return geo
}

/** Builds a curved pouring lip water tongue bridging inner rim x=0.244 to outer drop x=0.280. */
function createPouringLipGeometry(): THREE.BufferGeometry {
  const cols = 6
  const pos: number[] = []
  const idx: number[] = []
  for (let i = 0; i <= cols; i++) {
    const u = i / cols
    const x = THREE.MathUtils.lerp(0.244, 0.280, u)
    // Gentle meniscus crest rising slightly over the rounded metal lip before dipping into stream.
    const y = 0.1801 + Math.sin(u * Math.PI) * 0.0042 - u * u * 0.0012
    const halfW = THREE.MathUtils.lerp(0.0115, 0.0068, u)
    pos.push(x, y, -halfW, x, y, halfW)
  }
  for (let i = 0; i < cols; i++) {
    const a = i * 2, b = a + 1, c = a + 2, d = a + 3
    idx.push(a, c, d, a, d, b)
  }
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
  g.setIndex(idx)
  g.computeVertexNormals()
  return g
}

/**
 * Water material for the silver bowl's frustum-clipped surface: keeps CPU vertices strictly
 * horizontal for geometric invariants while rendering live GPU slosh shimmer, meniscus rim
 * highlight, and sunlit jasmine-water caustics driven by the spring-pendulum liquid state.
 */
function createBowlSurfaceMaterial() {
  const uniforms = {
    wbrSongTime: { value: 0 },
    wbrSongSlosh: { value: new THREE.Vector2(0, 0) },
    wbrSongReduced: { value: 0 },
  }
  const mat = new THREE.MeshPhysicalMaterial({
    color: 0x88d5e3,
    roughness: 0.12,
    metalness: 0,
    ior: 1.333,
    clearcoat: 0.82,
    clearcoatRoughness: 0.09,
    transparent: true,
    opacity: 0.65,
    side: THREE.DoubleSide,
    depthWrite: false,
  })
  mat.userData.waterRendering = false
  mat.customProgramCacheKey = () => 'wbr-songkran-bowl-water-v1'
  mat.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = `
varying vec3 wbrSongWorld;
uniform float wbrSongTime;
uniform vec2 wbrSongSlosh;
uniform float wbrSongReduced;
` + shader.vertexShader.replace('#include <begin_vertex>', `
      #include <begin_vertex>
      float calm = 1.0 - wbrSongReduced;
      float wave = (sin(position.x * 26.0 + wbrSongTime * 2.4) * 0.55 + cos(position.z * 23.0 - wbrSongTime * 1.9) * 0.45) * 0.0016;
      float sloshShift = clamp((wbrSongSlosh.x * sin(position.x * 9.0) + wbrSongSlosh.y * sin(position.z * 9.0)) * 0.008, -0.006, 0.006);
      transformed.y += (wave + sloshShift) * calm;
      wbrSongWorld = (modelMatrix * vec4(transformed, 1.0)).xyz;
    `)
    shader.fragmentShader = `
varying vec3 wbrSongWorld;
uniform float wbrSongTime;
uniform vec2 wbrSongSlosh;
uniform float wbrSongReduced;
` + shader.fragmentShader.replace('#include <color_fragment>', `
      #include <color_fragment>
      float t = wbrSongTime * (1.0 - wbrSongReduced);
      float caust = 0.5 + 0.5 * sin(wbrSongWorld.x * 29.0 + t * 2.1) * cos(wbrSongWorld.z * 27.0 - t * 1.7);
      float sloshEnergy = clamp(length(wbrSongSlosh) * 0.9, 0.0, 0.55);
      vec3 edgeTint = vec3(0.84, 0.97, 0.95);
      vec3 deepTint = vec3(0.29, 0.60, 0.68);
      vec3 viewDir = normalize(vViewPosition);
      float fres = pow(clamp(1.0 - abs(dot(normal, viewDir)), 0.0, 1.0), 2.6);
      diffuseColor.rgb = mix(deepTint, diffuseColor.rgb, 0.62 + caust * 0.28);
      diffuseColor.rgb = mix(diffuseColor.rgb, edgeTint, clamp(fres * 0.36 + caust * 0.16 + sloshEnergy * 0.22, 0.0, 0.68));
      diffuseColor.a = clamp(diffuseColor.a + fres * 0.14 + sloshEnergy * 0.08, 0.0, 0.94);
    `)
  }
  return { material: mat, uniforms }
}

/** A seated elder, a hollow water bowl and a supported catch basin. Furniture and gesture timing are product staging. */
export function createSongkranModel(){
 const root=new THREE.Group();root.name='songkran-subject'
 const make=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,m);o.name='songkran-'+name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const matte=(color:number,roughness=.9)=>new THREE.MeshStandardMaterial({color,roughness})
 // Warm Komorebi stylized skin, woven Thai blouse & sarong garments, silver-white elder hair.
 const skin=createStylizedSkinMaterial({color:0xd89f76,tone:'honey-ochre',roughness:.86,scatterStrength:.14,name:'songkran-skin'})
 const shirt=createStylizedGarmentMaterial({color:0xf5e7bb,roughness:.92,fabricStrength:.26,name:'songkran-shirt'})
 const pants=createStylizedGarmentMaterial({color:0x468b8a,roughness:.92,fabricStrength:.26,name:'songkran-pants'})
 const hair=new THREE.MeshStandardMaterial({color:0xe5e3d6,roughness:.84,vertexColors:true})
 const shoeMat=new THREE.MeshStandardMaterial({color:0x55595a,roughness:.88,vertexColors:true})
 const featureMat=matte(0x4f5355,.86)
 const browMat=matte(0xdcd9ca,.88)
 const wood=matte(0x9c6c43),legWood=matte(0x885c37),sideWood=matte(0x8e613b),stone=matte(0xdacfc0),metal=new THREE.MeshStandardMaterial({color:0x9dc2c3,metalness:.35,roughness:.42})
 applyCraftSurface(wood, { kind: 'wood', strength: .4, axis: 'x' })
 applyCraftSurface(legWood, { kind: 'wood', strength: .42, axis: 'y' })
 applyCraftSurface(sideWood, { kind: 'wood', strength: .40, axis: 'z' })
 applyCraftSurface(metal, { kind: 'metal', strength: .45 })
 applyCraftSurface(stone, { kind: 'stone', strength: .4 })

 const GROUND_Y=.0175
 const roundedBox=(name:string,size:number[],p:number[],m:THREE.Material,parent:THREE.Object3D=root,radius=.014)=>{const r=Math.min(radius,size[0]!/3,size[1]!/3,size[2]!/3);const o=make(name,new RoundedBoxGeometry(size[0]!,size[1]!,size[2]!,2,r),m,parent);o.position.set(...p as [number,number,number]);return o}
 const bench=new THREE.Group();bench.name='songkran-bench';root.add(bench)
 // Chamfered elder stool with vertical-grain legs, aprons, and lower stretchers grounded cleanly on +0.0175.
 roundedBox('bench-seat',[1.04,.08,.64],[0,.56,-.46],wood,bench,.016)
 const legH=.53-GROUND_Y
 for(const x of[-.40,.40])for(const z of[-.68,-.24])roundedBox('bench-leg-'+x+'-'+z,[.09,legH,.09],[x,GROUND_Y+legH/2,z],legWood,bench,.014)
 roundedBox('bench-apron-front',[.76,.07,.045],[0,.485,-.24],wood,bench,.010)
 roundedBox('bench-apron-back',[.76,.07,.045],[0,.485,-.68],wood,bench,.010)
 roundedBox('bench-side-apron-left',[.045,.07,.40],[-.40,.485,-.46],sideWood,bench,.010)
 roundedBox('bench-side-apron-right',[.045,.07,.40],[.40,.485,-.46],sideWood,bench,.010)
 roundedBox('bench-side-stretcher-left',[.048,.046,.42],[-.40,.175,-.46],sideWood,bench,.010)
 roundedBox('bench-side-stretcher-right',[.048,.046,.42],[.40,.175,-.46],sideWood,bench,.010)
 roundedBox('bench-stretcher',[.80,.044,.048],[0,.175,-.46],wood,bench,.010)

 // Loop-subdivided warm storybook seated Thai elder & gently cupped receiving hands.
 const elder=new THREE.Group();elder.name='songkran-elder';root.add(elder)
 const addElderPart=(name:string,g:THREE.BufferGeometry,m:THREE.Material,role:'skin'|'garment'|'hair')=>{
  const o=make(name,g,m,elder)
  applyStylizedHumanSurfaceHint(o,role)
  return o
 }

 const torsoMesh=addElderPart('torso',createStylizedTorsoGeometry({
  shoulderWidth:.60,
  waistWidth:.50,
  hemWidth:.57,
  depth:.37,
  height:.60,
  collarStyle:'mandarin',
  foldDepth:.011,
  radialSegments:12,
  iterations:1,
 }),shirt,'garment')
 torsoMesh.position.set(0,.64,-.46)

 const hipsMesh=addElderPart('hips',createStylizedTorsoGeometry({
  shoulderWidth:.52,
  waistWidth:.56,
  hemWidth:.59,
  depth:.42,
  height:.19,
  collarStyle:'round',
  foldDepth:.008,
  radialSegments:10,
  iterations:1,
 }),pants,'garment')
 hipsMesh.position.set(0,.595,-.42)

 const thighGeo=createStylizedLimbGeometry({length:.47,topRadius:.112,bottomRadius:.092,depthRatio:1.05,bend:.05,foldDepth:.006,radialSegments:8,iterations:1})
 const shinGeo=createStylizedLimbGeometry({length:.57,topRadius:.094,bottomRadius:.072,depthRatio:1.04,bend:.06,foldDepth:.006,radialSegments:8,iterations:1})
 const shoeGeo=createStylizedShoeGeometry({length:.30,width:.162,height:.112,toeLift:.010,radialSegments:8,iterations:1})
 const sleeveGeo=createStylizedSleeveCuffGeometry({
  length:.40,
  cuffRadiusX:.084,
  cuffRadiusY:.078,
  sleeveRadiusX:.118,
  sleeveRadiusY:.110,
  wallThickness:.014,
  rolledLip:.009,
  foldDepth:.006,
  radialSegments:10,
  iterations:1,
 })
 const forearmGeo=createStylizedForearmGeometry({
  length:.50,
  wristRadiusX:.048,
  wristRadiusY:.042,
  elbowRadiusX:.062,
  elbowRadiusY:.056,
  fullness:.08,
  radialSegments:8,
  iterations:1,
 })

 const negY=V(0,-1,0),posZ=V(0,0,1)
 for(const side of[-1,1] as const){
  const x=side*.185
  const hipPt=V(x,.70,-.43),kneePt=V(x,.68,.045),anklePt=V(x,.10,.05)
  const thigh=addElderPart('thigh-'+side,side===-1?thighGeo:thighGeo.clone(),pants,'garment')
  thigh.position.copy(hipPt)
  thigh.quaternion.setFromUnitVectors(negY,kneePt.clone().sub(hipPt).normalize())

  const shin=addElderPart('shin-'+side,side===-1?shinGeo:shinGeo.clone(),pants,'garment')
  shin.position.copy(kneePt)
  shin.quaternion.setFromUnitVectors(negY,anklePt.clone().sub(kneePt).normalize())

  // Shoe geometry is seated cleanly at local min.y === 0 -> world min.y === GROUND_Y (0.0175).
  const shoe=addElderPart('shoe-'+side,side===-1?shoeGeo:shoeGeo.clone(),shoeMat,'garment')
  shoe.position.set(x,GROUND_Y,.085)

  const shoulderPt=V(side*.25,1.08,-.42),elbowPt=V(side*.36,.89,-.11),wristPt=V(side*.105,.916,.315)
  const sleeve=addElderPart('sleeve-'+side,side===-1?sleeveGeo:sleeveGeo.clone(),shirt,'garment')
  sleeve.position.copy(elbowPt)
  sleeve.quaternion.setFromUnitVectors(posZ,shoulderPt.clone().sub(elbowPt).normalize())

  const forearm=addElderPart('forearm-'+side,side===-1?forearmGeo:forearmGeo.clone(),skin,'skin')
  forearm.position.copy(wristPt)
  forearm.quaternion.setFromUnitVectors(posZ,elbowPt.clone().sub(wristPt).normalize())
 }

 const neck=addElderPart('neck',createStylizedLimbGeometry({
  length:.14,
  topRadius:.082,
  bottomRadius:.092,
  depthRatio:1.0,
  bend:0,
  foldDepth:.001,
  radialSegments:8,
  iterations:1,
 }),skin,'skin')
 neck.position.set(0,1.32,-.46)

 const head=addElderPart('head',createStylizedHeadGeometry({
  width:.41,
  height:.46,
  depth:.39,
  cheekFullness:.14,
  noseProminence:.52,
  chinTaper:.20,
  radialSegments:12,
  iterations:1,
 }),skin,'skin')
 head.position.set(0,1.44,-.46)

 // Closed sculpted silver elder coiffure with neat low bun.
 const scalp=addElderPart('hair',createStylizedHairGeometry({
  style:'bun',
  headWidth:.41,
  headHeight:.46,
  headDepth:.39,
  volume:.024,
  radialSegments:12,
  iterations:1,
 }),hair,'hair')
 scalp.position.set(0,1.44,-.46)

 const earGeo=createElderEarGeometry()
 const headPos=V(0,1.44,-.46)
 for(const side of[-1,1] as const){
  const ear=addElderPart('ear-'+side,side===-1?earGeo:earGeo.clone(),skin,'skin')
  ear.position.set(side*.205,1.425,-.46)
  const eye=addElderPart('eye-'+side,createFacialArcGeometry([
   V(side*.048,1.452,-.273),
   V(side*.072,1.460,-.267),
   V(side*.096,1.450,-.276),
  ],.0068,head,headPos),featureMat,'hair')
  eye.castShadow=false
  const brow=addElderPart('brow-'+side,createFacialArcGeometry([
   V(side*.042,1.490,-.274),
   V(side*.072,1.498,-.270),
   V(side*.102,1.488,-.280),
  ],.0085,head,headPos),browMat,'hair')
  brow.castShadow=false
 }
 const smile=addElderPart('smile',createFacialArcGeometry([
  V(-.038,1.356,-.276),
  V(0,1.344,-.269),
  V(.038,1.356,-.276),
 ],.0068,head,headPos),featureMat,'hair')
 smile.castShadow=false

 // Joined cupped palms facing upward (+Y) with gentle forward fingers over the catch basin.
 const hands:THREE.Mesh[]=[]
 const fingerLengths=[.112,.130,.126,.102]
 const fingerRadii=[.0205,.0215,.0208,.0185]
 for(const side of[-1,1] as const){
  const x=side*.093
  const palm=addElderPart('palm-'+side,createStylizedPalmGeometry({
   width:.210,
   thickness:.068,
   length:.245,
   handedness:side===-1?'right':'left',
   palmUp:true,
   arch:.007,
   radialSegments:10,
   iterations:1,
  }),skin,'skin')
  palm.position.set(x,.922,.425)
  palm.rotation.y=Math.PI
  hands.push(palm)

  for(let i=0;i<4;i++){
   const fx=x+(i-1.5)*.042
   // Mirror anatomical length ordering across left/right hands so middle/ring fingers sit longest.
   const anatIdx=side===-1?3-i:i
   const finger=addElderPart('finger-'+side+'-'+i,createStylizedFingerGeometry({
    length:fingerLengths[anatIdx]!,
    radiusX:fingerRadii[anatIdx]!,
    radiusY:fingerRadii[anatIdx]!*.92,
    curl:.09,
    curlUp:true,
    splay:0,
    lengthSegments:2,
    radialSegments:6,
    iterations:1,
   }),skin,'skin')
   finger.position.set(fx,.924,.505)
   finger.rotation.y=Math.PI
   hands.push(finger)
  }

  const thumb=addElderPart('thumb-'+side,createStylizedThumbGeometry({
   length:.112,
   radiusX:.024,
   radiusY:.022,
   curl:.14,
   curlUp:true,
   opposition:side*.012,
   iterations:1,
  }),skin,'skin')
  thumb.position.set(x+side*.086,.920,.385)
  thumb.rotation.y=Math.PI-side*.34
  hands.push(thumb)
 }

 // Seat the catch basin and chamfered stone water-bowl pedestal cleanly onto the courtyard flagstones (+0.0175).
 const basin=make('basin',vessel([[0,0],[.40,0],[.46,.025],[.50,.18],[.474,.18],[.438,.035],[.39,.024],[0,.024]]),metal);basin.position.set(0,GROUND_Y,.80)
 const padProfile=[[0,GROUND_Y],[.308,GROUND_Y],[.322,GROUND_Y+.0065],[.322,GROUND_Y+.014],[.304,GROUND_Y+.021],[.308,.052],[.294,.060],[0,.060]]
 const padGeo=new THREE.LatheGeometry(padProfile.map(([r,y])=>new THREE.Vector2(r!,y!)),48);padGeo.computeVertexNormals()
 const pad=make('pad',padGeo,stone);pad.position.set(-.80,0,.60)
 const cup=new THREE.Group();cup.name='songkran-cup-root';root.add(cup)
 const bowl=make('bowl',vessel([[0,0],[.12,0],[.155,.018],[.26,.18],[.244,.18],[.138,.026],[.115,.018],[0,.018]]),metal,cup)
 const home=V(-.80,.06,.60),lifted=V(-.80,.74,.60),ready=V(-.38,1.15,.425)

 const waterMaterial=createRitualMaterial({color:0x93d8e6,transparent:true,opacity:.64,roughness:.14,metalness:0,side:THREE.DoubleSide,depthWrite:false},{kind:'water',strength:.34})
 const bowlSurface=createBowlSurfaceMaterial()
 const waterGeometry=new THREE.BufferGeometry();waterGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(256*9),3));waterGeometry.setDrawRange(0,0)
 const water=make('water-surface',waterGeometry,bowlSurface.material);water.userData.effect=true;water.castShadow=false

 // Spring-pendulum slosh physics engine tracking the silver bowl (drives GPU slosh shader without mutating CPU vertices).
 const bowlSlosh=createVesselLiquid({
  preset:'clear-water',
  radius:.20,
  radialSegments:6,
  angularSegments:16,
  deformMode:'gpu',
  name:'songkran-bowl-slosh-sim',
 })
 bowlSlosh.trackContainer(cup)

 // Catch basin water upgraded to GPU-deformed vessel-liquid with capillary meniscus & concentric drip ripples.
 const caughtLiquid=createVesselLiquid({
  preset:'clear-water',
  radius:.422,
  radialSegments:16,
  angularSegments:48,
  deformMode:'gpu',
  color:0x86d4df,
  edgeColor:0xdcf8f5,
  deepColor:0x3f8f9e,
  foamColor:0xfff8eb,
  foamStrength:.09,
  opacity:.66,
  roughness:.12,
  meniscusHeight:.009,
  maxAmplitude:.018,
  name:'songkran-caught-water',
 })
 const caught=caughtLiquid.mesh
 caught.position.set(0,GROUND_Y+.027,.80)
 caught.userData.effect=true
 caught.castShadow=false
 root.add(caught)

 // Gravity-tapered living pour stream & fingertip runoff stream with Rayleigh-Plateau shimmer & splash crowns.
 const pourStream=createLivingPourStream({
  preset:'clear-water',
  topRadius:.0078,
  bottomRadius:.0048,
  segments:14,
  radialSegments:10,
  arcForward:.14,
  showSplashCrown:true,
  splashRadius:.020,
  color:0x90d9e6,
  opacity:.72,
  roughness:.12,
  name:'songkran-pour-stream',
 })
 const stream=pourStream.mesh
 stream.userData.effect=true
 pourStream.splashCrown.userData.effect=true
 root.add(pourStream.root)

 const runoffStream=createLivingPourStream({
  preset:'clear-water',
  topRadius:.0048,
  bottomRadius:.0030,
  segments:12,
  radialSegments:8,
  arcForward:.06,
  showSplashCrown:true,
  splashRadius:.028,
  color:0x90d9e6,
  opacity:.68,
  roughness:.12,
  name:'songkran-runoff',
 })
 const runoff=runoffStream.mesh
 runoff.userData.effect=true
 runoffStream.splashCrown.userData.effect=true
 root.add(runoffStream.root)

 const resetLiving=(handle:LivingPourStreamHandle)=>{
  handle.reset()
  handle.splashCrown.position.set(0,0,0)
  const pos=handle.mesh.geometry.getAttribute('position') as THREE.BufferAttribute
  pos.array.fill(0)
  pos.needsUpdate=true
 }
 resetLiving(pourStream)
 resetLiving(runoffStream)

 const lipGeometry=createPouringLipGeometry()
 const lipFlow=make('lip-flow',lipGeometry,waterMaterial,cup);lipFlow.userData.effect=true;lipFlow.castShadow=false
 const handFlowGeometry=new THREE.BufferGeometry();handFlowGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(256*18),3));handFlowGeometry.setDrawRange(0,0)
 const handFlow=make('hand-flow',handFlowGeometry,waterMaterial);handFlow.userData.effect=true;handFlow.castShadow=false
 const streamStart=V(0,0,0),streamEnd=V(0,0,0),runoffStart=V(0,0,0),runoffEnd=V(0,0,0)
 let liquidClock=0,basinRippleTimer=.11

 // Intersect the hollow bowl's inner truncated cone with a WORLD-horizontal water plane.
 // All polygon vertices stay on the interior; the level never rises above the low rim while pouring.
 function liquid(fill:number){
  cup.updateMatrixWorld(true);const rings=[{y:.026,r:.138},{y:.18,r:.244}].map(({y,r})=>Array.from({length:48},(_,i)=>V(Math.cos(i/48*Math.PI*2)*r,y,Math.sin(i/48*Math.PI*2)*r).applyMatrix4(cup.matrixWorld)))
  const low=Math.min(...rings[1]!.map(p=>p.y)),level=Math.min(cup.position.y+(.12-fill*.065)*Math.cos(cup.rotation.z),low),points:THREE.Vector3[]=[]
  const add=(p:THREE.Vector3)=>{if(!points.some(q=>q.distanceToSquared(p)<1e-16))points.push(p)}
  const edge=(a:THREE.Vector3,b:THREE.Vector3)=>{if(Math.abs(a.y-level)<1e-9)add(a.clone());if(Math.abs(b.y-level)<1e-9)add(b.clone());if((a.y-level)*(b.y-level)<0)add(a.clone().lerp(b,(level-a.y)/(b.y-a.y)))}
  for(let i=0;i<48;i++){const j=(i+1)%48;edge(rings[0]![i]!,rings[1]![i]!);edge(rings[0]![i]!,rings[0]![j]!);edge(rings[1]![i]!,rings[1]![j]!)}
  const center=points.reduce((sum,p)=>sum.add(p),V(0,0,0)).divideScalar(Math.max(1,points.length));points.sort((a,b)=>Math.atan2(a.z-center.z,a.x-center.x)-Math.atan2(b.z-center.z,b.x-center.x))
  const pos=waterGeometry.getAttribute('position');pos.array.fill(0);let n=0
  for(let i=0;i<points.length;i++)for(const p of[center,points[(i+1)%points.length]!,points[i]!]){pos.setXYZ(n++,p.x,p.y,p.z)}
  waterGeometry.setDrawRange(0,n);pos.needsUpdate=true;waterGeometry.computeVertexNormals();waterGeometry.computeBoundingSphere();water.visible=n>0
 }
 function pose(checkpoint:number,amount:number,effects=true){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0,effects);return}
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1);cup.position.copy(home);cup.rotation.set(0,0,0);lipFlow.visible=handFlow.visible=false
  resetLiving(pourStream)
  resetLiving(runoffStream)
  for(const p of[streamStart,streamEnd,runoffStart,runoffEnd])p.set(0,0,0)
  const flowPos=handFlowGeometry.getAttribute('position');flowPos.array.fill(0);flowPos.needsUpdate=true;handFlowGeometry.setDrawRange(0,0)
  let fill=checkpoint>=3?1:0
  let pouringNow=false
  if(checkpoint===0)cup.position.lerp(lifted,t)
  if(checkpoint===1)cup.position.copy(lifted).lerp(ready,t)
  if(checkpoint===2){
   cup.position.copy(ready)
   if(t<=.72){const tilt=smooth(t/.24)*(1-smooth((t-.58)/.14));cup.rotation.z=-.75*tilt;cup.position.x+=.16*smooth((t-.24)/.34);fill=smooth((t-.20)/.42)}
   else{fill=1;const u=(t-.72)/.28;if(u<.55)cup.position.copy(ready).add(V(.16,0,0)).lerp(lifted,u/.55);else cup.position.copy(lifted).lerp(home,(u-.55)/.45)}
   pouringNow=t>.22&&t<.60&&cup.rotation.z<-.55
  }
  root.updateMatrixWorld(true);if(!effects)return
  liquid(fill);caught.position.y=GROUND_Y+.027+fill*.026
  if(pouringNow){
   // Water crosses the low lip on a thin surface sheet before falling onto the elder's palms.
   lipFlow.visible=true;streamStart.copy(V(.28,.1801,0).applyMatrix4(cup.matrixWorld));
   const ray=new THREE.Raycaster(streamStart,V(0,-1,0));const hit=ray.intersectObjects(hands,false)[0]
   if(hit){
    streamEnd.copy(hit.point)
    pourStream.updateArc(streamStart,streamEnd,1,0,true)
    pourStream.splashCrown.visible=false
    const path=[hit.point.clone().add(V(0,.004,0))]
    // Follow one actual finger from the palm, rather than falling through the gap between fingers.
    const palmSide=hit.object.name==='songkran-palm--1'?-1:1
    const fingerIndex=THREE.MathUtils.clamp(Math.round((hit.point.x-palmSide*.093)/.042+1.5),0,3),fingerX=palmSide*.093+(fingerIndex-1.5)*.042
    for(let z=hit.point.z+.002;z<.67;z+=.002){const x=THREE.MathUtils.lerp(hit.point.x,fingerX,smooth((z-hit.point.z)/.075)),p=new THREE.Raycaster(V(x,1.1,z),V(0,-1,0)).intersectObjects(hands,false)[0];if(!p)break;path.push(p.point.clone().add(V(0,.004,0)))}
    runoffStart.copy(path[path.length-1]!).add(V(0,0,.006));path.push(runoffStart.clone())
    const side=(p:THREE.Vector3,dx:number)=>{const q=p.clone().add(V(dx,0,0)),h=new THREE.Raycaster(V(q.x,1.1,q.z),V(0,-1,0)).intersectObjects(hands,false)[0];if(h)q.y=Math.max(q.y,h.point.y+.004);return q}
    const edges=path.map((p,idx)=>{
     const u=path.length>1?idx/(path.length-1):1
     const hw=THREE.MathUtils.lerp(.0075,.0024,smooth(u))
     return [side(p,-hw),side(p,hw)]
    });let n=0
    const last=edges[edges.length-1]!;runoffStart.copy(last[0]!).lerp(last[1]!,.5);runoffEnd.set(runoffStart.x,caught.position.y,runoffStart.z)
    runoffStream.updateArc(runoffStart,runoffEnd,1,0,true)
    runoffStream.splashCrown.visible=false
    for(let i=1;i<edges.length;i++){const a=edges[i-1]!,b=edges[i]!;for(const p of[a[0]!,b[0]!,b[1]!,a[0]!,b[1]!,a[1]!])flowPos.setXYZ(n++,p.x,p.y,p.z)}
    handFlowGeometry.setDrawRange(0,n);handFlowGeometry.computeVertexNormals();handFlowGeometry.computeBoundingSphere();handFlow.visible=true
   }else{resetLiving(pourStream);resetLiving(runoffStream);lipFlow.visible=false}
  }
  if(t===0)bowlSlosh.reset()
  root.updateMatrixWorld(true)
 }
 function updateLiquid(dt:number,reduced=false){
  const stepDt=Number.isFinite(dt)&&dt>0?Math.min(dt,.05):0
  if(!reduced)liquidClock+=stepDt
  bowlSlosh.update(stepDt,liquidClock,reduced)
  bowlSurface.uniforms.wbrSongTime.value=liquidClock
  bowlSurface.uniforms.wbrSongSlosh.value.set(bowlSlosh.state.sloshX,bowlSlosh.state.sloshZ)
  bowlSurface.uniforms.wbrSongReduced.value=reduced?1:0
  caughtLiquid.update(stepDt,liquidClock,reduced)
  if(stream.visible){
   pourStream.updateArc(streamStart,streamEnd,1,liquidClock,reduced)
   if(reduced)pourStream.splashCrown.visible=false
  }
  if(runoff.visible){
   runoffStream.updateArc(runoffStart,runoffEnd,1,liquidClock,reduced)
   if(reduced){
    runoffStream.splashCrown.visible=false
   }else if(stepDt>0){
    basinRippleTimer+=stepDt
    if(basinRippleTimer>=.11){
     basinRippleTimer=0
     caughtLiquid.triggerRipple(runoffEnd.x,runoffEnd.z-.80,1.15)
    }
   }
  }else{
   basinRippleTimer=.11
  }
 }
 function disposeLiquid(){
  bowlSlosh.dispose()
  caughtLiquid.dispose()
  pourStream.dispose()
  runoffStream.dispose()
 }
 pose(0,0)
 return{
  refreshHeldWater:()=>{root.updateMatrixWorld(true);liquid(0);bowlSlosh.addTiltImpulse(.9,.5);root.updateMatrixWorld(true)},
  root,
  elder,
  head,
  hands,
  bench,
  basin,
  pad,
  cup,
  bowl,
  water,
  caught,
  caughtLiquid,
  bowlSlosh,
  pourStream,
  runoffStream,
  stream,
  runoff,
  lipFlow,
  handFlow,
  streamStart,
  streamEnd,
  runoffStart,
  runoffEnd,
  home,
  lifted,
  ready,
  pose,
  tick:(dt:number)=>updateLiquid(dt,false),
  updateLiquid,
  disposeLiquid,
  targets:[bowl,bowl,bowl],
  roots:[cup,cup,cup],
  anchors:[V(0,.018,0),V(0,.018,0),V(0,.018,0)],
 }
}
