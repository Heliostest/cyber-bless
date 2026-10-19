import * as THREE from 'three'
import {STAMP_ROWS} from './stamp'

/** Original coastal close view; one visitor throw with authored assistance. */
export function createUndamaModel(){
 const root=new THREE.Group();root.name='undama-subject'
 const radius=.13,cx=.65,cz=-.45,floor=.25,n=64
 const material=new THREE.MeshStandardMaterial({color:'#a99b81',roughness:.97})
 const ledgeMaterial=new THREE.MeshStandardMaterial({color:'#c4b49a',roughness:.96})
 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;root.add(o);return o}
 const closed=(loops:THREE.Vector3[][],bottom:THREE.Vector3,top:THREE.Vector3)=>{
  const p:number[]=[],idx:number[]=[]
  // Separate surface strips retain proper cap/rim normals without changing shared positions.
  for(let k=0;k<loops.length-1;k++){const base=p.length/3;for(const loop of[loops[k]!,loops[k+1]!])for(const v of loop)p.push(v.x,v.y,v.z);for(let i=0;i<n;i++){const j=(i+1)%n;idx.push(base+i,base+n+i,base+n+j,base+i,base+n+j,base+j)}}
  for(const[loop,center,up]of[[loops[0]!,bottom,false],[loops.at(-1)!,top,true]] as const){const b=p.length/3;p.push(center.x,center.y,center.z);for(const v of loop)p.push(v.x,v.y,v.z);for(let i=0;i<n;i++){const a=b+1+i,c=b+1+(i+1)%n;idx.push(b,up?c:a,up?a:c)}}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(p,3));g.setIndex(idx);g.computeVertexNormals();return g
 }
 const loop=(kind:number)=>Array.from({length:n},(_,i)=>{const t=i*2*Math.PI/n,c=Math.cos(t),s=Math.sin(t),wave=1+.035*Math.sin(3*t)+.018*Math.cos(5*t);let x:number,z:number,y:number
  if(kind<3){const a=[.94,1.12,.96][kind]!,b=[.65,.78,.66][kind]!;x=cx+a*c*wave;z=cz+b*s*wave;y=[-.30,.28,.59][kind]!+(kind===2?.022*Math.sin(2*t):0)}
  else{const half=kind===3?.28:.25,m=Math.max(Math.abs(c),Math.abs(s));x=cx+half*c/m;z=cz+half*s/m;y=kind===3?.65:floor}
  return new THREE.Vector3(x,y,z)
 })
 const rock=make('undama-rock',closed([0,1,2,3,4].map(loop),new THREE.Vector3(cx,-.30,cz),new THREE.Vector3(cx,floor,cz)),material)
 const ledgeLoops=[-.30,.5].map((y,k)=>Array.from({length:n},(_,i)=>{const t=i*2*Math.PI/n,r=1+.035*Math.sin(5*t);return new THREE.Vector3(-1.08+(k?.63:.76)*Math.cos(t)*r,y,1.02+(k?.49:.60)*Math.sin(t)*r)}))
 const ledge=make('undama-ledge',closed(ledgeLoops,new THREE.Vector3(-1.08,-.30,1.02),new THREE.Vector3(-1.08,.5,1.02)),ledgeMaterial)
 const width=256,height=128,data=new Uint8Array(width*height*4)
 for(let y=0;y<height;y++)for(let x=0;x<width;x++){const i=(y*width+x)*4;const gx=x-48,gy=109-y,ink=gx>=0&&gx<32&&gy>=0&&gy<32&&STAMP_ROWS[gy]![gx]==='1';data[i]=ink?139:205;data[i+1]=ink?80:145;data[i+2]=ink?49:94;data[i+3]=255}
 const stamp=new THREE.DataTexture(data,width,height,THREE.RGBAFormat);stamp.colorSpace=THREE.SRGBColorSpace;stamp.needsUpdate=true
 const ball=make('undama-ball',new THREE.SphereGeometry(radius,32,20),new THREE.MeshStandardMaterial({color:'#ffffff',map:stamp,roughness:.94}))
 ball.geometry.computeBoundingBox();const endY=floor-ball.geometry.boundingBox!.min.y
 const initial=new THREE.Vector3(-1.05,.5-ball.geometry.boundingBox!.min.y,1),raised=new THREE.Vector3(-1.05,1.08,1),aimed=new THREE.Vector3(-.75,1.08,1),release=new THREE.Vector3(-.83,1.14,1.14),landed=new THREE.Vector3(cx,endY,cz)
 const mix=(a:number,b:number,t:number)=>t<=0?a:t>=1?b:a+(b-a)*t
 const at=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>ball.position.set(mix(a.x,b.x,t),mix(a.y,b.y,t),mix(a.z,b.z,t))
 function pose(step:number,amount:number){const t=THREE.MathUtils.clamp(Number.isFinite(amount)?amount:0,0,1)
  if(step===0)at(initial,raised,t)
  else if(step===1)at(raised,aimed,t)
  else if(step===2){if(t<=.3)at(aimed,release,t/.3);else{const q=(t-.3)/.7,v=Math.min(1,q/.72),f=v*v*(3-2*v);ball.position.set(mix(release.x,cx,f),mix(release.y,endY,q)+.85*4*q*(1-q),mix(release.z,cz,f))}}
  else ball.position.copy(landed)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,subject:root,rock,ledge,ball,stamp,radius,floor,landed,pose,targets:[ball,ball,ball],roots:[ball,ball,ball],anchors:[[0,0,0],[0,0,0],[0,0,0]] as [number,number,number][]}
}
