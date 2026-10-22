import * as THREE from 'three'

/** Original doorway, decorated willow and gift; no named person's likeness or copied patterns. */
export function createVirpominenModel(){
 const root=new THREE.Group();root.name='virpominen-subject'
 const material=(color:number,roughness=.85,metalness=0)=>new THREE.MeshStandardMaterial({color,roughness,metalness})
 const bark=material(0x806746),willow=material(0xe4e2ce),blue=material(0x699b9a),wood=material(0xb3a27b),stone=material(0xc8c9b5),inside=material(0xe3dcc1),skin=material(0xe9b18a),yellow=material(0xf2ce78),pink=material(0xea918e),paper=material(0xf1e8bf),foil=material(0xd75e79,.5,.15)
 const clean=(source:THREE.BufferGeometry)=>{const raw=source.index?source.toNonIndexed():source,p=raw.getAttribute('position'),v:number[]=[];for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);if(new THREE.Triangle(a,b,c).getArea()>1e-12)v.push(...a.toArray(),...b.toArray(),...c.toArray())}const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.computeVertexNormals();if(raw!==source)raw.dispose();source.dispose();return g}
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(clean(g),m);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const ball=(name:string,p:number[],s:number[],mat:THREE.Material,parent:THREE.Object3D=root)=>{const o=mesh(name,new THREE.SphereGeometry(1,20,12),mat,parent);o.position.set(...p as [number,number,number]);o.scale.set(...s as [number,number,number]);return o}
 const box=(name:string,p:number[],s:number[],mat:THREE.Material)=>{const o=mesh(name,new THREE.BoxGeometry(...s as [number,number,number]),mat);o.position.set(...p as [number,number,number]);return o}
 const tube=(name:string,curve:THREE.Curve<THREE.Vector3>,radius:number,mat:THREE.Material,parent:THREE.Object3D=root,segments=24)=>{
  const radial=10,source=new THREE.TubeGeometry(curve,segments,radius,radial,false),positions=source.getAttribute('position'),raw=source.toNonIndexed(),values=Array.from(raw.getAttribute('position').array)
  const face=(a:THREE.Vector3,b:THREE.Vector3,c:THREE.Vector3)=>values.push(...a.toArray(),...b.toArray(),...c.toArray())
  for(let j=0;j<radial;j++){face(curve.getPoint(0),new THREE.Vector3().fromBufferAttribute(positions,j),new THREE.Vector3().fromBufferAttribute(positions,j+1));face(curve.getPoint(1),new THREE.Vector3().fromBufferAttribute(positions,segments*(radial+1)+j+1),new THREE.Vector3().fromBufferAttribute(positions,segments*(radial+1)+j))}
  source.dispose();raw.dispose();const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(values,3));return mesh(name,g,mat,parent)
 }
 const threshold=box('stone-doorstep',[.40,.07,-.31],[2.12,.14,1.12],stone)
 for(const x of[-.46,1.26])box('painted-door-jamb-'+x,[x,1.14,-.59],[.13,2.0,.17],blue)
 box('painted-lintel',[.40,2.17,-.59],[1.85,.12,.17],blue)
 box('interior-wall',[.40,1.12,-.86],[1.6,1.96,.1],inside)
 box('door-inner-floor',[.40,.17,-.62],[1.6,.06,.40],wood)
 for(const x of[-.33,1.13])box('door-inset-shadow-'+x,[x,1.12,-.75],[.045,1.9,.10],wood)

 const branch=new THREE.Group();branch.name='decorated-willow';root.add(branch)
 const stem=mesh('willow-stem',new THREE.CylinderGeometry(.012,.018,1.10,12),bark,branch);stem.position.y=.30
 for(const [i,side,height]of[[0,-1,.40],[1,1,.49],[2,-1,.64]]){
  const curve=new THREE.CatmullRomCurve3([new THREE.Vector3(0,height,0),new THREE.Vector3(side*.11,height+.12,.01),new THREE.Vector3(side*.21,height+.30,.02)])
  tube('willow-fork-'+i,curve,.008,bark,branch,14)
  for(let n=0;n<3;n++){const q=curve.getPoint(.40+n*.27);const bud=ball(`pussy-willow-${i}-${n}`,[q.x+side*.014,q.y,q.z+.014],[.025,.042,.022],willow,branch);bud.rotation.z=-side*.35}
 }
 for(const [i,y]of[[0,.46],[1,.79]]){
  const x=i===0?-.13:.10,flower=new THREE.Group();flower.name='paper-flower-'+i;flower.position.set(x,y,.04);branch.add(flower)
  for(let petal=0;petal<5;petal++){const a=petal/5*Math.PI*2,o=ball(`paper-petal-${i}-${petal}`,[Math.cos(a)*.054,Math.sin(a)*.054,0],[.045,.026,.010],i?pink:yellow,flower);o.rotation.z=a}
  ball('paper-flower-centre-'+i,[0,0,.013],[.025,.025,.012],paper,flower)
  const tie=mesh('paper-tie-'+i,new THREE.BoxGeometry(.025,.13,.009),i?yellow:pink,branch);tie.position.set(x,y-.09,.035);tie.rotation.z=i?.25:-.25
 }
 const makeHand=(name:string,kind:'stem'|'egg',cloth:THREE.Material)=>{
  const hand=new THREE.Group();hand.name=name;root.add(hand)
  const fingers=new THREE.Group();fingers.name=name+'-fingers';hand.add(fingers)
  const back=kind==='stem'?.07:.145,palm=ball(name+'-palm',[0,0,-back],[kind==='stem'?.09:.11,.13,.04],skin,hand),cuff=ball(name+'-cuff',[.12,-.06,-back],[.075,.07,.055],cloth,hand)
  for(let i=0;i<4;i++){
   const y=-.075+i*.05,r=kind==='stem'?.033:.09*Math.sqrt(1-(y/.13)**2)+.015
   const points=Array.from({length:19},(_,j)=>{const a=.75*Math.PI+j/18*1.5*Math.PI;return new THREE.Vector3(Math.cos(a)*r,y,Math.sin(a)*r)})
   tube(name+'-finger-'+i,new THREE.CatmullRomCurve3(points),.014,skin,fingers,24)
  }
  const open=(n:number)=>{fingers.scale.set(1+.5*n,1,1+.5*n);palm.position.z=-back-.04*n;cuff.position.z=palm.position.z}
  open(0);return{root:hand,open}
 }
 const visitor=makeHand('visitor-hand','stem',yellow),receiver=makeHand('receiving-hand','stem',blue),giver=makeHand('gift-hand','egg',blue)
 const childOrigin=new THREE.Vector3(-.68,.78,.66),childOffset=new THREE.Vector3(0,-.09,0),childRest=new THREE.Vector3(-1.02,.66,1.15),receiveOrigin=new THREE.Vector3(.73,.78,-.02),giftStart=new THREE.Vector3(.99,.83,.31)
 const receivingGrip=receiveOrigin.clone().add(new THREE.Vector3(0,.24,0)),receivingWait=receivingGrip.clone().add(new THREE.Vector3(0,0,-.30))
 const basket=new THREE.Group();basket.name='visitor-basket';basket.position.set(-.65,0,.82);root.add(basket)
 const base=mesh('basket-solid-base',new THREE.CylinderGeometry(1,1,.08,40),wood,basket);base.position.y=.06;base.scale.set(.40,1,.30)
 for(let i=0;i<32;i++){const a=i/32*Math.PI*2,o=mesh('basket-upright-'+i,new THREE.CylinderGeometry(.012,.013,.20,8),wood,basket);o.position.set(.41*Math.cos(a),.20,.31*Math.sin(a))}
 for(let i=0;i<4;i++){const rim=mesh('basket-woven-ring-'+i,new THREE.TorusGeometry(.41,.014,8,48),wood,basket);rim.rotation.x=Math.PI/2;rim.scale.y=.31/.41;rim.position.y=.13+i*.055}
 const egg=new THREE.Group();egg.name='wrapped-chocolate-egg';root.add(egg)
 const eggBody=ball('foil-egg-body',[0,0,0],[.09,.13,.09],foil,egg)
 const seam=mesh('foil-egg-seam',new THREE.TorusGeometry(.0903,.003,6,40),paper,egg);seam.rotation.x=Math.PI/2
 const floorY=.10,eggEnd=new THREE.Vector3(basket.position.x,floorY+.13,basket.position.z)
 const lerp=(a:THREE.Vector3,b:THREE.Vector3,n:number)=>a.clone().lerp(b,THREE.MathUtils.clamp(n,0,1))
 const pose=(step:number,amount:number)=>{
  const t=step>=3?1:THREE.MathUtils.clamp(amount,0,1)
  branch.position.copy(childOrigin);branch.rotation.set(0,0,0);visitor.open(0);receiver.open(1);receiver.root.position.copy(receivingWait);giver.open(0);egg.position.copy(giftStart);giver.root.position.copy(giftStart)
  if(step===0)branch.rotation.z=-.34*Math.sin(t*Math.PI)
  else if(step===1){
   branch.position.copy(lerp(childOrigin,receiveOrigin,t/.70))
   receiver.root.position.copy(lerp(receivingWait,receivingGrip,(t-.70)/.10))
   receiver.open(1-THREE.MathUtils.clamp((t-.80)/.05,0,1))
  }
  else{branch.position.copy(receiveOrigin);receiver.root.position.copy(receivingGrip);receiver.open(0)}
  visitor.root.quaternion.copy(branch.quaternion);visitor.root.position.copy(childOffset).applyQuaternion(branch.quaternion).add(branch.position)
  if(step===1&&t>.85){
   visitor.open(THREE.MathUtils.clamp((t-.85)/.05,0,1))
   const grip=receiveOrigin.clone().add(childOffset),clear=grip.clone().add(new THREE.Vector3(0,0,-.30))
   if(t>.90&&t<.95)visitor.root.position.copy(lerp(grip,clear,(t-.90)/.05))
   else if(t>=.95)visitor.root.position.copy(lerp(clear,childRest,(t-.95)/.05))
  }
  else if(step>=2){visitor.root.position.copy(childRest);visitor.open(1)}
  if(step>=2){
   const high=giftStart.clone().setY(1.25),over=new THREE.Vector3(eggEnd.x,1.25,eggEnd.z)
   if(t<.25)egg.position.copy(lerp(giftStart,high,t/.25))
   else if(t<.60)egg.position.copy(lerp(high,over,(t-.25)/.35))
   else if(t<.80)egg.position.copy(lerp(over,eggEnd,(t-.60)/.20))
   else egg.position.copy(eggEnd)
   giver.root.position.copy(egg.position)
   if(t>=.80)giver.open(THREE.MathUtils.clamp((t-.80)/.10,0,1))
   if(t>=.90&&t<.95)giver.root.position.copy(lerp(eggEnd,eggEnd.clone().setY(.83),(t-.90)/.05))
   else if(t>=.95)giver.root.position.copy(lerp(eggEnd.clone().setY(.83),giftStart,(t-.95)/.05))
  }
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,branch,stem,visitor,receiver,giver,egg,eggBody,basket,base,threshold,eggEnd,targets:[branch,branch,egg],roots:[branch,branch,egg],anchors:[[0,.40,0],[0,.40,0],[0,0,0]] as [number,number,number][],pose,dispose(){}}
}
