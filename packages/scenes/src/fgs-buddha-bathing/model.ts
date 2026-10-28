import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

/** Original basin, ladle and infant Buddha composition for FGS's public three-pour example. */
export function createBuddhaBathingModel() {
  const root=new THREE.Group();root.name='bathing-root'
  const subject=new THREE.Group();subject.name='bathing-subject';root.add(subject)
  const mat=(color:number,roughness=.75,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
  const stone=mat(0xc9c5aa),ceramic=mat(0x689b9e,.38),rimMat=mat(0xa8c3b5,.46),gold=mat(0xd6a749,.4,.3),dark=mat(0x846238),wood=mat(0xae7947),petal=mat(0xe5b9a7),leaf=mat(0x71906a)
  const waterMat=createRitualMaterial({color:0x82c8cd,transparent:true,opacity:.55,roughness:.16,metalness:0,depthWrite:false},{kind:'water',strength:.35})
  const mesh=(g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=!m.transparent;o.receiveShadow=true;parent.add(o);return o}
  const ball=(name:string,p:[number,number,number],scale:[number,number,number],m:THREE.Material,parent:THREE.Object3D=subject)=>{const o=mesh(new THREE.SphereGeometry(1,24,16),m,parent,name);o.position.set(...p);o.scale.set(...scale);return o}
  const rod=(name:string,a:[number,number,number],b:[number,number,number],radius:number,m:THREE.Material,parent:THREE.Object3D=subject)=>{
    const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),d=end.clone().sub(start),o=mesh(new THREE.CylinderGeometry(radius,radius,d.length(),16),m,parent,name)
    o.position.copy(start).add(end).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize());return o
  }
  const lathe=(name:string,points:[number,number][],m:THREE.Material,parent:THREE.Object3D=subject)=>mesh(new THREE.LatheGeometry(points.map(([x,y])=>new THREE.Vector2(x,y)),64),m,parent,name)
  const paving=mesh(new THREE.CylinderGeometry(1.25,1.28,.10,64),stone,subject,'bathing-paving');paving.position.y=-.015
  const foot=mesh(new THREE.CylinderGeometry(.65,.68,.14,48),ceramic,subject,'bathing-basin-foot');foot.position.y=.105
  // Closed thick vessel: flat floor, open interior and rounded rim; no solid cylinder filled with water.
  const basin=lathe('bathing-basin',[[0,.175],[.72,.175],[.86,.28],[.94,.58],[.935,.62],[.91,.64],[.88,.62],[.875,.58],[.80,.31],[.69,.235],[0,.235]],ceramic)
  const rim=mesh(new THREE.TorusGeometry(.905,.026,12,64),rimMat,subject,'bathing-basin-rim');rim.rotation.x=Math.PI/2;rim.position.y=.62
  const surface=mesh(new THREE.CircleGeometry(.846,64),waterMat,subject,'bathing-water');surface.rotation.x=-Math.PI/2;surface.position.y=.48
  const lotus=mesh(new THREE.CylinderGeometry(.23,.28,.10,48),gold,subject,'bathing-lotus-core');lotus.position.y=.65
  const pillar=mesh(new THREE.CylinderGeometry(.18,.21,.365,32),gold,subject,'bathing-lotus-support');pillar.position.y=.4175
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2,p=ball('bathing-lotus-petal-'+i,[Math.sin(a)*.20,.65,Math.cos(a)*.20],[.10,.07,.16],gold);p.rotation.y=a}
  const statue=new THREE.Group();statue.name='bathing-statue';subject.add(statue)
  for(const [i,x] of [-.08,.08].entries()){
    ball('bathing-foot-'+i,[x,.735,.035],[.065,.035,.105],gold,statue)
    rod('bathing-leg-'+i,[x,.76,0],[x,.98,0],.060,gold,statue)
  }
  ball('bathing-robe',[0,1.005,0],[.19,.15,.135],gold,statue)
  ball('bathing-torso',[0,1.19,0],[.215,.235,.14],gold,statue)
  const shoulders=[-1,1].map((sign,i)=>ball('bathing-shoulder-'+i,[sign*.24,1.31,.03],[.10,.10,.13],gold,statue))
  rod('bathing-neck',[0,1.36,0],[0,1.44,0],.065,gold,statue)
  ball('bathing-head',[0,1.59,-.005],[.16,.20,.145],gold,statue)
  ball('bathing-hair',[0,1.727,-.024],[.145,.079,.132],dark,statue)
  ball('bathing-topknot',[0,1.808,-.03],[.055,.047,.055],dark,statue)
  ball('bathing-nose',[0,1.57,.143],[.025,.035,.025],gold,statue)
  for(const [i,x] of [-.161,.161].entries())ball('bathing-ear-'+i,[x,1.59,-.005],[.026,.052,.032],gold,statue)
  for(const [i,x] of [-.06,.06].entries())rod('bathing-eye-'+i,[x-.019,1.61,.130],[x+.019,1.61,.130],.006,dark,statue)
  rod('bathing-mouth',[-.026,1.51,.130],[.026,1.51,.130],.005,dark,statue)
  // The source specifies one finger to the sky and the other to the ground, not a handedness rule.
  rod('bathing-up-arm',[-.24,1.34,.03],[-.235,1.70,.015],.045,gold,statue)
  ball('bathing-up-hand',[-.235,1.76,.015],[.045,.065,.035],gold,statue)
  rod('bathing-up-finger',[-.235,1.80,.015],[-.235,1.94,.015],.016,gold,statue)
  rod('bathing-down-arm',[.26,1.27,.03],[.30,1.07,.03],.047,gold,statue)
  ball('bathing-down-hand',[.31,1.02,.03],[.045,.06,.035],gold,statue)
  rod('bathing-down-finger',[.32,.98,.03],[.32,.89,.03],.016,gold,statue)
  // A small flower border sits on the paving, outside the vessel and the moving ladle path.
  for(const [i,x,z] of [[0,-.84,-.59],[1,.78,-.68],[2,.30,-1.02]]){
    const stem=rod('bathing-flower-stem-'+i,[x!, .035,z!],[x!, .25,z!],.016,leaf)
    for(let j=0;j<5;j++){const a=j/5*Math.PI*2;ball('bathing-flower-'+i+'-'+j,[x!+Math.cos(a)*.065,.25,z!+Math.sin(a)*.065],[.062,.028,.045],petal)}
    ball('bathing-flower-heart-'+i,[x!,.27,z!],[.035,.025,.035],gold)
    stem.userData.support='paving'
  }
  const ladle=new THREE.Group();ladle.name='bathing-ladle-root';subject.add(ladle)
  const cup=lathe('bathing-ladle-cup',[[0,-.105],[.055,-.092],[.10,-.060],[.132,-.012],[.14,0],[.128,.006],[.118,-.010],[.09,-.05],[.045,-.079],[0,-.087]],wood,ladle)
  rod('bathing-handle',[0,-.008,.123],[0,.55,.65],.024,wood,ladle)
  const grip=rod('bathing-grip',[0,.30648,.42],[0,.55,.65],.032,dark,ladle)
  const ladleWater=mesh(new THREE.CircleGeometry(.105,32),waterMat,ladle,'bathing-ladle-water');ladleWater.rotation.x=-Math.PI/2;ladleWater.position.y=-.028
  const stream=mesh(new THREE.CylinderGeometry(.010,.014,1,12),waterMat,subject,'bathing-stream');stream.visible=false
  const drops=Array.from({length:6},(_,i)=>ball('bathing-runoff-'+i,[0,0,0],[.013,.023,.013],waterMat))
  const ripple=mesh(new THREE.TorusGeometry(.10,.006,6,48),waterMat,subject,'bathing-ripple');ripple.rotation.x=Math.PI/2;ripple.position.y=.484
  const start=new THREE.Vector3(-.48,.44,.32),high=new THREE.Vector3(-.48,1.72,.58)
  const pourCenters=[new THREE.Vector3(-.43,1.66,.03),new THREE.Vector3(.43,1.66,.03)]
  const v=new THREE.Vector3(),end=new THREE.Vector3(),ray=new THREE.Raycaster(),down=new THREE.Vector3(0,-1,0),yAxis=new THREE.Vector3(0,1,0)
  const contact=new THREE.Vector3();let contactObject:THREE.Object3D|null=null
  const lerp=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>{ladle.position.lerpVectors(a,b,t);if(t===1)ladle.position.copy(b)}
  const pose=(step:number,amount:number)=>{
    const t=Number.isFinite(amount)?THREE.MathUtils.clamp(amount,0,1):0,index=step===1?1:0,sign=index===0?-1:1,center=pourCenters[index]!,front=new THREE.Vector3(center.x,1.72,.58)
    ladle.rotation.set(0,0,0);ladle.position.copy(start)
    stream.visible=false;stream.position.set(0,.5,0);stream.scale.set(1,1,1);stream.quaternion.identity()
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
        stream.visible=true;stream.position.copy(v).add(end).multiplyScalar(.5);stream.scale.y=v.distanceTo(end);stream.quaternion.setFromUnitVectors(yAxis,end.clone().sub(v).normalize())
        for(const [i,d] of drops.entries()){const f=((t-.61)*4+i/6)%1;d.visible=true;d.position.set(sign*(.35+.035*f),THREE.MathUtils.lerp(end.y-.025,.49,f),.16+.035*f)}
        ripple.visible=true;ripple.position.x=sign*.385;ripple.position.z=.195;ripple.scale.setScalar(.8+(t-.61)*4)
      }
    }
    root.updateMatrixWorld(true)
  }
  pose(0,0)
  return {root,subject,targets:[grip,grip,grip],roots:[ladle,ladle,ladle],anchors:[[0,0,.025],[0,0,.025],[0,0,.025]] as [number,number,number][],pose,ladle,basin,statue,shoulders,cup,stream,ladleWater,drops,contact,get contactObject(){return contactObject}}
}
