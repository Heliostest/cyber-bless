import { applyCraftSurface, type CraftSurfaceOptions } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return g
}

// Subtle matte plaster/earthen vertex-color relief without asserting wood/ceramic on painted surfaces.
function addMatteRelief(g:THREE.BufferGeometry,seed:number,amp=.045){
 const pos=g.getAttribute('position'),colors=new Float32Array(pos.count*3)
 for(let i=0;i<pos.count;i++){
  const x=pos.getX(i),y=pos.getY(i),z=pos.getZ(i)
  const n=Math.sin(x*5.7+z*4.1+seed)*.55+Math.cos(y*8.3-x*3.4+seed*1.7)*.45
  const shade=THREE.MathUtils.clamp(.965+n*amp+Math.min(y,.35)*.06,.86,1.04)
  colors[i*3]=shade;colors[i*3+1]=shade*.992;colors[i*3+2]=shade*.978
 }
 g.setAttribute('color',new THREE.BufferAttribute(colors,3))
 return g
}

// One closed, capped solid along a curve; no open TubeGeometry ends.
function curved(points:[number,number,number][],radius:number,endRadius=radius){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(...p))),segments=18,sides=8,frames=curve.computeFrenetFrames(segments,false),vertices:number[]=[],indices:number[]=[]
 for(let i=0;i<=segments;i++){const center=curve.getPoint(i/segments),r=THREE.MathUtils.lerp(radius,endRadius,i/segments);for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,p=center.clone().addScaledVector(frames.normals[i]!,Math.cos(a)*r).addScaledVector(frames.binormals[i]!,Math.sin(a)*r);vertices.push(p.x,p.y,p.z)}}
 for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,c,b,b,c,d)}
 const start=vertices.length/3;vertices.push(...curve.getPoint(0).toArray(),...curve.getPoint(1).toArray());for(let j=0;j<sides;j++)indices.push(start,j,(j+1)%sides,start+1,segments*sides+(j+1)%sides,segments*sides+j)
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);return g
}

// Extrude a closed Y/Z profile along X with optional end bevels, keeping top ridge aligned cleanly.
function crossSection(profile:[number,number][],width:number,bevel=0){
 const shape=new THREE.Shape(profile.map(([z,y])=>new THREE.Vector2(z,y)))
 const depth=Math.max(.02,width-bevel*2)
 const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel*.6,bevelSegments:2,steps:1})
 g.rotateY(-Math.PI/2);g.translate(depth/2,0,0);return g
}

// Chamfered-plan battered saddle pad whose bottom vertices lie strictly on y = 1 - .4*|z|/.95 and top at y = 1.10.
function saddlePadGeometry(width:number,depth:number,topY:number,chamfer=.052,batter=.022){
 const roofY=(z:number)=>1-.4*Math.abs(z)/.95
 const ring=(hw:number,hd:number,c:number):[number,number][]=>[
  [-hw+c,hd],[hw-c,hd],[hw,hd-c],[hw,0],[hw,-hd+c],[hw-c,-hd],[-hw+c,-hd],[-hw,-hd+c],[-hw,0],[-hw,hd-c],
 ]
 const botXZ=ring(width/2,depth/2,chamfer),topXZ=ring(width/2-batter,depth/2-batter,chamfer)
 const verts:number[]=[],indices:number[]=[]
 const push=(x:number,y:number,z:number)=>{verts.push(x,y,z);return verts.length/3-1}
 const botIdx=botXZ.map(([x,z])=>push(x,roofY(z),z))
 const topIdx=topXZ.map(([x,z])=>push(x,topY,z))
 const topCenter=push(0,topY,0),botRidgeCenter=push(0,1,0)
 const n=botIdx.length
 for(let i=0;i<n;i++){
  const j=(i+1)%n
  indices.push(botIdx[i]!,botIdx[j]!,topIdx[j]!,botIdx[i]!,topIdx[j]!,topIdx[i]!)
  indices.push(topCenter,topIdx[i]!,topIdx[j]!)
 }
 const frontLoop=[8,9,0,1,2,3],backLoop=[3,4,5,6,7,8]
 for(let i=0;i<frontLoop.length-1;i++)indices.push(botRidgeCenter,botIdx[frontLoop[i+1]!]!,botIdx[frontLoop[i]!]!)
 for(let i=0;i<backLoop.length-1;i++)indices.push(botRidgeCenter,botIdx[backLoop[i+1]!]!,botIdx[backLoop[i]!]!)
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(verts,3));g.setIndex(indices);return g
}

