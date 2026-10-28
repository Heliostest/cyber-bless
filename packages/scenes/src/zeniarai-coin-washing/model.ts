import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'

/** Original generalized washing station; named practice, authored materials and assistance. */
export function createCoinWashingModel(){
 const root=new THREE.Group();root.name='wash-subject'
 const stone=new THREE.MeshStandardMaterial({color:'#b9b098',roughness:.95}),ledgeStone=new THREE.MeshStandardMaterial({color:'#d1c4a8',roughness:.96}),wood=new THREE.MeshStandardMaterial({color:'#c59b64',roughness:.8}),basketMat=new THREE.MeshStandardMaterial({color:'#d6b67b',roughness:.9}),clothMat=new THREE.MeshStandardMaterial({color:'#f4ead6',roughness:1}),metal=new THREE.MeshStandardMaterial({color:'#ba9954',roughness:.4,metalness:.58}),waterMat=createRitualMaterial({color:'#8bd5d6',transparent:true,opacity:.58,roughness:.16,metalness:0,depthWrite:false},{kind:'water',strength:.35})
 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=!mat.transparent;parent.add(o);return o}
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,parent:THREE.Object3D=root)=>{const o=make(name,new THREE.BoxGeometry(w,h,d),mat,parent);o.position.set(x,y,z);return o}
 const n=48,ring=(r:number,y:number)=>Array.from({length:n},(_,i)=>new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n)))
 const meshData=()=>{const p:number[]=[],ix:number[]=[];const strip=(a:THREE.Vector3[],b:THREE.Vector3[])=>{const start=p.length/3,count=a.length;for(const v of[...a,...b])p.push(v.x,v.y,v.z);for(let i=0;i<count;i++){const j=(i+1)%count;ix.push(start+i,start+count+i,start+count+j,start+i,start+count+j,start+j)}};const cap=(a:THREE.Vector3[],center:THREE.Vector3,up:boolean)=>{const start=p.length/3;p.push(center.x,center.y,center.z);for(const v of a)p.push(v.x,v.y,v.z);for(let i=0;i<a.length;i++){const j=(i+1)%a.length;ix.push(start,start+1+(up?j:i),start+1+(up?i:j))}};const geometry=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g};return{p,ix,strip,cap,geometry}}
 const vessel=(profile:[number,number][],bottom:number,floor:number)=>{const d=meshData(),loops=profile.map(([r,y])=>ring(r,y));for(let i=0;i<loops.length-1;i++)d.strip(loops[i]!,loops[i+1]!);d.cap(loops[0]!,new THREE.Vector3(0,bottom,0),false);d.cap(loops.at(-1)!,new THREE.Vector3(0,floor,0),true);return d.geometry()}
 const basin=make('wash-basin',vessel([[1.55,0],[1.75,.58],[1.72,.68],[1.50,.68],[1.45,.12]],0,.12),stone)
 const ledge=box('wash-cloth-stone',-2.05,.34,1,.56,.68,.55,ledgeStone)
 const rails=[-.2,.2].map((z,i)=>box('wash-sieve-support-'+i,0,.695,z,3.30,.03,.08,wood))
 const d=meshData(),loops=[ring(.38,.71),ring(.49,.93),ring(.455,.93),ring(.355,.745)]
 for(let i=0;i<loops.length-1;i++)d.strip(loops[i]!,loops[i+1]!)
 const holes:THREE.Vector2[][]=[];for(const x of[-.18,0,.18])for(const z of[-.18,0,.18])holes.push([[-.045,-.045],[.045,-.045],[.045,.045],[-.045,.045]].map(([a,b])=>new THREE.Vector2(x+a!,z+b!)))
 const perforatedCap=(r:number,y:number,up:boolean)=>{const outline=ring(r,y).map(v=>new THREE.Vector2(v.x,v.z)),points=[...outline,...holes.flat()],faces=THREE.ShapeUtils.triangulateShape(outline,holes),base=d.p.length/3;for(const v of points)d.p.push(v.x,y,v.y)
  // Earcut can bridge aligned holes using an edge through other boundary vertices.
  // Split every such edge at actual collinear vertices to make the cap conforming.
  for(const face of faces){const center=new THREE.Vector2();face.forEach(i=>center.add(points[i]!));center.multiplyScalar(1/3);const ci=d.p.length/3;d.p.push(center.x,y,center.y)
   for(let k=0;k<3;k++){const a=face[k]!,b=face[(k+1)%3]!,va=points[a]!,vb=points[b]!,dx=vb.x-va.x,dz=vb.y-va.y,len=dx*dx+dz*dz,cuts=points.map((v,i)=>({i,t:((v.x-va.x)*dx+(v.y-va.y)*dz)/len,cross:Math.abs((v.x-va.x)*dz-(v.y-va.y)*dx)})).filter(v=>v.t>1e-10&&v.t<1-1e-10&&v.cross<1e-12).sort((x,z)=>x.t-z.t),chain=[a,...cuts.map(v=>v.i),b];for(let j=0;j<chain.length-1;j++)d.ix.push(ci,base+chain[up?j+1:j]!,base+chain[up?j:j+1]!)}
  }
 }
 perforatedCap(.38,.71,false);perforatedCap(.355,.745,true)
 for(const h of holes){const reverse=h.slice().reverse();d.strip(reverse.map(v=>new THREE.Vector3(v.x,.71,v.y)),reverse.map(v=>new THREE.Vector3(v.x,.745,v.y)))}
 const sieve=make('wash-sieve',d.geometry(),basketMat)
 const coin=make('wash-coin',new THREE.CylinderGeometry(.13,.13,.035,32),metal);coin.position.set(0,.7625,0)
 const ladle=new THREE.Group();ladle.name='wash-ladle';root.add(ladle)
 const cup=make('wash-cup',vessel([[.10,0],[.14,.18],[.12,.18],[.08,.035]],0,.035),wood,ladle)
 const handle=box('wash-handle',0,.31,.44,.055,.055,.72,wood,ladle);handle.geometry.rotateX(-.55)
 const fill=make('wash-cup-water',new THREE.CylinderGeometry(.11,.11,.008,32),waterMat,ladle);fill.position.y=.13
 const cloth=box('wash-cloth',-2.05,.695,1,.28,.03,.28,clothMat)
 const stream=make('wash-pour',new THREE.CylinderGeometry(.012,.018,1,12),waterMat);stream.castShadow=stream.receiveShadow=false
 const droplets=[[-.065,.035],[.06,.04],[0,-.065]].map(([x,z],i)=>{const o=make('wash-droplet-'+i,new THREE.SphereGeometry(.025,12,8),waterMat);o.position.set(x!, .797,z!);return o})
 const home=new THREE.Vector3(.85,.28,0),raised=new THREE.Vector3(0,1.30,0),pouring=new THREE.Vector3(0,1.18,-.205),parked=new THREE.Vector3(.85,1.30,0),clothHome=new THREE.Vector3(-2.05,.695,1)
 const mix=(a:number,b:number,t:number)=>t<=0?a:t>=1?b:a+(b-a)*t,lerp=(o:THREE.Object3D,a:THREE.Vector3,b:THREE.Vector3,t:number)=>o.position.set(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t))
 function pose(step:number,amount:number){const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1);ladle.rotation.set(0,Math.PI/2,0);cloth.position.copy(clothHome);fill.visible=false;stream.visible=false;droplets.forEach(o=>o.visible=step===2)
  if(step===0){if(t<.6)lerp(ladle,home,parked,t/.6);else lerp(ladle,parked,raised,(t-.6)/.4);fill.visible=t>.1}
  else if(step===1){if(t<.25){lerp(ladle,raised,pouring,t/.25);ladle.rotation.z=1.05*t/.25;fill.visible=true}else if(t<=.75){ladle.position.copy(pouring);ladle.rotation.z=1.05;stream.visible=true;droplets.forEach(o=>o.visible=true)}else{const q=(t-.75)/.25;lerp(ladle,pouring,parked,q);ladle.rotation.z=1.05*(1-q);droplets.forEach(o=>o.visible=true)}}
  else if(step===2){lerp(ladle,parked,home,t);if(t<.3){const q=t/.3;cloth.position.set(mix(clothHome.x,-.07,q),mix(clothHome.y,1.20,q),mix(clothHome.z,0,q))}else if(t<.4){cloth.position.set(-.07,mix(1.20,.795,(t-.3)/.1),0)}else if(t<=.7){cloth.position.set(-.07+.14*((t-.4)/.3),.795,0)}else if(t<.8){cloth.position.set(.07,mix(.795,1.20,(t-.7)/.1),0)}else{const q=(t-.8)/.2;cloth.position.set(mix(.07,clothHome.x,q),mix(1.20,clothHome.y,q),mix(0,clothHome.z,q))}if(t>.7)droplets.forEach(o=>o.visible=false)}
  else ladle.position.copy(home)
  if(step===2&&t===1)cloth.position.copy(clothHome)
  root.updateMatrixWorld(true)
  const start=ladle.localToWorld(new THREE.Vector3(-.13,.16,0)),end=new THREE.Vector3(0,.79,0),direction=end.clone().sub(start),length=direction.length();stream.position.copy(start).add(end).multiplyScalar(.5);stream.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());stream.scale.set(1,Math.max(.01,length),1);root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject:root,basin,ledge,rails,sieve,coin,ladle,cup,handle,cloth,fill,stream,droplets,pose,targets:[handle,handle,cloth],roots:[ladle,ladle,cloth],anchors:[[0,.115,.188],[0,.115,.188],[0,.01,0]] as [number,number,number][]}
}
