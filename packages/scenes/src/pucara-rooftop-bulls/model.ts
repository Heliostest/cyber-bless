import * as THREE from 'three'

function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return g
}

// One closed, capped solid along a curve; no open TubeGeometry ends.
function curved(points:[number,number,number][],radius:number,endRadius=radius){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=18,sides=8,frames=curve.computeFrenetFrames(segments,false),vertices:number[]=[],indices:number[]=[]
 for(let i=0;i<=segments;i++){const center=curve.getPoint(i/segments),r=THREE.MathUtils.lerp(radius,endRadius,i/segments);for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,p=center.clone().addScaledVector(frames.normals[i]!,Math.cos(a)*r).addScaledVector(frames.binormals[i]!,Math.sin(a)*r);vertices.push(p.x,p.y,p.z)}}
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,c,b,b,c,d)}
 const start=vertices.length/3;vertices.push(...curve.getPoint(0).toArray(),...curve.getPoint(1).toArray());for(let j=0;j<sides;j++)indices.push(start,j,(j+1)%sides,start+1,segments*sides+(j+1)%sides,segments*sides+j)
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);return g
}

// Extrude a closed Y/Z profile along X, keeping the roof and its pad truly joined.
function crossSection(profile:[number,number][],width:number){
 const shape=new THREE.Shape(profile.map(([z,y])=>new THREE.Vector2(z,y))),g=new THREE.ExtrudeGeometry(shape,{depth:width,bevelEnabled:false,steps:1});g.rotateY(-Math.PI/2);g.translate(width/2,0,0);return g
}

