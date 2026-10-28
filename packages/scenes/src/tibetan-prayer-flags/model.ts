import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z)
const NX=8,NY=10,W=.38,H=.45,COUNT=(NX+1)*(NY+1),LENGTH=2.5
const glyphs:Record<string,string[]>={O:['01110','10001','10001','10001','10001','10001','01110'],M:['10001','11011','10101','10101','10001','10001','10001'],A:['01110','10001','10001','11111','10001','10001','10001'],N:['10001','11001','11001','10101','10011','10011','10001'],I:['11111','00100','00100','00100','00100','00100','11111'],P:['11110','10001','10001','11110','10000','10000','10000'],D:['11110','10001','10001','10001','10001','10001','11110'],E:['11111','10000','10000','11110','10000','10000','11111'],H:['10001','10001','10001','11111','10001','10001','10001'],U:['10001','10001','10001','10001','10001','10001','01110']}
// Original Latin typesetting of the documented mantra; not a facsimile of a nunnery print.
function print(lines:string[]){
 const size=128,data=new Uint8Array(size*size*4);data.fill(255)
 const ink=(x:number,y:number)=>{const i=(y*size+x)*4;data[i]=35;data[i+1]=38;data[i+2]=39}
 for(let l=0;l<lines.length;l++){const text=lines[l]!,scale=4,x0=Math.floor((size-(text.length*6-1)*scale)/2),y0=Math.floor((size-lines.length*36)/2)+l*36
  ;[...text].forEach((c,k)=>glyphs[c]!.forEach((row,y)=>[...row].forEach((bit,x)=>{if(bit==='1')for(let a=0;a<scale;a++)for(let b=0;b<scale;b++)ink(x0+(k*6+x)*scale+a,y0+y*scale+b)})))
 }
 const texture=new THREE.DataTexture(data,size,size);texture.flipY=true;texture.colorSpace=THREE.SRGBColorSpace;texture.magFilter=THREE.NearestFilter;texture.needsUpdate=true;return texture
}
function clothGeometry(){
 const g=new THREE.BufferGeometry(),indices:number[]=[],uv:number[]=[],sources:number[]=[]
 for(let side=0;side<2;side++)for(let y=0;y<=NY;y++)for(let x=0;x<=NX;x++)uv.push(x/NX,1-y/NY)
 const quad=(a:number,b:number,c:number,d:number)=>indices.push(a,b,c,a,c,d)
 for(let y=0;y<NY;y++)for(let x=0;x<NX;x++){const a=y*(NX+1)+x;quad(a,a+NX+1,a+NX+2,a+1);quad(a+COUNT,a+COUNT+1,a+COUNT+NX+2,a+COUNT+NX+1)}
 const edge=(a:number,b:number,c:number,d:number)=>{const offset=COUNT*2+sources.length;for(const source of[a,b,c,d]){sources.push(source);uv.push(uv[source*2]!,uv[source*2+1]!)}quad(offset,offset+1,offset+2,offset+3)}
 for(let x=0;x<NX;x++){edge(x,x+1,x+1+COUNT,x+COUNT);const a=NY*(NX+1)+x;edge(a,a+COUNT,a+COUNT+1,a+1)}
 for(let y=0;y<NY;y++){const a=y*(NX+1),b=a+NX;edge(a,a+COUNT,a+COUNT+NX+1,a+NX+1);edge(b,b+NX+1,b+NX+1+COUNT,b+COUNT)}
 g.userData.edgeSources=sources;g.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((COUNT*2+sources.length)*3),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);return g
}
/** Complete five-colour Mini Mani string. Posts, peg sequence, proportions and typography are product staging. */
export function createPrayerFlagsModel(){
 const root=new THREE.Group();root.name='prayer-flags-subject'
 const matte=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.94})
 const make=<M extends THREE.Material>(name:string,g:THREE.BufferGeometry,m:M)=>{const o=new THREE.Mesh(g,m);o.name='prayer-flags-'+name;o.castShadow=o.receiveShadow=true;root.add(o);return o}
 const wood=matte(0xb48756),stone=matte(0xd6c9ab),cotton=matte(0xf8efdd)
 const box=(name:string,size:number[],p:number[],m:THREE.Material)=>{const o=make(name,new THREE.BoxGeometry(...size as [number,number,number]),m);o.position.set(...p as [number,number,number]);return o}
 for(const x of[-1.15,1.15]){box('post-'+x,[.10,2.05,.10],[x,1.025,0],wood);box('foot-'+x,[.25,.12,.25],[x,.06,0],stone)}
 const arm=box('temporary-arm',[.60,.055,.06],[.90,1.50,0],wood)
 const pegPositions=[[-1.15,1.50],[-1.15,1.85],[.65,1.50],[1.15,1.50],[1.15,1.85]]
 const pegs=pegPositions.map(([x,y],i)=>{const o=make('peg-'+i,new THREE.CylinderGeometry(.033,.033,.20,64),wood);o.rotation.x=Math.PI/2;o.position.set(x!,y!,.06);return o})
 const temporarySupport=new THREE.Group();temporarySupport.name='prayer-flags-temporary-support';temporarySupport.position.set(1.15,1.50,0);root.add(temporarySupport)
 arm.position.sub(temporarySupport.position);pegs[2]!.position.sub(temporarySupport.position);temporarySupport.add(arm,pegs[2]!)
 const hinge=make('hinge',new THREE.CylinderGeometry(.045,.045,.12,24),wood);hinge.position.copy(temporarySupport.position)
 const loops=[0,1].map(i=>make('loop-'+i,new THREE.TorusGeometry(.060,.012,8,64),cotton))
 const ropeGeometry=new THREE.BufferGeometry(),ropeIndices:number[]=[],RINGS=65,SIDES=8
 ropeGeometry.setAttribute('position',new THREE.Float32BufferAttribute(new Float32Array((RINGS*SIDES+2)*3),3))
 for(let i=0;i<RINGS-1;i++)for(let j=0;j<SIDES;j++){const a=i*SIDES+j,b=i*SIDES+(j+1)%SIDES;ropeIndices.push(a,b,b+SIDES,a,b+SIDES,a+SIDES)}
 for(let j=0;j<SIDES;j++){ropeIndices.push(RINGS*SIDES,(j+1)%SIDES,j);const a=(RINGS-1)*SIDES;ropeIndices.push(RINGS*SIDES+1,a+j,a+(j+1)%SIDES)}
 ropeGeometry.setIndex(ropeIndices);const rope=make('rope',ropeGeometry,cotton)
 const colors=[0x5079be,0xf6f0dd,0xd76054,0x659e76,0xe9c257],names=['blue','white','red','green','yellow'],syllables=[['OM'],['MA'],['NI'],['PAD','ME'],['HUM']]
 const flags=names.map((name,i)=>{const material=createRitualMaterial({color:colors[i]!,roughness:.94}, { kind: 'cloth', strength: .22, fiber: 'linen' });material.map=print(syllables[i]!);const mesh=make(name,clothGeometry(),material);mesh.userData.mantra=syllables[i]!.join(' ');return mesh})
 let time=0;const left=V(),right=V(),start=V(),end=V(),points:THREE.Vector3[]=[],lengths:number[]=[]
 const curve=(t:number,sag:number)=>start.clone().lerp(end,t).add(V(0,-4*sag*t*(1-t),0))
 function sample(sag:number){let length=0,previous=start.y;const dx=(end.x-start.x)/64,dz=(end.z-start.z)/64;for(let i=1;i<=64;i++){const t=i/64,y=start.y+(end.y-start.y)*t-4*sag*t*(1-t);length+=Math.hypot(dx,y-previous,dz);previous=y}return length}
 // Lift inside the loop, withdraw beyond the peg tip, carry, insert and lower onto the new peg.
 const transfer=(from:THREE.Vector3,to:THREE.Vector3,t:number)=>{
  const route=[from.clone().add(V(0,-.015,0)),from,from.clone().add(V(0,0,.10)),to.clone().add(V(0,0,.10)),to,to.clone().add(V(0,-.015,0))],stops=[0,.12,.25,.70,.85,1]
  let i=0;while(i<4&&t>stops[i+1]!)i++;return route[i]!.clone().lerp(route[i+1]!,THREE.MathUtils.clamp((t-stops[i]!)/(stops[i+1]!-stops[i]!),0,1))
 }
 function along(distance:number){let k=1;while(k<64&&lengths[k]!<distance)k++;return points[k-1]!.clone().lerp(points[k]!,THREE.MathUtils.clamp((distance-lengths[k-1]!)/(lengths[k]!-lengths[k-1]!),0,1))}
 function cloth(){
  flags.forEach((mesh,i)=>{const center=(.14+i*.18)*LENGTH,origin=along(center).add(V(0,-H/2,0));mesh.position.copy(origin);const p=mesh.geometry.getAttribute('position')
   for(let side=0;side<2;side++)for(let y=0;y<=NY;y++)for(let x=0;x<=NX;x++){const u=x/NX,v=y/NY,q=along(center+(u-.5)*W).add(V(0,-v*H,.035*Math.sin(Math.PI*v)*Math.sin(2*Math.PI*v)*Math.sin(time*1.8+u*3+i)));
    q.z+=(side===0?1:-1)*.003;q.sub(origin);p.setXYZ(side*COUNT+y*(NX+1)+x,q.x,q.y,q.z)
   }
   ;(mesh.geometry.userData.edgeSources as number[]).forEach((source,i)=>p.setXYZ(COUNT*2+i,p.getX(source),p.getY(source),p.getZ(source)))
   p.needsUpdate=true;mesh.geometry.computeVertexNormals();mesh.geometry.computeBoundingSphere()
  })
 }
 function pose(checkpoint:number,amount:number,_effects=true){
  if(checkpoint<3&&amount>=1){pose(checkpoint+1,0);return}
  const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
  const fold=checkpoint<1?0:checkpoint>1?1:THREE.MathUtils.clamp((t-.25)/.45,0,1);temporarySupport.rotation.y=-Math.PI/2*fold*fold*(3-2*fold)
  left.copy(checkpoint===0?transfer(V(-1.15,1.50,.12),V(-1.15,1.85,.12),t):V(-1.15,1.835,.12))
  right.copy(checkpoint===0?V(.65,1.485,.12):checkpoint===1?transfer(V(.65,1.50,.12),V(1.15,1.50,.12),t):checkpoint===2?transfer(V(1.15,1.50,.12),V(1.15,1.85,.12),t):V(1.15,1.835,.12))
  rebuild()
 }
 function rebuild(){
  loops[0]!.position.copy(left);loops[1]!.position.copy(right);start.copy(left).add(V(.060,0,0));end.copy(right).add(V(-.060,0,0))
  let lo=0,hi=1.5;for(let i=0;i<25;i++){const middle=(lo+hi)/2;if(sample(middle)<LENGTH)lo=middle;else hi=middle}
  points.length=lengths.length=0;lengths.push(0);for(let i=0;i<=64;i++){points.push(curve(i/64,(lo+hi)/2));if(i)lengths.push(lengths[i-1]!+points[i]!.distanceTo(points[i-1]!))}
  const p=ropeGeometry.getAttribute('position');for(let i=0;i<RINGS;i++){const tangent=points[Math.min(64,i+1)]!.clone().sub(points[Math.max(0,i-1)]!).normalize(),normal=V(-tangent.y,tangent.x,0).normalize(),binormal=tangent.clone().cross(normal)
   for(let j=0;j<SIDES;j++){const theta=j/SIDES*Math.PI*2,q=points[i]!.clone().addScaledVector(normal,.012*Math.cos(theta)).addScaledVector(binormal,.012*Math.sin(theta));p.setXYZ(i*SIDES+j,q.x,q.y,q.z)}
  }
  p.setXYZ(RINGS*SIDES,start.x,start.y,start.z);p.setXYZ(RINGS*SIDES+1,end.x,end.y,end.z);p.needsUpdate=true;ropeGeometry.computeVertexNormals();ropeGeometry.computeBoundingSphere();cloth();root.updateMatrixWorld(true)
 }
 function holdEnd(index:0|1,position:THREE.Vector3){
  if(![position.x,position.y,position.z].every(Number.isFinite))return
  const fixed=(index===0?right:left).clone().add(V(index===0?-.060:.060,0,0))
  const offset=V(index===0?.060:-.060,0,0),desired=position.clone(),moving=index===0?left:right
  for(let attempt=0;attempt<16;attempt++){
   const delta=desired.clone().add(offset).sub(fixed)
   // The string can become taut, but cannot stretch to follow an unreachable pointer.
   if(delta.length()>LENGTH-.001)delta.setLength(LENGTH-.001)
   moving.copy(fixed).add(delta).sub(offset);rebuild()
   const clearance=.055+H-Math.min(...points.map(point=>point.y))
   if(clearance<=0)break
   // Lifting the moving end preserves the established off-ground presentation;
   // a low pointer cannot lay the attached flags through the ground.
   desired.copy(moving);desired.y+=clearance*2+.01
  }
 }
 pose(0,0)
 return{root,flags,rope,loops,pegs,temporarySupport,left,right,points,lengths,pose,holdEnd,tick:(dt:number)=>{time+=dt;cloth()},targets:[flags[0]!,flags[4]!,flags[4]!],roots:[flags[0]!,flags[4]!,flags[4]!],anchors:[V(0,0,.004),V(0,0,.004),V(0,0,.004)]}
}
