import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'

const V = (x=0,y=0,z=0) => new THREE.Vector3(x,y,z)
const mix = THREE.MathUtils.lerp
const clamp = (x:number) => THREE.MathUtils.clamp(x,0,1)
const smooth = (x:number) => {const t=clamp(x);return t*t*(3-2*t)}

/** Original branch, shide and first-person hands. Positive Z is the worshipper side. */
export function createTamagushiModel(){
 const root=new THREE.Group();root.name='tamagushi-subject'
 const table=new THREE.Group();table.name='tamagushi-table';root.add(table)
 const branch=new THREE.Group();branch.name='tamagushi-branch';root.add(branch)
 const matte=(color:number,roughness=.92)=>new THREE.MeshStandardMaterial({color,roughness})
 const wood=matte(0xd2ad72),bark=matte(0x6d6242),paper=createRitualMaterial({color:0xfff6df,roughness:.92}, { kind: 'paper', strength: .22, fiber: 'paper' }),skin=matte(0xd9a47d),sleeve=matte(0xe9e6da)
 const green=[0x608c49,0x78a455,0x4c7945].map(color=>createRitualMaterial({color,roughness:.77}, { kind: 'leaf', strength: .12, fiber: false }))
 const mesh=(parent:THREE.Group,name:string,geometry:THREE.BufferGeometry,material:THREE.Material)=>{const o=new THREE.Mesh(geometry,material);o.name='tamagushi-'+name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(parent:THREE.Group,name:string,size:number[],p:number[],material:THREE.Material)=>{const o=mesh(parent,name,new THREE.BoxGeometry(...size as [number,number,number]),material);o.position.set(...p as [number,number,number]);return o}
 const cylinder=(parent:THREE.Group,name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,material:THREE.Material)=>{
  const d=b.clone().sub(a),o=mesh(parent,name,new THREE.CylinderGeometry(r,r,d.length(),16),material);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());return o
 }
 box(table,'table-top',[2.10,.12,1.80],[0,.95,-.45],wood)
 for(const x of[-.88,.88])for(const z of[-1.14,.24])box(table,`leg-${x}-${z}`,[.12,.89,.12],[x,.445,z],wood)
 // Two small product supports leave space to withdraw the hands after the branch settles.
 const rails=[-.95,.42].map((z,i)=>box(table,'support-'+i,[.24,.15,.06],[0,1.085,z],wood))
 const stem=cylinder(branch,'stem',V(-.80),V(.80),.025,bark)
 const leafSpecs=[[-.22,.042,.30,.15,.23,-.40],[-.40,.035,-.25,.12,.20,.45],[-.62,.035,.17,.11,.18,-.80],[-.06,.040,-.29,.12,.20,.15],[-1.02,.032,-.025,.10,.20,Math.PI/2]]
 const leaves=leafSpecs.map(([x,y,z,w,l,angle],i)=>{
  const g=new THREE.SphereGeometry(1,12,6);g.scale(w!,.012,l!);const o=mesh(branch,'leaf-'+i,g,green[i%3]!);o.position.set(x!,y!,z!);o.rotation.y=angle!;
  const start=V(Math.max(-.70,Math.min(.08,x!+.16)),.012,0),end=V(x!,y!,z!);cylinder(branch,'twig-'+i,start,end,.010,bark);return o
 })
 const strip=(name:string,path:THREE.Vector2[])=>{
  const side=(sign:number)=>path.map((p,i)=>{const before=path[Math.max(0,i-1)]!,after=path[Math.min(path.length-1,i+1)]!;
   const a=p.clone().sub(before).normalize(),b=after.clone().sub(p).normalize();if(i===0)a.copy(b);if(i===path.length-1)b.copy(a);
   const n=new THREE.Vector2(-a.y,a.x).add(new THREE.Vector2(-b.y,b.x)).normalize(),den=Math.max(.1,n.dot(new THREE.Vector2(-b.y,b.x)));return p.clone().addScaledVector(n,sign*.03/den)
  });const contour=[...side(1),...side(-1).reverse()],shape=new THREE.Shape(contour),g=new THREE.ExtrudeGeometry(shape,{depth:.006,bevelEnabled:false});g.rotateX(Math.PI/2);g.translate(0,.095,0);return mesh(branch,name,g,paper)
 }
 const papers=[1,-1].map((side,i)=>{
  const x=i===0?-.55:-.70;
  const points=[[x,0],[x,.12],[x+.18,.12],[x+.18,.24],[x,.24],[x,.36],[x+.18,.36],[x+.18,.47]].map(([a,b])=>new THREE.Vector2(a!,b!*side));
  const p=strip('shide-'+i,points),tie=mesh(branch,'paper-tie-'+i,new THREE.TorusGeometry(.029,.004,8,24),paper);tie.rotation.y=Math.PI/2;tie.position.x=x;
  box(branch,'paper-fold-'+i,[.06,.062,.006],[x,.064,0],paper);return p
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
