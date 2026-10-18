import * as THREE from 'three'
import {toCreasedNormals} from 'three/addons/utils/BufferGeometryUtils.js'

/** Original utilitarian metate. Assisted contact and grain transformation, not a fracture or food-process simulation. */
export function createMetateModel(){
 const subject=new THREE.Group();subject.name='metate-subject'
 const stone=new THREE.MeshStandardMaterial({color:0x747a70,roughness:.94,vertexColors:true}),manoMat=new THREE.MeshStandardMaterial({color:0x686b64,roughness:.93,vertexColors:true})
 const maize=new THREE.MeshStandardMaterial({color:0xdfbe72,roughness:.9}),meal=new THREE.MeshStandardMaterial({color:0xebd5a0,roughness:.95})
 const add=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=subject)=>{const m=new THREE.Mesh(g,mat);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const rows=Array.from({length:65},(_,i)=>Math.fround(-1.6+i*.05)),ys=rows.map(z=>Math.fround(.72+.12*z*z-.16*z)),cols=17
 const heightAt=(z:number)=>{let i=THREE.MathUtils.clamp(Math.floor((z+1.6)/.05),0,rows.length-2);while(i>0&&z<rows[i]!)i--;while(i<rows.length-2&&z>rows[i+1]!)i++;return THREE.MathUtils.lerp(ys[i]!,ys[i+1]!,THREE.MathUtils.clamp((z-rows[i]!)/(rows[i+1]!-rows[i]!),0,1))}
 const width=(z:number)=>Math.abs(z)<=1.36?1.34:1.10+Math.sqrt(Math.max(0,.24*.24-(Math.abs(z)-1.36)**2))
 const tint=(g:THREE.BufferGeometry,crease=false)=>{const p=g.getAttribute('position'),c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const v=.88+.12*((Math.sin(p.getX(i)*127.1+p.getY(i)*311.7+p.getZ(i)*74.7)*43758.5453)%1+1)/2;c.set([v,v,v],i*3)}g.setAttribute('color',new THREE.BufferAttribute(c,3));if(crease){const result=toCreasedNormals(g,.7);if(result!==g)g.dispose();return result}g.computeVertexNormals();return g}
 const pos:number[]=[],idx:number[]=[],index=(layer:number,j:number,i:number)=>(layer*rows.length+j)*cols+i
 for(let layer=0;layer<2;layer++)for(let j=0;j<rows.length;j++)for(let i=0;i<cols;i++)pos.push(width(rows[j]!)*(-1+2*i/(cols-1)),ys[j]!-layer*.24,rows[j]!)
 const quad=(a:number,b:number,c:number,d:number,reverse=false)=>{idx.push(...(reverse?[a,c,b,b,c,d]:[a,b,c,b,d,c]))}
 for(let j=0;j<rows.length-1;j++)for(let i=0;i<cols-1;i++)for(let l=0;l<2;l++)quad(index(l,j,i),index(l,j+1,i),index(l,j,i+1),index(l,j+1,i+1),l===1)
 for(let i=0;i<cols-1;i++){quad(index(0,0,i),index(0,0,i+1),index(1,0,i),index(1,0,i+1));const j=rows.length-1;quad(index(0,j,i),index(0,j,i+1),index(1,j,i),index(1,j,i+1),true)}
 for(let j=0;j<rows.length-1;j++){quad(index(0,j,0),index(0,j+1,0),index(1,j,0),index(1,j+1,0),true);const i=cols-1;quad(index(0,j,i),index(0,j+1,i),index(1,j,i),index(1,j+1,i))}
 const bedGeometry=new THREE.BufferGeometry();bedGeometry.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));bedGeometry.setIndex(idx)
 const bed=add('metate-concave-bed',tint(bedGeometry,true),stone)
 const feet:THREE.Mesh[]=[]
 for(const[x,z]of[[-.85,1.28],[.85,1.28],[0,-1.02]]){
  const positions:number[]=[],indices:number[]=[],n=12
  for(let l=0;l<2;l++)for(let k=0;k<n;k++){const a=k*Math.PI*2/n,r=l===0?.17:.23,px=x!+r*Math.cos(a),pz=z!+r*Math.sin(a);positions.push(px,l===0?0:heightAt(pz)-.21,pz)}
  positions.push(x!,0,z!,x!,heightAt(z!)-.21,z!)
  for(let k=0;k<n;k++){const next=(k+1)%n;indices.push(k,n+k,next,n+k,n+next,next,2*n,k,next,2*n+1,n+next,n+k)}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);feet.push(add('metate-foot-'+feet.length,tint(g,true),stone))
 }
 const joint=new THREE.Group();joint.name='mano-joint';subject.add(joint)
 const radius=.19,halfLength=1.075,bodyGeometry=new THREE.CylinderGeometry(radius,radius,halfLength*2,48);bodyGeometry.rotateZ(Math.PI/2)
 const body=add('mano-grinding-stone',tint(bodyGeometry),manoMat,joint)
 // Derive the contact polygon from actual Float32 mesh vertices, including its facet phase.
 const radial:THREE.Vector2[]=[],seen=new Set<string>(),bp=bodyGeometry.getAttribute('position')
 for(let i=0;i<bp.count;i++){const y=bp.getY(i),z=bp.getZ(i),key=[y,z].map(v=>Math.round(v*1e6)).join();if(Math.hypot(y,z)>.1&&!seen.has(key)){seen.add(key);radial.push(new THREE.Vector2(z,y))}}
 radial.sort((a,b)=>Math.atan2(a.y,a.x)-Math.atan2(b.y,b.x))
 const grains=new THREE.InstancedMesh(new THREE.SphereGeometry(.04,8,6),maize,26),powder=new THREE.InstancedMesh(new THREE.SphereGeometry(.04,8,4),meal,96)
 grains.name='metate-maize-grains';powder.name='metate-fine-grains';for(const m of[grains,powder]){m.castShadow=m.receiveShadow=true;m.frustumCulled=false;subject.add(m)}
 const scatter=(i:number,total:number,x:number,z:number)=>{const r=Math.sqrt((i+.35)/total),a=i*2.3999632297;return new THREE.Vector2(x*r*Math.cos(a),z*r*Math.sin(a))}
 const grainPoints=Array.from({length:26},(_,i)=>scatter(i,26,.78,.36))
 const powderPoints=Array.from({length:96},(_,i)=>scatter(i,96,.88,.43))
 const object=new THREE.Object3D(),state={z:-.8,y:0,lift:0,angle:0},checkpoints=[-.8,.65,-.8,-1.32]
 const pose=(at:number,n:number)=>{
  n=THREE.MathUtils.clamp(n,0,1);if(at>=3){at=2;n=1}
  const z=n===0?checkpoints[at]!:n===1?checkpoints[at+1]!:THREE.MathUtils.lerp(checkpoints[at]!,checkpoints[at+1]!,n)
  const lift=at===2&&n>0&&n<1?.12*Math.sin(Math.PI*n):0,angle=(z+.8)*.35,c=Math.cos(angle),s=Math.sin(angle)
  const poly=radial.map(p=>new THREE.Vector2(c*p.x+s*p.y,c*p.y-s*p.x))
  let y=-Infinity;for(const p of poly)y=Math.max(y,heightAt(z+p.x)-p.y+.001)
  const minZ=Math.min(...poly.map(p=>p.x)),maxZ=Math.max(...poly.map(p=>p.x))
  for(let j=Math.max(0,Math.floor((z+minZ+1.6)/.05));j<rows.length&&rows[j]!<=z+maxZ;j++){
   const dz=rows[j]!-z
   for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!;if(dz<Math.min(a.x,b.x)||dz>Math.max(a.x,b.x)||Math.abs(b.x-a.x)<1e-12)continue;y=Math.max(y,ys[j]!-THREE.MathUtils.lerp(a.y,b.y,(dz-a.x)/(b.x-a.x))+.001)}
  }
  y+=lift;joint.position.set(0,y,z);joint.rotation.x=angle
  const lowerAt=(dz:number)=>{let v=Infinity;for(let i=0;i<poly.length;i++){const a=poly[i]!,b=poly[(i+1)%poly.length]!;if(dz<Math.min(a.x,b.x)-1e-12||dz>Math.max(a.x,b.x)+1e-12)continue;if(Math.abs(a.x-b.x)<1e-12)v=Math.min(v,a.y,b.y);else v=Math.min(v,THREE.MathUtils.lerp(a.y,b.y,(dz-a.x)/(b.x-a.x)))}return y+v}
  const process=(pz:number)=>at===0?.6*THREE.MathUtils.clamp((z+.08-pz)/.16,0,1):at===1?.6+.4*THREE.MathUtils.clamp((pz+.08-z)/.16,0,1):1
  const fit=(mesh:THREE.InstancedMesh,i:number,p:THREE.Vector2,rx:number,ry:number,rz:number)=>{
   let floor=0,ceiling=Infinity
   for(let iteration=0;iteration<9;iteration++){
    floor=Math.max(heightAt(p.y-rz),heightAt(p.y+rz));ceiling=Infinity
    const lo=Math.max(p.y-rz-z,minZ),hi=Math.min(p.y+rz-z,maxZ)
    if(lo<=hi){ceiling=Math.min(lowerAt(lo),lowerAt(hi));for(const q of poly)if(q.x>=lo&&q.x<=hi)ceiling=Math.min(ceiling,y+q.y)}
    if(ceiling-floor>.0005)break;rx*=.4;rz*=.4
   }
   ry=Math.max(.00001,Math.min(ry,(ceiling-floor-.00015)/2))
   object.position.set(p.x,floor+ry+.00002,p.y);object.rotation.set(0,i*.713,0)
   // Equal x/z radii keep the footprint used above conservative under rotation.
   object.scale.set(rx/.04,ry/.04,rz/.04);object.updateMatrix();mesh.setMatrixAt(i,object.matrix)
  }
  for(const[i,p]of grainPoints.entries()){const q=process(p.y),r=THREE.MathUtils.lerp(.048,.013,q);fit(grains,i,p,r,THREE.MathUtils.lerp(.027,.005,q),r)}
  for(const[i,p]of powderPoints.entries()){const q=process(p.y),r=.026*q+.00001;fit(powder,i,p,r,.003*q+.00001,r)}
  grains.instanceMatrix.needsUpdate=powder.instanceMatrix.needsUpdate=true;Object.assign(state,{z,y,lift,angle});subject.updateMatrixWorld(true)
 }
 pose(0,0)
 return{subject,bed,feet,joint,body,grains,powder,rows,radial,radius,halfLength,heightAt,state,pose,targets:[body,body,body],roots:[joint,joint,joint],anchors:[[.14,.18,.06],[.14,.18,.06],[.14,.18,.06]] as [number,number,number][]}
}
