import { createVesselLiquid } from '@wbr/scene-runtime/vessel-liquid'
import * as THREE from 'three'

/** Original assisted plunge churn; cream surface uses lightweight vessel-liquid visual response. */
export function createPlungeChurnModel(){
 const subject=new THREE.Group();subject.name='churn-subject'
 const assembly=new THREE.Group();assembly.name='churn-assembly';subject.add(assembly)
 const dasher=new THREE.Group();dasher.name='churn-dasher';assembly.add(dasher)
 const boards=['#b9905c','#c19c68','#ad8354'].map(color=>new THREE.MeshStandardMaterial({color,roughness:.88}))
 const honey=new THREE.MeshStandardMaterial({color:'#d2b582',roughness:.82}),dark=new THREE.MeshStandardMaterial({color:'#725037',roughness:.78}),iron=new THREE.MeshStandardMaterial({color:'#616d6a',metalness:.65,roughness:.55})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const lathe=(points:number[][])=>new THREE.LatheGeometry(points.map(([r,y])=>new THREE.Vector2(r!,y!)),64)
 const bodyGeometry=lathe([[.68,0],[.78,0],[.68,2],[.58,2],[.68,0]])
 bodyGeometry.clearGroups();for(let i=0;i<16;i++)bodyGeometry.addGroup(i*96,96,i%3)
 const body=mesh('churn-body',bodyGeometry,boards)
 const bottom=mesh('churn-bottom',new THREE.CylinderGeometry(.735,.735,.14,64),honey);bottom.position.y=.07
 const hoops=[.12,.96,1.76].map((low,i)=>{const high=low+.14,r=(y:number)=>.78-.05*y;return mesh('churn-hoop-'+i,lathe([[r(low)-.012,low],[r(low)+.035,low],[r(high)+.035,high],[r(high)-.012,high],[r(low)-.012,low]]),iron)})
 const lid=mesh('churn-lid',lathe([[.067,-.05],[.72,-.05],[.72,.05],[.067,.05],[.067,-.05]]),honey,assembly);lid.position.y=2.05
 const rod=mesh('churn-rod',new THREE.CylinderGeometry(.035,.035,2,24),honey,dasher);rod.position.y=1.64
 const grip=mesh('churn-grip',new THREE.CylinderGeometry(.085,.085,.26,24),dark,dasher);grip.position.y=2.57
 const blades=[0,1].map(i=>{const o=mesh('churn-blade-'+i,new THREE.BoxGeometry(.94,.09,.15),honey,dasher);o.position.y=.64+.02*i;o.rotation.y=i*Math.PI/2;return o})
 const creamLiquid=createVesselLiquid({
  preset:'churned-cream',radius:.618,radialSegments:14,angularSegments:48,deformMode:'gpu',
  color:0xf4ead3,edgeColor:0xfffaf0,deepColor:0xdecda9,foamColor:0xfffdf5,foamStrength:.65,
  opacity:1,roughness:.32,meniscusHeight:.028,maxAmplitude:.045,seed:9013,name:'churn-cream',
 })
 const cream=creamLiquid.mesh;cream.position.y=1.03;subject.add(cream)
 let liquidClock=0,surgeAccum=0,disposed=false
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1);assembly.position.y=step>=3?.65:step===2?.65*t:0;dasher.position.y=step===0?-.32*t:step===1?-.32*(1-t):0;dasher.rotation.y=step===0?0:step===1?.12*t:.12;subject.updateMatrixWorld(true)}
 function updateLiquid(dt:number,reduced:boolean){
  const stepDt=Number.isFinite(dt)&&dt>0?Math.min(dt,.05):0
  if(!reduced)liquidClock+=stepDt
  creamLiquid.update(stepDt,liquidClock,reduced)
 }
 function plungeCream(step:number,deltaAmount:number){
  if(!Number.isFinite(deltaAmount)||Math.abs(deltaAmount)<1e-4)return
  surgeAccum+=Math.abs(deltaAmount)
  if(step===0){
   if(surgeAccum>=.16){
    surgeAccum=0
    creamLiquid.addDipDepression(0,0,.034,.28)
    creamLiquid.triggerRipple(0,0,1.25)
    creamLiquid.addTiltImpulse(1.35,-1.05)
   }
  }else if(step===1){
   creamLiquid.addSwirlImpulse(deltaAmount*4.2)
   if(surgeAccum>=.16){
    surgeAccum=0
    creamLiquid.addDipDepression(0,0,-.032,.30)
    creamLiquid.triggerRipple(0,0,1.35)
    creamLiquid.addTiltImpulse(-1.45,1.15)
   }
  }else if(step===2&&surgeAccum>=.22){
   surgeAccum=0
   creamLiquid.triggerRipple(0,0,.78)
   creamLiquid.addTiltImpulse(.82,.62)
  }
 }
 function resetLiquid(){liquidClock=0;surgeAccum=0;creamLiquid.reset()}
 function dispose(){if(disposed)return;disposed=true;creamLiquid.dispose()}
 pose(0,0)
 return{subject,assembly,dasher,body,bottom,hoops,lid,rod,grip,blades,cream,pose,updateLiquid,plungeCream,resetLiquid,dispose,targets:[grip,grip,lid],roots:[grip,grip,lid],anchors:[[.04,.1,.06],[.04,.1,.06],[.52,.051,.22]] as [number,number,number][]}
}
