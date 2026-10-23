import * as THREE from 'three'

function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return g
}
function cappedCurve(points:[number,number,number][],radius:number){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=18,sides=8,frames=curve.computeFrenetFrames(segments,false),vertices:number[]=[],indices:number[]=[]
 for(let i=0;i<=segments;i++){const center=curve.getPoint(i/segments);for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,p=center.clone().addScaledVector(frames.normals[i]!,Math.cos(a)*radius).addScaledVector(frames.binormals[i]!,Math.sin(a)*radius);vertices.push(p.x,p.y,p.z)}}
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,c,b,b,c,d)}
 const start=vertices.length/3;vertices.push(...curve.getPoint(0).toArray(),...curve.getPoint(1).toArray());for(let j=0;j<sides;j++)indices.push(start,j,(j+1)%sides,start+1,segments*sides+(j+1)%sides,segments*sides+j)
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);return g
}
export function createWishingMalletModel(){
 const root=new THREE.Group();root.name='uchide-subject'
 const materials=new Map<string,THREE.MeshStandardMaterial>(),material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:color==='#b44f3d'?.38:.80,metalness:color==='#d9b56b'?.35:0}));return materials.get(color)!}
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,color:string,p:[number,number,number])=>{const m=new THREE.Mesh(solid(g),material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const headRest=mesh(root,'uchide-head-rest',new THREE.BoxGeometry(1.55,.20,.65),'#94714d',[-.55,.10,-.45])
 const handleRest=mesh(root,'uchide-handle-rest',new THREE.BoxGeometry(.30,.46,.30),'#94714d',[-.55,.23,1.15])
 const actor=new THREE.Group();actor.name='uchide-mallet';root.add(actor)
 // One closed, gently barrel-shaped original mallet head, capped at both ends.
 const profile=[[0,-.68],[.24,-.68],[.29,-.60],[.34,-.40],[.36,0],[.34,.40],[.29,.60],[.24,.68],[0,.68]].map(([r,y])=>new THREE.Vector2(r!,y!))
 const barrel=new THREE.LatheGeometry(profile,24);barrel.rotateZ(Math.PI/2)
 const head=mesh(actor,'uchide-barrel-head',barrel,'#b44f3d',[0,.36,-1.15])
 for(const side of[-1,1]){
  const cap=new THREE.CylinderGeometry(.245,.245,.018,24);cap.rotateZ(Math.PI/2);mesh(actor,`uchide-head-cap-${side}`,cap,'#d9b56b',[side*.685,.36,-1.15])
  const band=mesh(actor,`uchide-head-band-${side}`,new THREE.TorusGeometry(.311,.012,6,24),'#d9b56b',[side*.56,.36,-1.15]);band.rotation.y=Math.PI/2
 }
 const shaft=new THREE.CylinderGeometry(.065,.065,1.60,16);shaft.rotateX(Math.PI/2)
 const handle=mesh(actor,'uchide-wood-handle',shaft,'#a87948',[0,.36,-.35])
 for(const[i,z]of[-.1,0,.1,.2].entries())mesh(actor,`uchide-grip-ring-${i}`,new THREE.TorusGeometry(.067,.008,6,16),'#815b36',[0,.36,z])
 const pommel=mesh(actor,'uchide-handle-pommel',new THREE.SphereGeometry(.10,16,10),'#a87948',[0,.36,.45])
 mesh(actor,'uchide-tassel-cord',cappedCurve([[0,.36,.50],[0,.30,.62],[0,.18,.70]],.016),'#b74434',[0,0,0])
 mesh(actor,'uchide-tassel-collar',new THREE.CylinderGeometry(.045,.045,.05,12),'#d9b56b',[0,.165,.70])
 for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh(actor,`uchide-tassel-strand-${i}`,new THREE.ConeGeometry(.012,.14,6),'#b74434',[Math.cos(a)*.025,.07,.70+Math.sin(a)*.025])}
 const pose=(step:number,t:number)=>{const n=THREE.MathUtils.clamp(t,0,1);actor.position.set(-.55,step===0?.20+.65*n:step===1?.85:step===2?.85-.65*n:.20,.70);actor.rotation.set(0,step===1?-.35*Math.sin(Math.PI*2*n):0,0);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,actor,head,handle,pommel,headRest,handleRest,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[0,.425,-.2],[0,.425,-.2],[0,.425,-.2]] as[number,number,number][],dispose(){}}
}
