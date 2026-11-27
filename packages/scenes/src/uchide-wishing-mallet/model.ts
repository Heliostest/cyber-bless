import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { applyBoxWoodUVs, applyTurnedShaftUVs, applyTurnedSphereUVs, createStylizedWoodTextures } from './wood-grain'

/** Watertight 45-degree chamfered timber block (96 vertices, exact [-w/2,w/2]x[-h/2,h/2]x[-d/2,d/2] bounds). */
function chamferedBox(w:number,h:number,d:number,r:number){
 const hx=w/2,hy=h/2,hz=d/2,b=Math.min(r,hx*.45,hy*.45,hz*.45),ix=hx-b,iy=hy-b,iz=hz-b
 type V=[number,number,number]
 const px=(sx:number,sy:number,sz:number):V=>[sx*hx,sy*iy,sz*iz]
 const py=(sx:number,sy:number,sz:number):V=>[sx*ix,sy*hy,sz*iz]
 const pz=(sx:number,sy:number,sz:number):V=>[sx*ix,sy*iy,sz*hz]
 const pos:number[]=[],norm:number[]=[],idx:number[]=[]
 const va=new THREE.Vector3(),vb=new THREE.Vector3(),vc=new THREE.Vector3(),fn=new THREE.Vector3(),mid=new THREE.Vector3()
 const poly=(verts:V[])=>{
  mid.set(0,0,0);for(const v of verts)mid.add(va.set(...v));mid.divideScalar(verts.length)
  va.set(...verts[0]!);vb.set(...verts[1]!);vc.set(...verts[2]!)
  fn.copy(vb).sub(va).cross(vc.sub(va)).normalize()
  const ordered=fn.dot(mid)<0?[...verts].reverse():verts
  if(fn.dot(mid)<0)fn.negate()
  const base=pos.length/3
  for(const v of ordered){pos.push(v[0],v[1],v[2]);norm.push(fn.x,fn.y,fn.z)}
  for(let i=1;i<ordered.length-1;i++)idx.push(base,base+i,base+i+1)
 }
 for(const s of[-1,1]){
  poly([px(s,-1,-1),px(s,-1,1),px(s,1,1),px(s,1,-1)])
  poly([py(-1,s,-1),py(1,s,-1),py(1,s,1),py(-1,s,1)])
  poly([pz(-1,-1,s),pz(1,-1,s),pz(1,1,s),pz(-1,1,s)])
 }
 for(const sy of[-1,1])for(const sz of[-1,1])poly([py(-1,sy,sz),py(1,sy,sz),pz(1,sy,sz),pz(-1,sy,sz)])
 for(const sx of[-1,1])for(const sz of[-1,1])poly([px(sx,-1,sz),px(sx,1,sz),pz(sx,1,sz),pz(sx,-1,sz)])
 for(const sx of[-1,1])for(const sy of[-1,1])poly([px(sx,sy,-1),px(sx,sy,1),py(sx,sy,1),py(sx,sy,-1)])
 for(const sx of[-1,1])for(const sy of[-1,1])for(const sz of[-1,1])poly([px(sx,sy,sz),py(sx,sy,sz),pz(sx,sy,sz)])
 const g=new THREE.BufferGeometry()
 g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3))
 g.setAttribute('normal',new THREE.Float32BufferAttribute(norm,3))
 g.setIndex(idx);g.computeBoundingBox();g.computeBoundingSphere();return g
}

