import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'
import * as THREE from 'three'
import { createBambooSieveMaterials, warmBambooTint } from './sieve-material'

/** Original generalized washing station; named practice, authored materials and assistance. */
export function createCoinWashingModel(){
 const root=new THREE.Group();root.name='wash-subject'
 const stone=new THREE.MeshStandardMaterial({color:'#b9b098',roughness:.95}),ledgeStone=new THREE.MeshStandardMaterial({color:'#d1c4a8',roughness:.96}),wood=new THREE.MeshStandardMaterial({color:'#c59b64',roughness:.8}),sieveMats=createBambooSieveMaterials(),clothMat=new THREE.MeshStandardMaterial({color:'#f4ead6',roughness:1}),metal=new THREE.MeshStandardMaterial({color:'#ba9954',roughness:.4,metalness:.58}),waterMat=createRitualMaterial({color:'#8bd5d6',transparent:true,opacity:.58,roughness:.16,metalness:0,depthWrite:false},{kind:'water',strength:.35})
 applyCraftSurface(wood, { kind: 'wood', strength: .4 })
 applyCraftSurface(clothMat, { kind: 'fabric', strength: .26 })
 applyCraftSurface(metal, { kind: 'metal', strength: .45 })
 applyCraftSurface(stone, { kind: 'stone', strength: .4 })
 applyCraftSurface(ledgeStone, { kind: 'stone', strength: .4 })

 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,mat);o.name=name;const opaque=Array.isArray(mat)?mat.every(m=>!m.transparent):!mat.transparent;o.castShadow=o.receiveShadow=opaque;parent.add(o);return o}
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,parent:THREE.Object3D=root)=>{const o=make(name,new THREE.BoxGeometry(w,h,d),mat,parent);o.position.set(x,y,z);return o}
 const n=48,ring=(r:number,y:number)=>Array.from({length:n},(_,i)=>new THREE.Vector3(r*Math.cos(i*2*Math.PI/n),y,r*Math.sin(i*2*Math.PI/n)))
 const meshData=()=>{const p:number[]=[],ix:number[]=[];const strip=(a:THREE.Vector3[],b:THREE.Vector3[])=>{const start=p.length/3,count=a.length;for(const v of[...a,...b])p.push(v.x,v.y,v.z);for(let i=0;i<count;i++){const j=(i+1)%count;ix.push(start+i,start+count+i,start+count+j,start+i,start+count+j,start+j)}};const cap=(a:THREE.Vector3[],center:THREE.Vector3,up:boolean)=>{const start=p.length/3;p.push(center.x,center.y,center.z);for(const v of a)p.push(v.x,v.y,v.z);for(let i=0;i<a.length;i++){const j=(i+1)%a.length;ix.push(start,start+1+(up?j:i),start+1+(up?i:j))}};const geometry=()=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(ix);g.computeVertexNormals();return g};return{p,ix,strip,cap,geometry}}
 const vessel=(profile:[number,number][],bottom:number,floor:number)=>{const d=meshData(),loops=profile.map(([r,y])=>ring(r,y));for(let i=0;i<loops.length-1;i++)d.strip(loops[i]!,loops[i+1]!);d.cap(loops[0]!,new THREE.Vector3(0,bottom,0),false);d.cap(loops.at(-1)!,new THREE.Vector3(0,floor,0),true);return d.geometry()}
 const basin=make('wash-basin',vessel([[1.55,0],[1.75,.58],[1.72,.68],[1.50,.68],[1.45,.12]],0,.12),stone)
 const ledge=box('wash-cloth-stone',-2.05,.34,1,.56,.68,.55,ledgeStone)
 const rails=[-.2,.2].map((z,i)=>box('wash-sieve-support-'+i,0,.695,z,3.30,.03,.08,wood))
 const d=meshData(),sieveUv:number[]=[],sieveCol:number[]=[],seamPairs:[number,number][]=[]
 const loops=[ring(.38,.71),ring(.49,.93),ring(.455,.93),ring(.355,.745)]
 const pushSieveVert=(x:number,y:number,z:number,u:number,v:number,recess:number,drift:number)=>{
  d.p.push(x,y,z);sieveUv.push(u,v)
  const [r,g,b]=warmBambooTint(recess,drift);sieveCol.push(r,g,b)
 }
 const sieveGroups:{start:number,count:number,materialIndex:number}[]=[]
 const addCylStrip=(a:THREE.Vector3[],b:THREE.Vector3[],va:number,vb:number,recessA:number,recessB:number,materialIndex:number)=>{
  const startV=d.p.length/3,rowLen=a.length+1,startI=d.ix.length
  for(let i=0;i<=a.length;i++){const v=a[i%a.length]!,ang=(i/a.length)*Math.PI*2;pushSieveVert(v.x,v.y,v.z,i/a.length,va,recessA,Math.sin(ang*3+0.4)*0.45)}
  for(let i=0;i<=b.length;i++){const v=b[i%b.length]!,ang=(i/b.length)*Math.PI*2;pushSieveVert(v.x,v.y,v.z,i/b.length,vb,recessB,Math.sin(ang*3+1.3)*0.45)}
  for(let i=0;i<a.length;i++)d.ix.push(startV+i,startV+rowLen+i,startV+rowLen+i+1,startV+i,startV+rowLen+i+1,startV+i+1)
  seamPairs.push([startV,startV+a.length],[startV+rowLen,startV+rowLen+b.length])
  sieveGroups.push({start:startI,count:d.ix.length-startI,materialIndex})
 }
 // [0] outer woven wall (v=0 base -> v=1 rim collar), [1] toasted rim hoop, [0] inner woven wall (v=1 rim collar -> v=0 floor)
 addCylStrip(loops[0]!,loops[1]!,0,1,.22,.05,0)
 addCylStrip(loops[1]!,loops[2]!,0,1,.08,.08,1)
 addCylStrip(loops[2]!,loops[3]!,1,0,.05,.34,0)
 const floorStartI=d.ix.length
 const holes:THREE.Vector2[][]=[];for(const x of[-.18,0,.18])for(const z of[-.18,0,.18])holes.push([[-.045,-.045],[.045,-.045],[.045,.045],[-.045,.045]].map(([a,b])=>new THREE.Vector2(x+a!,z+b!)))
 const floorVert=(x:number,y:number,z:number,up:boolean)=>{
  const r=Math.hypot(x,z),drift=Math.sin(x*7.5+z*5.2)*0.35
  const recess=up?THREE.MathUtils.smoothstep(r,.23,.355)*.38+Math.exp(-(r*r)/.026)*.16:.48
  pushSieveVert(x,y,z,(x+.045)/.36,(z+.045)/.36,recess,drift)
 }
 const perforatedCap=(r:number,y:number,up:boolean)=>{const outline=ring(r,y).map(v=>new THREE.Vector2(v.x,v.z)),points=[...outline,...holes.flat()],faces=THREE.ShapeUtils.triangulateShape(outline,holes),base=d.p.length/3;for(const v of points)floorVert(v.x,y,v.y,up)
  // Earcut can bridge aligned holes using an edge through other boundary vertices.
  // Split every such edge at actual collinear vertices to make the cap conforming.
  for(const face of faces){const center=new THREE.Vector2();face.forEach(i=>center.add(points[i]!));center.multiplyScalar(1/3);const ci=d.p.length/3;floorVert(center.x,y,center.y,up)
   for(let k=0;k<3;k++){const a=face[k]!,b=face[(k+1)%3]!,va=points[a]!,vb=points[b]!,dx=vb.x-va.x,dz=vb.y-va.y,len=dx*dx+dz*dz,cuts=points.map((v,i)=>({i,t:((v.x-va.x)*dx+(v.y-va.y)*dz)/len,cross:Math.abs((v.x-va.x)*dz-(v.y-va.y)*dx)})).filter(v=>v.t>1e-10&&v.t<1-1e-10&&v.cross<1e-12).sort((x,z)=>x.t-z.t),chain=[a,...cuts.map(v=>v.i),b];for(let j=0;j<chain.length-1;j++)d.ix.push(ci,base+chain[up?j+1:j]!,base+chain[up?j:j+1]!)}
  }
 }
 perforatedCap(.38,.71,false);perforatedCap(.355,.745,true)
 for(const h of holes){
  const reverse=h.slice().reverse(),start=d.p.length/3,count=reverse.length
  for(const v of reverse)pushSieveVert(v.x,.71,v.y,(v.x+.045)/.36,(v.y+.045)/.36,.72,0)
  for(const v of reverse)pushSieveVert(v.x,.745,v.y,(v.x+.045)/.36,(v.y+.045)/.36,.46,0)
  for(let i=0;i<count;i++){const j=(i+1)%count;d.ix.push(start+i,start+count+i,start+count+j,start+i,start+count+j,start+j)}
 }
 sieveGroups.push({start:floorStartI,count:d.ix.length-floorStartI,materialIndex:2})
 const sieveGeo=d.geometry()
 sieveGeo.setAttribute('uv',new THREE.Float32BufferAttribute(sieveUv,2))
 sieveGeo.setAttribute('color',new THREE.Float32BufferAttribute(sieveCol,3))
 const sieveNorm=sieveGeo.getAttribute('normal') as THREE.BufferAttribute
 for(const [a,b] of seamPairs){
  const nx=sieveNorm.getX(a)+sieveNorm.getX(b),ny=sieveNorm.getY(a)+sieveNorm.getY(b),nz=sieveNorm.getZ(a)+sieveNorm.getZ(b),len=Math.hypot(nx,ny,nz)||1
  sieveNorm.setXYZ(a,nx/len,ny/len,nz/len);sieveNorm.setXYZ(b,nx/len,ny/len,nz/len)
 }
 sieveNorm.needsUpdate=true
 for(const grp of sieveGroups)sieveGeo.addGroup(grp.start,grp.count,grp.materialIndex)
 const sieve=make('wash-sieve',sieveGeo,[...sieveMats.all])
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
