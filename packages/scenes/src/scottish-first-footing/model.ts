import { applyCraftSurface } from '@wbr/scene-runtime/craft-surfaces'
import * as THREE from 'three'
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js'

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z)
const smooth=(n:number)=>{const t=THREE.MathUtils.clamp(n,0,1);return t*t*(3-2*t)}

/** Original cutaway entrance; the coal gift crosses the actual opening into the host's hearth. */
export function createFirstFootingModel(){
 const root=new THREE.Group();root.name='first-footing-subject'
 const material=(color:number,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
 const sandstone=material(0xb6aa8b),edge=material(0x8e8773),floorWood=material(0x9b7651),doorWood=material(0x9b7651),mantelWood=material(0x9b7651),grain=material(0x7b5d43),blueStone=material(0x8faaa9),linen=material(0xd3c1a0),charcoal=material(0x29353b,.59,.12),iron=material(0x4b4c41,.55,.3),inside=material(0x484b42)
 const woodGrainZ=grain.clone(),woodGrainY=grain.clone(),clothStripe=material(0x9b7651)
 applyCraftSurface(floorWood, { kind: 'wood', axis: 'z', strength: .4 })
 applyCraftSurface(doorWood, { kind: 'wood', axis: 'y', strength: .4 })
 applyCraftSurface(mantelWood, { kind: 'wood', axis: 'x', strength: .4 })
 applyCraftSurface(woodGrainZ, { kind: 'wood', axis: 'z', strength: .35 })
 applyCraftSurface(woodGrainY, { kind: 'wood', axis: 'y', strength: .35 })
 applyCraftSurface(linen, { kind: 'fabric', strength: .28 })
 applyCraftSurface(clothStripe, { kind: 'fabric', strength: .26 })
 applyCraftSurface(iron, { kind: 'metal', strength: .45 })
 applyCraftSurface(sandstone, { kind: 'stone', strength: .4 })
 applyCraftSurface(edge, { kind: 'stone', strength: .38 })
 applyCraftSurface(blueStone, { kind: 'stone', strength: .4 })

 const solids:THREE.Mesh[]=[]
 const mesh=(name:string,geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=root,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,solid=true)=>{const m=mesh(name,new THREE.BoxGeometry(w,h,d),mat,root,x,y,z);if(solid)solids.push(m);return m}
 const rbox=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,solid=true,radius=.014)=>{const m=mesh(name,new RoundedBoxGeometry(w,h,d,2,Math.min(radius,w/3,h/3,d/3)),mat,root,x,y,z);if(solid)solids.push(m);return m}
 rbox('outside-step',0,-.06,.85,3,.12,1.6,blueStone,true,.016)
 rbox('inside-floor',0,-.06,-.55,3,.12,1.2,floorWood,true,.014)
 for(let x=-1.45;x<1.5;x+=.25)box('floor-seam-'+x,x,.001,-.55,.008,.002,1.16,woodGrainZ,false)
 rbox('stone-threshold',.45,.045,.35,1.16,.09,.24,sandstone,true,.014)
 rbox('door-post-left',-.17,1.0,.35,.14,2,.24,edge,true,.014)
 rbox('door-post-right',1.07,1.0,.35,.14,2,.24,edge,true,.014)
 rbox('door-lintel',.45,2.03,.35,1.38,.16,.30,edge,true,.016)
 for(const x of[-.17,1.07])rbox('post-light-face-'+x,x,1.0,.477,.10,1.96,.014,sandstone,false,.004)
 // The door is already open: no closed sheet blocks the gift's inward path.
 rbox('open-door',1.25,.96,-.29,.10,1.92,1.02,doorWood,true,.012)
 for(const z of[-.64,-.39,-.14])box('door-board-'+z,1.307,.96,z,.014,1.82,.008,woodGrainY,false)
 const handle=mesh('open-door-handle',new THREE.TorusGeometry(.052,.012,8,20),iron,root,1.317,.88,.04);handle.rotation.y=Math.PI/2
 // Thin folded linen presentation cloth with woven side stripes and soft folded hem edges.
 rbox('coal-cloth',.36,.006,1.12,.80,.012,.68,linen,true,.004)
 for(const x of[-.01,.73])box('cloth-stripe-'+x,x,.0126,1.12,.012,.0015,.64,clothStripe,false)
 for(const z of[.805,1.435])rbox('cloth-hem-'+z,.36,.0126,z,.76,.0018,.014,clothStripe,false,.0006)
 // A bevelled, closed uneven lump with a genuinely planar base, rather than a black sphere.
 const outline=new THREE.Shape();[[-.21,-.17],[.07,-.21],[.26,-.10],[.22,.15],[.04,.21],[-.25,.12],[-.28,-.03]].forEach(([x,y],i)=>i?outline.lineTo(x!,y!):outline.moveTo(x!,y!));outline.closePath()
 const coalGeometry=new THREE.ExtrudeGeometry(outline,{depth:.29,bevelEnabled:true,bevelThickness:.025,bevelSize:.028,bevelSegments:1,steps:1});coalGeometry.rotateX(-Math.PI/2);coalGeometry.computeBoundingBox();coalGeometry.translate(0,-coalGeometry.boundingBox!.min.y,0);coalGeometry.computeBoundingBox()
 charcoal.flatShading=true
 const coal=mesh('first-foot-coal',coalGeometry,charcoal)
 const fireplaceX=-.75,backZ=-.97
 rbox('hearth-floor',fireplaceX,.06,-.68,1.30,.12,.76,sandstone,true,.014)
 rbox('hearth-back',fireplaceX,.52,backZ,1.30,.92,.12,inside,true,.012)
 rbox('hearth-left',-1.34,.52,-.68,.12,.92,.70,edge,true,.014)
 rbox('hearth-right',-.16,.52,-.68,.12,.92,.70,edge,true,.014)
 rbox('hearth-lintel',fireplaceX,1.03,-.68,1.42,.16,.82,sandstone,true,.016)
 rbox('hearth-mantel',fireplaceX,1.14,-.68,1.52,.07,.91,mantelWood,true,.012)
 for(const y of[.29,.57,.85])for(const x of[-1.34,-.16])box('stone-course-'+x+'-'+y,x,y,-.319,.12,.014,.008,grain,false)
 const embers=new THREE.MeshStandardMaterial({color:0xb95d35,emissive:0x8b3013,emissiveIntensity:.65,roughness:1})
 for(const [i,x,z]of[[0,-1.17,-.72],[1,-.36,-.75],[2,-1.17,-.48],[3,-.36,-.48]]){const ember=mesh('ember-'+i,new THREE.IcosahedronGeometry(.085,0),embers,root,x,.145,z);ember.scale.set(1,.28,.6)}
 // These quiet flames are original visual staging, not a timed promise or a required ritual count.
 const flameMat=new THREE.MeshBasicMaterial({color:0xe5b45f}),flameCore=new THREE.MeshBasicMaterial({color:0xffdf9a})
 for(const [i,x,z]of[[0,-1.17,-.72],[1,-.36,-.74]]){const f=mesh('hearth-flame-'+i,new THREE.ConeGeometry(.07,.25,7),flameMat,root,x,.27,z);f.scale.z=.5;const c=mesh('flame-core-'+i,new THREE.ConeGeometry(.036,.15,7),flameCore,root,x,.22,z+.018);c.scale.z=.5}
 const fireLight=new THREE.PointLight(0xffbd75,.65,2);fireLight.name='hearth-warm-light';fireLight.position.set(fireplaceX,.42,-.40);root.add(fireLight)
 const rest=V(.36,.012,1.12),held=V(.36,.87,1.12),through=V(.36,.50,-.02),front=V(-.75,.50,-.02),lower=V(-.75,.24,-.02),seat=V(-.75,.12,-.65)
 const pose=(step:number,n:number)=>{
  const t=THREE.MathUtils.clamp(n,0,1);if(t===1&&step<3){pose(step+1,0);return};coal.position.copy(rest);coal.rotation.set(0,0,0)
  if(step===0)coal.position.lerpVectors(rest,held,smooth(t))
  else if(step===1)coal.position.lerpVectors(held,through,smooth(t))
  else if(step===2){
   if(t<.40)coal.position.lerpVectors(through,front,smooth(t/.40))
   else if(t<.72)coal.position.lerpVectors(front,lower,smooth((t-.40)/.32))
   else coal.position.lerpVectors(lower,seat,smooth((t-.72)/.28))
  }else coal.position.copy(seat)
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,coal,solids,seat,targets:[coal,coal,coal],roots:[coal,coal,coal],anchors:[[0,.23,.16],[0,.23,.16],[0,.23,.16]] as [number,number,number][],pose,dispose(){fireLight.dispose()}}
}
