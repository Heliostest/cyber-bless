import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'
import { createHollyLeafMaterial, createSpinyHollyLeafGeometry } from './holly-botanical'
const smooth=(x:number)=>{const t=THREE.MathUtils.clamp(x,0,1);return t*t*(3-2*t)}
export function createHiiragiModel(){
 const root=new THREE.Group();root.name='hiiragi-subject';root.position.y=-.012
 const material=(color:number,roughness=.75,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
 const wood=material(0x966746),frameWoodY=material(0x776044,.78),frameWoodX=material(0x776044,.78),bark=material(0x776044),leafmat=createHollyLeafMaterial(),stone=material(0xc6c6af),roast=material(0x928b75,.64,.18),dark=material(0x4c493e),eye=material(0x323e3a,.35),rim=material(0xc8b98c)
 applyCraftSurface(wood,{kind:'wood',strength:.4,axis:'y'})
 applyCraftSurface(frameWoodY,{kind:'wood',strength:.4,axis:'y'})
 applyCraftSurface(frameWoodX,{kind:'wood',strength:.4,axis:'x'})
 applyCraftSurface(stone,{kind:'stone',strength:.45})
 const finish=(source:THREE.BufferGeometry)=>{
  const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),faces:number[]=[]
  for(let i=0;i<p.count;i+=3){const v=[0,1,2].map(n=>new THREE.Vector3().fromBufferAttribute(p,i+n));if(new THREE.Triangle(v[0]!,v[1]!,v[2]!).getArea()>1e-12)v.forEach(q=>faces.push(q.x,q.y,q.z))}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(faces,3));g.computeVertexNormals();g.computeBoundingBox();g.computeBoundingSphere();if(raw!==source)raw.dispose();source.dispose();return g
 }
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root,x=0,y=0,z=0)=>{const o=new THREE.Mesh(finish(g),m);o.name=name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const ball=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=mesh(name,new THREE.SphereGeometry(1,20,12),m,parent,x,y,z);o.scale.set(sx,sy,sz);return o}
 const box=(name:string,x:number,y:number,z:number,sx:number,sy:number,sz:number,m:THREE.Material,bevel=.016)=>mesh(name,new RoundedBoxGeometry(sx,sy,sz,2,Math.min(bevel,sx/3,sy/3,sz/3)),m,root,x,y,z)
 const lathe=(p:number[][])=>new THREE.LatheGeometry(p.map(([x,y])=>new THREE.Vector2(x!,y!)),40)
 const threshold=box('stone-threshold',0,.0775,.10,2.8,.155,1.9,stone,.022)
 const door=box('door-panel',0,1.25,-.80,1.54,2.19,.12,wood,.014)
 for(const x of[-.83,.83])box('door-post-'+x,x,1.25,-.75,.12,2.19,.2,frameWoodY,.016)
 box('door-lintel',0,2.4,-.75,1.78,.12,.2,frameWoodX,.016)
 for(const x of[-.51,-.25,0,.25,.51])box('door-board-line-'+x,x,1.25,-.7341,.011,2.1,.012,frameWoodY,.003)
 const knob=mesh('door-handle',new THREE.TorusGeometry(.07,.016,10,24),dark,root,-.5,1.17,-.70)
 ball('door-ring-mount',-.5,1.24,-.724,.024,.024,.032,dark)
 box('holder-backplate',.83,.89,-.62,.15,.2,.14,frameWoodY,.016)
 const holder=mesh('branch-holder',lathe([[0,0],[.062,0],[.071,.012],[.075,.166],[.066,.18],[.054,.18],[.05,.17],[.05,.08],[0,.08]]),frameWoodY,root,.83,.80,-.50)
 const twig=new THREE.Group();twig.name='holly-twig';root.add(twig)
 const stem=mesh('holly-stem',new THREE.CylinderGeometry(.014,.025,1.08,16),bark,twig,0,.54,0)
 const collar=mesh('branch-head-bearing',new THREE.CylinderGeometry(.033,.027,.025,16),bark,twig,0,.8875,0)
 const leaves:THREE.Mesh[]=[]
 for(const [pair,y]of [[0,.40],[1,.65]]){
  for(const sign of[-1,1] as const){
   const leaf=new THREE.Mesh(createSpinyHollyLeafGeometry(sign),leafmat)
   leaf.name='holly-leaf-'+pair+'-'+sign;leaf.position.set(0,y!,0);if(sign<0)leaf.rotation.y=Math.PI
   leaf.castShadow=true;leaf.receiveShadow=true;twig.add(leaf);leaves.push(leaf)
   const petiole=mesh('leaf-stalk-'+pair+'-'+sign,new THREE.CylinderGeometry(.0065,.0065,.068,10),bark,twig,sign*.028,y!+.004,0);petiole.rotation.z=-sign*1.42
  }
 }
 const head=new THREE.Group();head.name='sardine-head';root.add(head)
 // A closed roasted-head volume with a real vertical insertion passage.
 // Its shape, passage and bearing are product geometry, not a traditional specification.
 const positions:number[]=[],tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>positions.push(...a.toArray(),...c.toArray(),...b.toArray())
 const outer:THREE.Vector3[][]=[],inner:THREE.Vector3[][]=[],sections=[[0,.235,.085,-.02],[.05,.30,.145,.01],[.16,.285,.145,-.005],[.27,.18,.09,-.075]]
 for(const [y,rx,rz,cx]of sections){
  outer.push(Array.from({length:48},(_,i)=>{const t=i/48*Math.PI*2;return new THREE.Vector3(cx!+rx!*Math.cos(t),y!,rz!*Math.sin(t))}))
  const r=.025-y!*.025
  inner.push(Array.from({length:48},(_,i)=>{const t=i/48*Math.PI*2;return new THREE.Vector3(r*Math.cos(t),y!,r*Math.sin(t))}))
 }
 for(let k=0;k<3;k++)for(let i=0;i<48;i++){const j=(i+1)%48,a=outer[k]!,b=outer[k+1]!,c=inner[k]!,d=inner[k+1]!;tri(a[i]!,b[j]!,b[i]!);tri(a[i]!,a[j]!,b[j]!);tri(c[i]!,d[i]!,d[j]!);tri(c[i]!,d[j]!,c[j]!)}
 for(const k of[0,3])for(let i=0;i<48;i++){const j=(i+1)%48,a=outer[k]!,b=inner[k]!;if(k===0){tri(a[i]!,b[i]!,b[j]!);tri(a[i]!,b[j]!,a[j]!)}else{tri(a[i]!,b[j]!,b[i]!);tri(a[i]!,a[j]!,b[j]!)}}
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));const body=mesh('roasted-head-body',geometry,roast,head)
 const gillTube=(sign:number)=>{
  const rings:THREE.Vector3[][]=[],vertices:number[]=[],centres:THREE.Vector3[]=[]
  for(let i=0;i<=18;i++){
   const q=i/18,y=.035+.20*q,x=-.17+.055*Math.sin(q*Math.PI),k=y<.05?0:y<.16?1:2,a=sections[k]!,b=sections[k+1]!,t=(y-a[0]!)/(b[0]!-a[0]!)
   const rx=THREE.MathUtils.lerp(a[1]!,b[1]!,t),rz=THREE.MathUtils.lerp(a[2]!,b[2]!,t),cx=THREE.MathUtils.lerp(a[3]!,b[3]!,t)
   centres.push(new THREE.Vector3(x,y,sign*(rz*Math.sqrt(1-((x-cx)/rx)**2)-.001)))
  }
  centres.forEach((c,i)=>{const tangent=centres[Math.min(i+1,18)]!.clone().sub(centres[Math.max(i-1,0)]!).normalize(),u=new THREE.Vector3(0,0,1).cross(tangent).normalize(),v=tangent.clone().cross(u);rings.push(Array.from({length:8},(_,j)=>c.clone().addScaledVector(u,Math.cos(j/8*Math.PI*2)*.005).addScaledVector(v,Math.sin(j/8*Math.PI*2)*.005)))})
  const face=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>vertices.push(...a.toArray(),...b.toArray(),...c.toArray())
  for(let i=0;i<18;i++)for(let j=0;j<8;j++){const k=(j+1)%8;face(rings[i]![j]!,rings[i]![k]!,rings[i+1]![k]!);face(rings[i]![j]!,rings[i+1]![k]!,rings[i+1]![j]!)}
  for(let j=0;j<8;j++){const k=(j+1)%8;face(centres[0]!,rings[0]![k]!,rings[0]![j]!);face(centres[18]!,rings[18]![j]!,rings[18]![k]!)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));return g
 }
 for(const sign of[-1,1]){
  ball('fish-eye-rim-'+sign,.10,.16,sign*.132,.047,.047,.012,rim,head)
  ball('fish-eye-'+sign,.10,.16,sign*.144,.027,.027,.009,eye,head)
  mesh('fish-gill-'+sign,gillTube(sign),dark,head)
 }
 const mouth=ball('fish-mouth',.277,.057,0,.036,.009,.087,dark,head)
 const nose=ball('fish-snout',.288,.080,0,.035,.025,.068,roast,head)
 const rest=new THREE.Vector3(-.65,.180,-.55),held=new THREE.Vector3(-.55,.35,.40),seat=new THREE.Vector3(.83,.88,-.50),headRest=new THREE.Vector3(.65,.155,.48),joined=new THREE.Vector3(0,.90,0),restAngle=Math.acos(.008/.8875)
 const setHeadJoined=()=>{twig.add(head);head.quaternion.identity();head.position.copy(joined)}
 const pose=(step:number,n:number)=>{
  const t=THREE.MathUtils.clamp(n,0,1);root.add(head);twig.position.copy(rest);twig.rotation.set(restAngle,0,0);head.position.copy(headRest);head.quaternion.identity()
  if(step===0){
   if(t<.3)twig.position.y=THREE.MathUtils.lerp(rest.y,.72,smooth(t/.3))
   else if(t<.75){const q=smooth((t-.3)/.45);twig.position.set(THREE.MathUtils.lerp(rest.x,held.x,q),.72,THREE.MathUtils.lerp(rest.z,held.z,q));twig.rotation.x=restAngle*(1-q)}
   else{twig.position.copy(held);twig.position.y=THREE.MathUtils.lerp(.72,held.y,smooth((t-.75)/.25));twig.rotation.x=0}
  }else if(step===1){
   twig.position.copy(held);twig.rotation.x=0
   const above=new THREE.Vector3(headRest.x,1.58,held.z),over=new THREE.Vector3(held.x,1.58,held.z),end=held.clone().add(joined)
   if(t<.35)head.position.lerpVectors(headRest,above,smooth(t/.35));else if(t<.72)head.position.lerpVectors(above,over,smooth((t-.35)/.37));else head.position.lerpVectors(over,end,smooth((t-.72)/.28))
  }else{
   twig.rotation.x=0;twig.position.copy(held)
   if(step===2){
    if(t<.3)twig.position.y=THREE.MathUtils.lerp(held.y,1.02,smooth(t/.3))
    else if(t<.8)twig.position.lerpVectors(new THREE.Vector3(held.x,1.02,held.z),new THREE.Vector3(seat.x,1.02,seat.z),smooth((t-.3)/.5))
    else twig.position.lerpVectors(new THREE.Vector3(seat.x,1.02,seat.z),seat,smooth((t-.8)/.2))
   }else twig.position.copy(seat)
   setHeadJoined()
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,threshold,door,holder,twig,stem,collar,leaves,head,body,joined,seat,targets:[twig,head,twig],roots:[twig,head,twig],anchors:[[.20,.65,.02],[.12,.14,.15],[.20,.65,.02]] as [number,number,number][],pose,dispose(){}}
}

