import * as THREE from 'three'

type Point = [number, number]
const glyphs: Record<string, Point[][]> = {
 '2': [[[0,.8],[.12,.97],[.45,1],[.65,.87],[.65,.67],[0,0],[.7,0]]],
 '0': [[[.32,1],[.1,.93],[0,.7],[0,.26],[.12,.05],[.36,0],[.59,.1],[.67,.34],[.67,.76],[.52,.96],[.32,1]]],
 '*': [[[.35,.2],[.35,.83]],[[.07,.35],[.63,.68]],[[.07,.68],[.63,.35]]],
 'C': [[[.68,.88],[.48,1],[.18,.94],[0,.73],[0,.25],[.19,.04],[.48,0],[.68,.12]]],
 '+': [[[.05,.48],[.65,.48]],[[.35,.18],[.35,.78]]],
 'M': [[[0,0],[0,1],[.38,.42],[.76,1],[.76,0]]],
 'B': [[[0,0],[0,1],[.45,1],[.65,.86],[.64,.68],[.45,.53],[0,.53]],[[.45,.53],[.7,.38],[.67,.16],[.46,0],[0,0]]],
 '6': [[[.62,.92],[.43,1],[.18,.9],[0,.59],[0,.2],[.18,0],[.47,0],[.65,.18],[.62,.44],[.43,.58],[.18,.56],[0,.37]]],
}
const V=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
const lerp=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>a.clone().lerp(b,t)
function chalkGeometry(){
 const lathe=new THREE.LatheGeometry([new THREE.Vector2(0,0),new THREE.Vector2(.014,.015),new THREE.Vector2(.04,.06),new THREE.Vector2(.043,.28),new THREE.Vector2(.037,.35),new THREE.Vector2(0,.35)],16)
 const p=lathe.attributes.position!,ix=lathe.index!,vertices:number[]=[]
 // A lathe pole creates one collapsed triangle per sector. Keep only real faces.
 for(let i=0;i<ix.count;i+=3){const v=[0,1,2].map(j=>new THREE.Vector3().fromBufferAttribute(p,ix.getX(i+j)));if(v[1]!.clone().sub(v[0]!).cross(v[2]!.clone().sub(v[0]!)).lengthSq()>1e-16)for(const point of v)vertices.push(...point.toArray())}
 lathe.dispose();const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));geometry.computeVertexNormals();return geometry
}

