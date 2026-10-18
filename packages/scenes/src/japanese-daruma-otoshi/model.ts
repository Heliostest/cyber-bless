import * as THREE from 'three'

/** Original wooden toy; contact, removal and settling follow assisted rigid paths. */
export function createDarumaOtoshiModel(){
 const root=new THREE.Group();root.name='otoshi-subject'
 const upper=new THREE.Group();upper.name='otoshi-upper';root.add(upper)
 const mallet=new THREE.Group();mallet.name='otoshi-mallet';root.add(mallet)
 const wood=new THREE.MeshStandardMaterial({color:'#b9966c',roughness:.83}),coral=new THREE.MeshStandardMaterial({color:'#bd6757',roughness:.76}),teal=new THREE.MeshStandardMaterial({color:'#75b4a4',roughness:.81}),ochre=new THREE.MeshStandardMaterial({color:'#d7b16b',roughness:.82}),cream=new THREE.MeshStandardMaterial({color:'#e9dfc6',roughness:.88}),inkMaterial=new THREE.MeshStandardMaterial({color:'#574638',roughness:.9})
 const mesh=(name:string,g:THREE.BufferGeometry,material:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,material);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const geometry=(vertices:number[],indices:number[])=>{const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();return g}
 const profile:[[number,number],...[number,number][]]=[[.31,1.24],[.42,1.31],[.45,1.48],[.41,1.75],[.28,1.91],[.06,1.98]]
 const radiusAt=(y:number)=>{for(let i=1;i<profile.length;i++){const [r,b]=profile[i]!,[q,a]=profile[i-1]!;if(y<=b)return q+(r-q)*(y-a)/(b-a)}return profile.at(-1)![0]}
 const body=()=>{const n=48,v:number[]=[],a:number[]=[];for(const[r,y]of profile)for(let i=0;i<n;i++){const t=i*2*Math.PI/n;v.push(r*Math.cos(t),y,r*Math.sin(t))}for(let k=0;k<profile.length-1;k++)for(let i=0;i<n;i++){const j=(i+1)%n,b=k*n+i,c=(k+1)*n+i,d=(k+1)*n+j,e=k*n+j;a.push(b,c,d,b,d,e)}for(const top of[false,true]){const[r,y]=top?profile.at(-1)!:profile[0]!,center=v.length/3;v.push(0,y,0);for(let i=0;i<n;i++){const t=i*2*Math.PI/n;v.push(r*Math.cos(t),y,r*Math.sin(t))}for(let i=0;i<n;i++){const b=center+1+i,c=center+1+(i+1)%n;a.push(center,top?c:b,top?b:c)}}return geometry(v,a)}
 // Every paint patch is a closed curved layer following the actual head surface.
 const patch=(cx:number,cy:number,rx:number,ry:number,front:number,back:number,rotation=0)=>{const n=48,rings=8,v:number[]=[],a:number[]=[],count=1+rings*n;for(const zOffset of[front,back]){const put=(r:number,t:number)=>{const u=r*rx*Math.cos(t),w=r*ry*Math.sin(t),x=cx+u*Math.cos(rotation)-w*Math.sin(rotation),y=cy+u*Math.sin(rotation)+w*Math.cos(rotation),z=Math.sqrt(radiusAt(y)**2-x*x)+zOffset;v.push(x,y,z)};put(0,0);for(let r=1;r<=rings;r++)for(let i=0;i<n;i++)put(r/rings,i*2*Math.PI/n)}for(let side=0;side<2;side++){const offset=side*count,tri=(x:number,y:number,z:number)=>side===0?a.push(x+offset,y+offset,z+offset):a.push(x+offset,z+offset,y+offset);for(let i=0;i<n;i++)tri(0,1+i,1+(i+1)%n);for(let r=1;r<rings;r++)for(let i=0;i<n;i++){const j=(i+1)%n,b=1+(r-1)*n+i,c=1+r*n+i,d=1+r*n+j,e=1+(r-1)*n+j;tri(b,c,d);tri(b,d,e)}}const boundary=1+(rings-1)*n;for(let i=0;i<n;i++){const x=boundary+i,y=boundary+(i+1)%n,first=v.length/3;for(const index of[x,x+count,y+count,y])v.push(v[index*3]!,v[index*3+1]!,v[index*3+2]!);a.push(first,first+1,first+2,first,first+2,first+3)}return geometry(v,a)}
 const blocks=[ochre,teal,coral].map((material,i)=>mesh('otoshi-block-'+i,new THREE.CylinderGeometry(.42,.42,.4,48).translate(0,.24+.4*i,0),material,i===0?root:upper))
 const head=mesh('otoshi-head',body(),coral,upper)
 const face=mesh('otoshi-face',patch(0,1.61,.30,.245,.012,-.018),cream,upper)
 const ink=[[-.105,1.67,.028,.036,0],[.105,1.67,.028,.036,0],[-.12,1.745,.075,.018,-.23],[.12,1.745,.075,.018,.23],[0,1.54,.12,.026,0],[0,1.435,.075,.055,0]].map(([x,y,rx,ry,angle],i)=>mesh('otoshi-ink-'+i,patch(x!,y!,rx!,ry!, .022,.003,angle),inkMaterial,upper))
 const malletHead=mesh('otoshi-mallet-head',new THREE.CylinderGeometry(.18,.18,.34,32).rotateZ(Math.PI/2),wood,mallet)
 const handle=mesh('otoshi-mallet-handle',new THREE.CylinderGeometry(.045,.045,.9,24).rotateX(Math.PI/2).translate(0,0,.45),wood,mallet)
 const mix=(a:number,b:number,t:number)=>t<=0?a:t>=1?b:a+(b-a)*t
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1);let x=-.96,y=.24,slide=0,drop=0;if(step===0)y=mix(.68,.24,t);else if(step===1){slide=mix(0,1.2,THREE.MathUtils.clamp((t-.2)/.45,0,1));x=t<=.2?mix(-.96,-.59,t/.2):slide===1.2?.61:slide-.59;drop=mix(0,.4,THREE.MathUtils.clamp((t-.7)/.3,0,1))}else{x=.61;y=mix(.24,.70,step===2?t:1);slide=1.2;drop=.4}mallet.position.set(x,y,0);blocks[0]!.position.x=slide;upper.position.y=drop===0?0:-drop;root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject:root,upper,mallet,malletHead,handle,blocks,head,face,ink,pose,targets:[handle,handle,handle],roots:[handle,handle,handle],anchors:[[0,0,.6],[0,0,.6],[0,0,.6]] as [number,number,number][]}
}
