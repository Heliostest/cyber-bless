import * as THREE from 'three'

const V=(x=0,y=0,z=0)=>new THREE.Vector3(x,y,z)
const smooth=(n:number)=>{const t=THREE.MathUtils.clamp(n,0,1);return t*t*(3-2*t)}

/** Original cutaway entrance; the coal gift crosses the actual opening into the host's hearth. */
export function createFirstFootingModel(){
 const root=new THREE.Group();root.name='first-footing-subject'
 const material=(color:number,roughness=.8,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
 const sandstone=material(0xb6aa8b),edge=material(0x8e8773),wood=material(0x9b7651),grain=material(0x7b5d43),blueStone=material(0x8faaa9),linen=material(0xd3c1a0),charcoal=material(0x29353b,.59,.12),iron=material(0x4b4c41,.55,.3),inside=material(0x484b42)
 const solids:THREE.Mesh[]=[]
 const mesh=(name:string,geometry:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=root,x=0,y=0,z=0)=>{const m=new THREE.Mesh(geometry,mat);m.name=name;m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material,solid=true)=>{const m=mesh(name,new THREE.BoxGeometry(w,h,d),mat,root,x,y,z);if(solid)solids.push(m);return m}
 box('outside-step',0,-.06,.85,3,.12,1.6,blueStone)
 box('inside-floor',0,-.06,-.55,3,.12,1.2,wood)
 for(let x=-1.45;x<1.5;x+=.25)box('floor-seam-'+x,x,.001,-.55,.008,.002,1.16,grain,false)
 box('stone-threshold',.45,.045,.35,1.16,.09,.24,sandstone)
 box('door-post-left',-.17,1.0,.35,.14,2,.24,edge)
 box('door-post-right',1.07,1.0,.35,.14,2,.24,edge)
 box('door-lintel',.45,2.03,.35,1.38,.16,.30,edge)
 for(const x of[-.17,1.07])box('post-light-face-'+x,x,1.0,.477,.10,1.96,.014,sandstone,false)
 // The door is already open: no closed sheet blocks the gift's inward path.
 box('open-door',1.25,.96,-.29,.10,1.92,1.02,wood)
 for(const z of[-.64,-.39,-.14])box('door-board-'+z,1.307,.96,z,.014,1.82,.008,grain,false)
 const handle=mesh('open-door-handle',new THREE.TorusGeometry(.052,.012,8,20),iron,root,1.317,.88,.04);handle.rotation.y=Math.PI/2
 box('coal-cloth',.36,.0225,1.12,.80,.045,.68,linen)
 for(const x of[-.01,.73])box('cloth-stripe-'+x,x,.0458,1.12,.012,.0015,.64,wood,false)
 // A bevelled, closed uneven lump with a genuinely planar base, rather than a black sphere.
 const outline=new THREE.Shape();[[-.21,-.17],[.07,-.21],[.26,-.10],[.22,.15],[.04,.21],[-.25,.12],[-.28,-.03]].forEach(([x,y],i)=>i?outline.lineTo(x!,y!):outline.moveTo(x!,y!));outline.closePath()
 const coalGeometry=new THREE.ExtrudeGeometry(outline,{depth:.29,bevelEnabled:true,bevelThickness:.025,bevelSize:.028,bevelSegments:1,steps:1});coalGeometry.rotateX(-Math.PI/2);coalGeometry.computeBoundingBox();coalGeometry.translate(0,-coalGeometry.boundingBox!.min.y,0);coalGeometry.computeBoundingBox()
 charcoal.flatShading=true
 const coal=mesh('first-foot-coal',coalGeometry,charcoal)
 const fireplaceX=-.75,backZ=-.97
 box('hearth-floor',fireplaceX,.06,-.68,1.30,.12,.76,sandstone)
 box('hearth-back',fireplaceX,.52,backZ,1.30,.92,.12,inside)
 box('hearth-left',-1.34,.52,-.68,.12,.92,.70,edge)
 box('hearth-right',-.16,.52,-.68,.12,.92,.70,edge)
 box('hearth-lintel',fireplaceX,1.03,-.68,1.42,.16,.82,sandstone)
 box('hearth-mantel',fireplaceX,1.14,-.68,1.52,.07,.91,wood)
 for(const y of[.29,.57,.85])for(const x of[-1.34,-.16])box('stone-course-'+x+'-'+y,x,y,-.319,.12,.014,.008,grain,false)
 const embers=new THREE.MeshStandardMaterial({color:0xb95d35,emissive:0x8b3013,emissiveIntensity:.65,roughness:1})
 for(const [i,x,z]of[[0,-1.17,-.72],[1,-.36,-.75],[2,-1.17,-.48],[3,-.36,-.48]]){const ember=mesh('ember-'+i,new THREE.IcosahedronGeometry(.085,0),embers,root,x,.145,z);ember.scale.set(1,.28,.6)}
 // These quiet flames are original visual staging, not a timed promise or a required ritual count.
 const flameMat=new THREE.MeshBasicMaterial({color:0xe5b45f}),flameCore=new THREE.MeshBasicMaterial({color:0xffdf9a})
 for(const [i,x,z]of[[0,-1.17,-.72],[1,-.36,-.74]]){const f=mesh('hearth-flame-'+i,new THREE.ConeGeometry(.07,.25,7),flameMat,root,x,.27,z);f.scale.z=.5;const c=mesh('flame-core-'+i,new THREE.ConeGeometry(.036,.15,7),flameCore,root,x,.22,z+.018);c.scale.z=.5}
 const fireLight=new THREE.PointLight(0xffbd75,.65,2);fireLight.name='hearth-warm-light';fireLight.position.set(fireplaceX,.42,-.40);root.add(fireLight)
 const rest=V(.36,.045,1.12),held=V(.36,.87,1.12),through=V(.36,.50,-.02),front=V(-.75,.50,-.02),lower=V(-.75,.24,-.02),seat=V(-.75,.12,-.65)
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
