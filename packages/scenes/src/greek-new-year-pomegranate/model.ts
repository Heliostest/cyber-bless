import * as THREE from 'three'

const R=.38,inner=.32,flat=.92,parts=6,detail=24,slices=8
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
function skin(){const w=128,h=64,data=new Uint8Array(w*h*4);for(let y=0;y<h;y++)for(let x=0;x<w;x++){const i=(y*w+x)*4,n=((x*17+y*31)%23)-11,m=Math.sin(x*.19)*Math.sin(y*.27);data[i]=190+n;data[i+1]=60+n+m*8;data[i+2]=64+n*.5;data[i+3]=255}const map=new THREE.DataTexture(data,w,h);map.colorSpace=THREE.SRGBColorSpace;map.needsUpdate=true;return map}
function surface(i:number){const positions:number[]=[],uvs:number[]=[],groups:{start:number;count:number;materialIndex:number}[]=[]
 const p=(r:number,k:number,j:number)=>{const phi=Math.PI*k/detail,a=(i+j/slices)*2*Math.PI/parts,f=1+.035*Math.cos(6*a)*Math.sin(phi)**2;return V(r*Math.sin(phi)*Math.cos(a)*f,r*Math.cos(phi)*flat,r*Math.sin(phi)*Math.sin(a)*f)}
 const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,normal:THREE.Vector3)=>{const cross=b.clone().sub(a).cross(c.clone().sub(a));if(cross.lengthSq()<1e-20)return;if(cross.dot(normal)<0)[b,c]=[c,b];for(const q of[a,b,c]){positions.push(...q.toArray());uvs.push(Math.atan2(q.z,q.x)/(2*Math.PI)+.5,q.y/(2*R*flat)+.5)}}
 for(const[r,inward]of[[R,false],[inner,true]] as const){const begin=positions.length/3;for(let k=0;k<detail;k++)for(let j=0;j<slices;j++){const a=p(r,k,j),b=p(r,k+1,j),c=p(r,k+1,j+1),d=p(r,k,j+1),n=a.clone().add(b).add(c).add(d);n.y/=flat*flat;if(inward)n.negate();tri(a,b,c,n);tri(a,c,d,n)}groups.push({start:begin,count:positions.length/3-begin,materialIndex:inward?1:0})}
 const begin=positions.length/3;for(const j of[0,slices]){const a=(i+j/slices)*2*Math.PI/parts,n=V(-Math.sin(a),0,Math.cos(a)).multiplyScalar(j===0?-1:1);for(let k=0;k<detail;k++){const a=p(R,k,j),b=p(inner,k,j),c=p(inner,k+1,j),d=p(R,k+1,j);tri(a,b,c,n);tri(a,c,d,n)}}groups.push({start:begin,count:positions.length/3-begin,materialIndex:1})
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));for(const q of groups)g.addGroup(q.start,q.count,q.materialIndex);g.computeVertexNormals();g.computeBoundingBox();return g
}
function calyx(){const p:number[]=[],rim=Array.from({length:10},(_,i)=>{const a=i*Math.PI/5,r=i%2?.052:.095;return V(r*Math.cos(a),i%2?.045:.135,r*Math.sin(a))}),bottom=rim.map(q=>V(q.x,0,q.z));const tri=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3,n:THREE.Vector3)=>{if(b.clone().sub(a).cross(c.clone().sub(a)).dot(n)<0)[b,c]=[c,b];for(const q of[a,b,c])p.push(q.x,q.y+R*flat,q.z)};for(let i=0;i<10;i++){const j=(i+1)%10;tri(V(0,.018,0),rim[i]!,rim[j]!,V(0,1,0));tri(V(0,0,0),bottom[i]!,bottom[j]!,V(0,-1,0));const n=rim[i]!.clone().add(rim[j]!);n.y=0;tri(bottom[i]!,rim[i]!,rim[j]!,n);tri(bottom[i]!,rim[j]!,bottom[j]!,n)}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.computeVertexNormals();return g}