export function createPucaraModel(){
 const root=new THREE.Group();root.name='pucara-subject'
 const materials=new Map<string,THREE.MeshStandardMaterial>(),material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:color==='#e6cf9d'?.48:.82}));return materials.get(color)!}
 const mesh=(parent:THREE.Object3D,name:string,source:THREE.BufferGeometry,color:string,p:[number,number,number])=>{const m=new THREE.Mesh(solid(source),material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const house=new THREE.Group();house.name='pucara-house';root.add(house)
 mesh(house,'pucara-walls',new THREE.BoxGeometry(2.65,.65,1.8),'#d8c7a6',[0,.325,0])
 const roof=mesh(house,'pucara-roof',crossSection([[-.95,.60],[0,1],[.95,.60]],2.8),'#ad6d4d',[0,0,0])
 for(const x of[-.88,.88]){mesh(house,`pucara-window-${x}`,new THREE.BoxGeometry(.39,.26,.035),'#5c706d',[x,.36,.915]);mesh(house,`pucara-window-cross-${x}`,new THREE.BoxGeometry(.028,.28,.038),'#8e6844',[x,.36,.937])}
 mesh(house,'pucara-door',new THREE.BoxGeometry(.46,.52,.04),'#866344',[0,.26,.92])
 mesh(house,'pucara-door-handle',new THREE.SphereGeometry(.025,8,6),'#d7b67a',[.14,.28,.96])
 // This original saddle-shaped pad fills the space down to the sloping roof.
 const pad=mesh(root,'pucara-ridge-pad',crossSection([[-.45,1-.4*.45/.95],[0,1],[.45,1-.4*.45/.95],[.45,1.10],[-.45,1.10]],2.10),'#98784e',[0,0,0])
 const stand=mesh(root,'pucara-low-stand',new THREE.BoxGeometry(2.10,.20,1.15),'#b5986c',[0,.10,2])
 const actor=new THREE.Group();actor.name='pucara-carrier';root.add(actor)
 const board=mesh(actor,'pucara-carrier-board',new THREE.BoxGeometry(2,.06,1.05),'#88633f',[0,.03,0])
 function bull(name:string,x:number){
  const group=new THREE.Group();group.name=name;group.position.x=x;actor.add(group)
  const clay='#e6cf9d',ochre='#a85d39',dark='#493e32'
  const ellipsoid=(part:string,p:[number,number,number],scale:[number,number,number],color=clay)=>{const m=mesh(group,`${name}-${part}`,new THREE.SphereGeometry(1,12,8),color,p);m.scale.set(...scale);return m}
  const profile=[[0,-.26],[.16,-.20],[.23,-.10],[.25,0],[.23,.10],[.16,.20],[.10,.23],[.09,.30],[.06,.30],[.07,.23],[.13,.20],[.20,.10],[.22,0],[.20,-.10],[.10,-.20],[0,-.22]].map(([r,y])=>new THREE.Vector2(r!,y!))
  const body=mesh(group,`${name}-body`,new THREE.LatheGeometry(profile,20),clay,[0,.61,0]);body.scale.z=1.6
  const legs:THREE.Mesh[]=[]
  for(const lx of[-.17,.17])for(const lz of[-.25,.25]){legs.push(mesh(group,`${name}-leg-${lx}-${lz}`,new THREE.CylinderGeometry(.057,.071,.45,10),clay,[lx,.285,lz]));mesh(group,`${name}-hoof-${lx}-${lz}`,new THREE.CylinderGeometry(.072,.072,.055,10),ochre,[lx,.0875,lz])}
  ellipsoid('neck',[0,.72,.30],[.17,.24,.17]);ellipsoid('head',[0,.88,.45],[.18,.18,.22]);ellipsoid('muzzle',[0,.79,.63],[.16,.105,.14]);
  for(const side of[-1,1]){
   ellipsoid(`eye-white-${side}`,[side*.151,.92,.53],[.047,.050,.048],'#f5e7c6');ellipsoid(`eye-${side}`,[side*.178,.927,.55],[.022,.027,.025],dark)
   const ear=ellipsoid(`ear-${side}`,[side*.22,.96,.34],[.12,.039,.066]);ear.rotation.z=side*.22
   mesh(group,`${name}-horn-${side<0?'left':'right'}`,curved([[side*.12,1.01,.36],[side*.24,1.16,.31],[side*.25,1.23,.39],[side*.20,1.25,.44]],.043,.006),ochre,[0,0,0])
   ellipsoid(`nostril-${side}`,[side*.074,.827,.749],[.023,.016,.012],dark)
   ellipsoid(`saddle-${side}`,[side*.212,.726,-.115],[.043,.059,.19],ochre)
   const rosetteZ=.025,rosetteY=.61;ellipsoid(`rosette-center-${side}`,[side*.25,rosetteY,rosetteZ],[.025,.038,.038],ochre)
   for(let i=0;i<5;i++){const a=i*Math.PI*2/5;ellipsoid(`rosette-${side}-${i}`,[side*.245,rosetteY+Math.cos(a)*.070,rosetteZ+Math.sin(a)*.070],[.024,.030,.030],ochre)}
  }
  ellipsoid('tongue',[.053,.748,.739],[.050,.022,.048],'#b66a53')
  mesh(group,`${name}-handle`,curved([[0,.82,-.20],[0,1.10,-.12],[0,1.12,.13],[0,.98,.32]],.029),clay,[0,0,0])
  mesh(group,`${name}-tail`,curved([[0,.65,-.37],[.13,.61,-.47],[.20,.69,-.51],[.13,.76,-.52],[.085,.70,-.51]],.032,.013),ochre,[0,0,0])
  return{group,body,legs}
 }
 const bulls=[bull('pucara-bull-left',-.55),bull('pucara-bull-right',.55)]
 const pose=(step:number,t:number)=>{const n=THREE.MathUtils.clamp(t,0,1);if(step===0)actor.position.set(0,.20+1.10*n,2);else if(step===1)actor.position.set(0,1.30,2*(1-n));else actor.position.set(0,step===2?1.30-.20*n:1.10,0);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,actor,bulls,board,stand,house,roof,pad,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[.65,.04,.525],[.65,.04,.525],[.65,.04,.525]] as[number,number,number][],dispose(){}}
}
