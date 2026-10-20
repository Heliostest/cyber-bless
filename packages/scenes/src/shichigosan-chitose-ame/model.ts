import * as THREE from 'three'

/** Original family gift composition; the three motions are an interaction arrangement. */
export function createChitoseAmeModel(){
 const root=new THREE.Group();root.name='chitose-root'
 const subject=new THREE.Group();subject.name='chitose-subject';root.add(subject)
 const mat=(color:number,roughness=.8)=>new THREE.MeshStandardMaterial({color,roughness})
 const stone=mat(0xcac6ac),paper=mat(0xf5e7be),coral=mat(0xd77b76),cream=mat(0xfff6db),skin=mat(0xdba47a),coat=mat(0xd8ac57),pants=mat(0x5f7e78),hair=mat(0x715244),dark=mat(0x443c35),shoe=mat(0x876657),cord=mat(0xc95855),redCandy=mat(0xe48b8b,.34),whiteCandy=mat(0xffefce,.34)
 const mesh=(g:THREE.BufferGeometry,m:THREE.Material,p:THREE.Object3D,name:string)=>{const o=new THREE.Mesh(g,m);o.name=name;o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
 const box=(name:string,size:[number,number,number],pos:[number,number,number],m:THREE.Material,p:THREE.Object3D=subject)=>{const o=mesh(new THREE.BoxGeometry(...size),m,p,name);o.position.set(...pos);return o}
 const ball=(name:string,pos:[number,number,number],scale:[number,number,number],m:THREE.Material,p:THREE.Object3D=subject)=>{const o=mesh(new THREE.SphereGeometry(1,24,24),m,p,name);o.position.set(...pos);o.scale.set(...scale);return o}
 const rod=(name:string,radius:number,m:THREE.Material,p:THREE.Object3D=subject)=>mesh(new THREE.CylinderGeometry(radius,radius,1,24),m,p,name)
 const place=(o:THREE.Mesh,a:THREE.Vector3,b:THREE.Vector3)=>{const d=b.clone().sub(a);o.position.copy(a).add(b).multiplyScalar(.5);o.scale.y=d.length();o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.normalize())}
 const v=(x:number,y:number,z:number)=>new THREE.Vector3(x,y,z)
 const paving=mesh(new THREE.CylinderGeometry(1.18,1.22,.1,64),stone,subject,'chitose-paving');paving.position.y=-.015
 const rest=box('chitose-gift-rest',[.52,.145,.36],[-.56,.1075,.4],stone)
 const bag=new THREE.Group();bag.name='chitose-bag-root';subject.add(bag)
 const floor=box('chitose-bag-floor',[.38,.018,.18],[0,.009,0],paper,bag)
 const front=box('chitose-bag-front',[.38,.65,.012],[0,.343,.084],paper,bag)
 box('chitose-bag-back',[.38,.65,.012],[0,.343,-.084],paper,bag)
 for(const sign of [-1,1])box('chitose-bag-side-'+sign,[.012,.65,.156],[sign*.184,.343,0],paper,bag)
 box('chitose-bag-lower-color',[.34,.12,.006],[0,.10,.093],coral,bag)
 // Original blossom printed as shallow closed relief, with no prescribed symbolic claim.
 for(let i=0;i<5;i++){const a=i/5*Math.PI*2;ball('chitose-bag-flower-'+i,[Math.sin(a)*.043,.37+Math.cos(a)*.043,.095],[.032,.032,.005],coral,bag)}
 ball('chitose-bag-flower-center',[0,.37,.099],[.021,.021,.004],cream,bag)
 const handle=mesh(new THREE.TorusGeometry(.13,.012,12,96),cord,bag,'chitose-handle');handle.position.set(0,.75,.102)
 const grip=rod('chitose-grip',.018,cord,bag);place(grip,v(-.045,.88,.102),v(.045,.88,.102))
 const candies=[-1,1].map((sign,i)=>{const c=mesh(new THREE.CylinderGeometry(.026,.026,.74,24),i===0?redCandy:whiteCandy,bag,'chitose-wrapped-candy-'+i);c.position.set(sign*.065,.388,0);return c})
 for(const [i,x]of [-.065,.065].entries()){
  // Flattened sealed wrapper ends and a neck band remain visible above the bag mouth.
  box('chitose-wrapper-seal-'+i,[.054,.038,.014],[x,.765,0],cream,bag)
  const collar=mesh(new THREE.TorusGeometry(.025,.003,12,24),cream,bag,'chitose-wrapper-band-'+i);collar.rotation.x=Math.PI/2;collar.position.set(x,.735,0)
  for(let j=0;j<3;j++)box('chitose-wrapper-crimp-'+i+'-'+j,[.003,.027,.002],[x+(j-1)*.012,.769,.008],coral,bag)
 }
 const child=new THREE.Group();child.name='chitose-child';subject.add(child)
 for(const [i,x]of [.295,.505].entries()){
  ball('chitose-shoe-'+i,[x,.08,.035],[.083,.045,.14],shoe,child)
  const leg=rod('chitose-trouser-leg-'+i,.067,pants,child);place(leg,v(x,.12,0),v(x,.64,0))
 }
 ball('chitose-hips',[.4,.65,0],[.19,.16,.12],pants,child)
 ball('chitose-coat',[.4,.94,0],[.22,.30,.145],coat,child)
 const neck=rod('chitose-neck',.062,skin,child);place(neck,v(.4,1.16,0),v(.4,1.30,0))
 ball('chitose-head',[.4,1.43,0],[.17,.20,.15],skin,child)
 ball('chitose-hair',[.4,1.572,-.025],[.159,.075,.138],hair,child)
 for(const [i,x]of [.225,.575].entries())ball('chitose-ear-'+i,[x,1.43,0],[.026,.047,.033],skin,child)
 ball('chitose-nose',[.4,1.408,.150],[.024,.030,.023],skin,child)
 for(const [i,x]of [.34,.46].entries())ball('chitose-eye-'+i,[x,1.46,.1425],[.009,.013,.005],dark,child)
 const smile=rod('chitose-smile',.005,dark,child);place(smile,v(.375,1.35,.139),v(.425,1.35,.139))
 const elbows=[v(.14,1.20,.13),v(.66,1.20,.13)]
 const upperArms=[rod('chitose-sleeve-0',.069,coat,child),rod('chitose-sleeve-1',.069,coat,child)]
 const forearms=[rod('chitose-forearm-0',.022,skin,child),rod('chitose-forearm-1',.022,skin,child)]
 const palms=[ball('chitose-palm-0',[0,0,0],[.035,.035,.035],skin,child),ball('chitose-palm-1',[0,0,0],[.035,.035,.035],skin,child)]
 for(let i=0;i<2;i++){place(upperArms[i]!,v(i===0?.18:.62,1.10,0),elbows[i]!);ball('chitose-elbow-'+i,elbows[i]!.toArray() as [number,number,number],[.043,.043,.043],skin,child)}
 const angles=[2*Math.PI/3,Math.PI/3],contacts=angles.map(a=>v(Math.cos(a)*.13,Math.sin(a)*.13,0))
 const finalHands=angles.map(a=>v(.4+Math.cos(a)*.083,.42+.75+Math.sin(a)*.083,.4+.102))
 const waiting=[v(.24,1.25,.17),v(.56,1.25,.17)]
 const positions=[v(-.56,.18,.4),v(-.56,.64,.4),v(.4,.64,.4),v(.4,.42,.4)]
 const pose=(step:number,t:number)=>{
  const s=THREE.MathUtils.clamp(Math.floor(step),0,3),n=THREE.MathUtils.clamp(t,0,1)
  bag.position.copy(positions[s]!)
  if(s<2)bag.position.lerp(positions[s+1]!,n)
  if(s===2)bag.position.lerp(positions[3]!,Math.min(n*2,1))
  const reach=s===3?1:s===2?Math.max(0,n*2-1):0
  for(let i=0;i<2;i++){
   // Align behind the opening before reaching through it to support the cord.
   const aligned=finalHands[i]!.clone();aligned.z=waiting[i]!.z
   palms[i]!.position.copy(waiting[i]!).lerp(aligned,Math.min(reach*2,1))
   if(reach>.5)palms[i]!.position.lerp(finalHands[i]!,reach*2-1)
   place(forearms[i]!,elbows[i]!,palms[i]!.position)
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return {root,subject,bag,handle,grip,candies,child,palms,contacts,rest,floor,front,pose,targets:[grip,grip,grip],roots:[bag,bag,bag],anchors:[new THREE.Vector3(0,0,.025),new THREE.Vector3(0,0,.025),new THREE.Vector3(0,0,.025)]}
}