/** An original six-piece rind around real opaque arils; deterministic authored fracture. */
export function createPomegranateModel(){
 const root=new THREE.Group();root.name='pomegranate-subject';const fruit=new THREE.Group();fruit.name='pomegranate-fruit';root.add(fruit)
 const texture=skin(),red=new THREE.MeshStandardMaterial({map:texture,roughness:.66}),cream=new THREE.MeshStandardMaterial({color:0xf2d7a1,roughness:.91}),stone=new THREE.MeshStandardMaterial({color:0xd2c3a3,roughness:.97}),wood=new THREE.MeshStandardMaterial({color:0x3e878e,roughness:.83}),frame=new THREE.MeshStandardMaterial({color:0xf0e6c8,roughness:.94}),bronze=new THREE.MeshStandardMaterial({color:0xa68a4f,metalness:.65,roughness:.35}),ruby=new THREE.MeshStandardMaterial({color:0xbb2850,roughness:.32})
 const make=(name:string,g:THREE.BufferGeometry,material:THREE.Material|THREE.Material[],parent:THREE.Object3D=root)=>{const m=new THREE.Mesh(g,material);m.name=name;m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const floor=.2,step=make('pomegranate-threshold',new THREE.BoxGeometry(3.6,.2,3.5),stone);step.position.set(0,.1,.5)
 const door=make('pomegranate-door',new THREE.BoxGeometry(2,1.8,.14),wood);door.position.set(0,1.1,-1.15)
 const posts=[-1.14,1.14].map((x,i)=>{const m=make('pomegranate-post-'+i,new THREE.BoxGeometry(.24,2,.30),frame);m.position.set(x,1.2,-1.15);return m})
 const header=make('pomegranate-header',new THREE.BoxGeometry(2.55,.18,.30),frame);header.position.set(0,2.21,-1.15)
 const knob=make('pomegranate-knob',new THREE.SphereGeometry(.055,16,12),bronze);knob.position.set(.65,1.12,-1.045)
 const peels=Array.from({length:parts},(_,i)=>make('pomegranate-peel-'+i,surface(i),[red,cream],fruit)),crown=make('pomegranate-crown',calyx(),red,fruit)
 const seeds=Array.from({length:18},(_,i)=>make('pomegranate-aril-'+i,new THREE.IcosahedronGeometry(.055,1).scale(.68,1,.85),ruby,fruit))
 const seedHome=seeds.map((_,i)=>{const a=i%9*2*Math.PI/9+(i<9?0:.32);return V(.18*Math.cos(a),i<9?-.085:.085,.18*Math.sin(a))})
 const seedEnd=seeds.map((o,i)=>{const a=i%9*2*Math.PI/9+(i<9?.15:.47),r=i<9?.24:.46;o.geometry.computeBoundingBox();return V(r*Math.cos(a),floor-o.geometry.boundingBox!.min.y,r*Math.sin(a)+.65)})
 const initial=V(-.7,floor+R*flat,.65),raised=V(-.7,1.20,.65),aligned=V(0,1.20,.65),impact=V(0,floor+R*flat,.65),identity=new THREE.Quaternion(),axis=new THREE.Vector3(),q=new THREE.Quaternion(),vertex=new THREE.Vector3()
 const minY=(o:THREE.Mesh,rotation:THREE.Quaternion)=>{let y=Infinity;const p=o.geometry.attributes.position!;for(let k=0;k<p.count;k++)y=Math.min(y,vertex.fromBufferAttribute(p,k).applyQuaternion(rotation).y);return y}
 const peelRadius=[1.02,1.05,.98,1.08,1.02,1.04],mix=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>fruit.position.copy(a).lerp(b,t)
 function pose(checkpoint:number,amount:number){const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1);for(const o of peels){o.position.set(0,0,0);o.quaternion.copy(identity)}crown.position.set(0,0,0);crown.quaternion.copy(identity);seeds.forEach((o,i)=>{o.position.copy(seedHome[i]!);o.quaternion.copy(identity)})
  let crack=0;if(checkpoint===0)mix(initial,raised,t);else if(checkpoint===1)mix(raised,aligned,t);else{const n=checkpoint>=3?1:t;if(n<=.2){fruit.position.copy(aligned);fruit.position.y+=.12*n/.2}else if(n<=.55){const u=(n-.2)/.35;fruit.position.copy(aligned);fruit.position.y=aligned.y+.12-(aligned.y+.12-impact.y)*u*u}else{fruit.position.copy(impact);crack=(n-.55)/.45}}
  if(crack>0){for(let i=0;i<parts;i++){const a=(i+.5)*2*Math.PI/parts,o=peels[i]!,r=peelRadius[i]!*crack;axis.set(-Math.sin(a),0,Math.cos(a));q.setFromAxisAngle(axis,-Math.PI/2*crack);o.quaternion.copy(q);o.position.set(r*Math.cos(a),floor-minY(o,q)-impact.y+.14*4*crack*(1-crack),r*Math.sin(a))}
   // The calyx tears upward clear of the opening rind, then lands on the stone.
   crown.position.set(-1.55*crack,(floor-minY(crown,identity)-impact.y)*crack+1.15*Math.sin(Math.PI*crack),1.1*crack)
   const u=THREE.MathUtils.clamp((crack-.35)/.65,0,1);seeds.forEach((o,i)=>{const target=seedEnd[i]!.clone().sub(impact);o.position.copy(seedHome[i]!).lerp(target,u);o.position.y+=.24*4*u*(1-u)})
  }root.updateMatrixWorld(true)
 }
 pose(0,0);let disposed=false;const dispose=()=>{if(!disposed){disposed=true;texture.dispose()}}
 return{root,subject:root,fruit,peels,seeds,crown,step,door,posts,header,knob,texture,floor,initial,raised,aligned,impact,pose,dispose,targets:[fruit,fruit,fruit],roots:[fruit,fruit,fruit],anchors:[[0,.02,.35],[0,.02,.35],[0,.02,.35]] as [number,number,number][]}
}
