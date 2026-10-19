import * as THREE from 'three'

/** Original unbranded mill. Assisted crank/drawer motion; beans and grounds stay static. */
export function createCoffeeMillModel(){
 const subject=new THREE.Group();subject.name='coffee-subject'
 const crank=new THREE.Group();crank.name='coffee-crank';subject.add(crank)
 const drawer=new THREE.Group();drawer.name='coffee-drawer';subject.add(drawer)
 const wood=new THREE.MeshStandardMaterial({color:'#b17b45',roughness:.78}),cut=new THREE.MeshStandardMaterial({color:'#d5b27b',roughness:.85})
 const green=new THREE.MeshStandardMaterial({color:'#577c67',roughness:.72}),steel=new THREE.MeshStandardMaterial({color:'#7e9699',roughness:.43,metalness:.55})
 const brass=new THREE.MeshStandardMaterial({color:'#b7a26b',roughness:.58,metalness:.45}),grounds=new THREE.MeshStandardMaterial({color:'#5b3b26',roughness:1})
 const beanMaterial=new THREE.MeshStandardMaterial({color:'#70442b',roughness:.86,vertexColors:true}),frameSolids:THREE.Mesh[]=[]
 const mesh=(name:string,g:THREE.BufferGeometry,mat:THREE.Material,parent:THREE.Object3D=subject)=>{const o=new THREE.Mesh(g,mat);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);if(parent===subject)frameSolids.push(o);return o}
 const box=(name:string,x:number,y:number,z:number,w:number,h:number,d:number,mat:THREE.Material=wood,parent:THREE.Object3D=subject)=>{const o=mesh(name,new THREE.BoxGeometry(w,h,d),mat,parent);o.position.set(x,y,z);return o}
 const caseBase=box('coffee-case-base',0,.05,0,1.3,.1,1.3)
 for(const sign of[-1,1])box('coffee-case-side-'+sign,sign*.6,.60,0,.1,1.00,1.3)
 box('coffee-case-back',0,.60,-.6,1.1,1.00,.1)
 box('coffee-case-front-upper',0,.87,.6,1.1,.46,.1,green);box('coffee-case-front-lower',0,.12,.6,1.1,.04,.1)
 for(const sign of[-1,1]){box('coffee-top-side-'+sign,sign*.385,1.15,0,.53,.1,1.3,cut);box('coffee-top-end-'+sign,0,1.15,sign*.385,.24,.1,.53,cut)}
 const rails=[-1,1].map(sign=>box('coffee-internal-runner-'+sign,sign*.46,.13,0,.1,.06,1.1,cut))
 const lathe=(profile:number[][],segments:number)=>new THREE.LatheGeometry(profile.map(([x,y])=>new THREE.Vector2(x!,y!)),segments)
 const bearing=mesh('coffee-bearing',lathe([[.055,1.16],[.23,1.16],[.23,1.32],[.055,1.32],[.055,1.16]],24),steel)
 const hopper=mesh('coffee-hopper',lathe([[.21,1.28],[.25,1.28],[.55,1.72],[.51,1.72],[.21,1.28]],32),brass)
 const shaft=mesh('coffee-shaft',new THREE.CylinderGeometry(.035,.035,1.31,24),steel,crank);shaft.position.y=1.415
 const hub=mesh('coffee-crank-hub',new THREE.CylinderGeometry(.09,.09,.1,16),steel,crank);hub.position.y=2.02
 const arm=box('coffee-crank-arm',.36,2.02,0,.72,.07,.10,steel,crank)
 const pin=mesh('coffee-grip-pin',new THREE.CylinderGeometry(.035,.035,.15,12),steel,crank);pin.position.set(.72,2.075,0)
 const grip=mesh('coffee-grip',new THREE.CylinderGeometry(.085,.085,.36,12),green,crank);grip.position.set(.72,2.3,0)
 const drawerFloor=box('coffee-drawer-floor',0,.19,.02,1.04,.06,1.06,cut,drawer)
 for(const sign of[-1,1])box('coffee-drawer-side-'+sign,sign*.49,.37,.05,.06,.30,1.00,cut,drawer)
 box('coffee-drawer-back',0,.37,-.48,1.04,.30,.06,cut,drawer);box('coffee-drawer-front',0,.41,.59,1.04,.38,.08,wood,drawer)
 const stem=mesh('coffee-drawer-knob-stem',new THREE.CylinderGeometry(.035,.035,.12,12),brass,drawer);stem.rotation.x=Math.PI/2;stem.position.set(0,.41,.66)
 const knob=mesh('coffee-drawer-knob',new THREE.SphereGeometry(.09,16,8),green,drawer);knob.position.set(0,.41,.74)
 const powder=mesh('coffee-grounds',new THREE.CylinderGeometry(.37,.39,.045,24),grounds,drawer);powder.position.set(0,.2425,.03)
 const beans:THREE.Mesh[]=[]
 for(let k=0;k<8;k++){
  const phi=k*Math.PI/4,g=new THREE.SphereGeometry(1,12,8);g.scale(.07,.04,.055)
  const p=g.attributes.position!,colors=new Float32Array(p.count*3)
  for(let i=0;i<p.count;i++){const x=p.getX(i),y=p.getY(i),z=p.getZ(i),groove=Math.exp(-((z/.012)**2))*Math.max(0,1-(x/.075)**2)*Math.max(0,y/.04);p.setY(i,y*(1-.30*groove));const shade=1-.35*groove;colors.set([shade,shade,shade],i*3)}
  g.setAttribute('color',new THREE.BufferAttribute(colors,3));g.rotateY(phi);g.computeVertexNormals()
  const bean=mesh('coffee-bean-'+k,g,beanMaterial);bean.position.set(.30*Math.cos(phi),0,.30*Math.sin(phi))
  // Fit to all actual inner hopper planes, leaving a small display clearance above the bowl.
  let y=-Infinity
  for(let j=0;j<p.count;j++)for(let i=0;i<32;i++){const a=(i+.5)*2*Math.PI/32,r=((p.getX(j)+bean.position.x)*Math.cos(a)+(p.getZ(j)+bean.position.z)*Math.sin(a))/Math.cos(Math.PI/32);y=Math.max(y,1.28+(r-.21)/(.30/.44)-p.getY(j))}
  bean.position.y=y+.002;beans.push(bean)
 }
 function pose(step:number,n:number){const t=THREE.MathUtils.clamp(Number.isFinite(n)?n:0,0,1);crank.rotation.y=step===0?(t===1?-.6+Math.PI:-.6+Math.PI*t):step===1?(t===1?-.6+2*Math.PI:-.6+Math.PI+Math.PI*t):-.6+2*Math.PI;drawer.position.z=step<2?0:step===2?.75*t:.75;subject.updateMatrixWorld(true)}
 pose(0,0)
 return{subject,crank,drawer,caseBase,frameSolids,rails,bearing,hopper,shaft,hub,arm,pin,grip,drawerFloor,knob,powder,beans,pose,targets:[grip,grip,knob],roots:[grip,grip,knob],anchors:[[.035,.06,.06],[.035,.06,.06],[.02,0,.075]] as [number,number,number][]}
}
