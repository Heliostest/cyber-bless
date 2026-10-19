import * as THREE from 'three'

export function createKanteleModel() {
  const subject=new THREE.Group(),fixed=new THREE.Group();subject.name='kantele-subject';fixed.name='kantele-fixed';subject.add(fixed)
  const wood=new THREE.MeshStandardMaterial({color:'#c99b62',roughness:.86,vertexColors:true}),topWood=new THREE.MeshStandardMaterial({color:'#e6bf7c',roughness:.82,vertexColors:true}),darkWood=new THREE.MeshStandardMaterial({color:'#9e734b',roughness:.87,vertexColors:true}),steel=new THREE.MeshStandardMaterial({color:'#9daea9',metalness:.78,roughness:.38})
  const add=(name:string,g:THREE.BufferGeometry,mat:THREE.MeshStandardMaterial,parent:THREE.Object3D,x=0,y=0,z=0)=>{if(mat.vertexColors){const p=g.getAttribute('position'),c=new Float32Array(p.count*3);for(let i=0;i<p.count;i++){const shade=.94+.045*Math.sin(p.getX(i)*18+p.getZ(i)*5);c.set([shade,shade,shade],i*3)}g.setAttribute('color',new THREE.BufferAttribute(c,3))}const mesh=new THREE.Mesh(g,mat);mesh.name=name;mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;parent.add(mesh);return mesh}
  const outline=[[-1.72,-.82],[1.62,-.82],[1.62,.82],[-.70,.82]]
  const polygon=(scale=1)=>new THREE.Shape(outline.map(([x,z])=>new THREE.Vector2(x!*scale,-z!*scale)))
  const rimShape=polygon();rimShape.holes.push(new THREE.Path(outline.map(([x,z])=>new THREE.Vector2(x!*.90,-z!*.90)).reverse()))
  const slab=(shape:THREE.Shape,depth:number,bevel=false)=>{const g=new THREE.ExtrudeGeometry(shape,{depth,bevelEnabled:bevel,bevelSegments:1,steps:1,bevelSize:.02,bevelThickness:.02,curveSegments:32});for(const key of ['position','normal']){const p=g.getAttribute(key);for(let i=0;i<p.count;i++){const y=p.getY(i),z=p.getZ(i);p.setY(i,z);p.setZ(i,-y)}}return g}
  const rim=add('kantele-hollow-rim',slab(rimShape,.24),wood,fixed)
  const topShape=polygon(),hole=new THREE.Path();hole.absarc(.20,-.635,.085,0,Math.PI*2,false);topShape.holes.push(hole)
  const top=add('kantele-soundboard',slab(topShape,.12,true),topWood,fixed,0,.24)
  const pegs:THREE.Mesh<THREE.BufferGeometry,THREE.MeshStandardMaterial>[]=[],radius=.020
  for(let i=0;i<5;i++){const x=-1.45+i*.14,z=-.52+i*.26;pegs.push(add(`kantele-peg-${i}`,new THREE.CylinderGeometry(.075,.075,.28,16),darkWood,fixed,x,.50,z));add(`kantele-peg-grip-${i}`,new THREE.BoxGeometry(.20,.06,.09),wood,fixed,x,.65,z)}
  for(const [i,z]of[-.67,.67].entries())add(`kantele-anchor-support-${i}`,new THREE.BoxGeometry(.17,.15,.16),darkWood,fixed,1.32,.435,z)
  const bar=add('kantele-anchor-bar',new THREE.CylinderGeometry(.045,.045,1.42,20),steel,fixed,1.32,.49);bar.rotation.x=Math.PI/2
  const frames=32,sides=8
  const wireGeometry=()=>{const g=new THREE.BufferGeometry(),indices:number[]=[];g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(((frames+1)*sides+2)*3),3).setUsage(THREE.DynamicDrawUsage));for(let i=0;i<frames;i++)for(let j=0;j<sides;j++){const a=i*sides+j,b=i*sides+(j+1)%sides,c=(i+1)*sides+j,d=(i+1)*sides+(j+1)%sides;indices.push(a,b,c,b,d,c)}const start=(frames+1)*sides,end=start+1;for(let j=0;j<sides;j++){indices.push(start,(j+1)%sides,j,end,frames*sides+j,frames*sides+(j+1)%sides)}g.setIndex(indices);return g}
  const wires=Array.from({length:5},(_,i)=>add(`kantele-string-${i}`,wireGeometry(),steel,subject,0,.49,-.52+i*.26))
  const deform=(i:number,d:number)=>{const wire=wires[i]!,p=wire.geometry.getAttribute('position') as THREE.BufferAttribute,start=-1.39+i*.14,end=1.29;for(let n=0;n<=frames;n++){const t=n/frames,z=(n===0||n===frames)?0:Math.sin(Math.PI*t)*d;for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2;p.setXYZ(n*sides+j,THREE.MathUtils.lerp(start,end,t),Math.cos(a)*radius,z+Math.sin(a)*radius)}}p.setXYZ((frames+1)*sides,start,0,0);p.setXYZ((frames+1)*sides+1,end,0,0);p.needsUpdate=true;wire.geometry.computeVertexNormals();wire.geometry.computeBoundingBox();wire.geometry.computeBoundingSphere()}
  const displacement=(n:number)=>{if(n===0||n===1)return 0;if(n<=.6)return .12*n/.6;const u=(n-.6)/.4;return .12*(1-u)**2*Math.cos(5*Math.PI*u)}
  const pose=(at:number,n:number)=>{const step=THREE.MathUtils.clamp(Math.floor(at),0,3),amount=THREE.MathUtils.clamp(n,0,1);for(let i=0;i<5;i++)deform(i,step<3&&i===step*2?displacement(amount)*(step===1?1:-1):0);subject.updateMatrixWorld(true)}
  pose(0,0)
  const targets=[wires[0]!,wires[2]!,wires[4]!],anchors:[number,number,number][]=[[-.05,0,0],[.09,0,0],[.23,0,0]]
  return{subject,fixed,rim,top,wires,pegs,bar,radius,pose,targets,roots:targets,anchors}
}