function solid(source:THREE.BufferGeometry){
 if(!source.getAttribute('normal'))source.computeVertexNormals()
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),sn=input.getAttribute('normal'),su=input.getAttribute('uv')
 const data:number[]=[],normals:number[]=[],uvs:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),face=new THREE.Vector3()
 const na=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3()
 let volume=0
 for(let i=0;i<p.count;i+=3){
  a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2)
  face.copy(b).sub(a).cross(c.clone().sub(a))
  if(face.lengthSq()<1e-20)continue
  face.normalize()
  na.fromBufferAttribute(sn,i);nb.fromBufferAttribute(sn,i+1);nc.fromBufferAttribute(sn,i+2)
  for(const n of[na,nb,nc])if(n.lengthSq()<1e-20)n.copy(face);else n.normalize()
  data.push(...a.toArray(),...b.toArray(),...c.toArray())
  normals.push(...na.toArray(),...nb.toArray(),...nc.toArray())
  if(su)uvs.push(su.getX(i),su.getY(i),su.getX(i+1),su.getY(i+1),su.getX(i+2),su.getY(i+2))
  volume+=a.dot(b.clone().cross(c))/6
 }
 if(volume<0){
  for(let i=0;i<data.length;i+=9){
   for(let j=0;j<3;j++){
    const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v
    const n=normals[i+3+j]!;normals[i+3+j]=normals[i+6+j]!;normals[i+6+j]=n
   }
   for(let j=0;j<9;j++)normals[i+j]=-normals[i+j]!
  }
  if(su)for(let i=0;i<uvs.length;i+=6){
   for(let j=0;j<2;j++){const u=uvs[i+2+j]!;uvs[i+2+j]=uvs[i+4+j]!;uvs[i+4+j]=u}
  }
 }
 const g=new THREE.BufferGeometry()
 g.setAttribute('position',new THREE.Float32BufferAttribute(data,3))
 g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3))
 if(su)g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2))
 if(input!==source)input.dispose();source.dispose();return g
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
 // Distinct hand-crafted wood warmth, grain scale, organic flow & sparse knots per timber piece.
 const headRestTex=createStylizedWoodTextures({
  key:'uchide-head-rest-v3',seed:17,
  earlywood:'#ab7e51',latewood:'#835b38',knotCore:'#624023',knotHalo:'#bf9261',
  ringFreq:5.2,flowAmp:0.16,archAmp:0.42,washStrength:0.08,roughnessRange:[0.82,1.0],
  knots:[
   {along:0.17,across:0.66,radiusAlong:0.068,radiusAcross:0.044,deflect:0.072,strength:0.84},
   {along:0.76,across:0.84,radiusAlong:0.062,radiusAcross:0.040,deflect:0.062,strength:0.82},
  ],
 })
 const handleRestTex=createStylizedWoodTextures({
  key:'uchide-handle-rest-v3',seed:53,
  earlywood:'#936b48',latewood:'#6d4c31',knotCore:'#53361e',knotHalo:'#a97f59',
  ringFreq:7.2,flowAmp:0.125,archAmp:0.28,washStrength:0.075,withEndGrainBand:true,roughnessRange:[0.84,1.0],
  knots:[
   {along:0.46,across:0.132,radiusAlong:0.088,radiusAcross:0.022,deflect:0.030,strength:0.80},
   {along:0.64,across:0.265,radiusAlong:0.084,radiusAcross:0.023,deflect:0.030,strength:0.76},
  ],
 })
 const handleTex=createStylizedWoodTextures({
  key:'uchide-wood-handle-v3',seed:91,
  earlywood:'#d39d5e',latewood:'#ae7640',knotCore:'#855429',knotHalo:'#e0af72',
  ringFreq:3.3,flowAmp:0.145,washStrength:0.065,turnedMode:'cylinder',roughnessRange:[0.78,0.95],
  knots:[
   {along:0.43,across:0.42,radiusAlong:0.044,radiusAcross:0.068,deflect:0.064,strength:0.72},
  ],
 })
 // Keep turned pommel clean, luminous and warm without knot clutter or busy stripes.
 const pommelTex=createStylizedWoodTextures({
  key:'uchide-handle-pommel-v3',seed:131,
  earlywood:'#cc9354',latewood:'#b57d44',knotCore:'#926030',
  ringFreq:1.7,flowAmp:0.08,washStrength:0.045,turnedMode:'sphere',roughnessRange:[0.76,0.90],
 })
 const woodTextures=[headRestTex,handleRestTex,handleTex,pommelTex]
 const headRestMat=applyCraftSurface(new THREE.MeshStandardMaterial({color:'#ffffff',map:headRestTex.map,bumpMap:headRestTex.bumpMap,bumpScale:.0045,roughnessMap:headRestTex.roughnessMap,roughness:.74}),{kind:'wood',strength:.12,scale:.62,axis:'x'})
 const handleRestMat=applyCraftSurface(new THREE.MeshStandardMaterial({color:'#ffffff',map:handleRestTex.map,bumpMap:handleRestTex.bumpMap,bumpScale:.0045,roughnessMap:handleRestTex.roughnessMap,roughness:.76}),{kind:'wood',strength:.12,scale:.96,axis:'y'})
 // Smooth, clean, warm red lacquer barrel — restrained grain strength avoids any repetitive striping.
 const barrelMat=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#af4a38',roughness:.55,clearcoat:.38,clearcoatRoughness:.29,envMapIntensity:.74}),{kind:'wood',strength:.10,scale:.66,axis:'x'})
 const handleMat=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#ffffff',map:handleTex.map,bumpMap:handleTex.bumpMap,bumpScale:.0035,roughnessMap:handleTex.roughnessMap,roughness:.62,clearcoat:.22,clearcoatRoughness:.37,envMapIntensity:.72}),{kind:'wood',strength:.10,scale:1.12,axis:'z'})
 const pommelMat=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#ffffff',map:pommelTex.map,bumpMap:pommelTex.bumpMap,bumpScale:.0025,roughnessMap:pommelTex.roughnessMap,roughness:.60,clearcoat:.37,clearcoatRoughness:.29,envMapIntensity:.74}),{kind:'wood',strength:.08,scale:.74,axis:'z'})
 const gripRingMat=new THREE.MeshStandardMaterial({color:'#815b36',roughness:.64})
 const trimMat=new THREE.MeshStandardMaterial({color:'#d9b56b',roughness:.54,metalness:.35})
 const cordMat=applyCraftSurface(new THREE.MeshStandardMaterial({color:'#b74434',roughness:.80}),{kind:'cord',strength:.3})
 const standBaseMat=applyCraftSurface(new THREE.MeshStandardMaterial({color:'#6e4e35',roughness:.84}),{kind:'wood',strength:.34,scale:.72,axis:'z'})
 const mesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,p:[number,number,number])=>{const m=new THREE.Mesh(solid(g),mat);m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const standMesh=(parent:THREE.Object3D,name:string,g:THREE.BufferGeometry,mat:THREE.Material,p:[number,number,number])=>{const m=new THREE.Mesh(g,mat);m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 // Compact chamfered wooden presentation base tying the two grooved/cradled wooden rests cleanly onto the courtyard.
 standMesh(root,'uchide-stand-base',chamferedBox(1.74,.044,2.22,.014),standBaseMat,[-.55,.022,.28])
 const headRestGeo=chamferedBox(1.55,.20,.65,.022);applyBoxWoodUVs(headRestGeo,[1.55,.20,.65],'x')
 const headRest=standMesh(root,'uchide-head-rest',headRestGeo,headRestMat,[-.55,.10,-.45])
 for(const side of[-1,1]as const){
  const cheekGeo=chamferedBox(1.40,.085,.08,.016);applyBoxWoodUVs(cheekGeo,[1.40,.085,.08],'x')
  standMesh(root,`uchide-head-cheek-${side}`,cheekGeo,headRestMat,[-.55,.225,-.45+side*.275])
 }
 const handleRestFootGeo=chamferedBox(.38,.06,.38,.014);applyBoxWoodUVs(handleRestFootGeo,[.38,.06,.38],'x')
 standMesh(root,'uchide-handle-rest-foot',handleRestFootGeo,standBaseMat,[-.55,.03,1.15])
 const handleRestGeo=chamferedBox(.30,.46,.30,.020);applyBoxWoodUVs(handleRestGeo,[.30,.46,.30],'y',true)
 const handleRest=standMesh(root,'uchide-handle-rest',handleRestGeo,handleRestMat,[-.55,.23,1.15])
 for(const side of[-1,1]as const){
  const pommelCheekGeo=chamferedBox(.055,.075,.25,.012);applyBoxWoodUVs(pommelCheekGeo,[.055,.075,.25],'y')
  standMesh(root,`uchide-handle-cheek-${side}`,pommelCheekGeo,handleRestMat,[-.55+side*.122,.468,1.15])
 }
 const actor=new THREE.Group();actor.name='uchide-mallet';root.add(actor)
 // One closed, gently barrel-shaped original mallet head, capped at both ends.
 const profile=[[0,-.68],[.24,-.68],[.29,-.60],[.34,-.40],[.354,-.20],[.36,0],[.354,.20],[.34,.40],[.29,.60],[.24,.68],[0,.68]].map(([r,y])=>new THREE.Vector2(r!,y!))
 const barrel=new THREE.LatheGeometry(profile,24);barrel.rotateZ(Math.PI/2)
 const head=mesh(actor,'uchide-barrel-head',barrel,barrelMat,[0,.36,-1.15])
 for(const side of[-1,1]){
  const cap=new THREE.CylinderGeometry(.245,.245,.018,24);cap.rotateZ(Math.PI/2);mesh(actor,`uchide-head-cap-${side}`,cap,trimMat,[side*.685,.36,-1.15])
  const band=mesh(actor,`uchide-head-band-${side}`,new THREE.TorusGeometry(.311,.012,6,24),trimMat,[side*.56,.36,-1.15]);band.rotation.y=Math.PI/2
 }
 const shaft=new THREE.CylinderGeometry(.065,.065,1.60,16);applyTurnedShaftUVs(shaft);shaft.rotateX(Math.PI/2)
 const handle=mesh(actor,'uchide-wood-handle',shaft,handleMat,[0,.36,-.35])
 for(const[i,z]of[-.1,0,.1,.2].entries())mesh(actor,`uchide-grip-ring-${i}`,new THREE.TorusGeometry(.067,.008,6,16),gripRingMat,[0,.36,z])
 const pommelGeo=new THREE.SphereGeometry(.10,16,12);applyTurnedSphereUVs(pommelGeo)
 const pommel=mesh(actor,'uchide-handle-pommel',pommelGeo,pommelMat,[0,.36,.45])
 mesh(actor,'uchide-tassel-cord',cappedCurve([[0,.36,.50],[0,.30,.62],[0,.18,.70]],.016),cordMat,[0,0,0])
 mesh(actor,'uchide-tassel-collar',new THREE.CylinderGeometry(.045,.045,.05,12),trimMat,[0,.165,.70])
 for(let i=0;i<6;i++){const a=i*Math.PI/3;mesh(actor,`uchide-tassel-strand-${i}`,new THREE.ConeGeometry(.012,.14,6),cordMat,[Math.cos(a)*.025,.07,.70+Math.sin(a)*.025])}
 const pose=(step:number,t:number)=>{const n=THREE.MathUtils.clamp(t,0,1);actor.position.set(-.55,step===0?.20+.65*n:step===1?.85:step===2?.85-.65*n:.20,.70);actor.rotation.set(0,step===1?-.35*Math.sin(Math.PI*2*n):0,0);root.updateMatrixWorld(true)}
 pose(0,0)
 let disposed=false
 return{root,actor,head,handle,pommel,headRest,handleRest,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[0,.425,-.2],[0,.425,-.2],[0,.425,-.2]] as[number,number,number][],dispose(){if(disposed)return;disposed=true;woodTextures.forEach(t=>t.dispose())}}
}
