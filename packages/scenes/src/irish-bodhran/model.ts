import * as THREE from 'three'
import { createRitualMaterial } from '@wbr/scene-runtime/ritual-optics'

/** Original assisted frame drum; no force, skin or acoustic simulation. */
export function createBodhranModel(){
 const subject=new THREE.Group();subject.name='bodhran-subject'
 const tipper=new THREE.Group();tipper.name='bodhran-tipper';subject.add(tipper)
 const wood=new THREE.MeshStandardMaterial({color:'#af7d4a',roughness:.80}),cut=new THREE.MeshStandardMaterial({color:'#cfaa74',roughness:.82}),dark=new THREE.MeshStandardMaterial({color:'#714b34',roughness:.74})
 const skin=createRitualMaterial({color:'#ead4a4',roughness:.98}, { kind: 'skin', strength: .12, thickness: .018, fiber: false }),green=new THREE.MeshStandardMaterial({color:'#497363',roughness:.76})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const ring=(name:string,inner:number,outer:number,back:number,front:number,mat:THREE.Material)=>{const g=new THREE.LatheGeometry([[inner,back],[outer,back],[outer,front],[inner,front],[inner,back]].map(([r,z])=>new THREE.Vector2(r!,z!)),64);g.rotateX(Math.PI/2);return mesh(name,g,mat)}
 const frame=ring('bodhran-frame',.86,1,-.12,.12,wood)
 const headGeometry=new THREE.CylinderGeometry(.9,.9,.018,64);headGeometry.rotateX(Math.PI/2)
 const head=mesh('bodhran-head',headGeometry,skin);head.position.z=.125
 const rim=ring('bodhran-rim',.875,.995,.11,.15,green)
 const braces=[0,1].map(i=>{const bar=mesh('bodhran-back-brace-'+i,new THREE.BoxGeometry(1.9,.07,.07),cut);bar.position.z=-.07-.01*i;bar.rotation.z=i*Math.PI/2;return bar})
 const rodGeometry=new THREE.CylinderGeometry(.024,.024,.92,12);rodGeometry.rotateZ(Math.PI/2)
 const rod=mesh('bodhran-tipper-rod',rodGeometry,cut,tipper)
 const left=mesh('bodhran-tip-left',new THREE.SphereGeometry(.075,16,12),dark,tipper);left.position.x=-.46
 const right=mesh('bodhran-tip-right',new THREE.SphereGeometry(.075,16,12),dark,tipper);right.position.x=.46
 const tipperMeshes=[rod,left,right],v=new THREE.Vector3()
 headGeometry.computeBoundingBox();const headFront=head.position.z+headGeometry.boundingBox!.max.z
 function pose(step:number,n:number){
  const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1),pulse=step<2&&t!==0&&t!==1?Math.sin(Math.PI*t):0
  subject.position.y=0;subject.rotation.z=step<2?0:step===2?.35*t:.35
  tipper.rotation.y=(step===1?-1:1)*.65*pulse;tipper.position.set(0,.1,0);subject.updateMatrixWorld(true)
  let minZ=Infinity
  for(const o of tipperMeshes){const p=o.geometry.attributes.position!;for(let i=0;i<p.count;i++)minZ=Math.min(minZ,v.fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld).z)}
  // Real rigid vertices stay in front of the skin; opposite ends touch at midstroke.
  tipper.position.z=headFront-minZ+.25*(1-pulse);subject.updateMatrixWorld(true)
  let minY=Infinity;const p=frame.geometry.attributes.position!;for(let i=0;i<p.count;i++)minY=Math.min(minY,v.fromBufferAttribute(p,i).applyMatrix4(frame.matrixWorld).y)
  subject.position.y=-minY;subject.updateMatrixWorld(true)
 }
 pose(0,0)
 return{subject,tipper,frame,head,rim,braces,rod,left,right,headFront,tipperMeshes,pose,targets:[right,left,rim],roots:[right,left,rim],anchors:[[0,.025,.06],[0,.025,.06],[.95,.1,.151]] as [number,number,number][]}
}
