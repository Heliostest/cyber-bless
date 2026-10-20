import * as THREE from 'three'

/** Prepared round rice cakes and a daidai orange, placed on a clean paper surface. */
export function createKagamiModel() {
 const root=new THREE.Group();root.name='kagami-root'
 const subject=new THREE.Group();subject.name='kagami-subject';root.add(subject)
 const mat=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
 const rice=mat(0xfff2d6,.96),orange=mat(0xf29a32,.64),green=mat(0x56794b),wood=mat(0xa67951),paper=mat(0xfff7e8,1),edge=mat(0xc8514d)
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 const base=mesh(new THREE.BoxGeometry(2.60,.12,2.78),wood,subject,'kagami-low-wood-base');base.position.set(0,-.06,.15)
 const cloth=mesh(new THREE.BoxGeometry(2.52,.012,2.70),edge,subject,'kagami-paper-edge');cloth.position.set(0,.006,.15)
 const sheet=mesh(new THREE.BoxGeometry(2.45,.004,2.63),paper,subject,'kagami-paper');sheet.position.set(0,.014,.15)
 // Closed lathed profiles have flat contact patches at their top and bottom.
 const round=(r:number,h:number,material:THREE.Material,parent:THREE.Object3D,name:string)=>{
  const points=[[0,0],[r*.63,0],[r*.82,h*.035],[r*.95,h*.16],[r,h*.40],[r*.98,h*.62],[r*.90,h*.82],[r*.75,h*.96],[r*.63,h],[0,h]].map(([x,y])=>new THREE.Vector2(x!,y!))
  return mesh(new THREE.LatheGeometry(points,64),material,parent,name)
 }
 const roots=[0,1,2].map(i=>{const o=new THREE.Group();o.name=`kagami-root-${i}`;subject.add(o);return o})
 const large=round(.66,.29,rice,roots[0]!,'kagami-large'),small=round(.48,.24,rice,roots[1]!,'kagami-small')
 const fruit=round(.20,.34,orange,roots[2]!,'kagami-orange')
 const stem=mesh(new THREE.CylinderGeometry(.014,.021,.075,10),green,roots[2]!,'kagami-orange-stem');stem.position.y=.36
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,o=mesh(new THREE.SphereGeometry(1,12,8),green,roots[2]!,`kagami-calyx-${i}`);o.scale.set(.033,.008,.018);o.position.set(Math.cos(a)*.023,.336,Math.sin(a)*.023);o.rotation.y=-a}
 const leaf=mesh(new THREE.SphereGeometry(1,16,8),green,roots[2]!,'kagami-leaf');leaf.scale.set(.10,.014,.038);leaf.position.set(.082,.382,0);leaf.rotation.z=.13
 const starts=[new THREE.Vector3(-.50,.016,.75),new THREE.Vector3(.70,.016,.80),new THREE.Vector3(.75,.016,-.85)]
 const ends=[new THREE.Vector3(-.25,.016,-.45),new THREE.Vector3(-.25,.306,-.45),new THREE.Vector3(-.25,.546,-.45)]
 const pose=(step:number,n:number)=>{
  const t=Number.isFinite(n)?THREE.MathUtils.clamp(n,0,1):0
  roots.forEach((o,i)=>{
   o.position.copy(i<step?ends[i]!:starts[i]!);o.rotation.set(0,0,0)
   if(i===step&&step<3){
    const lift=THREE.MathUtils.clamp(t/.3,0,1),travel=THREE.MathUtils.clamp((t-.3)/.4,0,1),lower=THREE.MathUtils.clamp((t-.7)/.3,0,1),high=.9
    o.position.lerpVectors(starts[i]!,ends[i]!,travel)
    o.position.y=t<.3?THREE.MathUtils.lerp(starts[i]!.y,high,lift):THREE.MathUtils.lerp(high,ends[i]!.y,lower)
   }
  });root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject,targets:[large,small,fruit],roots,anchors:[[0,.18,0],[0,.15,0],[0,.17,0]] as [number,number,number][],pose}
}