export function createPucaraModel(){
 const root=new THREE.Group();root.name='pucara-subject'
 const materials=new Map<string,THREE.MeshStandardMaterial>()
 const material=(color:string,surface?:CraftSurfaceOptions,matte=false)=>{
  const key=`${color}:${surface?.kind??''}:${surface?.axis??''}:${matte?1:0}`
  if(!materials.has(key)){
   const m=new THREE.MeshStandardMaterial({color,roughness:color==='#e6cf9d'?.48:matte?.92:.82,vertexColors:matte})
   if(surface)applyCraftSurface(m,surface)
   materials.set(key,m)
  }
  return materials.get(key)!
 }
 const surfaceFor=(name:string):CraftSurfaceOptions|undefined=>{
  if(name.startsWith('pucara-bull-left-')||name.startsWith('pucara-bull-right-'))return{kind:'ceramic',strength:.45}
  if(name==='pucara-carrier-board')return{kind:'wood',axis:'x',strength:.4}
 }
 const mesh=(parent:THREE.Object3D,name:string,source:THREE.BufferGeometry,color:string,p:[number,number,number],matteSeed?:number)=>{
  const g=solid(source)
  if(matteSeed!==undefined)addMatteRelief(g,matteSeed)
  const m=new THREE.Mesh(g,material(color,surfaceFor(name),matteSeed!==undefined))
  m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m
 }
 const house=new THREE.Group();house.name='pucara-house';root.add(house)
 mesh(house,'pucara-walls',new RoundedBoxGeometry(2.65,.65,1.8,2,.022),'#d8c7a6',[0,.325,0],1.1)
 mesh(house,'pucara-wall-plinth',new RoundedBoxGeometry(2.71,.085,1.86,2,.014),'#c7b594',[0,.0425,0],1.9)
 const roof=mesh(house,'pucara-roof',crossSection([[-.944,.534],[-.944,.594],[0,.994],[.944,.594],[.944,.534],[0,.934]],2.8,.010),'#ad6d4d',[0,0,0],2.7)
 for(const x of[-.88,.88]){mesh(house,`pucara-window-${x}`,new RoundedBoxGeometry(.39,.26,.035,2,.007),'#5c706d',[x,.36,.915]);mesh(house,`pucara-window-cross-${x}`,new RoundedBoxGeometry(.028,.28,.038,2,.005),'#8e6844',[x,.36,.937])}
 mesh(house,'pucara-door',new RoundedBoxGeometry(.46,.52,.04,2,.008),'#866344',[0,.26,.92])
 mesh(house,'pucara-door-handle',new THREE.SphereGeometry(.025,8,6),'#d7b67a',[.14,.28,.96])
 // This original saddle-shaped pad fills the space down to the sloping roof.
 const pad=mesh(root,'pucara-ridge-pad',saddlePadGeometry(2.10,.90,1.10),'#98784e',[0,0,0],3.3)
 const stand=mesh(root,'pucara-low-stand',new RoundedBoxGeometry(2.10,.20,1.15,2,.024),'#b5986c',[0,.10,2],4.1)
 mesh(root,'pucara-low-stand-plinth',new RoundedBoxGeometry(2.12,.048,1.17,2,.012),'#a4875d',[0,.024,2],4.7)
 const actor=new THREE.Group();actor.name='pucara-carrier';root.add(actor)
 const board=mesh(actor,'pucara-carrier-board',new RoundedBoxGeometry(2,.06,1.05,2,.014),'#88633f',[0,.03,0])
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
