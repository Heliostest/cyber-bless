import { getEnvironmentProfile } from '@wbr/scene-runtime'
import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import { createProgressivePolygonsSlices, layoutTextPolygons } from '@wbr/scene-runtime/glyph-kit'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

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
 const stone=material(0xc7ba9d),plaster=material(0xf3d9aa),woodY=material(0x366c79,.85),darkX=material(0x234955,.92),darkY=material(0x234955,.92),edgeX=material(0x60959a,.83),edgeY=material(0x60959a,.83),chalkMaterial=material(0xfff9df),metal=material(0xa98a4c,.43)
 metal.metalness=.6
 applyCraftSurface(woodY, { kind: 'wood', axis: 'y', strength: .4 })
 applyCraftSurface(darkX, { kind: 'wood', axis: 'x', strength: .22 })
 applyCraftSurface(darkY, { kind: 'wood', axis: 'y', strength: .22 })
 applyCraftSurface(edgeX, { kind: 'wood', axis: 'x', strength: .22 })
 applyCraftSurface(edgeY, { kind: 'wood', axis: 'y', strength: .22 })
 applyCraftSurface(metal, { kind: 'metal', strength: .45 })
 applyCraftSurface(stone, { kind: 'stone', strength: .4 })

 const rbox=(name:string,w:number,h:number,d:number,x:number,y:number,z:number,mat:THREE.Material,radius=.014)=>{const o=make(name,new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/3,h/3,d/3)),mat);o.position.set(x,y,z);return o}
 const floor=.14
 const groundY=getEnvironmentProfile('sternsinger-house-blessing')?.floor??-.065
 rbox('sternsinger-threshold',3.46,floor-groundY,1.32,0,(floor+groundY)/2,.29,stone,.022)
 // The surround is a real upright doorway; the inscription belongs to its lintel.
 for(const side of[-1,1]){
  rbox('sternsinger-wall-'+side,.44,2.52,.3,side*1.47,floor+1.26,-.12,plaster,.016)
  rbox('sternsinger-jamb-'+side,.17,1.98,.28,side*1.16,floor+.99,.07,woodY,.014)
  rbox('sternsinger-jamb-edge-'+side,.04,1.98,.045,side*1.055,floor+.99,.2175,edgeY,.008)
 }
 const door=rbox('sternsinger-door',2.10,1.97,.15,0,floor+.985,-.035,woodY,.014)
 const header=rbox('sternsinger-lintel',2.66,.48,.30,0,2.36,.08,darkX,.014)
 rbox('sternsinger-cornice',2.96,.11,.41,0,2.655,.065,edgeX,.014)
 // Quiet inset panels, a narrow glass transom and brass hardware differentiate the materials.
 rbox('sternsinger-upper-panel',1.75,.93,.035,0,1.41,.0575,darkY,.008)
 rbox('sternsinger-lower-panel',1.75,.47,.035,0,.55,.0575,darkY,.008)
 rbox('sternsinger-upper-field',1.62,.80,.015,0,1.41,.0825,woodY,.004)
 rbox('sternsinger-lower-field',1.62,.34,.015,0,.55,.0825,woodY,.004)
 const plate=rbox('sternsinger-handle-plate',.085,.21,.018,.82,1.02,.099,metal,.004)
 const handle=make('sternsinger-handle',new THREE.SphereGeometry(.042,16,10),metal);handle.position.set(.82,1.02,.15)
 const chalk=new THREE.Group();chalk.name='sternsinger-chalk';root.add(chalk)
 // Bevelled tip contacts the surface; the barrel stays wholly in front of it.
 const chalkBody=make('sternsinger-chalk-body',chalkGeometry(),chalkMaterial,chalk)
 const surfaceZ=.231,inscription='20*C+M+B+26',marks:THREE.Mesh[]=[],routes:{a:THREE.Vector3;b:THREE.Vector3;start:number;end:number;mark?:THREE.Mesh}[]=[]
 // Classical Roman serif chalk lettering (Cinzel Bold, SIL OFL 1.1) sliced cleanly left-to-right
 // with subtle powdery chalk vertex modulation so each glyph reveals directly beneath the chalk tip.
 const lineMaterial=new THREE.MeshStandardMaterial({color:0xfffae8,roughness:1,vertexColors:true,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1})
 const lintelCenterY=2.36
 const layout=layoutTextPolygons('cinzelBold',inscription,{center:true,fitBox:[2.24,.245],letterSpacing:.075,flatness:.004})
 const chalkDust=(x:number,y:number,out:THREE.Color)=>{
  const grain=0.90+0.10*(0.5+0.5*Math.sin(x*165+Math.cos(y*195)*2.3)*Math.cos((x-y)*110))
  out.setRGB(grain,grain*0.992,grain*0.97)
 }
 let duration=0,last:THREE.Vector3|undefined
 for(const glyphItem of layout.glyphs){
  if(glyphItem.polygons.length===0)continue
  const sliceCount=glyphItem.char==='*'||glyphItem.char==='+'?3:4
  const pieces=createProgressivePolygonsSlices(glyphItem.polygons,sliceCount,{direction:'x',maxEdgeLength:.045,plane:'xy',zOffset:0,vertexColor:chalkDust})
  for(let pIdx=0;pIdx<pieces.length;pIdx++){
   const piece=pieces[pIdx]!
   const x0=piece.bounds.minX,x1=piece.bounds.maxX,midY=(piece.bounds.minY+piece.bounds.maxY)*0.5
   const spanX=Math.max(1e-4,x1-x0)
   piece.geometry.translate(-x0,-midY,0)
   piece.geometry.computeBoundingBox();piece.geometry.computeBoundingSphere()
   const a=V(x0,lintelCenterY+midY,surfaceZ),b=V(x1,lintelCenterY+midY,surfaceZ)
   if(pIdx===0&&last){
    const liftLen=Math.max(.065,last.distanceTo(a)*.85)
    routes.push({a:last,b:a,start:duration,end:duration+liftLen});duration+=liftLen
   }
   const mark=make('sternsinger-mark-'+marks.length,piece.geometry,lineMaterial)
   mark.position.copy(a)
   mark.castShadow=false;mark.receiveShadow=false;mark.userData.surfaceDeposit=true;mark.userData.toonSurface={outline:false}
   marks.push(mark)
   const writeLen=Math.max(.035,spanX*1.35)
   routes.push({a,b,start:duration,end:duration+writeLen,mark});duration+=writeLen
   last=b
  }
 }
 const restRotation=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(.9,0,.435889894).normalize()),writingRotation=new THREE.Quaternion().setFromUnitVectors(V(0,1,0),V(.35,-.35,.869).normalize())
 // Derive floor contact from actual chalk vertices, rather than a bounding-sphere guess.
 let minY=Infinity;const pv=new THREE.Vector3(),vertices=chalkBody.geometry.attributes.position!
 for(let i=0;i<vertices.count;i++)minY=Math.min(minY,pv.fromBufferAttribute(vertices,i).applyQuaternion(restRotation).y)
 const rest=V(-.80,floor-minY,.63),first=routes[0]!.a.clone(),lastPoint=last!.clone()
 let writing: {end:THREE.Vector3;mark:THREE.Mesh}|null=null
 function inscriptionPose(n:number){
  writing=null;const time=n*duration
  for(const r of routes){if(!r.mark)continue;const amount=THREE.MathUtils.clamp((time-r.start)/(r.end-r.start),0,1);r.mark.visible=amount>0;r.mark.scale.set(amount,1,1)}
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
