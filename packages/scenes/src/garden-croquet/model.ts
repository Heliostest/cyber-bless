import * as THREE from 'three'

/** Original guided lawn vignette; a kinematic contact, not a stroke/physics tutorial. */
export function createCroquetModel(){
 const root=new THREE.Group();root.name='croquet-root'
 const subject=new THREE.Group();subject.name='croquet-subject';root.add(subject)
 const mallet=new THREE.Group();mallet.name='croquet-mallet';subject.add(mallet)
 const wood=new THREE.MeshStandardMaterial({color:'#bb8b52',roughness:.83}),dark=new THREE.MeshStandardMaterial({color:'#765334',roughness:.82}),coral=new THREE.MeshStandardMaterial({color:'#ce6651',roughness:.5}),cream=new THREE.MeshStandardMaterial({color:'#fff0cd',roughness:.5}),white=new THREE.MeshStandardMaterial({color:'#ece9d9',metalness:.25,roughness:.6}),green=new THREE.MeshStandardMaterial({color:'#8fae57',roughness:1})
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material|THREE.Material[],parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const lawn=mesh('croquet-lawn',new THREE.CylinderGeometry(1,1,.04,64).scale(3,1,1.2),green,root);lawn.position.y=-.02
 const head=mesh('croquet-head',new THREE.CylinderGeometry(.18,.18,.52,32).rotateZ(Math.PI/2),wood,mallet);head.position.set(-1.88,.18,0)
 const shaft=mesh('croquet-shaft',new THREE.CylinderGeometry(.035,.035,1.5,24),wood,mallet);shaft.position.set(-1.88,.92,0)
 const grip=mesh('croquet-grip',new THREE.CylinderGeometry(.06,.06,.3,24),dark,mallet);grip.position.set(-1.88,1.55,0)
 const bg=new THREE.SphereGeometry(.18,32,20),p=bg.getAttribute('position'),idx=bg.index!;bg.clearGroups();let start=0,material=-1
 for(let i=0;i<idx.count;i+=3){const y=(p.getY(idx.getX(i))+p.getY(idx.getX(i+1))+p.getY(idx.getX(i+2)))/3,next=Math.abs(y)<.05?1:0;if(next!==material){if(material>=0)bg.addGroup(start,i-start,material);start=i;material=next}}
 bg.addGroup(start,idx.count-start,material)
 const ball=mesh('croquet-ball',bg,[coral,cream])
 const posts=[-.44,.44].map((z,i)=>{const o=mesh('croquet-post-'+i,new THREE.CylinderGeometry(.04,.04,1,24),white);o.position.set(.55,.5,z);return o})
 const bar=mesh('croquet-crossbar',new THREE.CylinderGeometry(.04,.04,.96,24).rotateX(Math.PI/2),white);bar.position.set(.55,.98,0)
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1),lerp=THREE.MathUtils.lerp;let x=-1.4,offset=0;if(step===0)offset=lerp(0,-.45,t);else if(step===1){if(t<=.4)offset=lerp(-.45,.04,t/.4);else{const u=(t-.4)/.6;offset=lerp(.04,-.12,u);x=lerp(-1.4,.9,u)}}else if(step===2){offset=lerp(-.12,0,t);x=lerp(.9,1.7,t)}else x=1.7;mallet.position.x=offset===0?0:offset;ball.position.set(x,.18,0);const angle=-(x+1.4)/.18;ball.rotation.z=angle===0?0:angle;root.updateMatrixWorld(true)}
 pose(0,0)
 return{root,subject,mallet,lawn,head,shaft,grip,ball,posts,bar,pose,targets:[grip,grip,ball],roots:[grip,grip,ball],anchors:[[.02,.1,.05],[.02,.1,.05],[.04,.17,.04]] as [number,number,number][]}
}
