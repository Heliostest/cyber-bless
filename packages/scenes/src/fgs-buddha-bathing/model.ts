import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import {
  applyRobeDraperyFolds,
  applyStylizedHumanSurfaceHint,
  createStylizedFingerGeometry,
  createStylizedHairGeometry,
  createStylizedHeadGeometry,
  createStylizedLimbGeometry,
  createStylizedPalmGeometry,
  createStylizedShoeGeometry,
  createStylizedThumbGeometry,
  createStylizedTorsoGeometry,
  subdivideClosedCage,
} from '@wbr/scene-runtime/stylized-human'
import { createLivingPourStream, createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import {
  createBathingFlowerHeartGeometry,
  createBathingPetalGeometry,
  createBathingPetalMaterial,
  createBathingStemMaterial,
} from './flower-detail'

/** Builds a closed Loop-subdivided rounded bronze shoulder cap for reliable pour reception. */
function createSculptedShoulderGeometry(side: -1 | 1): THREE.BufferGeometry {
  const cage = new THREE.SphereGeometry(1, 10, 8)
  const pos = cage.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    let x = pos.getX(i)
    let y = pos.getY(i)
    let z = pos.getZ(i)
    // Gentle anatomical taper: fuller upper-outer deltoid cap tapering softly toward collar & arm.
    const topRound = y > 0 ? 1 + 0.06 * Math.sin(y * Math.PI) : 1 - 0.08 * Math.abs(y)
    const outerReach = x * side > 0 ? 1.08 : 0.96
    x *= 0.112 * outerReach * topRound
    y *= 0.102 * (y > 0 ? 1.04 : 0.94)
    z *= 0.128 * topRound
    pos.setXYZ(i, x, y, z)
  }
  pos.needsUpdate = true
  const geo = subdivideClosedCage(cage, {
    iterations: 1,
    colorGenerator: (_p, n) => {
      const underAO = THREE.MathUtils.smoothstep(-n.y, 0.15, 0.90) * 0.15
      const crownLift = THREE.MathUtils.smoothstep(n.y, 0.35, 0.95) * 0.05
      const shade = THREE.MathUtils.clamp(1 + crownLift - underAO, 0.80, 1.05)
      return [shade * 1.02, shade * 0.99, shade * 0.93]
    },
  })
  cage.dispose()
  return geo
}

/** Builds a closed Loop-subdivided elongated serene earlobe. */
function createSculptedEarGeometry(): THREE.BufferGeometry {
  const cage = new THREE.SphereGeometry(1, 8, 8)
  const pos = cage.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const lobeScale = y < 0 ? 1 - 0.18 * Math.abs(y) : 1 + 0.06 * y
    pos.setXYZ(i, x * 0.025 * lobeScale, y * 0.058, z * 0.032 * lobeScale)
  }
  pos.needsUpdate = true
  const geo = subdivideClosedCage(cage, {
    iterations: 1,
    colorGenerator: (_p, n) => {
      const shade = THREE.MathUtils.clamp(0.96 - Math.max(0, -n.y) * 0.12, 0.82, 1.02)
      return [shade * 1.02, shade * 0.98, shade * 0.92]
    },
  })
  cage.dispose()
  return geo
}

/** Builds a closed Loop-subdivided soft waist sash ring around the dhoti waistband. */
function createSculptedWaistSashGeometry(): THREE.BufferGeometry {
  const cage = new THREE.TorusGeometry(0.168, 0.026, 8, 18)
  cage.rotateX(Math.PI / 2)
  const pos = cage.getAttribute('position') as THREE.BufferAttribute
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i)
    const y = pos.getY(i)
    const z = pos.getZ(i)
    const ang = Math.atan2(z, x)
    const dip = -0.012 * Math.cos(ang - Math.PI * 0.5)
    const wave = 1 + 0.04 * Math.sin(ang * 4)
    pos.setXYZ(i, x * 1.06 * wave, y + dip, z * 0.78 * wave)
  }
  pos.needsUpdate = true
  const geo = subdivideClosedCage(cage, {
    iterations: 1,
    colorGenerator: (_p, n) => {
      const shade = THREE.MathUtils.clamp(0.98 - Math.max(0, -n.y) * 0.14, 0.80, 1.04)
      return [shade * 1.03, shade * 0.99, shade * 0.91]
    },
  })
  cage.dispose()
  return geo
}

