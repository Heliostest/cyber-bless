import { applyCraftSurface, type CraftSurfaceOptions } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'

function solid(source:THREE.BufferGeometry,smooth=false){
 if(smooth&&!source.getAttribute('normal'))source.computeVertexNormals()
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),sn=smooth?input.getAttribute('normal'):undefined,data:number[]=[],normals:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),na=new THREE.Vector3(),nb=new THREE.Vector3(),nc=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){
  a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2)
  if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue
  data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6
  if(sn){na.fromBufferAttribute(sn,i).normalize();nb.fromBufferAttribute(sn,i+1).normalize();nc.fromBufferAttribute(sn,i+2).normalize();normals.push(...na.toArray(),...nb.toArray(),...nc.toArray())}
 }
 if(volume<0){
  for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
  if(sn)for(let i=0;i<normals.length;i+=9){for(let j=0;j<3;j++){const v=normals[i+3+j]!;normals[i+3+j]=normals[i+6+j]!;normals[i+6+j]=v}for(let j=0;j<9;j++)normals[i+j]=-normals[i+j]!}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3))
 if(sn)g.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));else g.computeVertexNormals()
 if(input!==source)input.dispose();source.dispose();return g
}
export function createKadomatsuModel(){
 const root=new THREE.Group();root.name='kadomatsu-subject'
 const materials=new Map<string,THREE.MeshStandardMaterial>()
 const material=(color:string,surface?:CraftSurfaceOptions,finish:'matte'|'wood-satin'|'bamboo-node'='matte')=>{
  const key=`${color}:${surface?.kind??''}:${surface?.axis??''}:${surface?.scale??''}:${surface?.strength??''}:${finish}`
  if(!materials.has(key)){
   const m=finish==='wood-satin'
    ?new THREE.MeshPhysicalMaterial({color,roughness:.70,clearcoat:.10,clearcoatRoughness:.46,specularIntensity:.48})
    :finish==='bamboo-node'
     ?new THREE.MeshPhysicalMaterial({color,roughness:.54,clearcoat:.24,clearcoatRoughness:.36,specularIntensity:.58})
     :new THREE.MeshStandardMaterial({color,roughness:.9})
   if(surface)applyCraftSurface(m,surface);materials.set(key,m)
  }
  return materials.get(key)!
 }
 const bambooSkinMat=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.48,clearcoat:.30,clearcoatRoughness:.32,specularIntensity:.66,vertexColors:true}),{kind:'bamboo',strength:.48,scale:.85,axis:'y'})
 const bambooCutMat=applyCraftSurface(new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.88,vertexColors:true}),{kind:'bamboo',strength:.30,scale:.9,axis:'y'})
 const doorPanelMat=applyCraftSurface(new THREE.MeshPhysicalMaterial({color:'#ffffff',roughness:.72,clearcoat:.10,clearcoatRoughness:.46,specularIntensity:.46,vertexColors:true}),{kind:'wood',strength:.60,scale:.68,axis:'y'})
 // Cache by authored part family as well as colour: bamboo, straw and cord stay distinct.
 const surfaceFor=(name:string):CraftSurfaceOptions|undefined=>{
  if(name==='kadomatsu-paving')return{kind:'stone',strength:.4}
  if(/^kadomatsu-(left|right)-bamboo-/.test(name))return{kind:'bamboo',strength:.42,scale:.9,axis:'y'}
  if(/^kadomatsu-(left|right)-straw-/.test(name))return{kind:'straw',strength:.3,axis:'y'}
  if(/^kadomatsu-(left|right)-cord-/.test(name))return{kind:'cord',strength:.3}
  if(/^kadomatsu-(left|right)-pine-branch-/.test(name))return{kind:'wood',strength:.4,axis:'y'}
  if(/^kadomatsu-(jamb-|door-slat-)/.test(name))return{kind:'wood',strength:.58,scale:.68,axis:'y'}
  if(['kadomatsu-lintel','kadomatsu-threshold','kadomatsu-preparation-tray'].includes(name))return{kind:'wood',strength:.58,scale:.68,axis:'x'}
 }
 const finishFor=(name:string):'matte'|'wood-satin'|'bamboo-node'=>/^kadomatsu-(left|right)-bamboo-.*-node-/.test(name)?'bamboo-node':/^kadomatsu-(jamb-|door-slat-|lintel|threshold|preparation-tray)/.test(name)?'wood-satin':'matte'
 const mesh=(parent:THREE.Object3D,name:string,source:THREE.BufferGeometry,color:string,p:[number,number,number],smooth=false)=>{const m=new THREE.Mesh(solid(source,smooth),material(color,surfaceFor(name),finishFor(name)));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const paving=mesh(root,'kadomatsu-paving',new THREE.BoxGeometry(3.8,.08,2.9),'#c8bca3',[0,.04,.15])
 const door=new THREE.Group();door.name='kadomatsu-door';root.add(door)
 mesh(door,'kadomatsu-wall',new THREE.BoxGeometry(2.3,2.25,.12),'#d6c7a6',[0,1.205,-.80])
 // Warm stylized plank-toned cedar door panel behind the vertical battens.
 {
  const doorGeo=solid(new THREE.BoxGeometry(1.60,1.98,.06,14,4,1))
  const pos=doorGeo.getAttribute('position'),colors:number[]=[],plankBase=new THREE.Color('#866348'),plankWarm=new THREE.Color('#926d4f'),plankDeep=new THREE.Color('#7a5940'),c=new THREE.Color()
  for(let i=0;i<pos.count;i++){
   const px=pos.getX(i),py=pos.getY(i),plank=Math.floor((px+.80)/.23)
   c.copy(plank%3===0?plankWarm:plank%3===1?plankBase:plankDeep)
   const v=THREE.MathUtils.clamp((py+.99)/1.98,0,1)
   c.multiplyScalar(.93+.10*v)
   colors.push(c.r,c.g,c.b)
  }
  doorGeo.setAttribute('color',new THREE.Float32BufferAttribute(colors,3))
  const doorMesh=new THREE.Mesh(doorGeo,doorPanelMat);doorMesh.name='kadomatsu-wood-door';doorMesh.position.set(0,1.19,-.70);doorMesh.castShadow=doorMesh.receiveShadow=true;door.add(doorMesh)
 }
 for(const side of[-1,1])mesh(door,`kadomatsu-jamb-${side}`,new THREE.BoxGeometry(.14,2.16,.16),'#aa8357',[side*.89,1.16,-.68])
 mesh(door,'kadomatsu-lintel',new THREE.BoxGeometry(1.92,.14,.20),'#a57e52',[0,2.31,-.68])
 mesh(door,'kadomatsu-threshold',new THREE.BoxGeometry(1.92,.12,.24),'#a57e52',[0,.14,-.68])
 for(let i=0;i<7;i++)mesh(door,`kadomatsu-door-slat-${i}`,new THREE.BoxGeometry(.025,1.88,.025),i%2===0?'#9f7a52':'#96724c',[-.70+i*.23,1.19,-.659])
 mesh(door,'kadomatsu-door-handle',new THREE.BoxGeometry(.055,.21,.045),'#554b3a',[.52,1.10,-.62])
 const tray=mesh(root,'kadomatsu-preparation-tray',new THREE.BoxGeometry(.72,.12,.72),'#b89266',[-.55,.14,1.2])
 const rimNormal=new THREE.Vector3(0,1,.75).normalize()
 const stalkTints=['#629548','#699c4d','#5d8f44']
 function bundle(name:string){
  const group=new THREE.Group();group.name=name;root.add(group)
  const base=mesh(group,`${name}-straw-base`,new THREE.CylinderGeometry(.29,.30,.42,24),'#c4a76d',[0,.21,0],true)
  for(let i=0;i<28;i++){const a=i*Math.PI*2/28,m=mesh(group,`${name}-straw-${i}`,new THREE.BoxGeometry(.045,.40,.024),i%3===0?'#ddc58c':'#ccb278',[Math.cos(a)*.291,.21,Math.sin(a)*.291]);m.rotation.y=-a+Math.PI/2}
  for(const[y,i]of[.11,.22,.34].map((y,i)=>[y,i])){const ring=mesh(group,`${name}-cord-${i}`,new THREE.TorusGeometry(.307,.012,6,36),'#775338',[0,y!,0],true);ring.rotation.x=Math.PI/2}
  const stalks=[[-.15,.07,1.12],[0,-.12,1.52],[.15,.07,1.30]].map(([x,z,height],i)=>{
   const nodeYs:number[]=[];for(let ny=.50;ny<height!-.15;ny+=.33)nodeYs.push(ny)
   const ys=new Set<number>([.22,.34])
   for(const ny of nodeYs)for(const dy of[-.06,-.018,0,.018,.07])if(ny+dy>.24&&ny+dy<height!-.11)ys.add(Number((ny+dy).toFixed(4)))
   for(let sy=.42;sy<height!-.11;sy+=.16)ys.add(Number(sy.toFixed(4)))
   const outerYs=[...ys].sort((u,v)=>u-v)
   const innerYs=[height!-.20,.58,.255].filter((v,idx,arr)=>v>.255&&v<height!-.11&&(idx===0||arr[idx-1]!-v>.08))
   const profile:THREE.Vector2[]=[new THREE.Vector2(0,.22),...outerYs.map(y=>new THREE.Vector2(.095,y)),new THREE.Vector2(.095,height!),new THREE.Vector2(.071,height!),...innerYs.map(y=>new THREE.Vector2(.071,y)),new THREE.Vector2(.071,.255),new THREE.Vector2(0,.255)]
   const g=new THREE.LatheGeometry(profile,28),p=g.getAttribute('position')
   for(let j=0;j<p.count;j++)if(Math.abs(p.getY(j)-height!)<1e-5)p.setY(j,height!-.75*p.getZ(j))
   const raw=solid(g),rp=raw.getAttribute('position')
   const skinPos:number[]=[],skinNorm:number[]=[],skinCol:number[]=[],cutPos:number[]=[],cutNorm:number[]=[],cutCol:number[]=[]
   const skinBase=new THREE.Color(stalkTints[i%stalkTints.length]!),skinSun=new THREE.Color('#80b259'),skinShade=new THREE.Color('#4f7b3b'),skinBloom=new THREE.Color('#bfd698')
   const rimColor=new THREE.Color('#f0e3b2'),rimOuter=new THREE.Color('#e1d39a'),inTop=new THREE.Color('#788d5c'),inDeep=new THREE.Color('#47623c'),tmp=new THREE.Color()
   for(let j=0;j<rp.count;j+=3){
    const vs=[0,1,2].map(k=>new THREE.Vector3(rp.getX(j+k),rp.getY(j+k),rp.getZ(j+k)))
    const rim=vs.every(v=>Math.abs(v.y+.75*v.z-height!)<1e-4)
    const inside=vs.every(v=>Math.hypot(v.x,v.z)<.0725)
    const botCap=vs.every(v=>Math.abs(v.y-.22)<1e-4)
    const floorCap=vs.every(v=>Math.abs(v.y-.255)<1e-4)
    const isSkin=!rim&&!inside
    const tPos=isSkin?skinPos:cutPos,tNorm=isSkin?skinNorm:cutNorm,tCol=isSkin?skinCol:cutCol
    for(const v of vs){
     tPos.push(v.x,v.y,v.z)
     const r=Math.hypot(v.x,v.z)
     if(rim)tNorm.push(rimNormal.x,rimNormal.y,rimNormal.z)
     else if(botCap)tNorm.push(0,-1,0)
     else if(floorCap)tNorm.push(0,1,0)
     else if(inside)tNorm.push(-v.x/r,0,-v.z/r)
     else tNorm.push(v.x/r,0,v.z/r)
     if(rim){
      tmp.copy(r>.086?rimOuter:rimColor)
     }else if(inside){
      const d=THREE.MathUtils.clamp((v.y-.255)/(height!-.255),0,1)
      tmp.copy(inDeep).lerp(inTop,d*d)
     }else{
      const angle=Math.atan2(v.z,v.x),hFrac=THREE.MathUtils.clamp((v.y-.22)/(height!-.22),0,1)
      tmp.copy(skinBase).lerp(skinSun,hFrac*.22)
      let bloomAmt=0,groove=0
      for(const ny of nodeYs){
       const dy=v.y-ny
       if(dy<0&&dy>-.075)bloomAmt=Math.max(bloomAmt,Math.exp(-(((dy+.022)/.022)**2)))
       if(Math.abs(dy)<.022)groove=Math.max(groove,1-Math.abs(dy)/.022)
       if(dy>0&&dy<.085)tmp.lerp(skinShade,(1-dy/.085)*.20)
      }
      tmp.lerp(skinBloom,bloomAmt*.34).multiplyScalar(1-groove*.13)
      const striation=1+.022*Math.sin(angle*7+i*1.3)+.014*Math.cos(angle*13)
      tmp.multiplyScalar(striation)
     }
     tCol.push(Math.min(1,tmp.r),Math.min(1,tmp.g),Math.min(1,tmp.b))
    }
   }
   raw.dispose()
   const stalkGeo=new THREE.BufferGeometry()
   stalkGeo.setAttribute('position',new THREE.Float32BufferAttribute([...skinPos,...cutPos],3))
   stalkGeo.setAttribute('normal',new THREE.Float32BufferAttribute([...skinNorm,...cutNorm],3))
   stalkGeo.setAttribute('color',new THREE.Float32BufferAttribute([...skinCol,...cutCol],3))
   stalkGeo.addGroup(0,skinPos.length/3,0)
   stalkGeo.addGroup(skinPos.length/3,cutPos.length/3,1)
   const stalk=new THREE.Mesh(stalkGeo,[bambooSkinMat,bambooCutMat])
   stalk.name=`${name}-bamboo-${i}`;stalk.position.set(x!,0,z!);stalk.castShadow=stalk.receiveShadow=true;group.add(stalk)
   for(const y of nodeYs){const ring=mesh(group,`${name}-bamboo-${i}-node-${y.toFixed(2)}`,new THREE.TorusGeometry(.0955,.0065,8,28),'#8db264',[x!,y,z!],true);ring.rotation.x=Math.PI/2}
   return stalk
  })
  // Merge closed needle cones into one draw call; each cone remains a real solid.
  const needleData:number[]=[],needleSource=new THREE.ConeGeometry(1,1,4).toNonIndexed(),needlePositions=needleSource.getAttribute('position'),q=new THREE.Quaternion(),matrix=new THREE.Matrix4(),v=new THREE.Vector3()
  for(let i=0;i<7;i++){
   const a=i*Math.PI*2/7,from=new THREE.Vector3(Math.cos(a)*.10,.30,Math.sin(a)*.10),end=new THREE.Vector3(Math.cos(a)*.33,.55+(i%3)*.13,Math.sin(a)*.33),branch=mesh(group,`${name}-pine-branch-${i}`,new THREE.CylinderGeometry(.012,.018,from.distanceTo(end),6),'#71523b',from.clone().add(end).multiplyScalar(.5).toArray() as[number,number,number]);branch.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),end.clone().sub(from).normalize())
   for(let j=0;j<3;j++)for(let k=0;k<8;k++){const phi=k*Math.PI*2/8,origin=from.clone().lerp(end,.60+j*.20).add(new THREE.Vector3(Math.cos(phi)*.012,k*.0015,Math.sin(phi)*.012)),direction=new THREE.Vector3(Math.cos(a)*.65+Math.cos(phi)*.55,.65+.15*Math.sin(phi),Math.sin(a)*.65+Math.sin(phi)*.55).normalize();q.setFromUnitVectors(new THREE.Vector3(0,1,0),direction);matrix.compose(origin.addScaledVector(direction,.075),q,new THREE.Vector3(.007,.15,.007));for(let n=0;n<needlePositions.count;n++){v.fromBufferAttribute(needlePositions,n).applyMatrix4(matrix);needleData.push(v.x,v.y,v.z)}}
  }
  needleSource.dispose();const needles=new THREE.BufferGeometry();needles.setAttribute('position',new THREE.Float32BufferAttribute(needleData,3));mesh(group,`${name}-pine-needles`,needles,'#2f684d',[0,0,0])
  return{group,base,stalks}
 }
 const left=bundle('kadomatsu-left'),right=bundle('kadomatsu-right'),actor=right.group,fixed=left.group;fixed.position.set(-1.20,.08,0)
 const pose=(step:number,t:number)=>{const n=THREE.MathUtils.clamp(t,0,1);if(step===0)actor.position.set(-.55,.20+.46*n,1.2);else if(step===1)actor.position.set(-.55+1.75*n,.66,1.2*(1-n));else actor.position.set(1.2,step===2?.66-.58*n:.08,0);root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,actor,fixed,base:right.base,stalks:right.stalks,paving,door,tray,pose,targets:[actor,actor,actor],roots:[actor,actor,actor],anchors:[[0,.34,.30],[0,.34,.30],[0,.34,.30]] as[number,number,number][],dispose(){}}
}
