import * as THREE from 'three'

/** Closed original vessels and serving motion; not a traditional utensil specification. */
export function createNanakusaModel() {
 const root=new THREE.Group();root.name='nanakusa-subject'
 const material=(color:number)=>new THREE.MeshStandardMaterial({color,roughness:.78})
 const ceramic=material(0x48695e),cream=material(0xf2ead0),leaf=material(0x547d48),wood=material(0xb47c46),boardMat=material(0xd2b58a),bowlMat=material(0x679c98),light=material(0xd7e0cc)
 const closed=(source:THREE.BufferGeometry)=>{
  const g=source.index?source.toNonIndexed():source,p=g.getAttribute('position'),values:number[]=[];let volume=0
  for(let i=0;i<p.count;i+=3){const a=new THREE.Vector3().fromBufferAttribute(p,i),b=new THREE.Vector3().fromBufferAttribute(p,i+1),c=new THREE.Vector3().fromBufferAttribute(p,i+2);if(new THREE.Triangle(a,b,c).getArea()<=1e-12)continue;values.push(...a.toArray(),...b.toArray(),...c.toArray());volume+=a.dot(b.clone().cross(c))/6}
  if(volume<0)for(let i=0;i<values.length;i+=9)for(let k=0;k<3;k++)[values[i+3+k],values[i+6+k]]=[values[i+6+k]!,values[i+3+k]!]
  const result=new THREE.BufferGeometry();result.setAttribute('position',new THREE.Float32BufferAttribute(values,3));result.computeVertexNormals();if(g!==source)g.dispose();source.dispose();return result
 }
 const mesh=(name:string,g:THREE.BufferGeometry,m:THREE.Material,parent:THREE.Object3D=root)=>{const o=new THREE.Mesh(closed(g),m);o.name=name;o.castShadow=o.receiveShadow=true;parent.add(o);return o}
 const box=(name:string,size:[number,number,number],at:[number,number,number],m:THREE.Material,parent:THREE.Object3D=root)=>{const o=mesh(name,new THREE.BoxGeometry(...size),m,parent);o.position.set(...at);return o}
 const lathe=(name:string,points:number[][],m:THREE.Material,parent:THREE.Object3D=root)=>mesh(name,new THREE.LatheGeometry(points.map(p=>new THREE.Vector2(p[0]!,p[1]!)),32),m,parent)
 const tube=(name:string,a:THREE.Vector3,b:THREE.Vector3,r:number,m:THREE.Material,parent:THREE.Object3D)=>{const o=mesh(name,new THREE.CylinderGeometry(r,r,a.distanceTo(b),10),m,parent);o.position.copy(a).add(b).multiplyScalar(.5);o.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),b.clone().sub(a).normalize());return o}
 const board=box('serving-board',[3.35,.07,2.9],[0,.035,.15],boardMat)
 box('board-front-binding',[3.35,.025,.035],[0,.057,1.595],wood)
 const pot=lathe('porridge-pot',[[0,0],[.50,0],[.68,.10],[.74,.52],[.72,.70],[.65,.70],[.67,.51],[.61,.13],[0,.13]],ceramic);pot.position.set(-.55,.07,-.36)
 for(const sign of[-1,1])box(`pot-handle-${sign}`,[.25,.11,.24],[-.55+sign*.82,.55,-.36],ceramic)
 const potBand=mesh('pot-rim-band',new THREE.TorusGeometry(.69,.012,6,48),light);potBand.rotation.x=Math.PI/2;potBand.position.set(-.55,.771,-.36)
 const bowl=lathe('receiving-bowl',[[0,0],[.25,0],[.40,.06],[.48,.25],[.50,.37],[.46,.37],[.43,.25],[.34,.10],[0,.10]],bowlMat);bowl.position.set(.70,.07,.62)
 const bowlBand=mesh('bowl-rim-band',new THREE.TorusGeometry(.48,.012,6,40),light);bowlBand.rotation.x=Math.PI/2;bowlBand.position.set(.70,.441,.62)
 const stock=mesh('pot-porridge',new THREE.CylinderGeometry(.61,.61,1,32),cream);stock.position.set(-.55,.39,-.36)
 const potGarnish=new THREE.Group();potGarnish.name='pot-rice-and-greens';root.add(potGarnish);potGarnish.position.set(-.55,.58,-.36)
 function garnish(parent:THREE.Object3D,prefix:string,radius:number,riceCount:number,greenCount:number,height=0){
  for(let i=0;i<riceCount+greenCount;i++){const a=i*2.3999632297,r=radius*Math.sqrt((i+.5)/(riceCount+greenCount)),green=i>=riceCount,o=mesh(`${prefix}-${green?'green':'rice'}-${i}`,new THREE.SphereGeometry(1,6,4),green?leaf:cream,parent);o.position.set(Math.cos(a)*r,height+(green?.004:.008),Math.sin(a)*r);o.scale.set(green?.038:.017,green?.006:.009,green?.019:.035);o.rotation.y=a}
 }
 garnish(potGarnish,'pot',.565,44,23)
 const ladle=new THREE.Group();ladle.name='serving-ladle';root.add(ladle)
 const head=lathe('ladle-head',[[0,-.09],[.10,-.09],[.17,-.05],[.21,.025],[.22,.08],[.185,.08],[.17,.025],[.12,-.04],[0,-.055]],wood,ladle)
 const handle=tube('ladle-handle',new THREE.Vector3(0,.02,.16),new THREE.Vector3(0,.60,.98),.035,wood,ladle)
 const grip=mesh('ladle-grip',new THREE.SphereGeometry(1,8,6),wood,ladle);grip.position.set(0,.60,.98);grip.scale.set(.050,.045,.075);grip.quaternion.copy(handle.quaternion)
 const payload=new THREE.Group();payload.name='ladle-porridge';ladle.add(payload)
 lathe('ladle-loaded-porridge',[[0,-.052],[.09,-.034],[.145,0],[.16,.027],[0,.027]],cream,payload)
 garnish(payload,'loaded',.105,9,6,.022)
 const spout=new THREE.Vector3(.23,.115,0),bend=new THREE.Vector3(.18,.115,0)
 const bridge=new THREE.Group();bridge.name='porridge-over-lip';ladle.add(bridge)
 const throat=mesh('porridge-throat',new THREE.CylinderGeometry(.025,.025,1,10),cream,bridge)
 const outlet=tube('porridge-outlet',bend,spout,.025,cream,bridge)
 const bendFood=mesh('porridge-bend',new THREE.SphereGeometry(.025,8,6),cream,bridge);bendFood.position.copy(bend)
 const served=new THREE.Group();served.name='served-porridge';served.position.set(.70,.17,.62);root.add(served)
 const bowlSoup=mesh('bowl-porridge',new THREE.CylinderGeometry(.35,.31,1,32),cream,served)
 const bowlGarnish=new THREE.Group();bowlGarnish.name='served-rice-and-greens';served.add(bowlGarnish);garnish(bowlGarnish,'served',.31,16,11)
 const stream=mesh('pouring-porridge',new THREE.CylinderGeometry(.026,.035,1,10),cream)
 const park=new THREE.Vector3(1.38,0,-.85);ladle.rotation.x=.55;ladle.position.copy(park);root.updateMatrixWorld(true);park.y=.095-new THREE.Box3().setFromObject(head,true).min.y;ladle.position.copy(park);root.updateMatrixWorld(true)
 function lowest(o:THREE.Mesh){const p=o.geometry.getAttribute('position');let best=new THREE.Vector3(0,Infinity,0);for(let i=0;i<p.count;i++){const v=new THREE.Vector3().fromBufferAttribute(p,i).applyMatrix4(o.matrixWorld);if(v.y<best.y)best=v}return best}
 const headPoint=lowest(head),tailPoint=lowest(grip)
 const rest=(name:string,p:THREE.Vector3,width:number)=>box(name,[width,p.y-.07,.18],[p.x,(p.y+.07)/2,p.z],light)
 const headRest=rest('ladle-head-rest',headPoint,.24),tailRest=rest('ladle-tail-rest',tailPoint,.20)
 const potHead=new THREE.Vector3(-.55,.52,-.36),ready=new THREE.Vector3(.70,1.04,.62),parkHigh=new THREE.Vector3(park.x,1.12,park.z),v=new THREE.Vector3()
 const clamp=(n:number)=>THREE.MathUtils.clamp(n,0,1),mix=(a:THREE.Vector3,b:THREE.Vector3,t:number)=>ladle.position.copy(a).lerp(b,clamp(t))
 let received=0
 const bowlSurface=()=>.17+.10*received
 function pose(step:number,t:number){
  t=clamp(t);let taken=0;received=0;ladle.position.copy(park);ladle.rotation.set(.55,0,0);potGarnish.rotation.y=0
  if(step===0){
   if(t<.24){mix(park,parkHigh,t/.24);ladle.rotation.x=.55*(1-t/.24)}
   else if(t<.66){mix(parkHigh,new THREE.Vector3(potHead.x,1.12,potHead.z),(t-.24)/.42);ladle.rotation.x=0}
   else if(t<.86){mix(new THREE.Vector3(potHead.x,1.12,potHead.z),potHead,(t-.66)/.20);ladle.rotation.x=0}
   else{const a=(t-.86)/.14*Math.PI*2;ladle.position.copy(potHead).add(v.set(.12*Math.sin(a),0,.06*(1-Math.cos(a))));ladle.rotation.x=0;potGarnish.rotation.y=.20*Math.sin(a)}
  }else if(step===1){
   ladle.rotation.set(0,0,0);if(t<.4)mix(potHead,new THREE.Vector3(potHead.x,ready.y,potHead.z),t/.4);else mix(new THREE.Vector3(potHead.x,ready.y,potHead.z),ready,(t-.4)/.6)
   taken=clamp((ladle.position.y-potHead.y)/.08)
  }else if(step===2){
   taken=1;received=clamp((t-.34)/.36);ladle.position.copy(ready);ladle.rotation.set(0,0,-1.25*clamp(t/.4))
   if(t>=.70&&t<.82){const q=(t-.70)/.12;ladle.position.y=THREE.MathUtils.lerp(ready.y,parkHigh.y,q);ladle.rotation.z=-1.25*(1-q)}
   else if(t>=.82&&t<.92){const q=(t-.82)/.10;mix(new THREE.Vector3(ready.x,parkHigh.y,ready.z),parkHigh,q);ladle.rotation.set(.55*q,0,0)}
   else if(t>=.92){mix(parkHigh,park,(t-.92)/.08);ladle.rotation.set(.55,0,0)}
  }else if(step>=3){taken=received=1}
  const level=.58-.025*taken;stock.position.y=(.20+level)/2;stock.scale.y=level-.20;potGarnish.position.y=level
  payload.visible=taken-received>1e-8;const portion=Math.cbrt(Math.max(1e-18,taken-received));payload.scale.setScalar(portion)
  served.visible=received>1e-8;const servingWidth=.90+.10*received;bowlSoup.scale.set(servingWidth,Math.max(1e-6,.10*received),servingWidth);bowlSoup.position.y=.05*received;bowlGarnish.position.y=.10*received;bowlGarnish.scale.set(servingWidth,received,servingWidth)
  stream.visible=step===2&&t>.34&&t<.70;bridge.visible=stream.visible
  const mouth=new THREE.Vector3(.10*portion,.025*portion,0),flow=stream.visible?Math.sqrt(Math.max(0,Math.sin(Math.PI*received))):0
  throat.position.copy(mouth).add(bend).multiplyScalar(.5);throat.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),bend.clone().sub(mouth).normalize());throat.scale.set(flow,mouth.distanceTo(bend),flow)
  outlet.scale.x=outlet.scale.z=flow;bendFood.scale.setScalar(flow)
  root.updateMatrixWorld(true)
  if(stream.visible){const top=spout.clone().applyMatrix4(ladle.matrixWorld),bottom=bowlSurface();stream.position.set(top.x,(top.y+bottom)/2,top.z);stream.scale.set(flow,top.y-bottom,flow)}else{stream.position.set(0,.10,0);stream.scale.set(1,1e-6,1)}
  root.updateMatrixWorld(true)
 }
 pose(0,0)
 return{root,board,pot,bowl,ladle,head,handle,headRest,tailRest,park,payload,stock,served,stream,spout,pose,bowlSurface,targets:[ladle,ladle,ladle],roots:[ladle,ladle,ladle],anchors:[[0,.42,.72],[0,.42,.72],[0,.42,.72]] as [number,number,number][],dispose(){}}
}