/** Builds a smooth closed curved eyelid or serene smile arc snapped snugly onto the head surface. */
function createSereneArcGeometry(
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
  const tube = new THREE.TubeGeometry(curve, 10, radius, 8, false)
  tube.computeVertexNormals()
  return tube
}

/** Original basin, ladle and infant Buddha composition for FGS's public three-pour example. */
export function createBuddhaBathingModel() {
  const root=new THREE.Group();root.name='bathing-root'
  const subject=new THREE.Group();subject.name='bathing-subject';root.add(subject)
  const mat=(color:number,roughness=.75,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
  const stone=mat(0xc9c5aa),ceramic=mat(0x689b9e,.38),rimMat=mat(0xa8c3b5,.46),gold=mat(0xd6a749,.4,.3),wood=mat(0xae7947)
  // Warm gilded-bronze statue materials supporting Loop-subdivided vertex AO gradients.
  const statueBronze=new THREE.MeshStandardMaterial({color:0xdfb256,roughness:.38,metalness:.30,vertexColors:true})
  const statueRobeMat=new THREE.MeshStandardMaterial({color:0xd29e40,roughness:.44,metalness:.26,vertexColors:true})
  const statueHairMat=new THREE.MeshStandardMaterial({color:0x634a2e,roughness:.68,metalness:.16,vertexColors:true})
  const statueFeatureMat=new THREE.MeshStandardMaterial({color:0x543e26,roughness:.74,metalness:.10})
  const petal=createBathingPetalMaterial(),leaf=createBathingStemMaterial()
  const gripWood=applyCraftSurface(mat(0x846238),{kind:'wood',strength:.4,axis:'y'})
  const restWood=applyCraftSurface(mat(0x9a6b3e,.82),{kind:'wood',strength:.4,axis:'x'})
  ;[ceramic,rimMat].forEach(material=>applyCraftSurface(material,{kind:'ceramic',strength:.45}))
  applyCraftSurface(wood,{kind:'wood',strength:.4,axis:'y'})
  applyCraftSurface(stone,{kind:'stone',strength:.45})
  const waterMat=createRitualMaterial({color:0x82c8cd,transparent:true,opacity:.55,roughness:.16,metalness:0,depthWrite:false},{kind:'water',strength:.35})
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o}
  const ball=(name:string,p:[number,number,number],scale:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.SphereGeometry(1,24,16),m,parent,name);o.position.set(...p);o.scale.set(...scale);return o}
  const rod=(name:string,a:[number,number,number],b:[number,number,number],radius:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),o=mesh(new THREE.CylinderGeometry(radius,radius,d.length(),16),m,parent,name)
    o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o
  }
  const lathe=(name:string,points:[number,number][],m:THREE.Material,parent:THREE.Object3D=subject)=>mesh(new THREE.LatheGeometry(points.map(([x,y])=>new THREE.Vector2(x,y)),64),m,parent,name)
  // Compact chamfered stone curb directly cradling the ceramic basin foot, replacing the oversized plain stone disc.
  lathe('bathing-paving',[[0,-.065],[.84,-.065],[.865,-.048],[.86,-.010],[.835,.018],[.805,.032],[.775,.035],[0,.035]],stone)
  const foot=mesh(new THREE.CylinderGeometry(.65,.68,.14,48),ceramic,subject,'bathing-basin-foot');foot.position.y=.105
  // Closed thick vessel: flat floor, open interior and rounded rim; no solid cylinder filled with water.
  const basin=lathe('bathing-basin',[[0,.175],[.72,.175],[.86,.28],[.94,.58],[.935,.62],[.91,.64],[.88,.62],[.875,.58],[.80,.31],[.69,.235],[0,.235]],ceramic)
  const rim=mesh(new THREE.TorusGeometry(.905,.026,12,64),rimMat,subject,'bathing-basin-rim');rim.rotation.x=Math.PI/2;rim.position.y=.62
  // Chamfered wooden ladle rest seated on the basin rim beneath the resting ladle handle (clear of grip cue anchor).
  const ladleRest=new THREE.Group();ladleRest.name='bathing-ladle-rest';subject.add(ladleRest)
  const restBase=mesh(new RoundedBoxGeometry(.14,.106,.095,2,.014),restWood,ladleRest,'bathing-ladle-rest-base')
  restBase.position.set(-.48,.673,.767)
  for(const side of[-1,1]as const){
    const cheek=mesh(new RoundedBoxGeometry(.032,.042,.092,2,.008),restWood,ladleRest,`bathing-ladle-rest-cheek-${side}`)
    cheek.position.set(-.48+side*.052,.736,.767)
  }

  // Fragrant flower-basin water upgraded to GPU-deformed vessel-liquid with capillary meniscus,
  // concentric pour ripples, and warm daylight caustic shimmer (CPU positions stay deterministic).
  const basinLiquid=createVesselLiquid({
    preset:'clear-water',
    radius:.846,
    radialSegments:16,
    angularSegments:48,
    deformMode:'gpu',
    color:0x7fd0d4,
    edgeColor:0xd6f7f1,
    deepColor:0x3b8c94,
    foamColor:0xfff8ea,
    foamStrength:.08,
    opacity:.62,
    roughness:.12,
    meniscusHeight:.015,
    maxAmplitude:.026,
    name:'bathing-water',
  })
  const surface=basinLiquid.mesh
  surface.position.y=.48
  subject.add(surface)

  const lotus=mesh(new THREE.CylinderGeometry(.23,.28,.10,48),gold,subject,'bathing-lotus-core');lotus.position.y=.65
  const pillar=mesh(new THREE.CylinderGeometry(.18,.21,.365,32),gold,subject,'bathing-lotus-support');pillar.position.y=.4175
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,p=ball('bathing-lotus-petal-'+i,[Math.sin(a)*.20,.65,Math.cos(a)*.20],[.10,.07,.16],gold);p.rotation.y=a}

  // Stylized warm gilt-bronze Prince Siddhartha standing infant statue via Loop subdivision.
  const statue=new THREE.Group();statue.name='bathing-statue';subject.add(statue)
  const addStatueMesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,role:'statue'|'hair'='statue')=>{
    const o=mesh(g,m,statue,name)
    applyStylizedHumanSurfaceHint(o,role)
    return o
  }
  const footGeo=createStylizedShoeGeometry({length:.182,width:.102,height:.056,toeLift:.005,radialSegments:8,iterations:1})
  const legGeo=createStylizedLimbGeometry({length:.28,topRadius:.068,bottomRadius:.048,depthRatio:1.04,bend:.05,foldDepth:.002,radialSegments:8,iterations:1})
  for(const [i,x] of [-.082,.082].entries()){
    const f=addStatueMesh('bathing-foot-'+i,i===0?footGeo:footGeo.clone(),statueBronze)
    f.position.set(x,.70,.015)
    f.rotation.y=(i===0?-.07:.07)
    const leg=addStatueMesh('bathing-leg-'+i,i===0?legGeo:legGeo.clone(),statueBronze)
    leg.position.set(x,.985,.002)
  }

  // Softly pleated lower dhoti robe + waist sash.
  const robeGeo=applyRobeDraperyFolds(
    createStylizedTorsoGeometry({
      shoulderWidth:.33,
      waistWidth:.35,
      hemWidth:.40,
      depth:.265,
      height:.31,
      collarStyle:'robe',
      foldDepth:.010,
      radialSegments:12,
      iterations:1,
    }),
    {amplitude:.009,frequency:8,diagonalTwist:.65,valleyAO:.18},
  )
  const robeMesh=addStatueMesh('bathing-robe',robeGeo,statueRobeMat)
  robeMesh.position.set(0,.855,0)

  const sashMesh=addStatueMesh('bathing-sash',createSculptedWaistSashGeometry(),statueRobeMat)
  sashMesh.position.set(0,1.095,0)

  const torsoGeo=createStylizedTorsoGeometry({
    shoulderWidth:.42,
    waistWidth:.32,
    hemWidth:.34,
    depth:.265,
    height:.36,
    collarStyle:'round',
    foldDepth:.003,
    radialSegments:12,
    iterations:1,
  })
  const torsoMesh=addStatueMesh('bathing-torso',torsoGeo,statueBronze)
  torsoMesh.position.set(0,1.04,0)

  // Sculpted bronze shoulder caps positioned cleanly for exact downward pour Raycaster hits.
  const shoulders=([-1,1] as const).map((sign,i)=>{
    const sh=addStatueMesh('bathing-shoulder-'+i,createSculptedShoulderGeometry(sign),statueBronze)
    sh.position.set(sign*.245,1.31,.03)
    return sh
  })

  const neckGeo=createStylizedLimbGeometry({length:.13,topRadius:.066,bottomRadius:.075,depthRatio:1.0,bend:0,foldDepth:.001,radialSegments:8,iterations:1})
  const neckMesh=addStatueMesh('bathing-neck',neckGeo,statueBronze)
  neckMesh.position.set(0,1.48,-.004)

  const headGeo=createStylizedHeadGeometry({
    width:.305,
    height:.37,
    depth:.285,
    cheekFullness:.22,
    noseProminence:.50,
    chinTaper:.16,
    radialSegments:12,
    iterations:1,
  })
  const headMesh=addStatueMesh('bathing-head',headGeo,statueBronze)
  headMesh.position.set(0,1.59,-.005)

  const hairGeo=createStylizedHairGeometry({
    style:'topknot',
    headWidth:.305,
    headHeight:.37,
    headDepth:.285,
    volume:.020,
    radialSegments:12,
    iterations:1,
  })
  const hairMesh=addStatueMesh('bathing-hair',hairGeo,statueHairMat,'hair')
  hairMesh.position.set(0,1.59,-.005)

  const topknotCage=new THREE.SphereGeometry(1,8,8)
  topknotCage.scale(.056,.042,.056)
  const topknotGeo=subdivideClosedCage(topknotCage,{
    iterations:1,
    colorGenerator:(_p,n)=>{
      const lift=THREE.MathUtils.smoothstep(n.y,0,1)*.08
      const s=THREE.MathUtils.clamp(.95+lift,.84,1.06)
      return [s,s*.98,s*.95]
    },
  })
  topknotCage.dispose()
  const topknotMesh=addStatueMesh('bathing-topknot',topknotGeo,statueHairMat,'hair')
  topknotMesh.position.set(0,1.832,-.012)

  const earGeo=createSculptedEarGeometry()
  for(const [i,x] of [-.154,.154].entries()){
    const ear=addStatueMesh('bathing-ear-'+i,i===0?earGeo:earGeo.clone(),statueBronze)
    ear.position.set(x,1.58,-.008)
  }
  const headPos=new THREE.Vector3(0,1.59,-.005)
  for(const [i,x] of [-.056,.056].entries()){
    const eye=mesh(
      createSereneArcGeometry([
        new THREE.Vector3(x-.021,1.612,.132),
        new THREE.Vector3(x,1.604,.141),
        new THREE.Vector3(x+.021,1.612,.132),
      ],.0052,headMesh,headPos),
      statueFeatureMat,
      statue,
      'bathing-eye-'+i,
    )
    applyStylizedHumanSurfaceHint(eye,'hair')
  }
  const mouth=mesh(
    createSereneArcGeometry([
      new THREE.Vector3(-.026,1.515,.127),
      new THREE.Vector3(0,1.508,.134),
      new THREE.Vector3(.026,1.515,.127),
    ],.0046,headMesh,headPos),
    statueFeatureMat,
    statue,
    'bathing-mouth',
  )
  applyStylizedHumanSurfaceHint(mouth,'hair')

  // The source specifies one finger to the sky and the other to the ground, not a handedness rule.
  const upArmGeo=createStylizedLimbGeometry({length:.36,topRadius:.048,bottomRadius:.038,depthRatio:1.02,bend:.06,foldDepth:.001,radialSegments:8,iterations:1})
  const upArm=addStatueMesh('bathing-up-arm',upArmGeo,statueBronze)
  upArm.position.set(-.235,1.70,.015)
  upArm.rotation.x=-.04

  const upPalmGeo=createStylizedPalmGeometry({width:.088,thickness:.042,length:.102,handedness:'right',palmUp:true,iterations:1})
  const upHand=addStatueMesh('bathing-up-hand',upPalmGeo,statueBronze)
  upHand.position.set(-.235,1.752,.016)
  upHand.rotation.x=Math.PI/2

  const upFingerGeo=createStylizedFingerGeometry({length:.142,radiusX:.015,radiusY:.014,curl:.05,curlUp:false,iterations:1})
  const upFinger=addStatueMesh('bathing-up-finger',upFingerGeo,statueBronze)
  upFinger.position.set(-.218,1.792,.018)
  upFinger.rotation.x=Math.PI/2

  const upCurlGeo=createStylizedFingerGeometry({length:.072,radiusX:.013,radiusY:.012,curl:.85,curlUp:true,lengthSegments:2,iterations:1})
  for(let k=0;k<3;k++){
    const cf=addStatueMesh(`bathing-up-curl-${k}`,k===0?upCurlGeo:upCurlGeo.clone(),statueBronze)
    cf.position.set(-.237-k*.015,1.778-k*.004,.026)
    cf.rotation.set(Math.PI*.72,0,0)
  }
  const upThumbGeo=createStylizedThumbGeometry({length:.068,radiusX:.015,radiusY:.014,curl:.62,curlUp:true,opposition:.012,iterations:1})
  const upThumb=addStatueMesh('bathing-up-thumb',upThumbGeo,statueBronze)
  upThumb.position.set(-.202,1.748,.030)
  upThumb.rotation.set(Math.PI*.48,-.45,.25)

  const downArmGeo=createStylizedLimbGeometry({length:.24,topRadius:.050,bottomRadius:.039,depthRatio:1.02,bend:.08,foldDepth:.001,radialSegments:8,iterations:1})
  const downArm=addStatueMesh('bathing-down-arm',downArmGeo,statueBronze)
  downArm.position.set(.262,1.29,.03)
  downArm.rotation.z=.18

  const downPalmGeo=createStylizedPalmGeometry({width:.086,thickness:.040,length:.098,handedness:'left',palmUp:false,iterations:1})
  const downHand=addStatueMesh('bathing-down-hand',downPalmGeo,statueBronze)
  downHand.position.set(.312,1.022,.03)
  downHand.rotation.set(-Math.PI/2,0,.12)

  const downFingerGeo=createStylizedFingerGeometry({length:.105,radiusX:.015,radiusY:.014,curl:.06,curlUp:false,iterations:1})
  const downFinger=addStatueMesh('bathing-down-finger',downFingerGeo,statueBronze)
  downFinger.position.set(.316,.982,.03)
  downFinger.rotation.set(-Math.PI/2,0,.08)

  const downCurlGeo=createStylizedFingerGeometry({length:.066,radiusX:.013,radiusY:.012,curl:.82,curlUp:true,lengthSegments:2,iterations:1})
  for(let k=0;k<3;k++){
    const cf=addStatueMesh(`bathing-down-curl-${k}`,k===0?downCurlGeo:downCurlGeo.clone(),statueBronze)
    cf.position.set(.304+k*.014,.996-k*.003,.038)
    cf.rotation.set(-Math.PI*.72,0,.08)
  }
  const downThumbGeo=createStylizedThumbGeometry({length:.064,radiusX:.015,radiusY:.014,curl:.55,curlUp:true,opposition:-.012,iterations:1})
  const downThumb=addStatueMesh('bathing-down-thumb',downThumbGeo,statueBronze)
  downThumb.position.set(.284,1.025,.042)
  downThumb.rotation.set(-Math.PI*.48,.42,-.20)

  // A small flower border sits grounded in the courtyard outside the stone curb and the moving ladle path.
  const flowerPetalGeo=createBathingPetalGeometry()
  const flowerHeartGeo=createBathingFlowerHeartGeometry()
  for(const [i,x,z] of [[0,-.84,-.59],[1,.78,-.68],[2,.30,-1.02]]){
    const stem=rod('bathing-flower-stem-'+i,[x!,-.055,z!],[x!,.25,z!],.016,leaf)
    for(let j=0;j<5;j++){const a=j/5*Math.PI*2+i!*.35;const p=mesh(flowerPetalGeo,petal,subject,'bathing-flower-'+i+'-'+j);p.position.set(x!,.245,z!);p.rotation.y=a}
    const heart=mesh(flowerHeartGeo,petal,subject,'bathing-flower-heart-'+i);heart.position.set(x!,.266,z!)
    stem.userData.support='paving'
  }

  const ladle=new THREE.Group();ladle.name='bathing-ladle-root';subject.add(ladle)
  const cup=lathe('bathing-ladle-cup',[[0,-.105],[.055,-.092],[.10,-.060],[.132,-.012],[.14,0],[.128,.006],[.118,-.010],[.09,-.05],[.045,-.079],[0,-.087]],wood,ladle)
  rod('bathing-handle',[0,-.008,.123],[0,.55,.65],.024,wood,ladle)
  const grip=rod('bathing-grip',[0,.30648,.42],[0,.55,.65],.032,gripWood,ladle)

  // Ladle cup water upgraded to GPU-deformed vessel-liquid tracking ladle tilt/motion for realistic damped slosh.
  const ladleLiquid=createVesselLiquid({
    preset:'clear-water',
    radius:.105,
    radialSegments:10,
    angularSegments:32,
    deformMode:'gpu',
    color:0x86d5da,
    edgeColor:0xd9f8f2,
    deepColor:0x459aa1,
    foamColor:0xfff8ec,
    foamStrength:.06,
    opacity:.66,
    roughness:.12,
    meniscusHeight:.0045,
    maxAmplitude:.022,
    name:'bathing-ladle-water',
  })
  const ladleWater=ladleLiquid.mesh
  ladleWater.position.y=-.028
  ladle.add(ladleWater)
  ladleLiquid.trackContainer(ladle)

  // Inner tapered water core retains exact endpoint matrixWorld contract for Raycaster tests;
  // paired with livingStream for Rayleigh-Plateau pulsating sheath & shoulder splash crown.
  const stream=mesh(new THREE.CylinderGeometry(.006,.0095,1,12),waterMat,subject,'bathing-stream');stream.visible=false
  const livingStream=createLivingPourStream({
    preset:'clear-water',
    topRadius:.014,
    bottomRadius:.009,
    segments:14,
    radialSegments:10,
    arcForward:0,
    showSplashCrown:true,
    splashRadius:.042,
    color:0x88d7dd,
    opacity:.66,
    roughness:.12,
    name:'bathing-living-stream',
  })
  subject.add(livingStream.root)
  const resetLivingStream=()=>{
    livingStream.reset()
    livingStream.splashCrown.position.set(0,0,0)
    ;(livingStream.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).array.fill(0)
    ;(livingStream.mesh.geometry.getAttribute('position') as THREE.BufferAttribute).needsUpdate=true
  }
  resetLivingStream()

  const drops=Array.from({length:6},(_,i)=>ball('bathing-runoff-'+i,[0,0,0],[.013,.023,.013],waterMat))
  const ripple=mesh(new THREE.TorusGeometry(.10,.006,6,48),waterMat,subject,'bathing-ripple');ripple.rotation.x=Math.PI/2;ripple.position.y=.484
  const start=new THREE.Vector3(-.48,.44,.32),high=new THREE.Vector3(-.48,1.72,.58)
  const pourCenters=[new THREE.Vector3(-.43,1.66,.03),new THREE.Vector3(.43,1.66,.03)]
  const v=new THREE.Vector3(),end=new THREE.Vector3(),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),yAxis=new THREE.Vector3(0,1,0)
  const contact=new THREE.Vector3(),lastPourStart=new THREE.Vector3()
  let contactObject:THREE.Object3D|null=null
  let lastPourSign=-1,liquidClock=0,pourRippleTimer=.12
  const lerp=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>{ladle.position.lerpVectors(a,b,t);if(t===1)ladle.position.copy(b)}
  const pose=(step:number,amount:number)=>{
    const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0,index=step===1?1:0,sign=index===0?-1:1,center=pourCenters[index]!,front=new THREE.Vector3(center.x,1.72,.58)
    ladle.rotation.set(0,0,0);ladle.position.copy(start)
    stream.visible=false;stream.position.set(0,.5,0);stream.scale.set(1,1,1);stream.quaternion.identity()
    resetLivingStream()
    ripple.visible=false;ripple.position.set(0,.484,0);ripple.scale.setScalar(1)
    drops.forEach(d=>{d.visible=false;d.position.set(0,0,0)});contact.set(0,0,0);contactObject=null
    ladleWater.visible=step<3&&!(step===2&&t===1);ladleWater.scale.setScalar(1)
    if(step<3&&t>0&&t<1){
      if(t<.25)lerp(start,high,t/.25)
      else if(t<.43)lerp(high,front,(t-.25)/.18)
      else if(t<.55)lerp(front,center,(t-.43)/.12)
      else if(t<.80){ladle.position.copy(center);ladle.rotation.z=sign*.75*Math.min(1,(t-.55)/.06,(.80-t)/.02)}
      else if(t<.88)lerp(center,front,(t-.80)/.08)
      else if(t<.94)lerp(front,high,(t-.88)/.06)
      else lerp(high,start,(t-.94)/.06)
      ladleWater.visible=t<.78;ladleWater.scale.setScalar(t<.60?1:Math.max(0,1-(t-.60)/.18))
    }
    root.updateMatrixWorld(true)
    if(step<3&&t>=.61&&t<.78){
      v.set(-sign*.14,0,0).applyMatrix4(ladle.matrixWorld)
      ray.set(v,down);const hit=ray.intersectObjects(shoulders,false)[0]
      if(hit){
        contact.copy(hit.point);contactObject=hit.object;end.copy(hit.point)
        lastPourStart.copy(v);lastPourSign=sign
        stream.visible=true;stream.position.copy(v).add(end).multiplyScalar(.5);stream.scale.y=v.distanceTo(end);stream.quaternion.setFromUnitVectors(yAxis,end.clone().sub(v).normalize())
        livingStream.updateArc(v,end,1,0,true)
        livingStream.splashCrown.visible=false
        for(const [i,d] of drops.entries()){const f=((t-.61)*4+i/6)%1;d.visible=true;d.position.set(sign*(.35+.035*f),THREE.MathUtils.lerp(end.y-.025,.49,f),.16+.035*f)}
        ripple.visible=true;ripple.position.x=sign*.385;ripple.position.z=.195;ripple.scale.setScalar(.8+(t-.61)*4)
      }
    }
    if(t===0||t===1)ladleLiquid.reset()
    root.updateMatrixWorld(true)
  }
  const updateLiquid=(dt:number,reduced:boolean)=>{
    const stepDt=Number.isFinite(dt)&&dt>0?Math.min(dt,.05):0
    if(!reduced)liquidClock+=stepDt
    basinLiquid.update(stepDt,liquidClock,reduced)
    ladleLiquid.update(stepDt,liquidClock,reduced)
    if(stream.visible&&contactObject){
      livingStream.updateArc(lastPourStart,contact,1,liquidClock,reduced)
      if(reduced){
        livingStream.splashCrown.visible=false
      }else if(stepDt>0){
        pourRippleTimer+=stepDt
        if(pourRippleTimer>=.12){
          pourRippleTimer=0
          basinLiquid.triggerRipple(lastPourSign*.385,.195,1.15)
          basinLiquid.triggerRipple(lastPourSign*.31,.24,.62)
        }
      }
    }else{
      livingStream.mesh.visible=false
      livingStream.splashCrown.visible=false
      pourRippleTimer=.12
    }
  }
  const triggerLadleSplash=(strength=.85)=>{
    basinLiquid.triggerRipple(-.48,.32,strength)
    ladleLiquid.addTiltImpulse(1.8,-.9)
    ladleLiquid.triggerRipple(0,0,.75)
  }
  const disposeLiquid=()=>{
    basinLiquid.dispose()
    ladleLiquid.dispose()
    livingStream.dispose()
  }
  pose(0,0)
  return {
    root,
    subject,
    targets:[grip,grip,grip],
    roots:[ladle,ladle,ladle],
    anchors:[[0,0,.025],[0,0,.025],[0,0,.025]] as [number,number,number][],
    pose,
    updateLiquid,
    triggerLadleSplash,
    disposeLiquid,
    ladle,
    basin,
    statue,
    shoulders,
    cup,
    stream,
    ladleWater,
    basinLiquid,
    ladleLiquid,
    livingStream,
    drops,
    contact,
    get contactObject(){return contactObject},
  }
}