/** Original doorway; the year is an explicitly documented 2026 example, not a clock. */
export function createSternsingerModel(){
 const root=new THREE.Group();root.name='sternsinger-subject'
 const make=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const material=(color:number,roughness=1)=>new THREE.MeshStandardMaterial({color,roughness})
 const stone=material(0xc7ba9d),plaster=material(0xf3d9aa),wood=material(0x366c79,.85),dark=material(0x234955,.92),edge=material(0x60959a,.83),chalkMaterial=material(0xfff9df),metal=material(0xa98a4c,.43)
 metal.metalness=.6
 const box=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material)=>{const o=make(name,new THREE.BoxGeometry(w,h,d),mat);o.position.set(x,y,z);return o}
 const floor=.14
 box('sternsinger-threshold',3.5,floor,1.5,0,floor/2,.34,stone)
 // The surround is a real upright doorway; the inscription belongs to its lintel.
 for(const side of[-1,1]){
  box('sternsinger-wall-'+side,.44,2.52,.3,side*1.47,floor+1.26,-.12,plaster)
  box('sternsinger-jamb-'+side,.17,1.98,.28,side*1.16,floor+.99,.07,wood)
  box('sternsinger-jamb-edge-'+side,.04,1.98,.045,side*1.055,floor+.99,.2175,edge)
 }
 const door=box('sternsinger-door',2.10,1.97,.15,0,floor+.985,-.035,wood)
 const header=box('sternsinger-lintel',2.66,.48,.30,0,2.36,.08,dark)
 box('sternsinger-cornice',2.96,.11,.41,0,2.655,.065,edge)
 // Quiet inset panels, a narrow glass transom and brass hardware differentiate the materials.
 box('sternsinger-upper-panel',1.75,.93,.035,0,1.41,.0575,dark)
 box('sternsinger-lower-panel',1.75,.47,.035,0,.55,.0575,dark)
 box('sternsinger-upper-field',1.62,.80,.015,0,1.41,.0825,wood)
 box('sternsinger-lower-field',1.62,.34,.015,0,.55,.0825,wood)
 const plate=box('sternsinger-handle-plate',.085,.21,.018,.82,1.02,.099,metal)
 const handle=make('sternsinger-handle',new THREE.SphereGeometry(.042,16,10),metal);handle.position.set(.82,1.02,.15)
 const chalk=new THREE.Group();chalk.name='sternsinger-chalk';root.add(chalk)
 // Bevelled tip contacts the surface; the barrel stays wholly in front of it.
 const chalkBody=make('sternsinger-chalk-body',chalkGeometry(),chalkMaterial,chalk)
 const surfaceZ=.231,inscription='20*C+M+B+26',marks:THREE.Mesh[]=[],routes:{a:THREE.Vector3;b:THREE.Vector3;start:number;end:number;mark?:THREE.Mesh}[]=[]
 const lineMaterial=material(0xfffae8),unitLine=new THREE.PlaneGeometry(1,.013),startX=-1.11,baseline=2.235,cell=.205,glyphHeight=.24
 let duration=0,last:THREE.Vector3|undefined
 for(let g=0;g<inscription.length;g++)for(const stroke of glyphs[inscription[g]!]!){
  const points=stroke.map(([x,y])=>V(startX+g*cell+x*.20,baseline+y*glyphHeight,surfaceZ))
  if(last){const length=Math.max(.045,last.distanceTo(points[0]!)*.65);routes.push({a:last,b:points[0]!,start:duration,end:duration+length});duration+=length}
  for(let i=1;i<points.length;i++){
   const a=points[i-1]!,b=points[i]!,length=a.distanceTo(b),mark=make('sternsinger-mark-'+marks.length,unitLine,lineMaterial)
   mark.castShadow=false;mark.receiveShadow=false;mark.userData.surfaceDeposit=true;marks.push(mark)
   routes.push({a,b,start:duration,end:duration+length,mark});duration+=length
  }
  last=points.at(-1)!
 }
 const restRotation=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(.9,0,.435889894).normalize()),writingRotation=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(.35,-.35,.869).normalize())
 // Derive floor contact from actual chalk vertices, rather than a bounding-sphere guess.
 let minY=Infinity;const pv=new THREE.Vector3(),vertices=chalkBody.geometry.attributes.position!
 for(let i=0;i<vertices.count;i++)minY=Math.min(minY,pv.fromBufferAttribute(vertices,i).applyQuaternion(restRotation).y)
 const rest=V(-.80,floor-minY,.63),first=routes[0]!.a.clone(),lastPoint=last!.clone()
 let writing: {end:THREE.Vector3;mark:THREE.Mesh}|null=null
 function inscriptionPose(n:number){
  writing=null;const time=n*duration
  for(const r of routes){if(!r.mark)continue;const amount=THREE.MathUtils.clamp((time-r.start)/(r.end-r.start),0,1);r.mark.visible=amount>0;r.mark.scale.set(r.a.distanceTo(r.b)*amount,1,1);r.mark.position.copy(r.a).lerp(r.b,amount/2);r.mark.rotation.z=Math.atan2(r.b.y-r.a.y,r.b.x-r.a.x)}
  const route=routes.find(r=>time<r.end)??routes.at(-1)!,amount=THREE.MathUtils.clamp((time-route.start)/(route.end-route.start),0,1)
  chalk.position.copy(route.a).lerp(route.b,amount)
  if(route.mark)writing={end:chalk.position.clone(),mark:route.mark};else chalk.position.z+=Math.sin(Math.PI*amount)*.095
  chalk.quaternion.copy(writingRotation)
 }
 function pose(checkpoint:number,value:number){
  const t=THREE.MathUtils.clamp(Number.isFinite(value)?value:0,0,1)
  inscriptionPose(checkpoint===1?t:checkpoint>=2?1:0)
  if(checkpoint===0){chalk.position.copy(lerp(rest,first,t));chalk.position.z+=Math.sin(Math.PI*t)*.25;chalk.quaternion.copy(restRotation).slerp(writingRotation,t);writing=null}
  else if(checkpoint>=2){const n=checkpoint>=3?1:t;chalk.position.copy(lerp(lastPoint,rest,n));chalk.position.z+=Math.sin(Math.PI*n)*.36;chalk.quaternion.copy(writingRotation).slerp(restRotation,n);writing=null}
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject:root,chalk,chalkBody,door,header,plate,handle,marks,routes,inscription,surfaceZ,floor,rest,first,lastPoint,pose,activeStroke:()=>writing,dispose:()=>{},targets:[chalk,chalk,chalk],anchors:[[0,.16,0],[0,.16,0],[0,.16,0]] as [number,number,number][]}
}
