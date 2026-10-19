import * as THREE from 'three'
import {createStylizedWater} from '@wbr/scene-runtime/stylized-water'

export function createShishiOdoshiModel(){
 const subject=new THREE.Group(),fixed=new THREE.Group(),pivot=new THREE.Group(),feed=new THREE.Group()
 subject.name='sozu-subject';fixed.name='sozu-fixed';pivot.name='sozu-pivot';feed.name='sozu-feed';subject.add(fixed,pivot,feed);pivot.position.y=1.15
 const bamboo=new THREE.MeshStandardMaterial({color:'#9aa557',roughness:.82,vertexColors:true}),cut=new THREE.MeshStandardMaterial({color:'#ded19b',roughness:.9}),node=new THREE.MeshStandardMaterial({color:'#788342',roughness:.88}),stone=new THREE.MeshStandardMaterial({color:'#8c9a98',roughness:.98,vertexColors:true}),pinMat=new THREE.MeshStandardMaterial({color:'#b99b6a',roughness:.8})
 const waterMat=new THREE.MeshPhysicalMaterial({color:'#70c9c5',transparent:true,opacity:.70,roughness:.20,depthWrite:false,side:THREE.DoubleSide})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D,x=0,y=0,z=0)=>{
  if((mat as THREE.MeshStandardMaterial).vertexColors){const p=g.attributes.position!,a=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const v=.94+.035*Math.sin(p.getX(i)*31+p.getY(i)*8+p.getZ(i)*17);a.set([v,v,v],i*3)}g.setAttribute('color',new THREE.BufferAttribute(a,3))}
  const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m
 }
 // Closed wall, solid tail and internal node. The upward-facing mouth is a real opening.
 const positions:number[]=[],tri=(a:number[],b:number[],c:number[])=>positions.push(...a,...b,...c),quad=(a:number[],b:number[],c:number[],d:number[])=>{tri(a,b,c);tri(a,c,d)}
 const ring=(r:number,t:number,x:number|null)=>{const y=r*Math.cos(t);return[x??1.2-.6*y,y,r*Math.sin(t)]}
 for(let i=0;i<32;i++){
  const a=i*Math.PI/16,b=(i+1)*Math.PI/16,oa=ring(.16,a,-.9),ob=ring(.16,b,-.9),oc=ring(.16,b,null),od=ring(.16,a,null),ia=ring(.125,a,-.08),ib=ring(.125,b,-.08),ic=ring(.125,b,null),id=ring(.125,a,null)
  quad(oa,ob,oc,od);quad(ia,id,ic,ib);quad(od,oc,ic,id);tri([-.9,0,0],ob,oa);tri([-.08,0,0],ia,ib)
 }
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.computeVertexNormals()
 for(let i=0;i<32;i++){geometry.addGroup(i*24,6,0);geometry.addGroup(i*24+6,18,1)}
 const tube=mesh('sozu-tube',geometry,bamboo,pivot);tube.material=[bamboo,cut]
 for(const [i,x]of[-.48,.30].entries()){const band=mesh('sozu-node-band-'+i,new THREE.TorusGeometry(.162,.010,6,32),node,pivot,x);band.rotation.y=Math.PI/2}
 // Axle and two legs are the required fulcrum; no added furniture or panel.
 for(const[i,z]of[-.25,.25].entries())mesh('sozu-support-'+i,new THREE.CylinderGeometry(.045,.065,1.15,16),bamboo,fixed,0,.575,z)
 const axle=mesh('sozu-axle',new THREE.CylinderGeometry(.033,.033,.66,16),pinMat,fixed,0,1.15,0);axle.rotation.x=Math.PI/2
 mesh('sozu-feed-stem',new THREE.CylinderGeometry(.07,.08,1.65,16),bamboo,fixed,2.65,.825,0)
 const supplyGeometry=new THREE.LatheGeometry([new THREE.Vector2(.043,-.525),new THREE.Vector2(.061,-.525),new THREE.Vector2(.061,.525),new THREE.Vector2(.043,.525),new THREE.Vector2(.043,-.525)],32);supplyGeometry.rotateZ(-Math.PI/2);mesh('sozu-feed-supply',supplyGeometry,bamboo,fixed,2.125,1.65,0)
 const sleeveGeometry=new THREE.LatheGeometry([new THREE.Vector2(.065,-.35),new THREE.Vector2(.09,-.35),new THREE.Vector2(.09,.35),new THREE.Vector2(.065,.35),new THREE.Vector2(.065,-.35)],32);sleeveGeometry.rotateZ(-Math.PI/2)
 const sleeve=mesh('sozu-feed-sleeve',sleeveGeometry,bamboo,feed,1.52,1.65,0)
 const strikePoint=new THREE.Vector3(-.9*Math.cos(.2)+.16*Math.sin(.2),1.15-.9*Math.sin(.2)-.16*Math.cos(.2),0)
 const strike=mesh('sozu-strike-stone',new THREE.SphereGeometry(1,32,24),stone,fixed,strikePoint.x,strikePoint.y/2,0);strike.scale.set(.38,strikePoint.y/2,.32)
 const basinProfile=[[1.16,.02],[1.18,.30],[1.43,.32],[1.50,0],[1.16,0],[1.16,.02]].map(([x,y])=>new THREE.Vector2(x,y))
 mesh('sozu-pool-rim',new THREE.LatheGeometry(basinProfile.reverse(),64),stone,fixed,1.0,0,0)
 const pool=createStylizedWater({geometry:new THREE.CircleGeometry(1.17,64),depth:.16,color:'#67c5c2',bedColor:'#bcc6a2',opacity:.48,radius:1.17,causticScale:4.2});pool.surface.name='sozu-pool-water';pool.bed.name='sozu-pool-bed';pool.surface.rotation.x=-Math.PI/2;pool.surface.position.set(1.0,.18,0);fixed.add(pool.surface)
 const liquid=mesh('sozu-contained-water',new THREE.PlaneGeometry(1,1,32,1),waterMat,subject);liquid.castShadow=false;liquid.renderOrder=2;liquid.userData.toonSurface={outline:false}
 const inlet=mesh('sozu-inlet-water',new THREE.CylinderGeometry(.018,.018,1,12),waterMat,subject),outlet=mesh('sozu-outlet-water',new THREE.CylinderGeometry(.022,.022,1,12),waterMat,subject)
 for(const m of[inlet,outlet]){m.castShadow=false;m.userData.toonSurface={outline:false}}
 const spillGeometry=new THREE.BufferGeometry();spillGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array(36),3));const spill=mesh('sozu-spill-film',spillGeometry,waterMat,subject);spill.castShadow=false;spill.userData.toonSurface={outline:false}
 const stream=(m:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{m.position.copy(a).add(b).multiplyScalar(.5);m.scale.set(1,a.distanceTo(b),1);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize())}
 const liquidPose=(theta:number,height:number,show:boolean)=>{
  const c=Math.cos(theta),s=Math.sin(theta),r=.12425
  let lo=-.0799,hi=(1.2-.6*(height-1.15)/c)/(1-.6*s/c)
  if(Math.abs(s)>1e-10){const a=(height-1.15-r*c)/s,b=(height-1.15+r*c)/s;lo=Math.max(lo,Math.min(a,b));hi=Math.min(hi,Math.max(a,b))}
  hi=Math.min(hi,1.275);lo+=.00002;hi-=.00002;liquid.visible=show&&hi>lo&&Number.isFinite(hi)&&(Math.abs(s)>1e-10||Math.abs(height-1.15)<r)
  if(!liquid.visible){(liquid.geometry.attributes.position as THREE.BufferAttribute).array.fill(0);liquid.geometry.attributes.position!.needsUpdate=true;liquid.geometry.computeVertexNormals();liquid.geometry.computeBoundingSphere();return}
  const p=liquid.geometry.attributes.position as THREE.BufferAttribute
  for(let i=0;i<=32;i++){const x=lo+(hi-lo)*i/32,y=(height-1.15-x*s)/c,z=Math.sqrt(Math.max(0,r*r-y*y)),wx=x*c-y*s;p.setXYZ(i,wx,height,-z);p.setXYZ(i+33,wx,height,z)}
  p.needsUpdate=true;liquid.geometry.computeVertexNormals();liquid.geometry.computeBoundingSphere()
 }
 const pose=(at:number,n:number)=>{
  const step=Number.isFinite(at)?THREE.MathUtils.clamp(Math.floor(at),0,3):0,t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  const theta=step===1?.2-.75*t:step===2?-.55+.75*t:.2;pivot.rotation.z=theta
  feed.position.x=step===0?.45*(1-Math.min(t/.5,1)):0
  const initialHeight=1.16,lip=1.15+1.275*Math.sin(theta)-.125*Math.cos(theta)
  const height=step===0?1.013+(initialHeight-1.013)*Math.max(0,(t-.5)/.5):step===1?Math.min(initialHeight,lip-.003)-.10*t:0
  liquidPose(theta,height,(step===0&&t>.5)||(step===1&&t<1))
  inlet.visible=step===0&&t>.5&&t<1;outlet.visible=step===1&&t>.12&&t<.82
  stream(inlet,new THREE.Vector3(1.17+feed.position.x,1.56,0),new THREE.Vector3(1.17+feed.position.x,1.15+(1.17+feed.position.x)*Math.tan(.2)-.125/Math.cos(.2)+.008,0))
  const axis=new THREE.Vector3(0,0,1),normal=new THREE.Vector3(1,.6,0).normalize().applyAxisAngle(axis,theta)
  const innerLip=new THREE.Vector3(1.275,-.125,0).applyAxisAngle(axis,theta).add(pivot.position),outerLip=new THREE.Vector3(1.296,-.16,0).applyAxisAngle(axis,theta).add(pivot.position)
  const path=[innerLip.addScaledVector(normal,.002),outerLip.clone().addScaledVector(normal,.002),outerLip.clone().add(new THREE.Vector3(.035,0,0))]
  const sheet:number[]=[];for(let i=0;i<2;i++){const a=path[i]!,b=path[i+1]!,ap=a.clone().add(new THREE.Vector3(0,0,.013)),am=a.clone().add(new THREE.Vector3(0,0,-.013)),bp=b.clone().add(new THREE.Vector3(0,0,.013)),bm=b.clone().add(new THREE.Vector3(0,0,-.013));sheet.push(...ap.toArray(),...am.toArray(),...bm.toArray(),...ap.toArray(),...bm.toArray(),...bp.toArray())}
  ;(spill.geometry.attributes.position as THREE.BufferAttribute).array.set(sheet);spill.geometry.attributes.position!.needsUpdate=true;spill.geometry.computeVertexNormals();spill.geometry.computeBoundingSphere();spill.visible=outlet.visible
  stream(outlet,path[2]!,new THREE.Vector3(path[2]!.x,.182,path[2]!.z));subject.updateMatrixWorld(true)

 }
 const tailContact=()=>{subject.updateMatrixWorld(true);return pivot.localToWorld(new THREE.Vector3(-.9,-.16,0))}
 pose(0,0)
 return{subject,fixed,pivot,tube,feed,sleeve,axle,strike,strikePoint,tailContact,liquid,inlet,outlet,spill,pool,pose,targets:[sleeve,tube,tube],roots:[sleeve,tube,tube],anchors:[[-.12,0,.09],[.75,0,.16],[-.75,0,.16]] as[number,number,number][],updateWater:(dt:number,reduced:boolean)=>pool.update(dt,reduced),disposeWater:()=>pool.dispose()}
}