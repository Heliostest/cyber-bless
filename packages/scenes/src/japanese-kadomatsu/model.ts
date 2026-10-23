import * as THREE from 'three'

function solid(source:THREE.BufferGeometry){
 const input=source.index?source.toNonIndexed():source,p=input.getAttribute('position'),data:number[]=[]
 const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();let volume=0
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1);c.fromBufferAttribute(p,i+2);if(b.clone().sub(a).cross(c.clone().sub(a)).lengthSq()<1e-20)continue;data.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
 if(volume<0)for(let i=0;i<data.length;i+=9)for(let j=0;j<3;j++){const v=data[i+3+j]!;data[i+3+j]=data[i+6+j]!;data[i+6+j]=v}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(data,3));g.computeVertexNormals();if(input!==source)input.dispose();source.dispose();return g
}
export function createKadomatsuModel(){
 const root=new THREE.Group();root.name='kadomatsu-subject'
 const materials=new Map<string,THREE.MeshStandardMaterial>(),material=(color:string)=>{if(!materials.has(color))materials.set(color,new THREE.MeshStandardMaterial({color,roughness:.9}));return materials.get(color)!}
 const mesh=(parent:THREE.Object3D,name:string,source:THREE.BufferGeometry,color:string,p:[number,number,number])=>{const m=new THREE.Mesh(solid(source),material(color));m.name=name;m.position.set(...p);m.castShadow=m.receiveShadow=true;parent.add(m);return m}
 const paving=mesh(root,'kadomatsu-paving',new THREE.BoxGeometry(3.8,.08,2.9),'#c8bca3',[0,.04,.15])
 const door=new THREE.Group();door.name='kadomatsu-door';root.add(door)
 mesh(door,'kadomatsu-wall',new THREE.BoxGeometry(2.3,2.25,.12),'#d6c7a6',[0,1.205,-.80])
 mesh(door,'kadomatsu-wood-door',new THREE.BoxGeometry(1.60,1.98,.06),'#745844',[0,1.19,-.70])
 for(const side of[-1,1])mesh(door,`kadomatsu-jamb-${side}`,new THREE.BoxGeometry(.14,2.16,.16),'#9c7951',[side*.89,1.16,-.68])
 mesh(door,'kadomatsu-lintel',new THREE.BoxGeometry(1.92,.14,.20),'#9c7951',[0,2.31,-.68])
 mesh(door,'kadomatsu-threshold',new THREE.BoxGeometry(1.92,.12,.24),'#9c7951',[0,.14,-.68])
 for(let i=0;i<7;i++)mesh(door,`kadomatsu-door-slat-${i}`,new THREE.BoxGeometry(.025,1.88,.025),'#92714e',[-.70+i*.23,1.19,-.659])
 mesh(door,'kadomatsu-door-handle',new THREE.BoxGeometry(.055,.21,.045),'#554b3a',[.52,1.10,-.62])
 const tray=mesh(root,'kadomatsu-preparation-tray',new THREE.BoxGeometry(.72,.12,.72),'#ac8962',[-.55,.14,1.2])
 function bundle(name:string){
  const group=new THREE.Group();group.name=name;root.add(group)
  const base=mesh(group,`${name}-straw-base`,new THREE.CylinderGeometry(.29,.30,.42,24),'#c4a76d',[0,.21,0])
  for(let i=0;i<28;i++){const a=i*Math.PI*2/28,m=mesh(group,`${name}-straw-${i}`,new THREE.BoxGeometry(.045,.40,.024),i%3===0?'#ddc58c':'#ccb278',[Math.cos(a)*.291,.21,Math.sin(a)*.291]);m.rotation.y=-a+Math.PI/2}
  for(const[y,i]of[.11,.22,.34].map((y,i)=>[y,i])){const ring=mesh(group,`${name}-cord-${i}`,new THREE.TorusGeometry(.307,.012,6,36),'#775338',[0,y!,0]);ring.rotation.x=Math.PI/2}
  const stalks=[[-.15,.07,1.12],[0,-.12,1.52],[.15,.07,1.30]].map(([x,z,height],i)=>{
   const profile=[[0,.22],[.095,.22],[.095,height!],[.071,height!],[.071,.255],[0,.255]].map(([r,y])=>new THREE.Vector2(r!,y!)),g=new THREE.LatheGeometry(profile,20),p=g.getAttribute('position')
   for(let j=0;j<p.count;j++)if(Math.abs(p.getY(j)-height!)<1e-5)p.setY(j,height!-.75*p.getZ(j))
   const stalk=mesh(group,`${name}-bamboo-${i}`,g,'#ffffff',[x!,0,z!]),positions=stalk.geometry.getAttribute('position'),colors:number[]=[]
   for(let j=0;j<positions.count;j+=3){let rim=true,inside=true;for(let k=0;k<3;k++){const y=positions.getY(j+k),z=positions.getZ(j+k);rim&&=Math.abs(y+.75*z-height!)<1e-5;inside&&=Math.hypot(positions.getX(j+k),z)<.072}const color=new THREE.Color(rim?'#e4d49b':inside?'#56794a':'#66974b');for(let k=0;k<3;k++)colors.push(color.r,color.g,color.b)}
   stalk.geometry.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));(stalk.material as THREE.MeshStandardMaterial).vertexColors=true
   for(let y=.50;y<height!-.15;y+=.33){const ring=mesh(group,`${name}-bamboo-${i}-node-${y.toFixed(2)}`,new THREE.TorusGeometry(.096,.006,5,20),'#92b36a',[x!,y,z!]);ring.rotation.x=Math.PI/2}
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
